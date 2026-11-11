// LAPP kit — the ONE place for everything the pages share: helpers, talking to the server, dates and money,
// toasts, dialogs, popovers, avatars, the browser's voice, dragging, uploads, "this page belongs in the desktop".
// Every page (and the work desktop) uses window.K; nothing here may be copied into a page.
// Its look is in /ui/kit.css; the context menu is /ui/menu.js (K.menu).
(function () {
  "use strict";
  if (window.K) return;
  const K = window.K = {};

  /* ---------- small helpers ---------- */
  K.$ = (s, r = document) => r.querySelector(s);
  K.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  K.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // this browser's storage: values as JSON (a plain string stored by older code is read as it is);
  // raw / setRaw for keys other code reads as plain text (e.g. "lapp:lang")
  K.LS = {
    get(k, d) { let v; try { v = localStorage.getItem(k); } catch { return d; } if (v == null) return d; try { return JSON.parse(v) ?? d; } catch { return v; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
    raw(k) { try { return localStorage.getItem(k); } catch { return null; } },
    setRaw(k, v) { try { localStorage.setItem(k, v); } catch {} },
    keys() { try { return Object.keys(localStorage); } catch { return []; } }
  };
  // a small event channel: const ch = K.events(); ch.on("change", f) → off(); ch.emit("change", …)
  K.events = () => { const L = {}; return {
    on(e, f) { (L[e] = L[e] || new Set()).add(f); return () => L[e].delete(f); },
    emit(e, ...a) { (L[e] || []).forEach(f => { try { f(...a); } catch (x) { console.error(x); } }); } }; };
  // the look changed (theme, accent, pointer) — in this window or another one
  K.onLook = f => {
    addEventListener("storage", e => { if (e.key === "lapp.theme" || e.key === "lapp.cursor") f(); });
    addEventListener("message", e => { if (e.origin === location.origin && e.data && e.data.lapp && e.data.t === "theme") setTimeout(f, 0); });
  };
  K.loc = () => window.PanelI18N ? PanelI18N.locale : (navigator.language || "en-GB");
  K.embed = new URLSearchParams(location.search).has("embed") && window.parent !== window;
  // keys: a Mac has ⌘ Command, ⌥ Option and ⌃ Control (Command and Control are different keys); elsewhere Ctrl
  K.MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  // the keys of a keydown as one text: "Cmd+K", "Ctrl+Alt+ArrowLeft" ("" for a lone modifier)
  K.combo = e => { if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return ""; const k = e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.code === "Backquote" ? "`" : e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key; return (K.MAC ? [e.metaKey && "Cmd", e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", k] : [(e.ctrlKey || e.metaKey) && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", k]).filter(Boolean).join("+"); };
  K.keyLabel = c => { let t = String(c || "").replace("ArrowLeft", "←").replace("ArrowRight", "→").replace("ArrowUp", "↑").replace("ArrowDown", "↓").replace("Escape", "Esc"); if (K.MAC) t = t.replace(/Cmd\+/g, "⌘").replace(/Ctrl\+/g, "⌃").replace(/Alt\+/g, "⌥").replace(/Shift\+/g, "⇧"); return t; };
  // our icons (ui/icons.js); a page still written with an emoji gets the icon for it
  K.I = (n, s = 16) => window.Icon ? Icon(n, s) : "";
  K.IE = (e, s = 16) => { if (!window.Icon) return K.esc(e || ""); if (Icon.names.includes(e)) return Icon(e, s); const n = Icon.fromEmoji(e); return n ? Icon(n, s) : K.esc(e || ""); };

  /* ---------- dates, times, money, sizes ---------- */
  K.ago = (ms, empty = "—") => { if (!ms) return empty; const m = (Date.now() - ms) / 6e4; return m < 1 ? "now" : m < 60 ? Math.round(m) + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
  K.time = t => new Date(t).toLocaleTimeString(K.loc(), { hour: "2-digit", minute: "2-digit" });
  // a date: a timestamp, or "YYYY-MM-DD" (read at noon, so no time zone moves it a day)
  K.date = (t, o = { day: "numeric", month: "short", year: "numeric" }) => { if (!t && t !== 0) return ""; const d = typeof t === "string" && /^\d{4}-\d\d-\d\d$/.test(t) ? new Date(t + "T12:00:00") : new Date(t); return isNaN(d) ? "" : d.toLocaleDateString(K.loc(), o); };
  K.dateTime = t => t ? new Date(t).toLocaleString(K.loc(), { dateStyle: "medium", timeStyle: "short" }) : "—";
  K.money = (cents, currency = "EUR") => new Intl.NumberFormat(K.loc(), { style: "currency", currency }).format((cents || 0) / 100);
  K.size = n => n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB";
  K.fileIcon = (name = "", type = "") => /^image\//.test(type) ? "image" : /pdf/.test(type) ? "file-text" : /^audio\//.test(type) ? "music" : /^video\//.test(type) ? "video" : /sheet|excel|csv/i.test(type + name) ? "sheet" : /word|document|text|\.docx?$/i.test(type + name) ? "file-text" : "file";

  K.clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;   // seconds → m:ss
  // the words of a text, in any language (letters, marks, apostrophes, hyphens)
  K.words = t => String(t || "").match(/[\p{L}\p{M}\d'’-]+/gu) || [];
  // a shuffled copy (rnd: a seeded random for the same order every time)
  K.shuffle = (a, rnd = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- LAPP's own words: courses, levels, topics, lesson types (one list for every page) ---------- */
  K.COURSES = { de: { name: "German", native: "Deutsch", flag: "🇩🇪", speech: "de-DE" }, nl: { name: "Dutch", native: "Nederlands", flag: "🇳🇱", speech: "nl-NL" }, pl: { name: "Polish", native: "Polski", flag: "🇵🇱", speech: "pl-PL" } };
  K.LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  K.TOPICS = { daily: "Daily life", travel: "Travel & hotel", food: "Food & shopping", health: "Health & doctor", work: "Work & office", home: "Home & family", city: "City & transport", school: "School & study", story: "Stories", other: "Other" };
  K.TYPES = { talk: ["💬", "Conversation"], lesson: ["🎧", "Lesson"], story: ["📖", "Story"] };
  K.flag = c => (K.COURSES[c] || {}).flag || "";
  // choices for l-select
  K.opt = {
    courses: () => Object.entries(K.COURSES).map(([value, c]) => ({ value, label: c.name, icon: c.flag, sub: c.native })),
    levels: () => K.LEVELS.map(value => ({ value, label: value })),
    topics: () => Object.entries(K.TOPICS).map(([value, label]) => ({ value, label })),
    types: () => Object.entries(K.TYPES).map(([value, [icon, label]]) => ({ value, label, icon }))
  };
  // LAPP's dictionary of a course (cached): base entries, every form → its entry, and names
  const DICTS = {}, MEANS = {};
  K.dict = course => DICTS[course] || (DICTS[course] = Promise.all([
    fetch(`/content/lang/${course}/dict.json`).then(r => r.json()).catch(() => ({})),
    fetch(`/content/lang/${course}/names.json`).then(r => r.ok ? r.json() : []).catch(() => [])
  ]).then(([base, names]) => {
    const forms = new Map();
    for (const [key, v] of Object.entries(base)) { const b = key.split("_")[0].toLowerCase(); if (!forms.has(b)) forms.set(b, key); for (const f of v.f || []) if (!forms.has(f.toLowerCase())) forms.set(f.toLowerCase(), key); }
    return { base, forms, names: new Set((Array.isArray(names) ? names : Object.keys(names)).map(x => String(x).toLowerCase())) };
  }));
  // what its words mean in a language (English when that language has none)
  K.meanings = (course, lang) => MEANS[course + lang] || (MEANS[course + lang] = fetch(`/content/lang/${lang}/dict.${course}.json`).then(r => r.ok ? r.json() : fetch(`/content/lang/en/dict.${course}.json`).then(x => x.json())).catch(() => ({})));

  /* ---------- talking to the server ---------- */
  // K.api(method, path, body, raw?) against /api; K.apiAt(base, o) makes one for another base (e.g. /api/studio)
  //   o.next: where to come back after signing in (signed out → the sign-in page); o.signin: false → just an error
  //   o.keepalive: true → a PUT still arrives when the page closes (small bodies only)
  K.apiAt = (base, o = {}) => async (method, path, body, raw) => {
    if (typeof o === "string") o = { next: o };
    const headers = raw ? { "X-LAPP": "1", ...(raw.headers || {}) } : { ...(body ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { "X-LAPP": "1" } : {}) };
    const r = await fetch(base + path, { method, credentials: "same-origin", headers, body: raw ? raw.body : body ? JSON.stringify(body) : undefined, keepalive: !!o.keepalive && method === "PUT" });
    const ct = r.headers.get("Content-Type") || "", j = /json/.test(ct) || !ct ? await r.json().catch(() => ({})) : {};
    if (r.status === 401 && o.signin !== false) { location.href = `/?login=1&next=${encodeURIComponent(o.next || (K.embed ? "/manage" : location.pathname))}`; throw new Error("signed out"); }
    if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), j, { status: r.status });
    return j;
  };
  K.api = K.apiAt("/api");

  /* ---------- a lesson: its state, opening it, making a new one — the same everywhere ---------- */
  // the studio, in a window of the desktop (or a new tab when there is none)
  K.studioUrl = (id, part = "script", org = "") => `/studio${org ? "?org=" + encodeURIComponent(org) : ""}#${part}/${id}`;
  K.openStudio = (id, part, org) => { const url = K.studioUrl(id, part, org); if (K.embed && window.LAPPFrame) LAPPFrame.up({ t: "open", url }); else window.open(url, "_blank"); };
  // the one "New lesson" form. o: create(values) → the lesson · pre { course, level, type, topic } · chars [{ id, name, emoji, bio }] · after(lesson)
  K.newLesson = (o = {}) => {
    const pre = o.pre || {};
    return K.form("New lesson", [
      { name: "title", label: "Title (in the course language)", required: true, ph: "Am Bahnhof", attrs: 'maxlength="80"' },
      { type: "html", html: `<div class="cols2">` },
      { name: "course", label: "Language", type: "select", options: K.opt.courses(), value: pre.course || "de" },
      { name: "level", label: "Level", type: "select", options: K.opt.levels(), value: pre.level || "A1" },
      { type: "html", html: `</div><div class="cols2">` },
      { name: "type", label: "Type", type: "select", options: K.opt.types(), value: pre.type || "talk" },
      { name: "topic", label: "Topic", type: "select", options: K.opt.topics(), value: pre.topic || "daily" },
      { type: "html", html: `</div>` },
      { name: "brief", label: "What should it be about? (the AI writes from this)", type: "textarea", ph: "Buying a ticket, finding the platform, a delay… words and grammar it should practise" },
      ...(o.chars && o.chars.length ? [{ name: "characters", label: "Characters (optional)", type: "multi", options: o.chars.map(c => ({ value: String(c.id), label: c.name, icon: c.emoji, sub: c.bio })) }] : [])
    ], async v => {
      const l = await o.create({ ...v, characters: (v.characters || []).map(Number) });
      K.toast("Lesson created");
      if (o.after) o.after(l); else K.openStudio(l.id, "script", o.org);
    }, "Create lesson");
  };

  /* ---------- a lesson's state, the same everywhere ---------- */
  K.lessonTone = st => ({ review: "warn", published: "ok", bin: "bad" })[st] || "";
  K.lessonState = (st, binned) => { if (binned) st = "bin"; const label = { draft: "draft", review: "in work", published: "published", bin: "in the bin" }[st] || st || ""; return `<span class="pl ${K.lessonTone(st)}">${K.esc(label)}</span>`; };

  /* ---------- toasts ---------- */
  const KIND = { ok: ["check", "rgba(52,211,153,.2)"], info: ["info", "rgba(96,165,250,.2)"], warn: ["alert", "rgba(251,191,36,.2)"], err: ["x", "rgba(248,113,113,.2)"] };
  K.KIND = KIND;
  K.toastHooks = [];   // e.g. a page inside a window passes problems up to the desktop's notifications
  K.toast = (text, o = {}) => {
    if (typeof o === "string") o = { kind: o };
    const kind = o.kind || (/^(⚠|✕|error)/i.test(String(text)) ? "err" : "ok"), [ic, bg] = KIND[kind] || KIND.info;
    K.toastHooks.forEach(f => { try { f(text, kind, o); } catch {} });
    // Settings › "Show small messages" off: only problems and messages with a button still show
    if (o.quiet || (kind !== "err" && !o.action && !o.plain && K.LS.get("lapp.theme", {}).toasts === false)) return;
    let box = K.$(".k-toasts"); if (!box) { box = document.createElement("div"); box.className = "k-toasts"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
    const t = document.createElement("div"); t.className = "k-toast"; t.setAttribute("role", kind === "err" ? "alert" : "status");
    // o.plain: words only (the learner app)
    t.innerHTML = `${o.plain ? "" : `<span class="i" style="background:${bg}">${K.I(ic, 14) || "•"}</span>`}<span class="m">${K.esc(text)}</span>${o.action ? `<button class="a">${K.esc(o.action)}</button>` : ""}`;
    if (o.action) K.$(".a", t).onclick = () => { t.remove(); o.run && o.run(); };
    box.prepend(t); setTimeout(() => t.remove(), o.ms || (o.action ? 7000 : kind === "err" ? 5000 : 3400));
    return t;
  };

  /* ---------- dialogs: one look, one behaviour ---------- */
  K.closeDialogs = () => K.$$("dialog.k-dlg[open]").forEach(d => d.close());
  // the base: a modal with a form; onSubmit(form) may return an error text (or a promise of one)
  K.dialog = (html, onSubmit, o = {}) => new Promise(res => {
    const d = document.createElement("dialog"); d.className = "k-dlg" + (o.wide ? " wide" : "");
    d.innerHTML = `<form method="dialog">${html}</form>`;
    document.body.append(d);
    const f = K.$("form", d);
    f.onsubmit = async e => {
      if (e.submitter && e.submitter.value === "cancel") return;
      e.preventDefault();
      const ok = K.$("button[value=ok]", f); if (ok) ok.disabled = true;
      try { const err = onSubmit ? await onSubmit(f) : null; if (err) { const el = K.$(".err", d); if (el) el.textContent = err; return; } d.dataset.ok = 1; d.close(); }
      catch (x) { const el = K.$(".err", d); if (el) el.textContent = x.message; }
      finally { if (ok) ok.disabled = false; }
    };
    d.addEventListener("close", () => { const ok = !!d.dataset.ok; const v = f.elements.v ? f.elements.v.value : true; d.remove(); res(ok ? v : null); });
    d.showModal();
    if (o.ready) o.ready(f, d);
    (K.$("[autofocus]", f) || f.elements.v || K.$("input:not([type=hidden]),textarea,l-select", f) || K.$("button[value=ok]", f))?.focus();
  });
  const btns = (ok, danger) => `<div class="err" role="alert"></div><div class="k-acts"><button class="b" value="cancel" formnovalidate>Cancel</button><button class="b ${danger ? "d" : "pr"}" value="ok">${K.esc(ok || "OK")}</button></div>`;
  // one value: K.ask({ title, text, label, value, placeholder, ok, type, validate }) or K.ask(title, value)
  K.ask = (o, value) => {
    if (typeof o === "string") o = { title: o, value };
    return K.dialog(`<h3>${K.esc(o.title)}</h3>${o.text ? `<p class="mu">${K.esc(o.text)}</p>` : ""}
      <label class="k-lbl">${K.esc(o.label || "")}<input class="in" name="v" type="${K.esc(o.type || "text")}" value="${K.esc(o.value ?? "")}" placeholder="${K.esc(o.placeholder || "")}" maxlength="${o.max || 200}" autocomplete="off"></label>${btns(o.ok)}`,
      f => { const v = f.elements.v.value.trim(); return !v ? "Please fill this in." : o.validate ? o.validate(v) : ""; }).then(v => v == null ? null : String(v).trim());
  };
  // yes or no: K.confirm({ title, text, ok, danger, type: "a word the person must type" })
  K.confirm = async o => {
    if (typeof o === "string") o = { title: o };
    const v = await K.dialog(`<h3 class="${o.danger ? "dz" : ""}">${K.esc(o.title)}</h3>${o.text ? `<p class="mu">${K.esc(o.text)}</p>` : ""}
      ${o.type ? `<label class="k-lbl">Type <b>${K.esc(o.type)}</b> to confirm<input class="in" name="v" autocomplete="off"></label>` : ""}${btns(o.ok, o.danger)}`,
      f => o.type && f.elements.v.value.trim().toLowerCase() !== String(o.type).toLowerCase() ? `Type “${o.type}” exactly.` : "");
    return v !== null;
  };
  // a form: fields as HTML, or as a list [{ name, label, type: text|number|email|date|datetime-local|textarea|select|multi|checks|html, value, options, required, ph, search, attrs }]
  // submit(values, form) may throw: the error shows in the dialog and it stays open. Resolves true when saved.
  K.form = (title, fields, submit, okLabel = "Save", o = {}) => {
    const list = Array.isArray(fields) ? fields : null;
    const body = list ? list.map(x => {
      const id = "f_" + x.name;
      if (x.type === "html") return x.html;
      if (x.type === "select" || x.type === "multi") return `<div class="f"><label for="${id}">${K.esc(x.label)}</label><l-select id="${id}" name="${x.name}" ${x.type === "multi" ? "multiple" : ""} ${x.search ? "search" : ""} placeholder="${K.esc(x.ph || (x.type === "multi" ? "Choose…" : "Choose one"))}" ${x.required ? "required" : ""}></l-select></div>`;
      if (x.type === "date" || x.type === "datetime-local") return `<div class="f"><label for="${id}">${K.esc(x.label)}</label><l-date id="${id}" name="${x.name}" type="${x.type === "date" ? "date" : "datetime"}" value="${K.esc(x.value || "")}" ${x.required ? "required" : ""}></l-date></div>`;
      if (x.type === "checks") return `<div class="f"><label>${K.esc(x.label)}</label><div class="checks">${x.options.map(([v, l]) => `<label><input type="checkbox" name="${x.name}" value="${K.esc(v)}" ${(x.value || []).map(String).includes(String(v)) ? "checked" : ""}> ${K.esc(l)}</label>`).join("") || `<span class="mu">Nothing to choose yet</span>`}</div></div>`;
      if (x.type === "textarea") return `<div class="f"><label for="${id}">${K.esc(x.label)}</label><textarea class="in" id="${id}" name="${x.name}" placeholder="${K.esc(x.ph || "")}">${K.esc(x.value || "")}</textarea></div>`;
      return `<div class="f"><label for="${id}">${K.esc(x.label)}</label><input class="in" id="${id}" name="${x.name}" type="${x.type || "text"}" value="${K.esc(x.value ?? "")}" placeholder="${K.esc(x.ph || "")}" ${x.required ? "required" : ""} ${x.attrs || ""}></div>`;
    }).join("") : fields;
    return K.dialog(`<h3>${K.esc(title)}</h3>${body}${btns(okLabel)}`, async f => {
      let v;
      if (list) { v = {}; const fd = new FormData(f); for (const x of list) if (x.name) v[x.name] = x.type === "checks" || x.type === "multi" ? fd.getAll(x.name) : (fd.get(x.name) ?? ""); }
      else v = Object.fromEntries(new FormData(f));
      await submit(v, f);
    }, { wide: o.wide, ready: f => {
      // controls with pictures and second lines get their options once they exist
      if (list) for (const x of list) if (x.type === "select" || x.type === "multi") {
        const el = f.querySelector(`#f_${x.name}`);
        el.options = x.options.map(q => Array.isArray(q) ? { value: String(q[0]), label: String(q[1]), ...(q[2] || {}) } : q);
        el.value = x.type === "multi" ? (x.value || []).map(String) : String(x.value ?? (x.options[0] ? (Array.isArray(x.options[0]) ? x.options[0][0] : x.options[0].value) : ""));
      }
      if (o.ready) o.ready(f);
    } }).then(v => v !== null);
  };
  // an l-select (ui/lapp-ui.js) gets its choices
  K.opts = (el, list, v) => { el.options = list; if (v !== undefined) el.value = v; return el; };

  /* ---------- popovers: anchored to a button ---------- */
  K.closePops = () => K.$$(".k-pop").forEach(p => { p._anchor && p._anchor.classList.remove("open"); p.remove(); });
  K.pop = (anchor, html, o = {}) => {
    K.closePops();
    const p = document.createElement("div"); p.className = "k-pop " + (o.className || ""); p.innerHTML = html; document.body.append(p);
    const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
    const above = o.above ?? (r.bottom + h + 10 > innerHeight && r.top > h);
    p.style.left = Math.max(8, Math.min((o.align === "end" ? r.right - w : r.left + r.width / 2 - w / 2), innerWidth - w - 8)) + "px";
    p.style.top = (above ? Math.max(8, r.top - h - 6) : Math.min(r.bottom + 6, innerHeight - h - 8)) + "px";
    anchor.classList.add("open"); p._anchor = anchor;
    return p;
  };
  document.addEventListener("pointerdown", e => { if (e.target.closest && !e.target.closest(".k-pop") && !K.$$(".k-pop").some(p => p._anchor && p._anchor.contains(e.target))) K.closePops(); }, true);

  /* ---------- an avatar: the photo, or the first letter on a colour ---------- */
  const GRAD = ["#FF6B9A,#8A6CF0", "#F59E0B,#EF4444", "#34D399,#22D3EE", "#22D3EE,#8B5CF6", "#8B5CF6,#FF3D7F", "#FBBF24,#34D399"];
  K.avatar = (u, size = 30, cls = "") => {
    if (!u) return "";
    const a = u.avatar, n = (u.name || u.username || "?").charAt(0).toUpperCase();
    return a ? `<span class="k-av ${cls}" style="width:${size}px;height:${size}px;background-image:url('${K.esc(a)}')"></span>`
      : `<span class="k-av ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .43)}px;background:linear-gradient(135deg,${GRAD[(u.id || 0) % GRAD.length]})">${K.esc(n)}</span>`;
  };

  /* ---------- the browser's voice: a quick listen before the real audio exists ---------- */
  const SPEECH = { de: "de-DE", nl: "nl-NL", pl: "pl-PL", en: "en-GB", fa: "fa-IR", ru: "ru-RU", uk: "uk-UA" };
  K.speak = (text, o = {}) => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = SPEECH[o.lang] || o.lang || "de-DE";
      const v = speechSynthesis.getVoices().find(x => x.lang.startsWith(u.lang.slice(0, 2))); if (v) u.voice = v;   // a voice of that language, when the device has one
      u.rate = o.rate || 1; u.pitch = o.pitch || 1; if (o.volume != null) u.volume = o.volume;
      if (o.onend) u.onend = o.onend;
      if (o.onerror) u.onerror = o.onerror;
      speechSynthesis.speak(u); return true;
    } catch { K.toast("This browser cannot speak", { kind: "warn" }); return false; }
  };
  K.stopSpeaking = () => { try { speechSynthesis.cancel(); } catch {} };

  /* ---------- dragging: K.drag(pointerdownEvent, { move(dx, dy, e), end(e, moved), threshold }) ---------- */
  // threshold: how far (px) the pointer must go before it counts as a drag (a click stays a click)
  K.drag = (e, o) => {
    const sx = e.clientX, sy = e.clientY, th = o.threshold || 0; let on = !th;
    if (on) document.body.classList.add("dragging");
    const mv = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!on) { if (Math.abs(dx) + Math.abs(dy) < th) return; on = true; document.body.classList.add("dragging"); } o.move && o.move(dx, dy, ev); };
    const up = ev => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); document.body.classList.remove("dragging"); o.end && o.end(ev, on); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  };

  /* ---------- files: put files from the computer into the person's files ---------- */
  // one file to the server (the same headers everywhere: X-Name, Content-Type, X-Folder). o: api, path, name, folder
  K.sendFile = (f, o = {}) => (o.api || K.api)("POST", o.path || "/desk/files", null, { headers: { "Content-Type": f.type || "application/octet-stream", "X-Name": encodeURIComponent(o.name || f.name || "file"), ...(o.folder ? { "X-Folder": String(o.folder) } : {}) }, body: f });
  // o: folder · max · before(file) → a value handed to each/failed (e.g. a placeholder) · each(saved, file, value) · failed(file, error, value)
  K.upload = async (files, o = {}) => {
    const out = [];
    for (const f of [...files].slice(0, o.max || 20)) {
      if (f.size > 10e6) { K.toast(`${f.name}: files can be up to 10 MB`, { kind: "err" }); continue; }
      const v = o.before ? o.before(f) : null;
      try { const r = await K.sendFile(f, { folder: o.folder }); out.push(r); if (o.each) o.each(r, f, v); }
      catch (x) { K.toast(`${f.name}: ${x.message}`, { kind: "err" }); if (o.failed) o.failed(f, x, v); }
    }
    return out;
  };

  // a sheet over the learner app (its look: .ac-sheet / .ac-card in style.css); a click outside or on ✕ closes it
  K.sheet = (html, o = {}) => {
    let el = K.$("#kSheet");
    if (!el) { el = document.createElement("div"); el.id = "kSheet"; el.className = "ac-sheet"; document.body.append(el); el.addEventListener("click", e => { if (e.target === el || e.target.closest("[data-sh=close]")) el.hidden = true; }); }
    el.onclick = null;   // each sheet sets its own
    el.innerHTML = `<div class="ac-card ${o.cls || ""}" dir="${o.dir || "ltr"}"><button type="button" class="ac-x" data-sh="close" aria-label="${K.esc(o.close || "Close")}">✕</button>${html}</div>`;
    el.hidden = false;
    return el;
  };

  /* ---------- the microphone: const r = await K.record({ max: 120 }); r.level() 0…1; const { blob, dur } = await r.stop() ---------- */
  K.record = async (o = {}) => {
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error("This browser can't record");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const chunks = [], rec = new MediaRecorder(stream), t0 = Date.now();
    let ctx = null, an = null, buf = null;
    try { ctx = new AudioContext(); an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an); buf = new Uint8Array(an.fftSize); } catch {}
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); if (ctx) ctx.close().catch(() => {}); res({ blob: new Blob(chunks, { type: rec.mimeType || "audio/webm" }), dur: (Date.now() - t0) / 1000 }); }; });
    rec.start();
    const cap = setTimeout(() => rec.state === "recording" && rec.stop(), (o.max || 120) * 1000);
    return {
      done, get secs() { return (Date.now() - t0) / 1000; }, get on() { return rec.state === "recording"; },
      level() { if (!an) return 0; an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); return m / 128; },
      stop() { clearTimeout(cap); if (rec.state === "recording") rec.stop(); return done; }
    };
  };

  // sign out, everywhere the same
  K.signOut = () => K.api("POST", "/auth/logout").catch(() => {}).finally(() => { location.href = "/"; });

  /* ---------- pages of the work desktop: opened on their own, they go into it ---------- */
  K.inDesk = () => { if (!K.embed) { location.replace("/manage#open=" + encodeURIComponent(location.pathname + location.search + location.hash)); return false; } return true; };

  // <html data-desk>: this page belongs in the work desktop
  if (document.documentElement.hasAttribute("data-desk")) K.inDesk();

  // inside a window, problems also go to the desktop's notifications
  if (K.embed) K.toastHooks.push((text, kind) => { if (kind !== "ok" && window.LAPPFrame) LAPPFrame.up({ t: "note", text: String(text), kind }); });
})();
