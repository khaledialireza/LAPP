import { cleanName, blobPut, blobGet } from "./util.js";
// The work desktop of /manage: a person's layout (windows, icons, widgets, wallpaper, shortcuts)
// and the files they drop on it. Only people who work in /manage have one.
const MAX_FILE = 10_000_000, MAX_FILES = 60, MAX_TOTAL = 100_000_000;
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
    const files = (await env.DB.prepare("SELECT id, name, type, size, created_at, folder, star FROM user_files WHERE user_id = ? ORDER BY id").bind(u.id).all()).results;
    const folders = (await env.DB.prepare("SELECT id, parent, name, created_at FROM user_folders WHERE user_id = ? ORDER BY name").bind(u.id).all()).results;
    return H.json({ desk: d ? JSON.parse(d.data) : null, files, folders });
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
    const name = cleanName(decodeURIComponent(req.headers.get("X-Name") || ""), 120) || "file";
    const type = String(req.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim().toLowerCase().slice(0, 100);
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf.length) throw H.fail("the file is empty");
    if (buf.length > MAX_FILE) throw H.fail("files can be up to 10 MB", 413);
    const used = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(size), 0) s FROM user_files WHERE user_id = ?").bind(u.id).first();
    if (used.n >= MAX_FILES) throw H.fail(`the desktop holds up to ${MAX_FILES} files — remove some first`, 409);
    if (used.s + buf.length > MAX_TOTAL) throw H.fail("your files would pass 100 MB — remove some first", 409);
    let folder = Number(req.headers.get("X-Folder")) || 0;
    if (folder && !(await env.DB.prepare("SELECT 1 FROM user_folders WHERE id = ? AND user_id = ?").bind(folder, u.id).first())) folder = 0;
    const f = await env.DB.prepare("INSERT INTO user_files (user_id, name, type, size, created_at, folder) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, name, type, size, created_at, folder, star").bind(u.id, name, type, buf.length, t, folder).first();
    const st = [];
    st.push(...blobPut(env, `ufile/${f.id}`, buf));
    await env.DB.batch(st);
    return H.json(f);
  }
  if ((m = p.match(/^\/files\/(\d+)$/))) {
    const f = await env.DB.prepare("SELECT * FROM user_files WHERE id = ? AND user_id = ?").bind(Number(m[1]), u.id).first();
    if (!f) throw H.fail("no such file", 404);
    if (M === "PATCH") {
      const b = await H.body(req);
      const name = b.name != null ? cleanName(b.name, 120) : f.name;
      let folder = b.folder != null ? Number(b.folder) || 0 : f.folder;
      if (folder && !(await env.DB.prepare("SELECT 1 FROM user_folders WHERE id = ? AND user_id = ?").bind(folder, u.id).first())) throw H.fail("no such folder", 404);
      if (!name) throw H.fail("the file needs a name");
      const star = b.star != null ? (b.star ? 1 : 0) : f.star;
      await env.DB.prepare("UPDATE user_files SET name = ?, folder = ?, star = ? WHERE id = ?").bind(name, folder, star, f.id).run();
      return H.json({ ...f, name, folder, star, data: undefined });
    }
    if (M === "DELETE") {
      await env.DB.batch([env.DB.prepare("DELETE FROM blobs WHERE key = ?").bind(`ufile/${f.id}`), env.DB.prepare("DELETE FROM user_files WHERE id = ?").bind(f.id)]);
      return H.json({ ok: true });
    }
    if (M === "GET") {
      const all = await blobGet(env, `ufile/${f.id}`, f.size) || new Uint8Array(0);
      const inline = INLINE.test(f.type);
      return new Response(all, { headers: {
        "Content-Type": inline ? f.type : "application/octet-stream", "Content-Length": String(f.size), "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'" } });
    }
  }
  /* ---- folders of the Files app ---- */
  if (p === "/folders" && M === "POST") {
    const b = await H.body(req), name = cleanName(b.name, 60), parent = Number(b.parent) || 0;
    if (!name) throw H.fail("the folder needs a name");
    if (parent && !(await env.DB.prepare("SELECT 1 FROM user_folders WHERE id = ? AND user_id = ?").bind(parent, u.id).first())) throw H.fail("no such folder", 404);
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM user_folders WHERE user_id = ?").bind(u.id).first();
    if (n.n >= 200) throw H.fail("up to 200 folders", 409);
    return H.json(await env.DB.prepare("INSERT INTO user_folders (user_id, parent, name, created_at) VALUES (?, ?, ?, ?) RETURNING id, parent, name, created_at").bind(u.id, parent, name, t).first());
  }
  if ((m = p.match(/^\/folders\/(\d+)$/))) {
    const id = Number(m[1]), f = await env.DB.prepare("SELECT * FROM user_folders WHERE id = ? AND user_id = ?").bind(id, u.id).first();
    if (!f) throw H.fail("no such folder", 404);
    if (M === "PATCH") {
      const b = await H.body(req), name = b.name != null ? cleanName(b.name, 60) : f.name;
      let parent = b.parent != null ? Number(b.parent) || 0 : f.parent;
      if (!name) throw H.fail("the folder needs a name");
      // never into itself or one of its own folders
      const all = (await env.DB.prepare("SELECT id, parent FROM user_folders WHERE user_id = ?").bind(u.id).all()).results, P = new Map(all.map(x => [x.id, x.parent]));
      if (parent && !P.has(parent)) throw H.fail("no such folder", 404);
      for (let x = parent, i = 0; x && i < 50; x = P.get(x), i++) if (x === id) throw H.fail("a folder can't go inside itself");
      await env.DB.prepare("UPDATE user_folders SET name = ?, parent = ? WHERE id = ?").bind(name, parent, id).run();
      return H.json({ id, parent, name });
    }
    if (M === "DELETE") {
      // what was inside moves up one level
      await env.DB.batch([env.DB.prepare("UPDATE user_files SET folder = ? WHERE user_id = ? AND folder = ?").bind(f.parent, u.id, id), env.DB.prepare("UPDATE user_folders SET parent = ? WHERE user_id = ? AND parent = ?").bind(f.parent, u.id, id), env.DB.prepare("DELETE FROM user_folders WHERE id = ?").bind(id)]);
      return H.json({ ok: true });
    }
  }
  throw H.fail("not found", 404);
}
