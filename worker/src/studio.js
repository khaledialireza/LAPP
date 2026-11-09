// LAPP Studio API — /api/studio/* (designers, managers and admins; index.js checks the role).
//
// The studio keeps no data of its own. Drafts live in the repository (_studio/drafts/<slug>/)
// and every heavy step — writing with Claude, making the voices, publishing — runs as the
// "studio" GitHub Actions workflow with the same studio.py a laptop would run.
const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
// "Über die Brücke" → "ueber-die-bruecke", "Łódź" → "lodz"
const slugify = v => {
  let s = v.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/ł/g, "l")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return s.length >= 2 ? s : s ? s + "-1" : "";
};
const ACTIONS = ["write", "translate", "voice", "publish"];

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (message, status) => Object.assign(new Error(message), { status });

/* ---------- GitHub: the repository is the database ---------- */
function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${env.REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "lapp-studio", ...(init.headers || {})
    }
  });
}
const utf8 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), c => c.charCodeAt(0)));
function toB64(text) {
  const bytes = new TextEncoder().encode(text);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function readDraft(env, slug) {
  const r = await gh(env, `/contents/_studio/drafts/${slug}/draft.json?ref=${env.BRANCH}`);
  if (r.status === 404) throw fail("no such draft", 404);
  if (!r.ok) throw fail(`GitHub ${r.status}`, 502);
  const f = await r.json();
  return { draft: JSON.parse(utf8(f.content)), sha: f.sha };
}
async function writeDraft(env, slug, draft, sha, message) {
  const r = await gh(env, `/contents/_studio/drafts/${slug}/draft.json`, {
    method: "PUT",
    body: JSON.stringify({ message, branch: env.BRANCH, content: toB64(JSON.stringify(draft, null, 1) + "\n"), ...(sha ? { sha } : {}) })
  });
  // 409: somebody (usually the workflow) changed it since it was opened
  if (r.status === 409 || r.status === 422) throw fail("the draft changed since you opened it — reload it", 409);
  if (!r.ok) throw fail(`GitHub ${r.status}`, 502);
  return (await r.json()).content.sha;
}
const summary = (d, sha) => {
  const rows = (d.scenes || []).flatMap(s => s.lines);
  return { slug: d.slug, course: d.course || "de", title: d.title, type: d.type, level: d.level, status: d.status || "draft", lines: rows.length, ok: rows.filter(r => r.ok).length, sha };
};

export async function studioApi(req, env, path, email) {
  if (!env.GITHUB_TOKEN) throw fail("GITHUB_TOKEN is not set", 503);
  let m;
  if (req.method === "GET" && path === "/me") return json({ email, repo: env.REPO });

  if (req.method === "GET" && path === "/drafts") {
    const r = await gh(env, `/contents/_studio/drafts?ref=${env.BRANCH}`);
    if (r.status === 404) return json([]);
    const dirs = (await r.json()).filter(x => x.type === "dir" && SLUG.test(x.name));
    const out = await Promise.all(dirs.map(x => readDraft(env, x.name).then(({ draft, sha }) => summary(draft, sha)).catch(() => null)));
    return json(out.filter(Boolean));
  }

  if (req.method === "POST" && path === "/drafts") {
    const b = await req.json();
    // the folder name is made from the title; a number is added when the name is taken
    const base = slugify(String(b.title || "")) || "lesson";
    const taken = async x => (await gh(env, `/contents/_studio/drafts/${x}?ref=${env.BRANCH}`)).ok || (await gh(env, `/contents/content/lessons/${x}?ref=${env.BRANCH}`)).ok;
    let slug = base;
    for (let n = 2; await taken(slug); n++) { if (n > 50) throw fail("too many lessons with this title", 409); slug = `${base.slice(0, 37)}-${n}`; }
    b.slug = slug;
    if (!["de", "nl", "pl"].includes(b.course || "de")) throw fail("course: de, nl or pl", 400);
    if (!["talk", "lesson", "story"].includes(b.type) || !["A1", "A2", "B1", "B2", "C1", "C2"].includes(b.level) || !b.title) throw fail("type, level and title are required", 400);
    const draft = {
      slug: b.slug, course: b.course || "de", type: b.type, title: String(b.title).slice(0, 80), level: b.level, status: "draft", brief: String(b.brief || "").slice(0, 2000),
      cast: {}, pause: 0.6, scenePause: 1.4, tr: { en: { title: "", summary: "" }, fa: { title: "", summary: "" }, ru: { title: "", summary: "" }, uk: { title: "", summary: "" } },
      scenes: [], phrases: []
    };
    const sha = await writeDraft(env, b.slug, draft, null, `studio: new ${b.slug}`);
    return json({ draft, sha });
  }

  if ((m = path.match(/^\/drafts\/([a-z0-9-]+)$/)) && SLUG.test(m[1])) {
    if (req.method === "GET") return json(await readDraft(env, m[1]));
    if (req.method === "PUT") {
      const b = await req.json();
      if (!b.draft || b.draft.slug !== m[1] || !Array.isArray(b.draft.scenes)) throw fail("bad draft", 400);
      const sha = await writeDraft(env, m[1], b.draft, b.sha, `studio: edit ${m[1]}`);
      return json({ sha });
    }
  }

  // the draft's voiced audio, streamed through with Range so the panel can seek to a line
  if (req.method === "GET" && (m = path.match(/^\/audio\/([a-z0-9-]+)$/)) && SLUG.test(m[1])) {
    const r = await gh(env, `/contents/_studio/drafts/${m[1]}/audio.mp3?ref=${env.BRANCH}`, {
      headers: { Accept: "application/vnd.github.raw", ...(req.headers.get("Range") ? { Range: req.headers.get("Range") } : {}) }
    });
    if (!r.ok && r.status !== 206) return new Response("no audio yet", { status: 404 });
    const h = new Headers({ "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "Accept-Ranges": "bytes" });
    for (const k of ["Content-Length", "Content-Range"]) if (r.headers.get(k)) h.set(k, r.headers.get(k));
    return new Response(r.body, { status: r.status, headers: h });
  }

  // write · voice · publish run in GitHub Actions (.github/workflows/studio.yml)
  if (req.method === "POST" && (m = path.match(/^\/run\/([a-z]+)\/([a-z0-9-]+)$/)) && ACTIONS.includes(m[1]) && SLUG.test(m[2])) {
    const b = await req.json().catch(() => ({}));
    const r = await gh(env, `/actions/workflows/studio.yml/dispatches`, {
      method: "POST", body: JSON.stringify({ ref: env.BRANCH, inputs: { action: m[1], slug: m[2], force: b.force ? "true" : "false" } })
    });
    if (!r.ok) throw fail(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`, 502);
    return json({ started: true });
  }

  if (req.method === "GET" && path === "/runs") {
    const r = await gh(env, `/actions/workflows/studio.yml/runs?per_page=10`);
    if (!r.ok) return json([]);
    const { workflow_runs = [] } = await r.json();
    return json(workflow_runs.map(x => ({ id: x.id, title: x.display_title, status: x.status, conclusion: x.conclusion, at: x.created_at, url: x.html_url })));
  }

  throw fail("not found", 404);
}
