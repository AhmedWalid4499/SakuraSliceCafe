// The Japanese Tea Room (茶室): on the second floor, off the landing — the
// café's Japanese side, the way Ahwet El-Sett is its Egyptian one. Tatami
// mats edged in black cloth, shoji screens glowing softly, the tokonoma
// alcove with a hanging scroll and a branch of sakura, a low table with the
// tea things — the iron kettle on its brazier, the chawan bowl, the bamboo
// whisk — and zabuton cushions to kneel on. Take a cushion and make matcha a
// step at a time (app.js); you end up holding the bowl.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, shell, doorOut } from './roomkit.js';

export const TEAROOM = { minX: -5.5, maxX: 5.5, minZ: -4.5, maxZ: 4.5, h: 3.0 };
const R = TEAROOM;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

function tatamiTex() {
  return canvasTex(512, 512, (g, w) => {
    // two mats side by side, each 2:1, with black borders; fine weave lines
    for (const [x, y, mw, mh] of [[0, 0, 256, 512], [256, 0, 256, 256], [256, 256, 256, 256]]) {
      g.fillStyle = '#c9c48a'; g.fillRect(x, y, mw, mh);
      g.strokeStyle = 'rgba(120,115,60,.35)'; g.lineWidth = 1;
      for (let i = 0; i < mh; i += 4) { g.beginPath(); g.moveTo(x, y + i); g.lineTo(x + mw, y + i); g.stroke(); }
      g.strokeStyle = '#1d1b1a'; g.lineWidth = 10; g.strokeRect(x + 5, y + 5, mw - 10, mh - 10);
    }
  }, [(R.maxX - R.minX) / 3.6, (R.maxZ - R.minZ) / 3.6]);
}
function shojiTex() {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6e4a2e'; g.lineWidth = 6;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 14; g.strokeRect(0, 0, w, h);
  }, [4, 1]);
}
function scrollTex() {
  return canvasTex(200, 560, (g, w, h) => {
    g.fillStyle = '#6e5a3a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4ecd8'; g.fillRect(18, 40, w - 36, h - 80);
    g.fillStyle = '#1d1b1a'; g.textAlign = 'center';
    g.font = 'bold 70px "Noto Serif JP", "Hiragino Mincho ProN", serif';
    ['一', '期', '一', '会'].forEach((c, i) => g.fillText(c, w / 2, 130 + i * 96));
    g.fillStyle = '#c4362f'; g.fillRect(w / 2 - 12, h - 84, 24, 24); // the seal
  });
}

export function buildTearoom({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: tatamiTex(),
    wallColor: '#e9dcc4', lowColor: '#6e4a2e', ceilColor: '#c9a87a', wallsAreSurfaces: false,
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const fy = group.position.y;
  const wood = std('#6e4a2e', { roughness: 0.6 }), dark = std('#2a2422', { roughness: 0.5 });

  // shoji along the east and west walls, lit softly from behind
  const shojiM = std('#ffffff', { map: shojiTex(), roughness: 0.9, emissive: '#fff1d6', emissiveIntensity: 0.35 });
  for (const [x, ry] of [[R.minX + 0.04, Math.PI / 2], [R.maxX - 0.04, -Math.PI / 2]]) {
    const m = at(new THREE.Mesh(new THREE.PlaneGeometry(R.maxZ - R.minZ - 0.4, 2.3), shojiM), x, 1.2, 0); m.rotation.y = ry; group.add(m);
  }
  // ceiling beams
  for (let i = -2; i <= 2; i++) group.add(at(box(0.12, 0.12, R.maxZ - R.minZ, wood), i * 2.2, R.h - 0.06, 0));

  // ── the tokonoma: the alcove in the north wall, a scroll and the sakura branch
  {
    const x = -2.4, w = 2.2;
    group.add(at(box(w, 0.14, 0.7, std('#3a2a20', { roughness: 0.4 })), x, 0.07, R.minZ + 0.35));
    group.add(at(box(0.14, R.h, 0.14, std('#8a6a4a', { roughness: 0.7 })), x + w / 2, R.h / 2, R.minZ + 0.7)); // the tokobashira
    colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: R.minZ, maxZ: R.minZ + 0.72 });
    const sc = at(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.4), std('#ffffff', { map: scrollTex(), roughness: 0.9 })), x - 0.3, 1.55, R.minZ + 0.03);
    group.add(sc);
    clickable(sc, { kind: 'tea-scroll', label: 'The scroll: 一期一会 — “one time, one meeting”' });
    const vase = at(cyl(0.1, 0.13, 0.3, std('#3a4a5a', { roughness: 0.3 }), 16), x + 0.5, 0.29, R.minZ + 0.35); group.add(vase);
    const branch = new THREE.Group();
    const bark = std('#4a3326', { roughness: 0.9 });
    for (let i = 0; i < 4; i++) { const b = at(cyl(0.012, 0.018, 0.7, bark, 6), 0, 0.35, 0); b.rotation.z = -0.5 + i * 0.35; b.position.x = Math.sin(-0.5 + i * 0.35) * -0.3; branch.add(b); }
    const petal = std('#f6c6d6', { roughness: 0.8 });
    for (let i = 0; i < 26; i++) branch.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), petal), -0.4 + ((i * 37) % 80) / 100, 0.3 + ((i * 53) % 60) / 100, ((i * 17) % 20 - 10) / 100));
    branch.position.set(x + 0.5, 0.42, R.minZ + 0.35); group.add(branch);
    clickable(branch, { kind: 'tea-scroll', label: 'A branch of sakura in the tokonoma 🌸' });
  }

  // ── the low table and the tea things: the kama on its brazier, chawan, whisk, chashaku, natsume
  const table = { x: 1.0, z: -0.4 };
  let steam;
  {
    group.add(at(rbox(1.6, 0.06, 1.0, 0.03, std('#3a2418', { roughness: 0.35 })), table.x, 0.32, table.z));
    for (const a of [-1, 1]) for (const b of [-1, 1]) group.add(at(box(0.07, 0.3, 0.07, dark), table.x + a * 0.7, 0.15, table.z + b * 0.4));
    colliders.push({ type: 'box', fixed: true, minX: table.x - 0.82, maxX: table.x + 0.82, minZ: table.z - 0.52, maxZ: table.z + 0.52 });
    // the brazier and the iron kettle beside the table
    const bx = table.x + 1.3, bz = table.z - 0.6;
    group.add(at(rbox(0.5, 0.25, 0.5, 0.04, std('#5a3a26')), bx, 0.125, bz));
    group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), std('#2a2422', { metalness: 0.5, roughness: 0.6 })), bx, 0.42, bz));
    group.add(at(cyl(0.07, 0.07, 0.05, dark, 12), bx, 0.6, bz));
    colliders.push({ type: 'circle', fixed: true, x: bx, z: bz, r: 0.32 });
    steam = at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false })), bx, 0.75, bz);
    group.add(steam);
    const chawan = at(cyl(0.08, 0.05, 0.08, std('#3a4a3a', { roughness: 0.5 }), 20), table.x - 0.1, 0.39, table.z);
    group.add(chawan);
    group.add(at(cyl(0.07, 0.07, 0.01, std('#7ab05a', { roughness: 0.5 }), 18), table.x - 0.1, 0.43, table.z)); // matcha, frothed
    const whisk = new THREE.Group();
    whisk.add(at(cyl(0.012, 0.014, 0.07, std('#d9c49a'), 8), 0, 0.09, 0));
    whisk.add(at(cyl(0.03, 0.018, 0.06, std('#e8d8b0', { roughness: 0.9 }), 12), 0, 0.03, 0));
    whisk.position.set(table.x + 0.3, 0.35, table.z + 0.1); group.add(whisk);
    group.add(at(cyl(0.035, 0.035, 0.06, std('#1d1b1a', { roughness: 0.2 }), 14), table.x + 0.5, 0.38, table.z - 0.15)); // the natsume
    group.add(at(box(0.18, 0.008, 0.012, std('#d9c49a')), table.x + 0.15, 0.355, table.z - 0.25)); // the chashaku
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 1.1), new THREE.MeshBasicMaterial({ visible: false })), table.x, 0.45, table.z);
    group.add(hit);
    clickable(hit, { kind: 'tea-make', label: 'The tea things — make a bowl of matcha 🍵' });
  }
  // zabuton round the table, to kneel on
  [[0, -0.95, 0], [0, 0.95, Math.PI], [-1.15, 0, Math.PI / 2], [1.15, 0.3, -Math.PI / 2]].forEach(([dx, dz, ry], i) => {
    const x = table.x + dx, z = table.z + dz;
    const c = at(rbox(0.56, 0.08, 0.56, 0.04, std(['#7a1f2c', '#2f3f6e', '#4a5a3a', '#7a1f2c'][i], { roughness: 1 })), x, 0.04, z);
    group.add(c);
    const seat = { id: `tea-zabuton-${i}`, label: 'a zabuton cushion', x, z, y: fy, h: 0.12, ry };
    seats.push(seat);
    clickable(c, { kind: 'seat', seat, label: 'Kneel on a zabuton' });
  });
  // a small garden glimpsed through a round window, and a paper lantern
  {
    const win = at(new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), std('#cfe6c0', { emissive: '#bfe0a0', emissiveIntensity: 0.4 })), 2.8, 1.6, R.minZ + 0.02);
    group.add(win);
    group.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 40), wood), 2.8, 1.6, R.minZ + 0.04));
    for (let i = 0; i < 3; i++) group.add(at(box(0.02, 1.2, 0.02, std('#5a6a3a')), 2.55 + i * 0.25, 1.6, R.minZ + 0.03)); // bamboo outside
    const lantern = at(cyl(0.2, 0.2, 0.5, std('#fff6e6', { emissive: '#ffdba0', emissiveIntensity: 0.8, roughness: 0.9 }), 18), R.maxX - 0.8, 0.5, R.maxZ - 0.8);
    group.add(lantern);
    colliders.push({ type: 'circle', fixed: true, x: R.maxX - 0.8, z: R.maxZ - 0.8, r: 0.25 });
    const l = new THREE.PointLight('#ffe2b8', 1.4, 6, 1.6); l.position.set(R.maxX - 0.8, 0.9, R.maxZ - 0.8); group.add(l);
  }
  const name = makeSign([{ text: '茶室 · The Tea Room', size: 100, weight: '700' }, { text: 'one time, one meeting 🍵', font: 'Dancing Script, cursive', size: 66, color: '#4a5a3a' }], 1.5, 0.42, { bg: '#f4ecd8', border: '#6e4a2e' });
  name.position.set(2.6, 2.55, R.maxZ - 0.03); name.rotation.y = Math.PI; group.add(name);
  const lights = [];
  for (const [x, z] of [[-2, 0], [2, 0]]) { const p = new THREE.PointLight('#fff1d6', 1.6, 7, 1.6); p.position.set(x, 2.5, z); group.add(p); lights.push(p); }
  doorOut({ group, R, makeSign, interactables, color: '#8a6a4a', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  animate?.((dt, t) => { steam.position.y = 0.75 + ((t * 0.25) % 0.5); steam.material.opacity = 0.3 * (1 - ((t * 0.25) % 0.5) / 0.5); });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return { lights, bounds: R, arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI } };
}
