// The studio's voice desk, on the server.
//
// Every spoken line is kept as a clip (a "take") made by a voice or recorded by a person; its key is a hash
// of everything that changes the sound (voice, speed, pitch, feeling, take number, the words spoken), so a
// mix only makes the lines that changed. A voice job runs in GitHub Actions (_studio/job.py):
//   mode "lines": make new takes of some lines (nothing is mixed)
//   mode "mix":   make what is missing, then mix speech + music / ambience / effects into the lesson's audio
// Voices: Piper (fast, offline), Chatterbox (natural, emotional, can clone), Azure (when set up),
// and the library's own: designed (a base voice + settings, from a description) or cloned (with consent).
import { str, int, pick, sha, blobPut, blobGet, COURSES, uploadMeta, fileResponse } from "./util.js";
import * as AI from "./ai.js";

export const FEELS = ["", "happy", "excited", "polite", "tired", "sad", "angry", "whisper"];
// Azure neural voices (used when the site has AZURE_TTS set and GitHub has the key)
const AZURE = {
  de: [["azure:de-DE-KatjaNeural", "f"], ["azure:de-DE-AmalaNeural", "f"], ["azure:de-DE-ConradNeural", "m"], ["azure:de-DE-KillianNeural", "m"]],
  nl: [["azure:nl-NL-FennaNeural", "f"], ["azure:nl-NL-ColetteNeural", "f"], ["azure:nl-NL-MaartenNeural", "m"]],
  pl: [["azure:pl-PL-ZofiaNeural", "f"], ["azure:pl-PL-AgnieszkaNeural", "f"], ["azure:pl-PL-MarekNeural", "m"]]
};
const MEDIA_TYPES = /^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|webm|mp4|x-m4a|aac|flac)$/;
const MAX_MEDIA = 15e6, MAX_TAKE = 6e6;

/* ================= the voices a lesson may use ================= */
// voice: { id, g: "f"|"m", engine, name }
export async function voicesFor(env, org, course) {
  const c = COURSES[course]; if (!c) return [];
  const out = [...c.female.map(id => ({ id, g: "f" })), ...c.male.map(id => ({ id, g: "m" }))].map(v => ({ ...v, engine: "piper" }));
  out.push({ id: "chatterbox:default", g: "f", engine: "chatterbox", name: "Natural (Chatterbox)" });
  if (env.AZURE_TTS) out.push(...(AZURE[course] || []).map(([id, g]) => ({ id, g, engine: "azure" })));
  for (const v of await library(env, org)) if (v.course === course && (v.kind === "design" || v.ready))
    out.push({ id: v.kind === "clone" ? `chatterbox:v${v.id}` : `design:${v.id}`, g: v.gender, engine: v.kind === "clone" ? "chatterbox" : "design", name: v.name, own: v.kind });
  return out;
}
async function library(env, org) {
  return (await env.DB.prepare("SELECT * FROM studio_voices WHERE org_id = ? ORDER BY name").bind(org).all()).results
    .map(v => ({ id: v.id, kind: v.kind, name: v.name, gender: v.gender, course: v.course, description: v.description, settings: JSON.parse(v.settings || "{}"), consent: v.consent_name ? { name: v.consent_name, text: v.consent_text, at: v.consent_at } : null, ready: v.kind === "design" || v.ref_size > 0, created_at: v.created_at }));
}

/* ================= a line: its id, what is spoken, how, and the key of that sound ================= */
const rid = () => Math.random().toString(36).slice(2, 8);
// every line has an id (the page gives one; text made on the server gets one here)
export function lineIds(d) { const seen = new Set(); for (const s of d.scenes || []) for (const ln of s.lines || []) { if (!ln.id || seen.has(ln.id)) ln.id = rid(); seen.add(ln.id); } return d; }
const rows = d => (d.scenes || []).flatMap(s => s.lines || []);
// a lesson read from the database: lines without an id get one, kept at once (the takes hang on these ids)
export async function withIds(env, l, d) {
  const before = JSON.stringify(d.scenes || []); lineIds(d);
  if (JSON.stringify(d.scenes || []) !== before) await env.DB.prepare("UPDATE lessons SET data = ? WHERE id = ?").bind(JSON.stringify(d), l.id).run();
  return d;
}
// what the voice says: the line's own "say", with the lesson's pronunciations (whole words)
export function spoken(d, ln) {
  let t = String(ln.say || ln.de || "");
  for (const [w, as] of Object.entries(d.pron || {})) if (w && as) t = t.replace(new RegExp(`(?<![\\p{L}\\p{M}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "giu"), as);
  return t;
}
async function designs(env, d) {
  const ids = [...new Set(Object.values(d.cast || {}).map(c => /^design:(\d+)$/.exec(c.voice || "")).filter(Boolean).map(m => int(m[1])))];
  if (!ids.length) return {};
  const rs = (await env.DB.prepare(`SELECT id, settings FROM studio_voices WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results;
  return Object.fromEntries(rs.map(r => [r.id, JSON.parse(r.settings || "{}")]));
}
// how a line sounds, with a designed voice turned into its base voice + settings
function delivery(d, ln, des) {
  const c = (d.cast || {})[ln.who] || {};
  let voice = c.voice || "", speed = Number(ln.speed || c.speed || 0.95), pitch = Number(ln.pitch || 0), feel = ln.feel || "", exag = null;
  const m = /^design:(\d+)$/.exec(voice);
  if (m) { const s = des[int(m[1])] || {}; voice = s.base || ""; speed *= Number(s.speed || 1); pitch += Number(s.pitch || 0); feel = feel || s.feel || ""; exag = s.exaggeration ?? null; }
  return { voice, speed: Math.round(speed * 1000) / 1000, pitch: Math.round(pitch * 100) / 100, feel: pick(feel, FEELS, ""), exag, take: int(ln.seed || 0), text: spoken(d, ln) };
}
const keyOf = async x => (await sha(JSON.stringify([x.voice, x.speed, x.pitch, x.feel, x.exag, x.take, x.text]))).slice(0, 22);
// every line: its current key, the clip a mix uses (the chosen take, or the current one) and whether that clip exists
export async function plan(env, l, d) {
  const des = await designs(env, d), clips = (await env.DB.prepare("SELECT key, line_id, src, dur, params, created_at FROM voice_clips WHERE lesson_id = ? ORDER BY created_at").bind(l.id).all()).results;
  const have = new Map(clips.map(c => [c.key, c]));
  const out = [];
  for (const ln of rows(d)) {
    const x = delivery(d, ln, des), key = await keyOf(x);
    const take = ln.take && have.has(ln.take) && have.get(ln.take).line_id === ln.id ? ln.take : null;
    const use = take || key;
    out.push({ id: ln.id, who: ln.who, ...x, key, use, have: have.has(use), takes: clips.filter(c => c.line_id === ln.id).map(c => ({ key: c.key, src: c.src, dur: c.dur, at: c.created_at, params: JSON.parse(c.params || "{}") })) });
  }
  return out;
}

/* ================= the page's side: /api/studio/lessons/:id/voice…, /api/studio/voices ================= */
export async function voiceApi(req, env, H, sc, p, url, X) {
  const M = req.method; let m;
  // what the desk shows: every line's takes, what changed since the last mix, the lesson's sound files, the voices
  if ((m = p.match(/^\/lessons\/(\d+)\/voice$/)) && M === "GET") {
    const l = await X.lessonIn(env, H, sc, int(m[1])), d = l.data;
    const lines = await plan(env, l, d), mix = JSON.parse(l.mix || "{}");
    const media = (await env.DB.prepare("SELECT id, name, type, size, created_at FROM lesson_media WHERE lesson_id = ? ORDER BY id").bind(l.id).all()).results;
    const job = await env.DB.prepare("SELECT id, mode, lines, status, log, rev, updated_at FROM studio_jobs WHERE lesson_id = ? ORDER BY id DESC LIMIT 1").bind(l.id).first();
    return H.json({ lines: lines.map(x => ({ id: x.id, key: x.key, use: x.use, have: x.have, changed: mix[x.id] !== x.use, takes: x.takes })), media, job, words: JSON.parse(l.words || "[]"),
      voices: await voicesFor(env, sc.org, l.course), mixed: Object.keys(mix).length > 0 });
  }
  // make: { lines: [ids] } → new takes of those lines; nothing → mix the lesson (making only what changed)
  if ((m = p.match(/^\/lessons\/(\d+)\/voice$/)) && M === "POST") {
    const l = await X.lessonIn(env, H, sc, int(m[1])), b = await H.body(req).catch(() => ({}));
    return H.json({ job: await startJob(env, H, req, sc, l, Array.isArray(b.lines) ? b.lines.map(x => str(x, 12)).filter(Boolean).slice(0, 200) : null) });
  }
  // one take: listen to it, record one (the microphone), throw one away
  if ((m = p.match(/^\/lessons\/(\d+)\/clips\/([\w-]{6,40})$/)) && M === "GET") {
    const l = await X.lessonIn(env, H, sc, int(m[1])), c = await env.DB.prepare("SELECT * FROM voice_clips WHERE lesson_id = ? AND key = ?").bind(l.id, m[2]).first();
    if (!c) throw H.fail("no such take", 404);
    return fileResponse(await blobGet(env, `clip/${l.id}/${c.key}`, c.size), { name: `line-${c.line_id}.${c.type.includes("mpeg") ? "mp3" : "webm"}`, type: c.type, size: c.size });
  }
  if ((m = p.match(/^\/lessons\/(\d+)\/clips$/)) && M === "POST") {
    const l = await X.lessonIn(env, H, sc, int(m[1])), line = str(url.searchParams.get("line"), 12);
    if (!rows(l.data).some(x => x.id === line)) throw H.fail("no such line", 404);
    const { type } = uploadMeta(req), buf = new Uint8Array(await req.arrayBuffer());
    if (!/^audio\//.test(type)) throw H.fail("a recording, please");
    if (buf.length < 2000 || buf.length > MAX_TAKE) throw H.fail("the recording is too short or too long", 413);
    const key = "mic-" + rid() + rid(), dur = Math.max(0, Math.min(120, Number(url.searchParams.get("dur")) || 0));
    await env.DB.batch([...blobPut(env, `clip/${l.id}/${key}`, buf),
      env.DB.prepare("INSERT INTO voice_clips (lesson_id, key, line_id, src, type, params, dur, size, created_by, created_at) VALUES (?, ?, ?, 'mic', ?, '{}', ?, ?, ?, ?)").bind(l.id, key, line, type, dur, buf.length, sc.u.id, H.now())]);
    return H.json({ key, src: "mic", dur });
  }
  if ((m = p.match(/^\/lessons\/(\d+)\/clips\/([\w-]{6,40})$/)) && M === "DELETE") {
    const l = await X.lessonIn(env, H, sc, int(m[1]));
    await env.DB.batch([env.DB.prepare("DELETE FROM blobs WHERE key = ?").bind(`clip/${l.id}/${m[2]}`), env.DB.prepare("DELETE FROM voice_clips WHERE lesson_id = ? AND key = ?").bind(l.id, m[2])]);
    return H.json({ ok: true });
  }
  // the lesson's sound files (music, ambience, effects)
  if ((m = p.match(/^\/lessons\/(\d+)\/media$/)) && M === "POST") {
    const l = await X.lessonIn(env, H, sc, int(m[1])), { name, type } = uploadMeta(req), buf = new Uint8Array(await req.arrayBuffer());
    if (!MEDIA_TYPES.test(type)) throw H.fail("only sound files (mp3, wav, ogg, m4a…)");
    if (!buf.length || buf.length > MAX_MEDIA) throw H.fail("sound files can be up to 15 MB", 413);
    if ((await env.DB.prepare("SELECT COUNT(*) n FROM lesson_media WHERE lesson_id = ?").bind(l.id).first()).n >= 30) throw H.fail("a lesson holds up to 30 sound files", 409);
    const f = await env.DB.prepare("INSERT INTO lesson_media (lesson_id, name, type, size, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, name, type, size, created_at").bind(l.id, name, type, buf.length, sc.u.id, H.now()).first();
    await env.DB.batch(blobPut(env, `media/${l.id}/${f.id}`, buf));
    return H.json(f);
  }
  if ((m = p.match(/^\/lessons\/(\d+)\/media\/(\d+)$/)) && (M === "GET" || M === "DELETE")) {
    const l = await X.lessonIn(env, H, sc, int(m[1])), f = await env.DB.prepare("SELECT * FROM lesson_media WHERE id = ? AND lesson_id = ?").bind(int(m[2]), l.id).first();
    if (!f) throw H.fail("no such sound file", 404);
    if (M === "GET") return fileResponse(await blobGet(env, `media/${l.id}/${f.id}`, f.size), f);
    await env.DB.batch([env.DB.prepare("DELETE FROM blobs WHERE key = ?").bind(`media/${l.id}/${f.id}`), env.DB.prepare("DELETE FROM lesson_media WHERE id = ?").bind(f.id)]);
    return H.json({ ok: true });
  }
  // subtitles of the made audio, in the course language (with word timing) or a translation
  if ((m = p.match(/^\/lessons\/(\d+)\/subtitles\.vtt$/)) && M === "GET") {
    const l = await X.lessonIn(env, H, sc, int(m[1]));
    return new Response(subtitles(l, pick(url.searchParams.get("lang"), ["de", "en", "fa", "ru", "uk"], "de")), { headers: { "Content-Type": "text/vtt; charset=utf-8", "Content-Disposition": `attachment; filename="lesson-${l.id}.vtt"` } });
  }

  // the voice library of this school (or of LAPP)
  if (p === "/voices" && M === "GET") return H.json({ voices: await library(env, sc.org) });
  if (p === "/voices" && M === "POST") {
    const b = await H.body(req), kind = pick(b.kind, ["design", "clone"], ""), name = str(b.name, 40), course = pick(b.course, Object.keys(COURSES), "de"), gender = b.gender === "m" ? "m" : "f";
    if (!kind || !name) throw H.fail("a name and a kind, please");
    if ((await env.DB.prepare("SELECT COUNT(*) n FROM studio_voices WHERE org_id = ?").bind(sc.org).first()).n >= 40) throw H.fail("the library holds up to 40 voices", 409);
    let settings = {}, consent = ["", "", null];
    if (kind === "design") settings = await design(env, H, sc, course, gender, str(b.description, 400));
    else {
      // a cloned voice needs the speaker's written consent, given by the speaker themselves
      const who = str(b.consentName, 80), text = str(b.consentText, 600);
      if (!b.consent || !who || !text) throw H.fail("the speaker's written consent is needed");
      consent = [who, text, H.now()];
    }
    const v = await env.DB.prepare("INSERT INTO studio_voices (org_id, kind, name, gender, course, description, settings, consent_name, consent_text, consent_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(sc.org, kind, name, gender, course, str(b.description, 400), JSON.stringify(settings), ...consent, sc.u.id, H.now()).first();
    return H.json({ id: v.id, settings });
  }
  if ((m = p.match(/^\/voices\/(\d+)(\/ref)?$/))) {
    const v = await env.DB.prepare("SELECT * FROM studio_voices WHERE id = ? AND org_id = ?").bind(int(m[1]), sc.org).first();
    if (!v) throw H.fail("no such voice", 404);
    if (m[2] && (M === "PUT" || M === "POST")) {
      if (v.kind !== "clone") throw H.fail("only a cloned voice has a recording");
      const { type } = uploadMeta(req), buf = new Uint8Array(await req.arrayBuffer()), dur = url.searchParams.has("dur") ? Number(url.searchParams.get("dur")) || 0 : 10;
      if (!/^audio\//.test(type) || buf.length < 8000 || dur < 9.5 || buf.length > MAX_TAKE) throw H.fail("record at least 10 seconds");
      await env.DB.batch([env.DB.prepare("DELETE FROM blobs WHERE key = ?").bind(`voice/${v.id}`), ...blobPut(env, `voice/${v.id}`, buf),
        env.DB.prepare("UPDATE studio_voices SET ref_size = ?, settings = ? WHERE id = ?").bind(buf.length, JSON.stringify({ ...JSON.parse(v.settings || "{}"), type }), v.id)]);
      return H.json({ ok: true });
    }
    if (m[2] && M === "GET") { if (!v.ref_size) throw H.fail("no recording yet", 404); return fileResponse(await blobGet(env, `voice/${v.id}`, v.ref_size), { name: "voice.webm", type: JSON.parse(v.settings || "{}").type || "audio/webm", size: v.ref_size }); }
    if (!m[2] && M === "PATCH") {
      const b = await H.body(req), s = { ...JSON.parse(v.settings || "{}") };
      if (b.settings && v.kind === "design") for (const k of ["base", "speed", "pitch", "feel", "exaggeration"]) if (b.settings[k] !== undefined) s[k] = k === "base" || k === "feel" ? str(b.settings[k], 80) : Number(b.settings[k]) || 0;
      await env.DB.prepare("UPDATE studio_voices SET name = ?, settings = ? WHERE id = ?").bind(str(b.name, 40) || v.name, JSON.stringify(s), v.id).run();
      return H.json({ ok: true });
    }
    if (!m[2] && M === "DELETE") {
      await env.DB.batch([env.DB.prepare("DELETE FROM blobs WHERE key = ?").bind(`voice/${v.id}`), env.DB.prepare("DELETE FROM studio_voices WHERE id = ?").bind(v.id)]);
      return H.json({ ok: true });
    }
  }
  return null;
}

// a voice from a description: the AI picks the base voice and how it is set (without an AI: from key words)
async function design(env, H, sc, course, gender, description) {
  const base = (await voicesFor(env, sc.org, course)).filter(v => v.g === gender && !v.own).map(v => v.id);
  if (!base.length) throw H.fail("no voices for this language yet");
  const clamp = (v, a, b, d) => Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : d;
  let s = null;
  if (description && await AI.available(env)) {
    try {
      const r = await AI.ask(env, "assist", { prompt: `Design a ${gender === "m" ? "male" : "female"} ${COURSES[course].name} voice for language-learning audio from this description: "${description}".
Choose the base voice from: ${base.join(", ")} (chatterbox:default is the most natural and emotional; piper voices are clear and fast).
speed: 0.8–1.2 (1 = normal), pitch: −4…4 semitones, feel: one of ${FEELS.filter(Boolean).join(", ")} or "" for neutral, exaggeration: 0.25–1 (how expressive; 0.5 = normal).`,
        schema: { type: "object", required: ["base", "speed", "pitch", "feel", "exaggeration"], properties: { base: { type: "string", enum: base }, speed: { type: "number" }, pitch: { type: "number" }, feel: { type: "string" }, exaggeration: { type: "number" } } }, max: 400 });
      s = r.value;
    } catch {}
  }
  if (!s) {   // the key words of the description
    const t = description.toLowerCase(), has = (...w) => w.some(x => t.includes(x));
    s = { base: has("natural", "warm", "emotional", "lively", "expressive") && base.includes("chatterbox:default") ? "chatterbox:default" : base[0],
      speed: has("slow", "calm") ? 0.88 : has("fast", "quick", "energetic") ? 1.1 : 1, pitch: has("deep", "low", "old", "older") ? -2 : has("high", "young", "child", "girl", "boy") ? 2 : 0,
      feel: has("happy", "cheerful", "friendly") ? "happy" : has("tired", "sleepy") ? "tired" : has("sad") ? "sad" : has("whisper", "soft") ? "whisper" : "", exaggeration: has("expressive", "dramatic", "lively") ? 0.75 : 0.5 };
  }
  return { base: base.includes(s.base) ? s.base : base[0], speed: clamp(s.speed, 0.8, 1.2, 1), pitch: clamp(s.pitch, -4, 4, 0), feel: pick(s.feel, FEELS, ""), exaggeration: clamp(s.exaggeration, 0.25, 1, 0.5) };
}

/* ================= subtitles (WebVTT) ================= */
function subtitles(l, lang) {
  const d = JSON.parse(typeof l.data === "string" ? l.data : JSON.stringify(l.data)), t = JSON.parse(l.timings || "[]"), w = JSON.parse(l.words || "[]");
  const ts = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 36e5), mi = Math.floor(ms / 6e4) % 60, se = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(se).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`; };
  const cues = rows(d).map((ln, i) => {
    if (!t[i]) return "";
    let text = lang === "de" ? ln.de : ln[lang] || "";
    // word timing (karaoke tags) for the spoken language
    if (lang === "de" && Array.isArray(w[i]) && w[i].length) { const ws = String(ln.de).split(/\s+/).filter(Boolean); if (ws.length === w[i].length) text = ws.map((x, k) => (k ? `<${ts(w[i][k][0])}>` : "") + x).join(" "); }
    return text ? `${i + 1}\n${ts(t[i][0])} --> ${ts(t[i][1])}\n${ln.who ? `<v ${ln.who}>` : ""}${text}\n` : "";
  }).filter(Boolean);
  return "WEBVTT\n\n" + cues.join("\n");
}

/* ================= the job ================= */
async function startJob(env, H, req, sc, l, only) {
  if (!env.GITHUB_TOKEN) throw H.fail("the voice service is not set up (GITHUB_TOKEN)", 503);
  const d = l.data, all = rows(d);
  if (!all.length) throw H.fail("write the text first");
  const missing = all.find(r => !(d.cast[r.who] || {}).voice);
  if (missing) throw H.fail(`${missing.who} has no voice yet`);
  const running = await env.DB.prepare("SELECT id FROM studio_jobs WHERE lesson_id = ? AND status IN ('queued','running') AND updated_at > ?").bind(l.id, H.now() - 20 * 60e3).first();
  if (running) throw H.fail("the audio is already being made", 409);
  const lines = await plan(env, l, d);
  let mode = "mix", list;
  if (only) {
    mode = "lines"; list = lines.filter(x => only.includes(x.id) && !x.have).map(x => x.id);
    if (!list.length) throw H.fail("these lines are made already — change something, or ask for another take", 409);
  } else list = Object.fromEntries(lines.map(x => [x.id, x.use]));
  const token = H.b64url(H.rand(24));
  const job = await env.DB.prepare("INSERT INTO studio_jobs (lesson_id, kind, mode, lines, token_hash, rev, created_by, created_at, updated_at) VALUES (?, 'voice', ?, ?, ?, ?, ?, ?, ?) RETURNING id")
    .bind(l.id, mode, JSON.stringify(list), await sha(token), l.rev, sc.u.id, H.now(), H.now()).first();
  const r = await fetch(`https://api.github.com/repos/${env.REPO}/actions/workflows/studio-voice.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "lapp-studio", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: env.BRANCH || "main", inputs: { job: String(job.id), token, api: H.appUrl(env, req) } })
  });
  if (!r.ok) {
    await env.DB.prepare("UPDATE studio_jobs SET status = 'failed', log = ? WHERE id = ?").bind(`GitHub ${r.status}`, job.id).run();
    throw H.fail(`the voice service did not start (GitHub ${r.status})`, 502);
  }
  return job.id;
}

// the runner's side: /api/studio/jobs/:id/… with the job's one-time token
export async function jobApi(req, env, H, id, rest) {
  const job = await env.DB.prepare("SELECT * FROM studio_jobs WHERE id = ?").bind(id).first();
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!job || !tok || job.token_hash !== await sha(tok) || job.created_at < H.now() - 3 * 3600e3) throw H.fail("not allowed", 403);
  if (["done", "failed"].includes(job.status)) throw H.fail("this job is over", 409);
  const l = await env.DB.prepare("SELECT * FROM lessons WHERE id = ?").bind(job.lesson_id).first();
  if (!l) throw H.fail("no such lesson", 404);
  const d = await withIds(env, l, JSON.parse(l.data)), M = req.method, list = JSON.parse(job.lines || "[]"), url = new URL(req.url);
  const lines = await plan(env, l, d);
  // the clips this job may make: in "lines" mode the asked lines; in a mix, what is missing
  const makes = lines.filter(x => job.mode === "lines" ? list.includes(x.id) : !x.have);
  const voiceIds = [...new Set(lines.map(x => /^chatterbox:v(\d+)$/.exec(x.voice)).filter(Boolean).map(m => int(m[1])))];
  let m;
  if (rest === "" && M === "GET") {
    const media = (await env.DB.prepare("SELECT id, name, type, size FROM lesson_media WHERE lesson_id = ?").bind(l.id).all()).results;
    return H.json({ mode: job.mode, course: l.course, pause: d.pause ?? 0.6, scenePause: d.scenePause ?? 1.4, tracks: d.tracks || [], media, voices: voiceIds,
      scenes: (d.scenes || []).map(s => ({ lines: s.lines.map(ln => { const x = lines.find(y => y.id === ln.id); return { id: x.id, who: x.who, voice: x.voice, speed: x.speed, pitch: x.pitch, feel: x.feel, exag: x.exag, text: x.text, shown: ln.de, key: x.key, use: x.use, have: x.have, make: makes.includes(x), pause: ln.pause }; }) })) });
  }
  if (rest === "/status" && M === "POST") {
    const b = await H.body(req), st = pick(b.status, job.mode === "lines" ? ["running", "failed", "done"] : ["running", "failed"], "running");
    await env.DB.prepare("UPDATE studio_jobs SET status = ?, log = ?, updated_at = ? WHERE id = ?").bind(st, str(b.log, 4000), H.now(), id).run();
    return H.json({ ok: true });
  }
  // a clip it made: only the keys it was asked for
  if ((m = rest.match(/^\/clip\/([\w-]{6,40})$/)) && M === "PUT") {
    const x = makes.find(y => y.key === m[1]);
    if (!x) throw H.fail("not a clip of this job", 403);
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length < 100 || buf.length > MAX_TAKE) throw H.fail("bad clip", 400);
    const params = { voice: x.voice, speed: x.speed, pitch: x.pitch, feel: x.feel, take: x.take, text: x.text };
    await env.DB.batch([env.DB.prepare("DELETE FROM blobs WHERE key = ?").bind(`clip/${l.id}/${x.key}`), ...blobPut(env, `clip/${l.id}/${x.key}`, buf),
      env.DB.prepare("INSERT OR REPLACE INTO voice_clips (lesson_id, key, line_id, src, type, params, dur, size, created_at) VALUES (?, ?, ?, 'tts', 'audio/mpeg', ?, ?, ?, ?)").bind(l.id, x.key, x.id, JSON.stringify(params), Math.max(0, Number(url.searchParams.get("dur")) || 0), buf.length, H.now()),
      env.DB.prepare("UPDATE studio_jobs SET updated_at = ? WHERE id = ?").bind(H.now(), id)]);
    return H.json({ ok: true });
  }
  // what the mix needs: the clips it uses, the sound files on the tracks, the recordings of cloned voices
  if ((m = rest.match(/^\/clip\/([\w-]{6,40})$/)) && M === "GET") {
    const c = await env.DB.prepare("SELECT * FROM voice_clips WHERE lesson_id = ? AND key = ?").bind(l.id, m[1]).first();
    if (!c || !lines.some(x => x.use === c.key)) throw H.fail("not a clip of this lesson", 404);
    return new Response(await blobGet(env, `clip/${l.id}/${c.key}`, c.size), { headers: { "Content-Type": c.type } });
  }
  if ((m = rest.match(/^\/media\/(\d+)$/)) && M === "GET") {
    const f = await env.DB.prepare("SELECT * FROM lesson_media WHERE id = ? AND lesson_id = ?").bind(int(m[1]), l.id).first();
    if (!f) throw H.fail("no such sound file", 404);
    return new Response(await blobGet(env, `media/${l.id}/${f.id}`, f.size), { headers: { "Content-Type": f.type } });
  }
  if ((m = rest.match(/^\/voice\/(\d+)$/)) && M === "GET") {
    const v = voiceIds.includes(int(m[1])) && await env.DB.prepare("SELECT id, ref_size, settings FROM studio_voices WHERE id = ?").bind(int(m[1])).first();
    if (!v || !v.ref_size) throw H.fail("no such voice", 404);
    return new Response(await blobGet(env, `voice/${v.id}`, v.ref_size), { headers: { "Content-Type": JSON.parse(v.settings || "{}").type || "audio/webm" } });
  }
  // the timing of every line and word, sent before the audio
  if (rest === "/timings" && M === "POST") {
    const b = await H.body(req);
    await env.DB.prepare("UPDATE studio_jobs SET result = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify({ timings: Array.isArray(b.timings) ? b.timings : [], words: Array.isArray(b.words) ? b.words : [] }).slice(0, 400000), H.now(), id).run();
    return H.json({ ok: true });
  }
  if (rest === "/audio" && M === "PUT") {
    if (job.mode !== "mix") throw H.fail("this job makes lines only", 409);
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length < 100 || buf.length > 40e6) throw H.fail("bad audio", 400);
    const res = JSON.parse(job.result || "{}"), timings = res.timings || [], words = res.words || [];
    const key = `lesson/${l.id}/${job.rev}`;
    const st = [env.DB.prepare("DELETE FROM blobs WHERE key LIKE ?").bind(`lesson/${l.id}/%`)];
    st.push(...blobPut(env, key, buf));
    // the published lesson keeps playing its own audio, so only drafts lose the old one
    if (l.status === "published") st.shift();
    st.push(env.DB.prepare("UPDATE lessons SET audio_rev = ?, audio_size = ?, timings = ?, words = ?, mix = ?, status = CASE WHEN status = 'draft' THEN 'review' ELSE status END WHERE id = ?")
      .bind(job.rev, buf.length, JSON.stringify(timings), JSON.stringify(words), job.lines, l.id));
    st.push(env.DB.prepare("UPDATE studio_jobs SET status = 'done', log = ?, updated_at = ? WHERE id = ?").bind(`${timings.length} lines`, H.now(), id));
    await env.DB.batch(st);
    return H.json({ ok: true });
  }
  throw H.fail("not found", 404);
}

// everything a lesson keeps besides its row (its audio, takes, sound files), for deleting lessons
export const lessonFilesGone = (env, where, ...bind) => [
  env.DB.prepare(`DELETE FROM blobs WHERE key IN (SELECT 'clip/' || lesson_id || '/' || key FROM voice_clips WHERE lesson_id IN (SELECT id FROM lessons WHERE ${where}))`).bind(...bind),
  env.DB.prepare(`DELETE FROM blobs WHERE key IN (SELECT 'media/' || lesson_id || '/' || id FROM lesson_media WHERE lesson_id IN (SELECT id FROM lessons WHERE ${where}))`).bind(...bind),
  env.DB.prepare(`DELETE FROM blobs WHERE key IN (SELECT 'lesson/' || id || '/' || audio_rev FROM lessons WHERE ${where})`).bind(...bind),
  env.DB.prepare(`DELETE FROM voice_clips WHERE lesson_id IN (SELECT id FROM lessons WHERE ${where})`).bind(...bind),
  env.DB.prepare(`DELETE FROM lesson_media WHERE lesson_id IN (SELECT id FROM lessons WHERE ${where})`).bind(...bind),
  env.DB.prepare(`DELETE FROM studio_jobs WHERE lesson_id IN (SELECT id FROM lessons WHERE ${where})`).bind(...bind)
];
