// Living upstairs: everyone with an account has a room of their own along the
// upstairs hallway. It starts empty; they fill it with furniture from the
// catalogue (public/cafe/furniture.mjs), sleep in their bed and study at
// their desk — alone, or with friends they've let in.
//
// A room's live room id is 'home:<ownerId>'. Who may come in: the owner, the
// people they've invited, and anyone at all if they've left the door open.

const express = require('express');
const { pathToFileURL } = require('url');
const path = require('path');
const kindness = require('./moderation');
const { query } = require('./db');
const auth = require('./auth');
const { rateLimit, cleanText, wrap } = require('./util');
const realtime = require('./realtime');

let lib = null; // the catalogue, an ES module shared with the café
const catalogue = () => lib || (lib = import(pathToFileURL(path.join(__dirname, '..', 'public', 'cafe', 'furniture.mjs')).href));

const roomOf = ownerId => 'home:' + ownerId;
const HOUR = 3600e3;

async function ensureRoom(user) {
  await query(
    `INSERT INTO home_rooms (owner_id, name) VALUES ($1, $2) ON CONFLICT (owner_id) DO NOTHING`,
    [user.id, `${user.display_name}'s room`.slice(0, 40)]);
}

async function canEnterHome(userId, ownerId) {
  if (Number(userId) === Number(ownerId)) return true;
  const { rows } = await query(
    `SELECT r.open, EXISTS (SELECT 1 FROM home_guests g WHERE g.owner_id = r.owner_id AND g.guest_id = $1) AS invited
     FROM home_rooms r WHERE r.owner_id = $2`, [userId, ownerId]);
  return !!(rows[0] && (rows[0].open || rows[0].invited));
}

const ROOM_FIELDS = `r.owner_id AS "ownerId", r.name, r.wall, r.floor, r.open, u.display_name AS "ownerName"`;
async function roomRow(ownerId) {
  const { rows } = await query(`SELECT ${ROOM_FIELDS} FROM home_rooms r JOIN users u ON u.id = r.owner_id WHERE r.owner_id = $1`, [ownerId]);
  return rows[0] || null;
}
const ITEM_FIELDS = 'id, kind, x, y, z, ry, color, image_id AS "imageId", caption';
async function guestsOf(ownerId) {
  const { rows } = await query(
    `SELECT u.id, u.display_name AS "displayName", u.username FROM home_guests g JOIN users u ON u.id = g.guest_id
     WHERE g.owner_id = $1 ORDER BY g.created_at`, [ownerId]);
  return rows;
}
async function statsOf(userId) {
  const { rows } = await query('SELECT focus_minutes AS "focusMinutes", sessions, nights FROM home_stats WHERE user_id = $1', [userId]);
  return rows[0] || { focusMinutes: 0, sessions: 0, nights: 0 };
}

// Shared study sessions (one per room) and each person's own session.
const shared = new Map();  // room -> { by, byId, minutes, end }
const sessions = new Map(); // userId -> { start, end, room }
function sharedIn(room) {
  const s = shared.get(room);
  if (s && s.end < Date.now()) { shared.delete(room); return null; }
  return s || null;
}

// Tell everyone in a room who may still be there (after a guest is removed
// or the door is closed); their café takes them back downstairs.
async function announceAccess(ownerId) {
  const r = await roomRow(ownerId);
  const guests = await guestsOf(ownerId);
  realtime.broadcast({ t: 'home:access', ownerId: Number(ownerId), open: !!(r && r.open), allowed: [Number(ownerId), ...guests.map(g => g.id)] }, null, roomOf(ownerId));
}

const router = express.Router();
const editLimit = rateLimit({ windowMs: 60e3, max: 90, message: 'Easy — the furniture is not going anywhere.' });
const smallLimit = rateLimit({ windowMs: 60e3, max: 20 });

// My room (made the first time it's asked for) and the doors I can go through.
router.get('/home', auth.requireUser, wrap(async (req, res) => {
  await ensureRoom(req.user);
  const mine = await roomRow(req.user.id);
  const { rows } = await query(
    `SELECT ${ROOM_FIELDS}, EXISTS (SELECT 1 FROM home_guests g WHERE g.owner_id = r.owner_id AND g.guest_id = $1) AS invited
     FROM home_rooms r JOIN users u ON u.id = r.owner_id
     WHERE r.owner_id <> $1 AND (r.open OR EXISTS (SELECT 1 FROM home_guests g WHERE g.owner_id = r.owner_id AND g.guest_id = $1))
     ORDER BY invited DESC, r.updated_at DESC LIMIT 40`, [req.user.id]);
  const counts = realtime.roomCounts();
  const here = r => ({ ...r, here: counts[roomOf(r.ownerId)] || 0 });
  res.json({ mine: here(mine), doors: rows.map(here), stats: await statsOf(req.user.id) });
}));

router.get('/home/:ownerId(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const ownerId = Number(req.params.ownerId);
  if (ownerId === req.user.id) await ensureRoom(req.user);
  const room = await roomRow(ownerId);
  if (!room) return res.status(404).json({ error: "That room doesn't exist." });
  if (!(await canEnterHome(req.user.id, ownerId))) return res.status(403).json({ error: "That room's door is closed — ask them to invite you." });
  const { rows: items } = await query(`SELECT ${ITEM_FIELDS} FROM home_items WHERE owner_id = $1 ORDER BY id`, [ownerId]);
  const mine = ownerId === req.user.id;
  res.json({
    room, items, canEdit: mine,
    guests: mine ? await guestsOf(ownerId) : undefined,
    focus: sharedIn(roomOf(ownerId)),
    now: Date.now(), // so the café can count down by the server's clock
    stats: await statsOf(req.user.id),
  });
}));

router.patch('/home', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const { WALLS, FLOORS } = await catalogue();
  await ensureRoom(req.user);
  const r = await roomRow(req.user.id);
  const b = req.body || {};
  const name = b.name !== undefined ? cleanText(b.name, 40) : r.name;
  if (name.length < 2) return res.status(400).json({ error: 'Give your room a name.' });
  if (name !== r.name && !(await kindness.guard(res, name, 'room', req.user))) return;
  const wall = WALLS.includes(b.wall) ? b.wall : r.wall;
  const floor = FLOORS.includes(b.floor) ? b.floor : r.floor;
  const open = typeof b.open === 'boolean' ? b.open : r.open;
  await query('UPDATE home_rooms SET name = $2, wall = $3, floor = $4, open = $5, updated_at = now() WHERE owner_id = $1',
    [req.user.id, name, wall, floor, open]);
  const room = await roomRow(req.user.id);
  realtime.broadcast({ t: 'home:room', room }, null, roomOf(req.user.id));
  if (r.open && !open) await announceAccess(req.user.id);
  res.json({ room });
}));

// Furniture: only the owner moves things in their own room.
async function cleanItem(b, userId, prev = {}) {
  const { BY_KIND, ROOM_SIZE } = await catalogue();
  const kind = b.kind ?? prev.kind;
  const def = BY_KIND.get(kind);
  if (!def) return { error: "We don't have that one." };
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const m = def.wall ? 0.02 : 0.05; // frames hang right against the wall
  const x = num(b.x ?? prev.x, ROOM_SIZE.minX + m, ROOM_SIZE.maxX - m, 0);
  const z = num(b.z ?? prev.z, ROOM_SIZE.minZ + m, ROOM_SIZE.maxZ - m, 0);
  const y = def.onTop ? num(b.y ?? prev.y, 0, 2.2, 0) : def.wall ? num(b.y ?? prev.y, 0.6, 2.6, 1.5) : 0;
  let ry = num(b.ry ?? prev.ry, -100, 100, 0) % (Math.PI * 2);
  const color = def.colors.includes(b.color) ? b.color : def.colors.includes(prev.color) ? prev.color : def.colors[0];
  // a frame's photo has to be one this person uploaded
  let imageId = prev.imageId ?? null;
  let caption = prev.caption || '';
  if (def.picture && b.imageId !== undefined) {
    if (b.imageId === null) imageId = null;
    else {
      const { rows } = await query("SELECT id FROM media WHERE id = $1 AND kind = 'photo' AND created_by = $2", [Number(b.imageId) || 0, userId]);
      if (!rows[0]) return { error: "That picture isn't one of yours." };
      imageId = rows[0].id;
    }
  }
  if (def.picture && b.caption !== undefined) caption = cleanText(b.caption, 80);
  return { kind, x, y, z, ry, color, imageId: def.picture ? imageId : null, caption: def.picture ? caption : '', captionChanged: caption !== (prev.caption || '') };
}

router.post('/home/items', auth.requireUser, editLimit, wrap(async (req, res) => {
  const { MAX_ITEMS } = await catalogue();
  await ensureRoom(req.user);
  const it = await cleanItem(req.body || {}, req.user.id);
  if (it.error) return res.status(400).json({ error: it.error });
  if (it.caption && !(await kindness.guard(res, it.caption, 'frame', req.user))) return;
  const { rows: c } = await query('SELECT count(*)::int AS n FROM home_items WHERE owner_id = $1', [req.user.id]);
  if (c[0].n >= MAX_ITEMS) return res.status(409).json({ error: `Your room is full (${MAX_ITEMS} things). Take something out first.` });
  const { rows } = await query(
    `INSERT INTO home_items (owner_id, kind, x, y, z, ry, color, image_id, caption) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${ITEM_FIELDS}`,
    [req.user.id, it.kind, it.x, it.y, it.z, it.ry, it.color, it.imageId, it.caption]);
  await query('UPDATE home_rooms SET updated_at = now() WHERE owner_id = $1', [req.user.id]);
  realtime.broadcast({ t: 'home:item', op: 'add', item: rows[0] }, null, roomOf(req.user.id));
  res.json({ item: rows[0] });
}));

router.patch('/home/items/:id(\\d+)', auth.requireUser, editLimit, wrap(async (req, res) => {
  const { rows: prev } = await query(`SELECT ${ITEM_FIELDS} FROM home_items WHERE id = $1 AND owner_id = $2`, [Number(req.params.id), req.user.id]);
  if (!prev[0]) return res.status(404).json({ error: "That isn't in your room." });
  const it = await cleanItem({ ...(req.body || {}), kind: prev[0].kind }, req.user.id, prev[0]);
  if (it.error) return res.status(400).json({ error: it.error });
  if (it.captionChanged && it.caption && !(await kindness.guard(res, it.caption, 'frame', req.user))) return;
  const { rows } = await query(
    `UPDATE home_items SET x = $3, y = $4, z = $5, ry = $6, color = $7, image_id = $8, caption = $9 WHERE id = $1 AND owner_id = $2 RETURNING ${ITEM_FIELDS}`,
    [prev[0].id, req.user.id, it.x, it.y, it.z, it.ry, it.color, it.imageId, it.caption]);
  realtime.broadcast({ t: 'home:item', op: 'update', item: rows[0] }, null, roomOf(req.user.id));
  res.json({ item: rows[0] });
}));

router.delete('/home/items/:id(\\d+)', auth.requireUser, editLimit, wrap(async (req, res) => {
  const { rows } = await query('DELETE FROM home_items WHERE id = $1 AND owner_id = $2 RETURNING id', [Number(req.params.id), req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "That isn't in your room." });
  realtime.broadcast({ t: 'home:item', op: 'remove', item: { id: rows[0].id } }, null, roomOf(req.user.id));
  res.json({ ok: true });
}));

// Photos for frames. The upload is the raw picture (mounted before the
// JSON-only API, like the admin uploads); anyone who may come into the room
// may see the pictures on its walls, and nobody else.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX = 4 * 1024 * 1024;
const photoLimit = rateLimit({ windowMs: 10 * 60e3, max: 20, message: 'That is a lot of pictures — give it a few minutes.' });
const photoUpload = express.Router();
photoUpload.use(auth.loadUser, auth.requireUser, photoLimit);
photoUpload.post('/', express.raw({ type: () => true, limit: PHOTO_MAX }), wrap(async (req, res) => {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!PHOTO_TYPES.includes(mime)) return res.status(415).json({ error: 'That needs to be a picture (jpg, png or webp).' });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'The picture was empty.' });
  const { rows } = await query(
    `INSERT INTO media (kind, mime, name, size, bytes, created_by) VALUES ('photo', $1, 'frame', $2, $3, $4) RETURNING id`,
    [mime, req.body.length, req.body, req.user.id]);
  res.json({ id: rows[0].id });
}));

router.get('/home/photo/:id(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query("SELECT mime, created_by, bytes FROM media WHERE id = $1 AND kind = 'photo'", [Number(req.params.id)]);
  if (!rows[0] || !(await canEnterHome(req.user.id, rows[0].created_by))) return res.status(404).end();
  res.set({ 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
  res.end(rows[0].bytes);
}));

// Letting friends in (by username), and taking them off the list.
router.post('/home/guests', auth.requireUser, smallLimit, wrap(async (req, res) => {
  await ensureRoom(req.user);
  const name = String((req.body || {}).username || '').trim().replace(/^@/, '').toLowerCase();
  const { rows } = await query('SELECT id, display_name AS "displayName" FROM users WHERE lower(username) = $1', [name]);
  if (!rows[0]) return res.status(404).json({ error: "There's nobody here by that username." });
  if (rows[0].id === req.user.id) return res.status(400).json({ error: "It's already your room 🌸" });
  const { rows: n } = await query('SELECT count(*)::int AS n FROM home_guests WHERE owner_id = $1', [req.user.id]);
  if (n[0].n >= 30) return res.status(409).json({ error: 'Thirty friends on the list already — take someone off first.' });
  await query('INSERT INTO home_guests (owner_id, guest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, rows[0].id]);
  res.json({ guests: await guestsOf(req.user.id), added: rows[0] });
}));

router.delete('/home/guests/:id(\\d+)', auth.requireUser, smallLimit, wrap(async (req, res) => {
  await query('DELETE FROM home_guests WHERE owner_id = $1 AND guest_id = $2', [req.user.id, Number(req.params.id)]);
  await announceAccess(req.user.id);
  res.json({ guests: await guestsOf(req.user.id) });
}));

// Study sessions. Start one (alone, or for everyone in the room), and when
// the time is really up, the minutes go on your record.
router.post('/home/focus/start', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const b = req.body || {};
  const now = Date.now();
  const m = /^home:(\d+)$/.exec(String(b.room || ''));
  const room = m && (await canEnterHome(req.user.id, m[1])) ? b.room : null;
  if (b.join) {
    const s = room && sharedIn(room);
    if (!s) return res.status(409).json({ error: 'That study session has finished.' });
    sessions.set(req.user.id, { start: now, end: s.end, room });
    return res.json({ end: s.end, minutes: s.minutes, shared: s, now });
  }
  const minutes = Math.round(Number(b.minutes));
  if (!(minutes >= 5 && minutes <= 120)) return res.status(400).json({ error: 'Pick between 5 and 120 minutes.' });
  const end = now + minutes * 60e3;
  sessions.set(req.user.id, { start: now, end, room });
  let s = null;
  if (room && b.together) {
    s = { by: req.user.display_name, byId: req.user.id, minutes, end };
    shared.set(room, s);
    realtime.broadcast({ t: 'home:focus', focus: s, now }, null, room);
  }
  res.json({ end, minutes, shared: s, now });
}));

router.post('/home/focus/stop', auth.requireUser, wrap(async (req, res) => {
  const s = sessions.get(req.user.id);
  sessions.delete(req.user.id);
  if (s && s.room) {
    const sh = shared.get(s.room);
    if (sh && sh.byId === req.user.id) { shared.delete(s.room); realtime.broadcast({ t: 'home:focus', focus: null, by: req.user.display_name }, null, s.room); }
  }
  res.json({ ok: true });
}));

router.post('/home/focus/finish', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const s = sessions.get(req.user.id);
  if (!s) return res.status(409).json({ error: 'There was no study session running.' });
  if (Date.now() < s.end - 10e3) return res.status(409).json({ error: 'Not quite yet — a little longer.' });
  sessions.delete(req.user.id);
  const minutes = Math.max(1, Math.round((s.end - s.start) / 60e3));
  await query(
    `INSERT INTO home_stats (user_id, focus_minutes, sessions) VALUES ($1, $2, 1)
     ON CONFLICT (user_id) DO UPDATE SET focus_minutes = home_stats.focus_minutes + $2, sessions = home_stats.sessions + 1`,
    [req.user.id, minutes]);
  res.json({ minutes, stats: await statsOf(req.user.id) });
}));

// A night's sleep counts once every six hours.
router.post('/home/sleep', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const { rows } = await query('SELECT last_slept FROM home_stats WHERE user_id = $1', [req.user.id]);
  const last = rows[0] && rows[0].last_slept ? new Date(rows[0].last_slept).getTime() : 0;
  const counted = Date.now() - last > 6 * HOUR;
  if (counted) {
    await query(
      `INSERT INTO home_stats (user_id, nights, last_slept) VALUES ($1, 1, now())
       ON CONFLICT (user_id) DO UPDATE SET nights = home_stats.nights + 1, last_slept = now()`, [req.user.id]);
  }
  res.json({ counted, stats: await statsOf(req.user.id) });
}));

module.exports = { router, photoUpload, canEnterHome, roomOf };
