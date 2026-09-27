// Interface language. Every language lives in its own folder: content/lang/<code>/
//   ui.json       interface strings (key → text); "_pos" maps word-type labels
//   grammar.json  sentence templates for the grammar notes in the word sheet
//   dict.json     meanings of the German dictionary keys
//   names.json    names written in this language
// The list of languages (name, direction, locale, speech code) is content/index.json.
// In HTML: data-i18n / data-i18n-ph / data-i18n-aria; in code: t("key") or t("key", { n: 3 }).
(() => {
  const store = { get(k) { try { return localStorage.getItem("lapp:" + k); } catch { return null; } }, set(k, v) { try { localStorage.setItem("lapp:" + k, v); } catch {} } };
  const FALLBACK = "fa";
  let langs = [], lang = store.get("lang") || FALLBACK, str = {}, fb = {}, posMap = {};

  function t(key, vars) {
    let s = key in str ? str[key] : key in fb ? fb[key] : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
    return s;
  }
  const has = key => key in str;
  const pos = p => !p || lang === FALLBACK ? p : posMap[p] || p;
  const info = (l = lang) => langs.find(x => x.code === l) || { code: l, name: l, dir: "ltr", locale: l, speech: null };

  // strings of one language (and the fallback once)
  async function load(l, get) {
    const both = c => Promise.all([get(`lang/${c}/ui.json`), get(`lang/${c}/grammar.json`).catch(() => ({}))]);
    const [ui, gr] = await both(l);
    if (l !== FALLBACK && !Object.keys(fb).length) { const [f, fg] = await both(FALLBACK); fb = { ...f, ...fg }; delete fb._pos; }
    const all = { ...ui, ...gr }; delete all._pos;
    if (l === FALLBACK) fb = all;
    lang = l; str = all; posMap = ui._pos || {};
  }
  function init(list) {
    langs = list;
    if (!langs.some(x => x.code === lang)) lang = FALLBACK;
  }
  function apply(root = document) {
    const h = document.documentElement;
    h.dataset.ui = lang; h.dataset.dir = info().dir; h.lang = lang;
    root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    root.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = el.dataset.i18nPh.replace(/\{(\w+)\}/g, (_, k) => t(k)); });
    document.title = t("appTitle");
  }
  // switching loads the language's files first (content.js), then repaints
  async function setLang(l) {
    if (!langs.some(x => x.code === l)) return;
    await window.Content.loadLang(l);
    store.set("lang", l); apply();
    window.dispatchEvent(new CustomEvent("lapp:lang", { detail: l }));
  }
  window.I18N = {
    t, has, pos, info, init, load, apply, setLang,
    get lang() { return lang; }, get langs() { return langs.map(x => x.code); }, name: l => info(l).name
  };
  window.t = t;
})();
