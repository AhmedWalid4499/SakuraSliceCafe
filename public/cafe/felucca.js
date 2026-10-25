// The café's felucca, on the Nile at the end of the street. It ties up at the
// landing stage on the corniche, and every few minutes the ra'is pushes off
// for a sail: out into the river, down past Gezira and Cairo Tower, round,
// and home again. Everyone keeps the same timetable (it's worked out from the
// clock), so wherever you are, the boat is in the same place on the river.
//
// Step aboard (the sign by the café's front door) and you're on the deck:
// cushions along both sides, a low table with tea, lanterns on a string, the
// big lateen sail. While it moves, it carries you — and everyone else on
// board — with it: app.js asks move() each frame how far it went, and moves
// you along too.
//
// Like koshari.js it lives in the world (scene); the floor we're given only
// holds the lists for walking, sitting and clicking while you're aboard, and
// those lists follow the boat.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { NILE } from './nile.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const rbox = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m);
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

const WATER_Y = -0.95;         // where the hull sits
const DECK = 0.6;              // the deck, above that
export const FELUCCA = { deckY: WATER_Y + DECK, h: 8 };
// the timetable: tied up at the landing, then a sail round and back
const DOCKED = 50, SAILING = 190, CYCLE = DOCKED + SAILING;
const L = 4.4, B = 1.15;       // half the deck's length and breadth (local x along the boat)

export function buildFelucca({ scene, floor, makeSign, buildAvatar }) {
  const g = new THREE.Group();
  scene.add(g);
  const local = { seats: [], colliders: [] }; // in the boat's own frame; turned into world ones each frame
  const interactables = [];
  const wood = std('#8a5a3c', { roughness: 0.6 }), hullM = std('#2f6b8a', { roughness: 0.5 });

  // ── the boat: hull, deck, gunwale, the mast and the great lateen sail
  g.add(at(rbox(L * 2 + 1.0, 0.9, B * 2 + 0.7, 0.35, hullM), 0, 0.2, 0));
  g.add(at(box(L * 2 + 0.6, 0.06, B * 2 + 0.4, std('#c9a27e', { roughness: 0.7 })), 0, DECK - 0.03, 0));
  const deckMesh = at(new THREE.Mesh(new THREE.PlaneGeometry(L * 2 + 0.4, B * 2 + 0.3), std('#c9a27e', { roughness: 0.7 })), 0, DECK + 0.002, 0);
  deckMesh.rotation.x = -Math.PI / 2; deckMesh.userData.floor = true; g.add(deckMesh);
  for (const s of [-1, 1]) g.add(at(box(L * 2 + 0.6, 0.2, 0.08, std('#e8c98e', { roughness: 0.6 })), 0, DECK + 0.1, s * (B + 0.25)));
  g.add(at(rbox(1.2, 0.5, 1.0, 0.2, hullM), L + 0.7, 0.5, 0)); // the bow, curving up
  g.add(at(cyl(0.08, 0.1, 7, wood, 10), 1.4, DECK + 3.5, 0));
  local.colliders.push({ type: 'circle', x: 1.4, z: 0, r: 0.14 });
  const sailM = std('#f6f2ea', { roughness: 0.9, side: THREE.DoubleSide });
  const sh = new THREE.Shape(); sh.moveTo(-3.6, 0); sh.lineTo(3.4, 0); sh.lineTo(2.6, 8.4); sh.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), sailM);
  sail.position.set(1.0, DECK + 1.2, 0.08); sail.rotation.z = 0.14; g.add(sail);
  const yard = at(cyl(0.035, 0.035, 9, wood, 6), 2.2, DECK + 5.3, 0.1); yard.rotation.z = -0.95; g.add(yard);
  // the cushions along each side, facing in
  const CUSH = ['#c8352f', '#e8b44a', '#3f7a55', '#3f6a8a', '#f4f1ea'];
  for (const s of [-1, 1]) {
    g.add(at(rbox(L * 1.6, 0.22, 0.5, 0.08, std('#7a1f2c', { roughness: 1 })), -0.4, DECK + 0.11, s * (B - 0.05)));
    for (let i = 0; i < 5; i++) {
      const x = -3.4 + i * 1.5;
      g.add(at(rbox(0.45, 0.4, 0.14, 0.06, std(CUSH[(i + (s > 0 ? 2 : 0)) % 5], { roughness: 1 })), x, DECK + 0.42, s * (B + 0.12)));
      local.seats.push({ id: `felucca-${s < 0 ? 'p' : 's'}${i}`, label: 'a cushion on the felucca', x, z: s * (B - 0.1), h: 0.26, ry: s < 0 ? 0 : Math.PI });
    }
  }
  // a low table of tea glasses in the middle, a string of lanterns from mast to stern
  g.add(at(rbox(1.4, 0.06, 0.55, 0.02, wood), -1.4, DECK + 0.32, 0));
  for (const s of [-1, 1]) g.add(at(box(0.06, 0.3, 0.45, wood), -1.4 + s * 0.6, DECK + 0.15, 0));
  for (let i = 0; i < 5; i++) g.add(at(cyl(0.025, 0.02, 0.07, std('#7a2e12', { transparent: true, opacity: 0.8, roughness: 0.1 }), 8), -1.9 + i * 0.25, DECK + 0.39, (i % 2) * 0.1 - 0.05));
  local.colliders.push({ type: 'box', minX: -2.15, maxX: -0.65, minZ: -0.32, maxZ: 0.32 });
  const lampM = ['#ff4a8a', '#ffd23f', '#3fd0ff', '#7dff6a'].map(c => std(c, { emissive: c, emissiveIntensity: 1.2 }));
  for (let i = 0; i < 12; i++) { const t = i / 11; g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lampM[i % 4]), 1.4 - t * 5.6, DECK + 4.6 - t * 3.0 - Math.sin(t * Math.PI) * 0.4, 0)); }
  // the ra'is at the tiller, at the stern
  g.add(at(box(0.08, 0.08, 1.2, wood), -L - 0.2, DECK + 0.6, 0));
  let rais = null;
  if (buildAvatar) {
    rais = buildAvatar({ body: 'person', skin: '#7d5236', hair: '#1f1612', hairStyle: 'short', outfit: '#e9e2d0', accent: '#3f6a8a', accessory: 'scarf' });
    rais.group.position.set(-L + 0.1, DECK, 0.4); rais.group.rotation.y = Math.PI / 2;
    g.add(rais.group);
  }
  local.colliders.push({ type: 'circle', x: -L + 0.1, z: 0.4, r: 0.3 });
  const name = makeSign([{ text: 'فلوكة سكورا', font: 'serif', size: 120, weight: '700', color: '#fdf3e6' }, { text: 'the Sakura felucca', size: 70, color: '#fdf3e6' }], 1.4, 0.4, { bg: '#2f6b8a', border: '#e8b44a' });
  name.position.set(L + 0.3, 0.45, B + 0.36); g.add(name);
  const leave = at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })), -L + 1.4, DECK + 0.8, -B - 0.2);
  leave.userData = { kind: 'felucca-out', label: 'Step off — back to the café' };
  g.add(leave); interactables.push(leave);
  const hail = at(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.0), new THREE.MeshBasicMaterial({ visible: false })), -L + 0.1, DECK + 0.8, 0.4);
  hail.userData = { kind: 'felucca-rais', label: 'The ra’is — the boatman' };
  g.add(hail); interactables.push(hail);

  // ── the landing stage on the corniche
  const DOCK = { x: NILE.river.x0 + B + 0.7, z: 18 };
  {
    const jetty = at(box(2.2, 0.2, 6, std('#8a6a4a', { roughness: 0.8 })), NILE.river.x0 + 0.2, -0.2, DOCK.z);
    scene.add(jetty);
    for (let i = 0; i < 4; i++) scene.add(at(cyl(0.1, 0.1, 1.6, std('#5a3a26')), NILE.river.x0 + 1.1, -0.6, DOCK.z - 2.6 + i * 1.75));
  }

  // ── the route: out from the landing, down past the tower, round and home
  const route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(DOCK.x, 0, DOCK.z),
    new THREE.Vector3(DOCK.x + 0.6, 0, 26),
    new THREE.Vector3(72, 0, 36),
    new THREE.Vector3(80, 0, 48),
    new THREE.Vector3(81, 0, 62),
    new THREE.Vector3(76, 0, 70),
    new THREE.Vector3(70, 0, 60),
    new THREE.Vector3(69, 0, 38),
    new THREE.Vector3(67, 0, 16),
    new THREE.Vector3(DOCK.x + 0.3, 0, 8),
  ], true, 'centripetal');
  const ease = t => t * t * (3 - 2 * t);
  // where the boat is (and which way it faces) at a moment: { x, z, yaw, sailing, left }
  function pose(ms) {
    const c = ((ms / 1000) % CYCLE + CYCLE) % CYCLE;
    const sailing = c >= DOCKED;
    const u = sailing ? ease((c - DOCKED) / SAILING) : 0;
    const p = route.getPointAt(u), tan = route.getTangentAt(u);
    // tied up, she lies along the corniche, bow to the south
    const yaw = Math.atan2(-tan.z, tan.x); // (tied up, u is 0: she lies along the corniche, bow to the south)
    return { x: p.x, z: p.z, yaw, sailing, left: sailing ? CYCLE - c : DOCKED - c };
  }

  // the lists for when you're aboard: walking, sitting, clicking — in world terms
  const walk = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  const worldSeats = local.seats.map(s => ({ ...s, y: FELUCCA.deckY, fy: 0 }));
  const worldCols = local.colliders.map(c => ({ ...c, fixed: true }));
  floor.colliders.push({ type: 'room', fixed: true, walk: [walk] }, ...worldCols);
  floor.seats.push(...worldSeats);
  floor.interactables.push(...interactables, deckMesh);
  floor.surfaces.push();
  floor.floorMesh = deckMesh;

  let cur = pose(Date.now());
  const toWorld = (lx, lz, P = cur) => ({ x: P.x + Math.cos(P.yaw) * lx + Math.sin(P.yaw) * lz, z: P.z - Math.sin(P.yaw) * lx + Math.cos(P.yaw) * lz });
  function place() {
    g.position.set(cur.x, WATER_Y, cur.z);
    g.rotation.y = cur.yaw;
    // the deck you can walk on: the box round it as it lies now (a little in from the sides)
    const corners = [[-L + 0.5, -B + 0.35], [L - 0.2, -B + 0.35], [L - 0.2, B - 0.35], [-L + 0.5, B - 0.35]].map(([a, b]) => toWorld(a, b));
    walk.minX = Math.min(...corners.map(c => c.x)); walk.maxX = Math.max(...corners.map(c => c.x));
    walk.minZ = Math.min(...corners.map(c => c.z)); walk.maxZ = Math.max(...corners.map(c => c.z));
    local.seats.forEach((s, i) => { const w = toWorld(s.x, s.z); worldSeats[i].x = w.x; worldSeats[i].z = w.z; worldSeats[i].ry = s.ry + cur.yaw; });
    local.colliders.forEach((c, i) => {
      const o = worldCols[i];
      if (c.type === 'circle') { const w = toWorld(c.x, c.z); o.x = w.x; o.z = w.z; }
      else { const cs = [[c.minX, c.minZ], [c.maxX, c.minZ], [c.maxX, c.maxZ], [c.minX, c.maxZ]].map(([a, b]) => toWorld(a, b)); o.minX = Math.min(...cs.map(q => q.x)); o.maxX = Math.max(...cs.map(q => q.x)); o.minZ = Math.min(...cs.map(q => q.z)); o.maxZ = Math.max(...cs.map(q => q.z)); }
    });
  }
  place();

  return {
    group: g,
    // how the boat moved since last asked: apply(v) moves a point that was on board along with it
    move(ms = Date.now()) {
      const prev = cur;
      cur = pose(ms);
      place();
      const dyaw = cur.yaw - prev.yaw;
      const c = Math.cos(dyaw), s = Math.sin(dyaw);
      return {
        dyaw,
        apply(v) { // into the old frame, out of the new one
          const dx = v.x - prev.x, dz = v.z - prev.z;
          v.x = cur.x + c * dx + s * dz; v.z = cur.z - s * dx + c * dz;
          return v;
        },
      };
    },
    status: () => ({ sailing: cur.sailing, left: cur.left }),
    get bounds() { return { minX: cur.x - 9, maxX: cur.x + 9, minZ: cur.z - 9, maxZ: cur.z + 9, h: FELUCCA.h }; },
    arrival() { const w = toWorld(-1.4, -0.6); return { x: w.x, z: w.z, ry: cur.yaw + Math.PI }; },
    update(dt) {
      sail.rotation.y = Math.sin(performance.now() / 2400) * 0.05;
      if (rais) rais.update(dt, {});
    },
  };
}
