/* LAPP panel shell: the management panel's frame, shared by /admin and /s/<school>.
   Sidebar (avatar card, sections, sign out) · tabs like a browser · two pages side by side ·
   a tab can float above the rest · ⌘K search and commands · background work · notifications ·
   our own dialogs (no prompt/confirm) · keyboard shortcuts · tabs come back after sign-in.

   Shell.init({ side, main, key, nav: [{route, label, icon, group, badge}], me: {name, sub, initial, color},
                render: async route => html, after: (route, el) => {}, title: route => text,
                commands: () => [{label, icon, run, kbd}], menu: () => [items], jobs: async () => [...], signOut })
   Shell.open(route, {tab:"new"|"here", pane:0|1}) · Shell.refresh() · Shell.route() · Shell.view()
   Shell.toast(text, {kind, action, run}) · Shell.ask({...}) · Shell.confirm({...}) · Shell.menu(at, items) · Shell.notify(...)
*/
(() => {
  "use strict";
  const CSS = `
.sh-side{display:flex;flex-direction:column;gap:3px}
.sh-me{display:flex;align-items:center;gap:10px;padding:8px;border-radius:14px;background:var(--p2);border:1px solid var(--ln);margin-bottom:8px;text-align:start;width:100%}
.sh-me:hover{border-color:var(--ln2)}
.sh-av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:800;color:#fff;flex:none;position:relative;font-size:15px}
.sh-av::after{content:"";position:absolute;inset-inline-end:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:var(--gr);box-shadow:0 0 0 2px var(--p1)}
.sh-me b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sh-me small{display:block;color:var(--mu);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-me .c{margin-inline-start:auto;color:var(--mu2)}
.sh-find{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:11px;border:1px solid var(--ln2);background:var(--p2);color:var(--mu);font-size:13px;margin-bottom:8px;width:100%}
.sh-find kbd,.sh-kbd{font:600 10.5px Inter,system-ui;border:1px solid var(--ln2);border-bottom-width:2px;border-radius:5px;padding:0 5px;color:var(--mu)}
.sh-find kbd{margin-inline-start:auto}
.sh-grp{font:700 10.5px Inter,system-ui;color:var(--mu2);letter-spacing:.5px;text-transform:uppercase;padding:10px 12px 3px}
.sh-side .nv .ic{width:22px;text-align:center;flex:none}
.sh-side .nv .lb{flex:1;margin-inline-start:6px}
.sh-side .nv.open .lb::after{content:"";display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--cy);margin-inline-start:7px;vertical-align:middle}
.sh-grow{flex:1}
.sh-out{border:1px solid var(--ln2);border-radius:11px;padding:9px;font-weight:700;font-size:13px;width:100%;margin-top:8px}
.sh-out:hover{background:var(--p2)}
.sh-main{display:flex;flex-direction:column;min-width:0;height:100vh;position:sticky;top:0;padding:0!important;gap:0!important;max-width:none!important}
.sh-bar{display:flex;align-items:flex-end;gap:4px;padding:7px 10px 0;background:var(--p1);border-bottom:1px solid var(--ln);min-height:46px;flex:none}
.sh-tabs{display:flex;gap:2px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;align-items:flex-end}
.sh-tab{display:flex;align-items:center;gap:7px;height:35px;padding:0 6px 0 12px;border-radius:10px 10px 0 0;font-size:12.5px;color:var(--mu);max-width:220px;flex:none;border:1px solid transparent;border-bottom:0;cursor:pointer;position:relative;user-select:none}
.sh-tab:hover{background:var(--p2)}
.sh-tab.on{background:var(--bg);color:var(--tx);border-color:var(--ln2)}
.sh-tab.on::after{content:"";position:absolute;inset-inline:0;bottom:-1px;height:1px;background:var(--bg)}
.sh-tab.p0{box-shadow:inset 0 2px 0 var(--vi)}.sh-tab.p1{box-shadow:inset 0 2px 0 var(--cy)}
.sh-tab .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-tab .x{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font-size:10px;color:var(--mu2);flex:none}
.sh-tab .x:hover{background:rgba(255,255,255,.1);color:var(--tx)}
.sh-tab.drag{opacity:.4}
.sh-tab.add{padding:0 11px;color:var(--mu)}
.sh-tools{display:flex;align-items:center;gap:2px;padding-bottom:6px;flex:none}
.sh-tools button{height:31px;min-width:31px;padding:0 8px;border-radius:9px;color:var(--mu);display:inline-flex;align-items:center;gap:6px;font-size:13px;position:relative}
.sh-tools button:hover,.sh-tools button.on{background:var(--p3);color:var(--tx)}
.sh-dot{position:absolute;top:3px;inset-inline-end:3px;min-width:15px;height:15px;border-radius:99px;background:var(--pk);color:#fff;font:800 9.5px/15px Inter,system-ui;padding:0 4px}
.sh-panes{flex:1;min-height:0;display:grid;grid-template-columns:1fr;position:relative}
.sh-panes.split{grid-template-columns:var(--a,1fr) 6px var(--b,1fr)}
.sh-pane{min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}
.sh-pane .ph{display:none;align-items:center;gap:8px;height:30px;padding:0 12px;font-size:11.5px;color:var(--mu);border-bottom:1px solid var(--ln);background:var(--p1);flex:none}
.sh-panes.split .sh-pane .ph{display:flex}
.sh-pane.act .ph{color:var(--tx);box-shadow:inset 0 -2px 0 var(--vi)}.sh-pane.act[data-p="1"] .ph{box-shadow:inset 0 -2px 0 var(--cy)}
.sh-slot{flex:1;min-height:0;position:relative}
.sh-view{position:absolute;inset:0;overflow:auto;padding:22px 26px 60px;display:flex;flex-direction:column;gap:14px;container-type:inline-size}
.sh-empty{position:absolute;inset:0;display:grid;place-items:center;color:var(--mu2);text-align:center;padding:20px}
.sh-empty[hidden],.sh-dot[hidden]{display:none}
.sh-pane.drop .sh-slot::after{content:attr(data-drop);position:absolute;inset:10px;border:2px dashed var(--cy);border-radius:14px;background:rgba(34,211,238,.08);display:grid;place-items:center;color:var(--cy);font-weight:700;z-index:30}
.sh-div{background:var(--ln);cursor:col-resize;position:relative}.sh-div:hover{background:rgba(139,92,246,.5)}
.sh-div::after{content:"";position:absolute;inset-inline-start:2px;top:50%;width:2px;height:36px;margin-top:-18px;border-radius:2px;background:var(--mu2)}
.sh-panes:not(.split) .sh-div,.sh-panes:not(.split) .sh-pane[data-p="1"]{display:none}
.sh-float{position:fixed;z-index:60;width:460px;height:380px;min-width:260px;min-height:160px;resize:both;overflow:hidden;display:flex;flex-direction:column;background:var(--bg);border:1px solid rgba(139,92,246,.55);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.7)}
.sh-float .fh{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;background:var(--p2);border-bottom:1px solid var(--ln);font-size:12.5px;font-weight:700;cursor:grab;user-select:none;touch-action:none;flex:none}
.sh-float .fh span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-float .fh button{width:24px;height:24px;border-radius:6px;color:var(--mu)}.sh-float .fh button:hover{background:rgba(255,255,255,.1);color:var(--tx)}
.sh-float .fb{flex:1;min-height:0;position:relative}
.sh-float.mini{height:36px!important;resize:none}.sh-float.mini .fb{display:none}
.sh-menu{position:fixed;z-index:90;min-width:230px;max-width:300px;background:#1D1D2C;border:1px solid var(--ln2);border-radius:12px;padding:5px;box-shadow:0 24px 60px rgba(0,0,0,.75);font-size:13px}
.sh-menu .q{display:flex;align-items:center;gap:6px;background:var(--p3);border:1px solid var(--ln2);border-radius:8px;padding:5px 8px;margin-bottom:4px}
.sh-menu .q input{flex:1;background:none;border:0;outline:none;min-width:0}
.sh-menu .it{display:flex;align-items:center;gap:9px;padding:6px 9px;border-radius:7px;width:100%;text-align:start;position:relative}
.sh-menu .it:hover,.sh-menu .it.hov,.sh-menu .it:focus-visible{background:rgba(139,92,246,.25);outline:0}
.sh-menu .it .k{margin-inline-start:auto;font:600 10.5px Inter,system-ui;color:var(--mu2);padding-inline-start:10px}
.sh-menu .it.danger{color:var(--rd)}
.sh-menu .head{font:700 10.5px Inter,system-ui;color:var(--mu2);padding:5px 9px 2px;letter-spacing:.4px;text-transform:uppercase}
.sh-menu hr{border:0;border-top:1px solid var(--ln);margin:4px 2px}
.sh-menu .sub{display:none;position:absolute;inset-inline-start:calc(100% + 2px);top:-6px;min-width:210px;background:#1D1D2C;border:1px solid var(--ln2);border-radius:12px;padding:5px;box-shadow:0 24px 60px rgba(0,0,0,.75)}
.sh-menu .it:hover>.sub,.sh-menu .it.hov>.sub{display:block}
.sh-pal{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.45);display:flex;justify-content:center;align-items:flex-start;padding:12vh 16px 16px}
.sh-pal .box{width:min(620px,100%);background:#1D1D2C;border:1px solid var(--ln2);border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.8);overflow:hidden}
.sh-pal input{width:100%;background:none;border:0;outline:none;font:500 17px Inter,system-ui;padding:15px 18px;border-bottom:1px solid var(--ln)}
.sh-pal .res{max-height:min(380px,55vh);overflow:auto;padding:6px}
.sh-pal .grp{font:700 10.5px Inter,system-ui;color:var(--mu2);padding:7px 10px 2px;text-transform:uppercase;letter-spacing:.4px}
.sh-pal .r{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:9px;width:100%;text-align:start;font-size:13.5px}
.sh-pal .r.on{background:var(--vi)}.sh-pal .r .i{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--p3);flex:none}
.sh-pal .r .k{margin-inline-start:auto;color:var(--mu2);font-size:11.5px}.sh-pal .r.on .k{color:#fff}
.sh-pop{position:fixed;z-index:85;width:min(350px,calc(100vw - 20px));max-height:70vh;overflow:auto;background:#1D1D2C;border:1px solid var(--ln2);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.75);padding:10px;display:flex;flex-direction:column;gap:8px;font-size:13px}
.sh-pop h4{margin:0 2px;font-size:12.5px;color:var(--mu);display:flex;justify-content:space-between;gap:8px}
.sh-nt{display:flex;gap:10px;padding:9px;border-radius:12px;background:var(--p3)}
.sh-nt .i{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none}
.sh-nt b{display:block}.sh-nt small{color:var(--mu2)}
.sh-bar2{height:5px;border-radius:3px;background:var(--p1);margin-top:5px;overflow:hidden}.sh-bar2 i{display:block;height:100%;background:var(--g)}
.sh-toasts{position:fixed;top:14px;inset-inline-end:14px;z-index:99;display:flex;flex-direction:column;gap:8px;width:min(360px,calc(100vw - 28px));pointer-events:none}
.sh-toast{pointer-events:auto;display:flex;gap:10px;align-items:center;background:#1D1D2C;border:1px solid var(--ln2);border-radius:12px;padding:9px 12px;font-size:13px;box-shadow:0 18px 40px rgba(0,0,0,.6);animation:shIn .18s ease-out}
.sh-toast .i{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;flex:none;font-weight:800}
.sh-toast .a{margin-inline-start:auto;color:#C4B5FD;font-weight:700;white-space:nowrap}
@keyframes shIn{from{transform:translateY(-8px);opacity:0}to{transform:none;opacity:1}}
.sh-dlg{margin:auto;background:var(--p2);color:var(--tx);border:1px solid var(--ln2);border-radius:18px;padding:20px;width:min(460px,92vw)}
.sh-dlg::backdrop{background:rgba(0,0,0,.6)}
.sh-dlg form{display:flex;flex-direction:column;gap:12px}.sh-dlg h3{margin:0;font-size:17px}
.sh-dlg .err{color:var(--rd);font-size:12.5px;min-height:1em}
.sh-dlg .row2{display:flex;gap:8px;justify-content:flex-end}
.sh-keys{display:grid;grid-template-columns:auto 1fr;gap:7px 14px;font-size:13px;align-items:center}
.sh-guide{direction:rtl;font-family:Vazirmatn,Inter,system-ui;line-height:2}
@media (prefers-reduced-motion:reduce){.sh-toast{animation:none}}
@media (max-width:1100px){
  body.sh{grid-template-columns:66px 1fr!important}
  .sh-me>span:not(.sh-av),.sh-me .c,.sh-find span,.sh-find kbd,.sh-side .nv .lb,.sh-side .nv em,.sh-grp,.sh-out span,.sh-side .lg span,.sh-side .org{display:none}
  .sh-side{padding:12px 8px!important}.sh-side .nv{justify-content:center;padding:9px 0}.sh-me{justify-content:center;padding:6px}.sh-find{justify-content:center}
}
@media (max-width:760px){
  body.sh{grid-template-columns:1fr!important;grid-template-rows:1fr auto}
  .sh-main{height:calc(100dvh - 58px)}
  .sh-side{grid-row:2;flex-direction:row!important;overflow-x:auto;height:auto!important;position:sticky!important;bottom:0;top:auto!important;padding:6px!important;border-inline-end:0!important;border-top:1px solid var(--ln)}
  .sh-me,.sh-find,.sh-grow,.sh-grp,.sh-side .lg,.sh-side .org{display:none!important}
  .sh-side .nv{flex:none;width:46px}.sh-out{width:auto;margin:0;padding:8px 12px}
  .sh-panes.split{grid-template-columns:1fr}.sh-panes.split .sh-div,.sh-panes.split .sh-pane[data-p="1"]{display:none}
  .sh-view{padding:16px}
  .sh-float{inset-inline:8px!important;width:auto!important;top:auto!important;bottom:66px}
  .sh-tools .lb{display:none}
}`;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  // inside the management environment (/manage) a page shows one view, and the environment does the rest
  const EMBED = new URLSearchParams(location.search).has("embed") && window.parent !== window;
  const up = m => { try { parent.postMessage({ lapp: 1, ...m }, location.origin); } catch {} };
  const MOD = mac ? "⌘" : "Ctrl ";
  let O, side, main, bar, panesEl;
  let TABS = [], PANES = [null, null], ACT = 0, SPLIT = false, VIEWS = {}, TITLES = {}, FLOATS = {}, SEQ = {}, Z = 60;
  const NOTES = [];

  /* ---------- small helpers ---------- */
  const base = r => String(r || "").split("/")[0];
  const navOf = r => O.nav.find(n => n.route === r) || O.nav.find(n => n.route === base(r));
  function titleOf(r) {
    if (TITLES[r]) return TITLES[r];
    const t = O.title && O.title(r); if (t) return t;
    const n = navOf(r); return n ? n.label : r;
  }
  const iconOf = r => (navOf(r) || {}).icon || "📄";
  function save() {
    try { localStorage.setItem(O.key, JSON.stringify({ tabs: TABS, panes: PANES, split: SPLIT, act: ACT })); } catch {}
  }

  /* ---------- frame ---------- */
  function frame() {
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    document.body.classList.add("sh");
    side.classList.add("sh-side");
    main.classList.add("sh-main");
    main.innerHTML = `<div class="sh-bar"><div class="sh-tabs" role="tablist" aria-label="Open pages"></div>
      <div class="sh-tools">
        <button data-sh="split" title="Two pages side by side · Ctrl+Alt+→">⊟ <span class="lb">Split</span></button>
        <button data-sh="float" title="Float this page above the rest">⧉</button>
        <button data-sh="jobs" title="Working in the background">⏳<span class="sh-dot" hidden></span></button>
        <button data-sh="bell" title="Notifications">🔔<span class="sh-dot" hidden></span></button>
        <button data-sh="keys" title="Keyboard shortcuts · ?">⌨</button>
      </div></div>
      <div class="sh-panes">
        <div class="sh-pane act" data-p="0"><div class="ph"><span></span></div><div class="sh-slot" data-drop="Drop the tab here"><div class="sh-empty">Open a section from the sidebar.</div></div></div>
        <div class="sh-div" title="Drag to resize"></div>
        <div class="sh-pane" data-p="1"><div class="ph"><span></span></div><div class="sh-slot" data-drop="Drop the tab here"><div class="sh-empty">Click a tab, or drag one here.</div></div></div>
      </div>`;
    bar = $(".sh-tabs", main); panesEl = $(".sh-panes", main);
    const box = document.createElement("div"); box.className = "sh-toasts"; box.id = "shToasts"; box.setAttribute("aria-live", "polite"); document.body.append(box);
  }
  function drawSide() {
    const me = O.me;
    let g = null;
    side.innerHTML = (O.brand || "") + `<button class="sh-me" data-sh="me" title="Your account"><span class="sh-av" style="background:${esc(me.color)}">${esc(me.initial)}</span><span style="min-width:0"><b>${esc(me.name)}</b><small>${esc(me.sub)}</small></span><span class="c">▾</span></button>
      <button class="sh-find" data-sh="pal">🔍 <span>Search or run…</span><kbd>${mac ? "⌘K" : "Ctrl K"}</kbd></button>`
      + O.nav.filter(n => !n.hidden).map(n => (n.group && n.group !== g ? `<div class="sh-grp">${esc(g = n.group)}</div>` : "") + `<a class="nv" href="#${esc(n.route)}" data-nav="${esc(n.route)}" title="${esc(n.label)}"><span class="ic">${n.icon || ""}</span><span class="lb">${esc(n.label)}</span>${n.badge ? `<em id="${esc(n.badge)}"></em>` : ""}</a>`).join("")
      + `<div class="sh-grow"></div><button class="sh-out" data-sh="out">↩ <span>Sign out</span></button>`;
  }

  /* ---------- tabs and panes ---------- */
  function drawTabs() {
    if (EMBED || !bar) return;
    bar.innerHTML = TABS.map(r => `<div class="sh-tab ${PANES[ACT] === r ? "on" : ""} ${PANES[0] === r && SPLIT ? "p0" : ""} ${SPLIT && PANES[1] === r ? "p1" : ""}" role="tab" aria-selected="${PANES[ACT] === r}" draggable="true" data-tab="${esc(r)}" title="${esc(titleOf(r))}"><span>${FLOATS[r] ? "⧉" : iconOf(r)}</span><span class="t">${esc(titleOf(r))}</span><button class="x" data-close="${esc(r)}" aria-label="Close tab" title="Close · Alt+W">✕</button></div>`).join("")
      + `<button class="sh-tab add" data-sh="new" title="New tab">＋</button>`;
    $('[data-sh="split"]', main).classList.toggle("on", SPLIT);
    panesEl.classList.toggle("split", SPLIT);
    $$(".sh-pane", main).forEach((p, i) => { p.classList.toggle("act", i === ACT && SPLIT); $(".ph span", p).textContent = PANES[i] ? iconOf(PANES[i]) + " " + titleOf(PANES[i]) : ""; });
    $$("[data-nav]", side).forEach(a => { const r = a.dataset.nav; a.classList.toggle("on", base(PANES[ACT]) === r); a.classList.toggle("open", TABS.some(t => base(t) === r)); });
  }
  function viewOf(r) {
    if (VIEWS[r]) return VIEWS[r];
    const el = document.createElement("section"); el.className = "sh-view"; el.dataset.route = r; el.tabIndex = -1;
    return VIEWS[r] = el;
  }
  async function paint(r) {
    const el = viewOf(r), my = SEQ[r] = (SEQ[r] || 0) + 1;
    if (!el.innerHTML) el.innerHTML = `<div class="sh-empty">Loading…</div>`;
    let html;
    try { html = await O.render(r, el); } catch (e) { html = `<div class="card">⚠️ ${esc(e.message)}</div>`; }
    if (my !== SEQ[r] || !VIEWS[r]) return;
    if (html != null) el.innerHTML = html;
    if (O.after) try { O.after(r, el); } catch (e) { console.error(e); }
    drawTabs();
  }
  function place() {
    $$(".sh-pane", main).forEach((p, i) => {
      const slot = $(".sh-slot", p), r = PANES[i];
      const cur = $(":scope > .sh-view", slot);
      if (cur && cur.dataset.route !== r) cur.remove();
      if (r && !FLOATS[r] && (i === 0 || SPLIT) && !$(":scope > .sh-view", slot)) {
        const el = viewOf(r); slot.append(el);
        if (!el.dataset.painted) { el.dataset.painted = 1; paint(r); }
      }
      $(".sh-empty", slot).hidden = !!r;
    });
  }
  function sync() {
    if (PANES[0] && PANES[0] === PANES[1]) PANES[1] = null;
    place(); drawTabs(); save();
    const r = PANES[ACT];
    if (r && location.hash.slice(1) !== r) history.replaceState(null, "", "#" + r);
    document.title = (r ? titleOf(r) + " · " : "") + O.name;
    if (O.onShow) O.onShow(r);
  }
  function open(r, o = {}) {
    r = String(r || ""); if (!r) return;
    if (EMBED) { if (o.tab === "new" && r !== location.hash.slice(1)) up({ t: "open", url: location.pathname + location.search.replace(/[?&]embed=1/, "").replace(/^&/, "?") + "#" + r }); else location.hash = r; return; }
    if (FLOATS[r]) { FLOATS[r].style.zIndex = ++Z; return; }
    const here = o.tab === "here" && PANES[ACT] && !TABS.includes(r);
    if (here) {
      const old = PANES[ACT], i = TABS.indexOf(old);
      TABS[i] = r; dropView(old); PANES[ACT] = r;
    } else {
      if (!TABS.includes(r)) TABS.push(r);
      const other = PANES.indexOf(r);
      if (other > -1 && (SPLIT || other === 0)) ACT = other;
      else { if (!SPLIT && PANES[1] === r) PANES[1] = null; const p = o.pane ?? ACT; PANES[p] = r; ACT = p; }
    }
    sync();
  }
  function dropView(r) { const el = VIEWS[r]; if (el) el.remove(); delete VIEWS[r]; delete TITLES[r]; delete SEQ[r]; }
  function close(r) {
    if (!TABS.includes(r)) return;
    const i = TABS.indexOf(r);
    TABS = TABS.filter(t => t !== r);
    if (FLOATS[r]) { FLOATS[r].remove(); delete FLOATS[r]; }
    dropView(r);
    PANES = PANES.map(p => p === r ? (TABS.find(t => !PANES.includes(t) && !FLOATS[t]) || TABS[Math.max(0, i - 1)] || null) : p);
    if (!PANES[1]) { SPLIT = SPLIT && false; ACT = 0; }
    if (!TABS.length && O.home) { open(O.home); return; }
    sync();
  }
  function split(on, side2) {
    SPLIT = on ?? !SPLIT;
    if (SPLIT) {
      const r = side2 || PANES[ACT];
      if (side2) { if (PANES[0] === r) PANES[0] = TABS.find(t => t !== r && !FLOATS[t]) || null; PANES[1] = r; ACT = 1; }
      else if (!PANES[1]) PANES[1] = TABS.find(t => t !== PANES[0] && !FLOATS[t]) || null;
    } else ACT = 0;
    if (!SPLIT && !PANES[0]) PANES[0] = PANES[1];
    sync();
  }

  /* ---------- a page floating above the rest ---------- */
  function float(r) {
    r = r || PANES[ACT]; if (!r || FLOATS[r]) return;
    const f = document.createElement("div"); f.className = "sh-float"; f.dataset.tab = r; f.style.zIndex = ++Z;
    f.style.left = Math.max(10, innerWidth - 500) + "px"; f.style.top = "90px";
    f.innerHTML = `<div class="fh"><span>${iconOf(r)} ${esc(titleOf(r))}</span><button data-fl="back" title="Back into its tab">⤢</button><button data-fl="min" title="Make small">—</button><button data-fl="x" title="Close">✕</button></div><div class="fb"></div>`;
    document.body.append(f); FLOATS[r] = f;
    const el = viewOf(r); $(".fb", f).append(el);
    if (!el.dataset.painted) { el.dataset.painted = 1; paint(r); }
    PANES = PANES.map(p => p === r ? TABS.find(t => t !== r && !PANES.includes(t) && !FLOATS[t]) || null : p);
    if (!PANES[0]) { PANES[0] = PANES[1]; PANES[1] = null; SPLIT = false; ACT = 0; }
    sync();
    toast(`${titleOf(r)} floats above your work. ⤢ puts it back.`, { kind: "info" });
  }
  function unfloat(r) { const f = FLOATS[r]; if (!f) return; delete FLOATS[r]; f.remove(); open(r); }

  /* ---------- menus (ours, never the browser's) ---------- */
  function itemsHtml(L) {
    return L.map((x, i) => x === "-" ? "<hr>" : x.head ? `<div class="head">${esc(x.head)}</div>` : `<button class="it ${x.danger ? "danger" : ""}" data-i="${i}" data-l="${esc((x.label || "").toLowerCase())}" ${x.disabled ? "disabled" : ""}>${x.icon ? `<span>${x.icon}</span>` : ""}<span>${esc(x.label)}</span>${x.sub ? `<span class="k">›</span><div class="sub">${itemsHtml(x.sub).replace(/data-i="(\d+)"/g, `data-i="${i}.$1"`)}</div>` : x.kbd ? `<span class="k">${esc(x.kbd)}</span>` : ""}</button>`).join("");
  }
  function menu(at, L, o = {}) {
    closeMenus();
    const m = document.createElement("div"); m.className = "sh-menu"; m.id = "shMenu"; m.setAttribute("role", "menu");
    m.innerHTML = (o.search !== false && L.length > 6 ? `<div class="q">🔍<input placeholder="Search…" aria-label="Search the menu"></div>` : "") + `<div class="ls">${itemsHtml(L)}</div>`;
    document.body.append(m);
    const r = at.getBoundingClientRect ? at.getBoundingClientRect() : { left: at.x, right: at.x, top: at.y, bottom: at.y };
    const rtl = document.documentElement.dir === "rtl";
    let x = rtl ? r.right - m.offsetWidth : r.left, y = r.bottom + 4;
    x = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)); if (y + m.offsetHeight > innerHeight - 8) y = Math.max(8, r.top - m.offsetHeight - 4);
    m.style.left = x + "px"; m.style.top = y + "px";
    const pick = id => { const [a, b] = String(id).split(".").map(Number); const it = b == null ? L[a] : L[a].sub[b]; return it; };
    m.addEventListener("click", e => { const b = e.target.closest(".it"); if (!b || b.disabled) return; const it = pick(b.dataset.i); if (it.sub && !String(b.dataset.i).includes(".")) return; closeMenus(); it.run && it.run(); });
    const q = $(".q input", m);
    if (q) { q.focus(); q.oninput = () => { const s = q.value.trim().toLowerCase(); $$(".ls > .it", m).forEach(el => { const own = el.dataset.l.includes(s), kids = $$(".sub .it", el); kids.forEach(k => k.hidden = s && !own && !k.dataset.l.includes(s)); const hit = !s || own || kids.some(k => !k.hidden); el.hidden = !hit; el.classList.toggle("hov", !!s && hit && !own && kids.length > 0); }); }; }
    else ($(".it", m) || m).focus?.();
    m.addEventListener("keydown", e => {
      const its = $$(".ls > .it:not([hidden])", m), i = its.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); (its[i + 1] || its[0])?.focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (its[i - 1] || its[its.length - 1])?.focus(); }
      if (e.key === "Enter" && document.activeElement === q) { e.preventDefault(); its[0]?.click(); }
    });
    return m;
  }
  function closeMenus() { $("#shMenu")?.remove(); $$(".sh-pop").forEach(p => p.remove()); }

  /* ---------- ⌘K: find and run anything ---------- */
  function palette() {
    closeMenus(); $(".sh-pal")?.remove();
    const p = document.createElement("div"); p.className = "sh-pal";
    p.innerHTML = `<div class="box" role="dialog" aria-label="Search"><input placeholder="Search sections, open tabs, actions…" aria-label="Search"><div class="res"></div></div>`;
    document.body.append(p);
    const items = [
      ...O.nav.filter(n => !n.hidden).map(n => ({ g: "Go to", icon: n.icon, label: n.label, run: () => open(n.route) })),
      ...TABS.map(r => ({ g: "Open tabs", icon: iconOf(r), label: titleOf(r), run: () => open(r) })),
      ...(O.commands ? O.commands() : []).map(c => ({ g: "Actions", ...c })),
      { g: "Window", icon: "⊟", label: SPLIT ? "One page" : "Two pages side by side", kbd: "Ctrl+Alt+→", run: () => split() },
      { g: "Window", icon: "⧉", label: "Float this page", run: () => float() },
      { g: "Window", icon: "⌨", label: "Keyboard shortcuts", kbd: "?", run: keys }
    ];
    let sel = 0, shown = items;
    const res = $(".res", p), inp = $("input", p);
    const draw = () => { let g = ""; res.innerHTML = shown.map((x, i) => (x.g !== g ? `<div class="grp">${esc(g = x.g)}</div>` : "") + `<button class="r ${i === sel ? "on" : ""}" data-i="${i}"><span class="i">${x.icon || "•"}</span>${esc(x.label)}<span class="k">${esc(x.kbd || "")}</span></button>`).join("") || `<div class="sh-empty" style="position:static;padding:16px">Nothing found</div>`; $(".r.on", res)?.scrollIntoView({ block: "nearest" }); };
    const go = i => { const x = shown[i]; if (!x) return; p.remove(); x.run(); };
    inp.oninput = () => { const q = inp.value.trim().toLowerCase(); shown = items.filter(x => (x.label + " " + x.g).toLowerCase().includes(q)); sel = 0; draw(); };
    inp.onkeydown = e => { if (e.key === "ArrowDown") { sel = Math.min(sel + 1, shown.length - 1); draw(); e.preventDefault(); } if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); } if (e.key === "Enter") go(sel); if (e.key === "Escape") p.remove(); };
    p.onclick = e => { const r = e.target.closest(".r"); if (r) go(+r.dataset.i); else if (!e.target.closest(".box")) p.remove(); };
    draw(); inp.focus();
  }

  /* ---------- toasts and the notification centre ---------- */
  const KIND = { ok: ["✓", "rgba(52,211,153,.2)"], info: ["i", "rgba(96,165,250,.2)"], warn: ["!", "rgba(251,191,36,.2)"], err: ["✕", "rgba(248,113,113,.2)"] };
  function toast(text, o = {}) {
    const kind = o.kind || (/^(⚠|✕|error)/i.test(text) ? "err" : "ok"), [ic, bg] = KIND[kind];
    const t = document.createElement("div"); t.className = "sh-toast"; t.setAttribute("role", kind === "err" ? "alert" : "status");
    t.innerHTML = `<span class="i" style="background:${bg}">${ic}</span><span>${esc(text)}</span>${o.action ? `<button class="a">${esc(o.action)}</button>` : ""}`;
    if (o.action) $(".a", t).onclick = () => { t.remove(); o.run && o.run(); };
    $("#shToasts").prepend(t); setTimeout(() => t.remove(), o.ms || (o.action ? 6000 : 3200));
    NOTES.unshift({ text, kind, at: Date.now() }); NOTES.length = Math.min(NOTES.length, 40);
    if (EMBED && kind !== "ok") up({ t: "note", text, kind });
    const d = $('[data-sh="bell"] .sh-dot', main); if (d && kind !== "ok") { d.hidden = false; d.textContent = NOTES.filter(n => n.kind !== "ok" && !n.seen).length || ""; }
  }
  function notify(n) { NOTES.unshift({ kind: "info", at: Date.now(), ...n }); const d = $('[data-sh="bell"] .sh-dot', main); d.hidden = false; d.textContent = NOTES.filter(x => !x.seen && x.kind !== "ok").length || ""; }
  function pop(btn, html) {
    closeMenus();
    const p = document.createElement("div"); p.className = "sh-pop"; p.innerHTML = html; document.body.append(p);
    const r = btn.getBoundingClientRect(), rtl = document.documentElement.dir === "rtl";
    p.style.top = r.bottom + 6 + "px";
    p.style.left = Math.max(10, Math.min(rtl ? r.left : r.right - p.offsetWidth, innerWidth - p.offsetWidth - 10)) + "px";
    return p;
  }
  const ago = ms => { const m = (Date.now() - ms) / 6e4; return m < 1 ? "now" : m < 60 ? Math.round(m) + " min ago" : Math.round(m / 60) + " h ago"; };
  function bell(btn) {
    NOTES.forEach(n => n.seen = true); $('[data-sh="bell"] .sh-dot', main).hidden = true;
    pop(btn, `<h4><span>Notifications</span><span>${NOTES.length ? `<button data-sh="clear" style="color:#C4B5FD">Clear</button>` : ""}</span></h4>` + (NOTES.length ? NOTES.slice(0, 20).map(n => { const [ic, bg] = KIND[n.kind] || KIND.info; return `<div class="sh-nt"><span class="i" style="background:${bg}">${n.icon || ic}</span><div><b>${esc(n.title || n.text)}</b>${n.title && n.text ? esc(n.text) + "<br>" : ""}<small>${ago(n.at)}</small></div></div>`; }).join("") : `<div class="sh-empty" style="position:static;padding:14px">Nothing new. Messages, finished work and problems show up here.</div>`));
  }
  async function jobs(btn) {
    const p = pop(btn, `<h4><span>Working in the background</span></h4><div class="sh-empty" style="position:static;padding:10px">Loading…</div>`);
    let list = [];
    try { list = O.jobs ? await O.jobs() : []; } catch {}
    if (!p.isConnected) return;
    const ST = { queued: ["⏳", "waiting to start", 5], running: ["〰", "running", 50], done: ["✓", "ready", 100], failed: ["✕", "stopped", 100] };
    p.innerHTML = `<h4><span>Working in the background</span><span>${list.filter(j => ["queued", "running"].includes(j.status)).length} running</span></h4>` + (list.length ? list.map(j => { const s = ST[j.status] || ST.queued; return `<div class="sh-nt"><span class="i" style="background:${j.status === "failed" ? "rgba(248,113,113,.2)" : j.status === "done" ? "rgba(52,211,153,.2)" : "rgba(34,211,238,.2)"}">${s[0]}</span><div style="flex:1;min-width:0"><b>${esc(j.title)}</b><span>${esc(j.what || "")}</span> · <span>${s[1]}</span>${j.log ? ` · <span style="color:var(--mu)" dir="ltr">${esc(j.log.slice(0, 120))}</span>` : ""}${["queued", "running"].includes(j.status) ? `<div class="sh-bar2"><i style="width:${s[2]}%"></i></div>` : ""}<small style="display:block">${ago(j.at)}</small>${j.href ? ` · <a href="${esc(j.href)}" target="_blank" rel="noopener" style="color:#C4B5FD">Open</a>` : ""}</div></div>`; }).join("") : `<div class="sh-empty" style="position:static;padding:12px">Nothing is running. Audio and other long work keeps going here while you do something else.</div>`);
  }

  /* ---------- our own dialogs ---------- */
  function dialog(html, onSubmit) {
    return new Promise(res => {
      const d = document.createElement("dialog"); d.className = "sh-dlg";
      d.innerHTML = `<form method="dialog">${html}</form>`;
      document.body.append(d);
      const f = $("form", d);
      f.onsubmit = e => {
        if (e.submitter && e.submitter.value === "cancel") return;
        e.preventDefault();
        const err = onSubmit ? onSubmit(f) : null;
        if (err) { $(".err", d).textContent = err; return; }
        d.dataset.ok = 1; d.close();
      };
      d.addEventListener("close", () => { const ok = !!d.dataset.ok; const v = f.elements.v ? f.elements.v.value : true; d.remove(); res(ok ? v : null); });
      d.showModal();
      (f.elements.v || $("button[value=ok]", d))?.focus();
    });
  }
  // ask for one value: Shell.ask({ title, text, label, value, placeholder, ok, type, validate: v => "error" | "" })
  function ask(o) {
    return dialog(`<h3>${esc(o.title)}</h3>${o.text ? `<p style="color:var(--mu);margin:0">${esc(o.text)}</p>` : ""}
      <label style="font-size:12px;color:var(--mu)">${esc(o.label || "")}<input class="in" name="v" type="${esc(o.type || "text")}" value="${esc(o.value ?? "")}" placeholder="${esc(o.placeholder || "")}" autocomplete="off" style="margin-top:4px"></label>
      <div class="err" role="alert"></div><div class="row2"><button class="b" value="cancel" formnovalidate>Cancel <span class="sh-kbd">Esc</span></button><button class="b pr" value="ok">${esc(o.ok || "OK")}</button></div>`,
      f => { const v = f.elements.v.value.trim(); return !v ? "Please fill this in." : o.validate ? o.validate(v) : ""; });
  }
  // yes or no: Shell.confirm({ title, text, ok, danger, type: "word the person must type" })
  async function confirm(o) {
    const v = await dialog(`<h3 style="${o.danger ? "color:var(--rd)" : ""}">${esc(o.title)}</h3>${o.text ? `<p style="color:var(--mu);margin:0">${esc(o.text)}</p>` : ""}
      ${o.type ? `<label style="font-size:12px;color:var(--mu)">Type <b>${esc(o.type)}</b> to confirm<input class="in" name="v" autocomplete="off" style="margin-top:4px"></label>` : ""}
      <div class="err" role="alert"></div><div class="row2"><button class="b" value="cancel" formnovalidate>Cancel</button><button class="b ${o.danger ? "d" : "pr"}" value="ok">${esc(o.ok || "OK")}</button></div>`,
      f => o.type && f.elements.v.value.trim().toLowerCase() !== String(o.type).toLowerCase() ? `Type “${o.type}” exactly.` : "");
    return v !== null;
  }
  function keys() {
    const K = [[MOD + "K", "search sections and run actions"], ["Alt+W", "close the tab"], ["Alt+1…9", "go to tab 1…9"], ["Ctrl+Alt+→", "two pages side by side"], ["Ctrl+Alt+←", "back to one page"], ["Ctrl+Alt+F", "float the page"], ["G then a letter", "go to a section (G U = Users)"], ["Esc", "close a menu or dialog"], ["?", "this list"]];
    dialog(`<h3>Keyboard shortcuts</h3><div class="sh-keys">${K.map(([k, t]) => `<span class="sh-kbd" style="font-size:12px;padding:2px 7px">${esc(k)}</span><span>${esc(t)}</span>`).join("")}</div><div class="row2"><button class="b pr" value="ok">Close</button></div>`);
  }

  /* ---------- events ---------- */
  function events() {
    document.addEventListener("click", e => {
      const t = e.target;
      const c = t.closest("[data-close]"); if (c && bar.contains(c)) { e.preventDefault(); close(c.dataset.close); return; }
      const tb = t.closest(".sh-tab[data-tab]"); if (tb) { open(tb.dataset.tab); return; }
      const nv = t.closest("[data-nav]"); if (nv && side.contains(nv)) { e.preventDefault(); open(nv.dataset.nav, { tab: e.altKey ? "here" : "new" }); return; }
      const fl = t.closest("[data-fl]"); if (fl) { const f = fl.closest(".sh-float"), r = f.dataset.tab; if (fl.dataset.fl === "min") f.classList.toggle("mini"); else if (fl.dataset.fl === "back") unfloat(r); else close(r); return; }
      const pn = t.closest(".sh-pane"); if (pn && SPLIT && +pn.dataset.p !== ACT) { ACT = +pn.dataset.p; drawTabs(); save(); }
      const sh = t.closest("[data-sh]");
      if (sh) {
        const k = sh.dataset.sh;
        if (k === "split") return split();
        if (k === "float") return float();
        if (k === "jobs") return jobs(sh);
        if (k === "bell") return bell(sh);
        if (k === "clear") { NOTES.length = 0; closeMenus(); return; }
        if (k === "keys") return keys();
        if (k === "pal") return palette();
        if (k === "new") return menu(sh, [{ head: "Open in a new tab" }, ...O.nav.filter(n => !n.hidden).map(n => ({ icon: n.icon, label: n.label, run: () => open(n.route) }))]);
        if (k === "me") return menu(sh, [...(O.menu ? O.menu() : []), "-", { icon: "⌨", label: "Keyboard shortcuts", kbd: "?", run: keys }, { icon: "↩", label: "Sign out", run: O.signOut }], { search: false });
        if (k === "out") return O.signOut();
      }
      if (!t.closest(".sh-menu, .sh-pop, [data-sh]")) closeMenus();
    });
    // in-page links (#route) open in the current tab; Ctrl/⌘-click opens a new tab
    document.addEventListener("click", e => {
      const a = e.target.closest('a[href^="#"]'); if (!a || side.contains(a) || e.defaultPrevented) return;
      const r = a.getAttribute("href").slice(1); if (!r) return;
      e.preventDefault(); open(r, { tab: e.ctrlKey || e.metaKey || e.button === 1 ? "new" : "here" });
    });
    addEventListener("hashchange", () => { const r = location.hash.slice(1); if (r && r !== PANES[ACT]) open(r, { tab: "here" }); });
    // our right-click menu on tabs, and in the panel where nothing else has one
    document.addEventListener("contextmenu", e => {
      const tb = e.target.closest(".sh-tab[data-tab]");
      if (tb) {
        e.preventDefault(); const r = tb.dataset.tab;
        return menu({ x: e.clientX, y: e.clientY }, [
          { icon: "◧", label: "Show on the left", run: () => { if (!SPLIT) split(true); PANES[0] = r; if (PANES[1] === r) PANES[1] = TABS.find(t => t !== r) || null; ACT = 0; sync(); } },
          { icon: "◨", label: "Show on the right", kbd: "Ctrl+Alt+→", run: () => split(true, r) },
          { icon: "⧉", label: "Float above the rest", kbd: "Ctrl+Alt+F", run: () => float(r) },
          { icon: "⟳", label: "Reload", run: () => paint(r) }, "-",
          { icon: "✕", label: "Close", kbd: "Alt+W", run: () => close(r) },
          { icon: "✕", label: "Close the other tabs", run: () => TABS.filter(t => t !== r).forEach(close) }], { search: false });
      }
      if (e.defaultPrevented || e.target.closest("input, textarea, [contenteditable], a, .sh-menu")) return;
      if (!e.target.closest(".sh-main, .sh-side")) return;
      e.preventDefault();
      menu({ x: e.clientX, y: e.clientY }, [
        { icon: "🔍", label: "Search or run…", kbd: MOD + "K", run: palette },
        { icon: "⟳", label: "Reload this page", run: () => refresh() },
        { icon: "⊟", label: SPLIT ? "One page" : "Two pages side by side", run: () => split() },
        { icon: "⧉", label: "Float this page", run: () => float() },
        ...(O.commands ? O.commands().slice(0, 4) : [])], { search: false });
    });
    // shortcuts
    let gWait = 0;
    document.addEventListener("keydown", e => {
      const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable], l-select, l-date");
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      if (e.key === "Escape") { closeMenus(); $(".sh-pal")?.remove(); }
      if (mod && k === "k") { e.preventDefault(); return palette(); }
      if (e.altKey && !mod && (k === "w" || e.code === "KeyW")) { e.preventDefault(); return close(PANES[ACT]); }
      if (e.altKey && !mod && /^Digit[1-9]$/.test(e.code)) { e.preventDefault(); const r = TABS[+e.code.slice(5) - 1]; if (r) open(r); return; }
      if (e.ctrlKey && e.altKey) {
        if (e.key === "ArrowRight") { e.preventDefault(); return split(true, document.documentElement.dir === "rtl" ? undefined : undefined); }
        if (e.key === "ArrowLeft") { e.preventDefault(); return split(false); }
        if (k === "f") { e.preventDefault(); return float(); }
      }
      if (typing || mod || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); return keys(); }
      if (k === "g") { gWait = Date.now(); return; }
      if (gWait && Date.now() - gWait < 1200) { gWait = 0; const n = O.nav.find(x => (x.key || x.label.trim()[0]).toLowerCase() === k); if (n) { e.preventDefault(); open(n.route); } }
    });
    // drag a tab: onto another tab to reorder, onto a page to show it there (the right half opens a second page)
    let drag = null;
    document.addEventListener("dragstart", e => { const t = e.target.closest && e.target.closest(".sh-tab[data-tab]"); if (!t) return; drag = t.dataset.tab; t.classList.add("drag"); try { e.dataTransfer.setData("text/plain", drag); e.dataTransfer.effectAllowed = "move"; } catch {} });
    document.addEventListener("dragend", () => { drag = null; $$(".sh-tab.drag").forEach(x => x.classList.remove("drag")); $$(".sh-pane.drop").forEach(x => x.classList.remove("drop")); });
    document.addEventListener("dragover", e => {
      if (!drag) return;
      if (e.target.closest(".sh-tab[data-tab]")) { e.preventDefault(); return; }
      if (!e.target.closest(".sh-panes")) return; e.preventDefault();
      $$(".sh-pane.drop").forEach(x => x.classList.remove("drop"));
      const R = panesEl.getBoundingClientRect(), right = document.documentElement.dir === "rtl" ? e.clientX < R.left + R.width * .45 : e.clientX > R.left + R.width * .55;
      const pn = SPLIT ? e.target.closest(".sh-pane") : $('.sh-pane[data-p="0"]', main);
      pn?.classList.add("drop"); $(".sh-slot", pn).dataset.drop = !SPLIT && right ? "Drop: show it next to this page" : "Drop the tab here";
      panesEl.dataset.right = !SPLIT && right ? 1 : "";
    });
    document.addEventListener("drop", e => {
      if (!drag) return; const r = drag; e.preventDefault();
      const t = e.target.closest(".sh-tab[data-tab]");
      if (t) { const to = TABS.indexOf(t.dataset.tab); TABS = TABS.filter(x => x !== r); TABS.splice(to, 0, r); return sync(); }
      if (!e.target.closest(".sh-panes")) return;
      if (!SPLIT && panesEl.dataset.right) return split(true, r);
      const p = e.target.closest(".sh-pane"); open(r, { pane: p ? +p.dataset.p : 0 });
    });
    // resize the two pages; move floating pages
    let pd = null;
    document.addEventListener("pointerdown", e => {
      const f = e.target.closest(".sh-float"); if (f) f.style.zIndex = ++Z;
      const h = e.target.closest(".sh-float .fh");
      if (h && !e.target.closest("button") && innerWidth > 760) { const r = f.getBoundingClientRect(); pd = { f, dx: e.clientX - r.left, dy: e.clientY - r.top }; h.setPointerCapture(e.pointerId); }
      if (e.target.closest(".sh-div")) { pd = { div: panesEl.getBoundingClientRect() }; e.target.setPointerCapture(e.pointerId); }
    });
    document.addEventListener("pointermove", e => {
      if (!pd) return;
      if (pd.div) { let x = (e.clientX - pd.div.left) / pd.div.width; if (document.documentElement.dir === "rtl") x = 1 - x; x = Math.min(.8, Math.max(.2, x)); panesEl.style.setProperty("--a", x + "fr"); panesEl.style.setProperty("--b", 1 - x + "fr"); return; }
      pd.f.style.left = Math.min(Math.max(e.clientX - pd.dx, 0), innerWidth - 120) + "px"; pd.f.style.top = Math.min(Math.max(e.clientY - pd.dy, 0), innerHeight - 40) + "px";
    });
    document.addEventListener("pointerup", () => pd = null);
  }

  /* ---------- start ---------- */
  function embedInit() {
    const st = document.createElement("style");
    st.textContent = CSS + `body.sh-embed{display:block!important;height:100vh;overflow:hidden}body.sh-embed>aside{display:none!important}.sh-embed .sh-main{position:fixed;inset:0;height:100vh}.sh-embed .sh-view{padding:20px 24px 50px}`;
    document.head.append(st); document.body.classList.add("sh", "sh-embed");
    main.classList.add("sh-main"); main.innerHTML = "";
    const box = document.createElement("div"); box.className = "sh-toasts"; box.id = "shToasts"; document.body.append(box);
    const show = () => { const r = location.hash.slice(1) || O.home || O.nav[0].route; TABS = [r]; PANES = [r, null]; ACT = 0; main.innerHTML = ""; for (const k in VIEWS) delete VIEWS[k]; const el = viewOf(r); main.append(el); el.dataset.painted = 1; paint(r).then(() => up({ t: "title", title: titleOf(r), icon: iconOf(r), url: location.pathname + location.search.replace(/[?&]embed=1/, "").replace(/^&/, "?") + "#" + r })); if (O.onShow) O.onShow(r); };
    addEventListener("hashchange", show);
    // keys that belong to the environment
    document.addEventListener("keydown", e => {
      const KEYS = () => { try { return Object.values(JSON.parse(localStorage.getItem("lapp.keys")) || {}); } catch { return []; } };
      const k = ["Control", "Alt", "Shift", "Meta"].includes(e.key) ? "" : e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.code === "Backquote" ? "`" : e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const c = k && [(e.ctrlKey || e.metaKey) && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", k].filter(Boolean).join("+");
      if (c && KEYS().includes(c)) { e.preventDefault(); e.stopPropagation(); up({ t: "key", combo: c }); }
      else if (e.key === "Escape" && !document.querySelector("dialog[open]")) up({ t: "key", combo: "Escape" });
    }, true);
    // the studio and other pages open as tabs of the environment, never as new browser tabs
    document.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
      const u = new URL(a.href, location.href); if (u.origin !== location.origin || !/^\/(studio|admin|s\/)/.test(u.pathname)) return;
      if (a.target === "_blank" || u.pathname !== location.pathname) { e.preventDefault(); up({ t: "open", url: u.pathname + u.search + u.hash }); }
    }, true);
    const wo = window.open.bind(window);
    window.open = (url, ...rest) => { if (url === "about:blank") return null; const u = new URL(url, location.href); if (u.origin === location.origin && /^\/(studio|admin|s\/)/.test(u.pathname)) { up({ t: "open", url: u.pathname + u.search + u.hash }); return null; } return wo(url, ...rest); };
    O.signOut = O.signOut || (() => {});
    show();
  }
  function init(o) {
    O = o; side = o.side; main = o.main;
    // opened on its own: the page belongs inside the one management environment
    if (!EMBED && !o.standalone) { location.replace("/manage#open=" + encodeURIComponent(location.pathname + location.search + location.hash)); return; }
    if (EMBED) return embedInit();
    frame(); drawSide(); events();
    let s = null; try { s = JSON.parse(localStorage.getItem(O.key) || "null"); } catch {}
    const want = location.hash.slice(1);
    const ok = r => !!navOf(r);
    if (s && Array.isArray(s.tabs) && s.tabs.filter(ok).length) {
      TABS = s.tabs.filter(ok).slice(0, 12); PANES = (s.panes || []).map(p => TABS.includes(p) ? p : null); while (PANES.length < 2) PANES.push(null);
      SPLIT = !!(s.split && PANES[1]); ACT = SPLIT ? (s.act === 1 ? 1 : 0) : 0; if (!PANES[0]) PANES[0] = TABS[0];
      if (TABS.length > 1) setTimeout(() => toast(`Welcome back · ${TABS.length} tabs are open as you left them`, { kind: "info", action: "Start fresh", run: () => { TABS.slice().forEach(close); } }), 400);
    }
    if (want && ok(want)) open(want); else if (!TABS.length) open(O.home || O.nav[0].route); else sync();
  }
  function refresh(r) { if (EMBED) r = PANES[0]; r = r || PANES[ACT]; return r && VIEWS[r] ? paint(r) : Promise.resolve(); }
  function title(r, t) { TITLES[r] = t; if (EMBED) { up({ t: "title", title: t }); return; } drawTabs(); const f = FLOATS[r]; if (f) $(".fh span", f).textContent = iconOf(r) + " " + t; }
  function badge(id, v) { const el = document.getElementById(id); if (el) el.textContent = v || ""; }

  window.Shell = { init, open, close, refresh, split, float, menu, palette, toast, notify, ask, confirm, title, badge, keys,
    route: () => PANES[ACT], view: r => VIEWS[r || PANES[ACT]], tabs: () => TABS.slice(), get active() { return !!O; } };
})();
