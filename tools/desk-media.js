// Pages inside a desktop window keep their desktop layout: every "small screen" rule (@media max-width…)
// only applies when the page is NOT on a computer (html.desk is set by ui/frame.js). Idempotent.
//   node tools/desk-media.js
const fs = require("fs"), path = require("path");
const FILES = ["ui/shell.js", "ui/drive.js", "worker/src/admin.html", "worker/src/school.html", "worker/src/studio.html"];
const P = "html:not(.desk) ";
for (const f of FILES) {
  const file = path.join(__dirname, "..", f); let s = fs.readFileSync(file, "utf8"), n = 0, out = "", i = 0;
  const re = /@media\s*\(max-width:\s*\d+px\)\s*\{/g; let m;
  while ((m = re.exec(s))) {
    let j = m.index + m[0].length, depth = 1;
    while (depth && j < s.length) { if (s[j] === "{") depth++; else if (s[j] === "}") depth--; j++; }
    const body = s.slice(m.index + m[0].length, j - 1);
    const nb = body.replace(/(^|\})(\s*)([^{}]+)\{/g, (all, a, ws, sel) => a + ws + sel.split(",").map(x => { const t = x.trim(); return !t || t.startsWith(P.trim()) ? x : x.replace(t, P + t); }).join(",") + "{");
    out += s.slice(i, m.index + m[0].length) + nb + "}"; i = j; re.lastIndex = j; if (nb !== body) n++;
  }
  out += s.slice(i);
  if (out !== s) fs.writeFileSync(file, out);
  console.log(f, n, "blocks");
}
