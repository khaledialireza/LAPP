// Loads the chosen course from content/ and then starts the app.
//   content/index.json                 interface languages, and the courses (de, nl, pl) with their lessons
//   content/lang/<course>/             the learned language: dict.json (word type, forms), verbs.json, names.json
//   content/lang/<code>/               one folder per interface language (see i18n.js);
//                                      dict.<course>.json = meanings of that course's words
//   content/lessons/<folder>/          one folder per lesson or story (folders are unique across courses):
//       lesson.json   the text, timings, words, phrases, speaking tasks
//       audio.mp3     the recording
//       <code>.json   translation into one interface language
// A new interface language = a new lang/<code>/ folder + <code>.json in each lesson + one line in index.json.
// A course is listed once it has a lesson; each course keeps its own progress (see COURSE.prefix).
(() => {
  const V = ((document.currentScript || {}).src || "").match(/[?&]v=([^&]+)/)?.[1] || "";
  const get = p => fetch("content/" + p + (V ? "?v=" + V : "")).then(r => r.ok ? r.json() : Promise.reject(new Error(p + " " + r.status)));
  const loaded = new Set(); // languages whose files are in memory
  const dicts = {}, names = {};

  async function boot() {
    const idx = await get("index.json");
    I18N.init(idx.languages);
    window.COURSES = idx.courses.map(c => ({ ...c, ready: c.lessons.length > 0 }));
    let want = null; try { want = JSON.parse(localStorage.getItem("lapp:course")); } catch {}
    const C = COURSES.find(c => c.code === want && c.ready) || COURSES.find(c => c.ready);
    // the first course keeps the original "lapp:" keys; the others get their own
    window.COURSE = { ...C, chosen: !!want, prefix: C.code === COURSES[0].code ? "lapp:" : `lapp:${C.code}:` };
    const [de, verbs, deNames, lessons] = await Promise.all([
      get(`lang/${C.code}/dict.json`), get(`lang/${C.code}/verbs.json`).catch(() => ({})), get(`lang/${C.code}/names.json`).catch(() => []),
      Promise.all(C.lessons.map(async dir => ({ dir, ...await get(`lessons/${dir}/lesson.json`) })))]);
    window.VERBS = verbs;
    window.DICT = {};
    for (const [k, v] of Object.entries(de)) DICT[k] = { p: v.p, f: v.f || [], fa: "", g: "" };
    window.NAMES = Object.fromEntries(deNames.map(n => [n, n]));
    // the shape the app works with: transcript as text, phrases as [de, translation, note]
    window.LESSONS = lessons.map(L => ({
      ...L,
      audio: `content/lessons/${L.dir}/${L.audio}`,
      transcript: L.transcript.join("\n"),
      phrases: L.phrases.map(de => [de, "", ""]),
      focus: (L.focus || []).map(de => ({ de, fa: "", points: [] })),
      speak: L.speak || { topics: [], cues: [] },
      tr: {}
    }));
    await loadLang(I18N.lang);
  }

  // everything one language needs; the texts go where the app reads them (.fa = interface language)
  async function loadLang(l) {
    if (!loaded.has(l)) {
      const [, dict, nm, trs] = await Promise.all([
        I18N.load(l, get), get(`lang/${l}/dict.${COURSE.code}.json`).catch(() => ({})), get(`lang/${l}/names.json`).catch(() => ({})),
        Promise.all(LESSONS.map(L => get(`lessons/${L.dir}/${l}.json`).catch(() => ({}))))]);
      dicts[l] = dict; names[l] = nm;
      LESSONS.forEach((L, i) => { L.tr[l] = trs[i]; });
      loaded.add(l);
    } else await I18N.load(l, get);
    localize(l);
  }
  function localize(l) {
    const dict = dicts[l] || {}, nm = names[l] || {};
    for (const [k, d] of Object.entries(DICT)) {
      const e = dict[k];
      d.fa = typeof e === "string" ? e : e ? e.m : "";
      d.g = e && typeof e === "object" ? e.g || "" : "";
    }
    for (const n of Object.keys(NAMES)) NAMES[n] = nm[n] || n;
    for (const L of LESSONS) {
      const tr = L.tr[l] || {};
      L.phrases.forEach((p, i) => { p[1] = (tr.phrases || [])[i] || ""; p[2] = (tr.phraseNotes || [])[i] || ""; });
      L.focus.forEach((f, i) => { const x = (tr.focus || [])[i] || {}; f.fa = x.title || ""; f.points = x.points || []; });
      L.speak.topics.forEach((tp, i) => { tp.fa = (tr.topics || [])[i] || ""; });
      L.speak.cues.forEach((c, i) => { const x = (tr.cues || [])[i] || {}; c.fa = x.title || ""; c.items.forEach((q, j) => { q.fa = (x.items || [])[j] || ""; }); });
    }
  }

  window.Content = { boot, loadLang };
  Promise.all([boot(), window.Account ? Account.ready : null]).then(() => {
    const s = document.createElement("script");
    s.src = "app.js" + (V ? "?v=" + V : "");
    s.onload = () => document.body.classList.add("ready");
    document.body.append(s);
  }).catch(e => {
    console.error(e);
    document.body.insertAdjacentHTML("beforeend", `<div class="load-err">⚠︎ ${e.message}</div>`);
  });
})();
