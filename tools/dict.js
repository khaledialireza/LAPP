#!/usr/bin/env node
// ابزار دیکشنری LAPP
//   node tools/dict.js check   → دیکشنری سراسری را برای تکراری‌ها بررسی می‌کند
//   node tools/dict.js build   → فهرست کلمه‌های هر درس را در content/lessons/<درس>/lesson.json می‌نویسد
// دیکشنری سراسری (content/lang/de/dict.json + معنی‌ها در content/lang/<زبان>/dict.json) تنها جایی است که معنی کلمه‌ها ذخیره می‌شود؛
// هر درس فقط فهرست کلیدها را نگه می‌دارد، پس هیچ کلمه‌ای دو بار ذخیره نمی‌شود.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const C = path.join(root, "content");
const json = f => JSON.parse(fs.readFileSync(path.join(C, f), "utf8"));
global.window = {};
const idx0 = json("index.json");
const de = json("lang/de/dict.json"), fa = json("lang/fa/dict.json");
const DICT = {};
for (const [k, v] of Object.entries(de)) { const m = fa[k]; DICT[k] = { p: v.p, f: v.f || [], fa: typeof m === "string" ? m : m ? m.m : "" }; }
const NAMES = Object.fromEntries(json("lang/de/names.json").map(n => [n, n]));
const LESSONS = idx0.lessons.map(dir => ({ dir, ...json(`lessons/${dir}/lesson.json`) }));
window.VERBS = json("lang/de/verbs.json");
require(path.join(root, "grammar.js"));

const clean = t => t.replace(/^[^A-Za-zÄÖÜäöüßé]+|[^A-Za-zÄÖÜäöüßé'-]+$/g, "");
const base = k => k.replace(/_.*/, "");
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
  const src = fs.readFileSync(path.join(C, "lang/de/dict.json"), "utf8");
  const problems = [];
  // 1) same key written twice in the source (JSON.parse silently keeps the last one)
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
  LESSONS.forEach(L => {
    const keys = [], missing = new Set();
    L.transcript.forEach(line => {
      line.replace(/^\*\*.+?:\*\*\s*/, "").split(/\s+/).forEach(tok => {
        const w = clean(tok); if (!w || NAMES[w]) return;
        const k = lookupKey(idx, w);
        if (!k) { missing.add(w); return; }
        if (DICT[k].p !== "انگلیسی" && !keys.includes(k)) keys.push(k);
      });
    });
    // words go into lesson.json as one line, the rest of the file is left as it is
    const file = `content/lessons/${L.dir}/lesson.json`, full = path.join(root, file);
    const txt = fs.readFileSync(full, "utf8").replace(/^(  "words": ).*$/m, (m, a) => a + JSON.stringify(keys).replace(/,/g, ", ") + (/,\s*$/.test(m) ? "," : ""));
    fs.writeFileSync(full, txt);
    console.log(`${file}: ${keys.length} کلمه` + (missing.size ? ` · بدون مدخل (انگلیسی یا جدید): ${[...missing].join(", ")}` : ""));
  });
}

const cmd = process.argv[2];
if (cmd === "check") process.exitCode = check() ? 1 : 0;
else if (cmd === "build") { build(); }
else console.log("usage: node tools/dict.js check|build");
