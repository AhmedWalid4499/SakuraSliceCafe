// Sakura Slice Café — the 3D café.
// Accounts, walking, sitting, notes, ordering, chat and live presence.
// Everything people leave behind is saved in Postgres through /api.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, ROOM, STAIRS } from './world.js';
import { buildAvatar, makeLabel, makeCup, disposeTree } from './avatar.js';
import { makeNote, makeGhost, NOTE_COLORS } from './notes.js';
import { Soundscape } from './audio.js';

const $ = id => document.getElementById(id);

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
  resize();
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
const scene = world.scene;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
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
function updateTime() {
  const h = cairoHour();
  const { night } = world.setTimeOfDay(h);
  sound.setNight(night > 0.5);
  $('cairoTime').textContent = 'Cairo ' + cairoClock();
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
  placed: null,       // { drink, x, y, z } — the drink this person set down
  placedMesh: null,
  waving: 0,
};

function playerAvatar() {
  if (player.av) { scene.remove(player.av.group); disposeTree(player.av.group); }
  player.av = buildAvatar(state.me.avatar);
  player.label = makeLabel(state.me.displayName, { bg: 'rgba(212,103,138,0.92)', color: '#fff' });
  player.label.position.y = player.av.height + 0.12;
  player.label.visible = false; // you know who you are; others see your name
  player.av.group.add(player.label);
  scene.add(player.av.group);
  if (player.drink) player.av.setDrink(drinkColor(player.drink));
}

// third-person camera
const cam = { yaw: Math.PI, pitch: 0.32, dist: 4.2, targetDist: 4.2 };
const camTarget = new THREE.Vector3();
const keys = new Set();

function collide(p, r = 0.3) {
  for (const c of world.colliders) {
    if (c.type === 'room') {
      p.x = Math.min(c.maxX, Math.max(c.minX, p.x));
      p.z = Math.min(c.maxZ, Math.max(c.minZ, p.z));
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
  player.seat = null;
  // step out to the side of the chair, not into the table
  player.pos.set(s.x + Math.cos(s.ry) * 0.62, 0, s.z - Math.sin(s.ry) * 0.62);
  collide(player.pos);
  sendMove(true);
  refreshActions();
}

function sitAt(seat) {
  player.goingToSeat = null;
  player.target = null;
  player.seat = seat;
  player.pos.set(seat.x, seat.y, seat.z);
  player.ry = seat.ry;
  sound.cue('sit');
  sendMove(true);
  refreshActions();
  toast(`You sit down at ${seat.label}. Walk, or press Stand up, to get up.`);
}

// ── sitting ────────────────────────────────────────────────

function seatTaken(seat) {
  return [...state.people.values()].some(p => p.state.seat === seat.id);
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
  player.target = new THREE.Vector3(seat.x, 0, seat.z);
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

function drinkMesh(placed, mine, who) {
  const g = makeCup(drinkColor(placed.drink));
  g.position.set(placed.x, placed.y + 0.056, placed.z);
  g.rotation.y = Math.random() * Math.PI;
  const label = mine ? 'Your drink — click to pick it up' : `${who}'s drink`;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData = { kind: 'cup', mine, label }; } });
  scene.add(g);
  return g;
}

function setPlaced(placed) {
  if (player.placedMesh) { scene.remove(player.placedMesh); disposeTree(player.placedMesh); player.placedMesh = null; }
  player.placed = placed;
  if (placed) player.placedMesh = drinkMesh(placed, true);
}

function putDrinkDown(at = null) {
  if (!player.drink) return toast('You aren\'t holding a drink — order one at the counter ☕');
  const spot = at || spotOnTable(player.pos);
  if (!spot) return toast('Walk up to a table (or sit down) to put your drink down.');
  setPlaced({ drink: player.drink, ...spot });
  player.drink = null;
  player.av.setDrink(null);
  sound.cue('drink');
  sendMove(true);
  refreshActions();
}

function pickUpDrink() {
  if (!player.placed) return;
  const far = Math.hypot(player.placed.x - player.pos.x, player.placed.z - player.pos.z) > 2.6;
  if (far) return toast('Walk back to your table to pick up your drink.');
  player.drink = player.placed.drink;
  player.av.setDrink(drinkColor(player.drink));
  setPlaced(null);
  sound.cue('sit');
  sendMove(true);
  refreshActions();
}

function refreshActions() {
  const sitBtn = $('sitAct');
  sitBtn.querySelector('.t').textContent = player.seat ? 'Stand up' : 'Sit';
  sitBtn.classList.toggle('on', !!player.seat);
  const drinkBtn = $('drinkAct');
  const show = !!player.drink || !!player.placed;
  drinkBtn.classList.toggle('hidden', !show);
  if (show) drinkBtn.querySelector('.t').textContent = player.drink ? 'Put drink down' : 'Pick up drink';
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
    const stopAt = player.goingToSeat ? 1.0 : 0.05; // chairs tuck under tables, so close enough is enough
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
        }
      } else player.stuck = 0;
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
  player.av.update(dt, { moving, sitting: !!player.seat, waving: player.waving });
  if (moving) sendMove();
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const camPos = new THREE.Vector3();
function updateCamera(dt) {
  cam.dist += (cam.targetDist - cam.dist) * Math.min(1, dt * 6);
  const focus = player.av ? player.pos.clone().add(new THREE.Vector3(0, player.seat ? 1.15 : 1.45, 0)) : new THREE.Vector3(0, 1.5 + world.floorY, 0);
  camTarget.lerp(focus, Math.min(1, dt * 8));
  const cp = Math.cos(cam.pitch);
  camPos.set(
    camTarget.x + Math.sin(cam.yaw) * cp * cam.dist,
    camTarget.y + Math.sin(cam.pitch) * cam.dist,
    camTarget.z + Math.cos(cam.yaw) * cp * cam.dist,
  );
  // keep the camera inside the room, under the ceiling
  camPos.x = Math.min(ROOM.maxX - 0.25, Math.max(ROOM.minX + 0.25, camPos.x));
  camPos.z = Math.min(ROOM.maxZ - 0.25, Math.max(ROOM.minZ + 0.25, camPos.z));
  camPos.y = Math.min(world.floorY + world.floorH - 0.3, Math.max(world.floorY + 0.4, camPos.y));
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
  const av = buildAvatar(p.avatar);
  const label = makeLabel(p.displayName);
  label.position.y = av.height + 0.12;
  av.group.add(label);
  const s = p.state || {};
  av.group.position.set(s.x || 0, 0, s.z || 6.6);
  av.group.rotation.y = s.ry || 0;
  av.group.traverse(o => { if (o.isMesh) o.userData = { kind: 'person', person: p, label: p.displayName }; });
  scene.add(av.group);
  const person = { ...p, av, label, state: { ...s }, pos: av.group.position.clone(), ry: s.ry || 0, drinkShown: null };
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
  if (p.drinkShown !== (p.state.drink || null)) {
    p.drinkShown = p.state.drink || null;
    p.av.setDrink(p.drinkShown ? drinkColor(p.drinkShown) : null);
  }
  // the cup they set down on a table
  const pl = p.state.placed || null;
  const key = pl ? `${pl.drink}@${pl.x},${pl.y},${pl.z}` : null;
  if (p.placedKey === key) return;
  p.placedKey = key;
  if (p.placedMesh) { scene.remove(p.placedMesh); disposeTree(p.placedMesh); p.placedMesh = null; }
  if (pl) p.placedMesh = drinkMesh(pl, false, p.displayName);
}

function updatePeople(dt) {
  for (const p of state.people.values()) {
    const s = p.state;
    const seat = s.seat ? world.seats.find(x => x.id === s.seat) : null;
    const tx = seat ? seat.x : s.x, tz = seat ? seat.z : s.z;
    const k = Math.min(1, dt * 8);
    const before = p.pos.clone();
    p.pos.x += (tx - p.pos.x) * k;
    p.pos.z += (tz - p.pos.z) * k;
    p.pos.y = seat ? seat.y : world.floorY;
    p.ry = lerpAngle(p.ry, seat ? seat.ry : s.ry, k);
    const moving = before.distanceTo(p.pos) > dt * 0.4;
    p.av.group.position.copy(p.pos);
    p.av.group.rotation.y = p.ry;
    if (p.waving > 0) p.waving -= dt;
    p.av.update(dt, { moving, sitting: !!seat, waving: p.waving || 0 });
  }
}

function updateOnline() {
  const n = state.people.size + (state.me ? 1 : 0);
  const where = state.roomName ? ` · upstairs, ${state.roomName}` : '';
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
        if (p) bubble(p.av.group, m.msg.text);
        sound.cue('chat');
      }
      break;
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
    seat: player.seat ? player.seat.id : null, drink: player.drink, moving: player.moving,
    placed: player.placed ? {
      drink: player.placed.drink, x: +player.placed.x.toFixed(2), y: +player.placed.y.toFixed(3), z: +player.placed.z.toFixed(2),
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
const menu = () => (Array.isArray(state.content['cafe.menu']) && state.content['cafe.menu'].length ? state.content['cafe.menu'] : DEFAULT_MENU);
const drinkColor = id => (menu().find(d => d.id === id) || {}).color || '#d9b48f';

function openMenu() {
  const list = $('menuList');
  list.replaceChildren();
  for (const d of menu()) {
    const b = document.createElement('button');
    b.type = 'button';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = d.color;
    const txt = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = d.name;
    const by = document.createElement('small');
    by.textContent = `made by ${d.by}`;
    txt.append(name, by);
    b.append(dot, txt);
    b.onclick = () => order(d);
    list.appendChild(b);
  }
  openPanel('menuPanel');
  const hana = world.npcs.find(n => n.id === 'hana');
  if (hana) bubble(hana.av.group, 'What can I make you?', 'npc');
}

function order(d) {
  closePanels();
  const maker = world.npcs.find(n => n.name === d.by) || world.npcs.find(n => n.id === 'hana');
  if (maker) bubble(maker.av.group, `One ${d.name}, coming right up.`, 'npc');
  setTimeout(() => {
    player.drink = d.id;
    player.av.setDrink(d.color);
    sound.cue('drink');
    sendMove(true);
    refreshActions();
    toast(`☕ Your ${d.name} is here. ${d.by} made it.`);
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
    bubble(player.av.group, text);
  } catch (err) { toast(err.message); input.value = text; }
});

const bubbles = [];
function bubble(obj, text, kind = '') {
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
    b.el.style.left = ((v3.x + 1) / 2) * window.innerWidth + 'px';
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
  if (drag && drag.moved <= 6 && state.started) click(e.clientX, e.clientY);
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
    ? (player.drink ? 'Put your drink here' : 'Sit at this table')
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
    if (player.drink && near) return putDrinkDown({ x: h.point.x, y: d.top ?? h.point.y, z: h.point.z });
    // Otherwise, sit at the closest free chair around that table.
    const c = new THREE.Vector3();
    h.object.getWorldPosition(c);
    const seat = nearestFreeSeat(player.pos, { x: c.x, z: c.z, r: 1.3 });
    if (seat) return goSit(seat);
    if (player.drink) return toast('Walk a little closer to put your drink down.');
    return;
  }
  if (d.kind === 'order') return openMenu();
  if (d.kind === 'npc') return openTalk(d.npc.id);
  if (d.kind === 'stairs-up') return openUpstairs();
  if (d.kind === 'stairs-down') return goToRoom('main');
  if (d.kind === 'person') {
    bubble(player.av.group, '👋', 'emote');
    player.waving = 2;
    send({ t: 'emote', e: 'wave' });
    return;
  }
  if (d.kind === 'info') {
    $('infoTitle').textContent = d.label;
    $('infoText').textContent = d.text || '';
    return openPanel('infoPanel');
  }
  if (h.object.userData.floor) {
    if (player.seat) standUp();
    player.goingToSeat = null;
    player.target = new THREE.Vector3(h.point.x, 0, h.point.z);
  }
}

function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

// keys
window.addEventListener('keydown', e => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    if (state.placing) stopPlacing();
    closePanels();
    document.activeElement?.blur?.();
    return;
  }
  if (typing || !state.started) return;
  if (e.key === 'Enter') { e.preventDefault(); $('chat').classList.remove('hidden'); $('chatInput').focus(); return; }
  if (e.key === 'e' || e.key === 'E') { toggleSit(); return; }
  if (e.key === 'q' || e.key === 'Q') { if (player.drink) putDrinkDown(); else pickUpDrink(); return; }
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    keys.add(k);
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// ───────────────────────────────────────── panels & toasts

const PANELS = ['composePanel', 'readPanel', 'menuPanel', 'soundPanel', 'infoPanel', 'helpPanel', 'talkPanel', 'upPanel'];
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
    b.onclick = () => { applyQuality(id); buildMixer(); savePrefs(); };
    q.appendChild(b);
  }
}
$('soundBtn').onclick = () => { buildMixer(); openPanel('soundPanel'); };
$('muteBtn').onclick = () => {
  sound.setMuted(!sound.muted);
  $('soundBtn').textContent = sound.muted ? '🔇' : '🔊';
  buildMixer();
  savePrefs();
};
$('helpBtn').onclick = () => openPanel('helpPanel');

// ───────────────────────────────────────── actions

$('noteAct').onclick = () => (state.placing ? stopPlacing() : startPlacing());
$('orderAct').onclick = openMenu;
$('sitAct').onclick = toggleSit;
$('drinkAct').onclick = () => (player.drink ? putDrinkDown() : pickUpDrink());
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
$('chatAct').onclick = () => {
  const c = $('chat');
  c.classList.toggle('hidden');
  $('chatAct').classList.toggle('on', !c.classList.contains('hidden'));
};
$('outBtn').onclick = async () => {
  if (!confirm('Leave the café for now?')) return;
  await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  location.reload();
};

// ───────────────────────────────────────── content from the database

function applyContent(key) {
  const c = state.content;
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
  skin: {
    person: ['#f6dcc6', '#ecc3a0', '#e0b48c', '#c99a74', '#a8764f', '#7d5236', '#5a3a26'],
    fur: ['#b5562b', '#d98a4e', '#f6f2ee', '#c9b8a8', '#8a7a6a', '#4a3a32', '#9c8a6a', '#e6c79c'],
  },
  hair: ['#2a1d1a', '#3b2a22', '#6b4226', '#a0714f', '#d9b48f', '#c0392b', '#f2a7bb', '#7aab7a', '#e8e2da'],
  hairStyle: [['short', 'Short'], ['long', 'Long'], ['bob', 'Bob'], ['bun', 'Bun'], ['curly', 'Curly'], ['none', 'None']],
  outfit: ['#7aab7a', '#4d7a4d', '#f2a7bb', '#d4678a', '#efe0c4', '#6b8fb5', '#e8b44a', '#a0714f', '#3a3a4a', '#fef9f5'],
  accent: ['#fef9f5', '#fde8ef', '#f4ead8', '#d4678a', '#7aab7a', '#6b8fb5', '#e8b44a'],
  accessory: [['none', 'Nothing'], ['glasses', 'Glasses'], ['headphones', 'Headphones'], ['scarf', 'Scarf'], ['beanie', 'Beanie'], ['flower', 'A sakura flower']],
};

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
  const person = draft.body === 'person';
  $('skinLabel').textContent = person ? 'Skin' : 'Fur / feathers';
  swatches($('optSkin'), person ? OPTIONS.skin.person : OPTIONS.skin.fur, 'skin');
  $('hairGroup').classList.toggle('hidden', !person);
  chips($('optHairStyle'), OPTIONS.hairStyle, 'hairStyle');
  swatches($('optHair'), OPTIONS.hair, 'hair');
  swatches($('optOutfit'), OPTIONS.outfit, 'outfit');
  swatches($('optAccent'), OPTIONS.accent, 'accent');
  chips($('optAccessory'), OPTIONS.accessory, 'accessory');
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
      av = buildAvatar(draft);
      s.add(av.group);
    },
    frame(dt) {
      if ($('creator').classList.contains('hidden')) return;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.floor(w * r.getPixelRatio())) { r.setSize(w, h, false); cam2.aspect = w / h; cam2.updateProjectionMatrix(); }
      t += dt;
      const owl = draft.body === 'owl';
      cam2.position.set(0, owl ? 0.9 : 1.25, owl ? 3.0 : 4.2);
      cam2.lookAt(0, owl ? 0.6 : 0.95, 0);
      av.group.rotation.y = Math.sin(t * 0.6) * 0.6;
      av.update(dt, { waving: Math.sin(t * 0.4) > 0.85 ? 1 : 0 });
      r.render(s, cam2);
    },
  };
  preview.rebuild();
}

$('creatorCancel').onclick = () => $('creator').classList.add('hidden');
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
  sound.setNight(cairoHour() < 6 || cairoHour() >= 18.5);
  sound.setFirePosition(world.fire);
  if (prefs.quality) applyQuality(prefs.quality);

  playerAvatar();
  // walk in through the front door
  player.pos.set(0, 0, 5.6);
  player.ry = Math.PI;
  player.target = new THREE.Vector3(0, 0, 3.8);
  cam.yaw = 0; cam.pitch = 0.3; cam.dist = cam.targetDist = 3.6;

  $('hudTop').classList.remove('hidden');
  $('actions').classList.remove('hidden');
  $('chat').classList.remove('hidden');
  $('adminLink').classList.toggle('hidden', !state.me.isAdmin);
  state.started = true;
  canvas.focus();

  connect();
  loadNotes();
  try {
    const { messages } = await api('/chat?room=main');
    messages.forEach(addChat);
  } catch (e) { /* fine */ }
  sysChat('You came in. The door chimes softly behind you.');
  setTimeout(() => {
    const yuto = world.npcs.find(n => n.id === 'yuto');
    if (yuto) bubble(yuto.av.group, `Welcome in, ${state.me.displayName}. Take any seat you like.`, 'npc');
  }, 1600);
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

function recCard(rec) {
  const d = menu().find(x => x.id === rec.id) || rec;
  const card = document.createElement('div');
  card.className = 'rec';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = d.color || '#d9b48f';
  const txt = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = d.name;
  const why = document.createElement('small');
  why.textContent = rec.why || `made by ${d.by}`;
  txt.append(b, why);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = 'Order this ☕';
  btn.onclick = () => { order(d); btn.disabled = true; btn.textContent = 'Coming up…'; };
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
  if (!had) talkLine('them', npc.lines[0]);
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
    const holding = player.drink ? (menu().find(d => d.id === player.drink) || {}).name : '';
    const where = state.room !== 'main' ? `upstairs, in ${state.roomName}'s room` : player.seat ? `sitting at ${player.seat.label}` : 'standing in the café';
    const r = await api('/npc/' + id, { method: 'POST', body: { text, holding, where } });
    typing.remove();
    if (talkTo !== id) return;
    talkLine('them', r.reply);
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
    const { mine, open } = await api('/groups');
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
  stopPlacing();
  $('fade').classList.add('on');
  sound.cue('sit');
  await wait(480);

  player.seat = null;
  player.target = null;
  player.goingToSeat = null;
  setPlaced(null);
  const up = room !== 'main';
  state.room = room;
  state.roomName = up ? group.name : null;
  world.setFloor(up ? 'up' : 'main');
  if (up) world.setUpstairsSign(group.name, group.description || 'upstairs at Sakura Slice', group.color);

  // arrive at the top (or the foot) of the stairs, facing into the room
  player.pos.set(STAIRS.x - 0.3, world.floorY, STAIRS.z + 2.2);
  player.ry = 0;
  cam.yaw = Math.PI; cam.pitch = 0.3; cam.dist = cam.targetDist = 3.4;
  camTarget.copy(player.pos).add(new THREE.Vector3(0, 1.45, 0));

  for (const id of [...state.people.keys()]) removePerson(id);
  for (const id of [...state.notes.keys()]) removeNote(id);
  $('chatLog').replaceChildren();
  send({ t: 'room', room, state: {
    x: player.pos.x, z: player.pos.z, ry: player.ry, seat: null, drink: player.drink, placed: null, moving: false,
  } });
  $('floorAct').querySelector('.t').textContent = up ? 'Downstairs' : 'Upstairs';
  $('floorAct').firstElementChild.textContent = up ? '⬇️' : '🪜';
  refreshActions();
  await loadNotes();
  try {
    const { messages } = await api('/chat?room=' + encodeURIComponent(room));
    messages.forEach(addChat);
  } catch (e) { /* fine */ }
  sysChat(up ? `You climb the spiral stairs to ${group.name}'s room.` : 'You come back down into the café.');
  updateOnline();
  await wait(120);
  $('fade').classList.remove('on');
}

$('floorAct').onclick = () => (state.room === 'main' ? openUpstairs() : goToRoom('main'));

// ───────────────────────────────────────── the loop

const clock = new THREE.Clock();
let introAngle = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  world.update(dt, t);
  if (state.started) {
    updatePlayer(dt);
    updatePeople(dt);
    updateCamera(dt);
    updateHover();
    updateBubbles();
  } else {
    // a slow drift around the room behind the sign-in card
    introAngle += dt * 0.05;
    camera.position.set(Math.sin(introAngle) * 6.5, 2.4, Math.cos(introAngle) * 4.5 + 1);
    camera.lookAt(0, 1.3, -2);
  }
  if (preview) preview.frame(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('debug')) window.__cafe = { player, cam, state, world, camera };

// ───────────────────────────────────────── start

(async function boot() {
  try { state.content = await api('/content'); } catch (e) { state.content = {}; }
  applyContent();
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
