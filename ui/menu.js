// LAPP menu — the ONE right-click / drop-down menu of the whole system (desktop, title bars, taskbar, Files,
// Studio lines, pages), and the ribbon. Needs /ui/kit.js; its look is .k-menu / .k-ribbon in /ui/kit.css.
//
// Every right-click in the system opens this menu (Shift + right-click: the browser's own, e.g. for spelling).
// Like Windows and macOS it has two parts: on top a row of the system's actions that work everywhere
// (cut, copy, paste, select all, ask the AI), below it what belongs to the spot that was clicked:
//   - a page with its own menu for a spot calls K.menu in its contextmenu listener: the row is added to it;
//   - or it registers K.ctx(target => items | null); the first that answers wins;
//   - links and pictures have their own items; anywhere else the row and "ask the AI" show.
//
// K.menu(x, y, items, options) → the menu element
//   items: "-" (a line) · { head: "Title" } · { label, icon, key, run, danger, on, disabled, sub: [items] }
//          (the old desktop form [label, key, run, danger, icon, { on, disabled }] still works)
//   options: header (HTML on top, e.g. a word card) · title (small heading) · search (true or a placeholder)
//            ask ({ placeholder, run(text) }: "ask the assistant") · above (open upwards from y) · onClose · ready(menu)
(function () {
  "use strict";
  const K = window.K; if (!K || K.menu) return;
  const { $, $$, esc, I } = K;
  const norm = it => Array.isArray(it) ? { label: it[0], key: it[1], run: it[2], danger: it[3], icon: it[4], ...(it[5] || {}) } : it && it.kbd && !it.key ? { ...it, key: it.kbd } : it;
  let ON_CLOSE = null;

  /* ---------- the right-click of the whole system ---------- */
  const EDIT = "input:not([type]),input[type=text],input[type=search],input[type=email],input[type=url],input[type=tel],input[type=number],input[type=password],textarea,[contenteditable=''],[contenteditable='true'],[contenteditable='plaintext-only']";
  const CTX = { at: 0, used: true }, SPOTS = [];
  K.ctx = f => { SPOTS.push(f); };
  // what was under the pointer and selected at the moment of the right-click (before any menu takes the focus)
  addEventListener("contextmenu", e => {
    if (e.shiftKey) { CTX.used = true; return; }
    const t = e.target.nodeType === 1 ? e.target : e.target.parentElement; if (!t || !t.closest) return;
    if (t.closest(".k-menu")) { e.preventDefault(); e.stopPropagation(); return; }
    const ed = t.closest(EDIT), s = getSelection();
    let sel = s && !s.isCollapsed ? String(s) : "", ss = null, se = null;
    if (ed && ed.value != null) { try { ss = ed.selectionStart; se = ed.selectionEnd; sel = ss != null && se > ss ? ed.value.slice(ss, se) : ""; } catch { ss = se = null; } }
    Object.assign(CTX, { at: Date.now(), used: false, t, ed: ed && !ed.disabled && !ed.readOnly ? ed : null, sel, ss, se, range: s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null });
  }, true);
  // nobody opened a menu for this spot: ours, with what the page registered (or a link's / a picture's items)
  addEventListener("contextmenu", e => {
    if (e.shiftKey || e.defaultPrevented) return;
    e.preventDefault();
    const t = CTX.t || e.target; let items = [];
    for (const f of SPOTS) { let r = null; try { r = f(t, e); } catch (x) { console.error(x); } if (r && r.length) { items = r; break; } }
    if (!items.length) items = own(t);
    K.menu(e.clientX, e.clientY, items);
  });
  const own = t => {
    const a = t.closest("a[href]"), img = t.closest("img[src]"), out = [];
    if (a && !/^javascript:/i.test(a.getAttribute("href"))) out.push({ label: "Open the link", icon: "external", run: () => a.click() }, { label: "Open in a new tab", icon: "window", run: () => window.open(a.href, "_blank", "noopener") }, { label: "Copy the link", icon: "link", run: () => K.copy(a.href) });
    if (img) out.push({ label: "Open the picture", icon: "image", run: () => window.open(img.src, "_blank", "noopener") }, { label: "Copy the picture's address", icon: "link", run: () => K.copy(img.src) });
    return out;
  };
  // the selection of the right-click comes back before cutting, pasting…
  function restore() {
    const ed = CTX.ed, s = getSelection();
    if (ed) { ed.focus({ preventScroll: true }); if (CTX.ss != null) { try { ed.setSelectionRange(CTX.ss, CTX.se); } catch {} return; } }
    if (CTX.range) { s.removeAllRanges(); s.addRange(CTX.range); }
  }
  function insert(text) {
    const ed = CTX.ed; if (!ed) return;
    restore();
    if (ed.value != null) {
      try { ed.setRangeText(text, ed.selectionStart ?? ed.value.length, ed.selectionEnd ?? ed.value.length, "end"); } catch { ed.value = text; }
      ed.dispatchEvent(new Event("input", { bubbles: true }));
    } else document.execCommand("insertText", false, text);
  }
  const mod = k => (K.MAC ? "Cmd+" : "Ctrl+") + k;
  // what the AI is asked about: the selection, else the text of the spot
  const about = () => (CTX.sel || (CTX.t && (CTX.t.closest("[data-ai-about]")?.dataset.aiAbout || CTX.t.innerText)) || "").replace(/\s+/g, " ").trim().slice(0, 600);
  const SYS = {
    cut: () => { K.copy(CTX.sel); insert(""); },
    copy: () => K.copy(CTX.sel),
    paste: () => { restore(); (navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : Promise.reject()).then(insert).catch(() => K.toast(`This browser pastes only with the keys: ${K.keyLabel(mod("V"))}`, { kind: "info" })); },
    all: () => {
      const ed = CTX.ed, s = getSelection();
      if (ed) { ed.focus(); if (ed.select) ed.select(); else { const r = document.createRange(); r.selectNodeContents(ed); s.removeAllRanges(); s.addRange(r); } return; }
      const r = document.createRange(); r.selectNodeContents((CTX.t && CTX.t.closest("main, #view, article, section, .pn")) || document.body); s.removeAllRanges(); s.addRange(r);
    },
  };
  const sysRow = () => {
    const ed = CTX.ed, has = !!CTX.sel;
    const b = (k, ic, l, on, key) => `<button type="button" data-sys="${k}" ${on ? "" : "disabled"} title="${esc(l)}${key ? " · " + esc(K.keyLabel(key)) : ""}">${I(ic, 16)}<span>${esc(l)}</span></button>`;
    return `<div class="sys" role="group" aria-label="Edit">${b("cut", "cut", "Cut", ed && has, mod("X"))}${b("copy", "copy", "Copy", has, mod("C"))}${b("paste", "paste", "Paste", !!ed, mod("V"))}${b("all", "select-all", "Select all", true, mod("A"))}</div>`;
  };
  K.closeMenu = () => { const had = $$(".k-menu"); had.forEach(m => m.remove()); if (had.length && ON_CLOSE) { const f = ON_CLOSE; ON_CLOSE = null; f(); } };
  K.menuOpen = () => !!$(".k-menu");

  const row = (it, path) => {
    if (it === "-") return `<hr>`;
    if (it.head) return `<div class="mh">${esc(it.head)}</div>`;
    const tail = it.sub ? `<span class="ar">${I("chevron", 13)}</span>` : it.key ? `<kbd>${esc(it.key)}</kbd>` : "";
    const cls = `it ${it.danger ? "dz" : ""} ${it.on ? "on" : ""}`, lab = esc(String(it.label).toLowerCase());
    // a group with a sub-menu is a div: a button can't hold the buttons of its sub-menu
    return it.sub
      ? `<div class="${cls}" role="menuitem" tabindex="-1" aria-haspopup="true" data-p="${path}" data-l="${lab}">${it.icon ? K.IE(it.icon, 15) : ""}<span class="t">${esc(it.label)}</span>${tail}<div class="sub" role="menu">${it.sub.map(norm).map((s, j) => row(s, path + "." + j)).join("")}</div></div>`
      : `<button class="${cls}" role="menuitem" data-p="${path}" data-l="${lab}" ${it.disabled ? "disabled" : ""}>${it.icon ? K.IE(it.icon, 15) : ""}<span class="t">${esc(it.label)}</span>${tail}</button>`;
  };

  K.menu = (x, y, items, o = {}) => {
    K.closeMenu(); K.closePops && K.closePops();
    const L = items.map(norm), m = document.createElement("div");
    // opened by a right-click: the system's row on top, and "ask the AI" at the bottom when the page has none
    const sys = !o.noSystem && !CTX.used && Date.now() - CTX.at < 5000; if (sys) CTX.used = true;
    if (sys && !o.ask) o = { ...o, ask: { placeholder: "Search or ask…", run: v => { const t = about(); K.askAI(t ? `${v}\n\nAbout: “${t}”` : v); } } };
    if (o.ask) o = { ...o, search: false };   // one field: it searches the items, Enter asks the AI
    m.className = "k-menu " + (o.className || ""); m.setAttribute("role", "menu");
    m.innerHTML = `${o.header || ""}${sys ? sysRow() : ""}${o.search && L.length ? `<div class="q">${I("search", 14)}<input placeholder="${esc(o.search === true ? "Search…" : o.search)}" aria-label="Search actions"></div>` : ""}${o.title && L.length ? `<div class="mh">${esc(o.title)}</div>` : ""}<div class="ls">${L.map((it, k) => row(it, String(k))).join("")}</div>${o.ask ? `<div class="ask"><span class="spark">${I("ai", 14)}</span><input placeholder="${esc(o.ask.placeholder || "Search or ask…")}" aria-label="Search or ask the AI"></div>` : ""}`;
    document.body.append(m);
    ON_CLOSE = o.onClose || null;
    const w = m.offsetWidth, h = m.offsetHeight, hasSub = L.some(it => it && it.sub);
    m.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + "px";
    m.style.top = Math.max(6, Math.min(o.above ? y - h : y, innerHeight - h - 6)) + "px";
    if (hasSub && x + w + 210 > innerWidth) m.classList.add("flip");   // no room on the right: sub-menus open on the left
    const find = p => p.split(".").reduce((a, k, d) => d ? (a.sub || [])[+k] && norm(a.sub[+k]) : L[+k], null);
    const run = el => { const it = find(el.dataset.p); if (!it || it.sub || it.disabled || !it.run) return; K.closeMenu(); it.run(); };
    m.addEventListener("click", e => {
      const sb = e.target.closest("[data-sys]"); if (sb && m.contains(sb)) { e.stopPropagation(); K.closeMenu(); SYS[sb.dataset.sys](); return; }
      const el = e.target.closest("[data-p]"); if (!el || !m.contains(el)) return; e.stopPropagation(); run(el);
    });
    // a sub-menu stays inside the window: it moves up when it would run past the bottom
    const place = g => { const sub = $(":scope > .sub", g); if (!sub) return; sub.style.top = "-5px"; requestAnimationFrame(() => { const r = sub.getBoundingClientRect(), over = r.bottom - (innerHeight - 8); if (over > 0) sub.style.top = Math.max(-g.getBoundingClientRect().top + 8, -5 - over) + "px"; }); };
    m.addEventListener("pointerover", e => { const g = e.target.closest(".it[aria-haspopup]"); if (g && m.contains(g)) place(g); });
    // the keyboard: ↑ ↓ move, → opens a sub-menu, ← goes back, ↵ runs, Esc closes
    const vis = c => $$(":scope > .it:not([hidden]):not([disabled])", c);
    m.addEventListener("keydown", e => {
      const a = document.activeElement, c = a && a.closest(".sub, .ls");
      if (e.key === "Escape") { e.preventDefault(); K.closeMenu(); return; }
      if (!c || !a.matches(".it")) { if (e.key === "ArrowDown" && !a.closest(".ask")) { e.preventDefault(); vis($(".ls", m))[0]?.focus(); } return; }
      const list = vis(c), i = list.indexOf(a);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus(); }
      else if (e.key === "ArrowRight" && a.matches("[aria-haspopup]")) { e.preventDefault(); a.classList.add("hov"); place(a); vis($(".sub", a))[0]?.focus(); }
      else if (e.key === "ArrowLeft" && c.matches(".sub")) { e.preventDefault(); const g = c.parentElement; g.classList.remove("hov"); g.focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (a.matches("[aria-haspopup]")) { a.classList.add("hov"); place(a); vis($(".sub", a))[0]?.focus(); } else run(a); }
    });
    const q = $(".q input", m), filter = inp => {
        const s = inp.value.trim().toLowerCase();
        $$(".ls > .it", m).forEach(g => { const own = g.dataset.l.includes(s), subs = $$(".sub .it", g); subs.forEach(c => c.hidden = s && !own && !c.dataset.l.includes(s)); const hit = !s || own || subs.some(c => !c.hidden); g.hidden = !hit; g.classList.toggle("hov", !!s && hit && !own && subs.length > 0); if (g.classList.contains("hov")) place(g); });
        $$(".ls > hr, .ls > .mh", m).forEach(x => x.hidden = !!s);
      };
    if (q) {
      q.oninput = () => filter(q);
      // Enter runs the best match: a matching sub item first, then a plain item
      q.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const first = $(".ls .it.hov .sub .it:not([hidden]):not([disabled])", m) || $$(".ls > .it:not([hidden]):not([disabled])", m).find(g => !g.matches("[aria-haspopup]")); if (first) run(first); } };
    }
    const ask = $(".ask input", m);
    if (ask) {
      ask.oninput = () => filter(ask);
      ask.onkeydown = e => {
        if (e.key === "Enter" && ask.value.trim()) { e.preventDefault(); const v = ask.value.trim(); K.closeMenu(); o.ask.run(v); }
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const l = vis($(".ls", m)); (e.key === "ArrowDown" ? l[0] : l[l.length - 1])?.focus(); }
      };
    }
    if (o.ready) o.ready(m);
    (q || vis($(".ls", m))[0] || $(".sys button:not([disabled])", m))?.focus({ preventScroll: true });
    return m;
  };
  // a menu under a button (title-bar menus, "…" buttons)
  let SHUT = null;   // pressing the button of an open menu closes it (and doesn't open it again)
  K.menuAt = (btn, items, o = {}) => { if (SHUT && SHUT.b === btn && Date.now() - SHUT.t < 400) { SHUT = null; return null; } const r = btn.getBoundingClientRect(); btn.classList.add("open"); return K.menu(o.end ? r.right - 220 : r.left, o.above ? r.top - 4 : r.bottom + 4, items, { ...o, onClose: () => { btn.classList.remove("open"); o.onClose && o.onClose(); } }); };

  /* ---------- the ribbon: the actions of what is selected, in a bar you can move ---------- */
  // K.ribbon.show(items, { title, anchor }) while something is selected; K.ribbon.hide() when nothing is.
  // It starts at the bottom of the window (never on the text: it steps aside from the anchor), moves by its grip
  // (the place is kept per app; double-click the grip puts it back), rests while you type, and can be turned off —
  // the right-click has the same actions. items: { label, icon, run, sub, danger, on, disabled, iconOnly } · "-" a gap
  const RB = { el: null, items: [], o: {} };
  const posKey = () => "lapp.ribbon.pos." + (location.pathname.split("/")[1] || "home");
  function placeRibbon() {
    const el = RB.el, w = el.offsetWidth, h = el.offsetHeight, p = K.LS.get(posKey(), null);
    let x = p ? p.fx * innerWidth - w / 2 : (innerWidth - w) / 2, y = p ? p.fy * innerHeight : innerHeight - h - 16;
    const a = RB.o.anchor && RB.o.anchor.isConnected ? RB.o.anchor.getBoundingClientRect() : null;
    if (a && RB.o.above) { el.classList.add("mini"); el.style.left = Math.max(8, Math.min(a.right - w - 8, innerWidth - w - 8)) + "px"; el.style.top = Math.max(8, a.top - h - 6) + "px"; return; }
    if (a && y < a.bottom + 6 && y + h > a.top - 6) y = a.top - h - 10 > 8 ? a.top - h - 10 : a.bottom + 10;   // step aside from the selected thing
    el.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
    el.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + "px";
  }
  K.ribbon = {
    get on() { return !K.LS.get("lapp.ribbon.off", false); },
    set(on) { K.LS.set("lapp.ribbon.off", !on); if (!on) K.ribbon.hide(); else if (RB.items.length) K.ribbon.show(RB.items, RB.o); },
    hide() { if (RB.el) RB.el.hidden = true; },
    show(items, o = {}) {
      RB.items = items; RB.o = o;
      if (!K.ribbon.on) return null;
      let el = RB.el;
      if (!el) {
        el = RB.el = document.createElement("div"); el.className = "k-ribbon"; el.setAttribute("role", "toolbar"); document.body.append(el);
        el.addEventListener("click", e => {
          const b = e.target.closest("button"); if (!b) return;
          if (b.dataset.rq !== undefined) { const it = RB.L[+b.dataset.rq]; askBar(it); return; }
          if (b.dataset.rx !== undefined) { K.ribbon.set(false); K.toast("Ribbon hidden — View › Ribbon brings it back", { action: "Undo", run: () => K.ribbon.set(true) }); return; }
          const it = RB.L[+b.dataset.k]; if (!it || it.disabled) return;
          if (it.sub) K.menuAt(b, it.sub, { above: b.getBoundingClientRect().top > innerHeight / 2 }); else if (it.run) it.run(b);
        });
        el.addEventListener("pointerdown", e => {
          const g = e.target.closest(".grip"); if (!g) return; e.preventDefault();
          const r = el.getBoundingClientRect(), x0 = r.left, y0 = r.top;
          K.drag(e, { move: (dx, dy) => { el.style.left = Math.max(0, Math.min(x0 + dx, innerWidth - r.width)) + "px"; el.style.top = Math.max(0, Math.min(y0 + dy, innerHeight - r.height)) + "px"; },
            end: (ev, moved) => { if (!moved) return; const n = el.getBoundingClientRect(); K.LS.set(posKey(), { fx: (n.left + n.width / 2) / innerWidth, fy: n.top / innerHeight }); } });
        });
        el.addEventListener("dblclick", e => { if (e.target.closest(".grip")) { K.LS.del(posKey()); placeRibbon(); } });
      }
      const L = RB.L = items.map(norm);
      el.setAttribute("aria-label", o.title || "Actions");
      el.classList.remove("mini", "asking");
      el.innerHTML = (o.above ? "" : `<span class="grip" title="Drag to move · double-click to put it back">${I("grip", 14)}</span>${o.title ? `<span class="rt">${esc(o.title)}</span>` : ""}`)
        + L.map((it, k) => it === "-" ? `<i class="gap"></i>` : `<button type="button" class="${it.danger ? "dz" : ""} ${it.on ? "on" : ""} ${it.input ? "ai" : ""}" ${it.input ? `data-rq="${k}"` : `data-k="${k}"`} ${it.disabled ? "disabled" : ""} title="${esc(it.label)}${it.key ? " · " + esc(it.key) : ""}" aria-label="${esc(it.label)}">${it.icon ? K.IE(it.icon, 15) : ""}${it.iconOnly ? "" : `<span>${esc(it.short || it.label)}</span>`}${it.sub ? I("chevron-down", 12) : ""}</button>`).join("")
        + (o.above ? "" : `<button type="button" class="x" data-rx title="Hide the ribbon" aria-label="Hide the ribbon">${I("x", 13)}</button>`);
      el.hidden = false; el.classList.remove("rest"); placeRibbon();
      return el;
    }
  };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && RB.el && !RB.el.hidden && !K.menuOpen() && !document.querySelector("dialog[open]")) K.ribbon.hide(); });
  // the whole bar becomes one field for the AI (Enter sends, Esc goes back)
  function askBar(it) {
    const el = RB.el; el.classList.add("asking");
    el.innerHTML = `<span class="spk">${I("ai", 15)}</span><input placeholder="${esc(it.input.placeholder || "")}" aria-label="${esc(it.label)}"><button type="button" data-back aria-label="Close">${I("x", 13)}</button>`;
    const inp = $("input", el), back = () => K.ribbon.show(RB.items, RB.o);
    $("[data-back]", el).onclick = e => { e.stopPropagation(); back(); };
    inp.onkeydown = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); back(); } if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); const v = inp.value.trim(); back(); it.input.run(v); } };
    placeRibbon(); inp.focus();
  }
  // it rests while you type and comes back when the pointer moves
  document.addEventListener("keydown", e => { if (RB.el && !RB.el.hidden && e.target.closest && e.target.closest(EDIT) && !e.target.closest(".k-ribbon")) RB.el.classList.add("rest"); }, true);
  document.addEventListener("scroll", () => { if (RB.el && !RB.el.hidden && RB.o.above) placeRibbon(); }, true);
  // like a word processor's small bar: it fades when the pointer goes away from it and the line, and comes back when it returns
  document.addEventListener("pointermove", e => {
    const el = RB.el; if (!el || el.hidden) return;
    if (!el.classList.contains("mini")) { el.classList.remove("rest"); return; }
    if (el.classList.contains("asking")) return;
    const near = (r, m) => e.clientX > r.left - m && e.clientX < r.right + m && e.clientY > r.top - m && e.clientY < r.bottom + m;
    const a = RB.o.anchor && RB.o.anchor.isConnected ? RB.o.anchor.getBoundingClientRect() : null;
    el.classList.toggle("rest", !near(el.getBoundingClientRect(), 36) && !(a && near(a, 0)));
  }, { passive: true });
  addEventListener("resize", () => { if (RB.el && !RB.el.hidden) placeRibbon(); });
  K.ctx(t => t.closest(".k-ribbon") ? [{ label: "Put it back at the bottom", icon: "reload", run: () => { K.LS.del(posKey()); placeRibbon(); } }, { label: "Hide the ribbon", icon: "x", run: () => K.ribbon.set(false) }] : null);

  document.addEventListener("pointerdown", e => { if (!e.target.closest || e.target.closest(".k-menu") || !K.menuOpen()) return; const b = e.target.closest(".open"); if (b) SHUT = { b, t: Date.now() }; K.closeMenu(); }, true);
  addEventListener("blur", () => K.closeMenu());
  addEventListener("resize", () => K.closeMenu());
  addEventListener("scroll", e => { if (!(e.target.closest && e.target.closest(".k-menu"))) K.closeMenu(); }, true);
})();
