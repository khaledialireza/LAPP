// LAPP · the bridge every page uses when it runs inside a window of the work desktop (/manage).
// One standard for all windows: the page's title, buttons and menus go up to the window's title bar,
// its state (saving, AI working, error, done) colours the window's border, the person's keys and
// links to other apps go to the desktop. Pages only add <script src="/ui/frame.js"> — nothing else is required;
// a page may add its own menus with LAPPFrame.menus = () => [{ label, items: [{ label, icon, key, run, on, disabled } | "-"] }].
(function () {
  const q = new URLSearchParams(location.search);
  const EMBED = q.has("embed") && window.parent !== window;
  const up = m => { try { parent.postMessage({ lapp: 1, ...m }, location.origin); } catch {} };
  const F = window.LAPPFrame = { embed: EMBED, up, menus: null, state: s => up({ t: "state", state: s || "" }), sync: () => {} };
  if (!EMBED) return;
  const html = document.documentElement;
  html.classList.add("in-win");
  // the desktop decides the device: inside a window on a computer the page keeps its desktop layout, whatever the window's width
  if (q.get("device") !== "mobile") html.classList.add("desk");

  const st = document.createElement("style");
  st.textContent = `.cx-hide{display:none!important}html.in-win .crumb.cx-hide{display:none!important}`;
  (document.head || html).append(st);

  /* ---------- the person's keys go to the desktop ---------- */
  const KEYS = () => { try { return Object.values(JSON.parse(localStorage.getItem("lapp.keys")) || {}); } catch { return []; } };
  document.addEventListener("keydown", e => {
    const k = ["Control", "Alt", "Shift", "Meta"].includes(e.key) ? "" : e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.code === "Backquote" ? "`" : e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    const c = k && [(e.ctrlKey || e.metaKey) && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", k].filter(Boolean).join("+");
    if (c && KEYS().includes(c)) { e.preventDefault(); e.stopPropagation(); up({ t: "key", combo: c }); }
    else if (e.key === "Escape" && !document.querySelector("dialog[open]")) up({ t: "key", combo: "Escape" });
  }, true);

  /* ---------- other apps open as windows of the desktop, never as browser tabs ---------- */
  const APP = /^\/(studio|admin|files|s\/)/;
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href]"); if (!a || a.closest("[data-cx-keep]")) return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin || !APP.test(u.pathname)) return;
    if (a.target === "_blank" || u.pathname !== location.pathname) { e.preventDefault(); up({ t: "open", url: u.pathname + u.search + u.hash }); }
  }, true);
  const wo = window.open.bind(window);
  window.open = (url, ...rest) => { if (!url || url === "about:blank") return null; const u = new URL(url, location.href); if (u.origin === location.origin && APP.test(u.pathname)) { up({ t: "open", url: u.pathname + u.search + u.hash }); return null; } return wo(url, ...rest); };

  /* ---------- state: saving / AI working / error / done, from the page's own requests ---------- */
  let busy = 0, ai = 0, flash;
  const show = () => F.state(ai ? "ai" : busy ? "busy" : "");
  const end = s => { clearTimeout(flash); F.state(s); flash = setTimeout(show, s === "error" ? 2600 : 1200); };
  const of = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url, m = (init.method || (input && input.method) || "GET").toUpperCase();
    const isAi = /\/api\/(assist|studio\/ai|studio\/plan|studio\/[^/]+\/(rewrite|ai|translate|audio))/.test(url), watch = isAi || m !== "GET";
    if (!watch) return of(input, init);
    isAi ? ai++ : busy++; show();
    try { const r = await of(input, init); isAi ? ai-- : busy--; end(r.ok ? (busy || ai ? "" : "ok") : "error"); return r; }
    catch (e) { isAi ? ai-- : busy--; end("error"); throw e; }
  };

  /* ---------- the title bar: the page's heading, back link, buttons and menus go up ---------- */
  const visible = el => !!(el && el.offsetParent !== null);
  let ACTS = [], MENUS = [], sig = "", timer;
  const iconOf = t => { const m = String(t || "").trim().match(/^([\p{Extended_Pictographic}←-⯿＋+✎〰✦✓✕⟳▦▤▶⬇⬆]️?)\s*/u); return m ? m[1] : ""; };
  const label = el => (el.getAttribute("aria-label") || el.title || el.textContent || "").replace(/\s+/g, " ").trim();
  function header() {
    for (const el of document.querySelectorAll("[data-chrome], .top, .dv-top, #top")) if (visible(el) || el.dataset.cxDone) return el;
    return null;
  }
  function collect() {
    const h = header(), out = { t: "chrome", title: "", back: null, actions: [], menus: [] };
    ACTS = [];
    if (h) {
      h.dataset.cxDone = 1;
      const t = h.querySelector("h1"); if (t) { out.title = t.textContent.replace(/\s+/g, " ").trim(); t.classList.add("cx-hide"); }
      let prev = h.previousElementSibling; if (prev && prev.matches("a.crumb")) { out.back = label(prev); ACTS.push(prev); prev.classList.add("cx-hide"); out.backI = ACTS.length - 1; }
      h.querySelectorAll("button, a.b, a.btn").forEach(b => {
        if (b.closest("[data-cx-keep], .dv-crumb, form, dialog")) return;
        const txt = label(b), ic = iconOf(txt), grp = b.parentElement !== h && !b.parentElement.matches("h1") ? b.parentElement : null;
        ACTS.push(b); b.classList.add("cx-hide");
        out.actions.push({ i: ACTS.length - 1, label: ic ? txt.slice(ic.length).trim() : txt, icon: ic, primary: b.matches(".pr, .primary, .btn.pr"), danger: b.matches(".d, .danger"),
          on: b.matches(".on, [aria-pressed=true], [aria-selected=true]"), disabled: !!b.disabled, group: grp ? (grp.dataset.cxg || (grp.dataset.cxg = Math.random().toString(36).slice(2, 7))) : "" });
      });
      // a header with nothing left on screen goes away
      const left = [...h.children].some(c => !c.classList.contains("cx-hide") && visible(c) && (c.textContent.trim() || c.querySelector("input,select")));
      h.classList.toggle("cx-hide", !left);
    }
    MENUS = typeof F.menus === "function" ? (F.menus() || []) : [];
    out.menus = MENUS.map((m, mi) => ({ label: m.label, items: (m.items || []).map((it, ii) => it === "-" ? "-" : { id: mi + ":" + ii, label: it.label, icon: it.icon || "", key: it.key || "", on: !!it.on, disabled: !!it.disabled, danger: !!it.danger }) }));
    const s = JSON.stringify(out);
    if (s !== sig) { sig = s; up(out); }
  }
  F.sync = () => { clearTimeout(timer); timer = setTimeout(collect, 60); };
  addEventListener("message", e => {
    if (e.origin !== location.origin || e.source !== parent || !e.data || !e.data.lapp || e.data.t !== "cmd") return;
    const d = e.data;
    if (d.kind === "action") { const b = ACTS[d.i]; if (b && !b.disabled) b.click(); }
    if (d.kind === "menu") { const [mi, ii] = String(d.id).split(":").map(Number), it = MENUS[mi] && MENUS[mi].items[ii]; if (it && it.run && !it.disabled) it.run(); }
    if (d.kind === "resync") { sig = ""; F.sync(); }
    F.sync();
  });
  const start = () => {
    new MutationObserver(muts => { if (muts.some(m => m.type === "childList" || m.attributeName !== "class" || !m.target.classList.contains("cx-hide"))) F.sync(); })
      .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "disabled", "aria-pressed", "aria-selected", "hidden"] });
    addEventListener("hashchange", () => { sig = ""; F.sync(); });
    F.sync();
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
