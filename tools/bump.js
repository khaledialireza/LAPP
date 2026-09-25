#!/usr/bin/env node
// Adds ?v=<version> to local CSS/JS in index.html so browsers never mix a new page with old cached files.
//   node tools/bump.js
const fs = require("fs"), path = require("path");
const file = path.join(__dirname, "..", "index.html");
const v = Date.now().toString(36);
let s = fs.readFileSync(file, "utf8");
s = s.replace(/(<(?:script|link)[^>]+(?:src|href)=")((?!https?:)[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g, `$1$2?v=${v}"`);
fs.writeFileSync(file, s);
console.log("version", v);
