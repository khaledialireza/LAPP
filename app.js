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
  let lines = [], timed = false;
  // seconds where a line starts: real timings if present, else proportional estimate
  const lineStart = l => timed ? l.t0 : l.start * (player.duration || 0);
  const lineAt = t => timed ? lines.findIndex(l => t < l.t1) : lines.findIndex(l => t / (player.duration || 1) < l.end);

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
    document.body.dataset.screen = id;
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
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
    $$(".js-lesson-num").forEach(e => e.textContent = "L" + L.id);
    $("#lpName").textContent = L.title;
    $("#lpMenu").innerHTML = LESSONS.map((x, j) => `<button role="option" aria-selected="${j === i}" data-pick="${j}">
      <b>L${x.id}</b><span>${esc(x.title)}</span><span class="fa">${esc(x.fa)}</span></button>`).join("");
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
    lines.forEach((l, j) => l.fa = (L.transcriptFa || [])[j] || "");
    timed = Array.isArray(L.timings) && L.timings.length === lines.length;
    if (timed) lines.forEach((l, j) => { l.t0 = L.timings[j]; l.t1 = L.timings[j + 1] ?? Infinity; });
    const total = lines.reduce((n, l) => n + l.text.length, 0);
    let acc = 0;
    lines.forEach(l => { l.start = acc / total; acc += l.text.length; l.end = acc / total; });
    const listHtml = lines.map((l, j) => `
      <div class="line ${l.who.toLowerCase()}" data-i="${j}"><span class="who">${esc(l.who)}</span>
      <span>${esc(l.text)} <button class="say" style="display:inline-grid;width:22px;height:22px;vertical-align:middle" data-say="${esc(l.text)}">${SAY_ICON}</button></span></div>`).join("");
    $("#transcript").innerHTML = listHtml; $("#mTranscript").innerHTML = listHtml;
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
    $("#hNowLine").textContent = l ? `${l.who}: ${l.text}` : "";
    $("#hNowFa").textContent = l ? l.fa : "";
    $("#aNowWho").textContent = l ? l.who : "";
    $("#aNowDe").textContent = l ? l.text : "";
    $("#aNowFa").textContent = l ? l.fa : "";
  }

  const onLineClick = e => {
    const row = e.target.closest(".line"); if (!row || e.target.closest("[data-say]")) return;
    const l = lines[row.dataset.i];
    showNow(Number(row.dataset.i));
    setDrawer(false);
    if (player.duration) { player.currentTime = lineStart(l); player.play(); }
    else speak(l.text);
  };
  $("#transcript").addEventListener("click", onLineClick);
  $("#mTranscript").addEventListener("click", onLineClick);
  ["#spkTabs", "#mSpkTabs"].forEach(id => $(id).addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.spk = b.dataset.spk; $$(`${id} button`).forEach(x => x.classList.toggle("on", x === b)); filterSpeakers();
  }));
  function filterSpeakers() {
    $$(".transcript .line").forEach(r => r.classList.toggle("hide", state.spk !== "all" && !r.classList.contains(state.spk)));
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
  player.addEventListener("error", () => { $("#audioNote").textContent = "فایل صوتی پیدا نشد — آن را در پوشهٔ audio با نام lesson1.mp3 قرار دهید. تا آن موقع 🔊 با صدای مرورگر می‌خواند."; });
  let lastLine = -1;
  player.addEventListener("timeupdate", () => {
    const p = player.currentTime / (player.duration || 1);
    $$(".bar").forEach(b => b.style.width = p * 100 + "%");
    $$(".tCur").forEach(e => e.textContent = fmt(player.currentTime));
    const i = lineAt(player.currentTime);
    if (i !== lastLine && i >= 0) {
      lastLine = i;
      $$(".transcript .line").forEach(r => r.classList.toggle("now", Number(r.dataset.i) === i));
      showNow(i);
      if ($("#follow").checked && $("#audio").classList.contains("active"))
        $(`#transcript .line[data-i="${i}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
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
  function buildVocab() {
    const seen = new Map();
    lines.forEach(l => l.text.split(/\s+/).forEach(tok => {
      const w = cleanWord(tok); if (!w) return;
      const k = dictKey(w);
      if (!k || seen.has(k)) { if (k) seen.get(k).n++; return; }
      const d = DICT[k];
      if (!d.p || d.p === "انگلیسی") return;
      seen.set(k, { key: k, de: (ARTICLE[d.p] || "") + k.replace(/_.*/, ""), p: d.p, fa: d.fa, g: d.g, n: 1 });
    }));
    vocabList = [...seen.values()];
  }
  function renderVocab() {
    const q = ($("#vocabSearch").value || "").trim().toLowerCase();
    const list = vocabList.filter(v => (state.vf === "all" || (state.vf === "known") === state.known.has(v.key))
      && (!q || v.de.toLowerCase().includes(q) || v.fa.includes(q)));
    const known = vocabList.filter(v => state.known.has(v.key)).length;
    $("#vocabCount").textContent = `${known} / ${vocabList.length}`;
    $("#vocabGrid").innerHTML = list.map(v => `
      <div class="card ${state.known.has(v.key) ? "known" : ""}" data-de="${esc(v.key)}"><div class="in">
        <div class="face front"><button class="say" data-say="${esc(v.de)}">${SAY_ICON}</button><div class="de">${esc(v.de)}</div><div class="en fa">${esc(v.p)}</div></div>
        <div class="face back"><div class="fa v-fa">${esc(v.fa)}</div>
          ${v.g ? `<div class="fa v-g">${esc(v.g.split(" · ").slice(0, 2).join(" · "))}</div>` : ""}
          <button class="btn ghost" data-known style="font-size:12px;padding:6px 10px">${state.known.has(v.key) ? "✓ Gelernt" : "Als gelernt markieren"}</button></div>
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
  $("#vocabSearch").addEventListener("input", () => renderVocab());

  function renderWotd() {
    if (!vocabList.length) return;
    const v = vocabList[new Date().getDate() * 7 % vocabList.length];
    $("#wotdDe").textContent = v.de; $("#wotdFa").textContent = v.fa; $("#wotdEn").textContent = v.p;
  }
  function renderProgress() {
    const k = vocabList.filter(v => state.known.has(v.key)).length;
    const res = exResults(), ok = Object.values(res).filter(Boolean).length, n = ex.list.length || 1;
    const pct = Math.round((k / (vocabList.length || 1) * 0.4 + ok / n * 0.6) * 100);
    $("#ring").setAttribute("stroke-dasharray", `${pct} 100`);
    $("#ringTxt").textContent = pct + "%";
    $("#ringSub").textContent = `${k}/${vocabList.length} واژه · تمرین ${ok}/${ex.list.length}`;
  }

  /* ---------- Practice: 100 exercise cards ---------- */
  const ex = { list: [], i: 0, filter: "all" };
  const exKey = () => "ex" + LESSONS[state.idx].id;
  const exResults = () => store.get(exKey(), {});
  const shuffleArr = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  let clipStop = null;
  function playClip(i) {
    const l = lines[i];
    if (!player.duration || !timed) return speak(l.text);
    player.currentTime = l.t0; clipStop = l.t1; player.play();
  }
  player.addEventListener("timeupdate", () => { if (clipStop != null && player.currentTime >= clipStop) { player.pause(); clipStop = null; } });
  player.addEventListener("seeking", () => { if (clipStop != null && player.currentTime < (lines.find(l => l.t1 === clipStop)?.t0 ?? 0)) clipStop = null; });

  function buildPractice() {
    ex.list = window.Practice ? window.Practice.build(LESSONS[state.idx], lines, w => { const k = dictKey(w); return k ? DICT[k] : {}; }) : [];
    ex.i = Math.min(store.get(exKey() + ":i", 0), ex.list.length - 1);
    const counts = {}; ex.list.forEach(e => counts[e.type] = (counts[e.type] || 0) + 1);
    $("#exFilter").innerHTML = `<button class="on" data-t="all">Alle</button>` + Object.keys(counts).map(t =>
      `<button data-t="${t}">${window.Practice.TYPE_LABEL[t][0]} <small>${counts[t]}</small></button>`).join("");
    renderExercise();
  }
  const visibleEx = () => ex.list.filter(e => ex.filter === "all" || e.type === ex.filter);
  $("#exFilter").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    ex.filter = b.dataset.t; $$("#exFilter button").forEach(x => x.classList.toggle("on", x === b));
    const v = visibleEx(); if (v.length && !v.includes(ex.list[ex.i])) ex.i = v[0].id;
    renderExercise();
  });
  function stepEx(d) {
    const v = visibleEx(); const k = v.indexOf(ex.list[ex.i]);
    const n = v[Math.max(0, Math.min(v.length - 1, k + d))]; if (n) { ex.i = n.id; renderExercise(); }
  }
  $("#exPrev").onclick = () => stepEx(-1);
  $("#exNext").onclick = () => stepEx(1);

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
    fb.innerHTML = `<div class="fb-title">${correct ? "✓ Richtig! · آفرین" : "✗ Nicht ganz · دوباره گوش کن"}</div>
      ${detail}
      <div class="fb-ans"><button class="say" data-say="${esc(e.answer)}">${SAY_ICON}</button><span>${esc(e.answer)}</span></div>
      ${l && l.fa ? `<div class="fa fb-fa">${esc(e.explain || l.fa)}</div>` : ""}
      ${timed ? `<button class="chip-btn" id="exClip">▶ Im Dialog hören</button>` : ""}`;
    $("#exClip") && ($("#exClip").onclick = () => playClip(e.line));
    $("#exCheck").hidden = true; $("#exNext").classList.add("pulse");
    renderMap(); renderProgress();
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
      body.innerHTML = `<p class="ex-q fa">${esc(e.prompt)}</p><p class="ex-sub fa">آلمانی‌اش کدام است؟</p>${optHtml(e.options)}`;
      bindOpts();
    } else if (e.type === "listen") {
      body.innerHTML = `<button class="play-big" id="exPlay">▶</button><p class="ex-sub fa">گوش کن؛ کدام جمله را شنیدی؟</p>${optHtml(e.options)}`;
      $("#exPlay").onclick = () => playClip(e.line);
      bindOpts();
    } else if (e.type === "respond") {
      body.innerHTML = `<div class="ex-bubble"><button class="say" data-say="${esc(e.prompt)}">${SAY_ICON}</button><span>${esc(e.prompt)}</span></div>
        <p class="ex-sub fa">اگر از تو این را بپرسند، جواب مناسب کدام است؟</p>${optHtml(e.options)}`;
      bindOpts();
    } else if (e.type === "fill") {
      body.innerHTML = `${e.hint ? `<p class="ex-sub fa">${esc(e.hint)}</p>` : ""}
        <p class="ex-sent">${esc(e.before)}<input id="exInput" autocomplete="off" autocapitalize="off" spellcheck="false" size="${Math.max(4, e.answer.length)}" aria-label="Lücke">${esc(e.after)}</p>
        <div class="umlauts">${["ä", "ö", "ü", "ß"].map(c => `<button data-c="${c}">${c}</button>`).join("")}<button class="hint" id="exHint">💡 <span class="fa">راهنما</span></button></div>`;
      const inp = $("#exInput"); let hints = 0;
      $$(".umlauts [data-c]", body).forEach(b => b.onclick = () => { inp.value += b.dataset.c; inp.focus(); });
      $("#exHint").onclick = () => { hints++; inp.value = e.answer.slice(0, hints); inp.focus(); };
      const check = () => { if (!inp.value.trim()) return inp.focus(); const ok = window.Practice.norm(inp.value) === window.Practice.norm(e.answer); inp.classList.add(ok ? "ok" : "bad"); inp.disabled = true; finishEx(ok, e.note ? `<div class="fa fb-note">${esc(e.note)}</div>` : ""); };
      inp.addEventListener("keydown", k => { if (k.key === "Enter") check(); });
      $("#exCheck").hidden = false; $("#exCheck").onclick = check;
    } else if (e.type === "order") {
      const built = [];
      body.innerHTML = `${e.hint ? `<p class="ex-sub fa">${esc(e.hint)}</p>` : `<p class="ex-sub fa">کلمه‌ها را به ترتیب درست بزن</p>`}
        <div class="build" id="exBuilt"></div><div class="bank" id="exBank">${e.tokens.map((t, j) => `<button data-j="${j}">${esc(t)}</button>`).join("")}</div>`;
      const draw = () => {
        $("#exBuilt").innerHTML = built.map((j, k) => `<button data-k="${k}">${esc(e.tokens[j])}</button>`).join("") || `<span class="ph fa">اینجا ساخته می‌شود…</span>`;
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
      body.innerHTML = `<p class="ex-q fa">${esc(e.prompt)}</p><p class="ex-sub fa">این را به آلمانی بلند بگو</p>
        <div class="speak-row">${SR ? `<button class="mic" id="exMic" aria-label="Mikrofon">🎤</button>` : ""}
        <button class="chip-btn" id="exReveal">Lösung zeigen · <span class="fa">نمایش جواب</span></button></div>
        <p class="heard" id="exHeard"></p>
        <div class="self" id="exSelf" hidden><span class="fa">درست گفتی؟</span><button class="btn" data-self="1">✓ Ja</button><button class="btn ghost" data-self="0">✗ Nein</button></div>`;
      const reveal = () => { $("#exHeard").innerHTML = `<b>${esc(e.answer)}</b>`; $("#exSelf").hidden = false; speak(e.answer); };
      $("#exReveal").onclick = reveal;
      $$("#exSelf [data-self]").forEach(b => b.onclick = () => { $("#exSelf").hidden = true; finishEx(b.dataset.self === "1"); });
      if (SR) $("#exMic").onclick = () => {
        const r = new SR(); r.lang = "de-DE"; r.interimResults = false; r.maxAlternatives = 3;
        $("#exMic").classList.add("rec"); $("#exHeard").innerHTML = `<span class="fa">در حال گوش دادن…</span>`;
        r.onresult = ev => {
          const target = window.Practice.words(window.Practice.norm(e.answer));
          const best = [...ev.results[0]].map(a => {
            const said = window.Practice.words(window.Practice.norm(a.transcript));
            const hit = target.filter(w => said.includes(w)).length;
            return { t: a.transcript, score: hit / target.length };
          }).sort((p, q) => q.score - p.score)[0];
          const pct = Math.round(best.score * 100);
          $("#exHeard").innerHTML = `<span class="fa">شنیدم:</span> «${esc(best.t)}» · ${pct}%`;
          finishEx(best.score >= 0.7);
        };
        r.onerror = () => { $("#exHeard").innerHTML = `<span class="fa">میکروفون در دسترس نیست؛ از «نمایش جواب» استفاده کن.</span>`; };
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

  const faToggle = $("#showFa");
  faToggle.checked = store.get("showFa", true);
  const applyFa = () => { $("#aNowBox").hidden = !faToggle.checked; store.set("showFa", faToggle.checked); };
  faToggle.addEventListener("change", applyFa); applyFa();

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
    if (/^[a-z'-]+$/i.test(w) && !/[äöüß]/i.test(w)) return { lemma: w, p: "انگلیسی", fa: "این کلمه انگلیسی است (توضیح گوینده برای بینندگان).", g: "" };
    return { lemma: w, p: "", fa: "معنی این کلمه هنوز ثبت نشده.", g: "" };
  }
  function openWord(w) {
    const d = lookup(w), l = lines[curLine];
    $("#popWord").textContent = w;
    $("#popLemma").textContent = d.lemma.toLowerCase() !== w.toLowerCase() ? `← ${d.lemma}` : "";
    $("#popPos").textContent = d.p; $("#popPos").hidden = !d.p;
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

  /* ---------- Init ---------- */
  tick(); setInterval(tick, 10000);
  setSpeed(state.speed);
  if (LESSONS.length) setLesson(state.idx);
  const start = location.hash.slice(1);
  if (start && document.getElementById(start)?.classList.contains("screen")) go(start);
})();
