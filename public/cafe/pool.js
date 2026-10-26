// The rooftop pool: the top terrace, up the stairs from the third floor —
// open to the sky with all of Cairo below. A long pool of blue water (it
// glows at night), sun loungers with towels, palms in pots, umbrellas, a
// glass railing round the edge, and a pink ring floating on the water. Click
// the water to swim (you're in up to your shoulders and your arms go), lie on
// a lounger, or climb onto the ring and float (app.js).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex } from './roomkit.js';

export const POOL = { minX: -11, maxX: 11, minZ: -8, maxZ: 8, h: 12 };
const R = POOL;
const BASIN = { minX: -6, maxX: 6, minZ: -3.2, maxZ: 1.8, depth: 1.3 };
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

function waterTex() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#2f9ac4'; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(220,250,255,.55)'; g.lineWidth = 3;
    for (let i = 0; i < 26; i++) { g.beginPath(); const x = (i * 53) % w, y = (i * 97) % w; g.moveTo(x, y); g.bezierCurveTo(x + 20, y - 14, x + 40, y + 14, x + 64, y); g.stroke(); }
  }, [4, 2]);
}
function tileTex() {
  return canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#f1ece4'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#d9cfc0'; g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, w); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  }, [(R.maxX - R.minX) / 1.2, (R.maxZ - R.minZ) / 1.2]);
}

export function buildPool({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [], surfaces = [];
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const W = R.maxX - R.minX, D = R.maxZ - R.minZ;
  const bw = BASIN.maxX - BASIN.minX, bd = BASIN.maxZ - BASIN.minZ, bcx = (BASIN.minX + BASIN.maxX) / 2, bcz = (BASIN.minZ + BASIN.maxZ) / 2;

  // ── the deck: tiles all round the pool (a hole where the water is)
  {
    const sh = new THREE.Shape();
    sh.moveTo(R.minX, -R.maxZ); sh.lineTo(R.maxX, -R.maxZ); sh.lineTo(R.maxX, -R.minZ); sh.lineTo(R.minX, -R.minZ); sh.closePath();
    const hole = new THREE.Path(); // (the deck is turned flat, so its y is −z)
    hole.moveTo(BASIN.minX, -BASIN.maxZ); hole.lineTo(BASIN.maxX, -BASIN.maxZ); hole.lineTo(BASIN.maxX, -BASIN.minZ); hole.lineTo(BASIN.minX, -BASIN.minZ); hole.closePath();
    sh.holes.push(hole);
    const geo = new THREE.ShapeGeometry(sh);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - R.minX) / W, (pos.getY(i) + R.maxZ) / D);
    const deck = new THREE.Mesh(geo, std('#ffffff', { map: tileTex(), roughness: 0.6 }));
    deck.rotation.x = -Math.PI / 2; deck.receiveShadow = true; deck.userData.floor = true;
    group.add(deck); floor.floorMesh = deck;
    // under it, the building: a slab, so the terrace isn't floating
    group.add(at(box(W, 0.6, D, std('#e3d4c0', { roughness: 0.9 })), 0, -0.31, 0));
  }
  // ── the pool: tiled walls and floor, the water, the lights in it
  const waterMap = waterTex();
  const waterM = std('#ffffff', { map: waterMap, transparent: true, opacity: 0.82, roughness: 0.1, metalness: 0.1, emissive: '#3fb8e0', emissiveIntensity: 0.25 });
  {
    const tileM = std('#5fb8d8', { roughness: 0.4 });
    group.add(at(box(bw, 0.05, bd, tileM), bcx, -BASIN.depth, bcz));
    for (const [w, d, x, z] of [[bw, 0.05, bcx, BASIN.minZ], [bw, 0.05, bcx, BASIN.maxZ], [0.05, bd, BASIN.minX, bcz], [0.05, bd, BASIN.maxX, bcz]]) group.add(at(box(w, BASIN.depth, d, tileM), x, -BASIN.depth / 2, z));
    for (const [w, d, x, z] of [[bw + 0.4, 0.2, bcx, BASIN.minZ - 0.1], [bw + 0.4, 0.2, bcx, BASIN.maxZ + 0.1], [0.2, bd, BASIN.minX - 0.1, bcz], [0.2, bd, BASIN.maxX + 0.1, bcz]]) group.add(at(box(w, 0.06, d, std('#ffffff', { roughness: 0.4 })), x, 0.03, z)); // the coping
    const water = at(new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), waterM), bcx, -0.12, bcz);
    water.rotation.x = -Math.PI / 2; group.add(water);
    clickable(water, { kind: 'pool-swim', label: 'The pool — jump in and swim 🏊' });
    for (let i = 0; i < 5; i++) { const l = at(new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), new THREE.MeshBasicMaterial({ color: '#dff6ff' })), BASIN.minX + 1.2 + i * 2.4, -0.6, BASIN.maxZ - 0.03); l.rotation.y = Math.PI; group.add(l); }
    const glow = new THREE.PointLight('#7fd8ff', 2.0, 10, 1.4); glow.position.set(bcx, -0.6, bcz); group.add(glow);
    // the steps down in, at the east end, and a ladder at the west
    for (let i = 0; i < 4; i++) group.add(at(box(0.5, 0.05, 1.6, std('#ffffff', { roughness: 0.4 })), BASIN.maxX - 0.3 - i * 0.0, -0.25 - i * 0.28, bcz));
    for (const s of [-1, 1]) group.add(at(cyl(0.025, 0.025, 1.2, std('#c0c4c8', { metalness: 0.8, roughness: 0.2 }), 8), BASIN.minX + 0.15, 0.3, bcz + s * 0.25));
    // you can't walk on the water: the pool is a hole in the walkable deck
    colliders.push({ type: 'box', fixed: true, minX: BASIN.minX, maxX: BASIN.maxX, minZ: BASIN.minZ, maxZ: BASIN.maxZ });
  }
  // the places to be in the water: swimming (your legs and arms go), and the ring
  const swim = [];
  for (let i = 0; i < 8; i++) {
    // (each swimmer does lengths of a lane, ±0.9 m either side of their spot — avatar.js)
    const x = BASIN.minX + 1.8 + (i % 4) * 2.8, z = i < 4 ? BASIN.minZ + 1.0 : BASIN.maxZ - 1.0;
    const s = { id: `pool-swim-${i}`, label: 'the pool', x, z, y: fy - 1.05, h: 0, ry: i % 2 ? Math.PI / 2 : -Math.PI / 2, swim: true };
    seats.push(s); swim.push(s);
  }
  const ring = new THREE.Group();
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.16, 12, 28), std('#ff8ac0', { roughness: 0.4 })));
  ring.children[0].rotation.x = Math.PI / 2;
  ring.position.set(bcx + 1.4, -0.06, bcz - 0.4); group.add(ring);
  const ringSeat = { id: 'pool-ring', label: 'the pink ring', x: ring.position.x, z: ring.position.z, y: fy - 0.25, h: 0.12, ry: 0 };
  seats.push(ringSeat);
  clickable(ring, { kind: 'pool-ring', seat: ringSeat, label: 'The pink ring — float on it 🛟' });
  const duck = at(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), std('#ffd23f', { roughness: 0.4 })), bcx - 2.8, -0.06, bcz + 0.8); group.add(duck);

  // ── loungers with towels, umbrellas, palms in pots
  const TOWEL = ['#ff8ac0', '#3fb8e0', '#ffd23f', '#7dd8a0', '#ffffff', '#c98aff'];
  for (let i = 0; i < 6; i++) {
    const x = -6.6 + i * 2.6, z = 4.2;
    const g = new THREE.Group();
    g.add(at(rbox(0.7, 0.08, 1.9, 0.03, std('#f4f4f0', { roughness: 0.5 })), 0, 0.3, 0));
    const back = at(rbox(0.7, 0.08, 0.8, 0.03, std('#f4f4f0', { roughness: 0.5 })), 0, 0.55, -0.85); back.rotation.x = 0.7; g.add(back);
    for (const a of [-1, 1]) for (const b of [-1, 1]) g.add(at(box(0.04, 0.3, 0.04, std('#c0c4c8', { metalness: 0.6 })), a * 0.3, 0.15, b * 0.8));
    g.add(at(rbox(0.6, 0.02, 1.4, 0.01, std(TOWEL[i], { roughness: 1 })), 0, 0.35, 0.15));
    g.position.set(x, 0, z); g.rotation.y = Math.PI; group.add(g);
    block(x, z, 0.72, 1.9);
    const s = { id: `pool-lounger-${i}`, label: 'a sun lounger', x, z: z - 0.1, y: fy + 0.35, h: 0.2, ry: Math.PI, lie: true };
    seats.push(s);
    clickable(g, { kind: 'pool-lounge', seat: s, label: 'A sun lounger — lie back and soak up the sun ☀️' });
    if (i % 2 === 0) {
      const u = new THREE.Group();
      u.add(at(cyl(0.025, 0.025, 2.4, std('#8a6a4a'), 8), 0, 1.2, 0));
      u.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.45, 12, 1, true), std(i % 4 ? '#3fb8e0' : '#ff8ac0', { roughness: 0.8, side: THREE.DoubleSide })), 0, 2.35, 0));
      u.position.set(x + 1.3, 0, z + 0.4); group.add(u);
      colliders.push({ type: 'circle', fixed: true, x: x + 1.3, z: z + 0.4, r: 0.08 });
    }
  }
  const palm = (x, z) => {
    const p = new THREE.Group();
    p.add(at(cyl(0.4, 0.32, 0.6, std('#d8a07a'), 16), 0, 0.3, 0));
    p.add(at(cyl(0.08, 0.12, 2.6, std('#8a6a4a', { roughness: 0.9 }), 8), 0, 1.9, 0));
    for (let i = 0; i < 7; i++) { const l = at(new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.6, 4), std('#4f8a3a', { roughness: 0.9 })), Math.cos(i * 0.9) * 0.6, 3.1, Math.sin(i * 0.9) * 0.6); l.rotation.set(Math.sin(i * 0.9) * 1.2, 0, -Math.cos(i * 0.9) * 1.2); p.add(l); }
    p.position.set(x, 0, z); group.add(p);
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.42 });
  };
  for (const [x, z] of [[R.minX + 0.8, R.minZ + 0.8], [R.maxX - 0.8, R.minZ + 0.8], [R.minX + 0.8, R.maxZ - 0.8], [R.maxX - 0.8, R.maxZ - 0.8], [-8.5, -0.8], [8.5, -0.8]]) palm(x, z);

  // ── the glass railing round the edge, and the stair house you came up in
  const glass = std('#dff1ff', { transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  for (const [w, x, z, ry] of [[W, 0, R.minZ, 0], [W, 0, R.maxZ, 0], [D, R.minX, 0, Math.PI / 2], [D, R.maxX, 0, Math.PI / 2]]) {
    const g = at(new THREE.Mesh(new THREE.PlaneGeometry(w, 1.1), glass), x, 0.55, z); g.rotation.y = ry; group.add(g);
    const rail = at(box(w, 0.05, 0.08, std('#c0c4c8', { metalness: 0.8, roughness: 0.2 })), x, 1.12, z); rail.rotation.y = ry; group.add(rail);
  }
  {
    const x = 0, z = R.maxZ - 1.0;
    group.add(at(box(2.4, 2.6, 1.6, std('#e3d4c0', { roughness: 0.9 })), x, 1.3, z + 0.2));
    const door = at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.1), std('#2f8ab0', { roughness: 0.5 })), x, 1.05, z - 0.61);
    door.rotation.y = Math.PI; group.add(door);
    block(x, z + 0.2, 2.4, 1.6);
    const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), new THREE.MeshBasicMaterial({ visible: false })), x, 1.1, z - 0.66);
    hit.rotation.y = Math.PI; hit.userData = { kind: 'room-out', to: 'landing3', label: 'Down the stairs to the third floor' };
    group.add(hit); interactables.push(hit);
    const sign = makeSign([{ text: '⬇ The third floor', size: 96, weight: '700' }], 1.0, 0.24);
    sign.position.set(x, 2.35, z - 0.62); sign.rotation.y = Math.PI; group.add(sign);
  }
  const name = makeSign([{ text: 'The Rooftop Pool', size: 120, weight: '700', color: '#2f8ab0' }, { text: 'swim above the city 🌴', font: 'Dancing Script, cursive', size: 76, color: '#ff8ac0' }], 2.0, 0.5, { bg: '#ffffff', border: '#2f8ab0' });
  name.position.set(0, 1.9, R.minZ + 0.05); group.add(name);
  const lights = [new THREE.PointLight('#fff1d6', 1.4, 18, 1.2)];
  lights[0].position.set(0, 5, 2); group.add(lights[0]);

  animate?.((dt, t) => {
    waterMap.offset.x += dt * 0.03; waterMap.offset.y += dt * 0.015;
    ring.position.y = -0.06 + Math.sin(t * 1.2) * 0.03; ring.rotation.y += dt * 0.1;
    duck.position.x = bcx - 2.8 + Math.sin(t * 0.3) * 1.5;
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.4, maxX: R.maxX - 0.4, minZ: R.minZ + 0.4, maxZ: R.maxZ - 0.4 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R, swim,
    arrival: { x: 0, z: R.maxZ - 2.4, ry: Math.PI },
    setNight(k) { waterM.emissiveIntensity = 0.25 + k * 0.8; },
  };
}
