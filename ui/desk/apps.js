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

  D.buildApps = () => {
    const r = D.ME.role, A = [], W = [];
    const lapp = ["manager", "admin"].includes(r), designer = r === "designer";
    W.push({ key: "me", name: lapp ? "LAPP" : "My work", color: "#8B5CF6" });
    if (lapp) {
      A.push({ id: "admin:users", title: "Users", icon: "users", url: "/admin#users", ws: "me" });
      if (r === "admin") A.push({ id: "admin:ai", title: "AI", icon: "bot", url: "/admin#ai", ws: "me" });
    }
    // the studio's lesson library (curriculum map, board, AI ideas, folder rules, new lesson)
    if (lapp) A.push({ id: "studio:library", title: "Lesson library", icon: "library", url: "/admin#content", ws: "me", studio: "" });
    if (lapp || designer) {
      A.push({ id: "studio:home", title: "Studio", icon: "video", url: "/studio#home", ws: "me", studio: "" });
      A.push({ id: "studio:universe", title: "Characters", icon: "cast", url: "/studio#universe", ws: "me", studio: "" });
    }
    A.push({ id: "files", title: "Files", icon: "files", url: "/files", ws: "me" });
    A.push({ id: "settings", title: "Settings", icon: "settings", url: "/settings", ws: "me" });
    D.ORGS.filter(o => SCHOOL_APPS[o.role]).forEach((o, i) => {
      const ws = "s:" + o.slug, color = COLORS[i % COLORS.length];
      W.push({ key: ws, name: o.name, color, role: o.role });
      SCHOOL_APPS[o.role].forEach(([k, ic, l]) => A.push({ id: `${ws}:${k}`, title: l, icon: ic, url: `/s/${o.slug}#${k}`, ws }));
      if (["admin", "teacher"].includes(o.role)) {
        A.push({ id: `studio:library@${o.slug}`, title: "Lesson library", icon: "library", url: `/s/${o.slug}#lessons`, ws, studio: o.slug });
        A.push({ id: `studio:home@${o.slug}`, title: "Studio", icon: "video", url: `/studio?org=${o.slug}#home`, ws, studio: o.slug });
        A.push({ id: `studio:universe@${o.slug}`, title: "Characters", icon: "cast", url: `/studio?org=${o.slug}#universe`, ws, studio: o.slug });
      }
      A.push({ id: `files@${o.slug}`, title: "Files", icon: "files", url: `/files?org=${o.slug}`, ws });
    });
    A.forEach(a => a.color = (W.find(w => w.key === a.ws) || W[0]).color);
    D.APPS = A; D.WS = W;
    if (!W.some(w => w.key === D.CUR)) D.CUR = W[0].key;
  };
  D.wsOf = key => D.WS.find(w => w.key === key) || D.WS[0];

  // which app and workspace a window's address belongs to
  D.appKey = url => {
    const u = new URL(url, location.origin), p = u.pathname, h = u.hash.slice(1).split("/")[0];
    if (p.startsWith("/api/desk/files")) return "file";
    if (p.startsWith("/studio")) { const org = u.searchParams.get("org"); return `studio:${h || "home"}${org ? "@" + org : ""}`; }
    if (p.startsWith("/files")) { const org = u.searchParams.get("org"); return "files" + (org ? "@" + org : ""); }
    if (p.startsWith("/settings")) return "settings";
    if (p.startsWith("/admin")) return "admin:" + (h || "dash");
    const m = p.match(/^\/s\/([^/]+)/); if (m) return `s:${m[1]}:${h || "overview"}`;
    return p;
  };
  D.wsFor = url => {
    const u = new URL(url, location.origin), p = u.pathname;
    // a school the person works in has its own workspace; any other school (e.g. LAPP admins opening one) opens where they are
    const m = p.match(/^\/s\/([^/]+)/); if (m) return D.WS.some(w => w.key === "s:" + m[1]) ? "s:" + m[1] : D.CUR;
    const org = u.searchParams.get("org"); if (org && D.WS.some(w => w.key === "s:" + org)) return "s:" + org;
    if (p.startsWith("/admin") || p.startsWith("/studio") || p.startsWith("/files")) return "me";
    if (p.startsWith("/settings")) return D.CUR;
    return D.CUR;
  };
  D.appOf = url => { const k = D.appKey(url), base = k.replace(/:(script|voice|insights)(@|$)/, ":home$2"); return D.APPS.find(a => a.id === k) || D.APPS.find(a => D.appKey(a.url) === k) || D.APPS.find(a => D.appKey(a.url) === base) || null; };
  D.STUDIO_PART = { lesson: ["settings", "Lesson"], script: ["pen", "Script"], voice: ["wave", "Voice desk"], insights: ["insights", "Insights"], home: ["video", "Studio"], universe: ["cast", "Characters"] };

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
