/* LAPP page router for the apps that run inside a window of the work desktop (/admin, /s/<school>).
   One view at a time, chosen by the address (#route); the window's title bar gets the page's title and a "Go" menu.
   Toasts, dialogs and menus are the shared kit's (ui/kit.js, ui/menu.js) — the old names still work.

   Shell.init({ main, nav: [{ route, label, icon, hidden }], home, name, commands: () => [menu items], render: async (route, el) => html,
                after: (route, el) => {}, onShow: route => {}, title: route => text })
   Shell.open(route, { tab: "new" }) · Shell.refresh() · Shell.route() · Shell.view() · Shell.title(route, text) · Shell.badge(id, v)
   Shell.toast(text, { kind, action, run }) · Shell.ask({…}) · Shell.confirm({…}) · Shell.menu(at, items) */
(() => {
  "use strict";
  const K = window.K, { esc } = K;
  let O = null, main, VIEW = null, ROUTE = "", SEQ = 0;
  const CSS = `body.sh-embed{display:block!important;height:100vh;overflow:hidden}body.sh-embed>aside{display:none!important}
.sh-main{position:fixed;inset:0;height:100vh;padding:0!important;max-width:none!important}
.sh-view{position:absolute;inset:0;overflow:auto;padding:16px 22px 50px;display:flex;flex-direction:column;gap:14px;container-type:inline-size}
.sh-empty{position:absolute;inset:0;display:grid;place-items:center;color:var(--mu2);text-align:center;padding:20px}
@media (max-width:760px){html:not(.desk) .sh-view{padding:16px}}`;
  const navOf = r => O.nav.find(n => n.route === r) || O.nav.find(n => n.route === String(r).split("/")[0]);
  const titleOf = r => (O.title && O.title(r)) || (navOf(r) || {}).label || r;
  const routeNow = () => location.hash.slice(1) || O.home || O.nav[0].route;

  async function paint(r) {
    const el = VIEW, my = ++SEQ;
    if (!el.innerHTML) el.innerHTML = `<div class="sh-empty">Loading…</div>`;
    let html;
    try { html = await O.render(r, el); } catch (e) { html = `<div class="card">⚠️ ${esc(e.message)}</div>`; }
    if (my !== SEQ || el !== VIEW) return;
    if (html != null) el.innerHTML = html;
    if (O.after) try { O.after(r, el); } catch (e) { console.error(e); }
  }
  function show() {
    ROUTE = routeNow();
    main.innerHTML = "";
    VIEW = document.createElement("section"); VIEW.className = "sh-view"; VIEW.dataset.route = ROUTE; VIEW.tabIndex = -1;
    main.append(VIEW);
    document.title = titleOf(ROUTE) + " · " + O.name;
    paint(ROUTE).then(() => LAPPFrame.up({ t: "title", title: titleOf(ROUTE) }));
    if (O.onShow) O.onShow(ROUTE);
  }
  // another route: here, or in a new window of the desktop
  function open(r, o = {}) {
    r = String(r || ""); if (!r) return;
    if (o.tab === "new" && r !== location.hash.slice(1)) return LAPPFrame.up({ t: "open", url: location.pathname + location.search.replace(/[?&]embed=1/, "").replace(/^&/, "?") + "#" + r });
    location.hash = r;
  }
  function init(o) {
    O = o; main = o.main;
    if (!K.inDesk()) return;      // opened on its own, the page goes into the work desktop
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    document.body.classList.add("sh", "sh-embed"); main.classList.add("sh-main");
    // the title bar's menus: the page's sections, and reload
    const prev = LAPPFrame.menus;
    LAPPFrame.menus = () => [
      { label: "Go", items: O.nav.filter(n => !n.hidden).map(n => ({ label: n.label, icon: n.icon, on: n.route === ROUTE.split("/")[0], run: () => { location.hash = n.route; } })) },
      ...(O.commands ? [{ label: "Actions", items: O.commands() }] : []),
      { label: "View", items: [{ label: "Reload", icon: "reload", run: () => refresh() }] }, ...(prev ? prev() || [] : [])];
    addEventListener("hashchange", show);
    show();
  }
  const refresh = () => VIEW ? paint(ROUTE) : Promise.resolve();
  function title(r, t) { if (r === ROUTE) LAPPFrame.up({ t: "title", title: t }); }
  function badge(id, v) { const el = document.getElementById(id); if (el) el.textContent = v || ""; }
  // a menu at a button, or at { x, y }
  const menu = (at, L, o = {}) => { const search = o.search !== false && L.length > 6; return at.getBoundingClientRect ? K.menuAt(at, L, { search }) : K.menu(at.x, at.y, L, { search }); };

  window.Shell = { init, open, refresh, menu, title, badge, toast: K.toast, ask: K.ask, confirm: K.confirm,
    route: () => ROUTE, view: () => VIEW, get active() { return !!O; } };
})();
