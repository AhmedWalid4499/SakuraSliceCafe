// The Hammam and Spa: on the second floor, off the landing. A domed marble
// room with little star-shaped skylights, the warm göbektaşı slab in the
// middle to lie on, basins round the walls with brass taps, a steam room
// behind glass (step in and the screen fogs up — app.js), loungers with
// robes and towels, and a jug of cucumber water.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, shell, doorOut, plant } from './roomkit.js';

export const HAMMAM = { minX: -7, maxX: 7, minZ: -5.5, maxZ: 5.5, h: 3.6 };
const R = HAMMAM;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

function marbleTex(seed = 3, base = '#f1ece4') {
  return canvasTex(512, 512, (g, w) => {
    g.fillStyle = base; g.fillRect(0, 0, w, w);
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.strokeStyle = 'rgba(150,140,130,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { g.beginPath(); let x = r() * w, y = r() * w; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 120; y += (r() - 0.3) * 90; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, w); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
  }, [(R.maxX - R.minX) / 3, (R.maxZ - R.minZ) / 3]);
}

export function buildHammam({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: marbleTex(5, '#e9e2d6'),
    wallColor: '#e9dccb', lowColor: '#2f6b72', ceilColor: '#e9dccb',
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const brass = std('#c9a25b', { metalness: 0.75, roughness: 0.3 });
  const marble = std('#ffffff', { map: marbleTex(9, '#f4efe8'), roughness: 0.25 });

  // ── the dome over the middle, with its star skylights
  {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std('#efe6d8', { roughness: 0.9, side: THREE.BackSide }));
    dome.scale.y = 0.35; dome.position.set(0, R.h - 0.02, -0.5); group.add(dome);
    const starM = new THREE.MeshBasicMaterial({ color: '#fff7dc' });
    for (let i = 0; i < 18; i++) {
      const a = i * 2.399, d = 0.5 + (i % 6) * 0.45;
      const sh = new THREE.Shape();
      for (let k = 0; k < 10; k++) { const t = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 0.05 : 0.11; sh[k ? 'lineTo' : 'moveTo'](Math.cos(t) * rr, Math.sin(t) * rr); }
      const st = new THREE.Mesh(new THREE.ShapeGeometry(sh), starM);
      const x = Math.cos(a) * d, z = -0.5 + Math.sin(a) * d;
      const y = R.h + Math.sqrt(Math.max(0, 1 - (d / 3.2) ** 2)) * 3.2 * 0.35 - 0.06;
      st.position.set(x, y, z); st.rotation.x = Math.PI / 2; group.add(st);
    }
    const light = new THREE.PointLight('#fff1d6', 2.6, 9, 1.5); light.position.set(0, R.h - 0.4, -0.5); group.add(light);
  }

  // ── the göbektaşı: the warm marble slab, octagonal, to lie on
  {
    const slab = at(cyl(2.0, 2.05, 0.5, marble, 8), 0, 0.25, -0.5);
    slab.rotation.y = Math.PI / 8; group.add(slab);
    colliders.push({ type: 'circle', fixed: true, x: 0, z: -0.5, r: 2.0 });
    const SPOTS = [[0, -1.6, 0], [1.2, -0.5, Math.PI / 2], [-1.2, -0.5, -Math.PI / 2], [0, 0.6, Math.PI]];
    SPOTS.forEach(([x, z, ry], i) => {
      const seat = { id: `hammam-slab-${i}`, label: 'the warm marble slab', x, z, y: fy + 0.5 + 0.16, h: 0.2, ry, lie: true };
      seats.push(seat);
    });
    clickable(slab, { kind: 'hammam-slab', label: 'The warm marble slab — lie down and let the heat in ♨️' });
  }
  // ── basins round the walls, with brass taps and copper bowls
  const basin = (x, z, ry) => {
    const g = new THREE.Group();
    g.add(at(rbox(0.7, 0.55, 0.42, 0.06, marble), 0, 0.5, 0));
    g.add(at(cyl(0.26, 0.2, 0.12, std('#e8f2f4', { roughness: 0.1 }), 20), 0, 0.82, 0.02));
    g.add(at(cyl(0.02, 0.02, 0.2, brass, 8), 0, 1.02, -0.17));
    g.add(at(cyl(0.025, 0.025, 0.12, brass, 8).rotateX(Math.PI / 2), 0, 1.08, -0.11));
    g.add(at(cyl(0.12, 0.08, 0.07, std('#b5651d', { metalness: 0.7, roughness: 0.35 }), 16), 0.25, 0.82, 0.05)); // the copper tas
    g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    const turned = Math.abs(Math.sin(ry)) > 0.5;
    block(x, z, turned ? 0.45 : 0.72, turned ? 0.72 : 0.45);
    clickable(g, { kind: 'hammam-basin', label: 'A basin — splash some warm water' });
  };
  for (const z of [-3.6, -1.6, 0.4]) { basin(R.minX + 0.25, z, Math.PI / 2); }
  for (const x of [-4.6, -2.8]) basin(x, R.minZ + 0.25, 0);

  // ── the steam room: a glass box in the north-east corner, benches inside
  const STEAM = { minX: 3.0, maxX: R.maxX, minZ: R.minZ, maxZ: -1.6 };
  const steamPuffs = [];
  {
    const glass = new THREE.MeshStandardMaterial({ color: '#dfeef2', transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const fw = STEAM.maxX - STEAM.minX, fd = STEAM.maxZ - STEAM.minZ;
    const front = at(new THREE.Mesh(new THREE.PlaneGeometry(fw, 2.6), glass), (STEAM.minX + STEAM.maxX) / 2, 1.3, STEAM.maxZ); group.add(front);
    const side = at(new THREE.Mesh(new THREE.PlaneGeometry(fd, 2.6), glass), STEAM.minX, 1.3, (STEAM.minZ + STEAM.maxZ) / 2); side.rotation.y = Math.PI / 2; group.add(side);
    group.add(at(box(fw, 0.08, 0.08, brass), (STEAM.minX + STEAM.maxX) / 2, 2.62, STEAM.maxZ));
    group.add(at(box(0.08, 0.08, fd, brass), STEAM.minX, 2.62, (STEAM.minZ + STEAM.maxZ) / 2));
    // the glass: a wall to walk round, with the door at its west end
    colliders.push({ type: 'box', fixed: true, minX: STEAM.minX + 1.1, maxX: STEAM.maxX, minZ: STEAM.maxZ - 0.05, maxZ: STEAM.maxZ + 0.05 });
    colliders.push({ type: 'box', fixed: true, minX: STEAM.minX - 0.05, maxX: STEAM.minX + 0.05, minZ: STEAM.minZ, maxZ: STEAM.maxZ });
    group.add(at(rbox(fw - 0.3, 0.45, 0.55, 0.05, std('#c9a27e', { roughness: 0.6 })), (STEAM.minX + STEAM.maxX) / 2 + 0.1, 0.225, R.minZ + 0.35));
    block((STEAM.minX + STEAM.maxX) / 2 + 0.1, R.minZ + 0.35, fw - 0.3, 0.55);
    [3.9, 4.9, 5.9].forEach((x, i) => seats.push({ id: `hammam-steam-${i}`, label: 'the bench in the steam room', x, z: R.minZ + 0.45, y: fy, h: 0.46, ry: 0 }));
    const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(fw, 2.6), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })), (STEAM.minX + STEAM.maxX) / 2, 1.3, STEAM.maxZ + 0.02);
    group.add(hit);
    clickable(hit, { kind: 'hammam-steam', label: 'The steam room — step in and breathe ☁️' });
    const puffM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false });
    for (let i = 0; i < 14; i++) {
      const p = at(new THREE.Mesh(new THREE.SphereGeometry(0.35 + (i % 3) * 0.15, 10, 8), puffM), STEAM.minX + 0.5 + (i * 0.37) % (fw - 1), 0.6 + (i % 5) * 0.4, STEAM.minZ + 0.4 + (i * 0.53) % (fd - 0.8));
      group.add(p); steamPuffs.push({ p, y0: p.position.y, t: i });
    }
    const sign = makeSign([{ text: '☁️ Steam room', size: 110, weight: '700' }, { text: 'breathe slowly', size: 64 }], 0.9, 0.3, { bg: '#e3eef0' });
    sign.position.set((STEAM.minX + STEAM.maxX) / 2, 2.85, STEAM.maxZ + 0.03); group.add(sign);
  }

  // ── the cooling room side: loungers with robes, towels, cucumber water
  const ROBE = ['#ffffff', '#f2c6d0', '#bfe3d6'];
  [[3.4, 1.4], [3.4, 3.4], [5.6, 1.4], [5.6, 3.4]].forEach(([x, z], i) => {
    const g = new THREE.Group();
    g.add(at(rbox(0.7, 0.3, 1.9, 0.05, std('#8a5a3c', { roughness: 0.6 })), 0, 0.2, 0));
    g.add(at(rbox(0.66, 0.1, 1.86, 0.05, std('#f4ece0', { roughness: 1 })), 0, 0.4, 0));
    const back = at(rbox(0.66, 0.1, 0.8, 0.05, std('#f4ece0', { roughness: 1 })), 0, 0.62, -0.7); back.rotation.x = 0.7; g.add(back);
    g.add(at(rbox(0.5, 0.06, 0.4, 0.03, std(ROBE[i % 3], { roughness: 1 })), 0, 0.48, 0.55)); // a folded robe
    g.position.set(x, 0, z); g.rotation.y = Math.PI; group.add(g);
    block(x, z, 0.72, 1.9);
    const seat = { id: `hammam-lounger-${i}`, label: 'a lounger', x, z: z - 0.15, y: fy + 0.45, h: 0.2, ry: Math.PI, lie: true };
    seats.push(seat);
    clickable(g, { kind: 'hammam-lounge', seat, label: 'A lounger — put on a robe and rest 🛁' });
  });
  {
    const x = R.maxX - 0.4, z = 0.2;
    group.add(at(rbox(0.6, 0.9, 1.2, 0.04, std('#8a5a3c', { roughness: 0.5 })), x, 0.45, z));
    block(x, z, 0.6, 1.2);
    group.add(at(cyl(0.11, 0.09, 0.32, std('#e8f2f4', { transparent: true, opacity: 0.45, roughness: 0.05 }), 18), x, 1.06, z - 0.3));
    for (let i = 0; i < 6; i++) group.add(at(cyl(0.05, 0.05, 0.008, std('#7ab05a'), 12), x - 0.03 + (i % 2) * 0.04, 0.98 + i * 0.04, z - 0.3));
    for (let i = 0; i < 4; i++) group.add(at(cyl(0.035, 0.03, 0.09, std('#e8f2f4', { transparent: true, opacity: 0.5, roughness: 0.05 }), 10), x - 0.1 + (i % 2) * 0.16, 0.95, z + 0.1 + Math.floor(i / 2) * 0.16));
    for (let i = 0; i < 4; i++) group.add(at(rbox(0.4, 0.06, 0.3, 0.03, std(ROBE[i % 3], { roughness: 1 })), x, 0.93 + i * 0.07, z + 0.42)); // towels
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 1.3), new THREE.MeshBasicMaterial({ visible: false })), x, 0.7, z);
    group.add(hit);
    clickable(hit, { kind: 'hammam-water', label: 'Cucumber water, robes and towels' });
  }
  const name = makeSign([{ text: 'The Hammam', size: 120, weight: '700' }, { text: 'warm marble · steam · rest ♨️', font: 'Dancing Script, cursive', size: 70, color: '#2f6b72' }], 1.5, 0.44, { bg: '#f4efe8' });
  name.position.set(-3.6, 2.9, R.maxZ - 0.03); name.rotation.y = Math.PI; group.add(name);
  plant(group, colliders, R.minX + 0.45, R.maxZ - 0.45, 1.1);
  plant(group, colliders, 1.6, R.maxZ - 0.45, 1.0);
  const lights = [];
  for (const [x, z] of [[-4, 2.6], [4.5, 2.4]]) { const l = new THREE.PointLight('#ffe2b8', 1.6, 7, 1.6); l.position.set(x, 2.8, z); group.add(l); lights.push(l); }
  doorOut({ group, R, makeSign, interactables, color: '#2f6b72', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  animate?.((dt, t) => { for (const s of steamPuffs) { s.p.position.y = s.y0 + Math.sin(t * 0.4 + s.t) * 0.25; s.p.scale.setScalar(1 + Math.sin(t * 0.3 + s.t) * 0.15); } });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.5, ry: Math.PI },
    slabSeats: seats.filter(s => s.id.startsWith('hammam-slab')),
    steamSeats: seats.filter(s => s.id.startsWith('hammam-steam')),
  };
}
