(() => {
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
  let lines = [];

  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = t => isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}` : "0:00";
  const SAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg>';
  const PLAY = '<path d="M7 5v14l12-7z"/>', PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200);
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return toast("مرورگر از خواندن متن پشتیبانی نمی‌کند");
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
    $$(".nav button").forEach(b => b.classList.toggle("on", b.dataset.go === id));
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go);
    const a = e.target.closest("[data-act]"); if (a) act(a.dataset.act);
    const l = e.target.closest("[data-lesson]"); if (l) setLesson(state.idx + Number(l.dataset.lesson));
    const sp = e.target.closest("[data-speed]"); if (sp) setSpeed(state.speed + Number(sp.dataset.speed));
    const s = e.target.closest("[data-say]"); if (s) { e.stopPropagation(); speak(s.dataset.say); }
  });

  /* ---------- Clock ---------- */
  function tick() {
    const d = new Date();
    const t = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    $("#sbClock").textContent = t; $("#homeTime").textContent = t;
    $("#homeDate").textContent = d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
  }

  /* ---------- Lesson ---------- */
  function parseTranscript(raw) {
    return raw.split("\n").map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^\*\*(.+?):\*\*\s*(.*)$/);
      return m ? { who: m[1], text: m[2] } : { who: "", text: s };
    });
  }

  function setLesson(i) {
    if (i < 0 || i >= LESSONS.length) return toast("درس‌های بعدی به‌زودی اضافه می‌شوند");
    state.idx = i; store.set("lesson", i);
    const L = LESSONS[i];
    $("#dockLesson").textContent = "L" + L.id;
    $("#sbTitle").textContent = `Lektion ${L.id} · ${L.title}`;
    $("#hLessonTitle").textContent = L.title; $("#hLessonFa").textContent = L.fa; $("#hLevel").textContent = L.level;
    $("#lTitle").innerHTML = `Lektion ${L.id} <small>${esc(L.title)}</small>`;
    $("#lLevel").textContent = L.level; $("#lDe").textContent = L.title; $("#lSum").textContent = L.summary;
    $("#lessonList").innerHTML = LESSONS.map((x, j) => `<button class="chip" style="${j === i ? "background:var(--accent);color:#1b1024" : ""}" data-lesson="${j - i}">L${x.id}</button>`).join("");
    $("#phrases").innerHTML = L.phrases.map(([de, fa, note]) => `
      <div class="phrase"><button class="say" data-say="${esc(de)}">${SAY_ICON}</button>
      <span class="de">${esc(de)}</span><span class="fa">${esc(fa)}</span><span class="note fa">${esc(note)}</span></div>`).join("");

    // transcript
    lines = parseTranscript(L.transcript);
    const total = lines.reduce((n, l) => n + l.text.length, 0);
    let acc = 0;
    lines.forEach(l => { l.start = acc / total; acc += l.text.length; l.end = acc / total; });
    $("#transcript").innerHTML = lines.map((l, j) => `
      <div class="line ${l.who.toLowerCase()}" data-i="${j}"><span class="who">${esc(l.who)}</span>
      <span>${esc(l.text)} <button class="say" style="display:inline-grid;width:22px;height:22px;vertical-align:middle" data-say="${esc(l.text)}">${SAY_ICON}</button></span></div>`).join("");
    filterSpeakers();

    // audio
    player.src = L.audio; player.playbackRate = SPEEDS[state.speed];
    $("#hNowLine").textContent = lines[0] ? `${lines[0].who}: ${lines[0].text}` : "";

    renderVocab(); renderQuiz(true); renderBuilder(); renderProgress(); renderWotd();
  }

  $("#transcript").addEventListener("click", e => {
    const row = e.target.closest(".line"); if (!row || e.target.closest("[data-say]")) return;
    const l = lines[row.dataset.i];
    if (player.duration) { player.currentTime = l.start * player.duration; player.play(); }
    else speak(l.text);
  });
  $("#spkTabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.spk = b.dataset.spk; $$("#spkTabs button").forEach(x => x.classList.toggle("on", x === b)); filterSpeakers();
  });
  function filterSpeakers() {
    $$("#transcript .line").forEach(r => r.classList.toggle("hide", state.spk !== "all" && !r.classList.contains(state.spk)));
  }

  /* ---------- Audio ---------- */
  function act(a) {
    if (a === "toggle") {
      if (!player.src || player.error) return toast("فایل صوتی این درس هنوز آپلود نشده (audio/lesson1.mp3)");
      player.paused ? player.play().catch(() => toast("پخش ممکن نشد")) : player.pause();
    }
    if (a === "back10") player.currentTime = Math.max(0, player.currentTime - 10);
    if (a === "fwd10") player.currentTime = Math.min(player.duration || 0, player.currentTime + 10);
    if (a === "prev" || a === "next") {
      const cur = lines.findIndex(l => l.end > (player.currentTime / (player.duration || 1)));
      const t = lines[Math.max(0, Math.min(lines.length - 1, cur + (a === "next" ? 1 : -1)))];
      if (player.duration) player.currentTime = t.start * player.duration;
    }
  }
  function setSpeed(i) {
    state.speed = Math.max(0, Math.min(SPEEDS.length - 1, i));
    player.playbackRate = SPEEDS[state.speed];
    $("#speed").textContent = SPEEDS[state.speed].toFixed(2).replace(/0$/, "") + "×";
  }
  const setIcons = () => $$(".ico-play").forEach(s => s.innerHTML = player.paused ? PLAY : PAUSE);
  player.addEventListener("play", setIcons);
  player.addEventListener("pause", setIcons);
  player.addEventListener("loadedmetadata", () => $$(".tDur").forEach(e => e.textContent = fmt(player.duration)));
  player.addEventListener("error", () => { $("#audioNote").textContent = "فایل صوتی پیدا نشد — آن را در پوشهٔ audio با نام lesson1.mp3 قرار دهید. تا آن موقع 🔊 با صدای مرورگر می‌خواند."; });
  let lastLine = -1;
  player.addEventListener("timeupdate", () => {
    const p = player.currentTime / (player.duration || 1);
    $$(".bar").forEach(b => b.style.width = p * 100 + "%");
    $$(".tCur").forEach(e => e.textContent = fmt(player.currentTime));
    const i = lines.findIndex(l => p < l.end);
    if (i !== lastLine && i >= 0) {
      lastLine = i;
      $$("#transcript .line").forEach((r, j) => r.classList.toggle("now", j === i));
      $("#hNowLine").textContent = `${lines[i].who}: ${lines[i].text}`;
      if ($("#follow").checked && $("#audio").classList.contains("active"))
        $(`#transcript .line[data-i="${i}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
  $$("[data-seek]").forEach(bar => bar.addEventListener("click", e => {
    if (!player.duration) return;
    const r = bar.getBoundingClientRect();
    player.currentTime = ((e.clientX - r.left) / r.width) * player.duration;
  }));

  /* ---------- Vocab ---------- */
  function renderVocab() {
    const L = LESSONS[state.idx];
    const list = L.vocab.filter(([de]) => state.vf === "all" || (state.vf === "known") === state.known.has(de));
    $("#vocabGrid").innerHTML = list.map(([de, fa, en]) => `
      <div class="card ${state.known.has(de) ? "known" : ""}" data-de="${esc(de)}"><div class="in">
        <div class="face front"><button class="say" data-say="${esc(de)}">${SAY_ICON}</button><div class="de">${esc(de)}</div><div class="en">${esc(en)}</div></div>
        <div class="face back"><div class="fa" style="font-size:18px">${esc(fa)}</div>
          <button class="btn ghost" data-known style="font-size:12px;padding:6px 10px">${state.known.has(de) ? "✓ Gelernt" : "Als gelernt markieren"}</button></div>
      </div></div>`).join("") || `<p class="fa notice">چیزی اینجا نیست.</p>`;
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

  function renderWotd() {
    const v = LESSONS[state.idx].vocab;
    const [de, fa, en] = v[new Date().getDate() % v.length];
    $("#wotdDe").textContent = de; $("#wotdFa").textContent = fa; $("#wotdEn").textContent = en;
  }
  function renderProgress() {
    const L = LESSONS[state.idx];
    const k = L.vocab.filter(([de]) => state.known.has(de)).length;
    const best = store.get("quiz" + L.id, 0);
    const pct = Math.round((k / L.vocab.length * 0.6 + best / L.quiz.length * 0.4) * 100);
    $("#ring").setAttribute("stroke-dasharray", `${pct} 100`);
    $("#ringTxt").textContent = pct + "%";
    $("#ringSub").textContent = `${k}/${L.vocab.length} واژه · آزمون ${best}/${L.quiz.length}`;
  }

  /* ---------- Quiz ---------- */
  const quiz = { i: 0, score: 0, order: [] };
  const shuffle = a => a.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  function renderQuiz(reset) {
    const Q = LESSONS[state.idx].quiz;
    if (reset) Object.assign(quiz, { i: 0, score: 0, order: shuffle(Q.map((_, j) => j)) });
    const box = $("#quiz");
    if (quiz.i >= Q.length) {
      const best = Math.max(store.get("quiz" + LESSONS[state.idx].id, 0), quiz.score);
      store.set("quiz" + LESSONS[state.idx].id, best); renderProgress();
      box.innerHTML = `<h3>Quiz</h3><div class="quiz-q fa">نتیجه: ${quiz.score} از ${Q.length} ${quiz.score === Q.length ? "🎉" : ""}</div>
        <button class="btn" id="qAgain">Nochmal</button>`;
      $("#qAgain").onclick = () => renderQuiz(true); return;
    }
    const q = Q[quiz.order[quiz.i]];
    const opts = shuffle(q.a.map((t, j) => ({ t, ok: j === q.c })));
    box.innerHTML = `<h3>Quiz · ${quiz.i + 1}/${Q.length}</h3><div class="quiz-q fa">${esc(q.q)}</div>
      <div class="opts">${opts.map((o, j) => `<button data-j="${j}" class="${/[a-zäöüß]/i.test(o.t) ? "" : "fa"}">${esc(o.t)}</button>`).join("")}</div>
      <div class="quiz-foot"><span>Punkte: ${quiz.score}</span><button class="btn ghost" id="qNext" disabled>Weiter ›</button></div>`;
    $$(".opts button", box).forEach(b => b.onclick = () => {
      const o = opts[b.dataset.j];
      if (o.ok) quiz.score++;
      $$(".opts button", box).forEach((x, j) => { x.disabled = true; if (opts[j].ok) x.classList.add("ok"); });
      if (!o.ok) b.classList.add("bad");
      $("#qNext").disabled = false;
    });
    $("#qNext").onclick = () => { quiz.i++; renderQuiz(); };
  }

  /* ---------- Intro builder ---------- */
  function renderBuilder() {
    const T = LESSONS[state.idx].template;
    const saved = store.get("intro", {});
    $("#builderRows").innerHTML = T.map(([pre, key, ph, post]) => `
      <div class="row"><span>${esc(pre)}</span>${key ? `<input data-k="${key}" placeholder="${esc(ph)}" value="${esc(saved[key] || "")}">` : ""}${post ? `<span>${esc(post)}</span>` : ""}</div>`).join("");
    const update = () => {
      const vals = {};
      $$("#builderRows input").forEach(i => vals[i.dataset.k] = i.value.trim());
      store.set("intro", vals);
      $("#builderOut").textContent = T.map(([pre, key, ph, post]) =>
        (pre + (key ? " " + (vals[key] || ph) : "") + (post ? (post === "." ? "." : " " + post) : (key ? "." : ""))).replace(" .", ".")).join(" ");
    };
    $("#builderRows").oninput = update; update();
  }
  $("#speakIntro").onclick = () => speak($("#builderOut").textContent);
  $("#copyIntro").onclick = () => navigator.clipboard?.writeText($("#builderOut").textContent).then(() => toast("کپی شد"));

  /* ---------- Init ---------- */
  tick(); setInterval(tick, 10000);
  setSpeed(state.speed);
  if (LESSONS.length) setLesson(state.idx);
  const start = location.hash.slice(1);
  if (start && document.getElementById(start)?.classList.contains("screen")) go(start);
})();
