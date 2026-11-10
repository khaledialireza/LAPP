// LAPP · one look for the whole system: themes, accent colour, corner radius.
// The desktop saves the choice (with the account) and mirrors it to localStorage "lapp.theme";
// every page (and the desktop itself) applies it with LAPPTheme.apply() and follows changes live.
(function () {
  const T = window.LAPPThemes = {
    aurora: { name: "Aurora (dark)", vars: { "--bg": "#07070B", "--p1": "#0F0F16", "--p2": "#15151F", "--p3": "#1C1C29", "--p4": "#26263C", "--ln": "rgba(255,255,255,.08)", "--ln2": "rgba(255,255,255,.14)", "--tx": "#F4F4F8", "--mu": "rgba(235,235,245,.6)", "--mu2": "rgba(235,235,245,.38)", "--pop": "#1A1A27" }, scheme: "dark" },
    midnight: { name: "Midnight blue", vars: { "--bg": "#060B16", "--p1": "#0B1222", "--p2": "#111A2E", "--p3": "#18233B", "--p4": "#223051", "--ln": "rgba(160,190,255,.09)", "--ln2": "rgba(160,190,255,.16)", "--tx": "#EEF3FF", "--mu": "rgba(220,230,255,.62)", "--mu2": "rgba(220,230,255,.4)", "--pop": "#141E33" }, scheme: "dark" },
    graphite: { name: "Graphite", vars: { "--bg": "#0C0C0D", "--p1": "#141415", "--p2": "#1B1B1D", "--p3": "#232326", "--p4": "#2E2E32", "--ln": "rgba(255,255,255,.07)", "--ln2": "rgba(255,255,255,.13)", "--tx": "#F2F2F3", "--mu": "rgba(240,240,242,.6)", "--mu2": "rgba(240,240,242,.38)", "--pop": "#1F1F22" }, scheme: "dark" },
    light: { name: "Daylight (beta)", vars: { "--bg": "#F6F6FA", "--p1": "#FFFFFF", "--p2": "#F0F0F6", "--p3": "#E8E8F0", "--p4": "#DCDCE8", "--ln": "rgba(20,20,40,.09)", "--ln2": "rgba(20,20,40,.16)", "--tx": "#16161D", "--mu": "rgba(22,22,29,.62)", "--mu2": "rgba(22,22,29,.42)", "--pop": "#FFFFFF" }, scheme: "light" }
  };
  const get = () => { try { return JSON.parse(localStorage.getItem("lapp.theme")) || {}; } catch { return {}; } };
  function apply(look) {
    look = look || get();
    const t = T[look.theme] || T.aurora, r = document.documentElement;
    if (look.theme && look.theme !== "aurora") { for (const [k, v] of Object.entries(t.vars)) r.style.setProperty(k, v); r.style.colorScheme = t.scheme; }
    else { for (const k of Object.keys(T.aurora.vars)) r.style.removeProperty(k); r.style.removeProperty("color-scheme"); }
    if (look.accent) { r.style.setProperty("--vi", look.accent); r.style.setProperty("--acc", look.accent); } else { r.style.removeProperty("--vi"); r.style.removeProperty("--acc"); }
    if (look.radius) r.style.setProperty("--r", look.radius + "px"); else r.style.removeProperty("--r");
    r.dataset.theme = look.theme || "aurora";
  }
  window.LAPPTheme = { apply, get, themes: T };
  apply();
  addEventListener("storage", e => { if (e.key === "lapp.theme") apply(); });
  addEventListener("message", e => { if (e.origin === location.origin && e.data && e.data.lapp && e.data.t === "theme") apply(); });
})();
