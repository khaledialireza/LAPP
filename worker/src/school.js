// Schools API — /api/org/<slug>/…  (and /api/orgs, /api/admin/orgs for the platform)
//
// A school (org) has members with one role each: admin · teacher · finance · student.
//   admin    everything in the school
//   teacher  their own classes: timetable, material, homework, attendance, live class
//   finance  fees, installments, reminders (and the list of students)
//   student  their classes, calendar, material, homework, fees
// Platform admins (users.role = admin) can open every school as its admin.
// index.js hands in its helpers as H, so this file has no imports of its own.

const ROLES = ["admin", "teacher", "finance", "student"];
const SLUG = /^[a-z0-9][a-z0-9-]{1,30}$/;
const COURSES = ["de", "nl", "pl"];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const MAX_FILE = 2 * 1024 * 1024;
const int = v => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0;
const str = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);

/* ---------------- who is asking, in which school ---------------- */
async function ctx(req, env, H, slug) {
  const u = await H.need(req, env);
  const org = await env.DB.prepare("SELECT * FROM orgs WHERE slug = ?").bind(slug).first();
  if (!org) throw H.fail("no such school", 404);
  const m = await env.DB.prepare("SELECT role, active FROM org_members WHERE org_id = ? AND user_id = ?").bind(org.id, u.id).first();
  let role = m && m.active ? m.role : null;
  if (!role && u.role === "admin") role = "admin";             // the platform's admins can step in
  if (!role) throw H.fail("you are not a member of this school", 403);
  if (org.disabled && u.role !== "admin") throw H.fail("this school is disabled", 403);
  return { u, org, role };
}
const allow = (c, ...roles) => { if (!roles.includes(c.role)) throw Object.assign(new Error("not allowed for your role"), { status: 403 }); };

async function classOf(env, c, id, H) {
  const k = await env.DB.prepare("SELECT * FROM classes WHERE id = ? AND org_id = ?").bind(int(id), c.org.id).first();
  if (!k) throw H.fail("no such class", 404);
  return k;
}
// may this person see / change this class?
async function canSee(env, c, k) {
  if (["admin", "finance"].includes(c.role)) return true;
  if (c.role === "teacher") return k.teacher_id === c.u.id;
  return !!(await env.DB.prepare("SELECT 1 FROM class_students WHERE class_id = ? AND user_id = ?").bind(k.id, c.u.id).first());
}
async function mustSee(env, c, k, H) { if (!(await canSee(env, c, k))) throw H.fail("not your class", 403); }
const canTeach = (c, k) => c.role === "admin" || (c.role === "teacher" && k.teacher_id === c.u.id);
function mustTeach(c, k, H) { if (!canTeach(c, k)) throw H.fail("only the class's teacher or a school admin can do this", 403); }

// classes this person works with
async function myClassIds(env, c) {
  if (["admin", "finance"].includes(c.role)) return (await env.DB.prepare("SELECT id FROM classes WHERE org_id = ?").bind(c.org.id).all()).results.map(r => r.id);
  if (c.role === "teacher") return (await env.DB.prepare("SELECT id FROM classes WHERE org_id = ? AND teacher_id = ?").bind(c.org.id, c.u.id).all()).results.map(r => r.id);
  return (await env.DB.prepare("SELECT c.id FROM classes c JOIN class_students s ON s.class_id = c.id WHERE c.org_id = ? AND s.user_id = ?").bind(c.org.id, c.u.id).all()).results.map(r => r.id);
}
const inList = ids => ids.length ? `(${ids.map(Number).join(",")})` : "(-1)";

/* ---------------- adding people: existing account, or a new one with an invitation ---------------- */
async function addPerson(env, H, req, org, by, p) {
  const email = H.cleanEmail(p.email), role = ROLES.includes(p.role) ? p.role : "student";
  if (!H.EMAIL.test(email)) throw H.fail(`not a valid e-mail: ${p.email || "(empty)"}`);
  let u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  let invited = false;
  if (!u) {
    // a username from the e-mail, made unique
    let base = (H.cleanUser(p.username) || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 16);
    if (base.length < 3) base = (base + "user").slice(0, 16);
    let un = base, n = 1;
    while (H.RESERVED.has(un) || await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(un).first()) un = `${base}${++n}`;
    const h = await H.hashPassword(H.b64url(H.rand(24)));
    u = await env.DB.prepare("INSERT INTO users (email, username, name, pw_hash, salt, iter, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(email, un, str(p.name, 40), h.pw_hash, h.salt, h.iter, H.now()).first();
    invited = true;
  }
  await env.DB.prepare("INSERT INTO org_members (org_id, user_id, role, active, created_at) VALUES (?1, ?2, ?3, 1, ?4) ON CONFLICT(org_id, user_id) DO UPDATE SET role = ?3, active = 1")
    .bind(org.id, u.id, role, H.now()).run();
  if (Array.isArray(p.classIds)) for (const cid of p.classIds) {
    const k = await env.DB.prepare("SELECT id FROM classes WHERE id = ? AND org_id = ?").bind(int(cid), org.id).first();
    if (k && role === "student") await env.DB.prepare("INSERT OR IGNORE INTO class_students (class_id, user_id) VALUES (?, ?)").bind(k.id, u.id).run();
    if (k && role === "teacher") await env.DB.prepare("UPDATE classes SET teacher_id = ? WHERE id = ?").bind(u.id, k.id).run();
  }
  const base = H.appUrl(env, req);
  let sent = false;
  if (p.notify !== false) {
    if (invited) {
      const token = await H.newCode(env, u, "reset", 7 * H.DAY);
      sent = await H.sendMail(env, email, { subject: `${org.name} invited you to LAPP`, text: `${by.name || by.username} added you to ${org.name} on LAPP as ${role}.\n\nChoose your password and sign in (link valid for 7 days):\n${base}/?reset=${token}&next=/s/${org.slug}\n\nAfterwards your school is always at ${base}/s/${org.slug}` });
    } else {
      sent = await H.sendMail(env, email, { subject: `You were added to ${org.name}`, text: `${by.name || by.username} added you to ${org.name} on LAPP as ${role}.\n\nSign in with your LAPP account: ${base}/s/${org.slug}` });
    }
  }
  return { id: u.id, email, username: u.username, invited, sent };
}

/* ---------------- money helpers ---------------- */
const cents = v => Math.round(Number(String(v).replace(",", ".")) * 100) || 0;
function addMonths(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }

/* ===================================================================== */
export async function orgsList(req, env, H) {
  const u = await H.need(req, env);
  const rows = (await env.DB.prepare("SELECT o.slug, o.name, o.color, m.role FROM org_members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND m.active = 1 AND o.disabled = 0 ORDER BY o.name").bind(u.id).all()).results;
  return H.json({ orgs: rows });
}

// platform admins: create and look after schools
export async function adminOrgs(req, env, H, p) {
  const M = req.method;
  const me = await H.need(req, env, ["admin"]);
  let m;
  if (p === "" && M === "GET") {
    const rows = (await env.DB.prepare(`SELECT o.*,
        (SELECT COUNT(*) FROM org_members WHERE org_id = o.id AND role = 'student') students,
        (SELECT COUNT(*) FROM org_members WHERE org_id = o.id AND role = 'teacher') teachers,
        (SELECT COUNT(*) FROM classes WHERE org_id = o.id AND archived = 0) classes,
        (SELECT u.email FROM org_members x JOIN users u ON u.id = x.user_id WHERE x.org_id = o.id AND x.role = 'admin' ORDER BY x.created_at LIMIT 1) admin_email
      FROM orgs o ORDER BY o.created_at DESC`).all()).results;
    return H.json({ orgs: rows });
  }
  if (p === "" && M === "POST") {
    const b = await H.body(req);
    const slug = str(b.slug, 31).toLowerCase(), name = str(b.name, 80);
    if (!SLUG.test(slug)) throw H.fail("address: 2–31 lowercase letters, digits and -");
    if (!name) throw H.fail("the school needs a name");
    if (await env.DB.prepare("SELECT 1 FROM orgs WHERE slug = ?").bind(slug).first()) throw H.fail("this address is taken", 409);
    const org = await env.DB.prepare("INSERT INTO orgs (slug, name, color, created_at) VALUES (?, ?, ?, ?) RETURNING *").bind(slug, name, /^#[0-9a-fA-F]{6}$/.test(b.color || "") ? b.color : "#8B5CF6", H.now()).first();
    let admin = null;
    if (b.adminEmail) admin = await addPerson(env, H, req, org, me, { email: b.adminEmail, name: b.adminName, role: "admin" });
    return H.json({ org, admin });
  }
  if ((m = p.match(/^\/(\d+)$/)) && M === "PATCH") {
    const b = await H.body(req);
    const sets = [], vals = [];
    if (b.name !== undefined) { sets.push("name = ?"); vals.push(str(b.name, 80)); }
    if (b.disabled !== undefined) { sets.push("disabled = ?"); vals.push(b.disabled ? 1 : 0); }
    if (!sets.length) throw H.fail("nothing to change");
    await env.DB.prepare(`UPDATE orgs SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, int(m[1])).run();
    return H.json({ ok: true });
  }
  if ((m = p.match(/^\/(\d+)$/)) && M === "DELETE") {
    const id = int(m[1]);
    // the school's records go; the people keep their LAPP accounts
    const cls = `(SELECT id FROM classes WHERE org_id = ${id})`;
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE class_id IN ${cls})`),
      env.DB.prepare(`DELETE FROM assignments WHERE class_id IN ${cls}`),
      env.DB.prepare(`DELETE FROM materials WHERE class_id IN ${cls}`),
      env.DB.prepare(`DELETE FROM attendance WHERE event_id IN (SELECT id FROM class_events WHERE class_id IN ${cls})`),
      env.DB.prepare(`DELETE FROM class_events WHERE class_id IN ${cls}`),
      env.DB.prepare(`DELETE FROM class_students WHERE class_id IN ${cls}`),
      env.DB.prepare(`DELETE FROM installments WHERE fee_id IN (SELECT id FROM fees WHERE org_id = ?)`).bind(id),
      env.DB.prepare("DELETE FROM fees WHERE org_id = ?").bind(id),
      env.DB.prepare("DELETE FROM classes WHERE org_id = ?").bind(id),
      env.DB.prepare("DELETE FROM files WHERE org_id = ?").bind(id),
      env.DB.prepare("DELETE FROM org_members WHERE org_id = ?").bind(id),
      env.DB.prepare("DELETE FROM orgs WHERE id = ?").bind(id)
    ]);
    return H.json({ ok: true });
  }
  throw H.fail("not found", 404);
}

/* ===================================================================== */
export async function orgApi(req, env, H, slug, p, url) {
  const M = req.method;
  const c = await ctx(req, env, H, slug);
  const DB = env.DB;
  let m;

  /* ---- the school and me ---- */
  if (p === "" && M === "GET") {
    const n = async (sql, ...v) => (await DB.prepare(sql).bind(...v).first()).n;
    const counts = ["admin", "teacher", "finance"].includes(c.role) ? {
      students: await n("SELECT COUNT(*) n FROM org_members WHERE org_id = ? AND role = 'student' AND active = 1", c.org.id),
      teachers: await n("SELECT COUNT(*) n FROM org_members WHERE org_id = ? AND role = 'teacher' AND active = 1", c.org.id),
      staff: await n("SELECT COUNT(*) n FROM org_members WHERE org_id = ? AND role IN ('admin','finance') AND active = 1", c.org.id),
      classes: await n("SELECT COUNT(*) n FROM classes WHERE org_id = ? AND archived = 0", c.org.id)
    } : null;
    return H.json({ org: { id: c.org.id, slug: c.org.slug, name: c.org.name, color: c.org.color, currency: c.org.currency }, role: c.role, me: { id: c.u.id, username: c.u.username, name: c.u.name, email: c.u.email }, counts });
  }
  if (p === "" && M === "PATCH") {
    allow(c, "admin");
    const b = await H.body(req);
    const sets = [], vals = [];
    if (b.name !== undefined) { sets.push("name = ?"); vals.push(str(b.name, 80) || c.org.name); }
    if (b.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(b.color)) { sets.push("color = ?"); vals.push(b.color); }
    if (b.currency !== undefined && /^[A-Z]{3}$/.test(b.currency)) { sets.push("currency = ?"); vals.push(b.currency); }
    if (sets.length) await DB.prepare(`UPDATE orgs SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, c.org.id).run();
    return H.json({ ok: true });
  }

  /* ---- people ---- */
  if (p === "/members" && M === "GET") {
    allow(c, "admin", "teacher", "finance");
    const role = url.searchParams.get("role");
    const rows = (await DB.prepare(`SELECT u.id, u.username, u.name, u.email, u.verified, u.last_seen, m.role, m.active, m.created_at,
        (SELECT GROUP_CONCAT(k.name, ', ') FROM class_students s JOIN classes k ON k.id = s.class_id WHERE s.user_id = u.id AND k.org_id = m.org_id) AS classes,
        (SELECT GROUP_CONCAT(k.name, ', ') FROM classes k WHERE k.teacher_id = u.id AND k.org_id = m.org_id) AS teaches
      FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? ${role && ROLES.includes(role) ? "AND m.role = ?" : ""} ORDER BY m.role, u.name, u.username`)
      .bind(c.org.id, ...(role && ROLES.includes(role) ? [role] : [])).all()).results;
    return H.json({ members: rows });
  }
  if (p === "/members" && M === "POST") {
    allow(c, "admin");
    const b = await H.body(req);
    const list = Array.isArray(b.people) ? b.people.slice(0, 500) : [b];
    const done = [], failed = [];
    for (const person of list) {
      try { done.push(await addPerson(env, H, req, c.org, c.u, person)); }
      catch (e) { failed.push({ email: person.email, error: e.message }); }
    }
    return H.json({ added: done, failed });
  }
  if ((m = p.match(/^\/members\/(\d+)$/)) && (M === "PATCH" || M === "DELETE")) {
    allow(c, "admin");
    const uid = int(m[1]);
    if (uid === c.u.id) throw H.fail("you can't change your own membership here");
    if (M === "DELETE") {
      await DB.batch([
        DB.prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?").bind(c.org.id, uid),
        DB.prepare("DELETE FROM class_students WHERE user_id = ? AND class_id IN (SELECT id FROM classes WHERE org_id = ?)").bind(uid, c.org.id),
        DB.prepare("UPDATE classes SET teacher_id = NULL WHERE teacher_id = ? AND org_id = ?").bind(uid, c.org.id)
      ]);
      return H.json({ ok: true });
    }
    const b = await H.body(req);
    if (b.role !== undefined && !ROLES.includes(b.role)) throw H.fail("bad role");
    await DB.prepare("UPDATE org_members SET role = COALESCE(?, role), active = COALESCE(?, active) WHERE org_id = ? AND user_id = ?")
      .bind(b.role ?? null, b.active === undefined ? null : (b.active ? 1 : 0), c.org.id, uid).run();
    if (b.name !== undefined) await DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(str(b.name, 40), uid).run();
    return H.json({ ok: true });
  }

  /* ---- classes ---- */
  if (p === "/classes" && M === "GET") {
    const ids = await myClassIds(env, c);
    const rows = (await DB.prepare(`SELECT k.*, u.name teacher_name, u.username teacher_username,
        (SELECT COUNT(*) FROM class_students WHERE class_id = k.id) students,
        (SELECT MIN(starts_at) FROM class_events WHERE class_id = k.id AND ends_at > ?1 AND status != 'cancelled') next_at,
        (SELECT id FROM class_events WHERE class_id = k.id AND status = 'live' LIMIT 1) live_event
      FROM classes k LEFT JOIN users u ON u.id = k.teacher_id WHERE k.id IN ${inList(ids)} ORDER BY k.archived, k.name`).bind(H.now()).all()).results;
    return H.json({ classes: rows });
  }
  if (p === "/classes" && M === "POST") {
    allow(c, "admin");
    const b = await H.body(req);
    const name = str(b.name, 80); if (!name) throw H.fail("the class needs a name");
    const k = await DB.prepare("INSERT INTO classes (org_id, name, course, level, teacher_id, place, starts_on, ends_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(c.org.id, name, COURSES.includes(b.course) ? b.course : "de", LEVELS.includes(b.level) ? b.level : "A1", b.teacherId ? int(b.teacherId) : null, str(b.place, 60) || "Online", str(b.startsOn, 10), str(b.endsOn, 10), H.now()).first();
    return H.json({ class: k });
  }
  if ((m = p.match(/^\/classes\/(\d+)$/))) {
    const k = await classOf(env, c, m[1], H);
    if (M === "GET") {
      await mustSee(env, c, k, H);
      const students = canTeach(c, k) || c.role === "finance" ? (await DB.prepare("SELECT u.id, u.username, u.name, u.email FROM class_students s JOIN users u ON u.id = s.user_id WHERE s.class_id = ? ORDER BY u.name, u.username").bind(k.id).all()).results : [];
      const teacher = k.teacher_id ? await DB.prepare("SELECT id, username, name FROM users WHERE id = ?").bind(k.teacher_id).first() : null;
      return H.json({ class: k, teacher, students, canTeach: canTeach(c, k) });
    }
    if (M === "PATCH") {
      allow(c, "admin");
      const b = await H.body(req);
      await DB.prepare(`UPDATE classes SET name = COALESCE(?, name), course = COALESCE(?, course), level = COALESCE(?, level), teacher_id = ?, place = COALESCE(?, place),
          starts_on = COALESCE(?, starts_on), ends_on = COALESCE(?, ends_on), archived = COALESCE(?, archived) WHERE id = ?`)
        .bind(b.name ? str(b.name, 80) : null, COURSES.includes(b.course) ? b.course : null, LEVELS.includes(b.level) ? b.level : null,
          b.teacherId === undefined ? k.teacher_id : (b.teacherId ? int(b.teacherId) : null), b.place !== undefined ? str(b.place, 60) : null,
          b.startsOn !== undefined ? str(b.startsOn, 10) : null, b.endsOn !== undefined ? str(b.endsOn, 10) : null, b.archived === undefined ? null : (b.archived ? 1 : 0), k.id).run();
      return H.json({ ok: true });
    }
    if (M === "DELETE") {
      allow(c, "admin");
      await DB.batch([
        DB.prepare("DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE class_id = ?)").bind(k.id),
        DB.prepare("DELETE FROM assignments WHERE class_id = ?").bind(k.id),
        DB.prepare("DELETE FROM materials WHERE class_id = ?").bind(k.id),
        DB.prepare("DELETE FROM attendance WHERE event_id IN (SELECT id FROM class_events WHERE class_id = ?)").bind(k.id),
        DB.prepare("DELETE FROM class_events WHERE class_id = ?").bind(k.id),
        DB.prepare("DELETE FROM class_students WHERE class_id = ?").bind(k.id),
        DB.prepare("UPDATE fees SET class_id = NULL WHERE class_id = ?").bind(k.id),
        DB.prepare("DELETE FROM classes WHERE id = ?").bind(k.id)
      ]);
      return H.json({ ok: true });
    }
  }
  if ((m = p.match(/^\/classes\/(\d+)\/students$/)) && M === "PUT") {
    allow(c, "admin");
    const k = await classOf(env, c, m[1], H);
    const ids = ((await H.body(req)).ids || []).map(int).slice(0, 500);
    const valid = ids.length ? (await DB.prepare(`SELECT user_id FROM org_members WHERE org_id = ? AND user_id IN ${inList(ids)}`).bind(c.org.id).all()).results.map(r => r.user_id) : [];
    await DB.batch([DB.prepare("DELETE FROM class_students WHERE class_id = ?").bind(k.id), ...valid.map(id => DB.prepare("INSERT INTO class_students (class_id, user_id) VALUES (?, ?)").bind(k.id, id))]);
    return H.json({ ok: true, students: valid.length });
  }

  /* ---- timetable ---- */
  if (p === "/events" && M === "GET") {
    const from = int(url.searchParams.get("from")) || H.now() - 7 * H.DAY, to = int(url.searchParams.get("to")) || H.now() + 35 * H.DAY;
    const only = url.searchParams.get("class");
    let ids = await myClassIds(env, c);
    if (only) ids = ids.filter(id => id === int(only));
    const rows = (await DB.prepare(`SELECT e.*, k.name class_name, k.place, k.course, k.teacher_id, u.name teacher_name, u.username teacher_username
      FROM class_events e JOIN classes k ON k.id = e.class_id LEFT JOIN users u ON u.id = k.teacher_id
      WHERE e.class_id IN ${inList(ids)} AND e.ends_at > ? AND e.starts_at < ? ORDER BY e.starts_at`).bind(from, to).all()).results;
    return H.json({ events: rows });
  }
  if (p === "/events" && M === "POST") {
    const b = await H.body(req);
    const k = await classOf(env, c, b.classId, H);
    mustTeach(c, k, H);
    const start = int(b.startsAt), mins = Math.max(15, Math.min(600, int(b.minutes) || 90));
    if (!start) throw H.fail("pick a date and time");
    const repeat = Math.max(1, Math.min(60, int(b.weeks) || 1));
    const days = Array.isArray(b.weekdays) && b.weekdays.length ? b.weekdays.map(int) : null;   // 0 = Sunday
    const stmts = [];
    for (let w = 0; w < repeat; w++) {
      if (!days) { const s = start + w * 7 * H.DAY; stmts.push(DB.prepare("INSERT INTO class_events (class_id, starts_at, ends_at, title) VALUES (?, ?, ?, ?)").bind(k.id, s, s + mins * 60e3, str(b.title, 100))); continue; }
      for (let d = 0; d < 7; d++) {
        const s = start + (w * 7 + d) * H.DAY;
        if (days.includes(new Date(s).getUTCDay())) stmts.push(DB.prepare("INSERT INTO class_events (class_id, starts_at, ends_at, title) VALUES (?, ?, ?, ?)").bind(k.id, s, s + mins * 60e3, str(b.title, 100)));
      }
    }
    if (stmts.length) await DB.batch(stmts.slice(0, 200));
    return H.json({ ok: true, created: Math.min(stmts.length, 200) });
  }
  if ((m = p.match(/^\/events\/(\d+)$/)) && (M === "PATCH" || M === "DELETE")) {
    const e = await DB.prepare("SELECT * FROM class_events WHERE id = ?").bind(int(m[1])).first();
    if (!e) throw H.fail("no such lesson", 404);
    const k = await classOf(env, c, e.class_id, H);
    mustTeach(c, k, H);
    if (M === "DELETE") { await DB.batch([DB.prepare("DELETE FROM attendance WHERE event_id = ?").bind(e.id), DB.prepare("DELETE FROM class_events WHERE id = ?").bind(e.id)]); return H.json({ ok: true }); }
    const b = await H.body(req);
    if (b.status === "live") await DB.prepare("UPDATE class_events SET status = 'done' WHERE class_id = ? AND status = 'live' AND id != ?").bind(k.id, e.id).run();
    await DB.prepare("UPDATE class_events SET title = COALESCE(?, title), status = COALESCE(?, status), starts_at = COALESCE(?, starts_at), ends_at = COALESCE(?, ends_at) WHERE id = ?")
      .bind(b.title !== undefined ? str(b.title, 100) : null, ["planned", "live", "done", "cancelled"].includes(b.status) ? b.status : null, b.startsAt ? int(b.startsAt) : null, b.endsAt ? int(b.endsAt) : null, e.id).run();
    return H.json({ ok: true });
  }
  if ((m = p.match(/^\/events\/(\d+)\/attendance$/))) {
    const e = await DB.prepare("SELECT * FROM class_events WHERE id = ?").bind(int(m[1])).first();
    if (!e) throw H.fail("no such lesson", 404);
    const k = await classOf(env, c, e.class_id, H);
    mustTeach(c, k, H);
    if (M === "GET") {
      const rows = (await DB.prepare("SELECT u.id, u.name, u.username, a.present FROM class_students s JOIN users u ON u.id = s.user_id LEFT JOIN attendance a ON a.event_id = ? AND a.user_id = u.id WHERE s.class_id = ? ORDER BY u.name, u.username").bind(e.id, k.id).all()).results;
      return H.json({ event: e, students: rows });
    }
    if (M === "PUT") {
      const marks = (await H.body(req)).marks || {};
      await DB.batch(Object.entries(marks).map(([uid, v]) => DB.prepare("INSERT INTO attendance (event_id, user_id, present) VALUES (?1, ?2, ?3) ON CONFLICT(event_id, user_id) DO UPDATE SET present = ?3").bind(e.id, int(uid), v ? 1 : 0)));
      return H.json({ ok: true });
    }
  }

  /* ---- files (≤ 2 MB, kept in the database) ---- */
  if (p === "/files" && M === "POST") {
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) throw H.fail("empty file");
    if (buf.byteLength > MAX_FILE) throw H.fail("files can be at most 2 MB — use a link for bigger ones", 413);
    const name = str(decodeURIComponent(req.headers.get("X-File-Name") || "file"), 120);
    const type = str(req.headers.get("Content-Type") || "application/octet-stream", 100);
    const f = await DB.prepare("INSERT INTO files (org_id, name, type, size, data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(c.org.id, name, type, buf.byteLength, buf, c.u.id, H.now()).first();
    return H.json({ id: f.id, name, type, size: buf.byteLength });
  }
  if ((m = p.match(/^\/files\/(\d+)$/)) && M === "GET") {
    const f = await DB.prepare("SELECT * FROM files WHERE id = ? AND org_id = ?").bind(int(m[1]), c.org.id).first();
    if (!f) throw H.fail("no such file", 404);
    const safe = /^(image\/(png|jpeg|gif|webp)|audio\/|video\/|application\/pdf$|text\/plain$)/.test(f.type) ? f.type : "application/octet-stream";
    return new Response(f.data, { headers: { "Content-Type": safe, "Content-Disposition": `${safe === "application/octet-stream" ? "attachment" : "inline"}; filename="${encodeURIComponent(f.name)}"`, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  }

  /* ---- material ---- */
  if (p === "/materials" && M === "GET") {
    const k = await classOf(env, c, url.searchParams.get("class"), H);
    await mustSee(env, c, k, H);
    const rows = (await DB.prepare(`SELECT m.*, f.name file_name, f.type file_type, f.size file_size FROM materials m LEFT JOIN files f ON f.id = m.file_id WHERE m.class_id = ? ${canTeach(c, k) ? "" : "AND m.shared = 1"} ORDER BY m.created_at DESC`).bind(k.id).all()).results;
    return H.json({ materials: rows });
  }
  if (p === "/materials" && M === "POST") {
    const b = await H.body(req);
    const k = await classOf(env, c, b.classId, H);
    mustTeach(c, k, H);
    if (!["text", "link", "file", "lesson"].includes(b.kind)) throw H.fail("kind: text, link, file or lesson");
    const title = str(b.title, 120); if (!title) throw H.fail("give it a title");
    if (b.kind === "link" && !/^https:\/\//.test(b.url || "")) throw H.fail("links must start with https://");
    const row = await DB.prepare("INSERT INTO materials (class_id, kind, title, body, url, file_id, shared, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(k.id, b.kind, title, str(b.body, 20000), str(b.url, 500), b.fileId ? int(b.fileId) : null, b.shared === false ? 0 : 1, c.u.id, H.now()).first();
    return H.json({ material: row });
  }
  if ((m = p.match(/^\/materials\/(\d+)$/)) && (M === "PATCH" || M === "DELETE")) {
    const mt = await DB.prepare("SELECT * FROM materials WHERE id = ?").bind(int(m[1])).first();
    if (!mt) throw H.fail("not found", 404);
    const k = await classOf(env, c, mt.class_id, H);
    mustTeach(c, k, H);
    if (M === "DELETE") { await DB.prepare("DELETE FROM materials WHERE id = ?").bind(mt.id).run(); return H.json({ ok: true }); }
    const b = await H.body(req);
    await DB.prepare("UPDATE materials SET shared = COALESCE(?, shared), title = COALESCE(?, title) WHERE id = ?").bind(b.shared === undefined ? null : (b.shared ? 1 : 0), b.title ? str(b.title, 120) : null, mt.id).run();
    return H.json({ ok: true });
  }

  /* ---- homework ---- */
  if (p === "/assignments" && M === "GET") {
    const only = url.searchParams.get("class");
    let ids = await myClassIds(env, c);
    if (only) ids = ids.filter(id => id === int(only));
    const rows = (await DB.prepare(`SELECT a.id, a.class_id, a.title, a.kind, a.due_at, a.created_at, k.name class_name,
        (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id) submitted,
        (SELECT COUNT(*) FROM class_students WHERE class_id = a.class_id) students,
        (SELECT ROUND(AVG(score)) FROM submissions WHERE assignment_id = a.id AND score IS NOT NULL) avg,
        s.score my_score, s.submitted_at my_at
      FROM assignments a JOIN classes k ON k.id = a.class_id LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = ?
      WHERE a.class_id IN ${inList(ids)} ORDER BY a.due_at = 0, a.due_at, a.created_at DESC`).bind(c.u.id).all()).results;
    return H.json({ assignments: rows });
  }
  if (p === "/assignments" && M === "POST") {
    const b = await H.body(req);
    const k = await classOf(env, c, b.classId, H);
    mustTeach(c, k, H);
    if (!["quiz", "write", "speak"].includes(b.kind)) throw H.fail("kind: quiz, write or speak");
    const title = str(b.title, 120); if (!title) throw H.fail("give it a title");
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 100).map(it => ({ q: str(it.q, 500), options: Array.isArray(it.options) ? it.options.map(o => str(o, 200)).filter(Boolean).slice(0, 8) : [], answer: str(it.answer, 200) })).filter(it => it.q);
    if (b.kind === "quiz" && !items.length) throw H.fail("add at least one question");
    const a = await DB.prepare("INSERT INTO assignments (class_id, title, kind, instructions, items, due_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(k.id, title, b.kind, str(b.instructions, 4000), JSON.stringify(items), int(b.dueAt), c.u.id, H.now()).first();
    return H.json({ assignment: a });
  }
  if ((m = p.match(/^\/assignments\/(\d+)$/))) {
    const a = await DB.prepare("SELECT * FROM assignments WHERE id = ?").bind(int(m[1])).first();
    if (!a) throw H.fail("not found", 404);
    const k = await classOf(env, c, a.class_id, H);
    await mustSee(env, c, k, H);
    const teach = canTeach(c, k);
    if (M === "DELETE") { mustTeach(c, k, H); await DB.batch([DB.prepare("DELETE FROM submissions WHERE assignment_id = ?").bind(a.id), DB.prepare("DELETE FROM assignments WHERE id = ?").bind(a.id)]); return H.json({ ok: true }); }
    if (M === "GET") {
      const items = JSON.parse(a.items);
      const mine = await DB.prepare("SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?").bind(a.id, c.u.id).first();
      // students see the answers only after they have handed in
      const shown = teach || mine ? items : items.map(({ q, options }) => ({ q, options }));
      const subs = teach ? (await DB.prepare(`SELECT u.id, u.name, u.username, s.answers, s.score, s.feedback, s.submitted_at, s.file_id
          FROM class_students cs JOIN users u ON u.id = cs.user_id LEFT JOIN submissions s ON s.assignment_id = ? AND s.user_id = u.id WHERE cs.class_id = ? ORDER BY u.name, u.username`).bind(a.id, k.id).all()).results : null;
      return H.json({ assignment: { ...a, items: shown }, class: { id: k.id, name: k.name }, mine, submissions: subs, canTeach: teach });
    }
  }
  if ((m = p.match(/^\/assignments\/(\d+)\/submit$/)) && M === "POST") {
    const a = await DB.prepare("SELECT * FROM assignments WHERE id = ?").bind(int(m[1])).first();
    if (!a) throw H.fail("not found", 404);
    const k = await classOf(env, c, a.class_id, H);
    if (!(await DB.prepare("SELECT 1 FROM class_students WHERE class_id = ? AND user_id = ?").bind(k.id, c.u.id).first())) throw H.fail("only students of this class hand in", 403);
    const b = await H.body(req);
    const answers = b.answers && typeof b.answers === "object" ? b.answers : {};
    let score = null;
    if (a.kind === "quiz") {
      const items = JSON.parse(a.items), norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?]$/, "");
      const right = items.filter((it, i) => norm(answers[i]) === norm(it.answer)).length;
      score = items.length ? Math.round(right / items.length * 100) : 0;
    }
    await DB.prepare("INSERT INTO submissions (assignment_id, user_id, answers, score, file_id, submitted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(assignment_id, user_id) DO UPDATE SET answers = ?3, score = ?4, file_id = ?5, submitted_at = ?6")
      .bind(a.id, c.u.id, JSON.stringify(answers).slice(0, 50000), score, b.fileId ? int(b.fileId) : null, H.now()).run();
    return H.json({ ok: true, score });
  }
  if ((m = p.match(/^\/assignments\/(\d+)\/grade\/(\d+)$/)) && M === "PUT") {
    const a = await DB.prepare("SELECT * FROM assignments WHERE id = ?").bind(int(m[1])).first();
    if (!a) throw H.fail("not found", 404);
    const k = await classOf(env, c, a.class_id, H);
    mustTeach(c, k, H);
    const b = await H.body(req);
    await DB.prepare("UPDATE submissions SET score = ?, feedback = ? WHERE assignment_id = ? AND user_id = ?").bind(Math.max(0, Math.min(100, int(b.score))), str(b.feedback, 2000), a.id, int(m[2])).run();
    return H.json({ ok: true });
  }

  /* ---- money ---- */
  if (p === "/fees" && M === "GET") {
    const mine = c.role === "student" || url.searchParams.get("mine") === "1";
    if (!mine) allow(c, "admin", "finance");
    const rows = (await DB.prepare(`SELECT f.*, u.name student_name, u.username student_username, u.email student_email, k.name class_name
      FROM fees f JOIN users u ON u.id = f.student_id LEFT JOIN classes k ON k.id = f.class_id WHERE f.org_id = ? ${mine ? "AND f.student_id = ?" : ""} ORDER BY u.name, u.username, f.created_at`)
      .bind(c.org.id, ...(mine ? [c.u.id] : [])).all()).results;
    const ins = rows.length ? (await DB.prepare(`SELECT * FROM installments WHERE fee_id IN ${inList(rows.map(r => r.id))} ORDER BY due_on`).all()).results : [];
    const t = today();
    for (const f of rows) {
      f.installments = ins.filter(i => i.fee_id === f.id);
      f.paid = f.installments.reduce((s, i) => s + i.paid, 0);
      f.open = f.total - f.paid;
      const next = f.installments.find(i => i.paid < i.amount);
      f.next_due = next ? next.due_on : "";
      f.overdue = f.installments.filter(i => i.paid < i.amount && i.due_on < t).reduce((s, i) => s + i.amount - i.paid, 0);
      f.late_days = next && next.due_on < t ? Math.round((Date.parse(t) - Date.parse(next.due_on)) / 864e5) : 0;
    }
    const sum = { received: rows.reduce((s, f) => s + f.paid, 0), open: rows.reduce((s, f) => s + f.open, 0), overdue: rows.reduce((s, f) => s + f.overdue, 0), plans: rows.filter(f => f.installments.length > 1).length, currency: c.org.currency };
    return H.json({ fees: rows, summary: sum });
  }
  if (p === "/fees" && M === "POST") {
    allow(c, "admin", "finance");
    const b = await H.body(req);
    const student = int(b.studentId);
    if (!(await DB.prepare("SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND role = 'student'").bind(c.org.id, student).first())) throw H.fail("pick a student of this school");
    const total = cents(b.total); if (total <= 0) throw H.fail("enter the amount");
    const n = Math.max(1, Math.min(24, int(b.installments) || 1)), first = /^\d{4}-\d{2}-\d{2}$/.test(b.firstDue || "") ? b.firstDue : today();
    const f = await DB.prepare("INSERT INTO fees (org_id, student_id, class_id, title, total, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(c.org.id, student, b.classId ? int(b.classId) : null, str(b.title, 120) || "Course fee", total, str(b.note, 500), H.now()).first();
    const part = Math.floor(total / n);
    await DB.batch(Array.from({ length: n }, (_, i) => DB.prepare("INSERT INTO installments (fee_id, due_on, amount) VALUES (?, ?, ?)").bind(f.id, addMonths(first, i), i === n - 1 ? total - part * (n - 1) : part)));
    return H.json({ fee: f });
  }
  if ((m = p.match(/^\/fees\/(\d+)$/)) && M === "DELETE") {
    allow(c, "admin", "finance");
    await DB.batch([DB.prepare("DELETE FROM installments WHERE fee_id IN (SELECT id FROM fees WHERE id = ? AND org_id = ?)").bind(int(m[1]), c.org.id), DB.prepare("DELETE FROM fees WHERE id = ? AND org_id = ?").bind(int(m[1]), c.org.id)]);
    return H.json({ ok: true });
  }
  if ((m = p.match(/^\/installments\/(\d+)\/pay$/)) && M === "POST") {
    allow(c, "admin", "finance");
    const i = await DB.prepare("SELECT i.* FROM installments i JOIN fees f ON f.id = i.fee_id WHERE i.id = ? AND f.org_id = ?").bind(int(m[1]), c.org.id).first();
    if (!i) throw H.fail("not found", 404);
    const b = await H.body(req);
    const amount = b.amount === undefined ? i.amount - i.paid : cents(b.amount);
    await DB.prepare("UPDATE installments SET paid = MIN(amount, paid + ?), paid_on = ?, method = ? WHERE id = ?").bind(Math.max(0, amount), /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : today(), ["cash", "bank", "card", "voucher", "other"].includes(b.method) ? b.method : "bank", i.id).run();
    return H.json({ ok: true });
  }
  if (p === "/reminders" && M === "POST") {
    allow(c, "admin", "finance");
    const ids = ((await H.body(req)).feeIds || []).map(int);
    const t = today(), money = v => `${(v / 100).toFixed(2)} ${c.org.currency}`;
    let sent = 0;
    for (const id of ids.slice(0, 200)) {
      const f = await DB.prepare("SELECT f.*, u.email, u.name, u.username FROM fees f JOIN users u ON u.id = f.student_id WHERE f.id = ? AND f.org_id = ?").bind(id, c.org.id).first();
      if (!f) continue;
      const due = (await DB.prepare("SELECT * FROM installments WHERE fee_id = ? AND paid < amount AND due_on <= ? ORDER BY due_on").bind(f.id, addMonths(t, 0)).all()).results;
      const next = due[0] || await DB.prepare("SELECT * FROM installments WHERE fee_id = ? AND paid < amount ORDER BY due_on LIMIT 1").bind(f.id).first();
      if (!next) continue;
      const open = (due.length ? due : [next]).reduce((s, i) => s + i.amount - i.paid, 0);
      await H.sendMail(env, f.email, { subject: `${c.org.name}: payment ${next.due_on < t ? "overdue" : "due"}`, text: `Hello ${f.name || f.username},\n\nthis is a reminder from ${c.org.name} about "${f.title}": ${money(open)} ${next.due_on < t ? "was due on" : "is due on"} ${next.due_on}.\n\nYou can see your payments in LAPP: ${H.appUrl(env, req)}/s/${c.org.slug}#fees\n\nIf you have already paid, please ignore this message.` });
      await DB.prepare("UPDATE installments SET reminded_at = ? WHERE fee_id = ? AND paid < amount").bind(H.now(), f.id).run();
      sent++;
    }
    return H.json({ ok: true, sent });
  }

  /* ---- a student's own page ---- */
  if (p === "/me" && M === "GET") {
    const ids = await myClassIds(env, c);
    const att = (await DB.prepare(`SELECT COUNT(*) n, SUM(a.present) p FROM class_events e JOIN class_students s ON s.class_id = e.class_id AND s.user_id = ?1
      LEFT JOIN attendance a ON a.event_id = e.id AND a.user_id = ?1 WHERE e.class_id IN ${inList(ids)} AND e.status = 'done'`).bind(c.u.id).first());
    const hw = (await DB.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN s.user_id IS NOT NULL THEN 1 ELSE 0 END) done, ROUND(AVG(s.score)) avg FROM assignments a
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = ? WHERE a.class_id IN ${inList(ids)}`).bind(c.u.id).first());
    return H.json({ attendance: att.n ? Math.round((att.p || 0) / att.n * 100) : null, lessons: att.n, homework: hw.n, handedIn: hw.done || 0, average: hw.avg });
  }

  /* ---- live class: hand the socket to the room (a Durable Object per lesson) ---- */
  if ((m = p.match(/^\/live\/(\d+)$/)) && M === "GET") {
    const e = await DB.prepare("SELECT * FROM class_events WHERE id = ?").bind(int(m[1])).first();
    if (!e) throw H.fail("no such lesson", 404);
    const k = await classOf(env, c, e.class_id, H);
    await mustSee(env, c, k, H);
    const teach = canTeach(c, k);
    if (req.headers.get("Upgrade") !== "websocket") return H.json({ event: e, class: { id: k.id, name: k.name, course: k.course }, canTeach: teach, live: e.status === "live" });
    if (!teach && e.status !== "live") throw H.fail("the class hasn't started yet", 409);
    if (!teach) await DB.prepare("INSERT INTO attendance (event_id, user_id, present) VALUES (?, ?, 1) ON CONFLICT(event_id, user_id) DO UPDATE SET present = 1").bind(e.id, c.u.id).run();
    const room = env.ROOM.get(env.ROOM.idFromName(`${c.org.id}:${e.id}`));
    const h = new Headers(req.headers);
    h.set("X-User", JSON.stringify({ id: c.u.id, name: c.u.name || c.u.username, teacher: teach }));
    return room.fetch(new Request(req.url, { headers: h }));
  }

  throw H.fail("not found", 404);
}
