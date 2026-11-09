// LAPP — one Worker for the whole site (lapp.khaledi.eu).
//
// The static app (index.html, app.js, content/…) is served from Workers Static Assets.
// This code runs first only for: /api/*, /admin, /studio and the lessons' audio.mp3
// (see run_worker_first in wrangler.toml).
//
//   accounts     e-mail + username + password, one form: /api/auth/check says whether the
//                e-mail is known (→ password) or new (→ sign-up). Session = HttpOnly cookie.
//   progress     the browser's lapp:* keys as one JSON blob per user (guests keep theirs local)
//   plans        free · Plus (Stripe subscription, a hand grant, staff, or a connection from Iran)
//   admin        /admin for managers and admins, /studio for designers too
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, GITHUB_TOKEN, ADMIN_EMAILS.
// Vars:    APP_URL, EMAIL_FROM, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, REPO, BRANCH, DEV.
import { studioApi } from "./studio.js";
import STUDIO from "./studio.html";
import ADMIN from "./admin.html";
import SCHOOL from "./school.html";
import { orgApi, orgsList, adminOrgs } from "./school.js";
export { Room } from "./room.js";

const DAY = 864e5;
const SESSION_DAYS = 60;
const COOKIE = "__Host-lapp";
const ITER = 100000;                 // the most PBKDF2 iterations Workers allow
const ROLES = ["user", "designer", "manager", "admin"];
const STAFF = ["designer", "manager", "admin"];
const USERNAME = /^[a-z0-9_.]{3,20}$/;
const RESERVED = new Set(["admin", "administrator", "studio", "lapp", "root", "support", "help", "api", "system", "staff", "moderator", "official"]);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
// school accounts have no address ("@username"): nothing is ever sent to them
const hasEmail = e => !!e && !String(e).startsWith("@");
const DEFAULT_ACCESS = { locked: [], iranFree: true, trialDays: 7 };   // locked: lesson folders that need Plus

const SECURE = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" };
const json = (v, status = 200, headers = {}) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...SECURE, ...headers } });
const fail = (message, status = 400, extra) => Object.assign(new Error(message), { status, extra });

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p.startsWith("/api/")) return await api(req, env, url, ctx);
      if (p === "/admin" || p === "/admin/") return await page(req, env, ADMIN, ["manager", "admin"], "/admin");
      // a school's portal: anyone signed in gets the page; the API decides what they may see
      let sm;
      if ((sm = p.match(/^\/s\/([a-z0-9][a-z0-9-]{1,30})\/?$/))) return await page(req, env, SCHOOL, ROLES, `/s/${sm[1]}`);
      if (p === "/studio" || p === "/studio/") return await page(req, env, STUDIO, STAFF, "/studio");
      if (/^\/content\/lessons\/[^/]+\/audio\.mp3$/.test(p)) return await audio(req, env, p);
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (!e.status) console.error(e.stack || e);
      return json({ error: e.status ? e.message : "server error", ...(e.extra || {}) }, e.status || 500);
    }
  }
};

/* ================= helpers ================= */
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64url = buf => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const sha = async s => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
function same(a, b) {               // constant-time compare of two strings
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: iter }, key, 256);
  return b64(bits);
}
async function hashPassword(pw) { const salt = b64(rand(16)); return { salt, iter: ITER, pw_hash: await pbkdf2(pw, salt, ITER) }; }
async function checkPassword(u, pw) { return same(await pbkdf2(pw, u.salt, u.iter), u.pw_hash); }
const now = () => Date.now();
const ip = req => req.headers.get("CF-Connecting-IP") || "local";
const country = req => (req.cf && req.cf.country) || req.headers.get("CF-IPCountry") || "";
const cleanEmail = e => String(e || "").trim().toLowerCase();
const cleanUser = u => String(u || "").trim().toLowerCase().replace(/^@/, "");
async function body(req) { try { return await req.json(); } catch { throw fail("bad JSON"); } }
const admins = env => String(env.ADMIN_EMAILS || "").split(",").map(cleanEmail).filter(Boolean);
const appUrl = (env, req) => (env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");

// fixed-window limit: at most n hits per key in `win` ms
async function limit(env, key, n, win) {
  const t = now();
  const r = await env.DB.prepare("INSERT INTO hits (key, n, reset) VALUES (?1, 1, ?2) ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset < ?3 THEN 1 ELSE n + 1 END, reset = CASE WHEN reset < ?3 THEN ?2 ELSE reset END RETURNING n")
    .bind(key, t + win, t).first();
  if (r.n > n) throw fail("too many attempts — try again later", 429, { code: "rate" });
}

async function getSetting(env, key, dflt) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return r ? { ...dflt, ...JSON.parse(r.value) } : { ...dflt };
}

/* ================= sessions ================= */
function cookieOf(req) {
  const m = (req.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]{20,})`));
  return m ? m[1] : null;
}
const setCookie = (token, days) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.round(days * 86400)}`;
async function startSession(env, req, user) {
  const token = b64url(rand(32));
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires, ua) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha(token), user.id, now(), now() + SESSION_DAYS * DAY, (req.headers.get("User-Agent") || "").slice(0, 200)).run();
  return setCookie(token, SESSION_DAYS);
}
async function currentUser(req, env) {
  const token = cookieOf(req);
  if (!token) return null;
  const u = await env.DB.prepare("SELECT u.*, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?")
    .bind(await sha(token), now()).first();
  if (!u || u.disabled) return null;
  return u;
}
async function need(req, env, roles) {
  const u = await currentUser(req, env);
  if (!u) throw fail("sign in first", 401, { code: "auth" });
  if (roles && !roles.includes(u.role)) throw fail("not allowed", 403);
  return u;
}

/* ================= plan ================= */
async function planOf(env, req, u) {
  const access = await getSetting(env, "access", DEFAULT_ACCESS);
  const iran = access.iranFree && country(req) === "IR";
  if (!u) return { tier: iran ? "plus" : "free", why: iran ? "iran" : "" };
  if (STAFF.includes(u.role)) return { tier: "plus", why: "staff" };
  const s = await env.DB.prepare("SELECT * FROM subscriptions WHERE user_id = ?").bind(u.id).first();
  const sub = s && ["active", "trialing"].includes(s.status) ? s : null;
  if (sub) return { tier: "plus", why: "stripe", status: sub.status, interval: sub.interval, until: sub.period_end, cancelAtEnd: !!sub.cancel_at_end };
  if (u.plus_until > now()) return { tier: "plus", why: "grant", until: u.plus_until };
  if (iran) return { tier: "plus", why: "iran" };
  return { tier: "free", why: "", status: s ? s.status : "" };
}
const publicUser = u => ({ id: u.id, email: hasEmail(u.email) ? u.email : "", managed: !!u.managed_by, username: u.username, name: u.name, role: u.role, verified: !!u.verified, since: new Date(u.created_at).toISOString().slice(0, 10) });
async function me(env, req, u) {
  const orgs = (await env.DB.prepare("SELECT o.slug, o.name, m.role FROM org_members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND m.active = 1 AND o.disabled = 0 ORDER BY o.name").bind(u.id).all()).results;
  return { user: publicUser(u), plan: await planOf(env, req, u), country: country(req), orgs };
}
// what school.js needs from here
const H = {
  json, fail, body, need: (req, env, roles) => need(req, env, roles), sendMail, newCode, hashPassword, rand, b64url,
  appUrl, cleanEmail, cleanUser, EMAIL, USERNAME, RESERVED, now, DAY, hasEmail
};

/* ================= e-mail ================= */
const T = {
  verify: (code) => ({ subject: `Your LAPP code: ${code}`, text: `Your verification code is ${code}\n\nIt is valid for 30 minutes. If you did not sign up for LAPP, you can ignore this e-mail.` }),
  invite: (link, who) => ({ subject: "You're invited to LAPP", text: `${who} created a LAPP account for you.\n\nOpen this link to choose your password and sign in (valid for 7 days):\n${link}` }),
  reset: (link) => ({ subject: "Reset your LAPP password", text: `Someone (hopefully you) asked to reset the password of your LAPP account.\n\nOpen this link to choose a new password (valid for 1 hour):\n${link}\n\nIf this wasn't you, ignore this e-mail — your password stays the same.` })
};
async function sendMail(env, to, { subject, text }) {
  if (!hasEmail(to)) return false;
  if (!env.RESEND_API_KEY) { console.log(`[mail to ${to}] ${subject}\n${text}`); return false; }
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;max-width:480px">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>")}</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM || "LAPP <no-reply@khaledi.eu>", to: [to], subject, text, html })
  });
  if (!r.ok) console.error("resend", r.status, await r.text());
  return r.ok;
}
async function newCode(env, user, kind, ttl) {
  await env.DB.prepare("UPDATE codes SET used = 1 WHERE user_id = ? AND kind = ? AND used = 0").bind(user.id, kind).run();
  const code = kind === "verify" ? String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)) : b64url(rand(32));
  ttl = ttl || (kind === "verify" ? 30 * 60e3 : 60 * 60e3);
  await env.DB.prepare("INSERT INTO codes (user_id, kind, code_hash, expires) VALUES (?, ?, ?, ?)").bind(user.id, kind, await sha(code), now() + ttl).run();
  return code;
}
async function sendVerify(env, user) {
  const code = await newCode(env, user, "verify");
  await sendMail(env, user.email, T.verify(code));
  return env.DEV === "1" ? { devCode: code } : {};
}

/* ================= API ================= */
async function api(req, env, url, ctx) {
  const p = url.pathname.slice(4);           // after /api
  const M = req.method;
  if (!env.DB) throw fail("accounts are not set up yet", 503);
  // Stripe calls in with its own signature; everything else that changes state must carry
  // a header a cross-site form, link or image cannot send
  if (p === "/stripe/webhook" && M === "POST") return stripeWebhook(req, env);
  if (M !== "GET" && M !== "HEAD" && req.headers.get("X-LAPP") !== "1") throw fail("missing X-LAPP header", 400);

  /* ---- public ---- */
  if (p === "/config" && M === "GET") {
    const access = await getSetting(env, "access", DEFAULT_ACCESS);
    return json({ api: true, country: country(req), iran: access.iranFree && country(req) === "IR", access, billing: !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTHLY),
      prices: { month: env.PRICE_MONTH_LABEL || "", year: env.PRICE_YEAR_LABEL || "", save: env.PRICE_SAVE_LABEL || "" } });
  }
  if (p === "/username" && M === "GET") {
    const u = cleanUser(url.searchParams.get("u"));
    await limit(env, `uname:${ip(req)}`, 60, 60e3);
    if (!USERNAME.test(u)) return json({ ok: false, reason: "format" });
    if (RESERVED.has(u)) return json({ ok: false, reason: "taken" });
    const r = await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(u).first();
    return json({ ok: !r, reason: r ? "taken" : "" });
  }

  /* ---- accounts ---- */
  // the sign-in card asks for an e-mail or a username: known → password, new e-mail → sign-up
  if (p === "/auth/check" && M === "POST") {
    const b = await body(req);
    const e = cleanEmail(b.email || b.username);
    await limit(env, `check:${ip(req)}`, 30, 60e3);
    if (!e.includes("@") || e.startsWith("@")) {
      const un = cleanUser(e);
      const u = USERNAME.test(un) ? await env.DB.prepare("SELECT name, username, email FROM users WHERE username = ?").bind(un).first() : null;
      if (!u) throw fail("no account with this username", 404, { code: "nouser" });
      return json({ exists: true, name: u.name || u.username, username: u.username, email: hasEmail(u.email) });
    }
    if (!EMAIL.test(e)) throw fail("enter a valid e-mail", 400, { code: "email" });
    const u = await env.DB.prepare("SELECT name, username FROM users WHERE email = ?").bind(e).first();
    return json({ exists: !!u, name: u ? (u.name || u.username) : "", email: true });
  }

  if (p === "/auth/signup" && M === "POST") {
    const b = await body(req);
    const e = cleanEmail(b.email), un = cleanUser(b.username), pw = String(b.password || ""), name = String(b.name || "").trim().slice(0, 40);
    if (!EMAIL.test(e)) throw fail("enter a valid e-mail", 400, { code: "email" });
    if (!USERNAME.test(un) || RESERVED.has(un)) throw fail("username: 3–20 letters, digits, _ or .", 400, { code: "username" });
    if (pw.length < 8 || pw.length > 200) throw fail("password: at least 8 characters", 400, { code: "password" });
    await limit(env, `signup:${ip(req)}`, 8, 3600e3);
    const taken = await env.DB.prepare("SELECT email = ? AS mail FROM users WHERE email = ? OR username = ?").bind(e, e, un).first();
    if (taken) throw fail(taken.mail ? "this e-mail already has an account" : "this username is taken", 409, { code: taken.mail ? "exists" : "taken" });
    const h = await hashPassword(pw);
    const t = now();
    const user = await env.DB.prepare("INSERT INTO users (email, username, name, pw_hash, salt, iter, created_at, last_seen, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(e, un, name, h.pw_hash, h.salt, h.iter, t, t, country(req)).first();
    // the guest's progress from this browser becomes the account's
    if (b.progress && typeof b.progress === "object") await saveProgress(env, user.id, b.progress);
    const cookie = await startSession(env, req, user);
    const dev = await sendVerify(env, user);
    return json({ ...(await me(env, req, user)), ...dev }, 200, { "Set-Cookie": cookie });
  }

  if (p === "/auth/login" && M === "POST") {
    const b = await body(req);
    const id = cleanEmail(b.email || b.username), pw = String(b.password || "");
    await limit(env, `login:${ip(req)}`, 20, 15 * 60e3);
    await limit(env, `login:${id}`, 10, 15 * 60e3);
    const u = await env.DB.prepare("SELECT * FROM users WHERE email = ? OR username = ?").bind(id, id.replace(/^@/, "")).first();
    // same work and the same answer for an unknown account and a wrong password
    const ok = u ? await checkPassword(u, pw) : (await pbkdf2(pw, "AAAAAAAAAAAAAAAAAAAAAA==", ITER), false);
    if (!ok) throw fail("wrong e-mail or password", 401, { code: "wrong" });
    if (u.disabled) throw fail("this account is disabled", 403, { code: "disabled" });
    await promote(env, u);
    await env.DB.prepare("UPDATE users SET last_seen = ?, country = ? WHERE id = ?").bind(now(), country(req) || u.country, u.id).run();
    const cookie = await startSession(env, req, u);
    return json(await me(env, req, u), 200, { "Set-Cookie": cookie });
  }

  if (p === "/auth/logout" && M === "POST") {
    const token = cookieOf(req);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(token)).run();
    return json({ ok: true }, 200, { "Set-Cookie": setCookie("x".repeat(20), 0) });
  }

  if (p === "/auth/forgot" && M === "POST") {
    const e = cleanEmail((await body(req)).email);
    await limit(env, `forgot:${ip(req)}`, 10, 3600e3);
    await limit(env, `forgot:${e}`, 3, 3600e3);
    const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(e).first();
    let dev = {};
    if (u && !u.disabled && hasEmail(u.email)) {
      const token = await newCode(env, u, "reset");
      await sendMail(env, u.email, T.reset(`${appUrl(env, req)}/?reset=${token}`));
      if (env.DEV === "1") dev = { devToken: token };
    }
    return json({ ok: true, ...dev });   // the same answer whether or not the e-mail is known
  }

  if (p === "/auth/reset" && M === "POST") {
    const b = await body(req);
    const pw = String(b.password || "");
    if (pw.length < 8 || pw.length > 200) throw fail("password: at least 8 characters", 400, { code: "password" });
    await limit(env, `reset:${ip(req)}`, 20, 3600e3);
    const c = await env.DB.prepare("SELECT * FROM codes WHERE code_hash = ? AND kind = 'reset' AND used = 0 AND expires > ?").bind(await sha(String(b.token || "")), now()).first();
    if (!c) throw fail("this link has expired — ask for a new one", 400, { code: "expired" });
    const h = await hashPassword(pw);
    // a reset proves the e-mail, so it also verifies it; every other session is signed out
    await env.DB.batch([
      env.DB.prepare("UPDATE codes SET used = 1 WHERE id = ?").bind(c.id),
      env.DB.prepare("UPDATE users SET pw_hash = ?, salt = ?, iter = ?, verified = 1 WHERE id = ?").bind(h.pw_hash, h.salt, h.iter, c.user_id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(c.user_id)
    ]);
    const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(c.user_id).first();
    if (u.disabled) throw fail("this account is disabled", 403, { code: "disabled" });
    await promote(env, u);
    const cookie = await startSession(env, req, u);
    return json(await me(env, req, u), 200, { "Set-Cookie": cookie });
  }

  /* ---- signed in ---- */
  if (p === "/me" && M === "GET") {
    const u = await currentUser(req, env);
    if (!u) return json({ user: null, plan: await planOf(env, req, null), country: country(req) });
    if (now() - u.last_seen > 3600e3) ctx.waitUntil(env.DB.prepare("UPDATE users SET last_seen = ?, country = ? WHERE id = ?").bind(now(), country(req) || u.country, u.id).run());
    return json(await me(env, req, u));
  }

  if (p === "/me" && M === "PATCH") {
    const u = await need(req, env);
    const b = await body(req);
    const sets = [], vals = [];
    if (b.name !== undefined) { sets.push("name = ?"); vals.push(String(b.name).trim().slice(0, 40)); }
    if (b.username !== undefined && cleanUser(b.username) !== u.username) {
      const un = cleanUser(b.username);
      if (!USERNAME.test(un) || RESERVED.has(un)) throw fail("username: 3–20 letters, digits, _ or .", 400, { code: "username" });
      if (await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(un).first()) throw fail("this username is taken", 409, { code: "taken" });
      sets.push("username = ?"); vals.push(un);
    }
    if (sets.length) await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, u.id).run();
    return json(await me(env, req, await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first()));
  }

  if (p === "/auth/verify" && M === "POST") {
    const u = await need(req, env);
    const code = String((await body(req)).code || "").replace(/\D/g, "");
    const c = await env.DB.prepare("SELECT * FROM codes WHERE user_id = ? AND kind = 'verify' AND used = 0 AND expires > ? ORDER BY id DESC LIMIT 1").bind(u.id, now()).first();
    if (!c) throw fail("this code has expired — send a new one", 400, { code: "expired" });
    if (c.tries >= 5) throw fail("too many wrong codes — send a new one", 429, { code: "expired" });
    if (!same(await sha(code), c.code_hash)) {
      await env.DB.prepare("UPDATE codes SET tries = tries + 1 WHERE id = ?").bind(c.id).run();
      throw fail("wrong code", 400, { code: "code" });
    }
    await env.DB.batch([
      env.DB.prepare("UPDATE codes SET used = 1 WHERE id = ?").bind(c.id),
      env.DB.prepare("UPDATE users SET verified = 1 WHERE id = ?").bind(u.id)
    ]);
    u.verified = 1;
    await promote(env, u);
    return json(await me(env, req, u));
  }

  if (p === "/auth/verify/resend" && M === "POST") {
    const u = await need(req, env);
    if (u.verified) return json({ ok: true });
    await limit(env, `resend:${u.id}`, 5, 3600e3);
    return json({ ok: true, ...(await sendVerify(env, u)) });
  }

  if (p === "/auth/password" && M === "POST") {
    const u = await need(req, env);
    const b = await body(req);
    await limit(env, `pw:${u.id}`, 10, 3600e3);
    if (!(await checkPassword(u, String(b.current || "")))) throw fail("the current password is wrong", 400, { code: "current" });
    const pw = String(b.password || "");
    if (pw.length < 8 || pw.length > 200) throw fail("password: at least 8 characters", 400, { code: "password" });
    const h = await hashPassword(pw);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET pw_hash = ?, salt = ?, iter = ? WHERE id = ?").bind(h.pw_hash, h.salt, h.iter, u.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(u.id, u.token_hash)
    ]);
    return json({ ok: true });
  }

  if (p === "/progress" && M === "GET") {
    const u = await need(req, env);
    const r = await env.DB.prepare("SELECT data, version, updated_at FROM progress WHERE user_id = ?").bind(u.id).first();
    return json(r ? { data: JSON.parse(r.data), version: r.version, updatedAt: r.updated_at } : { data: null, version: 0 });
  }
  if (p === "/progress" && M === "PUT") {
    const u = await need(req, env);
    const b = await body(req);
    if (!b.data || typeof b.data !== "object") throw fail("data missing");
    const version = await saveProgress(env, u.id, b.data);
    return json({ version });
  }

  /* ---- billing (Stripe Checkout + customer portal) ---- */
  if (p === "/billing/checkout" && M === "POST") {
    const u = await need(req, env);
    const b = await body(req);
    const price = b.interval === "year" ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;
    if (!env.STRIPE_SECRET_KEY || !price) throw fail("payments are not set up yet", 503, { code: "billing" });
    const plan = await planOf(env, req, u);
    if (plan.why === "stripe") throw fail("you already have Plus", 409, { code: "has" });
    const access = await getSetting(env, "access", DEFAULT_ACCESS);
    const s = await env.DB.prepare("SELECT * FROM subscriptions WHERE user_id = ?").bind(u.id).first();
    const base = appUrl(env, req);
    const f = {
      mode: "subscription", "line_items[0][price]": price, "line_items[0][quantity]": "1",
      client_reference_id: String(u.id), "subscription_data[metadata][user_id]": String(u.id), "metadata[user_id]": String(u.id),
      success_url: `${base}/?plus=ok`, cancel_url: `${base}/?plus=cancel`, allow_promotion_codes: "true"
    };
    // one free trial per person
    if (!s && access.trialDays > 0) f["subscription_data[trial_period_days]"] = String(access.trialDays);
    if (s && s.customer_id) f.customer = s.customer_id; else f.customer_email = u.email;
    const r = await stripe(env, "/v1/checkout/sessions", f);
    return json({ url: r.url });
  }
  if (p === "/billing/portal" && M === "POST") {
    const u = await need(req, env);
    const s = await env.DB.prepare("SELECT customer_id FROM subscriptions WHERE user_id = ?").bind(u.id).first();
    if (!s || !s.customer_id) throw fail("no subscription", 404);
    const r = await stripe(env, "/v1/billing_portal/sessions", { customer: s.customer_id, return_url: `${appUrl(env, req)}/` });
    return json({ url: r.url });
  }

  /* ---- admin ---- */
  if (p === "/admin/orgs" || p.startsWith("/admin/orgs/")) return adminOrgs(req, env, H, p.slice(11));
  if (p.startsWith("/admin/")) return adminApi(req, env, p.slice(6), url);

  /* ---- schools ---- */
  if (p === "/orgs" && M === "GET") return orgsList(req, env, H);
  let om;
  if ((om = p.match(/^\/org\/([a-z0-9][a-z0-9-]{1,30})(\/.*)?$/))) return orgApi(req, env, H, om[1], om[2] || "", url);

  /* ---- studio (designers and up) ---- */
  if (p.startsWith("/studio/")) {
    const u = await need(req, env, STAFF);
    return studioApi(req, env, p.slice(7), u.email);
  }

  throw fail("not found", 404);
}

async function saveProgress(env, userId, data) {
  delete data["lapp:session"];
  const text = JSON.stringify(data);
  if (text.length > 1_000_000) throw fail("progress is too large", 413);
  const r = await env.DB.prepare("INSERT INTO progress (user_id, data, version, updated_at) VALUES (?1, ?2, 1, ?3) ON CONFLICT(user_id) DO UPDATE SET data = ?2, version = version + 1, updated_at = ?3 RETURNING version")
    .bind(userId, text, now()).first();
  return r.version;
}

// the owner's e-mails (ADMIN_EMAILS) become admins — only once the e-mail is proven
async function promote(env, u) {
  if (u.verified && u.role !== "admin" && admins(env).includes(u.email)) {
    await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(u.id).run();
    u.role = "admin";
  }
}

/* ================= pages for staff ================= */
async function page(req, env, html, roles, path) {
  const u = env.DB ? await currentUser(req, env) : null;
  if (!u) return Response.redirect(`${new URL(req.url).origin}/?login=1&next=${encodeURIComponent(path)}`, 302);
  if (!roles.includes(u.role)) return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain" } });
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'", ...SECURE }
  });
}

/* ================= audio: Plus lessons, and byte ranges ================= */
// Static assets answer a Range request with the whole file, but the player seeks into long
// recordings, so the Worker cuts the requested bytes itself.
async function audio(req, env, path) {
  const slug = path.split("/")[3];
  let locked = false;
  if (env.DB) {
    const access = await getSetting(env, "access", DEFAULT_ACCESS);
    if (access.locked.includes(slug)) {
      const plan = await planOf(env, req, await currentUser(req, env));
      if (plan.tier !== "plus") return json({ error: "this lesson is part of Plus", code: "plus" }, 402);
      locked = true;
    }
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("Range") || "");
  const r = await env.ASSETS.fetch(new Request(req.url, { method: req.method, headers: { "If-None-Match": range ? "" : req.headers.get("If-None-Match") || "" } }));
  const h = new Headers(r.headers);
  h.set("Accept-Ranges", "bytes");
  if (locked) h.set("Cache-Control", "private, no-store");
  if (!range || r.status !== 200) return new Response(r.body, { status: r.status, headers: h });
  const buf = await r.arrayBuffer();
  const size = buf.byteLength;
  let a = range[1] === "" ? size - Number(range[2]) : Number(range[1]);
  let b = range[1] === "" || range[2] === "" ? size - 1 : Math.min(Number(range[2]), size - 1);
  a = Math.max(0, a);
  if (a > b || a >= size) { h.set("Content-Range", `bytes */${size}`); return new Response(null, { status: 416, headers: h }); }
  h.set("Content-Range", `bytes ${a}-${b}/${size}`);
  h.set("Content-Length", String(b - a + 1));
  return new Response(req.method === "HEAD" ? null : buf.slice(a, b + 1), { status: 206, headers: h });
}

/* ================= Stripe ================= */
async function stripe(env, path, form) {
  const r = await fetch("https://api.stripe.com" + path, {
    method: form ? "POST" : "GET",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form) : undefined
  });
  const j = await r.json();
  if (!r.ok) throw fail(`Stripe: ${(j.error && j.error.message) || r.status}`, 502);
  return j;
}
async function stripeWebhook(req, env) {
  const raw = await req.text();
  const sig = req.headers.get("Stripe-Signature") || "";
  const t = (sig.match(/(?:^|,)t=(\d+)/) || [])[1];
  const v1s = [...sig.matchAll(/(?:^|,)v1=([0-9a-f]+)/g)].map(m => m[1]);
  if (!env.STRIPE_WEBHOOK_SECRET || !t || !v1s.length) return json({ error: "bad signature" }, 400);
  if (Math.abs(now() / 1000 - Number(t)) > 300) return json({ error: "too old" }, 400);
  const key = await crypto.subtle.importKey("raw", enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`)))].map(x => x.toString(16).padStart(2, "0")).join("");
  if (!v1s.some(v => same(v, mac))) return json({ error: "bad signature" }, 400);

  const ev = JSON.parse(raw);
  const o = ev.data && ev.data.object;
  if (ev.type === "checkout.session.completed" && o.mode === "subscription") {
    const uid = Number(o.client_reference_id || (o.metadata && o.metadata.user_id));
    if (uid) {
      await upsertSub(env, uid, { customer_id: o.customer, sub_id: o.subscription });
      if (o.subscription && env.STRIPE_SECRET_KEY) await syncSub(env, uid, await stripe(env, `/v1/subscriptions/${o.subscription}`));
    }
  } else if (ev.type && ev.type.startsWith("customer.subscription.")) {
    let uid = Number(o.metadata && o.metadata.user_id);
    if (!uid) { const r = await env.DB.prepare("SELECT user_id FROM subscriptions WHERE customer_id = ?").bind(o.customer).first(); uid = r && r.user_id; }
    if (uid) await syncSub(env, uid, o);
  }
  return json({ received: true });
}
async function upsertSub(env, uid, f) {
  await env.DB.prepare(`INSERT INTO subscriptions (user_id, customer_id, sub_id, updated_at) VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(user_id) DO UPDATE SET customer_id = COALESCE(NULLIF(?2, ''), customer_id), sub_id = COALESCE(NULLIF(?3, ''), sub_id), updated_at = ?4`)
    .bind(uid, f.customer_id || "", f.sub_id || "", now()).run();
}
async function syncSub(env, uid, s) {
  const item = s.items && s.items.data && s.items.data[0];
  const end = s.current_period_end || (item && item.current_period_end) || 0;
  const interval = (item && item.price && item.price.recurring && item.price.recurring.interval) || "";
  await upsertSub(env, uid, { customer_id: s.customer, sub_id: s.id });
  await env.DB.prepare("UPDATE subscriptions SET status = ?, interval = ?, period_end = ?, cancel_at_end = ?, updated_at = ? WHERE user_id = ?")
    .bind(s.status || "", interval, end * 1000, s.cancel_at_period_end ? 1 : 0, now(), uid).run();
}

/* ================= admin API ================= */
async function adminApi(req, env, p, url) {
  const M = req.method;
  const me = await need(req, env, ["manager", "admin"]);
  let m;

  if (p === "/stats" && M === "GET") {
    const t = now();
    const q = (sql, ...v) => env.DB.prepare(sql).bind(...v).first();
    const [all, verified, week, active, plus, trial, grants, staff] = await Promise.all([
      q("SELECT COUNT(*) n FROM users"),
      q("SELECT COUNT(*) n FROM users WHERE verified = 1"),
      q("SELECT COUNT(*) n FROM users WHERE created_at > ?", t - 7 * DAY),
      q("SELECT COUNT(*) n FROM users WHERE last_seen > ?", t - 7 * DAY),
      q("SELECT COUNT(*) n FROM subscriptions WHERE status = 'active'"),
      q("SELECT COUNT(*) n FROM subscriptions WHERE status = 'trialing'"),
      q("SELECT COUNT(*) n FROM users WHERE plus_until > ?", t),
      q("SELECT COUNT(*) n FROM users WHERE role != 'user'")
    ]);
    const iran = await q("SELECT COUNT(*) n FROM users WHERE country = 'IR'");
    const countries = (await env.DB.prepare("SELECT country, COUNT(*) n FROM users GROUP BY country ORDER BY n DESC LIMIT 8").all()).results;
    const days = (await env.DB.prepare("SELECT (created_at / 86400000) d, COUNT(*) n FROM users WHERE created_at > ? GROUP BY d ORDER BY d").bind(t - 30 * DAY).all()).results;
    const recent = (await env.DB.prepare("SELECT id, username, email, country, created_at FROM users ORDER BY id DESC LIMIT 6").all()).results;
    return json({ users: all.n, verified: verified.n, newWeek: week.n, activeWeek: active.n, plus: plus.n, trial: trial.n, grants: grants.n, staff: staff.n, iran: iran.n, countries, days, recent });
  }

  if (p === "/users" && M === "GET") {
    const q = `%${(url.searchParams.get("q") || "").trim().toLowerCase()}%`;
    const f = url.searchParams.get("filter") || "all";
    const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
    const where = {
      all: "1", plus: "(s.status IN ('active','trialing') OR u.plus_until > ?2)", free: "(COALESCE(s.status,'') NOT IN ('active','trialing') AND u.plus_until <= ?2 AND u.role = 'user')",
      staff: "u.role != 'user'", disabled: "u.disabled = 1", unverified: "u.verified = 0", iran: "u.country = 'IR'"
    }[f] || "1";
    const rows = (await env.DB.prepare(`SELECT u.id, u.email, u.username, u.name, u.role, u.verified, u.disabled, u.plus_until, u.country, u.created_at, u.last_seen,
        s.status sub_status, s.interval sub_interval, s.period_end
      FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
      WHERE (u.email LIKE ?1 OR u.username LIKE ?1 OR LOWER(u.name) LIKE ?1) AND ${where}
      ORDER BY u.id DESC LIMIT 51 OFFSET ?3`).bind(q, now(), page * 50).all()).results;
    return json({ users: rows.slice(0, 50), more: rows.length > 50 });
  }

  if ((m = p.match(/^\/users\/(\d+)$/)) && M === "PATCH") {
    const id = Number(m[1]);
    const b = await body(req);
    const target = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!target) throw fail("no such user", 404);
    // managers look after learners; only admins change roles or touch staff accounts
    if (me.role !== "admin" && (target.role !== "user" || (b.role !== undefined && b.role !== target.role))) throw fail("only an admin can do this", 403);
    if (id === me.id && ((b.role !== undefined && b.role !== target.role) || b.disabled)) throw fail("you can't change your own role or disable yourself", 400);
    const sets = [], vals = [];
    if (b.name !== undefined) { sets.push("name = ?"); vals.push(String(b.name).trim().slice(0, 40)); }
    if (b.username !== undefined && cleanUser(b.username) !== target.username) {
      const un = cleanUser(b.username);
      if (!USERNAME.test(un) || RESERVED.has(un)) throw fail("username: 3–20 letters, digits, _ or .");
      if (await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(un).first()) throw fail("this username is taken", 409);
      sets.push("username = ?"); vals.push(un);
    }
    if (b.email !== undefined && cleanEmail(b.email) !== target.email) {
      const e = cleanEmail(b.email);
      if (!EMAIL.test(e)) throw fail("enter a valid e-mail");
      if (await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(e).first()) throw fail("this e-mail already has an account", 409);
      // a new address has to be proven again
      sets.push("email = ?", "verified = 0"); vals.push(e);
    }
    if (b.role !== undefined && b.role !== target.role) { if (!ROLES.includes(b.role)) throw fail("bad role"); sets.push("role = ?"); vals.push(b.role); }
    if (b.disabled !== undefined) { sets.push("disabled = ?"); vals.push(b.disabled ? 1 : 0); }
    if (b.plusDays !== undefined) { const d = Math.max(0, Math.min(3650, Number(b.plusDays) || 0)); sets.push("plus_until = ?"); vals.push(d ? now() + d * DAY : 0); }
    if (b.verified !== undefined) { sets.push("verified = ?"); vals.push(b.verified ? 1 : 0); }
    if (!sets.length) throw fail("nothing to change");
    const stmts = [env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id)];
    if (b.disabled) stmts.push(env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id));
    await env.DB.batch(stmts);
    return json({ ok: true });
  }

  // add someone by hand: they get an invitation link and choose their own password
  if (p === "/users" && M === "POST") {
    const b = await body(req);
    const e = cleanEmail(b.email), un = cleanUser(b.username), role = b.role || "user";
    if (!EMAIL.test(e)) throw fail("enter a valid e-mail");
    if (!USERNAME.test(un) || RESERVED.has(un)) throw fail("username: 3–20 letters, digits, _ or .");
    if (!ROLES.includes(role)) throw fail("bad role");
    if (role !== "user" && me.role !== "admin") throw fail("only an admin can add team members", 403);
    const taken = await env.DB.prepare("SELECT email = ? AS mail FROM users WHERE email = ? OR username = ?").bind(e, e, un).first();
    if (taken) throw fail(taken.mail ? "this e-mail already has an account" : "this username is taken", 409);
    const h = await hashPassword(b64url(rand(24)));        // nobody knows it; the invite sets the real one
    const t = now();
    const u = await env.DB.prepare("INSERT INTO users (email, username, name, pw_hash, salt, iter, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(e, un, String(b.name || "").trim().slice(0, 40), h.pw_hash, h.salt, h.iter, role, t).first();
    let sent = false, dev = {};
    if (b.invite !== false) {
      const token = await newCode(env, u, "reset", 7 * DAY);
      const link = `${appUrl(env, req)}/?reset=${token}`;
      sent = await sendMail(env, e, T.invite(link, me.name || me.username));
      if (env.DEV === "1") dev = { devToken: token };
    }
    return json({ ok: true, id: u.id, sent, ...dev });
  }

  if ((m = p.match(/^\/users\/(\d+)$/)) && M === "DELETE") {
    const id = Number(m[1]);
    if (me.role !== "admin") throw fail("only an admin can delete accounts", 403);
    if (id === me.id) throw fail("you can't delete yourself");
    const s = await env.DB.prepare("SELECT status FROM subscriptions WHERE user_id = ?").bind(id).first();
    if (s && ["active", "trialing", "past_due"].includes(s.status)) throw fail("this user has a running subscription — cancel it in Stripe first", 409);
    await env.DB.batch(["sessions", "codes", "progress", "subscriptions"].map(t => env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(id))
      .concat(env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id)));
    return json({ ok: true });
  }

  if ((m = p.match(/^\/users\/(\d+)\/progress$/)) && M === "DELETE") {
    const id = Number(m[1]);
    const u = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(id).first();
    if (!u) throw fail("no such user", 404);
    if (me.role !== "admin" && u.role !== "user") throw fail("only an admin can do this", 403);
    // an empty, newer version: their devices clear it on the next start instead of uploading it again
    await env.DB.prepare("UPDATE progress SET data = '{}', version = version + 1, updated_at = ? WHERE user_id = ?").bind(now(), id).run();
    return json({ ok: true });
  }

  if ((m = p.match(/^\/users\/(\d+)\/reset$/)) && M === "POST") {
    const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(Number(m[1])).first();
    if (!u) throw fail("no such user", 404);
    if (me.role !== "admin" && u.role !== "user") throw fail("only an admin can do this", 403);
    const token = await newCode(env, u, "reset");
    const sent = await sendMail(env, u.email, T.reset(`${appUrl(env, req)}/?reset=${token}`));
    return json({ ok: true, sent });
  }

  if (p === "/customers" && M === "GET") {
    const rows = (await env.DB.prepare(`SELECT u.id, u.email, u.username, u.country, s.status, s.interval, s.period_end, s.cancel_at_end, s.customer_id, s.updated_at
      FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.status != '' ORDER BY s.updated_at DESC LIMIT 200`).all()).results;
    const grants = (await env.DB.prepare("SELECT id, email, username, plus_until FROM users WHERE plus_until > ? ORDER BY plus_until DESC LIMIT 200").bind(now()).all()).results;
    return json({ subscriptions: rows, grants, stripe: !!env.STRIPE_SECRET_KEY });
  }

  if (p === "/settings" && M === "GET") return json({ access: await getSetting(env, "access", DEFAULT_ACCESS) });
  if (p === "/settings" && M === "PUT") {
    if (me.role !== "admin") throw fail("only an admin can do this", 403);
    const a = (await body(req)).access || {};
    const clean = {
      locked: Array.isArray(a.locked) ? a.locked.filter(x => /^[a-z0-9-]{1,80}$/.test(x)).slice(0, 500) : [],
      iranFree: !!a.iranFree,
      trialDays: Math.max(0, Math.min(30, Number(a.trialDays) || 0))
    };
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('access', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1").bind(JSON.stringify(clean)).run();
    return json({ access: clean });
  }

  throw fail("not found", 404);
}
