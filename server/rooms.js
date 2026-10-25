// The shared rooms upstairs that keep something: the Games Room's high-score
// board (arcade.js) and the BookBeans Library's word count for the day.

const express = require('express');
const { query } = require('./db');
const auth = require('./auth');
const { rateLimit, wrap, cleanText } = require('./util');
const kindness = require('./moderation');
const realtime = require('./realtime');

const router = express.Router();
const smallLimit = rateLimit({ windowMs: 60e3, max: 40 });

// ── the high scores: the best five at each table
const GAMES = { pingpong: 2000, pool: 7, foosball: 10 }; // and the most you can score
async function topScores() {
  const { rows } = await query(
    `SELECT game, name, score FROM (
       SELECT s.game, u.display_name AS name, s.score,
              row_number() OVER (PARTITION BY s.game ORDER BY s.score DESC, s.updated_at) AS n
       FROM arcade_scores s JOIN users u ON u.id = s.user_id WHERE s.score > 0) t
     WHERE n <= 5 ORDER BY game, n`);
  const out = { pingpong: [], pool: [], foosball: [] };
  for (const r of rows) if (out[r.game]) out[r.game].push({ name: r.name, score: r.score });
  return out;
}
router.get('/arcade/scores', auth.requireUser, wrap(async (_req, res) => {
  res.json({ scores: await topScores() });
}));
router.post('/arcade/score', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const game = String((req.body || {}).game || ''), score = Math.floor(Number((req.body || {}).score));
  if (!GAMES[game]) return res.status(400).json({ error: 'Which game?' });
  if (!(score >= 0 && score <= GAMES[game])) return res.status(400).json({ error: "That score doesn't add up." });
  const before = await query('SELECT score FROM arcade_scores WHERE user_id = $1 AND game = $2', [req.user.id, game]);
  const prev = before.rows[0] ? before.rows[0].score : null;
  if (prev === null || score > prev) {
    await query(`INSERT INTO arcade_scores (user_id, game, score) VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, game) DO UPDATE SET score = EXCLUDED.score, updated_at = now()`, [req.user.id, game, score]);
  }
  const scores = await topScores();
  if (prev === null || score > prev) realtime.broadcast({ t: 'arcade:scores', scores }, null, 'games');
  res.json({ scores, best: Math.max(prev || 0, score), newBest: prev === null ? score > 0 : score > prev });
}));

// ── today's word count in the library (a Cairo day)
const TODAY = "(now() AT TIME ZONE 'Africa/Cairo')::date";
async function wordsToday(userId) {
  const { rows } = await query(
    `SELECT u.display_name AS name, w.words, w.user_id = $1 AS mine
     FROM library_words w JOIN users u ON u.id = w.user_id
     WHERE w.day = ${TODAY} AND w.words > 0 ORDER BY w.words DESC LIMIT 50`, [userId || 0]);
  return {
    total: rows.reduce((n, r) => n + r.words, 0),
    writers: rows.slice(0, 6).map(r => ({ name: r.name, words: r.words })),
    mine: (rows.find(r => r.mine) || { words: 0 }).words,
  };
}
router.get('/library/words', auth.requireUser, wrap(async (req, res) => {
  res.json({ words: await wordsToday(req.user.id) });
}));
router.post('/library/words', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const n = Math.floor(Number((req.body || {}).words));
  if (!(n >= 1 && n <= 20000)) return res.status(400).json({ error: 'How many words? (1 to 20,000 at a time)' });
  await query(`INSERT INTO library_words (user_id, day, words) VALUES ($1, ${TODAY}, $2)
               ON CONFLICT (user_id, day) DO UPDATE SET words = LEAST(library_words.words + EXCLUDED.words, 100000)`, [req.user.id, n]);
  const words = await wordsToday(req.user.id);
  realtime.broadcast({ t: 'library:words', words: { total: words.total, writers: words.writers } }, null, 'library');
  res.json({ words });
}));

// ── the Art Studio's gallery wall: paintings anyone signed in has hung there
// (a small JPEG each, kept in media as kind 'painting')
const ART_MAX = 150 * 1024;
async function gallery() {
  const { rows } = await query(
    `SELECT m.id, m.name AS title, u.display_name AS by, m.created_by AS "byId" FROM media m JOIN users u ON u.id = m.created_by
     WHERE m.kind = 'painting' ORDER BY m.id DESC LIMIT 11`);
  return rows.map(r => ({ ...r, url: `/api/art/painting/${r.id}` }));
}
router.get('/art/paintings', auth.requireUser, wrap(async (_req, res) => {
  res.json({ paintings: await gallery() });
}));
router.get('/art/painting/:id(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query("SELECT mime, bytes FROM media WHERE id = $1 AND kind = 'painting'", [Number(req.params.id)]);
  if (!rows[0]) return res.status(404).end();
  res.set({ 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
  res.end(rows[0].bytes);
}));
const artLimit = rateLimit({ windowMs: 10 * 60e3, max: 12, message: 'That is a lot of paintings — give the paint a few minutes to dry.' });
router.post('/art/paintings', auth.requireUser, artLimit, wrap(async (req, res) => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body || {}).image || ''));
  if (!m) return res.status(400).json({ error: 'That painting didn’t come through — try again.' });
  const bytes = Buffer.from(m[1], 'base64');
  if (!bytes.length || bytes.length > ART_MAX) return res.status(413).json({ error: 'That painting is too big to hang.' });
  const title = cleanText((req.body || {}).title, 40) || 'Untitled';
  if (!(await kindness.guard(res, title, 'painting', req.user))) return;
  const { rows } = await query(
    "INSERT INTO media (kind, mime, name, size, bytes, created_by) VALUES ('painting', 'image/jpeg', $1, $2, $3, $4) RETURNING id",
    [title, bytes.length, bytes, req.user.id]);
  const paintings = await gallery();
  realtime.broadcast({ t: 'art:gallery', paintings }, null, 'art');
  res.json({ id: rows[0].id, paintings });
}));
// take one down: whoever painted it, or the owner
router.delete('/art/painting/:id(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query("DELETE FROM media WHERE id = $1 AND kind = 'painting' AND (created_by = $2 OR $3) RETURNING id", [Number(req.params.id), req.user.id, !!req.user.is_admin]);
  if (!rows[0]) return res.status(404).json({ error: 'That one isn’t yours to take down.' });
  const paintings = await gallery();
  realtime.broadcast({ t: 'art:gallery', paintings }, null, 'art');
  res.json({ paintings });
}));

// ── the Recording Studio: what's been recorded in the booth (media kind 'recording')
const REC_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
const REC_MAX = 4 * 1024 * 1024;
async function recordings() {
  const { rows } = await query(
    `SELECT m.id, m.title, m.duration AS seconds, u.display_name AS by, m.created_by AS "byId" FROM media m JOIN users u ON u.id = m.created_by
     WHERE m.kind = 'recording' ORDER BY m.id DESC LIMIT 8`);
  return rows.map(r => ({ ...r, url: `/api/studio/recording/${r.id}` }));
}
router.get('/studio/recordings', auth.requireUser, wrap(async (_req, res) => {
  res.json({ recordings: await recordings() });
}));
router.get('/studio/recording/:id(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query("SELECT mime, bytes FROM media WHERE id = $1 AND kind = 'recording'", [Number(req.params.id)]);
  if (!rows[0]) return res.status(404).end();
  res.set({ 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'none' });
  res.end(rows[0].bytes);
}));
router.delete('/studio/recording/:id(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query("DELETE FROM media WHERE id = $1 AND kind = 'recording' AND (created_by = $2 OR $3) RETURNING id", [Number(req.params.id), req.user.id, !!req.user.is_admin]);
  if (!rows[0]) return res.status(404).json({ error: 'That one isn’t yours to take down.' });
  const list = await recordings();
  realtime.broadcast({ t: 'studio:list', recordings: list }, null, 'studio');
  res.json({ recordings: list });
}));
// the upload itself is the raw audio (mounted before the JSON-only API, like the photo uploads)
const recUpload = express.Router();
const recLimit = rateLimit({ windowMs: 10 * 60e3, max: 10, message: 'That’s a lot of recordings — give it a few minutes.' });
recUpload.use(auth.loadUser, auth.requireUser, recLimit);
recUpload.post('/', express.raw({ type: () => true, limit: REC_MAX }), wrap(async (req, res) => {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!REC_TYPES.includes(mime)) return res.status(415).json({ error: 'That doesn’t sound like a recording.' });
  if (!Buffer.isBuffer(req.body) || req.body.length < 200) return res.status(400).json({ error: 'The recording was empty.' });
  const title = cleanText(req.query.title, 60) || 'A recording';
  if (!(await kindness.guard(res, title, 'recording', req.user))) return;
  const seconds = Math.max(0, Math.min(600, Number(req.query.seconds) || 0));
  await query(
    "INSERT INTO media (kind, mime, name, title, duration, size, bytes, created_by) VALUES ('recording', $1, 'studio', $2, $3, $4, $5, $6)",
    [mime, title, seconds, req.body.length, req.body, req.user.id]);
  const list = await recordings();
  realtime.broadcast({ t: 'studio:list', recordings: list }, null, 'studio');
  res.json({ recordings: list });
}));

// ── the Post Room: letters between the people who live upstairs
const DOORS = 28;
router.get('/post/holes', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT r.door, r.owner_id AS "ownerId", u.display_name AS name FROM home_rooms r JOIN users u ON u.id = r.owner_id WHERE r.door IS NOT NULL`);
  const waiting = await query('SELECT count(*)::int AS n FROM letters WHERE to_id = $1 AND read_at IS NULL', [req.user.id]);
  const holes = Array.from({ length: DOORS }, () => null);
  for (const r of rows) if (r.door >= 0 && r.door < DOORS) holes[r.door] = { ownerId: r.ownerId, name: r.name, mine: r.ownerId === req.user.id };
  res.json({ holes, waiting: waiting.rows[0].n });
}));
router.get('/post/mine', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT l.id, l.body, l.created_at AS "createdAt", l.read_at IS NULL AS unread, u.display_name AS "fromName"
     FROM letters l JOIN users u ON u.id = l.from_id WHERE l.to_id = $1 ORDER BY l.id DESC LIMIT 30`, [req.user.id]);
  await query('UPDATE letters SET read_at = now() WHERE to_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ letters: rows });
}));
const postLimit = rateLimit({ windowMs: 10 * 60e3, max: 15, message: 'That’s a lot of letters — the postman needs a rest.' });
router.post('/post/letters', auth.requireUser, postLimit, wrap(async (req, res) => {
  const b = req.body || {};
  const body = cleanText(b.body, 1200);
  if (body.length < 2) return res.status(400).json({ error: 'Write something first ✍️' });
  let to = null;
  if (b.door != null && Number.isInteger(Number(b.door))) {
    const { rows } = await query('SELECT owner_id AS id FROM home_rooms WHERE door = $1', [Number(b.door)]);
    to = rows[0] && rows[0].id;
  } else if (b.username) {
    const { rows } = await query('SELECT id FROM users WHERE lower(username) = $1', [String(b.username).toLowerCase().replace(/^@/, '').slice(0, 24)]);
    to = rows[0] && rows[0].id;
  }
  if (!to) return res.status(404).json({ error: 'Nobody lives there yet — try another pigeonhole.' });
  if (to === req.user.id) return res.status(400).json({ error: 'A letter to yourself? Lovely — but write to a neighbour 💌' });
  if (!(await kindness.guard(res, body, 'letter', req.user))) return;
  await query('INSERT INTO letters (from_id, to_id, body) VALUES ($1, $2, $3)', [req.user.id, to, body]);
  realtime.sendToUser(to, { t: 'letter', from: req.user.display_name });
  res.json({ ok: true });
}));

module.exports = { router, recUpload };
