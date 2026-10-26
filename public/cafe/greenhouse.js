// The Flower Shop & Greenhouse: on the fourth floor, off its landing. In the
// front, a little flower shop — a counter with a till and a roll of ribbon,
// buckets of cut flowers, a chalkboard; buy a bouquet there (app.js). At the
// back, under a glass roof, the greenhouse: long benches of everyone's pots
// (plant a seed at the potting bench, water it each day and it grows —
// app.js / server), watering cans, hanging plants and a little fountain.
//
// makePlant() builds one plant at a stage (0 seed → 3 in bloom).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, shell, doorOut, chair, plant, pendant } from './roomkit.js';

export const GREENHOUSE = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, h: 3.6 };
const R = GREENHOUSE;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const ball = (r, m, seg = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), m);

export const FLOWERS = {
  sakura: { name: 'Sakura', color: '#f6b8c8', emoji: '🌸', line: 'a little cherry tree — pink blossom in spring' },
  jasmine: { name: 'Jasmine', color: '#fffaf0', emoji: '🤍', line: 'full, the way Cairo smells on a summer night' },
  rose: { name: 'Rose', color: '#d84a5a', emoji: '🌹', line: 'a deep red rose, for someone special' },
  tulip: { name: 'Tulip', color: '#ffb04a', emoji: '🌷', line: 'bright and cheerful, in a soft orange' },
  sunflower: { name: 'Sunflower', color: '#ffd23f', emoji: '🌻', line: 'tall and golden, always facing the light' },
  lotus: { name: 'Blue lotus', color: '#7a9ae8', emoji: '🪷', line: 'the blue lotus of the Nile, the flower of old Egypt' },
};

// ── one plant, in its terracotta pot (the lotus floats in a bowl of water). About 25 cm.
export function makePlant(flower = 'sakura', stage = 0) {
  const F = FLOWERS[flower] || FLOWERS.sakura;
  const g = new THREE.Group();
  const lotus = flower === 'lotus';
  const potM = std(lotus ? '#3f6f9a' : '#c8643c', { roughness: 0.7 });
  g.add(at(cyl(lotus ? 0.12 : 0.085, lotus ? 0.08 : 0.065, lotus ? 0.08 : 0.12, potM, 18), 0, lotus ? 0.04 : 0.06, 0));
  if (!lotus) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.012, 6, 18), potM).rotateX(Math.PI / 2), 0, 0.12, 0));
  const top = lotus ? 0.075 : 0.115;
  g.add(at(cyl(lotus ? 0.11 : 0.08, lotus ? 0.11 : 0.08, 0.008, std(lotus ? '#5aa0c8' : '#5a3e2e', { roughness: lotus ? 0.1 : 1 }), 18), 0, top, 0));
  const leafM = std('#6aa05a', { roughness: 0.7 }), stemM = std('#5a8a4a', { roughness: 0.7 });
  const petalM = std(F.color, { roughness: 0.6 });
  const centreM = std(flower === 'sunflower' ? '#6a4020' : '#ffd23f', { roughness: 0.7 });
  if (stage <= 0) { // a seed, just showing
    const s = ball(0.012, std('#8a6a40'), 8); s.scale.y = 0.6; s.position.y = top + 0.006; g.add(s);
    return g;
  }
  const stem = (h, x = 0, z = 0, lean = 0) => { const s = at(cyl(0.005, 0.006, h, stemM, 6), x, top + h / 2, z); s.rotation.z = lean; g.add(s); return top + h; };
  const leaf = (y, a, s = 1) => { const l = ball(0.03 * s, leafM, 10); l.scale.set(1, 0.25, 0.5); l.position.set(Math.cos(a) * 0.03 * s, y, Math.sin(a) * 0.03 * s); l.rotation.y = -a; l.rotation.z = 0.4; g.add(l); };
  const bloom = (x, y, z, r, petals = 6) => {
    const f = new THREE.Group(); f.position.set(x, y, z);
    for (let i = 0; i < petals; i++) { const p = ball(r, petalM, 10); p.scale.set(1, 0.35, 0.6); const a = i * Math.PI * 2 / petals; p.position.set(Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9); p.rotation.y = -a; f.add(p); }
    f.add(ball(r * 0.5, centreM, 10));
    f.rotation.x = -0.5; g.add(f); return f;
  };
  if (stage === 1) { // a sprout: two little leaves
    if (lotus) { const pad = cyl(0.04, 0.04, 0.004, leafM, 14); pad.position.set(0.02, top + 0.006, 0); g.add(pad); return g; }
    const y = stem(0.05); leaf(y, 0, 0.8); leaf(y, Math.PI, 0.8);
    return g;
  }
  if (lotus) { // lily pads on the water, a bud or an open blue flower
    for (const [x, z, r] of [[0.04, 0.03, 0.045], [-0.05, -0.02, 0.04], [0.0, -0.06, 0.03]]) { const pad = cyl(r, r, 0.004, leafM, 16); pad.position.set(x, top + 0.006, z); g.add(pad); }
    if (stage === 2) { const b = ball(0.022, petalM, 10); b.scale.set(0.8, 1.4, 0.8); b.position.set(0, top + 0.05, 0); g.add(b); g.add(at(cyl(0.004, 0.004, 0.04, stemM, 6), 0, top + 0.02, 0)); }
    else for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 8; i++) {
      const p = ball(0.03 - ring * 0.006, petalM, 10); p.scale.set(0.45, 1.3, 0.25);
      const a = i * Math.PI / 4 + ring * 0.4; p.position.set(Math.cos(a) * 0.02, top + 0.04 + ring * 0.01, Math.sin(a) * 0.02);
      p.rotation.set(Math.sin(a) * (0.7 - ring * 0.3), 0, -Math.cos(a) * (0.7 - ring * 0.3)); g.add(p);
    }
    if (stage >= 3) g.add(at(ball(0.012, centreM, 8), 0, top + 0.05, 0));
    return g;
  }
  if (flower === 'sakura') { // a little bonsai-style branch
    const trunkM = std('#5a3e30', { roughness: 0.8 });
    const trunk = at(cyl(0.01, 0.016, 0.14, trunkM, 8), 0, top + 0.07, 0); trunk.rotation.z = 0.25; g.add(trunk);
    const arms = [[-0.05, top + 0.16, 0.02], [0.04, top + 0.19, -0.02], [0.0, top + 0.22, 0.03]];
    for (const [x, y, z] of arms) { const a = at(cyl(0.005, 0.008, 0.08, trunkM, 6), x * 0.5, y - 0.02, z * 0.5); a.rotation.z = -x * 12; g.add(a); }
    for (const [x, y, z] of arms) {
      if (stage === 2) { for (let i = 0; i < 4; i++) { const l = ball(0.016, leafM, 8); l.position.set(x + Math.cos(i * 1.7) * 0.025, y + Math.sin(i) * 0.012, z + Math.sin(i * 1.7) * 0.025); g.add(l); } }
      else for (let i = 0; i < 7; i++) { const b = ball(0.014, petalM, 8); b.position.set(x + Math.cos(i * 1.3) * 0.032, y + Math.sin(i * 2.1) * 0.015, z + Math.sin(i * 1.3) * 0.032); g.add(b); }
    }
    return g;
  }
  const tall = flower === 'sunflower' ? 0.26 : flower === 'jasmine' ? 0.12 : 0.17;
  if (flower === 'jasmine') { // a bushy little plant, white star flowers all over it
    for (let i = 0; i < 9; i++) { const l = ball(0.03, leafM, 10); l.scale.set(1, 0.7, 1); l.position.set(Math.cos(i * 2.4) * 0.05, top + 0.05 + (i % 3) * 0.035, Math.sin(i * 2.4) * 0.05); g.add(l); }
    if (stage >= 3) for (let i = 0; i < 8; i++) { const f = bloom(Math.cos(i * 1.9) * 0.06, top + 0.08 + (i % 3) * 0.04, Math.sin(i * 1.9) * 0.06, 0.009, 5); f.rotation.x = -1; }
    else for (let i = 0; i < 4; i++) { const b = ball(0.007, petalM, 6); b.position.set(Math.cos(i * 1.6) * 0.06, top + 0.12, Math.sin(i * 1.6) * 0.06); g.add(b); }
    return g;
  }
  const y = stem(stage === 2 ? tall * 0.75 : tall);
  for (let i = 0; i < (flower === 'sunflower' ? 4 : 2); i++) leaf(top + 0.04 + i * 0.05, i * 2.3, flower === 'sunflower' ? 1.4 : 1);
  if (stage === 2) { const b = ball(0.018, std('#7ab05a'), 10); b.scale.y = 1.4; b.position.y = y + 0.01; g.add(b); const tip = ball(0.01, petalM, 8); tip.position.y = y + 0.03; g.add(tip); return g; }
  if (flower === 'tulip') { // a closed cup of petals
    for (let i = 0; i < 5; i++) { const p = ball(0.022, petalM, 10); p.scale.set(0.6, 1.3, 0.4); const a = i * Math.PI * 2 / 5; p.position.set(Math.cos(a) * 0.013, y + 0.025, Math.sin(a) * 0.013); p.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); g.add(p); }
  } else if (flower === 'rose') {
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 5; i++) { const p = ball(0.02 - ring * 0.005, petalM, 10); p.scale.set(0.8, 0.9, 0.35); const a = i * Math.PI * 2 / 5 + ring; p.position.set(Math.cos(a) * (0.016 - ring * 0.005), y + 0.015 + ring * 0.006, Math.sin(a) * (0.016 - ring * 0.005)); p.rotation.y = -a; g.add(p); }
  } else bloom(0, y + 0.02, 0.01, flower === 'sunflower' ? 0.032 : 0.02, flower === 'sunflower' ? 14 : 6);
  return g;
}

export function buildGreenhouse({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const tileTex = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#e8dccc'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#c8a080' : '#e0c4a4'; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
  }, [6, 5]);
  const { surfaces } = shell({
    group, R, floor, floorMap: tileTex,
    wallColor: '#eef4ea', lowColor: '#6a9a6a', ceilColor: '#ffffff', windows: { east: [-3.2, -0.8], west: [-3.2, -0.8] },
  });
  // the back half is a greenhouse: make the ceiling glass, with white frames over it
  for (const o of group.children) if (o.isMesh && Math.abs(o.position.y - R.h) < 1e-3 && o.rotation.x > 1.5) {
    o.material = new THREE.MeshStandardMaterial({ color: '#e8f6ff', roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  }
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const white = std('#fbfbf6', { roughness: 0.5 }), wood = std('#8a6040', { roughness: 0.6 }), dark = std('#3a3a3a', { roughness: 0.5 });
  const lights = [];
  const SPLIT = 0.6; // greenhouse behind (z < SPLIT), the shop in front
  // the glass roof's frames, and glass panes on the back wall
  for (let x = R.minX; x <= R.maxX + 0.01; x += 1.5) group.add(at(box(0.06, 0.06, SPLIT - R.minZ, white), x, R.h - 0.04, (R.minZ + SPLIT) / 2));
  for (let z = R.minZ; z <= SPLIT + 0.01; z += 1.4) group.add(at(box(R.maxX - R.minX, 0.06, 0.06, white), 0, R.h - 0.04, z));
  {
    const pane = new THREE.MeshStandardMaterial({ color: '#dff1ff', roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false });
    const glass = at(new THREE.Mesh(new THREE.PlaneGeometry(R.maxX - R.minX - 0.4, R.h - 1.2), pane), 0, 0.9 + (R.h - 1.2) / 2, R.minZ + 0.03); group.add(glass);
    for (let x = R.minX + 0.2; x <= R.maxX - 0.19; x += 1.15) group.add(at(box(0.05, R.h - 1.2, 0.05, white), x, 0.9 + (R.h - 1.2) / 2, R.minZ + 0.05));
    group.add(at(box(R.maxX - R.minX, 0.06, 0.06, white), 0, 2.2, R.minZ + 0.05));
  }
  // the low wall between the shop and the greenhouse, with an arch of white trellis
  for (const s of [-1, 1]) {
    group.add(at(rbox(3.6, 0.9, 0.2, 0.05, std('#6a9a6a', { roughness: 0.8 })), s * 4.0, 0.45, SPLIT));
    block(s * 4.0, SPLIT, 3.6, 0.25);
  }
  {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.05, 8, 24, Math.PI), white); arch.position.set(0, 2.0, SPLIT); group.add(arch);
    for (const s of [-1, 1]) group.add(at(box(0.08, 2.0, 0.08, white), s * 1.15, 1.0, SPLIT));
    const vineM = std('#5f8f52'), blossM = std('#f6b8c8');
    for (let i = 0; i <= 14; i++) { const a = Math.PI * i / 14; const l = ball(0.07, i % 3 ? vineM : blossM, 8); l.position.set(Math.cos(a) * 1.15, 2.0 + Math.sin(a) * 1.15, SPLIT + 0.05); group.add(l); }
  }

  // ── the greenhouse: three long benches of pots (everyone's plants)
  const BENCHES = [{ x: -3.5, z: -3.0, ry: 0 }, { x: 0, z: -3.0, ry: 0 }, { x: 3.5, z: -3.0, ry: 0 }];
  const SPOTS = [];
  for (const b of BENCHES) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z); group.add(g);
    g.add(at(rbox(2.6, 0.06, 0.9, 0.02, wood), 0, 0.78, 0));
    g.add(at(box(2.5, 0.04, 0.8, wood), 0, 0.3, 0));
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(box(0.06, 0.78, 0.06, wood), a * 1.2, 0.39, c * 0.38));
    for (let k = 0; k < 4; k++) g.add(at(cyl(0.07, 0.055, 0.1, std('#c8643c', { roughness: 0.7 }), 12), -0.9 + k * 0.6, 0.37, 0)); // empty pots underneath
    block(b.x, b.z, 2.7, 1.0);
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 0.95), new THREE.MeshBasicMaterial({ visible: false })), b.x, 0.85, b.z);
    group.add(hit); clickable(hit, { kind: 'flower-pots', label: 'Everyone’s plants 🌷' });
    for (let row = 0; row < 2; row++) for (let k = 0; k < 3; k++) SPOTS.push({ x: b.x - 0.8 + k * 0.8, z: b.z - 0.2 + row * 0.4 });
  }
  const potGroup = new THREE.Group(); group.add(potGroup);
  function setPots(pots = []) {
    for (const o of [...potGroup.children]) { potGroup.remove(o); o.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } }); }
    pots.slice(0, SPOTS.length).forEach((p, i) => {
      const s = SPOTS[i];
      const pl = makePlant(p.flower, Math.max(0, Math.min(3, p.stage | 0)));
      pl.scale.setScalar(2.0); pl.position.set(s.x, 0.81, s.z); pl.rotation.y = i * 1.3;
      if (p.mine) { // a pink ribbon round your own pots
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 6, 18), std('#f27aa0', { roughness: 0.5 }));
        rib.rotation.x = Math.PI / 2; rib.position.y = 0.07; pl.add(rib);
        const bow = ball(0.018, rib.material, 8); bow.scale.set(1.6, 1, 0.6); bow.position.set(0, 0.07, 0.085); pl.add(bow);
      }
      potGroup.add(pl);
    });
  }

  // the potting bench, by the east wall: soil, seed packets, a trowel and a can
  {
    const px = R.maxX - 0.7, pz = -0.6;
    const g = new THREE.Group(); g.position.set(px, 0, pz); group.add(g);
    g.add(at(rbox(0.9, 0.06, 2.0, 0.02, wood), 0, 0.85, 0));
    g.add(at(box(0.06, 0.5, 2.0, wood), 0.42, 1.12, 0)); // a back board
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(box(0.06, 0.85, 0.06, wood), a * 0.38, 0.425, c * 0.9));
    g.add(at(rbox(0.5, 0.14, 0.7, 0.04, std('#5a3e2e', { roughness: 1 })), -0.05, 0.95, -0.45)); // the soil tray
    Object.values(FLOWERS).forEach((f, i) => { const pk = at(box(0.1, 0.14, 0.012, std(f.color, { roughness: 0.8 })), -0.1 + (i % 3) * 0.12, 0.95, 0.25 + Math.floor(i / 3) * 0.16); pk.rotation.y = Math.PI / 2; pk.rotation.z = 0.1; g.add(pk); });
    for (let k = 0; k < 3; k++) g.add(at(makePlant(['tulip', 'rose', 'jasmine'][k], k + 1), -0.15, 0.88, 0.55 + k * 0.2)); // seedlings coming on
    const trowel = at(box(0.05, 0.01, 0.16, std('#b8bcc0', { metalness: 0.7, roughness: 0.3 })), 0.05, 0.89, -0.05); g.add(trowel);
    block(px, pz, 1.0, 2.1);
    clickable(g, { kind: 'flower-plant', label: 'The potting bench — plant, water and pick 🌱' });
    const s = makeSign([{ text: 'Plant a seed 🌱', size: 96, weight: '700', color: '#4a7a4a' }, { text: 'water it every day · it blooms in 3', size: 54 }], 1.3, 0.34, { bg: '#fbfbf6', border: '#6a9a6a' });
    s.position.set(R.maxX - 0.03, 2.0, pz); s.rotation.y = -Math.PI / 2; group.add(s);
  }
  // watering cans
  for (const [x, z, c] of [[R.maxX - 1.4, -1.9, '#6fb0c8'], [R.minX + 0.7, -1.2, '#e8b44a']]) {
    const can = new THREE.Group(); can.position.set(x, 0, z); group.add(can);
    const m = std(c, { roughness: 0.4, metalness: 0.3 });
    can.add(at(cyl(0.12, 0.13, 0.24, m, 16), 0, 0.12, 0));
    const spout = at(cyl(0.015, 0.025, 0.3, m, 8), 0.17, 0.2, 0); spout.rotation.z = -0.9; can.add(spout);
    can.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI), m), 0, 0.26, 0));
  }
  // hanging plants from the roof frames
  const hangers = [];
  for (const [x, z] of [[-4.5, -1.5], [-1.5, -1.6], [1.5, -1.5], [4.5, -1.6], [-3.0, -4.2], [3.0, -4.2]]) {
    const h = new THREE.Group(); h.position.set(x, R.h - 0.05, z); group.add(h);
    h.add(at(cyl(0.004, 0.004, 0.7, dark, 4), 0, -0.35, 0));
    h.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#c8643c', { roughness: 0.7 })), 0, -0.72, 0));
    for (let i = 0; i < 7; i++) { const v = ball(0.05, std('#5f8f52'), 8); v.scale.set(0.8, 2.2, 0.8); v.position.set(Math.cos(i) * 0.13, -0.85 - (i % 3) * 0.08, Math.sin(i) * 0.13); h.add(v); }
    hangers.push(h);
  }
  // the little fountain at the back, in the middle
  const water = [];
  {
    const fx = 0, fz = R.minZ + 0.9;
    const stone = std('#d8d0c4', { roughness: 0.85 });
    group.add(at(cyl(0.7, 0.75, 0.35, stone, 24), fx, 0.175, fz));
    group.add(at(cyl(0.62, 0.62, 0.02, std('#6ab0d0', { roughness: 0.05, transparent: true, opacity: 0.85 }), 24), fx, 0.33, fz));
    group.add(at(cyl(0.07, 0.1, 0.6, stone, 12), fx, 0.6, fz));
    group.add(at(cyl(0.28, 0.12, 0.12, stone, 18), fx, 0.92, fz));
    for (let i = 0; i < 10; i++) { const d = ball(0.02, std('#bfe6ff', { roughness: 0.05, transparent: true, opacity: 0.8 }), 6); group.add(d); water.push({ d, a: i * Math.PI / 5, k: i / 10 }); }
    for (let i = 0; i < 3; i++) { const lp = cyl(0.08, 0.08, 0.005, std('#6aa05a'), 12); lp.position.set(fx + Math.cos(i * 2.1) * 0.4, 0.345, fz + Math.sin(i * 2.1) * 0.4); group.add(lp); }
    colliders.push({ type: 'circle', fixed: true, x: fx, z: fz, r: 0.8 });
  }
  plant(group, colliders, R.minX + 0.6, R.minZ + 0.6, 1.3);
  plant(group, colliders, R.maxX - 0.6, R.minZ + 0.6, 1.3);

  // ── the shop: the counter, buckets of cut flowers, a chalkboard
  {
    const cx = -3.4, cz = 3.0;
    const g = new THREE.Group(); g.position.set(cx, 0, cz); group.add(g);
    g.add(at(rbox(2.4, 0.95, 0.7, 0.05, std('#f4ece0', { roughness: 0.7 })), 0, 0.475, 0));
    g.add(at(rbox(2.5, 0.06, 0.8, 0.02, wood), 0, 0.98, 0));
    for (let i = 0; i < 6; i++) g.add(at(box(0.02, 0.8, 0.02, std('#e8dcc8')), -1.0 + i * 0.4, 0.45, 0.355));
    g.add(at(rbox(0.36, 0.26, 0.3, 0.04, std('#c8a050', { metalness: 0.5, roughness: 0.35 })), 0.75, 1.14, 0)); // the till
    g.add(at(box(0.3, 0.04, 0.12, std('#2a2a2a')), 0.75, 1.3, 0.06));
    const roll = at(cyl(0.07, 0.07, 0.12, std('#f27aa0', { roughness: 0.5 }), 16), -0.4, 1.07, 0.05); roll.rotation.z = Math.PI / 2; g.add(roll);
    const paper = at(box(0.5, 0.01, 0.35, std('#f2e6d0', { roughness: 0.9 })), 0.1, 1.02, -0.05); g.add(paper);
    // a finished bouquet waiting on the counter
    const bq = new THREE.Group(); bq.position.set(0.1, 1.02, -0.05); g.add(bq);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 12, 1, true), std('#f2e6d0', { roughness: 0.9, side: THREE.DoubleSide })); cone.rotation.z = Math.PI / 2 + 0.25; cone.position.set(0, 0.06, 0); bq.add(cone);
    for (let i = 0; i < 6; i++) { const b = ball(0.035, std(['#f6b8c8', '#d84a5a', '#fffaf0'][i % 3]), 8); b.position.set(-0.17 + Math.sin(i) * 0.03, 0.09 + Math.cos(i * 2) * 0.04, Math.cos(i) * 0.05); bq.add(b); }
    block(cx, cz, 2.5, 0.8);
    clickable(g, { kind: 'flower-shop', label: 'The flower shop — buy a bouquet 💐' });
    const board = makeSign([{ text: 'Fresh today', font: 'Dancing Script, cursive', size: 110, color: '#ffffff' }, { text: 'sakura · jasmine · roses', size: 58, color: '#f6e6c8' }, { text: 'tulips · sunflowers · blue lotus', size: 58, color: '#f6e6c8' }], 1.1, 0.7, { bg: '#2e3a32', border: '#8a6040' });
    board.position.set(cx - 0.4, 2.0, R.maxZ - 0.04); board.rotation.y = Math.PI; group.add(board);
  }
  // buckets of cut flowers along the east of the shop
  for (let i = 0; i < 6; i++) {
    const key = Object.keys(FLOWERS)[i], F = FLOWERS[key];
    const bx = 1.6 + (i % 3) * 0.9, bz = 2.6 + Math.floor(i / 3) * 0.8;
    const g = new THREE.Group(); g.position.set(bx, 0, bz); group.add(g);
    g.add(at(cyl(0.2, 0.16, 0.4, std('#b8bcc0', { metalness: 0.6, roughness: 0.35 }), 18), 0, 0.2, 0));
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4, d = 0.05 + (k % 3) * 0.04, hh = 0.4 + (k % 4) * 0.08;
      g.add(at(cyl(0.006, 0.006, hh, std('#5a8a4a'), 5), Math.cos(a) * d, 0.4 + hh / 2, Math.sin(a) * d));
      const fl = ball(key === 'sunflower' ? 0.06 : 0.045, std(F.color, { roughness: 0.6 }), 10); fl.scale.y = 0.75; fl.position.set(Math.cos(a) * d * 1.3, 0.42 + hh, Math.sin(a) * d * 1.3); g.add(fl);
    }
    colliders.push({ type: 'circle', fixed: true, x: bx, z: bz, r: 0.28 });
  }
  // a little bench in the shop
  chair(group, seats, interactables, { id: 'greenhouse-chair-0', label: 'a garden chair', x: -4.8, z: 1.5, ry: Math.PI / 2, color: '#6a9a6a', y0: fy });
  chair(group, seats, interactables, { id: 'greenhouse-chair-1', label: 'a garden chair', x: 4.8, z: -0.2, ry: -Math.PI / 2, color: '#e8b4c0', y0: fy });

  lights.push(pendant(group, R, -3.4, 3.0, { intensity: 2.2 }), pendant(group, R, 2.5, 3.0, { intensity: 1.8 }));
  const sun = new THREE.PointLight('#fff4dc', 2.2, 12, 1.2); sun.position.set(0, R.h - 0.3, -2.5); group.add(sun); lights.push(sun);
  {
    const s = makeSign([{ text: 'The Flower Shop', size: 110, weight: '700', color: '#4a7a4a' }, { text: '& greenhouse 🌸', font: 'Dancing Script, cursive', size: 80, color: '#e27a9a' }], 1.9, 0.5, { bg: '#fbfbf6', border: '#6a9a6a' });
    s.position.set(0, 2.65, SPLIT + 0.12); group.add(s);
  }
  doorOut({ group, R, makeSign, interactables, color: '#6a9a6a', to: 'landing4', sign: '⬅ The landing', label: 'Back out to the landing' });

  animate?.((dt, t) => {
    hangers.forEach((h, i) => { h.rotation.z = Math.sin(t * 0.6 + i) * 0.03; });
    for (const w of water) {
      const k = (w.k + t * 0.6) % 1;
      w.d.position.set(Math.cos(w.a) * 0.3 * k, 0.95 + Math.sin(k * Math.PI) * 0.18 - k * 0.55, R.minZ + 0.9 + Math.sin(w.a) * 0.3 * k);
    }
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.2, ry: Math.PI },
    setPots,
  };
}
