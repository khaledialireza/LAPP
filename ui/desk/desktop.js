// LAPP work desktop · the desktop itself: widgets, shortcuts and files (dragged in from the computer), wallpaper.
"use strict";
(function () {
  const { $, $$, esc, I } = D;
  D.fileIcon = K.fileIcon;

  async function events(days) {
    const sc = D.ORGS.filter(o => ["admin", "teacher"].includes(o.role)); if (!sc.length) return null;
    const now = Date.now(), end = days ? now + days * 864e5 : new Date().setHours(23, 59, 59, 999);
    return (await Promise.all(sc.map(o => D.api("GET", `/org/${o.slug}/events?from=${now - 36e5}&to=${end}`).then(r => r.events.filter(e => e.status !== "cancelled" && (o.role === "admin" || e.teacher_id === D.ME.id)).map(e => ({ ...e, school: o.name }))).catch(() => [])))).flat().sort((a, b) => a.starts_at - b.starts_at);
  }
  const apps = n => { const seen = new Set(); return [...(D.DESK.recent || []).map(r => D.APPS.find(a => a.url === r.url)).filter(Boolean), ...D.APPS].filter(a => !seen.has(a.id) && seen.add(a.id)).slice(0, n); };
  const WT = D.WT = {
    today: ["calendar", "Today", "your next classes", async () => { const ev = await events(0); if (!ev) return `<div class="mu">No classes here: you don't teach or run a school.</div>`; return ev.length ? `<div class="big">${D.hm(ev[0].starts_at)}</div><div class="mu">${esc(ev[0].class_name)}${ev[0].place ? " · " + esc(ev[0].place) : ""}</div>` + ev.slice(1, 4).map(e => `<div class="row"><span>${D.hm(e.starts_at)} ${esc(e.class_name)}</span><span class="mu">${esc(e.school)}</span></div>`).join("") : `<div class="mu">No more classes today.</div>`; }],
    week: ["calendar-days", "This week", "classes in the next 7 days", async () => { const ev = await events(7); if (!ev) return `<div class="mu">No classes here.</div>`; return ev.slice(0, 6).map(e => `<div class="row"><span>${new Date(e.starts_at).toLocaleDateString(D.loc(), { weekday: "short" })} ${D.hm(e.starts_at)} ${esc(e.class_name)}</span><span class="mu">${esc(e.school)}</span></div>`).join("") || `<div class="mu">A free week.</div>`; }],
    needs: ["tasks", "Needs you", "what waits, with one click", async () => { const ls = await D.lessons().catch(() => []); const appr = ls.filter(l => l.status !== "published" && l.lines && l.approved < l.lines), un = D.NOTES.filter(n => !n.read); return `<div class="row"><span>${appr.length} lessons with lines to approve</span>${appr[0] ? `<button class="b" data-go="lesson:${esc(appr[0].scope.q)}:${appr[0].id}:script">Open</button>` : ""}</div><div class="row"><span>${un.length} unread</span><button class="b" data-go="bell">Read</button></div><div class="row"><span>${D.running().length} running</span><button class="b" data-go="running">See</button></div>`; }],
    note: ["note", "Quick note", "a sticky note you type into", async w => `<textarea data-note="${w.id}" aria-label="Note" placeholder="Write something…">${esc(w.text || "")}</textarea>`],
    kpi: ["chart", "LAPP numbers", "users, Plus, activity", async () => { if (!["manager", "admin"].includes(D.ME.role)) return `<div class="mu">For LAPP managers.</div>`; const s = await D.api("GET", "/admin/stats"); return `<div class="row"><span>Users</span><b>${s.users}</b></div><div class="row"><span>Plus · trial</span><b style="color:var(--gr)">${s.plus} · ${s.trial}</b></div><div class="row"><span>New this week</span><b>${s.newWeek}</b></div><div class="row"><span>Schools</span><b>${s.schools}</b></div>`; }],
    jobs: ["hourglass", "Background work", "audio being made", async () => D.JOBS.slice(0, 4).map(j => `<div class="row"><span>${esc(j.title)}</span><span class="mu">${esc(D.JOBTXT[j.status] || j.status)}</span></div>`).join("") || `<div class="mu">Nothing running</div>`],
    clock: ["clock", "Clock", "your time and date", async () => `<div class="big" data-clock></div><div class="mu" data-date></div>`],
    ask: ["ai", "Ask AI", "a box that asks the AI", async () => `<button class="b" data-go="ai" style="width:100%;justify-content:flex-start;height:36px">${I("ai", 15)}<span class="mu">Ask anything…</span></button>`],
    launch: ["rocket", "Quick launch", "the pages you use most", async () => `<div class="pins">${apps(4).map(a => `<button class="pin" data-go="open:${esc(a.url)}"><span class="g" style="background:${a.color}">${I(a.icon, 18)}</span><span>${esc(a.title)}</span></button>`).join("") || `<span class="mu">Nothing to launch yet</span>`}</div>`]
  };
  D.deskDefault = () => ({ wall: "", icons: [], widgets: [{ id: 1, t: "today", x: -300, y: 16, w: 280 }, { id: 2, t: "needs", x: -300, y: 200, w: 280 }, { id: 3, t: "note", x: -300, y: 370, w: 280, text: "" }], windows: [], recent: [], keys: {}, pins: {}, groups: {}, groupBy: "auto" });

  let drawing = 0;
  D.drawDesk = async () => {
    if (!D.DESK) return;
    const me = ++drawing;
    document.body.dataset.wall = D.DESK.wall || "";
    const DK = $("#desk"), A = DK.getBoundingClientRect();
    DK.innerHTML = D.DESK.icons.map(c => `<div class="ico ${c.up ? "up" : ""}" data-ico="${esc(c.id)}" tabindex="0" style="left:${c.x}px;top:${c.y}px" title="${esc(c.n)} · double-click to open"><span class="g">${c.thumb ? `<img src="${esc(c.thumb)}" alt="">` : I(c.i, 22) || D.IE(c.i, 22)}${c.url ? `<em>${I("external", 11)}</em>` : ""}</span><span>${esc(c.n)}</span></div>`).join("")
      + D.DESK.widgets.filter(w => WT[w.t]).map(w => { const [i, t] = WT[w.t], x = w.x < 0 ? Math.max(0, A.width + w.x) : Math.max(0, Math.min(w.x, A.width - 120)); return `<div class="wdg" data-wdg="${w.id}" style="left:${x}px;top:${Math.max(0, Math.min(w.y, A.height - 60))}px;width:${w.w}px"><div class="wh"><span class="grip">⋮⋮</span>${I(i, 13)} ${esc(t)}<button data-wsz="${w.id}" title="Wider / narrower">${I("columns", 13)}</button><button data-wrm="${w.id}" title="Remove">${I("x", 13)}</button></div><div class="wb">…</div></div>`; }).join("");
    await Promise.all(D.DESK.widgets.filter(w => WT[w.t]).map(async w => { let h; try { h = await WT[w.t][3](w); } catch (e) { h = `<div class="mu">${esc(e.message)}</div>`; } const el = me === drawing && $(`.wdg[data-wdg="${w.id}"] .wb`); if (el) el.innerHTML = h; }));
    D.tick();
  };
  D.addIcon = c => {
    const used = new Set(D.DESK.icons.map(i => `${i.x},${i.y}`)), H = Math.max(110, $("#desk").clientHeight - 110); let x = 16, y = 16;
    while (used.has(`${x},${y}`)) { y += 100; if (y > H) { y = 16; x += 96; } }
    const ic = { id: "i" + Date.now() + Math.round(Math.random() * 1e4), x, y, ...c }; D.DESK.icons.push(ic); D.save(); D.drawDesk(); return ic;
  };
  D.addWidget = t => { const A = $("#desk").getBoundingClientRect(); D.DESK.widgets.push({ id: Date.now(), t, x: Math.max(0, Math.round(A.width / 2 - 140)), y: 40, w: 280 }); D.save(); D.drawDesk(); D.closeSheet(); D.toast("Widget added · drag it by ⋮⋮"); };
  D.gallery = () => { const s = D.sheet(`<h4>${I("puzzle")} Add a widget<button data-sx aria-label="Close">${I("x")}</button></h4><div class="galg">${Object.entries(WT).map(([k, [i, t, d]]) => `<button data-add="${k}"><b>${I(i, 15)} ${esc(t)}</b><span class="mu">${esc(d)}</span></button>`).join("")}</div><p class="mu sm" style="margin-top:10px">Drag widgets by ⋮⋮. Your desktop is saved with your account.</p>`); $("[data-add]", s).focus(); };
  D.ACT.widget = D.gallery;
  // files from the computer become icons on the desktop (the shared K.upload)
  D.upload = files => K.upload(files, { max: 12,
    before: f => D.addIcon({ n: f.name, i: D.fileIcon(f.name, f.type), up: 1 }),
    each: (r, f, ic) => { Object.assign(ic, { file: r.id, type: r.type, up: 0, thumb: /^image\//.test(r.type) ? `/api/desk/files/${r.id}` : "" }); D.FILES.push(r); D.toast(`${f.name} is on your desktop`); D.save(); D.drawDesk(); },
    failed: (f, x, ic) => { D.DESK.icons = D.DESK.icons.filter(z => z !== ic); D.save(); D.drawDesk(); } });
  D.openIcon = c => {
    if (c.url) return D.openWin(c.url, { title: c.n, icon: c.i, lesson: c.lesson });
    if (c.file) return D.openWin(`/api/desk/files/${c.file}`, { title: c.n, icon: c.i });
  };
  D.tick = () => { const d = new Date(); $$("[data-clock]").forEach(x => x.textContent = D.hm(d)); $$("[data-date]").forEach(x => x.textContent = d.toLocaleDateString(D.loc(), { weekday: "long", day: "numeric", month: "long" })); $("#clk").innerHTML = `${D.hm(d)}<br>${d.toLocaleDateString(D.loc(), { weekday: "short", day: "numeric", month: "short" })}`; };
  setInterval(D.tick, 15000);
  D.ACT.desk = () => { D.WN().filter(x => x.ws === D.CUR).forEach(x => { x.min = true; D.place(x); }); D.focusWin(null); };

  /* ---------- clicks, menus, drags on the desktop ---------- */
  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest) return;
    const ad = t.closest("[data-add]"); if (ad) return D.addWidget(ad.dataset.add);
    const rm = t.closest("[data-wrm]"); if (rm) { D.DESK.widgets = D.DESK.widgets.filter(w => String(w.id) !== rm.dataset.wrm); D.save(); return D.drawDesk(); }
    const sz = t.closest("[data-wsz]"); if (sz) { const w = D.DESK.widgets.find(x => String(x.id) === sz.dataset.wsz); w.w = w.w > 320 ? 280 : 420; D.save(); return D.drawDesk(); }
    const ic = t.closest(".ico"); $$(".ico.sel").forEach(x => x.classList.remove("sel")); if (ic) ic.classList.add("sel");
  });
  document.addEventListener("dblclick", e => { const ic = e.target.closest && e.target.closest(".ico"); if (ic) { const c = D.DESK.icons.find(x => String(x.id) === ic.dataset.ico); if (c) D.openIcon(c); } });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.classList && e.target.classList.contains("ico")) { const c = D.DESK.icons.find(x => String(x.id) === e.target.dataset.ico); if (c) D.openIcon(c); } });
  document.addEventListener("contextmenu", e => {
    const t = e.target; if (!t.closest || t.closest("input, textarea, #tb, #cc, .wnd, .sheet, .k-pop, .k-menu, dialog")) return;
    e.preventDefault();
    const ic = t.closest(".ico"), wd = t.closest(".wdg"), x = e.clientX, y = e.clientY;
    if (ic) { const c = D.DESK.icons.find(z => String(z.id) === ic.dataset.ico); if (!c) return; return D.cmenu(x, y, [["Open", "↵", () => D.openIcon(c), 0, "external"], ...(c.file ? [["Download", "", () => { const a = document.createElement("a"); a.href = `/api/desk/files/${c.file}`; a.download = c.n; a.click(); }, 0, "download"]] : []), ["Rename…", "", async () => { const n = await D.askName("Rename", c.n); if (n) { c.n = n; D.save(); D.drawDesk(); } }, 0, "rename"], "-", [c.file ? "Delete the file" : "Remove from the desktop", "", async () => { if (c.file) await D.api("DELETE", `/desk/files/${c.file}`).catch(() => {}); D.DESK.icons = D.DESK.icons.filter(z => z !== c); D.save(); D.drawDesk(); }, 1, "trash"]]); }
    if (wd) { const w = D.DESK.widgets.find(z => String(z.id) === wd.dataset.wdg); return D.cmenu(x, y, [["Wider / narrower", "", () => { w.w = w.w > 320 ? 280 : 420; D.save(); D.drawDesk(); }, 0, "columns"], ["Refresh", "", D.drawDesk, 0, "reload"], "-", ["Remove the widget", "", () => { D.DESK.widgets = D.DESK.widgets.filter(z => z !== w); D.save(); D.drawDesk(); }, 1, "trash"]]); }
    D.cmenu(x, y, [["Add a widget…", D.nice(D.BIND.widget), D.gallery, 0, "puzzle"], ["New note", "", () => D.addWidget("note"), 0, "note"], ["Put files here…", "", () => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.onchange = () => D.upload(i.files); i.click(); }, 0, "upload"], "-", ["Change the wallpaper", "", () => D.go("wall"), 0, "image"], ["Line up the icons", "", () => { const h = Math.max(1, Math.floor(($("#desk").clientHeight - 20) / 100)); D.DESK.icons.forEach((c, i) => { c.x = 16 + Math.floor(i / h) * 96; c.y = 16 + (i % h) * 100; }); D.save(); D.drawDesk(); }, 0, "grid"], ["Command center", D.nice(D.BIND.cc), () => D.ccOpen(), 0, "search"]]);
  });
  // widgets move by their header, icons by themselves (after a few pixels, so a click stays a click)
  document.addEventListener("pointerdown", e => {
    const t = e.target; if (e.button || !t.closest) return;
    const wh = t.closest(".wdg .wh");
    if (wh && !t.closest("button")) {
      const el = wh.parentElement, r = el.getBoundingClientRect(); e.preventDefault();
      return K.drag(e, { move: (dx, dy) => { el.style.left = Math.max(0, Math.min(r.left + dx, innerWidth - 120)) + "px"; el.style.top = Math.max(0, Math.min(r.top + dy, innerHeight - 80)) + "px"; },
        end: () => { const w = D.DESK.widgets.find(z => String(z.id) === el.dataset.wdg); if (w) { w.x = Math.round(parseFloat(el.style.left) / 8) * 8; w.y = Math.round(parseFloat(el.style.top) / 8) * 8; el.style.left = w.x + "px"; el.style.top = w.y + "px"; D.save(); } } });
    }
    const ic = t.closest(".ico");
    if (ic) {
      const r = ic.getBoundingClientRect();
      K.drag(e, { threshold: 3, move: (dx, dy) => { ic.style.left = Math.max(0, r.left + dx) + "px"; ic.style.top = Math.max(0, r.top + dy) + "px"; },
        end: (ev, moved) => { if (!moved) return; const c = D.DESK.icons.find(z => String(z.id) === ic.dataset.ico); if (c) { c.x = Math.max(16, Math.round((parseFloat(ic.style.left) - 16) / 96) * 96 + 16); c.y = Math.max(16, Math.round((parseFloat(ic.style.top) - 16) / 100) * 100 + 16); D.save(); D.drawDesk(); } } });
    }
  });
  // files from the computer, and lessons from the command center, onto the desktop
  let dragLesson = null;
  const hint = t => { if (!$(".drop")) { const d = document.createElement("div"); d.className = "drop"; document.body.append(d); } $(".drop").textContent = t; };
  document.addEventListener("dragstart", e => { const l = e.target.closest && e.target.closest("[data-lesson]"); if (l) { dragLesson = l.dataset.lesson; try { e.dataTransfer.setData("text/plain", l.dataset.lesson); } catch {} setTimeout(D.ccClose, 0); } });
  document.addEventListener("dragover", e => {
    const files = [...(e.dataTransfer ? e.dataTransfer.types : [])].includes("Files");
    if (!files && !dragLesson) return; if (e.target.closest && e.target.closest(".wnd, #tb")) return;
    e.preventDefault(); hint(dragLesson ? "Drop: a shortcut to the lesson" : "Drop your files on the desktop");
  });
  document.addEventListener("dragleave", e => { if (!e.relatedTarget) $(".drop")?.remove(); });
  document.addEventListener("drop", async e => {
    $(".drop")?.remove(); if (e.target.closest && e.target.closest(".wnd, #tb")) return;
    if (!dragLesson && !(e.dataTransfer && e.dataTransfer.files.length)) return;
    e.preventDefault();
    if (dragLesson) { const [q, id] = dragLesson.split(":"); dragLesson = null; const l = (await D.lessons()).find(x => x.scope.q === q && String(x.id) === id); if (l) { D.addIcon({ n: l.title, i: "pen", url: D.studioUrl(l), lesson: { id: String(l.id), title: l.title } }); D.toast(`Shortcut to “${l.title}” on the desktop`); } return; }
    D.upload(e.dataTransfer.files);
  });
  document.addEventListener("dragend", () => { dragLesson = null; $(".drop")?.remove(); });
  document.addEventListener("input", e => { const n = e.target.closest && e.target.closest("[data-note]"); if (n) { const w = D.DESK.widgets.find(z => String(z.id) === n.dataset.note); if (w) { w.text = n.value.slice(0, 4000); D.save(); } } });
})();
