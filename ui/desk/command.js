// LAPP work desktop · the command center: the brain of the system. Calm, fast, useful.
// One field searches everything; small scope buttons narrow it (All · Apps · Files & lessons · People · AI).
// → opens the actions of a result; Tab (or the AI button) turns the panel into the AI chat. Fixed size: it never grows.
"use strict";
(function () {
  const { $, $$, esc, I } = D;
  const CC = { scope: "all", q: "", sel: 0, mode: "list", item: null, rows: [], people: null, peopleQ: "", view: "home" };
  const CHAT = D.CHAT = [];
  const SCOPES = [["all", "search", "Everything"], ["apps", "grid", "Apps"], ["files", "files", "Files & lessons"], ["people", "users", "People"], ["ai", "ai", "Ask the AI"]];
  const TOK = { apps: "Apps", files: "Files & lessons", people: "People" };

  D.ccOpen = (scope = "all", q = "") => {
    D.closeMenus(); D.closeSheet && $("#sheet") && D.closeSheet();
    let c = $("#cc");
    if (c && ((scope === "ai") === (CC.mode === "chat")) && scope === CC.scope && !q) return D.ccClose();
    CC.mode = scope === "ai" ? "chat" : "list"; CC.scope = scope === "ai" ? CC.scope : scope; CC.q = q; CC.sel = 0; CC.item = null; CC.view = ["applist", "widgets", "walls"].includes(scope) ? scope : "home"; if (CC.view !== "home" || scope === "settings") CC.scope = "all";
    if (!c) {
      c = document.createElement("div"); c.id = "cc"; c.setAttribute("role", "dialog"); c.setAttribute("aria-label", "Command center");
      document.body.append(c); c.classList.toggle("full", PREF().open === "full");
      const p = D.DESK && D.DESK.ccpos; if (p && innerWidth > 760) { c.classList.add("moved"); c.style.left = Math.max(0, Math.min(p.x, innerWidth - 300)) + "px"; c.style.top = Math.max(0, Math.min(p.y, innerHeight - 200)) + "px"; }
    }
    frame(); $("#lb").classList.add("on");
    if (!D.LESSONS) D.lessons().then(() => $("#cc") && draw()).catch(() => {});
  };
  D.ccClose = () => { $("#cc")?.remove(); $("#lb")?.classList.remove("on"); };

  function frame() {
    const c = $("#cc");
    if (CC.mode === "chat") {
      c.innerHTML = `<div class="cch" title="Drag to move"><i></i></div><div class="chathd"><button data-cc="back">${I("back", 15)} Back</button><span class="spark">✦</span><b style="font-size:13px">LAPP AI</b><span style="flex:1"></span>${CHAT.length ? `<button data-cc="new">${I("plus", 15)} New chat</button>` : ""}</div>
        <div class="ccb" id="ccb" aria-live="polite"></div><div class="chatin"><textarea id="cci" rows="1" placeholder="Ask the AI anything…" aria-label="Ask the AI"></textarea><button class="send" data-cc="send" aria-label="Send">${I("send", 15)}</button></div>`;
      const t = $("#cci"); t.value = CC.q; CC.q = "";
      t.oninput = () => { t.style.height = "auto"; t.style.height = Math.min(120, t.scrollHeight) + "px"; };
      t.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (t.value.trim()) D.ask(t.value); } if (e.key === "Escape") { e.preventDefault(); back(); } };
      draw(); t.focus();
      return;
    }
    c.innerHTML = `<div class="cch" title="Drag to move"><i></i></div><label class="ccs"><span style="color:var(--vi)">${I("ai", 17)}</span>${TOK[CC.scope] ? `<span class="tok">${esc(TOK[CC.scope])}<button data-cc="untok" aria-label="Search everything">${I("x", 12)}</button></span>` : ""}${CC.view !== "home" ? `<button class="ib" data-cc="home" aria-label="Back">${I("back", 15)}</button>` : ""}<input id="ccq" placeholder="${CC.view === "applist" ? "Find an app…" : "Ask, search, or tell LAPP what to do…"}" autocomplete="off" aria-label="Ask or search"></label>
      <div class="ccb" id="ccb"></div>
      <div class="ccfoot">${D.ccFoot()}</div>`;
    const i = $("#ccq"); i.value = CC.q;
    i.oninput = () => { CC.q = i.value; CC.sel = 0; CC.moved = false; CC.item = null; CC.mode = "list"; if (CC.q && CC.view !== "applist") CC.view = "home"; draw(); };
    i.onkeydown = key;
    draw(); i.focus();
  }
  function back() { if (CC.mode === "chat") { CC.mode = "list"; frame(); } }

  /* ---------- rows: one shape for everything ---------- */
  // { icon, color, name, place, k, run, acts: [[label, icon, run]] }
  const winRow = w => ({ icon: w.icon, name: w.title, place: D.wsOf(w.ws).name + (w.min ? " · minimised" : ""), k: "switch", run: () => { D.ccClose(); D.focusWin(w); },
    acts: [["Switch to it", "window", () => D.focusWin(w)], ["Left half", "sidebar", () => D.snap(w, "left")], ["Right half", "sidebar", () => D.snap(w, "right")], ["Shortcut on the desktop", "desktop", () => D.addIcon({ n: w.title, i: w.icon, url: w.url, lesson: w.lesson })], ["Close", "x", () => D.closeWin(w)]] });
  const appRow = a => { const pins = (D.DESK.pins || {})[a.ws] || [], pinned = pins.includes(a.id);
    return { icon: a.icon, color: a.color, name: a.title, place: D.wsOf(a.ws).name, run: () => { D.ccClose(); D.openWin(a.url); },
      acts: [["Open", "external", () => D.openWin(a.url)], [pinned ? "Unpin from the taskbar" : "Pin to the taskbar", "pin", () => { const cur = (D.DESK.pins || {})[a.ws] || D.APPS.filter(x => x.ws === a.ws).slice(0, 4).map(x => x.id); D.DESK.pins = { ...(D.DESK.pins || {}), [a.ws]: pinned ? cur.filter(x => x !== a.id) : [...cur, a.id] }; D.save(); D.drawTask(); }], ["Shortcut on the desktop", "desktop", () => D.addIcon({ n: a.title, i: a.icon, url: a.url })]] }; };
  const lessonRow = l => ({ icon: "lessonfile", name: `${D.FLAG(l.course)} ${l.title}`.trim(), place: `${l.level || ""} · ${l.scope.name} · ${({ draft: "draft", review: "in work", published: "published" })[l.status] || ""}`, k: "", run: () => { D.ccClose(); D.openLesson(l, "script"); }, drag: `${l.scope.q}:${l.id}`,
    acts: [["Script", "pen", () => D.openLesson(l, "script")], ["Lesson settings", "settings", () => D.openLesson(l, "lesson")], ["Voice desk", "wave", () => D.openLesson(l, "voice")], ["Insights", "insights", () => D.openLesson(l, "insights")], ["Shortcut on the desktop", "desktop", () => D.addIcon({ n: l.title, i: "pen", url: D.studioUrl(l), lesson: { id: String(l.id), title: l.title } })], ["Ask the AI about it", "ai", () => D.ask(`Tell me about the lesson “${l.title}” and what it still needs`)]] });
  const fileRow = f => ({ icon: D.fileIcon(f.name, f.type), name: f.name, place: "Files · " + Math.max(1, Math.round(f.size / 1024)) + " KB", run: () => { D.ccClose(); D.openWin(`/api/desk/files/${f.id}`, { title: f.name, icon: D.fileIcon(f.name, f.type) }); },
    acts: [["Open", "external", () => D.openWin(`/api/desk/files/${f.id}`, { title: f.name })], ["Download", "download", () => { const a = document.createElement("a"); a.href = `/api/desk/files/${f.id}`; a.download = f.name; a.click(); }], ["Shortcut on the desktop", "desktop", () => D.addIcon({ n: f.name, i: D.fileIcon(f.name, f.type), file: f.id })]] });
  const COMMANDS = () => [["settings", "Settings", "settings"], ["guide", "Guide", "guide"], ["globe", "Language", "lang"], ["keyboard", "Keyboard shortcuts", "keys"], ["pointer", "Mouse pointer", "cursor"], ["image", "Change the wallpaper", "wall"], ["puzzle", "Add a widget", "widget"], ["group", "Group windows", "groupby"], ["desktop", "Show the desktop", "desk"], ["headphones", "The learning site ↗", "site"], ["log-out", "Sign out", "out"]]
    .map(([ic, l, g]) => ({ icon: ic, name: l, place: "Command", run: () => D.go(g) }));
  const askRow = q => ({ icon: "ai", color: "#8B5CF6", name: `Ask the AI: “${q}”`, k: "Tab", run: () => D.ask(q) });
  const has = (s, q) => String(s || "").toLowerCase().includes(q);

  function suggested() {
    const out = [], un = D.NOTES.filter(n => !n.read && n.url).slice(0, 1), run = D.running().slice(0, 1);
    un.forEach(n => out.push({ icon: "bell", name: n.text, place: n.from || "", k: "open", run: () => D.go("nopen:" + n.id) }));
    run.forEach(j => out.push({ icon: "wave", name: `Audio for “${j.title}” is being made`, place: "open the voice desk meanwhile", run: () => D.go(`lesson:${j.scope.q}:${j.lesson}:voice`) }));
    if (out.length < 2 && D.LESSONS) D.LESSONS.filter(l => l.status !== "published" && l.lines && l.approved < l.lines).slice(0, 1).forEach(l => out.push({ ...lessonRow(l), icon: "approve", name: `${l.lines - l.approved} lines wait for approval in “${l.title}”` }));
    return out.slice(0, 2);
  }
  function recentRows() {
    return (D.DESK.recent || []).filter(r => !D.WN().some(w => w.url === r.url)).slice(0, 6).map(r => ({ icon: r.icon, name: r.title, place: D.ago(r.at || Date.now()), run: () => { D.ccClose(); D.openWin(r.url, { title: r.title, icon: r.icon, lesson: r.lesson }); }, acts: [["Open", "external", () => D.openWin(r.url, { title: r.title, icon: r.icon, lesson: r.lesson })], ["Shortcut on the desktop", "desktop", () => D.addIcon({ n: r.title, i: r.icon, url: r.url, lesson: r.lesson })]] }));
  }

  /* ---------- drawing ---------- */
  function draw() {
    const B = $("#ccb"); if (!B) return;
    if (CC.mode === "chat") return drawChat(B);
    const q = CC.q.trim().toLowerCase(), S = CC.scope, G = [];
    const sec = (title, rows, more) => rows.length && G.push({ title, rows, more });
    if (CC.item) {
      CC.rows = CC.item.acts.map(([l, ic, run]) => ({ icon: ic, name: l, place: "", run: () => { D.ccClose(); run(); } }));
      B.innerHTML = `<div class="actp"><div class="head"><button data-cc="unact" aria-label="Back">${I("back", 15)}</button>${I(CC.item.icon, 16) || D.IE(CC.item.icon)}<span>${esc(CC.item.name)}</span></div>${CC.rows.map((r, k) => rowHtml(r, k)).join("")}</div>`;
      return mark();
    }
    if (CC.view !== "home") return D.ccExtra(B, CC.view, CC.q);
    if (S === "all" && !q) return D.ccBoard(B);
    if (false) {
      sec("Suggested now", suggested());
      sec("Recent", recentRows());
      const pins = ((D.DESK.pins || {})[D.CUR] || D.APPS.filter(a => a.ws === D.CUR).slice(0, 4).map(a => a.id)).map(id => D.APPS.find(a => a.id === id)).filter(Boolean);
      G.push({ title: D.WS.length > 1 ? "Apps · " + D.wsOf(D.CUR).name : "Apps", pins: pins.length ? pins : D.APPS.filter(a => a.ws === D.CUR).slice(0, 6), more: "apps" });
      if (D.WS.length > 1) sec("Other workspaces", D.WS.filter(w => w.key !== D.CUR).map(w => ({ icon: w.key === "me" ? "home" : "school", color: w.color, name: w.name, place: D.APPS.filter(a => a.ws === w.key).map(a => a.title).slice(0, 4).join(" · "), run: () => { D.ccClose(); D.switchWs(w.key); D.toast(w.name, { kind: "info" }); } })));
    } else if (S === "apps") {
      D.WS.forEach(w => sec(D.WS.length > 1 ? w.name : "Apps", D.APPS.filter(a => a.ws === w.key && (!q || has(a.title, q))).map(appRow)));
    } else if (S === "files") {
      const ls = (D.LESSONS || []).filter(l => !q || has(l.title, q)).sort((a, b) => b.updated_at - a.updated_at).slice(0, q ? 20 : 8).map(lessonRow);
      const fs = (D.FILES || []).filter(f => !q || has(f.name, q)).slice(0, q ? 12 : 4).map(fileRow);
      sec("Lessons", ls); sec("Files", fs);
      if (!D.LESSONS) G.push({ title: "", html: `<div class="empty tight">Loading…</div>` });
      G.push({ title: "", rows: [{ icon: "files", name: "Open Files", place: "all your files and folders", run: () => { D.ccClose(); D.openWin(D.APPS.find(a => a.id.startsWith("files") && a.ws === D.CUR)?.url || "/files"); } }] });
    } else if (S === "people") {
      if (q.length < 2) G.push({ title: "", html: `<div class="empty tight">Type a name or an email</div>` });
      else { if (CC.peopleQ !== q) findPeople(q); sec("People", (CC.people || []).map(p => ({ icon: "user", name: p.name || "@" + p.username, place: [p.email, p.where].filter(Boolean).join(" · "), run: () => { D.ccClose(); D.openWin(p.url); } }))); if (!CC.people) G.push({ title: "", html: `<div class="empty tight">Searching…</div>` }); else if (!CC.people.length) G.push({ title: "", html: `<div class="empty tight">Nobody found</div>` }); }
    } else {
      sec("", [askRow(CC.q.trim())]);
      sec("Open windows", D.WN().filter(w => has(w.title, q)).slice(0, 5).map(winRow));
      sec("Apps", D.APPS.filter(a => has(a.title, q) || has(D.wsOf(a.ws).name, q)).slice(0, 6).map(appRow));
      sec("Lessons", (D.LESSONS || []).filter(l => has(l.title, q)).slice(0, 5).map(lessonRow));
      sec("Files", (D.FILES || []).filter(f => has(f.name, q)).slice(0, 4).map(fileRow));
      sec("Commands", COMMANDS().filter(c => has(c.name, q) && !D.APPS.some(a => a.title === c.name)).slice(0, 4));
    }
    CC.rows = []; let html = "";
    G.forEach(g => {
      if (g.html) { html += g.html; return; }
      html += `<div class="ccg">${g.title ? `<h5>${esc(g.title)}${g.more ? `<button data-scope="${g.more}">all</button>` : ""}</h5>` : ""}`;
      if (g.pins) html += `<div class="pins">${g.pins.map(a => { const r = appRow(a), k = CC.rows.push(r) - 1; return `<button class="pin" data-r="${k}" title="${esc(a.title)}"><span class="g" style="background:${a.color}">${I(a.icon, 19)}</span><span>${esc(a.title)}</span></button>`; }).join("")}</div>`;
      else html += g.rows.map(r => rowHtml(r, CC.rows.push(r) - 1)).join("");
      html += `</div>`;
    });
    B.innerHTML = html || `<div class="empty tight">Nothing found. Press Tab to ask the AI.</div>`;
    // typing: ↵ opens the best match; the AI is one Tab away (its row stays on top)
    if (S === "all" && q && !CC.moved) CC.sel = CC.rows.length > 1 ? 1 : 0;
    mark();
  }
  function rowHtml(r, k) {
    return `<div class="rw" data-r="${k}" role="option" ${r.drag ? `draggable="true" data-lesson="${esc(r.drag)}"` : ""}><span class="ri ${r.color ? "c" : ""}" style="${r.color ? `background:${r.color}` : ""}">${I(r.icon, 15) || D.IE(r.icon)}</span><span class="nm">${esc(r.name)}</span>${r.place ? `<span class="rplace">${esc(r.place)}</span>` : `<span class="rplace"></span>`}${r.k ? `<span class="k">${esc(r.k)}</span>` : ""}${r.acts ? `<button class="go" data-go2="${k}" aria-label="Actions" title="Actions (→)">${I("chevron", 15)}</button>` : ""}</div>`;
  }
  function mark() { $$("#ccb [data-r]").forEach(r => r.classList.toggle("sel", +r.dataset.r === CC.sel)); $(`#ccb [data-r="${CC.sel}"]`)?.scrollIntoView({ block: "nearest" }); }
  function key(e) {
    const n = CC.rows.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (n) { CC.moved = true; CC.sel = (CC.sel + (e.key === "ArrowDown" ? 1 : -1) + n) % n; mark(); } }
    else if (e.key === "ArrowRight" && (!e.target.value || e.target.selectionStart === e.target.value.length) && CC.rows[CC.sel] && CC.rows[CC.sel].acts && !CC.item) { e.preventDefault(); CC.item = CC.rows[CC.sel]; CC.sel = 0; draw(); }
    else if (e.key === "ArrowLeft" && CC.item && !e.target.value) { e.preventDefault(); CC.item = null; CC.sel = 0; draw(); }
    else if (e.key === "Tab" && CC.q.trim()) { e.preventDefault(); D.ask(CC.q); }
    else if (e.key === "Enter") { e.preventDefault(); const r = CC.rows[CC.sel]; if (r) r.run(); }
    else if (e.key === "Escape") { e.preventDefault(); if (CC.item) { CC.item = null; draw(); } else D.ccClose(); }
    else if (e.key === "Backspace" && !e.target.value && CC.scope !== "all") { CC.scope = "all"; frame(); }
  }
  let pT;
  function findPeople(q) {
    CC.peopleQ = q; CC.people = null; clearTimeout(pT);
    pT = setTimeout(async () => {
      const out = [];
      if (["manager", "admin"].includes(D.ME.role)) { const r = await D.api("GET", "/admin/users?q=" + encodeURIComponent(q)).catch(() => ({ users: [] })); (r.users || []).slice(0, 8).forEach(u => out.push({ ...u, where: "LAPP", url: "/admin#users" })); }
      for (const o of D.ORGS.filter(o => ["admin", "teacher", "finance"].includes(o.role))) {
        D._mem = D._mem || {}; if (!D._mem[o.slug]) D._mem[o.slug] = D.api("GET", `/org/${o.slug}/members`).then(r => r.members).catch(() => []);
        (await D._mem[o.slug]).filter(m => [m.name, m.username, m.email].some(x => String(x || "").toLowerCase().includes(q))).slice(0, 8).forEach(m => out.push({ ...m, where: o.name + " · " + m.role, url: `/s/${o.slug}#people` }));
      }
      if (CC.peopleQ === q) { CC.people = out; draw(); }
    }, 250);
  }

  /* ---------- the home: what the AI arranged for this moment (a main task, three numbers, a short list) ---------- */
  // The panel sends the AI a summary of the signals (time, window in front, waiting work…) and gets back a choice from a
  // fixed catalogue, so the panel can't break. Without an AI (or with "arranged by the AI" off) simple rules choose.
  const PREF = () => ({ ai: true, learn: true, tiles: "calm", open: "center", ...((D.DESK && D.DESK.cc) || {}) });
  const setPref = (k, v) => { D.DESK.cc = { ...(D.DESK.cc || {}), [k]: v }; K.LS.set("lapp.cc", D.DESK.cc); D.save(); };
  function signals() {
    const ls = D.LESSONS || [], w = D.W(D.ACTW), h = new Date().getHours();
    const wait = ls.filter(l => l.status !== "published" && l.lines && l.approved < l.lines), run = D.running(), un = D.NOTES.filter(n => !n.read);
    const front = w && /\/studio/.test(w.url) && w.lesson ? ls.find(l => String(l.id) === String(w.lesson.id)) : null;
    return { h, wait, run, un, front, w, recent: (D.DESK.recent || []).filter(r => !D.WN().some(x => x.url === r.url)), inwork: ls.filter(l => l.status !== "published"), pub: ls.filter(l => l.status === "published") };
  }
  // the catalogue: tiles (a number), main tasks and lists — each knows when it makes sense
  const TILES = {
    approve: s => ({ icon: "approve", tone: "#34D399", label: "To approve", value: s.wait.reduce((a, l) => a + (l.lines - l.approved), 0), sub: `lines in ${s.wait.length} lesson${s.wait.length === 1 ? "" : "s"}`, go: "open:" + (D.APPS.find(a => /content|library/i.test(a.id) && a.ws === D.CUR) || D.APPS[0] || {}).url }),
    inwork: s => ({ icon: "pen", tone: "#8B5CF6", label: "In work", value: s.inwork.length, sub: "lessons", go: "open:/studio#home" }),
    published: s => ({ icon: "lessonfile", tone: "#22D3EE", label: "Published", value: s.pub.length, sub: "lessons", go: "open:/studio#home" }),
    running: s => ({ icon: "wave", tone: "#FF3D7F", label: "Running", value: s.run.length, sub: s.run[0] ? "audio · " + s.run[0].title : "nothing now", go: "running" }),
    unread: s => ({ icon: "bell", tone: "#FBBF24", label: "Unread", value: s.un.length, sub: "notifications", go: "bell" }),
    windows: s => ({ icon: "window", tone: "#60A5FA", label: "Windows", value: D.WN().filter(x => x.ws === D.CUR).length, sub: D.wsOf(D.CUR).name, go: "tasks" }),
  };
  const HEROES = {
    front: s => s.front && { title: s.front.title, text: `${s.front.lines || 0} lines · ${Math.max(0, (s.front.lines || 0) - (s.front.approved || 0))} not approved`, acts: [["Open the voice desk", `lesson:${s.front.scope.q}:${s.front.id}:voice`, 1], ["Lesson settings", `lesson:${s.front.scope.q}:${s.front.id}:lesson`]] },
    approve: s => s.wait.length && { title: `${s.wait.length} lesson${s.wait.length === 1 ? "" : "s"} wait for approval`, text: s.wait.slice(0, 3).map(l => l.title).join(" · "), acts: [["Review the first", `lesson:${s.wait[0].scope.q}:${s.wait[0].id}:script`, 1]] },
    running: s => s.run.length && { title: `Audio for “${s.run[0].title}” is being made`, text: "You can keep working; it tells you when it's ready.", acts: [["Open the voice desk", `lesson:${s.run[0].scope.q}:${s.run[0].lesson}:voice`, 1]] },
    notes: s => s.un.length && { title: `${s.un.length} new notification${s.un.length === 1 ? "" : "s"}`, text: s.un.slice(0, 2).map(n => n.text).join(" · "), acts: [["Read", "bell", 1]] },
    continue: s => s.recent[0] && { title: `Continue: ${s.recent[0].title}`, text: D.ago(s.recent[0].at || Date.now()), acts: [["Open", "open:" + s.recent[0].url, 1]] },
    start: () => ({ title: "A new lesson", text: "Start from a topic; the AI drafts it and you approve every line.", acts: [["New lesson", "open:/studio#home", 1]] }),
  };
  function rules(s) {
    const hero = s.front ? "front" : s.run.length ? "running" : s.wait.length ? "approve" : s.un.length ? "notes" : s.recent.length ? "continue" : "start";
    const tiles = (s.front ? ["approve", "running", "inwork"] : s.h >= 17 ? ["published", "inwork", "unread"] : ["approve", "inwork", "unread"]);
    return { hero, tiles, list: s.wait.length || s.run.length || s.un.length ? "needs" : "recent", why: "simple rules" };
  }
  let PLAN = null;
  async function arrange(s) {
    const P = PREF(), base = rules(s);
    if (!P.ai) return base;
    const sig = { hour: s.h, front: s.w ? s.w.title : "", frontLesson: s.front ? s.front.title : "", toApprove: s.wait.length, running: s.run.length, unread: s.un.length, recent: s.recent.slice(0, 3).map(r => r.title), role: D.ME.role, workspace: D.wsOf(D.CUR).name };
    const key = JSON.stringify(sig), less = Object.keys((D.DESK.cc || {}).less || {});
    if (PLAN && PLAN.key === key) return PLAN.plan;
    try {
      const r = await D.api("POST", "/assist/arrange", { signals: sig, heroes: Object.keys(HEROES), tiles: Object.keys(TILES), lists: ["needs", "recent"], less: P.learn ? less : [] });
      const plan = { hero: HEROES[r.hero] ? r.hero : base.hero, tiles: (r.tiles || []).filter(t => TILES[t]).slice(0, 3), list: ["needs", "recent"].includes(r.list) ? r.list : base.list, why: r.why || "", ai: 1 };
      if (plan.tiles.length < 3) plan.tiles = [...new Set([...plan.tiles, ...base.tiles])].slice(0, 3);
      PLAN = { key, plan }; return plan;
    } catch { return base; }
  }
  // the board (ui/desk/ccboard.js) uses these
  D.ccSignals = signals; D.ccTiles = TILES; D.ccHeroes = HEROES; D.ccRules = rules; D.ccArrange = arrange;
  D.ccRedraw = () => { if ($("#cc") && CC.mode === "list") frame(); };

  /* ---------- the AI chat (inside the panel; the box stays at the bottom) ---------- */
  function drawChat(B) {
    const w = D.W(D.ACTW), tries = /\/studio/.test(w ? w.url : "") ? ["Make line 4 simpler for A1", "Write a short homework for this lesson", "Show the voice desk next to the script"] : ["What can I do here?", "Open Users and Files side by side", "Plan 6 A1 lessons for a trip to Vienna"];
    B.innerHTML = (CHAT.length ? "" : `<div class="aiq"><div class="who2">${I("ai", 13)} LAPP AI</div>Ask anything, or tell me what to open or arrange. I see your open windows and show a plan before I do anything.</div><div class="ccg"><h5>Try</h5>${tries.map((s, k) => `<button class="rw" data-try="${esc(s)}"><span class="ri">${I("ai", 14)}</span><span class="nm">${esc(s)}</span></button>`).join("")}</div>`)
      + CHAT.map((m, k) => m.me ? `<div class="me2">${esc(m.t)}</div>` : m.wait ? `<div class="aiq" aria-label="Thinking"><span class="dots"><i></i><i></i><i></i></span></div>`
        : `<div class="aiq ${m.err ? "err" : ""}"><div class="who2">${I("ai", 13)} LAPP AI${m.provider && !/^lapp ai$/i.test(m.provider) ? " · " + esc(m.provider) : ""}</div>${esc(m.t)}${m.plan && m.plan.length ? `<div class="plan">${m.plan.map(p => `<div>${I(p.icon, 14)} ${esc(p.label)}</div>`).join("")}</div><div class="btns">${m.done ? `<span class="mu sm">${I("check", 13)} Done</span>` : `<button class="b pr" data-plan="${k}">Do it</button>`}</div>` : ""}</div>`).join("");
    B.scrollTop = B.scrollHeight;
  }
  D.ask = async (q, about) => {
    q = (q || "").trim(); if (!q) return;
    if (!$("#cc") || CC.mode !== "chat") { $("#cc") ? (CC.mode = "chat", frame()) : D.ccOpen("ai"); }
    const t = $("#cci"); if (t) { t.value = ""; t.style.height = "auto"; }
    CHAT.push({ me: 1, t: q }); const a = { wait: 1 }; CHAT.push(a); draw();
    const places = D.APPS.map((x, k) => ({ id: "p" + k, label: `${x.title} · ${D.wsOf(x.ws).name}`, url: x.url }));
    (D.LESSONS || []).slice(0, 25).forEach((l, k) => places.push({ id: "l" + k, label: `Studio script · ${l.title} (${l.scope.name})`, lesson: l }));
    const wins = D.WN().map(w => ({ id: "w" + w.id, label: `${w.title} · ${D.wsOf(w.ws).name}` }));
    const w = about || D.W(D.ACTW);
    if (w) D.setState(w, "ai");
    try {
      const r = await D.api("POST", "/assist", { q, context: { title: w ? w.title : "the desktop", group: w ? D.wsOf(w.ws).name : "", place: w ? new URL(w.url, location.origin).pathname : "/manage" }, places: places.map(({ id, label }) => ({ id, label })), windows: wins, history: CHAT.filter(m => !m.wait && !m.err && m.t).slice(-7, -1).map(m => ({ me: !!m.me, text: m.t })) });
      const VERB = { open: ["external", "Open"], left: ["sidebar", "Left half"], right: ["sidebar", "Right half"], max: ["maximize", "Full size"], close: ["x", "Close"] };
      const plan = (r.actions || []).map(x => {
        const pl = places.find(p => p.id === x.id), win = /^w\d+$/.test(x.id) ? D.W(x.id.slice(1)) : null, label = pl ? pl.label : win ? win.title : "";
        if (!label || !VERB[x.do]) return null;
        return { icon: VERB[x.do][0], label: `${VERB[x.do][1]}: ${label}`, run: () => { let t = win; if (pl) t = pl.lesson ? D.openLesson(pl.lesson) : D.openWin(pl.url); if (!t) return; if (x.do === "close") D.closeWin(t); else if (x.do !== "open") D.snap(t, x.do); } };
      }).filter(Boolean);
      Object.assign(a, { wait: 0, t: r.answer, plan, provider: r.provider });
    } catch (e) { Object.assign(a, { wait: 0, err: 1, t: e.message }); }
    if (w && w.state === "ai") D.setState(w, "");
    draw();
  };

  /* ---------- clicks ---------- */
  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest || !t.closest("#cc")) return;
    const sc = t.closest("[data-scope]"); if (sc) { const s = sc.dataset.scope; if (s === "ai") { CC.mode = "chat"; CC.q = $("#ccq") ? $("#ccq").value : ""; return frame(); } CC.scope = CC.scope === s && s !== "all" ? "all" : s; CC.item = null; CC.sel = 0; return frame(); }
    const c = t.closest("[data-cc]"); if (c) { const k = c.dataset.cc; if (k === "home") { CC.view = "home"; CC.q = ""; return frame(); } if (k === "untok") { CC.scope = "all"; return frame(); } if (k === "back") return back(); if (k === "new") { CHAT.length = 0; return frame(); } if (k === "send") { const v = $("#cci").value; if (v.trim()) D.ask(v); return; } if (k === "unact") { CC.item = null; CC.sel = 0; draw(); return $("#ccq")?.focus(); } }
    const g2 = t.closest("[data-go2]"); if (g2) { CC.item = CC.rows[+g2.dataset.go2]; CC.sel = 0; draw(); return $("#ccq")?.focus(); }
    const r = t.closest("[data-r]"); if (r) { const row = CC.rows[+r.dataset.r]; if (row) row.run(); return; }
    const tr = t.closest("[data-try]"); if (tr) return D.ask(tr.dataset.try);
    const pl = t.closest("[data-plan]"); if (pl) { const m = CHAT[+pl.dataset.plan]; m.done = 1; m.plan.forEach(p => p.run()); return draw(); }
  });
  // the panel moves by its handle and remembers where it was
  document.addEventListener("pointerdown", e => {
    const h = e.target.closest && e.target.closest(".cch"); if (!h) return;
    const c = $("#cc"), r = c.getBoundingClientRect(); e.preventDefault();
    K.drag(e, { move: (dx, dy) => { c.classList.add("moved"); c.style.left = Math.max(0, Math.min(r.left + dx, innerWidth - 120)) + "px"; c.style.top = Math.max(0, Math.min(r.top + dy, innerHeight - 80)) + "px"; },
      end: () => { const b = c.getBoundingClientRect(); D.DESK.ccpos = { x: Math.round(b.left), y: Math.round(b.top) }; D.save(); } });
  });
  D.on("notes", () => $("#cc") && CC.mode === "list" && !CC.q && draw());
  D.on("jobs", () => $("#cc") && CC.mode === "list" && !CC.q && draw());
})();
