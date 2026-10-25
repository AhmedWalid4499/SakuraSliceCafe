// The Post Room: on the second floor, off the landing. A wall of wooden
// pigeonholes, one for each flat (Rooms 01–28, with your name on yours), a
// counter with stamps, envelopes and a postbox, a lost-and-found box, and a
// noticeboard. Write a letter to anyone who lives upstairs and it waits in
// their pigeonhole — there's a little light on yours when something's come
// (app.js, server/rooms.js).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, shell, doorOut, plant, pendant, chair } from './roomkit.js';

export const POSTOFFICE = { minX: -6, maxX: 6, minZ: -4.5, maxZ: 4.5, h: 3.2 };
const R = POSTOFFICE;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const HOLES = 28;

const labelTex = (n, name, mine, waiting) => canvasTex(128, 96, (g, w, h) => {
  g.fillStyle = mine ? '#fbe3ea' : '#f4ecd8'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#6e4a2e'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  g.fillStyle = '#3a2418'; g.textAlign = 'center';
  g.font = 'bold 34px Georgia, serif'; g.fillText(String(n).padStart(2, '0'), w / 2, 40);
  g.font = '18px Georgia, serif'; g.fillText(String(name || '').slice(0, 11), w / 2, 70);
  if (waiting) { g.fillStyle = '#c94a4a'; g.beginPath(); g.arc(w - 16, 16, 10, 0, Math.PI * 2); g.fill(); }
});

export function buildPostOffice({ floor, makeSign }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [140, 96, 64], 29),
    wallColor: '#f3e6d0', lowColor: '#7a1f2c', windows: { east: [0] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const wood = std('#8a5a3c', { roughness: 0.55 }), brass = std('#c9a25b', { metalness: 0.75, roughness: 0.3 });

  // ── the pigeonholes: 7 across, 4 high, on the north wall
  const labels = [];
  {
    const cols = 7, rows = 4, cw = 0.62, ch = 0.46, x0 = -((cols - 1) / 2) * cw, y0 = 0.9;
    group.add(at(box(cols * cw + 0.12, rows * ch + 0.12, 0.42, wood), 0, y0 - ch / 2 + (rows * ch) / 2, R.minZ + 0.21));
    block(0, R.minZ + 0.21, cols * cw + 0.12, 0.42);
    for (let i = 0; i < HOLES; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const x = x0 + c * cw, y = y0 + (rows - 1 - r) * ch;
      group.add(at(box(cw - 0.06, ch - 0.06, 0.02, std('#3a2418', { roughness: 0.9 })), x, y, R.minZ + 0.43)); // the dark inside
      const lab = at(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ map: labelTex(i + 1, '', false, false) })), x, y - ch / 2 + 0.1, R.minZ + 0.44);
      group.add(lab); labels.push(lab);
      const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.04, ch - 0.04), new THREE.MeshBasicMaterial({ visible: false })), x, y, R.minZ + 0.45);
      group.add(hit);
      clickable(hit, { kind: 'post-hole', door: i, label: `Room ${String(i + 1).padStart(2, '0')}’s pigeonhole` });
    }
    const sign = makeSign([{ text: '✉️ The pigeonholes', size: 100, weight: '700' }, { text: 'one for every room upstairs', size: 60 }], 1.4, 0.36, { bg: '#f4ecd8' });
    sign.position.set(0, y0 + rows * ch + 0.15, R.minZ + 0.43); group.add(sign);
  }
  // ── the counter: stamps, envelopes, a scale, the postbox beside it
  {
    const x = -3.4, z = 0.6;
    group.add(at(rbox(2.2, 1.0, 0.7, 0.03, wood), x, 0.5, z));
    group.add(at(rbox(2.3, 0.05, 0.76, 0.02, std('#e8dccb', { roughness: 0.4 })), x, 1.02, z));
    block(x, z, 2.3, 0.76);
    for (let i = 0; i < 6; i++) group.add(at(box(0.22, 0.01, 0.15, std(['#f4ecd8', '#fbe3ea', '#dff1ff'][i % 3])), x - 0.6 + (i % 3) * 0.05, 1.05 + i * 0.012, z - 0.1));
    group.add(at(cyl(0.1, 0.12, 0.08, brass, 16), x + 0.5, 1.08, z));
    group.add(at(cyl(0.12, 0.12, 0.01, brass, 16), x + 0.5, 1.2, z));
    for (let i = 0; i < 9; i++) group.add(at(box(0.04, 0.005, 0.05, std(['#c94a4a', '#5f8fc4', '#6f9f63'][i % 3])), x + 0.1 + (i % 3) * 0.05, 1.05, z + 0.15 + Math.floor(i / 3) * 0.06));
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.3, 0.8), new THREE.MeshBasicMaterial({ visible: false })), x, 0.65, z);
    group.add(hit);
    clickable(hit, { kind: 'post-write', label: 'The counter — write a letter ✍️' });
    // the postbox: a red pillar box
    const px = x + 1.7, pz = z;
    const pb = new THREE.Group();
    pb.add(at(cyl(0.26, 0.28, 1.2, std('#c8352f', { roughness: 0.4 }), 20), 0, 0.6, 0));
    pb.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#c8352f', { roughness: 0.4 })), 0, 1.2, 0));
    pb.add(at(box(0.3, 0.04, 0.04, std('#1d1b1a')), 0, 1.0, 0.26));
    pb.position.set(px, 0, pz); group.add(pb);
    colliders.push({ type: 'circle', fixed: true, x: px, z: pz, r: 0.3 });
    clickable(pb, { kind: 'post-write', label: 'The postbox — post a letter 📮' });
    chair(group, seats, interactables, { id: 'post-desk', label: 'the writing desk', x: x, z: z + 0.75, ry: Math.PI, y0: fy, color: '#7a1f2c' });
  }
  // ── lost & found, and the noticeboard
  {
    const x = 3.6, z = 1.4;
    const g = new THREE.Group();
    g.add(at(rbox(1.0, 0.6, 0.6, 0.04, std('#b58a63', { roughness: 0.9 })), 0, 0.3, 0));
    const items = [['#f2a7bb', 'sphere'], ['#5f8fc4', 'box'], ['#e2b04a', 'sphere'], ['#6f9f63', 'box']];
    items.forEach(([c, k], i) => g.add(at(k === 'sphere' ? new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), std(c)) : rbox(0.2, 0.12, 0.16, 0.03, std(c)), -0.25 + i * 0.17, 0.66, (i % 2) * 0.1)));
    g.position.set(x, 0, z); group.add(g);
    block(x, z, 1.0, 0.6);
    clickable(g, { kind: 'post-lost', label: 'Lost & found' });
    const sign = makeSign([{ text: 'Lost & found', size: 100, weight: '700' }], 0.8, 0.2, { bg: '#fffaf0' });
    sign.position.set(0, 0.85, 0.32); g.add(sign);
    const board = makeSign([
      { text: '📌 Notices', size: 96, weight: '700' },
      { text: 'Letters wait in the pigeonholes', size: 52 },
      { text: 'until you collect them.', size: 52 },
      { text: 'Be kind. Sign your name. 💌', size: 52 },
    ], 1.0, 0.7, { bg: '#f4ecd8', border: '#6e4a2e' });
    board.position.set(R.maxX - 0.03, 1.7, -2.4); board.rotation.y = -Math.PI / 2; group.add(board);
  }
  const name = makeSign([{ text: 'The Post Room', size: 120, weight: '700' }, { text: 'letters between neighbours 💌', font: 'Dancing Script, cursive', size: 70, color: '#c4627f' }], 1.6, 0.44, { bg: '#f4ecd8' });
  name.position.set(2.6, 2.7, R.maxZ - 0.03); name.rotation.y = Math.PI; group.add(name);
  plant(group, colliders, R.minX + 0.45, R.maxZ - 0.45, 1.0);
  const lights = [pendant(group, R, -2.5, 0, { intensity: 2.4 }), pendant(group, R, 2.5, 0, { intensity: 2.4 })];
  doorOut({ group, R, makeSign, interactables, color: '#7a1f2c', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
    // the names on the pigeonholes: doors[i] = { name, mine, waiting }
    setHoles(doors = []) {
      labels.forEach((l, i) => { const d = doors[i] || {}; const old = l.material.map; l.material.map = labelTex(i + 1, d.name, d.mine, d.waiting); l.material.needsUpdate = true; old?.dispose(); });
    },
  };
}
