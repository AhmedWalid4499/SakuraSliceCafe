// Live café: who is in the room, where they're standing, what they're
// holding. Persistent things (notes, chat) are saved through the HTTP API
// and then broadcast from here so everyone sees them straight away.

const { WebSocketServer } = require('ws');
const { userFromCookieHeader, publicUser } = require('./auth');
const { clamp } = require('./util');

const clients = new Map(); // ws -> { user, state }
let wss;

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const ws of clients.keys()) {
    if (ws !== except && ws.readyState === ws.OPEN) ws.send(data);
  }
}

// One person can have the café open in two tabs; show them once.
function roster() {
  const seen = new Map();
  for (const c of clients.values()) seen.set(c.user.id, c);
  return [...seen.values()].map(c => ({ ...c.profile, state: c.state }));
}

function attach(server) {
  wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

  wss.on('connection', async (ws, req) => {
    let user;
    try { user = await userFromCookieHeader(req.headers.cookie); } catch (e) { user = null; }
    if (!user) { send(ws, { t: 'error', error: 'signin' }); return ws.close(4001, 'signin'); }

    const p = publicUser(user);
    const entry = {
      user,
      profile: { id: p.id, displayName: p.displayName, avatar: p.avatar },
      state: { x: 0, z: 6.5, ry: Math.PI, seat: null, drink: null, placed: null, moving: false },
      lastMsg: 0,
    };
    clients.set(ws, entry);

    send(ws, { t: 'hello', you: p.id, people: roster() });
    broadcast({ t: 'join', person: { ...entry.profile, state: entry.state } }, ws);

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', raw => {
      const now = Date.now();
      if (now - entry.lastMsg < 60) return; // ~15 updates a second is plenty
      entry.lastMsg = now;
      let m;
      try { m = JSON.parse(raw); } catch (e) { return; }

      if (m.t === 'move') {
        entry.state = {
          x: clamp(m.x, -11, 11) || 0,
          z: clamp(m.z, -8, 8) || 0,
          ry: clamp(m.ry, -10, 10) || 0,
          seat: typeof m.seat === 'string' ? m.seat.slice(0, 24) : null,
          drink: typeof m.drink === 'string' ? m.drink.slice(0, 24) : null,
          // a drink this person has set down on a table (one at a time)
          placed: m.placed && typeof m.placed.drink === 'string' ? {
            drink: m.placed.drink.slice(0, 24),
            x: clamp(m.placed.x, -11, 11) || 0,
            y: clamp(m.placed.y, 0, 1.5) || 0,
            z: clamp(m.placed.z, -8, 8) || 0,
          } : null,
          moving: !!m.moving,
        };
        broadcast({ t: 'move', id: entry.user.id, state: entry.state }, ws);
      } else if (m.t === 'wave' || m.t === 'emote') {
        const e = ['wave', '🌸', '☕', '💗', '✨', '😴'].includes(m.e) ? m.e : 'wave';
        broadcast({ t: 'emote', id: entry.user.id, e }, ws);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      const stillHere = [...clients.values()].some(c => c.user.id === entry.user.id);
      if (!stillHere) broadcast({ t: 'leave', id: entry.user.id });
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
  for (const c of clients.values()) {
    if (c.user.id === p.id) c.profile = { id: p.id, displayName: p.displayName, avatar: p.avatar };
  }
  broadcast({ t: 'profile', person: { id: p.id, displayName: p.displayName, avatar: p.avatar } });
}

const onlineCount = () => new Set([...clients.values()].map(c => c.user.id)).size;

module.exports = { attach, broadcast, updateProfile, onlineCount };
