// The Kids' Playroom: on the second floor, off the landing. A ball pit to
// jump into, a soft play mat with building blocks (click and the tower grows —
// knock it down and start again), a little slide, crayons on a low table, and
// the story corner, where Hana sits in a big armchair with picture books and
// reads to whoever sits on the cushions (app.js).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, shell, doorOut, plant, pendant } from './roomkit.js';

export const PLAYROOM = { minX: -6.5, maxX: 6.5, minZ: -5, maxZ: 5, h: 3.2 };
const R = PLAYROOM;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const TOY = ['#e58aa6', '#5f8fc4', '#e2b04a', '#6f9f63', '#c94a4a', '#7a3fa0', '#e07a2a'];

function matTex() {
  return canvasTex(256, 256, (g, w) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = TOY[(i + j * 2) % 6]; g.fillRect(i * 64, j * 64, 64, 64); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(i * 64 + 4, j * 64 + 4, 56, 56); }
  }, [3, 2]);
}

export function buildPlayroom({ floor, makeSign, animate, buildAvatar }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: canvasTex(64, 64, (g, w) => { g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, w, w); }, [1, 1]),
    wallColor: '#fdf3e6', lowColor: '#9fd0c0', windows: { east: [-2, 2] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  // painted clouds and a rainbow on the north wall
  {
    const art = at(new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), std('#ffffff', {
      map: canvasTex(1024, 288, (g, w, h) => {
        g.fillStyle = '#dff1ff'; g.fillRect(0, 0, w, h);
        const RB = ['#e58aa6', '#e07a2a', '#e2b04a', '#6f9f63', '#5f8fc4', '#7a3fa0'];
        RB.forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 18; g.beginPath(); g.arc(w / 2, h + 40, 260 - i * 18, Math.PI, 0); g.stroke(); });
        g.fillStyle = '#ffffff';
        for (const [x, y] of [[140, 80], [860, 70], [520, 50]]) for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 34 - 50, y + (k % 2) * 10, 30, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(940, 200, 40, 0, Math.PI * 2); g.fill();
      }), roughness: 1,
    })), 0, 1.9, R.minZ + 0.02);
    group.add(art);
  }

  // ── the ball pit
  {
    const x = -3.6, z = -2.6, w = 3.0, d = 2.4;
    const wallM = std('#5f8fc4', { roughness: 0.8 });
    for (const [bw, bd, dx, dz] of [[w, 0.2, 0, -d / 2], [w, 0.2, 0, d / 2], [0.2, d, -w / 2, 0], [0.2, d, w / 2, 0]]) group.add(at(rbox(bw, 0.55, bd, 0.08, wallM), x + dx, 0.275, z + dz));
    const balls = new THREE.Group();
    const geo = new THREE.SphereGeometry(0.09, 10, 8);
    const mats = TOY.map(c => std(c, { roughness: 0.35 }));
    for (let i = 0; i < 220; i++) { const b = new THREE.Mesh(geo, mats[i % mats.length]); b.position.set(x - w / 2 + 0.25 + ((i * 37) % 100) / 100 * (w - 0.5), 0.1 + (i % 4) * 0.09, z - d / 2 + 0.25 + ((i * 61) % 100) / 100 * (d - 0.5)); balls.add(b); }
    group.add(balls);
    block(x, z, w + 0.2, d + 0.2);
    [[x - 0.7, z], [x + 0.7, z], [x, z + 0.5]].forEach(([sx, sz], i) => seats.push({ id: `play-pit-${i}`, label: 'the ball pit', x: sx, z: sz, y: fy + 0.15, h: 0.12, ry: (i * 2.1) % (Math.PI * 2) }));
    clickable(balls, { kind: 'play-pit', label: 'The ball pit — jump in! 🟡🔴🔵' });
    const sign = makeSign([{ text: 'Ball pit!', size: 120, weight: '700', color: '#c94a4a' }], 0.8, 0.22, { bg: '#fffaf0' });
    sign.position.set(x, 0.85, z + d / 2 + 0.12); sign.rotation.y = 0; group.add(sign);
  }
  // ── the play mat and the building blocks
  const tower = new THREE.Group();
  {
    const x = 2.6, z = -1.8;
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), std('#ffffff', { map: matTex(), roughness: 1 }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(x, 0.006, z); group.add(mat);
    for (let i = 0; i < 14; i++) group.add(at(rbox(0.16, 0.16, 0.16, 0.02, std(TOY[i % TOY.length], { roughness: 0.6 })), x - 1.2 + (i % 5) * 0.32 + (i % 2) * 0.05, 0.08, z + 0.6 + Math.floor(i / 5) * 0.25).rotateY(i * 0.4));
    tower.position.set(x, 0, z - 0.2); group.add(tower);
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 2.4), new THREE.MeshBasicMaterial({ visible: false })), x, 0.25, z);
    group.add(hit);
    clickable(hit, { kind: 'play-blocks', label: 'Building blocks — build a tower 🧱' });
    [[x - 0.8, z - 0.6, 0.6], [x + 0.8, z - 0.6, -0.6]].forEach(([sx, sz, ry], i) => seats.push({ id: `play-mat-${i}`, label: 'the play mat', x: sx, z: sz, y: fy, h: 0.06, ry }));
  }
  // ── a little slide
  {
    const x = 4.8, z = 2.6;
    const g = new THREE.Group();
    g.add(at(rbox(0.9, 0.9, 0.9, 0.08, std('#e2b04a', { roughness: 0.6 })), 0, 0.45, 0));
    const slide = at(rbox(0.6, 0.06, 1.6, 0.03, std('#e58aa6', { roughness: 0.3 })), 0, 0.5, 1.1); slide.rotation.x = 0.55; g.add(slide);
    for (let i = 0; i < 3; i++) g.add(at(box(0.6, 0.06, 0.12, std('#5f8fc4')), 0, 0.15 + i * 0.25, -0.5 - i * 0.05));
    g.position.set(x, 0, z); g.rotation.y = Math.PI; group.add(g);
    block(x, z - 0.3, 1.0, 2.4);
    clickable(g, { kind: 'play-slide', label: 'The slide — wheee! 🛝' });
  }
  // ── crayons at a low table, little chairs
  {
    const x = -0.2, z = 1.4;
    group.add(at(rbox(1.2, 0.05, 0.8, 0.02, std('#fffaf0', { roughness: 0.6 })), x, 0.45, z));
    for (const a of [-1, 1]) for (const b of [-1, 1]) group.add(at(cyl(0.03, 0.03, 0.43, std(TOY[(a + 2) * (b + 2) % 6]), 8), x + a * 0.5, 0.215, z + b * 0.3));
    block(x, z, 1.2, 0.8);
    for (let i = 0; i < 8; i++) group.add(at(cyl(0.008, 0.008, 0.1, std(TOY[i % TOY.length]), 6).rotateZ(Math.PI / 2), x - 0.3 + i * 0.07, 0.48, z - 0.1 + (i % 2) * 0.05));
    group.add(at(box(0.3, 0.005, 0.22, std('#ffffff')), x + 0.25, 0.476, z + 0.1));
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), new THREE.MeshBasicMaterial({ visible: false })), x, 0.55, z);
    group.add(hit);
    clickable(hit, { kind: 'play-crayons', label: 'Crayons and paper' });
    [[-0.85, 0, Math.PI / 2], [0.85, 0, -Math.PI / 2]].forEach(([dx, dz, ry], i) => {
      const c = new THREE.Group();
      c.add(at(rbox(0.32, 0.04, 0.32, 0.02, std(TOY[i + 2])), 0, 0.28, 0));
      c.add(at(rbox(0.32, 0.26, 0.04, 0.02, std(TOY[i + 2])), 0, 0.42, -0.15));
      for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(at(box(0.03, 0.28, 0.03, std('#fffaf0')), a * 0.13, 0.14, b * 0.13));
      c.position.set(x + dx, 0, z + dz); c.rotation.y = ry; group.add(c);
      const s = { id: `play-chair-${i}`, label: 'a little chair', x: x + dx, z: z + dz, y: fy, h: 0.3, ry };
      seats.push(s);
      clickable(c, { kind: 'seat', seat: s, label: 'Sit on a little chair' });
    });
  }
  // ── the story corner: Hana in the big armchair, cushions in front, a shelf of picture books
  let hana = null;
  {
    const x = -4.2, z = 2.6;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), std('#f6c6d6', { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(x + 0.8, 0.006, z); group.add(rug);
    const chairM = std('#93ab8c', { roughness: 1 });
    const a = new THREE.Group();
    a.add(at(rbox(0.9, 0.45, 0.85, 0.12, chairM), 0, 0.25, 0));
    a.add(at(rbox(0.9, 0.75, 0.2, 0.1, chairM), 0, 0.75, -0.35));
    for (const s of [-1, 1]) a.add(at(rbox(0.18, 0.35, 0.85, 0.08, chairM), s * 0.42, 0.6, 0));
    a.position.set(x - 0.6, 0, z); a.rotation.y = Math.PI / 2; group.add(a);
    colliders.push({ type: 'circle', fixed: true, x: x - 0.6, z, r: 0.5 });
    if (buildAvatar) {
      hana = buildAvatar({ body: 'person', skin: '#f1c9a8', hair: '#2a1d1a', hairStyle: 'bob', outfit: '#f2a7bb', accent: '#fffaf0', accessory: 'none' });
      hana.group.position.set(x - 0.55, fy - fy + 0.0, z); hana.group.rotation.y = Math.PI / 2;
      group.add(hana.group);
      const book = at(rbox(0.3, 0.22, 0.03, 0.01, std('#e2b04a')), x - 0.2, 0.95, z); book.rotation.y = Math.PI / 2; book.rotation.x = -0.3; group.add(book);
    }
    clickable(a, { kind: 'play-story', label: 'Hana’s story corner — sit and listen 📖' });
    [[x + 0.6, z - 0.7], [x + 0.9, z], [x + 0.6, z + 0.7]].forEach(([cx, cz], i) => {
      const c = at(rbox(0.5, 0.14, 0.5, 0.07, std(TOY[i * 2], { roughness: 1 })), cx, 0.07, cz);
      group.add(c);
      const s = { id: `play-story-${i}`, label: 'a cushion in the story corner', x: cx, z: cz, y: fy, h: 0.16, ry: -Math.PI / 2 + (i - 1) * 0.4 };
      seats.push(s);
      clickable(c, { kind: 'play-story', seat: s, label: 'Sit for a story 📖' });
    });
    const shelf = new THREE.Group();
    shelf.add(at(box(1.4, 0.9, 0.3, std('#fffaf0', { roughness: 0.6 })), 0, 0.45, 0));
    for (let i = 0; i < 8; i++) shelf.add(at(box(0.14, 0.26, 0.02, std(TOY[i % TOY.length])), -0.55 + i * 0.16, 0.7, 0.15).rotateX(-0.15));
    shelf.position.set(x, 0, R.maxZ - 0.2); shelf.rotation.y = Math.PI; group.add(shelf);
    block(x, R.maxZ - 0.2, 1.4, 0.32);
    const sign = makeSign([{ text: '📖 Story corner', size: 100, weight: '700' }, { text: 'with Hana, every evening', size: 60 }], 1.0, 0.32, { bg: '#fbe3ea' });
    sign.position.set(R.minX + 0.03, 2.1, z); sign.rotation.y = Math.PI / 2; group.add(sign);
  }
  const name = makeSign([{ text: 'The Playroom', size: 120, weight: '700', color: '#5f8fc4' }, { text: 'for the little ones 🧸', font: 'Dancing Script, cursive', size: 76, color: '#e58aa6' }], 1.6, 0.44, { bg: '#fffaf0' });
  name.position.set(2.6, 2.75, R.maxZ - 0.03); name.rotation.y = Math.PI; group.add(name);
  plant(group, colliders, R.maxX - 0.45, R.minZ + 0.45, 1.0);
  const lights = [pendant(group, R, -3, 0, { intensity: 2.6 }), pendant(group, R, 3, 0, { intensity: 2.6 })];
  doorOut({ group, R, makeSign, interactables, color: '#e2b04a', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  // the tower of blocks: grows by one each click, and falls over at twelve
  const BLOCK = new THREE.BoxGeometry(0.22, 0.16, 0.22);
  let fall = 0;
  function addBlock() {
    if (fall > 0) return tower.children.length;
    const n = tower.children.length;
    const b = new THREE.Mesh(BLOCK, std(TOY[n % TOY.length], { roughness: 0.6 }));
    b.position.set((Math.random() - 0.5) * 0.04, 0.08 + n * 0.16, (Math.random() - 0.5) * 0.04);
    b.rotation.y = (Math.random() - 0.5) * 0.3; b.castShadow = true;
    tower.add(b);
    if (n + 1 >= 12) fall = 1.2;
    return n + 1;
  }
  animate?.((dt, t) => {
    if (hana) hana.update(dt, { sitting: true, sitH: 0.46 });
    if (fall > 0) {
      fall -= dt;
      tower.children.forEach((b, i) => { b.rotation.z += dt * (0.5 + i * 0.15); b.position.x += dt * i * 0.12; b.position.y = Math.max(0.08, b.position.y - dt * 1.2); });
      if (fall <= 0) { tower.children.slice().forEach(b => { tower.remove(b); b.material.dispose(); }); }
    }
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.4, ry: Math.PI },
    addBlock, hana,
    pitSeats: seats.filter(s => s.id.startsWith('play-pit')),
  };
}
