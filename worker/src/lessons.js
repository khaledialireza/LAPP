// Studio: lessons made in the site, by LAPP staff (the library everyone sees) or by a school
// (only its own students see them). Everything lives in D1; the audio too (table blobs).
//
//   /api/studio/...            the studio (staff, or a school's admins and teachers with ?org=<slug>)
//   /api/studio/jobs/:id/...   the voice job in GitHub Actions, with its one-time token
//   /api/lib?course=de         published lessons this person may open (the app adds them to its list)
//   /content/lessons/s-<id>/   lesson.json · <lang>.json · audio.mp3, the same shape as the static lessons
//   /api/ev                    what learners do in a lesson (for the studio's insights)
//
// Writing, translating and rewriting call Claude from here (ANTHROPIC_API_KEY); the voice is made
// with Piper in .github/workflows/studio-voice.yml (_studio/job.py), so it costs nothing.
import Anthropic from "@anthropic-ai/sdk";

export const TR = ["en", "fa", "ru", "uk"];                       // translation languages
const LANG_NAME = { en: "English", fa: "Persian", ru: "Russian", uk: "Ukrainian" };
const COURSES = {
  de: { name: "German", male: ["piper:thorsten-medium", "piper:karlsson-low"], female: ["piper:eva_k-x_low", "piper:kerstin-low"] },
  nl: { name: "Dutch", male: ["piper:nl_NL-ronnie-medium", "piper:nl_NL-pim-medium"], female: ["piper:nl_BE-nathalie-medium"] },
  pl: { name: "Polish", male: ["piper:pl_PL-darkman-medium"], female: ["piper:pl_PL-gosia-medium"] }
};
const TYPES = ["talk", "lesson", "story"];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const TOPICS = ["daily", "travel", "food", "health", "work", "home", "city", "school", "story", "other"];
const NARRATOR = /^(erzähler|erzählerin|verteller|vertelster|narrator|narratorka|narrador)$/i;
const MAX_WORDS = { A1: 10, A2: 14, B1: 20, B2: 26, C1: 32, C2: 40 };
const STAFF = ["designer", "manager", "admin"];
const MODEL = "claude-opus-5-5";
const BLOB_PART = 1_500_000;                                   // bytes per D1 row
export const APP_ID = id => 100000 + id;                        // the id the app uses (static lessons stay below)

const str = (v, n) => String(v ?? "").trim().slice(0, n);
const int = v => Number.parseInt(v, 10) || 0;
const pick = (v, list, d) => list.includes(v) ? v : d;
const enc = new TextEncoder();
const sha = async s => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))));

/* ================= who may do what ================= */
// LAPP library: platform staff. A school: its admins and teachers (and platform admins).
async function scope(req, env, H, url) {
  const u = await H.need(req, env);
  const slug = url.searchParams.get("org") || "";
  if (!slug) {
    if (!STAFF.includes(u.role)) throw H.fail("not allowed", 403);
    return { u, org: 0, name: "LAPP", slug: "", kind: "lapp" };
  }
  const org = await env.DB.prepare("SELECT * FROM orgs WHERE slug = ? AND disabled = 0").bind(slug).first();
  if (!org) throw H.fail("no such school", 404);
  const m = await env.DB.prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND active = 1").bind(org.id, u.id).first();
  const role = m ? m.role : u.role === "admin" ? "admin" : "";
  if (!["admin", "teacher"].includes(role)) throw H.fail("only the school's admins and teachers make lessons", 403);
  return { u, org: org.id, name: org.name, slug: org.slug, kind: "school", color: org.color };
}
async function lessonIn(env, H, sc, id) {
  const l = await env.DB.prepare("SELECT * FROM lessons WHERE id = ? AND org_id = ?").bind(id, sc.org).first();
  if (!l) throw H.fail("no such lesson", 404);
  l.data = JSON.parse(l.data || "{}");
  return l;
}
const emptyData = () => ({ cast: {}, scenes: [], phrases: [], tr: Object.fromEntries(TR.map(l => [l, { title: "", summary: "" }])), pause: 0.6, scenePause: 1.4 });

// what the list shows
function summary(l) {
  const d = typeof l.data === "string" ? JSON.parse(l.data || "{}") : l.data;
  const rows = (d.scenes || []).flatMap(s => s.lines || []);
  return {
    id: l.id, title: l.title, course: l.course, type: l.type, level: l.level, topic: l.topic, series: l.series, status: l.status, access: l.access,
    lines: rows.length, approved: rows.filter(r => r.ok).length, scenes: (d.scenes || []).length,
    audio: l.audio_rev ? (l.audio_rev === l.rev ? "ready" : "old") : "none", rev: l.rev,
    updated_at: l.updated_at, published_at: l.published_at, appId: APP_ID(l.id)
  };
}

/* ================= Claude ================= */
function claude(env, H) {
  if (!env.ANTHROPIC_API_KEY) throw H.fail("AI is not set up yet (ANTHROPIC_API_KEY)", 503, { code: "noai" });
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}
// one request, the answer as JSON that matches the schema (structured outputs)
async function ask(env, H, { prompt, schema, effort = "low", max = 16000 }) {
  const client = claude(env, H);
  const msg = await client.beta.messages.stream({
    model: MODEL, max_tokens: max,
    thinking: { type: "adaptive" }, output_config: { effort, format: { type: "json_schema", schema } },
    // a declined request is re-run on Anthropic's recommended fallback model
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    messages: [{ role: "user", content: prompt }]
  }).finalMessage();
  if (msg.stop_reason === "refusal") throw H.fail("the AI declined this request", 422);
  if (msg.stop_reason === "max_tokens") throw H.fail("the answer was too long — try a shorter brief", 422);
  const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
  try { return JSON.parse(text); } catch { throw H.fail("the AI answer was not readable — try again", 502); }
}
const trObj = (extra = {}) => ({ type: "object", additionalProperties: false, required: [...Object.keys(extra), ...TR], properties: { ...extra, ...Object.fromEntries(TR.map(l => [l, { type: "string" }])) } });
const SCRIPT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["title", "tr", "cast", "scenes", "phrases"],
  properties: {
    title: { type: "string" },
    tr: { type: "object", additionalProperties: false, required: TR, properties: Object.fromEntries(TR.map(l => [l, { type: "object", additionalProperties: false, required: ["title", "summary"], properties: { title: { type: "string" }, summary: { type: "string" } } }])) },
    cast: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "gender"], properties: { name: { type: "string" }, gender: { type: "string", enum: ["f", "m"] } } } },
    scenes: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "lines"], properties: {
      title: trObj({ de: { type: "string" } }),
      lines: { type: "array", items: trObj({ who: { type: "string" }, de: { type: "string" } }) }
    } } },
    phrases: { type: "array", items: trObj({ de: { type: "string" } }) }
  }
};

function scriptPrompt(l, chars) {
  const kind = { talk: "a short everyday conversation", lesson: "a lesson dialogue", story: "a story told by a narrator with some dialogue" }[l.type];
  const lang = COURSES[l.course].name;
  const cast = chars.length ? `\nUse these recurring characters (keep their personality; you may add 1–2 minor roles):\n${chars.map(c => `- ${c.name}${c.age ? `, ${c.age}` : ""} (${c.gender === "m" ? "male" : "female"}): ${c.bio} ${JSON.parse(c.traits || "[]").join(", ")}`).join("\n")}` : "";
  return `Write ${kind} in ${lang} for learners at level ${l.level}. It must be completely original.
Title idea: ${l.title}
Topic / brief: ${l.brief || l.title}${cast}
Rules:
- natural spoken ${lang}, one sentence per line, at most ${MAX_WORDS[l.level]} words per line, vocabulary and grammar a ${l.level} learner can follow
- 2–4 scenes, 8–14 lines each; every line has a speaker ("who"); a story uses "Erzähler" (or the narrator word of ${lang}) for narration
- translate the title, scene titles, lines and phrases naturally (not word for word) into English (en), Persian (fa), Russian (ru) and Ukrainian (uk)
- "de" always holds the ${lang} text
- "cast": every speaker once, with gender f or m
- 6–10 key phrases from the text a learner should keep`;
}

/* ================= the voice job (GitHub Actions) ================= */
async function startVoice(env, H, req, sc, l) {
  if (!env.GITHUB_TOKEN) throw H.fail("the voice service is not set up (GITHUB_TOKEN)", 503);
  const rows = (l.data.scenes || []).flatMap(s => s.lines);
  if (!rows.length) throw H.fail("write the text first");
  const missing = rows.find(r => !l.data.cast[r.who]);
  if (missing) throw H.fail(`${missing.who} has no voice yet`);
  const running = await env.DB.prepare("SELECT id FROM studio_jobs WHERE lesson_id = ? AND status IN ('queued','running') AND updated_at > ?").bind(l.id, H.now() - 20 * 60e3).first();
  if (running) throw H.fail("the audio is already being made", 409);
  const token = H.b64url(H.rand(24));
  const job = await env.DB.prepare("INSERT INTO studio_jobs (lesson_id, kind, token_hash, rev, created_by, created_at, updated_at) VALUES (?, 'voice', ?, ?, ?, ?, ?) RETURNING id")
    .bind(l.id, await sha(token), l.rev, sc.u.id, H.now(), H.now()).first();
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
async function jobApi(req, env, H, id, rest) {
  const job = await env.DB.prepare("SELECT * FROM studio_jobs WHERE id = ?").bind(id).first();
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!job || !tok || job.token_hash !== await sha(tok) || job.created_at < H.now() - 3 * 3600e3) throw H.fail("not allowed", 403);
  if (["done", "failed"].includes(job.status)) throw H.fail("this job is over", 409);
  const l = await env.DB.prepare("SELECT * FROM lessons WHERE id = ?").bind(job.lesson_id).first();
  if (!l) throw H.fail("no such lesson", 404);
  const M = req.method;
  if (rest === "" && M === "GET") {
    const d = JSON.parse(l.data);
    return H.json({ course: l.course, cast: d.cast, scenes: d.scenes, pause: d.pause ?? 0.6, scenePause: d.scenePause ?? 1.4 });
  }
  if (rest === "/status" && M === "POST") {
    const b = await H.body(req);
    await env.DB.prepare("UPDATE studio_jobs SET status = ?, log = ?, updated_at = ? WHERE id = ?").bind(pick(b.status, ["running", "failed"], "running"), str(b.log, 4000), H.now(), id).run();
    return H.json({ ok: true });
  }
  if (rest === "/audio" && M === "PUT") {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length < 100 || buf.length > 40e6) throw H.fail("bad audio", 400);
    let timings = [];
    try { timings = JSON.parse(new URL(req.url).searchParams.get("timings") || "[]"); } catch {}
    const key = `lesson/${l.id}/${job.rev}`;
    const st = [env.DB.prepare("DELETE FROM blobs WHERE key LIKE ?").bind(`lesson/${l.id}/%`)];
    for (let i = 0, p = 0; i < buf.length; i += BLOB_PART, p++) st.push(env.DB.prepare("INSERT INTO blobs (key, part, data) VALUES (?, ?, ?)").bind(key, p, buf.subarray(i, i + BLOB_PART)));
    // the published lesson keeps playing its own audio, so only drafts lose the old one
    if (l.status === "published") st.shift();
    st.push(env.DB.prepare("UPDATE lessons SET audio_rev = ?, audio_size = ?, timings = ?, status = CASE WHEN status = 'draft' THEN 'review' ELSE status END WHERE id = ?").bind(job.rev, buf.length, JSON.stringify(timings), l.id));
    st.push(env.DB.prepare("UPDATE studio_jobs SET status = 'done', log = ?, updated_at = ? WHERE id = ?").bind(`${timings.length} lines`, H.now(), id));
    await env.DB.batch(st);
    return H.json({ ok: true });
  }
  throw H.fail("not found", 404);
}

/* ================= audio from D1, with byte ranges ================= */
async function blobResponse(req, env, key, size, extra = {}) {
  const parts = (await env.DB.prepare("SELECT part, data FROM blobs WHERE key = ? ORDER BY part").bind(key).all()).results;
  if (!parts.length) return new Response("no audio yet", { status: 404 });
  const all = new Uint8Array(size || parts.reduce((n, p) => n + new Uint8Array(p.data).length, 0));
  let o = 0; for (const p of parts) { const b = new Uint8Array(p.data); all.set(b, o); o += b.length; }
  const h = { "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600", ...extra };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("Range") || "");
  if (m) {
    let a = m[1] === "" ? Math.max(0, o - int(m[2])) : int(m[1]), b = m[1] !== "" && m[2] !== "" ? Math.min(int(m[2]), o - 1) : o - 1;
    if (a > b || a >= o) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${o}` } });
    return new Response(all.subarray(a, b + 1), { status: 206, headers: { ...h, "Content-Range": `bytes ${a}-${b}/${o}`, "Content-Length": String(b - a + 1) } });
  }
  return new Response(all.subarray(0, o), { headers: { ...h, "Content-Length": String(o) } });
}

/* ================= what learners get ================= */
// lesson.json and the translations, in the same shape as content/lessons/<folder>/
function build(l) {
  const d = l.data, rows = d.scenes.flatMap(s => s.lines);
  const starts = []; let n = 0; for (const s of d.scenes) { starts.push(n); n += s.lines.length; }
  const lesson = {
    id: APP_ID(l.id), course: l.course, type: l.type, title: l.title, level: l.level, audio: "audio.mp3", made: "studio",
    phrases: (d.phrases || []).map(p => p.de),
    // the narrator of a story reads without a name in front
    transcript: rows.map(r => r.who && !NARRATOR.test(r.who) ? `**${r.who}:** ${r.de}` : r.de),
    timings: JSON.parse(l.timings || "[]"),
    words: [], focus: [], speak: { topics: [], cues: [] },
    scenes: d.scenes.map((s, i) => ({ start: starts[i], title: s.title.de }))
  };
  const tr = Object.fromEntries(TR.map(lg => [lg, {
    title: (d.tr[lg] || {}).title || "", summary: (d.tr[lg] || {}).summary || "",
    phrases: (d.phrases || []).map(p => p[lg] || ""), phraseNotes: (d.phrases || []).map(() => ""),
    lines: rows.map(r => r[lg] || ""), scenes: d.scenes.map(s => s.title[lg] || ""), topics: [], cues: [], focus: []
  }]));
  return { lesson, tr, audioKey: `lesson/${l.id}/${l.audio_rev}`, audioSize: l.audio_size, org: l.org_id, access: l.access };
}
// the lessons one person may open: the LAPP library, and their schools' own
async function visible(env, user, course) {
  const orgs = user ? (await env.DB.prepare("SELECT org_id FROM org_members WHERE user_id = ? AND active = 1").bind(user.id).all()).results.map(r => r.org_id) : [];
  const ids = [0, ...orgs];
  return (await env.DB.prepare(`SELECT id, org_id, course, title, level, type, access, published_at FROM lessons WHERE status = 'published' AND published != '' AND org_id IN (${ids.map(() => "?").join(",")})${course ? " AND course = ?" : ""} ORDER BY published_at`)
    .bind(...ids, ...(course ? [course] : [])).all()).results;
}
export async function plusLessons(env) {
  return (await env.DB.prepare("SELECT id FROM lessons WHERE status = 'published' AND org_id = 0 AND access = 'plus'").all()).results.map(r => `s-${r.id}`);
}
// GET /content/lessons/s-<id>/(lesson.json|<lang>.json|audio.mp3)
export async function servePublished(req, env, H, id, file, planOf, currentUser) {
  const row = await env.DB.prepare("SELECT org_id, published, status FROM lessons WHERE id = ?").bind(id).first();
  if (!row || !row.published) return new Response("not found", { status: 404 });
  const pub = JSON.parse(row.published);
  const user = row.org_id || pub.access === "plus" ? await currentUser(req, env) : null;
  if (row.org_id) {
    const ok = user && (user.role === "admin" || await env.DB.prepare("SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND active = 1").bind(row.org_id, user.id).first());
    if (!ok) return H.json({ error: "this lesson belongs to a school" }, 403);
  }
  if (file === "audio.mp3") {
    if (pub.access === "plus" && (await planOf(env, req, user)).tier !== "plus") return H.json({ error: "this lesson is part of Plus", code: "plus" }, 402);
    return blobResponse(req, env, pub.audioKey, pub.audioSize);
  }
  const body = file === "lesson.json" ? pub.lesson : (m => m && pub.tr[m[1]])(file.match(/^([a-z]{2})\.json$/));
  if (!body) return new Response("not found", { status: 404 });
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": row.org_id ? "private, no-cache" : "public, max-age=60" } });
}

/* ================= learners: list and events ================= */
export async function libApi(req, env, H, url, currentUser) {
  const user = await currentUser(req, env);
  const course = pick(url.searchParams.get("course"), Object.keys(COURSES), "");
  const rows = await visible(env, user, course);
  return H.json({ lessons: rows.map(r => ({ dir: `s-${r.id}`, id: APP_ID(r.id), course: r.course, title: r.title, level: r.level, type: r.type, school: !!r.org_id, access: r.access })) });
}
export async function eventsApi(req, env, H, currentUser) {
  const b = await H.body(req);
  const list = Array.isArray(b.ev) ? b.ev.slice(0, 60) : [];
  if (!list.length) return H.json({ ok: true });
  const user = await currentUser(req, env);
  const t = H.now();
  const st = list.filter(e => e && Number.isInteger(e.l) && ["open", "say", "reach"].includes(e.k)).map(e =>
    env.DB.prepare("INSERT INTO lesson_events (lesson, kind, line, value, user_id, at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(e.l, e.k, Number.isInteger(e.i) ? Math.max(-1, Math.min(e.i, 5000)) : -1, Math.max(0, Math.min(Number(e.v) || 0, 1)), user ? user.id : 0, t));
  if (st.length) await env.DB.batch(st);
  return H.json({ ok: true });
}

/* ================= insights ================= */
async function insightsOf(env, appId, lines, since) {
  const say = (await env.DB.prepare("SELECT line, AVG(value) avg, COUNT(*) n FROM lesson_events WHERE lesson = ? AND kind = 'say' AND at > ? AND line >= 0 GROUP BY line").bind(appId, since).all()).results;
  const reach = (await env.DB.prepare("SELECT line, COUNT(DISTINCT CASE WHEN user_id > 0 THEN user_id ELSE id END) n FROM lesson_events WHERE lesson = ? AND kind = 'reach' AND at > ? GROUP BY line").bind(appId, since).all()).results;
  const opens = await env.DB.prepare("SELECT COUNT(*) n, COUNT(DISTINCT CASE WHEN user_id > 0 THEN user_id END) u FROM lesson_events WHERE lesson = ? AND kind = 'open' AND at > ?").bind(appId, since).first();
  // reached line i = reached any line ≥ i
  const byLine = Array.from({ length: lines }, () => 0);
  for (const r of reach) if (r.line >= 0 && r.line < lines) byLine[r.line] = r.n;
  for (let i = lines - 2; i >= 0; i--) byLine[i] = Math.max(byLine[i], byLine[i + 1]);
  return { opens: opens.n, learners: opens.u, say: say.map(r => ({ line: r.line, avg: Math.round(r.avg * 100), n: r.n })), reach: byLine };
}

/* ================= the studio API ================= */
export async function lessonsApi(req, env, H, p, url, ctx) {
  const M = req.method;
  let m;
  if ((m = p.match(/^\/jobs\/(\d+)(\/[a-z]+)?$/))) return jobApi(req, env, H, int(m[1]), m[2] || "");

  const sc = await scope(req, env, H, url);
  const t = H.now();

  if (p === "/scope" && M === "GET") {
    const schools = (await env.DB.prepare("SELECT o.slug, o.name FROM org_members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND m.active = 1 AND m.role IN ('admin','teacher') AND o.disabled = 0").bind(sc.u.id).all()).results;
    return H.json({ scope: { kind: sc.kind, name: sc.name, slug: sc.slug, color: sc.color || "" }, me: { id: sc.u.id, name: sc.u.name, username: sc.u.username, role: sc.u.role },
      staff: STAFF.includes(sc.u.role), schools, ai: !!env.ANTHROPIC_API_KEY, voice: !!env.GITHUB_TOKEN,
      courses: Object.fromEntries(Object.entries(COURSES).map(([k, v]) => [k, { name: v.name, voices: [...v.female.map(x => ({ id: x, g: "f" })), ...v.male.map(x => ({ id: x, g: "m" }))] }])),
      topics: TOPICS, levels: LEVELS, types: TYPES, maxWords: MAX_WORDS });
  }

  /* ---- overview: KPIs, the curriculum map, suggestions ---- */
  if (p === "/overview" && M === "GET") {
    const rows = (await env.DB.prepare("SELECT id, title, course, type, level, topic, status, data, rev, audio_rev, series, access, updated_at, published_at FROM lessons WHERE org_id = ? ORDER BY updated_at DESC").bind(sc.org).all()).results;
    const week = t - 7 * H.DAY;
    const appIds = rows.filter(r => r.status === "published").map(r => APP_ID(r.id));
    let learners = 0, says = 0, hard = [];
    if (sc.org) learners = (await env.DB.prepare("SELECT COUNT(*) n FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.role = 'student' AND u.last_seen > ?").bind(sc.org, week).first()).n;
    else learners = (await env.DB.prepare("SELECT COUNT(*) n FROM users WHERE last_seen > ?").bind(week).first()).n;
    if (appIds.length) {
      const q = appIds.map(() => "?").join(",");
      says = (await env.DB.prepare(`SELECT COUNT(*) n FROM lesson_events WHERE kind = 'say' AND at > ? AND lesson IN (${q})`).bind(week, ...appIds).first()).n;
      hard = (await env.DB.prepare(`SELECT lesson, line, AVG(value) avg, COUNT(*) n FROM lesson_events WHERE kind = 'say' AND at > ? AND line >= 0 AND lesson IN (${q}) GROUP BY lesson, line HAVING n >= 3 ORDER BY avg LIMIT 5`).bind(t - 30 * H.DAY, ...appIds).all()).results;
    }
    const byId = Object.fromEntries(rows.map(r => [APP_ID(r.id), r]));
    hard = hard.map(h => { const l = byId[h.lesson], d = JSON.parse(l.data); const line = d.scenes.flatMap(s => s.lines)[h.line]; return line ? { lesson: l.id, title: l.title, line: h.line, text: line.de, avg: Math.round(h.avg * 100), n: h.n } : null; }).filter(Boolean);
    return H.json({ lessons: rows.map(summary), learners, says, hard });
  }

  /* ---- lessons ---- */
  if (p === "/lessons" && M === "GET") {
    const rows = (await env.DB.prepare("SELECT * FROM lessons WHERE org_id = ? ORDER BY updated_at DESC").bind(sc.org).all()).results;
    return H.json({ lessons: rows.map(summary) });
  }
  if (p === "/lessons" && M === "POST") {
    const b = await H.body(req);
    const list = Array.isArray(b.lessons) ? b.lessons.slice(0, 12) : [b];
    const out = [];
    for (const x of list) {
      const title = str(x.title, 80);
      if (!title) throw H.fail("the lesson needs a title");
      const course = pick(x.course, Object.keys(COURSES), "de");
      const d = emptyData();
      if (Array.isArray(x.characters)) d.characters = x.characters.map(int).filter(Boolean).slice(0, 6);
      const r = await env.DB.prepare("INSERT INTO lessons (org_id, created_by, course, type, level, topic, series, title, brief, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(sc.org, sc.u.id, course, pick(x.type, TYPES, "talk"), pick(x.level, LEVELS, "A1"), pick(x.topic, TOPICS, "other"), str(x.series, 60), title, str(x.brief, 2000), JSON.stringify(d), t, t).first();
      out.push(summary(r));
    }
    return H.json(Array.isArray(b.lessons) ? { lessons: out } : out[0]);
  }
  if ((m = p.match(/^\/lessons\/(\d+)$/)) && M === "GET") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    const job = await env.DB.prepare("SELECT id, status, log, rev, updated_at FROM studio_jobs WHERE lesson_id = ? ORDER BY id DESC LIMIT 1").bind(l.id).first();
    return H.json({ ...summary(l), brief: l.brief, data: l.data, timings: JSON.parse(l.timings || "[]"), audioRev: l.audio_rev, job, created_by: l.created_by });
  }
  if ((m = p.match(/^\/lessons\/(\d+)$/)) && M === "PUT") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    const b = await H.body(req);
    if (b.rev !== l.rev) throw H.fail("someone else changed this lesson — reload it", 409, { code: "rev" });
    const sets = ["rev = rev + 1", "updated_at = ?"], vals = [t];
    for (const [k, n] of [["title", 80], ["brief", 2000], ["series", 60]]) if (b[k] !== undefined) { sets.push(`${k} = ?`); vals.push(str(b[k], n)); }
    if (b.course !== undefined) { sets.push("course = ?"); vals.push(pick(b.course, Object.keys(COURSES), l.course)); }
    if (b.type !== undefined) { sets.push("type = ?"); vals.push(pick(b.type, TYPES, l.type)); }
    if (b.level !== undefined) { sets.push("level = ?"); vals.push(pick(b.level, LEVELS, l.level)); }
    if (b.topic !== undefined) { sets.push("topic = ?"); vals.push(pick(b.topic, TOPICS, l.topic)); }
    if (b.access !== undefined && !sc.org) { sets.push("access = ?"); vals.push(b.access === "plus" ? "plus" : "free"); }
    if (b.data !== undefined) {
      const text = JSON.stringify(b.data);
      if (text.length > 600_000) throw H.fail("the script is too long", 413);
      if (!b.data || !Array.isArray(b.data.scenes) || typeof b.data.cast !== "object") throw H.fail("bad script");
      sets.push("data = ?"); vals.push(text);
      if (l.status === "draft" && b.data.scenes.length) { sets.push("status = 'review'"); }
    }
    const r = await env.DB.prepare(`UPDATE lessons SET ${sets.join(", ")} WHERE id = ? AND rev = ? RETURNING rev`).bind(...vals, l.id, l.rev).first();
    if (!r) throw H.fail("someone else changed this lesson — reload it", 409, { code: "rev" });
    return H.json({ rev: r.rev });
  }
  if ((m = p.match(/^\/lessons\/(\d+)$/)) && M === "DELETE") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await env.DB.batch([
      env.DB.prepare("DELETE FROM blobs WHERE key LIKE ?").bind(`lesson/${l.id}/%`),
      env.DB.prepare("DELETE FROM studio_jobs WHERE lesson_id = ?").bind(l.id),
      env.DB.prepare("DELETE FROM materials WHERE kind = 'lesson' AND url = ?").bind(`s-${l.id}`),
      env.DB.prepare("DELETE FROM lessons WHERE id = ?").bind(l.id)
    ]);
    return H.json({ ok: true });
  }

  /* ---- AI: write the whole script (streamed, so the person watches it being written) ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/write$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await limitAi(env, H, sc);
    const client = claude(env, H);
    const ids = l.data.characters || [];
    const chars = ids.length ? (await env.DB.prepare(`SELECT * FROM characters WHERE org_id = ? AND id IN (${ids.map(() => "?").join(",")})`).bind(sc.org, ...ids).all()).results : [];
    const { readable, writable } = new TransformStream();
    const w = writable.getWriter(), send = o => w.write(enc.encode(JSON.stringify(o) + "\n"));
    const work = (async () => {
      try {
        const stream = client.beta.messages.stream({
          model: MODEL, max_tokens: 64000,
          thinking: { type: "adaptive" }, output_config: { effort: "medium", format: { type: "json_schema", schema: SCRIPT_SCHEMA } },
          betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
          messages: [{ role: "user", content: scriptPrompt(l, chars) }]
        });
        let buf = "", last = 0;
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            buf += ev.delta.text;
            if (Date.now() - last > 250) { await send({ t: "text", text: buf }); last = Date.now(); }
          }
        }
        const msg = await stream.finalMessage();
        if (msg.stop_reason === "refusal") throw new Error("the AI declined this request");
        if (msg.stop_reason === "max_tokens") throw new Error("the answer was cut off");
        const src = JSON.parse(msg.content.filter(b => b.type === "text").map(b => b.text).join(""));
        const d = merge(l, src, chars);
        const r = await env.DB.prepare("UPDATE lessons SET data = ?, rev = rev + 1, status = CASE WHEN status = 'draft' THEN 'review' ELSE status END, updated_at = ? WHERE id = ? RETURNING rev").bind(JSON.stringify(d), H.now(), l.id).first();
        await send({ t: "done", data: d, rev: r.rev });
      } catch (e) {
        await send({ t: "error", error: e.message || String(e) }).catch(() => {});
      } finally { await w.close().catch(() => {}); }
    })();
    if (ctx) ctx.waitUntil(work);
    return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  }

  /* ---- AI: fill the missing translations ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/translate$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await limitAi(env, H, sc);
    const d = l.data, todo = [];
    d.scenes.forEach((s, si) => {
      const need = TR.filter(x => !s.title[x]); if (need.length) todo.push({ id: `s${si}`, text: s.title.de, need });
      s.lines.forEach((ln, li) => { const n = TR.filter(x => !ln[x]); if (n.length) todo.push({ id: `l${si}.${li}`, text: ln.de, need: n }); });
    });
    (d.phrases || []).forEach((ph, pi) => { const n = TR.filter(x => !ph[x]); if (n.length) todo.push({ id: `p${pi}`, text: ph.de, need: n }); });
    const titleNeed = TR.filter(x => !(d.tr[x] || {}).title);
    if (!todo.length && !titleNeed.length) return H.json({ data: d, rev: l.rev, added: 0 });
    const got = await ask(env, H, {
      effort: "low", max: 32000,
      schema: { type: "object", additionalProperties: false, required: ["items", "titles"], properties: {
        items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", ...TR], properties: { id: { type: "string" }, ...Object.fromEntries(TR.map(x => [x, { type: "string" }])) } } },
        titles: { type: "object", additionalProperties: false, required: TR, properties: Object.fromEntries(TR.map(x => [x, { type: "object", additionalProperties: false, required: ["title", "summary"], properties: { title: { type: "string" }, summary: { type: "string" } } }])) }
      } },
      prompt: `A ${COURSES[l.course].name} lesson for ${l.level} learners, titled "${l.title}":\n${d.scenes.flatMap(s => s.lines).map(x => x.de).join("\n")}\n\nTranslate each item below naturally (not word for word) into English (en), Persian (fa), Russian (ru) and Ukrainian (uk). Also give a short title and a one-sentence summary of the lesson in each language.\n${JSON.stringify(todo.map(({ id, text }) => ({ id, text })))}`
    });
    let added = 0;
    const byId = Object.fromEntries((got.items || []).map(x => [x.id, x]));
    d.scenes.forEach((s, si) => {
      const g = byId[`s${si}`]; if (g) TR.forEach(x => { if (!s.title[x] && g[x]) { s.title[x] = g[x]; added++; } });
      s.lines.forEach((ln, li) => { const g2 = byId[`l${si}.${li}`]; if (g2) TR.forEach(x => { if (!ln[x] && g2[x]) { ln[x] = g2[x]; added++; } }); });
    });
    (d.phrases || []).forEach((ph, pi) => { const g = byId[`p${pi}`]; if (g) TR.forEach(x => { if (!ph[x] && g[x]) { ph[x] = g[x]; added++; } }); });
    for (const x of titleNeed) if (got.titles && got.titles[x]) { d.tr[x] = got.titles[x]; added++; }
    const r = await env.DB.prepare("UPDATE lessons SET data = ?, rev = rev + 1, updated_at = ? WHERE id = ? AND rev = ? RETURNING rev").bind(JSON.stringify(d), H.now(), l.id, l.rev).first();
    if (!r) throw H.fail("someone else changed this lesson — reload it", 409, { code: "rev" });
    return H.json({ data: d, rev: r.rev, added });
  }

  /* ---- AI: other versions of one line (simpler, more natural, …) ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/rewrite$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await limitAi(env, H, sc);
    const b = await H.body(req);
    const rows = l.data.scenes.flatMap(s => s.lines), i = int(b.line);
    const ln = rows[i]; if (!ln) throw H.fail("no such line");
    const how = {
      simpler: `simpler, so a ${l.level} learner understands it (common words, short)`,
      natural: "more natural, the way people really say it",
      question: "turned into a question the other speaker could ask, or with a short question added",
      shorter: "shorter",
      formal: "more polite / formal",
      casual: "more casual / informal",
      custom: str(b.instruction, 300) || "better"
    }[b.mode] || "better";
    const got = await ask(env, H, {
      effort: "low",
      schema: { type: "object", additionalProperties: false, required: ["options"], properties: { options: { type: "array", items: { type: "object", additionalProperties: false, required: ["de", "why", ...TR], properties: { de: { type: "string" }, why: { type: "string" }, ...Object.fromEntries(TR.map(x => [x, { type: "string" }])) } } } } },
      prompt: `A ${COURSES[l.course].name} lesson for ${l.level} learners. Context (lines around it):\n${rows.slice(Math.max(0, i - 3), i + 4).map((x, k) => `${Math.max(0, i - 3) + k === i ? ">> " : "   "}${x.who}: ${x.de}`).join("\n")}\n\nGive 3 versions of the marked line (${ln.who}: "${ln.de}"), ${how}. At most ${MAX_WORDS[l.level]} words. For each: the ${COURSES[l.course].name} text in "de", its translations (en, fa, ru, uk), and in "why" a very short English reason.`
    });
    return H.json({ options: (got.options || []).slice(0, 3) });
  }

  /* ---- AI: how hard is each line ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/check$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await limitAi(env, H, sc);
    const rows = l.data.scenes.flatMap(s => s.lines);
    if (!rows.length) throw H.fail("write the text first");
    const got = await ask(env, H, {
      effort: "low", max: 32000,
      schema: { type: "object", additionalProperties: false, required: ["lines", "grammar", "note"], properties: {
        lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["i", "level", "hard"], properties: { i: { type: "integer" }, level: { type: "string", enum: LEVELS }, hard: { type: "array", items: { type: "string" } } } } },
        grammar: { type: "array", items: { type: "string" } }, note: { type: "string" }
      } },
      prompt: `Rate this ${COURSES[l.course].name} text for a ${l.level} course. For every line (i = its number): its CEFR level, and in "hard" the exact words from the line that are above ${l.level}. "grammar": the main grammar points it practises (short English names). "note": one sentence of advice in English.\n${rows.map((r, k) => `${k}: ${r.de}`).join("\n")}`
    });
    const check = { rev: l.rev, at: H.now(), lines: got.lines || [], grammar: got.grammar || [], note: got.note || "" };
    l.data.check = check;
    const r = await env.DB.prepare("UPDATE lessons SET data = ?, rev = rev + 1 WHERE id = ? AND rev = ? RETURNING rev").bind(JSON.stringify(l.data), l.id, l.rev).first();
    if (!r) throw H.fail("someone else changed this lesson — reload it", 409, { code: "rev" });
    return H.json({ check, rev: r.rev });
  }

  /* ---- AI: plan a series from one sentence ---- */
  if (p === "/plan" && M === "POST") {
    await limitAi(env, H, sc);
    const b = await H.body(req);
    const want = str(b.prompt, 1000); if (!want) throw H.fail("say what you want");
    const existing = (await env.DB.prepare("SELECT title, level, topic, course FROM lessons WHERE org_id = ? ORDER BY id DESC LIMIT 60").bind(sc.org).all()).results;
    const got = await ask(env, H, {
      effort: "medium",
      schema: { type: "object", additionalProperties: false, required: ["series", "summary", "lessons"], properties: {
        series: { type: "string" }, summary: { type: "string" },
        lessons: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "brief", "type", "level", "topic", "course"], properties: {
          title: { type: "string" }, brief: { type: "string" }, type: { type: "string", enum: TYPES }, level: { type: "string", enum: LEVELS }, topic: { type: "string", enum: TOPICS }, course: { type: "string", enum: Object.keys(COURSES) } } } }
      } },
      prompt: `You plan lessons for LAPP, a speaking-first app for learning German (de), Dutch (nl) and Polish (pl). Each lesson is a short audio conversation, lesson dialogue or story.
Request: ${want}
${b.course ? `Course: ${b.course}. ` : ""}${b.level ? `Level: ${b.level}.` : ""}
Lessons that already exist (don't repeat them): ${existing.map(e => `${e.course}/${e.level}/${e.topic}: ${e.title}`).join("; ") || "none"}
Plan 1–8 lessons. "title" in the course language, "brief" in English: the situation, what learners practise (words, grammar), 1–2 sentences. "series": a short English name for the whole plan. "summary": one English sentence about it.`
    });
    return H.json(got);
  }

  /* ---- voice ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/voice$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    return H.json({ job: await startVoice(env, H, req, sc, l) });
  }
  if ((m = p.match(/^\/lessons\/(\d+)\/audio$/)) && M === "GET") {
    const l = await env.DB.prepare("SELECT id, audio_rev, audio_size FROM lessons WHERE id = ? AND org_id = ?").bind(int(m[1]), sc.org).first();
    if (!l || !l.audio_rev) return new Response("no audio yet", { status: 404 });
    return blobResponse(req, env, `lesson/${l.id}/${l.audio_rev}`, l.audio_size);
  }

  /* ---- publish ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/publish$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    const rows = l.data.scenes.flatMap(s => s.lines);
    if (!rows.length) throw H.fail("write the text first");
    if (!l.audio_rev) throw H.fail("make the audio first");
    if (l.audio_rev !== l.rev && !(await H.body(req).catch(() => ({}))).force) throw H.fail("the text changed after the audio was made — make the audio again", 409, { code: "stale" });
    const missing = TR.filter(x => rows.some(r => !r[x]) || !(l.data.tr[x] || {}).title);
    if (missing.length) throw H.fail(`translations missing: ${missing.join(", ")}`, 409, { code: "tr" });
    const pub = build(l);
    await env.DB.batch([
      env.DB.prepare("UPDATE lessons SET status = 'published', published = ?, published_at = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(pub), t, t, l.id),
      // older recordings are not needed any more
      env.DB.prepare("DELETE FROM blobs WHERE key LIKE ? AND key != ?").bind(`lesson/${l.id}/%`, pub.audioKey)
    ]);
    return H.json({ ok: true, dir: `s-${l.id}` });
  }
  if ((m = p.match(/^\/lessons\/(\d+)\/unpublish$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await env.DB.prepare("UPDATE lessons SET status = 'review', published = '', updated_at = ? WHERE id = ?").bind(t, l.id).run();
    return H.json({ ok: true });
  }

  /* ---- insights ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/insights$/)) && M === "GET") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    const days = Math.min(90, Math.max(1, int(url.searchParams.get("days")) || 30));
    const lines = l.data.scenes.flatMap(s => s.lines).length;
    return H.json({ days, ...(await insightsOf(env, APP_ID(l.id), lines, t - days * H.DAY)) });
  }

  /* ---- characters ---- */
  if (p === "/characters" && M === "GET") {
    const rows = (await env.DB.prepare("SELECT * FROM characters WHERE org_id = ? ORDER BY id").bind(sc.org).all()).results;
    const used = (await env.DB.prepare("SELECT data FROM lessons WHERE org_id = ?").bind(sc.org).all()).results.map(r => JSON.parse(r.data).characters || []);
    return H.json({ characters: rows.map(c => ({ ...c, traits: JSON.parse(c.traits), voices: JSON.parse(c.voices), lessons: used.filter(u => u.includes(c.id)).length })) });
  }
  if ((p === "/characters" && M === "POST") || ((m = p.match(/^\/characters\/(\d+)$/)) && M === "PUT")) {
    const b = await H.body(req);
    const name = str(b.name, 40); if (!name) throw H.fail("the character needs a name");
    const vals = [name, Math.max(0, Math.min(int(b.age), 120)), str(b.bio, 400), JSON.stringify((Array.isArray(b.traits) ? b.traits : []).map(x => str(x, 24)).filter(Boolean).slice(0, 6)),
      str(b.emoji, 8) || "🙂", /^#[0-9a-fA-F]{6}$/.test(b.color || "") ? b.color : "#8B5CF6", b.gender === "m" ? "m" : "f",
      JSON.stringify(Object.fromEntries(Object.entries(b.voices || {}).filter(([k, v]) => COURSES[k] && [...COURSES[k].male, ...COURSES[k].female].includes(v))))];
    if (p === "/characters") {
      const r = await env.DB.prepare("INSERT INTO characters (name, age, bio, traits, emoji, color, gender, voices, org_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(...vals, sc.org, t).first();
      return H.json({ id: r.id });
    }
    const r = await env.DB.prepare("UPDATE characters SET name = ?, age = ?, bio = ?, traits = ?, emoji = ?, color = ?, gender = ?, voices = ? WHERE id = ? AND org_id = ?").bind(...vals, int(m[1]), sc.org).run();
    if (!r.meta.changes) throw H.fail("no such character", 404);
    return H.json({ ok: true });
  }
  if ((m = p.match(/^\/characters\/(\d+)$/)) && M === "DELETE") {
    await env.DB.prepare("DELETE FROM characters WHERE id = ? AND org_id = ?").bind(int(m[1]), sc.org).run();
    return H.json({ ok: true });
  }

  throw H.fail("not found", 404);
}

// at most 80 AI requests a day per person
async function limitAi(env, H, sc) {
  const day = Math.floor(H.now() / H.DAY);
  const r = await env.DB.prepare("INSERT INTO hits (key, n, reset) VALUES (?1, 1, ?2) ON CONFLICT(key) DO UPDATE SET n = n + 1 RETURNING n").bind(`ai:${sc.u.id}:${day}`, (day + 2) * H.DAY).first();
  if (r.n > 80) throw H.fail("the daily AI limit is reached — try again tomorrow", 429);
}

// a written script → the lesson's data; every speaker gets a voice (a character's own, or a free one)
function merge(l, src, chars) {
  const d = { ...emptyData(), ...l.data };
  d.title = src.title;
  d.tr = Object.fromEntries(TR.map(x => [x, src.tr[x] || { title: "", summary: "" }]));
  d.scenes = src.scenes.map(s => ({ title: s.title, lines: s.lines.map(x => ({ ...x, ok: false })) }));
  d.phrases = src.phrases;
  delete d.check;
  const pool = COURSES[l.course], cast = {};
  const used = new Set();
  for (const c of src.cast) {
    const ch = chars.find(x => x.name.split(/[ ,]/)[0].toLowerCase() === c.name.split(/[ ,]/)[0].toLowerCase());
    const own = ch && JSON.parse(ch.voices || "{}")[l.course];
    const g = ch ? ch.gender : c.gender;
    const list = g === "m" ? pool.male : pool.female;
    const voice = own || list.find(v => !used.has(v)) || list[0];
    used.add(voice);
    cast[c.name] = { voice, speed: 0.95, gender: g, ...(ch ? { character: ch.id, emoji: ch.emoji, color: ch.color } : {}) };
  }
  // a speaker the cast list forgot
  for (const ln of d.scenes.flatMap(s => s.lines)) if (!cast[ln.who]) cast[ln.who] = { voice: pool.female.find(v => !used.has(v)) || pool.female[0], speed: 0.95, gender: "f" };
  d.cast = cast;
  return d;
}
