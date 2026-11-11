// AI for the studio, from any provider the admin sets up in /admin → AI.
//
//   workers     LAPP AI, built in: an open-source model on our own Cloudflare account (binding AI).
//               No key and no outside AI company; the default.
//   openai      GPT (api.openai.com)
//   gemini      Google Gemini
//   anthropic   Claude
//   compatible  anything that speaks the OpenAI chat API: a model on our own server (Ollama, vLLM,
//               LM Studio), DeepSeek, Mistral, Groq, OpenRouter, Together…
//
// Providers live in D1 (ai_providers); which one a task uses is the setting "ai"
// ({ default: id, tasks: { write: id, … } }). Keys never leave the server: the admin page
// sees only their last 4 characters.
//
// Every task asks for JSON: the prompt carries an example of the shape, the answer is read
// leniently (code fences, text around it) and checked; one retry if it isn't usable.
import { str, fail } from "./util.js";

export const KINDS = {
  workers: { name: "LAPP AI (built in)", key: false, url: "", models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/google/gemma-3-12b-it", "@cf/mistralai/mistral-small-3.1-24b-instruct", "@cf/qwen/qwq-32b", "@cf/meta/llama-4-scout-17b-16e-instruct"] },
  openai: { name: "OpenAI GPT", key: true, url: "https://api.openai.com/v1", models: ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o"] },
  gemini: { name: "Google Gemini", key: true, url: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"] },
  anthropic: { name: "Anthropic Claude", key: true, url: "https://api.anthropic.com/v1", models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] },
  compatible: { name: "Other (OpenAI-compatible)", key: false, url: "http://localhost:11434/v1", models: ["llama3.3", "qwen2.5", "deepseek-chat", "mistral-large-latest"] }
};
export const TASKS = { write: "Write a lesson", translate: "Translate", rewrite: "Rewrite a line", check: "Check the level", plan: "Plan a series", assist: "Assistant in the panel" };


/* ================= which provider ================= */
export async function setting(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'ai'").first();
  const v = r ? JSON.parse(r.value) : {};
  return { default: v.default || 1, tasks: v.tasks || {} };
}
export async function providerFor(env, task) {
  const s = await setting(env);
  const id = s.tasks[task] || s.default;
  let p = await env.DB.prepare("SELECT * FROM ai_providers WHERE id = ? AND enabled = 1").bind(id).first();
  // a removed or switched-off choice falls back to the built-in one
  if (!p) p = await env.DB.prepare("SELECT * FROM ai_providers WHERE kind = 'workers' AND enabled = 1 ORDER BY id LIMIT 1").first();
  if (!p) throw fail("no AI is switched on — see /admin → AI", 503, { code: "noai" });
  if (p.kind === "workers" && !env.AI) throw fail("the built-in AI is not available here (Workers AI binding)", 503, { code: "noai" });
  if (KINDS[p.kind].key && !p.api_key) throw fail(`${p.name} has no key yet — see /admin → AI`, 503, { code: "noai" });
  return p;
}
export async function available(env) {
  try { await providerFor(env, "write"); return true; } catch { return false; }
}

/* ================= the JSON we ask for ================= */
// an example of the shape, from a JSON schema: what models follow best
function example(s) {
  if (!s) return null;
  if (s.enum) return s.enum.join(" | ");
  if (s.type === "object") return Object.fromEntries(Object.entries(s.properties || {}).map(([k, v]) => [k, example(v)]));
  if (s.type === "array") return [example(s.items)];
  if (s.type === "integer" || s.type === "number") return 0;
  if (s.type === "boolean") return false;
  return "…";
}
const SYSTEM = "You are a careful writer and teacher of languages. You answer with one JSON object only: no text before or after it, no code fences.";
function wrap(prompt, schema) {
  return `${prompt}\n\nAnswer with JSON only, in exactly this shape (replace "…" and 0 with real values; arrays may hold as many items as needed):\n${JSON.stringify(example(schema))}`;
}
// the first {...} in a text, read leniently
export function readJSON(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no JSON in the answer");
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch {}
  // trailing commas and smart quotes are the usual small mistakes
  return JSON.parse(t.replace(/,\s*([}\]])/g, "$1").replace(/[“”]/g, '"'));
}
// do the answer's keys match the schema's required ones (top level and one level down)?
function fits(v, s) {
  if (!s || s.type !== "object") return true;
  if (!v || typeof v !== "object") return false;
  return (s.required || []).every(k => k in v && (s.properties[k].type !== "array" || Array.isArray(v[k])));
}

/* ================= one request ================= */
async function call(env, p, { prompt, max, stream, onText }) {
  const model = p.model;
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }];
  let r;
  if (p.kind === "workers") {
    const out = await env.AI.run(model, { messages, max_tokens: Math.min(max, 8000), stream: !!stream });
    if (!stream) return typeof out.response === "string" ? out.response : JSON.stringify(out.response);
    return readSSE(new Response(out), j => j.response, onText);
  }
  if (p.kind === "openai" || p.kind === "compatible") {
    const body = { model, messages, stream: !!stream, ...(p.kind === "openai" ? { max_completion_tokens: max, response_format: { type: "json_object" } } : { max_tokens: max }) };
    r = await fetch(`${(p.base_url || KINDS[p.kind].url).replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", ...(p.api_key ? { Authorization: `Bearer ${p.api_key}` } : {}) }, body: JSON.stringify(body) });
    await ok(r, p);
    if (!stream) { const j = await r.json(); return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ""; }
    return readSSE(r, j => j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content, onText);
  }
  if (p.kind === "gemini") {
    const base = (p.base_url || KINDS.gemini.url).replace(/\/$/, "");
    const body = { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: max } };
    r = await fetch(`${base}/models/${encodeURIComponent(model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": p.api_key }, body: JSON.stringify(body) });
    await ok(r, p);
    const text = j => ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(x => x.text || "").join("");
    if (!stream) return text(await r.json());
    return readSSE(r, text, onText);
  }
  if (p.kind === "anthropic") {
    const body = { model, max_tokens: max, system: SYSTEM, messages: [{ role: "user", content: prompt }], stream: !!stream };
    r = await fetch(`${(p.base_url || KINDS.anthropic.url).replace(/\/$/, "")}/messages`, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": p.api_key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
    await ok(r, p);
    if (!stream) { const j = await r.json(); if (j.stop_reason === "refusal") throw fail("the AI declined this request", 422); return (j.content || []).filter(b => b.type === "text").map(b => b.text).join(""); }
    return readSSE(r, j => j.type === "content_block_delta" && j.delta && j.delta.text, onText);
  }
  throw fail("unknown AI kind " + p.kind, 500);
}
async function ok(r, p) {
  if (r.ok) return;
  let msg = "";
  try { const j = await r.json(); msg = (j.error && (j.error.message || j.error)) || j.message || ""; } catch {}
  throw fail(`${p.name}: ${r.status}${msg ? " — " + String(msg).slice(0, 200) : ""}`, r.status === 429 ? 429 : 502);
}
// server-sent events: "data: {…}" lines; pick the text out of each
async function readSSE(r, pick, onText) {
  const rd = r.body.getReader(), dec = new TextDecoder();
  let buf = "", all = "";
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim(); if (!d || d === "[DONE]") continue;
      let j; try { j = JSON.parse(d); } catch { continue; }
      const t = pick(j);
      if (t) { all += t; if (onText) await onText(all); }
    }
  }
  return all;
}

/* ================= what the studio uses ================= */
// a task's answer as JSON that fits the schema; streamed when onText is given
export async function ask(env, task, { prompt, schema, max = 8000, onText }) {
  const p = await providerFor(env, task);
  const full = wrap(prompt, schema);
  let last;
  for (let tries = 0; tries < 2; tries++) {
    const text = await call(env, p, { prompt: tries ? `${full}\n\nYour last answer was not usable JSON in that shape. Answer again with the JSON only.` : full, max, stream: !!onText && !tries, onText });
    try {
      const v = readJSON(text);
      if (fits(v, schema)) { env.DB.prepare("UPDATE ai_providers SET uses = uses + 1, used_at = ? WHERE id = ?").bind(Date.now(), p.id).run().catch(() => {}); return { value: v, provider: p.name }; }
      last = new Error("the answer did not have the expected parts");
    }
    catch (e) { last = e; }
  }
  throw fail(`${p.name} gave no usable answer (${last.message}) — try again, or pick another AI in /admin → AI`, 502);
}
// the admin's “Test” button
export async function test(env, p) {
  const t0 = Date.now();
  if (p.kind === "workers" && !env.AI) throw fail("the Workers AI binding is missing here", 503);
  const text = await call(env, p, { prompt: 'Translate "Guten Morgen" into English, Persian, Russian and Ukrainian. Answer as JSON: {"en":"…","fa":"…","ru":"…","uk":"…"}', max: 300 });
  return { ms: Date.now() - t0, answer: readJSON(text) };
}

/* ================= /api/admin/ai: the admin's list of AIs ================= */
export async function adminAi(req, env, H, p) {
  const M = req.method;
  await H.need(req, env, ["admin"]);
  const view = x => ({ id: x.id, name: x.name, kind: x.kind, model: x.model, base_url: x.base_url, enabled: !!x.enabled, hasKey: !!x.api_key, keyEnd: x.api_key ? x.api_key.slice(-4) : "", uses: x.uses, used_at: x.used_at });
  let m;
  if (p === "" && M === "GET") {
    const rows = (await env.DB.prepare("SELECT * FROM ai_providers ORDER BY id").all()).results;
    return H.json({ providers: rows.map(view), setting: await setting(env), kinds: KINDS, tasks: TASKS, builtin: !!env.AI });
  }
  const check = (kind, url) => {
    if (!KINDS[kind]) throw H.fail("unknown kind");
    if (url && !/^https?:\/\/[^\s]+$/.test(url)) throw H.fail("the address must start with http:// or https://");
  };
  if (p === "" && M === "POST") {
    const b = await H.body(req);
    const kind = str(b.kind, 20), url = str(b.base_url, 300);
    check(kind, url);
    const model = str(b.model, 120); if (!model) throw H.fail("which model?");
    if (KINDS[kind].key && !str(b.api_key, 400)) throw H.fail("this one needs a key");
    if (kind === "compatible" && !url) throw H.fail("give the address of the server (…/v1)");
    const r = await env.DB.prepare("INSERT INTO ai_providers (name, kind, model, base_url, api_key, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(str(b.name, 60) || KINDS[kind].name, kind, model, url, str(b.api_key, 400), Date.now()).first();
    return H.json({ id: r.id });
  }
  if ((m = p.match(/^\/(\d+)$/)) && M === "PATCH") {
    const b = await H.body(req), sets = [], vals = [];
    const x = await env.DB.prepare("SELECT * FROM ai_providers WHERE id = ?").bind(+m[1]).first();
    if (!x) throw H.fail("no such AI", 404);
    if (b.name !== undefined) { sets.push("name = ?"); vals.push(str(b.name, 60) || x.name); }
    if (b.model !== undefined) { if (!str(b.model, 120)) throw H.fail("which model?"); sets.push("model = ?"); vals.push(str(b.model, 120)); }
    if (b.base_url !== undefined) { check(x.kind, str(b.base_url, 300)); sets.push("base_url = ?"); vals.push(str(b.base_url, 300)); }
    if (b.api_key) { sets.push("api_key = ?"); vals.push(str(b.api_key, 400)); }        // empty = keep the old key
    if (b.clearKey) { sets.push("api_key = ''"); }
    if (b.enabled !== undefined) { sets.push("enabled = ?"); vals.push(b.enabled ? 1 : 0); }
    if (!sets.length) throw H.fail("nothing to change");
    await env.DB.prepare(`UPDATE ai_providers SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, x.id).run();
    return H.json({ ok: true });
  }
  if ((m = p.match(/^\/(\d+)$/)) && M === "DELETE") {
    const x = await env.DB.prepare("SELECT kind FROM ai_providers WHERE id = ?").bind(+m[1]).first();
    if (!x) throw H.fail("no such AI", 404);
    if (+m[1] === 1) throw H.fail("the built-in AI stays — switch it off instead");
    await env.DB.prepare("DELETE FROM ai_providers WHERE id = ?").bind(+m[1]).run();
    return H.json({ ok: true });
  }
  if (p === "/setting" && M === "PUT") {
    const b = await H.body(req);
    const ids = new Set((await env.DB.prepare("SELECT id FROM ai_providers").all()).results.map(r => r.id));
    const def = ids.has(+b.default) ? +b.default : 1;
    const tasks = Object.fromEntries(Object.keys(TASKS).map(k => [k, +((b.tasks || {})[k]) || 0]).filter(([, v]) => ids.has(v)));
    const value = JSON.stringify({ default: def, tasks });
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('ai', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(value).run();
    return H.json({ ok: true });
  }
  if ((m = p.match(/^\/(\d+)\/test$/)) && M === "POST") {
    const x = await env.DB.prepare("SELECT * FROM ai_providers WHERE id = ?").bind(+m[1]).first();
    if (!x) throw H.fail("no such AI", 404);
    try { return H.json({ ok: true, ...(await test(env, x)) }); }
    catch (e) { return H.json({ ok: false, error: e.message }); }
  }
  throw H.fail("not found", 404);
}
