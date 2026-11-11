// Studio: lessons made in the site, by LAPP staff (the library everyone sees) or by a school
// (only its own students see them). Everything lives in D1; the audio too (table blobs).
//
//   /api/studio/...            the studio (staff, or a school's admins and teachers with ?org=<slug>)
//   /api/studio/jobs/:id/...   the voice job in GitHub Actions, with its one-time token
//   /api/lib?course=de         published lessons this person may open (the app adds them to its list)
//   /content/lessons/s-<id>/   lesson.json · <lang>.json · audio.mp3, the same shape as the static lessons
//   /api/ev                    what learners do in a lesson (for the studio's insights)
//
// Writing, translating and rewriting use the AI the admin picks in /admin → AI (worker/src/ai.js;
// by default LAPP's own, an open-source model on our Cloudflare account). The voice is made
// with Piper in .github/workflows/studio-voice.yml (_studio/job.py), so it costs nothing.
import * as AI from "./ai.js";
import { voiceApi, voicesFor, jobApi, withIds, lineIds, lessonFilesGone } from "./voice.js";
import { str, int, pick, aiLimit, revConflict, blobPut, blobGet, LEVELS, STAFF, COURSES, sha, enc, memberOf } from "./util.js";

export const TR = ["en", "fa", "ru", "uk"];                       // translation languages
const LANG_NAME = { en: "English", fa: "Persian", ru: "Russian", uk: "Ukrainian" };
const TYPES = ["talk", "lesson", "story"];
export const TOPICS = ["daily", "travel", "food", "health", "work", "home", "city", "school", "story", "other"];
const NARRATOR = /^(erzähler|erzählerin|verteller|vertelster|narrator|narratorka|narrador)$/i;
const MAX_WORDS = { A1: 10, A2: 14, B1: 20, B2: 26, C1: 32, C2: 40 };
export const APP_ID = id => 100000 + id;                        // the id the app uses (static lessons stay below)


/* ================= who may do what ================= */
// LAPP library: platform staff. A school: its admins and teachers (and platform admins).
async function scope(req, env, H, url) {
  const u = await H.need(req, env);
  const slug = url.searchParams.get("org") || "";
  if (!slug) {
    if (!STAFF.includes(u.role)) throw H.fail("not allowed", 403);
    return { u, org: 0, name: "LAPP", slug: "", kind: "lapp" };
  }
  const { org, role } = await memberOf(env, u, slug);
  if (org.disabled || !["admin", "teacher"].includes(role)) throw H.fail("only the school's admins and teachers make lessons", 403);
  return { u, org: org.id, name: org.name, slug: org.slug, kind: "school", color: org.color };
}
async function lessonIn(env, H, sc, id) {
  const l = await env.DB.prepare("SELECT * FROM lessons WHERE id = ? AND org_id = ?").bind(id, sc.org).first();
  if (!l) throw H.fail("no such lesson", 404);
  l.data = await withIds(env, l, JSON.parse(l.data || "{}"));
  return l;
}
// keep the version a change replaces: every AI change, and a hand-made one at most every 10 minutes; 40 per lesson
async function keepVersion(env, H, sc, l, note, ai) {
  const last = await env.DB.prepare("SELECT created_at, by_ai FROM lesson_versions WHERE lesson_id = ? ORDER BY id DESC LIMIT 1").bind(l.id).first();
  if (!ai && last && !last.by_ai && H.now() - last.created_at < 10 * 60e3) return;
  await env.DB.prepare("INSERT INTO lesson_versions (lesson_id, rev, title, data, note, by_user, by_ai, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(l.id, l.rev, l.title, typeof l.data === "string" ? l.data : JSON.stringify(l.data), str(note, 120), sc.u.id, ai ? 1 : 0, H.now()).run();
  await env.DB.prepare("DELETE FROM lesson_versions WHERE lesson_id = ? AND id NOT IN (SELECT id FROM lesson_versions WHERE lesson_id = ? ORDER BY id DESC LIMIT 40)").bind(l.id, l.id).run();
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
    updated_at: l.updated_at, published_at: l.published_at, appId: APP_ID(l.id),
    folder: l.folder_id || 0, own: l.access_own || "", binned: l.binned_at || 0
  };
}

/* ================= AI ================= */
// a task's answer from the chosen AI, as JSON in the schema's shape
async function ask(env, H, task, o) {
  try { return (await AI.ask(env, task, o)).value; }
  catch (e) { throw H.fail(e.message, e.status || 502, e.extra); }
}
const trObj = (extra = {}) => ({ type: "object", additionalProperties: false, required: [...Object.keys(extra), ...TR], properties: { ...extra, ...Object.fromEntries(TR.map(l => [l, { type: "string" }])) } });
// the script in the course language only; translations are a second step (translateAll), in small
// batches, so a long dialogue never runs out of room halfway and gets swapped for a retry
const SCRIPT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["title", "cast", "scenes", "phrases"],
  properties: {
    title: { type: "string" },
    cast: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "gender"], properties: { name: { type: "string" }, gender: { type: "string", enum: ["f", "m"] } } } },
    scenes: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "lines"], properties: {
      title: { type: "string" },
      lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["who", "de"], properties: { who: { type: "string" }, de: { type: "string" } } } }
    } } },
    phrases: { type: "array", items: { type: "string" } }
  }
};

// everything still without a translation, a batch at a time; onStep(done, total) reports progress
async function translateAll(env, l, d, onStep) {
  const todo = [];
  d.scenes.forEach((s, si) => {
    if (TR.some(x => !s.title[x])) todo.push({ id: `s${si}`, text: s.title.de });
    s.lines.forEach((ln, li) => { if (TR.some(x => !ln[x])) todo.push({ id: `l${si}.${li}`, text: ln.de }); });
  });
  (d.phrases || []).forEach((ph, pi) => { if (TR.some(x => !ph[x])) todo.push({ id: `p${pi}`, text: ph.de }); });
  const titleNeed = TR.filter(x => !(d.tr[x] || {}).title);
  const batches = [];
  for (let i = 0; i < todo.length; i += 14) batches.push(todo.slice(i, i + 14));
  if (!batches.length && titleNeed.length) batches.push([]);
  const script = d.scenes.flatMap(s => s.lines).map(x => `${x.who}: ${x.de}`).join("\n");
  const byId = {};
  let titles = null;
  for (const [bi, batch] of batches.entries()) {
    if (onStep) await onStep(bi, batches.length);
    const wantTitles = bi === 0 && titleNeed.length;
    const got = (await AI.ask(env, "translate", {
      max: 6000,
      schema: { type: "object", additionalProperties: false, required: ["items", ...(wantTitles ? ["titles"] : [])], properties: {
        items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", ...TR], properties: { id: { type: "string" }, ...Object.fromEntries(TR.map(x => [x, { type: "string" }])) } } },
        ...(wantTitles ? { titles: { type: "object", additionalProperties: false, required: TR, properties: Object.fromEntries(TR.map(x => [x, { type: "object", additionalProperties: false, required: ["title", "summary"], properties: { title: { type: "string" }, summary: { type: "string" } } }])) } } : {})
      } },
      prompt: `A ${COURSES[l.course].name} lesson for ${l.level} learners, titled "${l.title}":\n${script}\n\nTranslate each item below naturally (not word for word) into English (en), Persian (fa), Russian (ru) and Ukrainian (uk). Keep every id.${wantTitles ? " Also give a short title and a one-sentence summary of the whole lesson in each language (titles)." : ""}\n${JSON.stringify(batch)}`
    })).value;
    for (const x of got.items || []) byId[x.id] = x;
    if (got.titles) titles = got.titles;
  }
  let added = 0;
  const put = (o, g) => { if (g) TR.forEach(x => { if (!o[x] && g[x]) { o[x] = String(g[x]); added++; } }); };
  d.scenes.forEach((s, si) => { put(s.title, byId[`s${si}`]); s.lines.forEach((ln, li) => put(ln, byId[`l${si}.${li}`])); });
  (d.phrases || []).forEach((ph, pi) => put(ph, byId[`p${pi}`]));
  for (const x of titleNeed) if (titles && titles[x] && titles[x].title) { d.tr[x] = { title: String(titles[x].title), summary: String(titles[x].summary || "") }; added++; }
  return added;
}

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
- "de" holds the ${lang} text of each line; scene titles and phrases are ${lang} too (no translations)
- "cast": every speaker once, with gender "f" (female) or "m" (male), matching the name
- "phrases": 6–10 key phrases from the text a learner should keep`;
}

/* ================= audio from D1, with byte ranges ================= */
async function blobResponse(req, env, key, size, extra = {}) {
  const all = await blobGet(env, key, size);
  if (!all) return new Response("no audio yet", { status: 404 });
  const o = all.length;
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
/* ================= the drive: folders, rules, the bin ================= */
const BIN_DAYS = 30;
const cleanRules = r => ({ access: r && r.access === "plus" ? "plus" : "", level: r && LEVELS.includes(r.level) ? r.level : "", approved: !!(r && r.approved) });
async function folderMap(env, org) {
  const rows = (await env.DB.prepare("SELECT id, parent_id, name, rules FROM folders WHERE org_id = ?").bind(org).all()).results;
  return new Map(rows.map(f => [f.id, { ...f, rules: cleanRules(JSON.parse(f.rules || "{}")) }]));
}
// the rules a folder passes down: Plus anywhere above makes it Plus; the nearest level wins; "approved" anywhere counts
function rulesOf(F, id) {
  const out = { access: "", level: "", approved: false, from: {} };
  for (let i = 0, f = F.get(id); f && i < 40; i++, f = F.get(f.parent_id)) {
    if (f.rules.access === "plus" && !out.access) { out.access = "plus"; out.from.access = f.name; }
    if (f.rules.level && !out.level) { out.level = f.rules.level; out.from.level = f.name; }
    if (f.rules.approved && !out.approved) { out.approved = true; out.from.approved = f.name; }
  }
  return out;
}
// lessons.access is what learners get: Plus if the lesson or any folder above it says so (stricter, never looser)
async function settleAccess(env, org, F) {
  if (org) return;
  F = F || await folderMap(env, org);
  const rows = (await env.DB.prepare("SELECT id, folder_id, access, access_own FROM lessons WHERE org_id = 0").all()).results;
  const st = rows.map(l => [l, l.access_own === "plus" || rulesOf(F, l.folder_id).access === "plus" ? "plus" : "free"]).filter(([l, a]) => l.access !== a)
    .map(([l, a]) => env.DB.prepare("UPDATE lessons SET access = ? WHERE id = ?").bind(a, l.id));
  if (st.length) await env.DB.batch(st);
}
async function dropLesson(env, id) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM blobs WHERE key LIKE ?").bind(`lesson/${id}/%`),
    ...lessonFilesGone(env, "id = ?", id),
    env.DB.prepare("DELETE FROM materials WHERE kind = 'lesson' AND url = ?").bind(`s-${id}`),
    env.DB.prepare("DELETE FROM lessons WHERE id = ?").bind(id)
  ]);
}

export async function lessonsApi(req, env, H, p, url, ctx) {
  const M = req.method;
  let m;
  if ((m = p.match(/^\/jobs\/(\d+)(\/[a-z]+(?:\/[\w-]+)?)?$/))) return jobApi(req, env, H, int(m[1]), m[2] || "");

  const sc = await scope(req, env, H, url);
  const t = H.now();

  if (p === "/scope" && M === "GET") {
    const schools = (await env.DB.prepare("SELECT o.slug, o.name FROM org_members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND m.active = 1 AND m.role IN ('admin','teacher') AND o.disabled = 0").bind(sc.u.id).all()).results;
    return H.json({ scope: { kind: sc.kind, name: sc.name, slug: sc.slug, color: sc.color || "" }, me: { id: sc.u.id, name: sc.u.name, username: sc.u.username, role: sc.u.role },
      staff: STAFF.includes(sc.u.role), schools, ai: await AI.available(env), voice: !!env.GITHUB_TOKEN,
      courses: Object.fromEntries(await Promise.all(Object.entries(COURSES).map(async ([k, v]) => [k, { name: v.name, voices: await voicesFor(env, sc.org, k) }]))),
      topics: TOPICS, levels: LEVELS, types: TYPES, maxWords: MAX_WORDS });
  }

  /* ---- overview: KPIs, the curriculum map, suggestions ---- */
  if (p === "/overview" && M === "GET") {
    const rows = (await env.DB.prepare("SELECT id, title, course, type, level, topic, status, data, rev, audio_rev, series, access, updated_at, published_at FROM lessons WHERE org_id = ? AND binned_at = 0 ORDER BY updated_at DESC").bind(sc.org).all()).results;
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

  /* ---- work running in the background (audio), for the panel's tray ---- */
  if (p === "/jobs" && M === "GET") {
    const rows = (await env.DB.prepare("SELECT j.id, j.lesson_id, j.kind, j.status, j.log, j.updated_at, l.title FROM studio_jobs j JOIN lessons l ON l.id = j.lesson_id WHERE l.org_id = ? AND j.updated_at > ? ORDER BY j.id DESC LIMIT 12").bind(sc.org, t - H.DAY).all()).results;
    // a job silent for 20 minutes has died
    return H.json({ jobs: rows.map(j => ({ id: j.id, lesson: j.lesson_id, title: j.title, kind: j.kind, log: j.log || "", at: j.updated_at, status: ["queued", "running"].includes(j.status) && j.updated_at < t - 20 * 60e3 ? "failed" : j.status })) });
  }

  /* ---- the drive: folders and every lesson, with what each folder passes down ---- */
  if (p === "/drive" && M === "GET") {
    // the bin empties itself after 30 days
    const old = (await env.DB.prepare("SELECT id FROM lessons WHERE org_id = ? AND binned_at > 0 AND binned_at < ?").bind(sc.org, t - BIN_DAYS * H.DAY).all()).results;
    for (const o of old) await dropLesson(env, o.id);
    const F = await folderMap(env, sc.org);
    const rows = (await env.DB.prepare("SELECT * FROM lessons WHERE org_id = ? ORDER BY updated_at DESC").bind(sc.org).all()).results;
    return H.json({ folders: [...F.values()].map(f => ({ id: f.id, parent: f.parent_id, name: f.name, rules: f.rules, inherited: rulesOf(F, f.parent_id) })), lessons: rows.map(summary), binDays: BIN_DAYS });
  }
  if (p === "/folders" && M === "POST") {
    const b = await H.body(req), name = str(b.name, 60);
    if (!name) throw H.fail("the folder needs a name");
    const parent = int(b.parent) || 0;
    if (parent && !(await env.DB.prepare("SELECT 1 FROM folders WHERE id = ? AND org_id = ?").bind(parent, sc.org).first())) throw H.fail("no such folder", 404);
    if (await env.DB.prepare("SELECT 1 FROM folders WHERE org_id = ? AND parent_id = ? AND name = ? COLLATE NOCASE").bind(sc.org, parent, name).first()) throw H.fail("a folder with this name is already here", 409);
    const r = await env.DB.prepare("INSERT INTO folders (org_id, parent_id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id").bind(sc.org, parent, name, sc.u.id, t, t).first();
    return H.json({ id: r.id });
  }
  if ((m = p.match(/^\/folders\/(\d+)$/)) && (M === "PATCH" || M === "DELETE")) {
    const id = int(m[1]), F = await folderMap(env, sc.org), f = F.get(id);
    if (!f) throw H.fail("no such folder", 404);
    if (M === "DELETE") {
      // what was inside moves up one level; nothing is lost
      await env.DB.batch([
        env.DB.prepare("UPDATE folders SET parent_id = ? WHERE org_id = ? AND parent_id = ?").bind(f.parent_id, sc.org, id),
        env.DB.prepare("UPDATE lessons SET folder_id = ? WHERE org_id = ? AND folder_id = ?").bind(f.parent_id, sc.org, id),
        env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id)]);
      await settleAccess(env, sc.org);
      return H.json({ ok: true });
    }
    const b = await H.body(req), sets = ["updated_at = ?"], vals = [t];
    if (b.name !== undefined) {
      const name = str(b.name, 60); if (!name) throw H.fail("the folder needs a name");
      if (await env.DB.prepare("SELECT 1 FROM folders WHERE org_id = ? AND parent_id = ? AND name = ? COLLATE NOCASE AND id != ?").bind(sc.org, b.parent !== undefined ? int(b.parent) : f.parent_id, name, id).first()) throw H.fail("a folder with this name is already here", 409);
      sets.push("name = ?"); vals.push(name);
    }
    if (b.parent !== undefined) {
      const to = int(b.parent) || 0;
      if (to && !F.get(to)) throw H.fail("no such folder", 404);
      for (let x = F.get(to), i = 0; x && i < 40; x = F.get(x.parent_id), i++) if (x.id === id) throw H.fail("a folder can't go inside itself");
      sets.push("parent_id = ?"); vals.push(to);
    }
    if (b.rules !== undefined) { if (sc.org) b.rules.access = ""; sets.push("rules = ?"); vals.push(JSON.stringify(cleanRules(b.rules))); }
    await env.DB.prepare(`UPDATE folders SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run();
    if (b.parent !== undefined || b.rules !== undefined) await settleAccess(env, sc.org);
    return H.json({ ok: true });
  }
  // move lessons and folders; "to": a folder id, 0 = the top
  if (p === "/move" && M === "POST") {
    const b = await H.body(req), to = int(b.to) || 0, F = await folderMap(env, sc.org);
    if (to && !F.get(to)) throw H.fail("no such folder", 404);
    const ls = (b.lessons || []).map(int).filter(Boolean).slice(0, 200), fs = (b.folders || []).map(int).filter(Boolean).slice(0, 100);
    for (const id of fs) for (let x = F.get(to), i = 0; x && i < 40; x = F.get(x.parent_id), i++) if (x.id === id) throw H.fail("a folder can't go inside itself");
    const st = [
      ...ls.map(id => env.DB.prepare("UPDATE lessons SET folder_id = ? WHERE id = ? AND org_id = ?").bind(to, id, sc.org)),
      ...fs.filter(id => F.get(id)).map(id => env.DB.prepare("UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?").bind(to, t, id))];
    if (st.length) await env.DB.batch(st);
    await settleAccess(env, sc.org);
    return H.json({ ok: true, rules: rulesOf(F, to) });
  }
  // the bin: lessons leave the library at once and come back with "restore"; after 30 days they are gone
  if (p === "/bin" && M === "POST") {
    const b = await H.body(req), ls = (b.lessons || []).map(int).filter(Boolean).slice(0, 200);
    if (!ls.length) throw H.fail("nothing chosen");
    const q = ls.map(() => "?").join(",");
    if (b.restore) await env.DB.prepare(`UPDATE lessons SET binned_at = 0, updated_at = ? WHERE org_id = ? AND id IN (${q})`).bind(t, sc.org, ...ls).run();
    else if (b.forever) { for (const id of ls) if (await env.DB.prepare("SELECT 1 FROM lessons WHERE id = ? AND org_id = ? AND binned_at > 0").bind(id, sc.org).first()) await dropLesson(env, id); }
    else await env.DB.batch([
      env.DB.prepare(`UPDATE lessons SET binned_at = ?, status = CASE WHEN status = 'published' THEN 'review' ELSE status END, published = '', updated_at = ? WHERE org_id = ? AND id IN (${q})`).bind(t, t, sc.org, ...ls),
      env.DB.prepare(`DELETE FROM materials WHERE kind = 'lesson' AND url IN (${q})`).bind(...ls.map(id => `s-${id}`))]);
    return H.json({ ok: true });
  }

  /* ---- lessons ---- */
  if (p === "/lessons" && M === "GET") {
    const rows = (await env.DB.prepare("SELECT * FROM lessons WHERE org_id = ? AND binned_at = 0 ORDER BY updated_at DESC").bind(sc.org).all()).results;
    return H.json({ lessons: rows.map(summary) });
  }
  if (p === "/lessons" && M === "POST") {
    const b = await H.body(req);
    const list = Array.isArray(b.lessons) ? b.lessons.slice(0, 12) : [b];
    const out = [], folder = int(b.folder) || 0, F = folder ? await folderMap(env, sc.org) : null;
    if (folder && !F.get(folder)) throw H.fail("no such folder", 404);
    const fr = folder ? rulesOf(F, folder) : null;
    for (const x of list) {
      const title = str(x.title, 80);
      if (!title) throw H.fail("the lesson needs a title");
      const course = pick(x.course, Object.keys(COURSES), "de");
      const d = emptyData();
      if (Array.isArray(x.characters)) d.characters = x.characters.map(int).filter(Boolean).slice(0, 6);
      const r = await env.DB.prepare("INSERT INTO lessons (org_id, created_by, course, type, level, topic, series, title, brief, data, folder_id, access, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(sc.org, sc.u.id, course, pick(x.type, TYPES, "talk"), fr && fr.level ? fr.level : pick(x.level, LEVELS, "A1"), pick(x.topic, TOPICS, "other"), str(x.series, 60), title, str(x.brief, 2000), JSON.stringify(d), folder, fr && fr.access === "plus" && !sc.org ? "plus" : "free", t, t).first();
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
    if (b.rev !== l.rev) throw revConflict(H);
    const sets = ["rev = rev + 1", "updated_at = ?"], vals = [t];
    for (const [k, n] of [["title", 80], ["brief", 2000], ["series", 60]]) if (b[k] !== undefined) { sets.push(`${k} = ?`); vals.push(str(b[k], n)); }
    if (b.course !== undefined) { sets.push("course = ?"); vals.push(pick(b.course, Object.keys(COURSES), l.course)); }
    if (b.type !== undefined) { sets.push("type = ?"); vals.push(pick(b.type, TYPES, l.type)); }
    if (b.level !== undefined) { sets.push("level = ?"); vals.push(pick(b.level, LEVELS, l.level)); }
    if (b.topic !== undefined) { sets.push("topic = ?"); vals.push(pick(b.topic, TOPICS, l.topic)); }
    if (b.access !== undefined && !sc.org) { sets.push("access_own = ?"); vals.push(b.access === "plus" ? "plus" : ""); }
    if (b.data !== undefined) {
      if (b.data && Array.isArray(b.data.scenes)) lineIds(b.data);   // every line keeps an id (its takes hang on it)
      const text = JSON.stringify(b.data);
      if (text.length > 600_000) throw H.fail("the script is too long", 413);
      if (!b.data || !Array.isArray(b.data.scenes) || typeof b.data.cast !== "object") throw H.fail("bad script");
      sets.push("data = ?"); vals.push(text);
      if (l.status === "draft" && b.data.scenes.length) { sets.push("status = 'review'"); }
      if (l.data.scenes && l.data.scenes.length) await keepVersion(env, H, sc, l, str(b.note, 120) || "edited", !!b.byAi);
    }
    const r = await env.DB.prepare(`UPDATE lessons SET ${sets.join(", ")} WHERE id = ? AND rev = ? RETURNING rev`).bind(...vals, l.id, l.rev).first();
    if (!r) throw revConflict(H);
    if (b.access !== undefined) await settleAccess(env, sc.org);
    return H.json({ rev: r.rev });
  }
  if ((m = p.match(/^\/lessons\/(\d+)$/)) && M === "DELETE") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await dropLesson(env, l.id);
    return H.json({ ok: true });
  }

  /* ---- AI: write the whole script (streamed, so the person watches it being written) ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/write$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await aiLimit(env, H, sc.u.id);
    await AI.providerFor(env, "write").catch(e => { throw H.fail(e.message, e.status || 503, e.extra); });
    const ids = l.data.characters || [];
    const chars = ids.length ? (await env.DB.prepare(`SELECT * FROM characters WHERE org_id = ? AND id IN (${ids.map(() => "?").join(",")})`).bind(sc.org, ...ids).all()).results : [];
    const { readable, writable } = new TransformStream();
    const w = writable.getWriter(), send = o => w.write(enc.encode(JSON.stringify(o) + "\n"));
    const work = (async () => {
      try {
        let last = 0;
        const { value: src, provider } = await AI.ask(env, "write", {
          prompt: scriptPrompt(l, chars), schema: SCRIPT_SCHEMA, max: 8000,
          onText: async text => { if (Date.now() - last > 250) { last = Date.now(); await send({ t: "text", text }); } }
        });
        const d = merge(l, normalize(src, l), chars);
        if (!d.scenes.length) throw new Error("the AI wrote no lines — try again");
        if (l.data.scenes && l.data.scenes.length) await keepVersion(env, H, sc, l, "before the AI rewrote the lesson", true);
        await send({ t: "lines", data: d });
        try { await translateAll(env, l, d, (i, n) => send({ t: "status", text: `translating ${i + 1}/${n}` })); }
        catch (e) { await send({ t: "status", text: "translations: " + e.message }); }
        const r = await env.DB.prepare("UPDATE lessons SET data = ?, rev = rev + 1, status = CASE WHEN status = 'draft' THEN 'review' ELSE status END, updated_at = ? WHERE id = ? RETURNING rev").bind(JSON.stringify(d), H.now(), l.id).first();
        await send({ t: "done", data: d, rev: r.rev, provider });
      } catch (e) {
        await send({ t: "error", error: e.message || String(e) }).catch(() => {});
      } finally { await w.close().catch(() => {}); }
    })();
    if (ctx) ctx.waitUntil(work);
    return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  }

  /* ---- history: earlier versions of the lesson ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/versions$/)) && M === "GET") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    const rows = (await env.DB.prepare("SELECT v.id, v.rev, v.title, v.note, v.by_ai, v.created_at, u.name, u.username, LENGTH(v.data) size FROM lesson_versions v LEFT JOIN users u ON u.id = v.by_user WHERE v.lesson_id = ? ORDER BY v.id DESC").bind(l.id).all()).results;
    return H.json({ versions: rows.map(v => ({ id: v.id, rev: v.rev, title: v.title, note: v.note, ai: !!v.by_ai, at: v.created_at, by: v.name || (v.username ? "@" + v.username : "") })) });
  }
  if ((m = p.match(/^\/lessons\/(\d+)\/versions\/(\d+)(\/restore)?$/))) {
    const l = await lessonIn(env, H, sc, int(m[1]));
    const v = await env.DB.prepare("SELECT * FROM lesson_versions WHERE id = ? AND lesson_id = ?").bind(int(m[2]), l.id).first();
    if (!v) throw H.fail("no such version", 404);
    if (!m[3] && M === "GET") return H.json({ version: { id: v.id, rev: v.rev, title: v.title, note: v.note, at: v.created_at, data: JSON.parse(v.data) } });
    if (m[3] && M === "POST") {
      await keepVersion(env, H, sc, { ...l, data: JSON.stringify(l.data) }, "before going back to version " + v.rev, true);
      const r = await env.DB.prepare("UPDATE lessons SET data = ?, rev = rev + 1, updated_at = ? WHERE id = ? RETURNING rev").bind(v.data, H.now(), l.id).first();
      return H.json({ data: JSON.parse(v.data), rev: r.rev });
    }
  }

  /* ---- AI: a pasted text or story → scenes and speakers, the words stay exactly as written ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/import$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await aiLimit(env, H, sc.u.id);
    const text = str((await H.body(req)).text, 12000);
    if (text.length < 10) throw H.fail("paste a text first");
    const got = await ask(env, H, "write", {
      max: 6000,
      schema: { type: "object", required: ["scenes"], properties: { scenes: { type: "array", items: { type: "object", properties: { title: { type: "string" }, lines: { type: "array", items: { type: "object", properties: { who: { type: "string" }, de: { type: "string" } } } } } } }, cast: { type: "array", items: { type: "object", properties: { name: { type: "string" }, gender: { type: "string" } } } } } },
      prompt: `Split this ${COURSES[l.course].name} text into a dialogue script for a language lesson. DO NOT change, translate, fix or shorten a single word: every line's "de" must be copied exactly from the text, in the original order. Find who says each sentence (use "Narrator" for narration). Start a new scene where the place or time changes, with a short title in the same language. "cast": every speaker with gender "f" or "m" (Narrator: pick one).

Text:
${text}`
    });
    // only lines that really are in the text: the AI may not rewrite anything
    const flat = s => String(s || "").replace(/\s+/g, " ").trim(), src = flat(text);
    const scenes = (got.scenes || []).map(s => ({ title: { de: str(s.title, 80) || "Szene", en: "", fa: "", ru: "", uk: "" }, lines: (s.lines || []).map(x => ({ who: str(x.who, 40) || "Narrator", de: flat(x.de).slice(0, 400), en: "", fa: "", ru: "", uk: "", ok: false })).filter(x => x.de && src.includes(x.de)) })).filter(s => s.lines.length);
    const kept = scenes.reduce((a, s) => a + s.lines.reduce((b, x) => b + x.de.length, 0), 0);
    if (!scenes.length || kept < src.replace(/\s/g, "").length * 0.6) throw H.fail("the AI couldn't split this text without changing it — try the simple split, or add “Name: …” before each line", 422);
    return H.json({ scenes, cast: (got.cast || []).map(c => ({ name: str(c.name, 40), gender: c.gender === "m" ? "m" : "f" })).filter(c => c.name) });
  }

  /* ---- AI: fill the missing translations ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/translate$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await aiLimit(env, H, sc.u.id);
    const d = l.data;
    let added;
    await keepVersion(env, H, sc, { ...l, data: JSON.stringify(l.data) }, "before the AI translated", true);
    try { added = await translateAll(env, l, d); } catch (e) { throw H.fail(e.message, e.status || 502, e.extra); }
    const r = await env.DB.prepare("UPDATE lessons SET data = ?, rev = rev + 1, updated_at = ? WHERE id = ? AND rev = ? RETURNING rev").bind(JSON.stringify(d), H.now(), l.id, l.rev).first();
    if (!r) throw revConflict(H);
    return H.json({ data: d, rev: r.rev, added });
  }

  /* ---- AI: other versions of one line (simpler, more natural, …) ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/rewrite$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await aiLimit(env, H, sc.u.id);
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
    const got = await ask(env, H, "rewrite", {
      max: 2000,
      schema: { type: "object", additionalProperties: false, required: ["options"], properties: { options: { type: "array", items: { type: "object", additionalProperties: false, required: ["de", "why", ...TR], properties: { de: { type: "string" }, why: { type: "string" }, ...Object.fromEntries(TR.map(x => [x, { type: "string" }])) } } } } },
      prompt: `A ${COURSES[l.course].name} lesson for ${l.level} learners. Context (lines around it):\n${rows.slice(Math.max(0, i - 3), i + 4).map((x, k) => `${Math.max(0, i - 3) + k === i ? ">> " : "   "}${x.who}: ${x.de}`).join("\n")}\n\nGive 3 versions of the marked line (${ln.who}: "${ln.de}"), ${how}. At most ${MAX_WORDS[l.level]} words. For each: the ${COURSES[l.course].name} text in "de", its translations (en, fa, ru, uk), and in "why" a very short English reason.`
    });
    return H.json({ options: (got.options || []).slice(0, 3) });
  }

  /* ---- AI: how hard is each line ---- */
  if ((m = p.match(/^\/lessons\/(\d+)\/check$/)) && M === "POST") {
    const l = await lessonIn(env, H, sc, int(m[1]));
    await aiLimit(env, H, sc.u.id);
    const rows = l.data.scenes.flatMap(s => s.lines);
    if (!rows.length) throw H.fail("write the text first");
    const got = await ask(env, H, "check", {
      max: 6000,
      schema: { type: "object", additionalProperties: false, required: ["lines", "grammar", "note"], properties: {
        lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["i", "level", "hard"], properties: { i: { type: "integer" }, level: { type: "string", enum: LEVELS }, hard: { type: "array", items: { type: "string" } } } } },
        grammar: { type: "array", items: { type: "string" } }, note: { type: "string" }
      } },
      prompt: `Rate this ${COURSES[l.course].name} text for a ${l.level} course. For every line (i = its number): its CEFR level, and in "hard" the exact words from the line that are above ${l.level}. "grammar": the main grammar points it practises (short English names). "note": one sentence of advice in English.\n${rows.map((r, k) => `${k}: ${r.de}`).join("\n")}`
    });
    const check = { rev: l.rev, at: H.now(), lines: got.lines || [], grammar: got.grammar || [], note: got.note || "" };
    l.data.check = check;
    const r = await env.DB.prepare("UPDATE lessons SET data = ?, rev = rev + 1 WHERE id = ? AND rev = ? RETURNING rev").bind(JSON.stringify(l.data), l.id, l.rev).first();
    if (!r) throw revConflict(H);
    return H.json({ check, rev: r.rev });
  }

  /* ---- AI: plan a series from one sentence ---- */
  if (p === "/plan" && M === "POST") {
    await aiLimit(env, H, sc.u.id);
    const b = await H.body(req);
    const want = str(b.prompt, 1000); if (!want) throw H.fail("say what you want");
    const existing = (await env.DB.prepare("SELECT title, level, topic, course FROM lessons WHERE org_id = ? ORDER BY id DESC LIMIT 60").bind(sc.org).all()).results;
    const got = await ask(env, H, "plan", {
      max: 4000,
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
  // the voice desk: takes, sound files, subtitles, the voice library (voice.js)
  const vr = await voiceApi(req, env, H, sc, p, url, { lessonIn });
  if (vr) return vr;
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
    if (l.binned_at) throw H.fail("this lesson is in the bin — restore it first", 409);
    const fr = rulesOf(await folderMap(env, sc.org), l.folder_id);
    if (fr.approved && rows.some(r => !r.ok)) throw H.fail(`the folder “${fr.from.approved}” asks for every line to be approved first (${rows.filter(r => !r.ok).length} left)`, 409, { code: "approve" });
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

// what a model wrote, made complete: strings where objects are missing, every language present
function normalize(src, l) {
  const tro = (v, de) => { const o = typeof v === "object" && v ? v : { de: String(v || de || "") }; for (const x of ["de", ...TR]) o[x] = String(o[x] || ""); return o; };
  const scenes = (Array.isArray(src.scenes) ? src.scenes : []).map((s, i) => ({
    title: tro(s.title, `Szene ${i + 1}`),
    lines: (Array.isArray(s.lines) ? s.lines : []).filter(x => x && (x.de || x.text)).map(x => ({ ...tro(x), who: String(x.who || x.speaker || "Anna"), de: String(x.de || x.text) }))
  })).filter(s => s.lines.length);
  const speakers = [...new Set(scenes.flatMap(s => s.lines.map(x => x.who)))];
  const cast = (Array.isArray(src.cast) ? src.cast : []).map(c => typeof c === "string" ? { name: c, gender: "f" } : { name: String(c.name || ""), gender: /^(m|male|man|männlich)$/i.test(String(c.gender || "").trim()) ? "m" : "f" }).filter(c => c.name);
  for (const w of speakers) if (!cast.some(c => c.name === w)) cast.push({ name: w, gender: "f" });
  return {
    title: String(src.title || l.title), scenes, cast,
    tr: Object.fromEntries(TR.map(x => [x, { title: String(((src.tr || {})[x] || {}).title || ""), summary: String(((src.tr || {})[x] || {}).summary || "") }])),
    phrases: (Array.isArray(src.phrases) ? src.phrases : []).map(p => typeof p === "string" ? tro({ de: p }) : tro(p)).filter(p => p.de)
  };
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
