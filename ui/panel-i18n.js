// The person's language on the staff and school pages (admin, studio, school portal).
// The pages are written in English; this file translates what they show into the
// account's language, using content/lang/<code>/panel.json ({ "English text": "translation" }).
//   - a key may hold {n}-style holes: "{n} students" also matches "12 students"
//   - text inside [translate="no"], inputs, textareas and editable areas is never touched
//   - PanelI18N.menu(button) opens the language list; the choice is saved to the account
//   - PanelI18N.t("English text", { n: 3 }) translates in code
//   - PanelI18N.locale is the date/number locale for toLocale…() calls
(() => {
  const LANGS = [
    { code: "en", name: "English", dir: "ltr", locale: "en-GB" },
    { code: "fa", name: "فارسی", dir: "rtl", locale: "fa-IR-u-ca-gregory-nu-latn" },
    { code: "ru", name: "Русский", dir: "ltr", locale: "ru-RU" },
    { code: "uk", name: "Українська", dir: "ltr", locale: "uk-UA" }
  ];
  const info = c => LANGS.find(l => l.code === c) || LANGS[0];
  const ls = { get() { try { return localStorage.getItem("lapp:lang"); } catch { return null; } }, set(v) { try { localStorage.setItem("lapp:lang", v); } catch {} } };
  let lang = info(ls.get()).code, exact = new Map(), pats = [];
  const orig = new WeakMap();                 // node → its English text
  const origAttr = new WeakMap();             // element → { attr: English }
  const ATTRS = ["placeholder", "title", "aria-label"];
  const SKIP = "script,style,textarea,input,[contenteditable],[translate=no],code,pre";

  // dictionary → exact lookups + patterns for keys with holes
  function compile(dict) {
    exact = new Map(); pats = [];
    for (const [k, v] of Object.entries(dict)) {
      if (k.startsWith("_")) continue;
      if (!/\{\w+\}/.test(k)) { exact.set(k, v); continue; }
      const names = [];
      const re = k.split(/(\{\w+\})/).map(part => { const m = part.match(/^\{(\w+)\}$/); if (m) { names.push(m[1]); return "(.+?)"; } return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("");
      pats.push({ re: new RegExp("^" + re + "$", "s"), names, v });
    }
    pats.sort((a, b) => b.re.source.length - a.re.source.length);   // the most specific first
  }
  // emoji and arrows around the words stay as they are: "📊 Dashboard" → "📊 داشبورد"
  const EDGE_L = /^[^\p{L}\p{N}{(@"«'‹]+/u, EDGE_R = /[^\p{L}\p{N}})"»'.…?!%›:]+$/u;
  function look(core, depth) {
    let out = exact.get(core);
    if (out !== undefined) return out;
    if (depth > 2) return undefined;
    for (const p of pats) {
      const m = core.match(p.re); if (!m) continue;
      out = p.v; p.names.forEach((n, i) => { const v = m[i + 1]; out = out.split(`{${n}}`).join(look(v.trim(), depth + 1) ?? v); });
      return out;
    }
    return undefined;
  }
  function tr(s) {
    if (lang === "en" || !s) return s;
    const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0], core = s.trim();
    if (!core) return s;
    let out = look(core, 0);
    if (out === undefined) {
      const l = (core.match(EDGE_L) || [""])[0], r = (core.slice(l.length).match(EDGE_R) || [""])[0];
      const mid = core.slice(l.length, core.length - r.length);
      if (mid && (l || r)) { const o = look(mid, 0); if (o !== undefined) out = l + o + r; }
    }
    return out === undefined ? s : lead + out + tail;
  }
  function t(s, vars) { let out = tr(s); if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v); return out; }

  // walk a subtree and translate text and attributes
  let busy = false;
  function skip(el) { return el && el.closest && el.closest(SKIP); }
  function doText(n) {
    if (skip(n.parentElement)) return;
    const was = orig.get(n);
    const en = was !== undefined && (n.data === was.out) ? was.en : n.data;   // changed by the page → new English
    const out = tr(en);
    orig.set(n, { en, out });
    if (n.data !== out) n.data = out;
  }
  function doAttrs(el) {
    if (el.closest("[translate=no]")) return;
    let o = origAttr.get(el); if (!o) origAttr.set(el, o = {});
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const cur = el.getAttribute(a), rec = o[a];
      const en = rec && cur === rec.out ? rec.en : cur, out = tr(en);
      o[a] = { en, out };
      if (cur !== out) el.setAttribute(a, out);
    }
  }
  function walk(root) {
    busy = true;
    try {
      if (root.nodeType === 3) { doText(root); return; }
      if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
      if (root.nodeType === 1) { if (skip(root) && root.matches("[translate=no], [translate=no] *")) return; doAttrs(root); }
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? doText(n) : doAttrs(n);
    } finally { busy = false; }
  }
  const mo = new MutationObserver(list => {
    if (busy) return;
    for (const m of list) {
      if (m.type === "characterData") walk(m.target);
      else if (m.type === "attributes") { busy = true; try { doAttrs(m.target); } finally { busy = false; } }
      else m.addedNodes.forEach(walk);
    }
  });

  // the page's direction, font and locale
  function paint() {
    const h = document.documentElement, i = info(lang);
    h.lang = lang; h.dir = i.dir;
    if (lang === "fa" && !document.getElementById("pi-font")) {
      const l = document.createElement("link"); l.id = "pi-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap"; document.head.append(l);
    }
    if (!document.getElementById("pi-css")) {
      const s = document.createElement("style"); s.id = "pi-css";
      s.textContent = `html[lang=fa] body{font-family:Vazirmatn,Inter,system-ui,sans-serif}
.pi-menu{position:fixed;z-index:2000;min-width:190px;padding:5px;border-radius:12px;background:var(--ui-surface,#15151F);border:1px solid var(--ui-line,rgba(255,255,255,.14));box-shadow:0 18px 50px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:2px}
.pi-menu button{all:unset;cursor:pointer;display:flex;gap:10px;align-items:center;padding:9px 11px;border-radius:9px;color:var(--ui-text,#F4F4F8);font:inherit;font-size:14px}
.pi-menu button:hover,.pi-menu button:focus-visible{background:var(--ui-surface-2,#1C1C29)}.pi-menu button.on{color:var(--ui-accent,#8B5CF6);font-weight:700}
.pi-menu b{font-size:11px;opacity:.6;width:22px}`;
      document.head.append(s);
    }
  }
  const dicts = {};
  async function load(l) {
    if (l === "en") return {};
    if (!dicts[l]) dicts[l] = fetch(`/content/lang/${l}/panel.json?v=${window.PANEL_V || 6}`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    return dicts[l];
  }
  async function use(l, save) {
    l = info(l).code;
    const d = await load(l);
    lang = l; compile(d); ls.set(l); paint();
    // go back to the English first, then translate again
    busy = true;
    try {
      const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.currentNode; n; n = w.nextNode()) {
        if (n.nodeType === 3) { const o = orig.get(n); if (o && n.data === o.out) n.data = o.en; orig.delete(n); }
        else { const o = origAttr.get(n); if (o) for (const a in o) if (n.getAttribute(a) === o[a].out) n.setAttribute(a, o[a].en); origAttr.delete(n); }
      }
    } finally { busy = false; }
    walk(document.body || document.documentElement);
    document.title = tr(document.title);
    if (save) { try { await fetch("/api/me", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-LAPP": "1" }, body: JSON.stringify({ lang: l }) }); } catch {} }
    window.dispatchEvent(new CustomEvent("panel:lang", { detail: l }));
  }

  // the language list, next to a button
  function menu(btn) {
    let m = document.querySelector(".pi-menu");
    if (m) { m.remove(); return; }
    m = document.createElement("div"); m.className = "pi-menu"; m.setAttribute("translate", "no"); m.setAttribute("role", "menu");
    m.innerHTML = LANGS.map(l => `<button role="menuitem" data-l="${l.code}" class="${l.code === lang ? "on" : ""}"><b>${l.code.toUpperCase()}</b>${l.name}</button>`).join("");
    (btn.closest("dialog") || document.body).append(m);
    const r = btn.getBoundingClientRect(), h = m.offsetHeight, w = m.offsetWidth;
    m.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - 6 - h) : r.bottom + 6) + "px";
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + "px";
    m.addEventListener("click", e => { const b = e.target.closest("[data-l]"); if (b) { m.remove(); use(b.dataset.l, true); } });
    setTimeout(() => document.addEventListener("click", function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("click", off); } }), 0);
    m.querySelector(".on")?.focus();
  }

  // native boxes speak the language too
  const wrap = f => (msg, ...rest) => f.call(window, tr(String(msg ?? "")), ...rest);
  window.alert = wrap(window.alert); window.confirm = wrap(window.confirm); window.prompt = wrap(window.prompt);

  window.PanelI18N = { t, menu, use, get lang() { return lang; }, get locale() { return info(lang).locale; }, name: c => info(c).name };

  paint();
  const start = async () => {
    compile(await load(lang));
    walk(document.body); document.title = tr(document.title);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // the account decides: another device may have changed it
    try {
      const r = await fetch("/api/me", { credentials: "same-origin" }); const j = r.ok ? await r.json() : null;
      const l = j && j.user && j.user.lang;
      if (l && l !== lang) use(l);
    } catch {}
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
