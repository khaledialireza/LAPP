// LAPP Studio · the Lesson app (#lesson/<id>): everything about a lesson besides its text.
// Basics · Learning goals · Length & pace · Translations (+ their settings) · Practice & homework · Access · Publishing · History.
// Settings live in the lesson's data (data.meta), so they travel with the lesson.
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const I = (n, s = 15) => window.Icon ? Icon(n, s) : "";
  const st = document.createElement("style");
  st.textContent = `.la{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:start}
.la nav{display:flex;flex-direction:column;gap:2px;position:sticky;top:0}
.la nav button{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:9px;text-align:start;color:var(--mu);background:none;border:0;font:inherit;cursor:pointer}
.la nav button:hover{background:var(--p2);color:var(--tx)}.la nav button.on{background:var(--p3);color:var(--tx)}
.la section{background:var(--p1);border:1px solid var(--ln);border-radius:14px;padding:16px;margin-bottom:12px}
.la h2{font-size:15px;margin:0 0 10px;display:flex;align-items:center;gap:8px}
.la label{display:block;font-size:12px;color:var(--mu);margin:10px 0 4px}
.la .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.la .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.la .goal{display:flex;gap:6px;margin-bottom:6px}.la .goal input{flex:1}
.la .kv{display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--ln);font-size:13px}.la .kv:first-of-type{border:0}
.la .bar2{height:6px;border-radius:3px;background:var(--p3);overflow:hidden;margin-top:4px}.la .bar2 i{display:block;height:100%;background:var(--g)}
.la .tg{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--ln)}.la .tg:first-of-type{border:0}
.la .tg input{width:18px;height:18px;accent-color:#8B5CF6}
.la .seg2{display:inline-flex;background:var(--p2);border:1px solid var(--ln);border-radius:9px;padding:2px}.la .seg2 button{padding:4px 10px;border-radius:7px;background:none;border:0;color:var(--mu);font:inherit;cursor:pointer}.la .seg2 button.on{background:var(--p3);color:var(--tx)}
.la .chk{display:flex;align-items:center;gap:8px;padding:5px 0}.la .chk .ic{flex:none}
.tws{display:flex;flex-wrap:wrap;gap:6px}.twc{display:inline-flex;align-items:center;gap:4px;padding:3px 6px 3px 10px;border-radius:99px;border:1px dashed #FBBF24;font-weight:600}.twc button{background:none;border:0;color:var(--mu);cursor:pointer;display:grid;place-items:center}
.hwi{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--ln)}.hwi:first-child{border:0}.hwi .x{margin-inline-start:auto}.hwi small{color:var(--mu)}
.vprev{max-height:50vh;overflow:auto;font-size:13px;line-height:1.6}
@media (max-width:760px){html:not(.desk) .la{grid-template-columns:1fr}html:not(.desk) .la nav{flex-direction:row;overflow:auto}}`;
  document.head.append(st);

  const PARTS = [["basics", "settings", "Basics"], ["goals", "tasks", "Learning goals"], ["pace", "clock", "Length & pace"], ["tr", "translate", "Translations"], ["practice", "homework", "Practice & homework"], ["access", "lock", "Access"], ["publish", "send", "Publishing"], ["history", "history", "History"]];
  const meta = () => (S.L.data.meta = S.L.data.meta || {});
  const words = s => String(s || "").split(/\s+/).filter(Boolean);
  const all = () => S.L.data.scenes.flatMap(s => s.lines);
  const LANGS = { en: "English", fa: "فارسی", ru: "Русский", uk: "Українська" };
  const PRACTICE = [["say", "Say it (speaking)", "the learner says each line and gets a score"], ["cards", "Flashcards", "new words become cards"], ["gaps", "Fill the gaps", "missing words in the lines"], ["order", "Put in order", "the dialogue in the right order"], ["quiz", "Listening quiz", "questions about what was said"]];

  V.lesson = async () => {
    const L = S.L; if (!L) { location.hash = "home"; return; }
    bar(lessonCrumb ? lessonCrumb() : E(L.title), `<a class="btn" href="#script/${L.id}">✎ Script</a><a class="btn" href="#voice/${L.id}">〰 Voice desk</a>${L.status === "published" ? `<button class="btn" data-act="unpublishL">Take offline</button>` : `<button class="btn pr" data-act="publish">Publish</button>`}`);
    const p = S.lessonPart || "basics";
    $("#view").innerHTML = `<div class="la"><nav>${PARTS.map(([k, ic, l]) => `<button class="${p === k ? "on" : ""}" data-lp="${k}">${I(ic)}<span>${E(l)}</span></button>`).join("")}</nav><div id="lpBody"></div></div>`;
    draw(p);
  };
  function draw(p) {
    const L = S.L, m = meta(), b = $("#lpBody"); if (!b) return;
    const n = all().length, w = all().reduce((a, x) => a + words(x.de).length, 0), mins = Math.max(1, Math.round(w / 110 * 2 + n * .05));
    if (p === "basics") b.innerHTML = `<section><h2>${I("settings")} Basics</h2>
      <label>Title</label><input class="in de" id="lbTitle" value="${E(L.title)}" maxlength="80">
      <div class="g3"><div><label>Course</label><l-select id="lbCourse"></l-select></div><div><label>Level</label><l-select id="lbLevel"></l-select></div><div><label>Type</label><l-select id="lbType"></l-select></div></div>
      <div class="g2"><div><label>Topic</label><l-select id="lbTopic"></l-select></div><div><label>Series</label><input class="in" id="lbSeries" value="${E(L.series || "")}" maxlength="60"></div></div>
      <label>Brief · what happens, for whom</label><textarea class="in" id="lbBrief" rows="4">${E(L.brief || "")}</textarea>
      <div class="acts" style="justify-content:space-between;margin-top:12px"><button class="btn danger" data-act="settings">${I("trash", 14)} Delete…</button><button class="btn pr" data-lsave="basics">Save</button></div></section>`;
    if (p === "goals") b.innerHTML = `<section><h2>${I("tasks")} Learning goals</h2><div class="mu sm">What a learner can do after this lesson. Shown to learners and teachers.</div><div id="goals" style="margin-top:10px">${(m.goals || [""]).map((g, i) => `<div class="goal"><input class="in" data-goal="${i}" value="${E(g)}" placeholder="e.g. buy a train ticket" maxlength="120"><button class="btn sm" data-goaldel="${i}" aria-label="Remove">${I("x", 13)}</button></div>`).join("")}</div>
      <div class="acts"><button class="btn" data-goaladd>${I("plus", 14)} Goal</button>${S.scope.ai ? `<button class="btn" data-goalai>✦ Suggest from the text</button>` : ""}</div>
      <label>Target words · what learners should know after it</label><div class="tws">${(L.data.targets || []).map((w, i) => `<span class="twc">${E(w)}<button data-twdel="${i}" aria-label="Remove">${I("x", 11)}</button></span>`).join("") || `<span class="mu sm">None yet. Right-click a word in the script → Target word, or add one here.</span>`}</div>
      <div class="goal" style="margin-top:6px"><input class="in de" id="twNew" placeholder="Add a target word" maxlength="40"><button class="btn sm" data-twadd>${I("plus", 13)}</button></div>
      <label>Grammar it practises</label>${L.data.check && L.data.check.grammar && L.data.check.grammar.length ? `<div class="traits">${L.data.check.grammar.map(g => `<span>${E(g)}</span>`).join("")}</div>` : `<div class="mu sm">Run “Check level” in the script and the AI lists it here.</div>`}
      <label>Your own grammar notes</label><textarea class="in" id="grNote" rows="2" maxlength="300" placeholder="e.g. modal verbs: können, möchten">${E(m.grammarNote || "")}</textarea><div class="acts"><button class="btn" data-lsave="grammar">Save</button></div></section>`;
    if (p === "pace") b.innerHTML = `<section><h2>${I("clock")} Length & pace</h2>
      <div class="kv"><span>Scenes</span><b>${L.data.scenes.length}</b></div><div class="kv"><span>Lines</span><b>${n}</b></div><div class="kv"><span>Words</span><b>${w}</b></div><div class="kv"><span>About</span><b>${mins} min</b></div>
      <div class="kv"><span>Longest line</span><b>${Math.max(0, ...all().map(x => words(x.de).length))} words (≤ ${S.scope.maxWords[L.level]} for ${E(L.level)})</b></div>
      <label>Target length</label><div class="seg2" id="lpLen">${[["short", "Short · 2–4 min"], ["mid", "Medium · 5–8 min"], ["long", "Long · 10+ min"]].map(([k, l]) => `<button data-len="${k}" class="${(m.length || "mid") === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <label>Speaking pace for all voices</label><div class="seg2" id="lpPace">${[[0.8, "Slow"], [0.9, "Calm"], [0.95, "Normal"], [1, "Natural"]].map(([v, l]) => `<button data-pace="${v}" class="${(m.pace || 0.95) === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="mu sm" style="margin-top:8px">The pace applies to every speaker; one line can still have its own speed (right-click it → Voice).</div></section>`;
    if (p === "tr") {
      const miss = l => { let t = 0, h = 0; for (const s of L.data.scenes) { t++; if (s.title[l]) h++; for (const r of s.lines) { t++; if (r[l]) h++; } } for (const ph of L.data.phrases || []) { t++; if (ph[l]) h++; } return [h, t]; };
      b.innerHTML = `<section><h2>${I("translate")} Translations</h2>${Object.entries(LANGS).map(([k, l]) => { const [h, t] = miss(k), pc = t ? Math.round(h / t * 100) : 100; return `<div class="kv" style="display:block"><div style="display:flex;justify-content:space-between"><span>${l}</span><b>${pc}%</b></div><div class="bar2"><i style="width:${pc}%"></i></div></div>`; }).join("")}
        <div class="acts" style="margin-top:12px">${S.scope.ai ? `<button class="btn pr" data-act="translate">✦ Fill the missing ones</button>` : ""}<a class="btn" href="#script/${L.id}">Edit in the script</a></div></section>
        <section><h2>${I("settings")} Translation settings</h2>
        <label>Style</label><div class="seg2" id="trStyle">${[["natural", "Natural"], ["close", "Close to the original"], ["simple", "Simple words"]].map(([k, l]) => `<button data-trs="${k}" class="${(m.trStyle || "natural") === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <label>Shown under the lines while you write</label><div class="seg2" id="trShow">${Object.keys(LANGS).map(k => `<button data-trshow="${k}" class="${S.tr === k ? "on" : ""}">${k.toUpperCase()}</button>`).join("")}</div>
        <div class="tg"><span>Needed before publishing<div class="mu sm">a lesson can't go online while a translation is missing</div></span><input type="checkbox" id="trNeed" ${m.trRequired !== false ? "checked" : ""}></div>
        <label>Notes for translators (names, words to keep)</label><textarea class="in" id="trNote" rows="3" maxlength="400">${E(m.trNote || "")}</textarea><div class="acts"><button class="btn" data-lsave="tr">Save</button></div></section>`;
    }
    if (p === "practice") b.innerHTML = `<section><h2>${I("homework")} Practice & homework</h2><div class="mu sm">Exercises learners get from this lesson. Teachers can give them as homework.</div>
      ${PRACTICE.map(([k, l, d]) => `<div class="tg"><span>${E(l)}<div class="mu sm">${E(d)}</div></span><input type="checkbox" data-pr="${k}" ${(m.practice || { say: 1, cards: 1 })[k] ? "checked" : ""}></div>`).join("")}
      </section>${homeworkHtml()}`;
    if (p === "access") { b.innerHTML = `<section><h2>${I("lock")} Access</h2><div class="mu">Loading…</div></section>`; accessDraw(); }
    if (p === "publish") {
      const ok = all().filter(x => x.ok).length, trMiss = Object.keys(LANGS).some(k => all().some(r => !r[k]));
      const ck = (good, t) => `<div class="chk">${I(good ? "check" : "alert", 15)}<span style="color:${good ? "var(--gr)" : "var(--am)"}">${E(t)}</span></div>`;
      b.innerHTML = `<section><h2>${I("send")} Publishing</h2><div class="kv"><span>Status</span><b>${E({ draft: "draft", review: "in work", published: "published" }[L.status] || L.status)}</b></div>
        ${ck(n > 0, n ? `${n} lines written` : "No text yet")}${ck(ok === n && n > 0, `${ok} of ${n} lines approved`)}${ck(!trMiss, trMiss ? "Some translations are missing" : "Translations complete")}${ck(L.audio === "ready", { ready: "Audio up to date", old: "Audio is older than the text", none: "No audio yet" }[L.audio] || "")}
        <div class="acts" style="margin-top:12px">${L.status === "published" ? `<button class="btn" data-act="unpublishL">Take offline</button>` : `<button class="btn pr" data-act="publish">Publish now</button>`}<a class="btn" href="#voice/${L.id}">〰 Make the audio</a></div></section>`;
    }
    if (p === "history") {
      const t = x => x ? new Date(x).toLocaleString(window.PanelI18N ? PanelI18N.locale : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
      b.innerHTML = `<section><h2>${I("history")} History</h2><div class="kv"><span>Version now</span><b>${E(L.rev)}</b></div><div class="kv"><span>Last change</span><b>${t(L.updated_at)}</b></div><div class="kv"><span>Published</span><b>${t(L.published_at)}</b></div></section><section><h2>${I("undo")} Earlier versions</h2><div class="mu sm">Kept before every change by the AI and at most every 10 minutes while you write (the last 40). Go back to any of them; the current one is kept too.</div><div id="vers" style="margin-top:8px"><div class="mu">Loading…</div></div></section>`;
      api("GET", `/lessons/${L.id}/versions`).then(r => { const el = $("#vers"); if (!el) return; el.innerHTML = r.versions.map(v => `<div class="kv" style="align-items:center"><span>${I(v.ai ? "ai" : "edit", 14)} <b>${E(v.note || "edited")}</b><br><small class="mu">version ${v.rev} · ${t(v.at)}${v.by ? " · " + E(v.by) : ""}</small></span><span style="display:flex;gap:6px"><button class="btn sm" data-vlook="${v.id}">Look</button><button class="btn sm" data-vback="${v.id}">Go back to it</button></span></div>`).join("") || `<div class="mu">No earlier versions yet.</div>`; }).catch(x => { const el = $("#vers"); if (el) el.textContent = x.message; });
    }
    if (p === "basics") { opts($("#lbCourse"), courseOpts(), L.course); opts($("#lbLevel"), levelOpts(), L.level); opts($("#lbType"), typeOpts(), L.type); opts($("#lbTopic"), topicOpts(), L.topic); }
  }
  const saveMeta = () => { changed(); toast("Saved"); };
  document.addEventListener("click", async e => {
    if (!S.L || !$(".la")) return;
    const t = e.target;
    const lp = t.closest("[data-lp]"); if (lp) { S.lessonPart = lp.dataset.lp; $$(".la nav button").forEach(x => x.classList.toggle("on", x === lp)); draw(lp.dataset.lp); if (window.LAPPFrame) LAPPFrame.sync(); return; }
    const sv = t.closest("[data-lsave]"); if (sv) {
      if (sv.dataset.lsave === "basics") { const f = { title: $("#lbTitle").value.trim(), course: $("#lbCourse").value, level: $("#lbLevel").value, type: $("#lbType").value, topic: $("#lbTopic").value, series: $("#lbSeries").value.trim(), brief: $("#lbBrief").value }; if (!f.title) return toast("The lesson needs a title"); await flush(); try { const r = await api("PUT", `/lessons/${S.L.id}`, { rev: S.L.rev, ...f }); Object.assign(S.L, f, { rev: r.rev }); toast("Saved"); show(); } catch (x) { toast(x.message); } }
      if (sv.dataset.lsave === "tr") { meta().trNote = $("#trNote").value.slice(0, 400); saveMeta(); }
      if (sv.dataset.lsave === "grammar") { meta().grammarNote = $("#grNote").value.slice(0, 300); saveMeta(); }
      if (sv.dataset.lsave === "hw") { const h = hw(); h.write = $("#hwWrite").value.slice(0, 1000); h.due = +$("#hwDue").value || 3; saveMeta(); }
      return;
    }
    const m = meta();
    if (t.closest("[data-twadd]")) { const v = ($("#twNew").value || "").trim().toLowerCase(); if (!v) return; const tg = S.L.data.targets = S.L.data.targets || []; if (!tg.includes(v)) tg.push(v); saveMeta(); draw("goals"); return; }
    const twd = t.closest("[data-twdel]"); if (twd) { S.L.data.targets.splice(+twd.dataset.twdel, 1); saveMeta(); draw("goals"); return; }
    if (t.closest("[data-hwmake]")) { hw().quiz = makeQuiz(); saveMeta(); draw("practice"); return; }
    const hd = t.closest("[data-hwdel]"); if (hd) { hw().quiz.splice(+hd.dataset.hwdel, 1); saveMeta(); draw("practice"); return; }
    if (t.closest("[data-hwgive]")) return giveHomework();
    const vl = t.closest("[data-vlook]"); if (vl) { const r = await api("GET", `/lessons/${S.L.id}/versions/${vl.dataset.vlook}`); const d = r.version.data; form(`Version ${r.version.rev} · ${r.version.note || ""}`, `<div class="vprev">${(d.scenes || []).map(s => `<b>${E(s.title && s.title.de || "")}</b><br>${s.lines.map(x => `<span class="mu">${E(x.who)}:</span> ${E(x.de)}`).join("<br>")}`).join("<br><br>") || "—"}</div>`, async () => {}, "Close"); return; }
    const vb = t.closest("[data-vback]"); if (vb) { if (!confirm("Go back to this version? The current text is kept as a version too.")) return; await flush(); try { const r = await api("POST", `/lessons/${S.L.id}/versions/${vb.dataset.vback}/restore`); S.L.data = r.data; S.L.rev = r.rev; toast("Back to the earlier version"); draw("history"); } catch (x) { toast(x.message); } return; }
    if (t.closest("[data-goaladd]")) { m.goals = [...(m.goals || []).filter(Boolean), ""]; draw("goals"); $$("[data-goal]").pop()?.focus(); return; }
    const gd = t.closest("[data-goaldel]"); if (gd) { m.goals = (m.goals || []).filter((_, i) => i !== +gd.dataset.goaldel); saveMeta(); draw("goals"); return; }
    if (t.closest("[data-goalai]")) { const lines = all().slice(0, 30).map(x => x.de).join(" / "); if (window.LAPPFrame && LAPPFrame.embed) LAPPFrame.up({ t: "ask", text: `Suggest 3 short learning goals (can-do statements, ${S.L.level}) for this lesson “${S.L.title}”: ${lines}` }); return; }
    const ln = t.closest("[data-len]"); if (ln) { m.length = ln.dataset.len; saveMeta(); draw("pace"); return; }
    const pc = t.closest("[data-pace]"); if (pc) { m.pace = +pc.dataset.pace; Object.values(S.L.data.cast).forEach(c => c.speed = m.pace); saveMeta(); draw("pace"); return; }
    const ts = t.closest("[data-trs]"); if (ts) { m.trStyle = ts.dataset.trs; saveMeta(); draw("tr"); return; }
    const tsh = t.closest("[data-trshow]"); if (tsh) { S.tr = tsh.dataset.trshow; try { localStorage.setItem("lapp.studio.tr", S.tr); } catch {} draw("tr"); return; }
    const ac = t.closest("[data-acc]"); if (ac) { try { const r = await api("PUT", `/lessons/${S.L.id}`, { rev: S.L.rev, access: ac.dataset.acc }); S.L.rev = r.rev; S.L.access_own = ac.dataset.acc === "plus" ? "plus" : ""; toast("Saved"); accessDraw(); } catch (x) { toast(x.message); } return; }
  });
  document.addEventListener("change", e => {
    if (!S.L || !$(".la")) return; const t = e.target, m = meta();
    if (t.matches("[data-goal]")) { m.goals = m.goals || []; m.goals[+t.dataset.goal] = t.value.trim().slice(0, 120); m.goals = m.goals.filter((g, i, a) => g || i === a.length - 1); saveMeta(); }
    if (t.matches("[data-pr]")) { m.practice = { ...(m.practice || { say: 1, cards: 1 }), [t.dataset.pr]: t.checked ? 1 : 0 }; saveMeta(); }
    if (t.matches("[data-hwspeak]")) { const h = hw(), i = +t.dataset.hwspeak; h.speak = t.checked ? [...new Set([...(h.speak || []), i])].sort((a, b) => a - b) : (h.speak || []).filter(x => x !== i); saveMeta(); }
    if (t.id === "trNeed") { m.trRequired = t.checked; saveMeta(); }
  });
  /* ---------- homework inside the lesson: a quiz made from the lines, lines to say, a writing task ---------- */
  const hw = () => (meta().homework = meta().homework || { quiz: [], speak: [], write: "", due: 3 });
  function makeQuiz() {
    const lang = TRL.includes(S.tr) ? S.tr : "en", L = all().filter(r => r[lang] || r.en), out = [], tr = r => r[lang] || r.en;
    // meaning questions: the right translation among three others
    for (const r of L.slice(0, 6)) { const others = L.filter(x => x !== r).map(tr).sort(() => Math.random() - .5).slice(0, 3); out.push({ q: `What does “${r.de}” mean?`, options: [tr(r), ...others].sort(() => Math.random() - .5), answer: tr(r) }); }
    // gap questions with the target words
    const tg = (S.L.data.targets || []).filter(Boolean);
    for (const w of tg.slice(0, 4)) { const r = all().find(x => x.de.toLowerCase().includes(w)); if (!r) continue; const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), word = (r.de.match(re) || [w])[0]; const pool = tg.filter(x => x !== w).slice(0, 3); while (pool.length < 3) { const x = (all()[Math.floor(Math.random() * all().length)] || { de: "" }).de.split(/\s+/)[0]; if (x && !pool.includes(x)) pool.push(x.toLowerCase()); else break; } out.push({ q: r.de.replace(re, "____"), options: [word, ...pool].sort(() => Math.random() - .5), answer: word }); }
    return out;
  }
  function homeworkHtml() {
    const h = hw(), rs = all();
    return `<section><h2>${I("homework")} Homework in this lesson</h2><div class="mu sm">Part of the lesson: teachers give it to a class in one click; it's due a few days after the class.</div>
      <label>${I("tasks", 13)} Quiz · ${h.quiz.length} questions</label>${h.quiz.map((q, i) => `<div class="hwi"><span>${E(q.q)}<br><small>${q.options.map(o => o === q.answer ? `<b>✓ ${E(o)}</b>` : E(o)).join(" · ")}</small></span><button class="btn sm x" data-hwdel="${i}" aria-label="Remove">${I("x", 12)}</button></div>`).join("")}
      <div class="acts"><button class="btn" data-hwmake>${I("wand", 14)} ${h.quiz.length ? "Make again" : "Make from the lines"}</button></div>
      <label>${I("mic", 13)} Say it · lines to record</label><div style="max-height:180px;overflow:auto">${rs.map((r, i) => `<label class="tg" style="margin:0;padding:5px 0"><span class="de">${E(r.who)}: ${E(r.de)}</span><input type="checkbox" data-hwspeak="${i}" ${(h.speak || []).includes(i) ? "checked" : ""}></label>`).join("") || `<span class="mu sm">No lines yet.</span>`}</div>
      <label>${I("pen", 13)} Writing task</label><textarea class="in" id="hwWrite" rows="2" maxlength="1000" placeholder="e.g. Write 3 sentences: you buy a ticket at the station.">${E(h.write || "")}</textarea>
      <label>Due</label><select class="in" id="hwDue" style="width:auto">${[1, 2, 3, 5, 7, 14].map(d => `<option value="${d}" ${(h.due || 3) === d ? "selected" : ""}>${d} day${d > 1 ? "s" : ""} after class</option>`).join("")}</select>
      <div class="acts" style="margin-top:10px"><button class="btn" data-lsave="hw">Save</button>${S.scope.kind === "school" ? `<button class="btn pr" data-hwgive>${I("send", 14)} Give to a class…</button>` : `<span class="mu sm" style="align-self:center">Schools give it to their classes.</span>`}</div></section>`;
  }
  async function giveHomework() {
    const h = hw(); if ($("#hwWrite")) { h.write = $("#hwWrite").value.slice(0, 1000); h.due = +$("#hwDue").value || 3; changed(); }
    if (!h.quiz.length && !(h.speak || []).length && !h.write) return toast("Make the homework first");
    const slug = S.scope.slug, r = await fetch(`/api/org/${slug}/classes`, { credentials: "same-origin" }).then(x => x.json()).catch(() => ({ classes: [] }));
    const ks = r.classes || []; if (!ks.length) return toast("You have no classes yet");
    form("Give the homework to a class", `<label>Class</label><l-select name="cls" id="hwCls"></l-select><div class="mu sm" style="margin-top:6px">${[h.quiz.length && `quiz (${h.quiz.length})`, (h.speak || []).length && `say ${(h.speak || []).length} lines`, h.write && "writing"].filter(Boolean).join(" · ")} · due in ${h.due || 3} days</div>`, async f => {
      const due = Date.now() + (h.due || 3) * 864e5, post = b => fetch(`/api/org/${slug}/assignments`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-LAPP": "1" }, body: JSON.stringify({ classId: +f.cls, dueAt: due, ...b }) }).then(async x => { if (!x.ok) throw new Error((await x.json().catch(() => ({}))).error || "not given"); });
      const t = S.L.title, rs = all();
      if (h.quiz.length) await post({ kind: "quiz", title: `${t} · quiz`, items: h.quiz });
      if ((h.speak || []).length) await post({ kind: "speak", title: `${t} · say it`, instructions: h.speak.map(i => rs[i] ? `${rs[i].who}: ${rs[i].de}` : "").filter(Boolean).join("\n") });
      if (h.write) await post({ kind: "write", title: `${t} · writing`, instructions: h.write });
      toast("Given to the class");
    }, "Give");
    opts($("#hwCls"), ks.map(k => ({ value: String(k.id), label: k.name })), String(ks[0].id));
  }

  /* ---------- access: the folder's rule, and the lesson's own (only stricter) ---------- */
  async function accessDraw() {
    const b = $("#lpBody"), L = S.L; if (!b) return;
    if (S.scope.kind !== "lapp") { b.innerHTML = `<section><h2>${I("lock")} Access</h2><div class="mu">Lessons of a school are for the school's own classes and students.</div></section>`; return; }
    let rule = ""; try { const d = await api("GET", "/drive"); const F = new Map(d.folders.map(f => [f.id, f])); for (let x = F.get(L.folder), i = 0; x && i < 40 && !rule; x = F.get(x.parent), i++) rule = (x.rules || {}).access || ""; } catch {}
    const folderPlus = rule === "plus", own = L.access_own || "", eff = folderPlus || own === "plus" ? "plus" : "free";
    if (!$("#lpBody")) return;
    $("#lpBody").innerHTML = `<section><h2>${I("lock")} Access</h2><div class="kv"><span>From its folder</span><b>${rule ? (folderPlus ? "Plus members" : "Everyone (free)") : "no rule"}</b></div><div class="kv"><span>Who can open it now</span><b>${eff === "plus" ? "Plus members" : "Everyone (free)"}</b></div>
      <label>This lesson</label><div class="seg2">${[["free", "As its folder" + (folderPlus ? " (Plus)" : " (free)")], ["plus", "Plus members only"]].map(([k, l]) => `<button data-acc="${k}" class="${(own === "plus" ? "plus" : "free") === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="mu sm" style="margin-top:8px">A lesson can be stricter than its folder, never more open: in a Plus folder it stays Plus.</div></section>`;
  }

  ACT.unpublishL = async () => { try { await api("POST", `/lessons/${S.L.id}/unpublish`); S.L.status = "review"; toast("Taken offline"); show(); } catch (x) { toast(x.message); } };
})();
