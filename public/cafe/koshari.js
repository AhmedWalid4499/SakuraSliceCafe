// Koshari Abu Saied: the koshari shop across the road from the café, right
// opposite the front door. Its whole front is open to the street (the
// shutter rolled up), so you see it lit from the café and the café from it.
// Inside: green-and-white tiles, a steel counter of big pots — rice and
// lentils, macaroni, the tomato sauce, the garlic-vinegar dakka — the
// koshari man and his spoon, marble tables with dakka and shatta bottles,
// ceiling fans, strip lights, and the menu board.
//
// It all lives in the street (world.js's buildCairo hands us the scene), so
// it's there from outside too; the floor we're given only holds the lists
// for walking, sitting and clicking while you're inside.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, m) => shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m));
const box = (w, h, d, m) => shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
const cyl = (rt, rb, h, m, seg = 20) => shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m));
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const rot = (o, axis, v) => { o.rotation[axis] = v; return o; }; // (add() hands back the parent, so turn the child first)
function tex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// the shop's footprint (world coordinates): its open front on the far pavement
export const KOSHARI = { minX: -4.5, maxX: 4.5, minZ: 24.15, maxZ: 30.6, h: 3.4, width: 9, height: 13 };
const K = KOSHARI;

export function buildKoshari({ scene, floor, makeSign, buildAvatar, nightMats }) {
  const g = new THREE.Group();
  scene.add(g);
  const colliders = [], seats = [], interactables = [], surfaces = [];
  const animated = [];
  const cx = (K.minX + K.maxX) / 2, cz = (K.minZ + K.maxZ) / 2, W = K.maxX - K.minX, D = K.maxZ - K.minZ;
  const plaster = std('#e6cfa6', { roughness: 0.95 });

  // ── the building above: four floors of flats, shutters, a balcony or two
  {
    const up = K.height - K.h;
    g.add(at(box(W + 0.3, up, D + 0.4, plaster), cx, K.h + up / 2, cz + 0.2));
    g.add(at(box(W + 0.5, 0.2, 0.4, std('#efe3cc')), cx, K.h + 0.1, K.minZ));
    const winM = std('#4b4038', { roughness: 0.4, emissive: '#ffd08f', emissiveIntensity: 0 });
    nightMats.push({ mat: winM, max: 0.9 });
    const shutter = std('#4f6f5a', { roughness: 0.8 });
    for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) {
      const x = K.minX + 1.1 + c * 2.25, y = K.h + 1.2 + f * 2.3;
      g.add(rot(at(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.25), winM), x, y, K.minZ - 0.01), 'y', Math.PI));
      for (const s of [-1, 1]) g.add(at(box(0.4, 1.3, 0.04, shutter), x + s * 0.64, y, K.minZ - 0.03));
      if ((f + c) % 3 === 0) g.add(at(box(0.75, 0.5, 0.3, std('#f1efe9')), x + 0.8, y - 0.6, K.minZ - 0.17)); // the AC
    }
    g.add(at(box(W + 0.3, 0.5, 0.15, plaster), cx, K.height + 0.25, K.minZ));
  }

  // ── the sign over the shop, lit up at night
  {
    const sign = makeSign([
      { text: 'كشري أبو سعيد', font: 'serif', size: 170, weight: '700', color: '#ffe7a0' },
      { text: 'Koshari Abu Saied', font: 'Playfair Display, serif', size: 80, weight: '700', color: '#fdf3e6' },
    ], 5.6, 1.0, { bg: '#7a1f1f', border: '#e8b44a', radius: 24 });
    sign.material.emissive = new THREE.Color('#ffffff'); sign.material.emissiveMap = sign.material.map; sign.material.emissiveIntensity = 0;
    nightMats.push({ mat: sign.material, max: 0.75 });
    sign.position.set(cx, K.h - 0.45 + 0.75, K.minZ - 0.12); sign.rotation.y = Math.PI;
    g.add(sign);
    // the shutter, rolled up, and the pillars either side of the open front
    g.add(rot(at(cyl(0.22, 0.22, W, std('#9a9890', { metalness: 0.5, roughness: 0.4 })), cx, K.h - 0.05, K.minZ - 0.05), 'z', Math.PI / 2));
    for (const s of [-1, 1]) g.add(at(box(0.4, K.h, 0.5, plaster), cx + s * (W / 2 - 0.05), K.h / 2, K.minZ + 0.1));
  }

  // ── inside: the floor, tiled walls, the ceiling
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, D), std('#ffffff', {
    roughness: 0.6,
    map: tex(256, 256, (c, w, h) => {
      c.fillStyle = '#d9d1c4'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) { c.fillStyle = ['#8a7a6a', '#f4ece0', '#b8a890', '#5a4a40'][i % 4]; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); }
      c.strokeStyle = 'rgba(0,0,0,0.12)'; c.strokeRect(0, 0, w, h);
    }, [(W - 0.4) / 1, D / 1]),
  }));
  floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set(cx, 0.01, cz);
  floorMesh.receiveShadow = true;
  floorMesh.userData.floor = true;
  g.add(floorMesh);
  const tileM = std('#ffffff', {
    roughness: 0.3,
    map: tex(128, 128, (c, w) => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#2f7a55' : '#f4f1ea'; c.fillRect(i * 32, j * 32, 32, 32); }
      c.strokeStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, w); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); }
    }, [W / 1.2, 1.4 / 1.2]),
  });
  const cream = std('#f1e6cf', { roughness: 0.95 });
  for (const [w, x, z, ry] of [[W - 0.4, cx, K.maxZ, Math.PI], [D, K.minX + 0.2, cz, Math.PI / 2], [D, K.maxX - 0.2, cz, -Math.PI / 2]]) {
    const top = at(new THREE.Mesh(new THREE.PlaneGeometry(w, K.h - 1.4), cream), x, 1.4 + (K.h - 1.4) / 2, z); top.rotation.y = ry; g.add(top);
    const low = at(new THREE.Mesh(new THREE.PlaneGeometry(w, 1.4), tileM), x, 0.7, z); low.rotation.y = ry; g.add(low);
    top.userData.surface = 'wall'; surfaces.push(top);
  }
  const ceil = at(new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, D), std('#f6efe3', { roughness: 1 })), cx, K.h - 0.01, cz);
  ceil.rotation.x = Math.PI / 2; g.add(ceil);
  // strip lights and two ceiling fans
  const tubeM = std('#ffffff', { emissive: '#eef6ff', emissiveIntensity: 1.2 });
  for (const x of [-2.2, 2.2]) for (const z of [25.6, 28.2]) g.add(at(box(1.2, 0.05, 0.08, tubeM), x, K.h - 0.05, z));
  for (const [x, z] of [[-2, 26.7], [2.2, 26.7]]) {
    const l = new THREE.PointLight('#f4f8ff', 3.2, 9, 1.4); l.position.set(x, K.h - 0.4, z); g.add(l);
  }
  for (const [x, z] of [[-2.2, 26.9], [2.2, 26.9]]) {
    const fan = new THREE.Group();
    fan.add(at(cyl(0.012, 0.012, 0.4, std('#3a3a3a'), 6), 0, 0.2, 0));
    fan.add(at(cyl(0.1, 0.1, 0.1, std('#e9e4dc'), 14), 0, 0, 0));
    const blades = new THREE.Group();
    for (let k = 0; k < 3; k++) { const b = at(box(0.7, 0.01, 0.14, std('#a07a50')), 0.4, 0, 0); const arm = new THREE.Group(); arm.rotation.y = k * 2.094; arm.add(b); blades.add(arm); }
    fan.add(blades);
    fan.position.set(x, K.h - 0.45, z);
    g.add(fan);
    animated.push(dt => { blades.rotation.y += dt * 7; });
  }

  // ── the counter: steel, with the big pots, the bowls, and the koshari man behind it
  const steel = std('#c8ccd2', { metalness: 0.75, roughness: 0.25 });
  const counterZ = 29.6;
  {
    g.add(at(rbox(6.4, 1.0, 0.8, 0.03, std('#2f7a55', { roughness: 0.5 })), cx, 0.5, counterZ));
    g.add(at(box(6.5, 0.05, 0.85, steel), cx, 1.02, counterZ));
    const pots = [['#a07a4a', 'rice and lentils'], ['#efd69a', 'macaroni'], ['#b8341f', 'the sauce'], ['#d9c27a', 'dakka'], ['#e3c27a', 'chickpeas']];
    pots.forEach(([c], i) => {
      const x = -2.6 + i * 1.3;
      g.add(at(cyl(0.34, 0.3, 0.55, steel, 24), x, 1.32, counterZ + 0.05));
      const top = at(cyl(0.31, 0.31, 0.02, std(c, { roughness: 0.9 }), 24), x, 1.56, counterZ + 0.05);
      g.add(top);
      if (i === 1) for (let k = 0; k < 18; k++) g.add(rot(at(cyl(0.012, 0.012, 0.05, std('#efd69a'), 6), x - 0.2 + (k % 6) * 0.08, 1.58, counterZ - 0.12 + Math.floor(k / 6) * 0.12), 'x', Math.PI / 2));
    });
    // the crispy onions on a tray, the stack of bowls
    g.add(at(box(0.7, 0.04, 0.4, steel), 2.9, 1.06, counterZ - 0.1));
    for (let k = 0; k < 30; k++) g.add(rot(at(box(0.04, 0.008, 0.02, std('#7a4318')), 2.65 + Math.random() * 0.5, 1.09, counterZ - 0.25 + Math.random() * 0.3), 'y', k));
    for (let k = 0; k < 7; k++) g.add(at(cyl(0.12, 0.08, 0.06, steel, 18), -3.0, 1.08 + k * 0.035, counterZ - 0.25));
    // the menu board
    const menu = makeSign([
      { text: 'كشري', font: 'serif', size: 200, weight: '700', color: '#7a1f1f' },
      { text: 'صغير · وسط · كبير', font: 'serif', size: 90, color: '#2f5d3a' },
      { text: 'small · medium · large', size: 66, color: '#4a3a3a' },
      { text: 'أرز بلبن · rice pudding', font: 'serif', size: 70, color: '#4a3a3a' },
      { text: 'دقة وشطة على كل ترابيزة', font: 'serif', size: 66, color: '#b8341f' },
    ], 3.0, 1.3, { bg: '#fdf3e6', border: '#7a1f1f', radius: 20 });
    menu.position.set(cx, 2.55, K.maxZ - 0.03); menu.rotation.y = Math.PI;
    g.add(menu);
    colliders.push({ type: 'box', fixed: true, minX: -3.3, maxX: 3.3, minZ: counterZ - 0.45, maxZ: K.maxZ });
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.8, 1.0), new THREE.MeshBasicMaterial({ visible: false })), cx, 0.9, counterZ);
    hit.userData = { kind: 'koshari-order', label: 'The counter — order a bowl of koshari' };
    g.add(hit); interactables.push(hit);
  }
  const cook = buildAvatar({ body: 'person', skin: '#9a6a46', hair: '#2a1d1a', hairStyle: 'short', outfit: '#f4f1ea', accent: '#7a1f1f', accessory: 'none' });
  cook.group.position.set(0.4, 0, counterZ + 0.65); cook.group.rotation.y = Math.PI;
  g.add(cook.group);
  animated.push(dt => cook.update(dt, {}));

  // ── marble tables, chairs round them, dakka and shatta on every one
  const marble = std('#f1eee8', { roughness: 0.25 });
  const chairM = std('#7a5236', { roughness: 0.7 });
  [[-2.2, 25.7], [2.2, 25.7], [-2.2, 27.8], [2.2, 27.8]].forEach(([x, z], n) => {
    const top = at(rbox(1.2, 0.05, 0.75, 0.02, marble), x, 0.75, z);
    g.add(top);
    top.userData.surface = 'table'; top.userData.tableId = `koshari-t${n + 1}`; surfaces.push(top);
    for (const s of [-1, 1]) g.add(at(box(0.05, 0.73, 0.05, steel), x + s * 0.5, 0.365, z));
    g.add(at(box(1.0, 0.04, 0.05, steel), x, 0.2, z));
    colliders.push({ type: 'box', fixed: true, minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.38, maxZ: z + 0.38 });
    g.add(at(cyl(0.035, 0.035, 0.16, std('#e8d25a', { transparent: true, opacity: 0.8, roughness: 0.1 }), 10), x - 0.35, 0.86, z)); // dakka
    g.add(at(cyl(0.035, 0.035, 0.16, std('#c8352f', { roughness: 0.3 }), 10), x - 0.25, 0.86, z + 0.05)); // shatta
    for (const [dx, dz, ry] of [[-0.3, -0.62, 0], [0.3, -0.62, 0], [-0.3, 0.62, Math.PI], [0.3, 0.62, Math.PI]]) {
      const c = new THREE.Group();
      c.add(at(box(0.4, 0.04, 0.4, chairM), 0, 0.44, 0));
      c.add(at(box(0.4, 0.42, 0.04, chairM), 0, 0.67, -0.19));
      for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(at(box(0.03, 0.44, 0.03, steel), a * 0.17, 0.22, b * 0.17));
      c.position.set(x + dx, 0, z + dz); c.rotation.y = ry;
      g.add(c);
      const seat = { id: `koshari-t${n + 1}-${seats.filter(q => q.table === `koshari-t${n + 1}`).length}`, label: 'a chair at a marble table', x: x + dx, z: z + dz, y: 0, h: 0.46, ry, table: `koshari-t${n + 1}` };
      seats.push(seat);
      c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: 'Sit down for some koshari' }; interactables.push(o); } });
    }
  });

  // the way out (the open front) and, from the café, the way in
  const out = at(new THREE.Mesh(new THREE.PlaneGeometry(W - 0.8, K.h - 0.3), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })), cx, K.h / 2, K.minZ + 0.05);
  out.userData = { kind: 'koshari-out', label: 'Back across the road to the café' };
  g.add(out); interactables.push(out);
  const goIn = at(new THREE.Mesh(new THREE.PlaneGeometry(W - 0.8, K.h + 1.4), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })), cx, (K.h + 1.4) / 2, K.minZ - 0.3);
  goIn.userData = { kind: 'koshari-go', label: 'Koshari Abu Saied, across the road — go over for a bowl' };
  g.add(goIn);

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: K.minX + 0.55, maxX: K.maxX - 0.55, minZ: K.minZ + 0.25, maxZ: counterZ - 0.5 }] }, ...colliders);
  floor.seats.push(...seats);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.floorMesh = floorMesh;

  return {
    bounds: { minX: K.minX + 0.2, maxX: K.maxX - 0.2, minZ: K.minZ - 1.5, maxZ: K.maxZ - 0.2 },
    arrival: { x: 0, z: K.minZ + 0.9, ry: 0 },  // just in from the street, facing the counter
    cook, goIn, counterAt: new THREE.Vector3(0.4, 1.2, counterZ + 0.2),
    update(dt, t) { animated.forEach(f => f(dt, t)); },
  };
}
