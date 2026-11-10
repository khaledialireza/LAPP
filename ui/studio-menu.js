// LAPP Studio · the right-click menu of a line and the word card.
// Short, grouped, with sub-menus, a search and "ask the assistant" — our own menu, never the browser's.
// Loaded after the studio's script; it uses the studio's own helpers (S, rows, say, rewrite, insertLine…).
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const I = (n, s = 15) => window.Icon ? Icon(n, s) : "";
  const st = document.createElement("style");
  st.textContent = `.lctx{position:fixed;z-index:90;width:300px;background:#1A1A27;border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.7);font-size:13px;overflow:visible;animation:lp .1s ease-out}
@keyframes lp{from{opacity:0;transform:translateY(4px)}to{opacity:1}}
.lctx .q{display:flex;align-items:center;gap:7px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08);color:rgba(235,235,245,.4)}.lctx .q input{flex:1;background:none;border:0;outline:none;color:inherit;font:inherit;color:#F4F4F8}
.lctx .hd{padding:7px 12px 3px;font:700 10.5px Inter,system-ui;letter-spacing:.5px;text-transform:uppercase;color:rgba(235,235,245,.4)}
.lctx .ls{padding:4px;max-height:52vh;overflow:auto}
.lctx .it{position:relative;display:flex;align-items:center;gap:9px;width:100%;padding:6px 9px;border-radius:8px;text-align:start;color:#F4F4F8;background:none;border:0;font:inherit;cursor:pointer}
.lctx .it:hover,.lctx .it.hov,.lctx .it:focus-visible{background:rgba(139,92,246,.25)}.lctx .it .ic{color:rgba(235,235,245,.55)}.lctx .it.dz{color:#F87171}
.lctx .it kbd{margin-inline-start:auto;font:600 10.5px Inter,system-ui;color:rgba(235,235,245,.4);border:0;background:none}
.lctx .it .ar{margin-inline-start:auto;color:rgba(235,235,245,.4)}
.lctx .sub{display:none;position:absolute;inset-inline-start:calc(100% - 6px);top:-5px;min-width:210px;background:#1A1A27;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:4px;box-shadow:0 20px 50px rgba(0,0,0,.7)}
.lctx .it:hover>.sub,.lctx .it.hov>.sub{display:block}
.lctx .ask{display:flex;align-items:center;gap:7px;padding:8px 10px;border-top:1px solid rgba(255,255,255,.08)}.lctx .ask input{flex:1;background:none;border:0;outline:none;font:inherit;color:#F4F4F8}
.lctx .spark{background:linear-gradient(135deg,#FF3D7F,#8B5CF6 55%,#22D3EE);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800}
.wcard{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08)}.wcard .w{font-size:17px;font-weight:800}.wcard .p{font-size:11.5px;color:rgba(235,235,245,.45)}.wcard .m{margin-top:4px}.wcard .g{margin-top:4px;font-size:12px;color:rgba(235,235,245,.6)}
.wcard .tag{display:inline-block;margin-top:6px;font-size:11px;padding:1px 8px;border-radius:99px;border:1px solid rgba(255,255,255,.14)}.wcard .tag.nw{color:#22D3EE}.wcard .tag.hw{color:#FBBF24}`;
  document.head.append(st);

  /* ---------- the dictionary, for the word card ---------- */
  const DICT = {};
  async function dictFor(course, lang) {
    const k = course + ":" + lang; if (DICT[k]) return DICT[k];
    const [base, mean] = await Promise.all([fetch(`/content/lang/${course}/dict.json`).then(r => r.json()).catch(() => ({})), fetch(`/content/lang/${lang}/dict.${course}.json`).then(r => r.ok ? r.json() : fetch(`/content/lang/en/dict.${course}.json`).then(x => x.json())).catch(() => ({}))]);
    const forms = new Map();
    for (const [key, v] of Object.entries(base)) { const b = key.split("_")[0]; forms.set(b.toLowerCase(), key); for (const f of v.f || []) if (!forms.has(f.toLowerCase())) forms.set(f.toLowerCase(), key); }
    return DICT[k] = { base, mean, forms };
  }
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
    const mean = typeof m === "string" ? m : m && m.m || "", gram = m && typeof m === "object" ? m.g || "" : "";
    const hard = (((S.L.data.check && S.L.data.check.lines) || []).find(x => x.i === i) || {}).hard || [];
    return `<div class="wcard"><div class="w">${E(word)}</div><div class="p">${key ? `LAPP dictionary · ${E(key.split("_")[0])}${b && b.p ? " · " + E(b.p) : ""}` : "not in the LAPP dictionary yet"}</div>${mean ? `<div class="m" dir="auto">${E(mean)}</div>` : ""}${gram ? `<div class="g" dir="auto">${E(gram)}</div>` : ""}${!key ? `<span class="tag nw">new word for LAPP</span>` : ""}${hard.includes(word) ? ` <span class="tag hw">above ${E(S.L.level)}</span>` : ""}</div>`;
  }

  /* ---------- the line menu ---------- */
  const close = () => $$(".lctx").forEach(x => x.remove());
  function items(i, word) {
    const r = rows()[i], ai = S.scope && S.scope.ai, cast = Object.keys(S.L.data.cast || {}), scenes = S.L.data.scenes;
    const it = (label, icon, run, o = {}) => ({ label, icon, run, ...o });
    const L = [];
    if (word) L.push(["Word", "book", [it(`Listen to “${word}”`, "listen", () => say(word, S.L.course, .8)), it("Make it a key phrase", "star", () => { (S.L.data.phrases = S.L.data.phrases || []).push({ de: word, en: "", fa: "", ru: "", uk: "" }); changed(); renderSide(); toast("Added to the key phrases"); }), it("Ask the AI what it means here", "ai", () => askAi(`What does “${word}” mean in this line of my ${S.L.level} lesson, and is it right for that level? Line: “${r.de}”`))]]);
    L.push(["Edit", "edit", [it("Edit the text", "pen", () => { const el = $(`.txt .d[data-i="${i}"]`); el && el.focus(); }, { k: "↵" }), it(r.ok ? "Not approved" : "Approve", "approve", () => { r.ok = !r.ok; changed(); renderDoc(); selLine(i); }), it("Listen", "listen", () => say(r.de, S.L.course, r.speed || (S.L.data.cast[r.who] || {}).speed || 0.95)),
      it("Duplicate", "copy", () => { const [si, li] = locate(i); scenes[si].lines.splice(li + 1, 0, { ...r, ok: false }); changed(); renderDoc(); selLine(i + 1); }), it("Copy the text", "copy", () => navigator.clipboard && navigator.clipboard.writeText(r.de).then(() => toast("Copied")))]]);
    if (ai) L.push(["AI", "ai", [it("Simpler (" + S.L.level + ")", "wand", () => rewrite(i, "simpler")), it("More natural", "wand", () => rewrite(i, "natural")), it("Shorter", "wand", () => rewrite(i, "shorter")), it("More polite", "wand", () => rewrite(i, "formal")), it("More casual", "wand", () => rewrite(i, "casual")), it("Add a question", "plus", () => rewrite(i, "question")),
      it("Accent · Austrian", "globe", () => custom(i, "the way people in Austria say it (Austrian German words and phrasing)")), it("Accent · Swiss", "globe", () => custom(i, "the way people in Switzerland say it in Swiss Standard German")), it("Check the level", "approve", () => ACT.check && ACT.check()), it("My own instruction…", "edit", () => rewrite(i, "custom"))]]);
    L.push(["Translate", "translate", [...(ai ? [it("Fill all missing translations", "translate", () => ACT.translate && ACT.translate())] : []), ...["en", "fa", "ru", "uk"].map(l => it("Show " + l.toUpperCase(), "language", () => { S.tr = l; V.script(); }, { on: S.tr === l }))]]);
    L.push(["Person", "person", [...cast.map(n => it(n, "user", () => { r.who = n; changed(); renderDoc(); selLine(i); }, { on: r.who === n })), it("Someone new…", "user-plus", () => pickSpeaker(i)), it("Open the characters", "cast", () => { location.hash = "universe"; })]]);
    L.push(["Voice", "wave", [...[0.8, 0.9, 1].map(v => it(`Speed ${v}×`, "clock", () => { r.speed = v; changed(); toast(`Line ${i + 1}: speed ${v}×`); }, { on: (r.speed || 0) === v })), it("Open in the voice desk", "wave", () => { location.hash = "voice/" + S.L.id; })]]);
    L.push(["Structure", "structure", [it("New line above", "plus", () => insertLine(i - 1)), it("New line below", "plus", () => insertLine(i)), it("New scene from here", "scene", () => { const [si, li] = locate(i); if (li === 0) return toast("This line already starts a scene"); const rest = scenes[si].lines.splice(li); scenes.splice(si + 1, 0, { title: { de: `Szene ${si + 2}`, en: "", fa: "", ru: "", uk: "" }, lines: rest }); changed(); renderDoc(); }),
      ...(scenes.length > 1 ? scenes.map((s, si) => it(`Move to scene ${si + 1}`, "chevron", () => { const [from, li] = locate(i); if (from === si) return; const [x] = scenes[from].lines.splice(li, 1); scenes[si].lines.push(x); changed(); renderDoc(); }, { disabled: locate(i)[0] === si })) : [])]]);
    L.push(["Delete the line", "trash", null, { danger: true, run: () => delLine(i), k: "Del" }]);
    return L;
  }
  function custom(i, how) { const orig = window.prompt; window.prompt = () => how; try { rewrite(i, "custom"); } finally { window.prompt = orig; } }
  function askAi(text) { if (window.LAPPFrame && LAPPFrame.embed) LAPPFrame.up({ t: "ask", text }); else toast(text); }

  async function open(x, y, i, word) {
    close(); selLine(i);
    const L = items(i, word), m = document.createElement("div"); m.className = "lctx"; m.setAttribute("role", "menu");
    m.innerHTML = `${word ? await card(word, i) : ""}<div class="q">${I("search", 14)}<input placeholder="Search… e.g. “voice”" aria-label="Search actions"></div><div class="hd">Line ${i + 1}${rows()[i].who ? " · " + E(rows()[i].who) : ""}</div><div class="ls">${L.map(([l, ic, sub, o = {}], k) => `<button class="it ${o.danger ? "dz" : ""}" data-g="${k}" data-l="${E(l.toLowerCase())}">${I(ic)}<span>${E(l)}</span>${sub ? `<span class="ar">${I("chevron", 13)}</span><div class="sub">${sub.map((s, j) => `<button class="it" data-s="${k}:${j}" data-l="${E(s.label.toLowerCase())}" ${s.disabled ? "disabled" : ""}>${I(s.icon)}<span>${E(s.label)}</span>${s.on ? `<kbd>●</kbd>` : s.k ? `<kbd>${E(s.k)}</kbd>` : ""}</button>`).join("")}</div>` : `<kbd>${E(o.k || "")}</kbd>`}</button>`).join("")}</div>
      ${S.scope && S.scope.ai ? `<div class="ask"><span class="spark">✦</span><input placeholder="Ask the assistant to change this line…" aria-label="Ask the assistant"><kbd style="font-size:10.5px;color:rgba(235,235,245,.4)">↵</kbd></div>` : ""}`;
    document.body.append(m);
    const w = m.offsetWidth, h = m.offsetHeight; m.style.left = Math.max(6, Math.min(x, innerWidth - w - 220)) + "px"; m.style.top = Math.max(6, Math.min(y, innerHeight - h - 6)) + "px";
    const run = el => { if (el.dataset.s) { const [g, j] = el.dataset.s.split(":").map(Number); close(); L[g][2][j].run(); } else if (el.dataset.g && !L[el.dataset.g][2]) { close(); L[el.dataset.g][3].run(); } };
    m.addEventListener("click", e => { const el = e.target.closest("[data-s], [data-g]"); if (el && !el.disabled) { e.stopPropagation(); if (el.dataset.s || !L[el.dataset.g][2]) run(el); } });
    const q = $(".q input", m);
    q.oninput = () => {
      const s = q.value.trim().toLowerCase();
      $$(".ls > .it", m).forEach(g => { const own = g.dataset.l.includes(s), subs = $$(".sub .it", g); subs.forEach(c => c.hidden = s && !own && !c.dataset.l.includes(s)); const hit = !s || own || subs.some(c => !c.hidden); g.hidden = !hit; g.classList.toggle("hov", !!s && hit && !own && subs.length > 0); });
    };
    q.onkeydown = e => { if (e.key === "Escape") close(); if (e.key === "Enter") { const first = $$(".ls .it.hov .sub .it:not([hidden]), .ls > .it:not([hidden])", m)[0]; if (first) run(first.dataset.s || first.dataset.g ? first : first); } };
    const ask = $(".ask input", m);
    if (ask) ask.onkeydown = e => { if (e.key === "Escape") close(); if (e.key === "Enter" && ask.value.trim()) { const v = ask.value.trim(); close(); custom(i, v); } };
    q.focus();
  }
  document.addEventListener("contextmenu", e => {
    const dl = e.target.closest && e.target.closest(".dl"); if (!dl || !S.L) return;
    if (e.shiftKey) return;   // Shift + right-click: the browser's own menu (spelling)
    e.preventDefault();
    const word = e.target.closest(".txt .d") ? wordAt(e.clientX, e.clientY) : "";
    open(e.clientX, e.clientY, Number(dl.dataset.i), word);
  });
  document.addEventListener("click", e => { if (!e.target.closest(".lctx")) close(); });
  addEventListener("scroll", close, true);
  // the keyboard: the menu for the chosen line
  document.addEventListener("keydown", e => {
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { if (S.L && S.sel >= 0) { const el = $(`.dl[data-i="${S.sel}"]`); if (el) { e.preventDefault(); const r = el.getBoundingClientRect(); open(r.left + 60, r.top + 30, S.sel, ""); } } }
    if (e.key === "Escape") close();
  });
  // a hint the first time
  if (!localStorage.getItem("lapp.studio.ctxhint")) setTimeout(() => { if (S.L && $("#doc") && typeof toast === "function") { toast("Tip: right-click a line or a word for every action"); try { localStorage.setItem("lapp.studio.ctxhint", "1"); } catch {} } }, 4000);
})();
