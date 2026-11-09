"""Makes the audio of one studio lesson (lessons kept in the site's database).

The site starts .github/workflows/studio-voice.yml with a job id and a one-time token;
this script fetches the script from the site, speaks every line with the cast's voices
(the same engine as studio.py: Piper offline, or Azure when a voice is "azure:…"),
and sends the MP3 and the exact line timings back.

  python3 _studio/job.py <api base> <job id> <token>
"""
import json, sys, time, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import studio  # noqa: E402

API, JOB, TOKEN = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3]


def call(method, path, body=None, ctype="application/json"):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    req = urllib.request.Request(f"{API}/api/studio/jobs/{JOB}{path}", data, method=method, headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": ctype, "X-LAPP": "1", "User-Agent": "lapp-studio-job"})
    with urllib.request.urlopen(req, timeout=120) as r:
        t = r.read()
        return json.loads(t) if t else {}


def report(status, log):
    try: call("POST", "/status", {"status": status, "log": log[-4000:]})
    except Exception as e: print("status not sent:", e)


def main():
    import numpy as np
    d = call("GET", "")
    lines = [(si, li, ln) for si, sc in enumerate(d["scenes"]) for li, ln in enumerate(sc["lines"])]
    if not lines: report("failed", "the script has no lines"); sys.exit(1)
    for *_, ln in lines:
        if ln.get("who") not in d["cast"]: report("failed", f"speaker {ln.get('who')} has no voice"); sys.exit(1)
    report("running", f"0/{len(lines)} lines")
    R = studio.RATE
    parts, timings, t = [np.zeros(int(0.4 * R), np.float32)], [], 0.4
    n, last = 0, 0
    for si, sc in enumerate(d["scenes"]):
        if si:
            gap = d.get("scenePause", 1.4); parts.append(np.zeros(int(gap * R), np.float32)); t += gap
        for li, ln in enumerate(sc["lines"]):
            x = studio.clip(d, ln); n += 1
            dur = len(x) / R
            timings.append([round(t, 2), round(t + dur, 2)])
            parts.append(x); t += dur
            gap = ln.get("pause", d.get("pause", 0.6))
            parts.append(np.zeros(int(gap * R), np.float32)); t += gap
            if time.time() - last > 8: report("running", f"{n}/{len(lines)} lines"); last = time.time()
    audio = np.concatenate(parts)
    audio = audio * min(1.0, 0.89 / (np.abs(audio).max() or 1))
    out = Path("/tmp/lesson.mp3"); studio.write_mp3(out, audio)
    call("PUT", "/audio?timings=" + urllib.request.quote(json.dumps(timings)), out.read_bytes(), "audio/mpeg")
    print(f"✓ {n} lines · {round(len(audio) / R / 60, 1)} min")


if __name__ == "__main__":
    try: main()
    except SystemExit: raise
    except Exception as e:
        report("failed", repr(e)); raise
