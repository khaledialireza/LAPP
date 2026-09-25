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
    const listHtml = lines.map((l, j) => `
      <div class="line ${l.who.toLowerCase()}" data-i="${j}"><span class="who">${esc(l.who)}</span>
      <span>${esc(l.text)} <button class="say" style="display:inline-grid;width:22px;height:22px;vertical-align:middle" data-say="${esc(l.text)}">${SAY_ICON}</button></span></div>`).join("");
    $("#mTranscript").innerHTML = listHtml;
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

  function showNow(i) {
    curLine = i;
    const l = lines[i];
    $("#mWho").textContent = l ? l.who : "";
    $("#mNum").textContent = l ? `${i + 1} / ${lines.length}` : "";
    $("#lineCard").className = "line-card " + (l ? l.who.toLowerCase() : "");
    $("#lcSay").dataset.say = l ? l.text : "";
    $("#mDe").innerHTML = l ? wordHtml(l.text) : "";
    $("#mFa").textContent = l ? l.fa : "";
    $("#hWho").textContent = l ? l.who : "";
    $("#hWho").className = "hp-who " + (l ? l.who.toLowerCase() : "");
    $("#hNum").textContent = l ? `${i + 1} / ${lines.length}` : "";
    $("#hNowLine").textContent = l ? l.text : "";
    $("#hNowFa").textContent = l ? l.fa : "";
    $("#dpLine").textContent = l ? l.text : "";
    $("#dpWho").textContent = l ? l.who : "";
  }

  const onLineClick = e => {
    const row = e.target.closest(".line"); if (!row || e.target.closest("[data-say]")) return;
    const l = lines[row.dataset.i];
    showNow(Number(row.dataset.i));
    setDrawer(false);
    if (player.duration) { player.currentTime = lineStart(l); player.play(); }
    else speak(l.text);
  };
  $("#mTranscript").addEventListener("click", onLineClick);
  ["#mSpkTabs"].forEach(id => $(id).addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.spk = b.dataset.spk; $$(`${id} button`).forEach(x => x.classList.toggle("on", x === b)); filterSpeakers();
  }));
  function filterSpeakers() {
    $$(".transcript .line").forEach(r => r.classList.toggle("hide", state.spk !== "all" && !r.classList.contains(state.spk)));
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
      $$(".transcript .line").forEach(r => r.classList.toggle("now", Number(r.dataset.i) === i));
      showNow(i);
      if ($("#mFollow").checked && $("#mTranscript").clientHeight > 0)
        $(`#mTranscript .line[data-i="${i}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
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
  function renderVocab() {
    const q = ($("#vocabSearch").value || "").trim().toLowerCase();
    const list = vocabList.filter(v => (state.vf === "all" || (state.vf === "known") === state.known.has(v.key))
      && (!q || v.de.toLowerCase().includes(q) || v.fa.includes(q)));
    const known = vocabList.filter(v => state.known.has(v.key)).length;
    $("#vocabCount").textContent = `${known} / ${vocabList.length}`;
    $("#vocabGrid").innerHTML = list.map(v => `
      <div class="card ${state.known.has(v.key) ? "known" : ""}" data-de="${esc(v.key)}"><div class="in">
        <div class="face front"><button class="say" data-say="${esc(v.de)}">${SAY_ICON}</button><div class="de">${esc(v.de)}</div><div class="en fa">${esc(I18N.pos(v.p))}</div></div>
        <div class="face back"><div class="fa v-fa">${esc(v.fa)}</div>
          ${v.g ? `<div class="fa v-g">${esc(v.g.split(" · ").slice(0, 2).join(" · "))}</div>` : ""}
          <button class="btn ghost" data-known style="font-size:12px;padding:6px 10px">${state.known.has(v.key) ? "✓ Gelernt" : "Als gelernt markieren"}</button></div>
      </div></div>`).join("") || `<p class="fa notice">${t("nothingHere")}</p>`;
  }
  $("#vocabGrid").addEventListener("click", e => {
    const c = e.target.closest(".card"); if (!c || e.target.closest("[data-say]")) return;
    if (e.target.closest("[data-known]")) {
      const de = c.dataset.de; state.known.has(de) ? state.known.delete(de) : state.known.add(de);
      store.set("known", [...state.known]); renderVocab(); renderProgress(); return;
    }
    c.classList.toggle("flip");
  });
  $("#vocabTabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.vf = b.dataset.vf; $$("#vocabTabs button").forEach(x => x.classList.toggle("on", x === b)); renderVocab();
  });
  $("#vocabSearch").addEventListener("input", () => renderVocab());

  function renderWotd() {
    if (!vocabList.length) return;
    const v = vocabList[new Date().getDate() * 7 % vocabList.length];
    $("#wotdDe").textContent = v.de; $("#wotdFa").textContent = v.fa; $("#wotdEn").textContent = I18N.pos(v.p);
  }
  function renderProgress() {
    const k = vocabList.filter(v => state.known.has(v.key)).length;
    const res = exResults(), ok = Object.values(res).filter(Boolean).length, n = ex.list.length || 1;
    const pct = Math.round((k / (vocabList.length || 1) * 0.4 + ok / n * 0.6) * 100);
    $("#ring").setAttribute("stroke-dasharray", `${pct} 100`);
    $("#ringTxt").textContent = pct + "%";
    $("#ringSub").textContent = `${k}/${vocabList.length} ${t("words")} · ${t("exercisesShort")} ${ok}/${ex.list.length}`;
  }

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
  // how much of `target` was said; `required` words must all be present
  function scoreSpeech(target, alts, required = []) {
    const tw = nw(target), req = required.map(w => window.Practice.norm(w));
    let best = null;
    for (const a of alts) {
      const said = nw(a), pool = said.slice();
      const hit = tw.map(w => { const k = pool.indexOf(w); if (k >= 0) { pool.splice(k, 1); return true; } return false; });
      const pct = hit.filter(Boolean).length / (tw.length || 1);
      const reqOk = req.every(w => said.includes(w));
      if (!best || pct + (reqOk ? 1 : 0) > best.pct + (best.reqOk ? 1 : 0)) best = { pct, reqOk, hit, said: a };
    }
    const toks = target.split(/\s+/); let wi = 0;
    const html = toks.map(t => { const has = nw(t).length; if (!has) return esc(t); const ok = best.hit[wi++]; return `<span class="${ok ? "w-ok" : "w-miss"}">${esc(t)}</span>`; }).join(" ");
    return { ...best, ok: best.pct >= 0.7 && best.reqOk, html };
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
    if (fc.dir === "fa") speak(v.de);
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
  function renderHub() {
    const res = exResults(), counts = {}, done = {};
    ex.list.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; if (res[e.id] === true) done[e.type] = (done[e.type] || 0) + 1; });
    $("#hubEx").innerHTML = Object.keys(counts).map(t => {
      const [de, fa] = window.Practice.TYPE_LABEL[t];
      return `<button class="hub-tile" data-open="ex:${t}"><span class="ht-ico">${TYPE_ICON[t] || "•"}</span><b>${de}</b><span class="fa">${fa}</span><span class="ht-prog">✓ ${done[t] || 0}/${counts[t]}</span></button>`;
    }).join("");
    renderMap();
  }
  function showPanel(id, title) {
    $("#pHub").hidden = true; $("#pView").hidden = false;
    $$("#pView .pv-panel").forEach(p => p.hidden = p.id !== id);
    $("#pTitle").innerHTML = title; $("#pProg").textContent = "";
  }
  function closeView() {
    exam.active = false; dlg.run++; stopListening();
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
    stopListening(); dlg.run++; dlg.mode = mode; dlg.i = 0;
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
  const STATE_TXT = { get listen() { return t("stListen"); }, get model() { return t("stModel"); }, get retry() { return t("stRetry"); }, get silent() { return t("stSilent"); }, them: "🔊" };
  // only the previous line and the current one are visible; the next line stays hidden
  function renderDlg() {
    const cur = dlg.i;
    $("#dlgList").innerHTML = dlg.items.map((it, k) => {
      if (k < cur - 1 || k > cur) return "";
      const l = lines[it.line], sc = it.score, st = k < cur ? "done" : "cur";
      const showScore = sc && sc.html && (k < cur || it.state !== "listen");
      return `<div class="dl ${it.mine ? "mine" : "them"} ${st}" data-k="${k}">
        <div class="dl-who">${esc(l.who)}${it.mine ? ` <span class="fa">(${t("you")})</span>` : ""}</div>
        <div class="dl-text">${it.reveal || !showScore || (it.blanks.length && !sc.ok) ? lineHtml(it) : sc.html}</div>
        ${sc && (k < cur || it.state !== "listen") ? `<div class="dl-res ${sc.ok ? "ok" : "bad"}">${sc.self ? "✓" : `${Math.round(sc.pct * 100)}%`} ${sc.said ? `<span class="said">«${esc(sc.said)}»</span>` : ""}</div>` : ""}
        ${k === cur && it.state ? `<div class="dl-state ${it.state}">${it.state === "listen" ? `<span class="mic-live"></span>` : ""}<span class="fa">${STATE_TXT[it.state] || ""}</span>${it.tries ? ` <span class="tries">${it.tries}×</span>` : ""}</div>` : ""}
        ${k === cur && it.hint ? `<div class="dl-hint"><span class="fa">${t("hintColon")}</span> ${it.hint}</div>` : ""}
        ${k === cur && it.mine && !SR ? `<div class="dl-act"><button class="btn" data-self="${k}">✓ <span class="fa">${t("iSaidIt")}</span></button></div>` : ""}
        ${k < cur ? `<div class="fa dl-fa">${esc(l.fa || "")}</div>` : ""}
      </div>`;
    }).join("");
    $("#pProg").textContent = `${Math.min(cur + 1, dlg.items.length)} / ${dlg.items.length}`;
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // listen with a time limit so a silent or stuck recognizer never blocks the lesson
  const listenFor = ms => Promise.race([listen(), new Promise((_, rej) => setTimeout(() => { stopListening(); rej("timeout"); }, ms))]);
  async function speakTurn(it, run) {
    const MAX = 2; // two wrong attempts → play the right answer and move on
    while (run === dlg.run) {
      it.state = "listen"; renderDlg();
      let alts = null;
      try { alts = await listenFor(10000); }
      catch (err) {
        if (run !== dlg.run) return;
        if (err === "not-allowed" || err === "service-not-allowed") { it.state = ""; renderDlg(); micGate(runDlg); $("#dlgFoot").insertAdjacentHTML("afterbegin", `<p class="fa warn mic-msg">${MIC_MSG.denied}</p>`); return "stop"; }
      }
      if (run !== dlg.run) return;
      it.tries++;
      if (alts && alts.length) it.score = scoreSpeech(lines[it.line].text, alts, it.blanks);
      if (it.score && it.score.ok && alts) { it.reveal = true; it.hint = ""; it.state = ""; renderDlg(); await wait(1100); return; }
      if (it.tries >= MAX) {
        it.reveal = true; it.hint = ""; it.state = "model"; renderDlg();
        await playClip(it.line); if (run !== dlg.run) return;
        await wait(700); it.state = ""; return;
      }
      it.hint = hintFor(it);
      it.state = alts ? "retry" : "silent"; renderDlg();
      await wait(1500);
    }
  }
  async function runDlg() {
    const run = dlg.run;
    while (dlg.i < dlg.items.length && run === dlg.run) {
      const it = dlg.items[dlg.i];
      if (!it.mine) { it.state = "them"; renderDlg(); await playClip(it.line); if (run !== dlg.run) return; it.state = ""; await wait(250); dlg.i++; continue; }
      if (!SR) { renderDlg(); micGate(runDlg); return; }
      const r = await speakTurn(it, run);
      if (r === "stop" || run !== dlg.run) return;
      dlg.i++;
    }
    if (run === dlg.run && dlg.i >= dlg.items.length) finishDlg();
  }
  $("#dlgList").addEventListener("click", e => {
    const self = e.target.closest("[data-self]"); if (!self) return;
    const it = dlg.items[dlg.i]; if (!it) return;
    it.score = { ok: true, pct: 1, self: true }; dlg.i++; runDlg();
  });
  function finishDlg() {
    const mine = dlg.items.filter(x => x.mine && x.score);
    const avg = mine.length ? Math.round(mine.reduce((a, x) => a + x.score.pct, 0) / mine.length * 100) : 0;
    const st = store.get("dlg", {}); st[dlg.mode] = Math.max(st[dlg.mode] || 0, avg); store.set("dlg", st);
    renderDlg();
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

  /* ---------- Dialog: translation toggle, drawer, word popup ---------- */
  const faBtn = $("#faBtn");
  const applyMobileFa = on => {
    faBtn.setAttribute("aria-pressed", on); $("#mFa").hidden = !on; store.set("showFa", on);
  };
  faBtn.onclick = () => applyMobileFa(faBtn.getAttribute("aria-pressed") !== "true");
  applyMobileFa(store.get("showFa", true));

  function setDrawer(open) {
    $("#drawer").classList.toggle("open", open);
    $("#drawerHandle").setAttribute("aria-expanded", open);
    if (open) $(`#mTranscript .line[data-i="${curLine}"]`)?.scrollIntoView({ block: "center" });
  }
  $("#drawerHandle").onclick = () => setDrawer(!$("#drawer").classList.contains("open"));

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
  $("#mDe").addEventListener("click", e => {
    const b = e.target.closest(".w"); if (!b) return;
    if (!player.paused) player.pause();
    openWord(b.dataset.w);
  });
  $("#popClose").onclick = closeWord;
  $("#popBack").addEventListener("click", e => { if (e.target.id === "popBack") closeWord(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeWord(); setDrawer(false); } });
  $("#lcSay").innerHTML = SAY_ICON; $("#popSay").innerHTML = SAY_ICON;

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
