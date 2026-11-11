// LAPP Studio · the voice desk: a small audio studio for one lesson.
// Speech lanes (one per speaker) + tracks for music, ambience and effects. Every line keeps its takes (made by a
// voice, or recorded with the microphone); "Make audio" makes only the lines that changed and mixes the rest.
// Per line: feeling, speed, pitch, pause, how words are said, takes; per sound clip: move, cut, volume, fades,
// loop, lowered under speech. Right-click anything. Voices: Piper, Chatterbox (natural), Azure, and the
// library's designed and cloned voices. Uses the studio's helpers (S, rows, api, changed, flush, toast…) and the kit.
(function () {
  "use strict";
  const { $, $$, esc: E } = K, I = (n, s = 15) => K.I(n, s);
  const st = document.createElement("style");
  st.textContent = `.vd .trk.sp .lane{cursor:default}.vd .tracks{position:relative;overflow:auto;flex:1;min-height:0}
.clip.todo{opacity:.6;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.1) 0 6px,transparent 6px 12px)!important}
.clip .tag{position:absolute;top:5px;inset-inline-end:6px;font-size:10px;background:rgba(0,0,0,.4);border-radius:5px;padding:0 5px;display:flex;gap:3px;align-items:center}
.clip .chg{position:absolute;top:6px;inset-inline-start:22px;width:7px;height:7px;border-radius:50%;background:var(--am);box-shadow:0 0 0 2px rgba(0,0,0,.3)}
.trk.md{height:64px}.trk.md .th{gap:8px}.trk.md .th .ic{color:var(--mu)}.trk.md.off .lane{opacity:.4}
.mclip{position:absolute;top:10px;height:44px;border-radius:9px;background:linear-gradient(135deg,rgba(34,211,238,.55),rgba(139,92,246,.45));border:1px solid rgba(255,255,255,.25);font:600 11px Inter;color:#fff;padding:4px 10px;overflow:hidden;white-space:nowrap;cursor:grab;touch-action:none}
.mclip.loop{background-image:repeating-linear-gradient(90deg,transparent 0 38px,rgba(255,255,255,.18) 38px 40px),linear-gradient(135deg,rgba(34,211,238,.55),rgba(139,92,246,.45))}
.mclip.sel{box-shadow:0 0 0 2px #fff}.mclip .hd{position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize}.mclip .hd.l{left:0}.mclip .hd.r{right:0}.mclip .hd:hover{background:rgba(255,255,255,.3)}
.mclip .fi,.mclip .fo{position:absolute;top:0;bottom:0;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.45),transparent)}.mclip .fo{right:0;background:linear-gradient(270deg,rgba(0,0,0,.45),transparent)}
.trk.add{height:44px}.trk.add .th{border:0;background:none}
.vin .tk{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--ln);font-size:12.5px}.vin .tk:first-child{border:0}.vin .tk .t{flex:1;min-width:0}.vin .tk small{display:block;color:var(--mu2);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vin .tk.on{color:var(--tx)}.vin .tk.on .use{color:var(--gr)}
.vin .wd{cursor:pointer}.vin .wd.pr{border-color:var(--am);color:var(--am)}.vin .wd.now{background:var(--vi);color:#fff}
.vin label{display:block;font-size:12px;color:var(--mu);font-weight:600;margin:12px 0 5px}.vin .say{width:100%;min-height:44px}
.meter{height:8px;border-radius:4px;background:var(--p3);overflow:hidden;margin:8px 0}.meter i{display:block;height:100%;background:var(--gr);width:0;transition:width .08s}
.vread{font-size:15px;line-height:1.6;padding:10px 12px;border-radius:10px;background:var(--p3);margin:8px 0}`;
  document.head.append(st);

  const FEELS = [["", "Neutral"], ["happy", "Happy"], ["excited", "Excited"], ["polite", "Polite"], ["tired", "Tired"], ["sad", "Sad"], ["angry", "Angry"], ["whisper", "Whisper"]];
  const KINDS = { music: ["music", "Music"], ambience: ["wave", "Ambience"], effects: ["zap", "Effects"] };
  const VS = { sel: null, state: null, pos: [], total: 5, speechEnd: 5, audio: null, rec: null, pv: null, poll: null };
  const q = () => ORG ? "?org=" + encodeURIComponent(ORG) : "";
  const clipUrl = key => `/api/studio/lessons/${S.L.id}/clips/${key}${q()}`;
  const mediaUrl = id => `/api/studio/lessons/${S.L.id}/media/${id}${q()}`;
  const tracks = () => (S.L.data.tracks = S.L.data.tracks || []);
  const lst = id => VS.state && VS.state.lines.find(x => x.id === id);
  const voices = () => (S.scope.courses[S.L.course] || { voices: [] }).voices;
  const vName = id => { const v = voices().find(x => x.id === id); return v && v.name ? v.name : String(id || "").startsWith("azure:") ? id.replace(/^azure:[a-z]{2}-[A-Z]{2}-/, "").replace(/Neural$/, "") + " (Azure)" : voiceName(id); };
  const vOpts = () => voices().map(v => ({ value: v.id, label: vName(v.id), icon: v.g === "f" ? "♀" : "♂", sub: [v.engine === "piper" ? "Piper · fast" : v.engine === "chatterbox" ? (v.own === "clone" ? "cloned · Chatterbox" : "Chatterbox · natural") : v.engine === "azure" ? "Azure" : "designed", v.g === "f" ? "female" : "male"].join(" · ") }));
  const takeLabel = t => t.src === "mic" ? "🎤 Recording" : `${vName(t.params.voice)} · ${t.params.speed}×${t.params.pitch ? ` · ${t.params.pitch > 0 ? "+" : ""}${t.params.pitch}` : ""}${t.params.feel ? " · " + t.params.feel : ""}${t.params.take ? ` · take ${t.params.take + 1}` : ""}`;

  /* ---------- the plan of the lesson in time: where every line and every sound clip sits ---------- */
  function layout() {
    const d = S.L.data, all = rows(), pos = [], tm = S.L.timings || [];
    // the made audio's own timings, while it matches the lesson; else from the takes (or estimated)
    if (S.L.audio === "ready" && tm.length === all.length) { tm.forEach(x => pos.push(x)); VS.pos = pos; VS.speechEnd = (tm[tm.length - 1] || [0, 0])[1] + (d.pause ?? 0.6); let e = VS.speechEnd; for (const tr of tracks()) for (const c of tr.clips || []) if (!c.loop) e = Math.max(e, (c.at || 0) + clipLen(c)); VS.total = Math.max(5, e + 0.6); return all; }
    let t = 0.4;
    d.scenes.forEach((sc, si) => {
      if (si) t += d.scenePause ?? 1.4;
      sc.lines.forEach(r => { const s = lst(r.id), tk = s && s.have && s.takes.find(x => x.key === s.use), dur = tk && tk.dur > 0.2 ? tk.dur : Math.max(0.8, words(r.say || r.de).length * 0.42 / (r.speed || (d.cast[r.who] || {}).speed || 0.95)); pos.push([t, t + dur]); t += dur + (r.pause ?? d.pause ?? 0.6); });
    });
    VS.pos = pos; VS.speechEnd = t;
    let end = t;
    for (const tr of tracks()) for (const c of tr.clips || []) end = Math.max(end, c.loop ? t : (c.at || 0) + clipLen(c));
    VS.total = Math.max(5, end + 0.6);
    return all;
  }
  const clipLen = c => Math.max(0.2, (c.end ?? c.len ?? 3) - (c.start || 0));

  /* ---------- the desk ---------- */
  V.voice = async () => {
    const L = S.L;
    await flush();
    const [fresh, state] = await Promise.all([api("GET", `/lessons/${L.id}`), api("GET", `/lessons/${L.id}/voice`)]);
    Object.assign(L, { audio: fresh.audio, audioRev: fresh.audioRev, timings: fresh.timings, job: fresh.job, rev: fresh.rev, status: fresh.status, data: fresh.data });
    VS.state = state;
    draw();
    watch();
  };
  function draw() {
    const L = S.L, all = layout(), st = VS.state, W = 100 / VS.total;
    const job = st.job && ["queued", "running"].includes(st.job.status) && Date.now() - st.job.updated_at < 20 * 6e4 ? st.job : null;
    const todo = st.lines.filter(x => !x.have).length, changedN = st.lines.filter(x => x.changed).length, upToDate = L.audio === "ready" && !changedN;
    bar(lessonCrumb("voice"), `<span class="chip">${I("wave", 13)} ${all.length} lines · ≈ ${fmtT(VS.total)}</span>
      ${upToDate ? `<span class="chip ok">${I("check", 13)} audio up to date</span>` : L.audio === "none" ? `<span class="chip">no audio yet</span>` : changedN ? `<span class="chip warn">${changedN} line${changedN === 1 ? "" : "s"} changed since the audio</span>` : `<span class="chip warn">the lesson changed since the audio</span>`}
      ${job ? `<span class="chip on job"><span class="spin"></span> ${E(job.status === "queued" ? "starting… (about a minute)" : job.log || "making…")}</span>` : st.job && st.job.status === "failed" ? `<span class="chip bad" title="${E(st.job.log)}">last try failed</span>` : ""}
      <button class="btn ${upToDate ? "" : "pr"}" data-act="voiceMake" ${job || !all.length || !S.scope.voice ? "disabled" : ""} title="Makes the ${todo} line${todo === 1 ? "" : "s"} that changed and mixes everything">${I("mic", 14)} ${L.audio === "none" ? "Make audio" : "Make audio again"}${todo ? ` · ${todo} to make` : ""}</button>
      <button class="btn ${upToDate ? "pr" : ""}" data-act="publish" ${L.audio === "none" ? "disabled" : ""}>${I("send", 14)} ${L.status === "published" ? "Publish again" : "Publish"}</button>`);
    if (!all.length) { $("#view").innerHTML = `<div class="empty"><b>No text yet</b><a class="btn" href="#script/${L.id}">Write the text first</a></div>`; return; }
    const speakers = Object.keys(L.data.cast).filter(w => all.some(r => r.who === w));
    const step = VS.total <= 20 ? 2 : VS.total <= 60 ? 5 : VS.total <= 180 ? 15 : 30;
    $("#view").innerHTML = `<div class="vd">
      <div class="pn daw"><div class="tracks" id="vtr">
        <div class="ruler" style="margin-left:170px">${Array.from({ length: Math.floor(VS.total / step) + 1 }, (_, k) => `<span style="left:${k * step * W}%">${fmtT(k * step)}</span>`).join("")}</div>
        ${speakers.map(w => { const c = L.data.cast[w], col = speakerColor(w); return `<div class="trk sp" data-who="${E(w)}">
          <div class="th" data-vhead="${E(w)}"><div class="fc" style="background:${col}33;color:${col}">${E(c.emoji || w.charAt(0))}</div><div style="min-width:0"><b>${E(w)}</b><span>${E(vName(c.voice))} · ${c.speed || 0.95}×</span></div></div>
          <div class="lane">${all.map((r, i) => { if (r.who !== w) return ""; const s = lst(r.id) || {}, tk = s.takes || [], mic = s.use && s.use.startsWith("mic-");
            return `<div class="clip ${s.have ? "" : "todo"} ${VS.sel && VS.sel.k === "line" && VS.sel.i === i ? "sel" : ""}" data-clip="${i}" title="${E(r.de)}" style="left:${VS.pos[i][0] * W}%;width:${(VS.pos[i][1] - VS.pos[i][0]) * W}%;background:linear-gradient(135deg,${col},${col}99)">
              ${s.changed && L.audio !== "none" ? `<i class="chg" title="changed since the audio"></i>` : ""}<span class="tag">${mic ? "🎤" : ""}${tk.length > 1 ? `${tk.length} takes` : ""}${r.feel ? " " + E(r.feel) : ""}</span><span>${i + 1}</span><div class="wf">${wave(Math.max(3, Math.round((VS.pos[i][1] - VS.pos[i][0]) * 5)), i)}</div></div>`; }).join("")}</div></div>`; }).join("")}
        ${tracks().map((t, ti) => `<div class="trk md ${t.mute ? "off" : ""}" data-trk="${ti}">
          <div class="th" data-thd="${ti}">${I(KINDS[t.kind] ? KINDS[t.kind][0] : "music", 16)}<div style="min-width:0"><b>${E(t.name)}</b><span>${t.mute ? "muted" : t.duck !== false ? "lowered under speech" : "full volume"} · ${Math.round((t.gain ?? 1) * 100)}%</span></div></div>
          <div class="lane" data-tlane="${ti}">${(t.clips || []).map((c, ci) => { const len = c.loop ? Math.max(0.5, VS.speechEnd - (c.at || 0)) : clipLen(c);
            return `<div class="mclip ${c.loop ? "loop" : ""} ${VS.sel && VS.sel.k === "clip" && VS.sel.t === ti && VS.sel.c === ci ? "sel" : ""}" data-mc="${ti}:${ci}" style="left:${(c.at || 0) * W}%;width:${len * W}%">
              ${c.fadeIn ? `<i class="fi" style="width:${Math.min(100, c.fadeIn / len * 100)}%"></i>` : ""}${c.fadeOut ? `<i class="fo" style="width:${Math.min(100, c.fadeOut / len * 100)}%"></i>` : ""}
              <i class="hd l" data-hd="l"></i>${E(c.name || "sound")}${c.loop ? " ⟳" : ""}<i class="hd r" data-hd="r"></i></div>`; }).join("")}</div></div>`).join("")}
        <div class="trk add"><div class="th"><button class="btn sm" data-vd="addTrack">${I("plus", 13)} Track</button></div><div class="lane"></div></div>
        <div class="ph" id="ph" style="left:170px"></div>
      </div></div>
      <div class="pn vin" id="insp"></div>
      <div class="pn transport">
        <button class="tp" id="play" aria-label="Play" title="${upToDate ? "Play the audio" : "Play the takes (the browser's voice where a line isn't made yet)"}">▶</button><span class="de" style="font:700 15px Inter" id="clock">0:00 <span class="mu">/ ${fmtT(VS.total)}</span></span>
        <button class="chip" id="loop">Loop the line</button><button class="chip" id="slow">Slow</button><span style="flex:1"></span>
        <span class="chip">between lines <input type="range" min="0.2" max="2" step="0.1" value="${L.data.pause ?? 0.6}" id="gp" style="width:80px;accent-color:var(--vi)"> <b id="gpv">${L.data.pause ?? 0.6}s</b></span>
        <span class="chip">between scenes <input type="range" min="0.5" max="4" step="0.1" value="${L.data.scenePause ?? 1.4}" id="spz" style="width:80px;accent-color:var(--vi)"> <b id="spv">${L.data.scenePause ?? 1.4}s</b></span>
        ${upToDate ? "" : tracks().some(t => (t.clips || []).length) ? `<span class="chip">music and sounds are heard in the made audio</span>` : ""}
        ${S.scope.voice ? "" : `<span class="chip bad">the voice service is not set up</span>`}
      </div></div>`;
    inspector();
    const pl = $("#player");
    pl.src = L.audio !== "none" ? `/api/studio/lessons/${L.id}/audio?r=${L.audioRev}${ORG ? "&org=" + encodeURIComponent(ORG) : ""}` : "";
    $("#play").onclick = () => { if (VS.pv) return stop(); if (upToDate) { if (!pl.paused) return pl.pause(); return pl.play().catch(e => toast("The audio could not be played: " + (e.message || e.name))); } run(VS.sel && VS.sel.k === "line" ? VS.sel.i : 0); };
    $("#loop").onclick = e => { S.loop = !S.loop; e.currentTarget.classList.toggle("on", S.loop); };
    $("#slow").onclick = e => { pl.playbackRate = pl.playbackRate === 1 ? 0.8 : 1; e.currentTarget.classList.toggle("on", pl.playbackRate !== 1); };
    $("#gp").oninput = e => { L.data.pause = Number(e.target.value); $("#gpv").textContent = L.data.pause + "s"; changed(); };
    $("#spz").oninput = e => { L.data.scenePause = Number(e.target.value); $("#spv").textContent = L.data.scenePause + "s"; changed(); };
    VS.upToDate = upToDate;
  }
  function wave(n, seed) { return Array.from({ length: Math.min(n, 60) }, (_, i) => `<i style="height:${18 + Math.abs(Math.sin(i * .9 + seed) * 60 + Math.sin(i * .31 + seed * 2) * 22)}%"></i>`).join(""); }
  const redraw = () => { const sc = $("#vtr") && $("#vtr").scrollTop; draw(); if (sc && $("#vtr")) $("#vtr").scrollTop = sc; };

  /* ---------- the inspector: a line, a sound clip, or the voices ---------- */
  function inspector() {
    const L = S.L, all = rows(), el = $("#insp"); if (!el) return;
    if (VS.sel && VS.sel.k === "line" && all[VS.sel.i]) return lineInspector(el, VS.sel.i);
    if (VS.sel && VS.sel.k === "clip" && tracks()[VS.sel.t] && tracks()[VS.sel.t].clips[VS.sel.c]) return clipInspector(el, VS.sel.t, VS.sel.c);
    const lib = voices().filter(v => v.own);
    el.innerHTML = `<h3>Voices</h3>${Object.keys(L.data.cast).filter(w => all.some(r => r.who === w)).map(w => `<label style="color:${speakerColor(w)}">${E(w)}</label><l-select data-voice="${E(w)}" search></l-select>`).join("")}
      <h3 style="margin-top:16px">Your voices</h3>${lib.length ? lib.map(v => `<div class="li kv"><span>${v.g === "f" ? "♀" : "♂"} ${E(v.name)} <small class="mu2">${v.own === "clone" ? "cloned" : "designed"}</small></span></div>`).join("") : `<div class="mu sm">None yet.</div>`}
      <div class="acts" style="justify-content:flex-start;margin-top:8px"><button class="btn sm" data-vd="design">${I("wand", 13)} Design a voice</button><button class="btn sm" data-vd="clone">${I("mic", 13)} Clone a voice</button></div>
      ${Object.keys(L.data.pron || {}).length ? `<h3 style="margin-top:16px">How words are said</h3>${Object.entries(L.data.pron).map(([w, as]) => `<div class="li kv"><span><b>${E(w)}</b> → ${E(as)}</span><button class="btn sm ghost" data-unpron="${E(w)}" aria-label="Remove">${I("x", 12)}</button></div>`).join("")}` : ""}
      <div class="mu sm" style="margin-top:12px">Click a line to change how it is said, hear its takes or record it yourself. Right-click anything for more.</div>`;
    $$("[data-voice]", el).forEach(s => { opts(s, vOpts(), L.data.cast[s.dataset.voice].voice); s.addEventListener("change", () => { L.data.cast[s.dataset.voice].voice = s.value; changed(); refresh(); }); });
  }
  function lineInspector(el, i) {
    const L = S.L, r = rows()[i], c = L.data.cast[r.who] || {}, s = lst(r.id) || { takes: [] }, ws = String(r.de).split(/\s+/).filter(Boolean), pron = L.data.pron || {};
    const wt = VS.upToDate && VS.state.words[i] && VS.state.words[i].length === ws.length ? VS.state.words[i] : null;
    el.innerHTML = `<h3>Line ${i + 1} · <span style="color:${speakerColor(r.who)}">${E(r.who)}</span><button class="r btn sm ghost" data-vd="unsel" aria-label="Close">${I("x", 12)}</button></h3>
      <div class="de" style="font:600 15px Inter">${E(r.de)}</div><div class="mu sm">${E(r[S.tr] || "")}</div>
      <label>Words · click one to set how it is said</label><div class="words">${ws.map((w, k) => { const bare = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""); return `<span class="wd ${pron[bare] ? "pr" : ""}" data-pron="${E(bare)}" ${wt ? `data-t="${wt[k][0]}"` : ""} title="${pron[bare] ? "said as: " + E(pron[bare]) : wt ? fmtT(wt[k][0]) : ""}">${E(w)}</span>`; }).join("")}</div>
      <label>Spoken as <small class="mu2">(only when the voice should read something else)</small></label><textarea class="in say" id="lsayas" placeholder="${E(r.de)}">${E(r.say || "")}</textarea>
      <label>Feeling</label><l-select id="lfeel"></l-select>
      <div class="slider">Speed<input type="range" min="0.7" max="1.3" step="0.05" value="${r.speed || c.speed || 0.95}" id="lsp"><b id="lspv">${r.speed || c.speed || 0.95}×</b></div>
      <div class="slider">Pitch<input type="range" min="-4" max="4" step="0.5" value="${r.pitch || 0}" id="lpi"><b id="lpiv">${r.pitch > 0 ? "+" : ""}${r.pitch || 0}</b></div>
      <div class="slider">Pause after<input type="range" min="0" max="3" step="0.1" value="${r.pause ?? L.data.pause ?? 0.6}" id="lpa"><b id="lpav">${r.pause ?? L.data.pause ?? 0.6}s</b></div>
      <h3 style="margin-top:12px">Takes ${s.takes.length ? `<small class="mu2">${s.takes.length}</small>` : ""}</h3>
      ${s.takes.length ? s.takes.slice().reverse().map(t => `<div class="tk ${t.key === s.use ? "on" : ""}"><button class="btn sm icon ghost" data-tplay="${t.key}" aria-label="Listen">${I("play", 13)}</button><span class="t">${E(takeLabel(t))}<small>${K.ago(t.at)}${t.dur ? " · " + t.dur.toFixed(1) + " s" : ""}</small></span>
        ${t.key === s.use ? `<span class="use">${I("check", 14)}</span>` : `<button class="btn sm" data-tuse="${t.key}">Use</button>`}<button class="btn sm icon ghost" data-tdel="${t.key}" aria-label="Delete the take">${I("trash", 13)}</button></div>`).join("") : `<div class="mu sm">No take yet${s.have ? "" : " — make this line, or record it"}.</div>`}
      ${!s.have && s.takes.length ? `<div class="mu2 sm" style="margin-top:4px">The settings above have no take yet.</div>` : ""}
      <div class="acts" style="justify-content:flex-start;margin-top:8px">
        <button class="btn sm pr" data-vd="renderLine" ${S.scope.voice ? "" : "disabled"}>${I("wave", 13)} ${s.have ? "Another take" : "Make this line"}</button>
        <button class="btn sm" data-vd="recLine">${I("mic", 13)} Record it</button>
        <button class="btn sm" data-vd="quick">${I("listen", 13)} Quick listen</button></div>
      <div id="recBox"></div>
      <h3 style="margin-top:12px">Voice of ${E(r.who)}</h3><l-select id="lvo" search></l-select>`;
    opts($("#lfeel"), FEELS.map(([v, l]) => ({ value: v, label: l })), r.feel || "").addEventListener("change", e => { set(r, "feel", e.target.value); });
    $("#lsp").oninput = e => { $("#lspv").textContent = e.target.value + "×"; }; $("#lsp").onchange = e => set(r, "speed", Number(e.target.value));
    $("#lpi").oninput = e => { $("#lpiv").textContent = (e.target.value > 0 ? "+" : "") + e.target.value; }; $("#lpi").onchange = e => set(r, "pitch", Number(e.target.value) || "");
    $("#lpa").oninput = e => { r.pause = Number(e.target.value); $("#lpav").textContent = r.pause + "s"; changed(); };
    $("#lpa").onchange = () => redraw();
    $("#lsayas").onchange = e => set(r, "say", e.target.value.trim() && e.target.value.trim() !== r.de ? e.target.value.trim() : "");
    opts($("#lvo"), vOpts(), c.voice).addEventListener("change", e => { c.voice = e.target.value; changed(); refresh(); });
  }
  function clipInspector(el, ti, ci) {
    const t = tracks()[ti], c = t.clips[ci], len = c.len || 0;
    el.innerHTML = `<h3>${I(KINDS[t.kind] ? KINDS[t.kind][0] : "music", 14)} ${E(c.name || "Sound")}<button class="r btn sm ghost" data-vd="unsel" aria-label="Close">${I("x", 12)}</button></h3>
      <div class="mu sm">On “${E(t.name)}”${len ? ` · the file is ${len.toFixed(1)} s` : ""}. Drag it to move it, drag its edges to cut it.</div>
      <div class="slider">Starts at<input type="range" min="0" max="${Math.ceil(VS.total)}" step="0.1" value="${c.at || 0}" data-cf="at"><b>${(c.at || 0).toFixed(1)}s</b></div>
      <div class="slider">Cut start<input type="range" min="0" max="${Math.max(0.1, len - 0.2).toFixed(1)}" step="0.1" value="${c.start || 0}" data-cf="start"><b>${(c.start || 0).toFixed(1)}s</b></div>
      <div class="slider">Cut end<input type="range" min="0.2" max="${Math.max(0.2, len).toFixed(1)}" step="0.1" value="${c.end ?? len}" data-cf="end"><b>${(c.end ?? len).toFixed(1)}s</b></div>
      <div class="slider">Volume<input type="range" min="0" max="2" step="0.05" value="${c.gain ?? 1}" data-cf="gain"><b>${Math.round((c.gain ?? 1) * 100)}%</b></div>
      <div class="slider">Fade in<input type="range" min="0" max="5" step="0.1" value="${c.fadeIn || 0}" data-cf="fadeIn"><b>${(c.fadeIn || 0).toFixed(1)}s</b></div>
      <div class="slider">Fade out<input type="range" min="0" max="5" step="0.1" value="${c.fadeOut || 0}" data-cf="fadeOut"><b>${(c.fadeOut || 0).toFixed(1)}s</b></div>
      <div class="opt"><div><b>Under the whole lesson</b><small>repeats until the speech ends</small></div><button class="sw ${c.loop ? "on" : ""}" role="switch" aria-checked="${!!c.loop}" data-csw="loop"></button></div>
      <div class="opt"><div><b>Lower under speech</b><small>for the whole track “${E(t.name)}”</small></div><button class="sw ${t.duck !== false ? "on" : ""}" role="switch" aria-checked="${t.duck !== false}" data-tsw="duck"></button></div>
      <div class="acts" style="justify-content:flex-start;margin-top:10px"><button class="btn sm" data-vd="clipPlay">${I("play", 13)} Listen to the file</button><button class="btn sm d" data-vd="clipDel">${I("trash", 13)} Remove</button></div>`;
    $$("[data-cf]", el).forEach(x => { x.oninput = () => { const k = x.dataset.cf, v = Number(x.value); x.nextElementSibling.textContent = k === "gain" ? Math.round(v * 100) + "%" : v.toFixed(1) + "s"; }; x.onchange = () => { c[x.dataset.cf] = Number(x.value); changed(); redraw(); }; });
  }
  // a change of how a line is said: saved, and the desk shows the line as "to make"
  function set(r, k, v) { if (v === "" || v == null) delete r[k]; else r[k] = v; delete r.take; changed(); refresh(); }
  // the state (keys, takes) after a change, a little later
  let refT;
  function refresh() { clearTimeout(refT); refT = setTimeout(async () => { await flush(); VS.state = await api("GET", `/lessons/${S.L.id}/voice`); redraw(); }, 500); }

  /* ---------- listening ---------- */
  function playUrl(url, rate = 1) { stop(); const a = VS.audio = new Audio(url); a.playbackRate = rate; a.play().catch(e => toast("Could not play: " + (e.message || e.name))); return a; }
  function stop() { if (VS.pv) { VS.pv.stop = true; VS.pv = null; } if (VS.audio) { VS.audio.pause(); VS.audio = null; } K.stopSpeaking(); const b = $("#play"); if (b) b.textContent = "▶"; }
  window.VoiceDesk = { stop, get state() { return VS.state; } };
  // the lines one after another: the takes where they exist, the browser's voice where a line isn't made yet
  function run(from) {
    const all = rows(), me = VS.pv = { stop: false }; let k = Math.max(0, from);
    $("#play").textContent = "❚❚";
    const next = () => {
      if (me.stop || k >= all.length || !/^#voice/.test(location.hash)) { if (VS.pv === me) stop(); return; }
      const i = k++, r = all[i], s = lst(r.id), c = S.L.data.cast[r.who] || {};
      mark(i); head(VS.pos[i][0]);
      const after = () => setTimeout(next, (r.pause ?? S.L.data.pause ?? 0.6) * 1000);
      if (s && s.have) { const a = VS.audio = new Audio(clipUrl(s.use)); a.onended = after; a.onerror = after; a.play().catch(after); }
      else K.speak(r.say || r.de, { lang: S.L.course, rate: r.speed || c.speed || 0.95, pitch: c.gender === "m" ? 0.8 : 1.15, onend: after, onerror: () => { VS.pv = null; toast("This browser cannot speak"); } });
    };
    next();
  }
  const mark = i => $$(".clip").forEach(x => x.classList.toggle("sel", Number(x.dataset.clip) === i));
  const head = t => { const ph = $("#ph"); if (ph) ph.style.left = `calc(170px + (100% - 170px) * ${Math.min(1, t / VS.total)})`; const ck = $("#clock"); if (ck) ck.innerHTML = `${fmtT(t)} <span class="mu">/ ${fmtT(VS.total)}</span>`; };
  $("#player").addEventListener("timeupdate", () => {
    const p = $("#player"); if (!$("#ph") || !VS.pos.length) return;
    head(p.currentTime);
    const sel = VS.sel && VS.sel.k === "line" ? VS.sel.i : -1;
    if (S.loop && sel >= 0 && p.currentTime > VS.pos[sel][1] + 0.2) p.currentTime = VS.pos[sel][0];
    const i = VS.pos.findIndex(t => p.currentTime >= t[0] && p.currentTime < t[1] + 0.3);
    mark(S.loop && sel >= 0 ? sel : i);
    // the word being heard, in the inspector
    $$("#insp .wd[data-t]").forEach((w, k, a) => { const t0 = Number(w.dataset.t), t1 = a[k + 1] ? Number(a[k + 1].dataset.t) : VS.pos[sel] ? VS.pos[sel][1] : 0; w.classList.toggle("now", p.currentTime >= t0 && p.currentTime < t1); });
  });
  ["play", "pause"].forEach(ev => $("#player").addEventListener(ev, () => { const b = $("#play"); if (b) b.textContent = $("#player").paused ? "▶" : "❚❚"; }));

  /* ---------- making: the whole lesson, or some lines (new takes) ---------- */
  ACT.voiceMake = async btn => {
    if (btn) btn.disabled = true; await flush();
    try { await api("POST", `/lessons/${S.L.id}/voice`); toast("Started — the audio is ready in a few minutes"); }
    catch (e) { toast(e.message, { kind: "err" }); }
    V.voice();
  };
  async function makeLines(ids, another) {
    const all = rows();
    // a line that is made already gets another take (the take number is part of how it sounds)
    if (another) for (const id of ids) { const r = all.find(x => x.id === id); if (r) { r.seed = (r.seed || 0) + 1; delete r.take; } }
    if (another) changed();
    await flush();
    try { await api("POST", `/lessons/${S.L.id}/voice`, { lines: ids }); toast(ids.length === 1 ? "Making the line — about a minute" : `Making ${ids.length} lines`); }
    catch (e) { toast(e.message, { kind: "err" }); }
    V.voice();
  }
  function watch() {
    clearInterval(VS.poll);
    const j = VS.state.job; if (!j || !["queued", "running"].includes(j.status)) return;
    VS.poll = setInterval(async () => {
      if (!/^#voice/.test(location.hash) || !S.L) return clearInterval(VS.poll);
      const st = await api("GET", `/lessons/${S.L.id}/voice`).catch(() => null);
      if (!st || !st.job) return;
      if (st.job.status !== j.status || st.job.log !== j.log || st.job.id !== j.id) {
        if (st.job.status === "done") toast(st.job.mode === "lines" ? "New take ready" : "Audio ready", { kind: "ok" });
        if (st.job.status === "failed") toast("Making the audio failed: " + st.job.log, { kind: "err" });
        clearInterval(VS.poll); V.voice();
      }
    }, 4000);
  }

  /* ---------- recording a line with the microphone ---------- */
  async function recordLine(i) {
    const r = rows()[i], box = $("#recBox"); if (!box) return;
    if (VS.rec && VS.rec.on) return VS.rec.stop();
    try { VS.rec = await K.record({ max: 60 }); } catch (e) { return toast("The microphone isn't available: " + (e.message || e.name), { kind: "err" }); }
    box.innerHTML = `<div class="vread de">${E(r.de)}</div><div class="meter"><i id="lvl"></i></div><div class="acts" style="justify-content:flex-start"><button class="btn sm d" data-vd="recLine">${I("x", 13)} Stop</button><span class="mu sm" id="rsec">0 s</span></div>`;
    const t = setInterval(() => { const l = $("#lvl"), sec = $("#rsec"); if (!l || !VS.rec) return clearInterval(t); l.style.width = Math.min(100, VS.rec.level() * 160) + "%"; sec.textContent = Math.floor(VS.rec.secs) + " s"; }, 80);
    const { blob, dur } = await VS.rec.done; clearInterval(t); VS.rec = null;
    if (dur < 0.5) { box.innerHTML = ""; return; }
    try {
      const k = await K.sendFile(blob, { api, path: `/lessons/${S.L.id}/clips?line=${encodeURIComponent(r.id)}&dur=${dur.toFixed(2)}`, name: "take.webm" });
      r.take = k.key; changed(); toast("Your recording is the line's take now");
      await flush(); VS.state = await api("GET", `/lessons/${S.L.id}/voice`); redraw();
    } catch (e) { toast(e.message, { kind: "err" }); box.innerHTML = ""; }
  }

  /* ---------- tracks and sound files ---------- */
  function addTrack(kind) {
    const n = tracks().filter(t => t.kind === kind).length;
    tracks().push({ id: Math.random().toString(36).slice(2, 8), kind, name: KINDS[kind][1] + (n ? " " + (n + 1) : ""), gain: kind === "effects" ? 1 : 0.6, duck: kind !== "effects", clips: [] });
    changed(); redraw();
  }
  // a sound file from the computer onto a track, at a time
  function addSound(ti, at = 0) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "audio/*";
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const len = await new Promise(res => { const a = new Audio(URL.createObjectURL(f)); a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 0); a.onerror = () => res(0); });
      try {
        const m = await K.sendFile(f, { api, path: `/lessons/${S.L.id}/media` });
        const t = tracks()[ti];
        t.clips.push({ id: Math.random().toString(36).slice(2, 8), media: m.id, name: m.name, at: Math.round(at * 10) / 10, start: 0, len: Math.round(len * 100) / 100, gain: 1, fadeIn: t.kind === "effects" ? 0 : 1, fadeOut: t.kind === "effects" ? 0 : 1.5, loop: t.kind === "ambience" });
        changed(); VS.sel = { k: "clip", t: ti, c: t.clips.length - 1 }; redraw();
      } catch (e) { toast(e.message, { kind: "err" }); }
    };
    inp.click();
  }

  /* ---------- the voice library: designed and cloned voices ---------- */
  async function reloadScope() { const r = await api("GET", "/scope"); S.scope = { ...r, ...r.scope }; }
  function designVoice() {
    K.form("Design a voice", [
      { name: "name", label: "Name", required: true, ph: "Calm grandpa" },
      { type: "html", html: `<div class="cols2">` },
      { name: "course", label: "Language", type: "select", options: K.opt.courses().filter(o => S.scope.courses[o.value]), value: S.L.course },
      { name: "gender", label: "Voice", type: "select", options: [["f", "female"], ["m", "male"]] },
      { type: "html", html: `</div>` },
      { name: "description", label: "Describe it (the AI turns it into a voice)", type: "textarea", ph: "an older man, deep and slow, warm and patient" }
    ], async v => {
      const r = await api("POST", "/voices", { kind: "design", ...v });
      await reloadScope();
      toast(`“${v.name}” is ready: ${vName(r.settings.base)}, ${r.settings.speed}×, pitch ${r.settings.pitch}${r.settings.feel ? ", " + r.settings.feel : ""}`, { kind: "ok" });
      inspector();
    }, "Design it");
  }
  const READ = { de: "Guten Tag! Ich lese diesen Text langsam und deutlich vor. Heute ist ein schöner Tag, und ich freue mich auf die nächste Lektion. Eins, zwei, drei, vier, fünf.", nl: "Goedendag! Ik lees deze tekst rustig en duidelijk voor. Vandaag is een mooie dag en ik kijk uit naar de volgende les. Een, twee, drie, vier, vijf.", pl: "Dzień dobry! Czytam ten tekst powoli i wyraźnie. Dzisiaj jest piękny dzień i cieszę się na następną lekcję. Jeden, dwa, trzy, cztery, pięć." };
  function cloneVoice() {
    K.form("Clone a voice", [
      { name: "name", label: "Name of the voice", required: true, ph: "Ms. Weber" },
      { type: "html", html: `<div class="cols2">` },
      { name: "course", label: "Language", type: "select", options: K.opt.courses().filter(o => S.scope.courses[o.value]), value: S.L.course },
      { name: "gender", label: "Voice", type: "select", options: [["f", "female"], ["m", "male"]] },
      { type: "html", html: `</div><p class="mu sm">Only clone the voice of a person who agrees. They confirm it here in their own name; the consent is kept with the voice.</p>` },
      { name: "consentName", label: "The speaker's full name", required: true },
      { name: "consent", label: "Consent", type: "checks", options: [["yes", "I am this person, and I agree that LAPP makes lessons with my voice for this school. I can ask to delete it at any time."]] }
    ], async v => {
      if (!v.consent.includes("yes")) throw new Error("The speaker must agree");
      const text = `I, ${v.consentName}, agree that LAPP makes lessons with my voice for ${S.scope.name}. I can ask to delete it at any time.`;
      const r = await api("POST", "/voices", { kind: "clone", name: v.name, course: v.course, gender: v.gender, consent: true, consentName: v.consentName, consentText: text });
      setTimeout(() => recordVoice(r.id, v.course, v.name), 50);
    }, "Next: record");
  }
  // 10–30 seconds of the speaker reading a text
  function recordVoice(id, course, name) {
    let rec = null, blob = null, dur = 0;
    K.dialog(`<h3>Record “${E(name)}”</h3><p class="mu">Read this aloud in a quiet room, at least 10 seconds:</p><div class="vread de">${E(READ[course] || READ.de)}</div>
      <div class="meter"><i id="cvl"></i></div><div class="acts" style="justify-content:flex-start"><button type="button" class="btn" id="cvr">${I("mic", 14)} Record</button><span class="mu sm" id="cvs"></span></div>
      <div class="err" role="alert"></div><div class="k-acts"><button class="b" value="cancel" formnovalidate>Later</button><button class="b pr" value="ok">Save the voice</button></div>`,
      async () => { if (!blob || dur < 10) return "Record at least 10 seconds"; await K.sendFile(blob, { api, path: `/voices/${id}/ref?dur=${dur.toFixed(1)}`, name: "voice.webm" }); await reloadScope(); toast(`“${name}” is cloned — choose it as a speaker's voice`, { kind: "ok" }); inspector(); },
      { ready: f => { const b = f.querySelector("#cvr");
        b.onclick = async () => {
          if (rec && rec.on) return rec.stop();
          try { rec = await K.record({ max: 40 }); } catch (e) { return toast("The microphone isn't available", { kind: "err" }); }
          b.innerHTML = `${I("x", 14)} Stop`;
          const t = setInterval(() => { if (!rec || !rec.on) return clearInterval(t); f.querySelector("#cvl").style.width = Math.min(100, rec.level() * 160) + "%"; f.querySelector("#cvs").textContent = Math.floor(rec.secs) + " s"; }, 80);
          ({ blob, dur } = await rec.done); clearInterval(t); b.innerHTML = `${I("mic", 14)} Record again`; f.querySelector("#cvs").textContent = `${dur.toFixed(0)} s recorded${dur < 10 ? " — too short" : " ✓"}`;
        }; } });
  }

  /* ---------- clicks, dragging, right-click ---------- */
  const view = () => /^#voice/.test(location.hash) && S.L;
  document.addEventListener("click", async e => {
    if (!view()) return; const t = e.target;
    const cl = t.closest("[data-clip]"); if (cl) { VS.sel = { k: "line", i: Number(cl.dataset.clip) }; mark(VS.sel.i); $$(".mclip").forEach(x => x.classList.remove("sel")); inspector(); const pl = $("#player"); if (VS.upToDate && pl.src) pl.currentTime = VS.pos[VS.sel.i][0]; return; }
    const vd = t.closest("[data-vd]"); if (vd) { const k = vd.dataset.vd, i = VS.sel && VS.sel.i, r = VS.sel && VS.sel.k === "line" ? rows()[i] : null;
      if (k === "unsel") { VS.sel = null; mark(-1); return redraw(); }
      if (k === "addTrack") return K.menuAt(vd, Object.entries(KINDS).map(([kk, [ic, l]]) => ({ label: l, icon: ic, run: () => addTrack(kk) })));
      if (k === "renderLine" && r) return makeLines([r.id], (lst(r.id) || {}).have);
      if (k === "recLine" && r) return recordLine(i);
      if (k === "quick" && r) { const c = S.L.data.cast[r.who] || {}; return K.speak(r.say || r.de, { lang: S.L.course, rate: r.speed || c.speed || 0.95 }); }
      if (k === "design") return designVoice();
      if (k === "clone") return cloneVoice();
      if (k === "clipPlay" && VS.sel && VS.sel.k === "clip") return playUrl(mediaUrl(tracks()[VS.sel.t].clips[VS.sel.c].media));
      if (k === "clipDel" && VS.sel && VS.sel.k === "clip") { tracks()[VS.sel.t].clips.splice(VS.sel.c, 1); VS.sel = null; changed(); return redraw(); }
      return; }
    const tp = t.closest("[data-tplay]"); if (tp) return playUrl(clipUrl(tp.dataset.tplay));
    const tu = t.closest("[data-tuse]"); if (tu) { const r = rows()[VS.sel.i]; r.take = tu.dataset.tuse; changed(); await flush(); VS.state = await api("GET", `/lessons/${S.L.id}/voice`); return redraw(); }
    const td = t.closest("[data-tdel]"); if (td) { if (!await K.confirm({ title: "Delete this take?", ok: "Delete", danger: true })) return; await api("DELETE", `/lessons/${S.L.id}/clips/${td.dataset.tdel}`); const r = rows()[VS.sel.i]; if (r.take === td.dataset.tdel) { delete r.take; changed(); } await flush(); VS.state = await api("GET", `/lessons/${S.L.id}/voice`); return redraw(); }
    const pw = t.closest("[data-pron]"); if (pw && pw.dataset.pron) { const w = pw.dataset.pron, pr = S.L.data.pron = S.L.data.pron || {};
      const v = await K.ask({ title: `How is “${w}” said?`, text: "Write it the way it sounds. It is used everywhere in this lesson.", value: pr[w] || w, ok: "Use it" });
      if (v == null) return; if (v === w) delete pr[w]; else pr[w] = v; changed(); return refresh(); }
    const up = t.closest("[data-unpron]"); if (up) { delete S.L.data.pron[up.dataset.unpron]; changed(); return refresh(); }
    const cs = t.closest("[data-csw]"); if (cs && VS.sel && VS.sel.k === "clip") { const c = tracks()[VS.sel.t].clips[VS.sel.c]; c.loop = !c.loop; changed(); return redraw(); }
    const ts = t.closest("[data-tsw]"); if (ts && VS.sel && VS.sel.k === "clip") { const tr = tracks()[VS.sel.t]; tr.duck = tr.duck === false; changed(); return redraw(); }
  });
  document.addEventListener("dblclick", e => { if (!view()) return; const cl = e.target.closest("[data-clip]"); if (!cl) return; const s = lst(rows()[Number(cl.dataset.clip)].id); if (s && s.have) playUrl(clipUrl(s.use)); else $("[data-vd=quick]") && $("[data-vd=quick]").click(); });
  // a sound clip moves with the pointer; its edges cut it
  document.addEventListener("pointerdown", e => {
    if (!view() || e.button) return;
    const mc = e.target.closest && e.target.closest("[data-mc]"); if (!mc) return;
    const [ti, ci] = mc.dataset.mc.split(":").map(Number), c = tracks()[ti].clips[ci], lane = mc.parentElement, perPx = VS.total / lane.clientWidth;
    VS.sel = { k: "clip", t: ti, c: ci }; $$(".mclip").forEach(x => x.classList.toggle("sel", x === mc)); mark(-1); inspector();
    const edge = e.target.dataset.hd, o = { at: c.at || 0, start: c.start || 0, end: c.end ?? c.len ?? 3 };
    e.preventDefault();
    K.drag(e, { threshold: 3, move: dx => {
      const ds = dx * perPx;
      if (edge === "l") { const s = Math.max(0, Math.min(o.end - 0.2, o.start + ds)); c.start = Math.round(s * 10) / 10; c.at = Math.max(0, Math.round((o.at + (s - o.start)) * 10) / 10); }
      else if (edge === "r") c.end = Math.round(Math.max(o.start + 0.2, Math.min(c.len || 999, o.end + ds)) * 10) / 10;
      else c.at = Math.max(0, Math.round((o.at + ds) * 10) / 10);
      const W = 100 / VS.total, len = c.loop ? Math.max(0.5, VS.speechEnd - c.at) : clipLen(c);
      mc.style.left = c.at * W + "%"; mc.style.width = len * W + "%";
    }, end: (ev, moved) => { if (moved) { changed(); redraw(); } } });
  });
  document.addEventListener("contextmenu", e => {
    if (!view()) return;
    const t = e.target, x = e.clientX, y = e.clientY;
    const cl = t.closest("[data-clip]");
    if (cl) {
      e.preventDefault(); const i = Number(cl.dataset.clip), r = rows()[i], s = lst(r.id) || { takes: [] }, c = S.L.data.cast[r.who] || {};
      VS.sel = { k: "line", i }; mark(i); inspector();
      return K.menu(x, y, [
        { label: s.have ? "Listen to the take" : "Quick listen", icon: "listen", run: () => s.have ? playUrl(clipUrl(s.use)) : K.speak(r.say || r.de, { lang: S.L.course, rate: r.speed || c.speed || 0.95 }) },
        { label: s.have ? "Another take" : "Make this line", icon: "wave", disabled: !S.scope.voice, run: () => makeLines([r.id], s.have) },
        { label: "Takes", icon: "layers", sub: s.takes.length ? s.takes.slice().reverse().map(tk => ({ label: takeLabel(tk), icon: tk.src === "mic" ? "mic" : "wave", on: tk.key === s.use, run: () => { r.take = tk.key; changed(); refresh(); } })) : [{ label: "No take yet", disabled: true }] },
        { label: "Record it myself", icon: "mic", run: () => recordLine(i) }, "-",
        { label: "Feeling", icon: "person", sub: FEELS.map(([v, l]) => ({ label: l, on: (r.feel || "") === v, run: () => set(r, "feel", v) })) },
        { label: "Speed", icon: "clock", sub: [0.8, 0.9, 0.95, 1, 1.1, 1.2].map(v => ({ label: v + "×", on: (r.speed || c.speed || 0.95) === v, run: () => set(r, "speed", v) })) },
        { label: "Pitch", icon: "wave", sub: [-3, -2, -1, 0, 1, 2, 3].map(v => ({ label: (v > 0 ? "+" : "") + v, on: (r.pitch || 0) === v, run: () => set(r, "pitch", v || "") })) },
        { label: "Pause after", icon: "pause", sub: [0.3, 0.6, 1, 1.5, 2.5].map(v => ({ label: v + " s", on: (r.pause ?? S.L.data.pause ?? 0.6) === v, run: () => { r.pause = v; changed(); redraw(); } })) }, "-",
        { label: "Edit the text", icon: "edit", run: () => { S.focusLine = i; location.hash = `script/${S.L.id}`; } }
      ], { title: `Line ${i + 1} · ${r.who}`, search: true });
    }
    const mc = t.closest("[data-mc]");
    if (mc) {
      e.preventDefault(); const [ti, ci] = mc.dataset.mc.split(":").map(Number), tr = tracks()[ti], c = tr.clips[ci];
      VS.sel = { k: "clip", t: ti, c: ci }; inspector();
      const setc = (k, v) => () => { c[k] = v; changed(); redraw(); };
      return K.menu(x, y, [
        { label: "Listen to the file", icon: "listen", run: () => playUrl(mediaUrl(c.media)) },
        { label: c.loop ? "Play once" : "Under the whole lesson", icon: "reload", run: setc("loop", !c.loop) },
        { label: "Fade in", icon: "wave", sub: [0, 0.5, 1, 2, 4].map(v => ({ label: v ? v + " s" : "none", on: (c.fadeIn || 0) === v, run: setc("fadeIn", v) })) },
        { label: "Fade out", icon: "wave", sub: [0, 0.5, 1, 2, 4].map(v => ({ label: v ? v + " s" : "none", on: (c.fadeOut || 0) === v, run: setc("fadeOut", v) })) },
        { label: "Volume", icon: "listen", sub: [0.25, 0.5, 0.75, 1, 1.5].map(v => ({ label: Math.round(v * 100) + "%", on: (c.gain ?? 1) === v, run: setc("gain", v) })) },
        { label: "Duplicate", icon: "copy", run: () => { tr.clips.push({ ...c, id: Math.random().toString(36).slice(2, 8), at: (c.at || 0) + clipLen(c) }); changed(); redraw(); } }, "-",
        { label: "Remove", icon: "trash", danger: true, run: () => { tr.clips.splice(ci, 1); VS.sel = null; changed(); redraw(); } }
      ], { title: c.name });
    }
    const th = t.closest("[data-thd]"), ln = t.closest("[data-tlane]");
    if (th || ln) {
      e.preventDefault(); const ti = Number((th || ln).dataset.thd ?? ln.dataset.tlane), tr = tracks()[ti];
      const at = ln ? (x - ln.getBoundingClientRect().left) / ln.clientWidth * VS.total : 0;
      return K.menu(x, y, [
        { label: "Add a sound file here…", icon: "upload", run: () => addSound(ti, at) },
        { label: "Rename…", icon: "rename", run: async () => { const n = await K.ask({ title: "Rename the track", value: tr.name }); if (n) { tr.name = n; changed(); redraw(); } } },
        { label: tr.mute ? "Unmute" : "Mute", icon: "listen", run: () => { tr.mute = !tr.mute; changed(); redraw(); } },
        { label: "Lower under speech", icon: "wave", on: tr.duck !== false, run: () => { tr.duck = tr.duck === false; changed(); redraw(); } },
        { label: "Volume", icon: "listen", sub: [0.25, 0.4, 0.6, 0.8, 1].map(v => ({ label: Math.round(v * 100) + "%", on: (tr.gain ?? 1) === v, run: () => { tr.gain = v; changed(); redraw(); } })) }, "-",
        { label: "Delete the track", icon: "trash", danger: true, run: async () => { if (!tr.clips.length || await K.confirm({ title: `Delete “${tr.name}”?`, ok: "Delete", danger: true })) { tracks().splice(ti, 1); VS.sel = null; changed(); redraw(); } } }
      ], { title: tr.name });
    }
    const vh = t.closest("[data-vhead]");
    if (vh) {
      e.preventDefault(); const w = vh.dataset.vhead, c = S.L.data.cast[w];
      const pickV = v => ({ label: vName(v.id), on: c.voice === v.id, run: () => { c.voice = v.id; changed(); refresh(); } });
      const vs = voices();
      return K.menu(x, y, [
        { label: "Female voices", icon: "user", sub: vs.filter(v => v.g === "f" && !v.own).map(pickV) },
        { label: "Male voices", icon: "user", sub: vs.filter(v => v.g === "m" && !v.own).map(pickV) },
        { label: "Your voices", icon: "star", sub: vs.filter(v => v.own).length ? vs.filter(v => v.own).map(pickV) : [{ label: "None yet", disabled: true }] },
        { label: "Speed", icon: "clock", sub: [0.85, 0.9, 0.95, 1, 1.05].map(v => ({ label: v + "×", on: (c.speed || 0.95) === v, run: () => { c.speed = v; changed(); refresh(); } })) },
        { label: `Make ${w}'s lines`, icon: "wave", disabled: !S.scope.voice, run: () => { const ids = rows().filter(r => r.who === w && !(lst(r.id) || {}).have).map(r => r.id); if (!ids.length) return toast(`${w}'s lines are made already`); makeLines(ids); } }, "-",
        { label: "Design a voice…", icon: "wand", run: designVoice },
        { label: "Clone a voice…", icon: "mic", run: cloneVoice }
      ], { title: w });
    }
  });

  /* ---------- the window's menus: Voice ---------- */
  const prev = window.LAPPFrame && LAPPFrame.menus;
  if (window.LAPPFrame) LAPPFrame.menus = () => {
    const base = prev ? prev() : [];
    if (!view()) return base;
    const st = VS.state || { lines: [] }, todo = st.lines.filter(x => !x.have).map(x => x.id);
    const sub = l => ({ label: l === "de" ? K.COURSES[S.L.course].name + " · with word timing" : l.toUpperCase(), run: () => { const a = document.createElement("a"); a.href = `/api/studio/lessons/${S.L.id}/subtitles.vtt?lang=${l}${ORG ? "&org=" + encodeURIComponent(ORG) : ""}`; a.download = `lesson-${S.L.id}-${l}.vtt`; a.click(); } });
    return [...base.slice(0, 1), { label: "Voice", items: [
      { label: "Make audio", icon: "mic", disabled: !S.scope.voice, run: () => ACT.voiceMake() },
      { label: `Make the ${todo.length} changed line${todo.length === 1 ? "" : "s"} (no mix)`, icon: "wave", disabled: !todo.length || !S.scope.voice, run: () => makeLines(todo) }, "-",
      { label: "Add a track", icon: "plus", sub: Object.entries(KINDS).map(([k, [ic, l]]) => ({ label: l, icon: ic, run: () => addTrack(k) })) },
      { label: "Record the chosen line", icon: "mic", disabled: !(VS.sel && VS.sel.k === "line"), run: () => recordLine(VS.sel.i) }, "-",
      { label: "Design a voice…", icon: "wand", run: designVoice }, { label: "Clone a voice…", icon: "mic", run: cloneVoice }, "-",
      { label: "Subtitles", icon: "file-text", disabled: S.L.audio === "none", sub: ["de", "en", "fa", "ru", "uk"].map(sub) }
    ] }, ...base.slice(1)];
  };
})();
