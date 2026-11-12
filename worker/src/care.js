// LAPP · the app store (every root installs what it needs) and the Customer Center (only the platform owner's own space).
// A root is one independent space: "lapp" (the platform owner) or "org:<id>" (an organisation).
// The Customer Center never shows another root's data until that root approves a support request.

/* ================= the store ================= */
// every app in the store; core apps (Users, Files, Settings, App Store) are always there and are not listed
export const CATALOG = [
  { id: "studio", name: "Language Studio", by: "LAPP", icon: "video", color: "#8B5CF6", cat: "Education", about: "Write lessons line by line, cast voices and publish courses. Lesson library, Studio and Characters.", reach: ["Files of your space", "AI"] },
  { id: "classes", name: "Classes", by: "KX5", icon: "school", color: "#0EA5E9", cat: "Education", about: "Groups, teachers and who sits in which class, with an overview of the day.", reach: ["Your members"] },
  { id: "timetable", name: "Timetable", by: "KX5", icon: "calendar", color: "#F59E0B", cat: "Education", about: "Lessons in the week, rooms and live classes.", reach: ["Your members", "Calendar"] },
  { id: "homework", name: "Homework", by: "KX5", icon: "homework", color: "#10B981", cat: "Education", about: "Give, collect and mark homework, with voice answers.", reach: ["Your members", "Files of your space"] },
  { id: "money", name: "Payments", by: "KX5", icon: "money", color: "#64748B", cat: "Business", about: "Fees, payments and what is still open.", reach: ["Your members"] }
];
const IDS = CATALOG.map(a => a.id);
// what a root has before it ever opens the store (so nothing disappears for anyone)
const FIRST = { lapp: ["studio"], org: ["classes", "timetable", "homework", "money", "studio"] };

// which root the person is working in, and whether they may install there
async function rootOf(env, H, req, u, org) {
  if (!org) {
    if (!["designer", "manager", "admin"].includes(u.role)) throw H.fail("not allowed", 403);
    return { key: "lapp", kind: "lapp", admin: u.role === "admin", name: "LAPP", role: u.role };
  }
  const r = await env.DB.prepare("SELECT o.id, o.name, m.role FROM orgs o JOIN org_members m ON m.org_id = o.id WHERE o.slug = ? AND m.user_id = ? AND m.active = 1 AND o.disabled = 0").bind(org, u.id).first();
  if (!r) throw H.fail("not allowed", 403);
  return { key: "org:" + r.id, kind: "org", admin: r.role === "admin", name: r.name, role: r.role };
}
export async function installsOf(env, root, kind) {
  const chose = await env.DB.prepare("SELECT 1 FROM install_roots WHERE root = ?").bind(root).first();
  if (!chose) return Object.fromEntries(FIRST[kind].map(a => [a, { all: 1 }]));
  const rows = (await env.DB.prepare("SELECT app, who FROM installs WHERE root = ?").bind(root).all()).results;
  return Object.fromEntries(rows.map(r => { let w = { all: 1 }; try { w = JSON.parse(r.who); } catch {} return [r.app, w]; }));
}
// may this person (with this role in the root) use the app?
export const mayUse = (who, role, isAdmin) => !who ? false : who.all ? true : who.me ? isAdmin : Array.isArray(who.roles) ? who.roles.includes(role) : false;

export async function storeApi(req, env, H, p, url) {
  const M = req.method, u = await H.need(req, env), root = await rootOf(env, H, req, u, url.searchParams.get("org") || "");
  const DB = env.DB;
  if (p === "" && M === "GET") {
    const inst = await installsOf(env, root.key, root.kind);
    return H.json({ root: { name: root.name, admin: root.admin, role: root.role }, apps: CATALOG.map(a => ({ ...a, installed: !!inst[a.id], who: inst[a.id] || null, mine: mayUse(inst[a.id], root.role, root.admin) })) });
  }
  let m;
  if ((m = p.match(/^\/([a-z]+)$/)) && (M === "PUT" || M === "DELETE")) {
    if (!root.admin) throw H.fail("only the space's admin installs apps", 403);
    const app = m[1]; if (!IDS.includes(app)) throw H.fail("no such app", 404);
    // the first change: keep what the root had, then change it
    if (!await DB.prepare("SELECT 1 FROM install_roots WHERE root = ?").bind(root.key).first()) {
      const cur = await installsOf(env, root.key, root.kind);
      await DB.batch([DB.prepare("INSERT INTO install_roots (root, at) VALUES (?, ?)").bind(root.key, H.now()),
        ...Object.keys(cur).map(a => DB.prepare("INSERT OR IGNORE INTO installs (root, app, who, by_user, at) VALUES (?, ?, ?, ?, ?)").bind(root.key, a, '{"all":1}', u.id, H.now()))]);
    }
    if (M === "DELETE") { await DB.prepare("DELETE FROM installs WHERE root = ? AND app = ?").bind(root.key, app).run(); return H.json({ ok: true }); }
    const b = await H.body(req);
    const who = b.who && b.who.me ? { me: 1 } : b.who && Array.isArray(b.who.roles) && b.who.roles.length ? { roles: b.who.roles.map(String).slice(0, 20) } : { all: 1 };
    await DB.prepare("INSERT INTO installs (root, app, who, by_user, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(root, app) DO UPDATE SET who = excluded.who").bind(root.key, app, JSON.stringify(who), u.id, H.now()).run();
    return H.json({ ok: true });
  }
  throw H.fail("not found", 404);
}

/* ================= public IDs ================= */
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newId = () => { const b = crypto.getRandomValues(new Uint8Array(10)); return [...b].map(x => ABC[x % ABC.length]).join(""); };
export async function pubId(env, table, id) {
  const r = await env.DB.prepare(`SELECT pub_id FROM ${table} WHERE id = ?`).bind(id).first();
  if (!r) return "";
  if (r.pub_id) return r.pub_id;
  for (let i = 0; i < 5; i++) { const v = newId(); try { await env.DB.prepare(`UPDATE ${table} SET pub_id = ? WHERE id = ? AND pub_id IS NULL`).bind(v, id).run(); break; } catch {} }
  return (await env.DB.prepare(`SELECT pub_id FROM ${table} WHERE id = ?`).bind(id).first()).pub_id;
}

/* ================= what happened to an account, and the rules ================= */
const device = ua => { ua = ua || ""; const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser"; const o = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : ""; return b + (o ? " · " + o : ""); };
export async function logAccount(env, H, req, userId, kind, detail = "") {
  if (!userId) return;
  const country = (req.cf && req.cf.country) || req.headers.get("CF-IPCountry") || "";
  await env.DB.prepare("INSERT INTO account_log (user_id, kind, country, device, detail, at) VALUES (?, ?, ?, ?, ?, ?)").bind(userId, kind, country, device(req.headers.get("User-Agent")), String(detail).slice(0, 200), H.now()).run();
  if (kind === "signin" || kind === "wrongpw") await checkRules(env, H, userId).catch(() => {});
}
// rules look at behaviour only (how often, from how many countries or devices) — never at anyone's content
async function checkRules(env, H, userId) {
  const DB = env.DB, rules = (await DB.prepare("SELECT * FROM care_rules WHERE on_ = 1").all()).results;
  for (const r of rules) {
    const since = H.now() - r.minutes * 60e3;
    const q = { wrongpw: "SELECT COUNT(*) n FROM account_log WHERE user_id = ? AND kind = 'wrongpw' AND at > ?", signins: "SELECT COUNT(*) n FROM account_log WHERE user_id = ? AND kind = 'signin' AND at > ?",
      countries: "SELECT COUNT(DISTINCT country) n FROM account_log WHERE user_id = ? AND kind = 'signin' AND country != '' AND at > ?", devices: "SELECT COUNT(DISTINCT device) n FROM account_log WHERE user_id = ? AND kind = 'signin' AND at > ?" }[r.signal];
    if (!q) continue;
    const n = (await DB.prepare(q).bind(userId, since).first()).n;
    if (n < r.amount) continue;
    if (await DB.prepare("SELECT 1 FROM care_flags WHERE rule_id = ? AND user_id = ? AND at > ?").bind(r.id, userId, since).first()) continue;   // once per window
    let done = "Shown to us";
    if (r.action === "signout") { await DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run(); done = "Signed out everywhere"; }
    if (r.action === "suspend") { await DB.batch([DB.prepare("UPDATE users SET disabled = 1 WHERE id = ?").bind(userId), DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId)]); done = "Suspended"; }
    await DB.prepare("INSERT INTO care_flags (rule_id, user_id, detail, done, at) VALUES (?, ?, ?, ?, ?)").bind(r.id, userId, `${n} in ${r.minutes} min`, done, H.now()).run();
  }
}

/* ================= the Customer Center: only the platform owner's own team ================= */
const SIGNALS = ["wrongpw", "countries", "signins", "devices"], ACTIONS = ["show", "signout", "suspend"];
async function owner(req, env, H) { return H.need(req, env, ["manager", "admin"]); }
// what support may see about an account before consent: its name and its ID
async function who(env, kind, id) {
  if (kind === "org") { const o = await env.DB.prepare("SELECT id, name FROM orgs WHERE id = ?").bind(id).first(); return o && { kind, id: o.id, name: o.name, pub: await pubId(env, "orgs", o.id) }; }
  const u = await env.DB.prepare("SELECT id, name, username, role, disabled FROM users WHERE id = ?").bind(id).first();
  return u && { kind, id: u.id, name: u.name || "@" + u.username, pub: await pubId(env, "users", u.id), suspended: !!u.disabled };
}
async function byPub(env, pub) {
  pub = String(pub || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (pub.length !== 10) return null;
  const u = await env.DB.prepare("SELECT id FROM users WHERE pub_id = ?").bind(pub).first(); if (u) return who(env, "user", u.id);
  const o = await env.DB.prepare("SELECT id FROM orgs WHERE pub_id = ?").bind(pub).first(); if (o) return who(env, "org", o.id);
  return null;
}
// an approved, unexpired request opens this account to support
async function granted(env, H, kind, id) {
  return env.DB.prepare("SELECT * FROM care_requests WHERE kind = ? AND target = ? AND status = 'approved' AND expires > ? ORDER BY id DESC LIMIT 1").bind(kind, id, H.now()).first();
}
const sha = async s => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))));

export async function careApi(req, env, H, p, url) {
  const M = req.method, DB = env.DB;
  // the person (or organisation admin) answers a request from the link in the e-mail or from their desk
  if (p === "/answer" && M === "POST") {
    const b = await H.body(req), yes = !!b.yes;
    let r = null;
    if (b.token) r = await DB.prepare("SELECT * FROM care_requests WHERE token_hash = ? AND status = 'waiting'").bind(await sha(String(b.token))).first();
    else if (b.id) {
      const u = await H.need(req, env); r = await DB.prepare("SELECT * FROM care_requests WHERE id = ? AND status = 'waiting'").bind(+b.id).first();
      if (r && !(r.kind === "user" ? r.target === u.id : await DB.prepare("SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? AND role = 'admin' AND active = 1").bind(r.target, u.id).first())) r = null;
    }
    if (!r) throw H.fail("this request is no longer open", 404);
    await DB.prepare("UPDATE care_requests SET status = ?, answered_at = ?, expires = ?, token_hash = NULL WHERE id = ?").bind(yes ? "approved" : "declined", H.now(), yes ? H.now() + H.DAY : null, r.id).run();
    return H.json({ ok: true });
  }
  // requests waiting for me (shown on my desk)
  if (p === "/mine" && M === "GET") {
    const u = await H.need(req, env);
    const rows = (await DB.prepare(`SELECT id, kind, target, reason, created_at FROM care_requests WHERE status = 'waiting' AND ((kind = 'user' AND target = ?) OR (kind = 'org' AND target IN (SELECT org_id FROM org_members WHERE user_id = ? AND role = 'admin' AND active = 1)))`).bind(u.id, u.id).all()).results;
    return H.json({ requests: rows });
  }

  const me = await owner(req, env, H);
  if (p === "/find" && M === "GET") { const w = await byPub(env, url.searchParams.get("id")); if (!w) throw H.fail("no account with this ID", 404); return H.json({ who: w }); }
  if (p === "/requests" && M === "GET") {
    await DB.prepare("UPDATE care_requests SET status = 'ended' WHERE status = 'approved' AND expires <= ?").bind(H.now()).run();
    const rows = (await DB.prepare("SELECT r.*, u.name by_name, u.username by_username FROM care_requests r LEFT JOIN users u ON u.id = r.by_user ORDER BY r.id DESC LIMIT 100").all()).results;
    return H.json({ requests: await Promise.all(rows.map(async r => ({ id: r.id, status: r.status, reason: r.reason, via: r.via, at: r.created_at, expires: r.expires, by: r.by_name || "@" + r.by_username, who: await who(env, r.kind, r.target) }))) });
  }
  if (p === "/requests" && M === "POST") {
    const b = await H.body(req), w = await byPub(env, b.id); if (!w) throw H.fail("no account with this ID", 404);
    if (await DB.prepare("SELECT 1 FROM care_requests WHERE kind = ? AND target = ? AND status IN ('waiting','approved') AND (expires IS NULL OR expires > ?)").bind(w.kind, w.id, H.now()).first()) throw H.fail("there is already an open request for this account", 409);
    const token = H.b64url(H.rand(24)), via = ["app", "email"].filter(v => !b.via || b.via.includes(v)).join(",") || "app";
    const r = await DB.prepare("INSERT INTO care_requests (kind, target, reason, via, token_hash, by_user, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(w.kind, w.id, String(b.reason || "").slice(0, 200), via, await sha(token), me.id, H.now()).first();
    let dev = {};
    if (via.includes("email")) {
      const to = w.kind === "user" ? (await DB.prepare("SELECT email FROM users WHERE id = ?").bind(w.id).first()).email
        : ((await DB.prepare("SELECT u.email FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.role = 'admin' AND m.active = 1 LIMIT 1").bind(w.id).first()) || {}).email;
      const link = `${H.appUrl(env, req)}/?care=${token}`;
      if (to && H.hasEmail(to)) await H.sendMail(env, to, { subject: "Our support asks to look into your account", text: `Our support team asks for access to your account to help you${b.reason ? `: “${String(b.reason).slice(0, 200)}”` : ""}.\n\nAccess lasts 24 hours and you can end it any time. Open this link to allow or refuse:\n${link}\n\nIf you did not contact us, refuse it.` });
      if (env.DEV === "1") dev = { devToken: token };
    }
    return H.json({ ok: true, id: r.id, ...dev });
  }
  let m;
  if ((m = p.match(/^\/requests\/(\d+)$/)) && M === "DELETE") {
    await DB.prepare("UPDATE care_requests SET status = CASE WHEN status = 'approved' THEN 'ended' ELSE 'cancelled' END, expires = MIN(COALESCE(expires, ?), ?) WHERE id = ? AND status IN ('waiting','approved')").bind(H.now(), H.now(), +m[1]).run();
    return H.json({ ok: true });
  }
  // inside an approved account: its account facts and its log (only while access lasts)
  if ((m = p.match(/^\/open\/(\d+)$/)) && M === "GET") {
    const r = await DB.prepare("SELECT * FROM care_requests WHERE id = ?").bind(+m[1]).first();
    if (!r || r.status !== "approved" || r.expires <= H.now()) throw H.fail("no access — the account has to approve first", 403);
    const w = await who(env, r.kind, r.target);
    const users = r.kind === "user" ? [r.target] : (await DB.prepare("SELECT user_id FROM org_members WHERE org_id = ? AND active = 1").bind(r.target).all()).results.map(x => x.user_id);
    const log = users.length ? (await DB.prepare(`SELECT l.*, u.name, u.username FROM account_log l JOIN users u ON u.id = l.user_id WHERE l.user_id IN (${users.map(() => "?").join(",")}) ORDER BY l.at DESC LIMIT 200`).bind(...users).all()).results : [];
    let account = null;
    if (r.kind === "user") {
      const u = await DB.prepare("SELECT verified, disabled, created_at, last_seen, country FROM users WHERE id = ?").bind(r.target).first();
      const sessions = (await DB.prepare("SELECT created_at, ua FROM sessions WHERE user_id = ? AND expires > ? ORDER BY created_at DESC LIMIT 20").bind(r.target, H.now()).all()).results.map(s => ({ at: s.created_at, device: device(s.ua) }));
      account = { ...u, sessions };
    } else account = { members: users.length };
    await DB.prepare("INSERT INTO account_log (user_id, kind, detail, at) VALUES (?, 'support', ?, ?)").bind(r.kind === "user" ? r.target : users[0] || 0, `support looked at the account (${me.name || me.username})`, H.now()).run();
    return H.json({ who: w, expires: r.expires, reason: r.reason, account, log: log.map(l => ({ at: l.at, kind: l.kind, country: l.country, device: l.device, detail: l.detail, who: l.name || "@" + l.username })) });
  }
  if ((m = p.match(/^\/open\/(\d+)\/signout$/)) && M === "POST") {
    const r = await DB.prepare("SELECT * FROM care_requests WHERE id = ?").bind(+m[1]).first();
    if (!r || r.status !== "approved" || r.expires <= H.now() || r.kind !== "user") throw H.fail("no access", 403);
    await DB.batch([DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(r.target), DB.prepare("INSERT INTO account_log (user_id, kind, detail, at) VALUES (?, 'support', 'support signed the account out everywhere', ?)").bind(r.target, H.now())]);
    return H.json({ ok: true });
  }
  // flags: who broke which rule (ID and name only), and suspending without seeing anything
  if (p === "/flags" && M === "GET") {
    const st = url.searchParams.get("status") === "closed" ? "closed" : "open";
    const rows = (await DB.prepare("SELECT f.*, r.name rule FROM care_flags f JOIN care_rules r ON r.id = f.rule_id WHERE f.status = ? ORDER BY f.id DESC LIMIT 200").bind(st).all()).results;
    return H.json({ flags: await Promise.all(rows.map(async f => ({ id: f.id, rule: f.rule, detail: f.detail, done: f.done, at: f.at, who: await who(env, "user", f.user_id) }))) });
  }
  if ((m = p.match(/^\/flags\/(\d+)$/)) && M === "POST") {
    const b = await H.body(req), f = await DB.prepare("SELECT * FROM care_flags WHERE id = ?").bind(+m[1]).first(); if (!f) throw H.fail("not found", 404);
    if (b.do === "close") await DB.prepare("UPDATE care_flags SET status = 'closed' WHERE id = ?").bind(f.id).run();
    else if (b.do === "suspend" || b.do === "lift") {
      if (me.role !== "admin") throw H.fail("only an admin can do this", 403);
      const t = await DB.prepare("SELECT role FROM users WHERE id = ?").bind(f.user_id).first(); if (t && t.role !== "user") throw H.fail("not for the team", 403);
      await DB.batch([DB.prepare("UPDATE users SET disabled = ? WHERE id = ?").bind(b.do === "suspend" ? 1 : 0, f.user_id), ...(b.do === "suspend" ? [DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(f.user_id)] : []),
        DB.prepare("UPDATE care_flags SET done = ? WHERE id = ?").bind(b.do === "suspend" ? "Suspended" : "Lifted", f.id), DB.prepare("INSERT INTO account_log (user_id, kind, at) VALUES (?, ?, ?)").bind(f.user_id, b.do === "suspend" ? "suspended" : "lifted", H.now())]);
    } else throw H.fail("bad action");
    return H.json({ ok: true });
  }
  // rules
  if (p === "/rules" && M === "GET") {
    const rows = (await DB.prepare("SELECT r.*, (SELECT COUNT(*) FROM care_flags f WHERE f.rule_id = r.id AND f.at > ?) week FROM care_rules r ORDER BY r.id").bind(H.now() - 7 * H.DAY).all()).results;
    return H.json({ rules: rows.map(r => ({ id: r.id, name: r.name, signal: r.signal, amount: r.amount, minutes: r.minutes, action: r.action, on: !!r.on_, week: r.week })) });
  }
  const clean = b => {
    const signal = SIGNALS.includes(b.signal) ? b.signal : null, action = ACTIONS.includes(b.action) ? b.action : "show";
    const amount = Math.max(1, Math.min(100000, +b.amount || 0)), minutes = Math.max(1, Math.min(43200, +b.minutes || 0));
    if (!signal || !amount || !minutes) throw H.fail("a rule needs what to count, how many and in how long");
    return { signal, action, amount, minutes, name: String(b.name || "").trim().slice(0, 80) || `${amount}+ ${signal} in ${minutes} min` };
  };
  if (p === "/rules" && M === "POST") {
    if (me.role !== "admin") throw H.fail("only an admin can do this", 403);
    const r = clean(await H.body(req));
    await DB.prepare("INSERT INTO care_rules (name, signal, amount, minutes, action, on_, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)").bind(r.name, r.signal, r.amount, r.minutes, r.action, H.now()).run();
    return H.json({ ok: true });
  }
  if ((m = p.match(/^\/rules\/(\d+)$/)) && (M === "PATCH" || M === "DELETE")) {
    if (me.role !== "admin") throw H.fail("only an admin can do this", 403);
    if (M === "DELETE") { await DB.batch([DB.prepare("DELETE FROM care_rules WHERE id = ?").bind(+m[1]), DB.prepare("DELETE FROM care_flags WHERE rule_id = ?").bind(+m[1])]); return H.json({ ok: true }); }
    const b = await H.body(req);
    if (b.on !== undefined) await DB.prepare("UPDATE care_rules SET on_ = ? WHERE id = ?").bind(b.on ? 1 : 0, +m[1]).run();
    if (b.action !== undefined && ACTIONS.includes(b.action)) await DB.prepare("UPDATE care_rules SET action = ? WHERE id = ?").bind(b.action, +m[1]).run();
    return H.json({ ok: true });
  }
  throw H.fail("not found", 404);
}
