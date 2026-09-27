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
  // lessons and stories share one list; each category is numbered on its own (L1, L2 … / G1, G2 …)
  const isStory = L => L && L.type === "story";
  const lsCode = i => { const L = LESSONS[i], same = LESSONS.filter(x => isStory(x) === isStory(L)); return (isStory(L) ? "G" : "L") + (same.indexOf(L) + 1); };
  const lsKind = i => isStory(LESSONS[i]) ? t("story") : t("lesson");
  const lsName = i => iso(lsKind(i) + " " + lsCode(i).slice(1));
  const lineAt = t => timed ? lines.findIndex(l => t < l.next) : lines.findIndex(l => t / (player.duration || 1) < l.end);

  // Persian pieces are bidi-isolated so numbers and Latin codes keep their order inside LTR lines
  const iso = s => I18N.lang === "fa" ? "\u2068" + s + "\u2069" : s;
  const tf = (k, o) => iso(t(k).replace(/\{(\w+)\}/g, (m, x) => o[x]));
  const uiLocale = () => ({ fa: "fa-IR", ru: "ru-RU", uk: "uk-UA" })[I18N.lang] || "fa-IR";
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
    const tab = id === "lesson" || id === "library" ? "home" : id;
    $$(".nav button").forEach(b => b.classList.toggle("on", b.dataset.go === tab));
    document.body.dataset.screen = id;
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    if (id === "practice" && typeof renderHub === "function" && !$("#pHub").hidden) renderHub();
    if (id === "lesson" && typeof renderLesson === "function") renderLesson();
    if (id === "library" && typeof renderLibrary === "function") renderLibrary();
    if (id === "profile" && typeof renderProfile === "function") renderProfile();
    if (id !== "audio" && typeof queueSheet === "function") queueSheet(false);
    if (id === "audio") { document.body.classList.add("dock-collapsed"); requestAnimationFrame(() => showNow(curLine)); }
    const on = $(".nav button.on");
    const ic = on && on.querySelector("svg, .avatar-btn"); if (ic) $("#dockTabsBtn").innerHTML = ic.outerHTML;
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
  $("#lpBtn").addEventListener("click", () => go("library"));

  /* ---------- Clock ---------- */
  function tick() {
    const d = new Date();
    const h = d.getHours();
    $("#hGreet").textContent = t(h < 5 ? "greetNight" : h < 11 ? "greetMorning" : h < 17 ? "greetDay" : h < 22 ? "greetEvening" : "greetNight");
    $("#homeDate").textContent = d.toLocaleDateString(uiLocale(), { weekday: "long", day: "numeric", month: "long" });
  }

  /* ---------- Lesson ---------- */
  // speaker name → one CSS class ("Papa Bär" → "papa-bär")
  const whoCls = w => (w || "").toLowerCase().replace(/\s+/g, "-");
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
    if (!isStory(LESSONS[i])) store.set("lastLesson", i);
    const L = LESSONS[i];
    $$(".js-lesson-num").forEach(e => e.textContent = lsCode(i));
    $$(".js-lesson-word").forEach(e => e.textContent = lsKind(i));
    const seen = store.get("libSeen", {}); seen[L.id] = Date.now(); store.set("libSeen", seen);
    $("#lpName").textContent = L.title;
    const TR = lessonTr(L);
    $("#hLessonTitle").textContent = L.title; $("#hLessonFa").textContent = TR.title; $("#hLevel").textContent = L.level;
    $("#phrases").innerHTML = L.phrases.map(([de], pi) => [de, TR.phrases[pi] || "", TR.notes[pi] || ""]).map(([de, fa, note], pi) => `
      <button class="p" data-phr="${pi}" data-say="${esc(de)}"><span class="sp">${SAY_ICON}</span><b dir="ltr">${esc(de)}</b><span class="fa">${esc(fa)}</span>${note ? `<span class="tag fa">${esc(note)}</span>` : ""}</button>`).join("");
    $("#lsGram").innerHTML = (L.focus || []).map((g, gi) => `<details class="gf"${gi ? "" : " open"}><summary><b dir="ltr">${esc(g.de)}</b><span class="fa">${esc(g.fa)}</span><span class="chev">›</span></summary><ul class="fa">${g.points.map(p => `<li>${p}</li>`).join("")}</ul></details>`).join("");
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
      <div class="ly-line ${whoCls(l.who)}" data-i="${j}"><span class="ly-who">${esc(l.who)}</span>
      <div class="ly-de">${esc(l.text)}</div><div class="ly-fa fa">${esc(l.fa || "")}</div></div>`).join("");
    // speaker filter: one tab per speaker of this lesson
    const whos = [...new Set(lines.map(l => l.who).filter(Boolean))];
    if (!whos.some(w => whoCls(w) === state.spk)) state.spk = "all";
    $("#mSpkTabs").innerHTML = ["all", ...whos].map(w => `<button class="${(w === "all" ? "all" : whoCls(w)) === state.spk ? "on" : ""}" data-spk="${w === "all" ? "all" : esc(whoCls(w))}">${w === "all" ? t("all") : esc(w)}</button>`).join("");
    $(".spk-pick").hidden = whos.length < 2;
    $("#spkLbl").textContent = $("#mSpkTabs button.on")?.textContent || t("all");
    filterSpeakers();
    bgvSet(L);
    const story = L.type === "story";
    $("#lyTitle").textContent = story ? t("story") : t("dialog");
    $("#lySrc").textContent = story ? `${L.title} · ${L.level}` : "Daily German Talk";

    // audio: every lesson and story remembers where you stopped
    player.src = L.audio; player.playbackRate = SPEEDS[state.speed];
    const resume = (store.get("posMap", {}))[L.id];
    if (resume > 3) player.addEventListener("loadedmetadata", () => { if (state.idx === i && player.currentTime < 1 && resume < player.duration - 3) { player.currentTime = resume; showNow(Math.max(0, lineAt(resume))); } }, { once: true });
    showNow(0);

    buildVocab(); buildPractice(); renderVocab(); renderProgress(); renderWotd();
    if (document.body.dataset.screen === "lesson") renderLesson();
  }

  let curLine = 0;
  const cleanWord = tok => tok.replace(/^[^A-Za-zÄÖÜäöüßé]+|[^A-Za-zÄÖÜäöüßé'-]+$/g, "");
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
      // the previous translation collapses at once and this one grows in, so the final position is known now
      if (Date.now() > followPause && box.clientHeight) box.scrollTo({ top: row.offsetTop - box.clientHeight * 0.38, behavior: "smooth" });
    }
    if (night.open) nightShow(i);
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
  // speaker filter: a small menu in the header
  const spkMenu = open => { $("#mSpkTabs").hidden = !open; $("#spkBtn").setAttribute("aria-expanded", open); };
  $("#spkBtn").addEventListener("click", e => { e.stopPropagation(); spkMenu($("#mSpkTabs").hidden); });
  document.addEventListener("click", e => { if (!e.target.closest(".spk-pick")) spkMenu(false); });
  $("#mSpkTabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.spk = b.dataset.spk; $$("#mSpkTabs button").forEach(x => x.classList.toggle("on", x === b)); filterSpeakers();
    $("#spkLbl").textContent = b.textContent; spkMenu(false);
  });
  function filterSpeakers() {
    $$("#mTranscript .ly-line").forEach(r => r.classList.toggle("hide", state.spk !== "all" && !r.classList.contains(state.spk)));
  }

  /* ---------- Background video: the story's film plays muted and dim behind the text, in sync with the audio ---------- */
  const bgv = { p: null, id: "", ready: false, timer: 0 };
  const bgvOn = () => store.get("bgVideo", true);
  const ytApi = () => window.YT && YT.Player ? Promise.resolve() : new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
    let sc = document.getElementById("ytApi");
    if (!sc) { sc = document.createElement("script"); sc.id = "ytApi"; sc.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(sc); }
    sc.addEventListener("error", () => { sc.remove(); rej(); }, { once: true });
  });
  function bgvSet(L) {
    $$("[data-bgv]").forEach(b => { b.hidden = !L.video; b.setAttribute("aria-pressed", bgvOn()); });
    const want = L.video && bgvOn() ? L.video : "";
    if (want === bgv.id) return;
    try { bgv.p?.destroy?.(); } catch {}
    bgv.p = null; bgv.ready = false; bgv.id = want; clearInterval(bgv.timer);
    $("#bgv").innerHTML = ""; $("#bgv").classList.remove("live");
    document.body.classList.toggle("has-bgv", !!want);
    vidOnly(want && store.get("vidOnly", false));
    if (!want) return;
    $("#bgv").innerHTML = '<div id="bgvBox"></div>';
    ytApi().then(() => {
      if (bgv.id !== want) return;
      bgv.p = new YT.Player("bgvBox", { videoId: want,
        playerVars: { controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, mute: 1, cc_load_policy: 0, ...(/^https?:/.test(location.origin) ? { origin: location.origin } : {}) },
        events: {
          onReady: e => { bgv.ready = true; e.target.mute(); bgvSync(true); },
          onStateChange: e => { if (e.data === 1) $("#bgv").classList.add("live"); },
          onError: e => toast(tf("videoErr", { c: e.data }) + (e.data === 101 || e.data === 150 ? t("videoNoEmbed") : ""))
        } });
      bgv.timer = setInterval(() => bgvSync(false), 2000);
    }, () => toast(t("videoUnreach")));
  }
  // follow the audio: same position, same speed, play/pause together
  function bgvSync(force) {
    const p = bgv.p; if (!bgv.ready || !p?.getCurrentTime) return;
    try {
      if (Math.abs(p.getCurrentTime() - player.currentTime) > (force ? 0.3 : 0.8)) p.seekTo(player.currentTime, true);
      if (p.getPlaybackRate?.() !== player.playbackRate) p.setPlaybackRate(player.playbackRate);
      const playing = p.getPlayerState?.() === 1;
      if (!player.paused && !playing) p.playVideo();
      if (player.paused && playing) p.pauseVideo();
    } catch {}
    $("#bgv").classList.toggle("paused", player.paused);
  }
  ["play", "pause", "seeked", "ratechange"].forEach(ev => player.addEventListener(ev, () => bgvSync(true)));
  // video only: the text disappears and the film shows at normal brightness
  function vidOnly(on) {
    on = !!on && document.body.classList.contains("has-bgv");
    document.body.classList.toggle("video-only", on);
    $$("[data-vidonly]").forEach(b => { b.setAttribute("aria-pressed", on); b.hidden = !document.body.classList.contains("has-bgv"); b.textContent = on ? "Aa ✕" : "Aa"; });
  }
  document.addEventListener("click", e => { if (!e.target.closest("[data-vidonly]")) return; const on = !document.body.classList.contains("video-only"); store.set("vidOnly", on); vidOnly(on); });
  document.addEventListener("click", e => { if (!e.target.closest("[data-bgv]")) return; store.set("bgVideo", !bgvOn()); bgvSet(LESSONS[state.idx]); });

  /* ---------- Night mode: calm, one line at a time, big translation, big controls ---------- */
  const night = { open: false, lock: null, idle: 0, sleepEnd: 0, sleepT: 0, shown: -1 };
  function nightShow(i) {
    const l = lines[i]; if (!l || night.shown === i) return;
    night.shown = i;
    const card = $("#ntCard"); card.classList.add("out");
    setTimeout(() => {
      $("#ntWho").textContent = l.who || ""; $("#ntDe").textContent = l.text; $("#ntTr").textContent = l.fa || "";
      $("#ntNum").textContent = `${i + 1} / ${lines.length}`;
      $("#ntTitle").textContent = `${lsCode(state.idx)} · ${LESSONS[state.idx].title}`;
      const q = night.queue, nx = q && q[night.qi + 1] != null ? LESSONS.findIndex(x => x.id === q[night.qi + 1]) : -1;
      $("#ntNext").textContent = nx >= 0 ? tf("upNext", { c: lsCode(nx) }) : "";
      card.classList.remove("out");
    }, 280);
  }
  function nightWake() {
    $("#night").classList.remove("idle"); clearTimeout(night.idle);
    night.idle = setTimeout(() => { if (!player.paused) $("#night").classList.add("idle"); }, 4000);
  }
  async function nightLock(on) {
    try { if (on && !night.lock && navigator.wakeLock) { night.lock = await navigator.wakeLock.request("screen"); night.lock.addEventListener?.("release", () => night.lock = null); }
      if (!on && night.lock) { await night.lock.release(); night.lock = null; } } catch {}
  }
  function nightOpen() {
    night.open = true; night.shown = -1; $("#night").hidden = false; document.body.classList.add("night-on");
    try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch {}
    nightShow(curLine); nightWake(); nightLock(!player.paused);
  }
  function nightClose() {
    night.open = false; $("#night").hidden = true; document.body.classList.remove("night-on"); clearTimeout(night.idle);
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
    nightLock(false); requestAnimationFrame(() => showNow(curLine));
  }
  // sleep timer: minutes, or "end" = stop when the current story ends
  const SLEEP = [0, 15, 30, 45, "end"];
  function nightSleep(v) {
    night.sleepMode = v; clearInterval(night.sleepT);
    night.sleepEnd = typeof v === "number" && v ? Date.now() + v * 60000 : 0;
    if (night.sleepEnd) night.sleepT = setInterval(() => { nightSleepLabel(); if (Date.now() >= night.sleepEnd) { player.pause(); nightSleep(0); } }, 15000);
    nightSleepLabel();
  }
  function nightSleepLabel() {
    const left = night.sleepEnd ? Math.max(0, Math.ceil((night.sleepEnd - Date.now()) / 60000)) : 0;
    $("#ntSleepL").textContent = night.sleepMode === "end" ? t("endL") : night.sleepEnd ? tf("minN", { n: left }) : t("off");
  }
  $("#ntClose").onclick = () => nightClose();
  $("#nightBtn").onclick = () => nightOpen();
  // time bar: drag to any point; swipe on the text for the next/previous sentence
  const ntBar = $("#ntSeek"); let ntDrag = false;
  const fmtT = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
  const ntTime = v => { $("#ntCur").textContent = fmtT(v); $("#ntDur").textContent = fmtT(player.duration || 0); ntBar.style.setProperty("--p", (player.duration ? v / player.duration * 100 : 0) + "%"); };
  ntBar.addEventListener("input", () => { ntDrag = true; ntTime(Number(ntBar.value)); const i = lineAt(Number(ntBar.value)); if (i >= 0) nightShow(i); });
  ntBar.addEventListener("change", () => { ntDrag = false; player.currentTime = Number(ntBar.value); });
  player.addEventListener("timeupdate", () => { if (!night.open || ntDrag) return; ntBar.max = Math.floor(player.duration || 0); ntBar.value = player.currentTime; ntTime(player.currentTime); });
  player.addEventListener("loadedmetadata", () => { ntBar.max = Math.floor(player.duration || 0); ntTime(player.currentTime); });
  let ntSx = null;
  $("#ntStage").addEventListener("pointerdown", e => { ntSx = [e.clientX, e.clientY]; });
  $("#ntStage").addEventListener("pointerup", e => {
    if (!ntSx) return; const dx = e.clientX - ntSx[0], dy = e.clientY - ntSx[1]; ntSx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) act(dx < 0 ? "next" : "prev");
  });
  $("#ntRep").onclick = () => { if (!player.duration) return; player.currentTime = lineStart(lines[curLine]); player.play(); };
  $("#ntSleep").onclick = () => {
    const k = SLEEP.indexOf(night.sleepMode ?? 0);
    nightSleep(SLEEP[(k + 1) % SLEEP.length]);
  };
  // while the controls are dimmed, the first tap only wakes them
  let ntWoke = false;
  $("#night").addEventListener("pointerdown", () => { ntWoke = $("#night").classList.contains("idle"); nightWake(); }, true);
  $("#night").addEventListener("click", e => { if (ntWoke) { ntWoke = false; e.stopPropagation(); e.preventDefault(); } }, true);
  $("#night").addEventListener("keydown", nightWake);
  player.addEventListener("play", () => { if (night.open) { nightLock(true); nightWake(); } });
  player.addEventListener("pause", () => { if (night.open && !night.gapWait) { $("#night").classList.remove("idle"); nightLock(false); } });
  document.addEventListener("visibilitychange", () => { if (night.open && !document.hidden && !player.paused) nightLock(true); });
  document.addEventListener("keydown", e => { if (!night.open) return; if (e.key === "Escape") nightClose(); if (e.key === " ") { e.preventDefault(); act("toggle"); } if (e.key === "ArrowRight") act("next"); if (e.key === "ArrowLeft") act("prev"); });

  /* ---------- Story playlist (dock tab): pick, order, settings, then night-mode playback ---------- */
  const PL_MODES = { mine: "plMine", level: "plLevel", newest: "plNewest", random: "plRandom" };
  const plGet = () => ({ order: [], off: [], mode: "mine", sleep: 0, speed: 2, tr: true, gap: 0, pos: null, ...store.get("pl", {}) });
  const plSet = v => store.set("pl", v);
  // stories are in the playlist unless switched off; lesson dialogs only when switched on
  const plItems = () => [...LESSONS.filter(isStory), ...LESSONS.filter(x => !isStory(x))];
  const plSel = (pl, id) => isStory(LESSONS.find(x => x.id === id)) ? !pl.off.includes(id) : (pl.dOn || []).includes(id);
  function plOrdered(pl) {
    const ids = plItems().map(L => L.id);
    const mine = [...pl.order.filter(id => ids.includes(id)), ...ids.filter(id => !pl.order.includes(id))];
    const byId = id => LESSONS.find(x => x.id === id);
    if (pl.mode === "level") return [...mine].sort((a, b) => LEVELS.indexOf(byId(a).level) - LEVELS.indexOf(byId(b).level));
    if (pl.mode === "newest") return [...mine].sort((a, b) => LESSONS.indexOf(byId(b)) - LESSONS.indexOf(byId(a)));
    return mine;
  }
  function renderStories() {
    const pl = plGet(), ids = plOrdered(pl), on = ids.filter(id => plSel(pl, id));
    const mins = on.reduce((a, id) => a + (libMins(LESSONS.find(x => x.id === id)) || 0), 0);
    $("#plMode").innerHTML = Object.entries(PL_MODES).map(([k, v]) => `<button data-mode="${k}" class="${pl.mode === k ? "on" : ""}">${t(v)}</button>`).join("");
    $("#plCount").innerHTML = tf("plCount", { a: on.length, b: ids.length, m: mins });
    let n = 0;
    $("#plList").innerHTML = ids.map(id => { const i = LESSONS.findIndex(x => x.id === id), L = LESSONS[i], sel = plSel(pl, id), p = lessonPct(i), m = libMins(L);
      return `<div class="pl-it ${sel ? "" : "off"}" data-id="${id}">
        <span class="n">${sel && pl.mode !== "random" ? ++n : ""}</span><span class="cv cv${i % 4}">${isStory(L) ? "📖" : "💬"}</span>
        <span class="t"><b>${esc(L.title)}</b><span>${isStory(L) ? "" : t("dialog") + " · "}${lsCode(i)} · ${esc(L.level)}${m ? " · " + tf("minN", { n: m }) : ""} · ${p >= 100 ? t("stDone") : p ? p + "%" : t("stNew")}</span></span>
        <button class="ck" data-ck aria-pressed="${sel}">${sel ? "✓" : ""}</button>${pl.mode === "mine" ? `<span class="hd" data-drag>≡</span>` : ""}</div>`; }).join("")
      || `<div class="pl-empty">${t("plEmpty")}</div>`;
    const chips = (key, vals, lab = v => v) => vals.map(v => `<button data-opt="${key}" data-v="${v}" class="${String(pl[key]) === String(v) ? "on" : ""}">${lab(v)}</button>`).join("");
    const hasVid = on.some(id => LESSONS.find(x => x.id === id).video);
    $("#plOpts").innerHTML = `
      <div class="pl-opt"><span>${t("sleepTimer")}</span><span class="pl-chips">${chips("sleep", SLEEP, v => v === 0 ? t("off") : v === "end" ? t("endL") : v)}</span></div>
      <div class="pl-opt"><span>${t("speed")}</span><span class="pl-chips">${chips("speed", [1, 2, 3], v => SPEEDS[v] + "×")}</span></div>
      <div class="pl-opt"><span>${t("plTr")}</span><button class="tg" data-tg="tr" aria-pressed="${pl.tr}"></button></div>
      <div class="pl-opt"><span>${t("plGap")}</span><span class="pl-chips">${chips("gap", [0, 2, 4], v => v ? v + " s" : "0")}</span></div>
      ${hasVid ? `<div class="pl-opt"><span>${t("bgVideoDim")}</span><button class="tg" data-tg="video" aria-pressed="${bgvOn()}"></button></div>` : ""}`;
    const st = plStartPoint(pl);
    $("#plStart").disabled = !st;
    $("#plStart").innerHTML = st ? `▶︎ ${t("start")} <small>${st.t > 5 ? tf("plFrom", { c: lsCode(st.i), n: st.line + 1 }) : tf("plItems", { n: on.length, m: mins })}</small>` : t("plNone");
  }
  // where Start begins: the saved position if that story is still in the list
  function plStartPoint(pl, queue) {
    const q = queue || plOrdered(pl).filter(id => plSel(pl, id)); if (!q.length) return null;
    // start with what is open in the player if it is in the list, else where the list stopped last time
    const curId = LESSONS[state.idx].id;
    const pos = q.includes(curId) ? { id: curId, t: player.currentTime || (store.get("posMap", {})[curId] || 0) } : pl.pos && q.includes(pl.pos.id) ? pl.pos : { id: q[0], t: 0 };
    const i = LESSONS.findIndex(x => x.id === pos.id), L = LESSONS[i];
    const line = Array.isArray(L.timings) ? Math.max(0, L.timings.findIndex(x => (Array.isArray(x) ? x[1] : x) > pos.t)) : 0;
    return { id: pos.id, i, t: pos.t || 0, line };
  }
  $("#plMode").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (!b) return; const pl = plGet(); pl.mode = b.dataset.mode; plSet(pl); renderStories(); });
  $("#plOpts").addEventListener("click", e => {
    const pl = plGet(), b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tg === "video") { store.set("bgVideo", !bgvOn()); bgvSet(LESSONS[state.idx]); }
    else if (b.dataset.tg) pl[b.dataset.tg] = !pl[b.dataset.tg];
    else if (b.dataset.opt) { const v = b.dataset.v; pl[b.dataset.opt] = isNaN(v) ? v : Number(v); }
    plSet(pl); renderStories();
  });
  $("#plList").addEventListener("click", e => {
    const ck = e.target.closest("[data-ck]"); if (!ck) return;
    const id = Number(ck.closest("[data-id]").dataset.id), pl = plGet();
    if (isStory(LESSONS.find(x => x.id === id))) pl.off = pl.off.includes(id) ? pl.off.filter(x => x !== id) : [...pl.off, id];
    else { const d = pl.dOn || []; pl.dOn = d.includes(id) ? d.filter(x => x !== id) : [...d, id]; }
    plSet(pl); renderStories();
  });
  // reorder by dragging ≡
  let plDrag = null;
  $("#plList").addEventListener("pointerdown", e => {
    const h = e.target.closest("[data-drag]"); if (!h) return;
    e.preventDefault(); plDrag = h.closest(".pl-it"); plDrag.classList.add("drag"); h.setPointerCapture(e.pointerId);
  });
  $("#plList").addEventListener("pointermove", e => {
    if (!plDrag) return;
    const over = [...$$("#plList .pl-it")].find(x => x !== plDrag && (r => e.clientY > r.top && e.clientY < r.bottom)(x.getBoundingClientRect()));
    if (over) { const r = over.getBoundingClientRect(); $("#plList").insertBefore(plDrag, e.clientY < r.top + r.height / 2 ? over : over.nextSibling); }
  });
  const plDrop = () => { if (!plDrag) return; plDrag.classList.remove("drag"); plDrag = null; const pl = plGet(); pl.order = [...$$("#plList .pl-it")].map(x => Number(x.dataset.id)); plSet(pl); renderStories(); };
  ["pointerup", "pointercancel"].forEach(ev => $("#plList").addEventListener(ev, plDrop));

  function playStory(qi, at) {
    const id = night.queue[qi], i = LESSONS.findIndex(x => x.id === id); if (i < 0) return;
    night.qi = qi; night.gapDone = -1;
    if (i !== state.idx) setLesson(i);
    night.shown = -1;
    const start = () => { player.currentTime = at || 0; showNow(Math.max(0, lineAt(at || 0))); player.play().catch(() => toast(t("playFailed"))); };
    player.readyState >= 1 ? start() : player.addEventListener("loadedmetadata", start, { once: true });
  }
  function startQueue(q, id, at) {
    const pl = plGet();
    night.queue = q; setSpeed(pl.speed); $("#night").classList.toggle("no-tr", !pl.tr); night.gap = pl.gap;
    unlockAudio(); nightSleep(pl.sleep);
    playStory(q.indexOf(id), at);
  }
  $("#plStart").onclick = () => {
    const pl = plGet(); let q = plOrdered(pl).filter(id => plSel(pl, id)); if (!q.length) return;
    if (pl.mode === "random") q = shuffleArr(q);
    const st = plStartPoint(pl, q);
    startQueue(q, st.id, st.t);
  };
  $("#plStart").addEventListener("click", () => { queueSheet(false); go("audio"); });
  // the queue sheet lives in the player
  function queueSheet(open) {
    if (open) renderStories();
    $("#qSheet").hidden = !open; $("#qBack").hidden = !open;
    $("#qBtn")?.classList.toggle("on", !!open);
  }
  $("#qBtn").addEventListener("click", () => { if (document.body.dataset.screen !== "audio") go("audio"); queueSheet($("#qSheet").hidden); });
  $("#qClose").onclick = () => queueSheet(false);
  $("#qBack").onclick = () => queueSheet(false);
  // remember where we are; move on to the next story at the end; optional pause after each sentence
  let plSaveT = 0, posSaveT = 0;
  player.addEventListener("timeupdate", () => {
    if (player.paused || clipStop != null || Date.now() - posSaveT < 3000) return;
    posSaveT = Date.now(); const m = store.get("posMap", {}); m[LESSONS[state.idx].id] = player.ended ? 0 : Math.round(player.currentTime); store.set("posMap", m);
  });
  player.addEventListener("timeupdate", () => {
    if (!night.queue || player.ended) return;
    if (Date.now() - plSaveT > 4000) { plSaveT = Date.now(); const pl = plGet(); pl.pos = { id: LESSONS[state.idx].id, t: player.currentTime }; plSet(pl); }
    const l = lines[curLine];
    if (night.gap && timed && l && !player.paused && !night.gapWait && night.gapDone !== curLine && player.currentTime >= l.t1 - 0.05 && player.currentTime < l.t1 + 0.6) {
      night.gapDone = curLine; player.pause();
      night.gapWait = setTimeout(() => { night.gapWait = 0; player.play(); }, night.gap * 1000);
    }
  });
  player.addEventListener("ended", () => {
    if (!night.queue) return;
    const pl = plGet(); pl.pos = null; plSet(pl);
    if (night.sleepMode === "end") { nightSleep(0); return; }
    if (night.qi + 1 < night.queue.length) setTimeout(() => playStory(night.qi + 1, 0), 1500);
  });

  /* ---------- Audio ---------- */
  function act(a) {
    if (a === "toggle" && night.gapWait) { clearTimeout(night.gapWait); night.gapWait = 0; player.pause(); return; }
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
  const POSG = ["N", "V", "A", "Adv", "Pro", "Pr", "K", "F", "X"].map(k => [k, "pos" + k]);
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
  const ST_NAME = { get k() { return t("stK"); }, get p() { return t("stP"); }, get s() { return t("stS"); }, get n() { return t("stN"); } };
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
    $("#vocabSub").textContent = `${LESSONS[state.idx] ? lsName(state.idx) + " · " : ""}${tf("nWords", { n: vocabList.length })}`;
    $("#vMbar").innerHTML = ["k", "p", "s", "n"].map(k => `<i style="flex:${stats[k]};background:${ST_COL[k]}"></i>`).join("");
    $("#vMleg").innerHTML = ["k", "p", "s", "n"].map(k => `<button data-vf="${k}" class="${state.vf === k ? "on" : ""}"><i style="background:${ST_COL[k]}"></i><b>${stats[k]}</b> ${ST_NAME[k]}</button>`).join("");
    $("#vocabPos").innerHTML = `<button data-pos="all" class="${state.vpos === "all" ? "on" : ""}">${t("all")} <b>${vocabList.length}</b></button>` +
      POSG.filter(([k]) => byPos[k]).map(([k, name]) => `<button data-pos="${k}" class="${state.vpos === k ? "on" : ""}">${t(name)} <b>${byPos[k]}</b></button>`).join("");
    const list = vocabList.filter(v => (state.vf === "all" || v.st === state.vf) && (state.vpos === "all" || v.pg === state.vpos)
      && (!q || v.de.toLowerCase().includes(q) || v.fa.includes(q)))
      .sort((a, b) => baseWord(a).localeCompare(baseWord(b), "de", { sensitivity: "base" }));
    const groups = [];
    list.forEach(v => { const L = letterOf(v); if (!groups.length || groups[groups.length - 1][0] !== L) groups.push([L, []]); groups[groups.length - 1][1].push(v); });
    $("#vocabGrid").innerHTML = groups.map(([L, vs]) => `<div class="dsec">${esc(L)}</div><div class="dgrp">${vs.map(v => {
      const ar = articleOf(v), pl = pluralOf(v), [, , short] = POSG.find(x => x[0] === v.pg);
      return `<div class="drow" data-de="${esc(v.key)}">${ST_SVG[v.st]}<div class="dtx"><div class="dw">${ar ? `<span class="ar ${ar}">${ar}</span> ` : ""}${esc(baseWord(v))}${pl ? `<span class="pl">· ${esc(pl)}</span>` : ""}</div><div class="dm fa">${esc(v.fa)}</div></div>
        <span class="pos ${v.pg === "N" ? "N-" + (ar || "die") : v.pg}">${short}</span><button class="spk" data-say="${esc(v.de)}" aria-label="${t("listenAria")}">${SAY_ICON}</button></div>`;
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
  // into: render the card inside that element (dialog side panel) instead of the bottom sheet
  function openEntry(key, into) {
    const v = vocabList.find(x => x.key === key) || vocabEntry(key); if (!v) return;
    markSeen(key);
    const ar = articleOf(v), pl = pluralOf(v), pg = wordType(v.p), word = baseWord(v);
    const seen = seenMap()[key] || 0, [right = 0, wrong = 0] = fcStats()[key] || [];
    const tries = right + wrong, pct = tries ? Math.round(right / tries * 100) : 0;
    const GEN = { der: t("masc"), die: t("fem"), das: t("neut") };
    let tags = [], table = "", notes = [], forms = [word, ...((DICT[key] || {}).f || [])];
    if (pg === "V") {
      const vb = G.verb(key);
      tags = [`<span class="pos V">${t("tVerb")} · ${t(vb.irr ? "irregular" : "regular")}</span>`, `<span class="pos P">${tf("perfWith", { a: vb.aux })}</span>`];
      if (vb.sep) tags.push(`<span class="pos P">${t("separable")}</span>`); if (vb.refl) tags.push(`<span class="pos P">${t("reflexive")}</span>`); if (vb.modal) tags.push(`<span class="pos P">${t("modalV")}</span>`);
      table = `<div class="vs-sec">${t("conjugation")}</div><div class="conj"><table><tr><th></th><th>Präsens</th><th>Präteritum</th><th>Perfekt</th></tr>${vb.rows.map(r => `<tr><td>${r.p}</td><td><b>${esc(r.pr)}</b></td><td>${esc(r.pt)}</td><td><span class="aux">${esc(r.pf)}</span> ${esc(r.pp)}</td></tr>`).join("")}</table></div>`;
      notes = G.verbNotes(vb);
      vb.rows.forEach(r => { forms.push(r.pr.split(" ")[0], r.pt.split(" ")[0]); }); forms.push(vb.pp);
    } else if (pg === "N" && ar) {
      tags = [`<span class="pos N-${ar}">${ar} · ${GEN[ar]}</span>`]; if (pl) tags.push(`<span class="pos P">${tf("pluralP", { p: esc(pl) })}</span>`);
      const nn = G.noun(word, ar, pl);
      table = `<div class="vs-sec">${t("declension")}</div><div class="conj"><table><tr><th></th><th>Singular</th><th></th>${nn.hasPlural ? "<th>Plural</th>" : ""}</tr>${nn.rows.map(r => `<tr><td>${r.c.slice(0, 3)}.</td><td><b>${esc(r.def)}</b></td><td>${esc(r.ind)}</td>${nn.hasPlural ? `<td>${esc(r.pl)}</td>` : ""}</tr>`).join("")}</table></div>`;
      notes = nn.notes; if (pl) forms.push(pl);
    } else {
      const [, name] = POSG.find(x => x[0] === pg);
      tags = [`<span class="pos P fa">${esc(I18N.pos(v.p) || t(name))}</span>`];
      if (pg === "A") {
        const a = G.adj(word);
        if (a) { table = `<div class="vs-sec">${t("comparison")}</div><div class="conj"><table><tr><th>Positiv</th><th>Komparativ</th><th>Superlativ</th></tr><tr><td><b>${esc(a.pos)}</b></td><td>${esc(a.comp)}</td><td>${esc(a.sup)}</td></tr></table></div>`;
          notes.push(tf("adjAttr", { x: a.attr.map(G.de).join(" · ") }), tf("adjPred", { v: G.de("sein/werden"), x: G.de(`Das ist ${a.pos}.`) })); }
      }
      const sm = G.smallNotes(key, v.p || "");
      notes.push(...sm.notes);
      if (sm.table) table = `<div class="vs-sec">${t("forms")}</div><div class="conj"><table><tr>${sm.table.head.map(h => `<th>${h}</th>`).join("")}</tr>${sm.table.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<td><b>${esc(c)}</b></td>`).join("")}</tr>`).join("")}</table></div>`;
    }
    const inL = (keyLessons()[key] || []).map(i => `${lsCode(i)} · ${LESSONS[i].level || ""}`);
    tags.push(inL.length ? `<span class="pos P">${inL.join(" · ")}</span>` : `<span class="pos P">${t("notInLessons")}</span>`);
    // notes from the dictionary first (usage, idioms), then the rules
    const own = (v.g || "").split(" · ").filter(x => x && x !== v.de && !/^جمع:/.test(x) && !(pg === "V" && /^(ich|du|er|sie|es|wir|ihr|Sie) \S+$/.test(x))).map(x => `<bdi dir="auto">${esc(x)}</bdi>`);
    // rule notes from grammar.js are written in Persian only; hide them in other UI languages
    const all = [...own, ...(I18N.lang === "fa" ? notes : notes.filter(n => !/[\u0600-\u06FF]/.test(n.replace(/<[^>]*>/g, ""))))];
    const ex = examplesFor(v, forms);
    const target = into || $("#vSheet");
    target.innerHTML = `<div class="vs-grab"></div>
      <div class="vs-scroll">
      <div class="vs-top"><span class="vs-big">${ar ? `<span class="ar ${ar}">${ar}</span> ` : ""}${esc(word)}</span>
        <button class="spk big" data-say="${esc(v.de)}" aria-label="${t("listenAria")}">${SAY_ICON}</button><button class="vs-x" id="vsClose" aria-label="${t("close")}">✕</button></div>
      <div class="vs-tags">${tags.join("")}</div>
      <div class="vs-mean fa">${esc(v.fa)}</div>
      ${table}
      ${all.length ? `<div class="vs-sec">${t("grammarNote")}</div><div class="gram fa">${all.map(n => `<div class="li"><span>${n}</span></div>`).join("")}</div>` : ""}
      ${ex.length ? `<div class="vs-sec">${t("fromLesson")}</div>${ex.map(e => `<div class="quote ${whoCls(e.who)}"><span class="who">${esc(e.who.toUpperCase())} · ${tf("lineN", { n: e.i + 1 })}</span><span class="qde">${e.html}</span><span class="qfa fa">${esc(e.fa)}</span></div>`).join("")}` : ""}
      </div>
      <div class="vs-stats"><div><span class="vs-ico">👁</span><div><b>${seen}×</b><span>${t("seenL")}</span></div></div>
        <div><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="4" opacity=".15"/>${tries ? "" : "<!--"}<circle cx="18" cy="18" r="15" fill="none" stroke="${pct >= 70 ? "#30D158" : pct >= 40 ? "#FF9F0A" : "#FF375F"}" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 18 18)"/>${tries ? "" : "-->"}</svg>
          <div><b>${tries ? pct + "%" : "—"}</b><span>${tries ? tf("rightOf", { a: right, b: tries }) : t("notPracticed")}</span></div></div></div>`;
    if (into) { target.querySelector("#vsClose").onclick = closeSide; return; }
    $("#vBack").hidden = false;
    $("#vsClose").onclick = closeEntry;
  }
  function closeEntry() { $("#vBack").hidden = true; $("#vSheet").innerHTML = ""; renderVocab(); }
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
    for (let k = 0; k < 7; k++) { const d = new Date(monday); d.setDate(monday.getDate() + k); const r = all[dayKey(d)] || {}; days.push({ n: d.toLocaleDateString(uiLocale(), { weekday: "narrow" }), min: Math.round((r.l || 0) / 60), s: r.s || 0, today: dayKey(d) === dayKey(now) }); }
    const score = d => d.min + d.s, max = Math.max(1, ...days.map(score));
    $("#hWeek").innerHTML = days.map(d => `<div class="d ${d.today ? "today" : ""}"><i class="${score(d) ? "" : "z"}" style="height:${Math.max(4, score(d) / max * 100)}%" title="${tf("weekSum", { m: d.min, s: d.s })}"></i>${d.n}</div>`).join("");
    $("#hWeekSum").textContent = tf("weekSum", { m: days.reduce((a, d) => a + d.min, 0), s: days.reduce((a, d) => a + d.s, 0) });
    const st = fcStats();
    const weak = vocabList.map(v => { const [r = 0, w = 0] = st[v.key] || []; return { v, n: r + w, pct: r + w ? Math.round(r / (r + w) * 100) : 0 }; })
      .filter(x => x.n && x.pct < 70).sort((a, b) => a.pct - b.pct).slice(0, 5);
    $("#hReview").innerHTML = weak.length ? weak.map(x => `<button class="r" data-entry="${esc(x.v.key)}"><b>${esc(x.v.de)}</b><span class="fa">${esc(x.v.fa)}</span><span class="sc">${x.pct}%</span></button>`).join("")
      : `<p class="fa muted rev-empty">${t("nothingHere")}</p>`;
    const dl = store.get(bestKey("dlg"), {}), fcAll = Object.values(st).reduce((a, [r = 0, w = 0]) => [a[0] + r, a[1] + r + w], [0, 0]);
    const best = { role: dl.role, gap: dl.gap, read: dl.read, fc: fcAll[1] ? Math.round(fcAll[0] / fcAll[1] * 100) : undefined, exam: store.get("exam" + (LESSONS[state.idx] || {}).id, undefined) };
    // the four skills and the final exam, like the practice page
    const eb = store.get("exam" + (LESSONS[state.idx] || {}).id, null);
    $("#hPrac").innerHTML = SKILLS.map(k => { const p = skillPct(k.id); return `<button class="pt" data-prac="skill:${k.id}"><span class="ic" style="background:${k.color}">${k.ic}</span><span class="tx"><b>${t(k.fa)}</b><span class="bar"><i style="width:${p}%"></i></span></span></button>`; }).join("")
      + `<button class="pt" data-prac="exam"><span class="ic" style="background:linear-gradient(135deg,#FF2D55,#7B3FF2)">🏁</span><span class="tx"><b>${t("examTitle")}</b><small>${eb != null ? eb + "%" : "—"}</small><span class="bar"><i style="width:${eb || 0}%"></i></span></span></button>`;
  }
  $("#hReview").addEventListener("click", e => { const b = e.target.closest("[data-entry]"); if (b) openEntry(b.dataset.entry); });
  $("#hPrac").addEventListener("click", e => { const b = e.target.closest("[data-prac]"); if (!b) return; practiceOpen(b.dataset.prac); });

  /* ---------- Vocab scope ---------- */
  state.vscope = "lesson";
  $("#vocabScope").addEventListener("click", e => {
    const b = e.target.closest("[data-scope]"); if (!b) return;
    state.vscope = b.dataset.scope; $$("#vocabScope button").forEach(x => x.classList.toggle("on", x === b));
    buildVocab(); renderVocab();
  });

  // best results are kept per lesson (dlg1, fs1, …); older global values belong to lesson 1
  const bestKey = (k, i = state.idx) => k + (LESSONS[i] || {}).id;
  for (const k of ["dlg", "fs"]) { const old = store.get(k, null); if (old && store.get(k + "1", null) == null) store.set(k + "1", old); }

  /* ---------- Speech: recognition + scoring ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let activeRec = null;
  const stopListening = () => { try { activeRec?.abort(); } catch {} activeRec = null; };
  // one short listening session: mic on → one phrase → mic off (resolves only after the mic is released)
  function listen(lang = "de-DE") {
    return new Promise((resolve, reject) => {
      if (!SR) return reject(new Error("no-sr"));
      stopListening();
      const r = new SR(); r.lang = lang; r.interimResults = false; r.continuous = false; r.maxAlternatives = 4;
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
    $("#dlgFoot").innerHTML = `<button class="btn big" id="dlgStart">🎤 ${t("start")}</button>`;
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
  /* ---------- Karteikarten: a round of cards with a count, a list of this round and a 5 s pause ---------- */
  // browsers recognise Russian, Ukrainian and German speech, but not Persian: Persian answers are chosen from options
  const SR_LANG = { ru: "ru-RU", uk: "uk-UA" };
  const nativeVoice = () => !!(SR && SR_LANG[I18N.lang]);
  function renderFcStats() {
    $("#fcStats").innerHTML = `<span class="ok">✓ ${fc.right}</span><span class="bad">✗ ${fc.wrong}</span>`;
    const s = fc.sess;
    if (!s || exam.active) { $("#kcCount").textContent = ""; $("#kcDots").innerHTML = ""; return; }
    $("#kcCount").textContent = `${Math.min(s.i, s.n)} / ${s.n}`;
    $("#kcDots").innerHTML = Array.from({ length: s.n }, (_, k) => { const e = s.log[k]; return `<i class="${e ? (e.ok ? "ok" : "bad") : k === s.i - 1 ? "cur" : ""}"></i>`; }).join("");
  }
  function renderKcLog() {
    const s = fc.sess, box = $("#kcLog");
    $("#kcLogWrap").hidden = exam.active || !s || !s.log.length;
    if (!s) return;
    box.innerHTML = s.log.slice().reverse().map(e => `<div class="kc-li"><span class="d ${e.ok ? "ok" : "bad"}">${e.ok ? "✓" : "✗"}</span><b dir="ltr">${esc(e.v.de)}</b><small class="fa">${e.said ? `«${esc(e.said)}»${e.ok ? "" : " · " + esc(e.dir === "de" ? e.v.fa : e.v.de)}` : esc(e.v.fa)}</small></div>`).join("");
  }
  function openCards(from) {
    fc.from = from || "";
    if (document.body.dataset.screen !== "practice") go("practice");
    showPanel("pFc", t("fcTitle"));
    fcSession();
  }
  function fcSession() {
    fc.list = lessonKeys(LESSONS[state.idx], lines).map(vocabEntry).filter(Boolean);
    fc.sess = { n: Math.min(20, fc.list.length), i: 0, log: [] };
    fc.right = fc.wrong = fc.streak = 0;
    $("#fcCard").hidden = false; $("#kcDone").hidden = true;
    renderKcLog(); nextCard();
  }
  function fcSummary() {
    const s = fc.sess, ok = s.log.filter(e => e.ok).length;
    $("#fcCard").hidden = true; $("#kcDone").hidden = false;
    $("#kcDone").innerHTML = `<div class="kc-big">${ok} / ${s.n}</div><div class="fa">${t("kcDone")}</div><button class="btn big" id="kcAgain">↻ ${t("again")}</button>`;
    $("#kcAgain").onclick = fcSession;
    renderFcStats(); renderKcLog();
  }
  function fcCountdown() {
    clearInterval(fc.cdT); fc.cd = 5;
    const lab = () => { $("#fcNext").innerHTML = `${t("nextBtn")} <span class="kc-cd">${fc.cd}</span>`; $("#fcNext").style.setProperty("--cd", (5 - fc.cd) / 5 * 100 + "%"); };
    lab();
    fc.cdT = setInterval(() => { fc.cd--; if (fc.cd <= 0) { clearInterval(fc.cdT); $("#fcNext").click(); } else lab(); }, 1000);
  }
  function nextCard() {
    clearTimeout(fc.timer); clearInterval(fc.cdT);
    fc.list = lessonKeys(LESSONS[state.idx], lines).map(vocabEntry).filter(Boolean);
    if (!fc.list.length) return;
    if (!exam.active) {
      if (!fc.sess) fc.sess = { n: Math.min(20, fc.list.length), i: 0, log: [] };
      if (fc.sess.i >= fc.sess.n) return fcSummary();
      fc.sess.i++;
    }
    const v = pickWord(); fc.cur = v; fc.last = v.key;
    fc.dir = Math.random() < 0.5 ? "de" : "fa";
    const voice = fc.dir === "fa" ? !!SR : nativeVoice();
    $("#fcDir").innerHTML = fc.dir === "de" ? `${t("german")} → ${t("nativeLang")}${voice ? " 🎤" : ""}` : `${t("nativeLang")} → ${t("german")}${voice ? " 🎤" : ""}`;
    $("#fcPrompt").innerHTML = fc.dir === "de"
      ? `<span>${esc(v.de)}</span><button class="say" data-say="${esc(v.de)}">${SAY_ICON}</button>`
      : `<span class="fa">${esc(v.fa)}</span>`;
    $("#fcPos").textContent = I18N.pos(v.p);
    const opts = [v];
    for (let k = 0; k < 2; k++) { const d = closeDistractor(v, fc.dir); if (d && !opts.some(o => o.key === d.key)) opts.push(d); }
    $("#fcOpts").innerHTML = voice ? "" : shuffleArr(opts).map(o => `<button data-k="${esc(o.key)}" class="${fc.dir === "de" ? "fa" : ""}">${esc(fc.dir === "de" ? o.fa : o.de)}</button>`).join("");
    $("#fcOpts").hidden = voice;
    $("#fcVoice").hidden = !voice; $("#fcHeard").textContent = fc.dir === "de" ? t("kcSayNative") : t("sayGerman");
    $("#fcInfo").hidden = true; $("#fcNext").hidden = true;
    $("#fcCard").className = "fc-card";
    renderFcStats();
    if (fc.dir === "de") speak(v.de);
    if (voice) fc.timer = setTimeout(() => { if (fc.cur === v && !$("#fcVoice").hidden) $("#fcMic").click(); }, fc.dir === "de" ? 1400 : 700);
  }
  function fcAnswer(ok, said) {
    const v = fc.cur;
    const st = fcStats(), [r = 0, w = 0] = st[v.key] || [];
    st[v.key] = ok ? [r + 1, w] : [r, w + 1]; store.set("fc", st);
    if (ok) { fc.right++; fc.streak++; if (st[v.key][0] >= 3 && !state.known.has(v.key)) { state.known.add(v.key); store.set("known", [...state.known]); renderProgress(); } }
    else { fc.wrong++; fc.streak = 0; }
    if (!exam.active && fc.sess) { fc.sess.log.push({ v, ok, said: said || "", dir: fc.dir }); renderKcLog(); }
    $("#fcCard").className = "fc-card " + (ok ? "ok" : "bad");
    $("#fcInfo").innerHTML = `<div class="fc-pair"><b dir="ltr">${esc(v.de)}</b> = ${esc(v.fa)}</div>${v.g ? `<div class="fc-g">${esc(v.g)}</div>` : ""}`;
    $("#fcInfo").hidden = false; $("#fcNext").hidden = false; $("#fcVoice").hidden = true;
    renderFcStats();
    if (fc.dir === "fa") { speak(v.de); if (ok) logDay("s", 1); }
    if (exam.active) examRecord(ok);
    fcCountdown();
  }
  $("#fcOpts").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const ok = b.dataset.k === fc.cur.key;
    $$("#fcOpts button").forEach(x => { x.disabled = true; if (x.dataset.k === fc.cur.key) x.classList.add("ok"); });
    if (!ok) b.classList.add("bad");
    fcAnswer(ok);
  });
  // German → say the meaning in Russian/Ukrainian; native → say the German word
  const meaningWords = v => (v.fa || "").toLowerCase().split(/[\s,;/()·.!?«»"]+/).filter(w => w.length > 1);
  $("#fcMic").onclick = async () => {
    const v = fc.cur, toNative = fc.dir === "de";
    $("#fcMic").classList.add("rec"); $("#fcHeard").textContent = t("listening");
    try {
      const alts = await listen(toNative ? SR_LANG[I18N.lang] : "de-DE");
      let ok;
      if (toNative) {
        const want = meaningWords(v);
        ok = alts.some(a => a.toLowerCase().split(/\s+/).some(h => want.some(w => h === w || (w.length > 4 && h.slice(0, 4) === w.slice(0, 4)))));
      } else {
        const forms = [bareDe(v), ...(DICT[v.key]?.f || [])].map(f => window.Practice.norm(f));
        ok = alts.some(a => nw(a).some(w => forms.includes(w)));
      }
      $("#fcHeard").innerHTML = `<span class="fa">${t("heard")}</span> «${esc(alts[0])}»`;
      fcAnswer(ok, alts[0]);
    } catch (err) { $("#fcHeard").textContent = t("heardNothing"); }
    $("#fcMic").classList.remove("rec");
  };
  $("#fcSkip").onclick = () => fcAnswer(false);
  $("#fcNext").onclick = () => { clearInterval(fc.cdT); exam.active ? examNext() : nextCard(); };
  $("#vocabFc").onclick = () => openCards("vocab");

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
  // (muted and rewound, so nothing is heard — it used to play a bit of the lesson under the microphone)
  function unlockAudio() {
    if (!player.paused || !player.src) { try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {} return; }
    const t0 = player.currentTime, wasMuted = player.muted;
    player.muted = true;
    const done = () => { player.pause(); try { player.currentTime = t0; } catch {} player.muted = wasMuted; };
    try { const p = player.play(); p ? p.then(done).catch(() => { player.muted = wasMuted; }) : done(); } catch { player.muted = wasMuted; }
    try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {}
  }
  player.addEventListener("timeupdate", () => { if (clipStop != null && player.currentTime >= clipStop) { player.pause(); clipStop = null; clipDone?.(); clipDone = null; } });
  player.addEventListener("pause", () => { if (clipStop == null && clipDone) { clipDone(); clipDone = null; } });

  function buildPractice() {
    ex.list = window.Practice ? window.Practice.build(LESSONS[state.idx], lines, w => { const k = dictKey(w); return k ? DICT[k] : {}; }) : [];
    ex.i = Math.min(store.get(exKey() + ":i", 0), ex.list.length - 1);
    renderHub();
  }
  const visibleEx = () => ex.list.filter(e => ex.filter === "all" || (Array.isArray(ex.filter) ? ex.filter.includes(e.type) : e.type === ex.filter));
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
    fb.innerHTML = `<div class="fb-title">${correct ? "✓ " + t("wellDone") : "✗ " + t("listenAgain")}</div>
      ${detail}
      <div class="fb-ans"><button class="say" data-say="${esc(e.answer)}">${SAY_ICON}</button><span>${esc(e.answer)}</span></div>
      ${l && l.fa ? `<div class="fa fb-fa">${esc(e.explain || l.fa)}</div>` : ""}
      ${timed ? `<button class="chip-btn" id="exClip">${t("hearInDialog")}</button>` : ""}`;
    $("#exClip") && ($("#exClip").onclick = () => playClip(e.line));
    $("#exCheck").hidden = true; $("#exNext").classList.add("pulse");
    renderMap(); renderProgress(); renderHub();
    if (exam.active) examRecord(correct);
  }

  function renderExercise() {
    const e = ex.list[ex.i]; if (!e) return;
    store.set(exKey() + ":i", ex.i);
    $("#exType").textContent = window.Practice.TYPE_LABEL[e.type][1];
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
        <p class="ex-sent">${esc(e.before)}<input id="exInput" autocomplete="off" autocapitalize="off" spellcheck="false" size="${Math.max(4, e.answer.length)}" aria-label="${t("gaps")}">${esc(e.after)}</p>
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
        <div class="speak-row">${SR ? `<button class="mic" id="exMic" aria-label="${t("mic")}">🎤</button>` : ""}
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
  // practice scope: this lesson, every lesson of its level, or everything
  const prScope = () => store.get("prScope", "lesson");
  function scopePool() {
    const sc = prScope(), L = LESSONS[state.idx];
    if (sc === "lesson") return [state.idx];
    return LESSONS.map((x, i) => i).filter(i => sc === "all" || LESSONS[i].level === L.level);
  }
  // with a wider scope, each session takes a lesson from the pool (the least practised first)
  function scopeLesson() {
    const pool = scopePool(); if (pool.length < 2) return;
    const i = pool.map(i => [lessonPct(i) + Math.random() * 15, i]).sort((a, b) => a[0] - b[0])[0][1];
    if (i !== state.idx) { setLesson(i); toast(`${lsCode(i)} · ${LESSONS[i].title}`); }
  }
  function renderHub() {
    const L = LESSONS[state.idx], sc = prScope();
    $("#phSub").textContent = `${lsCode(state.idx)} · ${L.title}`;
    $("#prScope").innerHTML = [["lesson", `${lsCode(state.idx)} · ${L.level}`], ["level", tf("allLevel", { l: L.level })], ["all", t("everything")]].map(([k, v]) => `<button data-scope="${k}" class="${sc === k ? "on" : ""}">${v}</button>`).join("");
    $("#prSkills").innerHTML = SKILLS.map(k => { const p = skillPct(k.id); return `<button class="pr-sk" data-skill="${k.id}"><span class="ic" style="background:${k.color}">${k.ic}</span><span class="tx"><b>${t(k.fa)}</b></span><span class="bar"><i style="width:${p}%;background:${k.color}"></i></span></button>`; }).join("");
    const eb = store.get("exam" + L.id, null);
    $("#phExamSub").textContent = t("examMix") + " · " + tf("examBest", { b: eb != null ? eb + "%" : "—" });
    renderMap();
  }
  $("#prScope").addEventListener("click", e => { const b = e.target.closest("[data-scope]"); if (!b) return; store.set("prScope", b.dataset.scope); renderHub(); });

  /* ---------- Skill pages ---------- */
  const skOpt = { role: "both", gaps: "off", help: true, topic: -1, cues: false };
  function openSkill(id) {
    const sk = SKILLS.find(k => k.id === id); skOpt.skill = id;
    showPanel("pSkill", `${sk.ic} ${t(sk.fa)}`);
    renderSkill();
  }
  function renderSkill() {
    const id = skOpt.skill, sk = SKILLS.find(k => k.id === id), res = exResults();
    const chips = (key, vals) => vals.map(([v, lab]) => `<button data-o="${key}" data-v="${esc(String(v))}" class="${String(skOpt[key]) === String(v) ? "on" : ""}">${esc(lab)}</button>`).join("");
    const tg = key => `<button class="tg" data-t="${key}" aria-pressed="${!!skOpt[key]}"></button>`;
    const exRows = types => types.map(tp => { const l = ex.list.filter(e => e.type === tp), d = l.filter(e => res[e.id] === true).length; if (!l.length) return ""; const [de, fa] = window.Practice.TYPE_LABEL[tp];
      return `<button class="sk-ex" data-ex="${tp}"><span class="ic">${TYPE_ICON[tp] || "•"}</span><span class="tx"><b>${fa}</b></span><span class="n">${d}/${l.length}</span><span class="go">›</span></button>`; }).join("");
    let html = "";
    if (id === "speak") {
      const whos = [...new Set(lines.map(l => l.who).filter(Boolean))].slice(0, 4), sd = speakData();
      if (!whos.some(w => whoCls(w) === skOpt.role)) skOpt.role = "both";
      if (skOpt.topic >= sd.topics.length) skOpt.topic = -1;
      html = `<div class="sk-card"><h3>💬 ${t("dlgSpeak")}</h3><p class="fa">${t("skDialogSub")}</p>
          ${whos.length > 1 ? `<div class="sk-opt"><span>${t("yourRole")}</span><span class="sk-chips">${chips("role", [...whos.map(w => [whoCls(w), w]), ["both", t("all")]])}</span></div>` : ""}
          <div class="sk-opt"><span>${t("gaps")}</span><span class="sk-chips">${chips("gaps", [["off", t("off")], ["light", t("easy")], ["hard", t("hard")]])}</span></div>
          <div class="sk-opt"><span>${t("showTranslation")}</span>${tg("help")}</div>
          <button class="sk-go" data-go-sk="dialog">🎤 ${t("start")}</button></div>
        <div class="sk-card"><h3>🗣️ ${t("freeTalk")}</h3><p class="fa">${t("skFreeSub")}</p>
          <div class="sk-opt"><span>${t("topic")}</span><span class="sk-chips">${chips("topic", [[-1, t("none")], ...sd.topics.map((tp, i) => [i, tp[I18N.lang] || tp.fa || tp.de])])}</span></div>
          <div class="sk-opt"><span>${t("skCues")}</span>${tg("cues")}</div>
          <button class="sk-go alt" data-go-sk="free">🎤 ${t("start")}</button></div>
        ${exRows(sk.types)}`;
    } else {
      html = `<p class="fa sk-sub">${t("sk_" + id)}</p>${exRows(sk.types)}<button class="sk-go" data-go-sk="mix">${t("start")} · ${t("skMix")}</button>`;
    }
    $("#skPage").innerHTML = html;
  }
  $("#skPage").addEventListener("click", e => {
    const o = e.target.closest("[data-o]"); if (o) { const v = o.dataset.v; skOpt[o.dataset.o] = isNaN(v) ? v : Number(v); renderSkill(); return; }
    const tgl = e.target.closest("[data-t]"); if (tgl) { skOpt[tgl.dataset.t] = !skOpt[tgl.dataset.t]; renderSkill(); return; }
    const x = e.target.closest("[data-ex]"); if (x) { scopeLesson(); openExercises([x.dataset.ex]); return; }
    const g = e.target.closest("[data-go-sk]"); if (!g) return;
    scopeLesson();
    const k = g.dataset.goSk, sk = SKILLS.find(s => s.id === skOpt.skill);
    if (k === "dialog") startDialog(skOpt.gaps !== "off" ? "gap" : skOpt.role !== "both" ? "role" : "read", { ...skOpt });
    else if (k === "free") startFree(skOpt.cues ? "cue" : skOpt.topic >= 0 ? "topic" : "free", skOpt.topic);
    else openExercises(sk.types);
  });
  function openExercises(types) {
    ex.filter = types;
    const v = visibleEx(), res = exResults();
    const next = v.find(x => res[x.id] === undefined) || v[0];
    if (next) ex.i = next.id;
    const sk = SKILLS.find(k => k.id === skOpt.skill);
    showPanel("pEx", types.length === 1 ? window.Practice.TYPE_LABEL[types[0]][1] : sk ? t(sk.fa) : t("exercisesT")); renderExercise();
  }
  // one entry point for every practice mode (used by the lesson page, home and the hub)
  function practiceOpen(k) {
    if (document.body.dataset.screen !== "practice") go("practice");
    if (!k.startsWith("skill:")) skOpt.skill = null;
    if (k.startsWith("skill:")) openSkill(k.slice(6));
    else if (k.startsWith("ex:")) openExercises([k.slice(3)]);
    else if (k === "fc") openCards();
    else if (k === "exam") { scopeLesson(); startExam(); }
    else if (k === "free" || k === "topic" || k === "cue") startFree(k);
    else startDialog(k);
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
  $("#pBack").onclick = () => {
    const panel = [...$$("#pView .pv-panel")].find(p => !p.hidden)?.id;
    clearInterval(fc.cdT); clearTimeout(fc.timer);
    if (panel === "pFc" && fc.from === "vocab") { fc.from = ""; closeView(); go("vocab"); return; }
    if (panel !== "pSkill" && skOpt.skill && panel !== "pFc") { closeView(); openSkill(skOpt.skill); return; }
    skOpt.skill = null; closeView();
  };
  $("#pHub").addEventListener("click", e => {
    const sk = e.target.closest("[data-skill]"); if (sk) { openSkill(sk.dataset.skill); return; }
    const b = e.target.closest("[data-open]"); if (b) practiceOpen(b.dataset.open);
  });

  /* ---------- Dialog speaking: role play · gap dialog · read aloud ---------- */
  const dlg = { run: 0, items: [], i: 0, mode: "", role: "" };
  const DLG = {
    get role() { return [t("dlgSpeak"), t("role")]; },
    get gap() { return [t("dlgSpeak"), t("gap")]; },
    get read() { return [t("dlgSpeak"), t("read")]; }
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
  function blanksFor(text, level = "light") {
    const cands = window.Practice.words(text).filter(w => w.length >= 3 && !NAMES[w] && DICT[dictKey(w)] && !/^(der|die|das|und|ich|du|wir|ihr|sie|es|ein|eine)$/i.test(w));
    const n = level === "hard" ? (wcount(text) > 8 ? 3 : 2) : wcount(text) > 10 ? 2 : 1;
    const pick = shuffleArr([...new Set(cands)]).slice(0, n);
    return pick;
  }
  // one dialog exercise with options: your role (or all lines), gaps (off/light/hard), translation help
  function startDialog(mode, opts = {}) {
    stopListening(); recCancel(); $("#dlgSheet").hidden = true; dlg.resolve?.(); dlg.run++; dlg.mode = mode; dlg.i = 0;
    dlg.opts = { role: "both", gaps: mode === "gap" ? "light" : "off", help: true, ...opts };
    const role = dlg.opts.role;
    let idx = pickBlock(mode === "gap" ? 6 : 8, 22);
    // a block where your role speaks at least twice
    if (role !== "both") for (let k = 0; k < 20 && idx.filter(i => whoCls(lines[i].who) === role).length < 2; k++) idx = pickBlock(8, 22);
    let mine = idx.map(i => role === "both" ? true : whoCls(lines[i].who) === role);
    if (!mine.some(Boolean)) mine = idx.map(() => Math.random() < 0.5);
    if (mode === "role" && role === "both") { mine = idx.map(() => Math.random() < 0.5); while (mine.filter(Boolean).length < 4) mine[Math.floor(Math.random() * mine.length)] = true; }
    dlg.items = idx.map((i, k) => ({ line: i, mine: mine[k], blanks: dlg.opts.gaps !== "off" && mine[k] ? blanksFor(lines[i].text, dlg.opts.gaps) : [], score: null, tries: 0, state: "" }));
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
    // the microphone never records over the lesson audio
    if (!player.paused) { clipStop = null; player.pause(); }
    try { speechSynthesis.cancel(); } catch {}
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
  function startFree(mode, topicIdx = -1) {
    stopListening(); recCancel(); fs.run++; fs.mode = mode; fs.qi = 0; fs.answers = []; fs.text = "";
    const sd = speakData();
    if (mode === "topic") fs.topic = sd.topics[topicIdx >= 0 ? topicIdx : Math.floor(Math.random() * sd.topics.length)];
    if (mode === "cue") fs.set = sd.cues[Math.floor(Math.random() * sd.cues.length)];
    const T = { free: [t("freeTalk"), t("fsFreeSub")], topic: [t("freeTalk"), t("fsTopicSub")], cue: [t("freeTalk"), t("fsCueSub")] }[mode];
    showPanel("pFree", `${T[0]} <span class="fa">· ${esc(T[1])}</span>`);
    $("#fsRes").hidden = true; $("#fsLive").hidden = false; $("#fsBar").hidden = false; $("#fsCnt").hidden = false;
    renderFreeTop(); renderFreeLive("", "");
    $("#fsAuto").classList.toggle("on", fs.auto);
    $("#fsMic").innerHTML = MIC_SVG;
    freeGate();
  }
  // ask for the microphone once, with a clear message if it is blocked
  function freeGate() {
    $("#fsLive").innerHTML = `<div class="fs-gate"><button class="btn big" id="fsStart">🎤 ${t("start")}</button></div>`;
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
    if (fs.mode === "free") $("#fsTop").innerHTML = `<div class="ly-seg" id="fsScope"><button data-sc="lesson" class="${fs.scope === "lesson" ? "on" : ""}">${lsName(state.idx)}</button><button data-sc="all" class="${fs.scope === "all" ? "on" : ""}">${t("allWords")}</button></div><p class="fa fs-hint">${t("fsHintFree")}</p>`;
    if (fs.mode === "topic") { const tp = fs.topic || {}; $("#fsTop").innerHTML = `<div class="topic"><div class="k">${t("topic")}</div><b>${esc(tp.de || "")}</b><div class="fa">${esc(tp[lang] || tp.fa || "")}</div><button class="tp-new" id="fsNewTopic" aria-label="${t("newTopic")}">↻</button></div>`; }
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
    const legend = fs.mode === "topic" ? `<span class="c-tw">● ${t("topic")}</span> <span class="c-lw">● ${t("lesson")}</span>` : fs.mode === "free" && fs.scope === "all" ? `<span class="c-lw">● ${t("dictionary")}</span>` : `<span class="c-lw">● ${lsName(state.idx)}</span> <span class="c-ow">● ${t("other")}</span>`;
    $("#fsCnt").innerHTML = `<div><b>${words.length}</b>${t("wordsSaid")}</div><div><b class="c-lw">${fs.mode === "topic" ? cl.filter(x => x.cls === "tw").length : lessonU.size}</b>${fs.mode === "topic" ? t("onTopic") : fs.scope === "all" && fs.mode === "free" ? t("inDict") : tf("fromX", { c: lsName(state.idx) })}</div><div><b>${uniq.size}</b>${t("distinct")}</div>`;
    if (!$("#fsLive .fs-gate")) $("#fsLive").innerHTML = `<div class="k"><span>${t("live")}</span><span id="fsLegend">${legend}</span></div><div class="lv" dir="ltr">${fin || interim ? liveHtml(fin, interim) : `<span class="ph fa">${fs.mode === "cue" ? t("fsHintCue") : "🎤 …"}</span>`}</div>`;
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
      const lg = $("#fsLegend"); if (lg) lg.innerHTML = ok ? `<span class="c-lw">${t("fitsQ")}</span>` : `<span class="c-ow">~ ${said ? t("example") + ": " + esc(q.ex) : t("fsNotHeard")}</span>`;
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
    const kl = keyLessons(), best = store.get(bestKey("fs"), {});
    let html = "";
    if (fs.mode === "cue") {
      const ok = fs.answers.filter(a => a && a.ok).length, n = fs.set.items.length, pct = Math.round(ok / n * 100);
      best.cue = Math.max(best.cue || 0, pct);
      html = `<div class="big">${ringSvgP(pct)}<div><b>${ok} / ${n}</b><span>${t("answersFit")}</span></div></div>` + fs.set.items.map((q, i) => { const a = fs.answers[i] || {}; return `<div class="qres"><span class="s" style="color:${a.ok ? "#30D158" : "#FF9F0A"}">${a.ok ? "✓" : "~"}</span><div><b>${esc(q.q)}</b><small>${a.said ? "„" + esc(a.said) + "“" : `<span class="fa">${t("fsNotHeard")}</span>`}${a.ok ? "" : ` · <i>${esc(q.ex)}</i>`}</small></div></div>`; }).join("");
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
        html = `<div class="big">${ringSvgP(rel)}<div><b>${tf("topicWords", { n: tw.length })}</b><span class="fa">${tw.length >= 3 ? t("fsTopicOk") : t("fsTopicLow")} · ${rel}% · ${tf("nWords", { n: words })}</span></div></div>
          <div class="rh">${t("topic")} · ${t("fsUsed")}</div><div class="chipsw">${tw.map(chip).join("") || "—"}</div>
          <div class="rh">${t("otherWords")}</div><div class="chipsw">${used.filter(x => x.cls !== "tw").map(chip).join("") || "—"}</div>
          <div class="rh">${t("fsTry").toUpperCase()}</div><div class="chipsw">${miss.map(w => `<span class="m">${esc(w)}</span>`).join("")}</div>`;
      } else if (fs.scope === "all") {
        best.free = Math.max(best.free || 0, used.length);
        html = `<div class="big">${ringSvgP(Math.min(100, used.length * 2))}<div><b>${tf("nWords", { n: used.length })}</b><span class="fa">${tf("fsDictRes", { w: words })}</span></div></div>
          <div class="rh">${t("fsUsed").toUpperCase()}</div><div class="chipsw">${used.map(chip).join("") || "—"}</div>`;
      } else {
        best.free = Math.max(best.free || 0, inL.length);
        html = `<div class="big">${ringSvgP(Math.round(inL.length / (vocabList.length || 1) * 100 * 5))}<div><b>${tf("fsFromL", { a: inL.length, c: lsName(state.idx) })}</b><span>${tf("fsOther", { b: other.length, w: words })}</span></div></div>
          <div class="rh">${lsName(state.idx).toUpperCase()}</div><div class="chipsw">${inL.map(chip).join("") || "—"}</div>
          ${other.length ? `<div class="rh">${t("other")}</div><div class="chipsw">${other.map(chip).join("")}</div>` : ""}
          <div class="rh">${t("fsTry").toUpperCase()}</div><div class="chipsw">${notUsed.map(v => `<button class="m" data-entry="${esc(v.key)}">${esc(v.de)}</button>`).join("")}</div>`;
      }
      const sentences = (fs.text.match(/[^.!?]+/g) || []).filter(x => x.trim().split(/\s+/).length >= 3).length || Math.floor(words / 6);
      if (sentences) logDay("s", Math.min(sentences, 20));
    }
    store.set(bestKey("fs"), best);
    $("#fsRes").innerHTML = html + `<div class="fs-acts"><button class="vs-b sec" id="fsAgain">↻ ${t("again")}</button></div>`;
    $("#fsRes").hidden = false; $("#fsLive").hidden = true; $("#fsBar").hidden = true; $("#fsCnt").hidden = true;
    if (fs.mode === "cue") $("#fsTop").innerHTML = "";
    $("#fsAgain").onclick = () => startFree(fs.mode, fs.topic ? speakData().topics.indexOf(fs.topic) : -1);
  }
  $("#fsRes").addEventListener("click", e => { const b = e.target.closest("[data-entry]"); if (b) openEntry(b.dataset.entry); });
  const ringSvgP = pct => `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="4" opacity=".12"/><circle cx="18" cy="18" r="15" fill="none" stroke="#30D158" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="${Math.min(100, pct)} 100" transform="rotate(-90 18 18)" ${pct ? "" : 'opacity="0"'}/></svg>`;

  /* ---------- Dialog as a chat: partner lines play, your line waits for the mic ---------- */
  function bubble(it, k) {
    const l = lines[it.line], cur = k === dlg.i;
    if (!it.mine) return `<div class="rb them"><div class="rb-who">${esc(l.who)}</div><div class="rb-de">${esc(l.text)}</div>${dlg.opts?.help === false ? "" : `<div class="rb-fa fa">${esc(l.fa || "")}</div>`}</div>`;
    let body;
    if (cur && rec.on && !it.blanks.length) body = wordsHtml(l.text, matchWords(l.text, [recText()]), "w-pend");
    else if (it.score && (it.score.ok || it.reveal || !cur)) body = it.score.html;
    else body = lineHtml(it);
    return `<div class="rb mine ${cur ? "now" : "done"}${it.score && !cur ? (it.score.ok ? " ok" : " bad") : ""}"><div class="rb-de" id="${cur ? "rbNow" : ""}">${body}</div>${cur && dlg.opts?.help && l.fa ? `<div class="rb-fa fa">${esc(l.fa)}</div>` : ""}${!cur && it.score ? `<div class="rb-pc">${it.score.self ? "✓" : Math.round(it.score.pct * 100) + "%"}</div>` : ""}</div>`;
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
      <button class="rp-mic" id="rpMic" ${mode === "wait" ? "disabled" : ""} aria-label="${t("mic")}">${MIC_SVG}</button></div>`;
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
    const verdict = !alts.length ? t("rpNothing") : sc.ok ? (pc >= 90 ? t("veryGood") : t("good")) : t("rpAgain");
    $("#dlgSheet").innerHTML = `<div class="sh-grab"></div>
      <div class="sh-score"><span class="sh-pc ${sc.ok ? "ok" : "bad"}">${alts.length ? pc + "%" : "—"}</span>
        <div><b class="${sc.ok ? "" : "fa"}">${verdict}</b><div class="sh-legend"><span class="g">${t("recognized")}</span><span class="r">${t("notHeardL")}</span></div></div></div>
      <div class="sh-line">${it.blanks.length && !it.reveal ? lineHtml(it) : sc.html}</div>
      ${alts.length && (!it.blanks.length || it.reveal) ? `<div class="sh-heard">🎧 <span>${t("heard")} „${esc(alts[0])}“</span>${miss.length ? ` <span class="fa">· ${esc(miss.slice(0, 3).join("، "))} ${t("rpNotHeard")}</span>` : ""}</div>` : ""}
      <div class="fa sh-fa">${esc(l.fa || "")}</div>
      <div class="sh-acts"><button class="sh-b sec" id="shAgain">↺ ${t("again")}</button><button class="sh-b sec sq" id="shPlay" aria-label="${t("listenAria")}">🔊</button><button class="sh-b ${sc.ok ? "pri" : "sec"}" id="shNext">${t("nextBtn")}</button></div>`;
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
    const st = store.get(bestKey("dlg"), {}); st[dlg.mode] = Math.max(st[dlg.mode] || 0, avg); store.set(bestKey("dlg"), st);
    dlg.i = dlg.items.length - 1; renderDlg(); dlg.i = dlg.items.length;
    $("#dlgFoot").innerHTML = `<div class="dlg-sum"><b>${avg}%</b> <span class="fa">${t("saidCorrectly")}</span></div>
      <button class="btn big" id="dlgAgain">↻ ${t("newLines")}</button>`;
    $("#dlgAgain").onclick = () => startDialog(dlg.mode, dlg.opts);
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
    const title = t("examTitle");
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
    showPanel("pEnd", t("examTitle"));
    $("#pEnd").innerHTML = `<div class="exam-end">
      <div class="exam-score">${exam.right} / ${n}</div>
      <div class="exam-pct ${pct >= 70 ? "ok" : "bad"}">${pct}%</div>
      <p class="fa">${pct >= 90 ? t("examGreat") : pct >= 70 ? t("examGood") : t("examRetry")}</p>
      <p class="fa muted">${t("bestResult")} ${best}%</p>
      <button class="btn big" id="examAgain">↻ ${t("newExam")}</button></div>`;
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
  function dictKey(w) {
    if (!w) return undefined;
    const hit = x => dictIdx[x] || dictIdx[x.toLowerCase()];
    if (hit(w)) return hit(w);
    // inflected adjectives, articles and nouns: tolles → toll, Freunden → Freund, keinen → kein
    for (const end of ["en", "em", "er", "es", "e", "n", "s"]) if (w.length > end.length + 2 && w.endsWith(end) && hit(w.slice(0, -end.length))) return hit(w.slice(0, -end.length));
    return undefined;
  }
  function lookup(w) {
    if (NAMES[w]) return { lemma: w, p: "اسم خاص", fa: NAMES[w], g: "" };
    const k = dictIdx[w] || dictIdx[w.toLowerCase()];
    if (k) return { lemma: k.replace(/_.*/, ""), ...DICT[k] };
    if (/^[a-z'-]+$/i.test(w) && !/[äöüß]/i.test(w)) return { lemma: w, p: "انگلیسی", fa: t("englishWord"), g: "" };
    return { lemma: w, p: "", fa: t("noMeaning"), g: "" };
  }
  // dialog: tapping a word opens a side panel (bottom panel on phones); the lyrics stay usable
  function openWord(w) {
    const k = dictKey(w), side = $("#wsBody");
    markSeen(k);
    $$("#mTranscript .w.picked").forEach(x => x.classList.remove("picked"));
    $$(`#mTranscript .ly-line.cur .w`).forEach(x => { if (x.dataset.w === w) x.classList.add("picked"); });
    if (k && DICT[k]) openEntry(k, side);
    else {
      const d = lookup(w);
      side.innerHTML = `<div class="vs-grab"></div><div class="vs-scroll"><div class="vs-top"><span class="vs-big">${esc(w)}</span>
        <button class="spk big" data-say="${esc(w)}" aria-label="${t("listenAria")}">${SAY_ICON}</button><button class="vs-x" id="vsClose" aria-label="${t("close")}">✕</button></div>
        ${d.p ? `<div class="vs-tags"><span class="pos P fa">${esc(I18N.pos(d.p))}</span></div>` : ""}<div class="vs-mean fa">${esc(d.fa)}</div></div>`;
      side.querySelector("#vsClose").onclick = closeSide;
    }
    $("#audio").classList.add("side-open");
    side.scrollTop = 0;
    const row = $("#mTranscript .ly-line.cur"), box = $("#mTranscript");
    if (row) setTimeout(() => box.scrollTo({ top: row.offsetTop - 20, behavior: "smooth" }), 320);
  }
  function closeSide() {
    $("#audio").classList.remove("side-open");
    $$("#mTranscript .w.picked").forEach(x => x.classList.remove("picked"));
  }
  const closeWord = () => { $("#popBack").hidden = true; };
  $("#popClose").onclick = closeWord;
  $("#popBack").addEventListener("click", e => { if (e.target.id === "popBack") closeWord(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeWord(); closeSide(); } });
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
    if (document.body.dataset.screen === "profile") renderProfile();
    if (document.body.dataset.screen === "library") renderLibrary();
    tick(); renderStories(); nightSleepLabel();
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

  /* ---------- Four skills (speaking, listening, reading, writing) ---------- */
  const SKILLS = [
    { id: "speak", ic: "🗣️", de: "Sprechen", fa: "skSpeak", color: "#FF2D55", types: ["speak"] },
    { id: "listen", ic: "🎧", de: "Hören", fa: "skListen", color: "#5E5CE6", types: ["listen", "respond"] },
    { id: "read", ic: "📖", de: "Lesen", fa: "skRead", color: "#30B0C7", types: ["fill", "order"] },
    { id: "write", ic: "✍️", de: "Schreiben", fa: "skWrite", color: "#FF9F0A", types: ["translate"] }
  ];
  function skillPct(id) {
    const sk = SKILLS.find(k => k.id === id), res = exResults();
    const list = ex.list.filter(e => sk.types.includes(e.type)), ok = list.filter(e => res[e.id] === true).length;
    let p = list.length ? ok / list.length * 100 : 0;
    if (id === "speak") { const dl = store.get(bestKey("dlg"), {}), fb = store.get(bestKey("fs"), {}); p = Math.max(p, ...Object.values(dl), fb.cue || 0, fb.topic || 0); }
    return Math.min(100, Math.round(p));
  }

  /* ---------- Profile ---------- */
  const initial = n => (n || "").trim().charAt(0).toUpperCase() || "🙂";
  const paintAvatar = () => {
    $$(".js-avatar").forEach(e => e.textContent = initial(store.get("name", "")));
  };
  function renderProfile() {
    const L = LESSONS[state.idx];
    const known = vocabList.filter(v => state.known.has(v.key)).length;
    const res = exResults(), okEx = Object.values(res).filter(Boolean).length;
    const fcs = Object.values(store.get("fc", {})), fr = fcs.reduce((a, x) => a + x[0], 0), fw = fcs.reduce((a, x) => a + x[1], 0);
    const exam = store.get("exam" + L.id, 0), dl = store.get(bestKey("dlg"), {}), bestDlg = Math.max(0, ...Object.values(dl));
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
    // page header: streak, words, listening time; progress per skill (current lesson)
    const all = daily(), mins = Math.round(Object.values(all).reduce((a, d) => a + (d.l || 0), 0) / 60), since = Object.keys(all).sort()[0];
    $("#pfSub").textContent = `${I18N.name(I18N.lang)}${since ? " · " + since : ""} · ${L.level}`;
    $("#pfStats").innerHTML = `<div><b>🔥 ${streak()}</b><small>${t("days")}</small></div><div><b>${state.known.size}</b><small>${t("wordsCap")}</small></div><div><b>${mins >= 60 ? tf("hoursN", { n: Math.round(mins / 60 * 10) / 10 }) : tf("minN", { n: mins })}</b><small>${t("heardL")}</small></div>`;
    $("#pfLsName").textContent = `${lsCode(state.idx)} · ${L.title}`;
    $("#pfSkills").innerHTML = SKILLS.map(k => { const p = skillPct(k.id); return `<div class="pf-row"><span>${k.ic} ${t(k.fa)}</span><span class="pf-bar"><i style="width:${p}%"></i></span><b>${p}%</b></div>`; }).join("");
    paintAvatar();
  }
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

  /* ---------- Lesson page: hero, learning path, key phrases, grammar focus ---------- */
  const lsKey = (k, i = state.idx) => k + (LESSONS[i] || {}).id;
  function lessonSteps(i = state.idx) {
    const L = LESSONS[i], cur = i === state.idx;
    const nLines = cur ? lines.length : L.transcript.split("\n").filter(x => x.trim()).length;
    const keys = cur ? vocabList.map(v => v.key) : (L.words || []);
    const heard = store.get(lsKey("heard", i), []).length, nPh = L.phrases.length, phr = store.get(lsKey("phr", i), []).length;
    const kn = keys.filter(k => state.known.has(k)).length, dl = store.get(bestKey("dlg", i), {}), fsb = store.get(bestKey("fs", i), {}), exb = store.get(lsKey("exam", i), null);
    const best = (v, goal = 70) => Math.min(1, (v || 0) / goal);
    if (isStory(L)) return [
      { ic: "🎧", de: t("listenStory"), sub: tf("lsStepDialog", { a: heard, b: nLines }), f: Math.min(1, heard / (nLines * 0.8 || 1)), go: () => { go("audio"); player.play().catch(() => {}); } },
      { ic: "🔤", de: t("newWords"), sub: tf("lsStepWords", { a: kn, b: keys.length }), f: Math.min(1, kn / (keys.length * 0.5 || 1)), go: () => go("vocab") },
      { ic: "❓", de: t("storyQs"), sub: tf("lsStepBest", { b: fsb.cue != null ? fsb.cue + "%" : "—" }), f: best(fsb.cue), go: () => { practiceOpen("cue"); } },
      { ic: "🗣️", de: t("retell"), sub: tf("lsStepBest", { b: fsb.topic != null ? fsb.topic + "%" : "—" }), f: best(fsb.topic), go: () => { practiceOpen("topic"); } },
      { ic: "🏁", de: t("examTitle"), sub: tf("lsStepBest", { b: exb != null ? exb + "%" : "—" }), f: best(exb), go: () => { practiceOpen("exam"); } }
    ];
    return [
      { ic: "🎧", de: t("listenDialog"), sub: tf("lsStepDialog", { a: heard, b: nLines }), f: Math.min(1, heard / (nLines * 0.8 || 1)), go: () => go("audio") },
      { ic: "📖", de: t("keyPhrases"), sub: tf("lsStepPhr", { a: phr, b: nPh }), f: Math.min(1, phr / (nPh * 0.8 || 1)), go: () => $("#phrases").scrollIntoView({ behavior: "smooth", block: "center" }) },
      { ic: "🔤", de: t("learnWords"), sub: tf("lsStepWords", { a: kn, b: keys.length }), f: Math.min(1, kn / (keys.length * 0.5 || 1)), go: () => go("vocab") },
      { ic: "💬", de: t("dlgSpeak"), sub: tf("lsStepBest", { b: dl.role != null ? dl.role + "%" : "—" }), f: best(Math.max(dl.role || 0, dl.gap || 0, dl.read || 0)), go: () => { practiceOpen("skill:speak"); } },
      { ic: "🗣️", de: t("freeTalk"), sub: tf("lsStepBest", { b: fsb.cue != null ? fsb.cue + "%" : fsb.topic != null ? fsb.topic + "%" : "—" }), f: best(Math.max(fsb.cue || 0, fsb.topic || 0)), go: () => { practiceOpen("skill:speak"); } },
      { ic: "🏁", de: t("examTitle"), sub: tf("lsStepBest", { b: exb != null ? exb + "%" : "—" }), f: best(exb), go: () => { practiceOpen("exam"); } }
    ];
  }
  const lessonPct = (i = state.idx) => { if (store.get("done", []).includes(LESSONS[i].id)) return 100; const st = lessonSteps(i); return Math.round(st.reduce((a, x) => a + x.f, 0) / st.length * 100); };
  const overallPct = () => Math.round(LESSONS.reduce((a, x, i) => a + lessonPct(i), 0) / (LESSONS.length || 1));
  function renderLesson() {
    const L = LESSONS[state.idx]; if (!L) return;
    const TR = lessonTr(L), steps = lessonSteps(), pct = lessonPct();
    const cur = steps.findIndex(s => s.f < 1), mins = player.duration ? Math.round(player.duration / 60) : "–";
    $("#lsHero").innerHTML = `<div class="row"><span class="chip5">${lsName(state.idx)}</span><span class="chip5">${esc(L.level)}</span></div>
      <div class="tt">${esc(L.title)}</div><div class="fa">${esc(TR.title)} — ${esc(TR.summary)}</div>
      <div class="meta"><span>🎧 ${tf("minN", { n: mins })}</span><span>💬 ${tf("sentN", { n: lines.length })}</span><span>🔤 ${tf("nWords", { n: vocabList.length })}</span></div>
      <div class="pb"><i style="width:${pct}%"></i></div><div class="meta"><span class="fa">${tf("lsProgress", { p: pct })}</span></div>
      <div class="ls-overall"><span>${t("lsOverall")}</span><b>${overallPct()}%</b></div>
      <div class="ls-lessons">${LESSONS.map((x, j) => isStory(x) !== isStory(L) ? "" : `<button class="chip5 lchip ${j === state.idx ? "on" : ""}" data-lesson="${j - state.idx}"><span>${lsCode(j)}</span><i style="--p:${lessonPct(j)}%"></i><small>${lessonPct(j)}%</small></button>`).join("")}<button class="chip5 lchip" data-go="library">📚 ${t("library")}</button></div>`;
    $("#lsHero").classList.toggle("story", isStory(L));
    $("#lsPath").innerHTML = steps.map((s, i) => { const st = s.f >= 1 ? "done" : i === cur ? "cur" : "todo";
      return `<button class="step ${st}" data-step="${i}"><span class="ic">${st === "done" ? "✓" : s.ic}</span><span class="tx"><b>${i + 1}. ${s.de}</b><small class="fa">${esc(s.sub)}</small><span class="sbar"><i style="width:${Math.round(s.f * 100)}%"></i></span></span><span class="go">${st === "done" ? "✓" : st === "cur" ? t("nextBtn") : t("start")}</span></button>`; }).join("");
    $("#lsPathN").textContent = `${steps.filter(s => s.f >= 1).length} / ${steps.length}`;
    const done = new Set(store.get(lsKey("phr"), []));
    $$("#phrases .p").forEach(p => p.classList.toggle("done", done.has(Number(p.dataset.phr))));
    $("#lsPhrN").textContent = `${done.size} / ${L.phrases.length}`;
  }
  player.addEventListener("loadedmetadata", () => { if (document.body.dataset.screen === "lesson") renderLesson(); });
  $("#lsPath").addEventListener("click", e => { const b = e.target.closest("[data-step]"); if (b) lessonSteps()[b.dataset.step].go(); });
  $("#phrases").addEventListener("click", e => {
    const b = e.target.closest("[data-phr]"); if (!b) return;
    const k = lsKey("phr"), set = new Set(store.get(k, [])); set.add(Number(b.dataset.phr)); store.set(k, [...set]); renderLesson();
  });
  // lines of the dialog that were actually heard (lesson audio, not practice clips)
  let lastHeard = -1;
  player.addEventListener("timeupdate", () => {
    if (player.paused || clipStop != null || !timed) return;
    const i = lineAt(player.currentTime); if (i < 0 || i === lastHeard) return;
    lastHeard = i;
    const k = lsKey("heard"), arr = store.get(k, []); if (!arr.includes(i)) { arr.push(i); store.set(k, arr); }
  });

  /* ---------- Home: speak now, word of the day ---------- */
  $("#hSpeak").addEventListener("click", () => practiceOpen("skill:speak"));
  $("#wotdSay").addEventListener("click", e => { e.stopPropagation(); speak(e.currentTarget.dataset.word || ""); });

  /* ---------- Dock: the one player. While the lesson plays it fills the dock and the
     tabs fold into a round button; tapping that button brings the tabs back. ---------- */
  const setDock = collapsed => document.body.classList.toggle("dock-collapsed", collapsed);
  player.addEventListener("play", () => { if (clipStop == null) setDock(true); });
  $("#dockTabsBtn").addEventListener("click", () => setDock(false));

  /* ---------- iOS home-screen app: fill the whole screen ---------- */
  // only iOS Safari's home-screen app (navigator.standalone) has the short-viewport bug; desktop web apps size correctly
  // macOS Safari web apps also report navigator.standalone but have windows: only touch devices (iPhone/iPad) need this
  if (navigator.standalone === true && navigator.maxTouchPoints > 0) {
    const fit = () => {
      const long = Math.max(screen.width, screen.height), short = Math.min(screen.width, screen.height);
      const h = innerWidth > innerHeight ? short : long;
      document.documentElement.classList.add("standalone");
      document.documentElement.style.setProperty("--app-h", Math.max(h, innerHeight) + "px");
    };
    fit(); addEventListener("resize", fit); addEventListener("orientationchange", () => setTimeout(fit, 300));
  }

  /* ---------- Init ---------- */
  tick(); setInterval(tick, 10000);

  /* ---------- Mediathek: lessons and stories as separate, manageable lists ---------- */
  const lib = { tab: store.get("libTab", "lesson"), lvl: "all", sort: store.get("libSort", "order") };
  const LIB_SORT = { order: "sortOrder", level: "sortLevel", recent: "sortRecent" };
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const libMins = L => { const tm = L.timings; const e = Array.isArray(tm) && tm.length ? (Array.isArray(tm[tm.length - 1]) ? tm[tm.length - 1][1] : tm[tm.length - 1]) : 0; return e ? Math.max(1, Math.round(e / 60)) : null; };
  const libLines = L => L.transcript.split("\n").filter(x => x.trim()).length;
  function renderLibrary() {
    const all = LESSONS.map((L, i) => ({ L, i, story: isStory(L), p: lessonPct(i), done: store.get("done", []).includes(L.id) }));
    const nL = all.filter(x => !x.story).length, nS = all.length - nL;
    const inTab = all.filter(x => lib.tab === "all" || (lib.tab === "story") === x.story);
    const lvls = LEVELS.filter(l => inTab.some(x => x.L.level === l));
    if (lib.lvl !== "all" && !lvls.includes(lib.lvl)) lib.lvl = "all";
    const seen = store.get("libSeen", {});
    const items = inTab.filter(x => lib.lvl === "all" || x.L.level === lib.lvl).sort((a, b) =>
      lib.sort === "level" ? LEVELS.indexOf(a.L.level) - LEVELS.indexOf(b.L.level) || a.i - b.i
      : lib.sort === "recent" ? (seen[b.L.id] || 0) - (seen[a.L.id] || 0) || a.i - b.i
      : (a.story - b.story) || a.i - b.i);
    $("#libCount").textContent = tf("titlesN", { n: all.length });
    $("#libSeg").innerHTML = [["lesson", tf("lessonsN", { n: nL })], ["story", tf("storiesN", { n: nS })], ["all", t("all")]].map(([k, v]) => `<button data-tab="${k}" class="${lib.tab === k ? "on" : ""}">${v}</button>`).join("");
    $("#libChips").innerHTML = ["all", ...lvls].map(l => `<button data-lvl="${l}" class="${lib.lvl === l ? "on" : ""}">${l === "all" ? t("all") : l}</button>`).join("") + `<button class="srt" data-sort>↕ ${t(LIB_SORT[lib.sort])}</button>`;
    const row = x => { const TR = lessonTr(x.L), m = libMins(x.L), cur = x.i === state.idx;
      const st = x.p >= 100 ? `<span class="st ok">✓</span>` : x.p > 0 ? `<span class="st">${x.p}%</span>` : `<span class="st new">${t("stNew")}</span>`;
      return `<div class="lib-it ${cur ? "cur" : ""}" data-li="${x.i}" role="button" tabindex="0">
        <div class="cv cv${x.i % 4} ${x.story ? "book" : ""}">${x.story ? "📖" : ""}<b>${lsCode(x.i)}</b></div>
        <div class="tx"><b>${esc(x.L.title)}</b><span class="fa">${esc(TR.title)}</span>
          <span class="mt"><span class="lv">${esc(x.L.level)}</span>${m ? `<span>${tf("minN", { n: m })}</span>` : ""}<span>${tf("sentN", { n: libLines(x.L) })}</span>${x.L.words ? `<span>${tf("nWords", { n: x.L.words.length })}</span>` : ""}</span>
          <span class="pb"><i style="width:${x.p}%"></i></span></div>
        ${st}<button class="more" data-more="${x.i}" aria-label="${t("more")}">⋯</button></div>`; };
    const groups = lib.sort !== "order" ? [["", items]] : [
      [t("inProgress"), items.filter(x => x.p > 0 && x.p < 100)],
      [t("notStarted"), items.filter(x => x.p === 0)],
      [t("finished"), items.filter(x => x.p >= 100)]];
    $("#libList").innerHTML = groups.filter(g => g[1].length).map(([h, xs]) => (h ? `<div class="lib-sec">${h}</div>` : "") + xs.map(row).join("")).join("")
      || `<div class="lib-empty">${t("nothingHere")}</div>`;
  }
  $("#libSeg").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (!b) return; lib.tab = b.dataset.tab; store.set("libTab", lib.tab); renderLibrary(); });
  $("#libChips").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.sort != null) { const ks = Object.keys(LIB_SORT); lib.sort = ks[(ks.indexOf(lib.sort) + 1) % ks.length]; store.set("libSort", lib.sort); }
    else lib.lvl = b.dataset.lvl;
    renderLibrary();
  });
  // tap = open, long press / right click / ⋯ = manage
  let libPress = 0, libLong = false;
  function libMenu(i, anchor) {
    const L = LESSONS[i], done = store.get("done", []).includes(L.id), r = anchor.getBoundingClientRect(), box = $("#library").getBoundingClientRect();
    $("#libMenu").innerHTML = `<div class="lm-h"><b>${lsCode(i)} · ${esc(L.title)}</b></div>
      <button data-m="play">▶︎ ${lessonPct(i) > 0 ? t("resume") : t("listen")}</button>
      <button data-m="open">☰ ${t("overview")}</button>
      <button data-m="done">${done ? "○ " + t("markUndone") : "✓ " + t("markDone")}</button>
      <button data-m="restart">↺ ${t("restart")}</button>
      <button data-m="reset" class="red">${t("resetLs")}</button>`;
    $("#libMenu").dataset.i = i;
    const top = Math.min(r.bottom - box.top + 4, box.height - 300);
    $("#libMenu").style.top = Math.max(8, top) + "px";
    $("#libBack").hidden = false; $("#libMenu").hidden = false;
  }
  const libMenuClose = () => { $("#libBack").hidden = true; $("#libMenu").hidden = true; };
  $("#libBack").onclick = libMenuClose;
  function libReset(L) {
    const id = L.id;
    ["heard", "phr", "exam", "dlg", "fs", "ex"].forEach(k => { try { localStorage.removeItem("lapp:" + k + id); } catch {} });
    try { localStorage.removeItem("lapp:ex" + id + ":i"); } catch {}
    store.set("done", store.get("done", []).filter(x => x !== id));
  }
  $("#libMenu").addEventListener("click", e => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    const i = Number($("#libMenu").dataset.i), L = LESSONS[i], m = b.dataset.m; libMenuClose();
    if (m === "play" || m === "restart") { if (i !== state.idx) setLesson(i); if (m === "restart") { player.currentTime = 0; showNow(0); } go("audio"); player.play().catch(() => {}); }
    if (m === "open") { if (i !== state.idx) setLesson(i); go("lesson"); }
    if (m === "done") { const d = store.get("done", []); store.set("done", d.includes(L.id) ? d.filter(x => x !== L.id) : [...d, L.id]); renderLibrary(); renderProgress?.(); }
    if (m === "reset" && confirm(`${lsName(i)}: Fortschritt löschen?`)) { libReset(L); if (i === state.idx) setLesson(i); renderLibrary(); }
  });
  $("#libList").addEventListener("pointerdown", e => {
    const it = e.target.closest("[data-li]"); if (!it || e.target.closest("[data-more]")) return;
    libLong = false; clearTimeout(libPress);
    libPress = setTimeout(() => { libLong = true; navigator.vibrate?.(10); libMenu(Number(it.dataset.li), it); }, 500);
  });
  ["pointerup", "pointerleave", "pointercancel", "scroll"].forEach(ev => $("#libList").addEventListener(ev, () => clearTimeout(libPress), true));
  $("#libList").addEventListener("contextmenu", e => { const it = e.target.closest("[data-li]"); if (!it) return; e.preventDefault(); clearTimeout(libPress); libMenu(Number(it.dataset.li), it); });
  $("#libList").addEventListener("click", e => {
    const mo = e.target.closest("[data-more]"); if (mo) { e.stopPropagation(); libMenu(Number(mo.dataset.more), mo.closest("[data-li]")); return; }
    const it = e.target.closest("[data-li]"); if (!it || libLong) { libLong = false; return; }
    const i = Number(it.dataset.li); if (i !== state.idx) setLesson(i); go("lesson");
  });
  setSpeed(state.speed);
  if (LESSONS.length) setLesson(state.idx);
  const start = location.hash.slice(1);
  go(start && document.getElementById(start)?.classList.contains("screen") ? start : "home");
})();
