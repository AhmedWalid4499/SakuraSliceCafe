// The Onsen Garden: an open-air Japanese hot spring at the very top of the
// building, on the fourth floor's terrace — open to the sky. A bamboo fence
// all round, raked gravel and stepping stones, a big rocky pool and a little
// one, both steaming, stone tōrō lanterns, a sakura tree dropping petals, a
// wooden shelter with towels and buckets, and a shishi-odoshi that tips and
// clacks every few seconds. Slip into the water and soak (you change into
// your swimwear — app.js). In winter snow settles on the rocks and three snow
// monkeys come for a bath.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, doorOut } from './roomkit.js';

export const ONSEN = { minX: -10, maxX: 10, minZ: -8, maxZ: 8, h: 9 };
const R = ONSEN;
const BIG = { x: -1.6, z: -2.4, rx: 4.2, rz: 2.7 };   // the big pool (an ellipse)
const SMALL = { x: 5.6, z: 2.0, rx: 1.9, rz: 1.9 };   // the little one
const WATER_Y = -0.14, DEPTH = 0.8;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const ball = (r, m, seg = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), m);
const rnd = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

function gravelTex() {
  return canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, w, w);
    const r = rnd(7);
    for (let i = 0; i < 5000; i++) { const v = 170 + r() * 70 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(r() * w, r() * w, 2, 2); }
    // raked lines
    g.strokeStyle = 'rgba(120,110,95,0.35)'; g.lineWidth = 3;
    for (let y = 8; y < w; y += 22) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 40) * 4); g.stroke(); }
  }, [(R.maxX - R.minX) / 4, (R.maxZ - R.minZ) / 4]);
}
function waterTex() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#7fc4c0'; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(240,255,250,.45)'; g.lineWidth = 2.5;
    for (let i = 0; i < 22; i++) { g.beginPath(); const x = (i * 61) % w, y = (i * 89) % w; g.moveTo(x, y); g.bezierCurveTo(x + 18, y - 10, x + 36, y + 10, x + 56, y); g.stroke(); }
  }, [3, 3]);
}
function bambooTex() {
  return canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 16; i++) {
      const x = i * 16, v = i % 3;
      g.fillStyle = ['#b9a46a', '#a8935a', '#c4b077'][v]; g.fillRect(x, 0, 16, h);
      g.fillStyle = 'rgba(255,255,230,0.25)'; g.fillRect(x + 3, 0, 3, h);
      g.fillStyle = 'rgba(60,45,20,0.45)'; g.fillRect(x, 0, 1.5, h);
      g.fillRect(x, 30 + (i % 4) * 9, 16, 3); g.fillRect(x, 90 + (i % 3) * 7, 16, 3); // the nodes
    }
  });
}
function softTex() {
  return canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
}
const ellipse = (p, k = 1, n = 48) => { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([p.x + Math.cos(a) * p.rx * k * (1 + Math.sin(a * 3) * 0.04), p.z + Math.sin(a) * p.rz * k * (1 + Math.cos(a * 2) * 0.05)]); } return pts; };

export function buildOnsen({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [], surfaces = [];
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const W = R.maxX - R.minX, D = R.maxZ - R.minZ;
  const wood = std('#8a5a3a', { roughness: 0.75 }), darkWood = std('#4a3020', { roughness: 0.75 });
  const stoneM = std('#8a8680', { roughness: 0.95 }), stoneDark = std('#6a6660', { roughness: 0.95 });
  const mossM = std('#6a8a3a', { roughness: 1 });
  const snowM = std('#fbfdff', { roughness: 0.9 });
  const lights = [];
  const snow = new THREE.Group(); snow.visible = false; group.add(snow);  // winter only
  const capOn = (x, y, z, r, sx = 1, sz = 1) => { const c = ball(r, snowM, 12); c.scale.set(sx, 0.35, sz); c.position.set(x, y, z); snow.add(c); };

  // a soft daylight from the open sky (the rest comes from the world's sky)
  const sky = new THREE.HemisphereLight('#e8f2ff', '#8a7a60', 0.6); group.add(sky);
  const sun = new THREE.PointLight('#fff1d6', 1.2, 26, 1.0); sun.position.set(0, 7, 2); group.add(sun); lights.push(sun);

  // ── the ground: raked gravel, with holes where the pools are
  {
    const sh = new THREE.Shape();
    sh.moveTo(R.minX, -R.maxZ); sh.lineTo(R.maxX, -R.maxZ); sh.lineTo(R.maxX, -R.minZ); sh.lineTo(R.minX, -R.minZ); sh.closePath();
    for (const p of [BIG, SMALL]) { const h = new THREE.Path(); ellipse(p).forEach(([x, z], i) => (i ? h.lineTo(x, -z) : h.moveTo(x, -z))); h.closePath(); sh.holes.push(h); }
    const geo = new THREE.ShapeGeometry(sh);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - R.minX) / W, (pos.getY(i) + R.maxZ) / D);
    const ground = new THREE.Mesh(geo, std('#ffffff', { map: gravelTex(), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.floor = true;
    group.add(ground); floor.floorMesh = ground;
    group.add(at(box(W, 0.6, D, std('#c9bca8', { roughness: 0.9 })), 0, -0.31 - DEPTH, 0)); // the roof slab under it all
  }

  // ── the pools: dark stone basins, warm milky-green water, rocks round the rim
  const waterMap = waterTex();
  const waterM = std('#ffffff', { map: waterMap, transparent: true, opacity: 0.88, roughness: 0.12, metalness: 0.05, emissive: '#3a8a80', emissiveIntensity: 0.15 });
  const basinM = std('#3e3a36', { roughness: 0.9 });
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  const rock = (x, z, s, y = 0, m = stoneM, seed = 1) => {
    const r = rnd(seed * 97 + 3);
    const k = new THREE.Mesh(rockGeo, m); k.castShadow = k.receiveShadow = true;
    k.scale.set(s * (0.9 + r() * 0.5), s * (0.55 + r() * 0.3), s * (0.8 + r() * 0.5)); k.rotation.set(r() * 3, r() * 3, r() * 3);
    k.position.set(x, y + s * 0.2, z); group.add(k);
    return k;
  };
  const pools = [];
  [BIG, SMALL].forEach((p, pi) => {
    const sh = new THREE.Shape(); ellipse(p).forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); sh.closePath();
    const water = new THREE.Mesh(new THREE.ShapeGeometry(sh), waterM);
    const pos = water.geometry.attributes.position, uv = water.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - p.x + p.rx) / (p.rx * 2), (pos.getY(i) + p.z + p.rz) / (p.rz * 2));
    water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; group.add(water);
    clickable(water, { kind: 'onsen-soak', label: 'The hot spring — slip in and soak ♨️' });
    const bottom = new THREE.Mesh(new THREE.ShapeGeometry(sh), basinM); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -DEPTH; group.add(bottom);
    // the sides: a band of stone round the edge
    const pts = ellipse(p);
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
      const len = Math.hypot(x1 - x0, z1 - z0) + 0.02;
      const side = at(new THREE.Mesh(new THREE.PlaneGeometry(len, DEPTH), basinM), (x0 + x1) / 2, -DEPTH / 2, (z0 + z1) / 2);
      side.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); side.material.side = THREE.DoubleSide;
      group.add(side);
    }
    // rocks round the rim (with a gap where you step in)
    const ring = ellipse(p, 1.06, pi ? 14 : 26);
    ring.forEach(([x, z], i) => { if (i === (pi ? 3 : 6)) return; const k = rock(x, z, (pi ? 0.32 : 0.42) * (0.8 + ((i * 7) % 5) * 0.1), -0.05, i % 3 ? stoneM : stoneDark, i + pi * 40); capOn(x, k.scale.y * 1.0 + 0.05, z, k.scale.x * 0.75, 1, k.scale.z / k.scale.x); });
    // a couple of big feature rocks with moss
    for (let j = 0; j < (pi ? 1 : 3); j++) {
      const a = 3.6 + j * 1.0, x = p.x + Math.cos(a) * p.rx * 1.2, z = p.z + Math.sin(a) * p.rz * 1.25;
      const k = rock(x, z, 0.8 - j * 0.12, 0, stoneDark, 300 + j + pi * 9);
      const moss = ball(0.5 - j * 0.08, mossM, 12); moss.scale.set(1.1, 0.25, 0.9); moss.position.set(x, k.scale.y * 0.95 + 0.12, z); group.add(moss);
      capOn(x, k.scale.y * 0.95 + 0.25, z, 0.55 - j * 0.08, 1.2, 1);
      colliders.push({ type: 'circle', fixed: true, x, z, r: 0.8 - j * 0.1 });
    }
    // you can't walk on the water
    const n = pi ? 1 : 4;
    for (let j = 0; j < n; j++) {
      const t = n === 1 ? 0 : j / (n - 1) - 0.5;
      colliders.push({ type: 'circle', fixed: true, x: p.x + t * (p.rx - p.rz) * 2, z: p.z, r: n === 1 ? p.rx * 1.02 : p.rz * 1.02 });
    }
    // the warm light glowing up from the water
    const glow = new THREE.PointLight('#bff0e0', 0.9, 6, 1.5); glow.position.set(p.x, 0.4, p.z); group.add(glow); lights.push(glow);
    pools.push({ p, water });
  });

  // ── soak seats: in the water, facing in — 8 in the big pool, 4 in the little
  const soak = [];
  const seatRing = (p, n, start, k) => {
    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      const x = p.x + Math.cos(a) * p.rx * k, z = p.z + Math.sin(a) * p.rz * k;
      const s = { id: `onsen-soak-${soak.length}`, label: 'the hot spring', x, z, y: fy - 0.62, h: 0.1, ry: Math.atan2(p.x - x, p.z - z) };
      seats.push(s); soak.push(s);
    }
  };
  seatRing(BIG, 8, 0.2, 0.72);
  seatRing(SMALL, 4, 0.6, 0.6);

  // ── steam rising off the water, soft and slow
  const steamTex = softTex();
  const steam = [];
  for (const [p, n] of [[BIG, 26], [SMALL, 10]]) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, color: '#ffffff' });
      const sp = new THREE.Sprite(m); group.add(sp);
      const r = rnd(i * 13 + n);
      steam.push({ sp, x: p.x + (r() - 0.5) * p.rx * 1.5, z: p.z + (r() - 0.5) * p.rz * 1.4, ph: r(), sp0: 0.12 + r() * 0.08, drift: (r() - 0.5) * 0.4 });
    }
  }
  animate?.((dt, t) => {
    steam.forEach(o => {
      const k = (t * o.sp0 + o.ph) % 1;
      o.sp.position.set(o.x + Math.sin(t * 0.3 + o.ph * 6) * 0.2 + o.drift * k, WATER_Y + 0.1 + k * 2.2, o.z);
      const s = 0.8 + k * 1.8; o.sp.scale.set(s, s, 1);
      o.sp.material.opacity = Math.sin(k * Math.PI) * 0.5;
    });
    waterMap.offset.x = Math.sin(t * 0.1) * 0.05; waterMap.offset.y = t * 0.01;
  });

  // ── the bamboo fence all round (a gate in the south side)
  {
    const tex = bambooTex(); tex.wrapS = THREE.RepeatWrapping;
    const H = 2.5;
    const fence = (len, x, z, ry) => {
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(len / 2.6, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), std('#ffffff', { map: t, roughness: 0.85, side: THREE.DoubleSide }));
      m.position.set(x, H / 2, z); m.rotation.y = ry; group.add(m);
      // the cross rails and the posts
      for (const y of [0.5, 1.6]) { const rail = at(cyl(0.035, 0.035, len, darkWood, 8), x, y, z); rail.rotation.set(0, ry, Math.PI / 2); rail.translateZ(0.06); group.add(rail); }
      const top = at(box(len, 0.08, 0.16, darkWood), x, H + 0.04, z); top.rotation.y = ry; group.add(top);
      const cap = at(box(len, 0.06, 0.24, snowM), x, H + 0.11, z); cap.rotation.y = ry; group.remove(cap); snow.add(cap);
    };
    const gap = 1.7;
    fence(W, 0, R.minZ, 0);
    fence(D, R.minX, 0, Math.PI / 2);
    fence(D, R.maxX, 0, -Math.PI / 2);
    fence((W - gap) / 2, R.minX + (W - gap) / 4, R.maxZ, Math.PI);
    fence((W - gap) / 2, R.maxX - (W - gap) / 4, R.maxZ, Math.PI);
    for (const [x, z] of [[R.minX, R.minZ], [R.maxX, R.minZ], [R.minX, R.maxZ], [R.maxX, R.maxZ], [-gap / 2 - 0.08, R.maxZ], [gap / 2 + 0.08, R.maxZ]]) group.add(at(cyl(0.08, 0.08, H + 0.3, darkWood, 10), x, (H + 0.3) / 2, z));
    // a little roof over the gate, and the door through it
    const roofM = std('#3a3430', { roughness: 0.7 });
    const gr = at(box(2.4, 0.1, 0.9, roofM), 0, 3.05, R.maxZ - 0.1); gr.rotation.x = 0.08; group.add(gr);
    capOn(0, 3.13, R.maxZ - 0.1, 1.1, 1.1, 0.4);
    doorOut({ group, R, makeSign, interactables, color: '#8a5a3a', to: 'landing4', sign: '⬅ The landing', label: 'Back out to the landing' });
  }

  // ── stepping stones from the gate up to the pools, moss between
  {
    const r = rnd(5);
    const path = [[0, 6.6], [0.5, 5.7], [-0.1, 4.8], [0.6, 3.9], [1.6, 3.4], [2.7, 3.0], [3.6, 2.4], [-0.8, 3.7], [-1.6, 2.9], [-2.2, 1.6]];
    for (const [x, z] of path) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.34 + r() * 0.08, 0.38, 0.06, 9), stoneM);
      s.scale.z = 0.8 + r() * 0.3; s.rotation.y = r() * 3; s.position.set(x, 0.03, z); s.receiveShadow = true; group.add(s);
      capOn(x, 0.07, z, 0.3, 1, 0.9);
    }
    for (let i = 0; i < 14; i++) { const m = ball(0.25 + r() * 0.25, mossM, 10); m.scale.y = 0.12; m.position.set(R.minX + 1 + r() * (W - 2), 0.02, R.minZ + 1 + r() * (D - 2)); const inPool = [BIG, SMALL].some(p => ((m.position.x - p.x) / (p.rx * 1.3)) ** 2 + ((m.position.z - p.z) / (p.rz * 1.3)) ** 2 < 1); if (!inPool) group.add(m); }
  }

  // ── stone tōrō lanterns, glowing
  const lanternLights = [];
  const toro = (x, z, s = 1) => {
    const g = new THREE.Group();
    g.add(at(cyl(0.34, 0.4, 0.14, stoneM, 6), 0, 0.07, 0));
    g.add(at(cyl(0.11, 0.13, 0.7, stoneM, 8), 0, 0.49, 0));
    g.add(at(cyl(0.3, 0.26, 0.12, stoneM, 6), 0, 0.9, 0));
    const paper = std('#fff1c4', { emissive: '#ffc86a', emissiveIntensity: 0.9, roughness: 0.8 });
    g.add(at(box(0.36, 0.32, 0.36, stoneDark), 0, 1.12, 0));
    for (const [dx, dz, ry] of [[0, 0.185, 0], [0.185, 0, Math.PI / 2], [0, -0.185, Math.PI], [-0.185, 0, -Math.PI / 2]]) { const w = at(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.18), paper), dx, 1.13, dz); w.rotation.y = ry; g.add(w); }
    const roof = at(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.28, 6), stoneM), 0, 1.42, 0); g.add(roof);
    g.add(at(ball(0.07, stoneM, 10), 0, 1.6, 0));
    g.scale.setScalar(s); g.position.set(x, 0, z); group.add(g);
    capOn(x, 1.5 * s, z, 0.36 * s, 1, 1);
    const l = new THREE.PointLight('#ffc86a', 0.5, 4.5, 1.6); l.position.set(x, 1.15 * s, z); group.add(l); lights.push(l); lanternLights.push({ l, paper });
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.4 * s });
  };
  toro(-6.8, -0.4, 1.1); toro(3.6, -5.6, 1.0); toro(8.2, -1.0, 0.9); toro(-3.0, 4.6, 0.9);

  // ── the sakura tree in the north-west corner, petals drifting down
  const TX = -7.6, TZ = -5.6;
  {
    const bark = std('#5a3a2a', { roughness: 0.95 });
    const trunk = at(cyl(0.16, 0.26, 2.2, bark, 10), TX, 1.1, TZ); trunk.rotation.z = 0.12; group.add(trunk);
    const limbs = [[0.9, 2.4, 0.3, 0.9], [-0.6, 2.6, -0.2, -0.7], [0.2, 2.8, 0.7, 0.2], [0.4, 2.5, -0.7, 0.5]];
    for (const [dx, y, dz, rz] of limbs) { const b = at(cyl(0.06, 0.1, 1.4, bark, 8), TX + dx * 0.5, y - 0.3, TZ + dz * 0.5); b.rotation.set(dz * 0.8, 0, -rz); group.add(b); }
    const pinks = ['#f7c6d4', '#f2b0c4', '#fbd9e3', '#eea0b8'];
    const r = rnd(41);
    for (let i = 0; i < 26; i++) {
      const c = ball(0.42 + r() * 0.32, std(pinks[i % 4], { roughness: 0.9 }), 12);
      const a = r() * Math.PI * 2, d = r() * 1.5;
      c.position.set(TX + Math.cos(a) * d + 0.2, 2.9 + r() * 1.0 - d * 0.25, TZ + Math.sin(a) * d * 0.9 + 0.2);
      c.scale.y = 0.78; group.add(c);
      if (i % 3 === 0) capOn(c.position.x, c.position.y + c.scale.x * 0.35, c.position.z, 0.3, 1, 1);
    }
    colliders.push({ type: 'circle', fixed: true, x: TX, z: TZ, r: 0.45 });
    // petals: little pink flakes, falling and drifting across the garden
    const petalM = new THREE.MeshBasicMaterial({ color: '#f7b8cc', side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const petals = [];
    const pg = new THREE.CircleGeometry(0.035, 6); pg.scale(1, 0.6, 1);
    for (let i = 0; i < 40; i++) { const p = new THREE.Mesh(pg, petalM); group.add(p); petals.push({ p, ph: r(), x: TX + (r() - 0.3) * 3, z: TZ + (r() - 0.3) * 3, s: 0.06 + r() * 0.05 }); }
    animate?.((dt, t) => petals.forEach(o => {
      const k = (t * o.s + o.ph) % 1;
      o.p.position.set(o.x + k * 5 + Math.sin(t + o.ph * 9) * 0.3, 3.6 - k * 3.6, o.z + k * 3 + Math.cos(t * 0.7 + o.ph * 5) * 0.3);
      o.p.rotation.set(t * 2 + o.ph * 7, t * 1.3, t * 1.7);
    }));
  }

  // ── the shelter on the west side: posts, a sloping roof, a noren curtain,
  //    a bench with folded towels and a row of wooden buckets
  const SX = R.minX + 1.4, SZ = 4.2;
  {
    for (const [dx, dz] of [[-0.9, -1.4], [-0.9, 1.4], [0.9, -1.4], [0.9, 1.4]]) group.add(at(box(0.12, 2.4, 0.12, wood), SX + dx, 1.2, SZ + dz));
    const roof = at(box(2.4, 0.1, 3.4, std('#4a3a32', { roughness: 0.7 })), SX, 2.5, SZ); roof.rotation.z = 0.18; group.add(roof);
    capOn(SX, 2.62, SZ, 1.2, 1.1, 1.5);
    // the noren across the front: two indigo panels with ♨
    const noren = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#2a3a6a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f4ece0'; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('♨', w * 0.25, h * 0.55); g.fillText('ゆ', w * 0.75, h * 0.55);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(w / 2 - 2, 20, 4, h);
    });
    const n = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.75), std('#ffffff', { map: noren, roughness: 0.9, side: THREE.DoubleSide }));
    n.position.set(SX + 0.92, 1.95, SZ); n.rotation.y = Math.PI / 2; group.add(n);
    animate?.((dt, t) => { n.rotation.x = Math.sin(t * 1.2) * 0.04; });
    // the bench (two seats), towels and buckets
    group.add(at(rbox(0.5, 0.08, 2.4, 0.02, wood), SX - 0.4, 0.45, SZ));
    for (const dz of [-1, 1]) group.add(at(box(0.4, 0.42, 0.06, darkWood), SX - 0.4, 0.21, SZ + dz * 1.05));
    block(SX - 0.4, SZ, 0.55, 2.5);
    for (const [i, dz] of [[0, -0.6], [1, 0.6]]) {
      const s = { id: `onsen-bench-${i}`, label: 'the wooden bench', x: SX - 0.35, z: SZ + dz, y: fy, h: 0.49, ry: Math.PI / 2 };
      seats.push(s);
    }
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 2.4), new THREE.MeshBasicMaterial({ visible: false })), SX - 0.4, 0.3, SZ);
    group.add(hit); clickable(hit, { kind: 'seat', seat: seats[seats.length - 1], label: 'Sit on the wooden bench' });
    const TOWEL = ['#ffffff', '#f2b0c4', '#9fd0e0', '#ffffff', '#f4ead8'];
    for (let i = 0; i < 5; i++) group.add(at(rbox(0.34, 0.07, 0.26, 0.03, std(TOWEL[i], { roughness: 1 })), SX - 0.85, 0.85 + i * 0.075, SZ - 1.0));
    group.add(at(box(0.42, 0.04, 0.34, wood), SX - 0.85, 0.8, SZ - 1.0));
    for (const dz of [-0.15, 0.15]) group.add(at(box(0.04, 0.8, 0.04, darkWood), SX - 0.85, 0.4, SZ - 1.0 + dz));
    const bucketM = std('#c49a62', { roughness: 0.7 });
    const bucket = (x, z, y = 0) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.24, 18, 1, true), bucketM); b.material.side = THREE.DoubleSide; b.position.y = 0.12; g.add(b);
      g.add(at(cyl(0.15, 0.15, 0.02, bucketM, 18), 0, 0.01, 0));
      for (const y2 of [0.05, 0.19]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.008, 6, 20), std('#6a4a2a')); band.rotation.x = Math.PI / 2; band.position.y = y2; g.add(band); }
      g.position.set(x, y, z); group.add(g);
      return g;
    };
    const b1 = bucket(SX + 0.3, SZ - 1.0); bucket(SX + 0.3, SZ - 0.6);
    const b3 = bucket(BIG.x + BIG.rx + 0.5, BIG.z + 1.6);
    for (const b of [b1, b3]) clickable(b, { kind: 'onsen-bucket', label: 'A wooden bucket — splash some water 💦' });
    // a stack of upturned buckets with a stool, by the pool
    group.add(at(cyl(0.16, 0.16, 0.28, wood, 14), BIG.x + BIG.rx + 0.9, 0.14, BIG.z + 1.1));
  }

  // ── the shishi-odoshi by the little pool: a bamboo arm that fills, tips, clacks
  const shishi = new THREE.Group();
  {
    const bam = std('#a8b25a', { roughness: 0.6 }), bamDark = std('#7a8a3a', { roughness: 0.6 });
    const SX2 = SMALL.x + 1.9, SZ2 = SMALL.z - 2.1;
    // the basin it pours into
    const basin = at(cyl(0.38, 0.42, 0.3, stoneDark, 14), SX2, 0.15, SZ2); group.add(basin);
    const wtr = at(new THREE.Mesh(new THREE.CircleGeometry(0.33, 20), waterM), SX2, 0.29, SZ2); wtr.rotation.x = -Math.PI / 2; group.add(wtr);
    // the spout, high on a post, trickling into the arm
    group.add(at(cyl(0.05, 0.05, 1.1, bam, 10), SX2 + 0.95, 0.55, SZ2));
    const spout = at(cyl(0.04, 0.04, 0.6, bam, 10), SX2 + 0.75, 1.05, SZ2); spout.rotation.z = Math.PI / 2 - 0.25; group.add(spout);
    const trickle = at(cyl(0.008, 0.008, 0.25, new THREE.MeshBasicMaterial({ color: '#cfeff0', transparent: true, opacity: 0.7 }), 6), SX2 + 0.45, 0.88, SZ2); group.add(trickle);
    // the pivot posts and the arm
    for (const dz of [-0.09, 0.09]) group.add(at(box(0.04, 0.6, 0.04, darkWood), SX2 + 0.5, 0.3, SZ2 + dz));
    shishi.position.set(SX2 + 0.5, 0.58, SZ2);
    const arm = at(cyl(0.05, 0.045, 0.9, bam, 10), -0.18, 0, 0); arm.rotation.z = Math.PI / 2; shishi.add(arm);
    for (const x of [-0.5, 0.1]) { const node = at(cyl(0.055, 0.055, 0.03, bamDark, 10), x, 0, 0); node.rotation.z = Math.PI / 2; shishi.add(node); }
    group.add(shishi);
    colliders.push({ type: 'circle', fixed: true, x: SX2 + 0.3, z: SZ2, r: 0.6 });
    let lastTip = 0;
    animate?.((dt, t) => {
      // fills for 4 s (tipping up slowly at the mouth end), tips over, clacks back
      const c = t % 4.6;
      shishi.rotation.z = c < 4 ? -0.35 + (c / 4) * 0.25 : c < 4.25 ? -0.1 + ((c - 4) / 0.25) * 0.75 : 0.65 - ((c - 4.25) / 0.35) * 1.0;
      if (c < lastTip) shishi.userData.clack = (shishi.userData.clack || 0) + 1; // (a counter the app could hear)
      lastTip = c;
    });
  }

  // ── snow monkeys: three Japanese macaques soaking in the big pool (winter)
  const monkeys = new THREE.Group(); monkeys.visible = false; group.add(monkeys);
  {
    const fur = std('#9a8a78', { roughness: 1 }), furLight = std('#c2b4a2', { roughness: 1 });
    const faceM = std('#e07a7a', { roughness: 0.7 }), eyeM = new THREE.MeshBasicMaterial({ color: '#1e1418' });
    const monkey = (x, z, ry, s, sleepy) => {
      const g = new THREE.Group();
      const body = ball(0.3, fur, 16); body.scale.set(1, 0.9, 0.85); body.position.y = 0.1; g.add(body);
      const head = new THREE.Group(); head.position.set(0, 0.5, 0.05); g.add(head);
      const hd = ball(0.2, fur, 16); hd.scale.set(1.08, 1, 1); head.add(hd);
      const mane = ball(0.22, furLight, 16); mane.scale.set(1.15, 0.9, 0.6); mane.position.set(0, -0.03, -0.04); head.add(mane);
      const face = ball(0.13, faceM, 14); face.scale.set(1, 1.05, 0.55); face.position.set(0, -0.01, 0.15); head.add(face);
      for (const sd of [-1, 1]) {
        const e = ball(0.022, eyeM, 8); e.scale.y = sleepy ? 0.25 : 1; e.position.set(sd * 0.045, 0.02, 0.22); head.add(e);
        if (!sleepy) { const sh = ball(0.007, new THREE.MeshBasicMaterial({ color: '#fff' }), 6); sh.position.set(sd * 0.045 + 0.007, 0.03, 0.238); head.add(sh); }
        const ear = ball(0.045, faceM, 8); ear.scale.set(0.5, 1, 0.7); ear.position.set(sd * 0.2, 0.02, 0.02); head.add(ear);
        const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), new THREE.MeshBasicMaterial({ color: '#ff9aa8', transparent: true, opacity: 0.6 }));
        cheek.position.set(sd * 0.07, -0.04, 0.215); head.add(cheek);
        const arm = ball(0.09, fur, 10); arm.scale.set(0.7, 1.3, 0.7); arm.position.set(sd * 0.27, 0.2, 0.12); arm.rotation.z = sd * 0.5; g.add(arm);
      }
      const nose = ball(0.012, std('#a04a4a'), 6); nose.position.set(0, -0.03, 0.22); head.add(nose);
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12, Math.PI), eyeM); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.07, 0.21); head.add(mouth);
      // a little cap of snow on its head
      const cap = ball(0.11, snowM, 12); cap.scale.set(1.2, 0.35, 1); cap.position.set(0, 0.19, 0); head.add(cap);
      g.position.set(x, WATER_Y - 0.1, z); g.rotation.y = ry; g.scale.setScalar(s);
      monkeys.add(g);
      return { g, head, sleepy };
    };
    const ms = [
      monkey(BIG.x - BIG.rx * 0.55, BIG.z - BIG.rz * 0.45, 0.7, 1.0, true),
      monkey(BIG.x - BIG.rx * 0.3, BIG.z - BIG.rz * 0.6, 0.3, 0.8, false),
      monkey(BIG.x + BIG.rx * 0.5, BIG.z - BIG.rz * 0.4, -0.6, 0.95, false),
    ];
    animate?.((dt, t) => {
      if (!monkeys.visible) return;
      ms.forEach((m, i) => { m.head.rotation.x = m.sleepy ? 0.25 + Math.sin(t * 0.5) * 0.06 : Math.sin(t * 0.4 + i) * 0.1; m.head.rotation.y = m.sleepy ? 0 : Math.sin(t * 0.3 + i * 2) * 0.4; m.g.position.y = WATER_Y - 0.1 + Math.sin(t * 0.8 + i) * 0.015; });
    });
  }

  // ── falling snow (winter): a few hundred flakes over the garden
  const flakes = [];
  {
    const fm = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const fg = new THREE.SphereGeometry(0.025, 6, 4);
    const r = rnd(77);
    for (let i = 0; i < 220; i++) { const f = new THREE.Mesh(fg, fm); snow.add(f); flakes.push({ f, x: R.minX + r() * W, z: R.minZ + r() * D, ph: r(), s: 0.08 + r() * 0.06 }); }
    animate?.((dt, t) => { if (!snow.visible) return; flakes.forEach(o => { const k = (t * o.s + o.ph) % 1; o.f.position.set(o.x + Math.sin(t + o.ph * 9) * 0.3, 6 - k * 6, o.z); }); });
  }

  // ── the name sign on the north fence
  const name = makeSign([{ text: '露天風呂 · The Onsen Garden', size: 88, weight: '700', color: '#2a3a6a' }, { text: 'soak · steam · sakura ♨️', font: 'Dancing Script, cursive', size: 72, color: '#c4627f' }], 2.4, 0.6, { bg: '#f4ead8', border: '#8a5a3a' });
  name.position.set(2.5, 2.0, R.minZ + 0.06); group.add(name);

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  let winter = false;
  return {
    lights, bounds: R, soak,
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
    // winter: snow on everything, flakes falling, and the snow monkeys come
    setWinter(on) { winter = !!on; snow.visible = winter; monkeys.visible = winter; },
    // night (true/false, or 0..1): the lanterns glow brighter
    setNight(k) { k = Number(k) || 0; lanternLights.forEach(o => { o.l.intensity = 0.5 + k * 1.6; o.paper.emissiveIntensity = 0.9 + k * 0.8; }); sky.intensity = 0.6 - k * 0.35; },
    get winter() { return winter; },
  };
}
