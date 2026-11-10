// The work desktop of /manage: a person's layout (windows, icons, widgets, wallpaper, shortcuts)
// and the files they drop on it. Only people who work in /manage have one.
const PART = 1_500_000, MAX_FILE = 10_000_000, MAX_FILES = 60, MAX_TOTAL = 100_000_000;
// shown in the browser; anything else is downloaded, so a dropped page or SVG can't run as ours
const INLINE = /^(image\/(png|jpeg|gif|webp|avif)|application\/pdf|audio\/[a-z0-9.+-]+|video\/(mp4|webm|quicktime)|text\/plain)$/;

export async function worksHere(env, u, STAFF) {
  if (STAFF.includes(u.role)) return true;
  return !!(await env.DB.prepare("SELECT 1 FROM org_members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND m.active = 1 AND m.role IN ('admin','teacher','finance') AND o.disabled = 0").bind(u.id).first());
}

export async function deskApi(req, env, H, p, u) {
  const M = req.method, t = H.now();
  let m;
  if (p === "" && M === "GET") {
    const d = await env.DB.prepare("SELECT data FROM desks WHERE user_id = ?").bind(u.id).first();
    const files = (await env.DB.prepare("SELECT id, name, type, size, created_at FROM user_files WHERE user_id = ? ORDER BY id").bind(u.id).all()).results;
    return H.json({ desk: d ? JSON.parse(d.data) : null, files });
  }
  if (p === "" && M === "PUT") {
    const text = await req.text();
    if (text.length > 120_000) throw H.fail("the desktop is too big to save", 413);
    let d; try { d = JSON.parse(text); } catch { throw H.fail("bad desktop"); }
    if (!d || typeof d !== "object" || Array.isArray(d)) throw H.fail("bad desktop");
    await env.DB.prepare("INSERT INTO desks (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").bind(u.id, JSON.stringify(d), t).run();
    return H.json({ ok: true });
  }
  if (p === "/files" && M === "POST") {
    const name = decodeURIComponent(req.headers.get("X-Name") || "").replace(/[\u0000-\u001f\\/]/g, "").trim().slice(0, 120) || "file";
    const type = String(req.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim().toLowerCase().slice(0, 100);
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf.length) throw H.fail("the file is empty");
    if (buf.length > MAX_FILE) throw H.fail("files can be up to 10 MB", 413);
    const used = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(size), 0) s FROM user_files WHERE user_id = ?").bind(u.id).first();
    if (used.n >= MAX_FILES) throw H.fail(`the desktop holds up to ${MAX_FILES} files — remove some first`, 409);
    if (used.s + buf.length > MAX_TOTAL) throw H.fail("your files would pass 100 MB — remove some first", 409);
    const f = await env.DB.prepare("INSERT INTO user_files (user_id, name, type, size, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, name, type, size, created_at").bind(u.id, name, type, buf.length, t).first();
    const st = [];
    for (let i = 0, k = 0; i < buf.length; i += PART, k++) st.push(env.DB.prepare("INSERT INTO blobs (key, part, data) VALUES (?, ?, ?)").bind(`ufile/${f.id}`, k, buf.subarray(i, i + PART)));
    await env.DB.batch(st);
    return H.json(f);
  }
  if ((m = p.match(/^\/files\/(\d+)$/))) {
    const f = await env.DB.prepare("SELECT * FROM user_files WHERE id = ? AND user_id = ?").bind(Number(m[1]), u.id).first();
    if (!f) throw H.fail("no such file", 404);
    if (M === "DELETE") {
      await env.DB.batch([env.DB.prepare("DELETE FROM blobs WHERE key = ?").bind(`ufile/${f.id}`), env.DB.prepare("DELETE FROM user_files WHERE id = ?").bind(f.id)]);
      return H.json({ ok: true });
    }
    if (M === "GET") {
      const parts = (await env.DB.prepare("SELECT data FROM blobs WHERE key = ? ORDER BY part").bind(`ufile/${f.id}`).all()).results;
      const all = new Uint8Array(f.size); let o = 0; for (const x of parts) { const b = new Uint8Array(x.data); all.set(b, o); o += b.length; }
      const inline = INLINE.test(f.type);
      return new Response(all, { headers: {
        "Content-Type": inline ? f.type : "application/octet-stream", "Content-Length": String(f.size), "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'" } });
    }
  }
  throw H.fail("not found", 404);
}
