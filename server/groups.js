// Groups and the second floor. A group is a few people who share a room
// upstairs: their own notes on the walls, their own quiet chat. Groups can
// be private (join with an invite code) or public (anyone can join).

const crypto = require('crypto');
const express = require('express');
const kindness = require('./moderation');
const { query } = require('./db');
const auth = require('./auth');
const { rateLimit, cleanText, isHexColor, wrap } = require('./util');
const realtime = require('./realtime');

const router = express.Router();
const writeLimit = rateLimit({ windowMs: 60e3, max: 10 });

const newCode = () => crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7).toUpperCase();

const GROUP_FIELDS = `g.id, g.name, g.description, g.color, g.is_public AS "isPublic", g.created_at AS "createdAt",
  g.owner_id AS "ownerId", (SELECT count(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS members`;

// The rooms everyone signed in can be in: the ground floor, the hallway upstairs and the roof garden.
// (one list, used by the chat, the live room and saved places too — a room missing here can't be joined)
const PUBLIC_ROOMS = ['main', 'garden', 'hall', 'common', 'music', 'prayer', 'koshari', 'hall2', 'sleepover',
  'landing', 'games', 'library', 'cinema', 'bakery', 'gym', 'art', 'laundry', 'ahwa', 'tent',
  'hammam', 'studio', 'tearoom', 'playroom', 'post', 'felucca'];
const ROOM_RE = new RegExp(`^(${PUBLIC_ROOMS.join('|')}|group:\\d+|home:\\d+)$`);

// Is this user allowed in this room? The public rooms are open to everyone signed in.
async function canEnter(userId, room) {
  if (PUBLIC_ROOMS.includes(room)) return true;
  const h = /^home:(\d+)$/.exec(room || '');
  if (h) return require('./homes').canEnterHome(userId, Number(h[1])); // someone's own room upstairs
  const m = /^group:(\d+)$/.exec(room || '');
  if (!m) return false;
  const { rows } = await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [Number(m[1]), userId]);
  return rows.length > 0;
}

function roomFromQuery(req) {
  const r = String(req.query.room || req.body?.room || 'main');
  return ROOM_RE.test(r) ? r : 'main';
}

// My groups (with the invite code, since I'm in them) + public ones to browse.
router.get('/groups', auth.requireUser, wrap(async (req, res) => {
  const mine = await query(
    `SELECT ${GROUP_FIELDS}, g.invite_code AS "inviteCode", gm.role
     FROM groups g JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
     ORDER BY gm.joined_at DESC`, [req.user.id]);
  const open = await query(
    `SELECT ${GROUP_FIELDS} FROM groups g
     WHERE g.is_public AND NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $1)
     ORDER BY g.created_at DESC LIMIT 40`, [req.user.id]);
  const counts = realtime.roomCounts();
  const here = g => ({ ...g, here: counts['group:' + g.id] || 0 });
  res.json({ mine: mine.rows.map(here), open: open.rows.map(here), garden: counts.garden || 0 });
}));

router.post('/groups', auth.requireUser, writeLimit, wrap(async (req, res) => {
  const name = cleanText(req.body.name, 40);
  if (name.length < 2) return res.status(400).json({ error: 'Give your group a name.' });
  if (!(await kindness.guard(res, [name, cleanText(req.body.description, 160)].filter(Boolean).join(' — '), 'group', req.user))) return;
  const owned = await query('SELECT count(*)::int AS n FROM groups WHERE owner_id = $1', [req.user.id]);
  if (owned.rows[0].n >= 10 && !req.user.is_admin) return res.status(429).json({ error: 'You already look after ten groups — that\'s plenty of tables.' });
  const color = isHexColor(req.body.color) ? req.body.color : '#d4678a';
  let row;
  for (let i = 0; i < 5 && !row; i++) {
    try {
      const { rows } = await query(
        `INSERT INTO groups (name, description, color, is_public, invite_code, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, cleanText(req.body.description, 160), color, !!req.body.isPublic, newCode(), req.user.id]);
      row = rows[0];
    } catch (e) { if (e.code !== '23505') throw e; } // invite code clash: try another
  }
  await query("INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')", [row.id, req.user.id]);
  const { rows } = await query(`SELECT ${GROUP_FIELDS}, g.invite_code AS "inviteCode", 'owner' AS role FROM groups g WHERE g.id = $1`, [row.id]);
  res.status(201).json({ group: rows[0] });
}));

// Join with a code (private) or by id (public).
router.post('/groups/join', auth.requireUser, writeLimit, wrap(async (req, res) => {
  let g;
  if (req.body.code) {
    const { rows } = await query('SELECT id FROM groups WHERE invite_code = $1', [cleanText(req.body.code, 12).toUpperCase()]);
    g = rows[0];
    if (!g) return res.status(404).json({ error: 'No group has that invite code — check it with whoever shared it.' });
  } else {
    const { rows } = await query('SELECT id FROM groups WHERE id = $1 AND is_public', [Number(req.body.id)]);
    g = rows[0];
    if (!g) return res.status(404).json({ error: 'That group is private — you\'ll need its invite code.' });
  }
  const count = await query('SELECT count(*)::int AS n FROM group_members WHERE group_id = $1', [g.id]);
  if (count.rows[0].n >= 50) return res.status(409).json({ error: 'That room upstairs is full (50 people).' });
  await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [g.id, req.user.id]);
  const { rows } = await query(
    `SELECT ${GROUP_FIELDS}, g.invite_code AS "inviteCode", gm.role FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2 WHERE g.id = $1`, [g.id, req.user.id]);
  res.json({ group: rows[0] });
}));

router.post('/groups/:id/leave', auth.requireUser, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query('SELECT owner_id FROM groups WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'That group is gone.' });
  if (rows[0].owner_id === req.user.id) {
    // The owner leaving closes the room for everyone.
    await query('DELETE FROM groups WHERE id = $1', [id]);
    await query('DELETE FROM cafe_notes WHERE room = $1', ['group:' + id]);
    await query('DELETE FROM chat_messages WHERE room = $1', ['group:' + id]);
    return res.json({ ok: true, closed: true });
  }
  await query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
  res.json({ ok: true });
}));

router.get('/groups/:id/members', auth.requireUser, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await canEnter(req.user.id, 'group:' + id))) return res.status(403).json({ error: 'Only members can see who\'s in this group.' });
  const { rows } = await query(
    `SELECT u.id, u.display_name AS "displayName", gm.role FROM group_members gm
     JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1 ORDER BY gm.joined_at`, [id]);
  res.json({ members: rows });
}));

module.exports = { router, canEnter, roomFromQuery, PUBLIC_ROOMS, ROOM_RE };
