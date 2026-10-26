// The fourth floor, and BookBeans Corner next door: the rooms that keep
// something. The Writer's Room's stories board and its writing sprint, the
// Pottery Studio's cup shelf, the Greenhouse's pots (a plant grows a stage for
// every Cairo day it's watered), the Pet Café's pets (their names, and how fond
// of you they are), the Party Hall's bookings and its confetti — and handing
// something you're holding (a bowl of matcha, a bouquet) to someone else.

const express = require('express');
const { query } = require('./db');
const auth = require('./auth');
const { rateLimit, wrap, cleanText, isHexColor, clamp } = require('./util');
const kindness = require('./moderation');
const realtime = require('./realtime');

const router = express.Router();
const smallLimit = rateLimit({ windowMs: 60e3, max: 40 });
const writeLimit = rateLimit({ windowMs: 60 * 60e3, max: 12 });
const TODAY = "(now() AT TIME ZONE 'Africa/Cairo')::date";
const nameOf = u => u.display_name || 'someone';

// ── the Writer's Room: the stories board
async function stories(userId = 0) {
  const { rows } = await query(
    `SELECT s.id, s.title, u.display_name AS name, s.user_id = $1 AS mine, s.created_at, length(s.body) AS chars
     FROM writer_stories s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 40`, [userId]);
  return rows.map(r => ({ id: r.id, title: r.title, name: r.name, mine: r.mine, at: r.created_at, words: Math.round(r.chars / 5.5) }));
}
router.get('/writers/stories', auth.requireUser, wrap(async (req, res) => {
  res.json({ stories: await stories(req.user.id) });
}));
router.get('/writers/story/:id(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.title, s.body, u.display_name AS name, s.created_at, s.user_id = $2 AS mine
     FROM writer_stories s JOIN users u ON u.id = s.user_id WHERE s.id = $1`, [Number(req.params.id), req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'That story has been taken down.' });
  const r = rows[0];
  res.json({ story: { id: r.id, title: r.title, body: r.body, name: r.name, at: r.created_at, mine: r.mine } });
}));
router.post('/writers/stories', auth.requireUser, writeLimit, wrap(async (req, res) => {
  const title = cleanText((req.body || {}).title, 60) || 'Untitled';
  const body = cleanText((req.body || {}).body, 4000);
  if (body.length < 20) return res.status(400).json({ error: 'A story needs a few lines at least.' });
  if (!(await kindness.guard(res, title + '\n' + body, 'story', req.user))) return;
  await query('INSERT INTO writer_stories (user_id, title, body) VALUES ($1, $2, $3)', [req.user.id, title, body]);
  const list = await stories(req.user.id);
  realtime.broadcast({ t: 'writers:stories', stories: list.map(s => ({ ...s, mine: false })) }, null, 'writers');
  res.json({ stories: list });
}));
router.delete('/writers/story/:id(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query('DELETE FROM writer_stories WHERE id = $1 AND (user_id = $2 OR $3) RETURNING id', [Number(req.params.id), req.user.id, !!req.user.is_admin]);
  if (!rows[0]) return res.status(404).json({ error: 'That one isn’t yours to take down.' });
  const list = await stories(req.user.id);
  realtime.broadcast({ t: 'writers:stories', stories: list.map(s => ({ ...s, mine: false })) }, null, 'writers');
  res.json({ stories: list });
}));

// ── the writing sprint: one at a time, everyone writing together against the clock
let sprint = null; // { endsAt, minutes, by, writers: [{ id, name }] }
const sprintOut = () => (sprint && sprint.endsAt > Date.now() ? { endsAt: sprint.endsAt, minutes: sprint.minutes, by: sprint.by, writers: sprint.writers.map(w => w.name) } : null);
const sprintNews = () => realtime.broadcast({ t: 'writers:sprint', sprint: sprintOut(), now: Date.now() }, null, 'writers');
router.get('/writers/sprint', auth.requireUser, (_req, res) => res.json({ sprint: sprintOut(), now: Date.now() }));
router.post('/writers/sprint/start', auth.requireUser, smallLimit, (req, res) => {
  if (sprintOut()) return res.status(409).json({ error: 'A sprint is already on — join it!' });
  const minutes = [5, 10, 15, 20, 25].includes(Number((req.body || {}).minutes)) ? Number(req.body.minutes) : 15;
  sprint = { endsAt: Date.now() + minutes * 60e3, minutes, by: nameOf(req.user), writers: [{ id: req.user.id, name: nameOf(req.user) }] };
  sprintNews();
  res.json({ sprint: sprintOut(), now: Date.now() });
});
router.post('/writers/sprint/join', auth.requireUser, smallLimit, (req, res) => {
  if (!sprintOut()) return res.status(404).json({ error: 'There’s no sprint on just now — start one!' });
  if (!sprint.writers.some(w => w.id === req.user.id)) sprint.writers.push({ id: req.user.id, name: nameOf(req.user) });
  sprintNews();
  res.json({ sprint: sprintOut(), now: Date.now() });
});

// ── the Pottery Studio: the cup shelf
const PATTERNS = ['plain', 'speckle', 'drip', 'stripes', 'dots'];
async function cups() {
  const { rows } = await query(
    `SELECT c.id, c.shape, c.glaze, c.pattern, c.name, u.display_name AS by
     FROM pottery_cups c JOIN users u ON u.id = c.user_id ORDER BY c.created_at DESC LIMIT 24`);
  return rows;
}
router.get('/pottery/cups', auth.requireUser, wrap(async (_req, res) => res.json({ cups: await cups() })));
router.post('/pottery/cups', auth.requireUser, writeLimit, wrap(async (req, res) => {
  const b = req.body || {}, s = b.shape || {};
  const n = k => clamp(Number(s[k]) || 0, 0, 1);
  const shape = { h: n('h'), belly: n('belly'), lip: n('lip'), foot: n('foot'), handle: !!s.handle };
  const glaze = isHexColor(b.glaze) ? b.glaze : '#9fc7b0';
  const pattern = PATTERNS.includes(b.pattern) ? b.pattern : 'plain';
  const name = cleanText(b.name, 30) || 'A little cup';
  if (!(await kindness.guard(res, name, 'cup', req.user))) return;
  await query('INSERT INTO pottery_cups (user_id, shape, glaze, pattern, name) VALUES ($1, $2, $3, $4, $5)', [req.user.id, JSON.stringify(shape), glaze, pattern, name]);
  const list = await cups();
  realtime.broadcast({ t: 'pottery:cups', cups: list }); // (the café's shelf shows them too)
  res.json({ cups: list });
}));

// ── the Greenhouse: three pots each; water once a (Cairo) day, three days to bloom
const FLOWERS = ['sakura', 'jasmine', 'rose', 'tulip', 'sunflower', 'lotus'];
const BLOOM = 3;
async function pots(userId) {
  const { rows } = await query(
    `SELECT p.id, p.flower, LEAST(p.growth, ${BLOOM}) AS stage, p.user_id = $1 AS mine,
            p.last_watered = ${TODAY} AS watered, u.display_name AS name
     FROM flower_pots p JOIN users u ON u.id = p.user_id ORDER BY (p.user_id = $1) DESC, p.planted_at DESC LIMIT 18`, [userId]);
  return { mine: rows.filter(r => r.mine).map(r => ({ id: r.id, flower: r.flower, stage: r.stage, watered: r.watered })), all: rows.map(r => ({ flower: r.flower, stage: r.stage, mine: r.mine, name: r.name })) };
}
router.get('/flowers/pots', auth.requireUser, wrap(async (req, res) => res.json(await pots(req.user.id))));
router.post('/flowers/plant', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const flower = String((req.body || {}).flower || '');
  if (!FLOWERS.includes(flower)) return res.status(400).json({ error: 'Which seeds?' });
  const { rows } = await query('SELECT count(*)::int AS n FROM flower_pots WHERE user_id = $1', [req.user.id]);
  if (rows[0].n >= 3) return res.status(400).json({ error: 'Your three pots are full — pick a flower that’s bloomed to make room.' });
  await query('INSERT INTO flower_pots (user_id, flower) VALUES ($1, $2)', [req.user.id, flower]);
  res.json(await pots(req.user.id));
}));
router.post('/flowers/water/:id(\\d+)', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const { rows } = await query(
    `UPDATE flower_pots SET growth = growth + 1, last_watered = ${TODAY}
     WHERE id = $1 AND user_id = $2 AND (last_watered IS NULL OR last_watered < ${TODAY}) AND growth < ${BLOOM} RETURNING id`, [Number(req.params.id), req.user.id]);
  const out = await pots(req.user.id);
  res.json({ ...out, grew: !!rows[0] });
}));
router.post('/flowers/pick/:id(\\d+)', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const { rows } = await query(`DELETE FROM flower_pots WHERE id = $1 AND user_id = $2 AND growth >= ${BLOOM} RETURNING flower`, [Number(req.params.id), req.user.id]);
  if (!rows[0]) return res.status(400).json({ error: 'It isn’t in bloom yet — keep watering it.' });
  res.json({ ...(await pots(req.user.id)), flower: rows[0].flower });
}));

// ── handing someone what you're holding: a bowl of matcha, a bouquet, a slice of cake
const HANDABLE = /^(tea-matcha|flower-(sakura|jasmine|rose|tulip|sunflower|lotus)|party-cake|bb-(latte|cardamom|cocoa|karak))$/;
router.post('/hand', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const to = Number((req.body || {}).to), item = String((req.body || {}).item || '');
  if (!HANDABLE.test(item)) return res.status(400).json({ error: 'You can’t hand that over.' });
  if (!to || to === req.user.id) return res.status(400).json({ error: 'Who to?' });
  realtime.sendToUser(to, { t: 'handed', item, from: nameOf(req.user), fromId: req.user.id });
  res.json({ ok: true });
}));

// ── the Pet Café: names, and fondness (a stroke now and then, a treat an hour)
const PETS = ['mishmish', 'luna', 'simsim', 'kiki', 'qamar', 'bondo'];
async function petsFor(userId) {
  const [names, love] = await Promise.all([
    query('SELECT pet, name FROM pet_names'),
    query('SELECT pet, love, fed_at FROM pet_love WHERE user_id = $1', [userId]),
  ]);
  return {
    names: Object.fromEntries(names.rows.map(r => [r.pet, r.name])),
    love: Object.fromEntries(love.rows.map(r => [r.pet, { love: r.love, fedAt: r.fed_at }])),
  };
}
router.get('/pets', auth.requireUser, wrap(async (req, res) => res.json(await petsFor(req.user.id))));
router.post('/pets/:pet/name', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const pet = String(req.params.pet);
  if (!PETS.includes(pet)) return res.status(404).json({ error: 'Which pet?' });
  const name = cleanText((req.body || {}).name, 20);
  if (!name) return res.status(400).json({ error: 'What shall we call them?' });
  if (!(await kindness.guard(res, name, 'pet name', req.user))) return;
  const { rows } = await query('INSERT INTO pet_names (pet, name, named_by) VALUES ($1, $2, $3) ON CONFLICT (pet) DO NOTHING RETURNING pet', [pet, name, req.user.id]);
  if (!rows[0]) return res.status(409).json({ error: 'Someone has already named them!' });
  const out = await petsFor(req.user.id);
  realtime.broadcast({ t: 'pets:names', names: out.names }, null, 'petcafe');
  res.json(out);
}));
router.post('/pets/:pet/:what(pet|feed)', auth.requireUser, smallLimit, wrap(async (req, res) => {
  const pet = String(req.params.pet), feed = req.params.what === 'feed';
  if (!PETS.includes(pet)) return res.status(404).json({ error: 'Which pet?' });
  const col = feed ? 'fed_at' : 'petted_at', wait = feed ? "interval '1 hour'" : "interval '20 seconds'";
  const { rows } = await query(
    `INSERT INTO pet_love (user_id, pet, love, ${col}) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, pet) DO UPDATE SET love = pet_love.love + $3, ${col} = now()
       WHERE pet_love.${col} IS NULL OR pet_love.${col} < now() - ${wait}
     RETURNING love`, [req.user.id, pet, feed ? 3 : 1]);
  const out = await petsFor(req.user.id);
  res.json({ ...out, counted: !!rows[0] });
}));

// ── the Party Hall: bookings (Cairo time), and confetti for everyone in the hall
const OCCASIONS = ['birthday', 'wedding', 'graduation', 'eid', 'baby', 'party'];
async function bookings(userId = 0) {
  const { rows } = await query(
    `SELECT b.id, b.occasion, b.title, b.starts_at, b.ends_at, u.display_name AS by, b.user_id = $1 AS mine
     FROM party_bookings b JOIN users u ON u.id = b.user_id WHERE b.ends_at > now() ORDER BY b.starts_at LIMIT 8`, [userId]);
  return rows.map(r => ({ id: r.id, occasion: r.occasion, title: r.title, startsAt: +r.starts_at, endsAt: +r.ends_at, by: r.by, mine: r.mine }));
}
const partyNews = async () => realtime.broadcast({ t: 'party:bookings', bookings: (await bookings()).map(b => ({ ...b, mine: false })), now: Date.now() }, null, 'party');
router.get('/party', auth.requireUser, wrap(async (req, res) => res.json({ bookings: await bookings(req.user.id), now: Date.now() })));
router.post('/party/book', auth.requireUser, writeLimit, wrap(async (req, res) => {
  const b = req.body || {};
  const occasion = OCCASIONS.includes(b.occasion) ? b.occasion : 'party';
  const title = cleanText(b.title, 50);
  if (!title) return res.status(400).json({ error: 'What’s the celebration? (e.g. “Happy Birthday Sara!”)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) || !/^\d{2}:\d{2}$/.test(String(b.time || ''))) return res.status(400).json({ error: 'Pick a day and a time.' });
  const hours = clamp(Math.round(Number(b.hours) || 2), 1, 4);
  if (!(await kindness.guard(res, title, 'party', req.user))) return;
  const when = await query(
    `SELECT ($1::date + $2::time) AT TIME ZONE 'Africa/Cairo' AS s,
            (($1::date + $2::time) AT TIME ZONE 'Africa/Cairo') + make_interval(hours => $3) AS e`, [b.date, b.time, hours]);
  const s = +when.rows[0].s, e = +when.rows[0].e;
  if (e < Date.now() + 5 * 60e3) return res.status(400).json({ error: 'That time has already gone by.' });
  if (s > Date.now() + 60 * 86400e3) return res.status(400).json({ error: 'You can book up to two months ahead.' });
  const mine = await query('SELECT count(*)::int AS n FROM party_bookings WHERE user_id = $1 AND ends_at > now()', [req.user.id]);
  if (mine.rows[0].n >= 2) return res.status(400).json({ error: 'You have two parties booked already — enjoy those first!' });
  const clash = await query('SELECT title FROM party_bookings WHERE starts_at < $2 AND ends_at > $1 LIMIT 1', [new Date(s), new Date(e)]);
  if (clash.rows[0]) return res.status(409).json({ error: `The hall is booked then (“${clash.rows[0].title}”) — try another time.` });
  await query('INSERT INTO party_bookings (user_id, occasion, title, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5)', [req.user.id, occasion, title, new Date(s), new Date(e)]);
  await partyNews();
  res.json({ bookings: await bookings(req.user.id), now: Date.now() });
}));
router.delete('/party/book/:id(\\d+)', auth.requireUser, wrap(async (req, res) => {
  const { rows } = await query('DELETE FROM party_bookings WHERE id = $1 AND (user_id = $2 OR $3) RETURNING id', [Number(req.params.id), req.user.id, !!req.user.is_admin]);
  if (!rows[0]) return res.status(404).json({ error: 'That booking isn’t yours to cancel.' });
  await partyNews();
  res.json({ bookings: await bookings(req.user.id), now: Date.now() });
}));
router.post('/party/confetti', auth.requireUser, rateLimit({ windowMs: 60e3, max: 10 }), (req, res) => {
  realtime.broadcast({ t: 'party:confetti', who: nameOf(req.user) }, null, 'party');
  res.json({ ok: true });
});

module.exports = { router };
