// Lists the English text of the staff and school pages, for content/lang/<code>/panel.json.
//   node tools/panel-strings.js            → every string, one per line (JSON array)
//   node tools/panel-strings.js --missing  → per language, the strings its panel.json lacks
// ${…} inside a text becomes {a}, {b}… so the translation can move the values around.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const FILES = ["ui/kit.js", "ui/menu.js", "ui/desk/lock.js", "worker/src/admin.html", "worker/src/studio.html", "worker/src/school.html", "ui/lapp-ui.js", "ui/shell.js", "ui/drive.js", "worker/src/manage.html", "worker/src/files.html", "worker/src/settings.html", "worker/src/users.html", "worker/src/store.html", "worker/src/customers.html", "ui/desk/core.js", "ui/desk/apps.js", "ui/desk/windows.js", "ui/desk/taskbar.js", "ui/desk/command.js", "ui/desk/desktop.js", "ui/desk/system.js", "ui/desk/main.js", "ui/studio-menu.js", "ui/studio-lesson.js", "ui/studio-script.js", "ui/studio-voice.js"];
const out = new Set();

// a template string with ${…} → text with {a} {b} holes (nested braces are skipped over)
function holes(s) {
  let r = "", i = 0, k = 0;
  while (i < s.length) {
    if (s[i] === "$" && s[i + 1] === "{") {
      let d = 0, j = i + 1;
      for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; }
      r += "{" + String.fromCharCode(97 + (k++ % 26)) + "}"; i = j + 1;
    } else r += s[i++];
  }
  return r;
}
function add(raw) {
  let s = holes(raw).replace(/\s+/g, " ").trim();
  // leading emoji / symbols are kept by the page, the words are what we translate
  s = s.replace(/^[^\p{L}{]+/u, "").replace(/[\s·:,–—-]+$/u, "").trim();
  if (!/\p{L}{2,}/u.test(s.replace(/\{\w\}/g, ""))) return;               // needs a real word
  if (/^[a-z0-9_.-]+$/.test(s) && !/\s/.test(s) && s.length < 3) return;
  if (/^(https?:|\/|#|[a-z]+\(|[a-z-]+:)/.test(s)) return;              // urls, code, css
  if (/[{};=]/.test(s.replace(/\{\w\}/g, ""))) return;
  if (/^[a-z][a-zA-Z]+$/.test(s) && s !== s.toLowerCase()) return;        // camelCase identifiers
  if (s.length > 220) return;
  out.add(s);
}
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8").replace(/<style[\s\S]*?<\/style>/g, "");
  // text between tags
  for (const m of src.matchAll(/>([^<>]+)</g)) {
    const t = m[1];
    if (/^\s*$/.test(t) || /=>|\bfunction\b|\breturn\b|\bconst\b|&&|\|\||===/.test(t)) {
      // a text with code in it: keep only the readable bits between ${…}
      if (!/[`]/.test(t)) for (const part of holes(t).split(/\{\w\}/)) add(part);
      continue;
    }
    add(t);
    for (const part of holes(t).split(/\{\w\}/)) add(part);
  }
  // attributes people see
  for (const m of src.matchAll(/(?:placeholder|title|aria-label)="([^"]+)"/g)) add(m[1]);
  // strings handed to the page in code
  for (const m of src.matchAll(/(?:label|ph|placeholder|title|hint|sub|okLabel|text):\s*"([^"]+)"/g)) add(m[1]);
  for (const m of src.matchAll(/(?:toast|confirm|alert|prompt|Error|fail)\(\s*(["`])((?:(?!\1).)+)\1/g)) add(m[2]);
  for (const m of src.matchAll(/\[\s*"[a-z_]+",\s*"([^"]+)"/g)) add(m[1]);                 // ["key", "Label", …]
  for (const m of src.matchAll(/\b[a-z_]+:\s*"([A-Z][^"]{1,80})"/g)) add(m[1]);              // { talk: "Conversation" }
  for (const m of src.matchAll(/\?\s*"([A-Z][^"]{1,80})"\s*:\s*"([^"]{1,80})"/g)) { add(m[1]); add(m[2]); }
  for (const m of src.matchAll(/,\s*"([A-Z][a-z][^"]{1,60})"\s*\)/g)) add(m[1]);             // form("Title", …, "Save")
  for (const m of src.matchAll(/form\(\s*"([^"]+)"/g)) add(m[1]);
  for (const m of src.matchAll(/`([^`]*)`/g)) if (!/</.test(m[1]) && /^[A-Z]/.test(m[1].trim())) add(m[1]);
}
const list = [...out].sort();
if (process.argv.includes("--missing")) {
  for (const l of ["fa", "ru", "uk"]) {
    const p = path.join(ROOT, "content/lang", l, "panel.json");
    const d = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
    const miss = list.filter(s => !(s in d));
    console.log(l, miss.length, "missing");
    if (miss.length) console.log(JSON.stringify(miss, null, 1));
  }
} else console.log(JSON.stringify(list, null, 1));
