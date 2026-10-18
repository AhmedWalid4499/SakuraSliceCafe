// Live café: who is in the room, where they're standing, what they're
// holding. Persistent things (notes, chat) are saved through the HTTP API
// and then broadcast from here so everyone sees them straight away.
//
// Every connection is in one room: 'main' (the ground floor), 'garden'
// (the roof garden, open to everyone) or 'group:<id>' (that group's room upstairs). Presence and room-scoped
// broadcasts only reach people in the same room.

const { WebSocketServer } = require('ws');
const { userFromCookieHeader, publicUser } = require('./auth');
const { clamp } = require('./util');

const clients = new Map(); // ws -> { user, profile, state, room }
let wss;
let canEnter = async () => false; // set by attach() to avoid a require cycle

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// room omitted = everyone, everywhere (e.g. site content changes)
function broadcast(msg, except, room) {
  const data = JSON.stringify(msg);
  for (const [ws, c] of clients) {
    if (ws === except || ws.readyState !== ws.OPEN) continue;
    if (room && c.room !== room) continue;
    ws.send(data);
  }
}

// One person can have the café open in two tabs; show them once.
function roster(room) {
  const seen = new Map();
  for (const c of clients.values()) if (c.room === room) seen.set(c.user.id, c);
  return [...seen.values()].map(c => ({ ...c.profile, state: c.state }));
}

function stillIn(userId, room, exceptWs) {
  for (const [ws, c] of clients) if (ws !== exceptWs && c.user.id === userId && c.room === room) return true;
  return false;
}

// What's on someone's table, as a short key (to spot when it changes).
function placedKey(p) {
  return p && typeof p === 'object' ? `${p.drink || ''}:${p.sips || 0}+${p.dessert || ''}:${p.bites || 0}@${p.x},${p.z}` : '';
}

function cleanState(m) {
  return {
    x: clamp(m.x, -15, 15) || 0,
    z: clamp(m.z, -14.5, 11) || 0, // −11 → −14.5: the kitchen behind the back door
    ry: clamp(m.ry, -10, 10) || 0,
    seat: typeof m.seat === 'string' ? m.seat.slice(0, 24) : null,
    drink: typeof m.drink === 'string' ? m.drink.slice(0, 60) : null,
    sips: Math.round(clamp(m.sips, 0, 4)) || 0, // how much of the drink is gone (0–4)
    // a pastry on a plate in the other hand, and how many bites are gone (0–3)
    dessert: typeof m.dessert === 'string' ? m.dessert.slice(0, 40) : null,
    bites: Math.round(clamp(m.bites, 0, 3)) || 0,
    // what this person has set down on a table (one spot at a time): a cup, a plate, or both
    placed: m.placed && (typeof m.placed.drink === 'string' || typeof m.placed.dessert === 'string') ? {
      drink: typeof m.placed.drink === 'string' ? m.placed.drink.slice(0, 60) : null,
      sips: Math.round(clamp(m.placed.sips, 0, 4)) || 0,
      dessert: typeof m.placed.dessert === 'string' ? m.placed.dessert.slice(0, 40) : null,
      bites: Math.round(clamp(m.placed.bites, 0, 3)) || 0,
      x: clamp(m.placed.x, -15, 15) || 0,
      y: clamp(m.placed.y, 0, 8.6) || 0,
      z: clamp(m.placed.z, -14.5, 11) || 0,
    } : null,
    moving: !!m.moving,
  };
}

function attach(server, opts = {}) {
  if (opts.canEnter) canEnter = opts.canEnter;
  wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

  wss.on('connection', async (ws, req) => {
    let user;
    try { user = await userFromCookieHeader(req.headers.cookie); } catch (e) { user = null; }
    if (!user) { send(ws, { t: 'error', error: 'signin' }); return ws.close(4001, 'signin'); }

    const p = publicUser(user);
    const entry = {
      user,
      profile: { id: p.id, displayName: p.displayName, avatar: p.avatar },
      state: { x: 0, z: 9.3, ry: Math.PI, seat: null, drink: null, placed: null, moving: false },
      room: 'main',
      lastMsg: 0,
    };
    clients.set(ws, entry);

    send(ws, { t: 'hello', you: p.id, room: entry.room, people: roster(entry.room) });
    if (!stillIn(p.id, entry.room, ws)) broadcast({ t: 'join', person: { ...entry.profile, state: entry.state } }, ws, entry.room);

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async raw => {
      let m;
      try { m = JSON.parse(raw); } catch (e) { return; }

      // Changing floors / rooms is never throttled.
      if (m.t === 'room') {
        const room = typeof m.room === 'string' ? m.room : '';
        let ok = false;
        try { ok = /^(main|garden|group:\d+)$/.test(room) && await canEnter(entry.user.id, room); } catch (e) { ok = false; }
        if (!ok) return send(ws, { t: 'room:denied', room });
        const from = entry.room;
        if (m.state) entry.state = cleanState(m.state);
        entry.room = room;
        if (from !== room && !stillIn(entry.user.id, from, ws)) broadcast({ t: 'leave', id: entry.user.id }, ws, from);
        send(ws, { t: 'hello', you: entry.user.id, room, people: roster(room).filter(x => x.id !== entry.user.id) });
        broadcast({ t: 'join', person: { ...entry.profile, state: entry.state } }, ws, room);
        return;
      }

      // The owner plays (or pauses) the café playlist for everyone, on every
      // floor — never throttled, and only the owner can.
      if (m.t === 'music') {
        if (!entry.user.is_admin) return;
        const now = Date.now();
        if (now - (entry.lastMusic || 0) < 1000) return;
        entry.lastMusic = now;
        broadcast({ t: 'music', action: m.action === 'pause' ? 'pause' : 'play', by: entry.profile.displayName }, ws);
        return;
      }

      const now = Date.now();
      // State changes (sitting, drinks) always go through; plain walking is
      // limited to ~15 updates a second.
      const important = m.t === 'move' && (m.seat !== entry.state.seat || m.drink !== entry.state.drink
        || (m.dessert || null) !== entry.state.dessert || (m.bites || 0) !== entry.state.bites || (m.sips || 0) !== entry.state.sips
        || placedKey(m.placed) !== placedKey(entry.state.placed));
      if (!important && now - entry.lastMsg < 60) return;
      entry.lastMsg = now;

      if (m.t === 'move') {
        entry.state = cleanState(m);
        broadcast({ t: 'move', id: entry.user.id, state: entry.state }, ws, entry.room);
      } else if (m.t === 'wave' || m.t === 'emote') {
        const e = ['wave', '🌸', '☕', '💗', '✨', '😴', '🌱', '💧', '🌿', '🧺'].includes(m.e) ? m.e : 'wave';
        broadcast({ t: 'emote', id: entry.user.id, e }, ws, entry.room);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      if (!stillIn(entry.user.id, entry.room)) broadcast({ t: 'leave', id: entry.user.id }, null, entry.room);
    });
  });

  const beat = setInterval(() => {
    for (const ws of clients.keys()) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(beat));
}

// Called after someone edits their avatar so others see the new look.
function updateProfile(user) {
  const p = publicUser(user);
  const rooms = new Set();
  for (const c of clients.values()) {
    if (c.user.id === p.id) { c.profile = { id: p.id, displayName: p.displayName, avatar: p.avatar }; rooms.add(c.room); }
  }
  for (const room of rooms) {
    broadcast({ t: 'profile', person: { id: p.id, displayName: p.displayName, avatar: p.avatar } }, null, room);
  }
}

const onlineCount = () => new Set([...clients.values()].map(c => c.user.id)).size;

// How many people are in each room right now (for the upstairs list).
function roomCounts() {
  const out = {};
  const seen = new Set();
  for (const c of clients.values()) {
    const k = c.room + ':' + c.user.id;
    if (seen.has(k)) continue;
    seen.add(k);
    out[c.room] = (out[c.room] || 0) + 1;
  }
  return out;
}

module.exports = { attach, broadcast, updateProfile, onlineCount, roomCounts };
