// The Escape Room: "The Pharaoh's Study", on the third floor, off its landing.
// A dusty study with a bookshelf, a desk with a scroll, an old clock, a
// sarcophagus with a cartouche, a chart of hieroglyphs, a rug and an old
// photograph — and a golden door with four locks. Start the hourglass and
// everyone in the room has fifteen minutes to work it out together: the clues
// are in the things you click, the answers go into the locks (app.js; the
// locks and the clock are kept on the server, server/rooms.js, so everyone
// sees the same thing).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, shell, doorOut } from './roomkit.js';

export const ESCAPE = { minX: -5.5, maxX: 5.5, minZ: -4.5, maxZ: 4.5, h: 3.2 };
const R = ESCAPE;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
// the books on the shelf: how many of each colour (the chest's code is red, blue, green)
export const BOOKS = { red: 4, blue: 2, green: 6 };

// the hieroglyphs, drawn (not a font — so they look the same on every screen)
const GLYPHS = { eye: 'S', bird: 'A', reed: 'K', water: 'U', mouth: 'R', lion: 'L', mat: 'P', ankh: 'N' };
function glyph(g, kind, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#3a2418'; g.fillStyle = '#3a2418'; g.lineWidth = 5; g.lineCap = 'round';
  const P = () => g.beginPath();
  if (kind === 'eye') { P(); g.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2); g.stroke(); P(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill(); P(); g.moveTo(-6, 13); g.lineTo(-12, 28); g.stroke(); }
  else if (kind === 'bird') { P(); g.ellipse(0, 4, 18, 12, -0.3, 0, Math.PI * 2); g.fill(); P(); g.arc(14, -12, 8, 0, Math.PI * 2); g.fill(); P(); g.moveTo(20, -12); g.lineTo(30, -10); g.stroke(); P(); g.moveTo(-4, 14); g.lineTo(-6, 28); g.moveTo(4, 14); g.lineTo(6, 28); g.stroke(); }
  else if (kind === 'reed') { P(); g.moveTo(0, 28); g.lineTo(0, -16); g.stroke(); P(); g.moveTo(0, -16); g.quadraticCurveTo(16, -26, 4, -30); g.stroke(); P(); g.moveTo(0, 0); g.lineTo(-10, -8); g.stroke(); }
  else if (kind === 'water') { for (const yy of [-12, 0, 12]) { P(); for (let i = 0; i <= 8; i++) g.lineTo(-28 + i * 7, yy + (i % 2 ? -5 : 5)); g.stroke(); } }
  else if (kind === 'mouth') { P(); g.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'lion') { P(); g.ellipse(0, 6, 26, 10, 0, 0, Math.PI * 2); g.fill(); P(); g.arc(-22, -6, 10, 0, Math.PI * 2); g.fill(); P(); g.moveTo(24, 6); g.quadraticCurveTo(34, -8, 28, -14); g.stroke(); }
  else if (kind === 'mat') { g.strokeRect(-24, -10, 48, 20); for (const xx of [-12, 0, 12]) { P(); g.moveTo(xx, -10); g.lineTo(xx, 10); g.stroke(); } }
  else if (kind === 'ankh') { P(); g.ellipse(0, -16, 9, 12, 0, 0, Math.PI * 2); g.stroke(); P(); g.moveTo(-16, 0); g.lineTo(16, 0); g.moveTo(0, -4); g.lineTo(0, 28); g.stroke(); }
  g.restore();
}
export const CARTOUCHE = ['eye', 'bird', 'reed', 'water', 'mouth', 'bird']; // S-A-K-U-R-A

function glyphTex(key) {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#e8d8b0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6e4a2e'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#3a2418'; g.textAlign = 'center'; g.font = 'bold 34px Georgia, serif';
    g.fillText(key ? 'The scribe’s key' : '', w / 2, 52);
    Object.entries(GLYPHS).forEach(([gl, l], i) => {
      const x = 80 + (i % 4) * 116, y = 130 + Math.floor(i / 4) * 140;
      glyph(g, gl, x, y, 1.1);
      g.font = 'bold 34px Georgia, serif'; g.fillText('= ' + l, x, y + 62);
    });
  });
}
function cartoucheTex() {
  return canvasTex(200, 520, (g, w, h) => {
    g.fillStyle = '#c9a25b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a2418'; g.lineWidth = 8;
    g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 14, h / 2 - 14, 0, 0, Math.PI * 2); g.stroke();
    CARTOUCHE.forEach((c, i) => glyph(g, c, w / 2, 86 + i * 70, 0.9));
  });
}
function hourglassTex(st) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#1b1410'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a25b'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'center';
    g.fillStyle = '#ffe7a0'; g.font = 'bold 36px Georgia, serif';
    g.fillText(st.escaped ? '🔓 ESCAPED!' : st.running ? '⏳ The sand is running' : st.failed ? '⌛ Time ran out' : '⏳ Turn the hourglass to begin', w / 2, 64);
    g.fillStyle = '#ffffff'; g.font = 'bold 84px Georgia, serif';
    g.fillText(st.clock || '15:00', w / 2, 160);
    g.fillStyle = '#c9a25b'; g.font = '30px Georgia, serif';
    g.fillText(`locks open: ${st.open || 0} of 4`, w / 2, 220);
  });
}

export function buildEscape({ floor, makeSign }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [110, 80, 56], 71),
    wallColor: '#d9c49a', lowColor: '#6e4a2e', ceilColor: '#3a2a20', wallsAreSurfaces: false,
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const wood = std('#5a3a26', { roughness: 0.6 }), gold = std('#c9a25b', { metalness: 0.8, roughness: 0.3 });

  // ── the golden door with its four locks, on the north wall
  {
    group.add(at(rbox(1.6, 2.5, 0.12, 0.04, gold), 0, 1.25, R.minZ + 0.06));
    for (let i = 0; i < 4; i++) group.add(at(cyl(0.07, 0.07, 0.06, std('#3a2418', { metalness: 0.5 }), 12).rotateX(Math.PI / 2), -0.45 + i * 0.3, 1.3, R.minZ + 0.14));
    const eye = at(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), std('#ffffff', { map: canvasTex(128, 128, (g, w) => { g.fillStyle = '#c9a25b'; g.fillRect(0, 0, w, w); glyph(g, 'eye', w / 2, w / 2 - 8, 1.6); }), roughness: 0.5 })), 0, 2.05, R.minZ + 0.13);
    group.add(eye);
    const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.5), new THREE.MeshBasicMaterial({ visible: false })), 0, 1.25, R.minZ + 0.16);
    group.add(hit);
    clickable(hit, { kind: 'escape-door', label: 'The golden door — four locks 🔐' });
  }
  // ── the hourglass board beside it
  const hgMat = new THREE.MeshBasicMaterial({ map: hourglassTex({}), toneMapped: false });
  {
    const b = at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), hgMat), 2.4, 2.2, R.minZ + 0.04); group.add(b);
    clickable(b, { kind: 'escape-door', label: 'The hourglass' });
    const hg = new THREE.Group();
    hg.add(at(cyl(0.16, 0.16, 0.03, wood, 12), 0, 0.02, 0)); hg.add(at(cyl(0.16, 0.16, 0.03, wood, 12), 0, 0.6, 0));
    hg.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 16), std('#e8f2f4', { transparent: true, opacity: 0.4 })), 0, 0.45, 0).rotateX(Math.PI));
    hg.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 16), std('#e8c98e', { roughness: 1 })), 0, 0.17, 0));
    hg.position.set(2.4, 0.8, R.minZ + 0.35); group.add(hg);
    group.add(at(rbox(0.6, 0.8, 0.5, 0.03, wood), 2.4, 0.4, R.minZ + 0.35)); block(2.4, R.minZ + 0.35, 0.6, 0.5);
    clickable(hg, { kind: 'escape-start', label: 'The hourglass — turn it over to start ⏳' });
  }
  // ── the bookshelf: red, blue and green books (count them)
  {
    const x = R.minX + 0.25, z = -1.6;
    const g = new THREE.Group();
    g.add(at(box(0.4, 2.2, 1.8, wood), 0, 1.1, 0));
    const COL = { red: '#b3263a', blue: '#1f4a8a', green: '#2f7a4a' };
    const order = [];
    for (const [c, n] of Object.entries(BOOKS)) for (let i = 0; i < n; i++) order.push(c);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; // (shuffled the same way every time)
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    order.forEach((c, i) => {
      const row = Math.floor(i / 5), k = i % 5;
      g.add(at(box(0.3, 0.32 + (i % 3) * 0.04, 0.12, std(COL[c], { roughness: 0.7 })), 0.06, 0.5 + row * 0.6, -0.6 + k * 0.28));
    });
    for (let row = 0; row < 4; row++) g.add(at(box(0.38, 0.03, 1.7, wood), 0.02, 0.32 + row * 0.6, 0));
    g.position.set(x, 0, z); group.add(g);
    block(x, z, 0.45, 1.8);
    clickable(g, { kind: 'escape-clue', clue: 'shelf', label: 'The bookshelf' });
  }
  // ── the desk with its scroll
  {
    const x = -2.6, z = 1.6;
    group.add(at(rbox(1.6, 0.06, 0.8, 0.02, wood), x, 0.76, z));
    for (const a of [-1, 1]) for (const b of [-1, 1]) group.add(at(box(0.06, 0.74, 0.06, wood), x + a * 0.72, 0.37, z + b * 0.32));
    block(x, z, 1.6, 0.8);
    const scroll = at(box(0.5, 0.01, 0.34, std('#f4ecd8', { roughness: 1 })), x, 0.8, z);
    group.add(scroll);
    for (const s of [-1, 1]) group.add(at(cyl(0.02, 0.02, 0.38, wood, 8).rotateX(Math.PI / 2), x + s * 0.26, 0.81, z));
    group.add(at(cyl(0.05, 0.06, 0.12, std('#2a2422'), 10), x + 0.55, 0.85, z - 0.2)); // an inkwell
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.8), new THREE.MeshBasicMaterial({ visible: false })), x, 0.9, z);
    group.add(hit); clickable(hit, { kind: 'escape-clue', clue: 'scroll', label: 'A scroll on the desk' });
  }
  // ── the old clock, and the riddle on its face
  {
    const x = R.maxX - 0.25, z = -1.8;
    group.add(at(rbox(0.4, 2.0, 0.5, 0.04, wood), x, 1.0, z));
    const face = at(new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), std('#f4ecd8')), x - 0.21, 1.55, z); face.rotation.y = -Math.PI / 2; group.add(face);
    block(x, z, 0.45, 0.55);
    clickable(face, { kind: 'escape-clue', clue: 'clock', label: 'The old clock' });
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.0, 0.55), new THREE.MeshBasicMaterial({ visible: false })), x, 1.0, z);
    group.add(hit); clickable(hit, { kind: 'escape-clue', clue: 'clock', label: 'The old clock' });
  }
  // ── the sarcophagus with its cartouche, the hieroglyph chart on the wall
  {
    const x = 2.2, z = 1.4;
    group.add(at(rbox(0.8, 0.7, 2.0, 0.15, std('#c9a25b', { metalness: 0.5, roughness: 0.4 })), x, 0.35, z));
    const lid = at(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.04), std('#ffffff', { map: cartoucheTex(), roughness: 0.6 })), x, 0.71, z); lid.rotation.x = -Math.PI / 2; group.add(lid);
    block(x, z, 0.85, 2.05);
    clickable(lid, { kind: 'escape-clue', clue: 'cartouche', label: 'The cartouche on the sarcophagus' });
    const chart = at(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), std('#ffffff', { map: glyphTex(true), roughness: 0.9 })), R.maxX - 0.03, 1.6, 1.6); chart.rotation.y = -Math.PI / 2; group.add(chart);
    clickable(chart, { kind: 'escape-clue', clue: 'chart', label: 'A chart of hieroglyphs' });
  }
  // ── the rug, and the old photograph
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), std('#7a1f2c', { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -0.6); group.add(rug);
    const border = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), std('#c9a25b', { roughness: 1 }));
    border.rotation.x = -Math.PI / 2; border.position.set(0, 0.007, -0.6); border.scale.set(0.9, 0.85, 1); group.add(border);
    clickable(rug, { kind: 'escape-clue', clue: 'rug', label: 'The rug' });
    clickable(border, { kind: 'escape-clue', clue: 'rug', label: 'The rug' });
    const photo = at(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), std('#ffffff', {
      map: canvasTex(200, 160, (g, w, h) => { g.fillStyle = '#c9b49a'; g.fillRect(0, 0, w, h); g.fillStyle = '#6e5a3a'; g.fillRect(20, 20, w - 40, h - 40); g.fillStyle = '#e8dcc4'; g.font = '18px Georgia'; g.textAlign = 'center'; g.fillText('the dig, Luxor', w / 2, h - 30); }), roughness: 0.8,
    })), -2.6, 1.7, R.maxZ - 0.03);
    photo.rotation.y = Math.PI; group.add(photo);
    group.add(at(box(0.56, 0.46, 0.03, gold), -2.6, 1.7, R.maxZ - 0.015));
    clickable(photo, { kind: 'escape-clue', clue: 'photo', label: 'An old photograph' });
  }
  const sign = makeSign([{ text: 'The Pharaoh’s Study', size: 104, weight: '700' }, { text: 'fifteen minutes · four locks · one door', size: 56 }], 1.5, 0.4, { bg: '#e8dcc4', border: '#6e4a2e' });
  sign.position.set(-2.6, 2.7, R.minZ + 0.03); group.add(sign);
  const lights = [];
  for (const [x, z] of [[-2, 0], [2, 0]]) { const l = new THREE.PointLight('#ffcf8f', 1.8, 7, 1.6); l.position.set(x, 2.6, z); group.add(l); lights.push(l); }
  doorOut({ group, R, makeSign, interactables, color: '#3a2a20', to: 'landing3', sign: '⬅ The landing', label: 'Give up and go back to the landing' });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
    setBoard(st) { const old = hgMat.map; hgMat.map = hourglassTex(st); hgMat.needsUpdate = true; old?.dispose(); },
  };
}
