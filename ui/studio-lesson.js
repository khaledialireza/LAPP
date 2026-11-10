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
      ${L.data.check && L.data.check.grammar && L.data.check.grammar.length ? `<label>Grammar it practises (from the level check)</label><div class="traits">${L.data.check.grammar.map(g => `<span>${E(g)}</span>`).join("")}</div>` : ""}</section>`;
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
      <div class="tg"><span>Homework when a class finishes this lesson<div class="mu sm">schools only: it's added to the class's homework automatically</div></span><input type="checkbox" id="prHw" ${m.autoHomework ? "checked" : ""}></div></section>`;
    if (p === "access") b.innerHTML = `<section><h2>${I("lock")} Access</h2>${S.scope.kind === "lapp" ? `<label>Who can open it</label><div class="seg2" id="acc">${[["free", "Everyone (free)"], ["plus", "Plus members"]].map(([k, l]) => `<button data-acc="${k}" class="${(L.access_own || (L.access === "plus" ? "plus" : "free")) === k || L.access === k ? "on" : ""}">${l}</button>`).join("")}</div><div class="mu sm" style="margin-top:8px">A folder's rule (in the Lesson library) can decide this for every lesson inside it.</div>` : `<div class="mu">Lessons of a school are for the school's own classes and students.</div>`}</section>`;
    if (p === "publish") {
      const ok = all().filter(x => x.ok).length, trMiss = Object.keys(LANGS).some(k => all().some(r => !r[k]));
      const ck = (good, t) => `<div class="chk">${I(good ? "check" : "alert", 15)}<span style="color:${good ? "var(--gr)" : "var(--am)"}">${E(t)}</span></div>`;
      b.innerHTML = `<section><h2>${I("send")} Publishing</h2><div class="kv"><span>Status</span><b>${E({ draft: "draft", review: "in work", published: "published" }[L.status] || L.status)}</b></div>
        ${ck(n > 0, n ? `${n} lines written` : "No text yet")}${ck(ok === n && n > 0, `${ok} of ${n} lines approved`)}${ck(!trMiss, trMiss ? "Some translations are missing" : "Translations complete")}${ck(L.audio === "ready", { ready: "Audio up to date", old: "Audio is older than the text", none: "No audio yet" }[L.audio] || "")}
        <div class="acts" style="margin-top:12px">${L.status === "published" ? `<button class="btn" data-act="unpublishL">Take offline</button>` : `<button class="btn pr" data-act="publish">Publish now</button>`}<a class="btn" href="#voice/${L.id}">〰 Make the audio</a></div></section>`;
    }
    if (p === "history") {
      const t = x => x ? new Date(x).toLocaleString(window.PanelI18N ? PanelI18N.locale : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
      b.innerHTML = `<section><h2>${I("history")} History</h2><div class="kv"><span>Version</span><b>${E(L.rev)}</b></div><div class="kv"><span>Last change</span><b>${t(L.updated_at)}</b></div><div class="kv"><span>Published</span><b>${t(L.published_at)}</b></div><div class="kv"><span>Audio made for version</span><b>${E(L.audioRev || "—")}</b></div><div class="mu sm" style="margin-top:8px">Every save makes a new version. A full change log with restore comes with the project files.</div></section>`;
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
      return;
    }
    const m = meta();
    if (t.closest("[data-goaladd]")) { m.goals = [...(m.goals || []).filter(Boolean), ""]; draw("goals"); $$("[data-goal]").pop()?.focus(); return; }
    const gd = t.closest("[data-goaldel]"); if (gd) { m.goals = (m.goals || []).filter((_, i) => i !== +gd.dataset.goaldel); saveMeta(); draw("goals"); return; }
    if (t.closest("[data-goalai]")) { const lines = all().slice(0, 30).map(x => x.de).join(" / "); if (window.LAPPFrame && LAPPFrame.embed) LAPPFrame.up({ t: "ask", text: `Suggest 3 short learning goals (can-do statements, ${S.L.level}) for this lesson “${S.L.title}”: ${lines}` }); return; }
    const ln = t.closest("[data-len]"); if (ln) { m.length = ln.dataset.len; saveMeta(); draw("pace"); return; }
    const pc = t.closest("[data-pace]"); if (pc) { m.pace = +pc.dataset.pace; Object.values(S.L.data.cast).forEach(c => c.speed = m.pace); saveMeta(); draw("pace"); return; }
    const ts = t.closest("[data-trs]"); if (ts) { m.trStyle = ts.dataset.trs; saveMeta(); draw("tr"); return; }
    const tsh = t.closest("[data-trshow]"); if (tsh) { S.tr = tsh.dataset.trshow; draw("tr"); return; }
    const ac = t.closest("[data-acc]"); if (ac) { try { const r = await api("PUT", `/lessons/${S.L.id}`, { rev: S.L.rev, access: ac.dataset.acc }); S.L.rev = r.rev; S.L.access_own = ac.dataset.acc === "plus" ? "plus" : ""; S.L.access = ac.dataset.acc; toast("Saved"); draw("access"); } catch (x) { toast(x.message); } return; }
  });
  document.addEventListener("change", e => {
    if (!S.L || !$(".la")) return; const t = e.target, m = meta();
    if (t.matches("[data-goal]")) { m.goals = m.goals || []; m.goals[+t.dataset.goal] = t.value.trim().slice(0, 120); m.goals = m.goals.filter((g, i, a) => g || i === a.length - 1); saveMeta(); }
    if (t.matches("[data-pr]")) { m.practice = { ...(m.practice || { say: 1, cards: 1 }), [t.dataset.pr]: t.checked ? 1 : 0 }; saveMeta(); }
    if (t.id === "prHw") { m.autoHomework = t.checked; saveMeta(); }
    if (t.id === "trNeed") { m.trRequired = t.checked; saveMeta(); }
  });
  ACT.unpublishL = async () => { try { await api("POST", `/lessons/${S.L.id}/unpublish`); S.L.status = "review"; toast("Taken offline"); show(); } catch (x) { toast(x.message); } };
})();
