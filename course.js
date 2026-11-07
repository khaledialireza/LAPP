// Which language is being learned: German, Dutch or Polish (content/index.json → courses).
// Asked once after sign-in or guest entry; changed later from the pill on the home screen.
// Each course keeps its own progress (COURSE.prefix in content.js); changing it restarts the app.
// A course without lessons yet is listed as "soon" and can't be chosen.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const t = (k, v) => I18N.t(k, v);
  const prefixOf = c => c.code === COURSES[0].code ? "lapp:" : `lapp:${c.code}:`;
  const words = c => { try { return (JSON.parse(localStorage.getItem(prefixOf(c) + "known")) || []).length; } catch { return 0; } };

  function row(c, sel) {
    const n = words(c);
    const sub = !c.ready ? `${t("course_" + c.code)} · ${t("crSoon")}`
      : sel === "pick" ? `${t("course_" + c.code)} · ${t("crLessons", { n: c.lessons.length })}`
      : n ? t("crWords", { n }) : t("crNotStarted");
    return `<button type="button" class="cr-it ${c.code === COURSE.code ? "on" : ""}" data-cr="${c.code}" ${c.ready ? "" : "disabled"}>
      <span><b>${esc(c.name)}</b><small>${esc(sub)}</small></span><span class="cr-code">${c.code.toUpperCase()}</span></button>`;
  }
  function choose(code) {
    try { localStorage.setItem("lapp:course", JSON.stringify(code)); } catch {}
    if (code !== COURSE.code) { location.replace(location.pathname); return true; }
    COURSE.chosen = true;
    return false;
  }

  // first time: a full page, like the sign-in
  function picker() {
    let el = $("#crPick");
    if (!el) { el = document.createElement("div"); el.id = "crPick"; el.className = "cr-page"; document.body.append(el); }
    el.dir = I18N.info().dir;
    el.innerHTML = `<div class="cr-box"><h2>${esc(t("crTitle"))}</h2>${COURSES.map(c => row(c, "pick")).join("")}
      <button type="button" class="wc-go cr-go" id="crGo">${esc(t("acContinue"))}</button></div>`;
    el.hidden = false;
    let sel = COURSE.code;
    el.onclick = e => {
      const b = e.target.closest("[data-cr]");
      if (b && !b.disabled) { sel = b.dataset.cr; el.querySelectorAll("[data-cr]").forEach(x => x.classList.toggle("on", x === b)); }
      if (e.target.closest("#crGo") && !choose(sel)) el.hidden = true;
    };
  }
  // later: a sheet from the home pill
  function sheet() {
    let el = $("#crSheet");
    if (!el) { el = document.createElement("div"); el.id = "crSheet"; el.className = "ac-sheet"; document.body.append(el); }
    el.innerHTML = `<div class="ac-card" dir="${I18N.info().dir}"><button type="button" class="ac-x" data-crx aria-label="${esc(t("close"))}">✕</button>
      <h3 class="ac-h">${esc(t("crCourse"))}</h3>${COURSES.map(c => row(c, "switch")).join("")}<p class="wc-note">${esc(t("crOwn"))}</p></div>`;
    el.hidden = false;
    el.onclick = e => {
      if (e.target === el || e.target.closest("[data-crx]")) { el.hidden = true; return; }
      const b = e.target.closest("[data-cr]");
      if (b && !b.disabled) { if (!choose(b.dataset.cr)) el.hidden = true; }
    };
  }
  document.addEventListener("click", e => { if (e.target.closest("[data-course]")) sheet(); });
  const paint = () => document.querySelectorAll("[data-course]").forEach(b => b.textContent = COURSE.code.toUpperCase() + " ▾");

  window.Course = {
    picker, sheet, paint,
    // after sign-in or guest entry, ask once
    ask() { setTimeout(() => { if (Auth.signedIn && !COURSE.chosen && $("#welcome").hidden) picker(); }, 0); }
  };
})();
