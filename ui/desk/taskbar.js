// LAPP work desktop · taskbar: workspace switcher · dock (pinned apps + open windows) · tray (AI, running work, notifications, you).
// Windows group by app, or by task/project; the AI may choose the grouping (the person can change it).
"use strict";
(function () {
  const { $, $$, esc, I } = D;
  const pinsOf = ws => (D.DESK.pins && D.DESK.pins[ws]) || D.APPS.filter(a => a.ws === ws).slice(0, 4).map(a => a.id);
  const setPins = (ws, list) => { D.DESK.pins = { ...(D.DESK.pins || {}), [ws]: list }; D.save(); draw(); };
  const RANK = { error: 5, dirty: 4, ai: 3, busy: 2, rec: 2, ok: 1, "": 0 };
  const worst = ws => ws.map(w => w.state || "").sort((a, b) => RANK[b] - RANK[a])[0] || "";
  const winApp = w => (D.appOf(w.url) || { id: D.appKey(w.url), title: w.title, icon: w.icon, url: w.url }).id;
  D.groupMode = () => (D.DESK && D.DESK.groupBy) || "auto";

  // groups (capsules): task groups the person made, or project groups (auto: windows of the same lesson; or the AI's)
  function capsules(wins) {
    const mode = D.groupMode(), out = [];
    if (mode === "task") ((D.DESK.groups || {})[D.CUR] || []).forEach(g => { const ws = wins.filter(w => g.urls.includes(w.url)); if (ws.length) out.push({ ...g, wins: ws, kind: "task" }); });
    if (mode === "auto") {
      const ai = ((D.DESK.aiGroups || {})[D.CUR] || []).map(g => ({ ...g, wins: wins.filter(w => g.urls.includes(w.url)) })).filter(g => g.wins.length > 1);
      if (ai.length) ai.forEach(g => out.push({ ...g, kind: "ai" }));
      else { const by = {}; wins.filter(w => w.lesson).forEach(w => (by[w.lesson.id] = by[w.lesson.id] || []).push(w)); Object.values(by).filter(x => x.length > 1).forEach(x => out.push({ id: "l" + x[0].lesson.id, name: x[0].lesson.title, color: "#FF3D7F", wins: x, kind: "project" })); }
    }
    // other signed-in accounts: their windows sit together in one capsule each, with the account's face on the left
    if (D.ACCTS.length > 1) { const cur = (D.wsOf(D.CUR) || {}).as || 0;
      D.ACCTS.filter(ac => ac.slot !== cur).forEach(ac => { const ws = D.WN().filter(w => (w.as || 0) === ac.slot); if (ws.length) out.push({ id: "acct" + ac.slot, name: ac.user.name || "@" + ac.user.username, color: D.wsOf(ac.ws[0]).color, wins: ws, kind: "acct", av: ac.user }); }); }
    return out;
  }
  function items() {
    const wins = D.WN().filter(w => w.ws === D.CUR), caps = capsules(wins), inCap = new Set(caps.flatMap(c => c.wins.map(w => w.id)));
    const pins = pinsOf(D.CUR), apps = new Map();
    pins.forEach(id => { const a = D.APPS.find(x => x.id === id); if (a) apps.set(id, { app: a, wins: [], pinned: true }); });
    wins.filter(w => !inCap.has(w.id)).forEach(w => { const id = winApp(w); if (!apps.has(id)) apps.set(id, { app: D.APPS.find(x => x.id === id) || { id, title: w.title, icon: w.icon, url: w.url }, wins: [], pinned: false }); apps.get(id).wins.push(w); });
    return { apps: [...apps.values()], caps };
  }
  const counts = () => D.waiting();
  D.counts = counts;
  function draw() {
    if (!D.DESK) return;
    const CN = counts();
    const { apps, caps } = items(), ws = D.wsOf(D.CUR);
    const sw = $("#wsb"); sw.hidden = D.WS.length < 2; sw.innerHTML = `<i style="background:${ws.color}"></i><span>${esc(ws.name)}</span>${I("chevron-down", 14)}`;
    $("#dock").innerHTML = apps.map((it, k) => {
      const on = it.wins.some(w => w.id === D.ACTW && !w.min), st = worst(it.wins), one = it.wins.length === 1 ? it.wins[0] : null;
      return `<button class="dk ${it.wins.length ? "run" : ""} ${on ? "on" : ""}" data-dk="${esc(it.app.id)}" draggable="true" style="--c:${it.app.color || ws.color}" title="${esc(it.app.title)}">${I(it.app.icon, 19) || D.IE(it.app.icon)}${it.wins.length ? `<span class="t">${esc(one ? one.title : it.app.title)}</span>` : ""}${it.wins.length > 1 ? `<span class="n">${it.wins.length}</span>` : ""}${CN[it.app.id] ? `<span class="wk" title="${CN[it.app.id]} waiting">${CN[it.app.id] > 99 ? "99+" : CN[it.app.id]}</span>` : ""}${st ? `<span class="sd ${st}"></span>` : ""}</button>`;
    }).join("") + (caps.length ? `<span class="dsep"></span>` + caps.map(c => `<div class="dk grp" data-cap="${esc(c.id)}" style="--c:${c.color || "#8B5CF6"}" title="${esc(c.name)}">${c.av ? K.avatar(c.av, 22) : ""}<span class="gn">${esc(c.name)}</span>${c.wins.map(w => `<span class="gi ${w.id === D.ACTW && !w.min ? "on" : ""}" data-gw="${w.id}" title="${esc(w.title)}">${I(w.icon, 15) || D.IE(w.icon)}${w.state ? `<span class="sd ${w.state}" style="top:1px;inset-inline-start:1px;width:6px;height:6px"></span>` : ""}</span>`).join("")}</div>`).join("") : "");
    const run = D.running().length, un = D.NOTES.filter(n => !n.read).length;
    $("#trRun").innerHTML = run ? `<span class="spin"></span><span class="bd">${run}</span>` : I("hourglass", 17);
    $("#trBell").innerHTML = `${I("bell", 17)}${un ? `<span class="bd">${un}</span>` : ""}`;
  }
  D.drawTask = draw;
  ["wins", "ws", "state", "jobs", "notes"].forEach(e => D.on(e, draw));

  const capOf = id => { const { caps } = items(); return caps.find(c => c.id === id); };
  const appItem = id => items().apps.find(x => x.app.id === id);
  function winList(wins, anchor, title) {
    const p = D.pop(anchor, `<h6>${esc(title)}</h6>` + wins.map(w => `<div class="pi" data-pw="${w.id}" draggable="true"><span class="ri">${I(w.icon, 15) || D.IE(w.icon)}</span><span class="tx"><b>${esc(w.title)}</b><small>${w.state ? esc({ busy: "working…", ai: "AI working…", dirty: "not saved", error: "a problem", ok: "done", rec: "recording" }[w.state]) + " · " : ""}${w.min ? "minimised" : w.id === D.ACTW ? "active" : "open"}${w.ws !== D.CUR ? " · " + esc(D.wsOf(w.ws).name) : ""}</small></span><span class="qa"><button data-pq="left" title="Left half">${I("sidebar", 14)}</button><button data-pq="right" title="Right half">${I("sidebar", 14)}</button><button data-pq="close" title="Close">${I("x", 14)}</button></span></div>`).join(""));
    return p;
  }
  function openApp(it, anchor) {
    if (!it.wins.length) return D.openWin(it.app.url);
    if (it.wins.length === 1) { const w = it.wins[0]; if (w.ws !== D.CUR) { D.switchWs(w.ws); return D.focusWin(w); } return w.id === D.ACTW && !w.min ? D.minWin(w) : D.focusWin(w); }
    winList(it.wins, anchor, it.app.title);
  }

  /* ---------- workspace switcher ---------- */
  // the clock: a month at a glance
  let CALM = 0;
  function calPop(anchor) {
    const t = new Date(), base = new Date(t.getFullYear(), t.getMonth() + CALM, 1), first = (base.getDay() + 6) % 7, days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells = []; for (let i = 0; i < first; i++) cells.push(`<span class="d"></span>`);
    for (let d = 1; d <= days; d++) cells.push(`<span class="d m ${!CALM && d === t.getDate() ? "t" : ""}">${d}</span>`);
    const wd = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(D.loc(), { weekday: "narrow" }));
    const p = D.pop(anchor, `<div class="calp"><div class="mh"><button data-cal="-1" aria-label="Previous month" style="transform:scaleX(-1)">${I("chevron", 15)}</button><b>${esc(base.toLocaleDateString(D.loc(), { month: "long", year: "numeric" }))}</b><button data-cal="1" aria-label="Next month">${I("chevron", 15)}</button></div><div class="calg">${wd.map(x => `<span class="h">${esc(x)}</span>`).join("")}${cells.join("")}</div></div>`);
    if (p) p.onclick = e => { const b = e.target.closest("[data-cal]"); if (!b) return; e.stopPropagation(); CALM += +b.dataset.cal; calPop(anchor); };
  }
  D.ACT.ws = () => { const i = D.WS.findIndex(w => w.key === D.CUR); D.switchWs(D.WS[(i + 1) % D.WS.length].key); D.toast(D.wsOf(D.CUR).name, { kind: "info" }); };
  function wsPop(anchor) {
    D.pop(anchor, `<h6>Workspaces</h6>` + D.WS.map(w => { const n = D.WN().filter(x => x.ws === w.key).length; return `<button class="pi ${w.key === D.CUR ? "sel" : ""}" data-ws="${esc(w.key)}"><span class="ri" style="background:${w.color}33;color:${w.color}">${I(w.key === "me" ? "home" : "school", 15)}</span><span class="tx"><b>${esc(w.name)}</b><small>${n} window${n === 1 ? "" : "s"}</small></span>${w.key === D.CUR ? `<span class="k">${I("check", 14)}</span>` : ""}</button>`; }).join("") + `<div class="pempty" style="padding:6px 8px;text-align:start">${esc(D.nice(D.BIND.ws))} · next workspace</div>`);
  }

  /* ---------- tray: running work, notifications, you ---------- */
  function runPop(anchor) {
    const js = D.JOBS.slice(0, 12);
    D.pop(anchor, `<h6>Working in the background</h6>` + (js.map(j => `<button class="pi" data-go="lesson:${esc(j.scope.q)}:${j.lesson}:voice"><span class="ri">${I(j.status === "done" ? "check" : j.status === "failed" ? "x" : "wave", 15)}</span><span class="tx"><b>${esc(j.title)}</b><small>Audio · ${esc(D.JOBTXT[j.status] || j.status)} · ${D.ago(j.at)}</small>${["queued", "running"].includes(j.status) ? `<div class="bar thin" style="margin-top:4px"><i style="width:${j.status === "running" ? 55 : 8}%"></i></div>` : ""}</span></button>`).join("") || `<div class="pempty">Nothing is running. Audio keeps being made here while you do other things.</div>`));
  }
  function bellPop(anchor) {
    const ns = D.NOTES.slice(0, 20);
    D.pop(anchor, `<h6>Notifications ${ns.some(n => !n.read) ? `<button data-markread>mark all read</button>` : ""}</h6>` + (ns.map(n => { const [ic, bg] = D.KIND[n.kind] || D.KIND.info; return `<button class="pi" data-go="nopen:${esc(n.id)}" style="${n.read ? "opacity:.55" : ""}"><span class="ri" style="background:${bg}">${I(n.icon && Icon.names.includes(n.icon) ? n.icon : ic, 15)}</span><span class="tx"><b>${esc(n.text)}</b><small>${esc(n.from || "")} · ${D.ago(n.at)}</small></span></button>`; }).join("") || `<div class="pempty">Nothing yet. Finished audio, problems in your pages and messages land here.</div>`));
  }
  D.groupMenu = (x, y) => D.cmenu(x, y, [{ head: "Group windows" }, ["Automatic (AI)", "", () => setMode("auto"), 0, "ai", { on: D.groupMode() === "auto" }], ["By app", "", () => setMode("app"), 0, "grid", { on: D.groupMode() === "app" }], ["By task (my groups)", "", () => setMode("task"), 0, "group", { on: D.groupMode() === "task" }], "-", ["✦ Group my windows with the AI", "", aiGroup, 0, "wand"], ["New task group from the open windows…", "", newTask, 0, "plus"]], { above: true });
  function setMode(m) { D.DESK.groupBy = m; D.save(); draw(); }
  async function newTask() {
    const ws = D.WN().filter(w => w.ws === D.CUR && !w.min); if (!ws.length) return D.toast("Open some windows first", { kind: "info" });
    const name = await D.askName("Name this task group", "My task"); if (!name) return;
    const gs = { ...(D.DESK.groups || {}) }; gs[D.CUR] = [...(gs[D.CUR] || []), { id: "g" + Date.now(), name, color: ["#22D3EE", "#F59E0B", "#34D399", "#FF3D7F", "#A78BFA"][(gs[D.CUR] || []).length % 5], urls: ws.map(w => w.url) }];
    D.DESK.groups = gs; setMode("task"); D.toast(`Task group “${name}” · click it to bring all its windows back`);
  }
  async function aiGroup() {
    const ws = D.WN().filter(w => w.ws === D.CUR); if (ws.length < 3) return D.toast("The AI groups windows once 3 or more are open", { kind: "info" });
    D.toast("The AI is grouping your windows…", { kind: "info" });
    try {
      const r = await D.api("POST", "/assist/groups", { windows: ws.map(w => ({ id: "w" + w.id, label: w.title + (w.lesson ? " (lesson " + w.lesson.title + ")" : "") })) });
      const groups = (r.groups || []).map((g, i) => ({ id: "a" + i, name: g.name, color: ["#8B5CF6", "#22D3EE", "#F59E0B", "#34D399"][i % 4], urls: g.ids.map(id => D.W(id.slice(1))).filter(Boolean).map(w => w.url) })).filter(g => g.urls.length > 1);
      D.DESK.aiGroups = { ...(D.DESK.aiGroups || {}), [D.CUR]: groups }; setMode("auto");
      D.toast(groups.length ? `Grouped into ${groups.length}: ${groups.map(g => g.name).join(", ")}` : "The AI found nothing to group", { kind: "info" });
    } catch (e) { D.toast(e.message, { kind: "err" }); }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest) return;
    if (t.closest("#lb")) return D.ccOpen();
    if (t.closest("#wsb")) return $(".k-pop") ? D.closeMenus() : wsPop($("#wsb"));
    const tr = t.closest("[data-tr]"); if (tr) { if (tr.classList.contains("open")) return D.closeMenus(); const k = tr.dataset.tr; if (k === "ai") return D.ccOpen("ai"); if (k === "running") return runPop(tr); if (k === "alerts") return bellPop(tr); if (k === "me") return D.ccOpen("accounts"); if (k === "clock") return calPop(tr); }
    const dk = t.closest("[data-dk]"); if (dk) { D.closeMenus(); const it = appItem(dk.dataset.dk); return it && openApp(it, dk); }
    const gw = t.closest("[data-gw]"); if (gw) { const w = D.W(gw.dataset.gw); if (w.ws !== D.CUR) { D.switchWs(w.ws); return D.focusWin(w); } return w.id === D.ACTW && !w.min ? D.minWin(w) : D.focusWin(w); }
    const cap = t.closest("[data-cap]"); if (cap) { const c = capOf(cap.dataset.cap); if (c) { c.wins.forEach(w => { w.min = false; D.place(w); }); c.wins.forEach(w => D.focusWin(w)); } return; }
    const pw = t.closest("[data-pw]"); if (pw) { const w = D.W(pw.dataset.pw), q = t.closest("[data-pq]"); if (q) { if (q.dataset.pq === "close") { D.closeWin(w); pw.remove(); if (!$$(".k-pop [data-pw]").length) D.closeMenus(); } else { D.snap(w, q.dataset.pq); D.closeMenus(); } return; } D.closeMenus(); return D.focusWin(w); }
    const wsx = t.closest("[data-ws]"); if (wsx) { D.closeMenus(); return D.switchWs(wsx.dataset.ws); }
    if (t.closest("[data-markread]")) { D.NOTES.forEach(n => n.read = true); D.closeMenus(); return draw(); }
  });
  document.addEventListener("auxclick", e => { if (e.button !== 1 || !e.target.closest) return; const dk = e.target.closest("[data-dk]"); if (dk) { const it = appItem(dk.dataset.dk); if (it && it.wins.length === 1) { e.preventDefault(); D.closeWin(it.wins[0]); } } });
  // hover: a preview of the windows behind a dock button
  let hovT;
  document.addEventListener("mouseover", e => {
    if (!e.target.closest) return; const dk = e.target.closest("[data-dk]");
    clearTimeout(hovT); if (!dk || $(".k-pop")) { if (!dk) $(".prev")?.remove(); return; }
    hovT = setTimeout(() => { const it = appItem(dk.dataset.dk); if (!it) return; $(".prev")?.remove(); const p = document.createElement("div"); p.className = "prev"; p.innerHTML = `<b>${esc(it.app.title)}</b>` + (it.wins.length ? it.wins.map(w => `<small>${esc(w.title)}${w.min ? " · minimised" : ""}${w.state ? " · " + w.state : ""}</small>`).join("") : `<small>Click to open</small>`); const r = dk.getBoundingClientRect(); document.body.append(p); p.style.left = Math.max(8, Math.min(r.left, innerWidth - 250)) + "px"; }, 380);
  });
  document.addEventListener("contextmenu", e => {
    if (!e.target.closest || !e.target.closest("#tb")) return; e.preventDefault();
    const dk = e.target.closest("[data-dk]"), cap = e.target.closest("[data-cap]"), x = e.clientX, y = e.clientY;
    if (dk) {
      const it = appItem(dk.dataset.dk), pins = pinsOf(D.CUR), pinned = pins.includes(it.app.id), real = D.APPS.some(a => a.id === it.app.id);
      return D.cmenu(x, y, [["Open " + it.app.title, "", () => D.openWin(it.app.url), 0, "external"], ...(real ? [[pinned ? "Unpin from the taskbar" : "Pin to the taskbar", "", () => setPins(D.CUR, pinned ? pins.filter(p => p !== it.app.id) : [...pins, it.app.id]), 0, "pin"]] : []),
        ...(it.wins.length ? ["-", [`Close ${it.wins.length > 1 ? "all " + it.wins.length + " windows" : "the window"}`, "", () => it.wins.forEach(D.closeWin), 1, "x"]] : []), "-", ["Group windows…", "", () => D.groupMenu(x, y), 0, "group"]], { above: true });
    }
    if (cap) {
      const c = capOf(cap.dataset.cap);
      return D.cmenu(x, y, [["Bring the group back", "", () => c.wins.forEach(w => D.focusWin(w)), 0, "layers"], ["Minimise the group", "", () => c.wins.forEach(D.minWin), 0, "minus"], ...(c.kind === "task" ? [["Rename…", "", async () => { const n = await D.askName("Rename the group", c.name); if (n) { const g = D.DESK.groups[D.CUR].find(z => z.id === c.id); g.name = n; D.save(); draw(); } }, 0, "rename"], ["Ungroup", "", () => { D.DESK.groups[D.CUR] = D.DESK.groups[D.CUR].filter(z => z.id !== c.id); D.save(); draw(); }, 0, "group"]] : []), "-", ["Close the group", "", () => c.wins.forEach(D.closeWin), 1, "x"]], { above: true });
    }
    D.cmenu(x, y, [["Command center", D.nice(D.BIND.cc), () => D.ccOpen(), 0, "search"], ["Show the desktop", D.nice(D.BIND.desk), () => D.act("desk"), 0, "desktop"], ["Group windows…", "", () => D.groupMenu(x, y), 0, "group"], ["Keyboard shortcuts", "", D.keysSheet, 0, "keyboard"]], { above: true });
  });
  // drag: reorder pinned apps; drop a window (from a list) onto a task group to add it
  let drag = null;
  document.addEventListener("dragstart", e => { const dk = e.target.closest && e.target.closest("[data-dk]"), pw = e.target.closest && e.target.closest("[data-pw]"); if (dk) drag = { app: dk.dataset.dk }; else if (pw) drag = { win: +pw.dataset.pw }; if (drag) { try { e.dataTransfer.setData("text/plain", "lapp"); } catch {} } });
  document.addEventListener("dragover", e => { if (!drag || !e.target.closest) return; const t = e.target.closest(drag.app ? "[data-dk]" : "[data-cap]"); $$(".drop-t").forEach(x => x.classList.remove("drop-t")); if (t) { e.preventDefault(); t.classList.add("drop-t"); } });
  document.addEventListener("drop", e => {
    if (!drag || !e.target.closest) return; $$(".drop-t").forEach(x => x.classList.remove("drop-t"));
    if (drag.app) { const t = e.target.closest("[data-dk]"); if (t && t.dataset.dk !== drag.app) { e.preventDefault(); const p = pinsOf(D.CUR).filter(x => x !== drag.app); const i = p.indexOf(t.dataset.dk); p.splice(i < 0 ? p.length : i, 0, drag.app); setPins(D.CUR, p); } }
    if (drag.win) { const t = e.target.closest("[data-cap]"); const g = t && ((D.DESK.groups || {})[D.CUR] || []).find(z => z.id === t.dataset.cap); if (g) { e.preventDefault(); const w = D.W(drag.win); if (w && !g.urls.includes(w.url)) g.urls.push(w.url); D.save(); draw(); } }
    drag = null;
  });
  document.addEventListener("dragend", () => { drag = null; $$(".drop-t").forEach(x => x.classList.remove("drop-t")); });
})();
