// The shared rooms upstairs that keep something: the Games Room's high-score
// board (arcade.js) and the BookBeans Library's word count for the day.

const express = require('express');
const { query } = require('./db');
const auth = require('./auth');
const { rateLimit, wrap } = require('./util');
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

module.exports = { router };
