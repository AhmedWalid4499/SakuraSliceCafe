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
const { rateLimit, cleanText, isHexColor, wrap } = require('./util');
const realtime = require('./realtime');

let lib = null; // the catalogue, an ES module shared with the café
const catalogue = () => lib || (lib = import(pathToFileURL(path.join(__dirname, '..', 'public', 'cafe', 'furniture.mjs')).href));

const roomOf = ownerId => 'home:' + ownerId;
const HOUR = 3600e3;

const DOORS = 28; // the doors along the two hallways, 14 each (public/cafe/hall.js SLOTS)
async function ensureRoom(user) {
  await query(
    `INSERT INTO home_rooms (owner_id, name) VALUES ($1, $2) ON CONFLICT (owner_id) DO NOTHING`,
    [user.id, `${user.display_name}'s room`.slice(0, 40)]);
  // and its own door in the hallway: the first free one (two people moving in at
  // once can't both get it — the unique index says no, and the next visit tries again)
  await query(
    `UPDATE home_rooms SET door = (SELECT s FROM generate_series(0, $2 - 1) s WHERE NOT EXISTS (SELECT 1 FROM home_rooms h WHERE h.door = s) ORDER BY s LIMIT 1)
     WHERE owner_id = $1 AND door IS NULL`, [user.id, DOORS]).catch(() => {});
}

async function canEnterHome(userId, ownerId) {
  if (Number(userId) === Number(ownerId)) return true;
  const { rows } = await query(
    `SELECT r.open, EXISTS (SELECT 1 FROM home_guests g WHERE g.owner_id = r.owner_id AND g.guest_id = $1)
       OR EXISTS (SELECT 1 FROM home_partners p WHERE p.owner_id = r.owner_id AND p.partner_id = $1) AS invited
     FROM home_rooms r WHERE r.owner_id = $2`, [userId, ownerId]);
  return !!(rows[0] && (rows[0].open || rows[0].invited));
}
// Is this person the flat's bedroom partner (sharing it with its owner)?
async function isPartner(ownerId, userId) {
  const { rows } = await query('SELECT 1 FROM home_partners WHERE owner_id = $1 AND partner_id = $2', [Number(ownerId), Number(userId)]);
  return rows.length > 0;
}
// May this person change this flat — its furniture, its name and colours? Its owner, or their partner.
async function mayEdit(ownerId, userId) {
  return Number(ownerId) === Number(userId) || isPartner(ownerId, userId);
}
// The flat a change is for: the one asked for (ownerId), if you may change it; otherwise your own.
async function flatFor(req) {
  const want = Number((req.body && req.body.ownerId) ?? (req.query && req.query.ownerId)) || req.user.id;
  return want !== req.user.id && (await isPartner(want, req.user.id)) ? want : req.user.id;
}

// (a flat shared with a bedroom partner: their name too, and who they are)
const ROOM_FIELDS = `r.owner_id AS "ownerId", r.name, r.wall, r.wallpaper, r.floor, r.open, r.door, u.display_name AS "ownerName",
  (SELECT pu.display_name FROM home_partners hp JOIN users pu ON pu.id = hp.partner_id WHERE hp.owner_id = r.owner_id) AS "partnerName",
  (SELECT hp.partner_id FROM home_partners hp WHERE hp.owner_id = r.owner_id) AS "partnerId"`;
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
  // every door along the hallway, each in its own place; you can go in where
  // the door's open or you're invited (a shut door just has its resident's name)
  const { rows } = await query(
    `SELECT ${ROOM_FIELDS}, EXISTS (SELECT 1 FROM home_guests g WHERE g.owner_id = r.owner_id AND g.guest_id = $1)
       OR EXISTS (SELECT 1 FROM home_partners p WHERE p.owner_id = r.owner_id AND p.partner_id = $1) AS invited,
       EXISTS (SELECT 1 FROM home_partners p WHERE p.owner_id = r.owner_id AND p.partner_id = $1) AS shared
     FROM home_rooms r JOIN users u ON u.id = r.owner_id
     WHERE r.owner_id <> $1 AND r.door IS NOT NULL
     ORDER BY r.door`, [req.user.id]);
  const counts = realtime.roomCounts();
  const both = r => (r.partnerName ? `${r.ownerName} & ${r.partnerName}` : r.ownerName);
  const here = r => ({ ...r, ownerName: both(r), here: counts[roomOf(r.ownerId)] || 0 });
  const door = r => (r.open || r.invited
    ? { ...here(r), canEnter: true }
    : { door: r.door, ownerName: both(r), canEnter: false, here: 0 });
  const { rows: g } = await query('SELECT count(*)::int AS n FROM home_gifts WHERE to_id = $1 AND opened_at IS NULL', [req.user.id]);
  res.json({ mine: here(mine), doors: rows.map(door), stats: await statsOf(req.user.id), giftsWaiting: g[0].n });
}));

router.get('/home/:ownerId(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const ownerId = Number(req.params.ownerId);
  if (ownerId === req.user.id) await ensureRoom(req.user);
  const room = await roomRow(ownerId);
  if (!room) return res.status(404).json({ error: "That room doesn't exist." });
  if (!(await canEnterHome(req.user.id, ownerId))) return res.status(403).json({ error: "That room's door is closed — ask them to invite you." });
  const { rows: items } = await query(`SELECT ${ITEM_FIELDS} FROM home_items WHERE owner_id = $1 ORDER BY id`, [ownerId]);
  const mine = ownerId === req.user.id;
  const partner = !mine && (await isPartner(ownerId, req.user.id)); // sharing it: you can change things too
  res.json({
    room, items, canEdit: mine || partner, shared: partner,
    pet: await petOf(ownerId), snacks: await snacksOf(ownerId), gifts: await giftsFor(ownerId), movie: movieIn(roomOf(ownerId)),
    guests: mine ? await guestsOf(ownerId) : undefined,
    focus: sharedIn(roomOf(ownerId)),
    now: Date.now(), // so the café can count down by the server's clock
    stats: await statsOf(req.user.id),
  });
}));

router.patch('/home', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const { WALLS, FLOORS, WALLPAPERS } = await catalogue();
  await ensureRoom(req.user);
  const flat = await flatFor(req); // yours, or the one you share
  const r = await roomRow(flat);
  const b = req.body || {};
  const name = b.name !== undefined ? cleanText(b.name, 40) : r.name;
  if (name.length < 2) return res.status(400).json({ error: 'Give your room a name.' });
  if (name !== r.name && !(await kindness.guard(res, name, 'room', req.user))) return;
  const wall = WALLS.includes(b.wall) ? b.wall : r.wall;
  const floor = FLOORS.includes(b.floor) ? b.floor : r.floor;
  const open = typeof b.open === 'boolean' ? b.open : r.open;
  const wallpaper = WALLPAPERS.includes(b.wallpaper) ? b.wallpaper : r.wallpaper;
  await query('UPDATE home_rooms SET name = $2, wall = $3, floor = $4, open = $5, wallpaper = $6, updated_at = now() WHERE owner_id = $1',
    [flat, name, wall, floor, open, wallpaper]);
  const room = await roomRow(flat);
  realtime.broadcast({ t: 'home:room', room }, null, roomOf(flat));
  if (r.open && !open) await announceAccess(flat);
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
      const { rows } = await query("SELECT id FROM media WHERE id = $1 AND kind = 'photo' AND created_by = ANY($2::int[])", [Number(b.imageId) || 0, [].concat(userId)]);
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
  const flat = await flatFor(req);
  const it = await cleanItem(req.body || {}, [req.user.id, flat]);
  if (it.error) return res.status(400).json({ error: it.error });
  if (it.caption && !(await kindness.guard(res, it.caption, 'frame', req.user))) return;
  const { rows: c } = await query('SELECT count(*)::int AS n FROM home_items WHERE owner_id = $1', [flat]);
  if (c[0].n >= MAX_ITEMS) return res.status(409).json({ error: `Your room is full (${MAX_ITEMS} things). Take something out first.` });
  const { rows } = await query(
    `INSERT INTO home_items (owner_id, kind, x, y, z, ry, color, image_id, caption) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${ITEM_FIELDS}`,
    [flat, it.kind, it.x, it.y, it.z, it.ry, it.color, it.imageId, it.caption]);
  await query('UPDATE home_rooms SET updated_at = now() WHERE owner_id = $1', [flat]);
  realtime.broadcast({ t: 'home:item', op: 'add', item: rows[0] }, null, roomOf(flat));
  res.json({ item: rows[0] });
}));

router.patch('/home/items/:id(\\d+)', auth.requireUser, editLimit, wrap(async (req, res) => {
  const { rows: prev } = await query(`SELECT ${ITEM_FIELDS}, owner_id AS "ownerId" FROM home_items WHERE id = $1`, [Number(req.params.id)]);
  if (!prev[0] || !(await mayEdit(prev[0].ownerId, req.user.id))) return res.status(404).json({ error: "That isn't in your room." });
  const flat = prev[0].ownerId;
  const it = await cleanItem({ ...(req.body || {}), kind: prev[0].kind }, [req.user.id, flat], prev[0]);
  if (it.error) return res.status(400).json({ error: it.error });
  if (it.captionChanged && it.caption && !(await kindness.guard(res, it.caption, 'frame', req.user))) return;
  const { rows } = await query(
    `UPDATE home_items SET x = $3, y = $4, z = $5, ry = $6, color = $7, image_id = $8, caption = $9 WHERE id = $1 AND owner_id = $2 RETURNING ${ITEM_FIELDS}`,
    [prev[0].id, flat, it.x, it.y, it.z, it.ry, it.color, it.imageId, it.caption]);
  realtime.broadcast({ t: 'home:item', op: 'update', item: rows[0] }, null, roomOf(flat));
  res.json({ item: rows[0] });
}));

router.delete('/home/items/:id(\\d+)', auth.requireUser, editLimit, wrap(async (req, res) => {
  const { rows: it } = await query('SELECT owner_id FROM home_items WHERE id = $1', [Number(req.params.id)]);
  if (!it[0] || !(await mayEdit(it[0].owner_id, req.user.id))) return res.status(404).json({ error: "That isn't in your room." });
  const { rows } = await query('DELETE FROM home_items WHERE id = $1 RETURNING id', [Number(req.params.id)]);
  realtime.broadcast({ t: 'home:item', op: 'remove', item: { id: rows[0].id } }, null, roomOf(it[0].owner_id));
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
  if (!rows[0]) return res.status(404).end();
  let may = await canEnterHome(req.user.id, rows[0].created_by);
  if (!may) { // (a partner's photo, hanging in the flat they share)
    const { rows: hung } = await query('SELECT DISTINCT owner_id FROM home_items WHERE image_id = $1', [Number(req.params.id)]);
    for (const h of hung) if (!may) may = await canEnterHome(req.user.id, h.owner_id);
  }
  if (!may) return res.status(404).end();
  res.set({ 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
  res.end(rows[0].bytes);
}));

// ── the cat
async function petOf(ownerId) {
  const { rows } = await query('SELECT name, coat FROM home_pets WHERE owner_id = $1', [ownerId]);
  return rows[0] || null;
}
router.put('/home/pet', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const { COATS } = await catalogue();
  const b = req.body || {};
  const name = cleanText(b.name, 24);
  if (name.length < 1) return res.status(400).json({ error: 'Every cat needs a name.' });
  const coat = Object.keys(COATS).includes(b.coat) ? b.coat : 'ginger';
  const prev = await petOf(req.user.id);
  if ((!prev || prev.name !== name) && !(await kindness.guard(res, name, 'name', req.user))) return;
  await ensureRoom(req.user);
  await query(`INSERT INTO home_pets (owner_id, name, coat) VALUES ($1, $2, $3)
    ON CONFLICT (owner_id) DO UPDATE SET name = EXCLUDED.name, coat = EXCLUDED.coat`, [req.user.id, name, coat]);
  const pet = await petOf(req.user.id);
  realtime.broadcast({ t: 'home:pet', pet }, null, roomOf(req.user.id));
  res.json({ pet });
}));
router.delete('/home/pet', auth.requireUser, smallLimit, wrap(async (req, res) => {
  await query('DELETE FROM home_pets WHERE owner_id = $1', [req.user.id]);
  realtime.broadcast({ t: 'home:pet', pet: null }, null, roomOf(req.user.id));
  res.json({ pet: null });
}));

// ── the snack shelf: pastries from the counter downstairs, kept for later
async function snacksOf(ownerId) {
  const { rows } = await query('SELECT pastry_id FROM home_snacks WHERE owner_id = $1 ORDER BY id', [ownerId]);
  return rows.map(r => r.pastry_id);
}
async function pastryIds() {
  const { rows } = await query("SELECT value FROM site_content WHERE key = 'counter.pastries'");
  const list = rows[0] && Array.isArray(rows[0].value) ? rows[0].value : [];
  return new Set(list.filter(p => p && p.id).map(p => String(p.id)));
}
async function inRoom(req, res) { // the room in the URL, and may this person be in it?
  const ownerId = Number(req.params.ownerId);
  if (!(await roomRow(ownerId))) { res.status(404).json({ error: "That room doesn't exist." }); return null; }
  if (!(await canEnterHome(req.user.id, ownerId))) { res.status(403).json({ error: "You're not in that room." }); return null; }
  return ownerId;
}
router.post('/home/:ownerId(\\d+)/snacks', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const { SNACKS_MAX } = await catalogue();
  const ownerId = await inRoom(req, res);
  if (!ownerId) return;
  const id = String((req.body || {}).pastry || '');
  if (!(await pastryIds()).has(id)) return res.status(400).json({ error: "That isn't from the counter downstairs." });
  const { rows } = await query('SELECT count(*)::int AS n FROM home_snacks WHERE owner_id = $1', [ownerId]);
  if (rows[0].n >= SNACKS_MAX) return res.status(409).json({ error: `The snack shelf is full (${SNACKS_MAX}). Have one first 🍡` });
  await query('INSERT INTO home_snacks (owner_id, pastry_id) VALUES ($1, $2)', [ownerId, id]);
  const snacks = await snacksOf(ownerId);
  realtime.broadcast({ t: 'home:snacks', snacks }, null, roomOf(ownerId));
  res.json({ snacks });
}));
router.post('/home/:ownerId(\\d+)/snacks/take', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const ownerId = await inRoom(req, res);
  if (!ownerId) return;
  const id = String((req.body || {}).pastry || '');
  const { rows } = await query(
    'DELETE FROM home_snacks WHERE id = (SELECT id FROM home_snacks WHERE owner_id = $1 AND pastry_id = $2 ORDER BY id LIMIT 1) RETURNING pastry_id', [ownerId, id]);
  if (!rows[0]) return res.status(409).json({ error: "Someone's already eaten that one 🍡" });
  const snacks = await snacksOf(ownerId);
  realtime.broadcast({ t: 'home:snacks', snacks }, null, roomOf(ownerId));
  res.json({ pastry: rows[0].pastry_id, snacks });
}));

// ── film night: a YouTube video everyone in the room watches together. The
// room keeps what's on and when it started; each café works out how far in it is.
const movies = new Map(); // room -> { videoId, title, by, byId, startedAt }
function movieIn(room) {
  const m = movies.get(room);
  if (m && Date.now() - m.startedAt > 6 * HOUR) { movies.delete(room); return null; }
  return m || null;
}
function youtubeId(url) {
  const s = String(url || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
// A playlist link (youtube.com/playlist?list=…, or a video in a playlist) — or just its id.
function playlistId(url) {
  const s = String(url || '').trim();
  if (/^(PL|UU|LL|FL|OL|RD)[\w-]{10,60}$/.test(s)) return s;
  const m = s.match(/[?&]list=([\w-]{10,64})/);
  return m ? m[1] : null;
}
// What a link puts on the screen: a playlist (played in order, then round again) or one video.
function youtubeLink(url) {
  const list = playlistId(url);
  if (list) return { list, videoId: null };
  const videoId = youtubeId(url);
  return videoId ? { list: null, videoId } : null;
}
async function videoTitle(id, list = null) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    const page = list ? `https://www.youtube.com/playlist?list=${list}` : `https://www.youtube.com/watch?v=${id}`;
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(page)}`, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return '';
    return cleanText((await r.json()).title, 80);
  } catch (e) { return ''; }
}
router.post('/home/:ownerId(\\d+)/movie', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const ownerId = await inRoom(req, res);
  if (!ownerId) return;
  const link = youtubeLink((req.body || {}).url);
  if (!link) return res.status(400).json({ error: "That doesn't look like a YouTube link — paste the address of a video or a playlist." });
  const movie = {
    ...link, title: (await videoTitle(link.videoId, link.list)) || (link.list ? 'a playlist' : 'a film'),
    by: req.user.display_name, byId: req.user.id, startedAt: Date.now(),
  };
  movies.set(roomOf(ownerId), movie);
  tvPos.delete(roomOf(ownerId));
  realtime.broadcast({ t: 'home:movie', movie, now: Date.now() }, null, roomOf(ownerId));
  res.json({ movie, now: Date.now() });
}));
router.delete('/home/:ownerId(\\d+)/movie', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const ownerId = await inRoom(req, res);
  if (!ownerId) return;
  movies.delete(roomOf(ownerId));
  realtime.broadcast({ t: 'home:movie', movie: null, by: req.user.display_name }, null, roomOf(ownerId));
  res.json({ movie: null });
}));

// ── where a playlist is up to, in each room. A playlist's videos have their
// own lengths, which only the players know, so the people watching tell us
// (every few seconds) which video and how far in — the first one to report
// keeps the job while they're watching — and anyone who comes in later picks
// it up from there. ('common' is the Common room; 'home:<id>' a resident's room.)
const tvPos = new Map(); // room -> { list, index, t, at, by }
const TV_ROOM = /^(common|sleepover|cinema|ahwa|home:\d+)$/;
async function mayWatch(userId, room) {
  if (['common', 'sleepover', 'cinema', 'ahwa'].includes(room)) return true;
  const m = /^home:(\d+)$/.exec(room);
  return !!m && canEnterHome(userId, Number(m[1]));
}
router.get('/tv/:room', auth.requireUser, wrap(async (req, res) => {
  const room = String(req.params.room);
  if (!TV_ROOM.test(room) || !(await mayWatch(req.user.id, room))) return res.status(403).json({ error: "You're not in that room." });
  const pos = tvPos.get(room);
  res.json({ pos: pos && Date.now() - pos.at < 6 * HOUR ? pos : null, now: Date.now() });
}));
router.post('/tv/pos', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const b = req.body || {};
  const room = String(b.room || '');
  if (!TV_ROOM.test(room) || !(await mayWatch(req.user.id, room))) return res.status(403).json({ error: "You're not in that room." });
  const list = playlistId(b.list);
  if (!list) return res.status(400).json({ error: 'Which playlist?' });
  const cur = tvPos.get(room);
  const fresh = !cur || cur.list !== list || cur.by === req.user.id || Date.now() - cur.at > 30e3;
  if (fresh) tvPos.set(room, { list, index: Math.max(0, Math.min(5000, Math.floor(Number(b.index) || 0))), t: Math.max(0, Math.min(36000, Number(b.t) || 0)), at: Date.now(), by: req.user.id });
  res.json({ ok: true, kept: fresh });
}));

// The Sleepover Room's TV (the second floor): like a flat's, anyone in the
// room can put something on — or turn it off — for everyone there.
router.get('/tv/sleepover/movie', auth.requireUser, wrap(async (_req, res) => {
  res.json({ movie: movieIn('sleepover'), now: Date.now() });
}));
router.post('/tv/sleepover/movie', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const link = youtubeLink((req.body || {}).url);
  if (!link) return res.status(400).json({ error: "That doesn't look like a YouTube link — paste the address of a video or a playlist." });
  const movie = {
    ...link, title: (await videoTitle(link.videoId, link.list)) || (link.list ? 'a playlist' : 'a film'),
    by: req.user.display_name, byId: req.user.id, startedAt: Date.now(),
  };
  movies.set('sleepover', movie);
  tvPos.delete('sleepover');
  realtime.broadcast({ t: 'home:movie', movie, now: Date.now() }, null, 'sleepover');
  res.json({ movie, now: Date.now() });
}));
router.delete('/tv/sleepover/movie', auth.requireUser, smallLimit, wrap(async (req, res) => {
  movies.delete('sleepover');
  realtime.broadcast({ t: 'home:movie', movie: null, by: req.user.display_name }, null, 'sleepover');
  res.json({ movie: null });
}));

// The Common room's TV: a playlist (or a video) the café's owner chooses,
// on for everyone who comes in (site_content 'common.tv').
// For the admin page: every flat, its door, whose it is, how much is in it.
router.get('/admin/homes', auth.requireAdmin, wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT r.owner_id AS "ownerId", r.name, r.door, r.open, u.display_name AS "ownerName", u.username,
            (SELECT count(*)::int FROM home_items i WHERE i.owner_id = r.owner_id) AS items
     FROM home_rooms r JOIN users u ON u.id = r.owner_id
     ORDER BY r.door NULLS LAST, r.created_at`);
  res.json({ homes: rows, doors: DOORS });
}));

// The owner moves a flat to another door upstairs (0–27); whoever lives
// there swaps to the flat's old door.
router.put('/admin/home/:ownerId(\\d+)/door', auth.requireAdmin, wrap(async (req, res) => {
  const ownerId = Number(req.params.ownerId), door = Number(req.body.door);
  if (!Number.isInteger(door) || door < 0 || door >= DOORS) return res.status(400).json({ error: `Doors go from 0 to ${DOORS - 1}.` });
  const flat = await roomRow(ownerId);
  if (!flat) return res.status(404).json({ error: "That flat doesn't exist yet." });
  const { rows } = await query('SELECT owner_id FROM home_rooms WHERE door = $1 AND owner_id <> $2', [door, ownerId]);
  await query('UPDATE home_rooms SET door = NULL WHERE owner_id = $1', [ownerId]);
  if (rows[0]) await query('UPDATE home_rooms SET door = $2 WHERE owner_id = $1', [rows[0].owner_id, flat.door]);
  await query('UPDATE home_rooms SET door = $2 WHERE owner_id = $1', [ownerId, door]);
  res.json({ ok: true, door, swappedWith: rows[0] ? rows[0].owner_id : null });
}));

router.put('/admin/common/tv', auth.requireAdmin, wrap(async (req, res) => {
  const url = String((req.body || {}).url || '').trim();
  let value = { url: '', list: null, videoId: null, title: '' };
  if (url) {
    const link = youtubeLink(url);
    if (!link) return res.status(400).json({ error: "That doesn't look like a YouTube link — paste the address of a playlist or a video." });
    value = { url: url.slice(0, 300), ...link, title: (await videoTitle(link.videoId, link.list)) || (link.list ? 'the Common room playlist' : 'a film'), setAt: Date.now() };
  }
  await require('./media').setContent('common.tv', value, req.user.id, "The Common room TV (upstairs, off the hallway): a YouTube playlist or video that plays for everyone. Set it from the TV in the Common room.");
  tvPos.delete('common');
  res.json({ tv: value });
}));

// ── presents: send a friend a piece of furniture or a drink, with a note. It
// waits, wrapped, by their door until they open it.
const GIFT_FIELDS = `g.id, g.item_kind AS "itemKind", g.color, g.drink, g.note, g.created_at AS "createdAt",
  f.display_name AS "fromName", t.display_name AS "toName"`;
async function giftsFor(ownerId) {
  const { rows } = await query(
    `SELECT ${GIFT_FIELDS} FROM home_gifts g LEFT JOIN users f ON f.id = g.from_id JOIN users t ON t.id = g.to_id
     WHERE g.to_id = $1 AND g.opened_at IS NULL ORDER BY g.id LIMIT 8`, [ownerId]);
  return rows.map(r => ({ ...r, fromName: r.fromName || 'someone' }));
}
router.post('/home/gifts', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const { BY_KIND } = await catalogue();
  const b = req.body || {};
  const name = String(b.to || '').trim().replace(/^@/, '').toLowerCase();
  const { rows: to } = await query('SELECT id, display_name AS "displayName" FROM users WHERE lower(username) = $1', [name]);
  if (!to[0]) return res.status(404).json({ error: "There's nobody here by that username." });
  if (to[0].id === req.user.id) return res.status(400).json({ error: "That's you! Treat yourself in the Decorate panel 🌸" });
  let itemKind = null, color = null, drink = null;
  if (b.item) {
    const def = BY_KIND.get(b.item.kind);
    if (!def) return res.status(400).json({ error: "We don't have that one." });
    itemKind = def.kind;
    color = def.colors.includes(b.item.color) ? b.item.color : def.colors[0];
  } else if (b.drink) {
    const id = cleanText(b.drink.id, 60), dname = cleanText(b.drink.name, 60);
    if (!id || !dname) return res.status(400).json({ error: 'Pick a drink.' });
    drink = { id, name: dname, color: isHexColor(b.drink.color) ? b.drink.color : '#d9b48f' };
  } else return res.status(400).json({ error: 'Pick something to send.' });
  const note = cleanText(b.note, 140);
  if (note && !(await kindness.guard(res, note, 'gift', req.user))) return;
  const { rows: n } = await query("SELECT count(*)::int AS n FROM home_gifts WHERE from_id = $1 AND created_at > now() - interval '1 day'", [req.user.id]);
  if (n[0].n >= 10) return res.status(429).json({ error: "That's ten presents today — so generous! Send more tomorrow 🎁" });
  const { rows: w } = await query('SELECT count(*)::int AS n FROM home_gifts WHERE to_id = $1 AND opened_at IS NULL', [to[0].id]);
  if (w[0].n >= 8) return res.status(409).json({ error: `${to[0].displayName} has a pile of presents waiting already — let them open some first.` });
  const { rows } = await query(
    'INSERT INTO home_gifts (from_id, to_id, item_kind, color, drink, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [req.user.id, to[0].id, itemKind, color, drink ? JSON.stringify(drink) : null, note]);
  const gifts = await giftsFor(to[0].id);
  realtime.broadcast({ t: 'home:gifts', ownerId: to[0].id, gifts }, null, roomOf(to[0].id));
  realtime.sendToUser(to[0].id, { t: 'gift', from: req.user.display_name });
  res.json({ ok: true, id: rows[0].id, to: to[0].displayName });
}));
router.post('/home/gifts/:id(\\d+)/open', auth.requireUser, editLimit, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT ${GIFT_FIELDS} FROM home_gifts g LEFT JOIN users f ON f.id = g.from_id JOIN users t ON t.id = g.to_id
     WHERE g.id = $1 AND g.to_id = $2 AND g.opened_at IS NULL`, [Number(req.params.id), req.user.id]);
  const gift = rows[0];
  if (!gift) return res.status(404).json({ error: "That present isn't yours to open (or it's open already)." });
  let item = null;
  if (gift.itemKind) {
    const { MAX_ITEMS } = await catalogue();
    const { rows: c } = await query('SELECT count(*)::int AS n FROM home_items WHERE owner_id = $1', [req.user.id]);
    if (c[0].n >= MAX_ITEMS) return res.status(409).json({ error: `Your room is full (${MAX_ITEMS} things) — take something out to make space for it.` });
    const it = await cleanItem({ ...(req.body || {}), kind: gift.itemKind, color: gift.color }, req.user.id);
    if (it.error) return res.status(400).json({ error: it.error });
    const { rows: ins } = await query(
      `INSERT INTO home_items (owner_id, kind, x, y, z, ry, color) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${ITEM_FIELDS}`,
      [req.user.id, it.kind, it.x, it.y, it.z, it.ry, it.color]);
    item = ins[0];
    realtime.broadcast({ t: 'home:item', op: 'add', item }, null, roomOf(req.user.id));
  }
  await query('UPDATE home_gifts SET opened_at = now() WHERE id = $1', [gift.id]);
  const gifts = await giftsFor(req.user.id);
  realtime.broadcast({ t: 'home:gifts', ownerId: req.user.id, gifts }, null, roomOf(req.user.id));
  res.json({ gift: { ...gift, fromName: gift.fromName || 'someone' }, item, gifts });
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

// ── bedroom partners: ask someone to share your flat; they say yes (or no)
async function partnership(userId) {
  const { rows } = await query(
    `SELECT p.owner_id AS "ownerId", p.partner_id AS "partnerId", o.display_name AS "ownerName", q.display_name AS "partnerName"
     FROM home_partners p JOIN users o ON o.id = p.owner_id JOIN users q ON q.id = p.partner_id
     WHERE p.owner_id = $1 OR p.partner_id = $1`, [userId]);
  return rows[0] || null;
}
router.get('/home/partner', auth.requireUser, wrap(async (req, res) => {
  const p = await partnership(req.user.id);
  const { rows: invites } = await query(
    `SELECT i.owner_id AS "ownerId", u.display_name AS "fromName", u.username FROM home_partner_invites i JOIN users u ON u.id = i.owner_id
     WHERE i.to_id = $1 ORDER BY i.created_at DESC`, [req.user.id]);
  const { rows: sent } = await query(
    `SELECT i.to_id AS "toId", u.display_name AS "toName" FROM home_partner_invites i JOIN users u ON u.id = i.to_id WHERE i.owner_id = $1`, [req.user.id]);
  res.json({
    partner: p && (p.ownerId === req.user.id ? { id: p.partnerId, name: p.partnerName, flat: p.ownerId, role: 'owner' } : { id: p.ownerId, name: p.ownerName, flat: p.ownerId, role: 'partner' }),
    invites, sent: sent[0] || null,
  });
}));
router.post('/home/partner/invite', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const username = String((req.body || {}).username || '').trim().toLowerCase().replace(/^@/, '').slice(0, 24);
  const { rows: to } = await query('SELECT id, display_name AS "displayName" FROM users WHERE lower(username) = $1', [username]);
  if (!to[0]) return res.status(404).json({ error: "There's nobody here by that username." });
  if (to[0].id === req.user.id) return res.status(400).json({ error: "That's you! Ask someone else to share your room 💞" });
  if (await partnership(req.user.id)) return res.status(409).json({ error: 'You already share a room. End that first, from your room’s settings.' });
  if (await partnership(to[0].id)) return res.status(409).json({ error: `${to[0].displayName} already shares a room with someone.` });
  await ensureRoom(req.user);
  await query('DELETE FROM home_partner_invites WHERE owner_id = $1', [req.user.id]); // one ask at a time
  await query('INSERT INTO home_partner_invites (owner_id, to_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, to[0].id]);
  realtime.sendToUser(to[0].id, { t: 'partner:invite', from: req.user.display_name, ownerId: req.user.id });
  res.json({ ok: true, to: to[0] });
}));
router.post('/home/partner/accept', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const ownerId = Number((req.body || {}).ownerId);
  const { rows } = await query('SELECT 1 FROM home_partner_invites WHERE owner_id = $1 AND to_id = $2', [ownerId, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'That invitation isn’t there any more.' });
  if (await partnership(req.user.id)) return res.status(409).json({ error: 'You already share a room with someone.' });
  if (await partnership(ownerId)) return res.status(409).json({ error: 'They’re already sharing their room with someone else.' });
  await query('INSERT INTO home_partners (owner_id, partner_id) VALUES ($1, $2)', [ownerId, req.user.id]);
  await query('DELETE FROM home_partner_invites WHERE owner_id IN ($1, $2) OR to_id IN ($1, $2)', [ownerId, req.user.id]);
  realtime.sendToUser(ownerId, { t: 'partner:accepted', name: req.user.display_name });
  res.json({ partner: await partnership(req.user.id) });
}));
router.post('/home/partner/decline', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const ownerId = Number((req.body || {}).ownerId);
  const { rows } = await query('DELETE FROM home_partner_invites WHERE owner_id = $1 AND to_id = $2 RETURNING owner_id', [ownerId, req.user.id]);
  if (rows[0]) realtime.sendToUser(ownerId, { t: 'partner:declined', name: req.user.display_name });
  res.json({ ok: true });
}));
router.delete('/home/partner', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const p = await partnership(req.user.id);
  await query('DELETE FROM home_partner_invites WHERE owner_id = $1', [req.user.id]); // (and any ask you'd sent)
  if (!p) return res.json({ ok: true });
  await query('DELETE FROM home_partners WHERE owner_id = $1', [p.ownerId]);
  const other = p.ownerId === req.user.id ? p.partnerId : p.ownerId;
  realtime.sendToUser(other, { t: 'partner:ended', name: req.user.display_name });
  res.json({ ok: true });
}));

module.exports = { router, photoUpload, canEnterHome, roomOf };
