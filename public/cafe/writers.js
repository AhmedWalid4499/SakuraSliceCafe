// The Writer's Room: on the fourth floor, off its landing. Quiet desks with
// typewriters and green lamps under the windows (rain on the glass), a big
// stone fireplace with armchairs drawn up to it, bookshelves, and three
// things to click: the stories board (a cork board of pinned short stories
// everyone can read, and pin their own — app.js), the writing sprint clock on
// the mantel (write together against the clock) and the author's shelf, the
// owner's novellas face out, each to read on Kindle.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, shell, doorOut, chair, plant, pendant } from './roomkit.js';

export const WRITERS = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, h: 3.4 };
const R = WRITERS;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const COVER = ['#c4627f', '#2f6b8a', '#6e8f5a', '#7c5aa0', '#c98a3a', '#3a3a5a'];

// words onto a canvas, wrapped to a width; returns the y after the last line
function wrap(g, text, x, y, maxW, lineH, maxLines = 3) {
  const words = String(text || '').split(/\s+/);
  let line = '', n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxW && line) {
      n++;
      if (n >= maxLines) { g.fillText(line.replace(/\s*\S*$/, '') + '…', x, y); return y + lineH; }
      g.fillText(line, x, y); y += lineH; line = words[i];
    } else line = test;
  }
  if (line) { g.fillText(line, x, y); y += lineH; }
  return y;
}

function boardTex(stories) {
  return canvasTex(1024, 600, (g, w, h) => {
    // cork
    g.fillStyle = '#c99a62'; g.fillRect(0, 0, w, h);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,55,25,.25)' : 'rgba(255,235,200,.22)'; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
    g.fillStyle = '#4a3020'; g.textAlign = 'center';
    g.font = 'bold 40px Georgia, serif'; g.fillText('The Stories Board', w / 2, 52);
    const list = (stories || []).slice(0, 12);
    if (!list.length) {
      g.save(); g.translate(w / 2, h / 2 + 30); g.rotate(-0.04);
      g.fillStyle = '#fffaf0'; g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 10; g.fillRect(-210, -95, 420, 190); g.shadowBlur = 0;
      g.fillStyle = '#c4627f'; g.beginPath(); g.arc(0, -78, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a3020'; g.font = 'italic 44px Georgia, serif'; g.fillText('Pin the first story', 0, 0);
      g.font = '30px Georgia, serif'; g.fillStyle = '#8a6a50'; g.fillText('click the board to write ✍️', 0, 50);
      g.restore();
      return;
    }
    const cols = 4, cw = 222, ch = 150, gx = (w - cols * cw) / (cols + 1);
    list.forEach((st, i) => {
      const c = i % cols, row = Math.floor(i / cols);
      const x = gx + c * (cw + gx) + cw / 2, y = 100 + row * (ch + 22) + ch / 2;
      g.save(); g.translate(x, y); g.rotate(((i * 37) % 7 - 3) * 0.012);
      g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 8;
      g.fillStyle = ['#fffaf0', '#fdf1d8', '#f6e8f0', '#eef6ea'][i % 4]; g.fillRect(-cw / 2, -ch / 2, cw, ch); g.shadowBlur = 0;
      g.strokeStyle = 'rgba(196,98,127,.35)'; g.lineWidth = 2;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-cw / 2 + 10, -20 + k * 26); g.lineTo(cw / 2 - 10, -20 + k * 26); g.stroke(); }
      g.fillStyle = ['#c4627f', '#2f6b8a', '#e8b44a', '#6e8f5a'][i % 4]; g.beginPath(); g.arc(0, -ch / 2 + 12, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a2a20'; g.font = 'bold 26px Georgia, serif';
      wrap(g, st.title || 'Untitled', 0, -22, cw - 26, 30, 2);
      g.fillStyle = '#8a6a50'; g.font = 'italic 21px Georgia, serif';
      g.fillText('by ' + String(st.name || 'someone').slice(0, 20), 0, ch / 2 - 18);
      g.restore();
    });
  });
}

function sprintTex(st) {
  return canvasTex(512, 288, (g, w, h) => {
    g.fillStyle = '#6e472e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#24372c'; g.fillRect(16, 16, w - 32, h - 32);
    g.textAlign = 'center'; g.fillStyle = '#f4ece0';
    if (st && st.running) {
      g.font = 'italic 34px Georgia, serif'; g.fillText('Writing sprint', w / 2, 70);
      g.font = 'bold 96px Georgia, serif'; g.fillStyle = '#ffe7a0'; g.fillText(st.clock || '00:00', w / 2, 170);
      g.font = '30px Georgia, serif'; g.fillStyle = '#c9e0c9';
      const n = st.writers || 0; g.fillText(`${n} ${n === 1 ? 'writer' : 'writers'} writing ✍️`, w / 2, 230);
    } else {
      g.font = 'bold 46px Georgia, serif'; g.fillText('Start a', w / 2, 100);
      g.fillText('writing sprint', w / 2, 155);
      g.font = 'italic 28px Georgia, serif'; g.fillStyle = '#c9e0c9'; g.fillText('write together · click to begin ⏱️', w / 2, 220);
    }
  });
}

function coverTex(book, i) {
  return canvasTex(256, 384, (g, w, h) => {
    const col = COVER[i % COVER.length];
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, col); gr.addColorStop(1, '#1d1620');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,240,220,.7)'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
    // a sakura blossom, or the moon
    g.fillStyle = 'rgba(255,220,230,.9)';
    if (i % 2) { g.beginPath(); g.arc(w / 2, 250, 46, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(w / 2 + 20, 240, 40, 0, Math.PI * 2); g.fill(); }
    else for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 26, 250 + Math.sin(a) * 26, 22, 15, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffe7a0'; g.beginPath(); g.arc(w / 2, 250, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffaf0'; g.textAlign = 'center';
    if (book) {
      g.font = 'bold 34px Georgia, serif'; wrap(g, book.title, w / 2, 80, w - 50, 38, 4);
      g.font = 'italic 20px Georgia, serif'; g.fillStyle = 'rgba(255,240,220,.85)'; g.fillText('a novella', w / 2, h - 34);
    } else {
      g.font = 'italic 28px Georgia, serif'; g.fillStyle = 'rgba(255,240,220,.55)'; g.fillText('coming soon', w / 2, 110);
    }
  });
}

function rainTex() {
  return canvasTex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, l = 10 + r() * 22;
      g.strokeStyle = `rgba(220,235,255,${0.25 + r() * 0.35})`; g.lineWidth = 1 + r();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y + l); g.stroke();
      if (r() < 0.3) { g.fillStyle = 'rgba(230,240,255,.5)'; g.beginPath(); g.arc(r() * w, r() * h, 1.5 + r() * 2, 0, Math.PI * 2); g.fill(); }
    }
  }, [2, 2]);
}

export function buildWriters({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [122, 82, 54], 63),
    wallColor: '#e9dcc8', lowColor: '#3e5a4a', ceilColor: '#f4ead8', windows: { east: [-2.4, 0.6] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const wood = std('#6e472e', { roughness: 0.55 }), darkWood = std('#4a3020', { roughness: 0.5 });
  const brass = std('#c9a25b', { metalness: 0.75, roughness: 0.3 });
  const lights = [];

  // ── the fireplace, in the middle of the north wall
  const stoneTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8a7f74'; g.fillRect(0, 0, w, h);
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let row = 0; row < 8; row++) for (let x = -(row % 2) * 24; x < w; x += 48) {
      const k = 0.8 + r() * 0.3; g.fillStyle = `rgb(${Math.round(150 * k)},${Math.round(138 * k)},${Math.round(124 * k)})`;
      g.beginPath(); g.roundRect(x + 2, row * 32 + 2, 44, 28, 6); g.fill();
    }
  }, [2, 3]);
  const stone = std('#ffffff', { map: stoneTex, roughness: 0.95 });
  const FZ = R.minZ;
  group.add(at(box(2.6, R.h, 0.7, stone), 0, R.h / 2, FZ + 0.35));                 // the chimney breast
  group.add(at(box(1.3, 0.95, 0.05, std('#1a1210', { roughness: 1 })), 0, 0.6, FZ + 0.705)); // the firebox (dark)
  group.add(at(box(1.6, 0.1, 0.4, stone), 0, 0.05, FZ + 0.9));                   // hearth
  const mantel = at(rbox(2.9, 0.12, 0.42, 0.03, darkWood), 0, 1.3, FZ + 0.82); group.add(mantel);
  block(0, FZ + 0.5, 2.9, 1.0);
  // the logs and the fire
  for (const [x, r] of [[-0.18, 0.3], [0.18, -0.3], [0, 0]]) { const log = at(cyl(0.06, 0.06, 0.7, std('#5a3a22', { roughness: 1 }), 10), x * 0.5, 0.2 + (r ? 0 : 0.09), FZ + 0.9); log.rotation.z = Math.PI / 2; log.rotation.y = r; group.add(log); }
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = at(new THREE.Mesh(new THREE.ConeGeometry(0.09 + (i % 2) * 0.03, 0.4, 10), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffb347' : '#ff7a2a', transparent: true, opacity: 0.85, depthWrite: false })), -0.28 + i * 0.14, 0.42, FZ + 0.9 + (i % 2) * 0.05);
    group.add(f); flames.push(f);
  }
  const fire = new THREE.PointLight('#ff9a4a', 3.2, 9, 1.4); fire.position.set(0, 0.6, FZ + 1.3); group.add(fire); lights.push(fire);
  // on the mantel: candlesticks, a little clock face, a jar of pens
  for (const x of [-1.2, 1.25]) { group.add(at(cyl(0.025, 0.04, 0.22, brass, 10), x, 1.47, FZ + 0.82)); group.add(at(cyl(0.018, 0.018, 0.12, std('#fbf3e6'), 8), x, 1.64, FZ + 0.82)); group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' })), x, 1.72, FZ + 0.82)); }
  group.add(at(cyl(0.05, 0.045, 0.14, std('#2f6b8a', { roughness: 0.4 }), 12), -0.85, 1.43, FZ + 0.84));
  for (let i = 0; i < 4; i++) { const p = at(cyl(0.006, 0.006, 0.2, std(['#c4627f', '#e8b44a', '#2a2a2a', '#6e8f5a'][i]), 6), -0.85 + (i - 1.5) * 0.015, 1.54, FZ + 0.84); p.rotation.z = (i - 1.5) * 0.12; group.add(p); }
  // the sprint clock, propped on the mantel
  const sprintMat = new THREE.MeshBasicMaterial({ map: sprintTex(null), toneMapped: false });
  const sprint = at(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.506), sprintMat), 0.15, 1.62, FZ + 0.74);
  sprint.rotation.x = -0.08; group.add(sprint);
  clickable(sprint, { kind: 'writers-sprint', label: 'The writing sprint — write together against the clock ⏱️' });
  // the room's name, on the chimney breast
  const name = makeSign([{ text: 'The Writer’s Room', size: 110, weight: '700' }, { text: 'quiet please · stories in progress ✍️', font: 'Dancing Script, cursive', size: 66, color: '#c4627f' }], 1.9, 0.5, { bg: '#fbf6ea', border: '#6e472e' });
  name.position.set(0, 2.6, FZ + 0.71); group.add(name);

  // ── armchairs drawn up to the fire, a rug, a little table with tea between them
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), std('#ffffff', { map: canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#7c2f3a'; g.fillRect(0, 0, w, w);
    for (let k = 0; k < 6; k++) { g.strokeStyle = k % 2 ? '#e8c98e' : '#4a1f28'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, w / 2, 120 - k * 18, 0, Math.PI * 2); g.stroke(); }
  }), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, FZ + 2.7); rug.receiveShadow = true; group.add(rug);
  const armM = std('#5f7f6a', { roughness: 0.95 }), cushionM = std('#6f907a', { roughness: 1 });
  [[-1.25, -0.5], [1.25, 0.5]].forEach(([x, turn], i) => {
    const z = FZ + 2.9;
    const c = new THREE.Group();
    c.add(at(rbox(0.82, 0.38, 0.78, 0.1, armM), 0, 0.22, 0));
    c.add(at(rbox(0.7, 0.14, 0.62, 0.06, cushionM), 0, 0.46, 0.04));
    c.add(at(rbox(0.82, 0.72, 0.18, 0.08, armM), 0, 0.68, -0.32));
    for (const s of [-1, 1]) c.add(at(rbox(0.14, 0.5, 0.74, 0.06, armM), s * 0.4, 0.5, 0));
    for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(at(cyl(0.025, 0.02, 0.08, darkWood, 6), a * 0.34, 0.04, b * 0.3));
    c.position.set(x, 0, z); c.rotation.y = Math.PI + turn; group.add(c);
    const seat = { id: `writers-arm-${i}`, label: 'an armchair by the fire', x, z, y: fy, h: 0.5, ry: Math.PI + turn };
    seats.push(seat);
    clickable(c, { kind: 'seat', seat, label: 'Sit in an armchair by the fire' });
    block(x, z, 0.85, 0.85);
  });
  {
    const t = new THREE.Group();
    t.add(at(cyl(0.28, 0.28, 0.04, wood, 24), 0, 0.55, 0));
    t.add(at(cyl(0.04, 0.06, 0.53, darkWood, 10), 0, 0.27, 0));
    t.add(at(cyl(0.18, 0.2, 0.03, darkWood, 18), 0, 0.015, 0));
    t.add(at(cyl(0.045, 0.035, 0.08, std('#fbf6ea', { roughness: 0.4 }), 14), 0.08, 0.61, 0.02));
    t.add(at(cyl(0.04, 0.04, 0.005, std('#8a5a32'), 14), 0.08, 0.648, 0.02));
    t.add(at(rbox(0.16, 0.04, 0.22, 0.01, std('#2f6b8a')), -0.1, 0.59, -0.04));
    t.position.set(0, 0, FZ + 3.2); group.add(t);
    block(0, FZ + 3.2, 0.6, 0.6);
  }

  // ── bookshelves either side of the fire (the right one: the author's shelf)
  const SPINE = ['#7c2f3a', '#2f6b8a', '#6e8f5a', '#c98a3a', '#3a3a5a', '#c4627f', '#e8dcc4', '#4a3020', '#8a6aa0'];
  const shelfUnit = (x, z, ry, w = 2.0, books = true) => {
    const g = new THREE.Group();
    g.add(at(box(w, 2.6, 0.04, darkWood), 0, 1.3, -0.17));
    for (const s of [-1, 1]) g.add(at(box(0.05, 2.6, 0.38, wood), s * (w / 2 - 0.025), 1.3, 0));
    for (let k = 0; k < 6; k++) g.add(at(box(w, 0.04, 0.38, wood), 0, 0.05 + k * 0.5, 0));
    if (books) {
      let s = Math.round(x * 13 + z * 7 + 99);
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 5; k++) {
        let bx = -w / 2 + 0.08;
        while (bx < w / 2 - 0.12) {
          const bw = 0.035 + r() * 0.04, bh = 0.28 + r() * 0.14;
          if (r() < 0.07) { bx += 0.12; continue; }
          const b = at(box(bw, bh, 0.24 + r() * 0.06, std(SPINE[Math.floor(r() * SPINE.length)], { roughness: 0.8 })), bx + bw / 2, 0.07 + k * 0.5 + bh / 2, 0.02);
          if (r() < 0.06) b.rotation.z = 0.25;
          g.add(b); bx += bw + 0.004;
        }
      }
    }
    g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    return g;
  };
  shelfUnit(-2.7, FZ + 0.22, 0);
  shelfUnit(-4.8, FZ + 0.22, 0, 2.2);
  // the author's shelf: three shelves, each with two covers face out
  const author = shelfUnit(3.0, FZ + 0.22, 0, 2.2, false);
  const covers = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.MeshStandardMaterial({ map: coverTex(null, i), roughness: 0.6 });
    const c = at(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.03), [darkWood, darkWood, darkWood, darkWood, m, darkWood]), (i % 2 ? 0.42 : -0.42), 0.8 + Math.floor(i / 2) * 0.5, 0.06);
    c.rotation.x = -0.12; author.add(c); covers.push({ mesh: c, mat: m });
  }
  for (let k = 0; k < 4; k++) author.add(at(box(0.05, 0.3, 0.2, std(SPINE[k], { roughness: 0.8 })), -0.95 + k * 0.06, 0.07 + 0.15, 0.02));
  const authorSign = makeSign([{ text: 'The author’s shelf', size: 100, weight: '700' }, { text: 'read on Kindle 📚', size: 70, color: '#c4627f' }], 1.3, 0.34, { bg: '#fbf6ea', border: '#6e472e' });
  authorSign.position.set(0, 2.82, 0.2); author.add(authorSign);
  clickable(author, { kind: 'writers-shelf', label: 'The author’s shelf — read on Kindle 📚' });
  block(-2.7, FZ + 0.22, 2.0, 0.44); block(-4.8, FZ + 0.22, 2.2, 0.44); block(3.0, FZ + 0.22, 2.2, 0.44);
  plant(group, colliders, 5.35, FZ + 0.5, 1.1);

  // ── the stories board, on the west wall
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex([]), roughness: 0.95 });
  const board = new THREE.Group();
  board.add(at(rbox(2.56, 1.56, 0.06, 0.02, darkWood), 0, 0, -0.02));
  board.add(at(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.406), boardMat), 0, 0, 0.015));
  board.position.set(R.minX + 0.05, 1.65, -1.6); board.rotation.y = Math.PI / 2; group.add(board);
  clickable(board, { kind: 'writers-board', label: 'The stories board — read and pin a short story 📌' });
  // a bench under it, to read on
  {
    const b = new THREE.Group();
    b.add(at(rbox(1.6, 0.08, 0.45, 0.03, wood), 0, 0.44, 0));
    b.add(at(rbox(1.5, 0.08, 0.38, 0.03, std('#c4627f', { roughness: 1 })), 0, 0.51, 0));
    for (const s of [-1, 1]) b.add(at(box(0.06, 0.42, 0.4, darkWood), s * 0.72, 0.21, 0));
    b.position.set(R.minX + 0.4, 0, -1.6); b.rotation.y = Math.PI / 2; group.add(b);
    for (const dz of [-0.4, 0.4]) {
      const seat = { id: `writers-bench-${dz < 0 ? 0 : 1}`, label: 'the bench under the board', x: R.minX + 0.5, z: -1.6 + dz, y: fy, h: 0.54, ry: Math.PI / 2 };
      seats.push(seat);
    }
    clickable(b, { kind: 'seat', seat: seats[seats.length - 2], label: 'Sit on the bench and read' });
    block(R.minX + 0.4, -1.6, 0.5, 1.6);
  }

  // ── the writing desks: typewriters and green lamps, under the windows and along the west wall
  const desk = (i, x, z, ry) => {
    const g = new THREE.Group();
    g.add(at(rbox(1.15, 0.05, 0.62, 0.015, wood), 0, 0.74, 0));
    for (const a of [-1, 1]) for (const b of [-1, 1]) g.add(at(box(0.05, 0.72, 0.05, darkWood), a * 0.52, 0.36, b * 0.25));
    g.add(at(box(0.36, 0.16, 0.56, darkWood), 0.36, 0.62, 0));            // a drawer
    g.add(at(cyl(0.012, 0.012, 0.03, brass, 8).rotateX(Math.PI / 2), 0.36, 0.62, -0.29));
    // the typewriter (it faces the writer, who sits on the −z side, looking +z… turned with the desk)
    const tw = new THREE.Group();
    const body = std(['#2f4a3a', '#3a2a2a', '#2a3a4a', '#4a2a3a', '#2a2a2a', '#3e5a4a'][i % 6], { roughness: 0.35, metalness: 0.2 });
    tw.add(at(rbox(0.42, 0.12, 0.3, 0.04, body), 0, 0.06, 0));
    const top = at(rbox(0.4, 0.06, 0.12, 0.03, body), 0, 0.15, 0.08); tw.add(top);
    tw.add(at(cyl(0.025, 0.025, 0.48, std('#1d1b1a', { roughness: 0.4 }), 12).rotateZ(Math.PI / 2), 0, 0.19, 0.1));  // the roller
    for (const s of [-1, 1]) tw.add(at(cyl(0.02, 0.02, 0.02, brass, 10).rotateZ(Math.PI / 2), s * 0.25, 0.19, 0.1));
    const paper = at(new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.24), std('#fffaf0', { roughness: 0.9, side: THREE.DoubleSide })), 0, 0.3, 0.12); paper.rotation.x = -0.25; tw.add(paper);
    const keyM = std('#f4ece0', { roughness: 0.5 });
    for (let row = 0; row < 3; row++) for (let k = 0; k < 8; k++) tw.add(at(cyl(0.011, 0.011, 0.012, keyM, 8), -0.14 + k * 0.04 + (row % 2) * 0.02, 0.13 + row * 0.012, -0.1 + row * 0.04));
    tw.position.set(-0.12, 0.765, 0.02); tw.rotation.y = Math.PI; g.add(tw);
    // the green banker's lamp
    const lamp = new THREE.Group();
    lamp.add(at(cyl(0.07, 0.08, 0.02, brass, 16), 0, 0.01, 0));
    lamp.add(at(cyl(0.008, 0.008, 0.3, brass, 8), 0, 0.16, 0));
    const shade = at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 18, 1, true, 0, Math.PI), std('#1f7a4a', { roughness: 0.25, emissive: '#2aa060', emissiveIntensity: 0.35, side: THREE.DoubleSide })), 0, 0.32, 0);
    shade.rotation.z = Math.PI / 2; lamp.add(shade);
    lamp.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff2c4' })), 0, 0.3, 0));
    lamp.position.set(0.4, 0.765, 0.18); g.add(lamp);
    // a little stack of paper, a mug of pencils
    g.add(at(box(0.21, 0.04, 0.28, std('#fffaf0', { roughness: 0.9 })), 0.36, 0.785, -0.12));
    g.add(at(cyl(0.035, 0.03, 0.09, std('#c4627f', { roughness: 0.5 }), 12), -0.45, 0.81, 0.18));
    g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    block(x, z, Math.abs(Math.sin(ry)) > 0.5 ? 0.66 : 1.2, Math.abs(Math.sin(ry)) > 0.5 ? 1.2 : 0.66);
    // the chair, on the writer's side
    const cx = x - Math.sin(ry) * 0.62, cz = z - Math.cos(ry) * 0.62;
    const s = chair(group, seats, interactables, { id: `writers-desk-${i}`, label: 'a writing desk', x: cx, z: cz, ry, color: '#7a4e33', y0: fy });
    s.work = true;
    clickable(g, { kind: 'seat', seat: s, label: 'Sit at a writing desk and type ✍️' });
  };
  desk(0, R.maxX - 0.55, -2.4, Math.PI / 2);
  desk(1, R.maxX - 0.55, 0.6, Math.PI / 2);
  desk(2, R.maxX - 0.55, 3.0, Math.PI / 2);
  desk(3, R.minX + 0.55, 1.6, -Math.PI / 2);
  desk(4, R.minX + 0.55, 3.6, -Math.PI / 2);

  // rain running down the window glass
  const rain = rainTex();
  for (const z of [-2.4, 0.6]) {
    const p = at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.35), new THREE.MeshBasicMaterial({ map: rain, transparent: true, depthWrite: false })), R.maxX - 0.03, 1.725, z);
    p.rotation.y = -Math.PI / 2; group.add(p);
  }
  // a long runner down the middle, plants, a coat stand by the door, a framed quote
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5.0), std('#2f4a3a', { roughness: 1 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.004, 1.8); runner.receiveShadow = true; group.add(runner);
  plant(group, colliders, R.minX + 0.5, R.maxZ - 0.5, 1.0);
  plant(group, colliders, R.maxX - 0.5, R.maxZ - 0.5, 0.9);
  {
    const q = makeSign([{ text: '“Start writing, no matter what.', font: 'Georgia, serif', size: 64, weight: '400', color: '#3a2a20' }, { text: 'The water does not flow until the faucet is turned on.”', font: 'Georgia, serif', size: 44, color: '#6e472e' }], 1.6, 0.42, { bg: '#fffaf0', border: '#6e472e' });
    q.position.set(R.minX + 0.03, 2.55, 2.6); q.rotation.y = Math.PI / 2; group.add(q);
  }
  // warm pendants
  lights.push(pendant(group, R, 0, 0.8, { intensity: 1.8 }));
  lights.push(pendant(group, R, 0, 3.2, { intensity: 1.4 }));

  doorOut({ group, R, makeSign, interactables, color: '#3e5a4a', to: 'landing4', sign: '⬅ The landing', label: 'Back out to the landing' });

  // the fire flickers
  animate?.((dt, t) => {
    fire.intensity = 2.8 + Math.sin(t * 7.3) * 0.4 + Math.sin(t * 13.1) * 0.25 + Math.sin(t * 3.1) * 0.2;
    flames.forEach((f, i) => { f.scale.set(1, 0.8 + Math.abs(Math.sin(t * (5 + i) + i)) * 0.5, 1); f.position.y = 0.36 + f.scale.y * 0.08; f.rotation.z = Math.sin(t * 4 + i) * 0.12; });
    rain.offset.y += dt * 0.35;
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
    setBoard(stories) { const old = boardMat.map; boardMat.map = boardTex(stories || []); boardMat.needsUpdate = true; old?.dispose(); },
    setSprint(st) { const old = sprintMat.map; sprintMat.map = sprintTex(st || null); sprintMat.needsUpdate = true; old?.dispose(); },
    setBooks(books) {
      const list = (books || []).slice(0, 6);
      covers.forEach(({ mat }, i) => { const old = mat.map; mat.map = coverTex(list[i] || null, i); mat.needsUpdate = true; old?.dispose(); });
    },
  };
}
