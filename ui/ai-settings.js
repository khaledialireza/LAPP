// LAPP · the AI settings (Settings › AI, admins only): which AIs the system may use and which one does what.
// AISettings.mount(box) draws into box and keeps itself up to date.
(function () {
  const { $, esc } = K;
  const ICON = { workers: "🏠", openai: "🟢", gemini: "🔷", anthropic: "🟠", compatible: "🔌" };
  const HINT = {
    workers: "Runs on our Cloudflare account. Any model from the Workers AI catalogue (@cf/…).",
    openai: "Key from platform.openai.com → API keys.",
    gemini: "Key from aistudio.google.com → Get API key.",
    anthropic: "Key from console.anthropic.com → API keys.",
    compatible: "Any server with the OpenAI chat API (Ollama, vLLM, LM Studio, DeepSeek, Mistral, Groq, OpenRouter…). Ollama: http://<server>:11434/v1"
  };
  const ago = t => K.ago(t);
  let AIS = null, BOX = null;
  const api = (m, p, b) => K.api(m, "/admin/ai" + p, b);

  async function draw() {
    AIS = await api("GET", "");
    const { providers: P, setting: st, kinds: KK, tasks: T } = AIS;
    const opt = (v, empty) => `${empty ? `<option value="0" ${+v ? "" : "selected"}>${empty}</option>` : ""}${P.filter(x => x.enabled).map(x => `<option value="${x.id}" ${+v === x.id ? "selected" : ""}>${ICON[x.kind]} ${esc(x.name)} · ${esc(x.model)}</option>`).join("")}`;
    const keyText = x => KK[x.kind].key ? (x.hasKey ? `🔑 ••••${esc(x.keyEnd)}` : `<span style="color:var(--rd)">🔑 no key</span>`)
      : x.kind === "workers" ? (AIS.builtin ? "no key needed" : `<span style="color:var(--rd)">not available on this server</span>`) : x.hasKey ? `🔑 ••••${esc(x.keyEnd)}` : "no key";
    BOX.innerHTML = `<div class="card rows"><div class="opt"><div><b>AIs</b></div><button class="b pr" data-ai-add>＋ Add an AI</button></div>
      ${P.map(x => `<div class="opt" style="${x.enabled ? "" : "opacity:.5"}"><div style="min-width:0"><b>${ICON[x.kind]} ${esc(x.name)}</b><small style="word-break:break-all">${esc(KK[x.kind].name)} · ${esc(x.model)}${x.base_url ? " · " + esc(x.base_url) : ""}</small>
        <small>${keyText(x)} · ${x.uses} uses${x.used_at ? " · last " + ago(x.used_at) : ""}</small><small id="aiRes${x.id}"></small></div>
        <span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><button class="b" data-ai-test="${x.id}">Test</button><button class="b" data-ai-edit="${x.id}">Edit</button>
        <button class="sw ${x.enabled ? "on" : ""}" data-ai-on="${x.id}" role="switch" aria-checked="${!!x.enabled}" aria-label="On / off"></button>${x.id !== 1 ? `<button class="b d" data-ai-del="${x.id}" aria-label="Remove">✕</button>` : ""}</span></div>`).join("")}</div>
      <div class="card rows"><div class="opt"><div><b>Which AI does what</b></div></div>
        <div class="opt"><div><b>Default</b></div><select class="in" id="aiDef" style="width:260px" aria-label="Default AI">${opt(st.default)}</select></div>
        ${Object.entries(T).map(([k, label]) => `<div class="opt"><div>${esc(label)}</div><select class="in" data-ai-task="${k}" style="width:260px" aria-label="${esc(label)}">${opt(st.tasks[k] || 0, "Same as default")}</select></div>`).join("")}</div>`;
  }

  // add or edit one AI
  function dialog(x) {
    const KINDS = AIS.kinds, kinds = Object.keys(KINDS).filter(k => x || k !== "workers");
    let kind = x ? x.kind : "openai";
    const body = () => { const v = KINDS[kind];
      return `<h3>${x ? "Edit " + esc(x.name) : "Add an AI"}</h3>
      <div class="f"><label for="aiKind">Provider</label><select class="in" id="aiKind" ${x ? "disabled" : ""}>${kinds.map(k => `<option value="${k}" ${k === kind ? "selected" : ""}>${ICON[k]} ${esc(KINDS[k].name)}</option>`).join("")}</select></div>
      <div class="cols2"><div class="f"><label for="aiName">Name</label><input class="in" id="aiName" name="name" maxlength="60" value="${esc(x ? x.name : "")}"></div>
      <div class="f"><label for="aiModel">Model</label><input class="in" id="aiModel" name="model" list="aiModels" required maxlength="120" value="${esc(x ? x.model : v.models[0] || "")}"><datalist id="aiModels">${v.models.map(m => `<option value="${esc(m)}">`).join("")}</datalist></div></div>
      ${kind !== "workers" ? `<div class="f"><label for="aiUrl">Address of the server (…/v1)</label><input class="in" id="aiUrl" name="base_url" maxlength="300" placeholder="${esc(v.url || "https://…/v1")}" value="${esc(x ? x.base_url || "" : "")}"></div>
      <div class="f"><label for="aiKey">${v.key ? "API key" : "API key (if the server needs one)"}</label><input class="in" id="aiKey" name="api_key" type="password" autocomplete="off" maxlength="400" placeholder="${x && x.hasKey ? `•••• ${esc(x.keyEnd)}` : ""}"></div>` : ""}
      <p class="mu">${esc(HINT[kind])}</p><div class="err" role="alert"></div>
      <div class="k-acts"><button class="b" value="cancel" formnovalidate>Cancel</button><button class="b pr" value="ok">${x ? "Save" : "Add"}</button></div>`; };
    return K.dialog(body(), async f => {
      const v = Object.fromEntries(new FormData(f));
      if (x) await api("PATCH", `/${x.id}`, { name: v.name, model: v.model, ...(x.kind !== "workers" ? { base_url: v.base_url } : {}), api_key: v.api_key });
      else await api("POST", "", { kind, name: v.name, model: v.model, base_url: v.base_url, api_key: v.api_key });
    }, { wide: true, ready: f => f.addEventListener("change", e => { if (e.target.id === "aiKind") { kind = e.target.value; f.innerHTML = body(); } }) })
      .then(ok => { if (ok !== null) { K.toast("Saved", { kind: "ok" }); draw(); } });
  }

  async function click(e) {
    if (!BOX || !BOX.contains(e.target)) return;
    const t = e.target, d = k => { const el = t.closest(`[data-${k}]`); return el && el.dataset[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; };
    let v;
    try {
      if (t.closest("[data-ai-add]")) return dialog();
      if ((v = d("ai-edit"))) return dialog(AIS.providers.find(x => x.id === +v));
      if ((v = d("ai-on"))) { await api("PATCH", `/${v}`, { enabled: !t.closest("[data-ai-on]").classList.contains("on") }); K.toast("Saved", { kind: "ok" }); return draw(); }
      if ((v = d("ai-del"))) { const x = AIS.providers.find(p => p.id === +v); if (!await K.confirm({ title: `Remove ${x ? x.name : "this AI"}?`, ok: "Remove", danger: true })) return; await api("DELETE", `/${v}`); K.toast("Removed", { kind: "ok" }); return draw(); }
      if ((v = d("ai-test"))) {
        const out = $(`#aiRes${v}`), b = t.closest("[data-ai-test]"); out.textContent = "Testing…"; b.disabled = true;
        const r = await api("POST", `/${v}/test`); b.disabled = false;
        out.innerHTML = r.ok ? `<span style="color:var(--gr)">✓ ${(r.ms / 1000).toFixed(1)} s</span> · ${esc(Object.values(r.answer || {}).join(" · ").slice(0, 160))}` : `<span style="color:var(--rd)">✗ ${esc(r.error)}</span>`;
      }
    } catch (x) { K.toast(x.message, { kind: "err" }); }
  }
  async function change(e) {
    if (!BOX || !BOX.contains(e.target) || !e.target.matches("#aiDef, [data-ai-task]")) return;
    const tasks = Object.fromEntries([...BOX.querySelectorAll("[data-ai-task]")].map(s => [s.dataset.aiTask, +s.value]));
    try { await api("PUT", "/setting", { default: +$("#aiDef").value, tasks }); K.toast("Saved", { kind: "ok" }); } catch (x) { K.toast(x.message, { kind: "err" }); }
  }
  let wired = false;
  window.AISettings = { mount(box) { BOX = box; if (!wired) { wired = true; document.addEventListener("click", click); document.addEventListener("change", change); } draw().catch(x => { box.innerHTML = `<div class="card">${esc(x.message)}</div>`; }); } };
})();
