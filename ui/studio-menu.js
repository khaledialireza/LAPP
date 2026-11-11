// LAPP Studio · the right-click menu of a line and the word card.
// Short, grouped, with sub-menus, a search and "ask the assistant" — it is the shared menu (K.menu, ui/menu.js) with a word card on top.
// Loaded after the studio's script; it uses the studio's own helpers (S, rows, say, rewrite, insertLine…).
(function () {
  "use strict";
  const { $, $$, esc: E } = K, I = (n, s = 15) => K.I(n, s);
  const st = document.createElement("style");
  st.textContent = `.k-menu.line{width:300px}.wcard{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08)}.wcard .w{font-size:17px;font-weight:800}.wcard .p{font-size:11.5px;color:rgba(235,235,245,.45)}.wcard .m{margin-top:4px}.wcard .g{margin-top:4px;font-size:12px;color:rgba(235,235,245,.6)}
.wtools{display:flex;align-items:center;gap:2px;margin-top:8px;flex-wrap:wrap}.wtools button{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:none;border:0;color:rgba(235,235,245,.7);cursor:pointer;font-size:14px}.wtools button:hover,.wtools button.on{background:rgba(139,92,246,.25);color:#F4F4F8}.wtools .sep{width:1px;height:16px;background:rgba(255,255,255,.12);margin:0 3px}
.wacts2{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.wacts2 button{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:none;color:#F4F4F8;font:600 12px Inter;cursor:pointer}.wacts2 button:hover,.wacts2 button.on{border-color:#8B5CF6;background:rgba(139,92,246,.18)}
.wcard .tag{display:inline-block;margin-top:6px;font-size:11px;padding:1px 8px;border-radius:99px;border:1px solid rgba(255,255,255,.14)}.wcard .tag.nw{color:#22D3EE}.wcard .tag.hw{color:#FBBF24}`;
  document.head.append(st);

  /* ---------- the dictionary, for the word card: the shared one (K.dict, K.meanings) ---------- */
  const dictFor = async (course, lang) => { const [d, mean] = await Promise.all([K.dict(course), K.meanings(course, lang)]); return { base: d.base, forms: d.forms, mean }; };
  function wordAt(x, y) {
    const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null; if (!r || r.startContainer.nodeType !== 3) return "";
    const t = r.startContainer.textContent, i = r.startOffset; let a = i, b = i;
    while (a > 0 && /[\p{L}\p{M}'’-]/u.test(t[a - 1])) a--; while (b < t.length && /[\p{L}\p{M}'’-]/u.test(t[b])) b++;
    return t.slice(a, b).replace(/^['’-]+|['’-]+$/g, "");
  }
  async function card(word, i) {
    if (!word) return "";
    const lang = ["en", "fa", "ru", "uk"].includes(S.tr) ? S.tr : "en";
    const d = await dictFor(S.L.course, lang), key = d.forms.get(word.toLowerCase()), b = key ? d.base[key] : null, m = key ? d.mean[key] : null;
    const own = (S.L.data.dict || {})[word.toLowerCase()], ownMean = own && (own[lang] || own.en) || "";
    const mean = ownMean || (typeof m === "string" ? m : m && m.m || ""), gram = m && typeof m === "object" ? m.g || "" : "";
    const target = (S.L.data.targets || []).includes(word.toLowerCase()), fx = ((rows()[i] || {}).fx || {})[CUR.k] || {};
    const tools = `<div class="wtools">${[["b", "bold", "B"], ["i", "italic", "I"], ["u", "format", "U"]].map(([f, ic, t]) => `<button data-fx="${f}" class="${fx[f] ? "on" : ""}" title="${t}">${I(ic, 14)}</button>`).join("")}<span class="sep"></span>${Object.entries(window.STUDIO_COLORS || {}).map(([n, c]) => `<button data-fxc="${n}" title="Colour" style="color:${c}" class="${fx.c === n ? "on" : ""}">●</button>`).join("")}<span class="sep"></span><button data-fxh="amber" title="Highlight" class="${fx.h ? "on" : ""}">${I("highlight", 14)}</button><button data-fxf title="Font">${I("format", 14)}</button><button data-fxx title="Clear format">${I("x", 13)}</button></div>`;
    const acts = `<div class="wacts2">${own ? `<button data-wd="correct">${I("edit", 13)} Correct</button>` : `<button data-wd="save">${I("dictionary", 13)} Save to the lesson dictionary</button>`}<button data-wd="target" class="${target ? "on" : ""}">${I("star", 13)} ${target ? "Target word ✓" : "Target word"}</button></div>`;
    const hard = (((S.L.data.check && S.L.data.check.lines) || []).find(x => x.i === i) || {}).hard || [];
    return `<div class="wcard"><div class="w">${E(word)}</div><div class="p">${own ? "Lesson dictionary" : key ? `LAPP dictionary · ${E(key.split("_")[0])}${b && b.p ? " · " + E(b.p) : ""}` : "not in the LAPP dictionary yet"}</div>${mean ? `<div class="m" dir="auto">${E(mean)}</div>` : ""}${gram ? `<div class="g" dir="auto">${E(gram)}</div>` : ""}${!key && !own ? `<span class="tag nw">new word for LAPP</span>` : ""}${hard.includes(word) ? ` <span class="tag hw">above ${E(S.L.level)}</span>` : ""}${tools}${acts}</div>`;
  }

  /* ---------- the line menu ---------- */
  const close = () => K.closeMenu();
  function items(i, word) {
    const r = rows()[i], ai = S.scope && S.scope.ai, cast = Object.keys(S.L.data.cast || {}), scenes = S.L.data.scenes;
    const it = (label, icon, run, o = {}) => ({ label, icon, run, ...o });
    const L = [];
    if (word) L.push(["Word", "book", [it("Word card", "book", () => wordCard(word, i)), it(`Listen to “${word}”`, "listen", () => say(word, S.L.course, .8)), it("Make it a key phrase", "star", () => { (S.L.data.phrases = S.L.data.phrases || []).push({ de: word, en: "", fa: "", ru: "", uk: "" }); changed(); renderSide(); toast("Added to the key phrases"); }), it("Ask the AI what it means here", "ai", () => askAi(`What does “${word}” mean in this line of my ${S.L.level} lesson, and is it right for that level? Line: “${r.de}”`))]]);
    L.push(["Edit", "edit", [it("Edit the text", "pen", () => { const el = $(`.txt .d[data-i="${i}"]`); el && el.focus(); }, { k: "↵" }), it(r.ok ? "Not approved" : "Approve", "approve", () => { r.ok = !r.ok; changed(); renderDoc(); selLine(i); }), it("Listen", "listen", () => say(r.de, S.L.course, r.speed || (S.L.data.cast[r.who] || {}).speed || 0.95)),
      it("Duplicate", "copy", () => { const [si, li] = locate(i); scenes[si].lines.splice(li + 1, 0, { ...r, ok: false }); changed(); renderDoc(); selLine(i + 1); }), it("Copy the text", "copy", () => K.copy(r.de))]]);
    if (ai) L.push(["AI", "ai", [it("Simpler (" + S.L.level + ")", "wand", () => rewrite(i, "simpler")), it("More natural", "wand", () => rewrite(i, "natural")), it("Shorter", "wand", () => rewrite(i, "shorter")), it("More polite", "wand", () => rewrite(i, "formal")), it("More casual", "wand", () => rewrite(i, "casual")), it("Add a question", "plus", () => rewrite(i, "question")),
      it("Accent · Austrian", "globe", () => custom(i, "the way people in Austria say it (Austrian German words and phrasing)")), it("Accent · Swiss", "globe", () => custom(i, "the way people in Switzerland say it in Swiss Standard German")), it("Check the level", "approve", () => ACT.check && ACT.check()), it("My own instruction…", "edit", () => rewrite(i, "custom"))]]);
    L.push(["Translate", "translate", [...(ai ? [it("Fill all missing translations", "translate", () => ACT.translate && ACT.translate())] : []), ...["en", "fa", "ru", "uk"].map(l => it("Show " + l.toUpperCase(), "language", () => { S.tr = l; V.script(); }, { on: S.tr === l }))]]);
    L.push(["Person", "person", [...cast.map(n => it(n, "user", () => { r.who = n; changed(); renderDoc(); selLine(i); }, { on: r.who === n })), it("Someone new…", "user-plus", () => pickSpeaker(i)), it("Open the characters", "cast", () => { location.hash = "universe"; })]]);
    const k = word ? CUR.k : -1, tgt = word ? `“${word}”` : "the line", cur = (word ? (r.fx || {})[k] : r.style) || {};
    const FEELS = [["", "neutral"], ["happy", "happy"], ["excited", "excited"], ["polite", "polite"], ["tired", "tired"], ["sad", "sad"], ["angry", "angry"], ["whisper", "whisper"]];
    const setV = (f, v, t) => { if (v === "" || v == null) delete r[f]; else r[f] = v; changed(); toast(`Line ${i + 1}: ${t}`); };
    L.push(["Voice", "wave", [...[0.8, 0.9, 1, 1.1].map(v => it(`Speed ${v}×`, "clock", () => setV("speed", v === 1 ? "" : v, `speed ${v}×`), { on: (r.speed || 1) === v })),
      ...FEELS.map(([f, l]) => it(`Feeling · ${l}`, "person", () => setV("feel", f, l), { on: (r.feel || "") === f })),
      ...[0.3, 0.6, 1, 1.5].map(v => it(`Pause after · ${v} s`, "pause", () => setV("pause", v === 0.6 ? "" : v, `pause ${v} s`), { on: (r.pause || 0.6) === v })),
      ...[-2, -1, 0, 1, 2].map(v => it(`Pitch · ${v > 0 ? "+" : ""}${v}`, "wave", () => setV("pitch", v || "", `pitch ${v > 0 ? "+" : ""}${v}`), { on: (r.pitch || 0) === v })),
      it("Listen with these settings", "listen", () => preview(r)), it("Open in the voice desk", "wave", () => { location.hash = "voice/" + S.L.id; })]]);
    L.push(["Format", "format", [it(`Bold · ${tgt}`, "bold", () => applyFx(i, k, { b: !cur.b }), { on: !!cur.b, k: "⌘B" }), it(`Italic · ${tgt}`, "italic", () => applyFx(i, k, { i: !cur.i }), { on: !!cur.i, k: "⌘I" }), it(`Underline · ${tgt}`, "format", () => applyFx(i, k, { u: !cur.u }), { on: !!cur.u }),
      ...Object.keys(window.STUDIO_COLORS || {}).map(n => it(`Colour · ${n}`, "palette", () => applyFx(i, k, { c: cur.c === n ? "" : n }), { on: cur.c === n })),
      ...["amber", "green", "cyan", "pink"].map(n => it(`Highlight · ${n}`, "highlight", () => applyFx(i, k, { h: cur.h === n ? "" : n }), { on: cur.h === n })),
      ...[["", "Inter"], ["serif", "Serif"], ["mono", "Mono"], ["round", "Round"]].map(([f, l]) => it(`Font · ${l}`, "format", () => applyFx(i, k, { f }), { on: (cur.f || "") === f })),
      it("Clear format", "x", () => clearFx(i, k))]]);
    L.push(["Structure", "structure", [it("New line above", "plus", () => insertLine(i - 1)), it("New line below", "plus", () => insertLine(i)), it("New scene from here", "scene", () => { const [si, li] = locate(i); if (li === 0) return toast("This line already starts a scene"); const rest = scenes[si].lines.splice(li); scenes.splice(si + 1, 0, { title: { de: `Szene ${si + 2}`, en: "", fa: "", ru: "", uk: "" }, lines: rest }); changed(); renderDoc(); }),
      ...(scenes.length > 1 ? scenes.map((s, si) => it(`Move to scene ${si + 1}`, "chevron", () => { const [from, li] = locate(i); if (from === si) return; const [x] = scenes[from].lines.splice(li, 1); scenes[si].lines.push(x); changed(); renderDoc(); }, { disabled: locate(i)[0] === si })) : [])]]);
    L.push(["Delete the line", "trash", null, { danger: true, run: () => delLine(i), k: "Del" }]);
    return L;
  }
  function custom(i, how) { rewrite(i, "custom", how); }
  const askAi = K.askAI;

  const CUR = { k: -1 }; let OPENS = 0;
  // the browser's voice with the line's feeling, pitch and speed, before the real audio is made
  function preview(r) {
    const FE = { happy: [1.1, 1.06], excited: [1.2, 1.1], sad: [.9, .9], tired: [.92, .86], angry: [1.03, 1.08], polite: [1.02, .96], whisper: [1, .92] }[r.feel] || [1, 1], c = S.L.data.cast[r.who] || {};
    K.speak(r.de, { lang: S.L.course, rate: (r.speed || c.speed || .95) * FE[1], pitch: (c.gender === "m" ? .8 : 1.15) * FE[0] * Math.pow(2, (r.pitch || 0) / 12), volume: r.feel === "whisper" ? .5 : null });
  }
  async function open(x, y, i, word, k) {
    close(); selLine(i); CUR.k = word ? (k ?? -1) : -1;
    const seq = ++OPENS;
    if (seq !== OPENS) return;
    close();
    const toItem = it => ({ label: it.label, icon: it.icon, run: it.run, on: it.on, disabled: it.disabled, key: it.k });
    const L = items(i, word).map(([label, icon, sub, o = {}]) => sub ? { label, icon, sub: sub.map(toItem) } : { label, icon, danger: o.danger, key: o.k, run: o.run });
    K.menu(x, y, L, {
      className: "line", title: `Line ${i + 1}${rows()[i].who ? " · " + rows()[i].who : ""}`,
      ask: S.scope && S.scope.ai ? { placeholder: "Search or ask…", run: v => custom(i, v) } : null
    });
  }
  // the word card, beside the word (a chosen word opens it; a right-click closes it)
  let CARDN = 0;
  async function wordCard(word, i, x, y, k) {
    if (x == null) { const el = document.querySelector(`.dl[data-i="${i}"] .txt .d`), r = el ? el.getBoundingClientRect() : { left: 100, bottom: 100 }; x = r.left; y = r.bottom + 6; }
    CUR.k = k ?? -1; const n = ++CARDN, html = await card(word, i);
    if (n !== CARDN) return;
    K.menu(x, y, [], { className: "line wcardm", header: html, noSystem: true,
      ready: m => m.addEventListener("click", e => {
        const t = e.target, k = CUR.k, fx = ((rows()[i] || {}).fx || {})[k] || {};
        const f = t.closest("[data-fx]"); if (f) { e.stopPropagation(); close(); return applyFx(i, k, { [f.dataset.fx]: !fx[f.dataset.fx] }); }
        const c = t.closest("[data-fxc]"); if (c) { e.stopPropagation(); close(); return applyFx(i, k, { c: fx.c === c.dataset.fxc ? "" : c.dataset.fxc }); }
        if (t.closest("[data-fxh]")) { e.stopPropagation(); close(); return applyFx(i, k, { h: fx.h ? "" : "amber" }); }
        if (t.closest("[data-fxf]")) { e.stopPropagation(); close(); const F = ["", "serif", "mono", "round"]; return applyFx(i, k, { f: F[(F.indexOf(fx.f || "") + 1) % F.length] }); }
        if (t.closest("[data-fxx]")) { e.stopPropagation(); close(); return clearFx(i, k); }
        const wd = t.closest("[data-wd]"); if (wd) { e.stopPropagation(); close(); if (wd.dataset.wd === "target") return toggleTarget(word); const own = (S.L.data.dict || {})[word.toLowerCase()]; return askMeaning(word, own && (own[S.tr] || own.en)); }
      })
    });
  }
  // choosing one word (double-click or drag) opens its card under it
  document.addEventListener("mouseup", e => {
    if (e.button || !S.L || !e.target.closest || !e.target.closest(".txt .d")) return;
    setTimeout(() => {
      const g = getSelection(), w = String(g).trim(); if (!w || /\s/.test(w) || !g.rangeCount) return;
      const dl = e.target.closest(".dl"); if (!dl) return;
      const i = Number(dl.dataset.i), r = g.getRangeAt(0).getBoundingClientRect();
      wordCard(w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""), i, r.left, r.bottom + 6, window.wordIndexAt ? wordIndexAt(rows()[i].de, w, r.left + 2, r.top + 2) : -1);
    }, 10);
  });
  document.addEventListener("contextmenu", e => {
    const tg = e.target, dl = tg.closest && tg.closest(".dl"); if (!dl || !S.L) return;
    if (e.shiftKey) return;   // Shift + right-click: the browser's own menu (spelling)
    e.preventDefault();
    const word = tg.closest(".txt .d") ? wordAt(e.clientX, e.clientY) : "", i = Number(dl.dataset.i);
    open(e.clientX, e.clientY, i, word, word && window.wordIndexAt ? wordIndexAt(rows()[i].de, word, e.clientX, e.clientY) : -1);
  });
  // the line's whole menu from elsewhere (the ribbon's "More")
  window.lineMenu = (x, y, i) => open(x, y, i, "");
  const relayout = () => { const v = (K.LS.get("lapp.theme", {}) || {}).trLang; if (v && v !== S.tr && !K.LS.get("lapp.studio.tr")) S.tr = v; if (S.L && $("#doc") && !document.querySelector(".txt [contenteditable]:focus")) renderDoc(); };
  K.onLook(relayout);
  // the keyboard: the menu for the chosen line
  document.addEventListener("keydown", e => {
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { if (S.L && S.sel >= 0) { const el = $(`.dl[data-i="${S.sel}"]`); if (el) { e.preventDefault(); const r = el.getBoundingClientRect(); open(r.left + 60, r.top + 30, S.sel, ""); } } }
  });
  // a hint the first time
  if (!K.LS.get("lapp.studio.ctxhint")) setTimeout(() => { if (S.L && $("#doc")) { toast("Tip: right-click a line or a word for every action"); K.LS.set("lapp.studio.ctxhint", 1); } }, 4000);
})();
