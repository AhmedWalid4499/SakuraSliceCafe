// The Common room: upstairs, off the hallway, for everyone who lives above
// the café to come and chill together. A deep sofa and armchairs round a
// big TV (it plays the playlist the café chooses — see app.js), beanbags
// and floor cushions on a big rug, a coffee table with a board game on it,
// a bookshelf, a little tea counter, lamps and fairy lights, windows onto
// the Cairo evening.
//
// Like hall.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const COMMON = { minX: -8, maxX: 8, minZ: -6, maxZ: 6, h: 3.3 };
const R = COMMON;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, m) => shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m));
const box = (w, h, d, m) => shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

function plankTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let s = 41; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 8; row++) {
    for (let x = -(row % 2) * 128; x < 512; x += 256) {
      const k = 0.82 + r() * 0.18;
      g.fillStyle = `rgb(${Math.round(150 * k)},${Math.round(104 * k)},${Math.round(70 * k)})`;
      g.fillRect(x, row * 64, 256, 64);
      g.fillStyle = 'rgba(50,30,15,0.28)'; g.fillRect(x, row * 64, 3, 64);
    }
    g.fillStyle = 'rgba(50,30,15,0.28)'; g.fillRect(0, row * 64, 512, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set((R.maxX - R.minX) / 5, (R.maxZ - R.minZ) / 5);
  return t;
}
function rugTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#e9d7c1'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#b8574f'; g.lineWidth = 18; g.strokeRect(22, 22, 468, 468);
  g.strokeStyle = '#2f5d3a'; g.lineWidth = 6; g.strokeRect(50, 50, 412, 412);
  g.fillStyle = '#d4678a';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const x = 100 + i * 62, y = 100 + j * 62;
    g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x + 16, y); g.lineTo(x, y + 16); g.lineTo(x - 16, y); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCommon({ floor, makeSign }) {
  const group = floor.group;
  const W = R.maxX - R.minX, D = R.maxZ - R.minZ;
  const surfaces = [], interactables = [], seats = [];
  const wallM = std('#efe2d2', { roughness: 0.95 });
  const wood = std('#7a4e33', { roughness: 0.55 });
  const sofaM = std('#6f8f7a', { roughness: 1 });
  const cushionM = std('#e7b7c4', { roughness: 1 });
  const colliders = [];

  // floor, ceiling, walls with a sage wainscot
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#ffffff', { map: plankTex(), roughness: 0.7 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.userData.floor = true;
  group.add(floorMesh);
  floor.floorMesh = floorMesh;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#fbf3ea', { roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = R.h;
  group.add(ceil);
  for (let x = R.minX + 2; x < R.maxX; x += 4) group.add(at(box(0.2, 0.2, D, wood), x, R.h - 0.1, 0));
  const wall = (w, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, R.h), wallM);
    m.position.set(x, R.h / 2, z); m.rotation.y = ry; m.receiveShadow = true;
    m.userData.surface = 'wall'; surfaces.push(m);
    group.add(m);
    const wain = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.0), std('#93ab8c', { roughness: 0.9 }));
    wain.position.set(x, 0.5, z); wain.rotation.y = ry;
    wain.translateZ(0.004);
    group.add(wain);
  };
  wall(W, 0, R.minZ, 0);
  wall(W, 0, R.maxZ, Math.PI);
  wall(D, R.minX, 0, Math.PI / 2);
  wall(D, R.maxX, 0, -Math.PI / 2);

  // windows onto the Cairo evening (east and west walls)
  const winM = new THREE.MeshBasicMaterial({ color: '#f6c99a' });
  const skyCanvas = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#7f8fc7'); gr.addColorStop(0.6, '#f2b38e'); gr.addColorStop(1, '#f7d7a8');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#5a4a5a';
    for (let i = 0; i < 9; i++) { const w = 18 + (i * 37) % 30, h = 50 + (i * 53) % 90; g.fillRect(i * 30, 256 - h, w, h); }
    g.fillStyle = '#ffd98a';
    for (let i = 0; i < 40; i++) g.fillRect((i * 47) % 250, 256 - 20 - ((i * 31) % 100), 3, 4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  winM.map = skyCanvas;
  for (const [x, ry] of [[R.minX + 0.02, Math.PI / 2], [R.maxX - 0.02, -Math.PI / 2]]) {
    for (const z of [-2.6, 2.6]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), winM);
      w.position.set(x, 1.75, z); w.rotation.y = ry;
      group.add(w);
      const f = new THREE.Group();
      f.position.set(x, 1.75, z); f.rotation.y = ry;
      for (const [fw, fh, fx, fy] of [[1.7, 0.08, 0, 0.74], [1.7, 0.08, 0, -0.74], [0.08, 1.5, 0.82, 0], [0.08, 1.5, -0.82, 0], [0.05, 1.4, 0, 0], [1.6, 0.05, 0, 0]]) f.add(at(box(fw, fh, 0.06, wood), fx, fy, 0.03));
      f.add(at(box(1.8, 0.06, 0.22, wood), 0, -0.78, 0.1));
      group.add(f);
    }
  }

  // the TV wall (north): a low wooden console, the big screen, speakers
  const tvW = 3.0, tvH = 1.7;
  const console_ = rbox(3.6, 0.5, 0.5, 0.03, wood);
  at(console_, 0, 0.25, R.minZ + 0.3);
  group.add(console_);
  colliders.push({ type: 'box', fixed: true, minX: -1.85, maxX: 1.85, minZ: R.minZ, maxZ: R.minZ + 0.6 });
  const frame = rbox(tvW + 0.12, tvH + 0.12, 0.08, 0.02, std('#1b1c20', { roughness: 0.4 }));
  at(frame, 0, 1.75, R.minZ + 0.06);
  group.add(frame);
  const screenM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(tvW, tvH), screenM);
  screen.position.set(0, 1.75, R.minZ + 0.105);
  group.add(screen);
  const tvHit = new THREE.Mesh(new THREE.BoxGeometry(tvW + 0.2, tvH + 0.2, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
  tvHit.position.copy(screen.position);
  tvHit.userData = { kind: 'common-tv', label: 'The Common room TV — click to watch' };
  group.add(tvHit); interactables.push(tvHit);
  for (const s of [-1, 1]) {
    const sp = rbox(0.28, 0.9, 0.26, 0.04, std('#3b2a22', { roughness: 0.5 }));
    group.add(at(sp, s * 2.2, 0.45, R.minZ + 0.3));
    colliders.push({ type: 'circle', fixed: true, x: s * 2.2, z: R.minZ + 0.3, r: 0.25 });
  }
  // a plant either side, a little stack of games on the console
  const plant = (x, z, s = 1) => {
    const p = new THREE.Group();
    p.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.17 * s, 0.4 * s, 18), std('#d8a07a')), 0, 0.2 * s, 0));
    for (let i = 0; i < 9; i++) {
      const a = i * 0.8, leaf = at(new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 10, 8), std('#5f8f52')), Math.cos(a) * 0.14 * s, (0.55 + (i % 3) * 0.16) * s, Math.sin(a) * 0.14 * s);
      leaf.scale.set(0.7, 1.5, 0.7); p.add(leaf);
    }
    group.add(at(p, x, 0, z));
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.3 * s });
  };
  plant(-3.0, R.minZ + 0.45, 1.2); plant(3.0, R.minZ + 0.45, 1.2);
  ['#c7605a', '#3f5d6e', '#e8c98e'].forEach((c, i) => group.add(at(rbox(0.42, 0.07, 0.3, 0.01, std(c)), -1.2, 0.54 + i * 0.07, R.minZ + 0.3)));

  // the big rug, the sofa facing the TV, armchairs, beanbags, cushions
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.4), std('#ffffff', { map: rugTex(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -1.2); rug.receiveShadow = true;
  group.add(rug);
  const seat = (id, label, x, z, ry, h = 0.48, mesh = null) => {
    const s = { id: `common-${id}`, label, x, z, y: group.position.y, h, ry };
    seats.push(s);
    if (mesh) mesh.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat: s, label: `Sit on ${label}` }; interactables.push(o); } });
    return s;
  };
  // the sofa: three seats, facing north (towards the TV)
  {
    const g = new THREE.Group();
    g.add(at(rbox(3.0, 0.42, 0.95, 0.12, sofaM), 0, 0.28, 0));
    g.add(at(rbox(3.0, 0.62, 0.24, 0.1, sofaM), 0, 0.72, 0.38));
    for (const s of [-1, 1]) g.add(at(rbox(0.24, 0.62, 0.95, 0.1, sofaM), s * 1.5, 0.5, 0));
    for (let i = 0; i < 3; i++) g.add(at(rbox(0.9, 0.12, 0.78, 0.06, std('#87a78f', { roughness: 1 })), (i - 1) * 0.95, 0.53, -0.04));
    for (const s of [-1, 1]) { const c = at(rbox(0.42, 0.42, 0.14, 0.07, cushionM), s * 1.1, 0.78, 0.25); c.rotation.set(-0.25, s * 0.3, s * 0.1); g.add(c); }
    // a throw over one arm
    g.add(at(rbox(0.5, 0.04, 0.9, 0.02, std('#c7605a', { roughness: 1 })), 1.45, 0.82, 0));
    g.position.set(0, 0, 0.6); // its back to the room, facing the screen
    group.add(g);
    colliders.push({ type: 'box', fixed: true, minX: -1.6, maxX: 1.6, minZ: 0.1, maxZ: 1.1 });
    for (let i = 0; i < 3; i++) seat(`sofa-${i}`, 'the big sofa', (i - 1) * 0.95, 0.5, Math.PI, 0.52, i === 0 ? g : null);
  }
  // two armchairs, angled in
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.add(at(rbox(0.9, 0.42, 0.85, 0.12, std('#d9a07a', { roughness: 1 })), 0, 0.28, 0));
    g.add(at(rbox(0.9, 0.62, 0.22, 0.1, std('#d9a07a', { roughness: 1 })), 0, 0.72, 0.34));
    for (const k of [-1, 1]) g.add(at(rbox(0.18, 0.5, 0.8, 0.08, std('#d9a07a', { roughness: 1 })), k * 0.4, 0.5, 0));
    g.add(at(rbox(0.6, 0.1, 0.6, 0.05, std('#fbe3ea', { roughness: 1 })), 0, 0.53, -0.02));
    const x = s * 2.6, z = -0.4, ry = Math.PI + s * 0.55;
    g.position.set(x, 0, z); g.rotation.y = ry + Math.PI; // built facing −z; turned to face the screen
    group.add(g);
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.55 });
    seat(`arm-${s < 0 ? 'l' : 'r'}`, 'an armchair', x - Math.sin(ry) * 0.02, z - Math.cos(ry) * 0.02, ry, 0.55, g);
  }
  // beanbags and floor cushions, closer to the screen
  const bean = (x, z, color, ry) => {
    const g = new THREE.Group();
    const b = shade(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), std(color, { roughness: 1 })));
    b.scale.set(1, 0.6, 1); b.position.y = 0.26;
    g.add(b);
    g.position.set(x, 0, z);
    group.add(g);
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.42 });
    return g;
  };
  seat('bean-l', 'a beanbag', -1.3, -2.1, Math.PI, 0.36, bean(-1.3, -2.1, '#9fb8d6'));
  seat('bean-r', 'a beanbag', 1.3, -2.1, Math.PI, 0.36, bean(1.3, -2.1, '#e8c98e'));
  for (const [i, x] of [-0.4, 0.4].entries()) {
    const c = rbox(0.55, 0.14, 0.55, 0.06, i ? cushionM : std('#c9b3d9', { roughness: 1 }));
    at(c, x, 0.07, -2.6);
    group.add(c);
    seat(`cushion-${i}`, 'a floor cushion', x, -2.6, Math.PI, 0.2, c);
  }
  // the coffee table: tea, a bowl of fruit, a board game mid-play
  {
    const top = rbox(1.6, 0.06, 0.8, 0.02, wood);
    at(top, 0, 0.42, -0.6);
    group.add(top);
    for (const [lx, lz] of [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]]) group.add(at(box(0.06, 0.4, 0.06, wood), lx, 0.2, -0.6 + lz));
    top.userData.surface = 'table'; top.userData.top = 0.45 + group.position.y; top.userData.tableName = 'the coffee table';
    surfaces.push(top);
    colliders.push({ type: 'box', fixed: true, minX: -0.85, maxX: 0.85, minZ: -1.05, maxZ: -0.15 });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 12), std('#fffaf4', { roughness: 0.3 }));
    pot.scale.y = 0.85; at(pot, -0.5, 0.53, -0.65); group.add(pot);
    for (const [cx, cz] of [[-0.25, -0.45], [-0.3, -0.8], [0.15, -0.8]]) group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.07, 14), std('#fffaf4', { roughness: 0.3 })), cx, 0.485, cz));
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.4), std('#e9d6b4'));
    at(board, 0.45, 0.46, -0.55); group.add(board);
    for (let i = 0; i < 6; i++) group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 10), std(i % 2 ? '#2b1d18' : '#fffaf2')), 0.33 + (i % 3) * 0.1, 0.476, -0.62 + Math.floor(i / 3) * 0.16));
  }

  // the back of the room: a bookshelf, a tea counter with a kettle, a games shelf
  {
    const shelf = new THREE.Group();
    shelf.add(at(rbox(2.0, 2.2, 0.36, 0.02, wood), 0, 1.1, 0));
    const r = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(7);
    const bookC = ['#d4678a', '#7aab7a', '#e8b44a', '#6b8fb5', '#a0714f', '#f2a7bb', '#4d7a4d', '#efe0c4'];
    for (let row = 0; row < 4; row++) {
      shelf.add(at(box(1.9, 0.03, 0.32, std('#5e3b26')), 0, 0.25 + row * 0.52, 0.02));
      let x = -0.88;
      while (x < 0.85) {
        const w = 0.05 + r() * 0.05, h = 0.26 + r() * 0.16;
        shelf.add(at(box(w, h, 0.24, std(bookC[Math.floor(r() * bookC.length)])), x + w / 2, 0.27 + row * 0.52 + h / 2, 0.04));
        x += w + 0.008;
      }
    }
    shelf.position.set(-5.2, 0, R.maxZ - 0.22);
    shelf.rotation.y = Math.PI;
    group.add(shelf);
    colliders.push({ type: 'box', fixed: true, minX: -6.25, maxX: -4.15, minZ: R.maxZ - 0.45, maxZ: R.maxZ });
    // tea counter
    const counter = rbox(2.4, 0.95, 0.6, 0.03, std('#93ab8c', { roughness: 0.8 }));
    at(counter, 5.0, 0.475, R.maxZ - 0.35);
    const ctop = rbox(2.5, 0.05, 0.66, 0.02, wood);
    at(ctop, 5.0, 0.97, R.maxZ - 0.35);
    group.add(counter, ctop);
    ctop.userData.surface = 'table'; ctop.userData.top = 0.995 + group.position.y; ctop.userData.tableName = 'the tea counter';
    surfaces.push(ctop);
    colliders.push({ type: 'box', fixed: true, minX: 3.75, maxX: 6.25, minZ: R.maxZ - 0.7, maxZ: R.maxZ });
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), std('#c7605a', { roughness: 0.35 }));
    kettle.scale.y = 0.9; at(kettle, 4.4, 1.09, R.maxZ - 0.35); group.add(kettle);
    for (let i = 0; i < 4; i++) group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 14), std(['#fffaf4', '#f2a7bb', '#93ab8c', '#e8c98e'][i], { roughness: 0.3 })), 5.0 + i * 0.16, 1.04, R.maxZ - 0.25));
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 18), new THREE.MeshStandardMaterial({ color: '#f5fbff', transparent: true, opacity: 0.45, roughness: 0.05 }));
    at(jar, 5.8, 1.11, R.maxZ - 0.38); group.add(jar);
    const sign = makeSign([{ text: 'help yourself', font: 'Dancing Script, cursive', size: 120, weight: '700', color: '#c4627f' }, { text: 'tea · biscuits · good company', size: 60 }], 1.0, 0.32);
    sign.position.set(5.0, 1.75, R.maxZ - 0.02); sign.rotation.y = Math.PI;
    group.add(sign);
  }
  plant(R.minX + 0.5, R.maxZ - 0.5, 1); plant(R.maxX - 0.5, R.minZ + 0.5, 0.9);

  // lamps: a warm ceiling lamp over the sofa, two floor lamps, fairy lights round the top
  const lights = [];
  for (const [x, z, i] of [[0, -1, 3.2], [-5, 3, 2.2], [5, 3, 2.2]]) {
    const l = new THREE.PointLight('#ffd6a0', i, 12, 1.5);
    l.position.set(x, R.h - 0.5, z);
    group.add(l); lights.push(l);
    const lamp = at(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.3, 24, 1, true), std('#fff1dc', { emissive: '#ffd9a6', emissiveIntensity: 0.55, side: THREE.DoubleSide })), x, R.h - 0.45, z);
    group.add(lamp);
    group.add(at(box(0.01, 0.3, 0.01, std('#3a3030')), x, R.h - 0.15, z));
  }
  for (const s of [-1, 1]) {
    const x = s * 3.9, z = 0.9;
    group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 10), wood), x, 0.75, z));
    group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 20, 1, true), std('#fff1dc', { emissive: '#ffd9a6', emissiveIntensity: 0.6, side: THREE.DoubleSide })), x, 1.6, z));
    const l = new THREE.PointLight('#ffcf94', 1.1, 5, 1.6);
    l.position.set(x, 1.5, z); group.add(l);
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.2 });
  }
  const bulbM = new THREE.MeshBasicMaterial({ color: '#ffe2a8' });
  const bulbG = new THREE.SphereGeometry(0.03, 8, 6);
  for (let i = 0; i < 64; i++) {
    const k = i / 64, per = 2 * (W + D);
    let d = k * per, x, z;
    if (d < W) { x = R.minX + d; z = R.minZ + 0.05; } else if ((d -= W) < D) { x = R.maxX - 0.05; z = R.minZ + d; } else if ((d -= D) < W) { x = R.maxX - d; z = R.maxZ - 0.05; } else { d -= W; x = R.minX + 0.05; z = R.maxZ - d; }
    group.add(at(new THREE.Mesh(bulbG, bulbM), x, R.h - 0.18 - Math.abs(Math.sin(i * 0.8)) * 0.12, z));
  }

  // the door back out to the hallway (south wall, middle)
  {
    const g = new THREE.Group();
    g.position.set(0, 0, R.maxZ); g.rotation.y = Math.PI;
    for (const s of [-1, 1]) g.add(at(rbox(0.7, 2.25, 0.05, 0.015, std('#6e472e', { roughness: 0.55 })), s * 0.36, 1.125, 0.025));
    for (const [w, h, dx, y] of [[0.1, 2.35, -0.77, 1.175], [0.1, 2.35, 0.77, 1.175], [1.64, 0.1, 0, 2.35]]) g.add(at(box(w, h, 0.08, wood), dx, y, 0.04));
    const sign = makeSign([{ text: '⬅ The hallway', size: 100, weight: '700' }], 0.9, 0.24);
    sign.position.set(0, 2.62, 0.04);
    g.add(sign);
    const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), new THREE.MeshBasicMaterial({ visible: false })), 0, 1.15, 0.1);
    hit.userData = { kind: 'common-out', label: 'Back out to the hallway' };
    g.add(hit); interactables.push(hit);
    group.add(g);
    const name = makeSign([{ text: 'The Common Room', size: 120, weight: '700' }, { text: 'for everyone who lives upstairs 🌸', font: 'Dancing Script, cursive', size: 80, color: '#c4627f' }], 1.8, 0.5);
    name.position.set(0, 2.85, R.minZ + 0.02);
    group.add(name);
  }

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  // what the TV shows: off, or the title of what's playing
  function setTV(tv) {
    const c = document.createElement('canvas'); c.width = 768; c.height = 432;
    const g = c.getContext('2d');
    if (!tv || !(tv.list || tv.videoId)) {
      g.fillStyle = '#15171c'; g.fillRect(0, 0, 768, 432);
      g.fillStyle = '#6c7280'; g.font = 'italic 30px Georgia, serif'; g.textAlign = 'center';
      g.fillText('Nothing on just yet', 384, 220);
    } else {
      const gr = g.createLinearGradient(0, 0, 768, 432); gr.addColorStop(0, '#2d2340'); gr.addColorStop(1, '#5a2a3c');
      g.fillStyle = gr; g.fillRect(0, 0, 768, 432);
      g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(344, 130); g.lineTo(344, 250); g.lineTo(448, 190); g.fill();
      g.textAlign = 'center';
      g.font = 'bold 34px Georgia, serif'; g.fillStyle = '#fbe3ea'; g.fillText(tv.list ? 'On the Common room TV' : 'Now showing', 384, 320);
      g.font = 'italic 28px Georgia, serif'; g.fillStyle = '#f4ece0'; g.fillText(String(tv.title || '').slice(0, 44), 384, 362);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    if (screenM.map) screenM.map.dispose();
    screenM.map = t; screenM.needsUpdate = true;
  }
  setTV(null);

  return {
    setTV, lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 3.2, ry: Math.PI }, // a few steps in from the door, facing the TV
  };
}
