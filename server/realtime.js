// Live café: who is in the room, where they're standing, what they're
// holding. Persistent things (notes, chat) are saved through the HTTP API
// and then broadcast from here so everyone sees them straight away.
//
// Every connection is in one room: 'main' (the ground floor), 'garden'
// (the roof garden, open to everyone), 'group:<id>' (that group's room upstairs)
// or 'home:<userId>' (someone's own room upstairs). Presence and room-scoped
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

// ── games at the tables: chess, tawla, snakes and ladders and Sakura Eights,
// one game per table, played live. The rules run in the players' browsers
// (chess.js, tawla.mjs, snakes.mjs, eights.mjs); here we keep the board,
// check it's the right person's turn, and tell the room. Seats are a, b, c…;
// the team (Yuto, Hana, Yuki, Me3temed) can fill empty ones, and their turns
// are played by the browser of whoever set the game out (seat a).
const games = new Map(); // `${room}|${table}` → game
const gameList = room => [...games.values()].filter(g => g.room === room);
const SEATS = ['a', 'b', 'c', 'd', 'e', 'f'];
const MAX_SEATS = { chess: 2, tawla: 2, snakes: 4, eights: 6 };
const BOTS = { yuto: 'Yuto', hana: 'Hana', yuki: 'Yuki', me3temed: 'Me3temed' };
const seatsOf = g => SEATS.slice(0, MAX_SEATS[g.kind]);
const freeSeat = g => seatsOf(g).find(k => !g.players[k]);
function handleGame(ws, entry, m) {
  const table = typeof m.table === 'string' ? m.table.slice(0, 24) : '';
  if (!/^[\w-]{1,24}$/.test(table)) return;
  const key = entry.room + '|' + table;
  const me = { id: entry.user.id, name: entry.profile.displayName };
  let g = games.get(key);
  const isPlayer = g && Object.values(g.players).some(p => p && p.id === me.id);
  const isHost = g && g.players.a && g.players.a.id === me.id;
  const state = m.state && typeof m.state === 'object' ? m.state : null;
  if (state && JSON.stringify(state).length > 2400) return;
  if (m.action === 'start') {
    // a game is already going at this table (left alone for 10 minutes, it can be cleared for a new one)
    if (g && !g.over && !isPlayer && Date.now() - g.at < 10 * 60e3) return;
    const kind = MAX_SEATS[m.kind] ? m.kind : 'chess';
    const players = { a: me };
    if (kind === 'chess' || kind === 'tawla') players.b = m.vs === 'yuto' ? { id: 'yuto', name: 'Yuto' } : null;
    else for (const b of (Array.isArray(m.bots) ? m.bots : []).filter(b => BOTS[b]).slice(0, MAX_SEATS[kind] - 1)) players[SEATS[Object.keys(players).length]] = { id: b, name: BOTS[b] };
    g = { table, room: entry.room, kind, players, state, turn: 'a', over: null, at: Date.now(), moves: 0 };
    games.set(key, g);
  } else if (!g) return;
  else if (m.action === 'join') {
    // a free seat, before the first move (two-player games: just the one across from you)
    const seat = freeSeat(g);
    if (isPlayer || !seat || (g.moves > 0 && MAX_SEATS[g.kind] > 2)) return;
    g.players[seat] = me;
  } else if (m.action === 'addbot') {
    // whoever set the game out asks one of the team to join in
    const seat = freeSeat(g);
    if (!isHost || !seat || g.moves > 0 || !BOTS[m.bot] || Object.values(g.players).some(p => p && p.id === m.bot)) return;
    g.players[seat] = { id: m.bot, name: BOTS[m.bot] };
  } else if (m.action === 'move') {
    if (g.over || !state) return;
    const mover = g.players[g.turn];
    // your own turn — or one of the team's, played for them by the person who set the game out
    const ok = mover && (mover.id === me.id || (BOTS[mover.id] && isHost));
    if (!ok) return;
    g.state = state;
    g.turn = seatsOf(g).includes(m.turn) && g.players[m.turn] ? m.turn : 'a';
    g.over = m.over ? { winner: seatsOf(g).includes(m.over.winner) && g.players[m.over.winner] ? m.over.winner : null, why: String(m.over.why || '').slice(0, 60) } : null;
    g.moves++;
  } else if (m.action === 'end') {
    if (!isPlayer && !entry.user.is_admin) return;
    games.delete(key);
    broadcast({ t: 'game:end', table, by: me.name }, null, entry.room);
    return;
  } else return;
  g.at = Date.now();
  broadcast({ t: 'game', game: g }, null, entry.room);
}
// games nobody has touched for an hour are cleared away
setInterval(() => { for (const [k, g] of games) if (Date.now() - g.at > 3600e3) games.delete(k); }, 600e3).unref();

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
    send(ws, { t: 'games', games: gameList(entry.room) });
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
        try { ok = /^(main|garden|hall|hall2|common|music|prayer|koshari|sleepover|landing|games|library|cinema|bakery|gym|art|laundry|ahwa|group:\d+|home:\d+)$/.test(room) && await canEnter(entry.user.id, room); } catch (e) { ok = false; }
        if (!ok) return send(ws, { t: 'room:denied', room });
        const from = entry.room;
        if (m.state) entry.state = cleanState(m.state);
        entry.room = room;
        if (from !== room && !stillIn(entry.user.id, from, ws)) broadcast({ t: 'leave', id: entry.user.id }, ws, from);
        send(ws, { t: 'hello', you: entry.user.id, room, people: roster(room).filter(x => x.id !== entry.user.id) });
        send(ws, { t: 'games', games: gameList(room) });
        broadcast({ t: 'join', person: { ...entry.profile, state: entry.state } }, ws, room);
        return;
      }

      // A note on an instrument in the Music Room: everyone else in there hears
      // it. Up to a dozen or so a second (fast enough for a tune, not for spam).
      // the Laundry Room: someone puts a wash on, and everyone in there sees that machine go
      if (m.t === 'machine') {
        if (entry.room !== 'laundry') return;
        const i = Math.round(Number(m.i));
        if (!(i >= 0 && i < 7)) return;
        broadcast({ t: 'machine', id: entry.user.id, i, by: entry.profile.displayName }, ws, entry.room);
        return;
      }
      if (m.t === 'play') {
        if (entry.room !== 'music') return;
        const now = Date.now();
        entry.plays = (entry.plays || []).filter(t => now - t < 1000);
        if (entry.plays.length >= 14) return;
        entry.plays.push(now);
        const RANGE = { piano: [36, 96], guitar: [0, 7], cajon: [0, 1] };
        const r = RANGE[m.i], n = Math.round(Number(m.n));
        if (!r || !(n >= r[0] && n <= r[1])) return;
        broadcast({ t: 'play', id: entry.user.id, i: m.i, n, up: !!m.up }, ws, entry.room);
        return;
      }

      // A move in a game at a table: never throttled (it's one click at a time anyway).
      if (m.t === 'game') {
        const now = Date.now();
        if (now - (entry.lastGame || 0) < 150) return;
        entry.lastGame = now;
        handleGame(ws, entry, m);
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

// to one person, wherever they are (every tab they have open)
function sendToUser(userId, msg) {
  for (const [ws, c] of clients) if (c.user.id === Number(userId)) send(ws, msg);
}

module.exports = { attach, broadcast, sendToUser, updateProfile, onlineCount, roomCounts };
