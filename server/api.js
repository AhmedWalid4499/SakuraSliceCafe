// HTTP API. Everything the website and the 3D café save goes through here.

const express = require('express');
const { query, pool } = require('./db');
const auth = require('./auth');
const realtime = require('./realtime');
const { rateLimit, cleanText, isHexColor, clamp, wrap, publicContent } = require('./util');
const kindness = require('./moderation');
const groups = require('./groups');
const npc = require('./npc');

const api = express.Router();
api.use(express.json({ limit: '200kb' }));
api.use(auth.loadUser);

// Cross-site forms can't send JSON without a CORS preflight (which we never
// answer), so requiring JSON on writes, plus SameSite cookies, blocks CSRF.
api.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Send JSON, please.' });
  }
  next();
});

const authLimit = rateLimit({ windowMs: 15 * 60e3, max: 20, message: 'Too many tries. Take a breath and try again in a few minutes.' });
const writeLimit = rateLimit({ windowMs: 60e3, max: 12 });
const chatLimit = rateLimit({ windowMs: 30e3, max: 10, message: 'The café is a quiet place — give it a moment.' });

// ─────────────────────────────────────────── avatar

const HAIR_STYLES = ['short', 'long', 'bun', 'curly', 'bob', 'none'];
const ACCESSORIES = ['none', 'glasses', 'beanie', 'flower', 'headphones', 'scarf'];
const BODY_TYPES = ['person', 'fox', 'rabbit', 'owl', 'cat'];
const GENDERS = ['he', 'she'];
const BOTTOMS = ['trousers', 'skirt'];
const PJ_PATTERNS = ['stripes', 'dots', 'stars', 'hearts', 'checks', 'plain'];
const AVATAR_DEFAULTS = {
  body: 'person', skin: '#e0b48c', hair: '#3b2a22', hairStyle: 'short',
  outfit: '#7aab7a', accent: '#fef9f5', accessory: 'none', gender: 'she', bottom: 'trousers',
};

function cleanAvatar(a) {
  a = a && typeof a === 'object' ? a : {};
  return {
    body: BODY_TYPES.includes(a.body) ? a.body : AVATAR_DEFAULTS.body,
    skin: isHexColor(a.skin) ? a.skin : AVATAR_DEFAULTS.skin,
    hair: isHexColor(a.hair) ? a.hair : AVATAR_DEFAULTS.hair,
    hairStyle: HAIR_STYLES.includes(a.hairStyle) ? a.hairStyle : AVATAR_DEFAULTS.hairStyle,
    outfit: isHexColor(a.outfit) ? a.outfit : AVATAR_DEFAULTS.outfit,
    accent: isHexColor(a.accent) ? a.accent : AVATAR_DEFAULTS.accent,
    accessory: ACCESSORIES.includes(a.accessory) ? a.accessory : AVATAR_DEFAULTS.accessory,
    gender: GENDERS.includes(a.gender) ? a.gender : AVATAR_DEFAULTS.gender,
    bottom: BOTTOMS.includes(a.bottom) ? a.bottom : AVATAR_DEFAULTS.bottom,
    // pyjamas, worn upstairs if you like
    pj: a.pj && typeof a.pj === 'object' ? {
      on: !!a.pj.on,
      color: isHexColor(a.pj.color) ? a.pj.color : '#9fb8d6',
      pattern: PJ_PATTERNS.includes(a.pj.pattern) ? a.pj.pattern : 'stripes',
      cap: !!a.pj.cap,
    } : { on: false, color: '#9fb8d6', pattern: 'stripes', cap: false },
  };
}

function cleanPrefs(p) {
  p = p && typeof p === 'object' ? p : {};
  const out = {};
  if (p.sound && typeof p.sound === 'object') {
    out.sound = {};
    for (const k of ['master', 'music', 'rain', 'murmur', 'fire', 'birds', 'chimes']) {
      if (p.sound[k] != null && !isNaN(p.sound[k])) out.sound[k] = clamp(p.sound[k], 0, 1);
    }
    out.sound.muted = !!p.sound.muted;
  }
  if (typeof p.favouriteSeat === 'string') out.favouriteSeat = p.favouriteSeat.slice(0, 24);
  if (typeof p.quality === 'string' && ['high', 'balanced', 'gentle'].includes(p.quality)) out.quality = p.quality;
  if (typeof p.toured === 'boolean') out.toured = p.toured; // has had the welcome tour
  // where you were last, so the café opens there next time
  if (p.place && typeof p.place === 'object' && /^(main|garden|hall|common|music|prayer|koshari|group:\d{1,9}|home:\d{1,9})$/.test(p.place.room)) {
    const n = (v, m) => (Number.isFinite(Number(v)) ? clamp(Number(v), -m, m) : 0);
    out.place = {
      room: p.place.room, x: n(p.place.x, 60), z: n(p.place.z, 60), ry: n(p.place.ry, 7),
      seat: typeof p.place.seat === 'string' ? p.place.seat.slice(0, 40) : null, at: Date.now(),
    };
  }
  return out;
}

// ─────────────────────────────────────────── accounts

api.post('/auth/register', authLimit, wrap(async (req, res) => {
  const email = cleanText(req.body.email, 120).toLowerCase();
  const username = cleanText(req.body.username, 24).toLowerCase();
  const displayName = cleanText(req.body.displayName || req.body.username, 24);
  const password = String(req.body.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'That email doesn\'t look right.' });
  if (!/^[a-z0-9_.]{3,24}$/.test(username)) return res.status(400).json({ error: 'Usernames are 3–24 letters, numbers, dots or underscores.' });
  if (displayName.length < 1) return res.status(400).json({ error: 'What should we call you?' });
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Passwords need at least 8 characters.' });
  if (!(await kindness.guard(res, `${displayName} (${username})`, 'name', null))) return;

  const taken = await query('SELECT email, username FROM users WHERE email = $1 OR username = $2', [email, username]);
  if (taken.rows.length) {
    const t = taken.rows[0];
    return res.status(409).json({ error: t.email === email ? 'There\'s already an account with that email.' : 'That username is taken.' });
  }

  const isAdmin = !!process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase();
  const { rows } = await query(
    `INSERT INTO users (email, username, display_name, password_hash, avatar, is_admin, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING *`,
    [email, username, displayName, await auth.hashPassword(password), JSON.stringify(cleanAvatar(req.body.avatar)), isAdmin]
  );
  await auth.createSession(res, rows[0].id);
  res.status(201).json({ user: auth.publicUser(rows[0]) });
}));

api.post('/auth/login', authLimit, wrap(async (req, res) => {
  const login = cleanText(req.body.login || req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await query('SELECT * FROM users WHERE email = $1 OR username = $1', [login]);
  const u = rows[0];
  if (!u || !(await auth.checkPassword(password, u.password_hash))) {
    return res.status(401).json({ error: 'That email or password isn\'t right.' });
  }
  await query('UPDATE users SET last_seen_at = now() WHERE id = $1', [u.id]);
  await auth.createSession(res, u.id);
  res.json({ user: auth.publicUser(u) });
}));

api.post('/auth/logout', wrap(async (req, res) => {
  await auth.destroySession(req, res);
  res.json({ ok: true });
}));

// who sent an invite link (only their display name — for the door's welcome)
api.get('/invite/:username', wrap(async (req, res) => {
  const { rows } = await query('SELECT display_name FROM users WHERE username = $1', [String(req.params.username).toLowerCase().slice(0, 24)]);
  if (!rows[0]) return res.status(404).json({ error: 'No one by that name.' });
  res.json({ displayName: rows[0].display_name });
}));

api.get('/auth/me', (req, res) => res.json({ user: auth.publicUser(req.user) }));

api.patch('/me', auth.requireUser, wrap(async (req, res) => {
  const u = req.user;
  const displayName = req.body.displayName != null ? cleanText(req.body.displayName, 24) : u.display_name;
  if (!displayName) return res.status(400).json({ error: 'What should we call you?' });
  if (displayName !== u.display_name && !(await kindness.guard(res, displayName, 'name', u))) return;
  const avatar = req.body.avatar ? cleanAvatar(req.body.avatar) : u.avatar;
  const prefs = req.body.prefs ? { ...(u.prefs || {}), ...cleanPrefs(req.body.prefs) } : u.prefs;
  const { rows } = await query(
    'UPDATE users SET display_name = $2, avatar = $3, prefs = $4, last_seen_at = now() WHERE id = $1 RETURNING *',
    [u.id, displayName, JSON.stringify(avatar), JSON.stringify(prefs)]
  );
  if (req.body.avatar || req.body.displayName != null) realtime.updateProfile(rows[0]);
  res.json({ user: auth.publicUser(rows[0]) });
}));

api.post('/me/password', auth.requireUser, authLimit, wrap(async (req, res) => {
  const next = String(req.body.next || '');
  if (!(await auth.checkPassword(String(req.body.current || ''), req.user.password_hash))) {
    return res.status(401).json({ error: 'Your current password isn\'t right.' });
  }
  if (next.length < 8 || next.length > 200) return res.status(400).json({ error: 'Passwords need at least 8 characters.' });
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, await auth.hashPassword(next)]);
  res.json({ ok: true });
}));

// ─────────────────────────────────────────── notes & pins in the 3D café

const SURFACES = ['board', 'table', 'wall'];
const NOTE_COLORS = ['#fde8ef', '#fff4c7', '#e8f5e8', '#e6eefc', '#fbe3cf', '#efe6fb'];

const NOTE_SELECT = `
  SELECT n.id, n.kind, n.surface, n.text, n.color, n.pos_x AS x, n.pos_y AS y, n.pos_z AS z,
         n.rot_y AS ry, n.tilt, n.room, n.created_at AS "createdAt",
         u.id AS "userId", u.display_name AS "author",
         (SELECT count(*)::int FROM note_hearts h WHERE h.note_id = n.id) AS hearts
  FROM cafe_notes n JOIN users u ON u.id = n.user_id`;

async function noteWithMine(id, userId) {
  const { rows } = await query(
    NOTE_SELECT + ` WHERE n.id = $1`, [id]);
  const n = rows[0];
  if (!n) return null;
  if (userId) {
    const h = await query('SELECT 1 FROM note_hearts WHERE note_id = $1 AND user_id = $2', [id, userId]);
    n.hearted = h.rows.length > 0;
  }
  return n;
}

api.get('/notes', wrap(async (req, res) => {
  const room = groups.roomFromQuery(req);
  if (!groups.PUBLIC_ROOMS.includes(room) && !(req.user && await groups.canEnter(req.user.id, room))) {
    return res.status(403).json({ error: 'That room is for its group only.' });
  }
  const { rows } = await query(NOTE_SELECT + ' WHERE n.room = $1 ORDER BY n.created_at DESC LIMIT 400', [room]);
  if (req.user && rows.length) {
    const mine = await query('SELECT note_id FROM note_hearts WHERE user_id = $1', [req.user.id]);
    const set = new Set(mine.rows.map(r => r.note_id));
    rows.forEach(n => { n.hearted = set.has(n.id); });
  }
  res.json({ notes: rows.reverse() });
}));

api.post('/notes', auth.requireUser, writeLimit, wrap(async (req, res) => {
  const b = req.body;
  const text = cleanText(b.text, 220);
  if (text.length < 2) return res.status(400).json({ error: 'Write something first — anything at all.' });
  const surface = SURFACES.includes(b.surface) ? b.surface : null;
  if (!surface) return res.status(400).json({ error: 'Notes go on the board, a table, or a wall.' });
  const kind = b.kind === 'pin' ? 'pin' : 'note';
  const color = NOTE_COLORS.includes(b.color) ? b.color : NOTE_COLORS[0];
  if (!(await kindness.guard(res, text, 'note', req.user))) return;

  const room = groups.roomFromQuery(req);
  if (!(await groups.canEnter(req.user.id, room))) return res.status(403).json({ error: 'That room is for its group only.' });
  // y covers both floors: the ground floor (0–4.2) and upstairs (4.4–8.6)
  const pos = [clamp(b.x, -15, 15), clamp(b.y, 0, 8.6), clamp(b.z, -11, 11)];
  if (pos.some(Number.isNaN)) return res.status(400).json({ error: 'Where should it go?' });

  const daily = await query(
    `SELECT count(*)::int AS n FROM cafe_notes WHERE user_id = $1 AND created_at > now() - interval '1 day'`,
    [req.user.id]);
  if (daily.rows[0].n >= 25 && !req.user.is_admin) {
    return res.status(429).json({ error: 'That\'s a lot of notes for one day — save some kindness for tomorrow.' });
  }

  const { rows } = await query(
    `INSERT INTO cafe_notes (user_id, kind, surface, text, color, pos_x, pos_y, pos_z, rot_y, tilt, room)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [req.user.id, kind, surface, text, color, ...pos, clamp(b.ry || 0, -10, 10) || 0, clamp(b.tilt || 0, -0.4, 0.4) || 0, room]);
  const note = await noteWithMine(rows[0].id, null);
  realtime.broadcast({ t: 'note:new', note }, null, room);
  res.status(201).json({ note: { ...note, hearted: false } });
}));

api.delete('/notes/:id', auth.requireUser, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query('SELECT user_id, room FROM cafe_notes WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'That note is already gone.' });
  if (rows[0].user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Only the person who left it can take it down.' });
  }
  await query('DELETE FROM cafe_notes WHERE id = $1', [id]);
  realtime.broadcast({ t: 'note:delete', id }, null, rows[0].room);
  res.json({ ok: true });
}));

api.post('/notes/:id/heart', auth.requireUser, writeLimit, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const del = await query('DELETE FROM note_hearts WHERE note_id = $1 AND user_id = $2', [id, req.user.id]);
  if (!del.rowCount) {
    try { await query('INSERT INTO note_hearts (note_id, user_id) VALUES ($1, $2)', [id, req.user.id]); }
    catch (e) { return res.status(404).json({ error: 'That note is gone.' }); }
  }
  const { rows } = await query(
    'SELECT (SELECT count(*)::int FROM note_hearts WHERE note_id = $1) AS n, (SELECT room FROM cafe_notes WHERE id = $1) AS room', [id]);
  realtime.broadcast({ t: 'note:hearts', id, hearts: rows[0].n }, null, rows[0].room || 'main');
  res.json({ hearted: !del.rowCount, hearts: rows[0].n });
}));

// ─────────────────────────────────────────── the stamp card

const CARD_SIZE = 10;
const STAMP_GAP = 3 * 60e3; // one stamp per drink, and not more often than every few minutes
api.get('/loyalty', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query('SELECT stamps, rewards FROM loyalty_cards WHERE user_id = $1', [req.user.id]);
  res.json({ stamps: rows[0] ? rows[0].stamps : 0, rewards: rows[0] ? rows[0].rewards : 0, size: CARD_SIZE });
}));
api.post('/loyalty/stamp', auth.requireUser, writeLimit, wrap(async (req, res) => {
  const { rows } = await query(
    `INSERT INTO loyalty_cards (user_id, stamps, rewards, last_stamp) VALUES ($1, 1, 0, now())
     ON CONFLICT (user_id) DO UPDATE SET
       stamps = CASE WHEN loyalty_cards.last_stamp IS NULL OR loyalty_cards.last_stamp < now() - make_interval(secs => $2)
                     THEN loyalty_cards.stamps + 1 ELSE loyalty_cards.stamps END,
       last_stamp = CASE WHEN loyalty_cards.last_stamp IS NULL OR loyalty_cards.last_stamp < now() - make_interval(secs => $2)
                     THEN now() ELSE loyalty_cards.last_stamp END
     RETURNING stamps, rewards, last_stamp > now() - interval '2 seconds' AS stamped`,
    [req.user.id, STAMP_GAP / 1000]);
  let { stamps, rewards } = rows[0];
  const stamped = rows[0].stamped;
  let reward = false;
  if (stamps >= CARD_SIZE) {
    // a full card: the slice of sakura cake, and a fresh card
    const r = await query('UPDATE loyalty_cards SET stamps = 0, rewards = rewards + 1 WHERE user_id = $1 RETURNING stamps, rewards', [req.user.id]);
    ({ stamps, rewards } = r.rows[0]);
    reward = true;
  }
  res.json({ stamps, rewards, size: CARD_SIZE, stamped, reward });
}));

// ─────────────────────────────────────────── quiet chat

api.get('/chat', auth.requireUser, wrap(async (req, res) => {
  const room = groups.roomFromQuery(req);
  if (!(await groups.canEnter(req.user.id, room))) return res.status(403).json({ error: 'That room is for its group only.' });
  const { rows } = await query(
    `SELECT c.id, c.text, c.created_at AS "createdAt", u.id AS "userId", u.display_name AS "author"
     FROM chat_messages c JOIN users u ON u.id = c.user_id
     WHERE c.room = $1 ORDER BY c.created_at DESC LIMIT 40`, [room]);
  res.json({ messages: rows.reverse() });
}));

api.post('/chat', auth.requireUser, chatLimit, wrap(async (req, res) => {
  const text = cleanText(req.body.text, 240).replace(/\n/g, ' ');
  if (!text) return res.status(400).json({ error: 'Say something first.' });
  const room = groups.roomFromQuery(req);
  if (room === 'prayer') return res.status(403).json({ error: 'The Prayer Room is a quiet room — no chat in here 🤍' });
  if (!(await groups.canEnter(req.user.id, room))) return res.status(403).json({ error: 'That room is for its group only.' });
  if (!(await kindness.guard(res, text, 'chat', req.user))) return;
  const { rows } = await query(
    'INSERT INTO chat_messages (user_id, text, room) VALUES ($1, $2, $3) RETURNING id, created_at AS "createdAt"',
    [req.user.id, text, room]);
  const msg = { ...rows[0], text, userId: req.user.id, author: req.user.display_name };
  realtime.broadcast({ t: 'chat', msg }, null, room);
  res.status(201).json({ msg });
}));

// ─────────────────────────────────────────── Table Four guestbook (main site)

api.get('/guestbook', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT who, text, created_at AS "createdAt" FROM guestbook_notes
     WHERE NOT hidden ORDER BY created_at DESC LIMIT 60`);
  res.json(rows.reverse());
}));

api.post('/guestbook', writeLimit, wrap(async (req, res) => {
  const text = cleanText(req.body.text, 140);
  const who = cleanText(req.body.who, 18) || 'anonymous';
  if (text.length < 2) return res.status(400).json({ ok: false, error: 'empty' });
  const verdict = await kindness.check(`${who}: ${text}`, 'guestbook', null);
  if (!verdict.ok) return res.status(422).json({ ok: false, error: verdict.message, moderated: true });
  await query('INSERT INTO guestbook_notes (who, text) VALUES ($1, $2)', [who, text]);
  res.status(201).json({ ok: true });
}));

// ─────────────────────────────────────────── letters signup

api.post('/subscribe', writeLimit, wrap(async (req, res) => {
  const email = cleanText(req.body.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  await query(
    `INSERT INTO subscribers (email, source) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET unsubscribed_at = NULL`,
    [email, cleanText(req.body.source, 30) || 'website']);

  // The SendGrid sender still reads recipients from the Google Sheet. If its
  // Apps Script URL is set, keep the Sheet in step. Failure here is not fatal:
  // the address is already safe in Postgres.
  if (process.env.APPS_SCRIPT_URL) {
    fetch(process.env.APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ email }),
    }).catch(err => console.warn('apps script forward failed:', err.message));
  }
  res.status(201).json({ ok: true });
}));

// ─────────────────────────────────────────── site content (public read)

api.get('/content', wrap(async (_req, res) => {
  const { rows } = await query('SELECT key, value FROM site_content');
  res.set('Cache-Control', 'no-cache');
  res.json(Object.fromEntries(rows.map(r => [r.key, publicContent(r.key, r.value)])));
}));

api.get('/content/:key', wrap(async (req, res) => {
  const { rows } = await query('SELECT value FROM site_content WHERE key = $1', [req.params.key]);
  if (!rows[0]) return res.status(404).json({ error: 'No such content.' });
  res.json(publicContent(req.params.key, rows[0].value));
}));

api.get('/cafe/stats', wrap(async (_req, res) => {
  const { rows } = await query(`SELECT
    (SELECT count(*)::int FROM cafe_notes) AS notes,
    (SELECT count(*)::int FROM users) AS guests`);
  res.json({ ...rows[0], online: realtime.onlineCount() });
}));

// ─────────────────────────────────────────── admin

const admin = express.Router();
admin.use(auth.requireAdmin);

admin.get('/content', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT c.key, c.value, c.description, c.updated_at AS "updatedAt", u.display_name AS "updatedBy"
     FROM site_content c LEFT JOIN users u ON u.id = c.updated_by ORDER BY c.key`);
  res.json({ content: rows });
}));

admin.put('/content/:key', wrap(async (req, res) => {
  const key = req.params.key;
  if (!/^[a-z0-9_.-]{1,64}$/i.test(key)) return res.status(400).json({ error: 'Keys are letters, numbers, dots, dashes.' });
  if (!('value' in req.body)) return res.status(400).json({ error: 'Send { value }.' });
  const value = JSON.stringify(req.body.value);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prev = await client.query('SELECT value FROM site_content WHERE key = $1 FOR UPDATE', [key]);
    if (prev.rows[0]) {
      await client.query('INSERT INTO site_content_history (key, value, changed_by) VALUES ($1, $2, $3)',
        [key, JSON.stringify(prev.rows[0].value), req.user.id]);
    }
    await client.query(
      `INSERT INTO site_content (key, value, description, updated_at, updated_by)
       VALUES ($1, $2, COALESCE($3, ''), now(), $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value,
         description = COALESCE($3, site_content.description), updated_at = now(), updated_by = $4`,
      [key, value, req.body.description == null ? null : cleanText(req.body.description, 400), req.user.id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  realtime.broadcast({ t: 'content', key, value: publicContent(key, req.body.value) });
  res.json({ ok: true });
}));

admin.delete('/content/:key', wrap(async (req, res) => {
  const { rows } = await query('DELETE FROM site_content WHERE key = $1 RETURNING value', [req.params.key]);
  if (rows[0]) {
    await query('INSERT INTO site_content_history (key, value, changed_by) VALUES ($1, $2, $3)',
      [req.params.key, JSON.stringify(rows[0].value), req.user.id]);
  }
  res.json({ ok: true });
}));

admin.get('/content/:key/history', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT h.id, h.value, h.changed_at AS "changedAt", u.display_name AS "changedBy"
     FROM site_content_history h LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.key = $1 ORDER BY h.changed_at DESC LIMIT 30`, [req.params.key]);
  res.json({ history: rows });
}));

admin.get('/overview', wrap(async (_req, res) => {
  const { rows } = await query(`SELECT
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM cafe_notes) AS notes,
    (SELECT count(*)::int FROM chat_messages) AS chat,
    (SELECT count(*)::int FROM guestbook_notes) AS guestbook,
    (SELECT count(*)::int FROM subscribers WHERE unsubscribed_at IS NULL) AS subscribers`);
  res.json({ ...rows[0], online: realtime.onlineCount() });
}));

admin.get('/users', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, email, username, display_name AS "displayName", is_admin AS "isAdmin",
            created_at AS "createdAt", last_seen_at AS "lastSeenAt"
     FROM users ORDER BY created_at DESC LIMIT 500`);
  res.json({ users: rows });
}));

admin.patch('/users/:id', wrap(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You can\'t change your own admin status.' });
  await query('UPDATE users SET is_admin = $2 WHERE id = $1', [Number(req.params.id), !!req.body.isAdmin]);
  res.json({ ok: true });
}));

admin.get('/subscribers', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT email, source, created_at AS "createdAt" FROM subscribers
     WHERE unsubscribed_at IS NULL ORDER BY created_at`);
  if (req.query.format === 'csv') {
    res.type('text/csv').attachment('sakura-subscribers.csv');
    return res.send('email,source,created_at\n' + rows.map(r =>
      [r.email, r.source, r.createdAt.toISOString()].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n'));
  }
  res.json({ subscribers: rows });
}));

admin.get('/guestbook', wrap(async (_req, res) => {
  const { rows } = await query(
    'SELECT id, who, text, hidden, created_at AS "createdAt" FROM guestbook_notes ORDER BY created_at DESC LIMIT 300');
  res.json({ notes: rows });
}));

admin.patch('/guestbook/:id', wrap(async (req, res) => {
  await query('UPDATE guestbook_notes SET hidden = $2 WHERE id = $1', [Number(req.params.id), !!req.body.hidden]);
  res.json({ ok: true });
}));

// what the kindness check held back (server/moderation.js)
admin.get('/moderation', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT m.id, m.place, m.text, m.category, m.reason, m.source, m.created_at AS "createdAt", u.display_name AS "by"
     FROM moderation_log m LEFT JOIN users u ON u.id = m.user_id ORDER BY m.created_at DESC LIMIT 200`);
  res.json({ items: rows });
}));

admin.delete('/chat/:id', wrap(async (req, res) => {
  const { rows } = await query('DELETE FROM chat_messages WHERE id = $1 RETURNING room', [Number(req.params.id)]);
  if (rows[0]) realtime.broadcast({ t: 'chat:delete', id: Number(req.params.id) }, null, rows[0].room);
  res.json({ ok: true });
}));

api.use(groups.router);
api.use(require('./garden').router);
api.use(require('./homes').router);
api.use(require('./media').router);
api.use(npc);
api.use('/admin', admin);

api.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
api.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That JSON didn\'t parse.' });
  console.error(err);
  res.status(500).json({ error: 'Something spilled behind the counter. Please try again.' });
});

module.exports = api;
