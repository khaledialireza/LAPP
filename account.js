// Accounts: one e-mail-first form for sign-in and sign-up, verification code, password reset,
// the plan (free · Plus), progress sync and the paywall for Plus lessons.
//
// Talks to the Worker's /api (worker/src/index.js). When there is no API (a static host, or
// offline) only guest entry is offered and every lesson stays open, exactly as before.
// Guests keep everything in this browser; on sign-up their progress moves into the account.
(() => {
  const API = "/api";
  const SKIP = /^lapp:(session|sync|cfg)$/;           // never synced
  const { $, esc } = K;
  const t = (k, v) => window.I18N ? I18N.t(k, v) : k;
  const ls = { get: K.LS.raw, keys: K.LS.keys };
  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const jget = K.LS.get;
  // written with the browser's own setter, so our own bookkeeping never counts as "progress changed"
  const jset = (k, v) => { try { rawSet.call(localStorage, k, JSON.stringify(v)); } catch {} };

  let cfg = null;          // /api/config, or null when there is no API
  let plan = { tier: "free", why: "" };
  const changes = K.events(), emit = () => changes.emit("change");

  // the server: the shared kit's api; a signed-out person stays here as a guest
  const call = K.apiAt(API, { signin: false, keepalive: true });
  const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

  /* ---------- the session in this browser ---------- */
  function setUser(u, p, o) {
    if (p) plan = p;
    if (o) orgs = o;
    if (!u) return;
    // the account's language is the person's language everywhere; a new account takes this device's
    if (u.lang && u.lang !== I18N.lang) { if (I18N.langs.includes(u.lang)) I18N.setLang(u.lang); else try { localStorage.setItem("lapp:lang", u.lang); } catch {} }
    else if (!u.lang) call("PATCH", "/me", { lang: I18N.lang }).catch(() => {});
    const s = Auth.session || {};
    Auth.setSession({ type: "account", id: u.id, email: u.email, username: u.username, name: u.name, role: u.role, verified: u.verified, since: u.since || s.since });
    if (!jget("lapp:name", "")) rawSet.call(localStorage, "lapp:name", JSON.stringify(u.name || u.username));
  }
  const isAccount = () => (Auth.session || {}).type === "account";
  // after sign-in, go back to the staff pages or a school portal that sent the person here
  const okNext = n => !!n && (/^\/manage\/?$/.test(n) || (/^\/admin\/?$/.test(n) && isStaff()) || /^\/studio\/?(\?org=[a-z0-9][a-z0-9-]{1,30})?$/.test(n) || /^\/s\/[a-z0-9][a-z0-9-]{1,30}\/?$/.test(n));
  let orgs = [];
  const isStaff = () => ["designer", "manager", "admin"].includes((Auth.session || {}).role);

  /* ---------- progress: every lapp:* key, as one object ---------- */
  function snapshot() {
    const o = {};
    for (const k of ls.keys()) if (k.startsWith("lapp:") && !SKIP.test(k)) o[k] = ls.get(k);
    return o;
  }
  function applyData(data) {
    for (const k of ls.keys()) if (k.startsWith("lapp:") && !SKIP.test(k) && k !== "lapp:lang" && !(k in data)) rawRemove.call(localStorage, k);
    for (const [k, v] of Object.entries(data)) if (k.startsWith("lapp:") && !SKIP.test(k) && typeof v === "string") rawSet.call(localStorage, k, v);
  }
  const sync = () => jget("lapp:sync", { v: 0, dirty: false, at: 0 });
  const setSync = o => { jset("lapp:sync", { ...sync(), ...o }); emit(); };
  let pushT = 0, pushing = false;
  function markDirty() {
    if (!isAccount() || !cfg) return;
    const s = sync(); if (!s.dirty) jset("lapp:sync", { ...s, dirty: true });
    clearTimeout(pushT); pushT = setTimeout(push, 4000);
  }
  async function push() {
    clearTimeout(pushT);
    if (!isAccount() || !cfg || pushing || !sync().dirty) return;
    pushing = true;
    try {
      const { version } = await call("PUT", "/progress", { data: snapshot() });
      setSync({ v: version, dirty: false, at: Date.now() });
    } catch (e) { if (e.status === 401) expired(); }
    finally { pushing = false; }
  }
  async function pull() {
    const r = await call("GET", "/progress");
    if (r.data) { applyData(r.data); setSync({ v: r.version, dirty: false, at: Date.now() }); }
    else { setSync({ v: 0, dirty: true }); await push(); }
  }
  // every write of a lapp:* key marks the account's progress for upload
  Storage.prototype.setItem = function (k, v) { rawSet.call(this, k, v); if (this === localStorage && k.startsWith("lapp:") && !SKIP.test(k)) markDirty(); };
  Storage.prototype.removeItem = function (k) { rawRemove.call(this, k); if (this === localStorage && k.startsWith("lapp:") && !SKIP.test(k)) markDirty(); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") push(); });

  function expired() {
    // the cookie is gone (signed out elsewhere, password reset, disabled): back to the start
    wipe(); Auth.signOut(); toast(t("acSessionOver"));
  }
  function wipe() { for (const k of ls.keys()) if (k.startsWith("lapp:") && !/^lapp:(lang|cfg)$/.test(k)) rawRemove.call(localStorage, k); }

  /* ---------- boot: is there an API, who is signed in, is the server's progress newer ---------- */
  const ready = (async () => {
    try {
      cfg = await timeout(fetch(API + "/config", { credentials: "same-origin" }).then(r => r.ok && /json/.test(r.headers.get("Content-Type") || "") ? r.json() : null), 4000);
    } catch { cfg = null; }
    if (!cfg) { cfg = null; return; }
    jset("lapp:cfg", { access: cfg.access, at: Date.now() });
    try {
      const m = await call("GET", "/me");
      plan = m.plan || plan;
      if (m.user) {
        setUser(m.user, m.plan, m.orgs);
        const s = sync();
        if (s.dirty) await push(); else await pull();
      } else if (isAccount()) { wipe(); Auth.signOut(); }
    } catch (e) { console.warn("account", e); }
  })();

  window.addEventListener("lapp:lang", e => { if (isAccount()) call("PATCH", "/me", { lang: e.detail }).catch(() => {}); });

  /* ---------- Plus ---------- */
  const isPlus = () => plan.tier === "plus";
  const lockedSlugs = () => (cfg && cfg.access && cfg.access.locked) || [];
  const isLocked = L => !!L && lockedSlugs().includes(L.dir);
  const canOpen = L => !isLocked(L) || isPlus();
  const billing = () => !!(cfg && cfg.billing);

  /* ---------- small UI helpers ---------- */
  const toast = msg => K.toast(msg, { plain: true, kind: "info", ms: 3200 });
  const strength = pw => { let s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; return pw.length < 8 ? Math.min(1, s) : Math.min(4, s); };
  const initial = n => (n || "?").trim().charAt(0).toUpperCase();
  const errText = e => ({
    email: t("acErrEmail"), password: t("acErrPassword"), wrong: t("acErrWrong"), nouser: t("acErrNoUser"), username: t("acErrUsername"), taken: t("acErrTaken"), exists: t("acErrExists"),
    rate: t("acErrRate"), code: t("acErrCode"), expired: t("acErrExpired"), disabled: t("acErrDisabled"), current: t("acErrCurrent"), billing: t("acErrBilling")
  })[e.code] || (e.status ? e.message : t("acErrNet"));
  const localWords = () => (jget("lapp:known", []) || []).length;
  const localDays = () => Object.keys(jget("lapp:daily", {}) || {}).length;

  /* ---------- the sign-in card: email → password (known) or sign-up (new) → code ---------- */
  const W = { step: "email", email: "", name: "", closable: false, token: "", busy: false };
  const pwField = (id, ac) => `<div class="ac-pw"><input class="ac-in" id="${id}" type="password" autocomplete="${ac}" minlength="8" maxlength="200" required><button type="button" class="ac-eye" data-eye="${id}" aria-label="${esc(t("acShow"))}">👁</button></div>`;
  const back = () => `<button type="button" class="ac-back" data-ac="back">‹ ${esc(t("acBack"))}</button>`;
  const mailChip = () => `<button type="button" class="ac-mail" data-ac="back"><bdi>${esc(W.email)}</bdi> <span>✎</span></button>`;
  const err = `<div class="ac-err" id="acErr" role="alert" hidden></div>`;
  const steps = n => `<div class="ac-steps"><i class="on"></i><i class="${n > 1 ? "on" : ""}"></i></div>`;

  function brand() {
    const s = W.step, b = $("#wbText");
    const words = localWords(), days = localDays();
    const map = {
      email: [t("wcTitle"), t("wcSub")],
      password: [t("acWelcomeBack"), t("acWelcomeBackSub")],
      signup: [t("acNewTitle"), t("acNewSub")],
      verify: [t("acVerifyT"), t("acVerifyBrand")],
      forgot: [t("acForgotT"), t("acForgotSub")], sent: [t("acForgotT"), t("acForgotSub")], reset: [t("acResetT"), t("acResetSub")]
    }[s] || [t("wcTitle"), t("wcSub")];
    b.innerHTML = `<h1>${esc(map[0])}</h1><p>${esc(map[1])}</p>`;
    $("#wbBubs").innerHTML = s === "signup" && words
      ? `<div class="wb-bub"><small>${esc(t("acMoveBrand"))}</small><b dir="ltr">${words} Wörter · ${days} ${days === 1 ? "Tag" : "Tage"} 🔥</b></div>`
      : [["Deutsch", "Ich habe ein Zimmer reserviert."], ["Nederlands", "Ik heb een kamer gereserveerd."], ["Polski", "Mam zarezerwowany pokój."]]
        .map(([k, x], i) => `<div class="wb-bub${i % 2 ? " r" : ""}"><small>${k}</small><b dir="ltr">${x}</b>${i === 2 ? `<span>${esc(t("wbLine2"))}</span>` : ""}</div>`).join("");
    $("#wbFeats").innerHTML = [t("wbF1"), t("wbF2"), t("wbF3")].map(x => `<span>${esc(x)}</span>`).join("");
    $("#wbLangs").innerHTML = I18N.langs.map(l => `<button type="button" data-wl="${l}" class="${l === I18N.lang ? "on" : ""}">${esc(I18N.name(l))}</button>`).join("");
  }

  function render() {
    const box = $("#wcBox"); if (!box) return;
    $("#welcome").dir = I18N.info().dir;
    const api = !!cfg, s = W.step;
    let h = W.closable ? `<button type="button" class="ac-x" data-ac="close" aria-label="${esc(t("close"))}">✕</button>` : "";
    if (s === "email") {
      // phone: logo, e-mail, one button, a quiet guest link, languages as links at the bottom
      // (the title, hints and divider show only beside the brand panel on wide screens)
      h += `<div class="wc-mob"><div class="wc-logo">L</div></div>`;
      if (api) h += `<div class="ac-dt">${steps(1)}<h3 class="ac-h">${esc(t(W.closable ? "acSaveT" : "acStartT"))}</h3><p class="ac-mu">${esc(t("acStartSub"))}</p></div>
        <form class="ac-form" data-form="email" novalidate><label class="ac-l ac-dt" for="acEmail">${esc(t("acEmailOrUser"))}</label>
        <input class="ac-in" id="acEmail" type="text" dir="ltr" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" required value="${esc(W.email)}" placeholder="${esc(t("acEmailOrUser"))}" aria-label="${esc(t("acEmailOrUser"))}">${err}
        <button class="wc-go" type="submit">${esc(t("acContinue"))}</button></form>`;
      if (!W.closable) {
        if (api) h += `<div class="ac-or ac-dt">${esc(t("acOr"))}</div><button type="button" class="wc-go ac-ghost" id="wcGuest">${esc(t("wcNoLogin"))}</button>`;
        else h += `<input class="wc-name" id="wcName" maxlength="30" autocomplete="given-name" placeholder="${esc(t("wcName"))}" aria-label="${esc(t("wcName"))}" value="${esc(jget("lapp:name", ""))}"><button type="button" class="wc-go" id="wcGuest">${esc(t("wcGuest"))}</button>`;
        h += `<p class="wc-note ac-dt">${esc(t("wcNote"))}</p>`;
      }
      h += `<nav class="wc-ll">${I18N.langs.map(l => `<button type="button" data-wl="${l}" class="${l === I18N.lang ? "on" : ""}">${esc(I18N.name(l))}</button>`).join("")}</nav>`;
    } else if (s === "password") {
      h += `${steps(2)}${back()}<div class="ac-av">${esc(initial(W.name || W.email))}</div><h3 class="ac-h">${esc(t("acHi", { n: W.name || W.email.split("@")[0] }))}</h3>${mailChip()}
        <form class="ac-form" data-form="login" novalidate><input type="email" autocomplete="username" value="${esc(W.email)}" hidden>
        <label class="ac-l" for="acPw">${esc(t("acPassword"))}</label>${pwField("acPw", "current-password")}${err}
        <button class="wc-go" type="submit">${esc(t("acSignIn"))}</button></form>
        ${W.noEmail ? `<p class="wc-note">${esc(t("acAskSchool"))}</p>` : `<button type="button" class="ac-link" data-ac="forgot">${esc(t("acForgot"))}</button><p class="wc-note">${esc(t("acStaffNote"))}</p>`}`;
    } else if (s === "signup") {
      const words = localWords();
      h += `${steps(2)}${back()}<h3 class="ac-h">${esc(t("acNewH"))}</h3>${mailChip()}
        <form class="ac-form" data-form="signup" novalidate><input type="email" autocomplete="username" value="${esc(W.email)}" hidden>
        <label class="ac-l" for="acUser">${esc(t("acUsername"))}</label>
        <div class="ac-uwrap"><input class="ac-in" id="acUser" autocomplete="nickname" autocapitalize="off" spellcheck="false" maxlength="20" required dir="ltr"><small id="acUserOk"></small></div>
        <label class="ac-l" for="acPw">${esc(t("acPassword"))}</label>${pwField("acPw", "new-password")}
        <div class="ac-meter"><i id="acMeter"></i></div><div class="ac-hint" id="acPwHint">${esc(t("acPwHint"))}</div>
        ${words ? `<div class="ac-move">📦 <span>${esc(t("acMove", { n: words, d: localDays() }))}</span></div>` : ""}${err}
        <button class="wc-go" type="submit">${esc(t("acCreate"))}</button></form><p class="wc-note">${esc(t("acCodeNote"))}</p>`;
    } else if (s === "verify") {
      h += `<div class="ac-big">✉️</div><h3 class="ac-h c">${esc(t("acVerifyT"))}</h3><p class="ac-mu c">${esc(t("acVerifySub", { e: "" }))} <bdi>${esc(W.email)}</bdi></p>
        <form class="ac-form" data-form="verify" novalidate><input class="ac-in ac-code" id="acCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" dir="ltr" required placeholder="••••••">${err}
        <button class="wc-go" type="submit">${esc(t("acVerify"))}</button></form>
        <button type="button" class="ac-link" data-ac="resend" id="acResend">${esc(t("acResend"))}</button><button type="button" class="ac-link mu" data-ac="later">${esc(t("acLater"))}</button>`;
    } else if (s === "forgot") {
      h += `${back()}<h3 class="ac-h">${esc(t("acForgotT"))}</h3><p class="ac-mu">${esc(t("acForgotP"))}</p>${mailChip()}
        <form class="ac-form" data-form="forgot" novalidate>${err}<button class="wc-go" type="submit">${esc(t("acSendLink"))}</button></form>`;
    } else if (s === "sent") {
      h += `<div class="ac-big">📬</div><h3 class="ac-h c">${esc(t("acSentT"))}</h3><p class="ac-mu c">${esc(t("acSentP"))} <bdi>${esc(W.email)}</bdi></p>
        <button type="button" class="wc-go ac-ghost" data-ac="back">${esc(t("acBackSignIn"))}</button>`;
    } else if (s === "reset") {
      h += `<h3 class="ac-h">${esc(t("acResetT"))}</h3><p class="ac-mu">${esc(t("acResetSub"))}</p>
        <form class="ac-form" data-form="reset" novalidate><label class="ac-l" for="acPw">${esc(t("acNewPw"))}</label>${pwField("acPw", "new-password")}
        <div class="ac-meter"><i id="acMeter"></i></div><div class="ac-hint" id="acPwHint">${esc(t("acPwHint"))}</div>${err}
        <button class="wc-go" type="submit">${esc(t("acSave"))}</button></form>`;
    }
    box.innerHTML = h;
    box.dataset.step = s;
    brand();
    const f = box.querySelector("input:not([hidden])");
    if (f && matchMedia("(pointer:fine)").matches) setTimeout(() => f.focus(), 30);
  }
  function showErr(e) { const el = $("#acErr"); if (!el) return toast(errText(e)); el.textContent = errText(e); el.hidden = false; }
  function busy(form, on) { W.busy = on; const b = form && form.querySelector("[type=submit]"); if (b) { b.disabled = on; b.classList.toggle("busy", on); } }
  function go(step) { W.step = step; render(); }

  function open(step = "email", { closable = true } = {}) {
    W.closable = closable; W.step = step;
    $("#welcome").hidden = false;
    document.body.classList.add("ac-open");
    render();
  }
  function close() { $("#welcome").hidden = true; document.body.classList.remove("ac-open"); }

  async function afterSignIn(m, fresh) {
    setUser(m.user, m.plan, m.orgs);
    if (fresh) setSync({ v: 1, dirty: false, at: Date.now() });
    else { try { await pull(); } catch {} }
    const next = new URLSearchParams(location.search).get("next");
    if (okNext(next)) { location.href = next; return; }
    // staff go to their own workspace, not the learning app
    const role = m.user.role, work = (m.orgs || []).find(o => o.role !== "student");
    // everyone who isn't only a learner works in the one management environment
    if (["admin", "manager", "designer"].includes(role) || work) { location.href = "/manage"; return; }
    if (m.user.managed && m.orgs && m.orgs.length) { location.href = `/s/${m.orgs[0].slug}`; return; }
    if (!m.user.verified) { go("verify"); return; }
    finish(fresh);
  }
  function finish(fresh) {
    close();
    const u = Auth.session || {};
    toast(fresh ? t("acWelcomeNew") : t("acWelcomeIn", { n: u.name || u.username }));
    // the app reads its progress once at start, so a pulled account starts it afresh
    if (!fresh) setTimeout(() => location.replace(location.pathname), 400);
    else emit();
  }

  document.addEventListener("submit", async e => {
    const form = e.target.closest("form[data-form]"); if (!form) return;
    e.preventDefault(); if (W.busy) return;
    const kind = form.dataset.form;
    const err = $("#acErr"); if (err) err.hidden = true;
    busy(form, true);
    try {
      if (kind === "email") {
        const id = $("#acEmail").value.trim().toLowerCase().replace(/^@/, "");
        // a username (accounts a school made) signs in; only an e-mail can start a new account
        if (!id.includes("@")) {
          if (!/^[a-z0-9_.]{3,20}$/.test(id)) throw { code: "nouser" };
          const r = await call("POST", "/auth/check", { username: id });
          W.email = id; W.name = r.name || ""; W.noEmail = !r.email;
          go("password"); return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id)) throw { code: "email" };
        const r = await call("POST", "/auth/check", { email: id });
        W.email = id; W.name = r.name || ""; W.noEmail = false;
        go(r.exists ? "password" : "signup"); return;
      }
      if (kind === "login") {
        const m = await call("POST", "/auth/login", { email: W.email, password: $("#acPw").value });
        await afterSignIn(m, false); return;
      }
      if (kind === "signup") {
        const username = $("#acUser").value.trim().toLowerCase(), password = $("#acPw").value;
        if (!/^[a-z0-9_.]{3,20}$/.test(username)) throw { code: "username" };
        if (password.length < 8) throw { code: "password" };
        const name = (jget("lapp:name", "") || "").slice(0, 40);
        const m = await call("POST", "/auth/signup", { email: W.email, username, password, name, progress: snapshot() });
        if (m.devCode) console.info("[dev] verification code", m.devCode);
        await afterSignIn(m, true); return;
      }
      if (kind === "verify") {
        const m = await call("POST", "/auth/verify", { code: $("#acCode").value.trim() });
        setUser(m.user, m.plan, m.orgs);
        const nx = new URLSearchParams(location.search).get("next");
        if (okNext(nx)) { location.href = nx; return; }
        finish(true); return;
      }
      if (kind === "forgot") {
        const r = await call("POST", "/auth/forgot", { email: W.email });
        if (r.devToken) console.info("[dev] reset link", `/?reset=${r.devToken}`);
        go("sent"); return;
      }
      if (kind === "reset") {
        const password = $("#acPw").value;
        if (password.length < 8) throw { code: "password" };
        const m = await call("POST", "/auth/reset", { token: W.token, password });
        const nx = new URLSearchParams(location.search).get("next");
        history.replaceState(null, "", location.pathname + (okNext(nx) ? `?next=${encodeURIComponent(nx)}` : ""));
        W.email = m.user.email;
        await afterSignIn(m, false); return;
      }
    } catch (x) { showErr(x); }
    finally { busy(form, false); }
  });

  let resendAt = 0;
  document.addEventListener("click", async e => {
    const eye = e.target.closest("[data-eye]");
    if (eye) { const i = document.getElementById(eye.dataset.eye); i.type = i.type === "password" ? "text" : "password"; return; }
    const wl = e.target.closest("#welcome [data-wl]");
    if (wl) { await I18N.setLang(wl.dataset.wl); render(); return; }
    if (e.target.closest("#wcGuest")) { const n = ($("#wcName") || {}).value; if (n && n.trim()) localStorage.setItem("lapp:name", JSON.stringify(n.trim())); Auth.signInGuest((n || "").trim()); close(); return; }
    const a = e.target.closest("[data-ac]"); if (!a) return;
    const k = a.dataset.ac;
    if (k === "back") go("email");
    else if (k === "close") close();
    else if (k === "forgot") go("forgot");
    else if (k === "later") finish(true);
    else if (k === "resend") {
      if (Date.now() < resendAt) return;
      try { const r = await call("POST", "/auth/verify/resend"); if (r.devCode) console.info("[dev] verification code", r.devCode); toast(t("acResent")); resendAt = Date.now() + 45e3; }
      catch (x) { showErr(x); }
    }
  });

  // live hints while typing: username free?, password strength
  let unameT = 0;
  document.addEventListener("input", e => {
    if (e.target.id === "acUser") {
      const v = e.target.value.trim().toLowerCase(), ok = $("#acUserOk");
      clearTimeout(unameT); ok.textContent = ""; ok.className = "";
      if (!v) return;
      if (!/^[a-z0-9_.]{3,20}$/.test(v)) { ok.textContent = t("acUserFormat"); ok.className = "bad"; return; }
      unameT = setTimeout(async () => {
        try { const r = await call("GET", "/username?u=" + encodeURIComponent(v)); if (e.target.value.trim().toLowerCase() !== v) return; ok.textContent = r.ok ? t("acUserFree") : t("acUserTaken"); ok.className = r.ok ? "good" : "bad"; } catch {}
      }, 350);
    }
    if (e.target.id === "acPw" && $("#acMeter")) {
      const s = strength(e.target.value);
      $("#acMeter").style.width = (s / 4 * 100) + "%";
      $("#acMeter").dataset.s = s;
      $("#acPwHint").textContent = e.target.value.length < 8 ? t("acPwHint") : t(["acPw1", "acPw1", "acPw2", "acPw3", "acPw4"][s]);
    }
    if (e.target.id === "acCode") { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); if (e.target.value.length === 6) e.target.form.requestSubmit(); }
  });

  /* ---------- sheets: plans, password, verify banner ---------- */
  const sheet = (html, cls = "") => K.sheet(html, { cls, dir: I18N.info().dir, close: t("close") });
  function plans(reason) {
    if (!cfg) return;
    if (!isAccount()) { open("email"); toast(t("acPlusNeedsAccount")); return; }
    const P = cfg.prices || {};
    let sel = "year";
    const el = sheet(`<div class="pl-top"><div class="pl-badge">LAPP Plus ✨</div><h3>${esc(reason || t("plTitle"))}</h3><p class="ac-mu">${esc(t("plSub"))}</p></div>
      <div class="pl-feat">${["plF1", "plF2", "plF3", "plF4"].map(k => `<span>${esc(t(k))}</span>`).join("")}</div>
      <button type="button" class="pl-opt on" data-iv="year">${P.save ? `<span class="pl-tag">${esc(t("plSave", { n: P.save }))}</span>` : ""}<b>${esc(t("plYearly"))}</b><span class="pl-pr" dir="ltr">${esc(P.year || "")}<small> / ${esc(t("plYear"))}</small></span></button>
      <button type="button" class="pl-opt" data-iv="month"><b>${esc(t("plMonthly"))}</b><span class="pl-pr" dir="ltr">${esc(P.month || "")}<small> / ${esc(t("plMonth"))}</small></span></button>
      <div class="ac-err" id="plErr" hidden></div>
      <button type="button" class="wc-go" id="plGo">${esc(cfg.access && cfg.access.trialDays && !plan.status ? t("plTrial", { n: cfg.access.trialDays }) : t("plBuy"))}</button>
      <p class="wc-note">${esc(t("plNote"))}</p>`, "pl");
    el.querySelectorAll("[data-iv]").forEach(b => b.onclick = () => { sel = b.dataset.iv; el.querySelectorAll("[data-iv]").forEach(x => x.classList.toggle("on", x === b)); });
    el.querySelector("#plGo").onclick = async ev => {
      ev.target.disabled = true;
      try { const r = await call("POST", "/billing/checkout", { interval: sel }); location.href = r.url; }
      catch (x) { const e2 = el.querySelector("#plErr"); e2.textContent = errText(x); e2.hidden = false; ev.target.disabled = false; }
    };
  }
  function paywall(L) {
    if (!billing() && !cfg) return;
    plans(t("plLocked", { t: L ? L.title : "" }));
  }
  function passwordSheet() {
    const el = sheet(`<h3 class="ac-h">${esc(t("acChangePw"))}</h3><form class="ac-form" id="pwForm"><input type="email" autocomplete="username" value="${esc((Auth.session || {}).email || "")}" hidden>
      <label class="ac-l" for="pwCur">${esc(t("acCurrentPw"))}</label>${pwField("pwCur", "current-password")}
      <label class="ac-l" for="pwNew">${esc(t("acNewPw"))}</label>${pwField("pwNew", "new-password")}
      <div class="ac-err" id="pwErr" hidden></div><button class="wc-go" type="submit">${esc(t("acSave"))}</button></form>`);
    el.querySelector("#pwForm").onsubmit = async ev => {
      ev.preventDefault();
      try { await call("POST", "/auth/password", { current: el.querySelector("#pwCur").value, password: el.querySelector("#pwNew").value }); el.hidden = true; toast(t("acPwChanged")); }
      catch (x) { const e2 = el.querySelector("#pwErr"); e2.textContent = errText(x); e2.hidden = false; }
    };
  }
  async function portal() {
    try { const r = await call("POST", "/billing/portal"); location.href = r.url; } catch (x) { toast(errText(x)); }
  }
  async function signOut() {
    if (!confirm(t(isAccount() ? "acSignOutQ" : "signOutConfirm"))) return;
    if (isAccount()) { await push().catch(() => {}); await call("POST", "/auth/logout").catch(() => {}); wipe(); Auth.signOut(); location.replace(location.pathname); return; }
    Auth.signOut();
  }

  /* ---------- profile: account card ---------- */
  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return t("acJustNow");
    if (m < 60) return t("acMinAgo", { n: m });
    return new Date(ms).toLocaleString(I18N.info().locale, { dateStyle: "short", timeStyle: "short" });
  }
  function badge() {
    if (plan.why === "iran") return `<span class="ac-badge ir">🇮🇷 ${esc(t("acIranFree"))}</span>`;
    if (plan.why === "staff") return `<span class="ac-badge plus">${esc(t("role_" + (Auth.session || {}).role))}</span>`;
    if (plan.tier === "plus") return `<span class="ac-badge plus">Plus ✨</span>`;
    return `<span class="ac-badge free">${esc(t("acFree"))}</span>`;
  }
  function profileCard() {
    const s = Auth.session || {};
    if (!isAccount()) {
      return {
        save: cfg ? `<b>${esc(t("saveTitle"))}</b><p>${esc(t("acSaveSub"))}</p><button type="button" class="wc-go" data-acct="signup">${esc(t("acCreateOrIn"))}</button>` : "",
        rows: `<div class="pf-row pf-acct"><span class="pf-acct-ic">👤</span><span class="pf-acct-tx"><b>${esc(t("guest"))}</b><small>${esc(t("guestInfo", { d: s.since ? new Date(s.since).toLocaleDateString(I18N.info().locale) : "" }))}</small></span><button class="pf-out" data-acct="out">${esc(t("signOut"))}</button></div>`
      };
    }
    const sy = sync();
    const syncTx = sy.dirty ? t("acSyncing") : sy.at ? `☁︎ ${t("synced")} · ${ago(sy.at)}` : `☁︎ ${t("synced")}`;
    const until = plan.until ? new Date(plan.until).toLocaleDateString(I18N.info().locale) : "";
    const planTx = plan.why === "stripe" ? `${t(plan.interval === "year" ? "plYearly" : "plMonthly")}${until ? " · " + t(plan.cancelAtEnd ? "acEnds" : "acRenews", { d: until }) : ""}${plan.status === "trialing" ? " · " + t("acTrial") : ""}` : plan.why === "grant" && until ? t("acUntil", { d: until }) : "";
    let save = "";
    if (!s.verified) save = `<b>✉️ ${esc(t("acVerifyT"))}</b><p>${esc(t("acVerifyBanner", { e: s.email }))}</p><button type="button" class="wc-go" data-acct="verify">${esc(t("acEnterCode"))}</button>`;
    else if (plan.tier !== "plus" && billing()) save = `<div class="ac-up"><b>LAPP Plus ✨</b><p>${esc(t("plCard"))}</p><button type="button" data-acct="plans">${esc(cfg.access && cfg.access.trialDays && !plan.status ? t("plTrial", { n: cfg.access.trialDays }) : t("plSee"))}</button></div>`;
    else if (plan.why === "iran") save = `<div class="ac-irc">${esc(t("acIranCard"))} 💚</div>`;
    const row = (ic, label, act, extra = "") => `<button type="button" class="pf-row pf-link" data-acct="${act}"><span>${ic} ${esc(label)}</span><span class="v">${extra}›</span></button>`;
    const rows = `<div class="pf-row pf-acct"><span class="pf-acct-ic">${esc(initial(s.name || s.username))}</span><span class="pf-acct-tx"><b><bdi>@${esc(s.username)}</bdi> ${badge()}</b><small><bdi>${esc(s.email)}</bdi> · ${esc(syncTx)}${planTx ? " · " + esc(planTx) : ""}</small></span></div>`
      + (plan.why === "stripe" || plan.status ? row("💳", t("acBilling"), "portal") : "")
      + orgs.map(o => `<a class="pf-row pf-link" href="/s/${esc(o.slug)}"><span>🏫 ${esc(o.name)} <span class="ac-badge free">${esc(o.role)}</span></span><span class="v">›</span></a>`).join("")
      + (["manager", "admin", "designer"].includes(s.role) || orgs.some(o => o.role !== "student") ? `<a class="pf-row pf-link" href="/manage"><span>🛠 ${esc(t("acAdmin"))}</span><span class="v">›</span></a>` : "")
      + (isStaff() ? `<a class="pf-row pf-link" href="/studio"><span>🎬 ${esc(t("acStudio"))}</span><span class="v">›</span></a>` : "")
      + row("🔒", t("acChangePw"), "password")
      + `<button type="button" class="pf-row pf-link danger" data-acct="out"><span>${esc(t("signOut"))}</span></button>`;
    return { save, rows };
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-acct]"); if (!b) return;
    const k = b.dataset.acct;
    if (k === "signup") open("email");
    else if (k === "verify") { W.email = (Auth.session || {}).email; open("verify"); }
    else if (k === "plans") plans();
    else if (k === "portal") portal();
    else if (k === "password") passwordSheet();
    else if (k === "out") signOut();
  });

  /* ---------- links back from e-mail and Stripe ---------- */
  function fromLink() {
    const q = new URLSearchParams(location.search);
    if (q.get("reset") && cfg) { W.token = q.get("reset"); open("reset", { closable: false }); return true; }
    if (q.get("login") && cfg && !isAccount()) { open("email", { closable: Auth.signedIn }); return true; }
    if (q.get("plus")) {
      history.replaceState(null, "", location.pathname);
      if (q.get("plus") === "ok") { toast(t("plThanks")); setTimeout(async () => { try { const m = await call("GET", "/me"); setUser(m.user, m.plan, m.orgs); emit(); } catch {} }, 2500); }
    }
    return false;
  }

  window.Account = {
    ready, open, close, render, plans, paywall, canOpen, isLocked, profileCard, fromLink, toast,
    get api() { return !!cfg; }, get plan() { return plan; }, get config() { return cfg; },
    get isAccount() { return isAccount(); }, get isPlus() { return isPlus(); },
    onChange: f => changes.on("change", f)
  };
})();
