// The BookBeans Library and Writers' Nook: on the second floor, off the
// landing. Shelves floor to ceiling with a rolling ladder, armchairs round a
// rug, the BookBeans coffee bar, the author's shelf (the café owner's own
// novellas, face out, each with a "Read on Kindle" link — site_content
// 'library.books'), a typewriter desk and writing desks where you sit and
// write with the study timer, and a board of today's word count.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, plankTex, canvasTex, shell, doorOut, plant, pendant, chair } from './roomkit.js';

export const LIBRARY = { minX: -8, maxX: 8, minZ: -5.5, maxZ: 5.5, h: 3.6 };
const R = LIBRARY;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const SPINES = ['#7c1f2c', '#2f5d3a', '#2f3f6e', '#8a5a2a', '#c4627f', '#e8c98e', '#5f8fc4', '#6e472e', '#93ab8c', '#3a2f3a', '#b85c38', '#d4a373'];

// a shelf's worth of book spines, as a texture
function spinesTex(seed, w = 512, h = 512) {
  return canvasTex(w, h, g => {
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#4a2f22'; g.fillRect(0, 0, w, h);
    const rows = 5, rh = h / rows;
    for (let row = 0; row < rows; row++) {
      let x = 4;
      while (x < w - 6) {
        const bw = 10 + r() * 16, bh = rh * (0.62 + r() * 0.3);
        if (r() < 0.06) { x += bw * 1.5; continue; } // a gap
        g.fillStyle = SPINES[Math.floor(r() * SPINES.length)];
        g.fillRect(x, row * rh + rh - 8 - bh, bw - 2, bh);
        g.fillStyle = 'rgba(255,230,180,.5)';
        g.fillRect(x + 2, row * rh + rh - 8 - bh + bh * 0.18, bw - 6, 2);
        g.fillRect(x + 2, row * rh + rh - 8 - bh + bh * 0.78, bw - 6, 2);
        x += bw;
      }
      g.fillStyle = '#6e472e'; g.fillRect(0, row * rh + rh - 8, w, 8); // the shelf
    }
  });
}
// a book face out: its cover, with the title on it
function coverTex(book, i) {
  return canvasTex(256, 384, (g, w, h) => {
    const c = SPINES[(i * 5 + 2) % SPINES.length];
    g.fillStyle = book ? c : '#e9dccb'; g.fillRect(0, 0, w, h);
    g.strokeStyle = book ? 'rgba(255,240,210,.8)' : '#c9b49a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = book ? '#fff6e6' : '#9a8670'; g.textAlign = 'center';
    if (!book) { g.font = 'italic 26px Georgia, serif'; g.fillText('coming soon', w / 2, h / 2); return; }
    // the title, wrapped
    g.font = 'bold 30px Georgia, serif';
    const words = String(book.title || '').split(/\s+/); const lines = []; let line = '';
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w - 50 && line) { lines.push(line); line = wd; } else line = t; }
    if (line) lines.push(line);
    lines.slice(0, 5).forEach((l, k) => g.fillText(l, w / 2, 110 + k * 38));
    g.font = 'italic 22px Georgia, serif'; g.fillText(book.author || 'Ahmed Walid', w / 2, h - 60);
    g.font = '40px serif'; g.fillText('🌸', w / 2, h - 110);
  });
}
function wordsTex(words) {
  return canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#26302a'; g.fillRect(0, 0, w, h); // a blackboard
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 18; g.strokeRect(0, 0, w, h);
    g.fillStyle = '#f4ece0'; g.textAlign = 'center';
    g.font = 'bold 42px Georgia, serif'; g.fillText('Today’s word count', w / 2, 74);
    g.font = 'bold 84px Georgia, serif'; g.fillStyle = '#ffd98a';
    g.fillText(((words && words.total) || 0).toLocaleString('en-GB'), w / 2, 180);
    g.font = 'italic 26px Georgia, serif'; g.fillStyle = '#c9d6c2'; g.fillText('words written here today', w / 2, 220);
    const list = (words && words.writers) || [];
    g.font = '30px Georgia, serif';
    if (!list.length) { g.fillStyle = '#9fb0a0'; g.fillText('Sit at a desk and write —', w / 2, 320); g.fillText('your words go up here.', w / 2, 360); }
    list.slice(0, 6).forEach((wr, i) => {
      g.fillStyle = i ? '#f4ece0' : '#f2a7bb';
      g.fillText(`${String(wr.name).slice(0, 14)} · ${Number(wr.words).toLocaleString('en-GB')}`, w / 2, 310 + i * 48);
    });
    g.font = 'italic 22px Georgia, serif'; g.fillStyle = '#9fb0a0'; g.fillText('(Cairo time — it starts again at midnight)', w / 2, h - 34);
  });
}

export function buildLibrary({ floor, makeSign }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [120, 80, 52], 61),
    wallColor: '#efe1cf', lowColor: '#5a3a26', ceilColor: '#e8dccb',
    windows: { east: [-2.6, 2.6] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const wood = std('#6e472e', { roughness: 0.55 });
  const fy = group.position.y;

  // ── the shelves: floor to ceiling along the north and west walls
  const shelf = (x, z, w, ry, seed) => {
    const g = new THREE.Group();
    g.add(at(box(w, R.h - 0.1, 0.42, wood), 0, (R.h - 0.1) / 2, 0));
    const face = at(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, R.h - 0.3), std('#ffffff', { map: spinesTex(seed), roughness: 0.8 })), 0, (R.h - 0.1) / 2, 0.215);
    g.add(face);
    g.position.set(x, 0, z); g.rotation.y = ry;
    group.add(g);
    clickable(face, { kind: 'lib-shelf', label: 'The shelves — every kind of book' });
    return g;
  };
  shelf(-5.4, R.minZ + 0.21, 5.0, 0, 7);
  shelf(4.6, R.minZ + 0.21, 6.4, 0, 19);
  shelf(R.minX + 0.21, -2.4, 5.6, Math.PI / 2, 31);
  block(-5.4, R.minZ + 0.21, 5.0, 0.45); block(4.6, R.minZ + 0.21, 6.4, 0.45); block(R.minX + 0.21, -2.4, 0.45, 5.6);
  // the rolling ladder, on its rail along the north shelves
  {
    group.add(at(cyl(0.02, 0.02, 11.2, std('#c9a25b', { metalness: 0.7, roughness: 0.3 }), 8).rotateZ(Math.PI / 2), -0.4, R.h - 0.35, R.minZ + 0.5));
    const lad = new THREE.Group();
    for (const s of [-1, 1]) { const rail = at(box(0.05, R.h - 0.3, 0.05, std('#8a5a3c')), s * 0.24, (R.h - 0.3) / 2, 0); lad.add(rail); }
    for (let i = 0; i < 9; i++) lad.add(at(box(0.48, 0.04, 0.06, std('#8a5a3c')), 0, 0.3 + i * 0.36, 0));
    for (const s of [-1, 1]) lad.add(at(cyl(0.04, 0.04, 0.03, std('#333'), 12).rotateZ(Math.PI / 2), s * 0.24, 0.04, 0));
    lad.position.set(2.6, 0, R.minZ + 0.75); lad.rotation.x = -0.22;
    group.add(lad);
    clickable(lad, { kind: 'lib-ladder', label: 'The rolling ladder' });
  }

  // ── the author's shelf: the owner's own books, face out, by the door
  const covers = [];
  {
    const x = -1.0, z = R.minZ + 0.25;
    const g = new THREE.Group();
    g.add(at(box(2.2, 2.6, 0.36, std('#8a5a3c', { roughness: 0.5 })), 0, 1.3, 0));
    for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) {
      const c = at(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), new THREE.MeshStandardMaterial({ map: coverTex(null, 0), roughness: 0.6 })), -0.66 + i * 0.66, 1.75 - row * 0.85, 0.2);
      c.rotation.x = -0.08;
      g.add(c); covers.push(c);
      g.add(at(box(2.1, 0.04, 0.3, std('#6e472e')), 0, 1.42 - row * 0.85, 0.05));
    }
    const sign = makeSign([{ text: 'The author’s shelf', size: 100, weight: '700' }, { text: 'novellas by the owner · read on Kindle', size: 56 }], 1.6, 0.36, { bg: '#f3e1d0' });
    sign.position.set(0, 2.85, 0.2); g.add(sign);
    g.position.set(x, 0, z); group.add(g);
    block(x, z, 2.2, 0.5);
    clickable(g, { kind: 'lib-author', label: 'The author’s shelf — the owner’s novellas 📖' });
  }

  // ── armchairs round a rug, a low table, floor lamps
  {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), std('#7c1f2c', { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-3.6, 0.006, 1.4); group.add(rug);
    const rug2 = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.6, 40), std('#e8c98e', { roughness: 1 }));
    rug2.rotation.x = -Math.PI / 2; rug2.position.set(-3.6, 0.008, 1.4); group.add(rug2);
    group.add(at(cyl(0.45, 0.45, 0.05, wood, 24), -3.6, 0.42, 1.4));
    group.add(at(cyl(0.06, 0.08, 0.4, wood, 10), -3.6, 0.2, 1.4));
    group.add(at(rbox(0.22, 0.05, 0.3, 0.01, std('#2f5d3a')), -3.5, 0.47, 1.35)); // a book on it
    group.add(at(cyl(0.05, 0.04, 0.09, std('#fffaf4'), 12), -3.8, 0.49, 1.5)); // a cup
    colliders.push({ type: 'circle', fixed: true, x: -3.6, z: 1.4, r: 0.5 });
    const ARM = ['#2f5d3a', '#7c1f2c', '#2f3f6e', '#8a5a2a'];
    [[0, -1.25, 0], [0, 1.25, Math.PI], [-1.25, 0, Math.PI / 2], [1.25, 0, -Math.PI / 2]].forEach(([dx, dz, ry], i) => {
      const x = -3.6 + dx, z = 1.4 + dz, m = std(ARM[i], { roughness: 1 });
      const a = new THREE.Group();
      a.add(at(rbox(0.8, 0.42, 0.75, 0.1, m), 0, 0.25, 0));
      a.add(at(rbox(0.8, 0.6, 0.18, 0.08, m), 0, 0.68, -0.3));
      for (const s of [-1, 1]) a.add(at(rbox(0.16, 0.3, 0.75, 0.07, m), s * 0.36, 0.55, 0));
      a.position.set(x, 0, z); a.rotation.y = ry; group.add(a);
      colliders.push({ type: 'circle', fixed: true, x, z, r: 0.38 });
      const s = { id: `library-arm-${i}`, label: 'an armchair', x, z, y: fy, h: 0.46, ry };
      seats.push(s);
      clickable(a, { kind: 'seat', seat: s, label: 'Sink into an armchair with a book' });
    });
    for (const [x, z] of [[-5.2, -0.1], [-2.0, 2.9]]) {
      group.add(at(cyl(0.015, 0.015, 1.5, std('#333'), 8), x, 0.75, z));
      group.add(at(cyl(0.16, 0.22, 0.26, std('#fff1d6', { emissive: '#ffcf8f', emissiveIntensity: 0.6, side: THREE.DoubleSide }), 20), x, 1.55, z));
      const l = new THREE.PointLight('#ffd9a6', 1.1, 4, 1.8); l.position.set(x, 1.4, z); group.add(l);
    }
  }

  // ── the writers' nook: the typewriter desk and two writing desks by the windows
  const desk = (x, z, ry, i, typewriter) => {
    const g = new THREE.Group();
    g.add(at(rbox(1.3, 0.05, 0.65, 0.02, std('#8a5a3c', { roughness: 0.5 })), 0, 0.76, 0));
    for (const a of [-1, 1]) g.add(at(box(0.05, 0.74, 0.6, wood), a * 0.6, 0.37, 0));
    if (typewriter) {
      g.add(at(rbox(0.42, 0.14, 0.32, 0.04, std('#2a3a33', { roughness: 0.4, metalness: 0.3 })), 0, 0.86, -0.05));
      g.add(at(cyl(0.03, 0.03, 0.46, std('#222'), 12).rotateZ(Math.PI / 2), 0, 0.97, -0.16));
      g.add(at(box(0.3, 0.2, 0.005, std('#fffdf6')), 0, 1.07, -0.18)); // the page in it
      for (let k = 0; k < 12; k++) g.add(at(cyl(0.012, 0.012, 0.01, std('#e8e0d0'), 8), -0.15 + (k % 6) * 0.06, 0.94, 0.04 + Math.floor(k / 6) * 0.05));
    } else {
      g.add(at(box(0.3, 0.01, 0.22, std('#fffdf6')), -0.1, 0.79, 0.05)); // a notebook
      g.add(at(cyl(0.005, 0.005, 0.15, std('#2f3f6e'), 6).rotateZ(Math.PI / 2), 0.12, 0.79, 0.1));
      g.add(at(cyl(0.012, 0.012, 0.35, std('#c9a25b', { metalness: 0.6 }), 8), 0.48, 0.95, -0.2));
      g.add(at(cyl(0.08, 0.12, 0.12, std('#2f5d3a', { side: THREE.DoubleSide }), 16, 1, true), 0.48, 1.15, -0.2)); // a banker's lamp
    }
    g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    const turned = Math.abs(Math.sin(ry)) > 0.5;
    block(x, z, turned ? 0.65 : 1.3, turned ? 1.3 : 0.65);
    // the chair in front of it, facing it
    const cx = x + Math.sin(ry) * 0.6, cz = z + Math.cos(ry) * 0.6;
    const s = chair(group, seats, interactables, { id: `library-desk-${i}`, label: typewriter ? 'the typewriter desk' : 'a writing desk', x: cx, z: cz, ry: ry + Math.PI, color: '#2f5d3a', y0: fy });
    clickable(g, { kind: 'lib-write', seat: s, label: typewriter ? 'The typewriter desk — sit and write ✍️' : 'A writing desk — sit and write ✍️' });
  };
  desk(R.maxX - 0.45, -2.6, -Math.PI / 2, 0, true);
  desk(R.maxX - 0.45, 0.0, -Math.PI / 2, 1, false);
  desk(R.maxX - 0.45, 2.6, -Math.PI / 2, 2, false);
  // the word-count board between the windows
  const wordsMat = new THREE.MeshBasicMaterial({ map: wordsTex(null), toneMapped: false });
  {
    const b = at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), wordsMat), R.maxX - 0.03, 1.8, -1.3);
    b.rotation.y = -Math.PI / 2; group.add(b);
    clickable(b, { kind: 'lib-words', label: 'Today’s word count' });
    const sign = makeSign([{ text: 'The writers’ nook', size: 100, weight: '700' }, { text: 'sit · write · count your words', font: 'Dancing Script, cursive', size: 64, color: '#c4627f' }], 1.4, 0.38, { bg: '#f3e1d0' });
    sign.position.set(R.maxX - 0.03, 3.0, 0); sign.rotation.y = -Math.PI / 2;
    group.add(sign);
  }

  // ── the BookBeans coffee bar, by the door
  {
    const x = 4.4, z = R.maxZ - 0.45;
    group.add(at(rbox(2.4, 1.0, 0.6, 0.03, std('#5a3a26', { roughness: 0.5 })), x, 0.5, z));
    group.add(at(rbox(2.5, 0.05, 0.66, 0.02, std('#e8dccb', { roughness: 0.4 })), x, 1.02, z));
    group.add(at(rbox(0.4, 0.45, 0.35, 0.04, std('#c0c4c8', { metalness: 0.7, roughness: 0.3 })), x - 0.6, 1.27, z)); // the espresso machine
    for (let i = 0; i < 4; i++) group.add(at(cyl(0.05, 0.04, 0.09, std('#fffaf4'), 12), x + 0.1 + i * 0.16, 1.09, z - 0.05));
    group.add(at(cyl(0.12, 0.12, 0.3, std('#e8f2f4', { transparent: true, opacity: 0.5 }), 16), x + 0.85, 1.2, z)); // a jar of beans
    for (let i = 0; i < 10; i++) group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), std('#4a2a18')), x + 0.8 + (i % 3) * 0.04, 1.08 + Math.floor(i / 3) * 0.04, z - 0.03 + (i % 2) * 0.05));
    block(x, z, 2.5, 0.66);
    const bar = at(new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.4, 0.7), new THREE.MeshBasicMaterial({ visible: false })), x, 0.7, z);
    group.add(bar);
    clickable(bar, { kind: 'order', label: 'The BookBeans coffee bar — order something ☕' });
    const sign = makeSign([{ text: '☕ BookBeans', size: 120, weight: '700' }, { text: 'coffee for readers', font: 'Dancing Script, cursive', size: 70, color: '#c4627f' }], 1.3, 0.4, { bg: '#f3e1d0' });
    sign.position.set(x, 2.1, R.maxZ - 0.03); sign.rotation.y = Math.PI;
    group.add(sign);
  }
  const name = makeSign([{ text: 'The BookBeans Library', size: 110, weight: '700' }, { text: 'read · write · stay a while 📚', font: 'Dancing Script, cursive', size: 70, color: '#c4627f' }], 1.8, 0.44, { bg: '#f3e1d0' });
  name.position.set(-4.5, 2.9, R.maxZ - 0.03); name.rotation.y = Math.PI;
  group.add(name);
  plant(group, colliders, R.minX + 0.45, R.maxZ - 0.45, 1.1);
  plant(group, colliders, R.maxX - 0.45, R.minZ + 0.45, 1.0);
  const lights = [pendant(group, R, -3.6, 1.4, { intensity: 2.2 }), pendant(group, R, 3.0, -1.2, { intensity: 2.2 }), pendant(group, R, 5.6, 1.0, { intensity: 2.0 })];
  doorOut({ group, R, makeSign, interactables, color: '#6e472e', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 2.0, ry: Math.PI },
    setBooks(list = []) {
      covers.forEach((c, i) => { const old = c.material.map; c.material.map = coverTex(list[i] || null, i); c.material.needsUpdate = true; old?.dispose(); });
    },
    setWords(words) { const old = wordsMat.map; wordsMat.map = wordsTex(words); wordsMat.needsUpdate = true; old?.dispose(); },
  };
}
