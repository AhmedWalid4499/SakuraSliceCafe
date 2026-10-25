// The Ramadan Tent (خيمة رمضان): up on the roof, through the door on the west
// side of the stair house. Walls and a peaked roof of khayamiya — the bright
// appliqué tent cloth sewn in Cairo's Street of the Tentmakers — fanous
// lanterns swaying overhead, a crescent and star, a long low sofra laid for
// iftar (dates, lentil soup, qamar el-din, karkadeh, tamr hindi), a tray of
// qatayef and kunafa, low majlis seats and floor cushions, tables for a game
// of tawla or cards after iftar, the musaharati's drum, and a board counting
// down to Maghrib in Ramadan (and to Ramadan the rest of the year; app.js).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, doorOut, plant } from './roomkit.js';

export const TENT = { minX: -8, maxX: 8, minZ: -6, maxZ: 6, h: 4.6 };
const R = TENT;
const WALL_H = 3.0; // the tent's sides; the roof peaks above them
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const GLASS = ['#e2b04a', '#c94a4a', '#2f8a4a', '#3a5fc4', '#7a3fa0', '#e07a2a'];

// khayamiya: panels of geometric appliqué — stars, lozenges, arches — in red, blue, green, gold on cream
function khayamiya(seed = 1, repeat = [4, 1]) {
  return canvasTex(512, 512, (g, w, h) => {
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const C = ['#b3263a', '#1f4a8a', '#2f7a4a', '#e2b04a', '#f4ece0', '#7a1f2c'];
    g.fillStyle = '#7a1f2c'; g.fillRect(0, 0, w, h);
    const P = 128;
    for (let py = 0; py < h; py += P) for (let px = 0; px < w; px += P) {
      const k = Math.floor(r() * 4);
      g.fillStyle = '#f4ece0'; g.fillRect(px + 6, py + 6, P - 12, P - 12);
      g.fillStyle = C[(k + 1) % 4]; g.fillRect(px + 14, py + 14, P - 28, P - 28);
      const cx = px + P / 2, cy = py + P / 2;
      // an eight-pointed star in the middle
      g.fillStyle = C[(k + 3) % 4];
      g.beginPath();
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? 22 : 44; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.fillStyle = '#f4ece0'; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
      // little lozenges in the corners
      g.fillStyle = C[k % 4];
      for (const [dx, dy] of [[20, 20], [P - 20, 20], [20, P - 20], [P - 20, P - 20]]) { g.beginPath(); g.moveTo(px + dx, py + dy - 9); g.lineTo(px + dx + 9, py + dy); g.lineTo(px + dx, py + dy + 9); g.lineTo(px + dx - 9, py + dy); g.fill(); }
    }
    // a border of arches along the top
    g.fillStyle = '#e2b04a';
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.arc(x + 16, 6, 12, 0, Math.PI); g.fill(); }
  }, repeat);
}
function rugTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#7a1f2c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e2b04a'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#1f4a8a'; g.fillRect(36, 36, w - 72, h - 72);
    g.fillStyle = '#e2b04a';
    for (let x = 70; x < w - 50; x += 60) for (let y = 70; y < h - 50; y += 60) { g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 14, y); g.lineTo(x, y + 14); g.lineTo(x - 14, y); g.fill(); }
  });
}
function boardTex({ title = '', big = '', line = '' } = {}) {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#1b2240'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e2b04a'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.textAlign = 'center';
    g.fillStyle = '#ffe7a0'; g.font = 'bold 40px Georgia, serif'; g.fillText(title, w / 2, 76);
    g.fillStyle = '#ffffff'; g.font = 'bold 74px Georgia, serif'; g.fillText(big, w / 2, 200);
    g.fillStyle = '#c9d2f0'; g.font = 'italic 28px Georgia, serif'; g.fillText(line, w / 2, 280);
    g.fillStyle = '#ffe7a0'; g.font = '44px serif'; g.fillText('☪︎ ✦', w / 2, 348);
  });
}

export function buildTent({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [], surfaces = [];
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const fy = group.position.y;
  const W = R.maxX - R.minX, D = R.maxZ - R.minZ;
  const wood = std('#6e472e', { roughness: 0.6 }), brass = std('#c9a25b', { metalness: 0.75, roughness: 0.3 });

  // ── the ground: rush matting, rugs over it
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#c9a46a', { roughness: 1 }));
  mat.rotation.x = -Math.PI / 2; mat.receiveShadow = true; mat.userData.floor = true;
  group.add(mat); floor.floorMesh = mat;
  for (const [x, z, w, d] of [[0, 1.5, 7.5, 3.0], [-5.6, -3.6, 3.2, 2.2], [5.6, -3.6, 3.2, 2.2]]) {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std('#ffffff', { map: rugTex(), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(x, 0.006, z); group.add(rug);
  }

  // ── the tent: khayamiya on every side, and a peaked roof
  const wallMat = s => std('#ffffff', { map: khayamiya(s, [W / 3, 1]), roughness: 0.95, side: THREE.DoubleSide });
  for (const [w, x, z, ry, s] of [[W, 0, R.minZ, 0, 3], [W, 0, R.maxZ, Math.PI, 7], [D, R.minX, 0, Math.PI / 2, 11], [D, R.maxX, 0, -Math.PI / 2, 13]]) {
    const m = at(new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), wallMat(s)), x, WALL_H / 2, z);
    m.rotation.y = ry; m.userData.surface = 'wall'; group.add(m); surfaces.push(m);
  }
  {
    // four sloping cloths up to the centre pole
    const peak = R.h - 0.05;
    const roofM = std('#ffffff', { map: khayamiya(17, [4, 2]), roughness: 0.95, side: THREE.DoubleSide });
    const corners = [[R.minX, R.minZ], [R.maxX, R.minZ], [R.maxX, R.maxZ], [R.minX, R.maxZ]];
    const pos = [], uv = [];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      pos.push(ax, WALL_H, az, bx, WALL_H, bz, 0, peak, 0);
      uv.push(0, 0, 1, 0, 0.5, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, roofM));
    group.add(at(cyl(0.08, 0.1, peak, wood, 12), 0, peak / 2, 0)); // the centre pole
    for (const [x, z] of corners) group.add(at(cyl(0.06, 0.07, WALL_H, wood, 10), x * 0.995, WALL_H / 2, z * 0.995));
    colliders.push({ type: 'circle', fixed: true, x: 0, z: 0, r: 0.16 });
  }

  // ── fanous lanterns, swaying a little, and a crescent and star
  const lanterns = [];
  const fanous = (x, z, y, i, s = 1) => {
    const g = new THREE.Group();
    const glass = std(GLASS[i % GLASS.length], { emissive: GLASS[i % GLASS.length], emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.2 });
    g.add(at(cyl(0.11 * s, 0.11 * s, 0.26 * s, glass, 6), 0, 0, 0));
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.15 * s, 0.16 * s, 6), brass), 0, 0.21 * s, 0));
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.1 * s, 6), brass).rotateX(Math.PI), 0, -0.18 * s, 0));
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.04 * s, 0.01 * s, 6, 12), brass), 0, 0.33 * s, 0));
    g.add(at(cyl(0.004, 0.004, 0.8, std('#333'), 4), 0, 0.75 * s, 0));
    g.position.set(x, y, z); group.add(g);
    lanterns.push({ g, t: i * 1.3 });
    clickable(g, { kind: 'tent-lantern', label: 'A fanous — a Ramadan lantern 🏮' });
    return g;
  };
  let li = 0;
  for (const x of [-5.5, -2.7, 2.7, 5.5]) for (const z of [-3.6, 0.2, 3.8]) fanous(x, z, 2.5 + ((li * 7) % 3) * 0.12, li++);
  fanous(0, 2.0, 3.1, li++, 1.8);
  const lights = [];
  for (const [x, z, c] of [[-4, 0, '#ffcf8f'], [4, 0, '#ffd9a6'], [0, -3.5, '#ffb870'], [0, 3.8, '#ffcf8f']]) {
    const l = new THREE.PointLight(c, 2.2, 8, 1.6); l.position.set(x, 2.4, z); group.add(l); lights.push(l);
  }
  {
    const crescent = new THREE.Group();
    const moonM = std('#ffe7a0', { emissive: '#ffd36a', emissiveIntensity: 0.9, metalness: 0.3 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 10, 40, Math.PI * 1.35), moonM);
    ring.rotation.z = Math.PI * 0.82; crescent.add(ring);
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.07 : 0.16; star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    crescent.add(at(new THREE.Mesh(new THREE.ShapeGeometry(star), moonM), 0.12, 0.05, 0));
    crescent.position.set(0, 2.25, R.minZ + 0.08); group.add(crescent);
    const banner = makeSign([{ text: 'رمضان كريم', font: 'serif', size: 150, weight: '700', color: '#ffe7a0' }, { text: 'Ramadan Kareem', font: 'Playfair Display, serif', size: 76, color: '#f4ece0' }], 2.6, 0.6, { bg: '#1b2240', border: '#e2b04a' });
    banner.position.set(0, 1.25, R.minZ + 0.06); group.add(banner);
  }

  // ── the sofra: a long low table laid for iftar, cushions down both sides
  const sofra = { x: 0, z: 1.5, w: 5.6, d: 1.1 }; // (south of the centre pole)
  {
    group.add(at(rbox(sofra.w, 0.06, sofra.d, 0.02, wood), sofra.x, 0.34, sofra.z));
    for (const a of [-1, 1]) for (const b of [-1, 1]) group.add(at(box(0.08, 0.32, 0.08, wood), sofra.x + a * (sofra.w / 2 - 0.15), 0.16, sofra.z + b * (sofra.d / 2 - 0.12)));
    group.add(at(box(sofra.w - 0.2, 0.005, 0.5, std('#e2b04a', { roughness: 0.7 })), sofra.x, 0.375, sofra.z)); // the runner
    colliders.push({ type: 'box', fixed: true, minX: sofra.x - sofra.w / 2, maxX: sofra.x + sofra.w / 2, minZ: sofra.z - sofra.d / 2, maxZ: sofra.z + sofra.d / 2 });
    const plate = std('#f4ece0', { roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const x = sofra.x - 2.3 + i * 0.92;
      for (const side of [-1, 1]) {
        const z = sofra.z + side * 0.3;
        group.add(at(cyl(0.13, 0.11, 0.02, plate, 18), x, 0.39, z));
        group.add(at(cyl(0.08, 0.06, 0.06, std('#c98a4a', { roughness: 0.4 }), 14), x, 0.43, z)); // lentil soup
        group.add(at(cyl(0.035, 0.03, 0.1, std(['#e8892a', '#9a1f2c', '#6e3f1f'][i % 3], { transparent: true, opacity: 0.85, roughness: 0.1 }), 10), x + 0.18, 0.43, z)); // qamar el-din, karkadeh, tamr hindi
      }
      // a bowl of dates in the middle
      group.add(at(cyl(0.11, 0.08, 0.05, brass, 16), x, 0.405, sofra.z));
      for (let k = 0; k < 5; k++) { const d = at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std('#4a2a18', { roughness: 0.4 })), x - 0.04 + (k % 3) * 0.04, 0.44, sofra.z - 0.02 + Math.floor(k / 3) * 0.04); d.scale.set(1, 0.7, 1.6); group.add(d); }
    }
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(sofra.w, 0.4, sofra.d), new THREE.MeshBasicMaterial({ visible: false })), sofra.x, 0.45, sofra.z);
    group.add(hit);
    clickable(hit, { kind: 'tent-iftar', label: 'The iftar table — dates, soup, qamar el-din 🌙' });
    const CUSH = ['#b3263a', '#1f4a8a', '#2f7a4a', '#e2b04a'];
    for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
      const x = sofra.x - 2.3 + i * 0.92, z = sofra.z + side * 0.95;
      const c = at(rbox(0.6, 0.16, 0.6, 0.07, std(CUSH[(i + (side > 0 ? 1 : 0)) % 4], { roughness: 1 })), x, 0.08, z);
      group.add(c);
      const seat = { id: `tent-sofra-${side < 0 ? 'n' : 's'}${i}`, label: 'a cushion at the iftar table', x, z, y: fy, h: 0.18, ry: side < 0 ? 0 : Math.PI };
      seats.push(seat);
      clickable(c, { kind: 'seat', seat, label: 'Sit down at the iftar table' });
    }
  }

  // ── two low tables for a game after iftar (games.js finds them by tableId), majlis seats round them
  [[-5.6, -3.6], [5.6, -3.6]].forEach(([x, z], n) => {
    const id = `tent-t${n + 1}`;
    const top = at(cyl(0.48, 0.48, 0.04, brass, 24), x, 0.42, z);
    top.userData = { tableId: id, top: 0.44, label: 'a low brass table', surface: 'table' };
    group.add(top); surfaces.push(top);
    group.add(at(cyl(0.3, 0.36, 0.4, wood, 8), x, 0.2, z));
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.5 });
    [[0, -0.85, 0], [0, 0.85, Math.PI], [-0.85, 0, Math.PI / 2], [0.85, 0, -Math.PI / 2]].forEach(([dx, dz, ry], ci) => {
      const c = at(rbox(0.62, 0.2, 0.62, 0.08, std(['#1f4a8a', '#b3263a', '#2f7a4a', '#e2b04a'][ci], { roughness: 1 })), x + dx, 0.1, z + dz);
      group.add(c);
      const seat = { id: `${id}-${ci}`, label: 'a cushion at a low table', x: x + dx, z: z + dz, y: fy, h: 0.22, ry, table: id };
      seats.push(seat);
      clickable(c, { kind: 'seat', seat, label: 'Sit for a game of tawla or cards' });
    });
  });
  // the majlis: long low seats along the side walls
  for (const side of [-1, 1]) {
    const x = side * (R.maxX - 0.4);
    group.add(at(rbox(0.7, 0.32, 6.0, 0.08, std('#7a1f2c', { roughness: 1 })), x, 0.16, 1.4));
    group.add(at(rbox(0.2, 0.5, 6.0, 0.08, std('#e2b04a', { roughness: 1 })), x + side * 0.28, 0.45, 1.4));
    colliders.push({ type: 'box', fixed: true, minX: x - 0.36, maxX: x + 0.36, minZ: -1.6, maxZ: 4.4 });
    for (let i = 0; i < 5; i++) {
      const z = -0.8 + i * 1.1;
      const seat = { id: `tent-majlis-${side < 0 ? 'w' : 'e'}${i}`, label: 'the majlis along the tent wall', x: x - side * 0.05, z, y: fy, h: 0.34, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2 };
      seats.push(seat);
    }
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 6.0), new THREE.MeshBasicMaterial({ visible: false })), x, 0.3, 1.4);
    group.add(hit);
    clickable(hit, { kind: 'seat', seat: seats[seats.length - 3], label: 'Sit on the majlis' });
  }

  // ── the sweets: a tray of qatayef and kunafa on a stand by the door
  {
    const x = 3.6, z = R.maxZ - 0.9;
    group.add(at(cyl(0.45, 0.45, 0.04, brass, 26), x, 0.72, z));
    group.add(at(cyl(0.05, 0.12, 0.7, wood, 10), x, 0.35, z));
    for (let i = 0; i < 8; i++) { const q = at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI), std('#d9a25a', { roughness: 0.7 })), x + Math.cos(i * 0.8) * 0.25, 0.75, z + Math.sin(i * 0.8) * 0.25); q.rotation.set(-Math.PI / 2, i * 0.8, 0); group.add(q); }
    group.add(at(cyl(0.14, 0.14, 0.05, std('#e2a04a', { roughness: 0.9 }), 18), x, 0.77, z));
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.48 });
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.0), new THREE.MeshBasicMaterial({ visible: false })), x, 0.5, z);
    group.add(hit);
    clickable(hit, { kind: 'tent-iftar', label: 'Qatayef and kunafa — help yourself 🍯' });
  }
  // ── the musaharati's drum, on its stand
  {
    const x = -3.6, z = R.maxZ - 0.9;
    const g = new THREE.Group();
    g.add(at(cyl(0.22, 0.22, 0.16, std('#b3263a', { roughness: 0.6 }), 20).rotateX(Math.PI / 2), 0, 0.9, 0));
    g.add(at(cyl(0.21, 0.21, 0.005, std('#f4ece0', { roughness: 0.9 }), 20).rotateX(Math.PI / 2), 0, 0.9, 0.085));
    g.add(at(cyl(0.012, 0.012, 0.35, wood, 6).rotateZ(0.8), 0.18, 1.05, 0.12));
    for (let k = 0; k < 3; k++) g.add(at(cyl(0.015, 0.015, 0.8, wood, 6), Math.cos(k * 2.1) * 0.15, 0.4, Math.sin(k * 2.1) * 0.15));
    g.position.set(x, 0, z); group.add(g);
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.25 });
    clickable(g, { kind: 'tent-drum', label: 'The musaharati’s drum 🥁' });
  }
  // ── the board: the countdown to Maghrib (or to Ramadan)
  const boardMat = new THREE.MeshBasicMaterial({ map: boardTex({ title: 'Ramadan', big: '…', line: '' }), toneMapped: false });
  {
    const b = at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), boardMat), R.maxX - 0.03, 1.6, -3.0);
    b.rotation.y = -Math.PI / 2; group.add(b);
    group.add(at(box(0.04, 1.15, 1.5, brass), R.maxX - 0.01, 1.6, -3.0));
    clickable(b, { kind: 'tent-board', label: 'The board — how long to iftar' });
  }
  plant(group, colliders, R.minX + 0.5, R.maxZ - 0.5, 1.0);
  plant(group, colliders, R.maxX - 0.5, R.maxZ - 0.5, 1.0);
  doorOut({ group, R: { ...R, h: WALL_H }, makeSign, interactables, color: '#7a1f2c', to: 'garden', sign: '⬅ The roof garden', label: 'Back out to the roof garden' });

  animate?.((dt, t) => { for (const l of lanterns) { l.g.rotation.z = Math.sin(t * 0.9 + l.t) * 0.05; l.g.rotation.x = Math.sin(t * 0.7 + l.t * 1.7) * 0.04; } });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.6, ry: Math.PI },
    setBoard(b) { const old = boardMat.map; boardMat.map = boardTex(b); boardMat.needsUpdate = true; old?.dispose(); },
  };
}
