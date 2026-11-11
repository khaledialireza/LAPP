// LAPP worker · the helpers every API file shares — one copy, never redefined in a file.

// an error the API answers with (status, and extra fields for the page)
export const fail = (message, status = 400, extra) => Object.assign(new Error(message), { status, extra });
// one of a list, or the default
export const pick = (v, list, d) => list.includes(v) ? v : d;

/* ---------- LAPP's own lists (the pages have the same ones in ui/kit.js) ---------- */
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const STAFF = ["designer", "manager", "admin"];            // LAPP's own team
export const TEAM = ["admin", "teacher", "finance"];              // a school's team (not its students)
export const COURSES = {
  // the best Piper voices per language, best first (Piper has German women only in "low" quality)
  de: { name: "German", male: ["piper:thorsten-high", "piper:thorsten_emotional-medium", "piper:karlsson-low", "piper:pavoque-low"], female: ["piper:kerstin-low", "piper:ramona-low", "piper:eva_k-x_low"] },
  nl: { name: "Dutch", male: ["piper:nl_NL-ronnie-medium", "piper:nl_BE-rdh-medium", "piper:nl_NL-pim-medium"], female: ["piper:nl_BE-nathalie-medium"] },
  pl: { name: "Polish", male: ["piper:pl_PL-darkman-medium", "piper:pl_PL-mc_speech-medium"], female: ["piper:pl_PL-gosia-medium"] }
};

/* ---------- hashing ---------- */
export const enc = new TextEncoder();
export const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
export const b64url = buf => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const sha = async s => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));

/* ---------- who someone is in a school ---------- */
// the schools where this person is on the team (admin, teacher, finance) — names and roles
export const teamOf = async (env, userId) => (await env.DB.prepare(`SELECT o.id, o.name, o.slug, m.role FROM org_members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND m.active = 1 AND m.role IN ('admin','teacher','finance') AND o.disabled = 0`).bind(userId).all()).results;
// a person's role in the school with this address (the platform's admins can step in); fails when they have none
export async function memberOf(env, u, slug) {
  const org = await env.DB.prepare("SELECT * FROM orgs WHERE slug = ?").bind(slug).first();
  if (!org) throw fail("no such school", 404);
  if (org.disabled && u.role !== "admin") throw fail("this school is disabled", 403);
  const m = await env.DB.prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND active = 1").bind(org.id, u.id).first();
  const role = m ? m.role : u.role === "admin" ? "admin" : null;
  if (!role) throw fail("you are not a member of this school", 403);
  return { org, role };
}

/* ---------- a stored file, sent back: shown in the browser when it is safe, else downloaded; never run as ours ---------- */
const INLINE = /^(image\/(png|jpeg|gif|webp|avif)|application\/pdf|audio\/[a-z0-9.+-]+|video\/(mp4|webm|quicktime)|text\/plain)$/;
export function fileResponse(data, { name, type, size }) {
  const inline = INLINE.test(type);
  return new Response(data, { headers: {
    "Content-Type": inline ? type : "application/octet-stream", ...(size != null ? { "Content-Length": String(size) } : {}), "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'" } });
}
// an upload's name and type, from the X-Name header and Content-Type
export const uploadMeta = req => ({ name: cleanName(decodeURIComponent(req.headers.get("X-Name") || ""), 120) || "file", type: String(req.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim().toLowerCase().slice(0, 100) });

// text from a request: trimmed and cut to a length
export const str = (v, n = 200) => String(v ?? "").trim().slice(0, n);
// a whole number from a request ("12", 12.7 → 12; anything else → 0)
export const int = v => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : (Number.parseInt(v, 10) || 0); };
// a file or folder name: no control characters and no slashes
export const cleanName = (v, n = 120) => String(v ?? "").replace(/[\u0000-\u001f\\/]/g, "").trim().slice(0, n);

// at most 80 AI requests a day per person (shared by every AI feature)
export async function aiLimit(env, H, userId) {
  const day = Math.floor(H.now() / H.DAY);
  const r = await env.DB.prepare("INSERT INTO hits (key, n, reset) VALUES (?1, 1, ?2) ON CONFLICT(key) DO UPDATE SET n = n + 1 RETURNING n").bind(`ai:${userId}:${day}`, (day + 2) * H.DAY).first();
  if (r.n > 80) throw H.fail("the daily AI limit is reached — try again tomorrow", 429);
}

// someone else saved the lesson in between
export const revConflict = H => H.fail("someone else changed this lesson — reload it", 409, { code: "rev" });

/* ---------- big files in D1 (table blobs): cut into parts of 1.5 MB ---------- */
export const BLOB_PART = 1_500_000;
// the statements that store it (run them in one batch with the rest)
export const blobPut = (env, key, buf) => {
  const st = [];
  for (let i = 0, p = 0; i < buf.length; i += BLOB_PART, p++) st.push(env.DB.prepare("INSERT INTO blobs (key, part, data) VALUES (?, ?, ?)").bind(key, p, buf.subarray(i, i + BLOB_PART)));
  return st;
};
// the whole file, or null
export async function blobGet(env, key, size) {
  const parts = (await env.DB.prepare("SELECT data FROM blobs WHERE key = ? ORDER BY part").bind(key).all()).results;
  if (!parts.length) return null;
  const all = new Uint8Array(size || parts.reduce((n, p) => n + new Uint8Array(p.data).length, 0));
  let o = 0; for (const p of parts) { const b = new Uint8Array(p.data); all.set(b, o); o += b.length; }
  return all;
}
