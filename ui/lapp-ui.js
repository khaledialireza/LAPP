// LAPP UI — form controls used everywhere instead of the browser's own <select> and date inputs.
//
//   <l-select name="role" value="student" placeholder="Choose…" [multiple] [search]></l-select>
//     el.options = [{ value, label, sub?, img?, icon?, font?, disabled? }, …]
//     or child <option value data-sub data-img data-icon data-font>Label</option>
//     · a picture or an emoji in front of each row, a font per row, a second line (sub)
//     · a search box of its own (always with [search], or by itself from 8 options on)
//     · [multiple]: chips, several values
//   <l-date name="due" type="date|datetime" value="2026-11-11" [min] [max]></l-date>
//     · its own calendar; value is "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" (local time)
// Both take part in forms like real inputs (FormData, required, reset) and fire "change".
// Colours come from the page: --ui-surface, --ui-surface-2, --ui-line, --ui-text, --ui-muted,
// --ui-accent, --ui-radius (dark defaults below).
(() => {
  if (window.customElements && customElements.get("l-select")) return;
  const esc = K.esc;   // needs /ui/kit.js first

  const css = `
  l-select>option{display:none}.lu-cal-h{direction:ltr}l-select,l-date{display:block;position:relative;min-width:0;font:inherit}
  .lu-field{width:100%;display:flex;align-items:center;gap:8px;min-height:42px;padding:6px 10px 6px 11px;border-radius:var(--ui-radius,10px);
    background:var(--ui-surface-2,#1C1C29);border:1px solid var(--ui-line,rgba(255,255,255,.14));color:var(--ui-text,#F4F4F8);cursor:pointer;text-align:start;font:inherit}
  .lu-field:focus-visible,l-select[open] .lu-field,l-date[open] .lu-field{outline:none;border-color:var(--ui-accent,#8B5CF6);box-shadow:0 0 0 3px color-mix(in srgb,var(--ui-accent,#8B5CF6) 22%,transparent)}
  .lu-field[aria-disabled=true]{opacity:.5;cursor:default}
  .lu-val{flex:1;min-width:0;display:flex;align-items:center;gap:8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .lu-ph{color:var(--ui-muted,rgba(235,235,245,.5))}
  .lu-chev{flex:none;opacity:.6;font-size:11px;transition:transform .15s}l-select[open] .lu-chev{transform:rotate(180deg)}
  .lu-pic{width:24px;height:24px;border-radius:7px;object-fit:cover;flex:none;display:grid;place-items:center;font-size:16px;line-height:1}
  .lu-chips{display:flex;flex-wrap:wrap;gap:4px}.lu-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 4px 2px 8px;border-radius:99px;font-size:12.5px;
    background:color-mix(in srgb,var(--ui-accent,#8B5CF6) 22%,transparent)}.lu-chip button{border:0;background:none;color:inherit;cursor:pointer;font-size:12px;opacity:.7;padding:0 3px}
  .lu-pop{position:fixed;z-index:1000;min-width:220px;max-height:min(360px,60vh);display:flex;flex-direction:column;border-radius:calc(var(--ui-radius,10px) + 2px);
    background:var(--ui-surface,#15151F);border:1px solid var(--ui-line,rgba(255,255,255,.14));color:var(--ui-text,#F4F4F8);box-shadow:0 18px 50px rgba(0,0,0,.35);overflow:hidden}
  .lu-search{margin:8px;padding:8px 10px;border-radius:8px;border:1px solid var(--ui-line,rgba(255,255,255,.14));background:var(--ui-surface-2,#1C1C29);color:inherit;font:inherit;outline:none}
  .lu-search:focus{border-color:var(--ui-accent,#8B5CF6)}
  .lu-list{overflow:auto;padding:4px;display:flex;flex-direction:column;gap:2px}
  .lu-opt{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;text-align:start;border:0;background:none;color:inherit;font:inherit;width:100%}
  .lu-opt:hover,.lu-opt.on{background:color-mix(in srgb,var(--ui-text,#fff) 8%,transparent)}
  .lu-opt[aria-selected=true]{background:color-mix(in srgb,var(--ui-accent,#8B5CF6) 22%,transparent)}
  .lu-opt[aria-disabled=true]{opacity:.4;cursor:default}
  .lu-opt .lu-t{flex:1;min-width:0}.lu-opt .lu-t b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis}.lu-opt .lu-t small{display:block;color:var(--ui-muted,rgba(235,235,245,.55));font-size:12px}
  .lu-tick{width:18px;flex:none;text-align:center;color:var(--ui-accent,#8B5CF6);font-weight:800}
  .lu-none{padding:14px;text-align:center;color:var(--ui-muted,rgba(235,235,245,.55));font-size:13px}
  .lu-cal{padding:10px;width:290px}.lu-cal-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
  .lu-cal-h b{font-weight:700}.lu-nav{border:0;background:none;color:inherit;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px}.lu-nav:hover{background:color-mix(in srgb,var(--ui-text,#fff) 8%,transparent)}
  .lu-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}.lu-grid span{font-size:11px;color:var(--ui-muted,rgba(235,235,245,.5));padding:4px 0}
  .lu-day{border:0;background:none;color:inherit;height:34px;border-radius:8px;cursor:pointer;font:inherit;font-variant-numeric:tabular-nums}
  .lu-day:hover{background:color-mix(in srgb,var(--ui-text,#fff) 8%,transparent)}.lu-day.out{opacity:.35}.lu-day.today{box-shadow:inset 0 0 0 1px var(--ui-accent,#8B5CF6)}
  .lu-day.sel{background:var(--ui-accent,#8B5CF6);color:#fff}.lu-day:disabled{opacity:.2;cursor:default}
  .lu-time{display:flex;gap:6px;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--ui-line,rgba(255,255,255,.12))}
  .lu-time input{flex:1;width:0;text-align:center;padding:6px;border-radius:8px;background:var(--ui-surface-2,#1C1C29);color:inherit;border:1px solid var(--ui-line,rgba(255,255,255,.14));font:inherit}
  .lu-foot{display:flex;justify-content:space-between;margin-top:8px}.lu-foot button{border:0;background:none;color:var(--ui-accent,#8B5CF6);font:inherit;font-weight:700;cursor:pointer;padding:4px 6px}`;
  const style = document.createElement("style"); style.textContent = css; document.head.append(style);

  // one open popup at a time; it follows its field and closes on outside click / Escape
  let openOne = null;
  function place(pop, field) {
    const r = field.getBoundingClientRect(), vh = innerHeight, vw = innerWidth;
    pop.style.minWidth = Math.max(220, r.width) + "px";
    const h = pop.offsetHeight, w = pop.offsetWidth;
    const below = r.bottom + 6 + h <= vh || r.top < h;
    pop.style.top = (below ? Math.min(r.bottom + 6, vh - h - 8) : r.top - h - 6) + "px";
    const rtl = getComputedStyle(field).direction === "rtl";
    pop.style.left = Math.max(8, Math.min(rtl ? r.right - w : r.left, vw - w - 8)) + "px";
  }
  document.addEventListener("pointerdown", e => { if (openOne && !openOne.contains(e.target) && !openOne._pop.contains(e.target)) openOne.close(); }, true);
  addEventListener("resize", () => openOne && openOne.close());
  document.addEventListener("scroll", e => { if (openOne && !openOne._pop.contains(e.target)) place(openOne._pop, openOne._field); }, true);

  class Base extends HTMLElement {
    static formAssociated = true;
    constructor() { super(); this._i = this.attachInternals ? this.attachInternals() : null; }
    get form() { return this._i && this._i.form; }
    get name() { return this.getAttribute("name"); }
    get required() { return this.hasAttribute("required"); }
    get disabled() { return this.hasAttribute("disabled"); }
    close() {
      if (!this._pop) return;
      this._pop.remove(); this._pop = null; this.removeAttribute("open");
      if (openOne === this) openOne = null;
    }
    popup(html) {
      if (openOne && openOne !== this) openOne.close();
      const pop = document.createElement("div"); pop.className = "lu-pop"; pop.innerHTML = html;
      // inside a <dialog> the popup must live in the dialog (top layer)
      (this.closest("dialog") || document.body).append(pop);
      this._pop = pop; openOne = this; this.setAttribute("open", "");
      place(pop, this._field);
      pop.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.close(); this._field.focus(); } });
      return pop;
    }
    formResetCallback() { this.value = this.getAttribute("value") || ""; }
    emit() { this.dispatchEvent(new Event("input", { bubbles: true })); this.dispatchEvent(new Event("change", { bubbles: true })); }
  }

  /* ---------------- l-select ---------------- */
  class LSelect extends Base {
    static get observedAttributes() { return ["disabled"]; }
    connectedCallback() {
      if (this._ready) return;
      // written in the page itself: the <option> children are not parsed yet, so wait for them
      if (!this._options && document.readyState === "loading") { document.addEventListener("DOMContentLoaded", () => this.isConnected && this.connectedCallback(), { once: true }); return; }
      this._ready = true;
      if (!this._options) this._options = [...this.querySelectorAll("option")].map(o => ({ value: o.value, label: o.textContent.trim(), sub: o.dataset.sub, img: o.dataset.img, icon: o.dataset.icon, font: o.dataset.font, disabled: o.disabled }));
      // the chosen value: the value="…" attribute, or the <option selected> children
      const sel = [...this.querySelectorAll("option[selected]")].map(o => o.value).join(this.multiple ? "," : "");
      if (this._values === undefined) this._values = (this.getAttribute("value") ?? sel ?? "").split(this.multiple ? "," : "\u0000").filter(v => v !== "");
      this.innerHTML = `<button type="button" class="lu-field" role="combobox" aria-haspopup="listbox" aria-expanded="false"><span class="lu-val"></span><span class="lu-chev">▼</span></button>`;
      this._field = this.firstChild;
      if (this.getAttribute("aria-label")) this._field.setAttribute("aria-label", this.getAttribute("aria-label"));
      if (this.id) { const l = document.querySelector(`label[for="${CSS.escape(this.id)}"]`); if (l) l.onclick = e => { e.preventDefault(); this._field.focus(); }; }
      this._field.addEventListener("click", e => { if (e.target.closest(".lu-chip button")) return; this._pop ? this.close() : this.open(); });
      this._field.addEventListener("keydown", e => { if (["ArrowDown", "Enter", " "].includes(e.key) && !this._pop) { e.preventDefault(); this.open(); } });
      this.render();
    }
    attributeChangedCallback() { if (this._field) this._field.setAttribute("aria-disabled", this.disabled); }
    get multiple() { return this.hasAttribute("multiple"); }
    get options() { return this._options || []; }
    set options(list) { this._options = (list || []).map(o => Array.isArray(o) ? { value: String(o[0]), label: String(o[1]) } : { ...o, value: String(o.value) }); if (this._ready) this.render(); }
    get value() { return this.multiple ? this._values.join(",") : (this._values[0] || ""); }
    set value(v) { this._values = (Array.isArray(v) ? v.map(String) : String(v ?? "").split(this.multiple ? "," : "\u0000")).filter(x => x !== ""); if (this._ready) this.render(); }
    get values() { return [...this._values]; }
    pic(o) { return o.img ? `<img class="lu-pic" src="${esc(o.img)}" alt="">` : o.icon ? `<span class="lu-pic">${esc(o.icon)}</span>` : ""; }
    render() {
      const chosen = this._values.map(v => this.options.find(o => o.value === v)).filter(Boolean);
      const ph = `<span class="lu-ph">${esc(this.getAttribute("placeholder") || "Choose…")}</span>`;
      this.querySelector(".lu-val").innerHTML = !chosen.length ? ph : this.multiple
        ? `<span class="lu-chips">${chosen.map(o => `<span class="lu-chip">${esc(o.label)}<button type="button" data-x="${esc(o.value)}" aria-label="Remove">✕</button></span>`).join("")}</span>`
        : `${this.pic(chosen[0])}<span style="${chosen[0].font ? `font-family:${esc(chosen[0].font)}` : ""};overflow:hidden;text-overflow:ellipsis">${esc(chosen[0].label)}</span>`;
      this.querySelectorAll(".lu-chip button").forEach(b => b.onclick = e => { e.stopPropagation(); this._values = this._values.filter(v => v !== b.dataset.x); this.render(); this.emit(); });
      this._field.setAttribute("aria-disabled", this.disabled);
      if (this._i) {
        if (this.multiple) { const fd = new FormData(); this._values.forEach(v => fd.append(this.name || "v", v)); this._i.setFormValue(fd); }
        else this._i.setFormValue(this.value);
        this._i.setValidity(this.required && !this._values.length ? { valueMissing: true } : {}, "Please choose one", this._field);
      }
    }
    open() {
      if (this.disabled) return;
      const many = this.hasAttribute("search") || this.options.length >= 8;
      const pop = this.popup(`${many ? `<input class="lu-search" placeholder="Search…" aria-label="Search">` : ""}<div class="lu-list" role="listbox" ${this.multiple ? 'aria-multiselectable="true"' : ""}></div>`);
      this._field.setAttribute("aria-expanded", "true");
      const list = pop.querySelector(".lu-list"), q = pop.querySelector(".lu-search");
      let shown = [], act = 0;
      const draw = () => {
        const t = (q ? q.value : "").trim().toLowerCase();
        shown = this.options.filter(o => !t || (o.label + " " + (o.sub || "")).toLowerCase().includes(t));
        list.innerHTML = shown.map((o, i) => `<button type="button" class="lu-opt ${i === act ? "on" : ""}" role="option" data-i="${i}" aria-selected="${this._values.includes(o.value)}" aria-disabled="${!!o.disabled}">
          ${this.multiple ? `<span class="lu-tick">${this._values.includes(o.value) ? "✓" : ""}</span>` : ""}${this.pic(o)}
          <span class="lu-t"><b style="${o.font ? `font-family:${esc(o.font)}` : ""}">${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>${!this.multiple && this._values.includes(o.value) ? `<span class="lu-tick">✓</span>` : ""}</button>`).join("") || `<div class="lu-none">Nothing found</div>`;
        place(pop, this._field);
      };
      const pick = i => {
        const o = shown[i]; if (!o || o.disabled) return;
        if (this.multiple) { this._values = this._values.includes(o.value) ? this._values.filter(v => v !== o.value) : [...this._values, o.value]; this.render(); this.emit(); act = i; draw(); }
        else { this._values = [o.value]; this.render(); this.emit(); this.close(); this._field.focus(); }
      };
      list.addEventListener("click", e => { const b = e.target.closest(".lu-opt"); if (b) pick(Number(b.dataset.i)); });
      pop.addEventListener("keydown", e => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); act = Math.max(0, Math.min(shown.length - 1, act + (e.key === "ArrowDown" ? 1 : -1))); draw(); const el = list.querySelector(".on"); el && el.scrollIntoView({ block: "nearest" }); if (!q) el && el.focus(); }
        if (e.key === "Enter") { e.preventDefault(); pick(act); }
        if (e.key === "Tab") this.close();
      });
      if (q) q.addEventListener("input", () => { act = 0; draw(); });
      const cur = this.options.findIndex(o => o.value === this._values[0]); act = cur > 0 ? cur : 0;
      draw();
      setTimeout(() => (q || list.querySelector(".on") || list.querySelector(".lu-opt"))?.focus(), 0);
    }
    close() { super.close(); this._field && this._field.setAttribute("aria-expanded", "false"); }
  }

  /* ---------------- l-date ---------------- */
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  class LDate extends Base {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      this._v = this._v ?? (this.getAttribute("value") || "");
      this.innerHTML = `<button type="button" class="lu-field" aria-haspopup="dialog"><span class="lu-pic">📅</span><span class="lu-val"></span><span class="lu-chev">▼</span></button>`;
      this._field = this.firstChild;
      if (this.id) { const l = document.querySelector(`label[for="${CSS.escape(this.id)}"]`); if (l) l.onclick = e => { e.preventDefault(); this._field.focus(); }; }
      this._field.addEventListener("click", () => this._pop ? this.close() : this.open());
      this.render();
    }
    get withTime() { return this.getAttribute("type") === "datetime"; }
    get value() { return this._v || ""; }
    set value(v) { this._v = v || ""; if (this._ready) this.render(); }
    get valueAsNumber() { return this._v ? new Date(this.withTime ? this._v : this._v + "T00:00").getTime() : NaN; }
    render() {
      const v = this._v;
      let txt = `<span class="lu-ph">${esc(this.getAttribute("placeholder") || (this.withTime ? "Pick a day and time" : "Pick a day"))}</span>`;
      if (v) { const d = new Date(this.withTime ? v : v + "T12:00"); txt = d.toLocaleDateString(K.loc(), { weekday: "short", day: "numeric", month: "short", year: "numeric" }) + (this.withTime ? " · " + v.slice(11, 16) : ""); }
      this.querySelector(".lu-val").innerHTML = txt;
      if (this._i) { this._i.setFormValue(v); this._i.setValidity(this.required && !v ? { valueMissing: true } : {}, "Please pick a date", this._field); }
    }
    open() {
      if (this.disabled) return;
      const v = this._v, base = v ? new Date(this.withTime ? v : v + "T12:00") : new Date();
      let y = base.getFullYear(), m = base.getMonth();
      let hh = v && this.withTime ? v.slice(11, 13) : "09", mm = v && this.withTime ? v.slice(14, 16) : "00";
      const pop = this.popup(`<div class="lu-cal" role="dialog" aria-label="Calendar"></div>`), cal = pop.firstChild;
      const min = this.getAttribute("min"), max = this.getAttribute("max");
      const draw = () => {
        const first = new Date(y, m, 1), start = new Date(y, m, 1 - ((first.getDay() + 6) % 7)), today = ymd(new Date()), sel = v ? v.slice(0, 10) : "";
        const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
        cal.innerHTML = `<div class="lu-cal-h"><button type="button" class="lu-nav" data-n="-1" aria-label="Previous month">‹</button><b>${first.toLocaleDateString(K.loc(), { month: "long", year: "numeric" })}</b><button type="button" class="lu-nav" data-n="1" aria-label="Next month">›</button></div>
          <div class="lu-grid">${Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(K.loc(), { weekday: /^fa/.test(window.PanelI18N ? PanelI18N.locale : "") ? "narrow" : "short" })).map(d => /^[A-Za-z]/.test(d) ? d.slice(0, 2) : d).map(d => `<span>${d}</span>`).join("")}${days.map(d => { const k = ymd(d); return `<button type="button" class="lu-day ${d.getMonth() !== m ? "out" : ""} ${k === today ? "today" : ""} ${k === sel ? "sel" : ""}" data-d="${k}" ${(min && k < min) || (max && k > max) ? "disabled" : ""}>${d.getDate()}</button>`; }).join("")}</div>
          ${this.withTime ? `<div class="lu-time"><span>🕘</span><input type="number" min="0" max="23" value="${hh}" aria-label="Hour" data-t="h">:<input type="number" min="0" max="59" step="5" value="${mm}" aria-label="Minutes" data-t="m"></div>` : ""}
          <div class="lu-foot"><button type="button" data-a="today">Today</button>${this.required ? "" : `<button type="button" data-a="clear">Clear</button>`}</div>`;
        place(pop, this._field);
      };
      const set = day => { this._v = this.withTime ? `${day}T${hh}:${mm}` : day; this.render(); this.emit(); };
      cal.addEventListener("click", e => {
        const n = e.target.closest("[data-n]"); if (n) { m += Number(n.dataset.n); if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); return; }
        const d = e.target.closest("[data-d]"); if (d && !d.disabled) { set(d.dataset.d); if (!this.withTime) { this.close(); this._field.focus(); } else draw(); return; }
        const a = e.target.closest("[data-a]"); if (a) { if (a.dataset.a === "clear") { this._v = ""; this.render(); this.emit(); this.close(); } else { const t = new Date(); y = t.getFullYear(); m = t.getMonth(); set(ymd(t)); if (!this.withTime) this.close(); else draw(); } }
      });
      cal.addEventListener("change", e => { const t = e.target.dataset.t; if (!t) return; const n = pad(Math.max(0, Math.min(t === "h" ? 23 : 59, Number(e.target.value) || 0))); e.target.value = n; if (t === "h") hh = n; else mm = n; set((this._v || ymd(new Date())).slice(0, 10)); });
      draw();
      setTimeout(() => (cal.querySelector(".lu-day.sel") || cal.querySelector(".lu-day.today") || cal.querySelector(".lu-day"))?.focus(), 0);
    }
  }
  customElements.define("l-select", LSelect);
  customElements.define("l-date", LDate);
})();
