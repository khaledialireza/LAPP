// LAPP Studio · the script, more: formatting of words and lines, the lesson's own dictionary and target words,
// and "Paste a text": a ready text or story becomes scenes and speakers without changing a word.
// Data, kept in the lesson: line.fx {wordIndex: {b,i,u,c,h,f}} · line.style {b,i,u,c,h,f} · data.dict {word: {en,fa,ru,uk,note}} · data.targets [word]
(function () {
  "use strict";
  const { $, $$, esc: E } = K, I = (n, s = 15) => K.I(n, s);
  const st = document.createElement("style");
  st.textContent = `.fx-b{font-weight:800}.fx-i{font-style:italic}.fx-u{text-decoration:underline;text-underline-offset:3px}
.fx-f-serif{font-family:Georgia,"Times New Roman",serif}.fx-f-mono{font-family:ui-monospace,Menlo,monospace}.fx-f-round{font-family:"Comic Sans MS","Chalkboard SE",Inter,sans-serif}
.tw{border-bottom:2px dotted #FBBF24}.ldw{border-bottom:1px dashed var(--cy)}
.pastebox{width:100%;min-height:220px;background:var(--p3);border:1px solid var(--ln2);border-radius:10px;padding:10px;color:inherit;font:14px/1.6 Inter;resize:vertical}`;
  document.head.append(st);
  window.STUDIO_COLORS = { pink: "#FF6B9A", violet: "#A78BFA", cyan: "#22D3EE", green: "#34D399", amber: "#FBBF24", red: "#F87171" };
  const C = window.STUDIO_COLORS;
  const styleOf = s => { if (!s) return ["", ""]; const cls = [s.b && "fx-b", s.i && "fx-i", s.u && "fx-u", s.f && "fx-f-" + s.f].filter(Boolean).join(" "); const css = [s.c && `color:${C[s.c] || s.c}`, s.h && `background:${(C[s.h] || s.h)}33;border-radius:3px`].filter(Boolean).join(";"); return [cls, css]; };

  /* ---------- the line, drawn with its formatting, new/hard words and target words ---------- */
  const oldHiDe = window.hiDe;
  window.hiDe = hiDe = function (text, i) {
    const r = rows()[i] || {}, fx = r.fx || {}, d = S.L.data, targets = new Set((d.targets || []).map(x => x.toLowerCase())), dict = d.dict || {};
    const forms = S.dicts[S.L.course], hard = new Set(((d.check && d.check.lines || []).find(x => x.i === i) || {}).hard || []);
    let k = -1;
    const inner = E(text).replace(/[\p{L}\p{M}'’-]+/gu, w => {
      k++; const [cls, css] = styleOf(fx[k]), lw = w.toLowerCase();
      const kind = hard.has(w) ? `hw" title="above ${E(S.L.level)}` : !known(w, forms) && !dict[lw] ? `nw" title="new word for LAPP` : dict[lw] ? `ldw" title="in the lesson dictionary` : "";
      const tw = targets.has(lw) ? " tw" : "";
      return kind || cls || css || tw ? `<span class="${kind}${tw} ${cls}" data-k="${k}"${css ? ` style="${css}"` : ""}>${w}</span>` : w;
    });
    const [lc, lcss] = styleOf(r.style);
    return lc || lcss ? `<span class="${lc}" style="${lcss}">${inner}</span>` : inner;
  };
  // the index of a word in its line (the same counting as above)
  window.wordIndexAt = (text, word, x, y) => {
    const el = document.elementFromPoint(x, y), sp = el && el.closest("[data-k]"); if (sp) return Number(sp.dataset.k);
    const ws = String(text).match(/[\p{L}\p{M}'’-]+/gu) || []; return ws.findIndex(w => w === word);
  };
  window.applyFx = (i, k, patch) => {
    const r = rows()[i]; if (!r) return;
    if (k == null || k < 0) { r.style = clean({ ...(r.style || {}), ...patch }); if (!Object.keys(r.style).length) delete r.style; }
    else { r.fx = r.fx || {}; r.fx[k] = clean({ ...(r.fx[k] || {}), ...patch }); if (!Object.keys(r.fx[k]).length) delete r.fx[k]; if (!Object.keys(r.fx).length) delete r.fx; }
    changed(); renderDoc(); selLine(i);
  };
  window.clearFx = (i, k) => { const r = rows()[i]; if (!r) return; if (k == null || k < 0) { delete r.style; delete r.fx; } else if (r.fx) { delete r.fx[k]; } changed(); renderDoc(); selLine(i); };
  const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v));

  /* ---------- the lesson's own dictionary and target words ---------- */
  window.lessonDict = () => (S.L.data.dict = S.L.data.dict || {});
  window.saveWordMeaning = (word, meaning, lang) => { const d = lessonDict(), lw = word.toLowerCase(); d[lw] = { ...(d[lw] || {}), [lang]: meaning.slice(0, 200) }; changed(); renderDoc(); toast(`“${word}” is in the lesson dictionary`); };
  window.toggleTarget = word => { const lw = word.toLowerCase(), t = S.L.data.targets = S.L.data.targets || []; const i = t.indexOf(lw); i < 0 ? t.push(lw) : t.splice(i, 1); changed(); renderDoc(); toast(i < 0 ? `“${word}” is a target word` : `“${word}” is no longer a target word`); };
  window.askMeaning = (word, have) => new Promise(res => {
    const lang = TRL.includes(S.tr) ? S.tr : "en";
    form(`“${word}” · meaning`, `<label>Meaning in ${lang.toUpperCase()}</label><input class="in" name="m" value="${E(have || "")}" maxlength="200" dir="${lang === "fa" ? "rtl" : "ltr"}" autofocus>`, async f => { if (f.m && f.m.trim()) saveWordMeaning(word, f.m.trim(), lang); res(); }, "Save");
  });

  /* ---------- paste a ready text or story ---------- */
  function simpleSplit(text) {
    const scenes = []; let cur = null; const cast = new Set();
    const start = t => { cur = { title: { de: t || `Szene ${scenes.length + 1}`, en: "", fa: "", ru: "", uk: "" }, lines: [] }; scenes.push(cur); };
    for (let raw of text.split(/\n/)) {
      const t = raw.trim(); if (!t) { if (cur && cur.lines.length) cur.sep = true; continue; }
      const head = t.match(/^(#+\s*|(?:szene|scene|scène|scena|kapitel|chapter)\b[\s\d.:–-]*)(.*)$/i);
      if (head) { start(head[2].trim() || t.replace(/^#+\s*/, "")); continue; }
      if (!cur || (cur.sep && cur.lines.length > 6)) start(); cur.sep = false;
      const m = t.match(/^([\p{Lu}][\p{L}.' -]{0,24}):\s+(.+)$/u);
      const who = m ? m[1].trim() : "Narrator", de = (m ? m[2] : t).trim();
      cast.add(who); (de.match(/[^.!?…]+[.!?…]+["“”»«]?|[^.!?…]+$/g) || [de]).map(x => x.trim()).filter(Boolean).forEach(x => cur.lines.push({ who, de: x, en: "", fa: "", ru: "", uk: "", ok: false }));
    }
    return { scenes: scenes.filter(s => s.lines.length).map(s => ({ title: s.title, lines: s.lines })), cast: [...cast].map(n => ({ name: n, gender: /^(anna|lena|maria|sara|frau|mutter|oma|sophie|lisa|julia|emma|mia)/i.test(n) ? "f" : /narrator|erzähler/i.test(n) ? "f" : "m" })) };
  }
  function place(res, how) {
    const d = S.L.data, replace = how === "replace";
    if (replace) d.scenes = [];
    d.scenes.push(...res.scenes);
    for (const c of res.cast) if (!d.cast[c.name]) d.cast[c.name] = defaultVoice(c.gender || "f");
    for (const s of res.scenes) for (const l of s.lines) if (!d.cast[l.who]) d.cast[l.who] = defaultVoice("f");
    changed(); renderDoc();
    toast(`${res.scenes.reduce((a, s) => a + s.lines.length, 0)} lines in ${res.scenes.length} scenes · ${Object.keys(d.cast).length} speakers`);
  }
  ACT.paste = () => {
    const has = S.L.data.scenes.length;
    form("Paste a text or story", `<div class="mu sm">Your words stay exactly as they are. Lines like <b>Anna: …</b> become Anna's; anything else is the narrator's. ${S.scope.ai ? "Or let the AI find who says what." : ""}</div>
      <textarea class="pastebox de" name="text" placeholder="Anna: Guten Morgen! …" required></textarea>
      ${has ? `<label>The script already has lines</label><l-select name="how" id="pHow"></l-select>` : ""}
      <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" name="ai" ${S.scope.ai ? "checked" : "disabled"}> ✦ Let the AI find speakers and scenes (it never changes your words)</label>`,
      async f => {
        const text = (f.text || "").trim(); if (!text) return;
        let res = null;
        if (f.ai && S.scope.ai) { await flush(); try { res = await api("POST", `/lessons/${S.L.id}/import`, { text }); } catch (e) { toast(e.message + " — split it simply instead"); } }
        if (!res) res = simpleSplit(text);
        if (!res.scenes.length) return toast("No lines found");
        place(res, f.how || "add");
      }, "Make the script");
    if ($("#pHow")) opts($("#pHow"), [{ value: "add", label: "Add after them" }, { value: "replace", label: "Replace them" }], "add");
  };
  // the studio's menus: Edit gets "Paste a text…"
  const prev = window.LAPPFrame && LAPPFrame.menus;
  if (window.LAPPFrame) LAPPFrame.menus = () => {
    const base = prev ? prev() : [], v = (location.hash.slice(1) || "home").split("/")[0];
    if (v !== "script" || !S.L) return base;
    return [...base.slice(0, 1), { label: "Edit", items: [{ label: "Paste a text or story…", icon: "📋", run: () => ACT.paste() }, { label: "Approve all", icon: "✓", run: () => ACT.approveAll() }, { label: "Listen", icon: "▶", run: () => ACT.listen() }, "-", { label: "Lesson settings", icon: "⚙", run: () => { location.hash = "lesson/" + S.L.id; } }] }, ...base.slice(1)];
  };
})();
