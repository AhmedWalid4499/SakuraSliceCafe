// Ahwet El-Sett: the old coffee house across the road, next to the koshari
// shop. Its front open to the street like every ahwa in Cairo; inside,
// black-and-white tiles, mirrors in gilt frames, ceiling fans, small round
// tables of hammered brass with tawla boards (sit and press 🎲 Games), the
// ahwagi behind his counter with the brass kettle and the tea glasses, and an
// old gramophone on the shelf playing records of Umm Kulthum — El-Sett, the
// Lady, whose picture hangs over the counter. No shisha here: just tea.
//
// Like koshari.js it lives in the street (world.js hands us the scene), so
// it's there from outside too; the floor we're given only holds the lists for
// walking, sitting and clicking while you're inside.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, m) => shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m));
const box = (w, h, d, m) => shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
const cyl = (rt, rb, h, m, seg = 20) => shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m));
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const rot = (o, axis, v) => { o.rotation[axis] = v; return o; };
function tex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// its footprint (world coordinates): next to the koshari shop, on the far pavement
export const AHWA = { minX: 6.0, maxX: 15.0, minZ: 24.15, maxZ: 30.6, h: 3.4, height: 11 };
const A = AHWA;

// El-Sett on the wall: drawn, not a photograph — the dark glasses, the scarf in her hand
function settTex() {
  return tex(320, 420, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d9c49a'); gr.addColorStop(1, '#a8885a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1e16';
    g.beginPath(); g.ellipse(w / 2, 150, 62, 78, 0, 0, Math.PI * 2); g.fill(); // the hair
    g.fillStyle = '#c99a76'; g.beginPath(); g.ellipse(w / 2, 165, 46, 58, 0, 0, Math.PI * 2); g.fill(); // the face
    g.fillStyle = '#111'; g.fillRect(w / 2 - 40, 148, 34, 18); g.fillRect(w / 2 + 6, 148, 34, 18); g.fillRect(w / 2 - 8, 154, 16, 4); // the glasses
    g.fillStyle = '#2a1e16'; g.beginPath(); g.moveTo(w / 2 - 90, h - 70); g.quadraticCurveTo(w / 2, 200, w / 2 + 90, h - 70); g.fill(); // shoulders
    g.fillStyle = '#f4ece0'; g.beginPath(); g.ellipse(w / 2 + 66, 300, 18, 26, 0.5, 0, Math.PI * 2); g.fill(); // the handkerchief
    g.fillStyle = '#3a2418'; g.textAlign = 'center';
    g.font = 'bold 40px serif'; g.fillText('كوكب الشرق', w / 2, h - 30);
    g.strokeStyle = '#6e4a2a'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  });
}

export function buildAhwa({ scene, floor, makeSign, buildAvatar, nightMats = [] }) {
  const g = new THREE.Group();
  scene.add(g);
  const colliders = [], seats = [], interactables = [], surfaces = [];
  const animated = [];
  const cx = (A.minX + A.maxX) / 2, cz = (A.minZ + A.maxZ) / 2, W = A.maxX - A.minX, D = A.maxZ - A.minZ;
  const plaster = std('#d9c39a', { roughness: 0.95 });
  const brass = std('#c9a25b', { metalness: 0.75, roughness: 0.3 });
  const wood = std('#5a3a26', { roughness: 0.6 });

  // ── the building above: old flats, wooden shutters, a balcony with laundry
  {
    const up = A.height - A.h;
    g.add(at(box(W + 0.3, up, D + 0.4, plaster), cx, A.h + up / 2, cz + 0.2));
    g.add(at(box(W + 0.5, 0.2, 0.4, std('#e8dcc4')), cx, A.h + 0.1, A.minZ));
    const winM = std('#4b4038', { roughness: 0.4, emissive: '#ffd08f', emissiveIntensity: 0 });
    nightMats.push({ mat: winM, max: 0.85 });
    const shutter = std('#7a5a3a', { roughness: 0.8 });
    for (let f = 0; f < 3; f++) for (let c = 0; c < 4; c++) {
      const x = A.minX + 1.2 + c * 2.2, y = A.h + 1.3 + f * 2.4;
      g.add(rot(at(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.3), winM), x, y, A.minZ - 0.01), 'y', Math.PI));
      for (const s of [-1, 1]) g.add(at(box(0.4, 1.35, 0.04, shutter), x + s * 0.64, y, A.minZ - 0.03));
    }
    g.add(at(box(3.2, 0.12, 0.8, plaster), A.minX + 2.3, A.h + 2.1, A.minZ - 0.4)); // a balcony
    for (let i = 0; i < 9; i++) g.add(at(box(0.03, 0.8, 0.03, std('#2a2a2a')), A.minX + 0.8 + i * 0.37, A.h + 2.55, A.minZ - 0.78));
    g.add(at(box(W + 0.3, 0.5, 0.15, plaster), cx, A.height + 0.25, A.minZ));
  }

  // ── the sign, an awning, the pillars of the open front
  {
    const sign = makeSign([
      { text: 'قهوة الست', font: 'serif', size: 170, weight: '700', color: '#ffe7a0' },
      { text: 'Ahwet El-Sett · since 1952', font: 'Playfair Display, serif', size: 74, weight: '700', color: '#fdf3e6' },
    ], 5.4, 1.0, { bg: '#1f4a3a', border: '#e8b44a', radius: 24 });
    sign.material.emissive = new THREE.Color('#ffffff'); sign.material.emissiveMap = sign.material.map; sign.material.emissiveIntensity = 0;
    nightMats.push({ mat: sign.material, max: 0.7 });
    sign.position.set(cx, A.h + 0.32, A.minZ - 0.12); sign.rotation.y = Math.PI;
    g.add(sign);
    const awning = tex(256, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#f4ece0' : '#2f6b4a'; c.fillRect(i * 16, 0, 16, h); } });
    const aw = at(new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, 1.3), std('#ffffff', { map: awning, side: THREE.DoubleSide, roughness: 0.9 })), cx, A.h - 0.55, A.minZ - 0.55);
    aw.rotation.x = -Math.PI / 2 + 0.45; g.add(aw);
    for (const s of [-1, 1]) g.add(at(box(0.4, A.h, 0.5, plaster), cx + s * (W / 2 - 0.05), A.h / 2, A.minZ + 0.1));
  }

  // ── inside: tiles, green walls with mirrors, the ceiling and its fans
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, D), std('#ffffff', {
    roughness: 0.5,
    map: tex(256, 256, (c, w) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#f1ece2' : '#1d1d1f'; c.fillRect(i * 32, j * 32, 32, 32); } }, [W / 1.2, D / 1.2]),
  }));
  floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set(cx, 0.01, cz); floorMesh.receiveShadow = true; floorMesh.userData.floor = true;
  g.add(floorMesh);
  const wallM = std('#3f7a6a', { roughness: 0.9 }), lowM = std('#e8dcc4', { roughness: 0.8 });
  for (const [w, x, z, ry] of [[W - 0.4, cx, A.maxZ, Math.PI], [D, A.minX + 0.2, cz, Math.PI / 2], [D, A.maxX - 0.2, cz, -Math.PI / 2]]) {
    const m = at(new THREE.Mesh(new THREE.PlaneGeometry(w, A.h), wallM), x, A.h / 2, z); m.rotation.y = ry; m.userData.surface = 'wall'; g.add(m); surfaces.push(m);
    const low = at(new THREE.Mesh(new THREE.PlaneGeometry(w, 1.0), lowM), x, 0.5, z); low.rotation.y = ry; low.translateZ(0.005); g.add(low);
  }
  const ceil = at(new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#efe3cc', { roughness: 1 })), cx, A.h, cz); ceil.rotation.x = Math.PI / 2; g.add(ceil);
  const fans = [];
  for (const fx of [cx - 2.2, cx + 2.2]) {
    g.add(at(cyl(0.01, 0.01, 0.5, std('#333'), 6), fx, A.h - 0.25, cz - 0.5));
    const fan = new THREE.Group();
    fan.add(at(cyl(0.09, 0.09, 0.1, brass, 14), 0, 0, 0));
    for (let i = 0; i < 4; i++) { const b = at(box(0.7, 0.01, 0.12, wood), Math.cos(i * Math.PI / 2) * 0.38, 0, Math.sin(i * Math.PI / 2) * 0.38); b.rotation.y = -i * Math.PI / 2; fan.add(b); }
    fan.position.set(fx, A.h - 0.55, cz - 0.5); g.add(fan); fans.push(fan);
  }
  // mirrors in gilt frames along the side walls
  const mirrorM = std('#bccdd2', { metalness: 0.9, roughness: 0.08 });
  for (const [x, ry] of [[A.minX + 0.22, Math.PI / 2], [A.maxX - 0.22, -Math.PI / 2]]) for (const z of [cz - 1.3, cz + 1.3]) {
    const f = new THREE.Group();
    f.add(at(box(1.2, 1.5, 0.05, brass), 0, 0, 0));
    f.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3), mirrorM), 0, 0, 0.03));
    f.position.set(x, 1.9, z); f.rotation.y = ry; g.add(f);
  }

  // ── the counter at the back: the ahwagi, the brass kettle, glasses on a tray, El-Sett over it all
  const counterZ = A.maxZ - 1.1;
  {
    g.add(at(rbox(4.0, 1.0, 0.6, 0.03, wood), cx, 0.5, counterZ));
    g.add(at(rbox(4.1, 0.05, 0.66, 0.02, std('#f1eee8', { roughness: 0.25 })), cx, 1.02, counterZ));
    g.add(at(cyl(0.16, 0.2, 0.3, brass, 18), cx - 1.2, 1.2, counterZ));
    g.add(at(cyl(0.04, 0.02, 0.22, brass, 8), cx - 1.0, 1.25, counterZ).rotateZ(-0.8));
    g.add(at(cyl(0.18, 0.18, 0.02, brass, 24), cx + 0.6, 1.06, counterZ));
    for (let i = 0; i < 7; i++) {
      g.add(at(cyl(0.025, 0.02, 0.08, std('#e8f2f4', { transparent: true, opacity: 0.5, roughness: 0.05 }), 10), cx + 0.5 + (i % 4) * 0.07 - 0.1, 1.11, counterZ - 0.06 + Math.floor(i / 4) * 0.1));
      g.add(at(cyl(0.022, 0.018, 0.05, std('#7a2e12', { roughness: 0.2 }), 10), cx + 0.5 + (i % 4) * 0.07 - 0.1, 1.095, counterZ - 0.06 + Math.floor(i / 4) * 0.1));
    }
    // the shelf of coffee tins and sugar behind, and El-Sett's picture above
    g.add(at(box(4.2, 0.05, 0.3, wood), cx, 1.8, A.maxZ - 0.17));
    for (let i = 0; i < 10; i++) g.add(at(cyl(0.07, 0.07, 0.2, std(['#c94a4a', '#e2b04a', '#2f6b4a', '#f4ece0'][i % 4], { roughness: 0.5, metalness: 0.3 }), 12), cx - 1.9 + i * 0.42, 1.93, A.maxZ - 0.17));
    const sett = at(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.18), std('#ffffff', { map: settTex(), roughness: 0.8 })), cx, 2.65, A.maxZ - 0.03);
    sett.rotation.y = Math.PI; g.add(sett);
    colliders.push({ type: 'box', fixed: true, minX: cx - 2.05, maxX: cx + 2.05, minZ: counterZ - 0.35, maxZ: A.maxZ });
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.8, 0.9), new THREE.MeshBasicMaterial({ visible: false })), cx, 0.9, counterZ);
    hit.userData = { kind: 'ahwa-order', label: 'The counter — tea, coffee, sahlab 🍵' };
    g.add(hit); interactables.push(hit);
  }
  const ahwagi = buildAvatar({ body: 'person', skin: '#8a5a3a', hair: '#3a2a20', hairStyle: 'short', outfit: '#f4ece0', accent: '#5a3a26', accessory: 'none' });
  ahwagi.group.position.set(cx - 0.4, 0, counterZ + 0.6); ahwagi.group.rotation.y = Math.PI;
  g.add(ahwagi.group);
  animated.push(dt => ahwagi.update(dt, {}));

  // ── the gramophone, on its own little table by the mirror
  let gramo;
  {
    const x = A.maxX - 0.8, z = counterZ - 0.6;
    gramo = new THREE.Group();
    gramo.add(at(cyl(0.3, 0.3, 0.04, wood, 20), 0, 0.72, 0));
    for (let k = 0; k < 3; k++) gramo.add(at(cyl(0.02, 0.02, 0.7, wood, 6), Math.cos(k * 2.1) * 0.22, 0.35, Math.sin(k * 2.1) * 0.22));
    gramo.add(at(rbox(0.36, 0.14, 0.36, 0.02, std('#6e472e', { roughness: 0.4 })), 0, 0.81, 0));
    const disc = at(cyl(0.15, 0.15, 0.008, std('#111', { roughness: 0.3 }), 24), 0, 0.885, 0); gramo.add(disc);
    const horn = at(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 24, 1, true), std('#c9a25b', { metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide })), 0.1, 1.15, 0.1);
    horn.rotation.set(-0.9, 0, -0.6); gramo.add(horn);
    gramo.position.set(x, 0, z); g.add(gramo);
    gramo.userData.disc = disc;
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.34 });
    gramo.traverse(o => { if (o.isMesh) { o.userData = { kind: 'ahwa-gramophone', label: 'The gramophone — Umm Kulthum, of course 🎶' }; interactables.push(o); } });
  }

  // ── round brass tables with tawla boards, wooden chairs round them
  const chairM = std('#6e472e', { roughness: 0.7 });
  [[cx - 2.6, A.minZ + 1.6], [cx, A.minZ + 1.6], [cx + 2.6, A.minZ + 1.6], [cx - 1.3, A.minZ + 3.6], [cx + 1.3, A.minZ + 3.6]].forEach(([x, z], n) => {
    const id = `ahwa-t${n + 1}`;
    const top = at(cyl(0.42, 0.42, 0.03, brass, 26), x, 0.72, z);
    g.add(top);
    top.userData.surface = 'table'; top.userData.tableId = id; top.userData.top = 0.735; top.userData.label = 'a brass table';
    surfaces.push(top);
    g.add(at(cyl(0.03, 0.05, 0.7, std('#2a2a2a'), 10), x, 0.35, z));
    g.add(at(cyl(0.22, 0.22, 0.02, std('#2a2a2a'), 16), x, 0.01, z));
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.45 });
    for (const [dx, dz, ry] of [[0, -0.72, 0], [0, 0.72, Math.PI]]) {
      const c = new THREE.Group();
      c.add(at(box(0.4, 0.04, 0.4, chairM), 0, 0.44, 0));
      c.add(at(box(0.4, 0.42, 0.04, chairM), 0, 0.67, -0.19));
      for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(at(box(0.03, 0.44, 0.03, chairM), a * 0.17, 0.22, b * 0.17));
      // the woven seat, in the old style
      c.add(at(box(0.34, 0.01, 0.34, std('#d9b37a', { roughness: 1 })), 0, 0.465, 0));
      c.position.set(x + dx, 0, z + dz); c.rotation.y = ry;
      g.add(c);
      const seat = { id: `${id}-${dz < 0 ? 0 : 1}`, label: 'a chair at a brass table', x: x + dx, z: z + dz, y: 0, h: 0.46, ry, table: id };
      seats.push(seat);
      c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: 'Sit down for a glass of tea and a game of tawla' }; interactables.push(o); } });
    }
  });

  // the way out (the open front) and, from the café, the way in
  const out = at(new THREE.Mesh(new THREE.PlaneGeometry(W - 0.8, A.h - 0.3), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })), cx, A.h / 2, A.minZ + 0.05);
  out.userData = { kind: 'ahwa-out', label: 'Back across the road to the café' };
  g.add(out); interactables.push(out);
  const goIn = at(new THREE.Mesh(new THREE.PlaneGeometry(W - 0.8, A.h + 1.4), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })), cx, (A.h + 1.4) / 2, A.minZ - 0.3);
  goIn.userData = { kind: 'ahwa-go', label: 'Ahwet El-Sett, across the road — tea, tawla and Umm Kulthum' };
  g.add(goIn);
  const light = new THREE.PointLight('#ffd9a6', 2.4, 9, 1.6); light.position.set(cx, A.h - 0.5, cz); g.add(light);

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: A.minX + 0.55, maxX: A.maxX - 0.55, minZ: A.minZ + 0.25, maxZ: counterZ - 0.45 }] }, ...colliders);
  floor.seats.push(...seats);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.floorMesh = floorMesh;

  let spinning = false;
  return {
    bounds: { minX: A.minX + 0.2, maxX: A.maxX - 0.2, minZ: A.minZ - 1.5, maxZ: A.maxZ - 0.2 },
    arrival: { x: cx, z: A.minZ + 0.9, ry: 0 }, // just in from the street, the counter ahead
    goIn, ahwagi, counterAt: new THREE.Vector3(cx, 1.2, counterZ), gramoAt: new THREE.Vector3(A.maxX - 0.8, 1, counterZ - 0.6),
    setSpinning(on) { spinning = !!on; },
    update(dt, t) {
      for (const f of fans) f.rotation.y += dt * 2.2;
      if (spinning) gramo.userData.disc.rotation.y += dt * 3.5;
      for (const a of animated) a(dt, t);
    },
  };
}
