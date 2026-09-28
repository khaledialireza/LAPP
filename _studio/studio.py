#!/usr/bin/env python3
"""LAPP Studio engine — writes our own lessons, stories and conversations.

This folder starts with "_", so GitHub Pages (Jekyll) never publishes it: the
studio lives in the repository but not on the site.

A piece of content is a draft in _studio/drafts/<slug>/draft.json. It moves:

    new      → an empty draft with a brief
    prompt   → the text to give an AI writer (Claude, ChatGPT …); its JSON answer
    import   → goes back into the draft
    check    → validates it: every line translated, speakers cast, sentence length
               for the level, words the dictionary does not know yet
    voice    → speaks every line with the speaker's voice, joins the clips with
               pauses and writes audio.mp3 + exact timings (no alignment needed)
    serve    → a local review page: read, listen per line, edit, approve
    publish  → writes content/lessons/<NN-slug>/ and adds it to content/index.json

Voices: "piper:<name>" runs offline (downloaded once into _studio/.voices);
"azure:<voice>" uses Azure Speech when AZURE_SPEECH_KEY and AZURE_SPEECH_REGION
are set.

    python3 _studio/studio.py new im-hotel --type talk --level A1 --title "Im Hotel"
"""
import argparse, glob, hashlib, json, os, re, shutil, subprocess, sys, tarfile, urllib.request, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STUDIO = ROOT / "_studio"
DRAFTS = STUDIO / "drafts"
VOICES = STUDIO / ".voices"
CACHE = STUDIO / ".cache"
CONTENT = ROOT / "content"
LANGS = ["fa", "ru", "uk"]
RATE = 24000
# longest sentence we accept per level (words); longer lines are flagged by check
MAX_WORDS = {"A1": 10, "A2": 14, "B1": 20, "B2": 26, "C1": 32, "C2": 40}
PIPER_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-de_DE-{}.tar.bz2"
# ranked by how well Whisper understands them back (thorsten, eva_k ≈ 95%, karlsson 88%, kerstin 81%)
DEFAULT_CAST = ["piper:thorsten-medium", "piper:eva_k-x_low", "piper:karlsson-low", "piper:kerstin-low"]


def load(slug):
    f = DRAFTS / slug / "draft.json"
    if not f.exists(): sys.exit(f"no draft {slug}")
    return json.loads(f.read_text("utf-8"))


def save(slug, d):
    (DRAFTS / slug).mkdir(parents=True, exist_ok=True)
    (DRAFTS / slug / "draft.json").write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", "utf-8")


def lines_of(d):
    for si, sc in enumerate(d["scenes"]):
        for li, ln in enumerate(sc["lines"]):
            yield si, li, ln


# ---------------------------------------------------------------- new / prompt / import
def cmd_new(a):
    if (DRAFTS / a.slug / "draft.json").exists(): sys.exit("draft exists")
    save(a.slug, {
        "slug": a.slug, "type": a.type, "title": a.title, "level": a.level, "status": "draft",
        "brief": a.brief or "", "cast": {}, "pause": 0.6, "scenePause": 1.4,
        "tr": {l: {"title": "", "summary": ""} for l in LANGS},
        "scenes": [], "phrases": []})
    print(f"_studio/drafts/{a.slug}/draft.json")


SCHEMA = """{
  "title": "German title",
  "tr": { "fa": {"title": "", "summary": ""}, "ru": {…}, "uk": {…} },
  "cast": { "<Speaker>": "male" | "female" },
  "scenes": [
    { "title": {"de": "", "fa": "", "ru": "", "uk": ""},
      "lines": [ {"who": "<Speaker>", "de": "", "fa": "", "ru": "", "uk": ""} ] }
  ],
  "phrases": [ {"de": "", "fa": "", "ru": "", "uk": ""} ]
}"""


def cmd_prompt(a):
    d = load(a.slug)
    kind = {"talk": "a short everyday conversation", "lesson": "a lesson dialogue", "story": "a story told by a narrator with some dialogue"}[d["type"]]
    print(f"""Write {kind} in German for learners at level {d['level']}. It must be completely original — do not copy any existing text.
Topic / brief: {d.get('brief') or d['title']}
Rules:
- natural spoken German, one sentence per line, at most {MAX_WORDS[d['level']]} words per line
- 2–4 scenes, 8–14 lines each; speakers keep one consistent name
- translate every line naturally (not word for word) into Persian (fa), Russian (ru) and Ukrainian (uk)
- 6–10 key phrases a learner should keep
Answer with JSON only, in exactly this shape:
{SCHEMA}""")


def cmd_import(a):
    d = load(a.slug)
    src = json.loads(Path(a.file).read_text("utf-8"))
    for k in ("title", "tr", "scenes", "phrases"):
        if k in src: d[k] = src[k]
    cast = src.get("cast", {})
    male = [v for v in DEFAULT_CAST if "thorsten" in v or "karlsson" in v]
    female = [v for v in DEFAULT_CAST if "eva_k" in v or "kerstin" in v]
    for who, g in cast.items():
        if who not in d["cast"]:
            pool = female if str(g).startswith("f") else male
            used = [c["voice"] for c in d["cast"].values()]
            d["cast"][who] = {"voice": next((v for v in pool if v not in used), pool[0]), "speed": 0.95}
    for _, _, ln in lines_of(d): ln.setdefault("ok", False)
    save(a.slug, d); print("imported", sum(1 for _ in lines_of(d)), "lines")


# ---------------------------------------------------------------- check
def dict_forms():
    de = json.loads((CONTENT / "lang/de/dict.json").read_text("utf-8"))
    forms = set()
    for k, v in de.items():
        b = k.split("_")[0]; forms |= {b, b.lower()}
        for f in v.get("f", []): forms |= {f, f.lower()}
    names = set(json.loads((CONTENT / "lang/de/names.json").read_text("utf-8")))
    return forms, names


def cmd_check(a):
    d = load(a.slug); forms, names = dict_forms(); problems, unknown = [], {}
    if not d["scenes"]: problems.append("no scenes yet")
    for l in LANGS:
        if not d["tr"].get(l, {}).get("title"): problems.append(f"title missing in {l}")
    for si, li, ln in lines_of(d):
        at = f"scene {si + 1} line {li + 1}"
        if ln.get("who") and ln["who"] not in d["cast"]: problems.append(f"{at}: speaker {ln['who']} has no voice")
        for l in LANGS:
            if not ln.get(l): problems.append(f"{at}: no {l}")
        words = re.findall(r"[A-Za-zÄÖÜäöüß]+", ln["de"])
        if len(words) > MAX_WORDS[d["level"]]: problems.append(f"{at}: {len(words)} words (> {MAX_WORDS[d['level']]} for {d['level']})")
        for w in words:
            if w in names or w in forms or w.lower() in forms: continue
            # inflected forms the app also finds: -e, -en, -es, -er, -n, -s
            if any(w.lower().endswith(e) and w.lower()[: -len(e)] in forms for e in ("en", "em", "er", "es", "e", "n", "s", "t", "st", "te")): continue
            # conjugated verbs the app turns back into the infinitive: rufe, dauert, reserviert
            lw = w.lower()
            if any(c in forms for c in (lw + "n", lw[:-1] + "en", lw[:-2] + "en", lw[:-1] + "n", lw[:-2] + "n", lw[:-3] + "en")): continue
            unknown.setdefault(w, at)
    n = sum(1 for _ in lines_of(d)); ok = sum(1 for *_, ln in lines_of(d) if ln.get("ok"))
    print(f"{d['title']} · {d['level']} · {len(d['scenes'])} scenes · {n} lines · {ok} approved")
    print("\n".join("✗ " + p for p in problems) or "✓ structure")
    if unknown: print(f"? {len(unknown)} words not in the dictionary yet: " + ", ".join(sorted(unknown)))
    return problems


# ---------------------------------------------------------------- voices
def piper(name):
    d = VOICES / f"vits-piper-de_DE-{name}"
    if not d.exists():
        VOICES.mkdir(parents=True, exist_ok=True)
        tmp = VOICES / f"{name}.tar.bz2"
        print("downloading voice", name); urllib.request.urlretrieve(PIPER_URL.format(name), tmp)
        with tarfile.open(tmp) as t: t.extractall(VOICES)
        tmp.unlink()
    import sherpa_onnx
    m = glob.glob(str(d / "*.onnx"))[0]
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=m, tokens=str(d / "tokens.txt"), data_dir=str(d / "espeak-ng-data")), num_threads=4))
    return sherpa_onnx.OfflineTts(cfg)


_engines = {}


def synth(voice, text, speed):
    """float32 mono samples at RATE for one line"""
    import numpy as np
    kind, name = voice.split(":", 1)
    if kind == "piper":
        eng = _engines.get(voice) or _engines.setdefault(voice, piper(name))
        a = eng.generate(text, sid=0, speed=speed)
        return resample(np.array(a.samples, dtype=np.float32), a.sample_rate)
    if kind == "azure":
        key, region = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
        if not key: sys.exit("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set")
        rate = f"{round((speed - 1) * 100):+d}%"
        esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        ssml = f'<speak version="1.0" xml:lang="de-DE"><voice name="{name}"><prosody rate="{rate}">{esc}</prosody></voice></speak>'
        req = urllib.request.Request(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", ssml.encode("utf-8"), {
            "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "raw-24khz-16bit-mono-pcm", "User-Agent": "lapp-studio"})
        pcm = urllib.request.urlopen(req).read()
        return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
    sys.exit(f"unknown voice {voice}")


def resample(x, sr):
    import numpy as np
    if sr == RATE: return x
    n = int(len(x) * RATE / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def trim(x, thr=0.004):
    """cut leading and trailing silence so the pauses we add are the only ones"""
    import numpy as np
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    pad = int(0.12 * RATE)  # keep soft endings like the final "t" or "s"
    return x[max(0, idx[0] - pad): idx[-1] + pad]


def clip(d, ln):
    import numpy as np
    c = d["cast"][ln["who"]]
    key = hashlib.sha1(f"{c['voice']}|{c.get('speed', 0.95)}|{ln['de']}".encode()).hexdigest()[:16]
    f = CACHE / f"{key}.npy"
    if f.exists(): return np.load(f)
    CACHE.mkdir(parents=True, exist_ok=True)
    x = trim(synth(c["voice"], ln["de"], c.get("speed", 0.95)))
    np.save(f, x); return x


def write_wav(path, x):
    import numpy as np
    w = wave.open(str(path), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()


def write_mp3(path, x):
    import av, numpy as np
    out = av.open(str(path), "w"); st = out.add_stream("mp3", rate=RATE); st.layout = "mono"; st.bit_rate = 64000
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    for i in range(0, len(pcm), 1152 * 8):
        fr = av.AudioFrame.from_ndarray(pcm[i:i + 1152 * 8].reshape(1, -1), format="s16p", layout="mono"); fr.sample_rate = RATE
        for p in st.encode(fr): out.mux(p)
    for p in st.encode(None): out.mux(p)
    out.close()


def cmd_voice(a):
    import numpy as np
    d = load(a.slug)
    if cmd_check(argparse.Namespace(slug=a.slug)) and not a.force: sys.exit("fix the problems first (or --force)")
    parts, timings, t = [], [], 0.4
    parts.append(np.zeros(int(0.4 * RATE), np.float32))
    cdir = DRAFTS / a.slug / "clips"; cdir.mkdir(exist_ok=True)
    n = 0
    for si, sc in enumerate(d["scenes"]):
        if si: parts.append(np.zeros(int(d.get("scenePause", 1.4) * RATE), np.float32)); t += d.get("scenePause", 1.4)
        for li, ln in enumerate(sc["lines"]):
            x = clip(d, ln); n += 1
            write_wav(cdir / f"{si}-{li}.wav", x)
            dur = len(x) / RATE
            timings.append([round(t, 2), round(t + dur, 2)])
            parts.append(x); t += dur
            gap = ln.get("pause", d.get("pause", 0.6))
            parts.append(np.zeros(int(gap * RATE), np.float32)); t += gap
            print(f"\r{n} lines", end="", flush=True)
    audio = np.concatenate(parts)
    peak = np.abs(audio).max() or 1
    audio = audio * min(1.0, 0.89 / peak)
    write_mp3(DRAFTS / a.slug / "audio.mp3", audio)
    (DRAFTS / a.slug / "timings.json").write_text(json.dumps(timings))
    print(f"\n✓ audio.mp3 · {round(len(audio) / RATE / 60, 1)} min · {n} lines, exact timings")


# ---------------------------------------------------------------- publish
def fmt(v, ind=""):
    """the layout every file in content/ uses: one key per line, short lists and objects on one line"""
    def flat(x):
        if not isinstance(x, (list, dict)): return True
        if isinstance(x, list): return all(flat(y) for y in x) and len(json.dumps(x, ensure_ascii=False)) < 400
        return all(flat(y) for y in x.values()) and len(json.dumps(x, ensure_ascii=False)) < 160
    long_strings = isinstance(v, list) and len(v) > 1 and any(isinstance(x, str) and len(x) > 60 for x in v)
    if flat(v) and not long_strings:
        return json.dumps(v, ensure_ascii=False, separators=(", ", ": ") if isinstance(v, list) and all(not isinstance(x, (list, dict)) for x in v) else (",", ":"))
    n = ind + "  "
    if isinstance(v, list): return "[\n" + ",\n".join(n + fmt(x, n) for x in v) + "\n" + ind + "]"
    return "{\n" + ",\n".join(n + json.dumps(k, ensure_ascii=False) + ": " + fmt(x, n) for k, x in v.items()) + "\n" + ind + "}"


def cmd_publish(a):
    d = load(a.slug)
    if cmd_check(argparse.Namespace(slug=a.slug)) and not a.force: sys.exit("fix the problems first (or --force)")
    src = DRAFTS / a.slug
    if not (src / "audio.mp3").exists(): sys.exit("run voice first")
    waiting = sum(1 for *_, ln in lines_of(d) if not ln.get("ok"))
    if waiting and not a.force: sys.exit(f"{waiting} lines are not approved yet (review them, or --force)")
    idx = json.loads((CONTENT / "index.json").read_text("utf-8"))
    ids = [json.loads((CONTENT / "lessons" / x / "lesson.json").read_text("utf-8"))["id"] for x in idx["lessons"]]
    existing = next((x for x in idx["lessons"] if x.split("-", 1)[1] == a.slug), None)
    if existing: lid = json.loads((CONTENT / "lessons" / existing / "lesson.json").read_text("utf-8"))["id"]; folder = existing
    else: lid = max(ids) + 1; folder = f"{lid:02d}-{a.slug}"
    out = CONTENT / "lessons" / folder; out.mkdir(parents=True, exist_ok=True)
    rows = [ln for *_, ln in lines_of(d)]
    starts, n = [], 0
    for sc in d["scenes"]: starts.append(n); n += len(sc["lines"])
    lesson = {
        "id": lid, "type": d["type"], "title": d["title"], "level": d["level"], "audio": "audio.mp3",
        "made": "studio",
        "phrases": [p["de"] for p in d.get("phrases", [])],
        "transcript": [f"**{ln['who']}:** {ln['de']}" if ln.get("who") else ln["de"] for ln in rows],
        "timings": json.loads((src / "timings.json").read_text()),
        "words": [], "focus": [], "speak": {"topics": [], "cues": []},
        "scenes": [{"start": s, "title": sc["title"]["de"]} for s, sc in zip(starts, d["scenes"])]}
    if d.get("video"): lesson["video"] = d["video"]
    (out / "lesson.json").write_text(fmt(lesson) + "\n", "utf-8")
    shutil.copy(src / "audio.mp3", out / "audio.mp3")
    for l in LANGS:
        (out / f"{l}.json").write_text(fmt({
            "title": d["tr"][l]["title"], "summary": d["tr"][l]["summary"],
            "phrases": [p.get(l, "") for p in d.get("phrases", [])], "phraseNotes": ["" for _ in d.get("phrases", [])],
            "lines": [ln[l] for ln in rows], "scenes": [sc["title"][l] for sc in d["scenes"]],
            "topics": [], "cues": [], "focus": []}) + "\n", "utf-8")
    if folder not in idx["lessons"]:
        idx["lessons"].append(folder)
        txt = (CONTENT / "index.json").read_text("utf-8")
        txt = re.sub(r'("lessons": \[[^\]]*?)(\s*\])', lambda m: m.group(1) + f', "{folder}"' + m.group(2), txt, flags=re.S)
        json.loads(txt); (CONTENT / "index.json").write_text(txt, "utf-8")
    subprocess.run(["node", str(ROOT / "tools/dict.js"), "build"], check=True, stdout=subprocess.DEVNULL)
    d["status"] = "published"; d["published"] = folder; save(a.slug, d)
    print(f"✓ content/lessons/{folder}/ (id {lid})")


# ---------------------------------------------------------------- serve: local review page
def cmd_serve(a):
    import http.server, socketserver, urllib.parse
    page = (STUDIO / "review.html").read_text("utf-8")

    class H(http.server.BaseHTTPRequestHandler):
        def send(self, code, body, ctype="application/json"):
            b = body if isinstance(body, bytes) else body.encode("utf-8")
            self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

        def do_GET(self):
            p = urllib.parse.urlparse(self.path).path
            if p == "/": return self.send(200, page, "text/html; charset=utf-8")
            if p == "/api/drafts":
                out = []
                for f in sorted(DRAFTS.glob("*/draft.json")):
                    d = json.loads(f.read_text("utf-8")); rows = [ln for *_, ln in lines_of(d)]
                    out.append({"slug": d["slug"], "title": d["title"], "type": d["type"], "level": d["level"], "status": d.get("status"), "lines": len(rows), "ok": sum(1 for r in rows if r.get("ok"))})
                return self.send(200, json.dumps(out, ensure_ascii=False))
            m = re.match(r"^/api/draft/([\w-]+)$", p)
            if m: return self.send(200, json.dumps(load(m.group(1)), ensure_ascii=False))
            m = re.match(r"^/clip/([\w-]+)/(\d+)-(\d+)\.wav$", p)
            if m:
                d = load(m.group(1)); ln = d["scenes"][int(m.group(2))]["lines"][int(m.group(3))]
                f = DRAFTS / m.group(1) / "preview.wav"; write_wav(f, clip(d, ln))
                return self.send(200, f.read_bytes(), "audio/wav")
            m = re.match(r"^/audio/([\w-]+)\.mp3$", p)
            if m and (DRAFTS / m.group(1) / "audio.mp3").exists(): return self.send(200, (DRAFTS / m.group(1) / "audio.mp3").read_bytes(), "audio/mpeg")
            self.send(404, "{}")

        def do_POST(self):
            p = urllib.parse.urlparse(self.path).path
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            m = re.match(r"^/api/draft/([\w-]+)$", p)
            if m: save(m.group(1), body); return self.send(200, '{"ok":true}')
            m = re.match(r"^/api/(voice|publish|check)/([\w-]+)$", p)
            if m:
                r = subprocess.run([sys.executable, __file__, m.group(1), m.group(2)], capture_output=True, text=True)
                return self.send(200, json.dumps({"ok": r.returncode == 0, "out": r.stdout + r.stderr}, ensure_ascii=False))
            self.send(404, "{}")

        def log_message(self, *x): pass

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", a.port), H) as s:
        print(f"LAPP Studio → http://localhost:{a.port}"); s.serve_forever()


def main():
    ap = argparse.ArgumentParser(description="LAPP Studio"); sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("new"); p.add_argument("slug"); p.add_argument("--type", choices=["talk", "lesson", "story"], default="talk")
    p.add_argument("--level", default="A1", choices=list(MAX_WORDS)); p.add_argument("--title", required=True); p.add_argument("--brief")
    sub.add_parser("prompt").add_argument("slug")
    p = sub.add_parser("import"); p.add_argument("slug"); p.add_argument("file")
    sub.add_parser("check").add_argument("slug")
    for c in ("voice", "publish"):
        p = sub.add_parser(c); p.add_argument("slug"); p.add_argument("--force", action="store_true")
    sub.add_parser("serve").add_argument("--port", type=int, default=8787)
    a = ap.parse_args()
    r = {"new": cmd_new, "prompt": cmd_prompt, "import": cmd_import, "check": cmd_check, "voice": cmd_voice, "publish": cmd_publish, "serve": cmd_serve}[a.cmd](a)
    if a.cmd == "check" and r: sys.exit(1)


if __name__ == "__main__":
    main()
