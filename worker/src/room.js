// A live class: one Durable Object per lesson, every participant on a WebSocket.
// The teacher draws and writes on pages, shows material, runs quick polls and lowers hands;
// students see it live, vote, raise a hand and chat. The board survives a reload or a hiccup:
// it is kept in the object's storage. Video and voice are not here (they need a media service).
//
// school.js checks who may enter and passes { id, name, teacher } in the X-User header.
const MAX_STROKES = 4000;

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.state = null;
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get("state")) || { pages: [{ strokes: [], texts: [] }], page: 0, show: null, poll: null, chat: [], hands: [] };
    });
  }

  async fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected a websocket", { status: 426 });
    const user = JSON.parse(req.headers.get("X-User") || "{}");
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment(user);
    pair[1].send(JSON.stringify({ t: "state", state: { ...this.state, poll: this.pollView() }, me: user }));
    this.presence();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  people() {
    const seen = new Map();
    for (const ws of this.ctx.getWebSockets()) { const u = ws.deserializeAttachment(); if (u && u.id) seen.set(u.id, { id: u.id, name: u.name, teacher: !!u.teacher }); }
    return [...seen.values()];
  }
  presence() { this.send({ t: "people", people: this.people() }); }
  send(msg, except) { const s = JSON.stringify(msg); for (const ws of this.ctx.getWebSockets()) if (ws !== except) { try { ws.send(s); } catch {} } }
  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.ctx.storage.put("state", this.state), 400); }

  async webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const u = ws.deserializeAttachment() || {}, S = this.state, T = !!u.teacher;
    const page = S.pages[S.page];
    switch (m.t) {
      case "stroke":                                        // a finished line: {c, w, pts:[x,y,…]} in 0–1 coordinates
        if (!T || !Array.isArray(m.s?.pts) || m.s.pts.length > 4000) return;
        if (page.strokes.length >= MAX_STROKES) page.strokes.shift();
        page.strokes.push({ c: String(m.s.c || "#111").slice(0, 9), w: Math.min(30, Number(m.s.w) || 3), pts: m.s.pts.map(n => Math.round(Number(n) * 1000) / 1000) });
        this.send({ t: "stroke", page: S.page, s: page.strokes[page.strokes.length - 1] }, ws); break;
      case "text":
        if (!T || !m.text) return;
        page.texts.push({ x: Number(m.x) || .05, y: Number(m.y) || .1, text: String(m.text).slice(0, 300), c: String(m.c || "#111").slice(0, 9), s: Math.min(64, Number(m.s) || 28) });
        this.send({ t: "page-data", n: S.page, data: page }); break;
      case "undo":
        if (!T) return;
        if (page.texts.length && (!page.strokes.length || m.what === "text")) page.texts.pop(); else page.strokes.pop();
        this.send({ t: "page-data", n: S.page, data: page }); break;
      case "clear":
        if (!T) return;
        S.pages[S.page] = { strokes: [], texts: [] };
        this.send({ t: "page-data", n: S.page, data: S.pages[S.page] }); break;
      case "page":
        if (!T) return;
        if (m.add) S.pages.push({ strokes: [], texts: [] });
        S.page = Math.max(0, Math.min(S.pages.length - 1, m.add ? S.pages.length - 1 : Number(m.n) || 0));
        this.send({ t: "page", n: S.page, count: S.pages.length, data: S.pages[S.page] }); break;
      case "show":                                          // material on top of the board for everyone (or null)
        if (!T) return;
        S.show = m.show ? { kind: String(m.show.kind), title: String(m.show.title || "").slice(0, 120), url: String(m.show.url || "").slice(0, 500), body: String(m.show.body || "").slice(0, 20000), type: String(m.show.type || "").slice(0, 60), at: Date.now() } : null;
        this.send({ t: "show", show: S.show }); break;
      case "poll":
        if (!T) return;
        S.poll = m.poll ? { q: String(m.poll.q).slice(0, 300), options: (m.poll.options || []).slice(0, 6).map(o => String(o).slice(0, 120)), votes: {}, open: true } : null;
        this.send({ t: "poll", poll: this.pollView() }); break;
      case "poll-close":
        if (!T || !S.poll) return;
        S.poll.open = false; this.send({ t: "poll", poll: this.pollView() }); break;
      case "vote":
        if (!S.poll || !S.poll.open || !(Number(m.i) >= 0 && Number(m.i) < S.poll.options.length)) return;
        S.poll.votes[u.id] = Number(m.i);
        this.send({ t: "poll", poll: this.pollView() }); break;
      case "hand":
        S.hands = S.hands.filter(h => h.id !== (T && m.id ? m.id : u.id));
        if (m.up && !T) S.hands.push({ id: u.id, name: u.name, at: Date.now() });
        this.send({ t: "hands", hands: S.hands }); break;
      case "chat":
        if (!m.text) return;
        S.chat.push({ id: u.id, name: u.name, teacher: T, text: String(m.text).slice(0, 500), at: Date.now() });
        S.chat = S.chat.slice(-80);
        this.send({ t: "chat", msg: S.chat[S.chat.length - 1] }); break;
      case "end":
        if (!T) return;
        this.send({ t: "ended" });
        for (const w of this.ctx.getWebSockets()) try { w.close(1000, "class ended"); } catch {}
        break;
      default: return;
    }
    this.save();
  }
  pollView() {
    const P = this.state.poll; if (!P) return null;
    const counts = P.options.map((_, i) => Object.values(P.votes).filter(v => v === i).length);
    return { q: P.q, options: P.options, counts, open: P.open, total: Object.keys(P.votes).length };
  }
  async webSocketClose(ws) { try { ws.close(); } catch {} this.presence(); }
  async webSocketError() { this.presence(); }
}
