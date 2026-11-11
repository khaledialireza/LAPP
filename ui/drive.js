/* LAPP content drive: lessons as files in folders, like a cloud drive.
   Folders carry rules (Plus only · level · every line approved before publishing) that pass down to what is inside.
   Drag files and folders onto a folder, select several with Ctrl/Shift, right-click for our menu,
   a bin that keeps things 30 days, the curriculum map (topic × level) and a board by stage,
   and ✦ ideas from the AI that become lessons with one click. The studio opens in its own browser tab.

   Drive.setup({ api(path, method, body), studioUrl(id, part), lapp: bool, refresh(), newLesson(folderId), extraRoot: html })
   Drive.html() → page markup (after Drive.load())  */
(() => {
  "use strict";
  const CSS = `
.dv-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dv-top h1{font-size:28px;font-weight:800;margin-inline-end:6px}
.dv-crumb{display:flex;gap:4px;align-items:center;flex-wrap:wrap;color:var(--mu);font-size:13px;margin-inline-end:auto}
.dv-crumb button{padding:3px 7px;border-radius:7px;color:var(--mu)}.dv-crumb button:hover{background:var(--p3);color:var(--tx)}.dv-crumb b{color:var(--tx);padding:3px 4px}
.dv-cmd{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;background:linear-gradient(var(--p2),var(--p2)) padding-box,var(--g) border-box;border:1px solid transparent}
.dv-cmd input{flex:1;background:none;border:0;outline:none;font-size:14px;min-width:0}
.dv-cmd .s{background:var(--g);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;font-size:17px}
.dv{display:grid;grid-template-columns:220px minmax(0,1fr) 290px;gap:12px;align-items:start}
.dv-pn{background:var(--p2);border:1px solid var(--ln);border-radius:16px;padding:12px;min-width:0}
.dv-pn h3{font-size:11.5px;font-weight:700;color:var(--mu);letter-spacing:.4px;text-transform:uppercase;margin:0 0 8px;display:flex;align-items:center;gap:8px}
.dv-tree{position:sticky;top:0;display:flex;flex-direction:column;gap:1px}
.dv-node{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:8px;font-size:13px;color:var(--mu);text-align:start;width:100%}
.dv-node:hover{background:var(--p3);color:var(--tx)}.dv-node.on{background:var(--p3);color:var(--tx);box-shadow:inset 0 0 0 1px var(--ln2)}
.dv-node.drop{background:rgba(34,211,238,.16);outline:1px dashed var(--cy)}
.dv-node .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}.dv-node em{font-style:normal;font-size:11px;color:var(--mu2)}
.dv-sep{height:1px;background:var(--ln);margin:6px 2px}
.dv-files{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;min-height:120px}
.dv-f{background:var(--p3);border:1px solid var(--ln);border-radius:13px;padding:9px;display:flex;flex-direction:column;gap:5px;text-align:start;cursor:default;user-select:none;position:relative}
.dv-f:hover{border-color:var(--ln2)}.dv-f.sel{border-color:rgba(139,92,246,.85);box-shadow:0 0 0 2px rgba(139,92,246,.3)}
.dv-f.drop{outline:2px dashed var(--cy)}.dv-f.drag{opacity:.4}
.dv-f .ic{height:62px;border-radius:9px;display:grid;place-items:center;font-size:26px;background:var(--p2);position:relative}
.dv-f.folder .ic{background:linear-gradient(135deg,rgba(139,92,246,.28),rgba(34,211,238,.12))}
.dv-f .ic .lk{position:absolute;top:5px;inset-inline-end:6px;font-size:12px}
.dv-f b{font-size:12.5px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.dv-f small{font-size:11px;color:var(--mu2)}
.dv-f.idea{border:1px dashed rgba(139,92,246,.7);background:rgba(139,92,246,.06)}
.dv-f.idea .ic{background:rgba(139,92,246,.12);color:#C4B5FD}
.dv-tag{font:700 9.5px Inter,system-ui;padding:1px 6px;border-radius:5px;letter-spacing:.3px;text-transform:uppercase;display:inline-block}
.t-published{background:rgba(52,211,153,.16);color:var(--gr)}.t-review{background:rgba(251,191,36,.16);color:var(--am)}.t-draft{background:rgba(255,255,255,.08);color:var(--mu)}.t-plus{background:rgba(255,61,127,.16);color:#FF9DBD}.t-bin{background:rgba(248,113,113,.15);color:var(--rd)}
.dv-rule{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--ln);font-size:12.5px}
.dv-rule:last-child{border:0}.dv-rule small{display:block;color:var(--mu2);font-size:11px}
.dv-rule l-select{width:160px;flex:none}
.dv-ck{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--ln);font-size:12.5px}.dv-ck span:first-child{color:var(--mu)}
.dv-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.dv-empty{padding:26px;text-align:center;color:var(--mu);grid-column:1/-1}
.dv-map{display:grid;grid-template-columns:120px repeat(6,minmax(90px,1fr));gap:5px;overflow-x:auto}
.dv-map .h{font:700 11px Inter,system-ui;color:var(--mu2);text-align:center}.dv-map .rl{font-size:12px;color:var(--mu);display:flex;align-items:center}
.dv-cell{min-height:56px;border-radius:9px;background:rgba(255,255,255,.025);border:1px dashed rgba(255,255,255,.1);padding:4px;display:flex;flex-direction:column;gap:3px}
.dv-cell.has{border-style:solid;border-color:var(--ln)}.dv-cell.gap{border-color:rgba(255,61,127,.5)}
.dv-chip{font:600 11px Inter,system-ui;padding:3px 6px;border-radius:6px;text-align:start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dv-chip.published{background:rgba(52,211,153,.16);color:#A7F3D0}.dv-chip.review{background:rgba(251,191,36,.14);color:#FDE68A}.dv-chip.draft{background:rgba(255,255,255,.07);color:var(--mu)}
.dv-board{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:8px;overflow-x:auto}
.dv-col{background:var(--p1);border:1px solid var(--ln);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;min-height:240px}
.dv-col h4{margin:0 0 2px;font-size:12px;color:var(--mu);display:flex;justify-content:space-between}
.dv-card{background:var(--p3);border:1px solid var(--ln);border-radius:9px;padding:7px 9px;font-size:12.5px;text-align:start}
.dv-card small{display:block;color:var(--mu2);font-size:11px}
@container (max-width:1050px){.dv{grid-template-columns:200px minmax(0,1fr)}.dv-ins{grid-column:1/-1}}
@container (max-width:680px){.dv{grid-template-columns:1fr}.dv-tree{position:static;flex-direction:row;overflow-x:auto}.dv-tree .dv-node{width:auto;flex:none}.dv-sep,.dv-tree h3{display:none}}`;
  const esc = K.esc;
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const TOPIC = { daily: "Daily life", travel: "Travel & hotel", food: "Food & shopping", health: "Health & doctor", work: "Work & office", home: "Home & family", city: "City & transport", school: "School & study", story: "Stories", other: "Other" };
  const TYPE = { talk: "💬", lesson: "🎧", story: "📖" }, FLAG = { de: "🇩🇪", nl: "🇳🇱", pl: "🇵🇱" };
  const STATUS = { draft: "Draft", review: "In work", published: "Published" };
  let C = null, D = { folders: [], lessons: [], binDays: 30 }, S = { cur: 0, sel: new Set(), view: "files", q: "", ideas: [], series: "", busy: false };
  const F = id => D.folders.find(f => f.id === id);
  const kids = id => D.folders.filter(f => f.parent === id).sort((a, b) => a.name.localeCompare(b.name));
  const live = () => D.lessons.filter(l => !l.binned);
  const smart = {
    drafts: ["📝", "Drafts", l => l.status !== "published"],
    published: ["✅", "Published", l => l.status === "published"],
    audio: ["🎧", "Needs audio", l => l.lines > 0 && l.audio !== "ready"],
    bin: ["🗑", "Bin", null]
  };
  const inSmart = () => typeof S.cur === "string";
  function shown() {
    const q = S.q.trim().toLowerCase(), m = l => !q || l.title.toLowerCase().includes(q);
    if (S.cur === "bin") return { folders: [], lessons: D.lessons.filter(l => l.binned && m(l)) };
    if (inSmart()) return { folders: [], lessons: live().filter(l => smart[S.cur][2](l) && m(l)) };
    if (q) return { folders: D.folders.filter(f => f.name.toLowerCase().includes(q)), lessons: live().filter(m) };
    return { folders: kids(S.cur), lessons: live().filter(l => l.folder === S.cur) };
  }
  const path = id => { const out = []; for (let f = F(id), i = 0; f && i < 40; f = F(f.parent), i++) out.unshift(f); return out; };
  function rulesHere(id) { // what the folder passes down (its own rules plus those above it)
    const f = F(id), r = { ...(f ? f.inherited : { access: "", level: "", approved: false, from: {} }) };
    if (f) { if (f.rules.access === "plus") { r.access = "plus"; r.from = { ...r.from, access: f.name }; } if (f.rules.level) { r.level = f.rules.level; r.from = { ...r.from, level: f.name }; } if (f.rules.approved) { r.approved = true; r.from = { ...r.from, approved: f.name }; } }
    return r;
  }
  const countIn = id => { let n = live().filter(l => l.folder === id).length; kids(id).forEach(k => n += countIn(k.id)); return n; };

  async function load() { D = await C.api("/drive"); if (typeof S.cur === "number" && S.cur && !F(S.cur)) S.cur = 0; S.sel = new Set([...S.sel].filter(k => k.startsWith("f") ? F(+k.slice(1)) : D.lessons.some(l => l.id === +k.slice(1)))); }
  async function reload() { await load(); C.refresh(); }
  async function act(fn, ok) { try { await fn(); if (ok) Shell.toast(ok); await reload(); } catch (e) { Shell.toast(e.message, { kind: "err" }); } }

  /* ---------- markup ---------- */
  function tree() {
    const node = (f, depth) => `<button class="dv-node ${S.cur === f.id ? "on" : ""}" data-dv-go="${f.id}" data-dv-drop="${f.id}" style="padding-inline-start:${8 + depth * 14}px" title="${esc(f.name)}"><span>📁</span><span class="n">${esc(f.name)}</span>${f.rules.access === "plus" ? "<em>🔒</em>" : ""}<em>${countIn(f.id) || ""}</em></button>` + kids(f.id).map(k => node(k, depth + 1)).join("");
    return `<h3>Folders</h3><button class="dv-node ${S.cur === 0 ? "on" : ""}" data-dv-go="0" data-dv-drop="0"><span>🗂</span><span class="n">All content</span><em>${live().length}</em></button>`
      + kids(0).map(f => node(f, 1)).join("")
      + `<div class="dv-sep"></div><h3>Smart folders</h3>` + Object.entries(smart).map(([k, [i, l, fn]]) => `<button class="dv-node ${S.cur === k ? "on" : ""}" data-dv-go="${k}" ${k === "bin" ? 'data-dv-drop="bin"' : ""}><span>${i}</span><span class="n">${l}</span><em>${fn ? live().filter(fn).length || "" : D.lessons.filter(x => x.binned).length || ""}</em></button>`).join("");
  }
  const fileCard = l => `<div class="dv-f ${S.sel.has("l" + l.id) ? "sel" : ""}" draggable="${!l.binned}" data-dv-l="${l.id}" tabindex="0" title="${l.binned ? "In the bin" : "Double-click to open in the studio"}">
      <div class="ic">${TYPE[l.type] || "🎧"}${l.access === "plus" && C.lapp ? `<span class="lk" title="Plus only">🔒</span>` : ""}</div>
      <b>${FLAG[l.course] || ""} ${esc(l.title)}</b><small>${esc(l.level)} · <span class="dv-tag t-${l.binned ? "bin" : l.status}">${l.binned ? "bin" : STATUS[l.status]}</span>${l.audio === "ready" ? " · 🎧" : ""}</small></div>`;
  const folderCard = f => `<div class="dv-f folder ${S.sel.has("f" + f.id) ? "sel" : ""}" draggable="true" data-dv-f="${f.id}" data-dv-drop="${f.id}" tabindex="0" title="Double-click to open">
      <div class="ic">📁${f.rules.access === "plus" ? `<span class="lk">🔒</span>` : ""}</div><b>${esc(f.name)}</b><small>${countIn(f.id)} lessons${f.rules.level ? " · " + f.rules.level : ""}</small></div>`;
  function files() {
    const { folders, lessons } = shown();
    const ideas = S.ideas.map((x, i) => `<div class="dv-f idea" data-dv-idea="${i}"><div class="ic">✦</div><b class="de">${esc(x.title)}</b><small>${esc(x.level)} · ${esc(TOPIC[x.topic] || "")}</small><div style="display:flex;gap:4px"><button class="b sm pr" data-dv-make="${i}">Create</button><button class="b sm" data-dv-skip="${i}" aria-label="Dismiss">✕</button></div></div>`).join("");
    const head = S.cur === "bin" ? `Bin · kept ${D.binDays} days` : inSmart() ? smart[S.cur][1] : S.q ? "Search results" : (F(S.cur) ? F(S.cur).name : "All content");
    return `<h3>${esc(head)} · ${folders.length + lessons.length} <span style="margin-inline-start:auto;text-transform:none;letter-spacing:0;font-weight:500;color:var(--mu2)">${S.cur === "bin" ? "right-click to restore" : "drag onto a folder to move · Ctrl/Shift to select several"}</span></h3>
      ${S.ideas.length ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="mu">✦ ${S.ideas.length} ideas${S.series ? " · " + esc(S.series) : ""}</span><button class="b sm pr" data-dv-make="all">Create all</button><button class="b sm" data-dv-skip="all">Dismiss</button></div>` : ""}
      <div class="dv-files" data-dv-area>${ideas}${folders.map(folderCard).join("")}${lessons.map(fileCard).join("") || (folders.length || ideas ? "" : `<div class="dv-empty">${S.cur === "bin" ? "The bin is empty." : "Empty. Make a lesson or a folder, or drag lessons here."}</div>`)}</div>`;
  }
  function map() {
    const ls = S.cur === 0 ? live() : shown().lessons;
    const topics = Object.keys(TOPIC).filter(t => ls.some(l => l.topic === t) || ["daily", "travel", "food", "health", "work"].includes(t));
    return `<h3>Curriculum map · topic × level</h3><div class="dv-map"><span></span>${LEVELS.map(l => `<span class="h">${l}</span>`).join("")}
      ${topics.map(t => `<span class="rl">${esc(TOPIC[t])}</span>${LEVELS.map(lv => { const xs = ls.filter(l => l.topic === t && l.level === lv); const gap = !xs.length && lv <= "A2"; return `<div class="dv-cell ${xs.length ? "has" : ""} ${gap ? "gap" : ""}" title="${gap ? "Nothing here yet" : ""}">${xs.map(l => `<button class="dv-chip ${l.status}" data-dv-l="${l.id}" title="${esc(l.title)}">${esc(l.title)}</button>`).join("")}</div>`; }).join("")}`).join("")}</div>
      <p class="mu" style="margin-top:8px">Pink edges: A1–A2 gaps with no lesson yet. Double-click a lesson to open it in the studio.</p>`;
  }
  function board() {
    const ls = S.cur === 0 ? live() : shown().lessons;
    const cols = [["Draft", l => !l.lines], ["Text in work", l => l.lines && l.status !== "published" && l.audio === "none"], ["Audio", l => l.lines && l.status !== "published" && l.audio !== "none"], ["Published", l => l.status === "published"]];
    return `<h3>Board · where each lesson stands</h3><div class="dv-board">${cols.map(([n, fn]) => { const xs = ls.filter(fn); return `<div class="dv-col"><h4><span>${n}</span><span>${xs.length}</span></h4>${xs.map(l => `<button class="dv-card" data-dv-l="${l.id}">${FLAG[l.course] || ""} <b>${esc(l.title)}</b><small>${esc(l.level)} · ${l.lines ? `${l.approved}/${l.lines} lines approved` : "no text yet"}${l.audio === "old" ? " · audio older than text" : ""}</small></button>`).join("")}</div>`; }).join("")}</div>`;
  }
  function inspector() {
    const sel = [...S.sel];
    if (sel.length > 1) return `<h3>${sel.length} selected</h3><div class="dv-acts"><button class="b sm" data-dv-a="move">Move to…</button>${sel.some(k => k[0] === "l") ? `<button class="b sm d" data-dv-a="bin">🗑 Move to the bin</button>` : ""}</div>`;
    if (sel.length === 1 && sel[0][0] === "l") {
      const l = D.lessons.find(x => x.id === +sel[0].slice(1)); if (!l) return "";
      const fr = rulesHere(l.folder);
      return `<h3>${FLAG[l.course] || ""} ${esc(l.title)}</h3>
        <div class="dv-ck"><span>Status</span><span class="dv-tag t-${l.binned ? "bin" : l.status}">${l.binned ? "in the bin" : STATUS[l.status]}</span></div>
        <div class="dv-ck"><span>Level · type</span><b>${esc(l.level)} · ${TYPE[l.type] || ""}</b></div>
        <div class="dv-ck"><span>Lines approved</span><b>${l.approved} / ${l.lines}</b></div>
        <div class="dv-ck"><span>Audio</span><b>${{ ready: "ready", old: "older than the text", none: "not made yet" }[l.audio]}</b></div>
        <div class="dv-ck"><span>Folder</span><b>${esc(F(l.folder) ? F(l.folder).name : "All content")}</b></div>
        ${C.lapp && !l.binned ? `<div class="dv-rule"><span>Who can open it<small>${fr.access === "plus" ? `“${esc(fr.from.access)}” makes it Plus` : "the folder lets everyone in"}</small></span><l-select data-dv-own="${l.id}" aria-label="Who can open it"><option value="" ${!l.own ? "selected" : ""}>${fr.access === "plus" ? "Plus (from the folder)" : "Same as the folder · free"}</option><option value="plus" ${l.own === "plus" ? "selected" : ""}>Plus only</option></l-select></div>` : ""}
        ${fr.approved ? `<p class="mu" style="font-size:12px;margin-top:6px">✅ “${esc(fr.from.approved)}”: every line approved before publishing.</p>` : ""}
        <div class="dv-acts">${l.binned ? `<button class="b sm pr" data-dv-a="restore">Restore</button><button class="b sm d" data-dv-a="forever">Delete for good</button>`
          : `<a class="b sm pr" href="${esc(C.studioUrl(l.id))}" target="_blank" rel="noopener">🎬 Open in the studio ↗</a>${l.status === "published" ? `<button class="b sm" data-dv-a="unpub">Unpublish</button>` : ""}<button class="b sm" data-dv-a="move">Move to…</button><button class="b sm d" data-dv-a="bin">🗑</button>`}</div>`;
    }
    const fid = sel.length === 1 && sel[0][0] === "f" ? +sel[0].slice(1) : typeof S.cur === "number" ? S.cur : null;
    if (fid === null) return `<h3>${smart[S.cur][0]} ${smart[S.cur][1]}</h3><p class="mu">${S.cur === "bin" ? `Lessons in the bin are hidden from learners and removed after ${D.binDays} days. Right-click one to restore it.` : "A live view of every folder. Select a lesson to see it here."}</p>`;
    const f = F(fid), inh = f ? f.inherited : { access: "", level: "", approved: false, from: {} }, r = f ? f.rules : null;
    const sel2 = (k, opts, v) => `<l-select data-dv-rule="${k}" data-f="${fid}" aria-label="${k}">${opts.map(([a, b]) => `<option value="${a}" ${String(v) === String(a) ? "selected" : ""}>${esc(b)}</option>`).join("")}</l-select>`;
    return `<h3>📁 ${esc(f ? f.name : "All content")} · rules</h3>
      ${f ? `${C.lapp ? `<div class="dv-rule"><span>Who can open it<small>${inh.access === "plus" ? `already Plus from “${esc(inh.from.access)}”` : "files inside may be stricter, never looser"}</small></span>${inh.access === "plus" ? "<b>Plus</b>" : sel2("access", [["", "Everyone, free"], ["plus", "Plus members"]], r.access)}</div>` : ""}
        <div class="dv-rule"><span>Level<small>${inh.level && !r.level ? `“${esc(inh.from.level)}” says ${inh.level}` : "new lessons get it; the AI writes at it"}</small></span>${sel2("level", [["", inh.level ? `As above (${inh.level})` : "Any level"], ...LEVELS.map(l => [l, l])], r.level)}</div>
        <div class="dv-rule"><span>Before publishing<small>${inh.approved ? `already asked by “${esc(inh.from.approved)}”` : "audio and all translations are always needed"}</small></span>${inh.approved ? "<b>every line approved</b>" : sel2("approved", [["", "Nothing more"], ["1", "Every line approved"]], r.approved ? "1" : "")}</div>
        <div class="dv-acts"><button class="b sm" data-dv-a="rename">Rename</button><button class="b sm" data-dv-a="move">Move to…</button><button class="b sm d" data-dv-a="delfolder">Delete folder</button></div>`
      : `<p class="mu">The top of the drive. Make folders for courses, levels or series, and give each folder its rules.</p>${C.extraRoot || ""}`}`;
  }
  function html() {
    const crumbs = inSmart() ? `<b>${smart[S.cur][1]}</b>` : [`<button data-dv-go="0">All content</button>`, ...path(S.cur).map((f, i, a) => i === a.length - 1 ? `<b>${esc(f.name)}</b>` : `<button data-dv-go="${f.id}">${esc(f.name)}</button>`)].join(" › ");
    return `<div class="dv-top"><h1>Lesson library</h1><div class="dv-crumb">${crumbs}</div>
        <div class="seg" role="tablist">${[["files", "▦ Files"], ["map", "🗺 Map"], ["board", "▥ Board"]].map(([k, l]) => `<button class="${S.view === k ? "on" : ""}" data-dv-view="${k}">${l}</button>`).join("")}</div>
        <button class="b" data-dv-a="newfolder">📁 New folder</button><button class="b pr" data-dv-a="newlesson">＋ New lesson</button></div>
      <form class="dv-cmd" data-dv-plan><span class="s">✦</span><input name="q" placeholder="Describe lessons to plan, e.g. “6 A1 lessons for a trip to Vienna”" aria-label="Describe lessons for the AI to plan" maxlength="400"><button class="b sm pr" ${S.busy ? "disabled" : ""}>${S.busy ? "Thinking…" : "✦ Suggest"}</button></form>
      <div class="dv"><aside class="dv-pn dv-tree">${tree()}</aside>
        <div class="dv-pn" data-dv-main><input class="in" data-dv-q placeholder="🔍 Find a lesson or folder" value="${esc(S.q)}" style="margin-bottom:10px" aria-label="Find">${S.view === "map" ? map() : S.view === "board" ? board() : files()}</div>
        <aside class="dv-pn dv-ins">${inspector()}</aside></div>`;
  }

  /* ---------- actions ---------- */
  const lessonIds = () => [...S.sel].filter(k => k[0] === "l").map(k => +k.slice(1));
  const folderIds = () => [...S.sel].filter(k => k[0] === "f").map(k => +k.slice(1));
  function moveTargets(run) {
    const items = [{ icon: "🗂", label: "All content", run: () => run(0) }];
    const add = (id, depth) => kids(id).forEach(f => { if (!folderIds().includes(f.id)) { items.push({ icon: "📁", label: " ".repeat(depth * 2) + f.name, run: () => run(f.id) }); add(f.id, depth + 1); } });
    add(0, 0); return items;
  }
  const move = to => act(() => C.api("/move", "POST", { lessons: lessonIds(), folders: folderIds(), to }), "Moved");
  async function run(a, el) {
    if (a === "newfolder") { const name = await Shell.ask({ title: "New folder", label: "Name", placeholder: "A1 · Travel", ok: "Create" }); if (name) act(() => C.api("/folders", "POST", { name, parent: typeof S.cur === "number" ? S.cur : 0 }), "Folder created"); }
    if (a === "newlesson") C.newLesson(typeof S.cur === "number" ? S.cur : 0, rulesHere(typeof S.cur === "number" ? S.cur : 0));
    if (a === "move") Shell.menu(el, [{ head: "Move to" }, ...moveTargets(move)]);
    if (a === "bin") act(() => C.api("/bin", "POST", { lessons: lessonIds() }), `In the bin for ${D.binDays} days`).then(() => S.sel.clear());
    if (a === "restore") act(() => C.api("/bin", "POST", { lessons: lessonIds(), restore: true }), "Restored");
    if (a === "forever") { if (await Shell.confirm({ title: "Delete for good?", text: "The lesson, its audio and its history are removed. This can't be undone.", ok: "Delete for good", danger: true })) act(() => C.api("/bin", "POST", { lessons: lessonIds(), forever: true }), "Deleted").then(() => S.sel.clear()); }
    if (a === "unpub") { const id = lessonIds()[0]; act(() => C.api(`/lessons/${id}/unpublish`, "POST"), "Unpublished · learners no longer see it"); }
    if (a === "rename") { const id = folderIds()[0] ?? S.cur, f = F(id); if (!f) return; const name = await Shell.ask({ title: "Rename the folder", label: "Name", value: f.name, ok: "Rename", validate: v => D.folders.some(x => x.parent === f.parent && x.id !== f.id && x.name.toLowerCase() === v.toLowerCase()) ? "A folder with this name is already here." : "" }); if (name) act(() => C.api(`/folders/${f.id}`, "PATCH", { name }), "Renamed"); }
    if (a === "delfolder") { const id = folderIds()[0] ?? S.cur, f = F(id); if (!f) return; if (await Shell.confirm({ title: `Delete the folder “${f.name}”?`, text: `Its ${countIn(f.id)} lessons and folders move up one level. Nothing is deleted.`, ok: "Delete folder", danger: true })) { if (S.cur === f.id) S.cur = f.parent; S.sel.clear(); act(() => C.api(`/folders/${f.id}`, "DELETE"), "Folder deleted · its content moved up"); } }
  }
  function select(key, e) {
    if (e.ctrlKey || e.metaKey) { S.sel.has(key) ? S.sel.delete(key) : S.sel.add(key); }
    else if (e.shiftKey && S.sel.size) {
      const all = [...document.querySelectorAll("[data-dv-main] [data-dv-l], [data-dv-main] [data-dv-f]")].map(x => x.dataset.dvL ? "l" + x.dataset.dvL : "f" + x.dataset.dvF);
      const a = all.indexOf([...S.sel].pop()), b = all.indexOf(key); all.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(k => S.sel.add(k));
    } else S.sel = new Set([key]);
    C.refresh();
  }
  function go(id) { S.cur = id === "0" || id === 0 ? 0 : /^\d+$/.test(String(id)) ? +id : id; S.sel.clear(); S.q = ""; C.refresh(); }
  function menuFor(e, key) {
    if (!S.sel.has(key)) S.sel = new Set([key]);
    const at = { x: e.clientX, y: e.clientY };
    if (key[0] === "f") {
      const f = F(+key.slice(1));
      return Shell.menu(at, [{ icon: "📂", label: "Open", run: () => go(f.id) }, { icon: "✎", label: "Rename", kbd: "F2", run: () => run("rename") }, { icon: "↪", label: "Move to", sub: moveTargets(move) }, { icon: "⚙", label: "Rules", run: () => { S.sel = new Set([key]); C.refresh(); } }, "-", { icon: "🗑", label: "Delete folder", danger: true, run: () => run("delfolder") }], { search: false });
    }
    const l = D.lessons.find(x => x.id === +key.slice(1));
    if (l.binned) return Shell.menu(at, [{ icon: "↩", label: "Restore", run: () => run("restore") }, { icon: "✕", label: "Delete for good", danger: true, run: () => run("forever") }], { search: false });
    const many = S.sel.size > 1;
    Shell.menu(at, [
      ...(many ? [] : [{ icon: "🎬", label: "Open in the studio ↗", kbd: "Enter", run: () => window.open(C.studioUrl(l.id), "_blank") }, { icon: "〰", label: "Open its voice desk ↗", run: () => window.open(C.studioUrl(l.id, "voice"), "_blank") }]),
      { icon: "↪", label: "Move to", sub: moveTargets(move) },
      ...(C.lapp && !many ? [{ icon: "🔒", label: "Who can open it", sub: [{ label: "Same as the folder", run: () => own(l, "") }, { label: "Plus only", run: () => own(l, "plus") }] }] : []),
      ...(!many && l.status === "published" ? [{ icon: "⏸", label: "Unpublish", run: () => run("unpub") }] : []),
      "-", { icon: "🗑", label: many ? `Move ${S.sel.size} to the bin` : "Move to the bin", kbd: "Del", danger: true, run: () => run("bin") }], { search: false });
  }
  const own = (l, v) => act(() => C.api(`/lessons/${l.id}`, "PUT", { rev: l.rev, access: v }), v ? "Plus only" : "Same as the folder");
  async function makeIdeas(which) {
    const list = which === "all" ? S.ideas : [S.ideas[+which]];
    const folder = typeof S.cur === "number" ? S.cur : 0;
    await act(async () => { await C.api("/lessons", "POST", { lessons: list.map(x => ({ ...x, series: S.series })), folder }); S.ideas = which === "all" ? [] : S.ideas.filter((_, i) => i !== +which); }, list.length > 1 ? `${list.length} lessons created` : "Lesson created");
  }

  /* ---------- events (once, scoped to the drive) ---------- */
  function events() {
    const inDrive = e => e.target.closest && e.target.closest(".dv, .dv-top, .dv-cmd");
    document.addEventListener("click", e => {
      if (!inDrive(e)) return;
      const t = e.target;
      const g = t.closest("[data-dv-go]"); if (g) return go(g.dataset.dvGo);
      const v = t.closest("[data-dv-view]"); if (v) { S.view = v.dataset.dvView; return C.refresh(); }
      const a = t.closest("[data-dv-a]"); if (a) return run(a.dataset.dvA, a);
      const mk = t.closest("[data-dv-make]"); if (mk) return makeIdeas(mk.dataset.dvMake);
      const sk = t.closest("[data-dv-skip]"); if (sk) { S.ideas = sk.dataset.dvSkip === "all" ? [] : S.ideas.filter((_, i) => i !== +sk.dataset.dvSkip); return C.refresh(); }
      const l = t.closest("[data-dv-l]"); if (l) return select("l" + l.dataset.dvL, e);
      const f = t.closest("[data-dv-f]"); if (f) return select("f" + f.dataset.dvF, e);
      if (t.closest("[data-dv-area]") && S.sel.size) { S.sel.clear(); C.refresh(); }
    });
    document.addEventListener("dblclick", e => {
      if (!inDrive(e)) return;
      const f = e.target.closest("[data-dv-f]"); if (f) return go(f.dataset.dvF);
      const l = e.target.closest("[data-dv-l]"); if (l) { const x = D.lessons.find(y => y.id === +l.dataset.dvL); if (x && !x.binned) window.open(C.studioUrl(x.id), "_blank"); }
    });
    document.addEventListener("contextmenu", e => {
      if (!inDrive(e)) return;
      const l = e.target.closest("[data-dv-l]"), f = e.target.closest("[data-dv-f]");
      if (l || f) { e.preventDefault(); return menuFor(e, l ? "l" + l.dataset.dvL : "f" + f.dataset.dvF); }
      if (e.target.closest("[data-dv-main]") && S.cur !== "bin") { e.preventDefault(); Shell.menu({ x: e.clientX, y: e.clientY }, [{ icon: "＋", label: "New lesson", run: () => run("newlesson") }, { icon: "📁", label: "New folder", run: () => run("newfolder") }, { icon: "⟳", label: "Reload", run: reload }], { search: false }); }
    });
    document.addEventListener("change", e => {
      const r = e.target.closest && e.target.closest("[data-dv-rule]");
      if (r) { const f = F(+r.dataset.f); const rules = { ...f.rules, [r.dataset.dvRule]: r.dataset.dvRule === "approved" ? r.value === "1" : r.value }; return act(() => C.api(`/folders/${f.id}`, "PATCH", { rules }), "Rule saved · it applies to everything inside"); }
      const o = e.target.closest && e.target.closest("[data-dv-own]");
      if (o) { const l = D.lessons.find(x => x.id === +o.dataset.dvOwn); return own(l, o.value); }
    });
    let qT;
    document.addEventListener("input", e => {
      if (!e.target.matches || !e.target.matches("[data-dv-q]")) return;
      clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; C.refresh().then(() => { const q = document.querySelector("[data-dv-q]"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }); }, 250);
    });
    document.addEventListener("submit", async e => {
      if (!e.target.matches("[data-dv-plan]")) return; e.preventDefault();
      const prompt = e.target.elements.q.value.trim(); if (!prompt) return;
      S.busy = true; C.refresh();
      try { const r = await C.api("/plan", "POST", { prompt }); S.ideas = r.lessons || []; S.series = r.series || ""; S.view = "files"; Shell.toast(`✦ ${S.ideas.length} ideas — create the ones you like`, { kind: "info" }); }
      catch (x) { Shell.toast(x.message, { kind: "err" }); }
      S.busy = false; C.refresh();
    });
    document.addEventListener("keydown", e => {
      if (!document.querySelector(".dv") || e.target.closest("input, textarea, select") || !S.sel.size) return;
      if (!document.querySelector(".dv").offsetParent) return;
      if (e.key === "Delete" || e.key === "Backspace") { if (lessonIds().length && S.cur !== "bin") { e.preventDefault(); run("bin"); } }
      if (e.key === "F2" && folderIds().length === 1) { e.preventDefault(); run("rename"); }
      if (e.key === "Enter") { const id = lessonIds()[0]; if (id) window.open(C.studioUrl(id), "_blank"); else if (folderIds()[0]) go(folderIds()[0]); }
      if (e.key === "Escape") { S.sel.clear(); C.refresh(); }
    });
    // drag lessons and folders onto a folder (in the tree or the grid), or onto the bin
    let drag = null;
    document.addEventListener("dragstart", e => {
      const el = e.target.closest && e.target.closest("[data-dv-l], [data-dv-f]"); if (!el || !inDrive(e)) return;
      const key = el.dataset.dvL ? "l" + el.dataset.dvL : "f" + el.dataset.dvF;
      if (!S.sel.has(key)) { S.sel = new Set([key]); }
      drag = [...S.sel]; el.classList.add("drag");
      try { e.dataTransfer.setData("text/plain", drag.join(",")); e.dataTransfer.effectAllowed = "move"; } catch {}
    });
    document.addEventListener("dragend", () => { drag = null; document.querySelectorAll(".dv .drag, .dv .drop").forEach(x => x.classList.remove("drag", "drop")); });
    document.addEventListener("dragover", e => {
      if (!drag) return; const t = e.target.closest("[data-dv-drop]"); document.querySelectorAll(".dv .drop").forEach(x => x.classList.remove("drop"));
      if (!t || drag.includes("f" + t.dataset.dvDrop)) return; e.preventDefault(); t.classList.add("drop");
    });
    document.addEventListener("drop", e => {
      if (!drag) return; const t = e.target.closest("[data-dv-drop]"); if (!t) return; e.preventDefault();
      const to = t.dataset.dvDrop; S.sel = new Set(drag); drag = null;
      if (to === "bin") return run("bin");
      move(+to);
    });
  }

  let ready = false;
  window.Drive = {
    setup(c) { C = c; if (!ready) { ready = true; const st = document.createElement("style"); st.textContent = CSS; document.head.append(st); events(); } },
    load, html, reload, state: () => S
  };
})();
