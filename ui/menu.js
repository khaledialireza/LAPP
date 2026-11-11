// LAPP menu — the ONE right-click / drop-down menu of the whole system (desktop, title bars, taskbar, Files,
// Studio lines, pages). Needs /ui/kit.js; its look is .k-menu in /ui/kit.css.
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
    m.className = "k-menu " + (o.className || ""); m.setAttribute("role", "menu");
    m.innerHTML = `${o.header || ""}${o.search ? `<div class="q">${I("search", 14)}<input placeholder="${esc(o.search === true ? "Search…" : o.search)}" aria-label="Search actions"></div>` : ""}${o.title ? `<div class="mh">${esc(o.title)}</div>` : ""}<div class="ls">${L.map((it, k) => row(it, String(k))).join("")}</div>${o.ask ? `<div class="ask"><span class="spark">✦</span><input placeholder="${esc(o.ask.placeholder || "Ask the assistant…")}" aria-label="Ask the assistant"><kbd>↵</kbd></div>` : ""}`;
    document.body.append(m);
    ON_CLOSE = o.onClose || null;
    const w = m.offsetWidth, h = m.offsetHeight, hasSub = L.some(it => it && it.sub);
    m.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + "px";
    m.style.top = Math.max(6, Math.min(o.above ? y - h : y, innerHeight - h - 6)) + "px";
    if (hasSub && x + w + 210 > innerWidth) m.classList.add("flip");   // no room on the right: sub-menus open on the left
    const find = p => p.split(".").reduce((a, k, d) => d ? (a.sub || [])[+k] && norm(a.sub[+k]) : L[+k], null);
    const run = el => { const it = find(el.dataset.p); if (!it || it.sub || it.disabled || !it.run) return; K.closeMenu(); it.run(); };
    m.addEventListener("click", e => { const el = e.target.closest("[data-p]"); if (!el || !m.contains(el)) return; e.stopPropagation(); run(el); });
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
    const q = $(".q input", m);
    if (q) {
      q.oninput = () => {
        const s = q.value.trim().toLowerCase();
        $$(".ls > .it", m).forEach(g => { const own = g.dataset.l.includes(s), subs = $$(".sub .it", g); subs.forEach(c => c.hidden = s && !own && !c.dataset.l.includes(s)); const hit = !s || own || subs.some(c => !c.hidden); g.hidden = !hit; g.classList.toggle("hov", !!s && hit && !own && subs.length > 0); if (g.classList.contains("hov")) place(g); });
        $$(".ls > hr, .ls > .mh", m).forEach(x => x.hidden = !!s);
      };
      // Enter runs the best match: a matching sub item first, then a plain item
      q.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const first = $(".ls .it.hov .sub .it:not([hidden]):not([disabled])", m) || $$(".ls > .it:not([hidden]):not([disabled])", m).find(g => !g.matches("[aria-haspopup]")); if (first) run(first); } };
    }
    const ask = $(".ask input", m);
    if (ask) ask.onkeydown = e => { if (e.key === "Enter" && ask.value.trim()) { e.preventDefault(); const v = ask.value.trim(); K.closeMenu(); o.ask.run(v); } };
    if (o.ready) o.ready(m);
    (q || vis($(".ls", m))[0])?.focus({ preventScroll: true });
    return m;
  };
  // a menu under a button (title-bar menus, "…" buttons)
  let SHUT = null;   // pressing the button of an open menu closes it (and doesn't open it again)
  K.menuAt = (btn, items, o = {}) => { if (SHUT && SHUT.b === btn && Date.now() - SHUT.t < 400) { SHUT = null; return null; } const r = btn.getBoundingClientRect(); btn.classList.add("open"); return K.menu(o.end ? r.right - 220 : r.left, o.above ? r.top - 4 : r.bottom + 4, items, { ...o, onClose: () => { btn.classList.remove("open"); o.onClose && o.onClose(); } }); };

  document.addEventListener("pointerdown", e => { if (!e.target.closest || e.target.closest(".k-menu") || !K.menuOpen()) return; const b = e.target.closest(".open"); if (b) SHUT = { b, t: Date.now() }; K.closeMenu(); }, true);
  addEventListener("blur", () => K.closeMenu());
  addEventListener("resize", () => K.closeMenu());
  addEventListener("scroll", e => { if (!(e.target.closest && e.target.closest(".k-menu"))) K.closeMenu(); }, true);
})();
