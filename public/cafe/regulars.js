// The regulars: quiet background guests who make the café feel lived in.
// They come in through the front door, order at the counter, take a free
// seat with their drink (and a book, a laptop or the paper), sip now and
// then, and leave when they're done. Busier at lunch and in the evening,
// almost nobody after closing — and fewer of them when real people are in.
//
// Who comes in and when is worked out from the clock, so everyone in the
// café sees the same regulars at about the same times. How they walk is
// worked out here, on each screen.

import * as THREE from 'three';
import { buildAvatar, makeCup, disposeTree, tempOf } from './avatar.js';
import { makeDessert, setBites } from './pastries.js';

const SLOT = 75e3;               // a possible arrival every 75 seconds
const SPEED = 1.1;               // metres per second, unhurried
const DOOR_OUT = new THREE.Vector3(0, 0, 12.6);
const DOOR_IN = new THREE.Vector3(0, 0, 10.2);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// How likely a slot brings someone in, by the hour (Cairo time).
function busyness(h) {
  if (h < 10 || h >= 22) return 0.04;                  // closed: the odd night owl
  if (h >= 12.5 && h < 15) return 0.72;                // lunch
  if (h >= 17.5 && h < 20.5) return 0.68;              // after work
  if (h < 11) return 0.32;                             // just opened
  return 0.46;
}

const SKIN = ['#f3d2b5', '#e8b996', '#d9a47c', '#c68b62', '#a8704a', '#8a5a3c', '#f6dcc8'];
const HAIR = ['#2a1d18', '#3b2a22', '#5a3a26', '#7a4e2e', '#1d1d22', '#9a6a3e', '#c9a27a', '#6b6b6b'];
const OUTFIT = ['#7a8fa6', '#b7a58c', '#5f7a64', '#a86b5a', '#4d5566', '#d9c8b0', '#8a6f9a', '#c9a24a', '#3f5d6e', '#e3d5c6', '#9a4f4f'];
const ACCENT = ['#fef9f5', '#efe6da', '#2f2a28', '#d9d2c5'];
const LINES = ['A {d}, please.', 'Could I get a {d}?', 'One {d} — thank you!', 'The {d}, like always.', 'Just a {d} today 🌸'];

export function createRegulars({ world, staff, sound, menu, pastries = () => [], takenBy, say, now = () => Date.now(), hour }) {
  const main = world.floors.main;
  const group = new THREE.Group();
  main.group.add(group);
  const live = new Map(); // visit id → regular
  const dirty = [];       // tables left with empty cups and plates, waiting for the team
  let clock = 0;          // seconds of café time, for how long a table has waited
  let cap = 9;

  // the counter: where they queue to order
  const cb = new THREE.Box3().setFromObject(world.counter);
  const counterFront = (r) => new THREE.Vector3(
    Math.min(cb.max.x - 0.6, Math.max(cb.min.x + 0.6, (cb.min.x + cb.max.x) / 2 + (r - 0.5) * 3)), 0, cb.max.z + 0.75);
  const counterPos = { x: (cb.min.x + cb.max.x) / 2, y: 1.1, z: cb.max.z - 0.4 };

  const seats = () => main.seats.filter(s => s.table && s.h != null); // seats at a table or the bar
  const mine = () => new Set([...live.values()].map(g => g.seat && g.seat.id).filter(Boolean));

  function visit(k) {
    const r = rng(k * 2654435761);
    const v = {
      id: k, arrive: k * SLOT + r() * SLOT, stay: (8 + r() * 16) * 60e3, rank: r(),
      seatPref: r(), counterR: r(), thing: pick(r, ['book', 'book', 'laptop', 'paper', 'phone', 'none']),
      look: {
        body: 'person', gender: r() < 0.5 ? 'she' : 'he', skin: pick(r, SKIN), hair: pick(r, HAIR),
        outfit: pick(r, OUTFIT), accent: pick(r, ACCENT),
      },
      drinkR: r(), lineR: r(), pastry: r() < 0.35 ? r() : -1, leaveBehind: r() < 0.2,
    };
    v.look.hairStyle = v.look.gender === 'she' ? pick(r, ['long', 'bun', 'bob', 'curly', 'long']) : pick(r, ['short', 'short', 'curly', 'none', 'short']);
    v.look.bottom = v.look.gender === 'she' && r() < 0.4 ? 'skirt' : 'trousers';
    v.look.accessory = r() < 0.25 ? pick(r, ['glasses', 'glasses', 'scarf', 'beanie', 'headphones']) : 'none';
    return v;
  }

  function freeSeat(v) {
    const all = seats();
    if (!all.length) return null;
    const busy = mine();
    const start = Math.floor(v.seatPref * all.length);
    for (let i = 0; i < all.length; i++) {
      const s = all[(start + i * 7) % all.length]; // a stride, so they spread across the room
      if (!busy.has(s.id) && !takenBy(s) && !dirty.some(d => d.table === s.table)) return s;
    }
    return null;
  }

  // Something on the table in front of them while they sit.
  function prop(thing) {
    const g = new THREE.Group();
    const m = (geo, color, o = {}) => { const x = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o })); x.castShadow = true; return x; };
    if (thing === 'book') {
      for (const s of [-1, 1]) {
        const leaf = m(new THREE.BoxGeometry(0.11, 0.012, 0.16), '#fbf6ec');
        leaf.position.set(0.057 * s, 0.008, 0); leaf.rotation.z = -0.06 * s;
        g.add(leaf);
      }
      const cover = m(new THREE.BoxGeometry(0.23, 0.006, 0.165), pick(Math.random, ['#7a4e3a', '#3f5d6e', '#8a6f9a', '#5f7a64']));
      g.add(cover);
    } else if (thing === 'laptop') {
      const base = m(new THREE.BoxGeometry(0.3, 0.014, 0.21), '#b9bcc2', { metalness: 0.5, roughness: 0.35 });
      base.position.y = 0.007;
      const lid = m(new THREE.BoxGeometry(0.3, 0.2, 0.01), '#b9bcc2', { metalness: 0.5, roughness: 0.35 });
      lid.position.set(0, 0.11, -0.1); lid.rotation.x = -0.25;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.17), new THREE.MeshStandardMaterial({ color: '#dfe8f2', emissive: '#9fb8d6', emissiveIntensity: 0.35 }));
      screen.position.set(0, 0.11, -0.094); screen.rotation.x = -0.25; // facing whoever's sitting there
      g.add(base, lid, screen);
    } else if (thing === 'paper') {
      const p = m(new THREE.BoxGeometry(0.3, 0.006, 0.22), '#ece7dc', { roughness: 0.95 });
      g.add(p);
    } else if (thing === 'phone') {
      const p = m(new THREE.BoxGeometry(0.07, 0.008, 0.145), '#202226', { roughness: 0.3 });
      p.position.x = 0.12;
      g.add(p);
    }
    return g;
  }

  function spawn(v, e) {
    const seat = freeSeat(v);
    if (!seat && e > 15e3) return null;
    const av = buildAvatar(v.look);
    group.add(av.group);
    const items = menu();
    const drink = items.length ? items[Math.floor(v.drinkR * items.length) % items.length] : { name: 'latte', color: '#d9b48f' };
    const g = {
      v, av, seat, drink, path: [], phase: 'enter', wait: 0, level: 1, sipIn: 8 + Math.random() * 20,
      pos: new THREE.Vector3(), ry: Math.PI, cup: null, prop: null, pageIn: 10 + Math.random() * 30,
    };
    if (e < 15e3 && seat) {
      // just arriving: walk in through the door
      g.pos.copy(DOOR_OUT);
      g.queue = counterFront(v.counterR);
      g.path = [DOOR_IN.clone(), ...route(DOOR_IN, g.queue)];
    } else {
      // already here when you came in: sitting with their drink
      sitDown(g, true);
    }
    live.set(v.id, g);
    return g;
  }

  function route(from, to) {
    const p = staff.findPath(from, to, { guest: true });
    if (!p || p.length < 2) return [to.clone()];
    const out = p.slice(1).map(q => new THREE.Vector3(q.x, 0, q.z));
    out[out.length - 1] = to.clone();
    return out;
  }

  const seatSpot = s => { const k = s.h < 0.5 ? 0 : 0.08; return new THREE.Vector3(s.x + Math.sin(s.ry) * k, s.y, s.z + Math.cos(s.ry) * k); };
  const tableSpot = s => new THREE.Vector3(s.x + Math.sin(s.ry) * 0.5, (s.h > 0.7 ? 1.006 : 0.786), s.z + Math.cos(s.ry) * 0.5);

  function sitDown(g, quiet = false) {
    if (!g.seat || takenBy(g.seat)) { g.seat = freeSeat(g.v); if (!g.seat) return leave(g); }
    g.phase = 'seated';
    g.pos.copy(seatSpot(g.seat));
    g.ry = g.seat.ry;
    g.av.setDrink(null);
    // the cup goes on the table, and whatever they brought beside it
    const spot = tableSpot(g.seat);
    const side = new THREE.Vector3(Math.cos(g.seat.ry), 0, -Math.sin(g.seat.ry)).multiplyScalar(0.13);
    g.level = quiet ? 0.35 + Math.random() * 0.6 : 1;
    g.cup = makeCup(g.drink.color, g.level, tempOf(g.drink));
    g.cup.position.copy(spot).add(side).add(new THREE.Vector3(0, 0.055, 0));
    group.add(g.cup);
    const ps = pastries();
    if (g.v.pastry >= 0 && ps.length) {
      const pastry = ps[Math.floor(g.v.pastry * ps.length) % ps.length];
      g.bites = quiet ? Math.floor(Math.random() * 3) : 0;
      g.plate = makeDessert(pastry.shape, g.bites);
      g.plate.position.copy(spot).add(new THREE.Vector3(Math.sin(g.seat.ry) * 0.17, -0.006, Math.cos(g.seat.ry) * 0.17)).sub(side.clone().multiplyScalar(0.4));
      group.add(g.plate);
    }
    if (g.v.thing !== 'none') {
      g.prop = prop(g.v.thing);
      g.prop.position.copy(spot).sub(side.clone().multiplyScalar(0.6));
      g.prop.rotation.y = g.seat.ry + Math.PI;
      group.add(g.prop);
    }
    if (!quiet) { sound.chair(g.pos); setTimeout(() => sound.cupDown(g.cup ? g.cup.position : g.pos), 900); }
  }

  function leave(g) {
    if (g.phase === 'leaving') return;
    const wasSeated = g.phase === 'seated';
    g.phase = 'leaving';
    // the empty cup and plate stay on the table for the team to clear (and now and then a book or the paper)
    const left = [];
    if (g.cup) { g.cup.userData.setLevel(0.03); left.push(g.cup); g.cup = null; }
    if (g.plate) { setBites(g.plate, 3); left.push(g.plate); g.plate = null; }
    if (g.prop) { if (wasSeated && g.v.leaveBehind && g.v.thing !== 'laptop' && g.v.thing !== 'phone') left.push(g.prop); else { group.remove(g.prop); disposeTree(g.prop); } g.prop = null; }
    if (left.length && wasSeated && g.seat) dirty.push({ items: left, table: g.seat.table, spot: new THREE.Vector3(g.seat.x, 0, g.seat.z), t: clock, clearing: false });
    else left.forEach(m => { group.remove(m); disposeTree(m); });
    if (wasSeated && g.seat) {
      sound.chair(g.pos);
      g.pos.set(g.seat.x + Math.cos(g.seat.ry) * 0.62, 0, g.seat.z - Math.sin(g.seat.ry) * 0.62);
    }
    g.seat = null;
    g.path = [...route(g.pos, DOOR_IN), DOOR_OUT.clone()];
  }

  function remove(g) {
    if (g.cup) { group.remove(g.cup); disposeTree(g.cup); }
    if (g.plate) { group.remove(g.plate); disposeTree(g.plate); }
    if (g.prop) { group.remove(g.prop); disposeTree(g.prop); }
    group.remove(g.av.group);
    disposeTree(g.av.group);
    live.delete(g.v.id);
  }

  function walk(g, dt) {
    const t = g.path[0];
    if (!t) return false;
    const dx = t.x - g.pos.x, dz = t.z - g.pos.z, d = Math.hypot(dx, dz);
    const step = SPEED * dt;
    if (d <= step) { g.pos.set(t.x, 0, t.z); g.path.shift(); }
    else { g.pos.x += dx / d * step; g.pos.z += dz / d * step; }
    const want = Math.atan2(dx, dz);
    let diff = want - g.ry;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.ry += diff * Math.min(1, dt * 8);
    return true;
  }

  // who should be in, right now
  let checkIn = 0;
  function schedule() {
    const t = now();
    const h = hour();
    const want = [];
    const k0 = Math.floor((t - 30 * 60e3) / SLOT), k1 = Math.floor(t / SLOT);
    for (let k = k0; k <= k1; k++) {
      const v = visit(k);
      const vh = ((h - (t - v.arrive) / 3600e3) % 24 + 24) % 24; // the hour they arrived
      if (v.rank >= busyness(vh)) continue;
      if (t < v.arrive || t > v.arrive + v.stay) continue;
      want.push(v);
    }
    const keep = new Set(want.slice(-cap).map(v => v.id));
    for (const v of want) {
      if (!keep.has(v.id) || live.has(v.id)) continue;
      spawn(v, t - v.arrive);
    }
    for (const g of live.values()) {
      if (g.phase !== 'leaving' && (!keep.has(g.v.id) || t > g.v.arrive + g.v.stay)) leave(g);
    }
  }

  // The team notice a table that needs clearing after a little while.
  function clearTables() {
    const d = dirty.find(x => !x.clearing && clock - x.t > 25);
    if (!d) return;
    const who = ['yuto', 'hana', 'yuki'].find(id => !staff.busy(id));
    if (!who) return;
    d.clearing = true;
    const ok = staff.clear(who, d.spot, () => {
      sound.cupDown(d.items[0] ? d.items[0].position : d.spot);
      d.items.forEach(m => { group.remove(m); disposeTree(m); });
      dirty.splice(dirty.indexOf(d), 1);
    });
    if (!ok) d.clearing = false;
  }
  // When you walk in, a table or two hasn't been cleared yet — as in any real café.
  let seeded = false;
  function seedUsedTables() {
    seeded = true;
    const ps = pastries();
    const all = seats().filter(s => !takenBy(s) && s.h < 0.7);
    for (let n = 0; n < 2 && all.length; n++) {
      const s = all.splice(Math.floor(Math.random() * all.length), 1)[0];
      if (dirty.some(d => d.table === s.table) || mine().has(s.id)) continue;
      const items = menu();
      const d = items[Math.floor(Math.random() * items.length)] || { color: '#d9b48f' };
      const spot = tableSpot(s);
      const cup = makeCup(d.color, 0.03, tempOf(d));
      cup.position.copy(spot).add(new THREE.Vector3(0, 0.055, 0));
      group.add(cup);
      const left = [cup];
      if (ps.length && Math.random() < 0.6) {
        const plate = makeDessert(ps[Math.floor(Math.random() * ps.length)].shape, 3);
        plate.position.copy(spot).add(new THREE.Vector3(Math.cos(s.ry) * 0.14, -0.006, -Math.sin(s.ry) * 0.14));
        group.add(plate);
        left.push(plate);
      }
      if (Math.random() < 0.4) {
        const paper = prop(Math.random() < 0.5 ? 'paper' : 'book');
        paper.position.copy(spot).add(new THREE.Vector3(-Math.cos(s.ry) * 0.16, 0, Math.sin(s.ry) * 0.16));
        paper.rotation.y = s.ry + Math.PI + 0.3;
        group.add(paper);
        left.push(paper);
      }
      dirty.push({ items: left, table: s.table, spot: new THREE.Vector3(s.x, 0, s.z), t: clock + Math.random() * 40, clearing: false });
    }
  }

  function update(dt) {
    clock += dt;
    checkIn -= dt;
    if (checkIn <= 0) {
      checkIn = 2;
      if (!seeded) seedUsedTables();
      schedule();
      clearTables();
    }
    for (const g of [...live.values()]) {
      let moving = false;
      if (g.phase === 'enter') {
        moving = walk(g, dt);
        if (!g.path.length) {
          g.phase = 'order'; g.wait = 7 + Math.random() * 4; g.ry = Math.PI;
          staff.attend('hana', g.pos, 9);
          say(g.av.group, pick(() => g.v.lineR, LINES).replace('{d}', g.drink.name));
          setTimeout(() => sound.espresso(counterPos, !/tea|juice|lemonade|smoothie|slush|float/i.test(g.drink.name)), 1200);
        }
      } else if (g.phase === 'order') {
        g.wait -= dt;
        if (g.wait <= 0) {
          sound.counterBell(counterPos);
          g.av.setDrink(g.drink.color, 1, tempOf(g.drink));
          if (!g.seat || takenBy(g.seat)) g.seat = freeSeat(g.v);
          if (!g.seat) leave(g);
          else { g.phase = 'toSeat'; g.path = route(g.pos, new THREE.Vector3(g.seat.x, 0, g.seat.z)); }
        }
      } else if (g.phase === 'toSeat') {
        moving = walk(g, dt);
        if (g.seat && takenBy(g.seat)) { g.seat = freeSeat(g.v); if (g.seat) g.path = route(g.pos, new THREE.Vector3(g.seat.x, 0, g.seat.z)); else leave(g); }
        if (g.phase === 'toSeat' && !g.path.length) sitDown(g);
      } else if (g.phase === 'seated') {
        // someone real wants this seat: give it up and go
        if (takenBy(g.seat)) leave(g);
        else {
          g.sipIn -= dt;
          if (g.sipIn <= 0 && g.cup) {
            g.sipIn = 25 + Math.random() * 45;
            g.level = Math.max(0.08, g.level - 0.12);
            g.cup.visible = false;
            g.av.setDrink(g.drink.color, g.level, tempOf(g.drink));
            g.av.play('sip');
            setTimeout(() => {
              if (!g.cup) return;
              g.av.setDrink(null);
              g.cup.userData.setLevel(g.level);
              g.cup.visible = true;
              sound.cupDown(g.cup.position);
            }, 2600);
          }
          if (g.plate && g.bites < 3) {
            g.biteIn = (g.biteIn ?? 40 + Math.random() * 60) - dt;
            if (g.biteIn <= 0) { g.biteIn = 50 + Math.random() * 80; g.bites++; g.av.play('bite'); setBites(g.plate, g.bites); }
          }
          if (g.v.thing === 'book' || g.v.thing === 'paper') {
            g.pageIn -= dt;
            if (g.pageIn <= 0) { g.pageIn = 20 + Math.random() * 40; sound.page(g.pos); }
          }
        }
      } else if (g.phase === 'leaving') {
        moving = walk(g, dt);
        if (!g.path.length) { remove(g); continue; }
      }
      g.av.group.position.copy(g.pos);
      g.av.group.rotation.y = g.ry;
      g.av.update(dt, { moving, sitting: g.phase === 'seated', sitH: g.seat ? g.seat.h : 0.54 });
    }
  }

  return {
    update,
    setCap(n) { cap = Math.max(0, n); },
    seatTaken: seat => [...live.values()].some(g => g.seat && g.seat.id === seat.id && g.phase !== 'leaving'),
    positions: () => [...live.values()].map(g => g.pos),
    count: () => live.size,
    dirtyTables: () => dirty.length,
    debug: () => [...live.values()].map(g => ({ phase: g.phase, seat: g.seat && g.seat.label, thing: g.v.thing, drink: g.drink.name })),
  };
}
