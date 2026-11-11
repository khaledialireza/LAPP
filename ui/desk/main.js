// LAPP work desktop · start-up, commands shared by all modules, keys.
"use strict";
(function () {
  const { $, $$, esc, I } = D;
  Object.assign(D.ACT, {
    cc: () => D.ccOpen("all"), ai: () => D.ccOpen("ai"),
    tasks: () => { const ws = D.WN(); D.sheet(`<h4>${I("window")} Open windows<button data-sx aria-label="Close">${I("x")}</button></h4>` + (ws.map(w => `<div class="pi" data-pw="${w.id}"><span class="ri">${I(w.icon, 15) || D.IE(w.icon)}</span><span class="tx"><b>${esc(w.title)}</b><small>${esc(D.wsOf(w.ws).name)} · ${w.min ? "minimised" : w.id === D.ACTW ? "active" : "open"}${w.state ? " · " + w.state : ""} · used ${D.ago(w.used)}</small></span><span class="qa" style="opacity:1"><button data-pq="left" title="Left half">${I("sidebar", 14)}</button><button data-pq="close" title="Close">${I("x", 14)}</button></span></div>`).join("") || `<div class="pempty">No windows open</div>`) + (ws.length > 1 ? `<div style="margin-top:10px"><button class="b" data-go="tidy">${I("ai", 14)} Tidy up with the AI</button></div>` : "")); },
    close: () => D.closeWin(D.W(D.ACTW)), min: () => D.minWin(D.W(D.ACTW)), max: () => D.toggleMax(D.W(D.ACTW)),
    left: () => D.snap(D.W(D.ACTW), "left"), right: () => D.snap(D.W(D.ACTW), "right"),
    next: () => { const ws = D.WN().filter(x => !x.min && x.ws === D.CUR); if (ws.length) D.focusWin(ws[(ws.indexOf(D.W(D.ACTW)) + 1) % ws.length]); }
  });

  D.go = g => {
    const i = g.indexOf(":"), k = i < 0 ? g : g.slice(0, i), v = i < 0 ? "" : g.slice(i + 1);
    D.closeMenus();
    if (k === "open") { D.ccClose(); return D.openWin(v); }
    if (k === "lesson") { const [q, id, part] = v.split(":"); D.ccClose(); return D.lessons().then(ls => { const l = ls.find(x => x.scope.q === q && String(x.id) === id) || { id, title: "Lesson", scope: { q } }; D.openLesson(l, part); }); }
    if (k === "nopen") { const n = D.NOTES.find(x => x.id === v); if (n) { n.read = true; D.ccClose(); D.openWin(n.url, { lesson: n.lesson }); D.emit("notes"); } return; }
    if (k === "ai") return D.ccOpen("ai");
    if (k === "bell") return $("#trBell").click();
    if (k === "running") return $("#trRun").click();
    if (k === "tidy") { D.closeSheet(); return D.ask("Tidy up my windows: close what I don't use and lay out the rest"); }
    if (k === "keys") return D.keysSheet();
    if (k === "lock") { D.closeMenus(); return D.lock(); }
    if (k === "guide") { D.closeMenus(); return D.guide(); }
    if (k === "settings") { D.ccClose(); return D.openWin("/settings"); }
    if (k === "widget") return D.gallery();
    if (k === "desk") { D.ccClose(); return D.act("desk"); }
    if (k === "groupby") { const r = $("#tb").getBoundingClientRect(); return D.groupMenu(r.right - 260, r.top - 4); }
    if (k === "lang") { D.ccClose(); return window.PanelI18N && PanelI18N.menu($("#lb")); }
    if (k === "cursor") { D.LS.set("lapp.cursor", D.LS.get("lapp.cursor", "") === "system" ? "" : "system"); return D.applyLook(); }
    if (k === "wall") { const L = ["", "dawn", "sea", "plain"]; return D.setLook("wall", L[(L.indexOf(D.DESK.wall || "") + 1) % L.length]); }
    if (k === "site") return window.open("/", "_blank", "noopener");
    if (k === "out") return K.signOut();
  };

  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest) return;
    const gg = t.closest("[data-go]"); if (gg) { e.preventDefault(); return D.go(gg.dataset.go); }
    if (t.closest("[data-sx]")) return D.closeSheet();
    const rec = t.closest("[data-rec]"); if (rec) { D.REC = D.REC === rec.dataset.rec ? null : rec.dataset.rec; return D.keysSheet(); }
    if (t.closest("[data-keyreset]")) { D.BIND = { ...D.DEF }; D.shareKeys(); D.save(); D.keysSheet(); return D.toast("Shortcuts are back to the defaults"); }
    const pw = t.closest(".sheet [data-pw]"); if (pw) { const w = D.W(pw.dataset.pw), q = t.closest("[data-pq]"); if (q) { q.dataset.pq === "close" ? (D.closeWin(w), pw.remove()) : D.snap(w, q.dataset.pq); return; } D.closeSheet(); return D.focusWin(w); }
    if (!t.isConnected) return;   // the click re-drew what it was in (e.g. a view of the command center)
    if (!t.closest("#cc, .k-menu, .sheet, .snapfly, #tb, .k-pop, .wmenu, dialog")) { D.closeMenus(); D.ccClose(); }
    else if (!t.closest(".k-menu, .k-pop, .wmenu, #tb, dialog")) D.closeMenus();
  });
  // keys: the person's own; pages inside windows pass matching keys up (see /ui/frame.js)
  document.addEventListener("keydown", e => {
    if (D.REC) { e.preventDefault(); e.stopPropagation(); if (e.key === "Escape") { D.REC = null; return D.keysSheet(); } const c = D.combo(e); if (!c) return; if (!/^(Cmd|Ctrl|Alt)\+/.test(c) && !/^F\d+$/.test(c)) return D.toast(D.MAC ? "Use ⌘, ⌃ or ⌥ with a key, so typing still works" : "Use Ctrl or Alt with a key, so typing still works", { kind: "warn" }); D.BIND[D.REC] = c; D.REC = null; D.shareKeys(); D.save(); D.keysSheet(); return D.toast("Shortcut saved: " + D.nice(c)); }
    if (e.key === "Escape") { if ($(".k-menu, .k-pop")) return D.closeMenus(); if ($("#sheet")) return D.closeSheet(); }
    const c = D.combo(e), a = Object.keys(D.BIND).find(k => D.BIND[k] === c); if (!a) { if (c && D.ccKey && D.ccKey(c)) e.preventDefault(); return; }
    e.preventDefault(); D.act(a);
  }, true);
  addEventListener("panel:lang", () => { D.WN().forEach(w => w.fr.src = w.fr.src); D.drawDesk(); });

  // the tray's avatars: one per signed-in account, overlapping; the account you work in now sits on top with a ring
  D.drawMe = () => { const a = $("#av"); if (!a) return; const cur = (D.wsOf(D.CUR) || {}).as || 0, many = D.ACCTS.length > 1;
    const list = (D.ACCTS.length ? D.ACCTS : [{ slot: 0, user: D.ME }]).slice().sort((x, y) => (x.slot === cur) - (y.slot === cur));
    a.innerHTML = list.map(ac => `<span class="avw ${many && ac.slot === cur ? "act" : ""}" title="${D.esc(ac.user.name || "@" + ac.user.username)}">${K.avatar(ac.user, 26)}</span>`).join(""); };
  D.on("ws", () => D.drawMe());
  D.on("lessons", () => D.drawTask && D.drawTask());

  /* ---------- start ---------- */
  const BOOT = { p: 0, done: false, t0: Date.now() };
  const bootTo = p => { if (BOOT.done || p <= BOOT.p) return; BOOT.p = p; const b = $("#bootBar"); if (b) b.style.width = p + "%"; };
  D.bootEnd = () => { if (BOOT.done) return; BOOT.done = true; const b = $("#boot"); if (!b) return; bootTo(100); BOOT.p = 100;
    const fast = Date.now() - BOOT.t0 < 300; if (fast) return b.remove(); setTimeout(() => { b.classList.add("out"); setTimeout(() => b.remove(), 700); }, 150); };
  setTimeout(() => D.bootEnd(), 15000);   // never stuck behind the glass
  (async () => {
    bootTo(10);
    const m = await D.api("GET", "/me");
    bootTo(30);
    if (!m.user) { location.href = "/?login=1&next=/manage"; return; }
    D.ME = m.user; D.ORGS = m.orgs || [];
    D.ACCTS = [{ slot: 0, user: D.ME, orgs: D.ORGS }, ...((await D.api("GET", "/auth/linked").catch(() => ({}))).accounts || [])];
    const d = await D.api("GET", "/desk").catch(() => ({ desk: null, files: [] }));
    D.DESK = { ...D.deskDefault(), ...(d.desk || {}) }; D.FILES = d.files || [];
    D.CUR = D.DESK.cur || "me";
    D.buildApps();
    if (!D.DESK.cur && !["manager", "admin", "designer"].includes(D.ME.role) && D.WS.length > 1) D.CUR = D.WS[1].key;
    D.drawMe();
    D.DESK.icons = (D.DESK.icons || []).filter(c => !c.up && (!c.file || D.FILES.some(f => f.id === c.file)));
    D.BIND = { ...D.DEF, ...(D.DESK.keys || {}) }; D.shareKeys();
    D.drawDesk(); bootTo(50);
    (D.LS.get("lapp.theme", {}).restore === false ? [] : D.DESK.windows || []).forEach(x => { if (!x || typeof x.url !== "string" || !D.acctOf(D.asOf(x.url))) return; const w = D.openWin(x.url, { ws: D.WS.some(s => s.key === x.ws) ? x.ws : undefined, title: x.title, icon: x.icon, lesson: x.lesson, geo: { x: x.x, y: x.y, w: x.w, h: x.h }, min: x.min, quiet: 1 }); if (x.snap) { const cur = D.CUR; D.CUR = w.ws; D.snap(w, x.snap); D.CUR = cur; D.place(w); } });
    const a = (D.DESK.windows || []).findIndex(x => x && x.act && !x.min && (x.ws || "me") === D.CUR);
    D.focusWin(a > -1 && D.WN()[a] ? D.WN()[a] : D.topWin());
    D.emit("ws");
    const want = decodeURIComponent((location.hash.match(/#open=(.+)$/) || [])[1] || "");
    history.replaceState(null, "", "/manage");
    if (want && /^\/(admin|studio|files|settings|s\/)/.test(want)) D.openWin(want);
    else if (D.WN().length > 1) D.toast(`Welcome back · your windows are where you left them`, { kind: "info" });
    else if (!D.WN().length) D.toast(`Press ${D.nice(D.BIND.cc)} or the L button: search, apps, lessons and the AI`, { kind: "info" });
    D.emit("ready"); bootTo(65);
    // the glass goes when every window that came back is ready
    const wait = () => { const ws = D.WN(), n = ws.filter(w => w.ready).length; bootTo(65 + (ws.length ? 30 * n / ws.length : 30)); if (n === ws.length && K.net.busy === 0) D.bootEnd(); else if (n === ws.length) setTimeout(wait, 120); };
    D.on("winready", wait); setTimeout(wait, 120);
    D.tick(); D.pollJobs(); D.lessons().then(() => D.emit("lessons")).catch(() => {});
  })();
})();
