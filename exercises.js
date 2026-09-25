// تمرین‌ها: ۱۰۰ تمرین از کل متن هر درس، با هدف سریع‌تر حرف زدن.
// انواع: ترجمه، جای خالی، ترتیب کلمات، شنیدن، جواب دادن، گفتن (میکروفون).
(() => {
  const TOTAL = 100;
  const PLAN = [["translate", 20], ["fill", 20], ["order", 20], ["listen", 15], ["respond", 15], ["speak", 10]];
  const TYPE_LABEL = {
    translate: ["Übersetzen", "ترجمه کن"],
    fill: ["Lücke füllen", "جای خالی را بنویس"],
    order: ["Satz bauen", "جمله را بساز"],
    listen: ["Hören", "گوش کن و انتخاب کن"],
    respond: ["Antworten", "بهترین جواب چیست؟"],
    speak: ["Sprechen", "بلند بگو"]
  };
  // کلماتی که نشان می‌دهند جمله انگلیسی است (توضیح گوینده‌ها)
  const EN = new Set("the is are you what what's where means that it's it to a and or do my i nice meet first next last one word perfect easy like for from how old your favorite imagine we fly sounds but just yourself myself introduce oneself living job free time reflexive verb complicated female age twenty-five five twenty hobbies origin introductions turn".split(" "));
  const LETTERS = /[A-Za-zÄÖÜäöüß]/;

  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const words = s => s.split(/\s+/).map(w => w.replace(/^[^A-Za-zÄÖÜäöüß0-9]+|[^A-Za-zÄÖÜäöüß0-9'-]+$/g, "")).filter(Boolean);
  const isGerman = s => words(s).every(w => !EN.has(w.toLowerCase()));
  const cleanSentence = s => s.replace(/^[\s"„“(]+|[\s")“]+$/g, "").replace(/\s+/g, " ").trim();
  const norm = s => s.toLowerCase().replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü").replace(/ss/g, "ß").replace(/[^a-zäöüß0-9 ]/g, "").replace(/\s+/g, " ").trim();

  function build(L, lines, dictLookup) {
    const R = rng(L.id * 7919 + 17);
    const pick = a => a[Math.floor(R() * a.length)];
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    // sentence pool from the whole transcript
    const sents = [];
    lines.forEach((l, i) => {
      const parts = (l.text.match(/[^.!?]+[.!?]*/g) || []).map(cleanSentence).filter(s => LETTERS.test(s));
      parts.forEach(s => { if (isGerman(s)) sents.push({ s, line: i, single: parts.length === 1 }); });
    });
    const uniq = arr => { const seen = new Set(); return arr.filter(x => { const k = norm(x.s || x.text); if (seen.has(k)) return false; seen.add(k); return true; }); };
    const wc = s => words(s).length;

    const germanLines = lines.map((l, i) => ({ ...l, i })).filter(l => l.text && isGerman(l.text) && l.fa);
    const distract = (correct, pool, n = 3) => shuffle(pool.filter(x => norm(x) !== norm(correct))).slice(0, n);

    const gen = {
      translate() {
        const pool = uniq(germanLines.filter(l => wc(l.text) >= 3 && wc(l.text) <= 14));
        const texts = pool.map(l => l.text);
        return shuffle(pool).map(l => ({ type: "translate", line: l.i, prompt: l.fa, answer: l.text,
          options: shuffle([l.text, ...distract(l.text, texts.filter(t => Math.abs(wc(t) - wc(l.text)) <= 5))]) }));
      },
      fill() {
        const pool = uniq(sents.filter(x => wc(x.s) >= 4 && wc(x.s) <= 12));
        return shuffle(pool).map(x => {
          const cands = words(x.s).filter(w => w.length >= 3 && !/^(der|die|das|ein|eine|und|ich|du|wir|ihr|sie|es|mit|aus|in|zu)$/i.test(w) && dictLookup(w).p);
          if (!cands.length) return null;
          const w = pick(cands), d = dictLookup(w);
          const k = x.s.indexOf(w);
          if (k < 0) return null;
          return { type: "fill", line: x.line, before: x.s.slice(0, k), after: x.s.slice(k + w.length), answer: w,
            hint: x.single ? lines[x.line].fa : "", note: d.fa ? `${w}: ${d.fa}` : "" };
        }).filter(Boolean);
      },
      order() {
        const pool = uniq(sents.filter(x => wc(x.s) >= 4 && wc(x.s) <= 9));
        return shuffle(pool).map(x => {
          const toks = words(x.s);
          let sh = shuffle(toks); for (let t = 0; t < 5 && sh.join(" ") === toks.join(" "); t++) sh = shuffle(toks);
          return { type: "order", line: x.line, answer: x.s, tokens: sh, hint: x.single ? lines[x.line].fa : "" };
        });
      },
      listen() {
        const pool = uniq(lines.map((l, i) => ({ ...l, i })).filter(l => wc(l.text) >= 3 && wc(l.text) <= 16 && isGerman(l.text)));
        const texts = pool.map(l => l.text);
        return shuffle(pool).map(l => ({ type: "listen", line: l.i, answer: l.text,
          options: shuffle([l.text, ...distract(l.text, texts)]) }));
      },
      respond() {
        const qa = [];
        lines.forEach((l, i) => {
          const next = lines[i + 1];
          if (!next || next.who === l.who || !/\?\s*["“]?$/.test(l.text.trim())) return;
          const qs = (l.text.match(/[^.!?]+[.!?]*/g) || []).map(cleanSentence).filter(Boolean);
          let q = qs.pop();
          if (q && words(q).length <= 3 && qs.length) q = qs.pop() + " " + q;
          const a = (next.text.match(/[^.!?]+[.!?]*/g) || []).map(cleanSentence).filter(s => LETTERS.test(s)).slice(0, 2).join(" ");
          if (q && a && isGerman(q) && isGerman(a) && wc(a) <= 16) qa.push({ q, a, line: i, fa: next.fa });
        });
        const answers = qa.map(x => x.a);
        return shuffle(uniq(qa.map(x => ({ ...x, s: x.q })))).map(x => ({ type: "respond", line: x.line, prompt: x.q, answer: x.a,
          explain: x.fa, options: shuffle([x.a, ...distract(x.a, answers)]) }));
      },
      speak() {
        const pool = uniq(germanLines.filter(l => wc(l.text) >= 3 && wc(l.text) <= 9));
        return shuffle(pool).map(l => ({ type: "speak", line: l.i, prompt: l.fa, answer: l.text }));
      }
    };

    const out = [], used = new Set();
    const take = (type, n) => {
      for (const ex of gen[type]()) {
        if (n <= 0) break;
        const key = type + "|" + norm(ex.answer);
        if (used.has(key)) continue;
        used.add(key); out.push(ex); n--;
      }
      return n;
    };
    let rest = 0;
    PLAN.forEach(([t, n]) => { rest += take(t, n); });
    // if a type ran short, top up with the types that have the most material
    for (const t of ["fill", "order", "translate", "listen"]) { if (rest > 0) rest = take(t, rest); }
    // interleave types so consecutive cards differ
    const byType = {}; out.forEach(e => (byType[e.type] ||= []).push(e));
    const mixed = []; let added = true;
    while (added) { added = false; for (const [t] of PLAN) { const e = byType[t]?.shift(); if (e) { mixed.push(e); added = true; } } }
    return mixed.slice(0, TOTAL).map((e, i) => ({ ...e, id: i }));
  }

  window.Practice = { build, TYPE_LABEL, norm, words, isGerman };
})();
