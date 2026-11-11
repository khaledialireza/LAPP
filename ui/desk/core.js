// LAPP work desktop · core: shared state, keys, notifications, sheets. Helpers, toasts, menus and dialogs come from the kit.
// Every other desk module uses window.D (one namespace, no globals of its own).
"use strict";
(function () {
  const D = window.D = {};
  // the shared kit (ui/kit.js, ui/menu.js): the desk never has its own copy
  Object.assign(D, { $: K.$, $$: K.$$, esc: K.esc, I: K.I, IE: K.IE, LS: K.LS, loc: K.loc, hm: K.time, ago: K.ago, KIND: K.KIND });
  D.api = K.apiAt("/api", { next: "/manage" });
  D.ME = null; D.ORGS = []; D.DESK = null; D.FILES = [];

  /* ---------- saving the desktop (layout, windows, keys, pins, groups) ---------- */
  let saveT;
  D.save = () => {
    if (!D.DESK) return;
    if (D.snapshot) D.snapshot();
    D.DESK.keys = Object.fromEntries(Object.entries(D.BIND).filter(([k, v]) => D.DEF[k] !== v));
    clearTimeout(saveT); saveT = setTimeout(() => D.api("PUT", "/desk", D.DESK).catch(e => D.toast("Your desktop wasn't saved: " + e.message, { kind: "err" })), 800);
  };

  /* ---------- the person's keys ---------- */
  D.ACTIONS = { cc: "Open the command center", ai: "Ask the AI", tasks: "Open windows (task manager)", close: "Close the window", min: "Minimise the window", max: "Maximise / restore", left: "Snap to the left half", right: "Snap to the right half", next: "Next window", ws: "Next workspace", desk: "Show the desktop", widget: "Add a widget" };
  D.DEF = { cc: "Ctrl+K", ai: "Ctrl+J", tasks: "Alt+T", close: "Alt+W", min: "Alt+M", max: "Ctrl+Alt+ArrowUp", left: "Ctrl+Alt+ArrowLeft", right: "Ctrl+Alt+ArrowRight", next: "Alt+`", ws: "Alt+Q", desk: "Ctrl+Alt+D", widget: "Alt+N" };
  D.MAC = K.MAC;
  if (D.MAC) Object.assign(D.DEF, { cc: "Cmd+K", ai: "Cmd+J" });   // ⌘K and ⌘J, as on every Mac app; the rest use ⌃ ⌥ so they never clash with the browser
  D.BIND = { ...D.DEF }; D.REC = null;
  // a Mac has ⌘ Command, ⌥ Option and ⌃ Control: Command and Control are different keys there; elsewhere Ctrl (or the Windows key) is one
  D.combo = K.combo;
  D.nice = K.keyLabel;
  D.shareKeys = () => D.LS.set("lapp.keys", D.BIND);      // the pages inside windows read this and pass the keys up
  D.ACT = {};                                             // action name → function (filled by the modules)
  D.act = a => D.ACT[a] && D.ACT[a]();

  /* ---------- notifications and toasts ---------- */
  D.NOTES = []; D.JOBS = [];
  D.toast = (text, o = {}) => K.toast(text, o);
  D.note = n => { D.NOTES.unshift({ id: String(Date.now() + Math.random()), at: Date.now(), ...n }); D.NOTES.length = Math.min(D.NOTES.length, 50); D.emit("notes"); };

  /* ---------- the event channel between modules (the shared K.events) ---------- */
  const BUS = K.events(); D.on = BUS.on; D.emit = BUS.emit;

  /* ---------- menus and popovers: the shared ones (K.menu, K.pop) ---------- */
  D.closeMenus = () => { K.closeMenu(); K.closePops(); D.$$(".snapfly, .prev").forEach(x => x.remove()); D.$$(".wmenu button.open, .tr.open").forEach(b => b.classList.remove("open")); };
  // items: { label, icon, key, run, danger, on, disabled, sub } | "-" | { head } (or the short [label, key, run, danger, icon, {on, disabled}])
  D.cmenu = (x, y, L, o = {}) => { D.closeMenus(); return K.menu(x, y, L, o); };
  // a popover above the taskbar, anchored to a button
  D.pop = (anchor, html, cls = "") => { D.closeMenus(); return K.pop(anchor, html, { className: cls, above: true }); };

  /* ---------- sheets ---------- */
  D.sheet = html => { D.closeSheet(); if (D.ccClose) D.ccClose(); const s = document.createElement("div"); s.className = "sheet"; s.id = "sheet"; s.setAttribute("role", "dialog"); s.innerHTML = html; document.body.append(s); return s; };
  D.closeSheet = () => { D.$("#sheet")?.remove(); D.REC = null; };
  D.askName = (title, value) => { D.closeSheet(); return K.ask({ title, value, label: "Name", max: 120 }); };
  D.keysSheet = () => {
    const s = D.$("#sheet") && D.$("#sheet").dataset.k ? D.$("#sheet") : D.sheet(""); s.dataset.k = 1;
    s.innerHTML = `<h4>${D.I("keyboard")} Keyboard shortcuts<button data-sx aria-label="Close">${D.I("x")}</button></h4><p class="mu sm" style="margin-bottom:8px">Click “Change”, then press the new keys. Esc cancels. They work inside every window too, and are saved with your account.</p>`
      + Object.entries(D.ACTIONS).map(([k, l]) => { const clash = Object.entries(D.BIND).find(([o, v]) => o !== k && v === D.BIND[k]); return `<div class="kbr ${D.REC === k ? "rec" : ""} ${clash ? "clash" : ""}"><span>${D.esc(l)}${clash ? `<br><small style="color:var(--rd)">same keys as “${D.esc(D.ACTIONS[clash[0]])}”</small>` : ""}</span><span class="kcap">${D.REC === k ? "press keys…" : D.esc(D.nice(D.BIND[k]))}</span><button class="b" data-rec="${k}">${D.REC === k ? "Cancel" : "Change"}</button></div>`; }).join("")
      + `<div style="display:flex;gap:8px;margin-top:10px"><button class="b" data-keyreset>Reset to the defaults</button></div>`;
  };
})();
