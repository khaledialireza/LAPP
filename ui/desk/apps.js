// LAPP work desktop · apps and workspaces: what this person may open, and where it lives.
// An app = { id, title, icon (our icon name), url, ws (workspace key), color }.
// A workspace = one organisation the person works in ("me" = LAPP and their own work, "s:<slug>" = a school).
"use strict";
(function () {
  const { esc } = D;
  const SCHOOL_APPS = {
    admin: [["overview", "dashboard", "Overview"], ["classes", "school", "Classes"], ["people", "users", "People"], ["timetable", "calendar", "Timetable"], ["homework", "homework", "Homework"], ["finance", "money", "Finance"], ["settings", "settings", "School settings"]],
    teacher: [["week", "calendar", "My week"], ["classes", "school", "My classes"], ["homework", "homework", "Homework"]],
    finance: [["finance", "money", "Finance"], ["people", "student", "Students"]]
  };
  const COLORS = ["#22D3EE", "#F59E0B", "#10B981", "#60A5FA", "#FF3D7F", "#A78BFA"];
  D.WS = []; D.APPS = []; D.CUR = "me";

  D.studioScopes = () => [...(["designer", "manager", "admin"].includes(D.ME.role) ? [{ q: "", name: "LAPP library", ws: "me" }] : []), ...D.ORGS.filter(o => ["admin", "teacher"].includes(o.role)).map(o => ({ q: o.slug, name: o.name, ws: "s:" + o.slug }))];

  // every signed-in account (the main one, slot 0, and linked ones) brings its own workspaces and apps;
  // a linked account's keys end in "~n" and its addresses carry ?as=n
  D.ACCTS = [];
  const withAs = (url, n) => { if (!n) return url; const u = new URL(url, location.origin); u.searchParams.set("as", n); return u.pathname + u.search + u.hash; };
  D.withAs = withAs;
  D.buildApps = () => {
    const A = [], W = [], accts = D.ACCTS.length ? D.ACCTS : [{ slot: 0, user: D.ME, orgs: D.ORGS }];
    accts.forEach(ac => {
      const n = ac.slot, sx = n ? "~" + n : "", r = ac.user.role, a0 = A.length, w0 = W.length;
      const lapp = ["manager", "admin"].includes(r), designer = r === "designer", acct = { slot: n, name: ac.user.name || "@" + ac.user.username };
      // an app from the store shows only when its space installed it and lets this person use it
      const ok = (x, ws, role, admin) => { const c = STORE_OF(x.id); if (!c) return true; const inst = (D.INST || {})[ws]; if (!inst) return true; const w = inst[c]; return !!w && (w.all || (w.me ? admin : (w.roles || []).includes(role))); };
      const push = (x, role, admin) => { if (ok(x, x.ws, role === undefined ? r : role, admin === undefined ? r === "admin" : admin)) A.push({ ...x, id: x.id + sx, url: withAs(x.url, n), as: n }); };
      if (!n || lapp || designer) W.push({ key: "me" + sx, name: lapp ? "LAPP" : n ? acct.name : "My work", color: "#8B5CF6", as: n });
      if (lapp) {
        push({ id: "users", title: "Users", icon: "users", url: "/users", ws: "me" + sx });
        push({ id: "studio:library", title: "Lesson library", icon: "library", url: "/admin#content", ws: "me" + sx, studio: "" });
      }
      if (lapp || designer) {
        push({ id: "studio:home", title: "Studio", icon: "video", url: "/studio#home", ws: "me" + sx, studio: "" });
        push({ id: "studio:universe", title: "Characters", icon: "cast", url: "/studio#universe", ws: "me" + sx, studio: "" });
      }
      if (lapp || designer) push({ id: "store", title: "App Store", icon: "download", url: "/store", ws: "me" + sx });
      if (lapp) push({ id: "customers", title: "Customer Center", icon: "headphones", url: "/customers", ws: "me" + sx });
      if (!n || lapp || designer) {
        push({ id: "files", title: "Files", icon: "files", url: "/files", ws: "me" + sx });
        if (!n) push({ id: "settings", title: "Settings", icon: "settings", url: "/settings", ws: "me" });
      }
      (ac.orgs || []).filter(o => SCHOOL_APPS[o.role]).forEach(o => {
        const ws = "s:" + o.slug + sx, color = COLORS[(W.length - 1 + COLORS.length) % COLORS.length];
        W.push({ key: ws, name: n ? `${o.name} · ${o.role}` : o.name, color, role: o.role, as: n });
        const R = o.role, AD = o.role === "admin";
        SCHOOL_APPS[o.role].forEach(([k, ic, l]) => push(k === "people" && AD ? { id: `users@${o.slug}`, title: "Users", icon: "users", url: `/users?org=${o.slug}`, ws } : { id: `s:${o.slug}:${k}`, title: l, icon: ic, url: `/s/${o.slug}#${k}`, ws }, R, AD));
        if (["admin", "teacher"].includes(o.role)) {
          push({ id: `studio:library@${o.slug}`, title: "Lesson library", icon: "library", url: `/s/${o.slug}#lessons`, ws, studio: o.slug }, R, AD);
          push({ id: `studio:home@${o.slug}`, title: "Studio", icon: "video", url: `/studio?org=${o.slug}#home`, ws, studio: o.slug }, R, AD);
          push({ id: `studio:universe@${o.slug}`, title: "Characters", icon: "cast", url: `/studio?org=${o.slug}#universe`, ws, studio: o.slug }, R, AD);
        }
        if (AD) push({ id: `store@${o.slug}`, title: "App Store", icon: "download", url: `/store?org=${o.slug}`, ws }, R, AD);
        push({ id: `files@${o.slug}`, title: "Files", icon: "files", url: `/files?org=${o.slug}`, ws }, R, AD);
      });
      ac.ws = W.slice(w0).map(w => w.key); ac.apps = A.length - a0;
    });
    A.forEach(a => a.color = (W.find(w => w.key === a.ws) || W[0]).color);
    D.APPS = A; D.WS = W;
    if (!W.some(w => w.key === D.CUR)) D.CUR = W[0].key;
  };
  // which store app an app of the desk belongs to (apps not listed here are always there)
  const STORE_OF = id => /^studio:/.test(id) ? "studio" : /:(overview|classes)$/.test(id) ? "classes" : /:(timetable|week)$/.test(id) ? "timetable" : /:homework$/.test(id) ? "homework" : /:finance$/.test(id) ? "money" : "";
  // what each space installed (asked once per space; a space that never opened the store keeps its first apps)
  D.INST = null;
  D.loadInstalls = async () => {
    const out = {};
    await Promise.all(D.ACCTS.flatMap(ac => { const sx = ac.slot ? "~" + ac.slot : "", h = ac.slot ? { headers: { "X-As": String(ac.slot) } } : undefined;
      const spaces = [...(["designer", "manager", "admin"].includes(ac.user.role) ? [["me" + sx, ""]] : []), ...(ac.orgs || []).map(o => ["s:" + o.slug + sx, o.slug])];
      return spaces.map(([ws, org]) => fetch("/api/store" + (org ? "?org=" + org : ""), { credentials: "same-origin", ...(h || {}) }).then(r => r.ok ? r.json() : null).then(j => { if (j) out[ws] = Object.fromEntries(j.apps.filter(a => a.installed).map(a => [a.id, a.who])); }).catch(() => {})); }));
    D.INST = out;
  };
  D.acctOf = n => D.ACCTS.find(a => a.slot === (n || 0)) || null;
  D.asOf = url => { try { return +(new URL(url, location.origin).searchParams.get("as") || 0); } catch { return 0; } };
  D.wsOf = key => D.WS.find(w => w.key === key) || D.WS[0];

  // which app and workspace a window's address belongs to
  D.appKey = url => { const n = D.asOf(url); return appKey0(url) + (n ? "~" + n : ""); };
  const appKey0 = url => {
    const u = new URL(url, location.origin), p = u.pathname, h = u.hash.slice(1).split("/")[0];
    if (p.startsWith("/api/desk/files")) return "file";
    if (p.startsWith("/studio")) { const org = u.searchParams.get("org"); return `studio:${h || "home"}${org ? "@" + org : ""}`; }
    if (p.startsWith("/files")) { const org = u.searchParams.get("org"); return "files" + (org ? "@" + org : ""); }
    if (p.startsWith("/settings")) return "settings";
    if (p.startsWith("/users")) { const org = u.searchParams.get("org"); return "users" + (org ? "@" + org : ""); }
    if (p.startsWith("/store")) { const org = u.searchParams.get("org"); return "store" + (org ? "@" + org : ""); }
    if (p.startsWith("/customers")) return "customers";
    if (p.startsWith("/admin")) return "admin:" + (h || "dash");
    const m = p.match(/^\/s\/([^/]+)/); if (m) return `s:${m[1]}:${h || "overview"}`;
    return p;
  };
  D.wsFor = url => {
    const n = D.asOf(url); if (n) { const ac = D.acctOf(n), app = D.appOf(url); return app ? app.ws : ac && ac.ws && ac.ws[0] || D.CUR; }
    const u = new URL(url, location.origin), p = u.pathname;
    // a school the person works in has its own workspace; any other school (e.g. LAPP admins opening one) opens where they are
    const m = p.match(/^\/s\/([^/]+)/); if (m) return D.WS.some(w => w.key === "s:" + m[1]) ? "s:" + m[1] : D.CUR;
    const org = u.searchParams.get("org"); if (org && D.WS.some(w => w.key === "s:" + org)) return "s:" + org;
    if (p.startsWith("/admin") || p.startsWith("/studio") || p.startsWith("/files") || p.startsWith("/users") || p.startsWith("/store") || p.startsWith("/customers")) return "me";
    if (p.startsWith("/settings")) return D.CUR;
    return D.CUR;
  };
  D.appOf = url => { const k = D.appKey(url), base = k.replace(/:(script|voice|insights)(@|$)/, ":home$2"); return D.APPS.find(a => a.id === k) || D.APPS.find(a => D.appKey(a.url) === k) || D.APPS.find(a => D.appKey(a.url) === base) || null; };
  D.STUDIO_PART = { lesson: ["settings", "Lesson"], script: ["pen", "Script"], voice: ["wave", "Voice desk"], insights: ["insights", "Insights"], home: ["video", "Studio"], universe: ["cast", "Characters"] };

  /* ---------- one picture of what is going on: the taskbar and the command center both read only this ---------- */
  // wait: lessons with lines to approve · lines: how many lines · run: audio being made · un: unread notifications
  D.live = () => {
    // numbers are for the workspace you are in, like the taskbar's apps
    const ls = (D.LESSONS || []).filter(l => !l.scope || !l.scope.ws || l.scope.ws === D.CUR), w = D.W && D.W(D.ACTW), wait = ls.filter(l => l.status !== "published" && l.lines && l.approved < l.lines);
    const front = w && /\/studio/.test(w.url) && w.lesson ? ls.find(l => String(l.id) === String(w.lesson.id)) : null;
    return { h: new Date().getHours(), wait, lines: wait.reduce((a, l) => a + (l.lines - l.approved), 0), run: D.running(), un: D.NOTES.filter(n => !n.read), front, w,
      recent: ((D.DESK && D.DESK.recent) || []).filter(r => !D.WN().some(x => x.url === r.url)), inwork: ls.filter(l => l.status !== "published"), pub: ls.filter(l => l.status === "published") };
  };
  // waiting work per app (the badge on the taskbar and the count on the app's tile are this one number)
  D.waiting = () => {
    const n = {}, add = (id, k) => { if (id) n[id] = (n[id] || 0) + k; }, L = D.live();
    (D.LESSONS || []).filter(l => l.status !== "published" && l.lines && l.approved < l.lines).forEach(l => { const at = l.scope && l.scope.q ? "@" + l.scope.q : ""; add("studio:home" + at, 1); add("studio:library" + at, 1); });
    L.un.filter(x => x.url).forEach(x => { const a = D.appOf(x.url); add(a && a.id, 1); });
    return n;
  };
  // any change to windows, workspace, jobs, notifications or lessons → one "live" event for everyone who shows it
  let liveT = 0; ["wins", "ws", "state", "jobs", "notes", "lessons"].forEach(e => D.on(e, () => { clearTimeout(liveT); liveT = setTimeout(() => D.emit("live"), 30); }));

  /* ---------- lessons (for the studio) ---------- */
  D.LESSONS = null;
  D.lessons = async () => {
    if (D.LESSONS) return D.LESSONS;
    const all = await Promise.all(D.studioScopes().map(s => D.api("GET", "/studio/lessons" + (s.q ? "?org=" + s.q : "")).then(r => r.lessons.filter(l => !l.binned).map(l => ({ ...l, scope: s }))).catch(() => [])));
    return D.LESSONS = all.flat();
  };
  D.studioUrl = (l, part = "script") => `/studio${l.scope.q ? "?org=" + l.scope.q : ""}#${part}/${l.id}`;
  D.openLesson = (l, part = "script") => { const [ic, nm] = D.STUDIO_PART[part] || D.STUDIO_PART.script; return D.openWin(D.studioUrl(l, part), { title: `${nm} · ${l.title}`, icon: ic, lesson: { id: String(l.id), title: l.title } }); };
  D.FLAG = c => ({ de: "🇩🇪", nl: "🇳🇱", pl: "🇵🇱" })[c] || "";

  /* ---------- background work (audio) ---------- */
  const SEEN = {};
  D.pollJobs = async () => {
    const all = await Promise.all(D.studioScopes().map(s => D.api("GET", "/studio/jobs" + (s.q ? "?org=" + s.q : "")).then(r => (r.jobs || []).map(j => ({ ...j, scope: s }))).catch(() => [])));
    D.JOBS.length = 0; D.JOBS.push(...all.flat().sort((a, b) => b.at - a.at));
    D.JOBS.forEach(j => { const k = j.scope.q + ":" + j.id; if (SEEN[k] && SEEN[k] !== j.status && ["done", "failed"].includes(j.status) && D.LS.get("lapp.theme", {}).jobnotes !== false) { const ok = j.status === "done", txt = `Audio ${ok ? "ready" : "stopped"} · ${j.title}`; D.note({ icon: "wave", text: txt, kind: ok ? "ok" : "err", from: "Studio", url: D.studioUrl({ id: j.lesson, scope: j.scope }, "voice"), lesson: { id: String(j.lesson), title: j.title } }); D.toast(txt, { kind: ok ? "ok" : "err" }); } SEEN[k] = j.status; });
    D.emit("jobs");
    setTimeout(D.pollJobs, D.JOBS.some(j => ["queued", "running"].includes(j.status)) ? 20000 : 90000);
  };
  D.running = () => D.JOBS.filter(j => ["queued", "running"].includes(j.status));
  D.JOBTXT = { queued: "waiting to start", running: "being made", done: "ready", failed: "stopped" };
  D.lessonTag = l => `${esc(l.level || "")} · ${esc(l.scope.name)}`;
})();
