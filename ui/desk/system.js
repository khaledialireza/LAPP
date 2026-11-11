// LAPP work desktop · system: the look (theme, accent, wallpaper) for every window, what the Settings app asks for,
// the Guide and "About" in every window's Help menu.
"use strict";
(function () {
  const { $, esc, I } = D;
  const LOOK_KEYS = ["theme", "accent", "radius", "wall", "groupBy", "restore", "toasts", "jobnotes", "trMode", "trLang", "lockAfter"];
  D.look = () => { const l = (D.DESK && D.DESK.look) || {}; return { ...l, wall: D.DESK ? D.DESK.wall || "" : "", groupBy: D.DESK ? D.DESK.groupBy || "auto" : "auto" }; };
  D.applyLook = () => {
    const l = D.look();
    D.LS.set("lapp.theme", Object.fromEntries(LOOK_KEYS.filter(k => l[k] !== undefined).map(k => [k, l[k]])));
    if (window.LAPPTheme) LAPPTheme.apply(l);
    document.body.dataset.wall = l.wall || "";
    if (window.LAPPCursor) LAPPCursor.refresh();
    const me = D.WS.find(w => w.key === "me"); if (me) { me.color = l.accent || "#8B5CF6"; D.APPS.forEach(a => { if (a.ws === "me") a.color = me.color; }); D.WN().forEach(D.dress); D.drawTask && D.drawTask(); }
    D.WN().forEach(w => D.post(w, { t: "theme" }));
  };
  D.setLook = (k, v) => {
    if (k === "wall") D.DESK.wall = v; else if (k === "groupBy") { D.DESK.groupBy = v; D.drawTask(); } else D.DESK.look = { ...(D.DESK.look || {}), [k]: v };
    D.applyLook(); D.save();
  };
  // what the Settings app asks for
  D.settings = (key, value) => {
    if (LOOK_KEYS.includes(key)) return D.setLook(key, value);
    if (key === "avatar") return D.api("GET", "/me").then(m => { D.ME = m.user; D.drawMe(); });
    if (key === "lock") return D.lock();
    if (key === "cursor") { D.LS.set("lapp.cursor", value ? "" : "system"); return D.applyLook(); }
    if (key === "widget") return D.gallery();
    if (key === "keys") return D.keysSheet();
  };
  D.on("ready", D.applyLook);

  /* ---------- the Guide: what each app is for ---------- */
  const HELP = {
    "admin:dash": "LAPP at a glance: users, Plus, sign-ups and schools.",
    "admin:users": "Every account: find people, give Plus, change roles, add schools. The buttons in the title bar add a user or a school.",
    "admin:ai": "Which AI does which job, keys and usage.",
    "admin:content": "The lesson library: folders with rules (level, access, approval), the curriculum map, the board and AI ideas. New lessons start here.",
    "studio:home": "The studio's start: lessons in work, what needs you, plans with the AI.",
    "studio:script": "Write and edit the lines. Right-click a line or a word for every action: AI rewrites, translation, speaker, voice, structure.",
    "studio:voice": "Voices for each speaker and the audio of the lesson. Audio keeps being made while you do other things.",
    "studio:insights": "How learners do: which lines they say right, where they stop.",
    "studio:universe": "Characters that come back in many lessons, each with their own voice.",
    "studio:lesson": "Everything about a lesson besides its text: goals, length, translations, practice, access, publishing, history.",
    files: "All your files and the lesson libraries in one explorer. Drag files in, make folders, double-click a lesson to open it in the studio.",
    settings: "You, the look of the whole system, the desktop, keys and notifications.",
    overview: "Your school at a glance.", classes: "Classes, their students and lessons.", people: "Students and staff of the school.", timetable: "The school's week: classes, rooms and teachers.",
    homework: "Homework of your classes.", finance: "Fees, payments and reminders.", week: "Your own week of classes."
  };
  const helpOf = url => { const k = D.appKey(url).replace(/@.*/, ""); return HELP[k] || HELP[k.replace(/^s:[^:]+:/, "")] || ""; };
  D.info = (w, anchor) => {
    D.closeMenus(); K.pop(anchor, `<h6>${I("info", 13)} ${esc(w.title)}</h6><div style="padding:2px 8px 8px;line-height:1.55">${esc(helpOf(w.url) || "This window belongs to " + D.wsOf(w.ws).name + ".")}</div>
      <button class="pi" data-go="guide"><span class="ri">${I("guide", 15)}</span><span class="tx"><b>Open the Guide</b><small>every app, the desktop and the keys</small></span></button>
      <button class="pi" data-infoask="${w.id}"><span class="ri">${I("ai", 15)}</span><span class="tx"><b>Ask the AI about it</b></span></button>`, { above: false });
  };
  D.guide = () => {
    D.sheet(`<h4>${I("guide")} Guide<button data-sx aria-label="Close">${I("x")}</button></h4>
      <div class="ccg"><h5>The desktop</h5><div class="mu" style="line-height:1.7;padding:0 4px 8px">Every page opens in its own window: drag the title bar to move it, its edges to resize, to the screen's edge to snap; rest the pointer on ${I("square", 12)} for layouts. The title bar holds the app's menus and buttons. The border shows what's happening: working, AI, not saved, a problem, done.<br>
      <b>Command center</b> (${esc(D.nice(D.BIND.cc))}): search everything, open apps and lessons; Tab asks the AI. <b>Taskbar</b>: pinned apps and open windows, workspaces for each organisation, grouping. Right-click anywhere for our menus.</div></div>
      <div class="ccg"><h5>Apps</h5>${D.APPS.filter((a, i, all) => all.findIndex(x => x.title === a.title) === i).map(a => `<div class="pi" style="pointer-events:none"><span class="ri" style="background:${a.color}33;color:${a.color}">${I(a.icon, 15)}</span><span class="tx"><b>${esc(a.title)}</b><small style="white-space:normal">${esc(helpOf(a.url))}</small></span></div>`).join("")}</div>
      <div class="ccg"><h5>Keys</h5>${Object.entries(D.ACTIONS).map(([k, l]) => `<div class="pi" style="pointer-events:none"><span class="tx"><b style="font-weight:500">${esc(l)}</b></span><span class="kbd">${esc(D.nice(D.BIND[k]))}</span></div>`).join("")}<div style="margin-top:8px"><button class="b" data-go="keys">${I("keyboard", 14)} Change the keys</button></div></div>`);
  };
  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest) return;
    const ia = t.closest("[data-infoask]"); if (ia) { const w = D.W(ia.dataset.infoask); D.closeMenus(); return D.ask(`Explain the window “${w.title}” and what I can do there`, w); }
    const wc = t.closest('[data-wc="info"]'); if (wc) { e.stopPropagation(); const w = D.W(wc.closest(".wnd").dataset.w); return D.info(w, wc); }
  }, true);
})();
