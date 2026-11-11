// LAPP worker · the helpers every API file shares — one copy, never redefined in a file.

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
