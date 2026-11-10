// LAPP work desktop · core: shared state, helpers, API, keys, toasts, menus, sheets.
// Every other desk module uses window.D (one namespace, no globals of its own).
"use strict";
(function () {
  const D = window.D = {};
  D.$ = (s, r = document) => r.querySelector(s); D.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  D.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  D.I = (n, s = 16) => window.Icon ? Icon(n, s) : "";
  D.IE = (e, s = 16) => { const n = window.Icon && Icon.fromEmoji(e); return n ? Icon(n, s) : D.esc(e || ""); };   // an emoji from a page → our icon
  D.GRAD = ["#FF6B9A,#8A6CF0", "#F59E0B,#EF4444", "#34D399,#22D3EE", "#22D3EE,#8B5CF6", "#8B5CF6,#FF3D7F", "#FBBF24,#34D399"];
  D.LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  D.loc = () => window.PanelI18N ? PanelI18N.locale : "en-GB";
  D.hm = t => new Date(t).toLocaleTimeString(D.loc(), { hour: "2-digit", minute: "2-digit" });
  D.ago = ms => { const m = (Date.now() - ms) / 6e4; return m < 1 ? "now" : m < 60 ? Math.round(m) + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
  D.api = async (m, p, b, raw) => {
    const headers = raw ? { "X-LAPP": "1", ...raw.headers } : { ...(b ? { "Content-Type": "application/json" } : {}), ...(m !== "GET" ? { "X-LAPP": "1" } : {}) };
    const r = await fetch("/api" + p, { method: m, credentials: "same-origin", headers, body: raw ? raw.body : b ? JSON.stringify(b) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { location.href = "/?login=1&next=/manage"; throw new Error("signed out"); }
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  };
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
  D.BIND = { ...D.DEF }; D.REC = null;
  D.combo = e => { if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return ""; const k = e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.code === "Backquote" ? "`" : e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key; return [(e.ctrlKey || e.metaKey) && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", k].filter(Boolean).join("+"); };
  D.nice = c => String(c || "").replace("ArrowLeft", "←").replace("ArrowRight", "→").replace("ArrowUp", "↑").replace("ArrowDown", "↓").replace("Escape", "Esc");
  D.shareKeys = () => D.LS.set("lapp.keys", D.BIND);      // the pages inside windows read this and pass the keys up
  D.ACT = {};                                             // action name → function (filled by the modules)
  D.act = a => D.ACT[a] && D.ACT[a]();

  /* ---------- notifications and toasts ---------- */
  D.NOTES = []; D.JOBS = [];
  D.KIND = { ok: ["check", "rgba(52,211,153,.2)"], info: ["info", "rgba(96,165,250,.2)"], warn: ["alert", "rgba(251,191,36,.2)"], err: ["x", "rgba(248,113,113,.2)"] };
  D.toast = (text, o = {}) => {
    const [ic, bg] = D.KIND[o.kind || "ok"] || D.KIND.info, t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", o.kind === "err" ? "alert" : "status");
    t.innerHTML = `<span class="i" style="background:${bg}">${D.I(ic, 14)}</span><span>${D.esc(text)}</span>${o.action ? `<button class="a">${D.esc(o.action)}</button>` : ""}`;
    if (o.action) D.$(".a", t).onclick = () => { t.remove(); o.run(); };
    D.$("#toasts").prepend(t); setTimeout(() => t.remove(), o.action ? 7000 : 3600);
  };
  D.note = n => { D.NOTES.unshift({ id: String(Date.now() + Math.random()), at: Date.now(), ...n }); D.NOTES.length = Math.min(D.NOTES.length, 50); D.emit("notes"); };

  /* ---------- tiny event bus between modules ---------- */
  const L = {};
  D.on = (e, f) => (L[e] = L[e] || []).push(f);
  D.emit = (e, ...a) => (L[e] || []).forEach(f => { try { f(...a); } catch (x) { console.error(x); } });

  /* ---------- our menus (right-click, title bar menus, taskbar) ---------- */
  D.closeMenus = () => { D.$$(".cm, .snapfly, .prev, .pop").forEach(x => x.remove()); D.$$(".wmenu button.open, .tr.open").forEach(b => b.classList.remove("open")); };
  // items: [label, key, run, danger, icon, {on, disabled}] | "-" | {head: "…"}
  D.cmenu = (x, y, L, o = {}) => {
    D.closeMenus(); const m = document.createElement("div"); m.className = "cm"; m.setAttribute("role", "menu");
    m.innerHTML = L.map((it, i) => it === "-" ? "<hr>" : it && it.head ? `<div class="ch">${D.esc(it.head)}</div>` : `<button data-i="${i}" role="menuitem" class="${it[3] ? "dz" : ""} ${it[5] && it[5].on ? "on" : ""}" ${it[5] && it[5].disabled ? "disabled" : ""}>${it[4] ? D.I(it[4], 15) : ""}<span>${D.esc(it[0])}</span>${it[1] ? `<span class="k">${D.esc(it[1])}</span>` : ""}</button>`).join("");
    document.body.append(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
    m.style.top = Math.max(8, Math.min(o.above ? y - h : y, innerHeight - h - 8)) + "px";
    m.onclick = e => { const b = e.target.closest("[data-i]"); if (b) { e.stopPropagation(); m.remove(); if (o.onClose) o.onClose(); L[+b.dataset.i][2](); } };
    m.addEventListener("keydown", e => { const bs = D.$$("button:not([disabled])", m), i = bs.indexOf(document.activeElement); if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); bs[(i + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length].focus(); } });
    D.$("button:not([disabled])", m)?.focus();
    return m;
  };
  // a popover above the taskbar, anchored to a button
  D.pop = (anchor, html, cls = "") => {
    D.closeMenus(); const p = document.createElement("div"); p.className = "pop " + cls; p.innerHTML = html; document.body.append(p);
    const r = anchor.getBoundingClientRect(); p.style.left = Math.max(8, Math.min(r.left + r.width / 2 - p.offsetWidth / 2, innerWidth - p.offsetWidth - 8)) + "px";
    anchor.classList.add("open"); return p;
  };

  /* ---------- sheets ---------- */
  D.sheet = html => { D.closeSheet(); if (D.ccClose) D.ccClose(); const s = document.createElement("div"); s.className = "sheet"; s.id = "sheet"; s.setAttribute("role", "dialog"); s.innerHTML = html; document.body.append(s); return s; };
  D.closeSheet = () => { D.$("#sheet")?.remove(); D.REC = null; };
  D.askName = (title, value) => new Promise(res => {
    const s = D.sheet(`<h4>${D.esc(title)}<button data-sx aria-label="Close">${D.I("x")}</button></h4><form id="nf" style="display:flex;flex-direction:column;gap:10px"><input class="in" name="v" value="${D.esc(value)}" maxlength="120" autocomplete="off" aria-label="Name"><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="b" data-sx>Cancel</button><button class="b pr">OK</button></div></form>`);
    const f = D.$("#nf", s), i = f.elements.v; i.focus(); i.select();
    f.onsubmit = e => { e.preventDefault(); const v = i.value.trim(); D.closeSheet(); res(v || null); };
    s.addEventListener("click", e => { if (e.target.closest("[data-sx]")) res(null); });
  });
  D.keysSheet = () => {
    const s = D.$("#sheet") && D.$("#sheet").dataset.k ? D.$("#sheet") : D.sheet(""); s.dataset.k = 1;
    s.innerHTML = `<h4>${D.I("keyboard")} Keyboard shortcuts<button data-sx aria-label="Close">${D.I("x")}</button></h4><p class="mu sm" style="margin-bottom:8px">Click “Change”, then press the new keys. Esc cancels. They work inside every window too, and are saved with your account.</p>`
      + Object.entries(D.ACTIONS).map(([k, l]) => { const clash = Object.entries(D.BIND).find(([o, v]) => o !== k && v === D.BIND[k]); return `<div class="kbr ${D.REC === k ? "rec" : ""} ${clash ? "clash" : ""}"><span>${D.esc(l)}${clash ? `<br><small style="color:var(--rd)">same keys as “${D.esc(D.ACTIONS[clash[0]])}”</small>` : ""}</span><span class="kcap">${D.REC === k ? "press keys…" : D.esc(D.nice(D.BIND[k]))}</span><button class="b" data-rec="${k}">${D.REC === k ? "Cancel" : "Change"}</button></div>`; }).join("")
      + `<div style="display:flex;gap:8px;margin-top:10px"><button class="b" data-keyreset>Reset to the defaults</button></div>`;
  };
})();
