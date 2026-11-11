"""Makes the audio of one studio lesson (lessons kept in the site's database) — the voice desk's worker.

The site starts .github/workflows/studio-voice.yml with a job id and a one-time token. This script asks the
site what to do:
  mode "lines": make new takes of some lines and send each clip back (nothing is mixed)
  mode "mix":   make the clips that are missing (only lines that changed), fetch the others, then mix the
                speech with the lesson's tracks (music, ambience, effects: trims, volume, fades, loops,
                lowered under speech) and send the MP3, the line timings and the word timings back.

  python3 _studio/job.py <api base> <job id> <token>
"""
import io, json, subprocess, sys, time, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import studio  # noqa: E402

API, JOB, TOKEN = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3]
R = studio.RATE


def call(method, path, body=None, ctype="application/json", raw=False):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    req = urllib.request.Request(f"{API}/api/studio/jobs/{JOB}{path}", data, method=method, headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": ctype, "X-LAPP": "1", "User-Agent": "lapp-studio-job"})
    with urllib.request.urlopen(req, timeout=300) as r:
        t = r.read()
        return t if raw else (json.loads(t) if t else {})


def report(status, log):
    try: call("POST", "/status", {"status": status, "log": log[-4000:]})
    except Exception as e: print("status not sent:", e)


def decode(data):
    """any sound file (mp3, wav, webm, ogg, m4a …) → mono float32 at RATE"""
    import av, numpy as np
    c = av.open(io.BytesIO(data))
    res = av.AudioResampler(format="fltp", layout="mono", rate=R)
    out = []
    for f in c.decode(c.streams.audio[0]):
        for g in res.resample(f): out.append(g.to_ndarray()[0])
    for g in res.resample(None): out.append(g.to_ndarray()[0])
    c.close()
    return np.concatenate(out).astype(np.float32) if out else np.zeros(0, np.float32)


def mp3(x):
    p = Path("/tmp/lapp-clip.mp3"); studio.write_mp3(p, x); return p.read_bytes()


def needs_chatterbox(lines):
    if not any(ln["voice"].startswith("chatterbox:") for ln in lines): return
    try:
        import chatterbox  # noqa: F401
    except ImportError:
        report("running", "installing the natural voice (Chatterbox) — the first time takes a few minutes")
        pip = [sys.executable, "-m", "pip", "install", "-q"]
        subprocess.check_call(pip + ["torch==2.6.0", "torchaudio==2.6.0", "--index-url", "https://download.pytorch.org/whl/cpu"])
        subprocess.check_call(pip + ["chatterbox-tts"])


def words_of(text, start, end):
    """when each word of a line is heard: the line's time shared by the length of its words"""
    ws = text.split()
    if not ws: return []
    pad = min(0.12, (end - start) / 4)
    a, b = start + pad, end - pad
    weight = [len(w) + 1 for w in ws]; tot = sum(weight); out, t = [], a
    for w in weight:
        d = (b - a) * w / tot; out.append([round(t, 2), round(t + d, 2)]); t += d
    return out


def fade(seg, n, up):
    import numpy as np
    n = min(n, len(seg))
    if n <= 0: return seg
    ramp = np.linspace(0, 1, n, dtype=np.float32) if up else np.linspace(1, 0, n, dtype=np.float32)
    if up: seg[:n] *= ramp
    else: seg[len(seg) - n:] *= ramp
    return seg


def main():
    import numpy as np
    d = call("GET", "")
    lines = [ln for sc in d["scenes"] for ln in sc["lines"]]
    if not lines: report("failed", "the script has no lines"); sys.exit(1)
    make = [ln for ln in lines if ln["make"]]
    needs_chatterbox(make)
    # the recordings of cloned voices
    for vid in d.get("voices", []):
        p = Path(f"/tmp/lapp-voice-{vid}.wav")
        if not p.exists(): studio.write_wav(p, decode(call("GET", f"/voice/{vid}", raw=True)))
        studio.REFS[f"v{vid}"] = str(p)
    report("running", f"0/{len(make)} lines to make")
    clips, last = {}, 0
    for n, ln in enumerate(make, 1):
        x = studio.trim(studio.synth(ln["voice"], ln["text"], ln["speed"], ln["pitch"], ln["feel"], lang=d["course"], exag=ln.get("exag")))
        call("PUT", f"/clip/{ln['key']}?dur={round(len(x) / R, 2)}", mp3(x), "audio/mpeg")
        clips[ln["key"]] = x
        if time.time() - last > 8: report("running", f"{n}/{len(make)} lines made"); last = time.time()
    if d["mode"] == "lines":
        report("done", f"{len(make)} new take{'s' if len(make) != 1 else ''}"); print(f"✓ {len(make)} takes"); return

    # ---- the speech: every line's clip in order, with the pauses between lines and scenes
    report("running", "mixing")
    parts, timings, words, t = [np.zeros(int(0.4 * R), np.float32)], [], [], 0.4
    for si, sc in enumerate(d["scenes"]):
        if si:
            gap = d.get("scenePause", 1.4); parts.append(np.zeros(int(gap * R), np.float32)); t += gap
        for ln in sc["lines"]:
            x = clips.get(ln["use"])
            if x is None:
                x = decode(call("GET", f"/clip/{ln['use']}", raw=True))
                if ln["use"].startswith("mic-"): x = studio.trim(x * (0.7 / (np.abs(x).max() or 1)))   # a recording: as loud as the voices
            dur = len(x) / R
            timings.append([round(t, 2), round(t + dur, 2)]); words.append(words_of(ln["shown"], t, t + dur))
            parts.append(x); t += dur
            gap = ln.get("pause") if ln.get("pause") is not None else d.get("pause", 0.6)
            parts.append(np.zeros(int(gap * R), np.float32)); t += gap
    speech = np.concatenate(parts)

    # ---- the other tracks: sound files placed on the timeline
    media = {m["id"]: m for m in d.get("media", [])}
    cache, beds = {}, []
    for tr in d.get("tracks", []):
        if tr.get("mute") or not tr.get("clips"): continue
        buf = np.zeros(len(speech), np.float32)
        for c in tr["clips"]:
            mid = c.get("media")
            if mid not in media: continue
            if mid not in cache: cache[mid] = decode(call("GET", f"/media/{mid}", raw=True))
            src = cache[mid]
            a = int(max(0, c.get("start") or 0) * R); b = int(c["end"] * R) if c.get("end") else len(src)
            seg = src[a:max(a, b)].copy()
            if not len(seg): continue
            at = int(max(0, c.get("at") or 0) * R)
            if c.get("loop"):   # under the whole lesson: repeated until the speech ends
                need = max(len(seg), len(speech) - at); seg = np.tile(seg, need // len(seg) + 1)[:need]
            seg *= float(c.get("gain", 1)) * float(tr.get("gain", 1))
            seg = fade(fade(seg, int(float(c.get("fadeIn") or 0) * R), True), int(float(c.get("fadeOut") or 0) * R), False)
            if at + len(seg) > len(buf): buf = np.concatenate([buf, np.zeros(at + len(seg) - len(buf), np.float32)])
            buf[at:at + len(seg)] += seg
        beds.append((buf, tr.get("duck", tr.get("kind") in ("music", "ambience"))))

    total = max([len(speech)] + [len(b) for b, _ in beds])
    mix = np.zeros(total, np.float32); mix[:len(speech)] += speech
    if beds:
        # lowered under speech: where someone speaks (smoothed over 0.25 s), the track is about 10 dB quieter
        env = np.zeros(total, np.float32); env[:len(speech)] = (np.abs(speech) > 0.02).astype(np.float32)
        k = int(0.25 * R); env = np.convolve(env, np.ones(k, np.float32) / k, mode="same").clip(0, 1)
        for b, duck in beds:
            b = np.concatenate([b, np.zeros(total - len(b), np.float32)])
            mix += b * (1 - 0.68 * env) if duck else b
    mix = mix * min(1.0, 0.89 / (np.abs(mix).max() or 1))
    call("POST", "/timings", {"timings": timings, "words": words})
    call("PUT", "/audio", mp3(mix), "audio/mpeg")
    print(f"✓ {len(lines)} lines ({len(make)} made) · {len(beds)} tracks · {round(total / R / 60, 1)} min")


if __name__ == "__main__":
    try: main()
    except SystemExit: raise
    except Exception as e:
        report("failed", repr(e)); raise
