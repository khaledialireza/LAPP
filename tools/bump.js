#!/usr/bin/env node
// Adds ?v=<version> to local CSS/JS in index.html, and sets the panels' ASSET_V, so browsers never mix a new page with old cached files.
//   node tools/bump.js
const fs = require("fs"), path = require("path");
const file = path.join(__dirname, "..", "index.html");
const v = Date.now().toString(36);
let s = fs.readFileSync(file, "utf8");
s = s.replace(/(<(?:script|link)[^>]+(?:src|href)=")((?!https?:)[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g, `$1$2?v=${v}"`);
fs.writeFileSync(file, s);
// the panels: one asset version for every shared and page script (worker/src/index.js → ASSET_V)
const worker = path.join(__dirname, "..", "worker", "src", "index.js");
fs.writeFileSync(worker, fs.readFileSync(worker, "utf8").replace(/const ASSET_V = "[^"]*";/, `const ASSET_V = "${v}";`));
console.log("version", v);
