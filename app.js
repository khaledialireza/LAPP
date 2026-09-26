(() => {
  if (location.protocol === "http:" && /(^|\.)khaledi\.eu$/.test(location.hostname)) {
    fetch("https://" + location.host + "/CNAME", { mode: "no-cors", cache: "no-store" })
      .then(() => location.replace("https://" + location.host + location.pathname + location.search + location.hash))
      .catch(() => {});
  }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const LESSONS = window.LESSONS || [];
  const SPEEDS = [0.75, 0.9, 1, 1.1, 1.25];

  const store = {
    get(k, d) { try { const v = localStorage.getItem("lapp:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("lapp:" + k, JSON.stringify(v)); } catch {} }
  };

  const state = {
    idx: Math.min(store.get("lesson", 0), LESSONS.length - 1),
    speed: 2,
    known: new Set(store.get("known", [])),
    spk: "all",
    vf: "all"
  };
  const player = $("#player");
  let lines = [], timed = false;
  // seconds where a line starts: real timings if present, else proportional estimate
  const lineStart = l => timed ? l.t0 : l.start * (player.duration || 0);
  const lineAt = t => timed ? lines.findIndex(l => t < l.next) : lines.findIndex(l => t / (player.duration || 1) < l.end);

  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = t => isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}` : "0:00";
  const SAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg>';
  const PLAY = '<path d="M7 5v14l12-7z"/>', PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200);
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return toast(t("noTts"));
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*"]/g, ""));
    u.lang = "de-DE"; u.rate = SPEEDS[state.speed] * 0.95;
    const v = speechSynthesis.getVoices().find(v => v.lang.startsWith("de"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  /* ---------- Navigation ---------- */
  function go(id) {
    $$(".screen").forEach(s => s.classList.toggle("active", s.id === id));
    // the lesson page opens from the home tile, so home stays lit
    const tab = id === "lesson" ? "home" : id;
    $$(".nav button").forEach(b => b.classList.toggle("on", b.dataset.go === tab));
    document.body.dataset.screen = id;
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    if (id === "practice" && typeof renderHub === "function" && !$("#pHub").hidden) renderHub();
    const on = $(".nav button.on");
    if (on) $("#dockTabsBtn").innerHTML = on.querySelector("svg").outerHTML;
  }
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go);
    const a = e.target.closest("[data-act]"); if (a) act(a.dataset.act);
    const l = e.target.closest("[data-lesson]"); if (l) setLesson(state.idx + Number(l.dataset.lesson));
    const sp = e.target.closest("[data-speed]"); if (sp) setSpeed(state.speed + Number(sp.dataset.speed));
    if (e.target.closest("[data-speed-cycle]")) setSpeed((state.speed + 1) % SPEEDS.length);
    const s = e.target.closest("[data-say]"); if (s) { e.stopPropagation(); speak(s.dataset.say); }
  });

  /* ---------- Lesson picker (top-left) ---------- */
  const setMenu = open => { $("#lpMenu").hidden = !open; $("#lpBtn").setAttribute("aria-expanded", open); };
  $("#lpBtn").addEventListener("click", e => { e.stopPropagation(); setMenu($("#lpMenu").hidden); });
  $("#lpMenu").addEventListener("click", e => {
    const b = e.target.closest("[data-pick]"); if (!b) return;
    setLesson(Number(b.dataset.pick)); setMenu(false);
  });
  document.addEventListener("click", e => { if (!e.target.closest("#lpMenu")) setMenu(false); });

  /* ---------- Clock ---------- */
  function tick() {
    const d = new Date();
    const t = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const h = d.getHours();
    $("#hGreet").textContent = h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 17 ? "Guten Tag" : h < 22 ? "Guten Abend" : "Gute Nacht";
    $("#homeDate").textContent = d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
  }

  /* ---------- Lesson ---------- */
  function parseTranscript(raw) {
    return raw.split("\n").map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^\*\*(.+?):\*\*\s*(.*)$/);
      return m ? { who: m[1], text: m[2] } : { who: "", text: s };
    });
  }

  // lesson texts in the interface language (Persian lives in lessons.js / lesson1-fa.js)
  function lessonTr(L) {
    const lang = window.I18N ? I18N.lang : "fa", tr = L.tr && L.tr[lang];
    if (lang === "fa" || !tr) return { title: L.fa, summary: L.summary, phrases: L.phrases.map(p => p[1]), notes: L.phrases.map(p => p[2]), lines: L.transcriptFa || [] };
    return { title: tr.title, summary: tr.summary, phrases: tr.phrases, notes: tr.phraseNotes || [], lines: tr.lines };
  }
  function setLesson(i) {
    if (i < 0 || i >= LESSONS.length) return toast(t("moreLessonsSoon"));
    state.idx = i; store.set("lesson", i);
    const L = LESSONS[i];
    $$(".js-lesson-num").forEach(e => e.textContent = "L" + L.id);
    $("#lpName").textContent = L.title;
    $("#lpMenu").innerHTML = LESSONS.map((x, j) => `<button role="option" aria-selected="${j === i}" data-pick="${j}">
      <b>L${x.id}</b><span>${esc(x.title)}</span><span class="fa">${esc(x.fa)}</span></button>`).join("");
    const TR = lessonTr(L);
    $("#hLessonTitle").textContent = L.title; $("#hLessonFa").textContent = TR.title; $("#hLevel").textContent = L.level;
    $("#lTitle").innerHTML = `Lektion ${L.id} <small>${esc(L.title)}</small>`;
    $("#lLevel").textContent = L.level; $("#lDe").textContent = L.title; $("#lSum").textContent = TR.summary;
    $("#lessonList").innerHTML = LESSONS.map((x, j) => `<button class="chip" style="${j === i ? "background:var(--accent);color:#1b1024" : ""}" data-lesson="${j - i}">L${x.id}</button>`).join("");
    $("#phrases").innerHTML = L.phrases.map(([de], pi) => [de, TR.phrases[pi] || "", TR.notes[pi] || ""]).map(([de, fa, note]) => `
      <div class="phrase"><button class="say" data-say="${esc(de)}">${SAY_ICON}</button>
      <span class="de">${esc(de)}</span><span class="fa">${esc(fa)}</span><span class="note fa">${esc(note)}</span></div>`).join("");

    // transcript
    lines = parseTranscript(L.transcript);
    lines.forEach((l, j) => l.fa = TR.lines[j] || "");
    timed = Array.isArray(L.timings) && L.timings.length === lines.length;
    // timings: [start, end] per line (or older format: start only, ends at the next line)
    if (timed) lines.forEach((l, j) => {
      const t = L.timings[j];
      if (Array.isArray(t)) { l.t0 = t[0]; l.t1 = t[1]; l.next = (L.timings[j + 1] || [Infinity])[0]; }
      else { l.t0 = t; l.t1 = L.timings[j + 1] ?? Infinity; l.next = l.t1; }
    });
    const total = lines.reduce((n, l) => n + l.text.length, 0);
    let acc = 0;
    lines.forEach(l => { l.start = acc / total; acc += l.text.length; l.end = acc / total; });
    $("#mTranscript").innerHTML = lines.map((l, j) => `
      <div class="ly-line ${l.who.toLowerCase()}" data-i="${j}"><span class="ly-who">${esc(l.who)}</span>
      <div class="ly-de">${esc(l.text)}</div><div class="ly-fa fa">${esc(l.fa || "")}</div></div>`).join("");
    filterSpeakers();

    // audio
    player.src = L.audio; player.playbackRate = SPEEDS[state.speed];
    showNow(0);

    buildVocab(); buildPractice(); renderVocab(); renderProgress(); renderWotd();
  }

  let curLine = 0;
  const cleanWord = tok => tok.replace(/^[^A-Za-zÄÖÜäöüß]+|[^A-Za-zÄÖÜäöüß'-]+$/g, "");
  const wordHtml = text => text.split(/(\s+)/).map(tok => {
    const w = cleanWord(tok);
    if (!w) return esc(tok);
    const k = tok.indexOf(w);
    return `${esc(tok.slice(0, k))}<button class="w" data-w="${esc(w)}">${esc(w)}</button>${esc(tok.slice(k + w.length))}`;
  }).join("");

  // lyrics view: the current line is big, its words are tappable and fill as they are spoken
  let followPause = 0;
  function showNow(i) {
    const prev = $(`#mTranscript .ly-line[data-i="${curLine}"]`);
    if (prev && curLine !== i) { prev.classList.remove("cur"); prev.querySelector(".ly-de").textContent = lines[curLine]?.text || ""; }
    curLine = i;
    const l = lines[i], row = $(`#mTranscript .ly-line[data-i="${i}"]`);
    $("#mNum").textContent = l ? `${i + 1} / ${lines.length}` : "";
    if (row && l) {
      row.classList.add("cur"); row.querySelector(".ly-de").innerHTML = wordHtml(l.text);
      const box = $("#mTranscript");
      if (Date.now() > followPause && box.clientHeight) box.scrollTo({ top: row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2, behavior: "smooth" });
    }
    $("#dpLine").textContent = l ? l.text : "";
    $("#dpWho").textContent = l ? l.who : "";
  }
  // words of the current line light up with the audio (spread over the line by length)
  function singWords(t) {
    const l = lines[curLine]; if (!l || !isFinite(l.t1)) return;
    const f = Math.max(0, Math.min(1, (t - l.t0) / Math.max(0.3, l.t1 - l.t0)));
    const ws = $$(`#mTranscript .ly-line.cur .w`); let tot = 0; ws.forEach(w => tot += w.textContent.length + 1);
    let acc = 0; ws.forEach(w => { acc += w.textContent.length + 1; w.classList.toggle("sung", acc / tot <= f + 0.02); });
  }
  ["touchstart", "wheel"].forEach(ev => $("#mTranscript").addEventListener(ev, () => { followPause = Date.now() + 4000; }, { passive: true }));
  $("#mTranscript").addEventListener("click", e => {
    const row = e.target.closest(".ly-line"); if (!row) return;
    const w = e.target.closest(".w");
    if (w && row.classList.contains("cur")) { if (!player.paused) player.pause(); openWord(w.dataset.w); return; }
    const i = Number(row.dataset.i), l = lines[i];
    followPause = 0; showNow(i);
    if (player.duration) { player.currentTime = lineStart(l); player.play(); }
    else speak(l.text);
  });
  $("#lyRepeat").onclick = () => { unlockAudio(); playClip(curLine); };
  $("#mSpkTabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.spk = b.dataset.spk; $$("#mSpkTabs button").forEach(x => x.classList.toggle("on", x === b)); filterSpeakers();
  });
  function filterSpeakers() {
    $$("#mTranscript .ly-line").forEach(r => r.classList.toggle("hide", state.spk !== "all" && !r.classList.contains(state.spk)));
  }

  /* ---------- Audio ---------- */
  function act(a) {
    if (a === "toggle") {
      if (!player.src || player.error) return toast(t("noAudio"));
      player.paused ? player.play().catch(() => toast(t("playFailed"))) : player.pause();
    }
    if (a === "back10") player.currentTime = Math.max(0, player.currentTime - 10);
    if (a === "fwd10") player.currentTime = Math.min(player.duration || 0, player.currentTime + 10);
    if (a === "prev" || a === "next") {
      const j = Math.max(0, Math.min(lines.length - 1, curLine + (a === "next" ? 1 : -1)));
      showNow(j);
      if (player.duration) player.currentTime = lineStart(lines[j]);
    }
  }
  function setSpeed(i) {
    state.speed = Math.max(0, Math.min(SPEEDS.length - 1, i));
    player.playbackRate = SPEEDS[state.speed];
    const label = SPEEDS[state.speed].toFixed(2).replace(/0$/, "") + "×";
    $$(".js-speed").forEach(e => e.textContent = label);
  }
  const setIcons = () => $$(".ico-play").forEach(s => s.innerHTML = player.paused ? PLAY : PAUSE);
  player.addEventListener("play", setIcons);
  player.addEventListener("pause", setIcons);
  player.addEventListener("loadedmetadata", () => $$(".tDur").forEach(e => e.textContent = fmt(player.duration)));
  player.addEventListener("error", () => toast(t("audioMissing")));
  let lastLine = -1;
  player.addEventListener("timeupdate", () => {
    const p = player.currentTime / (player.duration || 1);
    $$(".bar").forEach(b => b.style.width = p * 100 + "%");
    $$(".ring-fg").forEach(c => c.style.strokeDasharray = `${p * 100} 100`);
    $$(".tCur").forEach(e => e.textContent = fmt(player.currentTime));
    const i = lineAt(player.currentTime);
    if (i !== lastLine && i >= 0) {
      lastLine = i;
      showNow(i);
    }
    singWords(player.currentTime);
  });
  $$("[data-seek]").forEach(bar => bar.addEventListener("click", e => {
    if (!player.duration) return;
    const r = bar.getBoundingClientRect();
    player.currentTime = ((e.clientX - r.left) / r.width) * player.duration;
  }));

  /* ---------- Vocab: every word of the lesson ---------- */
  let vocabList = [];
  const ARTICLE = { "اسم مذکر": "der ", "اسم مؤنث": "die ", "اسم خنثی": "das ", "اسم جمع": "die " };
  const vocabEntry = k => { const d = DICT[k]; return d && { key: k, de: (ARTICLE[d.p] || "") + k.replace(/_.*/, ""), p: d.p, fa: d.fa, g: d.g }; };
  // lesson dictionary = keys into the one global dictionary (no duplicated entries)
  function lessonKeys(L, lessonLines) {
    if (Array.isArray(L.words)) return L.words.filter(k => DICT[k]);
    const keys = [];
    lessonLines.forEach(l => l.text.split(/\s+/).forEach(tok => {
      const k = dictKey(cleanWord(tok));
      if (k && DICT[k].p && DICT[k].p !== "انگلیسی" && !keys.includes(k)) keys.push(k);
    }));
    return keys;
  }
  function buildVocab() {
    const L = LESSONS[state.idx];
    const keys = state.vscope === "all"
      ? [...new Set(LESSONS.flatMap(x => x === L ? lessonKeys(x, lines) : (x.words || [])))]
      : lessonKeys(L, lines);
    vocabList = keys.map(vocabEntry).filter(Boolean);
  }
  /* Dictionary: every word with its status (new → seen → practising → known),
     gender colour for nouns and its word type. */
  const POSG = [["N", "Nomen", "Nomen"], ["V", "Verben", "Verb"], ["A", "Adjektive", "Adj."], ["Adv", "Adverbien", "Adv."], ["Pro", "Pronomen", "Pron."],
    ["Pr", "Präpositionen", "Präp."], ["K", "Konjunktionen", "Konj."], ["F", "Fragewörter", "Frage"], ["X", "Andere", "Andere"]];
  const wordType = p => !p ? "X" : p.startsWith("اسم") ? "N" : p.includes("فعل") ? "V" : p.startsWith("صفت") ? "A" : p.startsWith("قید") ? "Adv"
    : /ضمیر|حرف تعریف/.test(p) ? "Pro" : p.startsWith("حرف اضافه") ? "Pr" : p.startsWith("حرف ربط") ? "K" : p.startsWith("کلمهٔ پرسشی") ? "F" : "X";
  const seenMap = () => store.get("seen", {});
  function markSeen(key) { if (!key) return; const m = seenMap(); m[key] = (m[key] || 0) + 1; store.set("seen", m); }
  function wordStatus(key) {
    if (state.known.has(key)) return "k";
    const f = fcStats()[key]; if (f && (f[0] || f[1])) return "p";
    return seenMap()[key] ? "s" : "n";
  }
  const ST_SVG = {
    n: '<svg class="st" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" opacity=".45"/></svg>',
    s: '<svg class="st" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3" opacity=".15"/><circle cx="12" cy="12" r="9" fill="none" stroke="#0A84FF" stroke-width="3" stroke-dasharray="19 57" transform="rotate(-90 12 12)" stroke-linecap="round"/><circle cx="12" cy="12" r="2.5" fill="#0A84FF"/></svg>',
    p: '<svg class="st" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3" opacity=".15"/><circle cx="12" cy="12" r="9" fill="none" stroke="#FF9F0A" stroke-width="3" stroke-dasharray="40 57" transform="rotate(-90 12 12)" stroke-linecap="round"/></svg>',
    k: '<svg class="st" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#30D158"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const ST_NAME = { k: "kann ich", p: "übe", s: "gesehen", n: "neu" };
  const ST_COL = { k: "#30D158", p: "#FF9F0A", s: "#0A84FF", n: "var(--tile-2)" };
  const articleOf = v => (v.de.match(/^(der|die|das) /) || [])[1] || "";
  const pluralOf = v => { const m = (v.g || "").match(/جمع:\s*die\s+([^\s·]+)/); return m ? m[1] : ""; };
  const baseWord = v => v.de.replace(/^(der|die|das) /, "");
  function exampleFor(v) {
    const forms = [baseWord(v), ...((DICT[v.key] || {}).f || [])].filter(f => f && f.length > 1);
    const esc2 = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\wäöüß])(${forms.map(esc2).join("|")})([^\\wäöüß]|$)`, "i");
    for (let i = 0; i < lines.length; i++) {
      const hit = (lines[i].text.match(/[^.!?]+[.!?]*/g) || []).find(x => re.test(x));
      if (hit) return { de: hit.trim(), fa: lines[i].fa || "", re };
    }
    return null;
  }
  const letterOf = v => baseWord(v)[0].toUpperCase().replace("Ä", "A").replace("Ö", "O").replace("Ü", "U");
  state.vpos = "all";
  function renderVocab() {
    const q = ($("#vocabSearch").value || "").trim().toLowerCase();
    const stats = { k: 0, p: 0, s: 0, n: 0 }, byPos = {};
    vocabList.forEach(v => { v.st = wordStatus(v.key); v.pg = wordType(v.p); stats[v.st]++; byPos[v.pg] = (byPos[v.pg] || 0) + 1; });
    $("#vocabSub").textContent = `${LESSONS[state.idx] ? "Lektion " + (state.idx + 1) + " · " : ""}${vocabList.length} Wörter`;
    $("#vMbar").innerHTML = ["k", "p", "s", "n"].map(k => `<i style="flex:${stats[k]};background:${ST_COL[k]}"></i>`).join("");
    $("#vMleg").innerHTML = ["k", "p", "s", "n"].map(k => `<button data-vf="${k}" class="${state.vf === k ? "on" : ""}"><i style="background:${ST_COL[k]}"></i><b>${stats[k]}</b> ${ST_NAME[k]}</button>`).join("");
    $("#vocabPos").innerHTML = `<button data-pos="all" class="${state.vpos === "all" ? "on" : ""}">Alle <b>${vocabList.length}</b></button>` +
      POSG.filter(([k]) => byPos[k]).map(([k, name]) => `<button data-pos="${k}" class="${state.vpos === k ? "on" : ""}">${name} <b>${byPos[k]}</b></button>`).join("");
    const list = vocabList.filter(v => (state.vf === "all" || v.st === state.vf) && (state.vpos === "all" || v.pg === state.vpos)
      && (!q || v.de.toLowerCase().includes(q) || v.fa.includes(q)))
      .sort((a, b) => baseWord(a).localeCompare(baseWord(b), "de", { sensitivity: "base" }));
    const groups = [];
    list.forEach(v => { const L = letterOf(v); if (!groups.length || groups[groups.length - 1][0] !== L) groups.push([L, []]); groups[groups.length - 1][1].push(v); });
    $("#vocabGrid").innerHTML = groups.map(([L, vs]) => `<div class="dsec">${esc(L)}</div><div class="dgrp">${vs.map(v => {
      const ar = articleOf(v), pl = pluralOf(v), [, , short] = POSG.find(x => x[0] === v.pg);
      return `<div class="drow" data-de="${esc(v.key)}">${ST_SVG[v.st]}<div class="dtx"><div class="dw">${ar ? `<span class="ar ${ar}">${ar}</span> ` : ""}${esc(baseWord(v))}${pl ? `<span class="pl">· ${esc(pl)}</span>` : ""}</div><div class="dm fa">${esc(v.fa)}</div></div>
        <span class="pos ${v.pg === "N" ? "N-" + (ar || "die") : v.pg}">${short}</span><button class="spk" data-say="${esc(v.de)}" aria-label="anhören">${SAY_ICON}</button></div>`;
    }).join("")}</div>`).join("") || `<p class="fa notice">${t("nothingHere")}</p>`;
  }
  // every line of the lesson where the word (or one of its forms) appears
  function examplesFor(v, forms) {
    const esc2 = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const list = [...new Set(forms.filter(f => f && f.length > 1))].sort((a, b) => b.length - a.length);
    const re = new RegExp(`(^|[^\\wäöüßÄÖÜ])(${list.map(esc2).join("|")})(?=[^\\wäöüßÄÖÜ]|$)`, "gi");
    const out = [];
    lines.forEach((l, i) => { re.lastIndex = 0; if (out.length < 3 && re.test(l.text)) out.push({ i, who: l.who, fa: l.fa || "", html: esc(l.text).replace(re, (m, a, w) => `${a}<b>${w}</b>`) }); });
    return out;
  }
  const G = window.Grammar;
  function openEntry(key) {
    const v = vocabList.find(x => x.key === key) || vocabEntry(key); if (!v) return;
    markSeen(key);
    const ar = articleOf(v), pl = pluralOf(v), pg = wordType(v.p), word = baseWord(v);
    const seen = seenMap()[key] || 0, [right = 0, wrong = 0] = fcStats()[key] || [];
    const tries = right + wrong, pct = tries ? Math.round(right / tries * 100) : 0;
    const GEN = { der: "maskulin · مذکر", die: "feminin · مؤنث", das: "neutral · خنثی" };
    let tags = [], table = "", notes = [], forms = [word, ...((DICT[key] || {}).f || [])];
    if (pg === "V") {
      const vb = G.verb(key);
      tags = [`<span class="pos V">Verb · ${vb.irr ? "unregelmäßig" : "regelmäßig"}</span>`, `<span class="pos P">Perfekt mit „${vb.aux}“</span>`];
      if (vb.sep) tags.push(`<span class="pos P">trennbar</span>`); if (vb.refl) tags.push(`<span class="pos P">reflexiv</span>`); if (vb.modal) tags.push(`<span class="pos P">Modalverb</span>`);
      table = `<div class="vs-sec">KONJUGATION · <span class="fa">صرف فعل</span></div><div class="conj"><table><tr><th></th><th>Präsens</th><th>Präteritum</th><th>Perfekt</th></tr>${vb.rows.map(r => `<tr><td>${r.p}</td><td><b>${esc(r.pr)}</b></td><td>${esc(r.pt)}</td><td><span class="aux">${esc(r.pf)}</span> ${esc(r.pp)}</td></tr>`).join("")}</table></div>`;
      notes = G.verbNotes(vb);
      vb.rows.forEach(r => { forms.push(r.pr.split(" ")[0], r.pt.split(" ")[0]); }); forms.push(vb.pp);
    } else if (pg === "N" && ar) {
      tags = [`<span class="pos N-${ar}">${ar} · ${GEN[ar]}</span>`]; if (pl) tags.push(`<span class="pos P">Plural: die ${esc(pl)}</span>`);
      const nn = G.noun(word, ar, pl);
      table = `<div class="vs-sec">DEKLINATION · <span class="fa">صرف اسم</span></div><div class="conj"><table><tr><th></th><th>Singular</th><th></th>${nn.hasPlural ? "<th>Plural</th>" : ""}</tr>${nn.rows.map(r => `<tr><td>${r.c.slice(0, 3)}.</td><td><b>${esc(r.def)}</b></td><td>${esc(r.ind)}</td>${nn.hasPlural ? `<td>${esc(r.pl)}</td>` : ""}</tr>`).join("")}</table></div>`;
      notes = nn.notes; if (pl) forms.push(pl);
    } else {
      const [, name] = POSG.find(x => x[0] === pg);
      tags = [`<span class="pos ${pg}">${name}</span>`, `<span class="pos P fa">${esc(I18N.pos(v.p))}</span>`];
      if (pg === "A") {
        const a = G.adj(word);
        if (a) { table = `<div class="vs-sec">STEIGERUNG · <span class="fa">صفت برتر و برترین</span></div><div class="conj"><table><tr><th>Positiv</th><th>Komparativ</th><th>Superlativ</th></tr><tr><td><b>${esc(a.pos)}</b></td><td>${esc(a.comp)}</td><td>${esc(a.sup)}</td></tr></table></div>`;
          notes.push(`قبل از اسم پسوند می‌گیرد: ${a.attr.map(G.de).join(" · ")}`, `بعد از فعل‌های ${G.de("sein/werden")} بدون پسوند می‌آید: ${G.de(`Das ist ${a.pos}.`)}`); }
      }
      const sm = G.smallNotes(key, v.p || "");
      notes.push(...sm.notes);
      if (sm.table) table = `<div class="vs-sec">FORMEN · <span class="fa">صورت‌ها</span></div><div class="conj"><table><tr>${sm.table.head.map(h => `<th>${h}</th>`).join("")}</tr>${sm.table.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<td><b>${esc(c)}</b></td>`).join("")}</tr>`).join("")}</table></div>`;
    }
    const inL = (keyLessons()[key] || []).map(i => `L${i + 1} · ${LESSONS[i].level || ""}`);
    tags.push(inL.length ? `<span class="pos P">${inL.join(" · ")}</span>` : `<span class="pos P">nicht in den Lektionen</span>`);
    // notes from the dictionary first (usage, idioms), then the rules
    const own = (v.g || "").split(" · ").filter(x => x && x !== v.de && !/^جمع:/.test(x) && !(pg === "V" && /^(ich|du|er|sie|es|wir|ihr|Sie) \S+$/.test(x))).map(x => `<bdi dir="auto">${esc(x)}</bdi>`);
    const all = [...own, ...notes];
    const ex = examplesFor(v, forms);
    $("#vSheet").innerHTML = `<div class="vs-grab"></div>
      <div class="vs-scroll">
      <div class="vs-top"><span class="vs-big">${ar ? `<span class="ar ${ar}">${ar}</span> ` : ""}${esc(word)}</span>
        <button class="spk big" data-say="${esc(v.de)}" aria-label="anhören">${SAY_ICON}</button><button class="vs-x" id="vsClose" aria-label="schließen">✕</button></div>
      <div class="vs-tags">${tags.join("")}</div>
      <div class="vs-mean fa">${esc(v.fa)}</div>
      ${table}
      ${all.length ? `<div class="vs-sec">GRAMMATIK · <span class="fa">نکتهٔ دستوری</span></div><div class="gram fa">${all.map(n => `<div class="li"><span>${n}</span></div>`).join("")}</div>` : ""}
      ${ex.length ? `<div class="vs-sec">AUS DER LEKTION · <span class="fa">در درس</span></div>${ex.map(e => `<div class="quote ${e.who.toLowerCase()}"><span class="who">${esc(e.who.toUpperCase())} · Satz ${e.i + 1}</span><span class="qde">${e.html}</span><span class="qfa fa">${esc(e.fa)}</span></div>`).join("")}` : ""}
      </div>
      <div class="vs-stats"><div><span class="vs-ico">👁</span><div><b>${seen}×</b><span>gesehen</span></div></div>
        <div><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="4" opacity=".15"/>${tries ? "" : "<!--"}<circle cx="18" cy="18" r="15" fill="none" stroke="${pct >= 70 ? "#30D158" : pct >= 40 ? "#FF9F0A" : "#FF375F"}" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 18 18)"/>${tries ? "" : "-->"}</svg>
          <div><b>${tries ? pct + "%" : "—"}</b><span>${tries ? `${right} von ${tries} richtig` : "noch nicht geübt"}</span></div></div></div>`;
    $("#vBack").hidden = false;
    $("#vsClose").onclick = closeEntry;
  }
  function closeEntry() { $("#vBack").hidden = true; renderVocab(); }
  $("#vBack").addEventListener("click", e => { if (e.target.id === "vBack") closeEntry(); });
  $("#vocabGrid").addEventListener("click", e => {
    if (e.target.closest("[data-say]")) return;
    const r = e.target.closest(".drow"); if (r) openEntry(r.dataset.de);
  });
  $("#vMleg").addEventListener("click", e => { const b = e.target.closest("[data-vf]"); if (!b) return; state.vf = state.vf === b.dataset.vf ? "all" : b.dataset.vf; renderVocab(); });
  $("#vocabPos").addEventListener("click", e => { const b = e.target.closest("[data-pos]"); if (!b) return; state.vpos = b.dataset.pos; renderVocab(); });
  $("#vocabSearch").addEventListener("input", () => renderVocab());

  function renderWotd() {
    if (!vocabList.length) return;
    const v = vocabList[new Date().getDate() * 7 % vocabList.length];
    $("#wotdDe").textContent = v.de; $("#wotdFa").textContent = v.fa; $("#wotdEn").textContent = I18N.pos(v.p);
    // an example sentence from the lesson that uses the word
    const re = new RegExp(`(^|[^\\wäöüß])${v.de.replace(/^(der|die|das)\s+/i, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\wäöüß]|$)`, "i");
    const hit = lines.map(l => (l.text.match(/[^.!?]+[.!?]*/g) || []).find(x => re.test(x))).find(Boolean);
    $("#wotdEx").textContent = hit ? `„${hit.trim()}“` : "";
    $("#wotdSay").dataset.word = v.de;
  }
  /* ---------- Daily activity: rings + streak ---------- */
  const GOAL = { speak: 8, listen: 15 };
  const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
  const daily = () => store.get("daily", {});
  function logDay(field, n) {
    const all = daily(), k = dayKey(), d = all[k] || { s: 0, l: 0 };
    d[field] = (d[field] || 0) + n; all[k] = d; store.set("daily", all);
    renderProgress();
  }
  function streak() {
    const all = daily(), active = k => all[k] && (all[k].s > 0 || all[k].l >= 60 || all[k].x > 0);
    const d = new Date(); if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0; while (active(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderProgress() {
    const today = daily()[dayKey()] || { s: 0, l: 0 };
    const mins = Math.floor((today.l || 0) / 60), k = vocabList.filter(v => state.known.has(v.key)).length;
    const ring = (id, f) => $(id).setAttribute("stroke-dasharray", `${Math.min(100, Math.round(f * 100))} 100`);
    ring("#rgSpeak", (today.s || 0) / GOAL.speak); ring("#rgListen", mins / GOAL.listen); ring("#rgWords", k / (vocabList.length || 1));
    $("#lgSpeak").textContent = `${today.s || 0}/${GOAL.speak}`;
    $("#lgListen").textContent = `${mins}/${GOAL.listen}`;
    $("#lgWords").textContent = `${k}/${vocabList.length}`;
    $("#hStreak").textContent = `🔥 ${streak()}`;
    renderHomeExtras();
  }
  // wide screens: this week, words to review, practice shortcuts
  function renderHomeExtras() {
    const all = daily(), now = new Date(), days = [];
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (let k = 0; k < 7; k++) { const d = new Date(monday); d.setDate(monday.getDate() + k); const r = all[dayKey(d)] || {}; days.push({ n: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][k], min: Math.round((r.l || 0) / 60), s: r.s || 0, today: dayKey(d) === dayKey(now) }); }
    const score = d => d.min + d.s, max = Math.max(1, ...days.map(score));
    $("#hWeek").innerHTML = days.map(d => `<div class="d ${d.today ? "today" : ""}"><i class="${score(d) ? "" : "z"}" style="height:${Math.max(4, score(d) / max * 100)}%" title="${d.min} Min · ${d.s} Sätze"></i>${d.n}</div>`).join("");
    $("#hWeekSum").textContent = `${days.reduce((a, d) => a + d.min, 0)} Min · ${days.reduce((a, d) => a + d.s, 0)} Sätze`;
    const st = fcStats();
    const weak = vocabList.map(v => { const [r = 0, w = 0] = st[v.key] || []; return { v, n: r + w, pct: r + w ? Math.round(r / (r + w) * 100) : 0 }; })
      .filter(x => x.n && x.pct < 70).sort((a, b) => a.pct - b.pct).slice(0, 5);
    $("#hReview").innerHTML = weak.length ? weak.map(x => `<button class="r" data-entry="${esc(x.v.key)}"><b>${esc(x.v.de)}</b><span class="fa">${esc(x.v.fa)}</span><span class="sc">${x.pct}%</span></button>`).join("")
      : `<p class="fa muted rev-empty">${t("nothingHere")}</p>`;
    const dl = store.get("dlg", {}), fcAll = Object.values(st).reduce((a, [r = 0, w = 0]) => [a[0] + r, a[1] + r + w], [0, 0]);
    const best = { role: dl.role, gap: dl.gap, read: dl.read, fc: fcAll[1] ? Math.round(fcAll[0] / fcAll[1] * 100) : undefined, exam: store.get("exam" + (LESSONS[state.idx] || {}).id, undefined) };
    const P = [["role", "🎭", "Rollenspiel", "#FF2D55"], ["gap", "🧩", "Lückendialog", "#AF52DE"], ["read", "📖", "Vorlesen", "#5856D6"], ["fc", "🃏", "Karteikarten", "#FF9500"], ["exam", "🏁", "Prüfung", "#34C759"]];
    $("#hPrac").innerHTML = P.map(([k, ic, name, col]) => `<button class="pt" data-prac="${k}"><span class="ic" style="background:${col}">${ic}</span><span class="tx"><b>${name}</b><small>Bestes: ${best[k] != null ? best[k] + "%" : "—"}</small><span class="bar"><i style="width:${best[k] || 0}%"></i></span></span></button>`).join("");
  }
  $("#hReview").addEventListener("click", e => { const b = e.target.closest("[data-entry]"); if (b) openEntry(b.dataset.entry); });
  $("#hPrac").addEventListener("click", e => { const b = e.target.closest("[data-prac]"); if (!b) return; go("practice"); $(`#pHub [data-open="${b.dataset.prac}"]`)?.click(); });

  /* ---------- Vocab scope ---------- */
  state.vscope = "lesson";
  $("#vocabScope").addEventListener("click", e => {
    const b = e.target.closest("[data-scope]"); if (!b) return;
    state.vscope = b.dataset.scope; $$("#vocabScope button").forEach(x => x.classList.toggle("on", x === b));
    buildVocab(); renderVocab();
  });

  /* ---------- Speech: recognition + scoring ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let activeRec = null;
  const stopListening = () => { try { activeRec?.abort(); } catch {} activeRec = null; };
  // one short listening session: mic on → one phrase → mic off (resolves only after the mic is released)
  function listen() {
    return new Promise((resolve, reject) => {
      if (!SR) return reject(new Error("no-sr"));
      stopListening();
      const r = new SR(); r.lang = "de-DE"; r.interimResults = false; r.continuous = false; r.maxAlternatives = 4;
      activeRec = r;
      let result = null, error = null;
      r.onresult = ev => { result = [...ev.results[0]].map(a => a.transcript); try { r.stop(); } catch {} };
      r.onerror = ev => { error = ev.error || "error"; };
      r.onend = () => {
        if (activeRec === r) activeRec = null;
        result ? resolve(result) : reject(error || "no-speech");
      };
      r.start();
    });
  }
  // asks the browser for the microphone; shows why it failed so the learner can fix it
  async function ensureMic() {
    if (!window.isSecureContext) return { ok: false, why: "insecure" };
    if (!SR) return { ok: false, why: "no-sr" };
    if (navigator.mediaDevices?.getUserMedia) {
      try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach(t => t.stop()); }
      catch (e) { return { ok: false, why: e && e.name === "NotFoundError" ? "no-mic" : "denied" }; }
    }
    return { ok: true };
  }
  const MIC_MSG = {
    get insecure() { return `${t("micInsecure")} <a href="https://${location.host}${location.pathname}">${t("openHttps")}</a>.`; },
    get "no-sr"() { return t("micNoSr"); },
    get denied() { return t("micDenied"); },
    get "no-mic"() { return t("micNone"); }
  };
  function micGate(onReady) {
    $("#dlgFoot").innerHTML = `<button class="btn big" id="dlgStart">🎤 Start</button>`;
    $("#dlgStart").onclick = async () => {
      unlockAudio();
      const r = await ensureMic();
      if (r.ok) { $("#dlgFoot").innerHTML = ""; onReady(); return; }
      $("#dlgFoot").innerHTML = `<p class="fa warn mic-msg">${MIC_MSG[r.why]}</p><button class="btn big" id="dlgStart">🎤 ${t("allowAgain")}</button>`;
      $("#dlgStart").onclick = () => micGate(onReady) || $("#dlgStart").click();
    };
  }
  const nw = s => window.Practice.words(window.Practice.norm(s));
  // Lenient matching: speech recognizers mishear names, numbers, endings and compounds,
  // so a native speaker must pass. A target word counts when any alternative contains it,
  // a number form of it, a one-letter slip, or two said words that join into it.
  const NUMW = { eins: "1", ein: "1", eine: "1", zwei: "2", drei: "3", vier: "4", fünf: "5", sechs: "6", sieben: "7", acht: "8", neun: "9", zehn: "10", elf: "11", zwölf: "12", zwanzig: "20", dreißig: "30", hundert: "100" };
  const canon = w => NUMW[w] || w;
  const slip = w => w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;
  function heardWord(t, said) {
    const c = canon(t);
    for (let j = 0; j < said.length; j++) {
      const s = canon(said[j]);
      if (s === c || (slip(c) && lev(s, c) <= slip(c))) return true;
      // recognizers split compounds and zu-infinitives: "kennen zu lernen" = kennenzulernen
      for (let n = 2; n <= 3 && j + n <= said.length; n++) if (lev(said.slice(j, j + n).join(""), c) <= slip(c)) return true;
    }
    return false;
  }
  // per word of `target`: was it heard? (names always count — recognizers rarely spell them right)
  function matchWords(target, alts) {
    const saids = alts.map(nw);
    return target.split(/\s+/).filter(tok => nw(tok).length).map(tok => {
      const ws = nw(tok), raw = cleanWord(tok);
      const name = !!NAMES[raw] || !!NAMES[raw.replace(/'s$/, "")];
      return { tok, ok: name || ws.every(w => saids.some(sd => heardWord(w, sd))) };
    });
  }
  function wordsHtml(target, hits, pendClass = "w-miss") {
    let k = 0;
    return target.split(/(\s+)/).map(tok => {
      if (!tok.trim()) return tok;
      if (!nw(tok).length) return esc(tok);
      const h = hits[k++];
      return `<span class="${h && h.ok ? "w-ok" : pendClass}">${esc(tok)}</span>`;
    }).join("");
  }
  function scoreSpeech(target, alts, required = []) {
    alts = alts.filter(a => a && a.trim());
    const hits = matchWords(target, alts);
    const pct = hits.filter(h => h.ok).length / (hits.length || 1);
    const saids = alts.map(nw);
    const reqOk = required.every(w => saids.some(sd => heardWord(window.Practice.norm(w), sd)));
    const ok = alts.length > 0 && pct >= 0.6 && reqOk;
    if (ok) logDay("s", 1);
    return { pct, reqOk, hits, said: alts[0] || "", ok, html: wordsHtml(target, hits) };
  }

  /* ---------- Flashcards (in practice): DE→FA choose · FA→DE speak ---------- */
  const fc = { cur: null, last: null, dir: "de", right: 0, wrong: 0, streak: 0, timer: 0, list: [] };
  const fcStats = () => store.get("fc", {});
  const lev = (a, b) => {
    a = a.toLowerCase(); b = b.toLowerCase();
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
    return d[b.length];
  };
  const posGroup = p => (p || "").split(/[\s(]/)[0];
  const bareDe = v => v.de.replace(/^(der|die|das) /, "");
  function closeDistractor(v, dir) {
    const scored = fc.list.filter(c => c.key !== v.key && c.fa !== v.fa && c.de !== v.de).map(c => {
      let sc = (c.p === v.p ? 4 : posGroup(c.p) === posGroup(v.p) ? 2 : 0);
      if (dir === "fa") sc += Math.max(0, 3 - lev(bareDe(c), bareDe(v)) / 2) + (bareDe(c)[0]?.toLowerCase() === bareDe(v)[0]?.toLowerCase() ? 1 : 0);
      else sc += Math.max(0, 2 - Math.abs(c.fa.length - v.fa.length) / 4);
      return { c, sc: sc + Math.random() * 0.8 };
    }).sort((x, y) => y.sc - x.sc);
    return scored[Math.floor(Math.random() * Math.min(3, scored.length))]?.c;
  }
  function pickWord() {
    const st = fcStats();
    const weights = fc.list.map(v => {
      const [r = 0, w = 0] = st[v.key] || [];
      return v.key === fc.last ? 0 : Math.max(0.2, (r + w === 0 ? 3 : 1) + w * 3 - Math.min(r, 4) * 0.6);
    });
    let x = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < fc.list.length; i++) { x -= weights[i]; if (x <= 0) return fc.list[i]; }
    return fc.list[0];
  }
  function renderFcStats() {
    $("#fcStats").innerHTML = `<span class="ok">✓ ${fc.right}</span><span class="bad">✗ ${fc.wrong}</span><span>🔥 ${fc.streak}</span>`;
  }
  function nextCard() {
    clearTimeout(fc.timer);
    fc.list = lessonKeys(LESSONS[state.idx], lines).map(vocabEntry).filter(Boolean);
    if (!fc.list.length) return;
    const v = pickWord(); fc.cur = v; fc.last = v.key;
    fc.dir = Math.random() < 0.5 ? "de" : "fa";
    const voice = fc.dir === "fa" && SR;
    $("#fcDir").innerHTML = fc.dir === "de" ? `Deutsch → <span class="fa">${t("nativeLang")}</span>` : `<span class="fa">${t("nativeLang")}</span> → Deutsch 🎤`;
    $("#fcPrompt").innerHTML = fc.dir === "de"
      ? `<span>${esc(v.de)}</span><button class="say" data-say="${esc(v.de)}">${SAY_ICON}</button>`
      : `<span class="fa">${esc(v.fa)}</span>`;
    $("#fcPos").textContent = I18N.pos(v.p);
    const d = closeDistractor(v, fc.dir);
    const optsList = [v, d].filter(Boolean).sort(() => Math.random() - 0.5);
    $("#fcOpts").innerHTML = voice ? "" : optsList.map(o => `<button data-k="${esc(o.key)}" class="${fc.dir === "de" ? "fa" : ""}">${esc(fc.dir === "de" ? o.fa : o.de)}</button>`).join("");
    $("#fcOpts").hidden = voice;
    $("#fcVoice").hidden = !voice; $("#fcHeard").textContent = t("sayGerman");
    $("#fcInfo").hidden = true; $("#fcNext").hidden = true;
    $("#fcCard").className = "fc-card";
    renderFcStats();
    if (fc.dir === "de") speak(v.de);
    if (voice) fc.timer = setTimeout(() => { if (fc.cur === v && !$("#fcVoice").hidden) $("#fcMic").click(); }, 700);
  }
  function fcAnswer(ok) {
    const v = fc.cur;
    const st = fcStats(), [r = 0, w = 0] = st[v.key] || [];
    st[v.key] = ok ? [r + 1, w] : [r, w + 1]; store.set("fc", st);
    if (ok) { fc.right++; fc.streak++; if (st[v.key][0] >= 3 && !state.known.has(v.key)) { state.known.add(v.key); store.set("known", [...state.known]); renderProgress(); } }
    else { fc.wrong++; fc.streak = 0; }
    $("#fcCard").className = "fc-card " + (ok ? "ok" : "bad");
    $("#fcInfo").innerHTML = `<div class="fc-pair"><b dir="ltr">${esc(v.de)}</b> = ${esc(v.fa)}</div>${v.g ? `<div class="fc-g">${esc(v.g)}</div>` : ""}`;
    $("#fcInfo").hidden = false; $("#fcNext").hidden = false; $("#fcVoice").hidden = true;
    renderFcStats();
    if (fc.dir === "fa") { speak(v.de); if (ok) logDay("s", 1); }
    if (exam.active) examRecord(ok);
    else if (ok) fc.timer = setTimeout(nextCard, 1600);
  }
  $("#fcOpts").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const ok = b.dataset.k === fc.cur.key;
    $$("#fcOpts button").forEach(x => { x.disabled = true; if (x.dataset.k === fc.cur.key) x.classList.add("ok"); });
    if (!ok) b.classList.add("bad");
    fcAnswer(ok);
  });
  $("#fcMic").onclick = async () => {
    const v = fc.cur, forms = [bareDe(v), ...(DICT[v.key]?.f || [])].map(f => window.Practice.norm(f));
    $("#fcMic").classList.add("rec"); $("#fcHeard").textContent = t("listening");
    try {
      const alts = await listen();
      const ok = alts.some(a => nw(a).some(w => forms.includes(w)));
      $("#fcHeard").innerHTML = `<span class="fa">${t("heard")}</span> «${esc(alts[0])}»`;
      fcAnswer(ok);
    } catch (err) { $("#fcHeard").textContent = t("heardNothing"); }
    $("#fcMic").classList.remove("rec");
  };
  $("#fcSkip").onclick = () => fcAnswer(false);
  $("#fcNext").onclick = () => exam.active ? examNext() : nextCard();

  /* ---------- Practice: 100 exercise cards ---------- */
  const ex = { list: [], i: 0, filter: "all" };
  const exKey = () => "ex" + LESSONS[state.idx].id;
  const exResults = () => store.get(exKey(), {});
  const shuffleArr = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  let clipStop = null, clipDone = null;
  // plays one dialog line from the lesson audio; resolves when it ends
  function playClip(i) {
    const l = lines[i];
    const viaSpeech = () => { speak(l.text); return new Promise(r => setTimeout(r, 400 + l.text.length * 55)); };
    if (!player.duration || !timed) return viaSpeech();
    if (clipDone) clipDone();
    player.currentTime = l.t0; clipStop = l.t1;
    return new Promise(resolve => {
      let finished = false;
      const done = () => { if (finished) return; finished = true; clearTimeout(guard); clipDone = null; resolve(); };
      clipDone = done;
      // never hang: resolve after the clip length even if the browser swallowed events
      const guard = setTimeout(() => { if (!player.paused) player.pause(); clipStop = null; done(); }, (l.t1 - l.t0) * 1000 + 2500);
      // if the browser blocks playback (autoplay rules), read the line with speech instead
      player.play().catch(() => { clipStop = null; viaSpeech().then(done); });
    });
  }
  // unlock audio on a user tap so later clips may play without another tap (Safari)
  function unlockAudio() {
    try { const p = player.play(); p && p.then(() => player.pause()).catch(() => {}); } catch {}
    try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {}
  }
  player.addEventListener("timeupdate", () => { if (clipStop != null && player.currentTime >= clipStop) { player.pause(); clipStop = null; clipDone?.(); clipDone = null; } });
  player.addEventListener("pause", () => { if (clipStop == null && clipDone) { clipDone(); clipDone = null; } });

  function buildPractice() {
    ex.list = window.Practice ? window.Practice.build(LESSONS[state.idx], lines, w => { const k = dictKey(w); return k ? DICT[k] : {}; }) : [];
    ex.i = Math.min(store.get(exKey() + ":i", 0), ex.list.length - 1);
    renderHub();
  }
  const visibleEx = () => ex.list.filter(e => ex.filter === "all" || e.type === ex.filter);
  function stepEx(d) {
    const v = visibleEx(); const k = v.indexOf(ex.list[ex.i]);
    const n = v[Math.max(0, Math.min(v.length - 1, k + d))]; if (n) { ex.i = n.id; renderExercise(); }
  }
  $("#exPrev").onclick = () => stepEx(-1);
  $("#exNext").onclick = () => exam.active ? examNext() : stepEx(1);

  function renderMap() {
    const res = exResults();
    $("#exMap").innerHTML = visibleEx().map(e => `<button class="dot ${res[e.id] === true ? "ok" : res[e.id] === false ? "bad" : ""} ${e.id === ex.i ? "cur" : ""}" data-id="${e.id}" aria-label="${e.id + 1}"></button>`).join("");
    const ok = Object.values(res).filter(Boolean).length, bad = Object.values(res).filter(v => v === false).length;
    $("#exStats").innerHTML = `<span class="ok">✓ ${ok}</span><span class="bad">✗ ${bad}</span><span>${Object.keys(res).length} / ${ex.list.length}</span>`;
    $("#exMap .cur")?.scrollIntoView({ block: "nearest", inline: "center" });
  }
  $("#exMap").addEventListener("click", e => { const d = e.target.closest(".dot"); if (d) { ex.i = Number(d.dataset.id); renderExercise(); } });

  function finishEx(correct, detail = "") {
    const e = ex.list[ex.i], res = exResults();
    res[e.id] = correct; store.set(exKey(), res);
    const l = lines[e.line];
    const fb = $("#exFeedback");
    fb.hidden = false;
    fb.className = "ex-feedback " + (correct ? "ok" : "bad");
    fb.innerHTML = `<div class="fb-title">${correct ? "✓ Richtig! · " + t("wellDone") : "✗ Nicht ganz · " + t("listenAgain")}</div>
      ${detail}
      <div class="fb-ans"><button class="say" data-say="${esc(e.answer)}">${SAY_ICON}</button><span>${esc(e.answer)}</span></div>
      ${l && l.fa ? `<div class="fa fb-fa">${esc(e.explain || l.fa)}</div>` : ""}
      ${timed ? `<button class="chip-btn" id="exClip">▶ Im Dialog hören</button>` : ""}`;
    $("#exClip") && ($("#exClip").onclick = () => playClip(e.line));
    $("#exCheck").hidden = true; $("#exNext").classList.add("pulse");
    renderMap(); renderProgress(); renderHub();
    if (exam.active) examRecord(correct);
  }

  function renderExercise() {
    const e = ex.list[ex.i]; if (!e) return;
    store.set(exKey() + ":i", ex.i);
    const [de, fa] = window.Practice.TYPE_LABEL[e.type];
    $("#exType").innerHTML = `${de} <span class="fa">· ${fa}</span>`;
    $("#exNum").textContent = `${e.id + 1} / ${ex.list.length}`;
    $("#exFeedback").hidden = true; $("#exCheck").hidden = true; $("#exNext").classList.remove("pulse");
    const body = $("#exBody");
    const optHtml = opts => `<div class="opts">${opts.map((o, j) => `<button data-j="${j}">${esc(o)}</button>`).join("")}</div>`;
    const bindOpts = () => $$(".opts button", body).forEach(b => b.onclick = () => {
      const pickText = e.options[b.dataset.j], ok = pickText === e.answer;
      $$(".opts button", body).forEach((x, j) => { x.disabled = true; if (e.options[j] === e.answer) x.classList.add("ok"); });
      if (!ok) b.classList.add("bad");
      finishEx(ok);
    });

    if (e.type === "translate") {
      body.innerHTML = `<p class="ex-q fa">${esc(e.prompt)}</p><p class="ex-sub fa">${t("whichGerman")}</p>${optHtml(e.options)}`;
      bindOpts();
    } else if (e.type === "listen") {
      body.innerHTML = `<button class="play-big" id="exPlay">▶</button><p class="ex-sub fa">${t("whichHeard")}</p>${optHtml(e.options)}`;
      $("#exPlay").onclick = () => playClip(e.line);
      bindOpts();
    } else if (e.type === "respond") {
      body.innerHTML = `<div class="ex-bubble"><button class="say" data-say="${esc(e.prompt)}">${SAY_ICON}</button><span>${esc(e.prompt)}</span></div>
        <p class="ex-sub fa">${t("bestReply")}</p>${optHtml(e.options)}`;
      bindOpts();
    } else if (e.type === "fill") {
      body.innerHTML = `${e.hint ? `<p class="ex-sub fa">${esc(e.hint)}</p>` : ""}
        <p class="ex-sent">${esc(e.before)}<input id="exInput" autocomplete="off" autocapitalize="off" spellcheck="false" size="${Math.max(4, e.answer.length)}" aria-label="Lücke">${esc(e.after)}</p>
        <div class="umlauts">${["ä", "ö", "ü", "ß"].map(c => `<button data-c="${c}">${c}</button>`).join("")}<button class="hint" id="exHint">💡 <span class="fa">${t("hint")}</span></button></div>`;
      const inp = $("#exInput"); let hints = 0;
      $$(".umlauts [data-c]", body).forEach(b => b.onclick = () => { inp.value += b.dataset.c; inp.focus(); });
      $("#exHint").onclick = () => { hints++; inp.value = e.answer.slice(0, hints); inp.focus(); };
      const check = () => { if (!inp.value.trim()) return inp.focus(); const ok = window.Practice.norm(inp.value) === window.Practice.norm(e.answer); inp.classList.add(ok ? "ok" : "bad"); inp.disabled = true; finishEx(ok, e.note ? `<div class="fa fb-note">${esc(e.note)}</div>` : ""); };
      inp.addEventListener("keydown", k => { if (k.key === "Enter") check(); });
      $("#exCheck").hidden = false; $("#exCheck").onclick = check;
    } else if (e.type === "order") {
      const built = [];
      body.innerHTML = `${e.hint ? `<p class="ex-sub fa">${esc(e.hint)}</p>` : `<p class="ex-sub fa">${t("tapOrder")}</p>`}
        <div class="build" id="exBuilt"></div><div class="bank" id="exBank">${e.tokens.map((t, j) => `<button data-j="${j}">${esc(t)}</button>`).join("")}</div>`;
      const draw = () => {
        $("#exBuilt").innerHTML = built.map((j, k) => `<button data-k="${k}">${esc(e.tokens[j])}</button>`).join("") || `<span class="ph fa">${t("buildsHere")}</span>`;
        $$("#exBank button").forEach(b => b.classList.toggle("used", built.includes(Number(b.dataset.j))));
        $("#exCheck").hidden = built.length !== e.tokens.length;
      };
      $("#exBank").onclick = ev => { const b = ev.target.closest("button"); if (!b || b.classList.contains("used") || b.disabled) return; built.push(Number(b.dataset.j)); draw(); };
      $("#exBuilt").onclick = ev => { const b = ev.target.closest("button"); if (!b || b.disabled) return; built.splice(Number(b.dataset.k), 1); draw(); };
      $("#exCheck").onclick = () => {
        const ok = built.map(j => e.tokens[j]).join(" ").toLowerCase() === window.Practice.words(e.answer).join(" ").toLowerCase();
        $$("#exBuilt button, #exBank button").forEach(b => b.disabled = true);
        $("#exBuilt").classList.add(ok ? "ok" : "bad"); finishEx(ok);
      };
      draw();
    } else if (e.type === "speak") {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      body.innerHTML = `<p class="ex-q fa">${esc(e.prompt)}</p><p class="ex-sub fa">${t("sayInGerman")}</p>
        <div class="speak-row">${SR ? `<button class="mic" id="exMic" aria-label="Mikrofon">🎤</button>` : ""}
        <button class="chip-btn" id="exReveal">Lösung zeigen · <span class="fa">${t("showAnswer")}</span></button></div>
        <p class="heard" id="exHeard"></p>
        <div class="self" id="exSelf" hidden><span class="fa">${t("saidRight")}</span><button class="btn" data-self="1">✓ Ja</button><button class="btn ghost" data-self="0">✗ Nein</button></div>`;
      const reveal = () => { $("#exHeard").innerHTML = `<b>${esc(e.answer)}</b>`; $("#exSelf").hidden = false; speak(e.answer); };
      $("#exReveal").onclick = reveal;
      $$("#exSelf [data-self]").forEach(b => b.onclick = () => { $("#exSelf").hidden = true; finishEx(b.dataset.self === "1"); });
      if (SR) $("#exMic").onclick = () => {
        const r = new SR(); r.lang = "de-DE"; r.interimResults = false; r.maxAlternatives = 3;
        $("#exMic").classList.add("rec"); $("#exHeard").innerHTML = `<span class="fa">${t("listening")}</span>`;
        r.onresult = ev => {
          const target = window.Practice.words(window.Practice.norm(e.answer));
          const best = [...ev.results[0]].map(a => {
            const said = window.Practice.words(window.Practice.norm(a.transcript));
            const hit = target.filter(w => said.includes(w)).length;
            return { t: a.transcript, score: hit / target.length };
          }).sort((p, q) => q.score - p.score)[0];
          const pct = Math.round(best.score * 100);
          $("#exHeard").innerHTML = `<span class="fa">${t("heard")}</span> «${esc(best.t)}» · ${pct}%`;
          finishEx(best.score >= 0.7);
        };
        r.onerror = () => { $("#exHeard").innerHTML = `<span class="fa">${t("micUnavailable")}</span>`; };
        r.onend = () => $("#exMic")?.classList.remove("rec");
        r.start();
      };
    }
    // restore answered state marker
    const prev = exResults()[e.id];
    $("#exState").className = "ex-state " + (prev === true ? "ok" : prev === false ? "bad" : "");
    $("#exState").textContent = prev === true ? "✓" : prev === false ? "✗" : "";
    renderMap();
  }


  /* ---------- Practice hub: tiles → one exercise view ---------- */
  const TYPE_ICON = { translate: "🔁", fill: "✏️", order: "🧱", listen: "👂", respond: "💬", speak: "🗣️" };
  // words that need review: practised with < 70% right, or looked up but never practised
  function dueWords() {
    const st = fcStats(), seen = seenMap();
    return vocabList.filter(v => { const [r = 0, w = 0] = st[v.key] || []; return (r + w && r / (r + w) < 0.7) || (!(r + w) && seen[v.key] && !state.known.has(v.key)); });
  }
  const tf = (k, o) => t(k).replace(/\{(\w+)\}/g, (m, x) => o[x]);
  function renderHub() {
    const res = exResults(), counts = {}, done = {};
    ex.list.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; if (res[e.id] === true) done[e.type] = (done[e.type] || 0) + 1; });
    const COL = { translate: "#007AFF", fill: "#FF9500", order: "#30B0C7", listen: "#AF52DE", respond: "#34C759", speak: "#FF2D55" };
    $("#hubEx").innerHTML = Object.keys(counts).map(tp => {
      const [de, fa] = window.Practice.TYPE_LABEL[tp], d = done[tp] || 0;
      return `<button class="e" data-open="ex:${tp}"><span class="ic" style="background:${COL[tp]}">${TYPE_ICON[tp] || "•"}</span><span class="tx"><b>${de}</b><small><span class="fa">${fa}</span> · ${d}/${counts[tp]}</small><span class="bar"><i style="width:${d / counts[tp] * 100}%;background:${COL[tp]}"></i></span></span></button>`;
    }).join("");
    const okAll = Object.values(res).filter(Boolean).length, n = ex.list.length || 1, pct = Math.round(okAll / n * 100);
    $("#phSub").textContent = `${okAll} / ${ex.list.length} Übungen · Lektion ${state.idx + 1}`;
    $("#phExCount").textContent = `${okAll} / ${ex.list.length}`;
    $("#phRing").innerHTML = `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="4" opacity=".12"/><circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 18 18)" ${pct ? "" : 'opacity="0"'}/></svg><b>${pct}%</b>`;
    const dl = store.get("dlg", {});
    const SP = [["role", "🎭", "Rollenspiel", t("role"), "linear-gradient(135deg,#FF2D55,#FF6B9A)"], ["gap", "🧩", "Lückendialog", t("gap"), "linear-gradient(135deg,#AF52DE,#8A6CF0)"], ["read", "📖", "Vorlesen", t("readSub2"), "linear-gradient(135deg,#5856D6,#0A84FF)"]];
    $("#phSpeak").innerHTML = SP.map(([k, ic, de, fa, bg]) => `<button class="c" data-open="${k}" style="background:${bg}"><span class="sc">${dl[k] != null ? dl[k] + "%" : "—"}</span><span class="ic">${ic}</span><span class="nm"><b>${de}</b><small class="fa">${esc(fa)}</small></span></button>`).join("");
    const fsBest = store.get("fs", {});
    const FS = [["free", "🗣️", "Frei sprechen", t("fsFreeSub"), "linear-gradient(135deg,#FF9F0A,#FF6B3D)"], ["topic", "💡", "Thema", t("fsTopicSub"), "linear-gradient(135deg,#30B0C7,#0A84FF)"], ["cue", "📝", "Stichpunkte", t("fsCueSub"), "linear-gradient(135deg,#34C759,#30B0C7)"]];
    $("#phFree").innerHTML = FS.map(([k, ic, de, fa, bg]) => `<button class="c" data-open="${k}" style="background:${bg}"><span class="sc">${fsBest[k] != null ? fsBest[k] + (k === "free" ? "" : "%") : "—"}</span><span class="ic">${ic}</span><span class="nm"><b>${de}</b><small class="fa">${esc(fa)}</small></span></button>`).join("");
    const due = dueWords(), kn = vocabList.filter(v => state.known.has(v.key)).length;
    $("#phDue").textContent = due.length ? `${due.length} fällig` : "✓";
    $("#phDue").classList.toggle("none", !due.length);
    $("#phFcSub").textContent = tf("fcKnown", { k: kn, n: vocabList.length });
    const eb = store.get("exam" + (LESSONS[state.idx] || {}).id, null);
    $("#phExamSub").textContent = tf("examBest", { b: eb != null ? eb + "%" : "—" });
    // recommendation: speaking first until today's goal, then words to review, then the weakest exercise type
    const today = daily()[dayKey()] || {}, left = GOAL.speak - (today.s || 0);
    let rec;
    if (left > 0) rec = { open: "role", k: "Rollenspiel", s: tf("recSpeak", { n: left }), bg: "linear-gradient(135deg,#FF9F0A,#FF375F)" };
    else if (due.length) rec = { open: "fc", k: "Karteikarten", s: tf("recReview", { n: due.length }), bg: "linear-gradient(135deg,#FFB340,#FF9500)" };
    else { const tp = Object.keys(counts).sort((a, b) => (done[a] || 0) / counts[a] - (done[b] || 0) / counts[b])[0]; rec = tp && { open: "ex:" + tp, k: window.Practice.TYPE_LABEL[tp][0], s: t("recEx"), bg: "linear-gradient(135deg,#30B0C7,#007AFF)" }; }
    const r = $("#phRec");
    r.hidden = !rec;
    if (rec) { r.dataset.open = rec.open; r.style.background = rec.bg; r.innerHTML = `<span class="tx"><span class="k">EMPFOHLEN · <span class="fa">${t("recToday")}</span></span><b>${esc(rec.k)}</b><span class="s fa">${esc(rec.s)}</span></span><span class="go">›</span>`; }
    renderMap();
  }
  function showPanel(id, title) {
    $("#pHub").hidden = true; $("#pView").hidden = false;
    $$("#pView .pv-panel").forEach(p => p.hidden = p.id !== id);
    $("#pTitle").innerHTML = title; $("#pProg").textContent = "";
  }
  function closeView() {
    exam.active = false; dlg.run++; fs.run++; stopListening(); recCancel(); $("#dlgSheet").hidden = true;
    if (!player.paused) player.pause();
    $("#pView").hidden = true; $("#pView").classList.remove("exam"); $("#pHub").hidden = false; renderHub();
  }
  $("#pBack").onclick = closeView;
  $("#pHub").addEventListener("click", e => {
    const b = e.target.closest("[data-open]"); if (!b) return;
    const k = b.dataset.open;
    if (k.startsWith("ex:")) {
      ex.filter = k.slice(3);
      const v = visibleEx(), res = exResults();
      const next = v.find(x => res[x.id] === undefined) || v[0];
      if (next) ex.i = next.id;
      const [de, fa] = window.Practice.TYPE_LABEL[ex.filter];
      showPanel("pEx", `${de} <span class="fa">· ${fa}</span>`); renderExercise();
    } else if (k === "fc") { showPanel("pFc", `Karteikarten <span class="fa">· ${t("flashcards")}</span>`); fc.right = fc.wrong = fc.streak = 0; nextCard(); }
    else if (k === "exam") startExam();
    else if (k === "free" || k === "topic" || k === "cue") startFree(k);
    else startDialog(k);
  });

  /* ---------- Dialog speaking: role play · gap dialog · read aloud ---------- */
  const dlg = { run: 0, items: [], i: 0, mode: "", role: "" };
  const DLG = {
    get role() { return ["Rollenspiel", t("role")]; },
    get gap() { return ["Lückendialog", t("gap")]; },
    get read() { return ["Vorlesen", t("read")]; }
  };
  const wcount = s => window.Practice.words(s).length;
  function pickBlock(n, maxWords) {
    const starts = [];
    for (let s = 0; s + n <= lines.length; s++) {
      const blk = lines.slice(s, s + n);
      if (blk.every(l => wcount(l.text) <= maxWords && window.Practice.isGerman(l.text))) starts.push(s);
    }
    const s = starts.length ? starts[Math.floor(Math.random() * starts.length)] : 0;
    return Array.from({ length: n }, (_, k) => s + k);
  }
  function blanksFor(text) {
    const cands = window.Practice.words(text).filter(w => w.length >= 3 && !NAMES[w] && DICT[dictKey(w)] && !/^(der|die|das|und|ich|du|wir|ihr|sie|es|ein|eine)$/i.test(w));
    const pick = shuffleArr([...new Set(cands)]).slice(0, wcount(text) > 8 ? 2 : 1);
    return pick;
  }
  function startDialog(mode) {
    stopListening(); recCancel(); $("#dlgSheet").hidden = true; dlg.resolve?.(); dlg.run++; dlg.mode = mode; dlg.i = 0;
    let idx;
    if (mode === "role") idx = pickBlock(10, 22);
    else if (mode === "gap") idx = pickBlock(5, 20);
    else idx = shuffleArr(lines.map((l, i) => i).filter(i => wcount(lines[i].text) >= 3 && wcount(lines[i].text) <= 18 && window.Practice.isGerman(lines[i].text))).slice(0, 5).sort((a, b) => a - b);
    // role play: every line is randomly yours or your partner's (at least 4 are yours)
    let mine = idx.map(() => mode !== "role" || Math.random() < 0.5);
    if (mode === "role") while (mine.filter(Boolean).length < 4) mine[Math.floor(Math.random() * mine.length)] = true;
    dlg.items = idx.map((i, k) => ({ line: i, mine: mine[k], blanks: mode === "gap" ? blanksFor(lines[i].text) : [], score: null, tries: 0, state: "" }));
    const [de, fa] = DLG[mode];
    showPanel("pDlg", `${de} <span class="fa">· ${fa}</span>`);
    $("#dlgIntro").innerHTML = mode === "role"
      ? t("roleIntro")
      : mode === "gap" ? t("gapIntro")
      : t("readIntro");
    renderDlg();
    micGate(runDlg);
  }
  function lineHtml(it) {
    const l = lines[it.line];
    if (!it.blanks.length) return esc(l.text);
    return l.text.split(/(\s+)/).map(tok => {
      const w = cleanWord(tok);
      if (!w || !it.blanks.includes(w)) return esc(tok);
      // revealed (after success or when the answer is played): show the word highlighted
      return it.reveal ? esc(tok).replace(esc(w), `<mark class="w-fill">${esc(w)}</mark>`) : esc(tok.replace(w, "_".repeat(Math.max(4, w.length))));
    }).join("");
  }
  // hint for words that were missed: first letter + meaning
  function hintFor(it) {
    const said = it.score ? nw(it.score.said || "") : [];
    const target = it.blanks.length ? it.blanks : window.Practice.words(lines[it.line].text);
    const miss = [...new Set(target.filter(w => !said.includes(window.Practice.norm(w))))].slice(0, 3);
    return miss.map(w => {
      const k = dictKey(w), fa = k ? DICT[k].fa : "";
      const shown = it.blanks.length ? w[0] + "…".padEnd(Math.min(w.length, 6), "·") : w;
      return `<span class="hint-chip"><b dir="ltr">${esc(shown)}</b>${fa ? ` <span class="fa">= ${esc(fa)}</span>` : ""}</span>`;
    }).join("");
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  /* ---------- Recorder: hold to talk (release = done) or tap once for hands-free
     (ends after 2 s of silence or another tap). Recognition restarts by itself if the
     browser cuts it at a pause, so a slow speaker is never cut off mid-sentence. ---------- */
  const rec = { on: false, r: null, finals: [], interim: "", locked: false, t0: 0, last: 0, err: null, tick: 0, onUpdate: null, onDone: null };
  function srSession() {
    const id = rec.id, mine = () => id === rec.id;
    const r = new SR(); r.lang = "de-DE"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3;
    r.onresult = ev => {
      if (!mine()) return;
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) rec.finals.push([...res].map(a => a.transcript));
        else interim += res[0].transcript;
      }
      rec.interim = interim; rec.last = Date.now(); rec.onUpdate?.();
    };
    r.onspeechstart = () => { if (!mine()) return; rec.last = Date.now(); document.body.classList.add("voice"); };
    r.onspeechend = () => document.body.classList.remove("voice");
    r.onerror = ev => { if (mine()) rec.err = ev.error || "error"; };
    r.onend = () => {
      if (!mine() || rec.r !== r) return;
      rec.r = null;
      if (rec.interim) { rec.finals.push([rec.interim]); rec.interim = ""; }
      const fatal = rec.err === "not-allowed" || rec.err === "service-not-allowed" || rec.err === "audio-capture";
      if (rec.on && !fatal) { rec.err = null; setTimeout(() => mine() && rec.on && !rec.r && srSession(), 60); return; }
      recDone();
    };
    rec.r = r;
    try { r.start(); } catch { rec.r = null; recDone(); }
  }
  let recOpts = {};
  function recStart(onUpdate, onDone) {
    stopListening();
    rec.id = (rec.id || 0) + 1;
    Object.assign(rec, { on: true, finals: [], interim: "", locked: false, t0: Date.now(), last: 0, err: null, onUpdate, onDone, finished: false, max: 30000, silence: 2000 }, recOpts);
    recOpts = {};
    document.body.classList.add("recording");
    srSession();
    clearInterval(rec.tick);
    rec.tick = setInterval(() => {
      const el = $("#rpTime"); if (el) el.textContent = fmt((Date.now() - rec.t0) / 1000);
      $$(".js-rectime").forEach(e => e.textContent = fmt((Date.now() - rec.t0) / 1000));
      if (rec.locked && Date.now() - (rec.last || rec.t0) > rec.silence) recStop();
      if (Date.now() - rec.t0 > rec.max) recStop();
    }, 200);
  }
  function recStop() {
    if (!rec.on) return;
    rec.on = false;
    const id = rec.id;
    if (rec.r) { try { rec.r.stop(); } catch {} setTimeout(() => { if (id === rec.id && !rec.finished) { rec.r = null; recDone(); } }, 2500); }
    else recDone();
  }
  function recCancel() { rec.onDone = null; rec.on = false; try { rec.r?.abort(); } catch {} rec.r = null; recDone(); rec.id = (rec.id || 0) + 1; }
  function recDone() {
    if (rec.finished) return;
    rec.finished = true; rec.on = false;
    clearInterval(rec.tick); document.body.classList.remove("recording", "voice");
    const segs = rec.finals.slice(); if (rec.interim) segs.push([rec.interim]);
    const alts = [0, 1, 2].map(k => segs.map(sg => sg[k] || sg[0]).join(" ").trim());
    const cb = rec.onDone; rec.onDone = null;
    cb?.([...new Set(alts)].filter(Boolean), rec.err);
  }
  const recText = () => [...rec.finals.map(sg => sg[0]), rec.interim].join(" ");

  /* ---------- Free speaking: free · topic · cue prompts ----------
     Every spoken word is looked up in the whole dictionary (including verb forms)
     and coloured live: blue = topic word, green = this lesson, yellow = other lesson. */
  const fs = { run: 0, mode: "", scope: "lesson", auto: store.get("fsAuto", false), topic: null, set: null, qi: 0, answers: [], text: "" };
  let formIdx = null;
  function formIndex() {
    if (formIdx) return formIdx;
    formIdx = {};
    for (const [k, v] of Object.entries(DICT)) if ((v.p || "").includes("فعل") && window.Grammar) {
      try { const vb = window.Grammar.verb(k); vb.rows.forEach(r => [r.pr, r.pt].forEach(f => { const w = f.split(" ")[0].toLowerCase(); formIdx[w] ??= k; })); formIdx[vb.pp.toLowerCase()] ??= k; } catch {}
    }
    return formIdx;
  }
  const wordKey = w => w && (dictKey(w) || formIndex()[w.toLowerCase()] || null);
  let kLess = null, kLessFor = -1;
  function keyLessons() {
    if (kLess && kLessFor === state.idx) return kLess;
    kLess = {}; kLessFor = state.idx;
    LESSONS.forEach((L, i) => (Array.isArray(L.words) ? L.words : i === state.idx ? lessonKeys(L, lines) : []).forEach(k => (kLess[k] ||= []).push(i)));
    return kLess;
  }
  const speakData = () => (LESSONS[state.idx] || {}).speak || { topics: [], cues: [] };
  function classify(text) {
    const toks = text.split(/\s+/).filter(Boolean), kl = keyLessons();
    const topicSet = fs.mode === "topic" && fs.topic ? new Set(fs.topic.words.split(" ").map(w => w.toLowerCase())) : null;
    return toks.map(tok => {
      const w = cleanWord(tok), k = wordKey(w);
      let cls = "";
      if (k) {
        const ls = kl[k] || [];
        if (topicSet && (topicSet.has(k.replace(/_.*/, "").toLowerCase()) || topicSet.has(w.toLowerCase()))) cls = "tw";
        else if (fs.scope === "all" && fs.mode === "free") cls = "lw";
        else cls = ls.includes(state.idx) ? "lw" : ls.length ? "ow" : "dw";
      } else if (topicSet && topicSet.has(w.toLowerCase())) cls = "tw";
      return { tok, w, k, cls };
    });
  }
  // interim words are coloured too (slightly faded) so feedback is immediate
  const liveHtml = (fin, interim) => {
    const part = (txt, extra) => classify(txt).map(x => `<span class="${x.cls} ${extra}">${esc(x.tok)}</span>`).join(" ");
    return part(fin, "") + (interim ? " " + part(interim, "int") : "") + `<span class="cursor"></span>`;
  };
  function startFree(mode) {
    stopListening(); recCancel(); fs.run++; fs.mode = mode; fs.qi = 0; fs.answers = []; fs.text = "";
    const sd = speakData();
    if (mode === "topic") fs.topic = sd.topics[Math.floor(Math.random() * sd.topics.length)];
    if (mode === "cue") fs.set = sd.cues[Math.floor(Math.random() * sd.cues.length)];
    const T = { free: ["Frei sprechen", t("fsFreeSub")], topic: ["Thema", t("fsTopicSub")], cue: ["Stichpunkte", t("fsCueSub")] }[mode];
    showPanel("pFree", `${T[0]} <span class="fa">· ${esc(T[1])}</span>`);
    $("#fsRes").hidden = true; $("#fsLive").hidden = false; $("#fsBar").hidden = false; $("#fsCnt").hidden = false;
    renderFreeTop(); renderFreeLive("", "");
    $("#fsAuto").classList.toggle("on", fs.auto);
    $("#fsMic").innerHTML = MIC_SVG;
    freeGate();
  }
  // ask for the microphone once, with a clear message if it is blocked
  function freeGate() {
    $("#fsLive").innerHTML = `<div class="fs-gate"><button class="btn big" id="fsStart">🎤 Start</button></div>`;
    $("#fsBar").hidden = true;
    $("#fsStart").onclick = async () => {
      unlockAudio();
      const r = await ensureMic();
      if (!r.ok) { $("#fsLive").innerHTML = `<div class="fs-gate"><p class="fa warn mic-msg">${MIC_MSG[r.why]}</p><button class="btn big" id="fsStart">🎤 ${t("allowAgain")}</button></div>`; $("#fsStart").onclick = freeGate; return; }
      $("#fsBar").hidden = false; $("#fsLive").innerHTML = ""; renderFreeLive("", ""); freeRecStart();
    };
  }
  function renderFreeTop() {
    const lang = I18N.lang, sd = speakData();
    if (fs.mode === "free") $("#fsTop").innerHTML = `<div class="ly-seg" id="fsScope"><button data-sc="lesson" class="${fs.scope === "lesson" ? "on" : ""}">Lektion ${state.idx + 1}</button><button data-sc="all" class="${fs.scope === "all" ? "on" : ""}">Alle Wörter</button></div><p class="fa fs-hint">${t("fsHintFree")}</p>`;
    if (fs.mode === "topic") { const tp = fs.topic || {}; $("#fsTop").innerHTML = `<div class="topic"><div class="k">THEMA · <span class="fa">موضوع</span></div><b>${esc(tp.de || "")}</b><div class="fa">${esc(tp[lang] || tp.fa || "")}</div><button class="tp-new" id="fsNewTopic" aria-label="anderes Thema">↻</button></div>`; }
    if (fs.mode === "cue") $("#fsTop").innerHTML = `<div class="prompts">${fs.set.items.map((q, i) => { const a = fs.answers[i]; const st = a ? (a.ok ? "done" : "part") : i === fs.qi ? "cur" : ""; return `<div class="q ${st}"><span class="n">${a ? (a.ok ? "✓" : "~") : i + 1}</span><span><b>${esc(q.q)}</b> <small class="fa">${esc(q.fa)}</small></span></div>`; }).join("")}</div>`;
    $("#fsNext").hidden = fs.mode !== "cue";
  }
  $("#fsTop").addEventListener("click", e => {
    const sc = e.target.closest("[data-sc]"); if (sc) { fs.scope = sc.dataset.sc; renderFreeTop(); renderFreeLive(fs.text, ""); return; }
    if (e.target.closest("#fsNewTopic")) { const tps = speakData().topics; fs.topic = tps[(tps.indexOf(fs.topic) + 1) % tps.length]; renderFreeTop(); renderFreeLive(fs.text, ""); }
  });
  function renderFreeLive(fin, interim) {
    const cl = classify(fin), words = cl.filter(x => /[a-zäöüß]/i.test(x.w));
    const uniq = new Set(cl.filter(x => x.k).map(x => x.k));
    const lessonU = new Set(cl.filter(x => x.cls === "lw" || x.cls === "tw").map(x => x.k || x.w));
    const legend = fs.mode === "topic" ? `<span class="c-tw">● Thema</span> <span class="c-lw">● Lektion</span>` : fs.mode === "free" && fs.scope === "all" ? `<span class="c-lw">● Wörterbuch</span>` : `<span class="c-lw">● Lektion ${state.idx + 1}</span> <span class="c-ow">● andere</span>`;
    $("#fsCnt").innerHTML = `<div><b>${words.length}</b>Wörter gesagt</div><div><b class="c-lw">${fs.mode === "topic" ? cl.filter(x => x.cls === "tw").length : lessonU.size}</b>${fs.mode === "topic" ? "zum Thema" : fs.scope === "all" && fs.mode === "free" ? "im Wörterbuch" : "aus Lektion " + (state.idx + 1)}</div><div><b>${uniq.size}</b>verschiedene</div>`;
    if (!$("#fsLive .fs-gate")) $("#fsLive").innerHTML = `<div class="k"><span>LIVE · <span class="fa">هم‌زمان</span></span><span id="fsLegend">${legend}</span></div><div class="lv" dir="ltr">${fin || interim ? liveHtml(fin, interim) : `<span class="ph fa">${fs.mode === "cue" ? t("fsHintCue") : "🎤 …"}</span>`}</div>`;
    const lv = $("#fsLive .lv"); if (lv) lv.scrollTop = lv.scrollHeight;
  }
  function freeRecStart() {
    if (rec.on) return;
    const run = fs.run;
    recOpts = fs.mode === "cue" ? { max: 60000, silence: 2500 } : { max: 300000, silence: 6000 };
    recStart(() => { if (run !== fs.run) return; renderFreeLive(fs.text + " " + rec.finals.map(sg => sg[0]).join(" "), rec.interim); },
      (alts, err) => { if (run === fs.run) freeDone(alts, err); });
    if (fs.auto) { rec.locked = true; document.body.classList.add("rec-locked"); }
  }
  $("#fsMic").addEventListener("click", () => { unlockAudio(); rec.on ? recStop() : freeRecStart(); });
  $("#fsAuto").addEventListener("click", () => { fs.auto = !fs.auto; store.set("fsAuto", fs.auto); $("#fsAuto").classList.toggle("on", fs.auto); if (rec.on) { rec.locked = fs.auto; document.body.classList.toggle("rec-locked", fs.auto); } });
  $("#fsNext").addEventListener("click", () => { if (rec.on) { recStop(); return; } if (fs.mode === "cue") { fs.answers[fs.qi] ||= { ok: false, said: "" }; nextCue(); } });
  function freeDone(alts, err) {
    document.body.classList.remove("rec-locked");
    if (err === "not-allowed" || err === "service-not-allowed") { $("#fsLive").innerHTML = `<p class="fa warn mic-msg">${MIC_MSG.denied}</p>`; return; }
    const said = (alts[0] || "").trim();
    if (fs.mode === "cue") {
      const q = fs.set.items[fs.qi], ok = said && cueMatch(q, alts);
      fs.answers[fs.qi] = { ok: !!ok, said };
      if (ok) logDay("s", 1);
      renderFreeTop();
      renderFreeLive(said, "");
      const lg = $("#fsLegend"); if (lg) lg.innerHTML = ok ? `<span class="c-lw">✓ passt zur Frage</span>` : `<span class="c-ow">~ ${said ? "Beispiel: " + esc(q.ex) : t("fsNotHeard")}</span>`;
      const run = fs.run;
      if (ok) { setTimeout(() => run === fs.run && nextCue(), 1400); return; }
      // not yet: one more try, then show the example and move on
      fs.tries = (fs.tries || 0) + 1;
      if (fs.tries >= 2) setTimeout(() => run === fs.run && nextCue(), 2600);
      else { fs.answers[fs.qi] = undefined; renderFreeTop(); if (fs.auto) setTimeout(() => run === fs.run && freeRecStart(), 1800); }
      return;
    }
    fs.text = (fs.text + " " + said).trim();
    renderFreeLive(fs.text, "");
    if (fs.text) showFreeResult();
  }
  function cueMatch(q, alts) {
    return alts.some(a => { const ws = new Set(window.Practice.words(window.Practice.norm(a))); return q.need.some(group => group.every(pat => pat.split("|").some(p => ws.has(window.Practice.norm(p))))); });
  }
  function nextCue() {
    fs.tries = 0; fs.qi++;
    if (fs.qi >= fs.set.items.length) { showFreeResult(); return; }
    renderFreeTop(); renderFreeLive("", "");
    if (fs.auto) freeRecStart();
  }
  function showFreeResult() {
    stopListening(); recCancel();
    const kl = keyLessons(), best = store.get("fs", {});
    let html = "";
    if (fs.mode === "cue") {
      const ok = fs.answers.filter(a => a && a.ok).length, n = fs.set.items.length, pct = Math.round(ok / n * 100);
      best.cue = Math.max(best.cue || 0, pct);
      html = `<div class="big">${ringSvgP(pct)}<div><b>${ok} / ${n}</b><span>Antworten passen</span></div></div>` + fs.set.items.map((q, i) => { const a = fs.answers[i] || {}; return `<div class="qres"><span class="s" style="color:${a.ok ? "#30D158" : "#FF9F0A"}">${a.ok ? "✓" : "~"}</span><div><b>${esc(q.q)}</b><small>${a.said ? "„" + esc(a.said) + "“" : `<span class="fa">${t("fsNotHeard")}</span>`}${a.ok ? "" : ` · <i>${esc(q.ex)}</i>`}</small></div></div>`; }).join("");
    } else {
      const cl = classify(fs.text), words = cl.filter(x => /[a-zäöüß]/i.test(x.w)).length;
      const used = [...new Map(cl.filter(x => x.k).map(x => [x.k, x])).values()];
      const inL = used.filter(x => (kl[x.k] || []).includes(state.idx)), other = used.filter(x => !(kl[x.k] || []).includes(state.idx));
      const chip = x => `<button class="${x.cls}" data-entry="${esc(x.k)}">${esc(x.k.replace(/_.*/, ""))}</button>`;
      const notUsed = shuffleArr(vocabList.filter(v => !used.some(u => u.k === v.key) && /^(اسم|فعل|صفت)/.test(v.p || ""))).slice(0, 8);
      if (fs.mode === "topic") {
        const tw = used.filter(x => x.cls === "tw"), content = used.filter(x => /^(اسم|فعل|صفت)/.test(DICT[x.k]?.p || ""));
        const rel = content.length ? Math.round(tw.length / content.length * 100) : 0;
        best.topic = Math.max(best.topic || 0, rel);
        const miss = fs.topic.words.split(" ").filter(w => !used.some(u => u.k.replace(/_.*/, "").toLowerCase() === w.toLowerCase())).slice(0, 8);
        html = `<div class="big">${ringSvgP(rel)}<div><b>${tw.length} Themenwörter</b><span class="fa">${tw.length >= 3 ? t("fsTopicOk") : t("fsTopicLow")} · ${rel}% · ${words} Wörter</span></div></div>
          <div class="rh">THEMA · <span class="fa">${t("fsUsed")}</span></div><div class="chipsw">${tw.map(chip).join("") || "—"}</div>
          <div class="rh">ANDERE WÖRTER</div><div class="chipsw">${used.filter(x => x.cls !== "tw").map(chip).join("") || "—"}</div>
          <div class="rh">${t("fsTry").toUpperCase()}</div><div class="chipsw">${miss.map(w => `<span class="m">${esc(w)}</span>`).join("")}</div>`;
      } else if (fs.scope === "all") {
        best.free = Math.max(best.free || 0, used.length);
        html = `<div class="big">${ringSvgP(Math.min(100, used.length * 2))}<div><b>${used.length} Wörter</b><span class="fa">از دیکشنری · ${words} کلمه گفتی · روی هر کلمه بزن تا سطح و درسش را ببینی</span></div></div>
          <div class="rh">${t("fsUsed").toUpperCase()}</div><div class="chipsw">${used.map(chip).join("") || "—"}</div>`;
      } else {
        best.free = Math.max(best.free || 0, inL.length);
        html = `<div class="big">${ringSvgP(Math.round(inL.length / (vocabList.length || 1) * 100 * 5))}<div><b>${inL.length} aus Lektion ${state.idx + 1}</b><span>${other.length} aus anderen Lektionen / Wörterbuch · ${words} Wörter gesagt</span></div></div>
          <div class="rh">LEKTION ${state.idx + 1}</div><div class="chipsw">${inL.map(chip).join("") || "—"}</div>
          ${other.length ? `<div class="rh">ANDERE</div><div class="chipsw">${other.map(chip).join("")}</div>` : ""}
          <div class="rh">${t("fsTry").toUpperCase()}</div><div class="chipsw">${notUsed.map(v => `<button class="m" data-entry="${esc(v.key)}">${esc(v.de)}</button>`).join("")}</div>`;
      }
      const sentences = (fs.text.match(/[^.!?]+/g) || []).filter(x => x.trim().split(/\s+/).length >= 3).length || Math.floor(words / 6);
      if (sentences) logDay("s", Math.min(sentences, 20));
    }
    store.set("fs", best);
    $("#fsRes").innerHTML = html + `<div class="fs-acts"><button class="vs-b sec" id="fsAgain">↻ Nochmal</button></div>`;
    $("#fsRes").hidden = false; $("#fsLive").hidden = true; $("#fsBar").hidden = true; $("#fsCnt").hidden = true;
    if (fs.mode === "cue") $("#fsTop").innerHTML = "";
    $("#fsAgain").onclick = () => startFree(fs.mode);
  }
  $("#fsRes").addEventListener("click", e => { const b = e.target.closest("[data-entry]"); if (b) openEntry(b.dataset.entry); });
  const ringSvgP = pct => `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="4" opacity=".12"/><circle cx="18" cy="18" r="15" fill="none" stroke="#30D158" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${Math.min(100, pct)} 100" transform="rotate(-90 18 18)" ${pct ? "" : 'opacity="0"'}/></svg>`;

  /* ---------- Dialog as a chat: partner lines play, your line waits for the mic ---------- */
  function bubble(it, k) {
    const l = lines[it.line], cur = k === dlg.i;
    if (!it.mine) return `<div class="rb them"><div class="rb-who">${esc(l.who)}</div><div class="rb-de">${esc(l.text)}</div><div class="rb-fa fa">${esc(l.fa || "")}</div></div>`;
    let body;
    if (cur && rec.on && !it.blanks.length) body = wordsHtml(l.text, matchWords(l.text, [recText()]), "w-pend");
    else if (it.score && (it.score.ok || it.reveal || !cur)) body = it.score.html;
    else body = lineHtml(it);
    return `<div class="rb mine ${cur ? "now" : "done"}${it.score && !cur ? (it.score.ok ? " ok" : " bad") : ""}"><div class="rb-de" id="${cur ? "rbNow" : ""}">${body}</div>${!cur && it.score ? `<div class="rb-pc">${it.score.self ? "✓" : Math.round(it.score.pct * 100) + "%"}</div>` : ""}</div>`;
  }
  function renderDlg() {
    const list = $("#dlgList");
    list.innerHTML = dlg.items.slice(0, dlg.i + 1).map(bubble).join("");
    list.scrollTop = list.scrollHeight;
    $("#pProg").textContent = `${Math.min(dlg.i + 1, dlg.items.length)} / ${dlg.items.length}`;
  }
  const MIC_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg>';
  function renderBar(mode) { // mode: wait | ready
    $("#dlgFoot").innerHTML = `<div class="rp-bar ${mode}">
      <div class="rp-idle"><span class="fa">${mode === "wait" ? t("rpWait") : t("rpHold")}</span></div>
      <div class="rp-live"><span class="rec-dot"></span><span class="rp-time" id="rpTime">0:00</span><span class="rp-wave">${"<i></i>".repeat(24)}</span><span class="rp-lock fa">${t("rpLocked")}</span></div>
      <button class="rp-mic" id="rpMic" ${mode === "wait" ? "disabled" : ""} aria-label="Mikrofon">${MIC_SVG}</button></div>`;
    const btn = $("#rpMic"); if (mode === "wait") return;
    let pressT = 0;
    const down = e => {
      e.preventDefault();
      if (rec.on) { recStop(); return; } // second tap ends hands-free mode
      pressT = Date.now();
      try { btn.setPointerCapture(e.pointerId); } catch {}
      recStart(() => { const el = $("#rbNow"); const it = dlg.items[dlg.i]; if (el && it && !it.blanks.length) el.innerHTML = wordsHtml(lines[it.line].text, matchWords(lines[it.line].text, [recText()]), "w-pend"); },
        (alts, err) => turnDone(alts, err));
      renderDlg();
    };
    const up = () => {
      if (!rec.on || !pressT) return;
      if (Date.now() - pressT < 350) { rec.locked = true; document.body.classList.add("rec-locked"); }
      else recStop();
      pressT = 0;
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("contextmenu", e => e.preventDefault());
  }
  function turnDone(alts, err) {
    document.body.classList.remove("rec-locked");
    const it = dlg.items[dlg.i]; if (!it) return;
    if (err === "not-allowed" || err === "service-not-allowed") { micGate(() => renderBar("ready")); $("#dlgFoot").insertAdjacentHTML("afterbegin", `<p class="fa warn mic-msg">${MIC_MSG.denied}</p>`); return; }
    it.tries++;
    it.score = scoreSpeech(lines[it.line].text, alts, it.blanks);
    if (it.blanks.length && (it.score.ok || it.tries >= 2)) it.reveal = true;
    renderDlg();
    showSheet(it, alts);
  }
  function showSheet(it, alts) {
    const sc = it.score, l = lines[it.line];
    const pc = Math.round(sc.pct * 100);
    const miss = sc.hits.filter(h => !h.ok).map(h => cleanWord(h.tok)).filter(Boolean);
    const verdict = !alts.length ? t("rpNothing") : sc.ok ? (pc >= 90 ? "Sehr gut!" : "Gut!") : t("rpAgain");
    $("#dlgSheet").innerHTML = `<div class="sh-grab"></div>
      <div class="sh-score"><span class="sh-pc ${sc.ok ? "ok" : "bad"}">${alts.length ? pc + "%" : "—"}</span>
        <div><b class="${sc.ok ? "" : "fa"}">${verdict}</b><div class="sh-legend"><span class="g">erkannt</span><span class="r">nicht gehört</span></div></div></div>
      <div class="sh-line">${it.blanks.length && !it.reveal ? lineHtml(it) : sc.html}</div>
      ${alts.length && (!it.blanks.length || it.reveal) ? `<div class="sh-heard">🎧 <span>Gehört: „${esc(alts[0])}“</span>${miss.length ? ` <span class="fa">· ${esc(miss.slice(0, 3).join("، "))} ${t("rpNotHeard")}</span>` : ""}</div>` : ""}
      <div class="fa sh-fa">${esc(l.fa || "")}</div>
      <div class="sh-acts"><button class="sh-b sec" id="shAgain">↺ Nochmal</button><button class="sh-b sec sq" id="shPlay" aria-label="anhören">🔊</button><button class="sh-b ${sc.ok ? "pri" : "sec"}" id="shNext">Weiter ›</button></div>`;
    $("#dlgSheet").hidden = false;
    $("#shAgain").onclick = () => { $("#dlgSheet").hidden = true; it.score = null; it.reveal = false; renderDlg(); };
    $("#shPlay").onclick = () => playClip(it.line);
    $("#shNext").onclick = () => { $("#dlgSheet").hidden = true; dlg.resolve?.(); };
    // two misses: let the learner hear the right answer
    if (!sc.ok && it.tries >= 2) playClip(it.line);
  }
  async function runDlg() {
    const run = dlg.run;
    while (dlg.i < dlg.items.length && run === dlg.run) {
      const it = dlg.items[dlg.i];
      renderDlg();
      if (!it.mine) { renderBar("wait"); await playClip(it.line); if (run !== dlg.run) return; await wait(300); dlg.i++; continue; }
      if (!SR) { $("#dlgFoot").innerHTML = `<button class="btn big" id="rpSelf">✓ <span class="fa">${t("iSaidIt")}</span></button>`; }
      else renderBar("ready");
      await new Promise(res => { dlg.resolve = res; if (!SR) $("#rpSelf").onclick = () => { it.score = { ok: true, pct: 1, self: true, html: esc(lines[it.line].text), hits: [] }; res(); }; });
      dlg.resolve = null;
      if (run !== dlg.run) return;
      dlg.i++;
    }
    if (run === dlg.run && dlg.i >= dlg.items.length) finishDlg();
  }
  function finishDlg() {
    const mine = dlg.items.filter(x => x.mine && x.score);
    const avg = mine.length ? Math.round(mine.reduce((a, x) => a + x.score.pct, 0) / mine.length * 100) : 0;
    const st = store.get("dlg", {}); st[dlg.mode] = Math.max(st[dlg.mode] || 0, avg); store.set("dlg", st);
    dlg.i = dlg.items.length - 1; renderDlg(); dlg.i = dlg.items.length;
    $("#dlgFoot").innerHTML = `<div class="dlg-sum"><b>${avg}%</b> <span class="fa">${t("saidCorrectly")}</span></div>
      <button class="btn big" id="dlgAgain">↻ Nochmal · <span class="fa">${t("newLines")}</span></button>`;
    $("#dlgAgain").onclick = () => startDialog(dlg.mode);
  }

  /* ---------- Exam: 10–15 random questions from all exercise types ---------- */
  const exam = { active: false, items: [], k: 0, right: 0 };
  function startExam() {
    const n = 10 + Math.floor(Math.random() * 6), nFc = 2 + Math.floor(Math.random() * 2);
    const byType = {}; shuffleArr(ex.list).forEach(e => (byType[e.type] ||= []).push(e));
    const picks = []; let t = 0; const types = Object.keys(byType);
    while (picks.length < n - nFc && types.length) { const arr = byType[types[t++ % types.length]]; if (arr.length) picks.push({ kind: "ex", id: arr.pop().id }); }
    for (let k = 0; k < nFc; k++) picks.push({ kind: "fc" });
    Object.assign(exam, { active: true, items: shuffleArr(picks), k: -1, right: 0 });
    $("#pView").classList.add("exam");
    examNext();
  }
  function examRecord(ok) { const it = exam.items[exam.k]; if (it && it.res === undefined) { it.res = ok; if (ok) exam.right++; } }
  function examNext() {
    exam.k++;
    const title = `Prüfung <span class="fa">· ${t("exam")}</span>`;
    if (exam.k >= exam.items.length) return examEnd();
    const it = exam.items[exam.k];
    if (it.kind === "ex") { ex.filter = "all"; ex.i = it.id; showPanel("pEx", title); renderExercise(); }
    else { showPanel("pFc", title); nextCard(); }
    $("#pProg").textContent = `${exam.k + 1} / ${exam.items.length}`;
  }
  function examEnd() {
    const n = exam.items.length, pct = Math.round(exam.right / n * 100);
    const best = Math.max(store.get("exam" + LESSONS[state.idx].id, 0), pct); store.set("exam" + LESSONS[state.idx].id, best);
    exam.active = false;
    showPanel("pEnd", `Prüfung <span class="fa">· ${t("exam")}</span>`);
    $("#pEnd").innerHTML = `<div class="exam-end">
      <div class="exam-score">${exam.right} / ${n}</div>
      <div class="exam-pct ${pct >= 70 ? "ok" : "bad"}">${pct}%</div>
      <p class="fa">${pct >= 90 ? t("examGreat") : pct >= 70 ? t("examGood") : t("examRetry")}</p>
      <p class="fa muted">${t("bestResult")} ${best}%</p>
      <button class="btn big" id="examAgain">↻ Neue Prüfung · <span class="fa">${t("newExam")}</span></button></div>`;
    $("#examAgain").onclick = startExam;
  }

  /* ---------- Dialog: translation toggle, word popup ---------- */
  const faBtn = $("#faBtn");
  const applyMobileFa = on => { faBtn.setAttribute("aria-pressed", on); document.body.classList.toggle("no-fa", !on); store.set("showFa", on); };
  faBtn.onclick = () => applyMobileFa(faBtn.getAttribute("aria-pressed") !== "true");
  applyMobileFa(store.get("showFa", true));

  const DICT = window.DICT || {}, NAMES = window.NAMES || {}, dictIdx = {};
  for (const [k, v] of Object.entries(DICT)) {
    for (const f of [k.replace(/_.*/, ""), ...(v.f || [])]) { dictIdx[f] = k; dictIdx[f.toLowerCase()] ??= k; }
  }
  function dictKey(w) { return dictIdx[w] || dictIdx[w.toLowerCase()]; }
  function lookup(w) {
    if (NAMES[w]) return { lemma: w, p: "اسم خاص", fa: NAMES[w], g: "" };
    const k = dictIdx[w] || dictIdx[w.toLowerCase()];
    if (k) return { lemma: k.replace(/_.*/, ""), ...DICT[k] };
    if (/^[a-z'-]+$/i.test(w) && !/[äöüß]/i.test(w)) return { lemma: w, p: "انگلیسی", fa: t("englishWord"), g: "" };
    return { lemma: w, p: "", fa: t("noMeaning"), g: "" };
  }
  function openWord(w) {
    const d = lookup(w), l = lines[curLine];
    markSeen(dictKey(w));
    $("#popWord").textContent = w;
    $("#popLemma").textContent = d.lemma.toLowerCase() !== w.toLowerCase() ? `← ${d.lemma}` : "";
    $("#popPos").textContent = I18N.pos(d.p); $("#popPos").hidden = !d.p;
    $("#popFa").textContent = d.fa;
    $("#popG").innerHTML = d.g ? d.g.split(" · ").map(x => `<div>${esc(x)}</div>`).join("") : "";
    $("#popSay").dataset.say = w;
    $("#popCtx").innerHTML = l ? l.text.split(/(\s+)/).map(tok =>
      tok.replace(/^[^A-Za-zÄÖÜäöüß]+|[^A-Za-zÄÖÜäöüß'-]+$/g, "") === w ? `<mark>${esc(tok)}</mark>` : esc(tok)).join("") : "";
    $("#popCtxFa").textContent = l ? l.fa : "";
    $("#popBack").hidden = false;
  }
  const closeWord = () => { $("#popBack").hidden = true; };
  $("#popClose").onclick = closeWord;
  $("#popBack").addEventListener("click", e => { if (e.target.id === "popBack") closeWord(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeWord(); });
  $("#popSay").innerHTML = SAY_ICON;

  /* ---------- Interface language ---------- */
  function applyDictLang() {
    const lang = I18N.lang, col = lang === "ru" ? 0 : 1, TRD = window.DICT_TR || {}, NT = (window.NAMES_TR || {})[lang] || {};
    for (const [k, d] of Object.entries(DICT)) {
      if (d.fa0 === undefined) { d.fa0 = d.fa; d.g0 = d.g; }
      d.fa = lang === "fa" ? d.fa0 : ((TRD[k] || [])[col] || d.fa0);
      d.g = lang === "fa" ? d.g0 : ""; // grammar notes are written in Persian only
    }
    if (!window.NAMES0) window.NAMES0 = { ...NAMES };
    for (const n of Object.keys(NAMES)) NAMES[n] = lang === "fa" ? window.NAMES0[n] : (NT[n] || window.NAMES0[n]);
  }
  function applyLang() {
    applyDictLang(); I18N.apply();
    $$(".js-lang-code").forEach(e => e.textContent = I18N.lang.toUpperCase());
    if (LESSONS.length) setLesson(state.idx);
    if (!$("#profBack").hidden) renderProfile();
    if (!$("#pView").hidden) closeView();
  }
  window.addEventListener("lapp:lang", applyLang);
  const langMenu = $("#langMenu");
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-lang-btn]");
    if (b) {
      e.stopPropagation();
      langMenu.innerHTML = I18N.langs.map(l => `<button data-set-lang="${l}" class="${l === I18N.lang ? "on" : ""}"><b>${l.toUpperCase()}</b> ${I18N.name(l)}</button>`).join("");
      const r = b.getBoundingClientRect();
      langMenu.style.left = Math.max(8, Math.min(innerWidth - 200, r.right - 190)) + "px";
      if (r.top > innerHeight / 2) { langMenu.style.top = ""; langMenu.style.bottom = (innerHeight - r.top + 8) + "px"; }
      else { langMenu.style.bottom = ""; langMenu.style.top = (r.bottom + 8) + "px"; }
      langMenu.hidden = !langMenu.hidden; return;
    }
    const sl = e.target.closest("[data-set-lang]");
    if (sl) { langMenu.hidden = true; I18N.setLang(sl.dataset.setLang); return; }
    if (!e.target.closest("#langMenu")) langMenu.hidden = true;
  });

  /* ---------- Profile ---------- */
  const initial = n => (n || "").trim().charAt(0).toUpperCase() || "🙂";
  const paintAvatar = () => $$(".js-avatar").forEach(e => e.textContent = initial(store.get("name", "")));
  function renderProfile() {
    const L = LESSONS[state.idx];
    const known = vocabList.filter(v => state.known.has(v.key)).length;
    const res = exResults(), okEx = Object.values(res).filter(Boolean).length;
    const fcs = Object.values(store.get("fc", {})), fr = fcs.reduce((a, x) => a + x[0], 0), fw = fcs.reduce((a, x) => a + x[1], 0);
    const exam = store.get("exam" + L.id, 0), dl = store.get("dlg", {}), bestDlg = Math.max(0, ...Object.values(dl));
    $("#profName").value = store.get("name", "");
    $("#profName").placeholder = t("learner");
    const row = (label, val, pct) => `<div class="ps"><span class="fa">${label}</span><b dir="ltr">${val}</b>${pct != null ? `<i style="--p:${Math.round(pct)}%"></i>` : ""}</div>`;
    $("#profStats").innerHTML =
      row(t("wordsLearned"), `${known} / ${vocabList.length}`, known / (vocabList.length || 1) * 100) +
      row(t("exercisesDone"), `${okEx} / ${ex.list.length}`, okEx / (ex.list.length || 1) * 100) +
      row(t("flashcardsStat"), `${fr} / ${fw}`) +
      row(t("bestExam"), `${exam}%`, exam) +
      row(t("bestSpeaking"), `${bestDlg}%`, bestDlg);
    $("#profLang").innerHTML = I18N.langs.map(l => `<button data-set-lang="${l}" class="${l === I18N.lang ? "on" : ""}">${I18N.name(l)}</button>`).join("");
    paintAvatar();
  }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-profile]")) { renderProfile(); $("#profBack").hidden = false; }
  });
  $("#profClose").onclick = () => { $("#profBack").hidden = true; };
  $("#profBack").addEventListener("click", e => { if (e.target.id === "profBack") $("#profBack").hidden = true; });
  $("#profName").addEventListener("input", e => { store.set("name", e.target.value.trim()); paintAvatar(); });
  $("#profReset").onclick = () => {
    if (!confirm(t("resetConfirm"))) return;
    try { Object.keys(localStorage).filter(k => k.startsWith("lapp:") && !/^lapp:(lang|name)$/.test(k)).forEach(k => localStorage.removeItem(k)); } catch {}
    location.reload();
  };
  paintAvatar();
  applyDictLang(); I18N.apply();
  $$(".js-lang-code").forEach(e => e.textContent = I18N.lang.toUpperCase());

  /* ---------- Landscape: side dock, left or right hand ---------- */
  const setDockSide = side => { document.body.classList.toggle("dock-left", side === "left"); store.set("dockSide", side); };
  setDockSide(store.get("dockSide", "right"));
  $("#dockSwap").addEventListener("click", () => setDockSide(document.body.classList.contains("dock-left") ? "right" : "left"));

  /* ---------- Lesson audio playing (not practice clips) ---------- */
  const markPlaying = () => document.body.classList.toggle("playing", !player.paused && clipStop == null);
  ["play", "pause", "ended"].forEach(ev => player.addEventListener(ev, markPlaying));

  /* ---------- Listening time (lesson audio and dialog clips) ---------- */
  let lastT = null, heard = 0;
  player.addEventListener("timeupdate", () => {
    const d = lastT == null ? 0 : player.currentTime - lastT; lastT = player.currentTime;
    if (!player.paused && d > 0 && d < 2) { heard += d; if (heard >= 10) { logDay("l", Math.round(heard)); heard = 0; } }
  });
  player.addEventListener("pause", () => { lastT = null; if (heard >= 1) { logDay("l", Math.round(heard)); heard = 0; } });

  /* ---------- Home: speak now, word of the day ---------- */
  $("#hSpeak").addEventListener("click", () => { go("practice"); $('#pHub [data-open="role"]')?.click(); });
  $("#wotdSay").addEventListener("click", e => { e.stopPropagation(); speak(e.currentTarget.dataset.word || ""); });

  /* ---------- Dock: the one player. While the lesson plays it fills the dock and the
     tabs fold into a round button; tapping that button brings the tabs back. ---------- */
  const setDock = collapsed => document.body.classList.toggle("dock-collapsed", collapsed);
  player.addEventListener("play", () => { if (clipStop == null) setDock(true); });
  $("#dockTabsBtn").addEventListener("click", () => setDock(false));

  /* ---------- Init ---------- */
  tick(); setInterval(tick, 10000);
  setSpeed(state.speed);
  if (LESSONS.length) setLesson(state.idx);
  const start = location.hash.slice(1);
  go(start && document.getElementById(start)?.classList.contains("screen") ? start : "home");
})();
