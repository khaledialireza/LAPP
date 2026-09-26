#!/usr/bin/env node
// ابزار دیکشنری LAPP
//   node tools/dict.js check   → دیکشنری سراسری را برای تکراری‌ها بررسی می‌کند
//   node tools/dict.js build   → برای هر درس فایل data/lessonN-words.js می‌سازد (کلیدهای دیکشنری سراسری)
// دیکشنری سراسری (data/dict-de.js) تنها جایی است که معنی کلمه‌ها ذخیره می‌شود؛
// هر درس فقط فهرست کلیدها را نگه می‌دارد، پس هیچ کلمه‌ای دو بار ذخیره نمی‌شود.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
global.window = {};
const load = f => fs.existsSync(path.join(root, f)) && require(path.join(root, f));
load("data/lessons.js");
for (const f of fs.readdirSync(path.join(root, "data")).filter(f => /^lesson\d+-fa\.js$/.test(f))) load("data/" + f);
load("data/dict-de.js");
const { DICT, NAMES = {}, LESSONS = [] } = window;

const clean = t => t.replace(/^[^A-Za-zÄÖÜäöüßé]+|[^A-Za-zÄÖÜäöüßé'-]+$/g, "");
const base = k => k.replace(/_.*/, "");
load("data/verbs-de.js"); load("grammar.js");
function index() {
  const idx = {};
  for (const [k, v] of Object.entries(DICT)) for (const f of [base(k), ...(v.f || [])]) { idx[f] ??= k; idx[f.toLowerCase()] ??= k; }
  // conjugated verb forms (present, past, participle) point to the infinitive — same as the app does
  for (const [k, v] of Object.entries(DICT)) if ((v.p || "").includes("فعل") && window.Grammar) {
    const vb = window.Grammar.verb(k), add = f => { f = f.split(" ")[0]; idx[f] ??= k; idx[f.toLowerCase()] ??= k; };
    vb.rows.forEach(r => { add(r.pr); add(r.pt); }); add(vb.pp);
  }
  return idx;
}

function check() {
  const src = fs.readFileSync(path.join(root, "data/dict-de.js"), "utf8");
  const problems = [];
  // 1) same key written twice in the source (JS silently keeps the last one)
  const keys = [...src.matchAll(/^\s*"([^"]+)":\s*\{/gm)].map(m => m[1]);
  const seenKey = new Set();
  keys.forEach(k => { if (seenKey.has(k)) problems.push(`کلید تکراری: ${k}`); seenKey.add(k); });
  // 2) same word + same meaning under two keys
  const sig = new Map();
  for (const [k, v] of Object.entries(DICT)) {
    const s = base(k).toLowerCase() + "|" + (v.fa || "").trim();
    if (sig.has(s)) problems.push(`معنی تکراری: ${sig.get(s)} و ${k} (${v.fa})`); else sig.set(s, k);
  }
  // 3) one written form claimed by two different entries
  const owner = new Map();
  for (const [k, v] of Object.entries(DICT)) for (const f of [base(k), ...(v.f || [])]) {
    const o = owner.get(f);
    if (o && o !== k && base(o) !== base(k)) problems.push(`شکل «${f}» در دو مدخل آمده: ${o} و ${k}`);
    else owner.set(f, k);
  }
  // 4) empty entries
  for (const [k, v] of Object.entries(DICT)) if (!v.fa || !v.p) problems.push(`مدخل ناقص: ${k}`);
  console.log(`${Object.keys(DICT).length} مدخل در دیکشنری سراسری`);
  console.log(problems.length ? problems.join("\n") : "هیچ تکراری پیدا نشد ✓");
  return problems.length;
}

// inflected adjectives, articles and nouns: tolles → toll, Freunden → Freund, keinen → kein
function lookupKey(idx, w) {
  const hit = x => idx[x] || idx[x.toLowerCase()];
  if (hit(w)) return hit(w);
  for (const end of ["en", "em", "er", "es", "e", "n", "s"]) if (w.length > end.length + 2 && w.endsWith(end) && hit(w.slice(0, -end.length))) return hit(w.slice(0, -end.length));
  return null;
}
function build() {
  const idx = index();
  LESSONS.forEach((L, li) => {
    const keys = [], missing = new Set();
    L.transcript.split("\n").map(s => s.trim()).filter(Boolean).forEach(line => {
      line.replace(/^\*\*.+?:\*\*\s*/, "").split(/\s+/).forEach(tok => {
        const w = clean(tok); if (!w || NAMES[w]) return;
        const k = lookupKey(idx, w);
        if (!k) { missing.add(w); return; }
        if (DICT[k].p !== "انگلیسی" && !keys.includes(k)) keys.push(k);
      });
    });
    const file = `data/lesson${L.id}-words.js`;
    fs.writeFileSync(path.join(root, file),
      `// دیکشنری درس ${L.id}: کلیدهای دیکشنری سراسری (data/dict-de.js)، به ترتیب اولین ظهور در متن.\n` +
      `// با «node tools/dict.js build» دوباره ساخته می‌شود.\nwindow.LESSONS[${li}].words = ${JSON.stringify(keys)};\n`);
    console.log(`${file}: ${keys.length} کلمه` + (missing.size ? ` · بدون مدخل (انگلیسی یا جدید): ${[...missing].join(", ")}` : ""));
  });
}

const cmd = process.argv[2];
if (cmd === "check") process.exitCode = check() ? 1 : 0;
else if (cmd === "build") { build(); }
else console.log("usage: node tools/dict.js check|build");
