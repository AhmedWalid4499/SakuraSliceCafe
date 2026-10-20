// Sakura Slice Café — the 3D café.
// Accounts, walking, sitting, notes, ordering, chat and live presence.
// Everything people leave behind is saved in Postgres through /api.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, ROOM, STAIRS, noFog } from './world.js';
import { mapX, mapZ } from './layout.mjs';
import { currentWeather, WEATHER } from './weather.js';
import { buildAvatar, makeLabel, makeCup, disposeTree, tempOf } from './avatar.js';
import { makeDessert } from './pastries.js';
import { makeNote, makeGhost, NOTE_COLORS } from './notes.js';
import { Soundscape } from './audio.js';
import { createStaff } from './staff.js';
import { fullMenu, SEASONS } from './drinks.mjs';
import { FURNITURE, BY_KIND, CATS, MAX_ITEMS, WALLS, FLOORS, AREAS, areaAt, WALLPAPERS, COATS } from './furniture.mjs';
import { createRadio, audioDuration } from './radio.js';
import { createRegulars } from './regulars.js';
import { createGames } from './games.js';
import { createTour } from './tour.js';
import { cairoPrayerDay } from './prayertimes.mjs';

const $ = id => document.getElementById(id);
// Came from an invite link? (/cafe?invite=<username>&table=<table>)
const invite = (() => {
  const q = new URLSearchParams(location.search);
  const from = (q.get('invite') || '').toLowerCase().slice(0, 24);
  return { from: /^[a-z0-9_.]{3,24}$/.test(from) ? from : '', table: /^[\w-]{1,24}$/.test(q.get('table') || '') ? q.get('table') : '', name: '' };
})();

// ───────────────────────────────────────── API

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Something went wrong. Please try again.');
    err.detail = data && data.detail; // only sent to the café owner
    throw err;
  }
  return data;
}

// ───────────────────────────────────────── state

const state = {
  room: 'main',         // 'main' = the café; 'group:<id>' = that group's room upstairs
  roomName: null,
  me: null,
  content: {},
  notes: new Map(),     // id -> { note, group }
  people: new Map(),    // id -> remote person
  placing: false,
  pending: null,        // where the note being written will go
  reading: null,
  quality: 'high',
  started: false,
};

const sound = new Soundscape();

// ───────────────────────────────────────── renderer (smooth, never pixelated)

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function applyQuality(q) {
  state.quality = q;
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(q === 'gentle' ? 1 : q === 'balanced' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
  renderer.shadowMap.enabled = q !== 'gentle';
  world.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  post.on = q === 'high' && post.ok;
  resize();
}

// On the sharpest setting the picture gets the touches a camera would give
// it: soft shadows where things meet (ambient occlusion — under the tables,
// in the corners, where a cup sits) and a gentle glow off the lamps.
const post = { on: false, ok: true, composer: null, ao: null };
function makePost() {
  try {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(world.scene, camera));
    const ao = new GTAOPass(world.scene, camera, 1, 1);
    ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    ao.blendIntensity = 0.85;
    // name tags, bubbles, glass and rain shouldn't throw ambient shadows
    const hideOwn = ao.overrideVisibility.bind(ao);
    ao.overrideVisibility = function () {
      hideOwn();
      this.scene.traverse(o => {
        const m = o.material;
        if (o.isSprite || (m && !Array.isArray(m) && m.transparent && (m.opacity < 0.95 || m.depthWrite === false))) o.visible = false;
      });
    };
    composer.addPass(ao);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.16, 0.45, 0.92));
    composer.addPass(new OutputPass());
    post.composer = composer;
    post.ao = ao;
  } catch (e) {
    console.warn('post-processing unavailable', e);
    post.ok = false;
  }
}

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 400);

// Fonts first — the signs and notes are drawn with them.
await Promise.all([
  document.fonts.load('700 40px "Playfair Display"'),
  document.fonts.load('600 40px "Dancing Script"'),
  document.fonts.load('600 40px Nunito'),
  document.fonts.load('700 40px Nunito'),
]).catch(() => {});

const world = buildWorld(renderer);
makePost();
// the team walks about, and brings orders to your table (see staff.js)
const staff = createStaff(world, { say: (n, line) => bubble(n.av.group, line, 'npc') });
world.onThunder = () => sound.thunder();
const scene = world.scene;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (post.composer) { post.composer.setPixelRatio(renderer.getPixelRatio()); post.composer.setSize(w, h); }
  camera.aspect = w / h;
  camera.fov = w < 640 ? 65 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
applyQuality('high');

// ───────────────────────────────────────── Cairo time → light

function cairoHour() {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const h = Number(parts.find(p => p.type === 'hour').value);
    const m = Number(parts.find(p => p.type === 'minute').value);
    return h + m / 60;
  } catch (e) {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }
}
function cairoClock() {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date());
  } catch (e) { return ''; }
}
function cairoDay() {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', weekday: 'long' }).format(new Date()) + ' in Cairo';
  } catch (e) { return 'Cairo'; }
}
// Cairo's wall clock as plain numbers, for the calendar (seasons, events).
function cairoNow() {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date()).map(p => [p.type, p.value]));
    // a Date whose UTC fields read as Cairo's local time — easy to compare and count in
    return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute));
  } catch (e) { return new Date(); }
}
// The Islamic (Hijri) month and day, for Ramadan and the two Eids.
function hijri() {
  for (const cal of ['islamic-umalqura', 'islamic-civil', 'islamic']) {
    try {
      const f = new Intl.DateTimeFormat(`en-u-ca-${cal}`, { timeZone: 'Africa/Cairo', month: 'numeric', day: 'numeric' });
      const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
      if (p.month) return { month: +p.month, day: +p.day };
    } catch (e) { /* try the next calendar */ }
  }
  return null;
}
// The season (or the owner's choice, in site_content 'cafe.season'), Ramadan and Eid, and the hours.
function calendar() {
  const conf = state.content['cafe.season'] || {};
  const m = cairoNow().getUTCMonth() + 1;
  const auto = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  const season = ['spring', 'summer', 'autumn', 'winter'].includes(conf.season) ? conf.season : auto;
  const h = hijri();
  const ramadan = conf.ramadan === true || conf.ramadan === 'on' ? true : conf.ramadan === false || conf.ramadan === 'off' ? false : !!(h && h.month === 9);
  const eid = conf.eid === true || conf.eid === 'on' || (conf.eid !== false && conf.eid !== 'off' && !!h && ((h.month === 10 && h.day <= 3) || (h.month === 12 && h.day >= 10 && h.day <= 13)));
  const hours = ramadan ? { open: 12, close: 2, ...(conf.ramadanHours || {}) } : { open: 10, close: 22, ...(conf.hours || {}) };
  return { season, ramadan, eid, hours };
}
function applyCalendar() {
  const cal = calendar();
  state.calendar = cal;
  world.setSeason(cal);
  world.setHours(cal.hours.open, cal.hours.close, cal.ramadan ? 'in Ramadan' : 'every day');
  return cal;
}

// ── the weather: Cairo's own (seeded by the date), unless the owner set it
let weatherNow = null;
function refreshWeather() {
  const w = currentWeather(state.content['cafe.weather']);
  const changed = !weatherNow || weatherNow.key !== w.key;
  weatherNow = w;
  if (changed) {
    world.setWeather(w.look);
    sound.setWeather(w.look);
  }
  $('wxChipIcon').textContent = w.icon;
  $('wxChipText').textContent = `${w.temp}° ${w.label}`;
  if (!$('wxPanel').classList.contains('hidden')) fillWeatherPanel();
}

function fillWeatherPanel() {
  const w = weatherNow;
  $('wxBigIcon').textContent = w.icon;
  $('wxTemp').textContent = `${w.temp}°C`;
  $('wxLabel').textContent = w.label;
  $('wxNote').textContent = w.note;
  $('wxWhy').textContent = w.manual
    ? `Set by the café${w.until ? ' until ' + new Date(w.until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}.`
    : "Cairo's weather today, by its real seasons. The light follows Cairo's clock.";
}

function openWeather() {
  if (!weatherNow) refreshWeather();
  fillWeatherPanel();
  const admin = !!(state.me && state.me.isAdmin);
  $('wxAdmin').classList.toggle('hidden', !admin);
  if (admin) {
    const o = state.content['cafe.weather'];
    let pick = o && o.mode === 'set' ? o.condition : 'auto';
    const box = $('wxChoices');
    box.replaceChildren(...[['auto', '🗓️', "Cairo's own"], ...Object.entries(WEATHER).map(([k, v]) => [k, v.icon, v.label])].map(([k, icon, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (k === pick ? ' on' : '');
      b.textContent = `${icon} ${label}`;
      b.onclick = () => { pick = k; [...box.children].forEach(x => x.classList.toggle('on', x === b)); };
      return b;
    }));
    $('wxSave').onclick = async () => {
      $('wxErr').textContent = '';
      let value = { mode: 'auto' };
      if (pick !== 'auto') {
        const f = $('wxFor').value;
        let until = null;
        if (f === 'day') {
          const d = new Date(); d.setHours(23, 59, 0, 0); until = d.toISOString();
        } else if (f) until = new Date(Date.now() + Number(f) * 60e3).toISOString();
        const t = $('wxSetTemp').value;
        value = { mode: 'set', condition: pick, until, temp: t === '' ? null : Number(t) };
      }
      try {
        await api('/admin/content/cafe.weather', { method: 'PUT', body: { value, description: "The café's weather. mode 'auto' = Cairo's own; mode 'set' = condition (clear, hazy, still, cloudy, rain, storm, fog, khamaseen) until a time (or for good), with an optional temp." } });
        state.content['cafe.weather'] = value;
        refreshWeather();
        toast(pick === 'auto' ? "🗓️ Back to Cairo's own weather." : `${WEATHER[pick].icon} It's ${WEATHER[pick].label.toLowerCase()} now — for everyone.`);
      } catch (e) { $('wxErr').textContent = e.message; }
    };
  }
  openPanel('wxPanel');
}
$('wxChip').onclick = openWeather;
$('wxOwnerBtn').onclick = openWeather;

let lastDay = '';
function updateTime() {
  const h = cairoHour();
  const today = cairoNow().toISOString().slice(0, 10);
  // (once the café's content is in: the boards and the calendar are drawn from it)
  if (state.booted) {
    if (today !== lastDay) { lastDay = today; applyCalendar(); refreshBoards(); }
    refreshEvents();
  }
  refreshWeather();
  const { night, open } = world.setTimeOfDay(h);
  state.open = open;
  sound.setNight(night > 0.5);
  $('cairoTime').textContent = cairoClock();
  $('cairoDay').textContent = cairoDay();
  world.setClock(h, cairoClock(), weatherNow);
}
updateTime();
setInterval(updateTime, 30000);

// ───────────────────────────────────────── the player

const player = {
  pos: new THREE.Vector3(0, 0, 6.6),
  ry: Math.PI,
  av: null,
  label: null,
  moving: false,
  seat: null,
  drink: null,
  target: null,       // click-to-walk destination
  goingToSeat: null,
  seatDeadline: 0,
  dessert: null,      // { id, bites } — a pastry on a plate, in the other hand
  placed: null,       // { drink, dessert, bites, x, y, z } — what this person set down
  placedMesh: null,
  waving: 0,
};

// Pyjamas: if you've chosen a pair (avatar.pj), you wear them at home upstairs —
// in your room or anyone's, in the hallway, the Common room and the Music Room.
// Everyone in the room sees them; downstairs, in the garden and the Prayer Room
// you're in your day clothes.
const pjRoom = room => room === 'hall' || room === 'hall2' || room === 'common' || room === 'music' || /^home:/.test(room || '');
const dressFor = avatar => (avatar && avatar.pj && avatar.pj.on && pjRoom(state.room) ? { pj: avatar.pj } : {});
let wearingPJ = false;

function playerAvatar() {
  if (player.av) { scene.remove(player.av.group); disposeTree(player.av.group); }
  player.av = buildAvatar(state.me.avatar, dressFor(state.me.avatar));
  wearingPJ = !!dressFor(state.me.avatar).pj;
  noFog(player.av.group);
  player.label = makeLabel(state.me.displayName, { bg: 'rgba(212,103,138,0.92)', color: '#fff' });
  player.label.position.y = player.av.height + 0.12;
  player.label.visible = false; // you know who you are; others see your name
  player.av.group.add(player.label);
  scene.add(player.av.group);
  if (player.drink) player.av.setDrink(drinkColor(player.drink), levelOf(player.sips), drinkTemp(player.drink));
  if (player.dessert) player.av.setDessert(pastryOf(player.dessert.id).shape, player.dessert.bites);
}

// third-person camera
const cam = { yaw: Math.PI, pitch: 0.32, dist: 4.2, targetDist: 4.2 };
const camTarget = new THREE.Vector3();
const keys = new Set();

// Stay inside the nearest of a few rectangles (the room, the kitchen doorway, the kitchen).
function clampToRects(p, rects) {
  let best = null, bd = Infinity;
  for (const q of rects) {
    const x = Math.min(q.maxX, Math.max(q.minX, p.x)), z = Math.min(q.maxZ, Math.max(q.minZ, p.z));
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < bd) { bd = d; best = [x, z]; }
  }
  if (best) { p.x = best[0]; p.z = best[1]; }
}

function collide(p, r = 0.3) {
  // the team are people too: walk round them
  if (world.floor === 'main') {
    for (const q of staff.positions()) {
      const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz), min = r + 0.28;
      if (d < min && d > 1e-4) { p.x = q.x + (dx / d) * min; p.z = q.z + (dz / d) * min; }
    }
  }
  for (const c of world.colliders) {
    if (c.type === 'room') {
      if (c.walk) clampToRects(p, c.walk);
      else {
        p.x = Math.min(c.maxX, Math.max(c.minX, p.x));
        p.z = Math.min(c.maxZ, Math.max(c.minZ, p.z));
      }
    } else if (c.type === 'circle') {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + r;
      if (d < min && d > 1e-4) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
    } else if (c.type === 'box') {
      const cx = Math.min(c.maxX, Math.max(c.minX, p.x));
      const cz = Math.min(c.maxZ, Math.max(c.minZ, p.z));
      const dx = p.x - cx, dz = p.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-4) { p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
        else {
          // inside the box: push out the shortest way
          const opts = [[c.minX - r, p.z], [c.maxX + r, p.z], [p.x, c.minZ - r], [p.x, c.maxZ + r]];
          opts.sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z));
          p.x = opts[0][0]; p.z = opts[0][1];
        }
      }
    }
  }
}

function standUp() {
  if (!player.seat) return;
  const s = player.seat;
  if (s.lie) endSleep();
  player.seat = null;
  sound.chair(player.pos);
  // step out to the side of the chair, not into the table
  player.pos.set(s.x + Math.cos(s.ry) * 0.62, 0, s.z - Math.sin(s.ry) * 0.62);
  collide(player.pos);
  sendMove(true);
  refreshActions();
}

// Walk somewhere: round the furniture, and through the kitchen doors if that's the way.
function walkTo(point) {
  player.path = null;
  // at home, from one room to the next goes through the doorway between them
  if (world.floor === 'home') {
    const steps = world.home.route(player.pos, point).map(q => (q === point ? point : new THREE.Vector3(q.x, world.floorY, q.z)));
    player.target = steps.shift();
    player.path = steps.length ? steps : null;
    return;
  }
  const path = world.floor === 'main' ? staff.findPath(player.pos, point, { guest: true }) : null;
  if (path && path.length > 1) {
    player.path = path.slice(1);
    player.path[player.path.length - 1] = point.clone(); // end exactly where asked
    player.target = player.path.shift();
  } else player.target = point;
}

// Where to put someone sitting on a seat: a little forward of its middle, so
// their back isn't in the backrest.
function seatSpot(seat) {
  const k = seat.h != null && seat.h < 0.5 ? 0 : 0.08;
  return { x: seat.x + Math.sin(seat.ry) * k, z: seat.z + Math.cos(seat.ry) * k };
}

function sitAt(seat) {
  player.goingToSeat = null;
  player.target = null;
  player.path = null;
  player.seat = seat;
  const sp = seatSpot(seat);
  player.pos.set(sp.x, seat.y, sp.z);
  player.ry = seat.ry;
  sound.cue('sit');
  sound.chair(player.pos);
  sendMove(true);
  refreshActions();
  toast(`You sit down at ${seat.label}. Walk, or press Stand up, to get up.`);
}

// ── sitting ────────────────────────────────────────────────

function seatTaken(seat) {
  return [...state.people.values()].some(p => p.state.seat === seat.id) || (regulars && regulars.seatTaken(seat));
}
// a seat a real person has (or is heading for) — the regulars give these up
function seatHeld(seat) {
  return (seat.table && games.hasGame(seat.table)) // a game is out on that table: the regulars leave it be
    || [...state.people.values()].some(p => p.state.seat === seat.id)
    || (player.seat && player.seat.id === seat.id) || (player.goingToSeat && player.goingToSeat.id === seat.id);
}

function nearestFreeSeat(from, near = null, maxDist = Infinity) {
  let best = null, bestD = maxDist;
  for (const seat of world.seats) {
    if (seatTaken(seat)) continue;
    if (near && Math.hypot(seat.x - near.x, seat.z - near.z) > near.r) continue;
    const d = Math.hypot(seat.x - from.x, seat.z - from.z);
    if (d < bestD) { best = seat; bestD = d; }
  }
  return best;
}

function goSit(seat) {
  if (!seat) return toast('Every seat nearby is taken — try another table.');
  if (seatTaken(seat)) {
    const near = nearestFreeSeat(player.pos, { x: seat.x, z: seat.z, r: 1.6 });
    if (!near) return toast('Someone is already sitting there.');
    seat = near;
  }
  if (player.seat) standUp();
  player.goingToSeat = seat;
  walkTo(new THREE.Vector3(seat.x, 0, seat.z));
  // If the way is blocked, don't leave anyone hovering by a chair forever.
  player.seatDeadline = performance.now() + 7000;
  // Already right next to it? Sit straight away.
  if (Math.hypot(seat.x - player.pos.x, seat.z - player.pos.z) < 1.0) sitAt(seat);
}

function toggleSit() {
  if (player.seat) { standUp(); refreshActions(); return; }
  goSit(nearestFreeSeat(player.pos));
}

// ── putting a drink down ──────────────────────────────────

function tableTops() {
  return world.surfaces.filter(m => m.userData.surface === 'table');
}

// The nearest table top within reach, and a spot on it close to `from`.
function spotOnTable(from, reach = 2.2) {
  let best = null, bestD = reach;
  const c = new THREE.Vector3();
  for (const top of tableTops()) {
    top.getWorldPosition(c);
    const y = top.userData.top ?? c.y;
    const geo = top.geometry.parameters || {};
    let x, z;
    if (geo.radiusTop) {
      // round table: a spot on the near side, inside the rim
      const dx = from.x - c.x, dz = from.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const r = geo.radiusTop * 0.55;
      x = c.x + (dx / d) * r; z = c.z + (dz / d) * r;
    } else {
      // the counter: the nearest point along it, kept off the edges
      top.geometry.computeBoundingBox();
      const bb = top.geometry.boundingBox.clone().applyMatrix4(top.matrixWorld);
      x = Math.min(bb.max.x - 0.2, Math.max(bb.min.x + 0.2, from.x));
      z = Math.min(bb.max.z - 0.25, Math.max(bb.min.z + 0.25, from.z));
    }
    const d = Math.hypot(from.x - x, from.z - z);
    if (d < bestD) { bestD = d; best = { x, y, z }; }
  }
  return best;
}

const SIPS = 4;    // sips in a drink
const BITES = 3;   // bites in a pastry
const levelOf = sips => 1 - (sips || 0) / SIPS;

function drinkMesh(placed, mine, who) {
  const g = new THREE.Group();
  const both = placed.drink && placed.dessert;
  if (placed.drink) {
    const cup = makeCup(drinkColor(placed.drink), 1 - (placed.sips || 0) / SIPS, drinkTemp(placed.drink));
    cup.position.set(both ? -0.08 : 0, 0.056, 0);
    g.add(cup);
  }
  if (placed.dessert) {
    const plate = makeDessert(pastryOf(placed.dessert).shape, placed.bites || 0);
    plate.position.x = both ? 0.07 : 0;
    g.add(plate);
  }
  g.position.set(placed.x, placed.y, placed.z);
  g.rotation.y = Math.random() * Math.PI;
  const what = placed.drink && placed.dessert ? 'things' : placed.drink ? 'drink' : pastryOf(placed.dessert).name;
  const label = mine ? `Your ${what} — click to pick ${both ? 'them' : 'it'} up` : `${who}'s ${what}`;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData = { kind: 'cup', mine, label }; } });
  noFog(g);
  scene.add(g);
  return g;
}

function setPlaced(placed) {
  if (player.placedMesh) { scene.remove(player.placedMesh); disposeTree(player.placedMesh); player.placedMesh = null; }
  player.placed = placed;
  if (placed) player.placedMesh = drinkMesh(placed, true);
}

function putDrinkDown(at = null) {
  if (!player.drink && !player.dessert) return toast('Your hands are empty — order something at the counter ☕');
  const spot = at || spotOnTable(player.pos);
  if (!spot) return toast('Walk up to a table (or sit down) to put it down.');
  // Setting a plate down next to your cup (or a cup next to your plate) keeps both.
  const prev = player.placed;
  const keep = prev && Math.hypot(prev.x - spot.x, prev.z - spot.z) < 1.2 ? prev : {};
  setPlaced({
    ...spot,
    drink: player.drink || keep.drink || null,
    sips: player.drink ? player.sips || 0 : keep.sips || 0,
    dessert: player.dessert ? player.dessert.id : keep.dessert || null,
    bites: player.dessert ? player.dessert.bites : keep.bites || 0,
  });
  player.drink = null;
  player.sips = 0;
  player.dessert = null;
  player.av.setDrink(null);
  player.av.setDessert(null);
  sound.cue('drink');
  sound.cupDown(spot);
  sendMove(true);
  refreshActions();
}

function pickUpDrink() {
  if (!player.placed) return;
  const far = Math.hypot(player.placed.x - player.pos.x, player.placed.z - player.pos.z) > 2.6;
  if (far) return toast('Walk back to your table to pick it up.');
  const pl = player.placed;
  if ((pl.drink && player.drink) || (pl.dessert && player.dessert)) return toast('Your hands are full — put down what you\'re holding first.');
  if (pl.drink) { player.drink = pl.drink; player.sips = pl.sips || 0; player.av.setDrink(drinkColor(player.drink), levelOf(player.sips), drinkTemp(player.drink)); }
  if (pl.dessert) { player.dessert = { id: pl.dessert, bites: pl.bites || 0 }; player.av.setDessert(pastryOf(pl.dessert).shape, player.dessert.bites); }
  setPlaced(null);
  sound.cue('sit');
  sendMove(true);
  refreshActions();
}

function takeFromTable(kind) {
  const pl = player.placed;
  if (!pl || !pl[kind] || Math.hypot(pl.x - player.pos.x, pl.z - player.pos.z) > 2.6) return false;
  if (kind === 'drink') {
    if (player.drink) return false;
    player.drink = pl.drink; player.sips = pl.sips || 0;
    player.av.setDrink(drinkColor(player.drink), levelOf(player.sips), drinkTemp(player.drink));
    setPlaced(pl.dessert ? { ...pl, drink: null, sips: 0 } : null);
  } else {
    if (player.dessert) return false;
    player.dessert = { id: pl.dessert, bites: pl.bites || 0 };
    player.av.setDessert(pastryOf(pl.dessert).shape, player.dessert.bites);
    setPlaced(pl.drink ? { ...pl, dessert: null, bites: 0 } : null);
  }
  return true;
}

// what's within reach to sip from or bite into: in your hand, or on your table
const canSip = () => (player.drink && (player.sips || 0) < SIPS) || (!player.drink && player.placed?.drink && (player.placed.sips || 0) < SIPS
  && Math.hypot(player.placed.x - player.pos.x, player.placed.z - player.pos.z) <= 2.6);
const canBite = () => (player.dessert && player.dessert.bites < BITES) || (!player.dessert && player.placed?.dessert && (player.placed.bites || 0) < BITES
  && Math.hypot(player.placed.x - player.pos.x, player.placed.z - player.pos.z) <= 2.6);

function refreshActions() {
  const sitBtn = $('sitAct');
  sitBtn.querySelector('.t').textContent = player.seat ? 'Stand up' : 'Sit';
  sitBtn.classList.toggle('on', !!player.seat);
  const drinkBtn = $('drinkAct');
  const holding = !!player.drink || !!player.dessert;
  const show = holding || !!player.placed;
  drinkBtn.classList.toggle('hidden', !show);
  if (show) {
    const what = player.drink && player.dessert ? '' : player.dessert ? ' plate' : player.drink ? ' drink' : '';
    drinkBtn.querySelector('.t').textContent = holding ? `Put${what} down` : 'Pick up';
    drinkBtn.title = drinkBtn.querySelector('.t').textContent;
  }
  $('biteAct').classList.toggle('hidden', !canBite());
  $('sipAct').classList.toggle('hidden', !canSip());
  $('decorAct').classList.toggle('hidden', !inMyRoom());
  $('roomAct').classList.toggle('hidden', !inMyRoom());
  $('studyAct').classList.toggle('hidden', !state.home);
  $('doorsAct').classList.toggle('hidden', !(state.me && state.me.isAdmin && (state.room === 'hall' || state.room === 'hall2')));
  $('gameAct').classList.toggle('hidden', !(player.seat && player.seat.table && !/^bar-/.test(player.seat.table)));
}

// A sip at a time — the cup goes down; four and it's finished.
function takeSip() {
  if (!canSip()) return;
  if (!player.drink && !takeFromTable('drink')) return;
  player.sips = Math.min(SIPS, (player.sips || 0) + 1);
  player.av.play('sip');
  setTimeout(() => player.drink && player.av.setDrink(drinkColor(player.drink), levelOf(player.sips), drinkTemp(player.drink)), 500);
  sound.sip();
  sendMove(true);
  refreshActions();
  if (player.sips < SIPS) return;
  const id = player.drink;
  const d = menu().find(x => x.id === id) || {};
  toast(`☕ That was the last of your ${d.name || 'drink'}. ${d.by || 'Hana'} can always make another.`);
  setTimeout(() => {
    if (player.drink !== id || player.sips < SIPS) return;
    player.drink = null; player.sips = 0;
    player.av.setDrink(null);
    sendMove(true);
    refreshActions();
  }, 2600);
}

// A bite at a time; three and it's gone (Me3temed has a word about it).
function takeBite() {
  if (!canBite()) return;
  if (!player.dessert && !takeFromTable('dessert')) return;
  const d = player.dessert;
  d.bites += 1;
  player.av.play('bite');
  setTimeout(() => player.dessert === d && player.av.setDessert(pastryOf(d.id).shape, d.bites), 500);
  sound.bite();
  sendMove(true);
  refreshActions();
  if (d.bites < BITES) return;
  const p = pastryOf(d.id);
  toast(p.me3temed ? `🍽️ All gone. Me3temed, from the shelf: “${p.me3temed}”` : `🍽️ All gone. Only crumbs left.`);
  setTimeout(() => {
    if (player.dessert !== d) return;
    player.dessert = null;
    player.av.setDessert(null);
    sendMove(true);
    refreshActions();
  }, 2600);
}

function updatePlayer(dt) {
  if (!player.av) return;
  if (player.goingToSeat && performance.now() > player.seatDeadline) sitAt(player.goingToSeat);
  let mx = 0, mz = 0;
  if (keys.has('w') || keys.has('arrowup')) mz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) mz += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;

  let moving = false;
  const speed = 2.3;
  if (mx || mz) {
    if (player.seat) standUp();
    player.target = null;
    player.path = null;
    player.goingToSeat = null;
    // relative to where the camera is looking
    const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const dir = fwd.multiplyScalar(-mz).add(right.multiplyScalar(mx)).normalize();
    player.pos.addScaledVector(dir, speed * dt);
    player.ry = lerpAngle(player.ry, Math.atan2(dir.x, dir.z), Math.min(1, dt * 12));
    moving = true;
  } else if (player.target) {
    const dx = player.target.x - player.pos.x, dz = player.target.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    const last = !(player.path && player.path.length);
    const stopAt = last && player.goingToSeat ? 1.0 : last ? 0.05 : 0.15; // chairs tuck under tables, so close enough is enough
    if (d > stopAt) {
      const step = Math.min(d, speed * dt);
      const before = player.pos.clone();
      player.pos.x += (dx / d) * step;
      player.pos.z += (dz / d) * step;
      player.ry = lerpAngle(player.ry, Math.atan2(dx, dz), Math.min(1, dt * 10));
      moving = true;
      collide(player.pos);
      // stuck against something? give up gracefully
      if (before.distanceTo(player.pos) < step * 0.2) {
        player.stuck = (player.stuck || 0) + dt;
        if (player.stuck > 0.5) {
          player.stuck = 0;
          if (player.goingToSeat) sitAt(player.goingToSeat);
          player.target = null;
          player.path = null;
        }
      } else player.stuck = 0;
    } else if (!last) {
      player.target = player.path.shift();
    } else {
      if (player.goingToSeat) sitAt(player.goingToSeat);
      player.target = null;
    }
  }
  if (!player.seat) { player.pos.y = world.floorY; collide(player.pos); }

  player.moving = moving;
  if (player.waving > 0) player.waving -= dt;
  player.av.group.position.copy(player.pos);
  player.av.group.rotation.y = player.ry;
  // lying in bed: tip back flat (rotate about x first, then turn)
  const lying = !!player.seat?.lie;
  player.av.group.rotation.order = 'YXZ';
  player.av.group.rotation.x = lying ? -Math.PI / 2 : 0;
  player.av.update(dt, { moving, sitting: !!player.seat && !lying, sitH: player.seat?.h ?? 0.54, waving: player.waving, asleep: lying, typing: !!player.seat?.work });
  if (moving) sendMove();
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const camPos = new THREE.Vector3();
// While the welcome tour is on, the camera turns to what Hana is showing.
const tourCam = { yaw: 0, pitch: 0.3, dist: 4, on: false };
function updateCamera(dt) {
  cam.dist += (cam.targetDist - cam.dist) * Math.min(1, dt * 6);
  const tv = typeof tour !== 'undefined' ? tour.view() : null;
  if (tv && !tourCam.on) Object.assign(tourCam, { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, on: true });
  if (!tv && tourCam.on) { tourCam.on = false; cam.yaw = tourCam.yaw; }
  if (tv) {
    const k = Math.min(1, dt * 2.2);
    tourCam.yaw = lerpAngle(tourCam.yaw, tv.yaw, k);
    tourCam.pitch += (tv.pitch - tourCam.pitch) * k;
    tourCam.dist += (tv.dist - tourCam.dist) * k;
  }
  const yaw = tv ? tourCam.yaw : cam.yaw, pitch = tv ? tourCam.pitch : cam.pitch, dist = tv ? tourCam.dist : cam.dist;
  const focus = tv ? tv.focus : player.av ? player.pos.clone().add(new THREE.Vector3(0, player.seat ? 1.15 : 1.45, 0)) : new THREE.Vector3(0, 1.5 + world.floorY, 0);
  camTarget.lerp(focus, Math.min(1, dt * (tv ? 2.5 : 8)));
  const cp = Math.cos(pitch);
  camPos.set(
    camTarget.x + Math.sin(yaw) * cp * dist,
    camTarget.y + Math.sin(pitch) * dist,
    camTarget.z + Math.cos(yaw) * cp * dist,
  );
  // keep the camera inside the room, under the ceiling
  const K = world.kitchen;
  const inKitchen = world.floor === 'main' && player.pos.z < ROOM.minZ - 0.05;
  const box = inKitchen ? { minX: K.minX, maxX: K.maxX, minZ: K.minZ, maxZ: K.maxZ + 1.2 } : world.floor === 'home' ? world.home.cameraBox(player.pos) : world.floor === 'hall' ? world.hall.bounds : world.floor === 'hall2' ? world.hall2.bounds : world.floor === 'common' ? world.common.bounds : world.floor === 'koshari' ? world.koshari.bounds : world.floor === 'music' ? world.music.bounds : world.floor === 'prayer' ? world.prayer.bounds : ROOM;
  camPos.x = Math.min(box.maxX - 0.25, Math.max(box.minX + 0.25, camPos.x));
  camPos.z = Math.min(box.maxZ - 0.25, Math.max(box.minZ + 0.25, camPos.z));
  camPos.y = Math.min(world.floorY + (inKitchen ? 3.2 : world.floorH) - 0.3, Math.max(world.floorY + 0.4, camPos.y));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);

  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  sound.setListener(camera.position, fwd);
}

// ───────────────────────────────────────── other people

function addPerson(p) {
  if (!state.me || p.id === state.me.id) return;
  removePerson(p.id);
  const av = buildAvatar(p.avatar, dressFor(p.avatar));
  noFog(av.group);
  const label = makeLabel(p.displayName);
  label.position.y = av.height + 0.12;
  av.group.add(label);
  const s = p.state || {};
  av.group.position.set(s.x || 0, 0, s.z || 6.6);
  av.group.rotation.y = s.ry || 0;
  av.group.traverse(o => { if (o.isMesh) o.userData = { kind: 'person', person: p, label: p.displayName }; });
  scene.add(av.group);
  const person = { ...p, av, label, state: { ...s }, pos: av.group.position.clone(), ry: s.ry || 0, drinkShown: null, dessertShown: null };
  state.people.set(p.id, person);
  setPersonDrink(person);
  updateOnline();
}

function removePerson(id) {
  const p = state.people.get(id);
  if (!p) return;
  scene.remove(p.av.group);
  disposeTree(p.av.group);
  if (p.placedMesh) { scene.remove(p.placedMesh); disposeTree(p.placedMesh); }
  state.people.delete(id);
  updateOnline();
}

function setPersonDrink(p) {
  const cupKey = p.state.drink ? `${p.state.drink}:${p.state.sips || 0}` : null;
  if (p.drinkShown !== cupKey) {
    p.drinkShown = cupKey;
    p.av.setDrink(p.state.drink ? drinkColor(p.state.drink) : null, levelOf(p.state.sips), drinkTemp(p.state.drink));
  }
  const dKey = p.state.dessert ? `${p.state.dessert}:${p.state.bites || 0}` : null;
  if (p.dessertShown !== dKey) {
    p.dessertShown = dKey;
    p.av.setDessert(p.state.dessert ? pastryOf(p.state.dessert).shape : null, p.state.bites || 0);
  }
  // what they set down on a table
  const pl = p.state.placed || null;
  const key = pl ? `${pl.drink}:${pl.sips}+${pl.dessert}:${pl.bites}@${pl.x},${pl.y},${pl.z}` : null;
  if (p.placedKey === key) return;
  p.placedKey = key;
  if (p.placedMesh) { scene.remove(p.placedMesh); disposeTree(p.placedMesh); p.placedMesh = null; }
  if (pl) p.placedMesh = drinkMesh(pl, false, p.displayName);
}

function updatePeople(dt) {
  for (const p of state.people.values()) {
    const s = p.state;
    if ((s.seat || null) !== (p.heardSeat ?? null)) { if (p.heardSeat !== undefined) sound.chair(p.pos); p.heardSeat = s.seat || null; }
    const seat = s.seat ? world.seats.find(x => x.id === s.seat) : null;
    const sp = seat ? seatSpot(seat) : null;
    const tx = seat ? sp.x : s.x, tz = seat ? sp.z : s.z;
    const k = Math.min(1, dt * 8);
    const before = p.pos.clone();
    p.pos.x += (tx - p.pos.x) * k;
    p.pos.z += (tz - p.pos.z) * k;
    p.pos.y = seat ? seat.y : world.floorY;
    p.ry = lerpAngle(p.ry, seat ? seat.ry : s.ry, k);
    const moving = before.distanceTo(p.pos) > dt * 0.4;
    p.av.group.position.copy(p.pos);
    p.av.group.rotation.y = p.ry;
    p.av.group.rotation.order = 'YXZ';
    p.av.group.rotation.x = seat?.lie ? -Math.PI / 2 : 0;
    if (p.waving > 0) p.waving -= dt;
    p.av.update(dt, { moving, sitting: !!seat && !seat.lie, sitH: seat?.h ?? 0.54, waving: p.waving || 0, asleep: !!seat?.lie, typing: !!seat?.work });
  }
}

function updateOnline() {
  const n = state.people.size + (state.me ? 1 : 0);
  const where = state.room === 'garden' ? ' · up on the roof garden' : state.room === 'hall' ? ' · in the hallway upstairs' : state.room === 'hall2' ? ' · in the upper hallway' : state.room === 'common' ? ' · in the Common room' : state.room === 'koshari' ? ' · at Koshari Abu Saied, across the road' : state.room === 'music' ? ' · in the Music Room' : state.room === 'prayer' ? ' · in the Prayer Room' : state.home ? ` · in ${state.roomName}` : state.roomName ? ` · upstairs, ${state.roomName}` : '';
  $('online').textContent = (n <= 1 ? 'just you, for now' : `${n} people here`) + where;
}

// ───────────────────────────────────────── live connection

let ws = null;
let wsRetry = 0;
let lastSent = 0;
let lastSentState = '';

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    wsRetry = 0;
    // after a reconnect, rejoin the room we were in
    if (state.room !== 'main') send({ t: 'room', room: state.room, state: { x: player.pos.x, z: player.pos.z, ry: player.ry } });
    sendMove(true);
    loadNotes();
  };
  ws.onmessage = ev => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    handle(m);
  };
  ws.onclose = ev => {
    if (ev.code === 4001 || !state.me) return;
    const wait = Math.min(15000, 800 * 2 ** wsRetry++);
    setTimeout(() => { if (state.me) connect(); }, wait);
  };
}

function handle(m) {
  switch (m.t) {
    case 'hello':
      if (m.room && m.room !== state.room) break; // an answer for a room we've since left
      for (const id of [...state.people.keys()]) removePerson(id);
      m.people.forEach(addPerson);
      updateOnline();
      break;
    case 'home:item':
      if (!state.home) break;
      if (m.op === 'remove') { world.home.remove(m.item.id); if (decor.sel === m.item.id) { decor.sel = null; renderSelection(); } }
      else world.home.update(m.item);
      break;
    case 'home:room':
      if (!state.home || m.room.ownerId !== state.home.ownerId) break;
      state.home.room = m.room;
      state.roomName = m.room.name;
      world.home.setRoom(m.room);
      updateOnline();
      break;
    case 'home:access':
      // the door closed, or they took us off the list: back down we go
      if (state.home && state.me && m.ownerId === state.home.ownerId && !m.open && !m.allowed.includes(state.me.id)) {
        toast('🚪 The door to this room is closed now — back out to the hallway.');
        goToRoom(hallFor(state.home.room.door));
      }
      break;
    case 'home:pet':
      if (!state.home) break;
      state.home.pet = m.pet;
      world.home.setPet(m.pet);
      break;
    case 'home:snacks':
      if (state.home) setSnackShelf(m.snacks);
      break;
    case 'home:gifts':
      if (state.home && m.ownerId === state.home.ownerId) { state.home.gifts = m.gifts; world.home.setGifts(m.gifts, state.home.canEdit); }
      break;
    case 'home:movie':
      if (!state.home) break;
      setMovie(m.movie, m.now);
      if (m.movie) sysChat(`📺 ${m.movie.by} put on “${m.movie.title}”.`);
      else if (m.by) sysChat(`📺 ${m.by} turned the film off.`);
      break;
    case 'gift':
      toast(`🎁 ${m.from} sent you a present — it's waiting by the door of your room.`);
      sound.cue('heart');
      break;
    case 'home:focus':
      if (!state.home) break;
      if (m.focus) offerFocus(m.focus, m.now);
      else { $('focusInvite').classList.add('hidden'); if (m.by) sysChat(`${m.by} ended the study session.`); }
      break;
    case 'garden':
      if (state.room !== 'garden') break;
      setGardenBeds(m.beds);
      if (m.by && m.by.id !== state.me?.id) {
        const b = bedOf(m.by.bed);
        const did = { plant: 'planted', water: 'watered', weed: 'weeded', harvest: 'picked' }[m.by.action];
        if (b && did) sysChat(`${m.by.name} ${did} the ${b.plant.toLowerCase()}.`);
      }
      break;
    case 'room:denied':
      toast('That room is only for its group.');
      break;
    case 'join':
      addPerson(m.person);
      sysChat(`${m.person.displayName} came in.`);
      sound.cue('join');
      break;
    case 'leave': {
      const p = state.people.get(m.id);
      if (p) sysChat(`${p.displayName} headed home.`);
      removePerson(m.id);
      break;
    }
    case 'move': {
      const p = state.people.get(m.id);
      if (p) { p.state = m.state; setPersonDrink(p); }
      break;
    }
    case 'profile': {
      const p = state.people.get(m.person.id);
      if (p) addPerson({ ...m.person, state: p.state });
      break;
    }
    case 'games':
    case 'game':
    case 'game:end':
      games.onMessage(m);
      break;
    case 'emote': {
      const p = state.people.get(m.id);
      if (!p) break;
      if (m.e === 'wave') { p.waving = 2; bubble(p.av.group, '👋', 'emote'); }
      else bubble(p.av.group, m.e, 'emote');
      break;
    }
    case 'chat':
      addChat(m.msg);
      if (m.msg.userId !== state.me?.id) {
        const p = state.people.get(m.msg.userId);
        if (p) bubble(p.av.group, onStage(p.state.seat) ? '🎤 ' + m.msg.text : m.msg.text);
        sound.chatGet();
      }
      break;
    case 'play': {
      if (state.room !== 'music') break;
      soundOf(m.i, m.n, m.up);
      const p = state.people.get(m.id);
      if (p && performance.now() - (p.noteAt || 0) > 1500) { p.noteAt = performance.now(); bubble(p.av.group, m.i === 'cajon' ? '🥁' : '🎵', 'emote'); }
      break;
    }
    case 'chat:delete':
      document.querySelector(`#chatLog [data-id="${m.id}"]`)?.remove();
      break;
    case 'note:new':
      if (!state.notes.has(m.note.id)) {
        addNote(m.note);
        if (m.note.userId !== state.me?.id) toast(`${m.note.author} left a note ${whereLabel(m.note.surface)}.`);
      }
      break;
    case 'note:delete':
      removeNote(m.id);
      break;
    case 'note:hearts': {
      const n = state.notes.get(m.id);
      if (n) {
        n.note.hearts = m.hearts;
        n.group.userData.setHearts(m.hearts);
        if (state.reading === m.id) $('readHearts').textContent = m.hearts;
      }
      break;
    }
    case 'music':
      showMusic(true, 'spotify');
      musicAction(m.action);
      toast(m.action === 'pause' ? `⏸ ${m.by} paused the café playlist.` : `🎧 ${m.by} is playing the café playlist for everyone — if it's quiet, tap ▶ in the player.`);
      break;
    case 'content':
      state.content[m.key] = m.value;
      applyContent(m.key);
      break;
  }
}

function sendMove(force = false) {
  if (!ws || ws.readyState !== 1) return;
  const now = performance.now();
  const msg = {
    t: 'move', x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), ry: +player.ry.toFixed(2),
    seat: player.seat ? player.seat.id : null, drink: player.drink, sips: player.drink ? player.sips || 0 : 0, moving: player.moving,
    dessert: player.dessert ? player.dessert.id : null, bites: player.dessert ? player.dessert.bites : 0,
    placed: player.placed ? {
      drink: player.placed.drink || null, sips: player.placed.sips || 0, dessert: player.placed.dessert || null, bites: player.placed.bites || 0,
      x: +player.placed.x.toFixed(2), y: +player.placed.y.toFixed(3), z: +player.placed.z.toFixed(2),
    } : null,
  };
  const key = JSON.stringify(msg);
  if (!force && (now - lastSent < 110 || key === lastSentState)) return;
  lastSent = now;
  lastSentState = key;
  ws.send(key);
}
setInterval(() => { if (state.started) sendMove(true); }, 4000);

// ───────────────────────────────────────── notes

function whereLabel(surface) {
  return surface === 'board' ? 'on the board' : surface === 'table' ? 'on a table' : 'on the wall';
}

function addNote(note) {
  const group = makeNote(note);
  scene.add(group);
  state.notes.set(note.id, { note, group });
}

function removeNote(id) {
  const n = state.notes.get(id);
  if (!n) return;
  scene.remove(n.group);
  disposeTree(n.group);
  state.notes.delete(id);
  if (state.reading === id) closePanels();
}

// Brings the walls in line with the database: adds notes we haven't seen,
// removes ones that were taken down, and refreshes hearts. Runs on entry
// and every half minute, so nobody misses a note even if a live message
// was dropped on the way.
async function loadNotes() {
  try {
    const { notes } = await api('/notes?room=' + encodeURIComponent(state.room));
    const ids = new Set(notes.map(n => n.id));
    for (const id of [...state.notes.keys()]) if (!ids.has(id)) removeNote(id);
    for (const n of notes) {
      const have = state.notes.get(n.id);
      if (!have) addNote(n);
      else if (have.note.hearts !== n.hearts) {
        have.note.hearts = n.hearts;
        have.note.hearted = n.hearted;
        have.group.userData.setHearts(n.hearts);
      }
    }
  } catch (e) { /* the café still works without them */ }
}

const ghost = makeGhost();
scene.add(ghost);

function placementFromHit(hit) {
  const surface = hit.object.userData.surface;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  if (surface === 'table') {
    if (n.y < 0.7) return null;
    return { surface, x: hit.point.x, y: hit.object.userData.top ?? hit.point.y, z: hit.point.z, ry: Math.random() * 0.6 - 0.3 + cam.yaw, tilt: 0 };
  }
  if (Math.abs(n.y) > 0.3) return null;
  if (hit.point.y < world.floorY + 0.35 || hit.point.y > world.floorY + world.floorH - 0.3) return null;
  const off = surface === 'board' ? 0.025 : 0.11;
  return {
    surface, x: hit.point.x + n.x * off, y: hit.point.y, z: hit.point.z + n.z * off,
    ry: Math.atan2(n.x, n.z), tilt: (Math.random() - 0.5) * 0.16,
  };
}

function startPlacing() {
  if (state.room === 'prayer') return toast('🤍 The Prayer Room is kept quiet — no notes on these walls.');
  closePanels();
  state.placing = true;
  $('placing').classList.remove('hidden');
  $('noteAct').classList.add('on');
}

function stopPlacing() {
  state.placing = false;
  ghost.visible = false;
  $('placing').classList.add('hidden');
  $('noteAct').classList.remove('on');
}

let composeKind = 'note';
let composeColor = NOTE_COLORS[0];
function openCompose(place) {
  state.pending = place;
  stopPlacing();
  $('composeWhere').textContent = place.surface === 'board' ? 'On the community board' : place.surface === 'table' ? 'On the table' : 'On the wall';
  $('composeErr').textContent = '';
  openPanel('composePanel');
  setTimeout(() => $('composeText').focus(), 50);
}

$('composeColors').append(...NOTE_COLORS.map((c, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch' + (i === 0 ? ' on' : '');
  b.style.background = c;
  b.setAttribute('aria-label', 'Paper colour');
  b.onclick = () => {
    composeColor = c;
    [...$('composeColors').children].forEach(x => x.classList.toggle('on', x === b));
  };
  return b;
}));
$('composeKind').addEventListener('click', e => {
  const b = e.target.closest('[data-kind]');
  if (!b) return;
  composeKind = b.dataset.kind;
  [...$('composeKind').children].forEach(x => x.classList.toggle('on', x === b));
});
$('composeText').addEventListener('input', () => { $('composeCount').textContent = `${$('composeText').value.length} / 220`; });

$('composeSave').onclick = async () => {
  const text = $('composeText').value.trim();
  if (text.length < 2) { $('composeErr').textContent = 'Write something first — anything at all.'; return; }
  const btn = $('composeSave');
  btn.disabled = true;
  try {
    const { note } = await api('/notes', { method: 'POST', body: { ...state.pending, text, color: composeColor, kind: composeKind, room: state.room } });
    if (!state.notes.has(note.id)) addNote(note);
    $('composeText').value = '';
    $('composeCount').textContent = '0 / 220';
    closePanels();
    sound.cue('pin');
    toast('🌸 It\'s there now. Everyone who comes in will see it.');
  } catch (e) {
    $('composeErr').textContent = e.message;
  } finally {
    btn.disabled = false;
  }
};

function openNote(id) {
  const n = state.notes.get(id);
  if (!n) return;
  const note = n.note;
  state.reading = id;
  $('readWhere').textContent = whereLabel(note.surface).replace(/^on/, 'On');
  $('readPaper').style.background = note.color;
  $('readWords').textContent = note.text;
  const when = new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  $('readWho').textContent = `— ${note.author}, ${when}`;
  $('readHearts').textContent = note.hearts || 0;
  $('readHeart').classList.toggle('on', !!note.hearted);
  $('readHeart').firstChild.textContent = note.hearted ? '♥ ' : '♡ ';
  $('readDelete').classList.toggle('hidden', !(state.me && (state.me.id === note.userId || state.me.isAdmin)));
  openPanel('readPanel');
}

$('readHeart').onclick = async () => {
  const n = state.notes.get(state.reading);
  if (!n) return;
  try {
    const r = await api(`/notes/${n.note.id}/heart`, { method: 'POST', body: {} });
    n.note.hearted = r.hearted;
    n.note.hearts = r.hearts;
    n.group.userData.setHearts(r.hearts);
    $('readHearts').textContent = r.hearts;
    $('readHeart').classList.toggle('on', r.hearted);
    $('readHeart').firstChild.textContent = r.hearted ? '♥ ' : '♡ ';
    if (r.hearted) sound.cue('heart');
  } catch (e) { toast(e.message); }
};

$('readDelete').onclick = async () => {
  const id = state.reading;
  if (!id || !confirm('Take this note down? It will be gone for everyone.')) return;
  try {
    await api(`/notes/${id}`, { method: 'DELETE' });
    removeNote(id);
    toast('The note has been taken down.');
  } catch (e) { toast(e.message); }
};

// ───────────────────────────────────────── ordering

const DEFAULT_MENU = [
  { id: 'matcha', name: 'Warm Oat Milk Matcha', by: 'Hana', color: '#8fbf6a' },
  { id: 'hojicha', name: 'Hojicha with Oat Milk', by: 'Hana', color: '#a0714f' },
  { id: 'cardamom', name: 'Honey Cardamom Milk', by: 'Yuto', color: '#efe0c4' },
];
let menuCache = { a: null, b: null, list: null };
function menu() {
  const a = state.content['cafe.menu'], b = state.content['menu.drinks'];
  if (menuCache.a !== a || menuCache.b !== b || !menuCache.list) {
    const list = fullMenu(a, b);
    menuCache = { a, b, list: list.length ? list : DEFAULT_MENU };
  }
  return menuCache.list;
}
const drinkColor = id => (menu().find(d => d.id === id) || {}).color || '#d9b48f';
const drinkTemp = id => tempOf(menu().find(d => d.id === id) || {});

// The pastry counter — the same twelve as the website (site_content 'counter.pastries').
const pastries = () => (Array.isArray(state.content['counter.pastries']) ? state.content['counter.pastries'] : []).filter(p => p && p.id && p.name);
// a bowl from Koshari Abu Saied across the road counts as something to eat, like a pastry
const KOSHARI_BOWLS = { 'koshari-s': 'a small koshari', 'koshari-m': 'a medium koshari', 'koshari-l': 'a large koshari' };
const pastryOf = id => (KOSHARI_BOWLS[id] ? { id, name: KOSHARI_BOWLS[id], shape: 'koshari', by: 'abu-saied' } : null)
  || pastries().find(p => p.id === id) || { id, name: 'pastry', shape: 'daifuku', by: 'yuki' };
const bakerOf = p => (p.by === 'hana' ? 'Hana' : 'Yuki');

// A picture: the Drive image when there is one, otherwise the drawing from /art.js.
function picture(item, kind) {
  const el = document.createElement('span');
  el.className = 'pic';
  const art = window.SakuraArt;
  const draw = () => { if (art) el.innerHTML = kind === 'dessert' ? art.plateSVG(item.shape) : art.drinkSVG(item); };
  draw();
  if (item.image) {
    const img = new Image();
    img.alt = '';
    img.onload = () => el.replaceChildren(img);
    img.src = /^https?:\/\//.test(item.image) ? item.image : `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.image)}&sz=w300`;
  }
  return el;
}

function menuRow(item, kind, onPick) {
  const b = document.createElement('button');
  b.type = 'button';
  const txt = document.createElement('span');
  txt.className = 'txt';
  const name = document.createElement('b');
  name.textContent = item.name;
  const by = document.createElement('small');
  by.textContent = kind === 'dessert' ? `${bakerOf(item)}'s · ${item.line || ''}` : item.mood ? `${item.by}'s · ${item.mood}` : `made by ${item.by}`;
  txt.append(name, by);
  if (kind === 'dessert' && item.drink) {
    const pair = document.createElement('small');
    pair.className = 'pair';
    pair.textContent = `☕ with ${item.drink}`;
    txt.append(pair);
  }
  b.append(picture(item, kind), txt);
  b.onclick = () => onPick(item);
  return b;
}

let menuTab = 'drinks';
let drinkShelf = null; // first open: the season's shelf if it has a favourite, else the house menu
const SHELVES = [['house', '☕ House'], ['spring', '🌸 Spring'], ['summer', '☀️ Summer'], ['autumn', '🍂 Autumn'], ['winter', '❄️ Winter']];
// cook: in your own kitchen — anything from the menu, made by you, right away
let menuCook = false;
function openMenu(tab = menuTab, { cook = false } = {}) {
  menuCook = cook;
  menuTab = pastries().length && !cook ? tab : 'drinks';
  $('menuTabs').classList.toggle('hidden', !pastries().length || cook);
  document.querySelectorAll('#menuTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === menuTab));
  // drinks come on shelves: the house menu and the four seasons of the letters
  const shelves = $('menuShelves');
  const all = menu();
  const have = SHELVES.filter(([k]) => all.some(d => d.season === k));
  shelves.classList.toggle('hidden', menuTab !== 'drinks' || have.length < 2);
  if (drinkShelf === null) drinkShelf = featured().length ? (state.calendar || calendar()).season : 'house';
  if (!have.some(([k]) => k === drinkShelf)) drinkShelf = have[0]?.[0] || 'house';
  shelves.replaceChildren(...have.map(([k, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (k === drinkShelf ? ' on' : '');
    b.textContent = `${label} · ${all.filter(d => d.season === k).length}`;
    b.onclick = () => { drinkShelf = k; openMenu('drinks', { cook: menuCook }); };
    return b;
  }));
  // sitting at a table? the team can bring it to you
  const spot = player.seat && world.floor === 'main' && !cook ? spotOnTable(player.pos) : null;
  $('serveRow').classList.toggle('hidden', !spot);
  const list = $('menuList');
  list.replaceChildren(...(menuTab === 'desserts'
    ? pastries().map(p => menuRow(p, 'dessert', orderDessert))
    : all.filter(d => have.length < 2 || d.season === drinkShelf).map(d => menuRow(d, 'drink', cook ? makeAtHome : order))));
  $('menuNote').textContent = cook ? 'Your own kitchen. Make yourself anything — the recipes are the same as downstairs.'
    : menuTab === 'desserts'
    ? 'Hana bakes the warm things, Yuki shapes the delicate ones. Take it on a plate.'
    : drinkShelf === 'house' ? 'The house drinks. Nothing costs anything here.'
    : featured().some(d => d.season === drinkShelf) ? `🎃 ${featured()[0].note} And every ${drinkShelf} drink from the morning letters.`
    : 'Every drink from the morning letters, by season.';
  list.scrollTop = 0;
  openPanel('menuPanel');
  if (cook) return;
  const who = world.npcs.find(n => n.id === (menuTab === 'desserts' ? 'yuki' : 'hana'));
  if (who) bubble(who.av.group, menuTab === 'desserts' ? 'They\'re all fresh this morning.' : 'What can I make you?', 'npc');
}
document.querySelectorAll('#menuTabs button').forEach(b => { b.onclick = () => openMenu(b.dataset.tab, { cook: menuCook }); });

const serveToTable = () => !$('serveRow').classList.contains('hidden') && $('serveToggle').checked;
const SERVED = ['Here you are.', 'Take your time with it.', 'Careful — it\'s still warm.', 'Enjoy it slowly.', 'For you. 🌸'];

// Hana (or Yuki, or Yuto) carries it over and sets it down in front of you.
function bringToTable(kind, item, opts = {}) {
  const spot = spotOnTable(player.pos);
  if (!spot) return false;
  const maker = opts.reward ? 'yuto' : kind === 'drink' ? (item.by || 'Hana').toLowerCase() : item.by === 'hana' ? 'hana' : 'yuki';
  const servers = [maker, 'hana', 'yuki', 'yuto'].filter((x, i, a) => a.indexOf(x) === i);
  const who = servers.find(id => !staff.busy(id));
  if (!who) { setTimeout(() => bringToTable(kind, item, opts), 2500); return true; }
  const npc = world.npcs.find(n => n.id === who);
  const where = player.seat ? player.seat.label : 'your table';
  if (kind === 'drink') sound.espresso(counterSpot(), !/tea|juice|lemonade|smoothie|slush|float/i.test(item.name));
  bubble(npc.av.group, kind === 'drink' ? `One ${item.name}. I'll bring it over.` : `One ${item.name}. Coming to you.`, 'npc');
  toast(`🛎️ ${npc.name} is bringing your ${item.name} to ${where}.`);
  staff.deliver(who, kind === 'drink' ? { drinkColor: item.color, drinkTemp: tempOf(item) } : { dessertShape: item.shape }, spot, () => {
    const prev = player.placed;
    const keep = prev && Math.hypot(prev.x - spot.x, prev.z - spot.z) < 1.2 ? prev : {};
    setPlaced({
      ...spot,
      drink: kind === 'drink' ? item.id : keep.drink || null,
      sips: kind === 'drink' ? 0 : keep.sips || 0,
      dessert: kind === 'dessert' ? item.id : keep.dessert || null,
      bites: kind === 'dessert' ? 0 : keep.bites || 0,
    });
    sound.cue('drink');
    sound.cupDown(spot);
    bubble(npc.av.group, opts.reward ? 'Ten stamps — this one is from all of us 🌸' : SERVED[Math.floor(Math.random() * SERVED.length)], 'npc');
    sendMove(true);
    refreshActions();
    if (kind === 'drink') stampCard(item);
  });
  return true;
}

function order(d) {
  closePanels();
  if (serveToTable() && bringToTable('drink', d)) return;
  const maker = world.npcs.find(n => n.name === d.by) || world.npcs.find(n => n.id === 'hana');
  const hana = world.npcs.find(n => n.id === 'hana') || maker;
  // a line at the counter? you wait your turn (a little)
  const ahead = Math.min(2, regulars.queueAhead());
  const front = regulars.frontName();
  if (maker) bubble(maker.av.group, ahead && front ? `One ${d.name} — right after ${front}, won't be long!` : `One ${d.name}, coming right up.`, 'npc');
  if (ahead) toast(`🧾 There's ${ahead === 1 ? 'one person' : 'a couple of people'} ahead of you — Hana will call your name.`);
  setTimeout(() => sound.espresso(counterSpot(), !/tea|juice|lemonade|smoothie|slush|float/i.test(d.name), true), ahead * 2500);
  setTimeout(() => {
    // your name, called out across the café
    const name = state.me ? state.me.displayName : 'you';
    if (hana) bubble(hana.av.group, `${d.name} for ${name}! 🌸`, 'npc');
    sound.counterBell(counterSpot());
    player.drink = d.id;
    player.sips = 0;
    player.av.setDrink(d.color, 1, tempOf(d));
    sound.cue('drink');
    sendMove(true);
    refreshActions();
    toast(`☕ “${d.name} for ${name}!” — ${d.by} made it.`);
    stampCard(d);
  }, 1800 + ahead * 3000);
}

// ── the stamp card: a stamp for every drink, ten for a slice of the sakura cake
const card = { stamps: 0, rewards: 0, size: 10 };
async function loadCard() {
  try { Object.assign(card, await api('/loyalty')); } catch (e) { /* signed out */ }
  renderCard();
}
async function stampCard(d) {
  if (!state.me) return;
  try {
    const r = await api('/loyalty/stamp', { method: 'POST', body: { drink: d.id } });
    Object.assign(card, r);
    renderCard();
    if (r.reward) giveReward();
    else if (r.stamped) toast(`🎟️ A stamp on your card — ${r.stamps} of ${r.size}. ${r.size - r.stamps === 1 ? 'One more for a slice of the sakura cake!' : `${r.size - r.stamps} more for a slice of the sakura cake.`}`);
  } catch (e) { /* the card can wait */ }
}
function sakuraSlice() {
  const ps = pastries();
  return ps.find(p => p.shape === 'slice') || ps.find(p => /sakura/i.test(p.name)) || ps[0] || null;
}
function giveReward() {
  sound.cue('pin');
  setTimeout(() => sound.cue('heart'), 300);
  const slice = sakuraSlice();
  toast('🎉 Your card is full — ten stamps! A slice of the sakura cake is on its way to you 🌸');
  if (!slice) return;
  if (bringToTable('dessert', slice, { reward: true })) return;
  const yuto = world.npcs.find(n => n.id === 'yuto');
  if (yuto) bubble(yuto.av.group, `${state.me.displayName} — ten stamps! The sakura slice is yours 🌸`, 'npc');
  setTimeout(() => {
    player.dessert = { id: slice.id, bites: 0 };
    player.av.setDessert(slice.shape, 0);
    sound.cue('drink');
    sendMove(true);
    refreshActions();
  }, 1500);
}
function renderCard() {
  const box = $('cardStamps');
  if (!box) return;
  box.replaceChildren(...Array.from({ length: card.size }, (_, i) => {
    const d = document.createElement('div');
    d.className = 'stamp' + (i < card.stamps ? ' on' : '') + (i === card.size - 1 ? ' last' : '');
    d.textContent = i < card.stamps ? '🌸' : i === card.size - 1 ? '🍰' : String(i + 1);
    return d;
  }));
  $('cardCount').textContent = `${card.stamps} of ${card.size}`;
  $('cardRewards').textContent = card.rewards ? `You've had ${card.rewards} slice${card.rewards > 1 ? 's' : ''} of the sakura cake so far.` : 'Your first slice is waiting at the end of the card.';
  $('cardBtn').textContent = `🎟️ My stamp card · ${card.stamps}/${card.size}`;
}
$('cardBtn').onclick = () => { renderCard(); openPanel('cardPanel'); };
$('cardBack').onclick = () => openMenu();

function orderDessert(p) {
  closePanels();
  if (serveToTable() && bringToTable('dessert', p)) return;
  const who = bakerOf(p);
  const maker = world.npcs.find(n => n.name === who);
  if (maker) bubble(maker.av.group, who === 'Yuki' ? `One ${p.name}… here.` : `One ${p.name}. Still warm.`, 'npc');
  setTimeout(() => {
    player.dessert = { id: p.id, bites: 0 };
    player.av.setDessert(p.shape, 0);
    sound.cue('drink');
    sendMove(true);
    refreshActions();
    toast(`🍡 Your ${p.name} is here. ${who} made it.${p.drink ? ` It goes with a ${p.drink}.` : ''}`);
  }, 1800);
}

// ───────────────────────────────────────── chat & bubbles

function addChat(msg) {
  const log = $('chatLog');
  if (msg.id && log.querySelector(`[data-id="${msg.id}"]`)) return;
  const el = document.createElement('div');
  el.className = 'm';
  if (msg.id) el.dataset.id = msg.id;
  const b = document.createElement('b');
  b.textContent = msg.author;
  el.append(b, document.createTextNode(msg.text));
  log.appendChild(el);
  while (log.children.length > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

function sysChat(text) {
  const el = document.createElement('div');
  el.className = 'm sys';
  el.textContent = text;
  $('chatLog').appendChild(el);
  $('chatLog').scrollTop = $('chatLog').scrollHeight;
}

$('chatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    const { msg } = await api('/chat', { method: 'POST', body: { text, room: state.room } });
    addChat(msg);
    bubble(player.av.group, onStage(player.seat && player.seat.id) ? '🎤 ' + text : text);
    sound.chatSend();
  } catch (err) { toast(err.message); input.value = text; }
});

const bubbles = [];
function bubble(obj, text, kind = '') {
  // the team say it out loud, in their own little voices
  if (kind === 'npc') {
    const n = world.npcs.find(x => x.av.group === obj);
    if (n) sound.voice(n.id, text);
  }
  // one bubble per speaker
  for (const b of bubbles.filter(b => b.obj === obj)) { b.el.remove(); bubbles.splice(bubbles.indexOf(b), 1); }
  const el = document.createElement('div');
  el.className = 'bubble ' + kind;
  el.textContent = text;
  $('bubbles').appendChild(el);
  bubbles.push({ obj, el, until: performance.now() + (kind === 'emote' ? 2500 : 4000 + text.length * 50) });
}

const v3 = new THREE.Vector3();
function updateBubbles() {
  const now = performance.now();
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (now > b.until) { b.el.remove(); bubbles.splice(i, 1); continue; }
    b.obj.getWorldPosition(v3);
    const h = b.obj.scale.x < 0.6 ? 0.75 : 2.15;
    v3.y += h;
    v3.project(camera);
    const behind = v3.z > 1;
    b.el.style.opacity = behind ? 0 : (b.until - now < 500 ? (b.until - now) / 500 : 1);
    // keep the whole bubble on screen (it's up to 220px wide, centred on x)
    const bx = ((v3.x + 1) / 2) * window.innerWidth;
    b.el.style.left = Math.min(window.innerWidth - 118, Math.max(118, bx)) + 'px';
    b.el.style.top = ((1 - v3.y) / 2) * window.innerHeight + 'px';
  }
}

// ───────────────────────────────────────── pointer: look, hover, click

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let drag = null;
let hoverPt = null;

canvas.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  hoverPt = { x: e.clientX, y: e.clientY };
  if (drag && drag.id === e.pointerId) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.moved > 6) {
      cam.yaw -= dx * 0.006;
      cam.pitch = Math.min(1.2, Math.max(-0.1, cam.pitch + dy * 0.004));
    }
  }
});
canvas.addEventListener('pointerup', e => {
  if (drag && drag.moved <= 6 && state.started) {
    if (decor.pick) click(e.clientX, e.clientY);
    else if (!$('decorPanel').classList.contains('hidden') && decorPickAt(e.clientX, e.clientY)) { /* picked something to move */ }
    else if (PANELS.some(p => !$(p).classList.contains('hidden'))) closePanels();
    else click(e.clientX, e.clientY);
  }
  drag = null;
});
canvas.addEventListener('pointerleave', () => { hoverPt = null; $('tip').classList.add('hidden'); });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.targetDist = Math.min(8, Math.max(1.6, cam.targetDist + e.deltaY * 0.004));
}, { passive: false });

function castAt(x, y, objects) {
  pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(objects, true);
}

function noteMeshes() {
  return [...state.notes.values()].map(n => n.group);
}

function personMeshes() {
  return [...state.people.values()].map(p => p.av.group);
}

function pickInteractive(x, y) {
  const hits = castAt(x, y, [...noteMeshes(), ...world.interactables, ...personMeshes(), ...world.surfaces, world.floorMesh]);
  for (const h of hits) {
    if (h.object.isSprite && h.object.userData.kind !== 'note') continue;
    const k = h.object.userData.kind;
    if (k) return h;
    // a wall or the board or a table in the way: stop here
    if (h.object.userData.surface || h.object.userData.floor) return h;
  }
  return null;
}

function updateHover() {
  const tip = $('tip');
  if (!hoverPt || !state.started || (drag && drag.moved > 6)) { tip.classList.add('hidden'); return; }
  if (decor.pick) {
    decor.place = placementAt(hoverPt.x, hoverPt.y);
    showPlace();
    canvas.style.cursor = decor.place && decor.place.ok ? 'copy' : 'not-allowed';
    tip.classList.add('hidden');
    return;
  }
  if (state.placing) {
    const hits = castAt(hoverPt.x, hoverPt.y, [...world.surfaces, ...noteMeshes()]);
    const hit = hits.find(h => h.object.userData.surface);
    const place = hit && placementFromHit(hit);
    ghost.visible = !!place;
    canvas.style.cursor = place ? 'copy' : 'not-allowed';
    if (place) {
      ghost.position.set(place.x, place.y + (place.surface === 'table' ? 0.01 : 0), place.z);
      ghost.rotation.set(place.surface === 'table' ? -Math.PI / 2 : 0, place.surface === 'table' ? 0 : place.ry, 0);
    }
    tip.classList.add('hidden');
    return;
  }
  const h = pickInteractive(hoverPt.x, hoverPt.y);
  const ud = h ? h.object.userData : {};
  const label = ud.label || (ud.surface === 'table' && !ud.label
    ? (ud.tableName ? ud.tableName + ' · ' + (player.drink || player.dessert ? 'put it down here' : 'sit here')
      : (player.drink || player.dessert ? 'Put it down here' : 'Sit at this table'))
    : null);
  canvas.style.cursor = label ? 'pointer' : 'default';
  if (label) {
    tip.textContent = label;
    tip.style.left = hoverPt.x + 'px';
    tip.style.top = hoverPt.y + 'px';
    tip.classList.remove('hidden');
  } else tip.classList.add('hidden');
}

function click(x, y) {
  if (decor.pick) return placeAt(x, y);
  if (state.placing) {
    const hits = castAt(x, y, [...world.surfaces, ...noteMeshes()]);
    const hit = hits.find(h => h.object.userData.surface);
    const place = hit && placementFromHit(hit);
    if (place) openCompose(place);
    else toast('Notes go on the board, a table, or a wall.');
    return;
  }
  const h = pickInteractive(x, y);
  if (!h) return;
  const d = h.object.userData;
  if (d.kind === 'note') return openNote(d.note.id);
  if (d.kind === 'seat') return goSit(d.seat);
  if (d.kind === 'cup') {
    if (d.mine) return pickUpDrink();
    return toast(d.label + ' — best leave it be 🌸');
  }
  if (d.surface === 'table') {
    // Holding a drink and close enough? Set it down right where you clicked.
    const near = Math.hypot(h.point.x - player.pos.x, h.point.z - player.pos.z) < 2.4;
    if ((player.drink || player.dessert) && near) return putDrinkDown({ x: h.point.x, y: d.top ?? h.point.y, z: h.point.z });
    // Otherwise, sit at the closest free chair around that table.
    const c = new THREE.Vector3();
    h.object.getWorldPosition(c);
    const seat = nearestFreeSeat(player.pos, { x: c.x, z: c.z, r: 1.3 });
    if (seat) return goSit(seat);
    if (player.drink || player.dessert) return toast('Walk a little closer to put it down.');
    return;
  }
  if (d.kind === 'order') return openMenu();
  if (d.kind === 'npc') return openTalk(d.npc.id);
  if (d.kind === 'stairs-up') return goToRoom('hall');
  // out to the hallway: from a flat, the one its door is in; from the roof, the upper one
  if (d.kind === 'stairs-down') return goToRoom(state.room === 'garden' ? 'hall2' : state.home ? hallFor(state.home.room.door) : 'hall');
  // the stairs go café → hallway (Rooms 01–14) → upper hallway (15–28) → roof garden
  if (d.kind === 'hall-down') return walkToThing(h, () => goToRoom(state.room === 'hall2' ? 'hall' : 'main'));
  if (d.kind === 'hall-up') return walkToThing(h, () => goToRoom(state.room === 'hall2' ? 'garden' : 'hall2'));
  if (d.kind === 'hall-groups') return walkToThing(h, () => openUpstairs());
  if (d.kind === 'hall-common') return walkToThing(h, () => goToRoom('common'));
  if (d.kind === 'common-out') return walkToThing(h, () => goToRoom('hall'));
  if (d.kind === 'common-tv') return openCommonTV();
  if (d.kind === 'hall-music') return walkToThing(h, () => goToRoom('music'));
  if (d.kind === 'koshari-go') return goToRoom('koshari');
  if (d.kind === 'koshari-out') return goToRoom('main');
  if (d.kind === 'koshari-order') return openKoshari();
  if (d.kind === 'hall-prayer') return walkToThing(h, () => goToRoom('prayer'));
  if (d.kind === 'music-out' || d.kind === 'prayer-out') return walkToThing(h, () => goToRoom('hall'));
  if (d.kind === 'music-piano') return openPiano();
  if (d.kind === 'music-guitar') return openGuitar();
  if (d.kind === 'music-cajon') return playInstrument('cajon', (cajonHit = 1 - cajonHit));
  if (d.kind === 'music-records') return toggleRecords();
  if (d.kind === 'prayer-times') return showPrayerTimes();
  if (d.kind === 'prayer-read') return toast('🤍 The Quran on its rehal, and a few books for reflection. Sit a while — there is no hurry here.');
  if (d.kind === 'hall-door') {
    if (!d.ownerId) return walkToThing(h, () => { bubble(player.av.group, '🚪', 'emote'); toast("🚪 You knock softly — nobody answers. It's someone else's room."); });
    return walkToThing(h, () => goToRoom('home:' + d.ownerId));
  }
  if (d.kind === 'home-bed') return goToBed(d.seat);
  if (d.kind === 'home-basket') return lowerBasket();
  if (d.kind === 'home-baldoor') return toggleBalconyDoor();
  if (d.kind === 'home-desk') {
    // sit at a chair by the desk if there is one, then open the timer
    const c = new THREE.Vector3(); h.object.getWorldPosition(c);
    const seat = nearestFreeSeat(c, { x: c.x, z: c.z, r: 1.4 });
    if (seat && player.seat !== seat) goSit(seat);
    return openStudy();
  }
  if (d.kind === 'home-cook') return walkToThing(h, () => openMenu('drinks', { cook: true }));
  if (d.kind === 'home-bath') return takeBath(d.seat);
  if (d.kind === 'home-shower') return haveShower(d.itemId);
  if (d.kind === 'home-mirror') return walkToThing(h, () => { toast('🪞 You look in the mirror. Fancy a change?'); openCreator(false); });
  if (d.kind === 'home-frame') return openFrame(d.itemId);
  if (d.kind === 'home-snacks') return walkToThing(h, useSnackShelf);
  if (d.kind === 'home-tv') return openMovie();
  if (d.kind === 'home-gift') return walkToThing(h, () => openGift(d.giftId));
  if (d.kind === 'home-pet') return walkToThing(h, strokeCat);
  if (d.kind === 'home-catbed') return toast(state.home?.pet ? `${d.label} — ${state.home.pet.name}'s favourite spot 🐾` : `${d.label} — waiting for a cat 🐾`);
  if (d.kind === 'home-item') return toast(d.label);
  if (d.kind === 'garden-bed') return openBed(d.bed);
  if (d.kind === 'garden-list') return openGardenList();
  if (d.kind === 'person') {
    bubble(player.av.group, '👋', 'emote');
    player.waving = 2;
    send({ t: 'emote', e: 'wave' });
    return;
  }
  if (d.kind === 'shelf') return openShelf();
  if (d.kind === 'photo') return openPhoto(d.id);
  if (d.kind === 'game') return games.open(d.table);
  if (d.kind === 'specials') return openSpecials();
  if (d.kind === 'events') return openEvents();
  if (d.kind === 'bookweek') return openBook();
  if (d.kind === 'info') {
    $('infoEyebrow').textContent = 'In the café';
    $('infoText').style.whiteSpace = '';
    $('infoTitle').textContent = d.label;
    $('infoText').textContent = d.text || '';
    return openPanel('infoPanel');
  }
  if (h.object.userData.floor) {
    if (player.seat) standUp();
    player.goingToSeat = null;
    walkTo(new THREE.Vector3(h.point.x, 0, h.point.z));
  }
}

function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

// keys
window.addEventListener('keydown', e => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    if (decor.pick) { stopDecorPlacing(false); return; }
    if (state.placing) stopPlacing();
    closePanels();
    document.activeElement?.blur?.();
    return;
  }
  if (typing || !state.started) return;
  if (decor.pick && (e.key === 'r' || e.key === 'R')) { turnGhost(e.shiftKey ? Math.PI / 4 : -Math.PI / 4); return; }
  if (e.key === 'Enter') { e.preventDefault(); showChat(true); $('chatInput').focus(); return; }
  if (e.key === 'e' || e.key === 'E') { toggleSit(); return; }
  if (e.key === 'q' || e.key === 'Q') { if (player.drink || player.dessert) putDrinkDown(); else pickUpDrink(); return; }
  if (e.key === 'b' || e.key === 'B') { takeBite(); return; }
  if (e.key === 'c' || e.key === 'C') { takeSip(); return; }
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    keys.add(k);
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// ───────────────────────────────────────── panels & toasts

const PANELS = ['doorsPanel', 'kosharyPanel', 'pianoPanel', 'guitarPanel', 'composePanel', 'readPanel', 'menuPanel', 'soundPanel', 'infoPanel', 'helpPanel', 'talkPanel', 'upPanel', 'wxPanel', 'shelfPanel', 'bookPanel', 'photoPanel', 'eventsPanel', 'cardPanel', 'gamePanel', 'sharePanel', 'ctvPanel', 'gardenPanel', 'decorPanel', 'roomPanel', 'studyPanel', 'sleepPanel', 'framePanel', 'snackPanel', 'moviePanel', 'giftPanel', 'giftOpenPanel'];
function openPanel(id) {
  PANELS.forEach(p => $(p).classList.toggle('hidden', p !== id));
}
function closePanels() {
  PANELS.forEach(p => $(p).classList.add('hidden'));
  state.reading = null;
}
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closePanels));

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast card';
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = 0; }, 3600);
  setTimeout(() => el.remove(), 4200);
}

// ───────────────────────────────────────── sound panel

const MIX = [
  ['master', 'Everything'], ['music', 'Music'], ['rain', 'Rain'], ['murmur', 'Café hum'],
  ['fire', 'Fireplace'], ['birds', 'Outside'], ['chimes', 'Chimes'],
];
let savePrefsTimer;
function savePrefs() {
  clearTimeout(savePrefsTimer);
  savePrefsTimer = setTimeout(() => {
    api('/me', { method: 'PATCH', body: { prefs: { sound: { ...sound.levels, muted: sound.muted }, quality: state.quality } } })
      .then(r => { state.me = r.user; }).catch(() => {});
  }, 800);
}

function buildMixer() {
  const mix = $('mix');
  mix.replaceChildren();
  for (const [k, name] of MIX) {
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = name;
    const input = document.createElement('input');
    input.type = 'range'; input.min = 0; input.max = 100; input.value = Math.round((sound.levels[k] ?? 0) * 100);
    const out = document.createElement('output');
    out.textContent = input.value;
    input.oninput = () => {
      out.textContent = input.value;
      sound.set(k, input.value / 100);
      savePrefs();
    };
    label.append(span, input, out);
    mix.appendChild(label);
  }
  $('muteBtn').textContent = sound.muted ? 'Turn the sound back on' : 'Mute everything';
  const q = $('optQuality');
  q.replaceChildren();
  for (const [id, name] of [['high', 'Sharpest'], ['balanced', 'Balanced'], ['gentle', 'Gentle on battery']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state.quality === id ? ' on' : '');
    b.textContent = name;
    b.onclick = () => { state.qualityChosen = true; applyQuality(id); buildMixer(); savePrefs(); };
    q.appendChild(b);
  }
}
$('soundBtn').onclick = () => { buildMixer(); openPanel('soundPanel'); };
$('openMusic').onclick = () => { closePanels(); showMusic(true); };
$('musicBtn').onclick = () => showMusic($('musicDock').classList.contains('hidden'));
$('musicClose').onclick = () => showMusic(false);
// The player stays in the page when hidden, so the music keeps going.
function showMusic(on, tab) {
  $('musicDock').classList.toggle('hidden', !on);
  $('musicBtn').classList.toggle('on', on);
  if (tab) musicTab(tab);
  if (on) { if (state.musicTab === 'spotify') openSpotify(); else renderRadio(); }
  if (on && phoneLayout()) showChat(false); // a phone only has room for one of them
  fitMusicDock();
}
// The player and the chat both live on the left. On a computer the player
// sits under the clock card and stops above the chat (scrolling inside if
// it must); on a phone they share one spot, so opening one tucks the other away.
function phoneLayout() { return matchMedia('(max-width: 640px)').matches; }
function showChat(on) {
  $('chat').classList.toggle('hidden', !on);
  $('chatAct').classList.toggle('on', on);
  if (on && phoneLayout() && !$('musicDock').classList.contains('hidden')) showMusic(false);
  fitMusicDock();
}
function fitMusicDock() {
  const dock = $('musicDock');
  if (dock.classList.contains('hidden') || phoneLayout()) { dock.style.top = dock.style.maxHeight = ''; return; }
  const top = Math.round(document.querySelector('#hudTop .brand').getBoundingClientRect().bottom + 12);
  const chat = $('chat');
  const chatOpen = !chat.classList.contains('hidden');
  const bottom = chatOpen ? chat.getBoundingClientRect().top - 12 : $('actions').getBoundingClientRect().top - 12;
  dock.style.top = top + 'px';
  dock.style.maxHeight = Math.max(140, bottom - top) + 'px';
}
addEventListener('resize', fitMusicDock);
if (window.ResizeObserver) {
  const ro = new ResizeObserver(fitMusicDock);
  ro.observe($('chat')); ro.observe(document.querySelector('#hudTop .brand'));
}
state.musicTab = 'radio';
function musicTab(t) {
  state.musicTab = t;
  document.querySelectorAll('[data-mtab]').forEach(b => b.classList.toggle('on', b.dataset.mtab === t));
  $('radioTab').classList.toggle('hidden', t !== 'radio');
  $('spotifyTab').classList.toggle('hidden', t !== 'spotify');
  if (t === 'spotify') openSpotify(); else renderRadio();
}
document.querySelectorAll('[data-mtab]').forEach(b => { b.onclick = () => musicTab(b.dataset.mtab); });
// The generated piano steps aside while real music plays.
function duck() { sound.duckMusic(!!(spotify.playing || radio.state.playing)); }

// ── The café radio (radio.js): the owner's songs, heard together.
const radio = createRadio({ api, onChange: () => { duck(); renderRadio(); } });
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function renderRadio() {
  const r = radio.state;
  const admin = !!(state.me && state.me.isAdmin);
  $('radioOwner').classList.toggle('hidden', !admin);
  const t = r.current;
  $('radioPlay').textContent = r.listening && r.playing ? '⏸' : '▶';
  $('radioPlay').classList.toggle('on', r.listening && r.playing);
  $('radioPlay').setAttribute('aria-label', r.listening ? 'Stop listening' : 'Listen');
  if (!r.tracks.length) {
    $('radioTitle').textContent = 'The café radio';
    $('radioArtist').textContent = admin ? 'No songs yet — upload some below.' : 'Quiet for now — the café hasn\'t put any songs on yet.';
    $('radioBar').style.width = '0';
  } else if (!r.on) {
    $('radioTitle').textContent = 'The radio is off';
    $('radioArtist').textContent = 'The café turned it off for now.';
    $('radioBar').style.width = '0';
  } else if (t) {
    $('radioTitle').textContent = t.title || 'A song';
    const at = radio.progress();
    $('radioArtist').textContent = `${t.artist ? t.artist + ' · ' : ''}${fmt(at)} / ${fmt(t.duration)}`;
    $('radioBar').style.width = `${Math.min(100, (at / t.duration) * 100)}%`;
  }
  $('radioNote').textContent = r.blocked
    ? 'Your browser wants one tap first — press ▶.'
    : 'Everyone in the café hears the same song at the same moment.';
  $('radioOnOff').textContent = r.on ? '⏻ Turn the radio off' : '⏻ Turn the radio on';
  if (admin) {
    const list = $('radioList');
    const ids = r.tracks.map(x => x.id);
    if (list.dataset.ids !== ids.join(',') + '|' + (t && t.id)) {
      list.dataset.ids = ids.join(',') + '|' + (t && t.id);
      list.replaceChildren(...r.tracks.map((x, i) => {
        const li = document.createElement('li');
        li.classList.toggle('now', !!(t && t.id === x.id));
        li.append(`${x.title || 'A song'}${x.artist ? ' — ' + x.artist : ''} (${fmt(x.duration)}) `);
        const mk = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.onclick = fn; return b; };
        if (i > 0) li.append(mk('↑', 'Earlier', () => moveTrack(i, -1)));
        if (i < r.tracks.length - 1) li.append(mk('↓', 'Later', () => moveTrack(i, 1)));
        li.append(mk('✕', 'Take it off the radio', () => removeTrack(x)));
        return li;
      }));
    }
    if (r.waiting) $('radioUp').textContent = `${r.waiting} song(s) without a length — upload them again from this panel.`;
  }
}
setInterval(() => { if (!$('musicDock').classList.contains('hidden') && state.musicTab === 'radio') renderRadio(); }, 1000);
$('radioPlay').onclick = () => {
  const on = !(radio.state.listening && (radio.state.playing || !radio.state.blocked));
  radio.listen(on || radio.state.blocked);
  try { localStorage.setItem('cafe.radio.off', radio.state.listening ? '' : '1'); } catch (e) { /* private window */ }
  if (radio.state.listening && spotify.controller && spotify.playing) { try { spotify.controller.pause(); } catch (e) { /* ignore */ } }
};
$('radioVol').oninput = () => {
  radio.setVolume($('radioVol').value / 100);
  try { localStorage.setItem('cafe.radio.vol', $('radioVol').value); } catch (e) { /* ignore */ }
};
try { const v = localStorage.getItem('cafe.radio.vol'); if (v) { $('radioVol').value = v; radio.setVolume(v / 100); } } catch (e) { /* ignore */ }

// Save a new running order, keeping the song that's on playing where it is
// (so nobody hears a jump when the owner adds or moves songs).
async function saveRadio(order, { restart = false, on } = {}) {
  const r = radio.state;
  const cur = radio.where();
  const conf = { ...(state.content['cafe.radio'] || {}), order, on: on ?? r.on };
  const byId = new Map(r.tracks.map(t => [t.id, t]));
  const next = order.map(id => byId.get(id)).filter(Boolean);
  const now = Date.now() + r.skew;
  if (restart || !cur || !next.some(t => t.id === cur.track.id)) conf.startedAt = now;
  else {
    let before = 0;
    for (const t of next) { if (t.id === cur.track.id) break; before += t.duration; }
    conf.startedAt = Math.round(now - (before + cur.offset) * 1000);
  }
  await api('/admin/content/cafe.radio', { method: 'PUT', body: { value: conf, description: 'The café radio: the songs in order (media ids), when it started (ms), and whether it is on. Changed from the 🎧 panel in the café.' } });
  state.content['cafe.radio'] = conf;
  await radio.load();
}
async function moveTrack(i, d) {
  $('radioErr').textContent = '';
  const order = radio.state.tracks.map(t => t.id);
  [order[i], order[i + d]] = [order[i + d], order[i]];
  try { await saveRadio(order); } catch (e) { $('radioErr').textContent = e.message; }
}
async function removeTrack(t) {
  if (!confirm(`Take "${t.title || 'this song'}" off the radio?`)) return;
  $('radioErr').textContent = '';
  try {
    await saveRadio(radio.state.tracks.map(x => x.id).filter(id => id !== t.id));
    await api(`/admin/media/${t.id}`, { method: 'DELETE' });
    await radio.load();
  } catch (e) { $('radioErr').textContent = e.message; }
}
$('radioRestart').onclick = async () => {
  try { await saveRadio(radio.state.tracks.map(t => t.id), { restart: true }); toast('📻 The radio starts again from the first song — for everyone.'); } catch (e) { $('radioErr').textContent = e.message; }
};
$('radioOnOff').onclick = async () => {
  try { await saveRadio(radio.state.tracks.map(t => t.id), { on: !radio.state.on }); } catch (e) { $('radioErr').textContent = e.message; }
};
const AUDIO_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm', flac: 'audio/flac' };
const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
function fileType(file, table) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return table[ext] || file.type || 'application/octet-stream';
}
async function upload(file, type, meta = {}) {
  const q = new URLSearchParams({ name: file.name, ...meta });
  const res = await fetch('/api/admin/upload?' + q, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': type }, body: file });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty */ }
  if (!res.ok) throw new Error((data && data.error) || (res.status === 413 ? 'That file is too big (30 MB at most).' : 'The upload didn\'t work. Please try again.'));
  return data.media;
}
$('radioFiles').onchange = async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  $('radioErr').textContent = '';
  const added = [];
  for (const [n, f] of files.entries()) {
    $('radioUp').textContent = `Uploading ${n + 1} of ${files.length}: ${f.name}…`;
    try {
      const duration = await audioDuration(f);
      if (!duration) throw new Error(`Couldn't read "${f.name}" as a song.`);
      const base = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
      const [artist, title] = base.includes(' - ') ? base.split(' - ', 2) : ['', base];
      const m = await upload(f, fileType(f, AUDIO_TYPES), { title: title.trim(), artist: artist.trim(), duration: duration.toFixed(2) });
      added.push(m.id);
    } catch (err) { $('radioErr').textContent = err.message; }
  }
  $('radioUp').textContent = added.length ? `Added ${added.length} song(s) to the end of the radio.` : '';
  if (added.length) {
    try {
      const before = radio.state.tracks.map(t => t.id);
      await radio.load(); // picks up the new songs (on the end)
      await saveRadio([...before, ...added]);
    } catch (err) { $('radioErr').textContent = err.message; }
  }
};

// ── Lofi from Spotify: the café's playlist (site_content 'cafe.spotify'),
// played in Spotify's own player. Everyone gets the same playlist; while it
// plays, the café's generated piano fades out (rain, fire and the room stay).
const DEFAULT_SPOTIFY = 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn';
function spotifyUri(link) {
  const m = String(link || '').match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/)
    || String(link || '').match(/^spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]+)$/);
  return m ? `spotify:${m[1]}:${m[2]}` : null;
}
let spotify = { api: null, controller: null, uri: null, loading: false };
function openSpotify() {
  const admin = !!(state.me && state.me.isAdmin);
  $('spotOwner').classList.toggle('hidden', !admin);
  const conf = state.content['cafe.spotify'] || {};
  const uri = spotifyUri(conf.link) || spotifyUri(DEFAULT_SPOTIFY);
  if (admin && !$('spotLink').value) $('spotLink').value = conf.link || DEFAULT_SPOTIFY;
  if (spotify.controller) { if (spotify.uri !== uri) { spotify.controller.loadUri(uri); spotify.uri = uri; } return; }
  if (spotify.loading) return;
  spotify.loading = true;
  const make = api => {
    spotify.api = api;
    const holder = document.createElement('div');
    $('spotEmbed').replaceChildren(holder);
    api.createController(holder, { uri, width: '100%', height: 152 }, controller => {
      spotify.controller = controller;
      spotify.uri = uri;
      controller.addListener('playback_update', e => {
        spotify.playing = !!(e.data && !e.data.isPaused);
        if (spotify.playing && radio.state.listening) radio.listen(false); // one music at a time
        duck();
      });
      controller.addListener('ready', () => { if (spotify.pending) { const a = spotify.pending; spotify.pending = null; musicAction(a); } });
    });
  };
  if (window.SpotifyIframeApi) return make(window.SpotifyIframeApi);
  window.onSpotifyIframeApiReady = api => { window.SpotifyIframeApi = api; make(api); };
  const s = document.createElement('script');
  s.src = 'https://open.spotify.com/embed/iframe-api/v1';
  s.async = true;
  s.onerror = () => { spotify.loading = false; $('spotEmbed').textContent = "Spotify didn't load — check your connection and open this panel again."; };
  document.head.appendChild(s);
}
// Play or pause the café playlist here (when the owner does it for everyone,
// or presses the buttons). Browsers may still want one tap on ▶ the first time.
function musicAction(action) {
  if (!spotify.controller) { spotify.pending = action; openSpotify(); return; }
  try {
    if (action === 'pause') spotify.controller.pause();
    else spotify.controller.resume ? spotify.controller.resume() : spotify.controller.play();
  } catch (e) { /* the player says no until someone taps it */ }
}
$('playAll').onclick = () => {
  send({ t: 'music', action: 'play' });
  showMusic(true, 'spotify');
  musicAction('play');
  toast('🎧 The café playlist is playing — for everyone in the café.');
};
$('pauseAll').onclick = () => {
  send({ t: 'music', action: 'pause' });
  musicAction('pause');
  toast('⏸ Paused for everyone.');
};

$('spotSave').onclick = async () => {
  $('spotErr').textContent = '';
  const link = $('spotLink').value.trim();
  if (!spotifyUri(link)) { $('spotErr').textContent = 'That doesn\'t look like a Spotify link (open the playlist in Spotify → Share → Copy link).'; return; }
  try {
    await api('/admin/content/cafe.spotify', { method: 'PUT', body: { value: { link }, description: "The café's Spotify playlist (the sound panel's player, the same for everyone). Any Spotify playlist, album or track link." } });
    state.content['cafe.spotify'] = { link };
    openSpotify();
    toast('🎧 The café\'s playlist is changed — for everyone.');
  } catch (e) { $('spotErr').textContent = e.message; }
};
$('muteBtn').onclick = () => {
  sound.setMuted(!sound.muted);
  $('soundBtn').textContent = sound.muted ? '🔇' : '🔊';
  buildMixer();
  savePrefs();
};
$('helpBtn').onclick = () => openPanel('helpPanel');

// ───────────────────────────────────────── the story shelf

state.shelfTab = 'all';
const storyList = () => (Array.isArray(state.content['stories.library']) ? state.content['stories.library'] : []).filter(x => x && x.paragraphs && x.paragraphs.length);
function storyLine(x) {
  return [x.kind === 'night' ? '🌙 Bedtime' : '☀️ Morning', x.edition, x.day, x.date].filter(Boolean).join(' · ');
}
function renderShelf() {
  const all = storyList();
  const show = all.map((x, i) => [x, i]).filter(([x]) => state.shelfTab === 'all' || (x.kind === 'night' ? 'night' : 'morning') === state.shelfTab);
  document.querySelectorAll('[data-shelf]').forEach(b => b.classList.toggle('on', b.dataset.shelf === state.shelfTab));
  const books = $('shelfBooks');
  if (!show.length) {
    const p = document.createElement('p');
    p.className = 'fine';
    p.textContent = all.length ? 'Nothing on this side of the shelf yet.' : 'The shelf is waiting for its first stories.';
    books.replaceChildren(p);
  } else {
    books.replaceChildren(...show.map(([x, i]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shelf-book';
      const top = document.createElement('span'); top.textContent = storyLine(x);
      const t = document.createElement('b'); t.textContent = x.title || 'A story';
      const first = document.createElement('span'); first.textContent = String(x.paragraphs[0]).replace(/\*/g, '').slice(0, 90) + '…';
      b.append(top, t, first);
      b.onclick = () => readStory(i);
      return b;
    }));
  }
  const admin = !!(state.me && state.me.isAdmin);
  $('shelfOwner').classList.toggle('hidden', !admin);
  const sh = state.content['stories.sheet'] || {};
  $('shelfStatus').textContent = sh.lastSync ? `Last read ${new Date(sh.lastSync).toLocaleString()} — ${sh.count} stories.` : (sh.hasSheet ? 'Not read yet.' : '');
}
function readStory(i) {
  const x = storyList()[i];
  if (!x) return;
  $('shelfList').classList.add('hidden');
  $('shelfRead').classList.remove('hidden');
  $('storyEyebrow').textContent = storyLine(x);
  $('storyTitle').textContent = x.title || 'A story';
  // *soft emphasis* from the letters becomes italics
  $('storyText').replaceChildren(...x.paragraphs.map(par => {
    const p = document.createElement('p');
    String(par).split(/(\*[^*]+\*)/).forEach(bit => {
      if (/^\*[^*]+\*$/.test(bit)) { const em = document.createElement('em'); em.textContent = bit.slice(1, -1); p.append(em); }
      else if (bit) p.append(bit);
    });
    return p;
  }));
  $('storyText').scrollTop = 0;
}
async function openShelf() {
  $('shelfList').classList.remove('hidden');
  $('shelfRead').classList.add('hidden');
  renderShelf();
  openPanel('shelfPanel');
  if (state.me && state.me.isAdmin && !$('shelfSheet').value) {
    api('/admin/stories/sheet').then(c => { if (c.url && !$('shelfSheet').value) $('shelfSheet').value = c.url; }).catch(() => {});
  }
}
document.querySelectorAll('[data-shelf]').forEach(b => { b.onclick = () => { state.shelfTab = b.dataset.shelf; renderShelf(); }; });
$('shelfBack').onclick = () => { $('shelfRead').classList.add('hidden'); $('shelfList').classList.remove('hidden'); };
async function shelfCall(path, body) {
  $('shelfErr').textContent = '';
  $('shelfStatus').textContent = 'Reading the sheet…';
  try {
    const r = await api(path, { method: 'POST', body });
    toast(`📚 ${r.count} stories on the shelf.`);
    // the new list arrives over the socket too; take it now in case
    try { state.content['stories.library'] = await api('/content/stories.library'); state.content['stories.sheet'] = await api('/content/stories.sheet'); } catch (e) { /* ignore */ }
    renderShelf();
  } catch (e) { $('shelfErr').textContent = e.message; $('shelfStatus').textContent = ''; }
}
$('shelfSave').onclick = () => shelfCall('/admin/stories/sheet', { url: $('shelfSheet').value.trim() });
$('shelfSync').onclick = () => shelfCall('/admin/stories/sync', {});

// ───────────────────────────────────────── the book of the week

const coverUrl = c => (c === '' || c == null ? '' : /^\d+$/.test(String(c)) ? `/api/media/${c}` : String(c));
function renderBook() {
  const b = state.content['cafe.bookOfWeek'] || {};
  $('bookTitle').textContent = b.title || 'Coming soon';
  $('bookAuthor').textContent = b.author ? `by ${b.author}` : '';
  $('bookNote').textContent = b.note || '';
  const url = coverUrl(b.cover);
  $('bookImg').classList.toggle('hidden', !url);
  if (url) { $('bookImg').src = url; $('bookImg').alt = `The cover of ${b.title || 'the book'}`; }
}
function openBook() {
  renderBook();
  const admin = !!(state.me && state.me.isAdmin);
  $('bookOwner').classList.toggle('hidden', !admin);
  if (admin) {
    const b = state.content['cafe.bookOfWeek'] || {};
    $('bookSetTitle').value = b.title || '';
    $('bookSetAuthor').value = b.author || '';
    $('bookSetNote').value = b.note || '';
    $('bookSetUrl').value = /^\d+$/.test(String(b.cover || '')) ? '' : (b.cover || '');
    $('bookCoverNote').textContent = /^\d+$/.test(String(b.cover || '')) ? 'Using the cover you uploaded.' : '';
    state.bookCover = b.cover || '';
  }
  $('bookErr').textContent = '';
  openPanel('bookPanel');
}
$('bookFile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  $('bookErr').textContent = '';
  $('bookCoverNote').textContent = 'Uploading…';
  try {
    const m = await upload(f, fileType(f, IMAGE_TYPES), { title: $('bookSetTitle').value.trim() });
    state.bookCover = m.id;
    $('bookSetUrl').value = '';
    $('bookCoverNote').textContent = `✓ ${f.name} — press "Hang it up".`;
    $('bookImg').src = `/api/media/${m.id}`;
    $('bookImg').classList.remove('hidden');
  } catch (err) { $('bookCoverNote').textContent = ''; $('bookErr').textContent = err.message; }
};
$('bookSave').onclick = async () => {
  $('bookErr').textContent = '';
  let cover = state.bookCover || '';
  const link = $('bookSetUrl').value.trim();
  try {
    // a picture from elsewhere is copied into the café, so the 3D frame can show it
    if (link && link !== String(cover)) {
      if (!/^https?:\/\//.test(link)) throw new Error('The cover link should start with https://');
      const r = await api('/admin/media/from-url', { method: 'POST', body: { url: link, title: $('bookSetTitle').value.trim() } });
      cover = r.media.id;
    }
    const value = { title: $('bookSetTitle').value.trim(), author: $('bookSetAuthor').value.trim(), note: $('bookSetNote').value.trim(), cover };
    if (!value.title) throw new Error('Give the book a title.');
    await api('/admin/content/cafe.bookOfWeek', { method: 'PUT', body: { value, description: 'The book of the week, framed on the café wall by the bookshelf: { title, author, note, cover } — cover is an uploaded picture (media id) or a link.' } });
    state.content['cafe.bookOfWeek'] = value;
    applyContent('cafe.bookOfWeek');
    toast('🖼️ The book of the week is on the wall.');
  } catch (e) { $('bookErr').textContent = e.message; }
};

// ───────────────────────────────────────── the menu board and the week's specials

function dayNumber() { return Math.floor(cairoNow().getTime() / 86400e3); }
function rotate(list, n, seed) {
  if (!list.length) return [];
  const out = [];
  for (let i = 0; i < Math.min(n, list.length); i++) out.push(list[(seed * 5 + i * 7) % list.length]);
  return [...new Set(out)];
}
function refreshBoards() {
  const cal = state.calendar || calendar();
  const all = menu();
  const fresh = all.filter(d => d.season === cal.season || d.season === 'house');
  const pool = fresh.length >= 8 ? fresh : all;
  const day = dayNumber();
  const warm = pool.filter(d => tempOf(d) === 'hot'), iced = pool.filter(d => tempOf(d) === 'iced');
  const bakes = pastries();
  world.setMenuBoard({
    title: cal.ramadan ? 'Menu · Ramadan nights' : 'Menu',
    columns: [
      { head: 'Warm', items: [...new Set([...featured().map(d => d.name), ...rotate(warm, 6, day).map(d => d.name)])].slice(0, 6) },
      { head: 'Iced', items: rotate(iced, 6, day + 3).map(d => d.name) },
      { head: 'From the oven', items: rotate(bakes, 6, day + 1).map(p => p.name) },
    ],
  });
  world.setSpecials(specials());
}
// The season's favourites (the café's own seasonal drinks, e.g. Yuto's
// pumpkin spice latte in autumn) — first on the boards while their season lasts.
function featured() {
  const cal = state.calendar || calendar();
  return cal.ramadan ? [] : menu().filter(d => d.favourite && d.season === cal.season);
}
// The owner's specials (site_content 'cafe.specials'), or the week's own picks.
function specials() {
  const sp = state.content['cafe.specials'];
  if (sp && Array.isArray(sp.items) && sp.items.length) return sp;
  const cal = state.calendar || calendar();
  const week = Math.floor(dayNumber() / 7);
  const seasonal = menu().filter(d => d.season === cal.season);
  const pool = seasonal.length >= 2 ? seasonal : menu();
  const w = pool.filter(d => tempOf(d) === 'hot'), i = pool.filter(d => tempOf(d) === 'iced');
  const items = [];
  const fav = featured()[0];
  if (fav) items.push({ name: fav.name, note: fav.note || fav.mood });
  else if (w.length) { const d = w[(week * 3) % w.length]; items.push({ name: d.name, note: d.mood || `Made by ${d.by}, for slow mornings.` }); }
  if (i.length) { const d = i[(week * 5) % i.length]; items.push({ name: d.name, note: d.mood || `Made by ${d.by}, cold and bright.` }); }
  const bakes = pastries();
  if (bakes.length) { const p = bakes[(week * 7) % bakes.length]; items.push({ name: p.name, note: p.note || p.tagline || (p.drink ? `Lovely with a ${p.drink}.` : 'Fresh from the oven this morning.') }); }
  return { title: cal.ramadan ? 'For iftar' : 'This week', items };
}
function openSpecials() {
  const sp = specials();
  $('infoEyebrow').textContent = 'By the counter';
  $('infoTitle').textContent = sp.title || 'This week';
  $('infoText').textContent = sp.items.map(it => `• ${it.name} — ${it.note}`).join('\n') + '\n\nOrder any of them from Hana — free, like everything here 🌸';
  $('infoText').style.whiteSpace = 'pre-line';
  openPanel('infoPanel');
}

// ───────────────────────────────────────── what's on: story evenings and book club

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmtTime = mins => { const h = Math.floor(mins / 60), m = mins % 60; return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`; };
const toMins = t => { const [h, m] = String(t || '20:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
// The next time each event happens (or the one on now), on Cairo's clock.
function upcoming() {
  const list = Array.isArray(state.content['cafe.events']) ? state.content['cafe.events'] : [];
  const now = cairoNow().getTime();
  const out = [];
  for (const e of list) {
    if (!e || !e.title) continue;
    const len = (Number(e.minutes) || 60) * 60e3;
    let start = null;
    if (e.weekly != null && e.weekly !== '') {
      const d0 = new Date(now); d0.setUTCHours(0, 0, 0, 0);
      for (let k = -1; k <= 7 && start == null; k++) {
        const d = new Date(d0.getTime() + k * 86400e3);
        if (d.getUTCDay() !== Number(e.weekly)) continue;
        const st = d.getTime() + toMins(e.time) * 60e3;
        if (st + len > now) start = st;
      }
    } else if (e.date) {
      const [y, mo, d] = e.date.split('-').map(Number);
      const st = Date.UTC(y, mo - 1, d) + toMins(e.time) * 60e3;
      if (st + len > now) start = st;
    }
    if (start == null) continue;
    const sd = new Date(start);
    const soon = start - now < 6 * 86400e3;
    const when = (e.weekly != null && e.weekly !== '' ? `Every ${DAY_NAMES[sd.getUTCDay()]}` : soon ? DAYS[sd.getUTCDay()] : `${DAYS[sd.getUTCDay()]} ${sd.getUTCDate()} ${sd.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`) + ` · ${fmtTime(toMins(e.time))}`;
    out.push({ ...e, start, now: now >= start && now < start + len, when });
  }
  return out.sort((a, b) => a.start - b.start);
}
const announced = new Set();
function refreshEvents() {
  const list = upcoming();
  world.setEvents(list.map(e => ({ when: e.when, title: e.title, where: e.where, now: e.now })));
  for (const e of list) {
    const key = e.title + e.start;
    if (e.now && !announced.has(key)) {
      announced.add(key);
      if (state.started) toast(`${e.kind === 'bookclub' ? '📚' : '📖'} ${e.title} is on now${e.where ? ' — ' + e.where : ''}. Come and listen 🌸`);
    }
  }
  if (!$('eventsPanel').classList.contains('hidden')) renderEvents();
}
function renderEvents() {
  const list = upcoming();
  const admin = !!(state.me && state.me.isAdmin);
  const box = $('eventsList');
  if (!list.length) { const p = document.createElement('p'); p.className = 'fine'; p.textContent = 'Nothing planned just yet — the next story evening will be on the easel.'; box.replaceChildren(p); }
  else box.replaceChildren(...list.map(e => {
    const row = document.createElement('div');
    row.className = 'event-row' + (e.now ? ' now' : '');
    const when = document.createElement('span'); when.className = 'fine'; when.textContent = e.now ? '✨ happening now' : e.when;
    const t = document.createElement('b'); t.textContent = `${e.kind === 'bookclub' ? '📚' : '📖'} ${e.title}`;
    const note = document.createElement('p'); note.className = 'fine'; note.textContent = [e.where, e.note].filter(Boolean).join(' · ');
    row.append(when, t, note);
    if (admin) {
      const del = document.createElement('button'); del.type = 'button'; del.className = 'btn ghost small'; del.textContent = 'Remove';
      del.onclick = () => saveEvents((state.content['cafe.events'] || []).filter(x => x.id !== e.id));
      row.append(del);
    }
    return row;
  }));
  $('eventsOwner').classList.toggle('hidden', !admin);
}
async function saveEvents(list) {
  $('evErr').textContent = '';
  try {
    await api('/admin/content/cafe.events', { method: 'PUT', body: { value: list, description: "What's on (the easel by the fire): [{ id, title, kind: 'reading'|'bookclub'|'other', weekly: 0–6 (Sunday = 0) or date: 'YYYY-MM-DD', time: 'HH:MM' (Cairo), minutes, where, note }]." } });
    state.content['cafe.events'] = list;
    refreshEvents();
    renderEvents();
  } catch (e) { $('evErr').textContent = e.message; }
}
function openEvents() { renderEvents(); openPanel('eventsPanel'); }
$('evAdd').onclick = () => {
  const title = $('evTitle').value.trim();
  if (!title) { $('evErr').textContent = 'Give it a name.'; return; }
  const repeat = $('evRepeat').value;
  if (repeat === 'once' && !$('evDate').value) { $('evErr').textContent = 'Pick a date.'; return; }
  const e = {
    id: Date.now().toString(36), title, kind: $('evKind').value, time: $('evTime').value || '20:00',
    minutes: Number($('evMinutes').value) || 60, where: $('evWhere').value.trim(), note: $('evNote').value.trim(),
    ...(repeat === 'once' ? { date: $('evDate').value } : { weekly: Number(repeat) }),
  };
  saveEvents([...(state.content['cafe.events'] || []), e]);
  $('evTitle').value = ''; $('evNote').value = '';
};
$('evRepeat').onchange = () => $('evDateRow').classList.toggle('hidden', $('evRepeat').value !== 'once');

// ───────────────────────────────────────── the photo wall

function openPhoto(id) {
  const all = state.content['cafe.photos'] || {};
  const p = all[id] || {};
  const url = coverUrl(p.cover);
  const admin = !!(state.me && state.me.isAdmin);
  state.photoId = id;
  state.photoCover = p.cover || '';
  $('photoImg').classList.toggle('hidden', !url);
  if (url) $('photoImg').src = url;
  $('photoCaption').textContent = p.caption || (url ? '' : 'A photo of the café will hang here soon.');
  $('photoOwner').classList.toggle('hidden', !admin);
  $('photoErr').textContent = '';
  $('photoNote').textContent = '';
  if (admin) $('photoSetCaption').value = p.caption || '';
  openPanel('photoPanel');
}
async function savePhoto(cover) {
  const all = { ...(state.content['cafe.photos'] || {}) };
  if (cover === null) delete all[state.photoId];
  else all[state.photoId] = { cover, caption: $('photoSetCaption').value.trim() };
  await api('/admin/content/cafe.photos', { method: 'PUT', body: { value: all, description: 'The photo wall on the café\'s left wall: { p1…p5: { cover, caption } } — cover is an uploaded picture (media id) or a link. Hung from inside the café.' } });
  state.content['cafe.photos'] = all;
  applyContent('cafe.photos');
}
$('photoFile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  $('photoErr').textContent = '';
  $('photoNote').textContent = 'Uploading…';
  try {
    const m = await upload(f, fileType(f, IMAGE_TYPES), { title: $('photoSetCaption').value.trim() });
    state.photoCover = m.id;
    await savePhoto(m.id);
    $('photoImg').src = `/api/media/${m.id}`;
    $('photoImg').classList.remove('hidden');
    $('photoNote').textContent = '✓ It\'s on the wall — for everyone.';
  } catch (err) { $('photoNote').textContent = ''; $('photoErr').textContent = err.message; }
};
$('photoSave').onclick = async () => {
  $('photoErr').textContent = '';
  try {
    if (!state.photoCover) throw new Error('Upload a photo first.');
    await savePhoto(state.photoCover);
    $('photoCaption').textContent = $('photoSetCaption').value.trim();
    toast('🖼️ Saved.');
  } catch (e) { $('photoErr').textContent = e.message; }
};
$('photoRemove').onclick = async () => {
  if (!confirm('Take this photo down? (The frame stays, with its sakura print.)')) return;
  try { await savePhoto(null); closePanels(); toast('The frame has its sakura print back.'); } catch (e) { $('photoErr').textContent = e.message; }
};

// ───────────────────────────────────────── actions

$('gameAct').onclick = () => games.open();
$('noteAct').onclick = () => (state.placing ? stopPlacing() : startPlacing());
$('orderAct').onclick = () => openMenu(undefined, { cook: false });
$('sitAct').onclick = toggleSit;
$('drinkAct').onclick = () => (player.drink || player.dessert ? putDrinkDown() : pickUpDrink());
$('biteAct').onclick = takeBite;
$('sipAct').onclick = takeSip;
$('waveAct').onclick = () => {
  player.waving = 2;
  bubble(player.av.group, '👋', 'emote');
  send({ t: 'emote', e: 'wave' });
};
const EMOTES = ['🌸', '☕', '💗', '✨', '😴'];
let emoteIdx = 0;
$('emoteAct').onclick = () => {
  const e = EMOTES[emoteIdx++ % EMOTES.length];
  $('emoteAct').firstElementChild.textContent = EMOTES[emoteIdx % EMOTES.length];
  bubble(player.av.group, e, 'emote');
  send({ t: 'emote', e });
};
$('chatAct').onclick = () => showChat($('chat').classList.contains('hidden'));
$('chatClose').onclick = () => showChat(false);
$('outBtn').onclick = async () => {
  if (!confirm('Leave the café for now?')) return;
  await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  location.reload();
};

// ───────────────────────────────────────── content from the database

function applyContent(key) {
  const c = state.content;
  if (key === 'cafe.spotify' && spotify.controller) openSpotify();
  if (key === 'cafe.radio') radio.load().catch(() => {});
  if (key === 'common.tv' && state.room === 'common') commonTV(true);
  if (!key || key === 'cafe.photos') world.setPhotos(c['cafe.photos'] || {});
  if (!key || key === 'cafe.season') { applyCalendar(); if (key) refreshBoards(); }
  if (!key || ['cafe.menu', 'menu.drinks', 'counter.pastries', 'cafe.specials'].includes(key)) refreshBoards();
  if (!key || key === 'cafe.events') refreshEvents();
  if (!key || key === 'cafe.bookOfWeek') { world.setBookOfWeek(c['cafe.bookOfWeek'] || {}); if (!$('bookPanel').classList.contains('hidden')) renderBook(); }
  if (key === 'stories.library' && !$('shelfPanel').classList.contains('hidden')) renderShelf();
  if (!key || key === 'cafe.weather') refreshWeather();
  if (!key || key === 'cafe.board') {
    const b = c['cafe.board'];
    if (b && b.title) world.setBoardSign(b.title, b.subtitle || '');
  }
  if (!key || key === 'cafe.welcome') {
    const w = c['cafe.welcome'] || {};
    $('welcomeTitle').textContent = w.title || 'Welcome in.';
    const lines = $('welcomeLines');
    lines.replaceChildren(...(w.lines || []).map(t => { const p = document.createElement('p'); p.textContent = t; p.style.marginBottom = '8px'; return p; }));
    $('welcomeSign').textContent = w.sign || '— Yuto 🌸';
  }
}

// ───────────────────────────────────────── the door: join / sign in

document.querySelectorAll('#door [data-tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#door [data-tab]').forEach(x => x.classList.toggle('on', x === b));
  $('joinForm').classList.toggle('hidden', b.dataset.tab !== 'join');
  $('loginForm').classList.toggle('hidden', b.dataset.tab !== 'login');
}));

$('joinForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  $('joinErr').textContent = '';
  try {
    const { user } = await api('/auth/register', { method: 'POST', body: Object.fromEntries(f) });
    state.me = user;
    $('door').classList.add('hidden');
    openCreator(true);
  } catch (err) { $('joinErr').textContent = err.message; }
  btn.disabled = false;
});

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  $('loginErr').textContent = '';
  try {
    const { user } = await api('/auth/login', { method: 'POST', body: Object.fromEntries(f) });
    state.me = user;
    $('door').classList.add('hidden');
    showWelcome(true);
  } catch (err) { $('loginErr').textContent = err.message; }
  btn.disabled = false;
});

// ───────────────────────────────────────── avatar creator

const OPTIONS = {
  body: [['person', 'A person'], ['fox', 'A fox'], ['rabbit', 'A rabbit'], ['cat', 'A cat'], ['owl', 'An owl']],
  gender: [['she', 'She'], ['he', 'He']],
  bottom: [['trousers', 'Trousers'], ['skirt', 'A skirt']],
  skin: {
    person: ['#f6dcc6', '#ecc3a0', '#e0b48c', '#c99a74', '#a8764f', '#7d5236', '#5a3a26'],
    fur: ['#b5562b', '#d98a4e', '#f6f2ee', '#c9b8a8', '#8a7a6a', '#4a3a32', '#9c8a6a', '#e6c79c'],
  },
  hair: ['#2a1d1a', '#3b2a22', '#6b4226', '#a0714f', '#d9b48f', '#c0392b', '#f2a7bb', '#7aab7a', '#e8e2da'],
  hairStyle: [['short', 'Short'], ['long', 'Long'], ['bob', 'Bob'], ['bun', 'Bun'], ['curly', 'Curly'], ['none', 'None']],
  outfit: ['#7aab7a', '#4d7a4d', '#f2a7bb', '#d4678a', '#efe0c4', '#6b8fb5', '#e8b44a', '#a0714f', '#3a3a4a', '#fef9f5'],
  accent: ['#fef9f5', '#fde8ef', '#f4ead8', '#d4678a', '#7aab7a', '#6b8fb5', '#e8b44a'],
  accessory: [['none', 'Nothing'], ['glasses', 'Glasses'], ['headphones', 'Headphones'], ['scarf', 'Scarf'], ['beanie', 'Beanie'], ['flower', 'A sakura flower']],
  pjColor: ['#9fb8d6', '#f2c6d0', '#c9b3d9', '#b8cfc4', '#f4ead8', '#3f4d6e', '#d4678a', '#e8b44a'],
  pjPattern: [['stripes', 'Stripes'], ['dots', 'Dots'], ['stars', 'Stars'], ['hearts', 'Hearts'], ['checks', 'Checks'], ['plain', 'Plain']],
};
let previewPJ = false; // the avatar maker's preview: day clothes, or pyjamas

let draft = null;
let preview = null;

function openCreator(first) {
  draft = { ...(state.me.avatar || {}) };
  if (!draft.body) Object.assign(draft, { body: 'person', skin: '#e0b48c', hair: '#3b2a22', hairStyle: 'short', outfit: '#7aab7a', accent: '#fef9f5', accessory: 'none' });
  $('cName').value = state.me.displayName;
  $('creatorCancel').classList.toggle('hidden', !!first);
  $('creatorSave').textContent = first ? 'Step inside' : 'Save';
  $('creatorSave').dataset.first = first ? '1' : '';
  $('creator').classList.remove('hidden');
  renderCreator();
  startPreview();
}

function chips(el, list, key) {
  el.replaceChildren();
  for (const [id, name] of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (draft[key] === id ? ' on' : '');
    b.textContent = name;
    b.onclick = () => {
      draft[key] = id;
      if (key === 'body') draft.skin = id === 'person' ? OPTIONS.skin.person[2] : { fox: '#b5562b', rabbit: '#f6f2ee', cat: '#c9b8a8', owl: '#9c8a6a' }[id];
      if (key === 'gender') {
        // a sensible start for each; everything can still be changed
        draft.bottom = id === 'she' ? 'skirt' : 'trousers';
        if (id === 'she' && draft.hairStyle === 'short') draft.hairStyle = 'long';
        if (id === 'he' && draft.hairStyle === 'long') draft.hairStyle = 'short';
      }
      renderCreator();
    };
    el.appendChild(b);
  }
}
function swatches(el, list, key) {
  el.replaceChildren();
  for (const c of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (draft[key] === c ? ' on' : '');
    b.style.background = c;
    b.setAttribute('aria-label', key + ' ' + c);
    b.onclick = () => { draft[key] = c; renderCreator(); };
    el.appendChild(b);
  }
}
function renderCreator() {
  chips($('optBody'), OPTIONS.body, 'body');
  if (!draft.gender) draft.gender = 'she';
  if (!draft.bottom) draft.bottom = 'trousers';
  chips($('optGender'), OPTIONS.gender, 'gender');
  chips($('optBottom'), OPTIONS.bottom, 'bottom');
  $('bottomGroup').classList.toggle('hidden', draft.body === 'owl');
  const person = draft.body === 'person';
  $('skinLabel').textContent = person ? 'Skin' : 'Fur / feathers';
  swatches($('optSkin'), person ? OPTIONS.skin.person : OPTIONS.skin.fur, 'skin');
  $('hairGroup').classList.toggle('hidden', !person);
  chips($('optHairStyle'), OPTIONS.hairStyle, 'hairStyle');
  swatches($('optHair'), OPTIONS.hair, 'hair');
  swatches($('optOutfit'), OPTIONS.outfit, 'outfit');
  swatches($('optAccent'), OPTIONS.accent, 'accent');
  chips($('optAccessory'), OPTIONS.accessory, 'accessory');
  // pyjamas, for upstairs
  draft.pj = { on: false, color: OPTIONS.pjColor[0], pattern: 'stripes', cap: false, ...(draft.pj || {}) };
  const pjChips = (el, list, key) => {
    el.replaceChildren();
    for (const [id, name] of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (draft.pj[key] === id ? ' on' : '');
      b.textContent = name;
      b.onclick = () => { draft.pj[key] = id; if (key !== 'on') draft.pj.on = true; previewPJ = draft.pj.on; renderCreator(); };
      el.appendChild(b);
    }
  };
  pjChips($('optPJ'), [[false, 'No, day clothes'], [true, 'Yes, pyjamas 🌙']], 'on');
  $('pjMore').classList.toggle('hidden', !draft.pj.on);
  $('optPJColor').replaceChildren(...OPTIONS.pjColor.map(c => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch' + (draft.pj.color === c ? ' on' : '');
    b.style.background = c; b.setAttribute('aria-label', 'pyjamas ' + c);
    b.onclick = () => { draft.pj.color = c; previewPJ = true; renderCreator(); };
    return b;
  }));
  pjChips($('optPJPattern'), OPTIONS.pjPattern, 'pattern');
  pjChips($('optPJCap'), [[false, 'No cap'], [true, 'A nightcap']], 'cap');
  $('pjPreview').textContent = previewPJ && draft.pj.on ? '👀 Showing your pyjamas — tap to see your day clothes' : '👀 See them on';
  if (preview) preview.rebuild();
}

function startPreview() {
  if (preview) { preview.rebuild(); return; }
  const c = $('preview');
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const s = new THREE.Scene();
  s.environment = scene.environment;
  s.environmentIntensity = 0.5;
  s.add(new THREE.HemisphereLight('#fff6ee', '#e9c9c0', 1.6));
  const key = new THREE.DirectionalLight('#fff1e0', 2.2);
  key.position.set(2, 4, 3);
  s.add(key);
  const cam2 = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  let av = null;
  let t = 0;
  preview = {
    rebuild() {
      if (av) { s.remove(av.group); disposeTree(av.group); }
      av = buildAvatar(draft, previewPJ && draft.pj && draft.pj.on ? { pj: draft.pj } : {});
      s.add(av.group);
    },
    frame(dt) {
      if ($('creator').classList.contains('hidden')) return;
      const w = c.clientWidth, h = c.clientHeight;
      // match the drawing buffer to the box in both directions, or it gets stretched (and blurry)
      const pr = r.getPixelRatio();
      if (w && h && (c.width !== Math.floor(w * pr) || c.height !== Math.floor(h * pr))) { r.setSize(w, h, false); cam2.aspect = w / h; cam2.updateProjectionMatrix(); }
      t += dt;
      const owl = draft.body === 'owl';
      cam2.position.set(0, owl ? 0.9 : 1.3, owl ? 3.0 : 4.4);
      cam2.lookAt(0, owl ? 0.6 : 1.0, 0);
      av.group.rotation.y = Math.sin(t * 0.6) * 0.6;
      av.update(dt, { waving: Math.sin(t * 0.4) > 0.85 ? 1 : 0 });
      r.render(s, cam2);
    },
  };
  preview.rebuild();
}

$('creatorCancel').onclick = () => $('creator').classList.add('hidden');
$('pjPreview').onclick = () => { if (!draft.pj.on) draft.pj.on = true; previewPJ = !previewPJ; renderCreator(); };
$('creatorSave').onclick = async () => {
  const btn = $('creatorSave');
  btn.disabled = true;
  $('creatorErr').textContent = '';
  try {
    const { user } = await api('/me', { method: 'PATCH', body: { avatar: draft, displayName: $('cName').value } });
    state.me = user;
    $('creator').classList.add('hidden');
    if (btn.dataset.first) {
      showWelcome(false);
    } else {
      playerAvatar();
      toast('🪞 Looking lovely.');
    }
  } catch (e) { $('creatorErr').textContent = e.message; }
  btn.disabled = false;
};
$('avatarBtn').onclick = () => openCreator(false);

// ───────────────────────────────────────── entering

function showWelcome(returning) {
  $('welcomeEyebrow').textContent = returning ? `Welcome back, ${state.me.displayName}` : `Hello, ${state.me.displayName}`;
  applyContent('cafe.welcome');
  $('welcome').classList.remove('hidden');
}

$('enterBtn').onclick = async () => {
  $('welcome').classList.add('hidden');
  const prefs = state.me.prefs || {};
  const levels = { ...(state.content['cafe.sound'] || {}), ...(prefs.sound || {}) };
  delete levels.muted;
  sound.muted = !!(prefs.sound && prefs.sound.muted);
  $('soundBtn').textContent = sound.muted ? '🔇' : '🔊';
  sound.start(levels);
  setTimeout(() => sound.doorBell(), 250); // the bell over the door, as you come in
  if (weatherNow) sound.setWeather(weatherNow.look);
  sound.setNight(cairoHour() < 6 || cairoHour() >= 18.5);
  sound.setFirePosition(world.fire);
  if (prefs.quality) { applyQuality(prefs.quality); state.qualityChosen = true; }

  playerAvatar();
  // back where you were last time? (not when a friend has saved you a seat)
  const back = invite.table ? null : lastPlace();
  // walk in through the front door
  player.pos.set(0, 0, mapZ(5.6));
  player.ry = Math.PI;
  player.target = back ? null : new THREE.Vector3(0, 0, mapZ(3.8));
  cam.yaw = 0; cam.pitch = 0.3; cam.dist = cam.targetDist = 3.6;

  $('hudTop').classList.remove('hidden');
  $('actions').classList.remove('hidden');
  // On a phone the chat starts tucked away (💬 opens it); there's more café to see.
  const small = phoneLayout();
  showChat(!small);
  $('adminLink').classList.toggle('hidden', !state.me.isAdmin);
  $('wxOwnerBtn').classList.toggle('hidden', !state.me.isAdmin);
  // The radio comes on as you walk in (this click lets the browser play it),
  // unless you turned it off last time.
  let radioOff = false;
  try { radioOff = localStorage.getItem('cafe.radio.off') === '1'; } catch (e) { /* ignore */ }
  radio.load().then(() => {
    if (!radioOff && radio.state.tracks.length && radio.state.on) radio.listen(true);
    showMusic(!small, radio.state.tracks.length || state.me.isAdmin ? 'radio' : 'spotify');
  }).catch(() => showMusic(!small, 'spotify'));
  if (small) setTimeout(() => toast('🎧 Tap 🎧 at the top for the café radio.'), 4000);
  if (!state.open) setTimeout(() => toast(`🌙 The café is closed for now (${state.calendar && state.calendar.ramadan ? 'Ramadan hours: noon – 2am' : 'open 10am – 10pm'}, Cairo time) — but the door is never locked for you. Sit as long as you like.`), 2500);
  state.started = true;
  canvas.focus();

  connect();
  loadNotes();
  loadCard();
  try {
    const { messages } = await api('/chat?room=main');
    messages.forEach(addChat);
  } catch (e) { /* fine */ }
  if (back && await resumePlace(back)) {
    if (state.room === 'main') sysChat('Welcome back — right where you left off.');
  } else {
    sysChat('You came in. The door chimes softly behind you.');
    setTimeout(() => {
      const yuto = world.npcs.find(n => n.id === 'yuto');
      if (yuto && state.room === 'main') bubble(yuto.av.group, `Welcome in, ${state.me.displayName}. Take any seat you like.`, 'npc');
    }, 1600);
  }
  // invited to someone's table? walk over and sit down with them
  if (invite.table) setTimeout(() => {
    const free = world.seats.filter(x => x.table === invite.table && !seatTaken(x));
    if (free.length) { goSit(free[0]); toast(`🌸 ${invite.name || 'Your friend'} saved you a seat at ${free[0].label}.`); }
    else if (world.seats.some(x => x.table === invite.table)) toast(`${invite.name || 'Your friend'}'s table is full just now — sit nearby 🌸`);
    invite.table = '';
  }, 2600);
  // first time here? Hana shows you round
  if (!prefs.toured) setTimeout(() => { if (!invite.table) tour.start(); }, 3600);
  updateOnline();
};

// ───────────────────────────────────────── talking with the team (AI)
// Yuto, Hana, Yuki and Me3temed answer for real (see server/npc.js). They
// can recommend a drink — it shows as a card with an "order this" button —
// and they remember what you like, across visits.

const FACES = { yuto: '👓', hana: '🦊', yuki: '🐰', me3temed: '🦉' };
const wait = ms => new Promise(r => setTimeout(r, ms));
let talkTo = null;
let talkBusy = false;

function talkLine(cls, text) {
  const el = document.createElement('div');
  el.className = 'say ' + cls;
  el.textContent = text;
  $('talkLog').appendChild(el);
  $('talkLog').scrollTop = $('talkLog').scrollHeight;
  return el;
}

// The team's replies appear a few letters at a time, with their voice.
function talkSay(id, text) {
  const el = talkLine('them', '');
  sound.voice(id, text);
  const n = world.npcs.find(x => x.id === id);
  if (n) bubble(n.av.group, text.length > 90 ? text.slice(0, 88) + '…' : text, '');
  const step = Math.max(1, Math.ceil(text.length / 60));
  let i = 0;
  const tick = () => {
    i = Math.min(text.length, i + step);
    el.textContent = text.slice(0, i);
    $('talkLog').scrollTop = $('talkLog').scrollHeight;
    if (i < text.length) setTimeout(tick, 22);
  };
  tick();
  return el;
}

function recCard(rec) {
  const isPastry = rec.kind === 'pastry';
  const d = isPastry ? { ...rec, ...pastryOf(rec.id) } : menu().find(x => x.id === rec.id) || rec;
  const card = document.createElement('div');
  card.className = 'rec';
  const dot = picture(d, isPastry ? 'dessert' : 'drink');
  const txt = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = d.name;
  const why = document.createElement('small');
  why.textContent = rec.why || (isPastry ? `made by ${bakerOf(d)}` : `made by ${d.by}`);
  txt.append(b, why);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = isPastry ? 'I\'ll have it 🍡' : 'Order this ☕';
  btn.onclick = () => { (isPastry ? orderDessert : order)(d); btn.disabled = true; btn.textContent = 'Coming up…'; };
  card.append(dot, txt, btn);
  $('talkLog').appendChild(card);
  $('talkLog').scrollTop = $('talkLog').scrollHeight;
}

// A recipe, laid out properly: what it makes, ingredients, numbered steps.
function recipeText(r) {
  return [
    r.name,
    [r.serves && `Serves: ${r.serves}`, r.time && `Time: ${r.time}`].filter(Boolean).join(' · '),
    '',
    'Ingredients',
    ...r.ingredients.map(i => `• ${i.amount ? i.amount + ' ' : ''}${i.item}`),
    '',
    'Method',
    ...r.steps.map((st, k) => `${k + 1}. ${st}`),
    r.tip ? `\nTip from ${r.by}: ${r.tip}` : '',
    '\n— from Sakura Slice Café 🌸',
  ].filter(x => x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function recipeCard(r) {
  const card = document.createElement('div');
  card.className = 'recipe';
  const head = document.createElement('div');
  head.className = 'recipe-head';
  const title = document.createElement('h4');
  title.textContent = r.name;
  const meta = document.createElement('div');
  meta.className = 'recipe-meta';
  for (const [icon, val] of [['🍵', r.serves], ['⏱', r.time]]) {
    if (!val) continue;
    const chip = document.createElement('span');
    chip.textContent = `${icon} ${val}`;
    meta.appendChild(chip);
  }
  head.append(title, meta);

  const ingH = document.createElement('p');
  ingH.className = 'recipe-label';
  ingH.textContent = 'Ingredients';
  const ul = document.createElement('ul');
  for (const i of r.ingredients) {
    const li = document.createElement('li');
    const amt = document.createElement('b');
    amt.textContent = i.amount;
    li.append(amt, document.createTextNode(' ' + i.item));
    ul.appendChild(li);
  }
  const stepH = document.createElement('p');
  stepH.className = 'recipe-label';
  stepH.textContent = 'Method';
  const ol = document.createElement('ol');
  for (const st of r.steps) {
    const li = document.createElement('li');
    li.textContent = st;
    ol.appendChild(li);
  }
  card.append(head, ingH, ul, stepH, ol);
  if (r.tip) {
    const tip = document.createElement('p');
    tip.className = 'recipe-tip';
    tip.textContent = `${r.tip} — ${r.by}`;
    card.appendChild(tip);
  }
  const row = document.createElement('div');
  row.className = 'row';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'btn ghost';
  copy.textContent = 'Copy recipe';
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(recipeText(r)); copy.textContent = 'Copied ✓'; }
    catch (e) { prompt('Copy the recipe:', recipeText(r)); }
  };
  row.appendChild(copy);
  if (r.drink) {
    const ord = document.createElement('button');
    ord.type = 'button';
    ord.className = 'btn';
    ord.textContent = 'Or have it made ☕';
    ord.onclick = () => { order(menu().find(d => d.id === r.drink.id) || r.drink); ord.disabled = true; ord.textContent = 'Coming up…'; };
    row.appendChild(ord);
  }
  card.appendChild(row);
  $('talkLog').appendChild(card);
  // show the recipe from its title down
  $('talkLog').scrollTop = card.offsetTop - $('talkLog').offsetTop - 8;
}

async function openTalk(id) {
  const npc = world.npcs.find(n => n.id === id);
  if (!npc) return;
  talkTo = id;
  $('talkFace').textContent = FACES[id] || '🌸';
  $('talkName').textContent = npc.name;
  $('talkRole').textContent = npc.role;
  $('talkInput').placeholder = id === 'hana' ? 'What should I drink today?' : id === 'me3temed' ? 'Say something to the owl…' : `Say something to ${npc.name}…`;
  const who = $('talkWho');
  who.replaceChildren(...world.npcs.map(n => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${FACES[n.id] || ''} ${n.name}`;
    b.className = n.id === id ? 'on' : '';
    b.onclick = () => openTalk(n.id);
    return b;
  }));
  $('talkLog').replaceChildren();
  openPanel('talkPanel');
  staff.attend(id, player.pos, 40); // they stop and turn to you
  setTimeout(() => $('talkInput').focus(), 50);
  let had = false;
  try {
    const { messages } = await api('/npc/' + id);
    if (talkTo !== id) return;
    for (const m of messages) {
      if (m.display) talkLine(m.role === 'user' ? 'me' : 'them', m.display);
      if (m.meta && m.meta.recipe) recipeCard(m.meta.recipe);
      if (m.meta && m.meta.recommendation) recCard(m.meta.recommendation);
      had = true;
    }
  } catch (e) { /* fine — start fresh */ }
  if (!had) talkSay(id, npc.lines[0]);
  if (state.room === 'main') bubble(npc.av.group, npc.lines[0], 'npc');
}

$('talkForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('talkInput');
  const text = input.value.trim();
  if (!text || !talkTo || talkBusy) return;
  const id = talkTo;
  const npc = world.npcs.find(n => n.id === id);
  input.value = '';
  talkLine('me', text);
  const typing = talkLine('them typing', id === 'me3temed' ? '(…)' : '…');
  talkBusy = true;
  $('talkSend').disabled = true;
  try {
    const holding = [player.drink && (menu().find(d => d.id === player.drink) || {}).name,
      player.dessert && player.dessert.bites < 3 && pastryOf(player.dessert.id).name].filter(Boolean).join(' and ');
    const where = state.room === 'garden' ? 'up on the roof garden' : state.room === 'hall' ? 'in the hallway upstairs' : state.room === 'hall2' ? 'in the upper hallway, one floor further up' : state.room === 'common' ? 'in the Common room upstairs, on the sofa by the big TV' : state.room === 'koshari' ? 'across the road at Koshari Abu Saied, the koshari shop' : state.room === 'music' ? 'in the Music Room upstairs, by the piano and the little stage' : state.room === 'prayer' ? 'in the quiet Prayer Room upstairs' : state.home ? `upstairs, in ${state.roomName}` : state.room !== 'main' ? `upstairs, in ${state.roomName}'s room` : player.seat ? `sitting at ${player.seat.label}` : 'standing in the café';
    const r = await api('/npc/' + id, { method: 'POST', body: { text, holding, where } });
    typing.remove();
    if (talkTo !== id) return;
    talkSay(id, r.reply);
    if (r.recommendation) recCard(r.recommendation);
    if (r.recipe) recipeCard(r.recipe);
    if (state.room === 'main') bubble(npc.av.group, r.reply.length > 120 ? r.reply.slice(0, 117) + '…' : r.reply, 'npc');
    sound.cue('chat');
  } catch (err) {
    typing.remove();
    // No voice yet (no API key), or a hiccup: answer in character anyway.
    const shown = [...$('talkLog').querySelectorAll('.say.them')].map(x => x.textContent);
    const fresh = npc.lines.filter(l => !shown.includes(l));
    const line = (fresh.length ? fresh : npc.lines)[Math.floor(Math.random() * (fresh.length || npc.lines.length))];
    talkLine('them', /resting|smiles/.test(err.message) ? line : err.message);
    if (err.detail) talkLine('them typing', '🗝️ (only you see this, as the owner) ' + err.detail);
  } finally {
    talkBusy = false;
    $('talkSend').disabled = false;
    $('talkInput').focus();
  }
});

$('talkAct').onclick = () => openTalk(talkTo || 'hana');

// ───────────────────────────────────────── upstairs: rooms for groups

const GROUP_COLORS = ['#d4678a', '#4d7a4d', '#e8a64a', '#6b8fb5', '#8a6bb0', '#a0714f'];
let groupColor = GROUP_COLORS[0];
$('upColors').append(...GROUP_COLORS.map((c, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch' + (i === 0 ? ' on' : '');
  b.style.background = c;
  b.setAttribute('aria-label', 'Group colour');
  b.onclick = () => { groupColor = c; [...$('upColors').children].forEach(x => x.classList.toggle('on', x === b)); };
  return b;
}));

function groupCard(g, mine) {
  const el = document.createElement('div');
  el.className = 'group';
  const name = document.createElement('div');
  name.className = 'gname';
  const dot = document.createElement('i');
  dot.style.background = g.color;
  name.append(dot, document.createTextNode(g.name));
  const sub = document.createElement('small');
  const bits = [`${g.members} member${g.members === 1 ? '' : 's'}`];
  if (g.here) bits.push(`${g.here} upstairs now`);
  if (!g.isPublic) bits.push('private');
  sub.textContent = (g.description ? g.description + ' · ' : '') + bits.join(' · ');
  const row = document.createElement('div');
  row.className = 'row';
  if (mine) {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn';
    go.textContent = state.room === 'group:' + g.id ? "You're here" : 'Go up 🪜';
    go.disabled = state.room === 'group:' + g.id;
    go.onclick = () => goToRoom('group:' + g.id, g);
    const code = document.createElement('code');
    code.textContent = g.inviteCode;
    code.title = 'Invite code — share it with friends';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn ghost';
    copy.textContent = 'Copy invite';
    copy.onclick = async () => {
      const msg = `Come upstairs at Sakura Slice Café 🌸 Join "${g.name}" with the code ${g.inviteCode} — ${location.origin}/cafe`;
      try { await navigator.clipboard.writeText(msg); toast('Invite copied — send it to a friend.'); }
      catch (e) { prompt('Copy this invite:', msg); }
    };
    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'btn ghost';
    leave.textContent = g.role === 'owner' ? 'Close room' : 'Leave';
    leave.onclick = async () => {
      const ask = g.role === 'owner'
        ? `Close "${g.name}"? The room, its notes and its chat will be gone for everyone.`
        : `Leave "${g.name}"?`;
      if (!confirm(ask)) return;
      try {
        await api(`/groups/${g.id}/leave`, { method: 'POST', body: {} });
        if (state.room === 'group:' + g.id) await goToRoom('main');
        loadGroups();
      } catch (e) { toast(e.message); }
    };
    row.append(go, code, copy, leave);
  } else {
    const join = document.createElement('button');
    join.type = 'button';
    join.className = 'btn';
    join.textContent = 'Join';
    join.onclick = async () => {
      try { await api('/groups/join', { method: 'POST', body: { id: g.id } }); sound.cue('pin'); loadGroups(); }
      catch (e) { toast(e.message); }
    };
    row.append(join);
  }
  el.append(name, sub, row);
  return el;
}

async function loadGroups() {
  try {
    const { mine, open, garden: inGarden = 0 } = await api('/groups');
    $('gardenHere').textContent = state.room === 'garden' ? "You're up there now" : inGarden ? `${inGarden} up there now` : 'nobody up there just now';
    $('gardenGo').disabled = state.room === 'garden';
    const m = $('upMine');
    m.replaceChildren(...mine.map(g => groupCard(g, true)));
    if (!mine.length) {
      const p = document.createElement('p');
      p.className = 'fine';
      p.textContent = "You're not in a group yet. Start one for your friends, or join one below.";
      m.appendChild(p);
      $('upCreateBox').open = true;
    }
    $('upOpen').replaceChildren(...open.map(g => groupCard(g, false)));
    $('upOpenWrap').classList.toggle('hidden', !open.length);
  } catch (e) { toast(e.message); }
}

function openUpstairs() {
  openPanel('upPanel');
  loadHallway();
  loadGroups();
}

$('upCreate').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('upCreateErr').textContent = '';
  try {
    const { group } = await api('/groups', { method: 'POST', body: {
      name: f.get('name'), description: f.get('description'), isPublic: f.get('isPublic') === 'on', color: groupColor,
    } });
    e.target.reset();
    toast(`🌸 "${group.name}" has a room upstairs now. Invite code: ${group.inviteCode}`);
    await goToRoom('group:' + group.id, group);
  } catch (err) { $('upCreateErr').textContent = err.message; }
});

$('upJoin').addEventListener('submit', async e => {
  e.preventDefault();
  const code = new FormData(e.target).get('code');
  $('upJoinErr').textContent = '';
  try {
    const { group } = await api('/groups/join', { method: 'POST', body: { code } });
    e.target.reset();
    sound.cue('pin');
    await goToRoom('group:' + group.id, group);
  } catch (err) { $('upJoinErr').textContent = err.message; }
});

// Climb the stairs (or come back down). Everything room-specific — who's
// here, the notes on the walls, the chat — switches over.
async function goToRoom(room, group = null) {
  closePanels();
  if (room === state.room) return;
  // someone's room: check we're let in (and get the furniture) before the stairs
  let homeData = null;
  if (room.startsWith('home:')) {
    try { homeData = await api('/home/' + room.slice(5)); } catch (e) { toast(e.message); return; }
  }
  const from = state.room;
  leaveHome();
  stopPlacing();
  $('fade').classList.add('on');
  sound.cue('sit');
  await wait(480);

  player.seat = null;
  player.target = null;
  player.goingToSeat = null;
  setPlaced(null);
  const roof = room === 'garden';
  const isHome = !!homeData;
  const isHall = room === 'hall' || room === 'hall2';
  const isCommon = room === 'common';
  const isMusic = room === 'music', isPrayer = room === 'prayer', isKoshari = room === 'koshari';
  const up = room !== 'main' && !roof && !isHome && !isHall && !isCommon && !isMusic && !isPrayer && !isKoshari; // a group's room upstairs
  state.room = room;
  state.roomName = up ? group.name : isHome ? homeData.room.name : null;
  state.home = isHome ? { ...homeData, ownerId: Number(room.slice(5)) } : null;
  // into your pyjamas upstairs (or back into your day clothes)
  if (!!dressFor(state.me.avatar).pj !== wearingPJ) playerAvatar();
  world.setFloor(roof ? 'garden' : isHome ? 'home' : isHall ? room : isCommon ? 'common' : isMusic ? 'music' : isPrayer ? 'prayer' : isKoshari ? 'koshari' : up ? 'up' : 'main');
  if (isHall) await loadHallDoors();
  if (isHome) {
    world.home.setRoom(homeData.room); world.home.setItems(homeData.items);
    restoreBalconyDoor();
    world.home.setPet(homeData.pet); setSnackShelf(homeData.snacks);
    world.home.setGifts(homeData.gifts, homeData.canEdit);
    setMovie(homeData.movie, homeData.now);
  } else setMovie(null);
  if (up) world.setUpstairsSign(group.name, group.description || 'upstairs at Sakura Slice', group.color);

  // arrive at the top (or the foot) of the stairs, facing into the room
  // (on the roof, a few steps clear of the stair house, so the camera isn't inside it)
  player.pos.set(STAIRS.x - 0.3, world.floorY, STAIRS.z + (roof ? 4.4 : 2.2));
  player.ry = 0;
  cam.yaw = Math.PI; cam.pitch = 0.3; cam.dist = cam.targetDist = 3.4;
  if (isHome) { // in through the door, facing into the room
    const a = world.home.arrival;
    player.pos.set(a.x, world.floorY, a.z);
    player.ry = a.ry;
    cam.yaw = 0; cam.pitch = 0.42; cam.dist = cam.targetDist = 2.6; // a bedroom, not a hall
  }
  if (isHall) { // at the top of the stairs, or just out of the room you came from
    const h = world[room];
    // (between the two hallways: you come out at the top, or the foot, of the stairs at the east end)
    const a = (from && from.startsWith('home:') && h.doorFront(from.slice(5))) || (from === 'garden' || from === 'hall2' ? h.fromGarden : from === 'hall' ? h.arrival : from === 'common' ? h.fromCommon : from === 'music' ? h.fromMusic : from === 'prayer' ? h.fromPrayer : from && from.startsWith('group:') ? h.fromGroups : h.arrival);
    player.pos.set(a.x, world.floorY, a.z);
    player.ry = a.ry;
    cam.yaw = a.ry + Math.PI; cam.pitch = 0.3; cam.dist = cam.targetDist = 3.0;
  }
  if (isCommon) { // just in through the door, the big TV ahead
    const a = world.common.arrival;
    player.pos.set(a.x, world.floorY, a.z);
    player.ry = a.ry;
    cam.yaw = 0; cam.pitch = 0.32; cam.dist = cam.targetDist = 3.4;
  }
  if (room === 'main' && from === 'koshari') { // back across the road and in at the front door
    player.pos.set(0, 0, mapZ(3.8)); player.ry = Math.PI;
    cam.yaw = 0; cam.pitch = 0.3; cam.dist = cam.targetDist = 3.6;
  }
  if (isKoshari) { // in from the street, the counter ahead
    const a = world.koshari.arrival;
    player.pos.set(a.x, 0, a.z); player.ry = a.ry;
    cam.yaw = Math.PI; cam.pitch = 0.3; cam.dist = cam.targetDist = 2.8;
  }
  if (isMusic || isPrayer) { // just in from the door: the stage, or the qibla wall, ahead
    const a = world[room].arrival;
    player.pos.set(a.x, world.floorY, a.z);
    player.ry = a.ry;
    cam.yaw = 0; cam.pitch = 0.3; cam.dist = cam.targetDist = 3.2;
  }
  camTarget.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));

  for (const id of [...state.people.keys()]) removePerson(id);
  for (const id of [...state.notes.keys()]) removeNote(id);
  $('chatLog').replaceChildren();
  send({ t: 'room', room, state: {
    x: player.pos.x, z: player.pos.z, ry: player.ry, seat: null, drink: player.drink, placed: null, moving: false,
  } });
  $('floorAct').querySelector('.t').textContent = isKoshari ? 'Back to the café' : room !== 'main' ? 'Downstairs' : 'Upstairs';
  $('floorAct').firstElementChild.textContent = isKoshari ? '☕' : room !== 'main' ? '⬇️' : '🪜';
  refreshActions();
  garden.open = null;
  if (roof) await loadGarden();
  await loadNotes();
  try {
    const { messages } = await api('/chat?room=' + encodeURIComponent(room));
    messages.forEach(addChat);
  } catch (e) { /* fine */ }
  if (isCommon) { world.common.setTV(state.content['common.tv']); setTimeout(() => commonTV(true), 900); }
  setQuietRoom(isPrayer);
  sysChat(isCommon ? 'You open the doors to the Common room. Someone has left the kettle on.'
    : isKoshari ? 'You cross the road — mind the tuk-tuk — to Koshari Abu Saied. The spoon rings on the steel bowls.'
    : isMusic ? 'You open the doors to the Music Room. Someone has left the piano lid up.'
    : isPrayer ? 'You slip off your shoes and step into the Prayer Room. It is very quiet in here.' : isHall ? (from === 'main' ? 'You climb the stairs to the hallway upstairs.' + yourDoor()
      : room === 'hall2' && from === 'hall' ? 'You climb on up to the upper hallway — Rooms 15 to 28.' + yourDoor()
      : room === 'hall2' && from === 'garden' ? 'You come down from the roof into the upper hallway.'
      : room === 'hall' && from === 'hall2' ? 'You go back down to the first hallway.'
      : 'You step out into the hallway.')
    : roof ? 'You climb all the way up to the roof garden. The air smells of mint and warm stone.'
    : isHome ? (state.home.canEdit ? (homeData.items.length ? 'You open the door to your room.' : "You open the door to your room. It's empty for now — 🛠️ Decorate to make it yours.")
      : `You knock, and step into ${homeData.room.ownerName}'s room.`)
    : up ? `You climb the spiral stairs to ${group.name}'s room.` : from === 'koshari' ? 'You cross back over the road and in at the café door. The bell chimes.' : 'You come back down into the café.');
  if (isHome && homeData.focus) offerFocus(homeData.focus, homeData.now);
  updateOnline();
  await wait(120);
  $('fade').classList.remove('on');
}

$('floorAct').onclick = () => goToRoom(state.room === 'main' ? 'hall' : 'main');

// ── where you were: refresh, close the tab or come back tomorrow, and the
// café opens where you left it — the same room, where you stood, your seat.
// Kept in this browser every couple of seconds, and on your account (prefs)
// every half a minute and as you leave, so it follows you to your phone too.
const placeKey = () => 'cafe.place.' + state.me.id;
let placeSent = '';
function currentPlace() {
  return {
    room: state.room, x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), ry: +player.ry.toFixed(2),
    seat: player.seat ? player.seat.id : null, at: Date.now(),
  };
}
function savePlace(toAccount = false, leaving = false) {
  // not mid-stairs (between rooms) or before you've come in
  if (!state.started || !state.me || $('fade').classList.contains('on')) return;
  const p = currentPlace();
  try { localStorage.setItem(placeKey(), JSON.stringify(p)); } catch (e) { /* private window */ }
  const same = JSON.stringify({ ...p, at: 0 });
  if (!toAccount || same === placeSent) return;
  placeSent = same;
  // keepalive: the request still goes out as the page closes
  fetch('/api/me', {
    method: 'PATCH', credentials: 'same-origin', keepalive: leaving,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefs: { place: p } }),
  }).catch(() => {});
}
setInterval(() => savePlace(), 2000);
setInterval(() => savePlace(true), 30e3);
document.addEventListener('visibilitychange', () => { if (document.hidden) savePlace(true, true); });
addEventListener('pagehide', () => savePlace(true, true));

// the newer of this browser's note and the account's
function lastPlace() {
  let local = null;
  try { local = JSON.parse(localStorage.getItem(placeKey()) || 'null'); } catch (e) { /* none */ }
  const acct = (state.me.prefs || {}).place || null;
  const p = [local, acct].filter(q => q && typeof q.room === 'string').sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  return p || null;
}
// is (x, z) somewhere you can stand on this floor? (the walls and furniture
// wouldn't push you anywhere else)
function standable(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const p = new THREE.Vector3(x, 0, z);
  collide(p);
  return Math.hypot(p.x - x, p.z - z) < 0.05;
}
// back to where you were; false if there's nowhere to go back to
async function resumePlace(p) {
  if (!p) return false;
  if (p.room !== 'main') {
    let group = null;
    if (p.room.startsWith('group:')) {
      try { group = (await api('/groups')).mine.find(g => 'group:' + g.id === p.room); } catch (e) { /* offline */ }
      if (!group) return false; // not in that group any more
    }
    await goToRoom(p.room, group);
    if (state.room !== p.room) return false; // a door that's shut now
  }
  if (standable(p.x, p.z)) {
    player.pos.set(p.x, world.floorY, p.z);
    player.ry = p.ry || 0;
    player.target = null;
    cam.yaw = player.ry + Math.PI;
    camTarget.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));
    sendMove(true);
  }
  const seat = p.seat && world.seats.find(x => x.id === p.seat);
  if (seat && !seatTaken(seat)) sitAt(seat);
  return true;
}

// ── the hallways upstairs: whose door is whose (and whose has a light on).
// Doors 0–13 are along the first hallway, 14–27 along the upper one.
const hallFor = door => (door != null && door >= 14 ? 'hall2' : 'hall');
const roomNo = door => `Room ${String(door + 1).padStart(2, '0')}`;
// the owner's list of flats and their doors (the same as on /admin), right here in the hallway
async function openDoors() {
  openPanel('doorsPanel');
  $('doorsMsg').textContent = 'Loading…';
  let data;
  try { data = await api('/admin/homes'); } catch (e) { $('doorsMsg').textContent = '⚠️ ' + e.message; return; }
  const { homes, doors } = data;
  $('doorsMsg').textContent = homes.length ? '' : 'Nobody has a flat yet.';
  const byDoor = new Map(homes.filter(h => h.door != null).map(h => [h.door, h]));
  const label = d => (d == null ? 'no door' : roomNo(d) + (d >= 14 ? ' (upper hallway)' : ''));
  $('doorsList').replaceChildren(...homes.map(h => {
    const card = document.createElement('div');
    card.className = 'group-card';
    const t = document.createElement('div');
    const b = document.createElement('b'); b.textContent = `${label(h.door)} — ${h.ownerName}`;
    const sm = document.createElement('small'); sm.className = 'fine';
    sm.textContent = `@${h.username} · “${h.name}” · ${h.items} thing${h.items === 1 ? '' : 's'} in it · door ${h.open ? 'open' : 'shut'}`;
    t.append(b, document.createElement('br'), sm);
    const row = document.createElement('div'); row.className = 'row'; row.style.gap = '6px';
    const pick = document.createElement('select');
    for (let d = 0; d < doors; d++) {
      const o = document.createElement('option');
      const there = byDoor.get(d);
      o.value = d;
      o.textContent = `${label(d)} — ${there ? (there.ownerId === h.ownerId ? 'here now' : there.ownerName + "'s (swap)") : 'free'}`;
      if (d === h.door) o.selected = true;
      pick.append(o);
    }
    const go = document.createElement('button');
    go.type = 'button'; go.className = 'btn ghost'; go.textContent = 'Move';
    go.onclick = async () => {
      const door = Number(pick.value);
      if (door === h.door) return;
      go.disabled = true;
      try {
        const r = await api('/admin/home/' + h.ownerId + '/door', { method: 'PUT', body: { door } });
        const other = r.swappedWith != null && homes.find(x => x.ownerId === r.swappedWith);
        await loadHallDoors();
        await openDoors();
        $('doorsMsg').textContent = `🚪 ${h.ownerName}'s flat is now ${label(door)}${other ? ` — ${other.ownerName}'s moved to ${label(h.door)}` : ''}.`;
      } catch (e) { $('doorsMsg').textContent = '⚠️ ' + e.message; go.disabled = false; }
    };
    row.append(pick, go);
    card.append(t, row);
    return card;
  }));
}
$('doorsAct').onclick = () => openDoors();

// which door is yours, said the way you'd say it: the 2nd door on your right
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
function yourDoor() {
  const d = state.myHome && state.myHome.door;
  if (d == null) return ' Every door along here is taken — your room is through 🏠 My room.';
  const i = d % 14, side = i % 2 === 0 ? 'left' : 'right'; // (even doors on the north wall: your left from the stairs)
  if (hallFor(d) === state.room) return ` Your door is ${roomNo(d)} — the ${ORD[Math.floor(i / 2)]} door on your ${side}, with ★ on it.`;
  return d >= 14 ? ` Your door is ${roomNo(d)}, in the upper hallway — up the stairs at the far end.` : ` Your door is ${roomNo(d)}, in the hallway below.`;
}
async function loadHallDoors() {
  try {
    const r = await api('/home');
    state.myHome = r.mine;
    world.hall.setDoors(r.mine, r.doors);
    world.hall2.setDoors(r.mine, r.doors);
    if (r.mine && r.mine.door == null && !state.hallFullNoted) { state.hallFullNoted = true; toast('🏠 Every door in the hallway is taken just now — your room is through 🏠 My room.'); }
    if (r.giftsWaiting && !state.giftNudged) { state.giftNudged = true; toast(`🎁 ${r.giftsWaiting === 1 ? 'A present is' : `${r.giftsWaiting} presents are`} waiting by your door.`); }
  } catch (e) { /* signed out: the doors stay shut */ }
}
setInterval(() => { if ((state.room === 'hall' || state.room === 'hall2') && !document.hidden) loadHallDoors(); }, 20e3);

// ───────────────────────────────────────── the roof garden
// Eight beds the whole café shares (server/garden.js): plant, water, weed,
// pick. What changes for one person changes for everyone up there.
const garden = { beds: [], me: null, open: null, busy: false };
const GARDEN_ACTS = {
  plant: { icon: '🌱', label: 'Plant seeds', e: '🌱' },
  water: { icon: '💧', label: 'Water it', e: '💧' },
  weed: { icon: '🌿', label: 'Pull the weeds', e: '🌿' },
  harvest: { icon: '🧺', label: 'Pick it', e: '🧺' },
};
const STAGES = ['Bare soil, ready for seeds', 'Seedlings, just up', 'Growing', 'Ready to pick'];
const bedOf = id => garden.beds.find(b => b.id === id);

async function loadGarden() {
  try {
    const r = await api('/garden');
    garden.beds = r.beds;
    garden.me = r.me;
    world.setGarden(garden.beds);
  } catch (e) { /* the garden waits */ }
}
function setGardenBeds(beds) {
  garden.beds = beds;
  world.setGarden(beds);
  if (garden.open === 'list') openGardenList();
  else if (garden.open && !$('gardenPanel').classList.contains('hidden')) openBed(garden.open);
}
function helpedLine() {
  const m = garden.me;
  if (!m) return '';
  const n = m.plants + m.waters + m.weeds + m.harvests;
  if (!n) return "You haven't helped in the garden yet — every little bit counts.";
  return `You've helped ${n} time${n === 1 ? '' : 's'}: 🌱 ${m.plants} · 💧 ${m.waters} · 🌿 ${m.weeds} · 🧺 ${m.harvests}. Yuto says thank you.`;
}

function openBed(id) {
  const b = bedOf(id);
  if (!b) return;
  garden.open = id;
  $('gardenEyebrow').textContent = 'The roof garden';
  $('gardenTitle').textContent = `The ${b.plant.toLowerCase()} bed`;
  $('gardenText').textContent = b.use;
  const body = $('gardenBody');
  const status = document.createElement('p');
  status.className = 'fine';
  status.textContent = `${STAGES[b.stage]}${b.weeds ? ' · weeds coming through' : ''}`;
  const water = document.createElement('div');
  water.className = 'bed-meter';
  water.title = 'How damp the soil is';
  const fill = document.createElement('i');
  fill.style.width = `${Math.round(b.water * 100)}%`;
  water.appendChild(fill);
  const wl = document.createElement('p');
  wl.className = 'fine';
  wl.textContent = b.stage === 0 ? '' : b.water < 0.35 ? '💧 The soil is dry — it needs water to grow.' : b.water > 0.85 ? '💧 Soaked. It has all it needs for now.' : '💧 Damp enough to keep growing.';
  const acts = document.createElement('div');
  acts.className = 'bed-acts';
  for (const [k, a] of Object.entries(GARDEN_ACTS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn' + (b.needs.includes(k) ? '' : ' ghost');
    btn.textContent = `${a.icon} ${a.label}`;
    const can = k === 'plant' ? b.stage === 0 : k === 'water' ? b.water < 0.85 : k === 'weed' ? b.weeds : b.stage === 3;
    btn.disabled = !can || garden.busy;
    btn.onclick = () => tendBed(id, k);
    acts.appendChild(btn);
  }
  body.replaceChildren(status, water, wl, acts);
  $('gardenMe').textContent = helpedLine();
  openPanel('gardenPanel');
}

function openGardenList() {
  garden.open = 'list';
  $('gardenEyebrow').textContent = 'Pinned by the beds';
  $('gardenTitle').textContent = "Yuto's garden list";
  const jobs = garden.beds.flatMap(b => b.needs.map(k => ({ b, k })));
  $('gardenText').textContent = jobs.length
    ? "\"If you have a minute — no pressure. The plants are patient, and so am I.\" — Yuto"
    : '"Nothing needs doing right now. Sit down. Have a coffee. That is also gardening." — Yuto';
  const order = { harvest: 0, water: 1, weed: 2, plant: 3 };
  const words = { plant: 'needs seeds', water: 'is thirsty', weed: 'has weeds', harvest: 'is ready to pick' };
  const list = document.createElement('div');
  list.className = 'garden-jobs';
  jobs.sort((x, y) => order[x.k] - order[y.k]).forEach(({ b, k }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const t = document.createElement('span');
    t.textContent = `${GARDEN_ACTS[k].icon} The ${b.plant.toLowerCase()} ${words[k]}`;
    const go = document.createElement('small');
    go.textContent = 'go →';
    btn.append(t, go);
    btn.onclick = () => tendBed(b.id, k);
    list.appendChild(btn);
  });
  $('gardenBody').replaceChildren(list);
  $('gardenMe').textContent = helpedLine();
  openPanel('gardenPanel');
}

// Walk over to the bed, then do it.
async function tendBed(id, action) {
  if (garden.busy) return;
  const spot = world.gardenSpots()[id];
  if (!spot) return;
  garden.busy = true;
  closePanels();
  if (player.seat) standUp();
  player.goingToSeat = null;
  const target = new THREE.Vector3(spot.x, world.floorY, spot.z);
  // every bed is worked from the gravel path between the two rows; from
  // anywhere else, come in at the path's end so you don't walk into a bed
  const onPath = player.pos.x > 2.3 && player.pos.z > -2.5 && player.pos.z < 1.1;
  if (Math.hypot(player.pos.x - spot.x, player.pos.z - spot.z) > 0.6) {
    if (onPath) walkTo(target);
    else { player.path = [new THREE.Vector3(spot.x, world.floorY, -0.7), target]; player.target = new THREE.Vector3(2.0, world.floorY, -0.7); }
  }
  // wait while they're still on their way (however slow the computer is);
  // stop if they arrive or stop walking — or give up quietly if they head
  // off somewhere else themselves (a new target that isn't one of ours)
  const ours = new Set([player.target, ...(player.path || [])].filter(Boolean));
  const t0 = performance.now();
  while (Math.hypot(player.pos.x - spot.x, player.pos.z - spot.z) > 0.7 && performance.now() - t0 < 120000) {
    if (!player.target && !(player.path && player.path.length)) break;
    if (player.target && !ours.has(player.target)) { garden.busy = false; return; }
    await wait(120);
  }
  try {
    if (Math.hypot(player.pos.x - spot.x, player.pos.z - spot.z) > 2.5) throw new Error("You couldn't quite reach it — walk a little closer and try again.");
    player.target = null;
    player.path = null;
    const bed = bedOf(id);
    player.ry = Math.atan2(spot.bx - player.pos.x, spot.bz - player.pos.z); // face the bed
    bubble(player.av.group, GARDEN_ACTS[action].e, 'emote');
    send({ t: 'emote', e: GARDEN_ACTS[action].e });
    sound.cue('pin');
    const r = await api(`/garden/${id}/${action}`, { method: 'POST', body: {} }); // writes must be JSON (see api.js)
    garden.me = r.me;
    setGardenBeds(r.beds);
    toast(`${GARDEN_ACTS[action].icon} ${r.message}`);
    if (bed && action === 'harvest') sysChat(`You picked the ${bed.plant.toLowerCase()} for the café kitchen.`);
  } catch (e) {
    toast(e.message);
  } finally {
    garden.busy = false;
  }
}

$('gardenGo').onclick = () => goToRoom('garden');

// ───────────────────────────────────────── your room upstairs
// Everyone has a room along the upstairs hallway (server/homes.js). It
// starts empty; the owner fills it from the catalogue (furniture.mjs), and
// anyone in it can sit, sleep in a bed or start a study session at a desk.
const decor = { cat: 'sleep', pick: null, color: null, ry: 0, moveId: null, sel: null, place: null };
const FLOOR_NAMES = { oak: 'Light oak', walnut: 'Walnut', tatami: 'Tatami', tile: 'Tiles' };
const inMyRoom = () => !!(state.home && state.home.canEdit);
const homeItem = id => world.home.items.get(id);

// ── the hallway (in the stairs panel)
async function loadHallway() {
  try {
    const r = await api('/home');
    state.myHome = r.mine;
    $('homeName').textContent = r.mine.name;
    const s = r.stats;
    $('homeStats').textContent = state.room === 'home:' + r.mine.ownerId ? "You're in it now"
      : s.focusMinutes || s.nights ? `📚 ${s.focusMinutes} min studied · 🌙 ${s.nights} night${s.nights === 1 ? '' : 's'}` : '';
    $('homeGo').disabled = state.room === 'home:' + r.mine.ownerId;
    $('homeDoors').replaceChildren(...r.doors.filter(d => d.canEnter).map(d => {
      const card = document.createElement('div');
      card.className = 'group-card';
      const t = document.createElement('div');
      const b = document.createElement('b'); b.textContent = d.name;
      const sm = document.createElement('small'); sm.className = 'fine';
      sm.textContent = `${d.invited ? 'you can always come in' : 'door open'}${d.here ? ` · ${d.here} in there` : ''}`;
      t.append(b, document.createElement('br'), sm);
      const go = document.createElement('button');
      go.type = 'button'; go.className = 'btn ghost';
      go.textContent = state.room === 'home:' + d.ownerId ? "You're here" : 'Knock 🚪';
      go.disabled = state.room === 'home:' + d.ownerId;
      go.onclick = () => goToRoom('home:' + d.ownerId);
      card.append(t, go);
      return card;
    }));
  } catch (e) { /* signed out */ }
}
$('homeGo').onclick = () => state.myHome && goToRoom('home:' + state.myHome.ownerId);

// ── decorating (the owner only)
function openDecor() {
  if (!inMyRoom()) return;
  const cats = $('decorCats');
  cats.replaceChildren(...CATS.map(([k, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (k === decor.cat ? ' on' : '');
    b.textContent = label;
    b.onclick = () => { decor.cat = k; openDecor(); };
    return b;
  }));
  $('decorGrid').replaceChildren(...FURNITURE.filter(f => f.cat === decor.cat).map(f => {
    const card = document.createElement('div');
    card.className = 'item';
    const name = document.createElement('b');
    name.textContent = f.name;
    const sw = document.createElement('div');
    sw.className = 'sw-row';
    for (const c of f.colors) {
      const s = document.createElement('button');
      s.type = 'button'; s.style.background = c; s.title = `${f.name} in this colour`;
      s.onclick = () => startDecorPlacing(f.kind, c);
      sw.appendChild(s);
    }
    card.onclick = e => { if (e.target === card || e.target === name) startDecorPlacing(f.kind, f.colors[0]); };
    card.append(name, sw);
    return card;
  }));
  $('decorCount').textContent = `${world.home.items.size} of ${MAX_ITEMS} things in your room.`;
  renderSelection();
  openPanel('decorPanel');
}
function renderSelection() {
  const box = $('decorSel');
  const e = decor.sel != null && homeItem(decor.sel);
  box.classList.toggle('hidden', !e);
  world.home.select(e ? decor.sel : null);
  if (!e) return;
  const title = document.createElement('b');
  title.textContent = e.def.name;
  const row = document.createElement('div');
  row.className = 'row';
  const btn = (label, fn, cls = 'btn ghost') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.onclick = fn; row.appendChild(b); };
  btn('✋ Move', () => startDecorPlacing(e.item.kind, e.item.color, e.item.id, e.item.ry));
  btn('↻ Turn', () => saveItem(e.item.id, { ry: e.item.ry - Math.PI / 4 }));
  btn('🗑️ Take it out', () => removeItem(e.item.id));
  btn('Done', () => { decor.sel = null; renderSelection(); });
  const sw = document.createElement('div');
  sw.className = 'sw-row';
  sw.style.marginTop = '8px';
  for (const c of e.def.colors) {
    const s = document.createElement('button');
    s.type = 'button'; s.style.background = c; s.className = c === e.item.color ? 'on' : '';
    s.onclick = () => saveItem(e.item.id, { color: c });
    sw.appendChild(s);
  }
  box.replaceChildren(title, row, sw);
  if (e.def.picture) box.appendChild(frameEditor(e));
}
// a frame's picture (from your device) and the line underneath it
function frameEditor(e) {
  const wrap = document.createElement('div');
  wrap.className = 'frame-edit';
  const file = document.createElement('input');
  file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp'; file.hidden = true;
  const pick = document.createElement('button');
  pick.type = 'button'; pick.className = 'btn'; pick.textContent = e.item.imageId ? '🖼️ Change the picture' : '🖼️ Choose a picture';
  pick.onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    pick.disabled = true; pick.textContent = 'Developing…';
    try {
      const blob = await shrinkPhoto(f);
      const r = await fetch('/api/home/photo-upload', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob, credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "That picture didn't upload.");
      await saveItem(e.item.id, { imageId: j.id });
      sound.cue('pin');
    } catch (err) { toast(err.message); pick.disabled = false; pick.textContent = '🖼️ Choose a picture'; }
  };
  const cap = document.createElement('input');
  cap.type = 'text'; cap.maxLength = 80; cap.placeholder = 'Write something under it…'; cap.value = e.item.caption || '';
  const save = document.createElement('button');
  save.type = 'button'; save.className = 'btn ghost'; save.textContent = '✍️ Write it';
  save.onclick = () => saveItem(e.item.id, { caption: cap.value.trim() });
  cap.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') save.click(); };
  const row = document.createElement('div');
  row.className = 'row';
  row.append(cap, save);
  wrap.append(pick, file, row);
  return wrap;
}
// big phone photos are shrunk to at most 1280px on the long side, as a JPEG
async function shrinkPhoto(f) {
  if (!/^image\//.test(f.type)) throw new Error('That needs to be a picture.');
  const img = await createImageBitmap(f).catch(() => { throw new Error("That picture couldn't be opened."); });
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error("That picture couldn't be opened.")), 'image/jpeg', 0.86));
}
// looking at a frame up close (anyone in the room)
function openFrame(id) {
  const e = homeItem(id);
  if (!e) return;
  if (decor.pick) return;
  const pic = $('framePic');
  pic.classList.toggle('hidden', !e.item.imageId);
  if (e.item.imageId) pic.src = `/api/home/photo/${e.item.imageId}`;
  pic.style.setProperty('--frame', e.item.color);
  $('frameCaption').textContent = e.item.caption || (e.item.imageId ? '' : (inMyRoom() ? 'No picture yet — open Decorate and click the frame to choose one.' : 'An empty frame, waiting for a picture.'));
  $('frameWhere').textContent = `${e.def.name} · ${AREAS[areaAt(e.item.x, e.item.z)].name}`;
  openPanel('framePanel');
}
async function saveItem(id, change) {
  try {
    const { item } = await api('/home/items/' + id, { method: 'PATCH', body: change });
    world.home.update(item);
    renderSelection();
  } catch (e) { toast(e.message); }
}
async function removeItem(id) {
  try {
    await api('/home/items/' + id, { method: 'DELETE', body: {} });
    world.home.remove(id);
    decor.sel = null;
    sound.cue('pin');
    openDecor();
  } catch (e) { toast(e.message); }
}

function startDecorPlacing(kind, color, moveId = null, ry = 0) {
  closePanels();
  decor.pick = kind; decor.color = color; decor.moveId = moveId; decor.ry = ry; decor.place = null;
  world.home.showGhost(kind, color);
  world.home.select(null);
  $('decorHintText').textContent = `${BY_KIND.get(kind).name} — click where it goes`;
  $('decorHint').classList.remove('hidden');
}
function stopDecorPlacing(reopen = true) {
  if (!decor.pick) return;
  decor.pick = null;
  world.home.hideGhost();
  $('decorHint').classList.add('hidden');
  if (reopen && inMyRoom()) openDecor();
}
function turnGhost(by) {
  decor.ry += by;
  if (decor.place) { decor.place = placementAt(decor.place.sx, decor.place.sy); showPlace(); }
}
$('decorRotL').onclick = () => turnGhost(Math.PI / 4);
$('decorRotR').onclick = () => turnGhost(-Math.PI / 4);
$('decorCancel').onclick = () => stopDecorPlacing();

// Where would it go if you clicked here? Big things on the floor; small things
// on the floor or on top of a desk, a dresser, a shelf…
function placementAt(sx, sy) {
  const def = BY_KIND.get(decor.pick);
  if (def.wall) return wallPlacementAt(sx, sy);
  const tops = def.onTop ? world.home.tops().filter(t => t.userData.itemId !== decor.moveId) : [];
  const hits = castAt(sx, sy, [world.floorMesh, ...tops]);
  const h = hits[0];
  if (!h) return null;
  const snap = v => Math.round(v * 20) / 20;
  const x = snap(h.point.x), z = snap(h.point.z);
  const y = h.object.userData.homeTop ? h.object.userData.top - world.floorY : 0;
  const ok = world.home.canPlace(decor.pick, x, z, decor.ry, decor.moveId);
  return { sx, sy, x, y, z, ok };
}
// Frames go on a wall: wherever you point, facing out of it, at that height
// (kept between knee and just under the ceiling).
const wallNormal = new THREE.Vector3();
function wallPlacementAt(sx, sy) {
  const h = castAt(sx, sy, world.home.walls)[0];
  if (!h || !h.face) return null;
  wallNormal.copy(h.face.normal).transformDirection(h.object.matrixWorld);
  if (Math.abs(wallNormal.y) > 0.5) return null;
  const snap = v => Math.round(v * 20) / 20;
  // flush against the wall, and on the 5 cm grid along it
  const alongX = Math.abs(wallNormal.z) > Math.abs(wallNormal.x);
  const x = alongX ? snap(h.point.x) : h.point.x + wallNormal.x * 0.032, z = alongX ? h.point.z + wallNormal.z * 0.032 : snap(h.point.z);
  const y = Math.min(2.5, Math.max(0.7, snap(h.point.y - world.floorY)));
  decor.ry = Math.round(Math.atan2(wallNormal.x, wallNormal.z) / (Math.PI / 2)) * (Math.PI / 2);
  const ok = world.home.canPlace(decor.pick, x, z, decor.ry, decor.moveId);
  return { sx, sy, x, y, z, ok };
}
function showPlace() {
  const p = decor.place;
  if (p) world.home.moveGhost(p.x, p.y, p.z, decor.ry, p.ok);
}
async function placeAt(sx, sy) {
  const p = placementAt(sx, sy);
  if (!p) return;
  if (!p.ok) return toast("It won't fit there — try somewhere clear (and keep the doorway free).");
  const body = { x: p.x, y: p.y, z: p.z, ry: decor.ry };
  try {
    const { item } = decor.moveId
      ? await api('/home/items/' + decor.moveId, { method: 'PATCH', body })
      : await api('/home/items', { method: 'POST', body: { ...body, kind: decor.pick, color: decor.color } });
    world.home.update(item);
    sound.cue('pin');
    decor.sel = decor.moveId ? item.id : null;
    stopDecorPlacing();
  } catch (e) { toast(e.message); }
}
// in decorate mode, clicking something already in the room picks it
function decorPickAt(x, y) {
  const h = pickInteractive(x, y);
  const id = h && h.object.userData.itemId;
  if (!id || !homeItem(id)) return false;
  decor.sel = id;
  renderSelection();
  return true;
}

// ── the room itself: name, colours, who can come in
function openRoomPanel() {
  if (!inMyRoom()) return;
  const r = state.home.room;
  $('roomName').value = r.name;
  $('roomWalls').replaceChildren(...WALLS.map(c => {
    const b = document.createElement('button');
    b.type = 'button'; b.style.background = c; b.className = c === r.wall ? 'on' : '';
    b.onclick = () => saveRoom({ wall: c });
    return b;
  }));
  $('roomFloors').replaceChildren(...FLOORS.map(f => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (f === r.floor ? ' on' : '');
    b.textContent = FLOOR_NAMES[f] || f;
    b.onclick = () => saveRoom({ floor: f });
    return b;
  }));
  $('roomPaper').replaceChildren(...WALLPAPERS.map(w => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + ((r.wallpaper || 'plain') === w ? ' on' : '');
    b.textContent = PAPER_NAMES[w] || w;
    b.onclick = () => saveRoom({ wallpaper: w });
    return b;
  }));
  renderPetForm(true);
  $('roomOpen').checked = !!r.open;
  renderGuests();
  const s = state.home.stats || {};
  $('roomStats').textContent = `📚 ${s.focusMinutes || 0} minutes studied in ${s.sessions || 0} session${s.sessions === 1 ? '' : 's'} · 🌙 ${s.nights || 0} night${s.nights === 1 ? '' : 's'} slept here`;
  $('roomErr').textContent = '';
  openPanel('roomPanel');
}
function renderGuests() {
  const list = state.home.guests || [];
  $('roomGuests').replaceChildren(...(list.length ? list.map(g => {
    const row = document.createElement('div');
    const n = document.createElement('span'); n.textContent = `${g.displayName} · @${g.username}`;
    const x = document.createElement('button'); x.type = 'button'; x.textContent = 'Remove';
    x.onclick = async () => {
      try { state.home.guests = (await api('/home/guests/' + g.id, { method: 'DELETE', body: {} })).guests; renderGuests(); } catch (e) { toast(e.message); }
    };
    row.append(n, x);
    return row;
  }) : [Object.assign(document.createElement('p'), { className: 'fine', textContent: 'Nobody yet — let a friend in by their username.' })]));
}
async function saveRoom(change) {
  try {
    const { room } = await api('/home', { method: 'PATCH', body: change });
    state.home.room = room;
    world.home.setRoom(room);
    state.roomName = room.name;
    updateOnline();
    if (!$('roomPanel').classList.contains('hidden')) openRoomPanel();
  } catch (e) { $('roomErr').textContent = e.message; }
}
$('roomName').addEventListener('change', () => saveRoom({ name: $('roomName').value }));
$('roomOpen').addEventListener('change', () => saveRoom({ open: $('roomOpen').checked }));
$('roomInvite').addEventListener('submit', async e => {
  e.preventDefault();
  $('roomErr').textContent = '';
  const username = new FormData(e.target).get('username');
  try {
    const r = await api('/home/guests', { method: 'POST', body: { username } });
    state.home.guests = r.guests;
    e.target.reset();
    renderGuests();
    toast(`🗝️ ${r.added.displayName} can come into your room now.`);
  } catch (err) { $('roomErr').textContent = err.message; }
});

// ── study sessions
const focus = { end: 0, minutes: 0, timer: null, skew: 0, offer: null };
let studyLen = 25;
function openStudy() {
  $('studyLen').replaceChildren(...[15, 25, 50, 90].map(m => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (m === studyLen ? ' on' : '');
    b.textContent = `${m} min`;
    b.onclick = () => { studyLen = m; openStudy(); };
    return b;
  }));
  $('studyTogetherRow').classList.toggle('hidden', !(state.home && state.people.size));
  const s = (state.home && state.home.stats) || {};
  $('studyStats').textContent = focus.end ? 'A session is already running.' : s.sessions ? `So far: ${s.focusMinutes} minutes in ${s.sessions} session${s.sessions === 1 ? '' : 's'}.` : '';
  $('studyStart').disabled = !!focus.end;
  openPanel('studyPanel');
}
$('studyStart').onclick = async () => {
  try {
    const together = !!state.home && state.people.size > 0 && $('studyTogether').checked;
    const r = await api('/home/focus/start', { method: 'POST', body: { minutes: studyLen, room: state.room, together } });
    closePanels();
    runFocus(r, together ? 'together' : '');
    if (together) sysChat(`You start a ${r.minutes}-minute study session for everyone in the room.`);
  } catch (e) { toast(e.message); }
};
$('studyRadio').onclick = () => { closePanels(); showMusic(true, 'radio'); };
function runFocus(r, what) {
  focus.skew = Date.now() - r.now; // our clock minus the server's
  focus.end = r.end + focus.skew;
  focus.minutes = r.minutes;
  $('focusWhat').textContent = what === 'together' ? 'together' : '';
  $('focusHud').classList.remove('hidden');
  $('focusInvite').classList.add('hidden');
  clearInterval(focus.timer);
  const tick = () => {
    const left = Math.max(0, focus.end - Date.now());
    $('focusTime').textContent = fmt(left / 1000);
    if (left <= 0) finishFocus();
  };
  tick();
  focus.timer = setInterval(tick, 500);
}
async function finishFocus() {
  clearInterval(focus.timer);
  focus.end = 0;
  $('focusHud').classList.add('hidden');
  try {
    const r = await api('/home/focus/finish', { method: 'POST', body: {} });
    if (state.home) state.home.stats = r.stats;
    sound.counterBell(player.pos);
    toast(`📚 ${r.minutes} minutes of real focus. Stretch, drink some water — that's ${r.stats.focusMinutes} minutes in all.`);
    sysChat(`You finished a ${r.minutes}-minute study session.`);
  } catch (e) { toast(e.message); }
}
$('focusStop').onclick = async () => {
  clearInterval(focus.timer);
  focus.end = 0;
  $('focusHud').classList.add('hidden');
  try { await api('/home/focus/stop', { method: 'POST', body: {} }); } catch (e) { /* fine */ }
  toast('Session stopped. That was still worth something.');
};
function offerFocus(f, now) {
  if (!f || focus.end || (state.me && f.byId === state.me.id)) { $('focusInvite').classList.add('hidden'); focus.offer = null; return; }
  focus.offer = f;
  const left = Math.max(1, Math.round((f.end - now) / 60e3));
  $('focusInviteText').textContent = `📚 ${f.by} is studying — ${left} min left. Join in?`;
  $('focusInvite').classList.remove('hidden');
}
$('focusJoin').onclick = async () => {
  try {
    const r = await api('/home/focus/start', { method: 'POST', body: { join: true, room: state.room } });
    runFocus(r, 'together');
    sysChat(`You join ${focus.offer ? focus.offer.by + "'s" : 'the'} study session.`);
  } catch (e) { toast(e.message); $('focusInvite').classList.add('hidden'); }
};
$('focusNo').onclick = () => $('focusInvite').classList.add('hidden');

// ── sleeping
const sleep = { on: false };
async function goToBed(seat) {
  if (!seat) return;
  goSit(seat);
  const t0 = performance.now();
  while (player.seat !== seat && (player.goingToSeat === seat || player.target) && performance.now() - t0 < 60000) await wait(150);
  if (player.seat !== seat) return;
  startSleep();
}
async function startSleep() {
  sleep.on = true;
  $('sleepVeil').classList.remove('hidden');
  bubble(player.av.group, '💤', 'emote');
  send({ t: 'emote', e: '😴' });
  const stories = storyList().filter(s => s.kind === 'night');
  const s = stories.length ? stories[Math.floor(Math.random() * stories.length)] : null;
  $('sleepTitle').textContent = s ? s.title : 'Sleep well';
  $('sleepText').textContent = s ? s.paragraphs.slice(0, 4).join('\n\n') + (s.paragraphs.length > 4 ? '\n\n…the rest of this one is on the story shelf downstairs.' : '')
    : 'The city is quiet now. Put the heavy things down for tonight — they will still be there tomorrow, and so will you.\n\n— Me3temed';
  $('sleepNote').textContent = '';
  openPanel('sleepPanel');
  try {
    const r = await api('/home/sleep', { method: 'POST', body: {} });
    if (state.home) state.home.stats = r.stats;
    $('sleepNote').textContent = r.counted ? `🌙 That's ${r.stats.nights} night${r.stats.nights === 1 ? '' : 's'} you've slept here.` : '';
  } catch (e) { /* the night still happens */ }
}
function endSleep() {
  if (!sleep.on) return;
  sleep.on = false;
  $('sleepVeil').classList.add('hidden');
  if (!$('sleepPanel').classList.contains('hidden')) closePanels();
}
$('sleepWake').onclick = () => { endSleep(); standUp(); toast('☀️ Good morning. Take it slowly.'); };

// leaving the room (or the café) puts all of this away
function leaveHome() {
  stopDecorPlacing(false);
  decor.sel = null;
  world.home.select(null);
  endSleep();
  $('focusInvite').classList.add('hidden');
}

// ── wallpaper names, and the cat
const PAPER_NAMES = { plain: 'Plain', sakura: '🌸 Sakura', stripes: 'Stripes', dots: 'Polka dots', lattice: 'Asanoha', waves: 'Seigaiha waves' };
const COAT_NAMES = { ginger: 'Ginger', cream: 'Cream', grey: 'Grey', black: 'Black', tabby: 'Tabby', calico: 'Calico' };
let petCoat = 'ginger';
function renderPetForm(fresh = false) {
  const pet = state.home && state.home.pet;
  if (fresh) { petCoat = pet ? pet.coat : petCoat; $('petName').value = pet ? pet.name : ''; }
  $('petGo').textContent = pet ? 'Save' : '🐾 Adopt';
  $('petBye').classList.toggle('hidden', !pet);
  $('petCoats').replaceChildren(...Object.entries(COATS).map(([k, c]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = k === petCoat ? 'on' : ''; b.title = COAT_NAMES[k];
    b.style.background = k === 'calico' ? 'linear-gradient(135deg,#f4ece0 40%,#d98a4a 40% 70%,#2b2a2e 70%)' : k === 'tabby' ? 'repeating-linear-gradient(90deg,#9c7a5a 0 4px,#6d523b 4px 7px)' : c;
    b.onclick = () => { petCoat = k; renderPetForm(); };
    return b;
  }));
}
$('petForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('petErr').textContent = '';
  try {
    const had = !!state.home.pet;
    const { pet } = await api('/home/pet', { method: 'PUT', body: { name: $('petName').value, coat: petCoat } });
    state.home.pet = pet;
    world.home.setPet(pet);
    renderPetForm(true);
    if (!had) { toast(`🐾 Welcome home, ${pet.name}!`); sound.cue('heart'); }
  } catch (err) { $('petErr').textContent = err.message; }
});
$('petBye').onclick = async () => {
  if (!state.home.pet || !confirm(`Find ${state.home.pet.name} a new home? (They'll be very happy there.)`)) return;
  try { await api('/home/pet', { method: 'DELETE', body: {} }); state.home.pet = null; world.home.setPet(null); renderPetForm(true); } catch (err) { $('petErr').textContent = err.message; }
};
// whoever's typing at a laptop in here (the cat likes to help)
function typist() {
  if (player.seat && player.seat.work) return player.pos;
  for (const p of state.people.values()) {
    const seat = p.state && p.state.seat && world.seats.find(s => s.id === p.state.seat);
    if (seat && seat.work) return p.pos;
  }
  return null;
}
function strokeCat() {
  const c = world.home.petCat();
  if (!c) return;
  sound.cue('heart');
  const lines = ['purrs like a little engine', 'leans into your hand', 'does a slow blink at you — that means I love you', 'rolls over for a tummy rub (a trap)', 'headbutts your knee'];
  toast(`🐾 ${c.name} ${lines[Math.floor(Math.random() * lines.length)]}.`);
  send({ t: 'emote', e: '🐾' });
}

// ── the snack shelf: keep a pastry from downstairs, or have one later
let snacks = [];
function setSnackShelf(list = []) {
  snacks = list;
  world.home.setSnacks(list.map(id => pastryOf(id).shape));
}
async function useSnackShelf() {
  if (!state.home) return;
  if (player.dessert && player.dessert.bites === 0) {
    try {
      const r = await api(`/home/${state.home.ownerId}/snacks`, { method: 'POST', body: { pastry: player.dessert.id } });
      toast(`🍡 You put the ${pastryOf(player.dessert.id).name} on the snack shelf for later.`);
      player.dessert = null;
      player.av.setDessert(null);
      sendMove(true);
      refreshActions();
      setSnackShelf(r.snacks);
    } catch (e) { toast(e.message); }
    return;
  }
  if (player.dessert) return toast("You've started that one — finish it first 🍰");
  openSnacks();
}
function openSnacks() {
  const counts = new Map();
  snacks.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
  $('snackList').replaceChildren(...[...counts].map(([id, n]) => {
    const p = pastryOf(id);
    const row = document.createElement('div'); row.className = 'group-card';
    const t = document.createElement('div');
    const b = document.createElement('b'); b.textContent = p.name;
    const sm = document.createElement('small'); sm.className = 'fine'; sm.textContent = n > 1 ? ` × ${n}` : '';
    t.append(b, sm);
    const go = document.createElement('button'); go.type = 'button'; go.className = 'btn ghost'; go.textContent = 'Have one';
    go.onclick = () => takeSnack(id);
    row.append(t, go);
    return row;
  }));
  $('snackEmpty').classList.toggle('hidden', snacks.length > 0);
  openPanel('snackPanel');
}
async function takeSnack(id) {
  try {
    const r = await api(`/home/${state.home.ownerId}/snacks/take`, { method: 'POST', body: { pastry: id } });
    closePanels();
    player.dessert = { id: r.pastry, bites: 0 };
    player.av.setDessert(pastryOf(r.pastry).shape, 0);
    sound.cue('drink');
    sendMove(true);
    refreshActions();
    setSnackShelf(r.snacks);
    toast(`🍡 A ${pastryOf(r.pastry).name} from the shelf. Still perfect.`);
  } catch (e) { toast(e.message); }
}

// ── film night: what's on the TV, and the player that shows it
let movie = null, movieSkew = 0;
function setMovie(m, now) {
  movie = m || null;
  if (now) movieSkew = Date.now() - now;
  if (state.room !== 'common') world.home.setMovie(movie);
  const box = $('cinema');
  stopPlaylist();
  if (!movie) { box.classList.add('hidden'); $('cinemaFrame').src = 'about:blank'; return; }
  if (movie.list) { // a playlist: played in order, everyone in step (see playPlaylist)
    $('cinemaTitle').textContent = movie.title;
    $('cinemaBy').textContent = movie.by ? `put on by ${movie.by}` : 'on the Common room TV';
    box.classList.remove('hidden', 'small');
    playPlaylist(movie.list, state.room);
    return;
  }
  const offset = Math.max(0, Math.floor((Date.now() - movieSkew - movie.startedAt) / 1000));
  $('cinemaTitle').textContent = movie.title;
  $('cinemaBy').textContent = `put on by ${movie.by}`;
  $('cinemaFrame').src = `https://www.youtube-nocookie.com/embed/${movie.videoId}?autoplay=1&start=${offset}&rel=0&playsinline=1`;
  box.classList.remove('hidden', 'small');
}
function openMovie() {
  $('movieNow').classList.toggle('hidden', !movie);
  $('movieNowTitle').textContent = movie ? `“${movie.title}”, put on by ${movie.by}` : '';
  $('movieErr').textContent = '';
  openPanel('moviePanel');
}
$('movieForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('movieErr').textContent = '';
  try {
    const r = await api(`/home/${state.home.ownerId}/movie`, { method: 'POST', body: { url: $('movieUrl').value } });
    $('movieUrl').value = '';
    closePanels();
    setMovie(r.movie, r.now);
  } catch (err) { $('movieErr').textContent = err.message; }
});
$('movieStop').onclick = async () => { try { await api(`/home/${state.home.ownerId}/movie`, { method: 'DELETE', body: {} }); closePanels(); setMovie(null); } catch (err) { toast(err.message); } };
$('cinemaMin').onclick = () => $('cinema').classList.toggle('small');
$('cinemaClose').onclick = () => { $('cinema').classList.add('hidden'); $('cinemaFrame').src = 'about:blank'; stopPlaylist(); toast('📺 It goes on without you — click the TV to watch again.'); };

// ── playlists: YouTube's own player, so we can tell which video it's on and
// how far in. Whoever's watching tells the café every few seconds; anyone
// who comes in later starts from the same video, at the same moment.
let ytApi = null, ytPlayer = null, ytReport = null;
function loadYouTube() {
  if (ytApi) return ytApi;
  ytApi = new Promise(resolve => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytApi = null; toast("📺 YouTube didn't load — check your connection and click the TV again."); };
    document.head.appendChild(s);
  });
  return ytApi;
}
function stopPlaylist() {
  clearInterval(ytReport); ytReport = null;
  if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) { /* gone already */ } ytPlayer = null; }
  const holder = $('cinemaYT');
  if (holder) holder.remove();
  $('cinemaFrame').classList.remove('hidden');
}
async function playPlaylist(list, room) {
  let index = 0, start = 0;
  try {
    const r = await api('/tv/' + encodeURIComponent(room));
    if (r.pos && r.pos.list === list) {
      const skew = Date.now() - r.now;
      index = r.pos.index;
      start = Math.max(0, r.pos.t + (Date.now() - skew - r.pos.at) / 1000);
    }
  } catch (e) { /* start from the top */ }
  const YT = await loadYouTube();
  if (state.room !== room || $('cinema').classList.contains('hidden')) return;
  $('cinemaFrame').classList.add('hidden');
  $('cinemaFrame').src = 'about:blank';
  const holder = document.createElement('div');
  holder.id = 'cinemaYT';
  $('cinemaFrame').parentNode.appendChild(holder);
  ytPlayer = new YT.Player(holder, {
    width: '100%', height: '100%',
    playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
    events: {
      onReady: e => e.target.loadPlaylist({ list, listType: 'playlist', index, startSeconds: Math.floor(start) }),
      onError: () => toast("📺 That one won't play here — it skips to the next."),
    },
  });
  ytReport = setInterval(() => {
    if (!ytPlayer || !ytPlayer.getPlayerState || ytPlayer.getPlayerState() !== 1) return; // only while it's playing
    api('/tv/pos', { method: 'POST', body: { room, list, index: ytPlayer.getPlaylistIndex(), t: ytPlayer.getCurrentTime() } }).catch(() => {});
  }, 10000);
}

// ── Koshari Abu Saied, across the road: a bowl of koshari, just how you like it
const kosh = { size: 'm', dakka: true, shatta: false, crispy: true, busy: false };
function openKoshari() {
  const render = () => {
    for (const b of $('kSizes').children) b.classList.toggle('on', b.dataset.k === kosh.size);
    for (const b of $('kExtras').children) b.classList.toggle('on', !!kosh[b.dataset.k]);
  };
  $('kSizes').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { kosh.size = b.dataset.k; render(); } };
  $('kExtras').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { kosh[b.dataset.k] = !kosh[b.dataset.k]; render(); } };
  render();
  openPanel('kosharyPanel');
}
$('kOrder').onclick = () => {
  if (kosh.busy) return;
  closePanels();
  if (player.dessert) return toast('🥣 Finish what you have first — or put it down on a table.');
  kosh.busy = true;
  const k = world.koshari;
  const extras = [kosh.dakka && 'extra dakka', kosh.shatta && 'shatta', kosh.crispy && 'extra crispy onions'].filter(Boolean);
  bubble(k.cook.group, `${{ s: 'Small', m: 'Medium', l: 'Large' }[kosh.size]} koshari${extras.length ? ', ' + extras.join(', ') : ''}! Wa ahlan 🌶️`, 'npc');
  sound.street('clang', k.counterAt);
  setTimeout(() => sound.street('clang', k.counterAt), 1100);
  setTimeout(() => {
    kosh.busy = false;
    const id = 'koshari-' + kosh.size;
    player.dessert = { id, bites: 0 };
    player.av.setDessert('koshari', 0);
    sound.cue('drink');
    sendMove(true);
    refreshActions();
    toast(`🥣 Your ${KOSHARI_BOWLS[id].replace('a ', '')} is here, steaming${extras.length ? ' — with ' + extras.join(' and ') : ''}. Sit at a marble table; press B for a bite.`);
  }, 2400);
};
// the koshari man calls out now and then, and his spoon rings on the bowls
setInterval(() => {
  if (state.room !== 'koshari' || document.hidden || Math.random() < 0.5) return;
  const k = world.koshari;
  bubble(k.cook.group, ['Koshari! Koshari! 🥣', 'Ahlan! Come in, come in!', 'Hot and fresh — the onions are crispy today!', 'Dakka on the table, shatta if you dare 🌶️'][Math.floor(Math.random() * 4)], 'npc');
  sound.street('clang', k.counterAt);
}, 16000);

// ── the basket on the balcony's rope: down to the street, and back up with
// something in it from the kiosk (the way Cairo has always done its shopping)
const BASKET = [
  'a loaf of warm aish baladi, wrapped in paper', 'a bottle of cold water, beaded with drops', 'a paper cone of roasted peanuts',
  'two glasses of sugarcane juice', 'a bag of lemons and a bunch of mint', 'the evening paper, folded in half',
  'a little bag of ful and taameya, still hot', 'a box of basbousa from the bakery on the corner',
];
// the balcony doors: open or shut, remembered for each flat (in this browser)
const balKey = () => 'cafe.baldoor.' + (state.home ? state.home.ownerId : '');
function toggleBalconyDoor() {
  const open = !world.home.balconyDoorOpen();
  world.home.setBalconyDoor(open);
  try { localStorage.setItem(balKey(), open ? '1' : '0'); } catch (e) { /* fine */ }
  sound.cue('sit');
  toast(open ? '🚪 You open the balcony doors — the sound of the street comes in.' : '🚪 You pull the balcony doors shut. The street goes quiet.');
}
function restoreBalconyDoor() {
  let v = null;
  try { v = localStorage.getItem(balKey()); } catch (e) { /* fine */ }
  world.home.setBalconyDoor(v !== '0', true);
}
let basketBusy = false;
async function lowerBasket() {
  if (basketBusy) return;
  basketBusy = true;
  toast('🧺 You let the basket down on its rope… "Ya Am Saied!" — the man at the kiosk waves.');
  await wait(3500);
  toast(`🧺 Up it comes: ${BASKET[Math.floor(Math.random() * BASKET.length)]}. You wave a thank-you down to the street.`);
  basketBusy = false;
}

// ── the Music Room: a piano, a guitar and a cajón anyone can play. Every
// note goes to everyone else in the room too (realtime 'play') and sounds
// from where the instrument stands. Sit on the stool on the stage and the
// spotlight comes up; what you say from there shows with a 🎤.
const STAGE_SEAT = 'music-stage';
const onStage = seatId => seatId === STAGE_SEAT;
const CHORDS = [
  ['C', [48, 52, 55, 60, 64]], ['G', [43, 47, 50, 55, 59, 67]], ['Am', [45, 52, 57, 60, 64]], ['F', [41, 48, 53, 57, 60, 65]],
  ['Em', [40, 47, 52, 55, 59, 64]], ['D', [50, 57, 62, 66]], ['Dm', [50, 57, 62, 65]], ['E', [40, 47, 52, 56, 59, 64]],
];
let cajonHit = 1;
function soundOf(i, n, up) {
  const at = world.music.soundAt[i];
  if (i === 'piano') sound.piano(n, at);
  else if (i === 'guitar' && CHORDS[n]) sound.strum(CHORDS[n][1], at, up);
  else if (i === 'cajon') sound.cajon(n, at);
}
let noteBubbleAt = 0;
function playInstrument(i, n, up = false) {
  if (state.room !== 'music') return;
  soundOf(i, n, up);
  send({ t: 'play', i, n, up });
  if (performance.now() - noteBubbleAt > 1500) { noteBubbleAt = performance.now(); bubble(player.av.group, i === 'cajon' ? '🥁' : '🎵', 'emote'); }
}

// the piano: an octave and a half on screen, and on the computer keyboard
const piano = { base: 60 };
const WHITE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17];
const BLACK = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5], [13, 7], [15, 8]]; // [semitone, the white key it follows]
const PIANO_KEYS = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function buildPiano() {
  const el = $('pianoKeys');
  el.replaceChildren();
  const w = 100 / WHITE.length;
  const keyFor = {};
  const key = (semi, cls, left, width) => {
    const k = document.createElement('button');
    k.type = 'button'; k.className = cls;
    k.style.left = left + '%'; k.style.width = width + '%';
    const letter = Object.keys(PIANO_KEYS).find(x => PIANO_KEYS[x] === semi);
    if (cls === 'w') k.innerHTML = `<span>${letter ? letter.toUpperCase() : ''}</span>`;
    k.setAttribute('aria-label', NOTE_NAMES[(piano.base + semi) % 12]);
    k.addEventListener('pointerdown', ev => { ev.preventDefault(); pressPiano(semi); });
    el.appendChild(k); keyFor[semi] = k;
  };
  WHITE.forEach((semi, i) => key(semi, 'w', i * w, w));
  BLACK.forEach(([semi, after]) => key(semi, 'b', (after + 1) * w - w * 0.3, w * 0.6));
  piano.keys = keyFor;
  $('pianoOct').textContent = `starting at ${NOTE_NAMES[piano.base % 12]}${Math.floor(piano.base / 12) - 1}`;
}
function pressPiano(semi) {
  playInstrument('piano', piano.base + semi);
  const k = piano.keys && piano.keys[semi];
  if (k) { k.classList.add('on'); setTimeout(() => k.classList.remove('on'), 160); }
}
function openPiano() {
  const bench = world.seats.find(x => x.id === 'music-piano');
  if (bench && !(player.seat && player.seat.id === bench.id) && !seatTaken(bench)) goSit(bench);
  buildPiano();
  openPanel('pianoPanel');
}
$('pianoDown').onclick = () => { piano.base = Math.max(36, piano.base - 12); buildPiano(); };
$('pianoUp').onclick = () => { piano.base = Math.min(72, piano.base + 12); buildPiano(); };

// the guitar: eight chords to strum
function openGuitar() {
  const el = $('guitarChords');
  el.replaceChildren();
  CHORDS.forEach(([name], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost';
    b.innerHTML = `${name}<small>${i + 1}</small>`;
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); strumChord(i, ev.shiftKey); });
    el.appendChild(b);
  });
  openPanel('guitarPanel');
}
function strumChord(i, up) {
  playInstrument('guitar', i, up);
  const b = $('guitarChords').children[i];
  if (b) { b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 200); }
}
// while the piano or guitar is open, the keys play it (and don't walk you about)
window.addEventListener('keydown', e => {
  const pianoOpen = !$('pianoPanel').classList.contains('hidden'), guitarOpen = !$('guitarPanel').classList.contains('hidden');
  if ((!pianoOpen && !guitarOpen) || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') return;
  if (pianoOpen && k in PIANO_KEYS) { if (!e.repeat) pressPiano(PIANO_KEYS[k]); }
  else if (guitarOpen && /^[1-8]$/.test(k)) { if (!e.repeat) strumChord(Number(k) - 1, e.shiftKey); }
  else if (!/^[a-z;'0-9 ]$/.test(k) && !k.startsWith('arrow')) return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);

// the record player plays the café radio
function toggleRecords() {
  if (!radio.state.tracks.length) return toast('📻 No records yet — the café radio has no songs. The owner can add some from 🎧.');
  const on = !radio.state.listening;
  radio.listen(on);
  const t = radio.state.current;
  toast(on ? `🎶 You lower the needle — ${t ? `“${t.title || 'a song'}”` : 'the café radio'} is playing.` : '⏸ You lift the needle. The record slows to a stop.');
}

// ── the Prayer Room is quiet: the café's music and murmur fade, the radio
// pauses (and comes back on when you leave), and there's no chat and no notes
const quietRoom = { on: false, radioWas: false, timesAt: 0 };
function setQuietRoom(on) {
  if (on === quietRoom.on) return;
  quietRoom.on = on;
  sound.setQuiet(on);
  if (on) {
    stopPlacing();
    quietRoom.radioWas = !!radio.state.listening;
    if (quietRoom.radioWas) radio.listen(false);
    refreshPrayerTimes();
  } else if (quietRoom.radioWas) { quietRoom.radioWas = false; radio.listen(true); }
  $('chatInput').disabled = on;
  $('chatForm').querySelector('button').disabled = on;
  $('chatInput').placeholder = on ? 'A quiet room — no chat in here 🤍' : 'Say something softly…';
}
function refreshPrayerTimes() {
  quietRoom.timesAt = Date.now();
  quietRoom.day = cairoPrayerDay();
  world.prayer.setTimes(quietRoom.day);
}
function showPrayerTimes() {
  const day = quietRoom.day || cairoPrayerDay();
  const next = day.list.find(p => p.key === day.next);
  toast(`🕌 Today in Cairo: ${day.list.map(p => `${p.en} ${p.clock}`).join(' · ')}. Next: ${next.en} at ${next.clock}.`);
}
// the street's honks and hooves, from wherever they happen (cairo.js)
world.setStreetSound((kind, pos) => { if (!quietRoom.on) sound.street(kind, pos); });
// the call to prayer: at each prayer time the minarets light up and someone says so
const adhan = { last: null };
function checkAdhan() {
  if (!state.started) return;
  const day = cairoPrayerDay(), now = Date.now();
  const due = day.list.filter(p => p.key !== 'sunrise' && p.at.getTime() <= now && now - p.at.getTime() < 90e3);
  const p = due[due.length - 1];
  if (!p || adhan.last === p.key + p.clock) return;
  adhan.last = p.key + p.clock;
  world.adhan();
  sysChat(`🕌 The call to prayer for ${p.en} rises from the minarets behind the back street, and for a moment the street goes quiet.`);
}

// the spotlight, the turntable, and the prayer times board keeping up
let wasOnStage = false;
setInterval(() => {
  if (state.room === 'music') {
    world.music.setSpinning(!!radio.state.playing);
    const me = onStage(player.seat && player.seat.id);
    world.music.setStage(me || [...state.people.values()].some(p => onStage(p.state.seat)));
    if (me && !wasOnStage) sysChat('🎤 You take the stage. The spotlight comes up — say something, or play.');
    wasOnStage = me;
  } else wasOnStage = false;
  if (state.room === 'prayer' && Date.now() - quietRoom.timesAt > 60e3) refreshPrayerTimes();
  if (Date.now() - (adhan.checked || 0) > 15e3) { adhan.checked = Date.now(); checkAdhan(); }
}, 500);

// ── the Common room TV: the café's playlist (site_content 'common.tv'), on for everyone
function commonTV(autoplay) {
  const tv = state.content['common.tv'] || {};
  world.common.setTV(tv);
  if (state.room !== 'common') return;
  if (!(tv.list || tv.videoId)) { if (!autoplay) openCommonTV(); return; }
  setMovie({ ...tv, by: null, startedAt: Date.now() }, Date.now()); // (a single video starts from the top for each of us)
}
function openCommonTV() {
  const tv = state.content['common.tv'] || {};
  const admin = !!(state.me && state.me.isAdmin);
  $('ctvNow').textContent = tv.list || tv.videoId ? `${tv.list ? '📼 Playlist' : '🎞️ Video'}: “${tv.title}”` : 'Nothing on just yet — the café will put something on soon.';
  $('ctvWatch').classList.toggle('hidden', !(tv.list || tv.videoId));
  $('ctvOwner').classList.toggle('hidden', !admin);
  if (admin) $('ctvUrl').value = tv.url || '';
  $('ctvErr').textContent = '';
  openPanel('ctvPanel');
}
$('ctvWatch').onclick = () => { closePanels(); commonTV(false); };
$('ctvSave').onclick = async () => {
  $('ctvErr').textContent = '';
  try {
    const r = await api('/admin/common/tv', { method: 'PUT', body: { url: $('ctvUrl').value } });
    state.content['common.tv'] = r.tv;
    closePanels();
    commonTV(false);
    toast(r.tv.title ? `📺 “${r.tv.title}” is on in the Common room — for everyone.` : '📺 The Common room TV is off.');
  } catch (e) { $('ctvErr').textContent = e.message; }
};
$('movieWatch').onclick = () => { closePanels(); setMovie(movie); };

// ── presents
const giftOf = id => (state.home && state.home.gifts || []).find(g => g.id === id);
// somewhere clear for it in your room: the main room first, near the door
function clearSpot(kind) {
  const tries = [];
  for (const a of [AREAS.room, AREAS.library, AREAS.kitchen, AREAS.bath]) {
    for (let z = a.maxZ - 1.2; z > a.minZ + 0.4; z -= 0.4) for (let x = a.minX + 0.6; x < a.maxX - 0.4; x += 0.4) tries.push({ x, z, d: Math.hypot(x - 1.5, z - 3.6) + (a === AREAS.room ? 0 : 20) });
  }
  tries.sort((p, q) => p.d - q.d);
  for (const ry of [0, Math.PI / 2]) for (const p of tries) {
    const x = Math.round(p.x * 20) / 20, z = Math.round(p.z * 20) / 20;
    if (world.home.canPlace(kind, x, z, ry)) return { x, z, ry };
  }
  return null;
}
async function openGift(id) {
  const g = giftOf(id);
  if (!g) return;
  if (!state.home.canEdit) return toast(`🎁 A present for ${g.toName}, from ${g.fromName}. No peeking!`);
  let body = {};
  if (g.itemKind) {
    const spot = clearSpot(g.itemKind);
    if (!spot) return toast("🎁 There's no room for it — make a little space first.");
    body = spot;
  } else if (player.drink) return toast("🎁 It's a drink! Put down the one you're holding first.");
  try {
    const r = await api(`/home/gifts/${id}/open`, { method: 'POST', body });
    sound.cue('heart');
    state.home.gifts = r.gifts;
    world.home.setGifts(r.gifts, true);
    const what = r.item ? (BY_KIND.get(r.item.kind) || {}).name : r.gift.drink.name;
    if (r.item) world.home.update(r.item);
    if (r.gift.drink) {
      player.drink = r.gift.drink.id;
      player.sips = 0;
      player.av.setDrink(r.gift.drink.color, 1, drinkTemp(r.gift.drink.id));
      sendMove(true);
      refreshActions();
    }
    $('giftOpenWhat').textContent = `${r.gift.fromName} sent you ${/^[aeiou]/i.test(what) ? 'an' : 'a'} ${what.toLowerCase()}!`;
    $('giftOpenNote').textContent = r.gift.note ? `“${r.gift.note}”` : '';
    $('giftOpenWhere').textContent = r.item ? "It's in your room now — open Decorate to move it wherever you like." : 'Enjoy it while it\'s warm ☕';
    openPanel('giftOpenPanel');
    sysChat(`🎁 You opened a present from ${r.gift.fromName}.`);
  } catch (e) { toast(e.message); }
}
// sending one: furniture from the catalogue, or a drink from the menu
const gift = { what: 'item', kind: null, color: null, drink: null, cat: 'cosy' };
function openGiftSend(to = '') {
  if (to) $('giftTo').value = to;
  $('giftErr').textContent = '';
  renderGiftPicker();
  openPanel('giftPanel');
}
function renderGiftPicker() {
  document.querySelectorAll('#giftWhat .chip').forEach(b => b.classList.toggle('on', b.dataset.what === gift.what));
  const grid = $('giftGrid');
  if (gift.what === 'item') {
    $('giftCats').classList.remove('hidden');
    $('giftCats').replaceChildren(...CATS.filter(([k]) => k !== 'frames').map(([k, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (k === gift.cat ? ' on' : ''); b.textContent = label;
      b.onclick = () => { gift.cat = k; renderGiftPicker(); };
      return b;
    }));
    grid.replaceChildren(...FURNITURE.filter(f => f.cat === gift.cat && !f.wall).map(f => {
      const card = document.createElement('div'); card.className = 'item' + (gift.kind === f.kind ? ' on' : '');
      const name = document.createElement('b'); name.textContent = f.name;
      const sw = document.createElement('div'); sw.className = 'sw-row';
      for (const c of f.colors) {
        const s = document.createElement('button'); s.type = 'button'; s.style.background = c; s.className = gift.kind === f.kind && gift.color === c ? 'on' : '';
        s.onclick = ev => { ev.stopPropagation(); gift.kind = f.kind; gift.color = c; renderGiftPicker(); };
        sw.appendChild(s);
      }
      card.onclick = () => { gift.kind = f.kind; gift.color = gift.color && f.colors.includes(gift.color) ? gift.color : f.colors[0]; renderGiftPicker(); };
      card.append(name, sw);
      return card;
    }));
  } else {
    $('giftCats').classList.add('hidden');
    grid.replaceChildren(...menu().map(d => {
      const card = document.createElement('div'); card.className = 'item' + (gift.drink && gift.drink.id === d.id ? ' on' : '');
      const name = document.createElement('b'); name.textContent = d.name;
      const dot = document.createElement('div'); dot.className = 'sw-row';
      const s = document.createElement('button'); s.type = 'button'; s.style.background = d.color; s.tabIndex = -1; dot.appendChild(s);
      card.onclick = () => { gift.drink = { id: d.id, name: d.name, color: d.color }; renderGiftPicker(); };
      card.append(name, dot);
      return card;
    }));
  }
  const chosen = gift.what === 'item' ? (gift.kind && BY_KIND.get(gift.kind).name) : gift.drink && gift.drink.name;
  $('giftChosen').textContent = chosen ? `🎁 ${chosen}` : 'Pick something above';
}
document.querySelectorAll('#giftWhat .chip').forEach(b => { b.onclick = () => { gift.what = b.dataset.what; renderGiftPicker(); }; });
$('giftForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('giftErr').textContent = '';
  const body = { to: $('giftTo').value, note: $('giftNote').value };
  if (gift.what === 'item') { if (!gift.kind) return ($('giftErr').textContent = 'Pick something to send.'); body.item = { kind: gift.kind, color: gift.color }; }
  else { if (!gift.drink) return ($('giftErr').textContent = 'Pick a drink to send.'); body.drink = gift.drink; }
  try {
    const r = await api('/home/gifts', { method: 'POST', body });
    $('giftNote').value = '';
    closePanels();
    sound.cue('pin');
    toast(`🎁 Wrapped and sent! It's waiting by ${r.to}'s door.`);
  } catch (err) { $('giftErr').textContent = err.message; }
});
$('roomGift').onclick = () => openGiftSend();
$('homeGift').onclick = () => openGiftSend();

// ── the kitchen and the bathroom
// Walk up to something, then do it (stopping a step short of it).
async function walkToThing(hit, then) {
  const c = new THREE.Vector3();
  hit.object.getWorldPosition(c);
  const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z);
  if (d > 1.2) {
    if (player.seat) standUp();
    const k = (d - 0.9) / d;
    walkTo(new THREE.Vector3(player.pos.x + (c.x - player.pos.x) * k, world.floorY, player.pos.z + (c.z - player.pos.z) * k));
    const t0 = performance.now();
    while ((player.target || (player.path && player.path.length)) && performance.now() - t0 < 30000) await wait(120);
  }
  player.ry = Math.atan2(c.x - player.pos.x, c.z - player.pos.z);
  then();
}
function makeAtHome(d) {
  closePanels();
  bubble(player.av.group, '☕', 'emote');
  sound.espresso(player.pos, !/tea|juice|lemonade|smoothie|slush|float/i.test(d.name), true);
  setTimeout(() => {
    player.drink = d.id;
    player.sips = 0;
    player.av.setDrink(d.color, 1, tempOf(d));
    sound.cue('drink');
    sendMove(true);
    refreshActions();
    toast(`☕ You make yourself a ${d.name}. ${d.recipe && d.recipe.me3temed ? '“' + d.recipe.me3temed + '”' : 'Just how you like it.'}`);
  }, 1600);
}
async function takeBath(seat) {
  if (!seat) return;
  goSit(seat);
  const t0 = performance.now();
  while (player.seat !== seat && (player.goingToSeat === seat || player.target) && performance.now() - t0 < 60000) await wait(150);
  if (player.seat !== seat) return;
  bubble(player.av.group, '🫧', 'emote');
  send({ t: 'emote', e: '✨' });
  toast('🛁 You sink into a warm bath. Everything can wait. (Stand up when you\'re ready.)');
}
async function haveShower(itemId) {
  const e = world.home.items.get(itemId);
  if (!e) return;
  if (player.seat) standUp();
  walkTo(new THREE.Vector3(e.item.x, world.floorY, e.item.z));
  const t0 = performance.now();
  while ((player.target || (player.path && player.path.length)) && performance.now() - t0 < 30000) await wait(120);
  if (Math.hypot(player.pos.x - e.item.x, player.pos.z - e.item.z) > 0.9) return toast('Walk a little closer to the shower.');
  bubble(player.av.group, '🚿', 'emote');
  send({ t: 'emote', e: '✨' });
  await wait(2500);
  toast('🚿 Warm water, steam on the glass. You feel like a new person.');
}

$('decorAct').onclick = () => (decor.pick ? stopDecorPlacing() : openDecor());
$('roomAct').onclick = () => openRoomPanel();
$('studyAct').onclick = () => openStudy();

// ───────────────────────────────────────── the loop

const clock = new THREE.Clock();
let introAngle = 0;
// If the café is struggling (lots of people, a small laptop), make the picture
// a little gentler by itself — once per step, and never after you chose one.
const perf = { t: 0, frames: 0, slow: 0 };
function watchSpeed(realDt) {
  if (!state.started || state.qualityChosen || state.quality === 'gentle' || document.hidden) return;
  perf.t += realDt; perf.frames++;
  if (perf.t < 3) return;
  const fps = perf.frames / perf.t;
  perf.t = 0; perf.frames = 0;
  perf.slow = fps < 30 ? perf.slow + 1 : 0;
  if (perf.slow < 2) return;
  perf.slow = 0;
  applyQuality(state.quality === 'high' ? 'balanced' : 'gentle');
  toast('🌸 The picture is a little gentler now, so the café stays smooth. (You can change it in 🔊.)');
}

// The background regulars (regulars.js), and the room's sound following
// where you are and how busy it is.
const counterBox = new THREE.Box3().setFromObject(world.counter);
const counterSpot = () => ({ x: (counterBox.min.x + counterBox.max.x) / 2, y: 1.1, z: counterBox.max.z - 0.4 });
// Games at the tables (games.js): chess and tawla, with each other or with Yuto.
const games = createGames({
  world, send, $, toast, sound, openPanel,
  me: () => state.me,
  seatTable: () => (player.seat && player.seat.table && !/^bar-/.test(player.seat.table) ? player.seat.table : null),
  bubble: (obj, text, kind) => bubble(obj, text, kind),
  isOpen: () => !$('gamePanel').classList.contains('hidden'),
});
// The welcome tour (tour.js): once, on your first visit.
const tour = createTour({
  world, stairs: STAIRS, player, $, sound,
  bubble: (obj, text, kind) => bubble(obj, text, kind),
  onOrder: () => openMenu(),
  onDone: () => {
    if (state.me && !(state.me.prefs || {}).toured) {
      api('/me', { method: 'PATCH', body: { prefs: { toured: true } } }).then(r => { state.me = r.user; }).catch(() => {});
    }
  },
});
$('tourAgain').onclick = () => { closePanels(); if (!tour.start()) toast('The tour starts on the ground floor — come downstairs first.'); };
const regulars = createRegulars({
  world, staff, sound, menu, pastries,
  takenBy: seatHeld,
  say: (obj, text) => bubble(obj, text),
  callOut: (name, drink) => { const hana = world.npcs.find(n => n.id === 'hana'); if (hana && world.floor === 'main') bubble(hana.av.group, `${drink} for ${name}! 🌸`, 'npc'); },
  hour: cairoHour,
});
let roomTick = 0;
function listenRoom(dt) {
  roomTick -= dt;
  if (roomTick > 0) return;
  roomTick = 0.5;
  // fewer regulars when the café is full of real people
  regulars.setCap(9 - Math.floor(state.people.size * 0.8));
  sound.setCrowd((regulars.count() + state.people.size + 1) / 11);
  // the rain is louder by the glass: the front windows and the left ones
  const p = player.pos;
  const front = Math.abs(p.z - ROOM.maxZ) + Math.max(0, Math.min(Math.abs(p.x - mapX(-6)), Math.abs(p.x - mapX(6))) - 2);
  const left = Math.abs(p.x - ROOM.minX) + Math.max(0, Math.min(Math.abs(p.z + mapZ(-3.5)), Math.abs(p.z + mapZ(2.5)), Math.abs(p.z - mapZ(-3.5)), Math.abs(p.z - mapZ(2.5))) - 1.5);
  const d = world.floor === 'main' ? Math.min(front, left) : 6;
  sound.setNearWindow(1 - Math.min(1, d / 6));
}

function frame() {
  const realDt = clock.getDelta();
  watchSpeed(Math.min(realDt, 1));
  const dt = Math.min(0.05, realDt);
  const t = clock.elapsedTime;
  world.update(dt, t);
  if (state.started) {
    updatePlayer(dt);
    updatePeople(dt);
    staff.update(dt);
    regulars.update(dt);
    if (world.floor === 'main') world.updateDoors(dt, [player.pos, ...[...state.people.values()].map(p => p.pos), ...staff.positions(), ...regulars.positions()]);
    if (world.floor === 'home') {
      world.home.updatePet(dt, t, { typist: typist() });
      // stepping out onto the balcony: the camera swings round to look back at you from over the street
      const out = world.home.onBalcony(player.pos);
      if (out !== state.onBalcony) {
        state.onBalcony = out;
        if (out) { cam.yaw = Math.PI; cam.pitch = 0.22; cam.dist = cam.targetDist = 2.8; }
        else { cam.yaw = 0; cam.pitch = 0.42; cam.dist = cam.targetDist = 2.6; }
      }
    } else state.onBalcony = false;
    listenRoom(dt);
    updateCamera(dt);
    updateHover();
    updateBubbles();
  } else {
    // a slow drift around the room behind the sign-in card
    introAngle += dt * 0.05;
    camera.position.set(Math.sin(introAngle) * 9, 2.6, Math.cos(introAngle) * 6.3 + 1.4);
    camera.lookAt(0, 1.3, -2.8);
  }
  if (preview) preview.frame(dt);
  if (post.on) post.composer.render(dt);
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('debug')) window.__cafe = { games, tour, invite, takePhoto, openShare, player, cam, state, world, camera, staff, goToRoom, openCommonTV, openPiano, openGuitar, goSit, openKoshari, toggleBalconyDoor, radio, post, openShelf, openBook, openPhoto, regulars, sound, openEvents, openSpecials, calendar, refreshBoards, refreshEvents };

// ───────────────────────────────────────── start

// ───────────────────────────────────────── sharing: invites and photos

function inviteLink(withTable = true) {
  const u = new URL('/cafe', location.origin);
  if (state.me && state.me.username) u.searchParams.set('invite', state.me.username);
  const t = player.seat && player.seat.table;
  if (withTable && t && world.floor === 'main') u.searchParams.set('table', t);
  return u.toString();
}
function openShare() {
  const seated = player.seat && player.seat.table && world.floor === 'main';
  $('shareTable').classList.toggle('hidden', !seated);
  $('shareTable').textContent = seated ? `🪑 Include my seat — they'll sit down at ${player.seat.label}` : '';
  $('shareWithTable').checked = !!seated;
  $('shareLink').value = inviteLink(!!seated);
  $('snapWrap').classList.add('hidden');
  openPanel('sharePanel');
}
const shareText = () => `Come and sit with me at Sakura Slice Café 🌸 — a cozy little café in Cairo you can visit from anywhere.`;
$('shareWithTable').onchange = () => { $('shareLink').value = inviteLink($('shareWithTable').checked); };
$('shareBtn').onclick = openShare;
$('shareNative').onclick = async () => {
  const url = $('shareLink').value;
  if (navigator.share) { try { await navigator.share({ title: 'Sakura Slice Café', text: shareText(), url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copyLink();
};
async function copyLink() {
  const url = $('shareLink').value;
  try { await navigator.clipboard.writeText(url); toast('🔗 Link copied — send it to a friend.'); }
  catch (e) { $('shareLink').select(); document.execCommand && document.execCommand('copy'); toast('🔗 Link selected — copy it and send it to a friend.'); }
}
$('shareCopy').onclick = copyLink;
$('shareWhatsapp').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText() + ' ' + $('shareLink').value)}`, '_blank', 'noopener');

// A photo of the café as it is right now, with a little caption, to keep or share.
let snapBlob = null;
function takePhoto() {
  if (post.on) post.composer.render(0); else renderer.render(scene, camera);
  const src = renderer.domElement;
  const scale = Math.min(1, 1600 / src.width);
  const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h + Math.round(h * 0.11);
  const x = c.getContext('2d');
  x.fillStyle = '#fffaf2'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(src, 0, 0, w, h);
  const band = c.height - h, k = band / 100;
  x.fillStyle = '#6b4c4c'; x.textBaseline = 'middle';
  x.font = `700 ${Math.round(46 * k)}px "Dancing Script", cursive`;
  x.fillText('Sakura Slice Café', 28 * k, h + band / 2);
  x.font = `600 ${Math.round(24 * k)}px Nunito, sans-serif`;
  x.textAlign = 'right'; x.fillStyle = '#d4678a';
  x.fillText(`${cairoDay().replace(' in Cairo', '')} · ${cairoClock()} in Cairo 🌸`, w - 28 * k, h + band / 2);
  $('snapImg').src = c.toDataURL('image/jpeg', 0.9);
  c.toBlob(b => { snapBlob = b; }, 'image/jpeg', 0.9);
  $('snapWrap').classList.remove('hidden');
  sound.cue('pin');
}
$('snapBtn').onclick = takePhoto;
$('snapShare').onclick = async () => {
  if (!snapBlob) return;
  const file = new File([snapBlob], 'sakura-slice-cafe.jpg', { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sakura Slice Café', text: shareText() + ' ' + inviteLink(false) }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  snapSave();
};
function snapSave() {
  if (!snapBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(snapBlob);
  a.download = `sakura-slice-cafe-${Date.now()}.jpg`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$('snapSave').onclick = snapSave;

(async function boot() {
  if (invite.from) {
    api('/invite/' + invite.from).then(r => {
      invite.name = r.displayName;
      for (const id of ['inviteNote', 'inviteNote2']) {
        const el = $(id);
        if (el) { el.textContent = `🌸 ${r.displayName} saved you a seat${invite.table ? ' at their table' : ''} — come in and sit with them.`; el.classList.remove('hidden'); }
      }
    }).catch(() => {});
  }
  try { state.content = await api('/content'); } catch (e) { state.content = {}; }
  state.booted = true;
  applyContent();
  updateTime();
  await loadNotes();
  let me = null;
  try { me = (await api('/auth/me')).user; } catch (e) { /* offline */ }
  $('veil').classList.add('gone');
  if (me) {
    state.me = me;
    if (!me.avatar || !me.avatar.body) openCreator(true);
    else showWelcome(true);
  } else {
    $('door').classList.remove('hidden');
  }
  // notes refresh quietly now and then, in case a message was missed
  setInterval(() => { if (!document.hidden) loadNotes(); }, 30000);
})();

// everything above ran: the café started (cafe.html shows a card if this never happens)
window.__cafeReady = true;
