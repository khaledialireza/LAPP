// LAPP work desktop · the command center's board: one free grid where everything lives side by side —
// the AI's main task, numbers, apps, quick switches, widgets, clock, calendar — each as big as its content.
// Edit (the pencil in the footer): drag tiles to move them, the left column holds everything to add (drag or click),
// the footer takes anything too. Right-click a tile: priority, size, when it shows, its own shortcut, remove.
// With "Learn from my use" on, what you open most (and at this hour) comes first. All of it is saved with the desktop.
"use strict";
(function () {
  const { $, $$, esc, I } = D;
  const CCS = () => (D.DESK.cc = D.DESK.cc || {});
  const save = () => { K.LS.set("lapp.cc", D.DESK.cc); D.save(); D.shareKeys(); };
  const ST = { edit: false, drag: null };
  D.ccEditing = () => ST.edit;
  D.ccList = () => tiles();

  /* ---------- what a tile can be ---------- */
  const isLight = () => (D.look().theme || "") === "light";
  const Q = {
    theme: { icon: () => isLight() ? "sun" : "moon", label: () => isLight() ? "Light" : "Dark", on: () => !isLight(), run: () => D.setLook("theme", isLight() ? "" : "light") },
    pointer: { icon: () => "pointer", label: () => "LAPP pointer", on: () => D.LS.get("lapp.cursor", "") !== "system", run: () => D.settings("cursor", D.LS.get("lapp.cursor", "") === "system") },
    ribbon: { icon: () => "layers", label: () => "Line bar", on: () => !K.LS.get("lapp.ribbon.off", false), run: () => K.LS.set("lapp.ribbon.off", !K.LS.get("lapp.ribbon.off", false)) },
    toasts: { icon: () => "bell", label: () => "Pop-ups", on: () => D.look().toasts !== false, run: () => D.setLook("toasts", D.look().toasts === false) },
    restore: { icon: () => "reload", label: () => "Reopen windows", on: () => D.look().restore !== false, run: () => D.setLook("restore", D.look().restore === false) },
    group: { icon: () => "group", label: () => "Group windows", on: () => D.groupMode() === "auto", run: () => D.setLook("groupBy", D.groupMode() === "auto" ? "app" : "auto") },
    learn: { icon: () => "insights", label: () => "Learn from my use", on: () => CCS().learn !== false, run: () => { CCS().learn = CCS().learn === false; save(); } },
    lock: { icon: () => "lock", label: () => "Lock", on: () => false, run: () => D.lock() },
  };
  const app = id => D.APPS.find(a => a.id === id);
  const SIZES = { s11: "S", s21: "M", s22: "L" };
  const name = ([, kind, , d]) => kind === "app" ? (app(d) || {}).title || "App" : kind === "q" ? Q[d] ? Q[d].label() : d : kind === "kpi" ? (D.ccTiles[d] ? D.ccTiles[d](D.ccSignals()).label : d) : kind === "wid" ? (D.WT[d] || [])[1] || d : { hero: "For now", clock: "Clock", cal: "Calendar", allapps: "All apps", lang: "Language" }[kind] || kind;
  const icon = ([, kind, , d]) => kind === "app" ? (app(d) || {}).icon || "grid" : kind === "q" ? Q[d] ? Q[d].icon() : "grid" : kind === "kpi" ? (D.ccTiles[d] ? D.ccTiles[d](D.ccSignals()).icon : "chart") : kind === "wid" ? (D.WT[d] || [])[0] || "puzzle" : { hero: "ai", clock: "clock", cal: "calendar", allapps: "grid", lang: "globe" }[kind] || "grid";

  /* ---------- the tiles and their order ---------- */
  const DEF = () => [["hero", "hero", "s32"], ["clock", "clock", "s21"], ["k:approve", "kpi", "s11", "approve"],
    ...D.APPS.filter(a => a.ws === D.CUR).slice(0, 3).map(a => ["app:" + a.id, "app", "s11", a.id]),
    ["lang", "lang", "s21"], ["k:unread", "kpi", "s11", "unread"], ["q:theme", "q", "s11", "theme"], ["cal", "cal", "s22"], ["all", "allapps", "s11"], ["k:inwork", "kpi", "s11", "inwork"], ["q:learn", "q", "s11", "learn"]];
  const tiles = () => (CCS().tiles || DEF()).filter(t => t[1] !== "app" || app(t[3]));
  const setTiles = l => { CCS().tiles = l; save(); };
  const foot = () => (CCS().foot || []).filter(t => t[1] !== "app" || app(t[3]));
  const P = id => ({ pr: "normal", when: "always", key: "", ...((CCS().props || {})[id] || {}) });
  const setP = (id, k, v) => { CCS().props = { ...(CCS().props || {}), [id]: { ...((CCS().props || {})[id] || {}), [k]: v } }; save(); };
  const use = id => { if (CCS().learn === false) return; const u = CCS().uses = CCS().uses || {}, x = u[id] = u[id] || { n: 0, h: Array(24).fill(0) }; x.n++; x.h[new Date().getHours()]++; save(); };
  function ordered() {
    const now = new Date(), h = now.getHours(), wd = now.getDay() >= 1 && now.getDay() <= 5, U = CCS().uses || {}, learn = CCS().learn !== false;
    const shown = tiles().filter(t => { const w = P(t[0]).when; return w === "always" || (w === "morning" && h < 12) || (w === "work" && wd); });
    const rank = t => { const p = P(t[0]).pr, u = U[t[0]]; return (p === "top" ? -1e6 : p === "need" ? 1e6 : 0) - (learn && u ? u.n + 3 * u.h[h] : 0); };
    return shown.map((t, i) => [t, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
  }

  /* ---------- drawing ---------- */
  const tone = c => `--t:${c}`;
  function body(t, s) {
    const [id, kind, , d] = t;
    if (kind === "hero") { const plan = D.ccPlan || D.ccRules(s), hero = (D.ccHeroes[plan.hero] && D.ccHeroes[plan.hero](s)) || D.ccHeroes.start(s);
      return `<b>${esc(hero.title)}</b>${hero.text ? `<p>${esc(hero.text)}</p>` : ""}<div class="acts">${hero.acts.map(([l, g, pr]) => `<button class="b2 ${pr ? "pr" : ""}" data-go="${esc(g)}">${esc(l)}</button>`).join("")}</div>`; }
    if (kind === "clock") { const n = new Date(); return `<b class="clk">${n.toLocaleTimeString(D.loc(), { hour: "2-digit", minute: "2-digit" })}</b><span>${esc(n.toLocaleDateString(D.loc(), { weekday: "long", day: "numeric", month: "long" }))}</span>`; }
    if (kind === "cal") { const n = new Date(), y = n.getFullYear(), m = n.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
      return `<b class="ml">${esc(n.toLocaleDateString(D.loc(), { month: "long" }))}</b><div class="cal">${["M", "T", "W", "T", "F", "S", "S"].map(x => `<i class="h">${x}</i>`).join("")}${"<i></i>".repeat(first)}${Array.from({ length: days }, (_, k) => `<i class="${k + 1 === n.getDate() ? "t" : ""}">${k + 1}</i>`).join("")}</div>`; }
    if (kind === "kpi") { const k = D.ccTiles[d] ? D.ccTiles[d](s) : null; return k ? `<span class="th">${I(k.icon, 13)}${esc(k.label)}</span><b>${esc(String(k.value))}</b>` : ""; }
    if (kind === "app" || kind === "allapps") { const a = kind === "app" ? app(d) : { icon: "grid", title: "All apps", color: "var(--p4)" };
      // the same badge and the same "open" mark the taskbar shows for this app
      const n = kind === "app" && a.id ? D.waiting()[a.id] || 0 : 0, open = kind === "app" && a.id && D.WN().some(w => (D.appOf(w.url) || {}).id === a.id);
      return `<span class="g" style="background:${a.color}">${I(a.icon, 19)}${n ? `<span class="wk">${n > 99 ? "99+" : n}</span>` : ""}</span><span class="an">${esc(a.title)}</span>${open ? `<i class="runs"></i>` : ""}`; }
    if (kind === "lang") { const L = window.PanelI18N ? PanelI18N.lang : "en"; return `<span class="th">${I("globe", 14)}Language</span><div class="langs" translate="no">${["en", "fa", "ru", "uk"].map(x => `<button data-lang="${x}" class="${x === L ? "on" : ""}">${x.toUpperCase()}</button>`).join("")}</div>`; }
    if (kind === "q") { const q = Q[d]; return q ? `<span class="qi">${I(q.icon(), 15)}</span><b>${esc(q.label())}</b>` : ""; }
    if (kind === "wid") { const w = D.WT[d]; return w ? `<span class="th">${I(w[0], 14)}${esc(w[1])}</span><span class="mu">${esc(w[2])}</span>` : ""; }
    return "";
  }
  const cls = t => { const [, kind, sz, d] = t; return `cct ${sz} ${({ hero: "hero", clock: "clock", kpi: "k", app: "ap", allapps: "ap", lang: "lang", q: "qt", wid: "wd" })[kind] || ""} ${kind === "q" && Q[d] && Q[d].on() ? "on" : ""}`; };
  function tileHtml(t, s, where) {
    const [id, kind, , d] = t, p = P(id), k = kind === "kpi" && D.ccTiles[d] ? D.ccTiles[d](s) : null;
    return `<div class="${cls(t)}" data-t="${esc(id)}" ${where ? `data-where="${where}"` : ""} style="${k ? tone(k.tone) : ""}" draggable="${ST.edit || kind === "app" ? "true" : "false"}" ${["app", "allapps", "q", "kpi", "wid"].includes(kind) ? `role="button" tabindex="0"` : ""}>${body(t, s)}
      ${p.key ? `<kbd class="tkey">${esc(D.nice(p.key))}</kbd>` : ""}${p.pr === "top" && !ST.edit ? `<span class="tpin">${I("pin", 11)}</span>` : ""}${ST.edit ? `<button class="rm" data-rm="${esc(id)}" aria-label="Remove">${I("x", 11)}</button>` : ""}</div>`;
  }
  // everything that can be added (the left column while editing)
  function library() {
    const have = new Set([...tiles(), ...foot()].map(t => t[0]));
    const groups = [["Apps", D.APPS.map(a => ["app:" + a.id, "app", "s11", a.id])],
      ["Numbers", Object.keys(D.ccTiles).map(k => ["k:" + k, "kpi", "s11", k])],
      ["Quick", Object.keys(Q).map(k => ["q:" + k, "q", "s11", k])],
      ["Widgets", [["clock", "clock", "s21"], ["cal", "cal", "s22"], ["lang", "lang", "s21"], ["all", "allapps", "s11"], ["hero", "hero", "s32"], ...Object.keys(D.WT).map(k => ["w:" + k, "wid", "s21", k])]]];
    LIB = groups.flatMap(g => g[1]);
    const s = D.ccSignals();
    return `<aside class="lib" aria-label="Add to the command center">${groups.map(([g, l]) => { const free = l.filter(t => !have.has(t[0])); return free.length ? `<h5>${esc(g)}</h5><div class="lbento">${free.map(t => `<div class="${cls(t)} ltile" data-lib="${LIB.indexOf(t)}" draggable="true" title="${esc(name(t))}" style="${t[1] === "kpi" && D.ccTiles[t[3]] ? tone(D.ccTiles[t[3]](s).tone) : ""}">${body(t, s)}</div>`).join("")}</div>` : ""; }).join("")}</aside>`;
  }
  let LIB = [];
  D.ccBoard = B => {
    const s = D.ccSignals();
    const grid = `<div class="bento" data-drop="board">${(ST.edit ? tiles() : ordered()).map(t => tileHtml(t, s)).join("")}</div>`;
    B.innerHTML = ST.edit ? `<div class="ccrow">${library()}${grid}</div>` : grid;
    $("#cc")?.classList.toggle("editing", ST.edit);
    if (!ST.edit && !D.ccPlan) D.ccArrange(s).then(plan => { D.ccPlan = plan; setTimeout(() => { D.ccPlan = null; }, 10 * 6e4); const h = $('#cc [data-t="hero"]'); if (h) h.innerHTML = body(["hero", "hero"], D.ccSignals()); });
  };
  D.ccFoot = () => `${D.avatar(26)}<span class="ws"><i style="background:${D.wsOf(D.CUR).color}"></i>${esc(D.wsOf(D.CUR).name)}</span><span style="flex:1"></span>
    <span class="fslots" data-drop="foot">${foot().map(t => `<span class="fslot"><button class="ib ${t[1] === "q" && Q[t[3]] && Q[t[3]].on() ? "on" : ""}" data-t="${esc(t[0])}" data-where="foot" title="${esc(name(t))}" aria-label="${esc(name(t))}">${I(icon(t), 17)}</button>${ST.edit ? `<button class="rm" data-frm="${esc(t[0])}" aria-label="Remove">${I("x", 10)}</button>` : ""}</span>`).join("")}</span>
    <button class="ib ${ST.edit ? "on" : ""}" data-ccedit title="${ST.edit ? "Done" : "Edit"}" aria-label="${ST.edit ? "Done" : "Edit"}">${I(ST.edit ? "check" : "edit", 17)}</button>
    <button class="ib" data-pw title="Lock · Sign out" aria-label="Lock or sign out">${I("log-out", 17)}</button>`;
  // the views the desktop's right-click opens: all apps, widgets, wallpapers — as tiles, right here
  const WALLS = [["", "Aurora", "radial-gradient(circle at 80% 0,rgba(255,61,127,.45),transparent 60%),radial-gradient(circle at 0 100%,rgba(34,211,238,.3),transparent 60%),#0b0b12"], ["dawn", "Dawn", "radial-gradient(circle at 20% 0,rgba(251,191,36,.5),transparent 60%),radial-gradient(circle at 90% 100%,rgba(255,61,127,.45),transparent 60%),#140b10"], ["sea", "Sea", "radial-gradient(circle at 80% 10%,rgba(34,211,238,.5),transparent 60%),radial-gradient(circle at 10% 100%,rgba(96,165,250,.45),transparent 60%),#06101a"], ["plain", "Plain", "#15151c"]];
  /* ---------- accounts: the ones signed in here, and adding one with the sign-in panel itself ---------- */
  const AL = { on: false, step: "id", id: "", err: "", busy: false };
  const acctName = ac => ac.user.name || "@" + ac.user.username;
  const acctRole = ac => { const L = [["admin", "manager", "designer"].includes(ac.user.role) ? "LAPP · " + ac.user.role : "", ...(ac.orgs || []).map(o => `${o.name} · ${o.role}`)].filter(Boolean); return L.length > 1 ? `${L[0]} +${L.length - 1}` : L[0] || ""; };
  function accounts(B, q) {
    const c = $("#cc"); c.classList.toggle("acclogin", AL.on);
    if (AL.on) {
      B.innerHTML = `<form class="acclog" autocomplete="off"><button type="button" class="bk" data-acc="back" aria-label="Back">${I("back", 15)}</button><span class="lg">L</span>
        ${AL.step === "id" ? `<input id="accId" type="text" placeholder="E-mail or username" value="${esc(AL.id)}" autocomplete="username">`
          : `<button type="button" class="who" data-acc="change"><span>${esc(AL.id)}</span><small>Change</small></button><input id="accPw" type="password" placeholder="Password" autocomplete="current-password">`}
        <button class="go" type="submit" ${AL.busy ? "disabled" : ""}>${AL.busy ? "Signing in…" : AL.step === "id" ? "Continue" : "Sign in"}</button><span class="er">${esc(AL.err)}</span></form>`;
      const f = $(".acclog", B); setTimeout(() => $("#accId,#accPw", f)?.focus(), 30);
      f.onsubmit = async e => { e.preventDefault(); AL.err = "";
        if (AL.step === "id") { AL.id = $("#accId").value.trim(); if (!AL.id) return; AL.step = "pw"; return D.ccRedraw(); }
        const pw = $("#accPw") ? $("#accPw").value : ""; if (!pw) return; AL.busy = true; D.ccRedraw();
        try { await K.apiAt("/api", { signin: false })("POST", "/auth/login", { email: AL.id, password: pw, link: true }); Object.assign(AL, { on: false, step: "id", id: "", busy: false }); await D.reloadAccounts(); D.toast("Signed in", { kind: "ok" }); }
        catch (x) { AL.busy = false; AL.err = x.message || "Could not sign in"; }
        D.ccRedraw(); };
      f.onclick = e => { const b = e.target.closest("[data-acc]"); if (!b) return; if (b.dataset.acc === "back") Object.assign(AL, { on: false, err: "" }); else Object.assign(AL, { step: "id", err: "" }); D.ccRedraw(); };
      return;
    }
    const cur = (D.wsOf(D.CUR) || {}).as || 0;
    B.innerHTML = `<div class="accl">${D.ACCTS.filter(ac => !q || (acctName(ac) + " " + acctRole(ac)).toLowerCase().includes(q)).map(ac => { const n = D.WN().filter(w => (w.as || 0) === ac.slot).length;
      return `<button class="accr ${ac.slot === cur ? "sel" : ""}" data-acct="${ac.slot}">${K.avatar(ac.user, 34)}<span class="t"><b>${esc(acctName(ac))}</b><small>${esc(acctRole(ac))}</small></span><span class="n">${n} window${n === 1 ? "" : "s"}</span>${ac.slot === cur ? `<span class="dot"></span>` : ""}</button>`; }).join("")}
      ${D.ACCTS.length < 4 ? `<button class="accadd" data-acc="add"><i>${I("plus", 16)}</i>Add account</button>` : ""}</div>`;
    B.onclick = e => {
      if (e.target.closest('[data-acc="add"]')) { Object.assign(AL, { on: true, step: "id", id: "", err: "" }); return D.ccRedraw(); }
      const r = e.target.closest("[data-acct]"); if (!r) return; const ac = D.acctOf(+r.dataset.acct); if (!ac) return;
      D.ccClose(); D.switchWs(ac.ws[0]); D.toast(acctName(ac), { kind: "info" });
    };
    B.oncontextmenu = e => { const r = e.target.closest("[data-acct]"); if (!r) return; e.preventDefault(); const n = +r.dataset.acct;
      K.menu(e.clientX, e.clientY, [{ label: n ? "Sign out of this account" : "Sign out of all", icon: "log-out", danger: true, run: () => n ? D.signOutAcct(n) : D.go("out") }]); };
  }
  D.reloadAccounts = async () => {
    const r = await D.api("GET", "/auth/linked").catch(() => ({}));
    D.ACCTS = [{ slot: 0, user: D.ME, orgs: D.ORGS }, ...(r.accounts || [])];
    await D.loadInstalls(); D.buildApps(); D.drawMe(); D.drawTask && D.drawTask(); D.emit && D.emit("ws");
  };
  D.signOutAcct = async n => {
    D.WN().filter(w => (w.as || 0) === n).forEach(w => D.closeWin(w));
    await fetch("/api/auth/logout", { method: "POST", headers: { "X-LAPP": "1", "X-As": String(n) }, credentials: "same-origin" }).catch(() => {});
    await D.reloadAccounts(); D.ccRedraw(); D.toast("Signed out", { kind: "info" });
  };

  D.ccExtra = (B, v, q) => {
    q = (q || "").trim().toLowerCase();
    if (v === "applist") {
      // apps that come together from the store (e.g. Language Studio = Lesson library, Studio, Characters) show as one group
      const L = D.APPS.filter(a => !q || (a.title + " " + D.wsOf(a.ws).name).toLowerCase().includes(q)), seen = new Set();
      const row = a => `<button class="arow" data-open-app="${esc(a.id)}" draggable="true" data-app="${esc(a.id)}"><span class="g" style="background:${a.color}">${I(a.icon, 15)}</span><span class="t">${esc(a.title)}</span>${a.ws !== D.CUR ? `<small>${esc(D.wsOf(a.ws).name)}</small>` : ""}<span class="amore" data-amore="${esc(a.id)}" role="button" aria-label="More">${I("more", 16)}</span></button>`;
      const key = a => { const s = D.storeAppOf(a); return s ? a.ws + "|" + s.id : ""; };
      B.innerHTML = `<div class="alist">${L.map(a => {
        const k = key(a); if (seen.has(a.id)) return "";
        const group = k ? D.APPS.filter(x => key(x) === k) : [];
        if (group.length < 2) return row(a);
        group.forEach(x => seen.add(x.id)); const s = D.storeAppOf(a);
        return `<div class="agrp"><div class="ghd"><span class="t">${esc(s.name)}</span>${a.ws !== D.CUR ? `<small>${esc(D.wsOf(a.ws).name)}</small>` : ""}${s.admin ? `<span class="amore" data-gmore="${esc(a.id)}" role="button" aria-label="More">${I("more", 16)}</span>` : ""}</div>${group.filter(x => L.includes(x)).map(row).join("")}</div>`;
      }).join("")}</div>`;
    }
    if (v === "widgets") B.innerHTML = `<div class="bento">${Object.entries(D.WT).map(([k, w]) => `<button class="cct s21 wd" data-addwid="${k}"><span class="th">${I(w[0], 14)}${esc(w[1])}</span><span class="mu">${esc(w[2])}</span></button>`).join("")}</div>`;
    if (v === "accounts") return accounts(B, q);
    if (v === "walls") { const cur = D.DESK.wall || ""; B.innerHTML = `<div class="bento">${WALLS.map(([k, l, g]) => `<button class="cct s21 wall ${k === cur ? "on" : ""}" data-wall="${k}" title="${esc(l)}" aria-label="${esc(l)}" style="background:${g}"></button>`).join("")}</div>`; }
  };

  /* ---------- clicks ---------- */
  const redraw = () => D.ccRedraw && D.ccRedraw();
  function runTile(t) {
    const [id, kind, , d] = t; use(id);
    if (kind === "app") { const a = app(d); if (a) { D.ccClose(); D.openWin(a.url); } }
    else if (kind === "allapps") D.ccOpen("applist");
    else if (kind === "kpi") { const k = D.ccTiles[d] && D.ccTiles[d](D.ccSignals()); if (k) { if (k.go === "tasks") D.act("tasks"); else D.go(k.go); } }
    else if (kind === "q") { Q[d] && Q[d].run(); redraw(); }
    else if (kind === "wid") { D.addWidget(d); D.toast(`${D.WT[d][1]} is on the desktop`, { kind: "ok" }); }
  }
  const find = id => tiles().find(t => t[0] === id) || foot().find(t => t[0] === id);
  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest || !t.closest("#cc")) return;
    if (t.closest("[data-ccedit]")) { ST.edit = !ST.edit; return redraw(); }
    // the desk closes open menus on every click: open this one just after that
    const pw = t.closest("[data-pw]"); if (pw) return setTimeout(() => K.menuAt(pw, [{ label: "Lock", icon: "lock", run: () => D.lock() }, { label: "Sign out", icon: "log-out", run: () => K.signOut() }], { above: true, end: true }));
    const lg = t.closest("[data-lang]"); if (lg) { e.stopPropagation(); if (window.PanelI18N) PanelI18N.use(lg.dataset.lang, true); return; }
    const rm = t.closest("[data-rm]"); if (rm) { setTiles(tiles().filter(x => x[0] !== rm.dataset.rm)); return redraw(); }
    const frm = t.closest("[data-frm]"); if (frm) { CCS().foot = foot().filter(x => x[0] !== frm.dataset.frm); save(); return redraw(); }
    const lib = t.closest("[data-lib]"); if (lib) { const x = LIB[+lib.dataset.lib]; if (x) setTiles([...tiles(), x]); return redraw(); }
    const gm = t.closest("[data-gmore]"); if (gm) { e.stopPropagation(); const a = app(gm.dataset.gmore); return setTimeout(() => K.menuAt(gm, [{ head: D.storeAppOf(a).name }, { label: "Remove app", icon: "trash", danger: true, run: () => D.uninstall(a) }], { end: true }), 0); }
    const am = t.closest("[data-amore]"); if (am) { e.stopPropagation(); const items = appMenu(app(am.dataset.amore)); return setTimeout(() => K.menuAt(am, items, { end: true }), 0); }
    const oa = t.closest("[data-open-app]"); if (oa) { const a = app(oa.dataset.openApp); if (a) { use("app:" + a.id); D.ccClose(); D.openWin(a.url); } return; }
    const aw = t.closest("[data-addwid]"); if (aw) { D.addWidget(aw.dataset.addwid); return D.toast(`${D.WT[aw.dataset.addwid][1]} is on the desktop`, { kind: "ok" }); }
    const wl = t.closest("[data-wall]"); if (wl && t.closest("#cc .wall")) { D.setLook("wall", wl.dataset.wall); return redraw(); }
    if (ST.edit) return;
    const tl = t.closest("[data-t]"); if (tl && !t.closest("[data-go]")) { const x = find(tl.dataset.t); if (x) runTile(x); }
  });
  document.addEventListener("keydown", e => { if (e.key !== "Enter" || !e.target.closest || !e.target.closest("#cc [data-t][role=button]")) return; const x = find(e.target.dataset.t); if (x && !ST.edit) { e.preventDefault(); runTile(x); } });

  /* ---------- dragging: tiles move, the left column adds, apps go onto the desktop ---------- */
  document.addEventListener("dragstart", e => {
    const t = e.target; if (!t.closest) return;
    const lib = t.closest("#cc [data-lib]"); if (lib) { ST.drag = { lib: +lib.dataset.lib }; e.dataTransfer.setData("text/plain", "lapp-lib"); return; }
    const tl = t.closest("#cc [data-t]"); if (tl && ST.edit) { ST.drag = { id: tl.dataset.t }; e.dataTransfer.setData("text/plain", "lapp-tile"); return; }
    const ap = t.closest("#cc [data-app], #cc .ap[data-t]"); if (ap) { const id = ap.dataset.app || (find(ap.dataset.t) || [])[3]; if (id) { e.dataTransfer.setData("text/x-lapp-app", id); e.dataTransfer.setData("text/plain", id); D.DRAGAPP = id; } }
  });
  document.addEventListener("dragover", e => {
    if (!ST.drag || !e.target.closest || !e.target.closest("#cc")) return;
    const zone = e.target.closest("[data-drop]"); if (!zone) return; e.preventDefault();
    if (ST.drag.id && zone.dataset.drop === "board") {
      const over = e.target.closest("[data-t]"); if (!over || over.dataset.t === ST.drag.id) return;
      const l = tiles(), a = l.findIndex(x => x[0] === ST.drag.id), b = l.findIndex(x => x[0] === over.dataset.t); if (a < 0 || b < 0) return;
      const [m] = l.splice(a, 1); l.splice(b, 0, m); CCS().tiles = l; const el = $(`#cc .bento [data-t="${CSS.escape(ST.drag.id)}"]`); if (el) b > a ? over.after(el) : over.before(el);
    }
  });
  document.addEventListener("drop", e => {
    if (!ST.drag || !e.target.closest || !e.target.closest("#cc")) return;
    const zone = e.target.closest("[data-drop]"); if (!zone) return; e.preventDefault(); e.stopPropagation();
    if (ST.drag.lib != null) { const x = LIB[ST.drag.lib]; if (x) { if (zone.dataset.drop === "foot") CCS().foot = [...foot(), x]; else CCS().tiles = [...tiles(), x]; } }
    save(); ST.drag = null; redraw();
  }, true);
  document.addEventListener("dragend", () => { if (ST.drag && ST.drag.id) save(); ST.drag = null; setTimeout(() => { D.DRAGAPP = null; }, 50); });

  /* ---------- right-click a tile: its own settings ---------- */
  // an app in the list: open it, put it on the board, or remove it from its space (the store follows)
  const appMenu = a => !a ? [] : [{ head: a.title }, { label: "Open", icon: "external", run: () => { D.ccClose(); D.openWin(a.url); } },
    ...(tiles().some(y => y[1] === "app" && y[3] === a.id) ? [] : [{ label: "Add to the board", icon: "plus", run: () => { setTiles([...tiles(), ["app:" + a.id, "app", "s11", a.id]]); D.toast("On the board", { kind: "ok" }); } }]),
    ...((D.storeAppOf(a) || {}).admin ? ["-", { label: "Remove app", icon: "trash", danger: true, run: () => D.uninstall(a) }] : [])];
  K.ctx(t => { const r = t.closest && t.closest("#cc [data-open-app]"); return r ? appMenu(app(r.dataset.openApp)) : null; });
  K.ctx(t => {
    const el = t.closest && t.closest("#cc [data-t]"); if (!el) return null;
    const id = el.dataset.t, x = find(id); if (!x) return null;
    const p = P(id), inFoot = el.dataset.where === "foot";
    const sizes = x[1] === "app" || x[1] === "q" || x[1] === "allapps" ? ["s11", "s21"] : x[1] === "kpi" ? ["s11", "s21"] : ["s11", "s21", "s22"];
    return [{ head: name(x) },
      { label: "Priority", icon: "sort", sub: [["top", "First"], ["normal", "Normal"], ["need", "Only when needed"]].map(([v, l]) => ({ label: l, on: p.pr === v, run: () => { setP(id, "pr", v); redraw(); } })) },
      ...(inFoot ? [] : [{ label: "Size", icon: "maximize", sub: sizes.map(v => ({ label: SIZES[v], on: x[2] === v, run: () => { setTiles(tiles().map(y => y[0] === id ? [y[0], y[1], v, y[3]] : y)); redraw(); } })) }]),
      { label: "Shown", icon: "clock", sub: [["always", "Always"], ["morning", "Mornings"], ["work", "Work days"]].map(([v, l]) => ({ label: l, on: p.when === v, run: () => { setP(id, "when", v); redraw(); } })) },
      { label: p.key ? `Shortcut · ${D.nice(p.key)}` : "Shortcut…", icon: "keyboard", run: async () => { const v = await K.ask({ title: `A shortcut for “${name(x)}”`, value: p.key || "Alt+1", placeholder: "Alt+1", ok: "Use it", validate: v => /^(Ctrl|Cmd|Alt)\+/.test(v) ? "" : "Start with Ctrl, Cmd or Alt" }); if (v != null) { setP(id, "key", v); redraw(); } } },
      ...(id === "q:learn" ? [{ label: "Clear what it learned", icon: "trash", run: () => { CCS().uses = {}; save(); D.toast("Forgotten", { kind: "ok" }); } }] : []),
      ...(x[1] === "app" && (D.storeAppOf(app(x[3])) || {}).admin ? [{ label: "Remove app", icon: "trash", danger: true, run: () => D.uninstall(app(x[3])) }] : []),
      "-", { label: "Remove from the board", icon: "x", danger: true, run: () => { if (inFoot) CCS().foot = foot().filter(y => y[0] !== id); else CCS().tiles = tiles().filter(y => y[0] !== id); save(); redraw(); } }];
  });
  // a tile's own shortcut (pages in windows pass it up as well: D.shareKeys puts it in their list)
  D.ccKey = combo => { const id = Object.keys(CCS().props || {}).find(k => CCS().props[k].key && CCS().props[k].key === combo); const x = id && find(id); if (!x) return false; if (x[1] === "hero" || x[1] === "clock" || x[1] === "cal" || x[1] === "lang") D.ccOpen("all"); else runTile(x); return true; };
  D.ccKeys = () => Object.values(CCS().props || {}).map(p => p.key).filter(Boolean);
})();
