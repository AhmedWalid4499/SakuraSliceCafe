// The roof garden (the third floor). It's open to everyone, like the ground
// floor, and its beds are shared: water the mint and it's watered for
// everyone. The beds live in memory, worked out lazily from the time that has
// passed, and are saved to garden_beds after every change, so a deploy or a
// restart doesn't lose the garden.
//
// Each bed has a stage: 0 bare soil (plant it), 1 seedlings, 2 growing,
// 3 ready to pick. Watered beds grow; dry ones wait. Weeds come back if
// nobody tends a bed for a while, and slow it down.

const express = require('express');
const { query } = require('./db');
const auth = require('./auth');
const { rateLimit, wrap } = require('./util');
const realtime = require('./realtime');

const ROOM = 'garden';
const HOUR = 3600e3;
const WATER_LASTS_H = 6;     // a full watering lasts this long
const STAGE_H = 0.75;        // hours of watered time per stage
const WEEDS_AFTER_H = 5;     // untended this long and the weeds are back

// The beds and what the café does with them. The order is the layout order
// (world.js puts them in two rows of four).
const BEDS = [
  { id: 'mint', plant: 'Mint', perennial: true, use: 'Hana muddles it into the mint iced green tea.' },
  { id: 'basil', plant: 'Basil', perennial: true, use: "Yuto puts it on his sandwiches and pretends it's for the café." },
  { id: 'chamomile', plant: 'Chamomile', perennial: true, use: 'Dried for the bedtime chamomile tea.' },
  { id: 'lavender', plant: 'Lavender', perennial: true, use: 'Yuki dries it for the lavender shortbread.' },
  { id: 'strawberries', plant: 'Strawberries', seed: 'strawberry', perennial: true, use: 'Straight into the strawberry banana smoothies.' },
  { id: 'tomatoes', plant: 'Cherry tomatoes', seed: 'cherry tomato', perennial: false, use: "For the staff lunch. Also, Yuto eats them off the vine. Don't tell anyone." },
  { id: 'sunflowers', plant: 'Sunflowers', seed: 'sunflower', perennial: false, use: 'They go in jars on the tables downstairs.' },
  { id: 'jasmine', plant: 'Jasmine', perennial: true, use: 'For the jasmine green tea — and it smells like a Cairo summer night.' },
];
const BY_ID = new Map(BEDS.map(b => [b.id, b]));

// How the garden looks the very first time (a garden mid-way, with jobs to do).
const FIRST = {
  mint: { stage: 3, water: 0.6 }, basil: { stage: 2, water: 0.2 }, chamomile: { stage: 1, water: 0 },
  lavender: { stage: 2, water: 0.7, weeds: true }, strawberries: { stage: 3, water: 0.4 }, tomatoes: { stage: 0, water: 0.3 },
  sunflowers: { stage: 1, water: 0.5, weeds: true }, jasmine: { stage: 2, water: 0 },
};

let beds = null; // id -> { stage, progress, water, weeds, tended, at }

async function load() {
  if (beds) return beds;
  const next = new Map();
  const { rows } = await query('SELECT id, state FROM garden_beds');
  const saved = new Map(rows.map(r => [r.id, r.state]));
  const now = Date.now();
  for (const b of BEDS) {
    const s = saved.get(b.id) || FIRST[b.id] || {};
    next.set(b.id, {
      stage: clampInt(s.stage, 0, 3), progress: num(s.progress, 0, 1), water: num(s.water, 0, 1),
      weeds: !!s.weeds, tended: Number(s.tended) || now, at: Number(s.at) || now,
    });
  }
  beds = beds || next; // another request may have loaded it meanwhile
  return beds;
}
const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const clampInt = (v, lo, hi) => Math.round(num(v, lo, hi));

// Bring a bed up to now: water drains, watered beds grow, weeds come back.
function advance(s, now = Date.now()) {
  const dt = Math.max(0, (now - s.at) / HOUR);
  if (dt > 0) {
    const wetH = Math.min(dt, s.water * WATER_LASTS_H);
    if (s.stage >= 1 && s.stage < 3 && wetH > 0) {
      s.progress += (wetH / STAGE_H) * (s.weeds ? 0.5 : 1);
      while (s.progress >= 1 && s.stage < 3) { s.stage++; s.progress -= 1; }
      if (s.stage === 3) s.progress = 0;
    }
    s.water = Math.max(0, s.water - dt / WATER_LASTS_H);
    if (!s.weeds && s.stage > 0 && now - s.tended > WEEDS_AFTER_H * HOUR) s.weeds = true;
    s.at = now;
  }
  return s;
}

function needs(s) {
  const out = [];
  if (s.stage === 0) out.push('plant');
  if (s.water < 0.35 && s.stage > 0) out.push('water');
  if (s.weeds) out.push('weed');
  if (s.stage === 3) out.push('harvest');
  return out;
}

function view(id) {
  const b = BY_ID.get(id), s = advance(beds.get(id));
  return {
    id, plant: b.plant, perennial: b.perennial, use: b.use,
    stage: s.stage, progress: Math.round(s.progress * 100) / 100, water: Math.round(s.water * 100) / 100,
    weeds: s.weeds, needs: needs(s),
  };
}
const allViews = () => BEDS.map(b => view(b.id));

async function save(id) {
  const s = beds.get(id);
  await query(
    `INSERT INTO garden_beds (id, state, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [id, JSON.stringify(s)]);
}

const ACTIONS = {
  plant: {
    can: s => s.stage === 0, not: 'Something is already growing there.',
    run: s => { s.stage = 1; s.progress = 0; s.tended = Date.now(); s.weeds = false; },
    done: b => `You press the ${(b.seed || b.plant).toLowerCase()} seeds into the soil. Give them some water and they'll be up in no time.`,
    col: 'plants',
  },
  water: {
    can: s => s.water < 0.85, not: "It's still damp — it's had plenty for now.",
    run: s => { s.water = 1; },
    done: b => `You water the ${b.plant.toLowerCase()}. The soil goes dark and smells of rain.`,
    col: 'waters',
  },
  weed: {
    can: s => s.weeds, not: 'No weeds in this one right now.',
    run: s => { s.weeds = false; s.tended = Date.now(); },
    done: b => `You pull the weeds from round the ${b.plant.toLowerCase()}. Much better.`,
    col: 'weeds',
  },
  harvest: {
    can: s => s.stage === 3, not: "It isn't ready to pick yet.",
    run: (s, b) => { s.stage = b.perennial ? 2 : 0; s.progress = 0; s.tended = Date.now(); },
    done: b => `You pick a basket of ${b.plant.toLowerCase()}. ${b.use}${b.perennial ? '' : ' The bed is ready for new seeds.'}`,
    col: 'harvests',
  },
};

async function helperStats(userId) {
  const { rows } = await query('SELECT plants, waters, weeds, harvests FROM garden_helpers WHERE user_id = $1', [userId]);
  return rows[0] || { plants: 0, waters: 0, weeds: 0, harvests: 0 };
}

const router = express.Router();
const actLimit = rateLimit({ windowMs: 60e3, max: 30, message: 'Gently — the plants are not going anywhere.' });
const lastAct = new Map(); // userId -> time, so one person can't machine-gun the beds
setInterval(() => { const cut = Date.now() - 60e3; for (const [k, t] of lastAct) if (t < cut) lastAct.delete(k); }, 60e3).unref();

router.get('/garden', auth.requireUser, wrap(async (req, res) => {
  await load();
  res.json({ beds: allViews(), me: await helperStats(req.user.id) });
}));

router.post('/garden/:bed/:action', auth.requireUser, actLimit, wrap(async (req, res) => {
  await load();
  const b = BY_ID.get(req.params.bed);
  const a = ACTIONS[req.params.action];
  if (!b || !a) return res.status(404).json({ error: 'There is no such bed.' });
  const now = Date.now();
  if (now - (lastAct.get(req.user.id) || 0) < 1500) return res.status(429).json({ error: 'One thing at a time 🌱' });
  lastAct.set(req.user.id, now);
  const s = advance(beds.get(b.id), now);
  if (!a.can(s)) return res.status(409).json({ error: a.not, bed: view(b.id) });
  a.run(s, b);
  await save(b.id);
  const { rows } = await query(
    `INSERT INTO garden_helpers (user_id, ${a.col}) VALUES ($1, 1)
     ON CONFLICT (user_id) DO UPDATE SET ${a.col} = garden_helpers.${a.col} + 1, updated_at = now()
     RETURNING plants, waters, weeds, harvests`, [req.user.id]);
  const bedsNow = allViews();
  realtime.broadcast({ t: 'garden', beds: bedsNow, by: { id: req.user.id, name: req.user.display_name, action: req.params.action, bed: b.id } }, null, ROOM);
  res.json({ ok: true, message: a.done(b), beds: bedsNow, me: rows[0] });
}));

module.exports = { router, ROOM, BEDS };
