// LAPP work desktop · windows: one standard window for every app.
// Title bar = icon · title · the app's menus · the app's buttons · window controls. The single border shows the state.
// A window keeps its page (iframe) for its whole life; moving, snapping or hiding it never reloads it.
"use strict";
(function () {
  const { $, $$, esc, I } = D;
  let WN = [], Z = 10, WID = 1;
  D.WN = () => WN; D.ACTW = null;
  const W = D.W = id => WN.find(w => w.id === +id);
  const AREA = () => $("#wins").getBoundingClientRect();
  const device = () => matchMedia("(pointer:coarse)").matches && innerWidth < 760 ? "mobile" : "desktop";
  const embed = url => { const u = new URL(url, location.origin); if (!u.pathname.startsWith("/api/")) { u.searchParams.set("embed", "1"); u.searchParams.set("device", device()); } return u.pathname + u.search + u.hash; };
  const norm = D.norm = url => { const u = new URL(url, location.origin); u.searchParams.delete("embed"); u.searchParams.delete("device"); return u.pathname + u.search + u.hash; };
  const post = D.post = (w, m) => { try { w.fr.contentWindow.postMessage({ lapp: 1, ...m }, location.origin); } catch {} };   // a message to the page in a window

  D.openWin = (url, o = {}) => {
    url = norm(url);
    let w = WN.find(x => x.url === url);
    if (w) { if (w.ws !== D.CUR) D.switchWs(w.ws); D.focusWin(w); return w; }
    const ws = o.ws || D.wsFor(url);
    if (ws !== D.CUR && !o.quiet) D.switchWs(ws);
    const A = AREA(), n = WN.filter(x => x.ws === ws).length, app = D.appOf(url);
    const g = o.geo || { x: Math.round(A.width * (.04 + (n % 6) * .03)), y: Math.round(A.height * (.03 + (n % 6) * .04)), w: Math.round(Math.max(Math.min(A.width * .72, 1240), Math.min(820, A.width - 20))), h: Math.round(A.height * .86) };
    w = { id: WID++, url, ws, title: o.title || (app ? app.title : "Loading…"), icon: o.icon || (app ? app.icon : "window"), lesson: o.lesson || null, as: D.asOf(url), ...g, min: !!o.min, snap: null, used: Date.now(), state: "", chrome: null };
    const el = document.createElement("section"); el.className = "wnd"; el.dataset.w = w.id;
    el.innerHTML = `<div class="wbar"><button class="wback" data-wc="back" hidden aria-label="Back">${I("back")}</button><span class="wi"></span><span class="tt"></span><span class="otag" hidden></span><nav class="wmenu" aria-label="Menus"></nav><span class="sp"></span><div class="wacts"></div>
      <div class="wctl"><button data-wc="min" title="Minimise">${I("minus", 15)}</button><button data-wc="max" title="Maximise · rest the pointer here for layouts">${I("square", 13)}</button><button class="cl" data-wc="close" title="Close">${I("x", 15)}</button></div></div>
      <div class="wfr"><iframe src="${esc(embed(url))}"${D.asOf(url) ? ` name="lapp-as${D.asOf(url)}"` : ""} allow="microphone; autoplay; clipboard-write"></iframe><div class="k-wload"><div class="c"><span class="app">${I(w.icon, 22) || I("window", 22)}</span><span class="k-load creep"><i></i></span></div></div></div>${["n", "s", "e", "w", "ne", "nw", "se", "sw"].map(d => `<i class="rz ${d === "sw" ? "bl" : d}" data-rz="${d}"></i>`).join("")}`;
    w.el = el; w.fr = $("iframe", el); WN.push(w); $("#wins").append(el);
    // pages of the system say when they are there (their first title); a file or another page: when it has loaded
    // a file (no page of ours) is there when it has loaded; our pages say so themselves ("ready", from /ui/frame.js)
    w.fr.addEventListener("load", () => { if (!/^\/(admin|studio|files|settings|s\/)/.test(w.url)) ready(w); });
    setTimeout(() => ready(w), 20000);
    dress(w); place(w);
    if (!o.quiet) { D.recent(w); D.focusWin(w); } else { el.style.zIndex = ++Z; D.emit("wins"); }
    D.save();
    return w;
  };
  D.recent = w => { if (!D.DESK) return; D.DESK.recent = [{ url: w.url, title: w.title, icon: w.icon, lesson: w.lesson, at: Date.now() }, ...(D.DESK.recent || []).filter(r => r.url !== w.url)].slice(0, 12); };

  function dress(w) {
    const c = D.wsOf(w.ws).color;
    w.el.style.setProperty("--c", c);
    w.el.dataset.state = w.state || "";
    $(".wi", w.el).innerHTML = I(w.icon, 16) || D.IE(w.icon); $(".tt", w.el).textContent = w.title;
    w.el.setAttribute("aria-label", w.title); w.fr.title = w.title;
    // the organisation's name only when the same app is open for two organisations at once
    const k = D.appKey(w.url).replace(/@.*/, "").replace(/^s:[^:]+:/, "s:"), twin = WN.some(x => x !== w && x.ws !== w.ws && D.appKey(x.url).replace(/@.*/, "").replace(/^s:[^:]+:/, "s:") === k && !x.el.classList.contains("ows"));
    const tag = $(".otag", w.el); tag.hidden = !twin; tag.textContent = twin ? D.wsOf(w.ws).name : "";
    drawChrome(w);
  }
  D.dress = dress;

  /* ---------- the app's menus and buttons in the title bar ---------- */
  function drawChrome(w) {
    const c = w.chrome || { actions: [], menus: [] };
    const back = $(".wback", w.el); back.hidden = c.backI == null; back.title = c.back || "Back";
    $(".wmenu", w.el).innerHTML = [...(c.menus || []).map((m, i) => `<button data-wm="${i}">${esc(m.label)}</button>`), `<button data-wm="win">Window</button>`, `<button data-wm="help">Help</button>`].join("");
    const groups = {}, out = [];
    (c.actions || []).forEach(a => { if (a.group) { if (!groups[a.group]) { groups[a.group] = []; out.push({ seg: groups[a.group] }); } groups[a.group].push(a); } else out.push(a); });
    const btn = a => { const ic = window.Icon && Icon.fromEmoji(a.icon); return `<button class="wa ${a.primary ? "pr" : ""} ${a.danger ? "dz" : ""} ${a.on ? "on" : ""}" data-wa="${a.i}" ${a.disabled ? "disabled" : ""} title="${esc(a.label)}">${ic ? I(ic, 14) : a.icon ? `<span>${esc(a.icon)}</span>` : ""}${a.iconOnly && (ic || a.icon) ? "" : `<span class="wl">${esc(a.label)}</span>`}</button>`; };
    const box = $(".wacts", w.el); box.classList.remove("compact");
    box.innerHTML = out.map(x => x.seg ? `<span class="seg">${x.seg.map(btn).join("")}</span>` : btn(x)).join("");
    requestAnimationFrame(() => { if (box.scrollWidth > box.clientWidth + 1) box.classList.add("compact"); });
  }
  K.ctx(t => { const b = t.closest(".wbar"), el = b && b.closest(".wnd"), w = el && WN.find(x => String(x.id) === el.dataset.w); return w ? [{ head: w.title }, ...winMenu(w)] : null; });
  function winMenu(w) {
    return [{ label: "Reload", icon: "reload", run: () => { w.fr.src = embed(w.url); } }, "-",
      { label: "Left half", icon: "sidebar", key: D.nice(D.BIND.left), run: () => snap(w, "left") }, { label: "Right half", icon: "sidebar", key: D.nice(D.BIND.right), run: () => snap(w, "right") },
      { label: w.snap ? "Restore" : "Maximise", icon: w.snap ? "restore" : "maximize", key: D.nice(D.BIND.max), run: () => toggleMax(w) }, { label: "Minimise", icon: "minus", key: D.nice(D.BIND.min), run: () => minWin(w) }, "-",
      { label: "Shortcut on the desktop", icon: "desktop", run: () => { D.addIcon({ n: w.title, i: w.icon, url: w.url, lesson: w.lesson }); D.toast("Shortcut on the desktop"); } },
      { label: "Ask the AI about it", icon: "ai", run: () => D.ask(`Explain the window “${w.title}” and what I can do there`, w) }, "-",
      { label: "Close", icon: "x", key: D.nice(D.BIND.close), danger: true, run: () => closeWin(w) }];
  }
  function openMenu(w, b) {
    const i = b.dataset.wm, list = i === "help" ? [{ label: "About " + w.title, icon: "info", run: () => D.info(w, b) }, { label: "Guide", icon: "guide", run: () => D.guide() }, { label: "Keyboard shortcuts", icon: "keyboard", run: () => D.keysSheet() }, "-", { label: "Ask the AI about it", icon: "ai", run: () => D.ask(`Explain the window “${w.title}” and what I can do there`, w) }] : i === "win" ? winMenu(w) : (w.chrome.menus[+i].items || []).map(it => it === "-" ? "-" : { ...it, run: () => post(w, { t: "cmd", kind: "menu", id: it.id }) });
    // a page may still name its icons with an emoji: they become ours
    const icons = it => it === "-" || !it || it.head ? it : { ...it, icon: window.Icon && it.icon ? (Icon.names.includes(it.icon) ? it.icon : Icon.fromEmoji(it.icon)) || "" : it.icon, sub: it.sub && it.sub.map(icons) };
    K.menuAt(b, list.map(icons));
  }

  function place(w) { Object.assign(w.el.style, { left: w.x + "px", top: w.y + "px", width: w.w + "px", height: w.h + "px" }); w.el.classList.toggle("min", !!w.min); w.el.classList.toggle("full", w.snap === "max"); w.el.classList.toggle("ows", w.ws !== D.CUR); }
  D.place = place;
  D.focusWin = w => {
    WN.forEach(x => x.el.classList.toggle("act", x === w));
    if (w) { w.min = false; w.el.style.zIndex = ++Z; w.used = Date.now(); place(w); }
    D.ACTW = w ? w.id : null; D.emit("wins"); D.save();
    document.title = (w ? w.title + " · " : "") + "LAPP";
  };
  const topWin = D.topWin = () => WN.filter(x => !x.min && x.ws === D.CUR).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0] || null;
  const closeWin = D.closeWin = w => { if (!w) return; w.el.remove(); WN = WN.filter(x => x !== w); WN.forEach(dress); D.focusWin(topWin()); };
  const minWin = D.minWin = w => { if (!w) return; w.min = true; place(w); D.focusWin(topWin()); };
  const SNAP = D.SNAP = { left: [0, 0, .5, 1], right: [.5, 0, .5, 1], tl: [0, 0, .5, .5], tr: [.5, 0, .5, .5], bl: [0, .5, .5, .5], br: [.5, .5, .5, .5], max: [0, 0, 1, 1], l3: [0, 0, 1 / 3, 1], c3: [1 / 3, 0, 1 / 3, 1], r3: [2 / 3, 0, 1 / 3, 1], l23: [0, 0, 2 / 3, 1], r13: [2 / 3, 0, 1 / 3, 1] };
  const snap = D.snap = (w, k) => {
    if (!w || !SNAP[k]) return; const A = AREA(), [x, y, ww, hh] = SNAP[k];
    if (!w.snap) w.prev = { x: w.x, y: w.y, w: w.w, h: w.h };
    Object.assign(w, { x: Math.round(x * A.width), y: Math.round(y * A.height), w: Math.round(ww * A.width), h: Math.round(hh * A.height), snap: k, min: false });
    w.el.classList.add("anim"); place(w); setTimeout(() => w.el.classList.remove("anim"), 200); D.focusWin(w);
  };
  const restore = w => { if (!w) return; if (w.prev) Object.assign(w, w.prev); w.snap = null; w.el.classList.add("anim"); place(w); setTimeout(() => w.el.classList.remove("anim"), 200); D.focusWin(w); };
  const toggleMax = D.toggleMax = w => w && (w.snap ? restore(w) : snap(w, "max"));
  D.setState = (w, s) => { if (!w) return; w.state = s || ""; w.el.dataset.state = w.state; D.emit("state", w); };

  /* ---------- workspaces ---------- */
  D.switchWs = key => {
    if (!D.WS.some(w => w.key === key) || key === D.CUR) return;
    D.CUR = key; WN.forEach(place); WN.forEach(dress);
    const last = WN.filter(x => x.ws === key && !x.min).sort((a, b) => (b.used || 0) - (a.used || 0))[0];
    D.focusWin(last || null); D.emit("ws");
  };

  D.snapshot = () => {
    D.DESK.windows = WN.map(w => ({ url: w.url, ws: w.ws, title: w.title, icon: w.icon, lesson: w.lesson, x: w.x, y: w.y, w: w.w, h: w.h, min: w.min, snap: w.snap, act: w.id === D.ACTW }));
    D.DESK.cur = D.CUR;
  };
  addEventListener("resize", () => { WN.filter(w => w.snap).forEach(w => { const A = AREA(), [x, y, ww, hh] = SNAP[w.snap]; Object.assign(w, { x: Math.round(x * A.width), y: Math.round(y * A.height), w: Math.round(ww * A.width), h: Math.round(hh * A.height) }); place(w); }); });

  /* ---------- clicks in the title bar ---------- */
  document.addEventListener("click", e => {
    const t = e.target, wnd = t.closest && t.closest(".wnd"); if (!wnd) return;
    const w = W(wnd.dataset.w);
    const wc = t.closest("[data-wc]");
    if (wc) { const k = wc.dataset.wc; if (k === "close") closeWin(w); if (k === "min") minWin(w); if (k === "max") toggleMax(w); if (k === "back") post(w, { t: "cmd", kind: "action", i: w.chrome.backI }); return; }
    const wm = t.closest("[data-wm]"); if (wm) { e.stopPropagation(); return openMenu(w, wm); }
    const wa = t.closest("[data-wa]"); if (wa) { post(w, { t: "cmd", kind: "action", i: +wa.dataset.wa }); }
  });
  document.addEventListener("dblclick", e => { const bar = e.target.closest && e.target.closest(".wbar"); if (bar && !e.target.closest("button")) toggleMax(W(bar.parentElement.dataset.w)); });

  function ready(w) {
    if (w.ready) return; w.ready = true;
    const c = w.el && $(".k-wload", w.el); if (c) { const b = $(".k-load i", c); b.style.animation = "none"; b.style.width = "100%"; setTimeout(() => { c.classList.add("out"); setTimeout(() => c.remove(), 400); }, 120); }
    D.emit("winready");
  }
  /* ---------- messages from the pages ---------- */
  addEventListener("message", e => {
    if (e.origin !== location.origin || !e.data || !e.data.lapp) return;
    const w = WN.find(x => x.fr.contentWindow === e.source), d = e.data;
    if (d.t === "key") { if (d.combo === "Escape") { D.ccClose && D.ccClose(); return D.closeMenus(); } const a = Object.keys(D.BIND).find(k => D.BIND[k] === d.combo); if (a) { if (w && w.id !== D.ACTW) D.focusWin(w); D.act(a); } else if (D.ccKey) D.ccKey(d.combo); return; }
    if (d.t === "open" && typeof d.url === "string" && /^\/(admin|studio|files|settings|s\/|api\/desk\/files\/\d+$)/.test(d.url)) return D.openWin(d.url, d.title ? { title: String(d.title).slice(0, 120), icon: "file" } : {});
    if (d.t === "note") return D.note({ text: String(d.text || ""), kind: d.kind, from: w ? w.title : "", url: w ? w.url : "", lesson: w ? w.lesson : null });
    if (d.t === "alive") return;
    if (d.t === "ask" && typeof d.text === "string") return D.ask(d.text.slice(0, 1200), w);
    if (!w) return;
    if (d.t === "settings" && /^\/settings/.test(w.url)) return D.settings(String(d.key), d.value);
    if (d.t === "state") return D.setState(w, ["busy", "ai", "dirty", "error", "ok", "rec"].includes(d.state) ? d.state : "");
    if (d.t === "ready") return ready(w);
    if (d.t === "chrome") { w.chrome = { title: String(d.title || ""), back: d.back || "", backI: Number.isInteger(d.backI) ? d.backI : null, actions: Array.isArray(d.actions) ? d.actions.slice(0, 30) : [], menus: Array.isArray(d.menus) ? d.menus.slice(0, 8) : [] }; if (w.title === "Loading…" && w.chrome.title) { w.title = w.chrome.title; } return dress(w); }
    if (d.t === "title") {
      if (d.title) w.title = String(d.title); if (d.icon) w.icon = window.Icon && Icon.fromEmoji(d.icon) || String(d.icon); if (d.lesson) w.lesson = { id: String(d.lesson.id), title: String(d.lesson.title) };
      if (d.url) { const u = norm(d.url); if (!WN.some(x => x !== w && x.url === u)) w.url = u; }
      dress(w); D.emit("wins"); D.save();
    }
  });
  // a click inside a window's page brings that window forward
  addEventListener("blur", () => setTimeout(() => { const f = document.activeElement; if (f && f.tagName === "IFRAME") { const w = WN.find(x => x.fr === f); if (w && w.id !== D.ACTW) D.focusWin(w); D.ccClose && D.ccClose(); D.closeMenus(); } }, 0));

  /* ---------- the layouts on ▢ ---------- */
  let flyT;
  document.addEventListener("mouseover", e => {
    if (!e.target.closest) return;
    if (e.target.closest(".snapfly")) return clearTimeout(flyT);
    const mx = e.target.closest('[data-wc="max"]');
    clearTimeout(flyT); if (!mx || innerWidth < 760) return;
    flyT = setTimeout(() => {
      $(".snapfly")?.remove(); const w = mx.closest(".wnd").dataset.w, f = document.createElement("div"); f.className = "snapfly"; f.setAttribute("role", "menu");
      const L = [["grid-template-columns:1fr 1fr", ["left", "right"]], ["grid-template-columns:2fr 1fr", ["l23", "r13"]], ["grid-template-columns:1fr 1fr 1fr", ["l3", "c3", "r3"]], ["grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr", ["tl", "tr", "bl", "br"]]];
      f.innerHTML = L.map(([st, ks]) => `<div class="lay" style="${st}">${ks.map(k => `<button data-snapk="${k}" data-w="${w}" aria-label="${k}"></button>`).join("")}</div>`).join("");
      const r = mx.getBoundingClientRect(); f.style.left = Math.max(8, Math.min(r.left - 150, innerWidth - 320)) + "px"; f.style.top = r.bottom + 6 + "px"; document.body.append(f);
    }, 450);
  });
  document.addEventListener("click", e => { const sk = e.target.closest && e.target.closest("[data-snapk]"); if (sk) { snap(W(sk.dataset.w), sk.dataset.snapk); D.closeMenus(); } });

  /* ---------- moving and resizing (the shared K.drag) ---------- */
  document.addEventListener("pointerdown", e => {
    const t = e.target; if (e.button || !t.closest) return;
    const rz = t.closest("[data-rz]");
    if (rz) {
      const w = W(rz.closest(".wnd").dataset.w), d = rz.dataset.rz; D.focusWin(w); if (w.snap) { w.snap = null; w.el.classList.remove("full"); }
      const o = { x: w.x, y: w.y, w: w.w, h: w.h }; e.preventDefault();
      return K.drag(e, { move: (dx, dy) => {
        const A = AREA(), mw = Math.min(640, A.width), mh = 240;
        if (d.includes("e")) w.w = Math.max(mw, o.w + dx);
        if (d.includes("s")) w.h = Math.max(mh, o.h + dy);
        if (d.includes("w")) { w.w = Math.max(mw, o.w - dx); w.x = o.x + o.w - w.w; }
        if (d.includes("n")) { w.h = Math.max(mh, o.h - dy); w.y = Math.max(0, o.y + o.h - w.h); }
        place(w); drawChrome(w);
      }, end: () => D.save() });
    }
    const wb = t.closest(".wbar");
    if (wb && !t.closest("button") && innerWidth > 760) {
      const w = W(wb.parentElement.dataset.w); D.focusWin(w);
      const r = w.el.getBoundingClientRect(); let ox = e.clientX - r.left; const oy = e.clientY - r.top; let edge = null; e.preventDefault();
      return K.drag(e, { move: (dx, dy, ev) => {
        const A = AREA();
        // a snapped window comes loose once it is pulled a little, at its old size
        if (w.snap) { if (Math.abs(dx) + Math.abs(dy) < 8) return; const p = w.prev || { w: w.w * .7, h: w.h * .8 }; w.snap = null; w.w = p.w; w.h = p.h; ox = Math.min(ox, w.w / 2); w.el.classList.remove("full"); }
        w.x = Math.round(ev.clientX - A.left - ox); w.y = Math.max(0, Math.round(ev.clientY - A.top - oy)); place(w);
        const px = ev.clientX - A.left, py = ev.clientY - A.top, g = $("#ghost");
        edge = py < 4 ? "max" : px < 8 ? (py < A.height * .2 ? "tl" : py > A.height * .8 ? "bl" : "left") : px > A.width - 8 ? (py < A.height * .2 ? "tr" : py > A.height * .8 ? "br" : "right") : null;
        g.hidden = !edge; if (edge) { const [a, b, c, h] = SNAP[edge]; Object.assign(g.style, { left: a * A.width + 6 + "px", top: b * A.height + 6 + "px", width: c * A.width - 12 + "px", height: h * A.height - 12 + "px", zIndex: Z + 1 }); }
      }, end: () => { if (edge) snap(w, edge); $("#ghost").hidden = true; D.save(); } });
    }
    const wn = t.closest(".wnd"); if (wn) { const w = W(wn.dataset.w); if (w.id !== D.ACTW) D.focusWin(w); }
  });
})();
