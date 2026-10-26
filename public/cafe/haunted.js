// The Haunted Library: on the fourth floor, off its landing — the café's
// Halloween room, spooky but sweet. Moonlight through a tall arched window,
// crooked bookshelves, books that float and flap about by themselves, candles
// that flicker, cobwebs in the corners, jack-o'-lanterns, a bubbling green
// cauldron, and a friendly little ghost drifting round the room. Ten tiny
// pumpkins are hidden in the nooks: find them all (app.js keeps count).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, shell, doorOut } from './roomkit.js';

export const HAUNTED = { minX: -7, maxX: 7, minZ: -6, maxZ: 6, h: 4.2 };
const R = HAUNTED;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const ball = (r, m, seg = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), m);
const SPINES = ['#5a2a4a', '#2f3f5a', '#4a5a2a', '#6a3a1a', '#3a2a5a', '#7a2a2a', '#2a4a4a', '#5a4a2a'];

// a cobweb, drawn once: spokes and rings, fading out
function webTex() {
  return canvasTex(256, 256, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.strokeStyle = 'rgba(235,235,245,0.75)'; g.lineWidth = 1.6;
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); g.stroke(); }
    for (let r = 30; r < 250; r += 32) {
      g.beginPath();
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2, rr = r - (i % 2 ? 6 : 0); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) g.quadraticCurveTo(Math.cos(a - 0.13) * (rr - 8), Math.sin(a - 0.13) * (rr - 8), x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  });
}

// a jack-o'-lantern face: glowing eyes and a toothy grin, on a dark ground
function faceTex() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#ffd25a';
    const tri = (x, y, s, up = 1) => { g.beginPath(); g.moveTo(x - s, y + s * 0.6 * up); g.lineTo(x + s, y + s * 0.6 * up); g.lineTo(x, y - s * 0.7 * up); g.closePath(); g.fill(); };
    tri(80, 95, 26); tri(176, 95, 26); tri(128, 140, 12);
    g.beginPath(); g.moveTo(60, 170); g.quadraticCurveTo(128, 235, 196, 170); g.quadraticCurveTo(128, 200, 60, 170); g.fill();
    g.fillStyle = '#000'; g.fillRect(100, 168, 14, 14); g.fillRect(142, 168, 14, 14);
  });
}

// a pumpkin: ribbed, squat, with a curly green stem
function pumpkin(r, faceMap = null) {
  const g = new THREE.Group();
  const skin = std('#ef8a2a', { roughness: 0.55 });
  for (let i = 0; i < 8; i++) {
    const rib = ball(r * 0.62, skin, 14);
    const a = (i / 8) * Math.PI * 2;
    rib.scale.set(0.75, 0.95, 1.05);
    rib.position.set(Math.cos(a) * r * 0.38, 0, Math.sin(a) * r * 0.38);
    rib.rotation.y = -a;
    g.add(rib);
  }
  const stem = cyl(r * 0.08, r * 0.12, r * 0.4, std('#5a7a2a', { roughness: 0.8 }), 8);
  stem.position.y = r * 0.68; stem.rotation.z = 0.25;
  g.add(stem);
  if (faceMap) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.62, 24), new THREE.MeshBasicMaterial({ map: faceMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    face.position.set(0, 0, r * 0.83);
    g.add(face);
  }
  g.position.y = r * 0.6;
  const holder = new THREE.Group(); holder.add(g);
  return holder;
}

// a book: two covers hinged at the spine, pages between — `flap` opens it
function book(color) {
  const g = new THREE.Group();
  const coverM = std(color, { roughness: 0.7, side: THREE.DoubleSide });
  const pageM = std('#f4ead2', { roughness: 0.9 });
  const halves = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Group();
    h.add(at(box(0.16, 0.012, 0.22, coverM), s * 0.08, 0, 0));
    h.add(at(box(0.15, 0.02, 0.2, pageM), s * 0.075, s > 0 ? -0.012 : -0.012, 0));
    g.add(h); halves.push(h);
  }
  g.userData.flap = a => { halves[0].rotation.z = -a; halves[1].rotation.z = a; };
  return g;
}

export function buildHaunted({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({ group, R, floor, floorMap: plankTex(R, [70, 52, 46], 13), wallColor: '#2e2438', lowColor: '#1d1724', ceilColor: '#1a1520' });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const wood = std('#3a2a22', { roughness: 0.75 }), darkWood = std('#241a16', { roughness: 0.7 });
  const brass = std('#b8924a', { metalness: 0.7, roughness: 0.35 });
  const lights = [];
  const flickers = [];
  const face = faceTex();

  // a dim, purple-blue fill so the room reads in the dark
  const fill = new THREE.HemisphereLight('#7a6aaa', '#2a2030', 0.85); group.add(fill);

  // ── the tall arched window on the north wall, the full moon in it
  {
    const W = 2.2, H = 2.75, y0 = 0.8;
    const sh = new THREE.Shape();
    sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(W / 2, H - W / 2); sh.absarc(0, H - W / 2, W / 2, 0, Math.PI, false); sh.closePath();
    const night = canvasTex(256, 384, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#16203f'); gr.addColorStop(1, '#3a3060'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.12})`; g.fillRect((i * 97) % w, (i * 53) % (h * 0.7), 2, 2); }
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(150, 110, 52, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(220,210,180,0.5)'; for (const [x, y, r] of [[135, 95, 9], [168, 125, 12], [150, 140, 6]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      // bare branches across the moon, and a bat
      g.strokeStyle = '#0c0a14'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 230); g.quadraticCurveTo(90, 180, 200, 200); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(90, 196); g.lineTo(130, 150); g.moveTo(160, 198); g.lineTo(220, 160); g.stroke();
      g.fillStyle = '#0c0a14'; g.beginPath(); g.moveTo(70, 80); g.quadraticCurveTo(82, 66, 92, 82); g.quadraticCurveTo(100, 74, 108, 82); g.quadraticCurveTo(118, 66, 130, 80); g.quadraticCurveTo(100, 92, 70, 80); g.fill();
      for (let y = h * 0.82; y < h; y += 6) { g.fillStyle = '#0e0b16'; g.fillRect(0, y, w, 6); } // the rooftops below
    });
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ map: night, toneMapped: false }));
    // (ShapeGeometry UVs are in shape units: map them to 0..1)
    const uv = glass.geometry.attributes.uv, pos = glass.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, pos.getY(i) / H);
    glass.position.set(0, y0, R.minZ + 0.03); group.add(glass);
    // the frame and the leading
    const frameM = std('#1a1218', { roughness: 0.6 });
    group.add(at(box(W + 0.24, 0.14, 0.18, frameM), 0, y0 - 0.05, R.minZ + 0.08));
    group.add(at(box(0.06, H - 0.1, 0.05, frameM), 0, y0 + (H - 0.1) / 2, R.minZ + 0.05));
    group.add(at(box(W, 0.05, 0.05, frameM), 0, y0 + 1.1, R.minZ + 0.05));
    const arch = new THREE.Mesh(new THREE.TorusGeometry(W / 2 + 0.05, 0.07, 8, 32, Math.PI), frameM);
    arch.position.set(0, y0 + H - W / 2, R.minZ + 0.06); group.add(arch);
    for (const s of [-1, 1]) group.add(at(box(0.12, H - W / 2, 0.14, frameM), s * (W / 2 + 0.05), y0 + (H - W / 2) / 2, R.minZ + 0.07));
    // moonlight pouring in
    const moon = new THREE.PointLight('#a8b8ff', 2.2, 9, 1.4); moon.position.set(0.4, 2.8, R.minZ + 1.2); group.add(moon); lights.push(moon);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.2), new THREE.MeshBasicMaterial({ color: '#b8c4ff', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(0, 1.6, R.minZ + 1.5); beam.rotation.x = -0.75; group.add(beam);
    // the moonlit patch on the floor
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: '#c8d0ff', transparent: true, opacity: 0.12, depthWrite: false }));
    patch.rotation.x = -Math.PI / 2; patch.scale.set(1.0, 1.4, 1); patch.position.set(0, 0.006, R.minZ + 2.6); group.add(patch);
  }

  // ── crooked bookshelves either side of the window, and along the west wall
  const shelfUnit = (x, z, ry, w, h, lean, seed) => {
    const g = new THREE.Group();
    g.add(at(box(w, h, 0.05, darkWood), 0, h / 2, -0.17));
    for (const s of [-1, 1]) g.add(at(box(0.06, h, 0.38, wood), s * (w / 2 - 0.03), h / 2, 0));
    const rows = Math.floor(h / 0.48);
    for (let r = 0; r <= rows; r++) {
      const y = 0.06 + r * ((h - 0.1) / rows);
      g.add(at(box(w, 0.04, 0.38, wood), 0, y, 0));
      if (r === rows) continue;
      let x = -w / 2 + 0.08, k = seed + r * 7;
      while (x < w / 2 - 0.12) {
        k = (k * 31 + 7) % 97;
        const bw = 0.04 + (k % 5) * 0.012, bh = 0.24 + (k % 7) * 0.025;
        if (k % 11 === 0) { x += 0.12; continue; } // a gap
        const b = at(box(bw, bh, 0.24, std(SPINES[k % SPINES.length], { roughness: 0.75 })), x + bw / 2, y + 0.02 + bh / 2, 0.02);
        b.rotation.z = k % 9 === 0 ? 0.18 : 0;
        g.add(b);
        x += bw + 0.004;
      }
    }
    g.position.set(x, 0, z); g.rotation.set(0, ry, lean);
    group.add(g);
    return g;
  };
  shelfUnit(-2.6, R.minZ + 0.22, 0, 2.2, 3.4, 0.03, 3);
  shelfUnit(2.6, R.minZ + 0.22, 0, 2.2, 3.2, -0.035, 11);
  block(-2.6, R.minZ + 0.22, 2.2, 0.45); block(2.6, R.minZ + 0.22, 2.2, 0.45);
  shelfUnit(R.minX + 0.22, -2.6, Math.PI / 2, 2.6, 3.0, 0.02, 21);
  shelfUnit(R.minX + 0.22, 0.6, Math.PI / 2, 2.6, 3.5, -0.025, 33);
  block(R.minX + 0.22, -2.6, 0.45, 2.6); block(R.minX + 0.22, 0.6, 0.45, 2.6);
  // a ladder leaning on the tall one
  {
    const lad = new THREE.Group();
    for (const s of [-1, 1]) lad.add(at(box(0.04, 3.0, 0.04, wood), s * 0.2, 1.5, 0));
    for (let i = 0; i < 9; i++) lad.add(at(box(0.4, 0.03, 0.03, wood), 0, 0.3 + i * 0.32, 0));
    lad.position.set(R.minX + 0.75, 0, 1.4); lad.rotation.set(0, Math.PI / 2, -0.2); group.add(lad);
  }

  // ── the fireplace on the east wall: low green-blue flames (spooky!), a mantel of candles
  const FX = R.maxX - 0.3, FZ = -1.2;
  {
    const stone = std('#4a4450', { roughness: 0.95 });
    group.add(at(box(0.6, 1.4, 2.2, stone), FX, 0.7, FZ));
    group.add(at(box(0.62, 0.12, 2.5, darkWood), FX - 0.04, 1.46, FZ));
    group.add(at(box(0.3, 2.7, 1.6, stone), FX + 0.1, 2.85, FZ));
    group.add(at(box(0.62, 0.9, 1.1, std('#0d0a10', { roughness: 1 })), FX - 0.01, 0.5, FZ));
    for (let i = 0; i < 3; i++) group.add(at(cyl(0.05, 0.05, 0.7, std('#3a2416'), 8).rotateX(Math.PI / 2).rotateZ(0.2 * (i - 1)), FX - 0.15, 0.12 + (i % 2) * 0.07, FZ + (i - 1) * 0.12));
    const flameM = new THREE.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const flames = [];
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 10), flameM); f.position.set(FX - 0.2, 0.3, FZ - 0.3 + i * 0.15); group.add(f); flames.push(f); }
    const fireL = new THREE.PointLight('#6affb0', 1.6, 5, 1.4); fireL.position.set(FX - 0.6, 0.6, FZ); group.add(fireL); lights.push(fireL);
    flickers.push({ l: fireL, base: 1.6, k: 1.7 });
    animate?.((dt, t) => flames.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(t * 9 + i * 1.7) * 0.25; f.scale.x = f.scale.z = 0.9 + Math.sin(t * 7 + i) * 0.1; }));
    block(FX, FZ, 0.8, 2.6);
  }

  // ── candles: a candelabra on the mantel and on the table, and the chandelier
  const candleM = std('#f4ead6', { roughness: 0.7 });
  const flameM = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  const candle = (parent, x, y, z, h = 0.18) => {
    parent.add(at(cyl(0.022, 0.024, h, candleM, 10), x, y + h / 2, z));
    const f = ball(0.016, flameM, 8); f.scale.y = 1.8; f.position.set(x, y + h + 0.025, z); parent.add(f);
    return f;
  };
  const candelabra = (x, y, z, ry = 0) => {
    const g = new THREE.Group();
    g.add(at(cyl(0.08, 0.1, 0.03, brass, 14), 0, 0.015, 0));
    g.add(at(cyl(0.015, 0.015, 0.3, brass, 8), 0, 0.15, 0));
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.01, 6, 16, Math.PI), brass); arm.rotation.z = Math.PI; arm.position.y = 0.32; g.add(arm);
    const fl = [candle(g, -0.13, 0.32, 0), candle(g, 0, 0.3, 0, 0.22), candle(g, 0.13, 0.32, 0)];
    g.position.set(x, y, z); g.rotation.y = ry; group.add(g);
    const l = new THREE.PointLight('#ffb35a', 1.3, 5, 1.6); l.position.set(x, y + 0.6, z); group.add(l); lights.push(l);
    flickers.push({ l, base: 1.3, k: 2.3 + x, fl });
    return g;
  };
  candelabra(FX - 0.1, 1.52, FZ - 0.7, -Math.PI / 2);
  candelabra(FX - 0.1, 1.52, FZ + 0.75, -Math.PI / 2);

  // ── the reading table in the middle, its candelabra, the candy bowl, chairs
  const TX = 0.4, TZ = 0.4;
  {
    group.add(at(rbox(2.0, 0.08, 1.0, 0.03, wood), TX, 0.76, TZ));
    for (const a of [-1, 1]) for (const b of [-1, 1]) group.add(at(cyl(0.04, 0.03, 0.74, darkWood, 8), TX + a * 0.88, 0.37, TZ + b * 0.4));
    block(TX, TZ, 2.0, 1.0);
    candelabra(TX - 0.5, 0.8, TZ, 0);
    // an open spell book, a skull-shaped mug (a cute one), spilled sweets
    const open = book('#5a2a4a'); open.userData.flap(1.35); open.position.set(TX + 0.2, 0.82, TZ + 0.1); open.rotation.y = 0.3; group.add(open);
    const bowl = new THREE.Group();
    bowl.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#7a3fa0', { roughness: 0.4, side: THREE.DoubleSide })), 0, 0.15, 0));
    bowl.add(at(cyl(0.07, 0.09, 0.03, std('#7a3fa0', { roughness: 0.4 }), 14), 0, 0.015, 0));
    const SWEET = ['#ff6a9a', '#ffd23f', '#7dd8a0', '#ff9a3a', '#c98aff', '#6ac8ff'];
    for (let i = 0; i < 16; i++) { const a = i * 2.4, d = 0.03 + (i % 4) * 0.025; const s = ball(0.028, std(SWEET[i % 6], { roughness: 0.3 }), 10); s.scale.set(1.5, 0.8, 0.8); s.position.set(Math.cos(a) * d, 0.12 + (i % 3) * 0.02, Math.sin(a) * d); s.rotation.y = a; bowl.add(s); }
    bowl.position.set(TX + 0.7, 0.8, TZ - 0.15); group.add(bowl);
    clickable(bowl, { kind: 'haunt-candy', label: 'A bowl of Halloween sweets 🍬' });
    // chairs, high-backed and a little gothic
    const chairM = std('#4a2a3a', { roughness: 0.8 });
    const gothChair = (id, x, z, ry) => {
      const c = new THREE.Group();
      c.add(at(rbox(0.48, 0.08, 0.46, 0.03, chairM), 0, 0.46, 0));
      const back = at(rbox(0.48, 0.8, 0.06, 0.03, chairM), 0, 0.92, -0.21); c.add(back);
      for (const s of [-1, 1]) { const sp = ball(0.04, darkWood, 8); sp.scale.y = 1.6; sp.position.set(s * 0.22, 1.38, -0.21); c.add(sp); }
      for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(at(box(0.04, 0.46, 0.04, darkWood), a * 0.2, 0.23, b * 0.19));
      c.position.set(x, 0, z); c.rotation.y = ry; group.add(c);
      const s = { id, label: 'a high-backed chair', x, z, y: fy, h: 0.5, ry };
      seats.push(s);
      clickable(c, { kind: 'seat', seat: s, label: 'Sit on a high-backed chair' });
      return c;
    };
    gothChair('haunt-chair-0', TX - 0.5, TZ + 0.85, Math.PI);
    gothChair('haunt-chair-1', TX + 0.5, TZ + 0.85, Math.PI);
    gothChair('haunt-chair-2', TX - 0.5, TZ - 0.85, 0);
    gothChair('haunt-chair-3', TX + 0.5, TZ - 0.85, 0);
  }

  // ── two armchairs by the fire
  {
    const velvet = std('#5a2a5a', { roughness: 0.95 });
    for (const [i, z] of [[0, FZ - 1.6], [1, FZ + 1.7]]) {
      const x = FX - 1.6, ry = i ? -Math.PI * 0.75 : -Math.PI * 0.25;
      const c = new THREE.Group();
      c.add(at(rbox(0.8, 0.42, 0.75, 0.12, velvet), 0, 0.21, 0));
      c.add(at(rbox(0.8, 0.9, 0.2, 0.1, velvet), 0, 0.7, -0.3));
      for (const s of [-1, 1]) c.add(at(rbox(0.16, 0.55, 0.75, 0.07, velvet), s * 0.36, 0.45, 0));
      c.position.set(x, 0, z); c.rotation.y = ry; group.add(c);
      block(x, z, 0.85, 0.85);
      const s = { id: `haunt-armchair-${i}`, label: 'a velvet armchair by the fire', x, z, y: fy, h: 0.44, ry };
      seats.push(s);
      clickable(c, { kind: 'seat', seat: s, label: 'Curl up in a velvet armchair by the fire' });
    }
  }

  // ── the cauldron in the north-west corner, bubbling green
  const CX = R.minX + 1.3, CZ = R.minZ + 1.3;
  {
    const iron = std('#26222a', { metalness: 0.4, roughness: 0.6 });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, Math.PI * 0.28, Math.PI * 0.72), iron);
    pot.material.side = THREE.DoubleSide;
    pot.position.set(CX, 0.6, CZ); group.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.05, 8, 28), iron); rim.rotation.x = Math.PI / 2; rim.position.set(CX, 0.92, CZ); group.add(rim);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; group.add(at(cyl(0.04, 0.03, 0.3, iron, 8), CX + Math.cos(a) * 0.32, 0.15, CZ + Math.sin(a) * 0.32)); }
    const brewM = std('#5aff7a', { emissive: '#2aff5a', emissiveIntensity: 0.9, roughness: 0.3 });
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.38, 28), brewM); brew.rotation.x = -Math.PI / 2; brew.position.set(CX, 0.88, CZ); group.add(brew);
    const bubbles = [];
    for (let i = 0; i < 9; i++) { const b = ball(0.035 + (i % 3) * 0.015, brewM, 10); group.add(b); bubbles.push({ b, a: i * 0.7, d: 0.08 + (i % 4) * 0.07, p: i / 9 }); }
    const glow = new THREE.PointLight('#5aff7a', 1.4, 4, 1.5); glow.position.set(CX, 1.3, CZ); group.add(glow); lights.push(glow);
    flickers.push({ l: glow, base: 1.4, k: 0.9 });
    animate?.((dt, t) => bubbles.forEach(o => { const ph = (t * 0.6 + o.p) % 1; o.b.position.set(CX + Math.cos(o.a + t * 0.3) * o.d, 0.88 + ph * 0.12, CZ + Math.sin(o.a + t * 0.3) * o.d); o.b.scale.setScalar(ph < 0.85 ? 0.6 + ph * 0.6 : (1 - ph) * 6); }));
    block(CX, CZ, 1.1, 1.1);
  }

  // ── the chandelier, iron and candles, over the table
  const chand = new THREE.Group();
  {
    const iron = std('#1e1a22', { metalness: 0.5, roughness: 0.5 });
    chand.add(at(cyl(0.01, 0.01, 0.9, iron, 6), 0, 0.45, 0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 32), iron); ring.rotation.x = Math.PI / 2; chand.add(ring);
    const fl = [];
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; fl.push(candle(chand, Math.cos(a) * 0.55, 0.02, Math.sin(a) * 0.55, 0.14)); }
    chand.position.set(TX, R.h - 1.0, TZ); group.add(chand);
    const l = new THREE.PointLight('#ffc27a', 2.0, 8, 1.5); l.position.set(TX, R.h - 1.15, TZ); group.add(l); lights.push(l);
    flickers.push({ l, base: 2.0, k: 3.1, fl });
  }

  // ── jack-o'-lanterns, glowing: by the door, on the window sill, by the fire
  for (const [x, y, z, r, ry] of [[-1.3, 0, R.maxZ - 0.6, 0.26, Math.PI], [1.3, 0, R.maxZ - 0.6, 0.22, Math.PI], [-0.9, 0.85, R.minZ + 0.3, 0.17, 0], [FX - 0.75, 0, FZ + 0.6, 0.24, -Math.PI / 2], [R.minX + 0.6, 0, R.maxZ - 0.7, 0.3, Math.PI * 0.75]]) {
    const p = pumpkin(r, face); p.position.set(x, y, z); p.rotation.y = ry; group.add(p);
    const l = new THREE.PointLight('#ff9a3a', 0.9, 2.6, 1.6); l.position.set(x, y + r + 0.25, z); group.add(l); lights.push(l);
    flickers.push({ l, base: 0.9, k: 4.1 + x });
  }

  // ── cobwebs in the top corners, and a little spider on a thread
  {
    const web = webTex();
    const webM = new THREE.MeshBasicMaterial({ map: web, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 });
    // (flat on the end walls, their corner tucked into the corner of the room)
    const geo = new THREE.PlaneGeometry(1.1, 1.1); geo.translate(0.55, -0.55, 0);
    for (const [x, z, ry, flip] of [[R.minX, R.minZ + 0.02, 0, 1], [R.maxX, R.minZ + 0.02, 0, -1], [R.maxX, R.maxZ - 0.02, Math.PI, 1], [R.minX, R.maxZ - 0.02, Math.PI, -1]]) {
      const w = new THREE.Mesh(geo, webM);
      w.position.set(x, R.h, z); w.rotation.y = ry; w.scale.x = flip;
      group.add(w);
    }
    const spider = new THREE.Group();
    spider.add(at(cyl(0.002, 0.002, 1, std('#ddd'), 4), 0, 0.5, 0));
    const body = ball(0.04, std('#1a1418', { roughness: 0.5 }), 10); spider.add(body);
    for (const s of [-1, 1]) { const e = ball(0.009, new THREE.MeshBasicMaterial({ color: '#fff' }), 6); e.position.set(s * 0.015, 0.01, 0.035); spider.add(e); }
    for (let i = 0; i < 8; i++) { const leg = at(cyl(0.004, 0.004, 0.08, std('#1a1418'), 4), (i < 4 ? -1 : 1) * 0.05, -0.01, -0.03 + (i % 4) * 0.02); leg.rotation.z = (i < 4 ? 1 : -1) * 1.0; spider.add(leg); }
    spider.position.set(R.maxX - 1.0, R.h - 1.2, R.minZ + 1.0); group.add(spider);
    animate?.((dt, t) => { spider.position.y = R.h - 1.15 + Math.sin(t * 0.7) * 0.25; spider.scale.y = 1; });
  }

  // ── a grandfather clock by the door, stopped at midnight
  {
    const g = new THREE.Group();
    g.add(at(rbox(0.5, 2.1, 0.35, 0.03, darkWood), 0, 1.05, 0));
    g.add(at(rbox(0.6, 0.12, 0.42, 0.03, wood), 0, 2.16, 0));
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.17, 28), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c, w) => {
      c.fillStyle = '#efe4c8'; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#2a1a1a'; c.lineWidth = 5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 18); c.moveTo(64, 64); c.lineTo(66, 30); c.stroke();
      c.fillStyle = '#2a1a1a'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.fillRect(64 + Math.sin(a) * 52 - 2, 64 - Math.cos(a) * 52 - 2, 4, 4); }
    }) }));
    dial.position.set(0, 1.75, 0.18); g.add(dial);
    const pend = new THREE.Group(); pend.position.set(0, 1.45, 0.18); g.add(pend);
    pend.add(at(cyl(0.008, 0.008, 0.6, brass, 6), 0, -0.3, 0)); pend.add(at(cyl(0.07, 0.07, 0.015, brass, 16).rotateX(Math.PI / 2), 0, -0.62, 0));
    g.position.set(R.maxX - 0.4, 0, R.maxZ - 1.2); g.rotation.y = -Math.PI / 2; group.add(g);
    block(R.maxX - 0.4, R.maxZ - 1.2, 0.45, 0.6);
    animate?.((dt, t) => { pend.rotation.z = Math.sin(t * 2.2) * 0.22; });
  }

  // ── a pile of old books by the door (something's hiding behind it…)
  {
    const pile = new THREE.Group();
    for (let i = 0; i < 7; i++) { const b = at(box(0.32 - (i % 3) * 0.03, 0.07, 0.24, std(SPINES[(i * 3) % SPINES.length], { roughness: 0.75 })), 0, 0.035 + i * 0.07, 0); b.rotation.y = (i % 3 - 1) * 0.3; pile.add(b); }
    pile.position.set(R.minX + 1.2, 0, R.maxZ - 0.4); group.add(pile);
  }

  // ── a misty floor: a few big soft discs drifting low
  const mist = [];
  {
    const tex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(200,190,230,0.5)'); gr.addColorStop(1, 'rgba(200,190,230,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.22 });
    for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), m); d.rotation.x = -Math.PI / 2; d.position.y = 0.05 + i * 0.008; group.add(d); mist.push({ d, a: i * 1.9, r: 1.5 + (i % 4) * 1.1 }); }
    animate?.((dt, t) => mist.forEach(o => { const a = o.a + t * 0.05; o.d.position.x = Math.cos(a) * o.r; o.d.position.z = Math.sin(a) * o.r * 0.8; }));
  }

  // ── floating books, drifting round and flapping their covers
  const floaters = [];
  for (let i = 0; i < 12; i++) {
    const b = book(SPINES[i % SPINES.length]);
    group.add(b);
    floaters.push({ b, a: i * (Math.PI * 2 / 12), r: 2.2 + (i % 3) * 1.2, y: 1.9 + (i % 4) * 0.45, s: 0.12 + (i % 5) * 0.03, p: i * 1.3 });
  }
  animate?.((dt, t) => floaters.forEach(o => {
    const a = o.a + t * o.s;
    o.b.position.set(TX + Math.cos(a) * o.r, o.y + Math.sin(t * 0.8 + o.p) * 0.18, TZ + Math.sin(a) * o.r * 0.75);
    o.b.rotation.set(Math.sin(t * 0.5 + o.p) * 0.2, -a, Math.sin(t * 0.7 + o.p) * 0.15);
    o.b.userData.flap(0.6 + Math.sin(t * 2.4 + o.p) * 0.5);
  }));

  // ── the friendly ghost: a soft white sheet with a wavy hem, a sweet face,
  //    floating a loop round the room and bobbing as it goes
  const ghost = new THREE.Group();
  {
    const sheetM = std('#fbfaff', { roughness: 0.6, emissive: '#c8c8ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
    const prof = [];
    // a round dome of a head, then the sheet falling and flaring out to the hem
    for (let i = 0; i <= 10; i++) { const th = (i / 10) * Math.PI / 2; prof.push(new THREE.Vector2(Math.sin(th) * 0.32, 0.64 + Math.cos(th) * 0.32)); }
    for (let i = 1; i <= 8; i++) { const k = i / 8; prof.push(new THREE.Vector2(0.32 + k * k * 0.08, 0.64 - k * 0.64)); }
    prof.reverse();
    const geo = new THREE.LatheGeometry(prof, 40);
    // a wavy hem: push the bottom ring up and down round the circle
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < 0.25) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); pos.setY(i, y + Math.sin(a * 7) * 0.05 * (1 - y / 0.25)); } }
    geo.computeVertexNormals();
    const sheet = new THREE.Mesh(geo, sheetM); ghost.add(sheet);
    const eyeM = new THREE.MeshBasicMaterial({ color: '#1e1a2a' });
    for (const s of [-1, 1]) {
      const e = ball(0.045, eyeM, 12); e.scale.set(0.8, 1.15, 0.5); e.position.set(s * 0.11, 0.68, 0.29); ghost.add(e);
      const shine = ball(0.013, new THREE.MeshBasicMaterial({ color: '#fff' }), 8); shine.position.set(s * 0.11 + 0.012, 0.7, 0.315); ghost.add(shine);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), new THREE.MeshBasicMaterial({ color: '#ff9ab8', transparent: true, opacity: 0.6 }));
      blush.position.set(s * 0.18, 0.6, 0.27); blush.rotation.y = s * 0.5; ghost.add(blush);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 14, Math.PI), eyeM); mouth.rotation.z = Math.PI; mouth.position.set(0, 0.6, 0.305); ghost.add(mouth);
    // little arms
    for (const s of [-1, 1]) { const arm = ball(0.07, sheetM, 12); arm.scale.set(1.4, 0.6, 0.7); arm.position.set(s * 0.33, 0.42, 0.04); arm.rotation.z = s * -0.5; ghost.add(arm); }
    const glow = new THREE.PointLight('#c8d0ff', 0.8, 3, 1.6); glow.position.y = 0.5; ghost.add(glow); lights.push(glow);
    group.add(ghost);
    clickable(sheet, { kind: 'haunt-ghost', label: 'A friendly ghost 👻' });
    ghost.children.forEach(c => { if (c.isMesh && c !== sheet) { c.userData = { kind: 'haunt-ghost', label: 'A friendly ghost 👻' }; interactables.push(c); } });
  }
  animate?.((dt, t) => {
    // a figure-of-eight loop round the room, high enough to float past heads
    const a = t * 0.12;
    const x = Math.sin(a) * 4.2, z = Math.sin(a * 2) * 2.6 + 0.4;
    const dx = Math.cos(a) * 4.2, dz = Math.cos(a * 2) * 5.2;
    ghost.position.set(x, 1.7 + Math.sin(t * 1.6) * 0.15, z);
    ghost.rotation.y = Math.atan2(dx, dz);
    ghost.rotation.z = Math.sin(t * 1.6) * 0.06;
  });

  // ── the ten hidden pumpkins, ~15 cm, tucked away in nooks
  const HIDE = [
    [-2.6 + 0.7, 3.42, R.minZ + 0.25],          // 0 on top of the north-west bookshelf
    [TX + 0.3, 0, TZ - 0.1],                    // 1 under the reading table
    [FX - 1.95, 0, FZ - 2.05],                  // 2 behind the first armchair
    [FX - 0.22, 0.02, FZ + 0.35],               // 3 in the fireplace, by the logs
    [TX + 0.55 * Math.cos(1.05), R.h - 1.0 + 0.03, TZ + 0.55 * Math.sin(1.05)], // 4 sitting on the chandelier
    [CX + 0.36, 0.96, CZ + 0.1],                // 5 on the rim of the cauldron
    [0.75, 0.82, R.minZ + 0.2],                 // 6 on the window sill
    [R.minX + 0.3, 1.03, 0.0],                  // 7 in a gap on the tall west bookshelf
    [R.maxX - 0.4, 2.23, R.maxZ - 1.2],         // 8 on top of the grandfather clock
    [R.minX + 1.25, 0, R.maxZ - 0.15],          // 9 behind the pile of books by the door
  ];
  const hidden = HIDE.map(([x, y, z], n) => {
    const p = pumpkin(0.075); p.position.set(x, y, z); p.rotation.y = n * 1.3; group.add(p);
    clickable(p, { kind: 'haunt-pumpkin', n, label: 'A little pumpkin! 🎃' });
    return p;
  });

  // ── the name sign over the window, and the door back out
  const name = makeSign([{ text: 'The Haunted Library', size: 120, weight: '700', color: '#ffb35a' }, { text: 'mind the ghost · find the pumpkins 🎃', font: 'Dancing Script, cursive', size: 66, color: '#c8b8ff' }], 2.2, 0.55, { bg: '#1a1420', border: '#ff9a3a' });
  name.position.set(0, R.h - 0.3, R.minZ + 0.06); group.add(name);
  doorOut({ group, R, makeSign, interactables, color: '#3a2a3a', to: 'landing4', sign: '⬅ The landing', label: 'Back out to the landing' });

  // flickering lights (and their little flames)
  animate?.((dt, t) => flickers.forEach(f => {
    const n = Math.sin(t * 13 + f.k) * 0.5 + Math.sin(t * 7.3 + f.k * 2) * 0.35 + Math.sin(t * 23 + f.k) * 0.15;
    f.l.intensity = f.base * (0.82 + n * 0.18);
    if (f.fl) f.fl.forEach((m, i) => { m.scale.y = 1.6 + Math.sin(t * 15 + i + f.k) * 0.35; });
  }));

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
    pumpkins: HIDE.length,
    // the ones you've already found go (n = 0..9)
    setFound(found = []) { const f = new Set(found); hidden.forEach((p, n) => { p.visible = !f.has(n); }); },
  };
}
