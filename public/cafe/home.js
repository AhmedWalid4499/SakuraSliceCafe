// Someone's own room upstairs: the empty room (walls in their colour, their
// floor, a window onto Cairo, the door back to the hallway) and whatever
// furniture they've put in it. world.js gives us a floor ({ group, colliders,
// seats, surfaces, interactables }) and we keep its lists up to date as
// furniture comes and goes, so sitting, sleeping, putting a drink down and
// bumping into things all just work.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM_SIZE, AREAS, DOORWAYS, BY_KIND, footprint, areaAt, COATS } from './furniture.mjs';
import { makeDessert } from './pastries.js';

const R = ROOM_SIZE;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, m) => shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m));
const box = (w, h, d, m) => shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
const cyl = (rt, rb, h, m, seg = 24) => shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m));
const ball = (r, m, seg = 20) => shade(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.6)), m));
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const lighten = (c, k) => new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k);
const darken = (c, k) => new THREE.Color(c).lerp(new THREE.Color('#1a1210'), k);

function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}
const FLOOR_TEX = {
  oak: () => planks('#e2c4a0', 11),
  walnut: () => planks('#9a6a4c', 23),
  tatami: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#cdbf8f'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) { g.fillStyle = y % 8 ? 'rgba(120,110,60,.10)' : 'rgba(255,255,230,.12)'; g.fillRect(0, y, s, 2); }
    g.fillStyle = '#3f5a3a'; g.fillRect(0, 0, s, 10); g.fillRect(0, s / 2 - 5, s, 10);
  }, [R.maxX - R.minX, (R.maxZ - R.minZ) / 2].map(v => v / 2)),
  tile: () => canvasTex(512, (g, s) => {
    const n = 4, c = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#e9e2d6' : '#f6f1ea'; g.fillRect(i * c, j * c, c, c); }
    g.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, s); g.moveTo(0, i * c); g.lineTo(s, i * c); g.stroke(); }
  }, [(R.maxX - R.minX) / 2.4, (R.maxZ - R.minZ) / 2.4]),
};
function planks(base, seed) {
  return canvasTex(1024, (g, s) => {
    const r = rand(seed), rows = 8, ph = s / rows, col = new THREE.Color(base);
    for (let row = 0; row < rows; row++) {
      let x = -r() * 300;
      while (x < s) {
        const len = 260 + r() * 300, k = 0.88 + r() * 0.24;
        g.fillStyle = `rgb(${Math.min(255, col.r * 255 * k)}, ${Math.min(255, col.g * 255 * k)}, ${Math.min(255, col.b * 255 * k)})`;
        g.fillRect(x, row * ph, len, ph);
        g.fillStyle = 'rgba(60,35,20,0.3)'; g.fillRect(x, row * ph, 2, ph);
        x += len;
      }
      g.fillStyle = 'rgba(60,35,20,0.25)'; g.fillRect(0, row * ph, s, 2);
    }
  }, [(R.maxX - R.minX) / 4, (R.maxZ - R.minZ) / 4]);
}

// ── the furniture, drawn. Each returns a group facing +z (backs and
// headboards at −z), sitting on y = 0.
const BUILD = {
  bed(c, def) { return bed(c, def, 0.42); },
  'bed-double'(c, def) { return bed(c, def, 0.42); },
  futon(c, def) {
    const g = new THREE.Group();
    g.add(at(rbox(def.w, 0.1, def.d, 0.04, std('#f4ece0', { roughness: 1 })), 0, 0.05, 0));
    g.add(at(rbox(def.w - 0.04, 0.06, def.d * 0.62, 0.03, std(c, { roughness: 1 })), 0, 0.13, def.d * 0.17));
    g.add(at(rbox(def.w * 0.55, 0.08, 0.3, 0.04, std('#fffaf4', { roughness: 1 })), 0, 0.14, -def.d / 2 + 0.28));
    return g;
  },
  nightstand(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.6 });
    g.add(at(rbox(def.w, def.top, def.d, 0.02, m), 0, def.top / 2, 0));
    g.add(at(box(def.w - 0.08, 0.004, 0.005, std(darken(c, 0.4))), 0, def.top * 0.55, def.d / 2 + 0.002));
    g.add(at(ball(0.018, std('#c9a25b', { metalness: 0.8, roughness: 0.3 })), 0, def.top * 0.72, def.d / 2 + 0.01));
    return g;
  },
  desk(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.55 }), leg = std(darken(c, 0.35), { roughness: 0.6 });
    g.add(at(rbox(def.w, 0.05, def.d, 0.015, m), 0, def.top - 0.025, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(box(0.05, def.top - 0.05, 0.05, leg), x * (def.w / 2 - 0.06), (def.top - 0.05) / 2, z * (def.d / 2 - 0.06)));
    g.add(at(rbox(0.4, 0.14, def.d - 0.1, 0.01, m), def.w / 2 - 0.26, def.top - 0.12, 0));
    return g;
  },
  'desk-chair'(c) {
    const g = new THREE.Group(), frame = std('#3a3d44', { roughness: 0.4, metalness: 0.4 });
    g.add(at(rbox(0.46, 0.08, 0.46, 0.04, std(c, { roughness: 0.95 })), 0, 0.47, 0));
    const back = at(rbox(0.44, 0.48, 0.07, 0.04, std(c, { roughness: 0.95 })), 0, 0.8, -0.21); back.rotation.x = -0.1; g.add(back);
    g.add(at(cyl(0.03, 0.03, 0.36, frame, 12), 0, 0.25, 0));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const l = at(box(0.26, 0.03, 0.04, frame), Math.cos(a) * 0.13, 0.05, Math.sin(a) * 0.13); l.rotation.y = -a; g.add(l); g.add(at(ball(0.025, frame, 10), Math.cos(a) * 0.26, 0.025, Math.sin(a) * 0.26)); }
    return g;
  },
  laptop(c) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.35, metalness: 0.5 });
    g.add(at(rbox(0.34, 0.015, 0.24, 0.006, m), 0, 0.008, 0.02));
    const lid = new THREE.Group(); lid.position.set(0, 0.015, -0.1); lid.rotation.x = -0.25;
    lid.add(at(rbox(0.34, 0.22, 0.012, 0.006, m), 0, 0.11, 0));
    lid.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ map: screenTex() })), 0, 0.115, 0.007));
    g.add(lid);
    return g;
  },
  'desk-lamp'(c) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.4, metalness: 0.3 });
    g.add(at(cyl(0.07, 0.08, 0.02, m), 0, 0.01, 0));
    const arm = at(cyl(0.01, 0.01, 0.32, m, 8), 0, 0.17, 0); arm.rotation.z = 0.2; g.add(arm);
    const head = at(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 20, 1, true), std(c, { side: THREE.DoubleSide, roughness: 0.5 })), -0.06, 0.33, 0); head.rotation.z = -0.9; g.add(head);
    g.add(at(ball(0.025, new THREE.MeshBasicMaterial({ color: '#fff1cf' }), 10), -0.09, 0.3, 0));
    return g;
  },
  bookshelf(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.6 });
    for (const x of [-1, 1]) g.add(at(box(0.04, def.top, def.d, m), x * (def.w / 2 - 0.02), def.top / 2, 0));
    g.add(at(box(def.w, def.top, 0.02, std(darken(c, 0.2))), 0, def.top / 2, -def.d / 2 + 0.01));
    const r = rand(17), cols = ['#c4627f', '#93ab8c', '#f0b56a', '#6a87a8', '#f4ece0', '#a35d4a', '#7b5ea7'];
    for (let i = 0; i < 5; i++) {
      const y = 0.03 + i * (def.top - 0.06) / 4;
      g.add(at(box(def.w - 0.06, 0.03, def.d - 0.02, m), 0, y, 0.01));
      if (i === 4) continue;
      let x = -def.w / 2 + 0.06;
      while (x < def.w / 2 - 0.12) {
        const w = 0.03 + r() * 0.04, h = 0.24 + r() * 0.12;
        const b = at(box(w, h, def.d - 0.08, std(cols[Math.floor(r() * cols.length)], { roughness: 0.8 })), x + w / 2, y + 0.015 + h / 2, 0.02);
        if (r() < 0.08) b.rotation.z = 0.25;
        g.add(b); x += w + 0.006;
      }
    }
    return g;
  },
  armoire(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.55 });
    g.add(at(rbox(def.w, 1.95, def.d, 0.03, m), 0, 1.0, 0));
    g.add(at(rbox(def.w + 0.06, 0.06, def.d + 0.06, 0.02, std(darken(c, 0.25))), 0, 2.0, 0));
    g.add(at(box(0.008, 1.7, 0.01, std(darken(c, 0.45))), 0, 1.02, def.d / 2 + 0.002));
    for (const x of [-0.06, 0.06]) g.add(at(cyl(0.012, 0.012, 0.16, std('#c9a25b', { metalness: 0.8, roughness: 0.3 }), 10), x, 1.05, def.d / 2 + 0.03));
    for (const x of [-1, 1]) g.add(at(cyl(0.025, 0.02, 0.06, std(darken(c, 0.4)), 10), x * (def.w / 2 - 0.08), 0.03, 0));
    return g;
  },
  dresser(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.55 }), knob = std('#c9a25b', { metalness: 0.8, roughness: 0.3 });
    g.add(at(rbox(def.w, def.top - 0.08, def.d, 0.02, m), 0, def.top / 2 + 0.04, 0));
    for (let i = 0; i < 3; i++) {
      const y = 0.2 + i * 0.24;
      g.add(at(box(def.w - 0.06, 0.004, 0.005, std(darken(c, 0.4))), 0, y + 0.11, def.d / 2 + 0.002));
      for (const x of [-0.25, 0.25]) g.add(at(ball(0.018, knob, 10), x, y, def.d / 2 + 0.012));
    }
    for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(at(cyl(0.02, 0.015, 0.08, std(darken(c, 0.4)), 8), x * (def.w / 2 - 0.06), 0.04, z * (def.d / 2 - 0.06)));
    return g;
  },
  'side-table'(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.55 });
    g.add(at(cyl(def.w / 2, def.w / 2, 0.04, m, 32), 0, def.top - 0.02, 0));
    g.add(at(cyl(0.035, 0.04, def.top - 0.04, std(darken(c, 0.3)), 12), 0, (def.top - 0.04) / 2, 0));
    g.add(at(cyl(0.16, 0.18, 0.03, std(darken(c, 0.3)), 24), 0, 0.015, 0));
    return g;
  },
  armchair(c) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.95 });
    g.add(at(rbox(0.86, 0.36, 0.8, 0.1, m), 0, 0.3, 0));
    g.add(at(rbox(0.86, 0.6, 0.2, 0.08, m), 0, 0.68, -0.32));
    for (const x of [-1, 1]) g.add(at(rbox(0.16, 0.34, 0.78, 0.06, m), x * 0.37, 0.56, 0));
    g.add(at(rbox(0.56, 0.1, 0.56, 0.04, std(lighten(c, 0.25), { roughness: 1 })), 0, 0.53, 0.06));
    return g;
  },
  sofa(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.95 });
    g.add(at(rbox(def.w, 0.36, 0.82, 0.1, m), 0, 0.3, 0));
    g.add(at(rbox(def.w, 0.62, 0.2, 0.08, m), 0, 0.68, -0.32));
    for (const x of [-1, 1]) g.add(at(rbox(0.18, 0.36, 0.8, 0.06, m), x * (def.w / 2 - 0.09), 0.56, 0));
    for (const x of [-0.42, 0.42]) g.add(at(rbox(0.74, 0.1, 0.56, 0.04, std(lighten(c, 0.25), { roughness: 1 })), x, 0.53, 0.06));
    return g;
  },
  beanbag(c) {
    const g = new THREE.Group();
    const b = at(ball(0.42, std(c, { roughness: 1 }), 28), 0, 0.26, 0); b.scale.set(1, 0.62, 1); g.add(b);
    const back = at(ball(0.3, std(c, { roughness: 1 }), 24), 0, 0.42, -0.2); back.scale.set(1.1, 0.8, 0.6); g.add(back);
    return g;
  },
  'floor-cushion'(c) {
    const g = new THREE.Group();
    g.add(at(rbox(0.56, 0.14, 0.56, 0.06, std(c, { roughness: 1 })), 0, 0.07, 0));
    g.add(at(ball(0.025, std(darken(c, 0.3)), 10), 0, 0.145, 0));
    return g;
  },
  rug(c, def) {
    const g = new THREE.Group();
    const tex = canvasTex(256, (x, s) => {
      x.fillStyle = c; x.fillRect(0, 0, s, s);
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 8; x.strokeRect(14, 14, s - 28, s - 28);
      x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 3; x.strokeRect(26, 26, s - 52, s - 52);
    });
    const r = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.d), std('#ffffff', { map: tex, roughness: 1 }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.006; r.receiveShadow = true;
    g.add(r);
    return g;
  },
  plant(c) {
    const g = new THREE.Group(), leaf = std('#5f9a5a', { roughness: 0.8, side: THREE.DoubleSide });
    g.add(at(cyl(0.24, 0.18, 0.42, std(c, { roughness: 0.8 }), 24), 0, 0.21, 0));
    g.add(at(cyl(0.22, 0.22, 0.02, std('#4a3324'), 24), 0, 0.41, 0));
    const r = rand(5);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, h = 0.7 + r() * 0.5;
      const stem = at(cyl(0.008, 0.01, h, std('#4f7a3a'), 6), Math.cos(a) * 0.08, 0.42 + h / 2, Math.sin(a) * 0.08);
      stem.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      const l = at(ball(0.16, leaf, 14), Math.cos(a) * 0.3, 0.42 + h, Math.sin(a) * 0.3);
      l.scale.set(1, 0.2, 0.7); l.rotation.y = -a;
      g.add(stem, l);
    }
    return g;
  },
  'plant-small'(c) {
    const g = new THREE.Group();
    g.add(at(cyl(0.07, 0.055, 0.1, std(c, { roughness: 0.8 }), 16), 0, 0.05, 0));
    for (let i = 0; i < 5; i++) { const a = i * 1.25; const l = at(ball(0.045, std('#6fa35f'), 10), Math.cos(a) * 0.035, 0.13 + (i % 2) * 0.03, Math.sin(a) * 0.035); l.scale.set(0.6, 1.3, 0.6); g.add(l); }
    return g;
  },
  'floor-lamp'(c) {
    const g = new THREE.Group(), pole = std('#3a2a26', { roughness: 0.5, metalness: 0.3 });
    g.add(at(cyl(0.16, 0.18, 0.03, pole, 24), 0, 0.015, 0));
    g.add(at(cyl(0.015, 0.015, 1.45, pole, 10), 0, 0.74, 0));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.28, 28, 1, true), std(c, { side: THREE.DoubleSide, roughness: 0.9, emissive: '#ffcf8f', emissiveIntensity: 0.35 })), 0, 1.5, 0));
    g.add(at(ball(0.04, new THREE.MeshBasicMaterial({ color: '#fff1cf' }), 10), 0, 1.44, 0));
    return g;
  },
  'record-player'(c) {
    const g = new THREE.Group();
    g.add(at(rbox(0.42, 0.09, 0.34, 0.01, std(c, { roughness: 0.5 })), 0, 0.045, 0));
    g.add(at(cyl(0.14, 0.14, 0.008, std('#1c1c1f', { roughness: 0.3 }), 32), -0.04, 0.094, 0));
    g.add(at(cyl(0.04, 0.04, 0.01, std('#f2a7bb'), 16), -0.04, 0.1, 0));
    const arm = at(box(0.012, 0.012, 0.18, std('#c9ccd2', { metalness: 0.7, roughness: 0.3 })), 0.15, 0.11, 0.02); arm.rotation.y = 0.4; g.add(arm);
    return g;
  },
  plush() {
    const g = new THREE.Group();
    const body = at(ball(0.11, std('#9c8a6a', { roughness: 1 }), 20), 0, 0.11, 0); body.scale.set(1, 0.95, 0.9); g.add(body);
    const face = at(ball(0.085, std('#f4ead8', { roughness: 1 }), 18), 0, 0.125, 0.04); face.scale.set(1.05, 0.85, 0.55); g.add(face);
    for (const x of [-0.035, 0.035]) g.add(at(ball(0.016, std('#1e1a16'), 10), x, 0.135, 0.085));
    const beak = at(new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.025, 6), std('#e0a040')), 0, 0.11, 0.09); beak.rotation.x = Math.PI; g.add(beak);
    for (const s of [-1, 1]) { const b = at(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), std('#2f5d3a')), s * 0.02, 0.045, 0.09); b.rotation.z = s * Math.PI / 2; g.add(b); }
    const leaf = at(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 4), std('#5f8f45')), 0, 0.23, 0); leaf.rotation.z = 0.3; g.add(leaf);
    return g;
  },
  mug(c) {
    const g = new THREE.Group();
    g.add(at(cyl(0.04, 0.035, 0.09, std(c, { roughness: 0.3 }), 20), 0, 0.045, 0));
    g.add(at(cyl(0.035, 0.035, 0.004, std('#7a4e33'), 20), 0, 0.086, 0));
    const h = at(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16), std(c, { roughness: 0.3 })), 0.045, 0.048, 0); h.rotation.y = Math.PI / 2; g.add(h);
    return g;
  },
  'frame-wall'(c, def, item) { return onWall(frame(c, def, item)); },
  'frame-portrait'(c, def, item) { return onWall(frame(c, def, item)); },
  'frame-big'(c, def, item) { return onWall(frame(c, def, item)); },
  'frame-stand'(c, def, item) {
    // a little frame leaning back on its stand, for a desk or a shelf
    const g = new THREE.Group(), f = frame(c, def, item, true);
    f.position.set(0, def.picture.h / 2 + 0.035, 0.01); f.rotation.x = -0.18;
    g.add(f);
    const leg = at(box(0.02, def.picture.h * 0.9, 0.01, std(darken(c, 0.2))), 0, def.picture.h * 0.42, -0.05); leg.rotation.x = 0.4;
    g.add(leg);
    return g;
  },
  'book-stack'(c) {
    const g = new THREE.Group(), r = rand(31), cols = [c, '#f4ece0', '#6a87a8', '#93ab8c', '#a35d4a'];
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const h = 0.03 + r() * 0.025, b = at(box(0.2 + r() * 0.06, h, 0.15 + r() * 0.03, std(cols[i % cols.length], { roughness: 0.8 })), (r() - 0.5) * 0.03, y + h / 2, 0);
      b.rotation.y = (r() - 0.5) * 0.4; g.add(b); y += h;
    }
    return g;
  },
};

// A frame: the moulding, the owner's photo in it (cover-fit), and what they
// wrote underneath on a little card. The group's origin is the middle of the
// picture, flat against the wall, facing +z. No photo yet: a soft print.
const photoLoader = new THREE.TextureLoader();
// hung things are placed a hair off the wall (so they count as in the room);
// push the frame back so it sits flush
function onWall(f) { const g = new THREE.Group(); f.position.z = -0.03; g.add(f); return g; }
function frame(c, def, item = {}, small = false) {
  const g = new THREE.Group(), { w, h } = def.picture, b = small ? 0.025 : 0.05, m = std(c, { roughness: 0.5 });
  g.add(at(box(w + b * 2, b, 0.04, m), 0, h / 2 + b / 2, 0.02));
  g.add(at(box(w + b * 2, b, 0.04, m), 0, -h / 2 - b / 2, 0.02));
  for (const s of [-1, 1]) g.add(at(box(b, h, 0.04, m), s * (w / 2 + b / 2), 0, 0.02));
  g.add(at(box(w, h, 0.01, std('#f8f4ee')), 0, 0, 0.005));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.94), new THREE.MeshStandardMaterial({ map: printTex(), roughness: 0.6 }));
  pic.position.z = 0.012;
  g.add(pic);
  if (item.imageId) {
    photoLoader.load(`/api/home/photo/${item.imageId}`, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      // cover-fit: crop the photo to the frame's shape rather than squash it
      const a = (t.image.width / t.image.height) / (w / h);
      if (a > 1) { t.repeat.set(1 / a, 1); t.offset.set((1 - 1 / a) / 2, 0); } else { t.repeat.set(1, a); t.offset.set(0, (1 - a) / 2); }
      pic.material.map = t; pic.material.needsUpdate = true;
    });
  }
  if (item.caption) {
    const cw = Math.max(w * 0.9, small ? 0.2 : 0.42), ch = small ? 0.045 : 0.1;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshBasicMaterial({ map: captionTex(item.caption, cw / ch) }));
    if (small) { card.position.set(0, -h / 2 - b - ch / 2 - 0.01, 0.03); } else { card.position.set(0, -h / 2 - b - ch / 2 - 0.05, 0.004); }
    g.add(card);
  }
  return g;
}
let printT = null;
function printTex() {
  if (printT) return printT;
  printT = canvasTex(128, (g, n) => {
    const sky = g.createLinearGradient(0, 0, 0, n); sky.addColorStop(0, '#f6d7c3'); sky.addColorStop(1, '#f3e7d8');
    g.fillStyle = sky; g.fillRect(0, 0, n, n);
    g.fillStyle = '#f0b56a'; g.beginPath(); g.arc(n * 0.7, n * 0.4, n * 0.12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#93ab8c'; g.beginPath(); g.moveTo(0, n); g.lineTo(n * 0.35, n * 0.55); g.lineTo(n * 0.6, n * 0.8); g.lineTo(n * 0.8, n * 0.62); g.lineTo(n, n); g.fill();
    g.fillStyle = 'rgba(90,60,50,.55)'; g.font = '11px Georgia, serif'; g.textAlign = 'center'; g.fillText('choose a picture', n / 2, n - 10);
  });
  return printT;
}
// the line under a picture, in handwriting-ish ink on cream card
function captionTex(text, aspect) {
  const W = 512, H = Math.round(W / aspect);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf6ec'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#4a3a34'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = Math.round(H * 0.42);
  const fits = () => { g.font = `italic ${size}px Georgia, serif`; return g.measureText(text).width < W * 0.92; };
  while (size > H * 0.22 && !fits()) size--;
  if (fits()) g.fillText(text, W / 2, H / 2);
  else { // two lines, split near the middle at a space
    const mid = text.lastIndexOf(' ', Math.ceil(text.length / 2)) > 0 ? text.lastIndexOf(' ', Math.ceil(text.length / 2)) : Math.ceil(text.length / 2);
    size = Math.round(H * 0.3); g.font = `italic ${size}px Georgia, serif`;
    g.fillText(text.slice(0, mid).trim(), W / 2, H * 0.3, W * 0.94); g.fillText(text.slice(mid).trim(), W / 2, H * 0.7, W * 0.94);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// what's on the laptop: a page of writing, mid-sentence
let screenT = null;
function screenTex() {
  if (screenT) return screenT;
  screenT = canvasTex(256, (g, n) => {
    g.fillStyle = '#fdfbf7'; g.fillRect(0, 0, n, n);
    g.fillStyle = '#e9eef2'; g.fillRect(0, 0, n, 22);
    for (const [x, c] of [[10, '#f2a7bb'], [24, '#f0d27a'], [38, '#9fd0a0']]) { g.fillStyle = c; g.beginPath(); g.arc(x, 11, 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#3a3030'; g.font = 'bold 15px Georgia, serif'; g.fillText('Chapter 4', 18, 50);
    const r = rand(9);
    for (let y = 70; y < n - 20; y += 13) { g.fillStyle = 'rgba(58,48,48,.55)'; g.fillRect(18, y, 140 + r() * 80, 4); }
    g.fillStyle = '#d4678a'; g.fillRect(18 + 120, n - 33, 2, 10); // the cursor
  });
  return screenT;
}

// the kitchen and the bathroom
const steel = () => std('#c9ccd2', { metalness: 0.7, roughness: 0.3 });
const stone = () => std('#ece6dc', { roughness: 0.35 });
function cabinet(c, def) {
  const g = new THREE.Group(), m = std(c, { roughness: 0.55 });
  g.add(at(box(def.w - 0.04, 0.08, def.d - 0.08, std('#2a2420')), 0, 0.04, -0.02));
  g.add(at(rbox(def.w, 0.78, def.d - 0.04, 0.015, m), 0, 0.47, -0.02));
  g.add(at(rbox(def.w + 0.02, 0.05, def.d + 0.02, 0.01, stone()), 0, def.top - 0.025, 0));
  const n = Math.max(1, Math.round(def.w / 0.6));
  for (let i = 0; i < n; i++) {
    const x = -def.w / 2 + (i + 0.5) * (def.w / n);
    g.add(at(box(def.w / n - 0.04, 0.7, 0.008, std(lighten(c, 0.08))), x, 0.47, def.d / 2 - 0.02));
    g.add(at(box(0.12, 0.015, 0.02, steel()), x, 0.78, def.d / 2));
  }
  return g;
}
// ── rugs: one flat mat, its pattern drawn on a canvas
function rugTex(c, pattern, aspect) {
  const W = 512, H = Math.max(64, Math.round(W / aspect));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const light = '#' + lighten(c, 0.45).getHexString(), dark = '#' + darken(c, 0.3).getHexString();
  g.fillStyle = c; g.fillRect(0, 0, W, H);
  const r = rand(53);
  if (pattern === 'round') {
    for (let i = 0; i < 6; i++) { g.strokeStyle = i % 2 ? light : dark; g.lineWidth = 10; g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 14 - i * 34, 0, Math.PI * 2); g.stroke(); }
  } else if (pattern === 'runner') {
    g.strokeStyle = light; g.lineWidth = 14; g.strokeRect(18, 18, W - 36, H - 36);
    for (let y = 60; y < H - 60; y += 70) { g.fillStyle = dark; g.beginPath(); g.moveTo(W / 2, y); g.lineTo(W / 2 + 60, y + 30); g.lineTo(W / 2, y + 60); g.lineTo(W / 2 - 60, y + 30); g.fill(); }
  } else if (pattern === 'sakura') {
    g.strokeStyle = '#c4627f'; g.lineWidth = 10; g.strokeRect(16, 16, W - 32, H - 32);
    for (let i = 0; i < 26; i++) blossom(g, 40 + r() * (W - 80), 40 + r() * (H - 80), 12 + r() * 14, i % 3 ? '#f2a7bb' : '#e7849f');
  } else if (pattern === 'stripes') {
    for (let x = 0; x < W; x += 64) { g.fillStyle = (x / 64) % 2 ? light : dark; g.fillRect(x, 0, 28, H); }
  } else if (pattern === 'kilim') {
    g.strokeStyle = '#f1e3c8'; g.lineWidth = 12; g.strokeRect(14, 14, W - 28, H - 28);
    const cols = ['#f1e3c8', dark, '#c9a25b', '#2a2420'];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) {
      const cx = 70 + i * ((W - 140) / 4), cy = H * (0.25 + row * 0.25), s = 34;
      g.fillStyle = cols[(row + i) % cols.length];
      g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s, cy); g.fill();
      g.fillStyle = c; g.beginPath(); g.moveTo(cx, cy - s / 2.5); g.lineTo(cx + s / 2.5, cy); g.lineTo(cx, cy + s / 2.5); g.lineTo(cx - s / 2.5, cy); g.fill();
    }
  } else if (pattern === 'shaggy') {
    for (let i = 0; i < 2500; i++) { g.fillStyle = r() < 0.5 ? light : dark; g.globalAlpha = 0.25; g.fillRect(r() * W, r() * H, 3, 9); }
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function blossom(g, x, y, s, col) {
  g.fillStyle = col;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.5, s * 0.34, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#f7e08a'; g.beginPath(); g.arc(x, y, s * 0.18, 0, Math.PI * 2); g.fill();
}
function patternRug(c, def) {
  const g = new THREE.Group();
  const round = def.pattern === 'round';
  const geo = round ? new THREE.CircleGeometry(def.w / 2, 48) : new THREE.PlaneGeometry(def.w, def.d);
  const m = new THREE.Mesh(geo, std('#ffffff', { map: rugTex(c, def.pattern, def.w / def.d), roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.y = def.pattern === 'shaggy' ? 0.012 : 0.007; m.receiveShadow = true;
  g.add(m);
  if (def.pattern === 'shaggy') { const pad = at(rbox(def.w, 0.025, def.d, 0.012, std(c, { roughness: 1 })), 0, 0.0125, 0); g.add(pad); m.position.y = 0.026; }
  if (def.pattern === 'kilim' || def.pattern === 'runner') { // fringes at the ends
    const fr = std('#f1e3c8', { roughness: 1 });
    for (const s of [-1, 1]) for (let x = -def.w / 2 + 0.05; x < def.w / 2; x += 0.07) g.add(at(box(0.012, 0.004, 0.08, fr), x, 0.004, s * (def.d / 2 + 0.04)));
  }
  return g;
}

// the TV's screen: off, or showing what's on (setMovie below)
function screenCanvas(movie, big) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288;
  const g = cv.getContext('2d');
  if (!movie) { g.fillStyle = big ? '#e9e4dc' : '#14161b'; g.fillRect(0, 0, 512, 288); }
  else {
    const gr = g.createLinearGradient(0, 0, 512, 288); gr.addColorStop(0, '#2d2340'); gr.addColorStop(1, '#5a2a3c');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(226, 90); g.lineTo(226, 170); g.lineTo(296, 130); g.fill();
    g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#fbe3ea';
    g.fillText('Now showing', 256, 215);
    g.font = 'italic 20px Georgia, serif'; g.fillStyle = '#f4ece0';
    g.fillText((movie.title || 'a film').slice(0, 38), 256, 248);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

Object.assign(BUILD, {
  'rug-round'(c, def) { return patternRug(c, def); },
  'rug-runner'(c, def) { return patternRug(c, def); },
  'rug-sakura'(c, def) { return patternRug(c, def); },
  'rug-striped'(c, def) { return patternRug(c, def); },
  'rug-kilim'(c, def) { return patternRug(c, def); },
  'rug-shaggy'(c, def) { return patternRug(c, def); },
  'snack-shelf'(c, def) {
    // three open shelves; the pastries you've kept sit on them (home.setSnacks)
    const g = new THREE.Group(), m = std(c, { roughness: 0.6 });
    const H = 1.25;
    for (const x of [-1, 1]) g.add(at(box(0.04, H, def.d, m), x * (def.w / 2 - 0.02), H / 2, 0));
    g.add(at(box(def.w, H, 0.02, std(darken(c, 0.15))), 0, H / 2, -def.d / 2 + 0.01));
    const slots = new THREE.Group(); slots.name = 'slots';
    for (let i = 0; i < 4; i++) g.add(at(box(def.w - 0.04, 0.03, def.d - 0.02, m), 0, 0.03 + i * 0.4, 0.01));
    g.add(slots);
    const sign = at(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: captionTex('snacks ♡', 4) })), 0, H + 0.08, -def.d / 2 + 0.03);
    g.add(sign);
    return g;
  },
  tv(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.55 });
    g.add(at(rbox(def.w, 0.5, def.d, 0.02, m), 0, 0.25, 0));
    for (const x of [-0.35, 0.35]) g.add(at(box(0.6, 0.005, 0.01, std(darken(c, 0.4))), x, 0.25, def.d / 2 + 0.003));
    const frame = at(rbox(1.18, 0.7, 0.05, 0.015, std('#1a1b1f', { roughness: 0.3 })), 0, 0.5 + 0.08 + 0.35, -0.05);
    g.add(frame);
    g.add(at(box(0.3, 0.08, 0.2, std('#1a1b1f')), 0, 0.54, -0.05));
    const screen = at(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), new THREE.MeshBasicMaterial({ map: screenCanvas(null) })), 0, 0.93, -0.022);
    screen.name = 'screen';
    g.add(screen);
    return g;
  },
  projector(c, def) {
    const g = new THREE.Group(), m = std('#2a2420', { roughness: 0.4, metalness: 0.3 });
    for (const x of [-1, 1]) g.add(at(cyl(0.025, 0.025, 2.2, m, 10), x * (def.w / 2 - 0.05), 1.1, 0));
    for (const x of [-1, 1]) g.add(at(box(0.3, 0.03, 0.26, m), x * (def.w / 2 - 0.05), 0.015, 0));
    g.add(at(cyl(0.05, 0.05, def.w, m, 12), 0, 2.2, 0).rotateZ(Math.PI / 2));
    const screen = at(new THREE.Mesh(new THREE.PlaneGeometry(def.w - 0.2, (def.w - 0.2) * 9 / 16), new THREE.MeshBasicMaterial({ map: screenCanvas(null, true) })), 0, 2.15 - (def.w - 0.2) * 9 / 32, 0.01);
    screen.name = 'screen'; screen.userData.big = true;
    g.add(screen);
    return g;
  },
  popcorn(c) {
    const g = new THREE.Group();
    const tub = at(cyl(0.07, 0.05, 0.16, std('#fffaf4', { roughness: 0.8 }), 16), 0, 0.08, 0); g.add(tub);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(at(box(0.012, 0.16, 0.002, std(c)), Math.cos(a) * 0.062, 0.08, Math.sin(a) * 0.062).rotateY(-a + Math.PI / 2)); }
    const r = rand(8);
    for (let i = 0; i < 16; i++) g.add(at(ball(0.022, std(i % 5 ? '#fff4d6' : '#f0c868', { roughness: 1 }), 6), (r() - 0.5) * 0.09, 0.17 + r() * 0.04, (r() - 0.5) * 0.09));
    return g;
  },
  'cat-bed'(c, def) {
    const g = new THREE.Group();
    const rim = at(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 12, 28), std(c, { roughness: 1 })), 0, 0.08, 0); rim.rotation.x = Math.PI / 2; shade(rim); g.add(rim);
    g.add(at(cyl(0.24, 0.26, 0.06, std(lighten(c, 0.35), { roughness: 1 }), 28), 0, 0.04, 0));
    void def;
    return g;
  },
  'cat-tree'(c) {
    const g = new THREE.Group(), post = std('#d9c6a8', { roughness: 1 }), pad = std(c, { roughness: 1 });
    g.add(at(rbox(0.6, 0.06, 0.6, 0.02, pad), 0, 0.03, 0));
    g.add(at(cyl(0.06, 0.06, 1.0, post, 12), -0.12, 0.5, -0.1));
    g.add(at(cyl(0.05, 0.05, 0.55, post, 12), 0.16, 0.3, 0.12));
    g.add(at(rbox(0.36, 0.05, 0.36, 0.02, pad), 0.12, 0.6, 0.08));
    g.add(at(rbox(0.46, 0.05, 0.46, 0.02, pad), -0.08, 1.02, -0.06));
    const toy = at(ball(0.035, std('#f2a7bb')), 0.2, 0.42, 0.22); g.add(toy);
    g.add(at(cyl(0.002, 0.002, 0.15, std('#3a3030'), 4), 0.2, 0.52, 0.22));
    return g;
  },
});

Object.assign(BUILD, {
  'kitchen-counter'(c, def) { return cabinet(c, def); },
  'kitchen-sink'(c, def) {
    const g = cabinet(c, def);
    g.add(at(box(0.5, 0.012, 0.36, std('#8f959c', { metalness: 0.6, roughness: 0.25 })), 0, def.top + 0.001, 0.02));
    g.add(at(cyl(0.015, 0.015, 0.22, steel(), 10), 0, def.top + 0.11, -0.2));
    const spout = at(cyl(0.012, 0.012, 0.16, steel(), 10), 0, def.top + 0.22, -0.13); spout.rotation.x = Math.PI / 2; g.add(spout);
    return g;
  },
  stove(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.45 });
    g.add(at(rbox(def.w, def.top - 0.02, def.d, 0.015, m), 0, (def.top - 0.02) / 2, 0));
    g.add(at(box(def.w - 0.02, 0.012, def.d - 0.02, std('#1e1e22', { roughness: 0.3 })), 0, def.top - 0.01, 0));
    for (const [x, z] of [[-0.14, -0.13], [0.14, -0.13], [-0.14, 0.13], [0.14, 0.13]]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 8, 24), std('#555a60', { metalness: 0.5 }));
      r.rotation.x = Math.PI / 2; r.position.set(x, def.top + 0.002, z); g.add(r);
    }
    g.add(at(box(def.w - 0.12, 0.34, 0.01, std('#2a2d33', { roughness: 0.15 })), 0, 0.42, def.d / 2 + 0.002));
    g.add(at(box(def.w - 0.16, 0.02, 0.03, steel()), 0, 0.66, def.d / 2 + 0.02));
    for (let i = 0; i < 4; i++) g.add(at(cyl(0.018, 0.018, 0.02, std('#3a3d44'), 12), -0.21 + i * 0.14, 0.8, def.d / 2 + 0.01));
    return g;
  },
  fridge(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.35 });
    g.add(at(rbox(def.w, 1.8, def.d, 0.05, m), 0, 0.9, 0));
    g.add(at(box(def.w - 0.02, 0.008, 0.01, std(darken(c, 0.3))), 0, 1.22, def.d / 2 + 0.002));
    for (const y of [1.45, 0.85]) g.add(at(cyl(0.012, 0.012, 0.26, steel(), 10), def.w / 2 - 0.08, y, def.d / 2 + 0.03));
    g.add(at(box(0.08, 0.08, 0.005, std('#f2a7bb')), -0.12, 1.55, def.d / 2 + 0.003)); // a magnet
    return g;
  },
  'kitchen-table'(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.55 });
    g.add(at(rbox(def.w, 0.04, def.d, 0.012, m), 0, def.top - 0.02, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(cyl(0.025, 0.02, def.top - 0.04, std(darken(c, 0.3)), 12), x * (def.w / 2 - 0.07), (def.top - 0.04) / 2, z * (def.d / 2 - 0.07)));
    return g;
  },
  stool(c) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.6 });
    g.add(at(cyl(0.18, 0.17, 0.05, m, 24), 0, 0.62, 0));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const l = at(cyl(0.015, 0.018, 0.62, std(darken(c, 0.35)), 8), Math.cos(a) * 0.12, 0.31, Math.sin(a) * 0.12); l.rotation.set(Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1); g.add(l); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 20), std(darken(c, 0.35))); ring.rotation.x = Math.PI / 2; ring.position.y = 0.24; g.add(ring);
    return g;
  },
  kettle(c) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.35, metalness: 0.2 });
    const body = at(cyl(0.065, 0.085, 0.16, m, 24), 0, 0.08, 0); g.add(body);
    g.add(at(cyl(0.03, 0.06, 0.03, m, 20), 0, 0.175, 0));
    g.add(at(ball(0.015, std('#3a2a26'), 10), 0, 0.2, 0));
    const spout = at(cyl(0.01, 0.022, 0.1, m, 10), 0.09, 0.11, 0); spout.rotation.z = -0.9; g.add(spout);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 16, Math.PI), std('#3a2a26')); h.position.set(-0.02, 0.17, 0); g.add(h);
    return g;
  },
  'coffee-maker'(c) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.4 });
    g.add(at(rbox(0.24, 0.04, 0.22, 0.01, m), 0, 0.02, 0));
    g.add(at(rbox(0.1, 0.32, 0.2, 0.02, m), -0.07, 0.18, 0));
    g.add(at(rbox(0.24, 0.07, 0.22, 0.02, m), 0, 0.36, 0));
    g.add(at(cyl(0.055, 0.06, 0.13, new THREE.MeshStandardMaterial({ color: '#dff1ff', transparent: true, opacity: 0.35, roughness: 0.05 }), 20), 0.05, 0.105, 0));
    g.add(at(cyl(0.05, 0.05, 0.05, std('#4a2e1e'), 20), 0.05, 0.065, 0));
    return g;
  },
  'fruit-bowl'(c) {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(c, { roughness: 0.4, side: THREE.DoubleSide })), 0, 0.13, 0));
    const fruit = [['#f0a830', 0.05], ['#c7372f', 0.048], ['#f3df7a', 0.045], ['#f0a830', 0.05], ['#8fbf6a', 0.046]];
    fruit.forEach(([col, r], i) => g.add(at(ball(r, std(col, { roughness: 0.5 }), 14), Math.cos(i * 1.3) * 0.055, 0.06 + (i > 2 ? 0.05 : 0), Math.sin(i * 1.3) * 0.055)));
    return g;
  },
  bathtub(c, def) {
    // a proper tub: four sides round warm water, on little brass feet
    const g = new THREE.Group(), m = std(c, { roughness: 0.25 });
    const t = 0.08, h = 0.5, y0 = 0.07;
    g.add(at(rbox(def.w, 0.08, def.d, 0.03, m), 0, y0 + 0.04, 0));
    for (const x of [-1, 1]) g.add(at(rbox(t, h, def.d, 0.035, m), x * (def.w / 2 - t / 2), y0 + h / 2, 0));
    for (const z of [-1, 1]) g.add(at(rbox(def.w, h, t, 0.035, m), 0, y0 + h / 2, z * (def.d / 2 - t / 2)));
    g.add(at(box(def.w - 2 * t, 0.02, def.d - 2 * t, std('#a9d6e8', { roughness: 0.05, transparent: true, opacity: 0.8 })), 0, y0 + 0.36, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(ball(0.045, std('#c9a25b', { metalness: 0.8, roughness: 0.3 }), 10), x * (def.w / 2 - 0.08), 0.04, z * (def.d / 2 - 0.12)));
    g.add(at(cyl(0.015, 0.015, 0.2, steel(), 10), 0, y0 + h + 0.08, -def.d / 2 + 0.05));
    const spout = at(cyl(0.012, 0.012, 0.12, steel(), 10), 0, y0 + h + 0.17, -def.d / 2 + 0.1); spout.rotation.x = Math.PI / 2; g.add(spout);
    for (let i = 0; i < 9; i++) g.add(at(ball(0.03 + (i % 3) * 0.012, std('#ffffff', { roughness: 0.9 }), 10), ((i % 3) - 1) * 0.16 + (i % 2) * 0.03, y0 + 0.38, 0.15 + Math.floor(i / 3) * 0.15)); // bubbles
    return g;
  },
  shower(c, def) {
    const g = new THREE.Group();
    g.add(at(rbox(def.w, 0.05, def.d, 0.02, std('#f7f8f8', { roughness: 0.3 })), 0, 0.025, 0));
    g.add(at(cyl(0.035, 0.035, 0.01, std('#8f959c', { metalness: 0.6 }), 16), 0, 0.055, 0));
    const glass = new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(def.d, 1.95), glass), def.w / 2 - 0.01, 1.02, 0).rotateY(Math.PI / 2));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(def.w * 0.45, 1.95), glass), def.w / 4, 1.02, def.d / 2 - 0.01));
    g.add(at(box(0.02, 1.98, 0.02, steel()), def.w / 2 - 0.01, 1.02, def.d / 2 - 0.01));
    g.add(at(cyl(0.012, 0.012, 1.6, steel(), 10), -def.w / 2 + 0.06, 1.25, -def.d / 2 + 0.06));
    const head = at(cyl(0.09, 0.07, 0.03, steel(), 20), -def.w / 2 + 0.2, 2.05, -def.d / 2 + 0.2); g.add(head);
    const arm = at(cyl(0.01, 0.01, 0.22, steel(), 8), -def.w / 2 + 0.13, 2.07, -def.d / 2 + 0.13); arm.rotation.set(0.6, 0, -0.6); g.add(arm);
    return g;
  },
  toilet(c) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.2 });
    g.add(at(cyl(0.13, 0.16, 0.36, m, 24), 0, 0.18, 0.06));
    const bowl = at(ball(0.2, m, 24), 0, 0.36, 0.08); bowl.scale.set(0.95, 0.35, 1.15); g.add(bowl);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 10, 28), m); seat.rotation.x = Math.PI / 2; seat.scale.set(1, 1.2, 1); seat.position.set(0, 0.42, 0.08); g.add(seat);
    g.add(at(rbox(0.38, 0.4, 0.17, 0.04, m), 0, 0.62, -0.25));
    g.add(at(box(0.06, 0.015, 0.03, steel()), 0.12, 0.83, -0.25));
    return g;
  },
  'bath-sink'(c, def) {
    const g = new THREE.Group(), m = std(c, { roughness: 0.5 });
    g.add(at(rbox(def.w, def.top - 0.06, def.d - 0.04, 0.02, m), 0, (def.top - 0.06) / 2, -0.02));
    const basin = at(rbox(def.w, 0.1, def.d, 0.04, std('#fffaf4', { roughness: 0.2 })), 0, def.top - 0.05, 0); g.add(basin);
    g.add(at(box(def.w - 0.16, 0.012, def.d - 0.18, std('#dfe6ea', { roughness: 0.1 })), 0, def.top + 0.001, 0.02));
    g.add(at(cyl(0.012, 0.012, 0.14, steel(), 10), 0, def.top + 0.07, -def.d / 2 + 0.07));
    // the mirror, on the wall behind
    g.add(at(rbox(def.w * 0.85, 0.7, 0.03, 0.02, std('#c9a27e', { roughness: 0.5 })), 0, 1.55, -def.d / 2 - 0.02));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(def.w * 0.75, 0.6), std('#d6e6ee', { roughness: 0.12 })), 0, 1.55, -def.d / 2 - 0.004));
    return g;
  },
  'towel-rail'(c, def) {
    const g = new THREE.Group();
    for (const x of [-1, 1]) g.add(at(cyl(0.012, 0.012, 1.0, steel(), 8), x * (def.w / 2 - 0.03), 0.5, 0));
    for (const y of [0.7, 0.95]) { const b = at(cyl(0.01, 0.01, def.w - 0.06, steel(), 8), 0, y, 0); b.rotation.z = Math.PI / 2; g.add(b); }
    g.add(at(rbox(def.w * 0.7, 0.55, 0.05, 0.02, std(c, { roughness: 1 })), 0, 0.68, 0.02));
    for (const x of [-1, 1]) g.add(at(cyl(0.05, 0.05, 0.015, steel(), 12), x * (def.w / 2 - 0.03), 0.008, 0));
    return g;
  },
  'bath-mat'(c, def) {
    const g = new THREE.Group();
    g.add(at(rbox(def.w, 0.02, def.d, 0.01, std(c, { roughness: 1 })), 0, 0.01, 0));
    return g;
  },
  'laundry-basket'(c) {
    const g = new THREE.Group();
    g.add(at(cyl(0.2, 0.17, 0.5, std(c, { roughness: 1 }), 24), 0, 0.25, 0));
    const cloth = at(ball(0.16, std('#9fb8d6', { roughness: 1 }), 14), 0.02, 0.5, 0); cloth.scale.y = 0.4; g.add(cloth);
    g.add(at(ball(0.08, std('#f2a7bb', { roughness: 1 }), 12), -0.08, 0.52, 0.05));
    return g;
  },
});

function bed(c, def, h) {
  const g = new THREE.Group(), wood = std('#9a6a46', { roughness: 0.55 });
  g.add(at(rbox(def.w, 0.22, def.d, 0.03, wood), 0, 0.18, 0));
  g.add(at(rbox(def.w + 0.04, 0.9, 0.08, 0.03, wood), 0, 0.45, -def.d / 2 - 0.02));
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(at(box(0.07, 0.1, 0.07, wood), x * (def.w / 2 - 0.05), 0.05, z * (def.d / 2 - 0.05)));
  g.add(at(rbox(def.w - 0.06, 0.18, def.d - 0.06, 0.06, std('#fbf6ee', { roughness: 1 })), 0, h, 0.0));
  g.add(at(rbox(def.w - 0.02, 0.07, def.d * 0.66, 0.035, std(c, { roughness: 1 })), 0, h + 0.1, def.d * 0.16));
  const pillows = def.w > 1.4 ? [-def.w / 4, def.w / 4] : [0];
  for (const x of pillows) g.add(at(rbox(Math.min(0.62, def.w * 0.8), 0.12, 0.34, 0.06, std('#ffffff', { roughness: 1 })), x, h + 0.13, -def.d / 2 + 0.3));
  return g;
}

export function buildHome({ floor, makeSign }) {
  const { group } = floor;
  const W = R.maxX - R.minX, D = R.maxZ - R.minZ, H = R.h;
  const M = AREAS.room, K = AREAS.kitchen, B = AREAS.bath, L = AREAS.library;
  const wallM = std('#efe6db', { roughness: 0.95 });
  const trimM = std('#93ab8c', { roughness: 0.85 });
  const wood = std('#6e472e', { roughness: 0.5 });
  const shell = new THREE.Group();
  group.add(shell);

  // the floor (the main room's, by choice) under the whole flat; the
  // kitchen and the bathroom have their own tiles laid over it
  const floorTex = {};
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#ffffff', { roughness: 0.6 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.x = (R.minX + R.maxX) / 2;
  floorMesh.receiveShadow = true;
  floorMesh.userData.floor = true;
  shell.add(floorMesh);
  floor.floorMesh = floorMesh;
  const overlay = (a, tex) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(a.maxX - a.minX, a.maxZ - a.minZ), std('#ffffff', { map: tex, roughness: 0.5 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((a.minX + a.maxX) / 2, 0.003, (a.minZ + a.maxZ) / 2);
    m.receiveShadow = true;
    shell.add(m);
  };
  overlay(K, canvasTex(256, (g, n) => {
    const c = n / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#c98f6b' : '#efe2cf'; g.fillRect(i * c, j * c, c, c); }
  }, [(K.maxX - K.minX) / 1.2, (K.maxZ - K.minZ) / 1.2]));
  const smallTiles = () => canvasTex(256, (g, n) => {
    g.fillStyle = '#d9dde0'; g.fillRect(0, 0, n, n);
    const c = n / 8;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i * 7 + j * 3) % 5 ? '#f7f8f8' : '#eaf2f4'; g.fillRect(i * c + 2, j * c + 2, c - 4, c - 4); }
  }, [(B.maxX - B.minX) / 1.0, (B.maxZ - B.minZ) / 1.0]);
  overlay(B, smallTiles());

  // walls
  const walls = [];
  const wall = (w, h, x, y, z, ry = 0) => {
    const m = box(w, h, 0.16, wallM);
    // so wallpaper repeats every 0.9 m rather than stretching across the wall
    const uv = m.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 0.9, uv.getY(i) * h / 0.9);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.userData.surface = 'wall';
    shell.add(m); walls.push(m);
    return m;
  };
  // a run of wall along x (at z) or along z (at x), with openings cut out:
  // holes: [[from, to, bottom, top]] measured along the run
  function run(axis, at0, from, to, holes = []) {
    const ry = axis === 'x' ? 0 : Math.PI / 2;
    const place = (a0, a1, y0, y1) => {
      if (a1 - a0 < 0.01 || y1 - y0 < 0.01) return;
      const mid = (a0 + a1) / 2;
      if (axis === 'x') wall(a1 - a0, y1 - y0, mid, (y0 + y1) / 2, at0, ry);
      else wall(a1 - a0, y1 - y0, at0, (y0 + y1) / 2, mid, ry);
    };
    let cur = from;
    for (const [h0, h1, y0, y1] of holes.slice().sort((p, q) => p[0] - q[0])) {
      place(cur, h0, 0, H);
      place(h0, h1, 0, y0);
      place(h0, h1, y1, H);
      cur = h1;
    }
    place(cur, to, 0, H);
  }
  const wy0 = 0.9, wy1 = 2.5;
  const bz = R.minZ - 0.08, fz = R.maxZ + 0.08, lx = R.minX - 0.08, rx = R.maxX + 0.08, ix = 6.08;
  const dw = 1.1, dh = 2.2;
  const DK = DOORWAYS.kitchen, DB = DOORWAYS.bath, DL = DOORWAYS.library;
  // the balcony: off the main room's back wall, beside the big window (BD = its doors)
  const BAL = { minX: -1.3, maxX: 5.6, minZ: R.minZ - 1.8, maxZ: R.minZ - 0.17 };
  const BD = { x: 4.1, hw: 0.6 };
  run('x', bz, R.minX - 0.08, R.maxX + 0.08, [[-10, -8, 1.0, 2.4], [-0.5, 2.5, wy0, wy1], [BD.x - BD.hw, BD.x + BD.hw, 0, dh], [7.4, 8.8, 1.2, 2.3]]); // back: reading room, big window, the balcony doors, kitchen
  run('z', lx, R.minZ, R.maxZ, [[-1.5, 1.5, 0.7, 2.6]]);                                     // left: the reading room's tall window
  run('z', -6.08, M.minZ, M.maxZ, [[DL.z - DL.hw, DL.z + DL.hw, 0, dh]]);                   // into the reading room
  run('z', rx, R.minZ, R.maxZ, [[2.0, 2.9, 1.5, 2.35]]);                                     // right: the bathroom's little window
  run('x', fz, R.minX - 0.08, R.maxX + 0.08, [[-dw / 2, dw / 2, 0, dh]]);                    // front: the way out
  run('z', ix, M.minZ, M.maxZ, [[DK.z - DK.hw, DK.z + DK.hw, 0, dh], [DB.z - DB.hw, DB.z + DB.hw, 0, dh]]); // into the kitchen and bathroom
  run('x', 0, K.minX, K.maxX);                                                               // between kitchen and bathroom
  // window glass and frames
  const glassM = new THREE.MeshStandardMaterial({ color: '#dff1ff', roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false });
  const frostM = new THREE.MeshStandardMaterial({ color: '#f4f8fa', roughness: 0.6, transparent: true, opacity: 0.8 });
  for (const [w, x, z, ry, y0, y1, glass] of [
    [3, 1, bz, 0, wy0, wy1, glassM], [3, lx, 0, Math.PI / 2, 0.7, 2.6, glassM], [2, -9, bz, 0, 1.0, 2.4, glassM],
    [1.4, 8.1, bz, 0, 1.2, 2.3, glassM], [0.9, rx, 2.45, Math.PI / 2, 1.5, 2.35, frostM],
  ]) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), glass);
    gl.position.set(x, (y0 + y1) / 2, z); gl.rotation.y = ry;
    shell.add(gl);
    const fr = new THREE.Group();
    for (const [fw, fh, fx, fy] of [[w + 0.1, 0.07, 0, y0], [w + 0.1, 0.07, 0, y1], [0.07, y1 - y0, -w / 2, (y0 + y1) / 2], [0.07, y1 - y0, w / 2, (y0 + y1) / 2]]) {
      fr.add(at(box(fw, fh, 0.22, wood), fx, fy, 0));
    }
    if (w > 2) fr.add(at(box(0.05, y1 - y0, 0.22, wood), 0, (y0 + y1) / 2, 0));
    fr.add(at(box(w + 0.2, 0.05, 0.3, wood), 0, y0 - 0.03, 0.08)); // the sill
    fr.position.set(x, 0, z); fr.rotation.y = ry;
    shell.add(fr);
  }
  // ── the balcony. A Cairo balcony: patterned cement tiles, a wrought-iron
  // railing, a striped awning, pots of basil, jasmine and a bougainvillea,
  // two chairs and a little table with tea, the washing out on its rack, and
  // the basket on a rope for things from the kiosk downstairs. Outside the
  // flat: the building's own sandy plaster, all the way down to the street.
  const balcony = new THREE.Group();
  shell.add(balcony);
  const balHits = [], balSeats = [];
  let washing = [];
  {
    const bw = BAL.maxX - BAL.minX, bd = BAL.maxZ - BAL.minZ, cx = (BAL.minX + BAL.maxX) / 2, cz = (BAL.minZ + BAL.maxZ) / 2;
    const iron = std('#2b2522', { roughness: 0.45, metalness: 0.5 });
    // the building's face, with the flat's windows and the balcony doors cut out
    {
      const top = H + 0.6, bottom = -4.4;
      const sh = new THREE.Shape();
      // (it faces −z, so its own x runs the other way: x' = −x)
      sh.moveTo(-(R.maxX + 0.2), bottom); sh.lineTo(-(R.minX - 0.2), bottom); sh.lineTo(-(R.minX - 0.2), top); sh.lineTo(-(R.maxX + 0.2), top); sh.closePath();
      for (const [x0, x1, y0, y1] of [[-10, -8, 1.0, 2.4], [-0.5, 2.5, wy0, wy1], [BD.x - BD.hw, BD.x + BD.hw, 0, dh], [7.4, 8.8, 1.2, 2.3]]) {
        const h = new THREE.Path();
        h.moveTo(-x1, y0); h.lineTo(-x0, y0); h.lineTo(-x0, y1); h.lineTo(-x1, y1); h.closePath();
        sh.holes.push(h);
      }
      const plaster = std('#e2c79f', { roughness: 1 });
      const face = new THREE.Mesh(new THREE.ShapeGeometry(sh), plaster);
      face.rotation.y = Math.PI; face.position.z = R.minZ - 0.165;
      face.receiveShadow = true;
      balcony.add(face);
      // a band at each floor, a cornice at the top
      for (const y of [-0.12, H + 0.5]) balcony.add(at(box(R.maxX - R.minX + 0.5, 0.16, 0.14, std('#efe0c4', { roughness: 0.9 })), (R.minX + R.maxX) / 2, y, R.minZ - 0.24));
      // the air conditioner by the kitchen window, dripping into a tin
      const ac = new THREE.Group();
      ac.add(at(rbox(0.85, 0.55, 0.32, 0.03, std('#f1efe9', { roughness: 0.5 })), 0, 0, 0));
      for (let i = 0; i < 7; i++) ac.add(at(box(0.6, 0.02, 0.02, std('#9a9890')), -0.05, -0.18 + i * 0.06, -0.165));
      ac.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), std('#7a7870')), 0.24, 0, -0.165)).rotation.y = Math.PI;
      for (const s of [-1, 1]) ac.add(at(box(0.04, 0.04, 0.4, iron), s * 0.35, -0.3, 0.05));
      ac.position.set(8.1, 0.6, R.minZ - 0.36);
      balcony.add(ac);
      // a satellite dish clamped to the railing of the flat next door (well, nearly)
      const dish = at(new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), std('#e8e4dc', { roughness: 0.5, side: THREE.DoubleSide })), -6.5, 2.9, R.minZ - 0.45);
      dish.rotation.x = 1.9;
      balcony.add(dish);
    }
    // the floor: patterned cement tiles
    const tileTex = canvasTex(256, (g, n) => {
      const c = n / 2;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const x = i * c, y = j * c;
        g.fillStyle = '#efe4d2'; g.fillRect(x, y, c, c);
        g.fillStyle = '#3f6a8a';
        g.beginPath(); g.moveTo(x + c / 2, y + 6); g.lineTo(x + c - 6, y + c / 2); g.lineTo(x + c / 2, y + c - 6); g.lineTo(x + 6, y + c / 2); g.closePath(); g.fill();
        g.fillStyle = '#c0763a'; g.beginPath(); g.arc(x + c / 2, y + c / 2, c * 0.16, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#efe4d2'; g.beginPath(); g.arc(x + c / 2, y + c / 2, c * 0.07, 0, Math.PI * 2); g.fill();
        for (const [qx, qy] of [[0, 0], [c, 0], [0, c], [c, c]]) { g.fillStyle = '#c0763a'; g.beginPath(); g.arc(x + qx, y + qy, c * 0.14, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.strokeRect(x, y, c, c);
      }
    }, [bw / 0.8, bd / 0.8]);
    balcony.add(at(box(bw + 0.1, 0.2, bd + 0.05, std('#d8c8ae', { roughness: 0.9 })), cx, -0.1, cz));
    const balFloor = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), std('#ffffff', { map: tileTex, roughness: 0.7 }));
    balFloor.rotation.x = -Math.PI / 2; balFloor.position.set(cx, 0.004, cz);
    balFloor.receiveShadow = true;
    balFloor.userData.floor = true; // you can click it to walk out there
    balcony.add(balFloor);
    balHits.push(balFloor);
    // the railing: a top rail, a bottom rail, balusters, and curls between them
    const RH = 1.0;
    const railRun = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
      const g = new THREE.Group();
      g.position.set(x0, 0, z0); g.rotation.y = ry;
      g.add(at(box(len + 0.05, 0.05, 0.07, iron), len / 2, RH, 0));
      g.add(at(box(len, 0.03, 0.03, iron), len / 2, 0.12, 0));
      g.add(at(box(len, 0.025, 0.025, iron), len / 2, RH - 0.22, 0));
      for (let d = 0.06; d < len; d += 0.11) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, RH - 0.12, 6), iron), d, 0.12 + (RH - 0.12) / 2, 0));
      for (let d = 0.3; d < len - 0.2; d += 0.55) {
        for (const s of [-1, 1]) {
          const curl = at(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 18, Math.PI * 1.5), iron), d + s * 0.08, RH - 0.34, 0);
          curl.rotation.z = s > 0 ? Math.PI : 0;
          g.add(curl);
        }
      }
      balcony.add(g);
    };
    railRun(BAL.minX + 0.03, BAL.maxZ, BAL.minX + 0.03, BAL.minZ + 0.03);
    railRun(BAL.minX + 0.03, BAL.minZ + 0.03, BAL.maxX - 0.03, BAL.minZ + 0.03);
    railRun(BAL.maxX - 0.03, BAL.minZ + 0.03, BAL.maxX - 0.03, BAL.maxZ);
    // the awning: green and white stripes, with a scalloped edge
    const awnTex = canvasTex(256, (g, n) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fdf3e6' : '#3f7a55'; g.fillRect(i * n / 8, 0, n / 8, n); } }, [bw / 1.6, 1]);
    const awnM = std('#ffffff', { map: awnTex, roughness: 1, side: THREE.DoubleSide });
    const slope = Math.atan2(0.5, bd);
    const awn = at(new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.3, Math.hypot(bd + 0.15, 0.5)), awnM), cx, H - 0.05 - 0.25, cz - 0.05);
    awn.rotation.x = -Math.PI / 2 + slope;
    balcony.add(awn);
    for (let x = BAL.minX - 0.1; x < BAL.maxX + 0.1; x += 0.36) {
      const sc = at(new THREE.Mesh(new THREE.CircleGeometry(0.18, 16, 0, Math.PI), awnM), x + 0.18, H - 0.55, BAL.minZ - 0.07);
      sc.rotation.z = Math.PI;
      balcony.add(sc);
    }
    for (const x of [BAL.minX - 0.05, BAL.maxX + 0.05]) balcony.add(at(box(0.03, 0.03, bd + 0.2, iron), x, H - 0.55, cz));
    // the French doors, both leaves open out onto the balcony
    const glassD = std('#dff1ff', { roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false });
    const doorWood = std('#f4ece0', { roughness: 0.6 });
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      const w = BD.hw;
      for (const [fw, fh, fx, fy] of [[w, 0.07, w / 2, 0.035], [w, 0.07, w / 2, dh - 0.04], [0.06, dh, 0.03, dh / 2], [0.06, dh, w - 0.03, dh / 2], [w, 0.05, w / 2, 0.9]]) leaf.add(at(box(fw, fh, 0.05, doorWood), fx, fy, 0));
      leaf.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, dh - 0.2), glassD), w / 2, dh / 2, 0));
      // hinged at each side of the opening, both swung out towards the street
      leaf.position.set(BD.x + s * BD.hw, 0, R.minZ - 0.2);
      leaf.rotation.y = Math.PI / 2 - s * 0.3;
      balcony.add(leaf);
    }
    for (const [w, h, x, y] of [[0.08, dh, BD.x - BD.hw, dh / 2], [0.08, dh, BD.x + BD.hw, dh / 2], [BD.hw * 2 + 0.16, 0.08, BD.x, dh]]) balcony.add(at(box(w, h, 0.22, wood), x, y, bz));
    // pots: basil, jasmine, a bougainvillea climbing the corner
    const potM = std('#b8683f', { roughness: 0.9 });
    const pot = (x, z, leaf, flower, s = 1) => {
      const g = new THREE.Group();
      g.add(at(cyl(0.16 * s, 0.12 * s, 0.28 * s, potM), 0, 0.14 * s, 0));
      for (let i = 0; i < 8; i++) {
        const a = i * 0.8, l = at(ball(0.11 * s, std(leaf, { roughness: 0.9 }), 10), Math.cos(a) * 0.08 * s, (0.36 + (i % 3) * 0.08) * s, Math.sin(a) * 0.08 * s);
        g.add(l);
        if (flower && i % 2) g.add(at(ball(0.03 * s, std(flower, { roughness: 0.8 }), 6), Math.cos(a) * 0.15 * s, (0.42 + (i % 3) * 0.08) * s, Math.sin(a) * 0.15 * s));
      }
      g.position.set(x, 0, z);
      balcony.add(g);
    };
    pot(BAL.minX + 0.3, BAL.minZ + 0.3, '#4f8a4a', null);
    pot(BAL.minX + 0.75, BAL.minZ + 0.25, '#5f9a5a', '#ffffff', 0.9);
    pot(BAL.maxX - 0.3, BAL.minZ + 0.3, '#4f7a45', '#d4378a', 1.3);
    pot(BAL.maxX - 0.3, BAL.maxZ - 0.35, '#5f9a5a', '#ffffff');
    // the bougainvillea up the corner and along the awning
    for (let i = 0; i < 14; i++) balcony.add(at(ball(0.07 + (i % 3) * 0.02, std(i % 2 ? '#d4378a' : '#4f7a45', { roughness: 0.9 }), 8), BAL.maxX - 0.12 - (i > 8 ? (i - 8) * 0.3 : 0), Math.min(H - 0.6, 0.6 + i * 0.2), BAL.minZ + 0.12));
    // a little table with two glasses of tea, two chairs
    {
      const tx = 1.9, tz = cz;
      const t = new THREE.Group();
      t.add(at(cyl(0.3, 0.3, 0.03, std('#f4ece0', { roughness: 0.5 }), 24), 0, 0.68, 0));
      t.add(at(cyl(0.025, 0.025, 0.68, iron, 8), 0, 0.34, 0));
      t.add(at(cyl(0.16, 0.18, 0.03, iron, 16), 0, 0.015, 0));
      const teaM = std('#b0522a', { roughness: 0.15, transparent: true, opacity: 0.85 });
      for (const s of [-1, 1]) {
        t.add(at(cyl(0.028, 0.024, 0.08, std('#ffffff', { roughness: 0.05, transparent: true, opacity: 0.35 }), 12), s * 0.09, 0.735, 0.02));
        t.add(at(cyl(0.025, 0.022, 0.06, teaM, 12), s * 0.09, 0.725, 0.02));
      }
      t.add(at(cyl(0.1, 0.1, 0.012, std('#c9a25b', { metalness: 0.6, roughness: 0.3 }), 20), 0, 0.698, 0.02)); // the tray
      t.position.set(tx, 0, tz);
      balcony.add(t);
      for (const s of [-1, 1]) {
        const c = new THREE.Group();
        const cane = std('#c9a27e', { roughness: 0.8 });
        c.add(at(rbox(0.44, 0.05, 0.42, 0.02, cane), 0, 0.46, 0));
        c.add(at(rbox(0.44, 0.46, 0.04, 0.02, cane), 0, 0.7, -0.2));
        for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(at(box(0.03, 0.46, 0.03, std('#8a6a4a')), a * 0.19, 0.23, b * 0.18));
        c.add(at(rbox(0.38, 0.05, 0.36, 0.02, std('#e7b7c4', { roughness: 1 })), 0, 0.5, 0.01));
        const x = tx + s * 0.62, ry = s < 0 ? Math.PI / 2 + 0.35 : -Math.PI / 2 - 0.35;
        c.position.set(x, 0, tz); c.rotation.y = ry;
        balcony.add(c);
        const seat = { id: `home-balcony-${s < 0 ? 0 : 1}`, label: 'a chair on the balcony', x, z: tz, y: group.position.y, h: 0.5, ry };
        balSeats.push(seat);
        c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: 'Sit out on the balcony' }; balHits.push(o); } });
      }
    }
    // the washing, out on its rack over the street
    {
      const rack = new THREE.Group();
      for (const s of [-1, 1]) rack.add(at(box(0.03, 0.03, 0.55, iron), s * 0.8, 0, -0.27));
      for (let i = 0; i < 4; i++) rack.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.6, 4), std('#dddddd')), 0, 0, -0.1 - i * 0.13)).rotation.z = Math.PI / 2;
      const clothes = ['#3f6a8a', '#f4ece0', '#d4678a', '#e8b44a', '#93ab8c', '#ffffff', '#c7605a'];
      for (let i = 0; i < 7; i++) {
        const w = 0.22 + (i % 3) * 0.08, h = 0.3 + (i % 2) * 0.18;
        const c = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(clothes[i], { roughness: 1, side: THREE.DoubleSide }));
        c.geometry.translate(0, -h / 2, 0);
        const holder = new THREE.Group();
        holder.position.set(-0.65 + i * 0.21, 0, -0.1 - (i % 4) * 0.13);
        holder.add(c);
        rack.add(holder);
        washing.push({ g: holder, ph: i * 1.3 });
      }
      rack.position.set(-0.2, RH - 0.05, BAL.minZ);
      balcony.add(rack);
    }
    // the basket on a rope: let it down to the street, and something comes back up
    {
      const rope = at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.4, 4), std('#c9b28a')), 3.6, RH - 1.7, BAL.minZ - 0.12);
      balcony.add(rope);
      const basket = new THREE.Group();
      basket.add(at(cyl(0.16, 0.12, 0.2, std('#b98a4f', { roughness: 1 }), 14), 0, 0, 0));
      const handle = at(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 16, Math.PI), std('#9a6a3a')), 0, 0.1, 0);
      basket.add(handle);
      basket.position.set(3.6, RH - 3.45, BAL.minZ - 0.12);
      balcony.add(basket);
      const tie = at(box(0.04, 0.06, 0.04, std('#c9b28a')), 3.6, RH + 0.01, BAL.minZ + 0.02);
      balcony.add(tie);
      const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.8, 0.5), new THREE.MeshBasicMaterial({ visible: false })), 3.6, RH - 1.7, BAL.minZ - 0.12);
      hit.userData = { kind: 'home-basket', label: 'The basket on its rope — let it down to the street' };
      balcony.add(hit); balHits.push(hit);
    }
  }
  const onBalcony = p => p.z < R.minZ - 0.12;

  // a sage skirting band round each room; white tiles halfway up the bathroom walls
  for (const a of [M, K, B, L]) {
    const w = a.maxX - a.minX, d = a.maxZ - a.minZ, cx = (a.minX + a.maxX) / 2, cz = (a.minZ + a.maxZ) / 2;
    for (const [len, x, z, ry] of [[w, cx, a.minZ + 0.005, 0], [w, cx, a.maxZ - 0.005, 0], [d, a.minX + 0.005, cz, Math.PI / 2], [d, a.maxX - 0.005, cz, Math.PI / 2]]) {
      const bnd = at(box(len, 0.12, 0.02, trimM), x, 0.06, z); bnd.rotation.y = ry; shell.add(bnd);
    }
  }
  {
    const tileM = std('#ffffff', { map: smallTiles(), roughness: 0.3 });
    tileM.map.repeat.set(4, 1.2);
    const w = B.maxX - B.minX, d = B.maxZ - B.minZ, th = 1.2;
    for (const [len, x, z, ry] of [[w, (B.minX + B.maxX) / 2, B.minZ + 0.012, 0], [w, (B.minX + B.maxX) / 2, B.maxZ - 0.012, Math.PI], [d, B.maxX - 0.012, (B.minZ + B.maxZ) / 2, -Math.PI / 2]]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(len, th), tileM);
      t.position.set(x, th / 2, z); t.rotation.y = ry;
      shell.add(t);
    }
    for (const [z0, z1] of [[B.minZ, DB.z - DB.hw], [DB.z + DB.hw, B.maxZ]]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, th), tileM);
      t.position.set(B.minX + 0.012, th / 2, (z0 + z1) / 2); t.rotation.y = Math.PI / 2;
      shell.add(t);
    }
  }
  // the door out (closed, with a brass knob), and the frames of the inner doorways
  const door = at(rbox(dw - 0.06, dh - 0.03, 0.06, 0.02, std('#93ab8c', { roughness: 0.6 })), 0, dh / 2, R.maxZ + 0.04);
  shell.add(door);
  shell.add(at(ball(0.035, std('#c9a25b', { metalness: 0.8, roughness: 0.3 }), 12), 0.38, 1.0, R.maxZ));
  for (const [w, h, x, y] of [[0.08, dh, -dw / 2, dh / 2], [0.08, dh, dw / 2, dh / 2], [dw + 0.16, 0.08, 0, dh]]) shell.add(at(box(w, h, 0.22, wood), x, y, R.maxZ + 0.04));
  for (const d of [DK, DB, DL]) {
    for (const [w, h, z, y] of [[0.22, dh, d.z - d.hw, dh / 2], [0.22, dh, d.z + d.hw, dh / 2], [0.22, 0.08, d.z, dh]]) {
      shell.add(at(box(w, h, y === dh ? d.hw * 2 + 0.08 : 0.08, wood), d.x, y, z));
    }
  }
  const doorHit = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ visible: false }));
  doorHit.position.set(0, dh / 2, R.maxZ - 0.05);
  doorHit.rotation.y = Math.PI;
  doorHit.userData = { kind: 'stairs-down', label: 'Out to the hallway' };
  shell.add(doorHit);

  // the ceiling, a paper lamp in the main room, little lights in the others
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, D + 0.4), std('#fbf3ea', { roughness: 1, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set((R.minX + R.maxX) / 2, H, 0);
  shell.add(ceil);
  const lampShade = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), std('#fffaf0', { roughness: 0.9, emissive: '#ffd9a0', emissiveIntensity: 0.6 }));
  lampShade.position.set(0, H - 0.65, 0);
  shell.add(lampShade, at(cyl(0.006, 0.006, 0.35, std('#3a2a26'), 6), 0, H - 0.18, 0));
  const ceilingLight = new THREE.PointLight('#ffd9a6', 4, 12, 1.4);
  ceilingLight.position.set(0, H - 0.8, 0);
  shell.add(ceilingLight);
  const sideLights = [];
  for (const a of [K, B, L]) {
    const x = (a.minX + a.maxX) / 2, z = (a.minZ + a.maxZ) / 2;
    shell.add(at(cyl(0.22, 0.22, 0.05, std('#fffaf0', { emissive: '#ffe6bf', emissiveIntensity: 0.8 }), 28), x, H - 0.03, z));
    const l = new THREE.PointLight('#ffe2b8', 2.2, 6, 1.4);
    l.position.set(x, H - 0.4, z);
    shell.add(l);
    sideLights.push(l);
  }

  // the room's name on a little plaque by the door
  let plaque = null;
  function setPlaque(name) {
    if (plaque) { shell.remove(plaque); plaque.traverse(o => { o.material?.map?.dispose(); o.material?.dispose(); o.geometry?.dispose(); }); }
    plaque = makeSign([{ text: name, font: 'Dancing Script, cursive', size: 110, weight: '700' }], 1.3, 0.28);
    plaque.position.set(-1.35, 1.75, R.maxZ - 0.02);
    plaque.rotation.y = Math.PI;
    shell.add(plaque);
  }

  // ── the reading room: dark wood floor, a big rug, shelves on the walls
  overlay(L, planks('#7a5238', 41));
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.6), std('#ffffff', { roughness: 1, map: canvasTex(256, (g, n) => {
      g.fillStyle = '#8f3f45'; g.fillRect(0, 0, n, n);
      g.strokeStyle = '#e6c27a'; g.lineWidth = 8; g.strokeRect(16, 16, n - 32, n - 32);
      g.strokeStyle = '#f4ece0'; g.lineWidth = 3; g.strokeRect(34, 34, n - 68, n - 68);
      g.fillStyle = '#e6c27a'; g.beginPath(); g.arc(n / 2, n / 2, 30, 0, Math.PI * 2); g.fill();
    }) }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-9.2, 0.006, 0.4); rug.receiveShadow = true;
    shell.add(rug);
  }
  // built-in bookshelves (clicking one opens the story shelf) and a window seat
  const builtIns = [];
  const shelfM = std('#5e3b26', { roughness: 0.55 });
  function builtInShelf(x0, x1, z0, z1, along) {
    const len = along === 'x' ? x1 - x0 : z1 - z0, depth = 0.36, h = 2.6;
    const g = new THREE.Group();
    g.add(at(box(len, h, 0.03, shelfM), 0, h / 2, -depth / 2 + 0.015));
    for (const e of [-1, 1]) g.add(at(box(0.04, h, depth, shelfM), e * (len / 2 - 0.02), h / 2, 0));
    g.add(at(box(len + 0.06, 0.06, depth + 0.04, shelfM), 0, h, 0));
    const r = rand(Math.round((x0 + z0) * 13) + 7), cols = ['#c4627f', '#93ab8c', '#f0b56a', '#6a87a8', '#f4ece0', '#a35d4a', '#7b5ea7', '#3f6b5a'];
    for (let i = 0; i < 6; i++) {
      const y = 0.06 + i * 0.47;
      g.add(at(box(len - 0.06, 0.03, depth - 0.02, shelfM), 0, y, 0.01));
      if (i === 5) continue;
      let x = -len / 2 + 0.06;
      while (x < len / 2 - 0.1) {
        const w = 0.03 + r() * 0.045, bh = 0.26 + r() * 0.14;
        if (r() < 0.05) { x += 0.12; continue; } // a little gap
        const b = at(box(w, bh, depth - 0.1, std(cols[Math.floor(r() * cols.length)], { roughness: 0.8 })), x + w / 2, y + 0.015 + bh / 2, 0.02);
        if (r() < 0.06) b.rotation.z = 0.22;
        g.add(b); x += w + 0.005;
      }
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    g.position.set(cx, 0, cz);
    if (along === 'z') g.rotation.y = Math.PI / 2;
    shell.add(g);
    const hits = [];
    g.traverse(o => { if (o.isMesh) { o.userData = { kind: 'shelf', label: 'The bookshelves — pick a story to read' }; hits.push(o); } });
    const box3 = along === 'x' ? { minX: x0, maxX: x1, minZ: cz - depth / 2, maxZ: cz + depth / 2 } : { minX: cx - depth / 2, maxX: cx + depth / 2, minZ: z0, maxZ: z1 };
    builtIns.push({ box: box3, hits });
  }
  builtInShelf(-11.8, -10.2, L.minZ + 0.19, L.minZ + 0.19, 'x');   // the back wall, either side of its window
  builtInShelf(-7.8, -6.4, L.minZ + 0.19, L.minZ + 0.19, 'x');
  builtInShelf(L.minX + 0.19, L.minX + 0.19, -4.3, -1.7, 'z');    // the outer wall, either side of the tall window
  builtInShelf(L.minX + 0.19, L.minX + 0.19, 1.7, 4.3, 'z');
  {
    // a window seat under the tall window, with cushions
    const g = new THREE.Group();
    g.add(at(rbox(0.55, 0.45, 2.9, 0.03, shelfM), 0, 0.225, 0));
    g.add(at(rbox(0.5, 0.09, 2.8, 0.04, std('#93ab8c', { roughness: 1 })), 0, 0.49, 0));
    for (const z of [-0.95, 0, 0.95]) { const c = at(rbox(0.14, 0.34, 0.42, 0.06, std(z ? '#f2a7bb' : '#efe0c4', { roughness: 1 })), -0.2, 0.68, z); c.rotation.z = 0.15; g.add(c); }
    const x = L.minX + 0.3;
    g.position.set(x, 0, 0);
    shell.add(g);
    const hits = [];
    const seats = [-0.9, 0, 0.9].map((z, i) => ({ id: `home-windowseat-${i}`, label: 'the window seat', x: x + 0.05, z, y: group.position.y, h: 0.54, ry: Math.PI / 2 }));
    g.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat: seats[1], label: 'Sit on the window seat and read' }; hits.push(o); } });
    builtIns.push({ box: { minX: L.minX, maxX: x + 0.28, minZ: -1.45, maxZ: 1.45 }, hits, seats });
  }

  // ── where you can walk: each room (kept off its walls), joined by the doorways
  const IN = 0.3;
  const WALK = [
    ...Object.values(AREAS).map(a => ({ minX: a.minX + IN, maxX: a.maxX - IN, minZ: a.minZ + IN, maxZ: a.maxZ - IN })),
    // (a little wider than a straight inset, so it's easy to walk through with the keys too)
    ...Object.values(DOORWAYS).map(d => ({ minX: d.x - 0.45, maxX: d.x + 0.45, minZ: d.z - d.hw + 0.2, maxZ: d.z + d.hw - 0.2 })),
    // the balcony, and the way out through its doors
    { minX: BAL.minX + 0.3, maxX: BAL.maxX - 0.3, minZ: BAL.minZ + 0.3, maxZ: BAL.maxZ - 0.12 },
    { minX: BD.x - BD.hw + 0.2, maxX: BD.x + BD.hw - 0.2, minZ: BAL.maxZ - 0.3, maxZ: M.minZ + 0.4 },
  ];
  // the spaces furniture can't block
  const CLEAR = [
    { minX: -0.75, maxX: 0.75, minZ: R.maxZ - 1.0, maxZ: R.maxZ + 1 },
    ...Object.values(DOORWAYS).map(d => ({ minX: d.x - 0.9, maxX: d.x + 0.9, minZ: d.z - d.hw - 0.1, maxZ: d.z + d.hw + 0.1 })),
    { minX: BD.x - 0.9, maxX: BD.x + 0.9, minZ: M.minZ, maxZ: M.minZ + 1.1 }, // in front of the balcony doors
    ...builtIns.map(b => b.box),
  ];
  // Walking from one room to another goes through the doorway between them.
  function route(from, to) {
    // out to the balcony, or back in: through its doors
    const inside = { x: BD.x, z: M.minZ + 0.6 }, outside = { x: BD.x, z: BAL.maxZ - 0.55 };
    if (onBalcony(from) && onBalcony(to)) return [to];
    if (onBalcony(from)) return [outside, inside, ...route(inside, to)];
    if (onBalcony(to)) return [...route(from, inside), outside, to];
    const a = areaAt(from.x, from.z), b = areaAt(to.x, to.z);
    if (a === b) return [to];
    const out = d => ({ x: d.x - d.side * 0.68, z: d.z }), inn = d => ({ x: d.x + d.side * 0.68, z: d.z });
    const steps = [];
    if (a !== 'room') { const d = DOORWAYS[a]; steps.push(inn(d), out(d)); }
    if (b !== 'room') { const d = DOORWAYS[b]; steps.push(out(d), inn(d)); }
    return [...steps, to];
  }
  // The camera stays in the room you're in, so a wall never comes between.
  function cameraBox(p) {
    // out on the balcony the camera can drift out over the street, to look back at you
    if (onBalcony(p)) return { minX: BAL.minX - 1.2, maxX: BAL.maxX + 1.2, minZ: BAL.minZ - 2.6, maxZ: R.minZ - 0.3 };
    const a = AREAS[areaAt(p.x, p.z)] || M;
    return { minX: a.minX, maxX: a.maxX, minZ: a.minZ, maxZ: a.maxZ };
  }

  // ── furniture
  const items = new Map(); // id -> { item, def, group, meshes, seats }
  const giftHits = []; // the wrapped presents by the door (setGifts)
  let cat = null;      // the cat, if there is one (setPet): { pet, model, pos, ry, state, t, path, y, perch, petted }
  const things = new THREE.Group();
  group.add(things);
  const base = { colliders: builtIns.map(b => ({ type: 'box', fixed: true, ...b.box })), interactables: [doorHit, ...builtIns.flatMap(b => b.hits), ...balHits.filter(m => !m.userData.floor)], surfaces: [...walls, ...balHits.filter(m => m.userData.floor)], seats: [...builtIns.flatMap(b => b.seats || []), ...balSeats] };
  // the balcony's table and chairs, so you walk round them
  base.colliders.push({ type: 'circle', fixed: true, x: 1.9, z: (BAL.minZ + BAL.maxZ) / 2, r: 0.32 });

  // Rebuild the floor's lists from the shell and the furniture.
  function sync() {
    const fy = group.position.y;
    floor.colliders.length = 0;
    floor.colliders.push({ type: 'room', fixed: true, walk: WALK }, ...base.colliders);
    floor.seats.length = 0;
    floor.seats.push(...base.seats);
    floor.surfaces.length = 0;
    floor.surfaces.push(...base.surfaces);
    floor.interactables.length = 0;
    floor.interactables.push(...base.interactables);
    for (const e of items.values()) {
      const { item, def } = e;
      if (!def.flat && !def.onTop && !def.walkIn && !def.wall) {
        const f = footprint(def, item.x, item.z, item.ry);
        floor.colliders.push({ type: 'box', fixed: true, minX: f.minX + 0.04, maxX: f.maxX - 0.04, minZ: f.minZ + 0.04, maxZ: f.maxZ - 0.04 });
      }
      e.seats = [];
      const place = (o, i, extra) => {
        const c = Math.cos(item.ry), s = Math.sin(item.ry);
        return { id: `home-${item.id}-${i}`, x: item.x + o.x * c + o.z * s, z: item.z - o.x * s + o.z * c, ry: item.ry, ...extra };
      };
      (def.seats || []).forEach((o, i) => e.seats.push(place(o, i, { label: `the ${def.name.toLowerCase()}`, y: fy + item.y, h: o.h })));
      (def.lie || []).forEach((o, i) => e.seats.push(place(o, 'lie' + i, { label: `the ${def.name.toLowerCase()}`, y: fy + item.y + def.top + 0.16, h: 0.2, lie: true })));
      floor.seats.push(...e.seats);
      if (e.top) floor.surfaces.push(e.top);
      for (const m of e.meshes) floor.interactables.push(m);
    }
    floor.interactables.push(...giftHits);
    if (cat) cat.model.group.traverse(o => { if (o.isMesh) floor.interactables.push(o); });
    // a seat with a laptop in reach is somewhere to work: you type there
    const laptops = [...items.values()].filter(e => e.item.kind === 'laptop').map(e => e.item);
    for (const seat of floor.seats) seat.work = !seat.lie && laptops.some(l => Math.hypot(l.x - seat.x, l.z - seat.z) < 1.3);
  }

  function makeThing(item) {
    const def = BY_KIND.get(item.kind);
    if (!def) return null;
    const g = BUILD[item.kind](item.color, def, item);
    g.position.set(item.x, item.y || 0, item.z);
    g.rotation.y = item.ry;
    return { g, def };
  }

  function add(item) {
    remove(item.id);
    const t = makeThing(item);
    if (!t) return;
    const { g, def } = t;
    things.add(g);
    const e = { item: { ...item }, def, group: g, meshes: [], seats: [], top: null };
    // a flat, invisible top to put things on (and a drink down on)
    if (def.top) {
      const top = new THREE.Mesh(new THREE.PlaneGeometry(def.w * 0.92, def.d * 0.92), new THREE.MeshBasicMaterial({ visible: false }));
      top.rotation.x = -Math.PI / 2;
      top.position.y = def.top + 0.003;
      top.userData = { surface: 'table', top: group.position.y + (item.y || 0) + def.top, label: `Put it on the ${def.name.toLowerCase()}`, homeTop: true, itemId: item.id };
      g.add(top);
      if (!def.lie) e.top = top; // beds aren't for putting drinks down on
      else e.bedTop = top;
    }
    items.set(item.id, e);
    if (def.snacks) fillSnacks(e);
    if (def.tv) showOnScreen(e);
    const kind = def.snacks ? 'home-snacks' : def.tv ? 'home-tv' : def.catBed ? 'home-catbed' : def.picture ? 'home-frame' : def.bath ? 'home-bath' : def.lie ? 'home-bed' : def.desk ? 'home-desk' : def.cook ? 'home-cook'
      : def.shower ? 'home-shower' : def.mirror ? 'home-mirror' : def.seats ? 'seat' : 'home-item';
    const label = def.snacks ? `${def.name} — keep a pastry, or take one` : def.tv ? `${def.name} — put a film on for everyone here` : def.catBed ? def.name : def.picture ? (item.caption ? `“${item.caption}”` : def.name) : def.bath ? `${def.name} — take a bath` : def.lie ? `${def.name} — sleep here` : def.desk ? `${def.name} — start a study session`
      : def.cook ? `${def.name} — make yourself a drink` : def.shower ? `${def.name} — have a shower` : def.mirror ? `${def.name} — look in the mirror`
      : def.seats ? `Sit on the ${def.name.toLowerCase()}` : def.name;
    sync();
    g.traverse(o => {
      if (!o.isMesh || o.userData.homeTop) return;
      o.userData = { kind, itemId: item.id, label, seat: e.seats[0] || null };
      e.meshes.push(o);
    });
    sync();
  }
  function remove(id) {
    const e = items.get(id);
    if (!e) return;
    things.remove(e.group);
    e.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); } });
    items.delete(id);
    sync();
  }
  function setItems(list = []) {
    for (const id of [...items.keys()]) remove(id);
    list.forEach(add);
    sync();
  }
  function setRoom(room) {
    wallM.color.set(room.wall || '#efe6db');
    const wp = WALLPAPER[room.wallpaper] ? room.wallpaper : 'plain';
    wallM.map = wp === 'plain' ? null : (wallTex[wp] || (wallTex[wp] = WALLPAPER[wp]()));
    wallM.needsUpdate = true;
    const f = FLOOR_TEX[room.floor] ? room.floor : 'oak';
    floorMesh.material.map = floorTex[f] || (floorTex[f] = FLOOR_TEX[f]());
    floorMesh.material.needsUpdate = true;
    setPlaque(room.name || 'My room');
  }

  // ── the ghost: what you're about to put down, see-through, following you
  let ghost = null;
  const ghostOK = new THREE.MeshBasicMaterial({ color: '#7aab7a', transparent: true, opacity: 0.45, depthWrite: false });
  const ghostBad = new THREE.MeshBasicMaterial({ color: '#d4678a', transparent: true, opacity: 0.45, depthWrite: false });
  function showGhost(kind, color) {
    hideGhost();
    const t = makeThing({ kind, color, x: 0, y: 0, z: 0, ry: 0 });
    if (!t) return;
    ghost = { g: t.g, def: t.def, kind };
    t.g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.material = ghostOK; } });
    group.add(t.g);
  }
  function moveGhost(x, y, z, ry, ok = true) {
    if (!ghost) return;
    ghost.g.position.set(x, y, z);
    ghost.g.rotation.y = ry;
    ghost.g.traverse(o => { if (o.isMesh) o.material = ok ? ghostOK : ghostBad; });
  }
  function hideGhost() {
    if (!ghost) return;
    group.remove(ghost.g);
    ghost.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    ghost = null;
  }
  // Is this a fair place to put it? Inside the room, and (for big things)
  // not on top of other big things or across the doorway.
  function canPlace(kind, x, z, ry, ignoreId = null) {
    const def = BY_KIND.get(kind);
    if (!def) return false;
    const f = footprint(def, x, z, ry);
    // wholly inside one of the rooms (not through a wall)…
    const inside = a => f.minX >= a.minX - 0.01 && f.maxX <= a.maxX + 0.01 && f.minZ >= a.minZ - 0.01 && f.maxZ <= a.maxZ + 0.01;
    if (!Object.values(AREAS).some(inside)) return false;
    if (def.flat || def.onTop || def.wall) return true;
    // …and keeping the doorways clear: the way out, and into the kitchen and bathroom
    const hits = q => f.minX < q.maxX && f.maxX > q.minX && f.minZ < q.maxZ && f.maxZ > q.minZ;
    if (CLEAR.some(hits)) return false;
    for (const e of items.values()) {
      if (e.item.id === ignoreId || e.def.flat || e.def.onTop || e.def.wall) continue;
      const o = footprint(e.def, e.item.x, e.item.z, e.item.ry);
      if (f.minX < o.maxX - 0.03 && f.maxX > o.minX + 0.03 && f.minZ < o.maxZ - 0.03 && f.maxZ > o.minZ + 0.03) return false;
    }
    return true;
  }
  // the box round whatever you've picked to move (in world space, so it
  // lives on the scene rather than inside the room's group)
  const highlight = new THREE.BoxHelper(new THREE.Object3D(), '#d4678a');
  highlight.visible = false;
  function select(id) {
    const e = items.get(id);
    if (!highlight.parent && group.parent) group.parent.add(highlight);
    highlight.visible = !!e && group.visible;
    if (e) highlight.setFromObject(e.group);
  }

  // ── the snack shelf: up to twelve pastries kept from downstairs, three to a shelf
  let snackShapes = [];
  function fillSnacks(e) {
    const slots = e.group.getObjectByName('slots');
    if (!slots) return;
    slots.children.slice().forEach(o => { slots.remove(o); o.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } }); });
    snackShapes.slice(0, 12).forEach((shape, i) => {
      const d = makeDessert(shape);
      const row = Math.floor(i / 4), col = i % 4;
      d.position.set(-0.3 + col * 0.2, 0.045 + row * 0.4, 0.02);
      d.scale.setScalar(0.9);
      slots.add(d);
    });
    // the pastries are part of the shelf: clicking them is clicking the shelf
    slots.traverse(o => { if (o.isMesh && e.meshes.length) { o.userData = { ...e.meshes[0].userData }; e.meshes.push(o); } });
    sync();
  }
  function setSnacks(shapes = []) {
    snackShapes = shapes;
    for (const e of items.values()) if (e.def.snacks) fillSnacks(e);
  }

  // ── the TV: what's on (the same for everyone in the room)
  let movie = null;
  function showOnScreen(e) {
    const scr = e.group.getObjectByName('screen');
    if (!scr) return;
    scr.material.map?.dispose();
    scr.material.map = screenCanvas(movie, scr.userData.big);
    scr.material.needsUpdate = true;
  }
  function setMovie(m) {
    movie = m || null;
    for (const e of items.values()) if (e.def.tv) showOnScreen(e);
  }

  // ── presents waiting by the door: a wrapped box for each
  const giftGroup = new THREE.Group();
  group.add(giftGroup);
  const WRAP = [['#f2a7bb', '#fffaf4'], ['#93ab8c', '#f2c6d0'], ['#9fb8d6', '#f7e08a'], ['#c7605a', '#f4ece0']];
  function setGifts(list = [], mine = false) {
    giftGroup.children.slice().forEach(o => { giftGroup.remove(o); o.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } }); });
    giftHits.length = 0;
    list.slice(0, 8).forEach((gift, i) => {
      const [paper, ribbon] = WRAP[gift.id % WRAP.length];
      const s = 0.32 + (gift.id % 3) * 0.06;
      const g = new THREE.Group();
      g.position.set(1.3 + (i % 4) * 0.62, 0, R.maxZ - 0.45 - Math.floor(i / 4) * 0.62);
      g.rotation.y = (gift.id % 5) * 0.3;
      g.add(at(rbox(s, s * 0.85, s, 0.02, std(paper, { roughness: 0.7 })), 0, s * 0.425, 0));
      const rb = std(ribbon, { roughness: 0.5 });
      g.add(at(box(s + 0.01, s * 0.85 + 0.01, 0.05, rb), 0, s * 0.425, 0));
      g.add(at(box(0.05, s * 0.85 + 0.01, s + 0.01, rb), 0, s * 0.425, 0));
      for (const a of [-0.6, 0.6]) { const bow = at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 8, 16), rb), a * 0.06, s * 0.85 + 0.04, 0); bow.rotation.y = a; g.add(bow); }
      const label = mine ? `A present from ${gift.fromName} — open it 🎁` : `A present for ${gift.toName || 'them'}, from ${gift.fromName}`;
      g.traverse(o => { if (o.isMesh) { o.userData = { kind: 'home-gift', giftId: gift.id, label }; giftHits.push(o); } });
      giftGroup.add(g);
    });
    sync();
  }

  // ── the cat. It wanders from room to room, sits and washes, naps (on its own
  // bed if it has one, else yours), and jumps up next to a laptop someone's
  // typing on. Each person's café runs its own cat, so it needn't be in step.
  function setPet(pet) {
    if (cat) { group.remove(cat.model.group); cat.model.dispose(); cat = null; }
    if (!pet) return sync();
    const model = makeCat(pet.coat);
    group.add(model.group);
    cat = { pet, model, pos: new THREE.Vector3(-2, 0, 1.5), ry: 0, y: 0, state: 'sit', t: 3, path: [], perch: null, hop: null, petted: 0 };
    model.group.position.copy(cat.pos);
    model.group.traverse(o => { if (o.isMesh) o.userData = { kind: 'home-pet', label: `${pet.name} — give ${pet.name} a stroke` }; });
    sync();
  }
  const blocked = (x, z) => [...items.values()].some(e => {
    if (e.def.flat || e.def.onTop || e.def.wall || e.def.walkIn) return false;
    const f = footprint(e.def, e.item.x, e.item.z, e.item.ry);
    return x > f.minX - 0.25 && x < f.maxX + 0.25 && z > f.minZ - 0.25 && z < f.maxZ + 0.25;
  }) || builtIns.some(b => x > b.box.minX - 0.25 && x < b.box.maxX + 0.25 && z > b.box.minZ - 0.25 && z < b.box.maxZ + 0.25);
  function spotNear(x, z) { // the nearest clear floor beside something
    for (let r = 0.3; r < 1.6; r += 0.15) for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (WALK.slice(0, 4).some(q => px > q.minX + 0.2 && px < q.maxX - 0.2 && pz > q.minZ + 0.2 && pz < q.maxZ - 0.2) && !blocked(px, pz)) return { x: px, z: pz };
    }
    return null;
  }
  function randomSpot() {
    const areas = Object.values(AREAS);
    for (let i = 0; i < 30; i++) {
      const a = areas[Math.floor(Math.random() * areas.length)];
      const x = a.minX + 0.6 + Math.random() * (a.maxX - a.minX - 1.2), z = a.minZ + 0.6 + Math.random() * (a.maxZ - a.minZ - 1.2);
      if (!blocked(x, z)) return { x, z };
    }
    return { x: 0, z: 1 };
  }
  function goTo(to, perch = null) {
    cat.path = route(cat.pos, to).map(q => ({ x: q.x, z: q.z }));
    cat.perch = perch; // where to jump up to at the end: { x, y, z, nap }
    cat.state = 'walk';
  }
  function napSpot() {
    const own = [...items.values()].filter(e => e.def.catBed);
    const beds = own.length ? own : [...items.values()].filter(e => e.def.lie && !e.def.bath);
    if (!beds.length) return null;
    const e = beds[Math.floor(Math.random() * beds.length)];
    const y = e.item.kind === 'cat-tree' ? 1.05 : e.def.catBed ? 0.07 : e.def.top;
    return { x: e.item.x, y, z: e.item.z, nap: true };
  }
  function decide(typist) {
    // somebody typing at a laptop: up onto the desk beside it
    if (typist && Math.random() < 0.7) {
      const lap = [...items.values()].find(e => e.item.kind === 'laptop' && Math.hypot(e.item.x - typist.x, e.item.z - typist.z) < 1.4);
      if (lap) {
        const c = Math.cos(lap.item.ry), sn = Math.sin(lap.item.ry);
        const perch = { x: lap.item.x + c * 0.34, y: lap.item.y || 0.75, z: lap.item.z - sn * 0.34, nap: false, laptop: true };
        const floorSpot = spotNear(perch.x, perch.z);
        if (floorSpot) return goTo(floorSpot, perch);
      }
    }
    const r = Math.random();
    if (r < 0.3) {
      const n = napSpot();
      const fs = n && (n.y < 0.15 ? { x: n.x, z: n.z } : spotNear(n.x, n.z));
      if (n && fs) return goTo(fs, n.y < 0.15 ? { ...n, y: n.y } : n);
    }
    if (r < 0.5) { cat.state = Math.random() < 0.5 ? 'groom' : 'sit'; cat.t = 4 + Math.random() * 6; return; }
    goTo(randomSpot());
  }
  function updatePet(dt, t, { typist = null } = {}) {
    // the washing stirs in the breeze off the street
    for (const w of washing) w.g.rotation.x = Math.sin(t * 1.6 + w.ph) * 0.12 + 0.06;
    if (!cat) return;
    const c = cat, m = c.model;
    c.t -= dt;
    if (c.petted > 0) c.petted -= dt;
    if (c.hop) { // a little jump up (or down)
      c.hop.k = Math.min(1, c.hop.k + dt / 0.45);
      const k = c.hop.k;
      c.pos.x = c.hop.x0 + (c.hop.x1 - c.hop.x0) * k;
      c.pos.z = c.hop.z0 + (c.hop.z1 - c.hop.z0) * k;
      c.y = c.hop.y0 + (c.hop.y1 - c.hop.y0) * k + Math.sin(k * Math.PI) * 0.35;
      if (k >= 1) { const then = c.hop.then; c.hop = null; then(); }
    } else if (c.state === 'walk') {
      const next = c.path[0];
      if (!next) {
        if (c.perch) {
          const p = c.perch;
          c.ry = Math.atan2(p.x - c.pos.x, p.z - c.pos.z);
          c.hop = { k: 0, x0: c.pos.x, z0: c.pos.z, y0: c.y, x1: p.x, z1: p.z, y1: p.y, then: () => { c.state = p.nap ? 'nap' : 'perch'; c.t = p.nap ? 25 + Math.random() * 25 : 12 + Math.random() * 10; } };
        } else { c.state = 'sit'; c.t = 3 + Math.random() * 5; }
      } else {
        const dx = next.x - c.pos.x, dz = next.z - c.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.08) c.path.shift();
        else {
          const sp = 0.75 * dt;
          c.pos.x += dx / d * Math.min(sp, d); c.pos.z += dz / d * Math.min(sp, d);
          c.ry = lerpAng(c.ry, Math.atan2(dx, dz), Math.min(1, dt * 8));
        }
      }
    } else if (c.t <= 0) {
      if (c.y > 0.02) { // down off the furniture first
        const fs = spotNear(c.pos.x, c.pos.z) || { x: c.pos.x, z: c.pos.z + 0.6 };
        c.ry = Math.atan2(fs.x - c.pos.x, fs.z - c.pos.z);
        c.state = 'walk'; c.path = [];
        c.hop = { k: 0, x0: c.pos.x, z0: c.pos.z, y0: c.y, x1: fs.x, z1: fs.z, y1: 0, then: () => { c.perch = null; c.state = 'sit'; c.t = 0.5; } };
      } else decide(typist);
    }
    m.group.position.set(c.pos.x, c.y, c.pos.z);
    m.group.rotation.y = c.ry;
    m.pose(c.state === 'walk' && !c.hop ? 'walk' : c.hop ? 'jump' : c.state, t, c.petted > 0);
  }
  function petCat() {
    if (!cat) return null;
    cat.petted = 3;
    if (cat.state === 'walk' && !cat.hop) { cat.path = []; cat.perch = null; cat.state = 'sit'; cat.t = 4; }
    return { name: cat.pet.name, pos: cat.pos.clone(), y: cat.y, group: cat.model.group };
  }

  const tops = () => [...items.values()].map(e => e.top || e.bedTop).filter(Boolean);
  return {
    setRoom, setItems, add, update: add, remove, items, tops, sync,
    showGhost, moveGhost, hideGhost, canPlace, select, ghostKind: () => ghost && ghost.kind,
    // a couple of steps in from the door, so the camera behind you isn't
    // squashed against the wall looking down at the top of your head
    arrival: { x: 0, z: R.maxZ - 2.2, ry: Math.PI },
    bounds: R, ceilingLight, lampShade, sideLights, route, cameraBox, walls, onBalcony,
    setSnacks, setMovie, setGifts, setPet, updatePet, petCat, spotNear,
  };
}

// ── wallpaper: a light pattern, tinted by the wall colour (it multiplies)
const wallTex = {};
function wallCanvas(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const WALLPAPER = {
  plain: null,
  sakura: () => wallCanvas(g => {
    const r = rand(77);
    for (let i = 0; i < 9; i++) blossom(g, 20 + r() * 216, 20 + r() * 216, 10 + r() * 8, i % 2 ? '#f6dde3' : '#efd0d8');
    g.strokeStyle = '#e6d6cf'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.beginPath(); const x = r() * 256, y = r() * 256; g.moveTo(x, y); g.quadraticCurveTo(x + 30, y - 10, x + 50, y + 20); g.stroke(); }
  }),
  stripes: () => wallCanvas(g => { g.fillStyle = '#ebe5df'; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 26, 256); g.fillStyle = '#f4f0ec'; for (let x = 36; x < 256; x += 64) g.fillRect(x, 0, 4, 256); }),
  dots: () => wallCanvas(g => { g.fillStyle = '#e6dfd8'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(32 + x * 64 + (y % 2) * 32, 32 + y * 64, 7, 0, Math.PI * 2); g.fill(); } }),
  lattice: () => wallCanvas(g => { // asanoha, the hemp-leaf pattern
    g.strokeStyle = '#e2dad2'; g.lineWidth = 2;
    for (let y = 0; y <= 256; y += 64) for (let x = 0; x <= 256; x += 64) {
      for (const [dx, dy] of [[32, 32], [-32, 32], [32, -32], [-32, -32], [0, 32], [32, 0], [0, -32], [-32, 0]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke(); }
    }
  }),
  waves: () => wallCanvas(g => { // seigaiha
    g.lineWidth = 3;
    for (let row = -1; row < 9; row++) for (let i = -1; i < 9; i++) {
      const x = i * 32 + (row % 2) * 16, y = row * 16 + 16;
      for (let k = 0; k < 3; k++) { g.strokeStyle = k % 2 ? '#ece6e0' : '#ddd5cd'; g.beginPath(); g.arc(x, y, 16 - k * 5, Math.PI, 0); g.stroke(); }
    }
  }),
};

const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

// ── the cat: about 45 cm nose to tail, facing +z. pose() moves it.
function makeCat(coat = 'ginger') {
  const col = COATS[coat] || COATS.ginger;
  const group = new THREE.Group();
  const fur = std(col, { roughness: 1 }), dark = std(darken(col, 0.35), { roughness: 1 });
  const light = std(coat === 'black' ? '#3d3b40' : '#fbf6ee', { roughness: 1 });
  const body = new THREE.Group(); body.position.y = 0.17; group.add(body);
  const torso = at(ball(0.1, fur, 18), 0, 0, 0); torso.scale.set(0.95, 0.85, 1.6); body.add(torso);
  const chest = at(ball(0.07, light, 14), 0, -0.02, 0.1); chest.scale.set(1, 1, 0.9); body.add(chest);
  if (coat === 'tabby') for (let i = 0; i < 4; i++) { const st = at(box(0.16, 0.012, 0.02, dark), 0, 0.075, -0.1 + i * 0.06); st.rotation.x = 0.2; body.add(st); }
  if (coat === 'calico') { body.add(at(ball(0.06, std('#d98a4a', { roughness: 1 }), 12), 0.05, 0.05, -0.06)); body.add(at(ball(0.05, std('#2b2a2e', { roughness: 1 }), 12), -0.05, 0.06, 0.06)); }
  const head = new THREE.Group(); head.position.set(0, 0.1, 0.17); body.add(head);
  head.add(ball(0.075, fur, 18));
  head.add(at(ball(0.04, light, 12), 0, -0.03, 0.05));
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = at(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), coat === 'calico' && s < 0 ? std('#d98a4a') : fur), s * 0.045, 0.07, 0); ear.rotation.z = -s * 0.25; shade(ear); head.add(ear); ears.push(ear);
  }
  const eyes = [];
  for (const s of [-1, 1]) { const e = at(ball(0.012, std('#2a3a2a', { roughness: 0.2 }), 8), s * 0.028, 0.012, 0.064); head.add(e); eyes.push(e); }
  head.add(at(ball(0.009, std('#d98a8a'), 6), 0, -0.012, 0.077));
  const legs = [];
  for (const [x, z] of [[-0.05, 0.1], [0.05, 0.1], [-0.05, -0.1], [0.05, -0.1]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.12, z); group.add(leg);
    leg.add(at(cyl(0.022, 0.02, 0.12, fur, 8), 0, -0.06, 0));
    leg.add(at(ball(0.022, light, 8), 0, -0.115, 0.008));
    legs.push(leg);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.04, -0.15); body.add(tail);
  const segs = [];
  let parent = tail;
  for (let i = 0; i < 6; i++) {
    const sg = new THREE.Group(); sg.position.set(0, 0, i ? -0.045 : 0);
    sg.add(at(ball(0.02 - i * 0.0015, i === 5 && coat !== 'black' ? dark : fur, 8), 0, 0, -0.02));
    parent.add(sg); segs.push(sg); parent = sg;
  }
  const hearts = new THREE.Group(); group.add(hearts); hearts.position.y = 0.45; hearts.visible = false;
  for (let i = 0; i < 3; i++) { const h = at(ball(0.018, new THREE.MeshBasicMaterial({ color: '#e7849f' }), 8), (i - 1) * 0.05, i * 0.03, 0); hearts.add(h); }

  function pose(state, t, petted) {
    const walk = state === 'walk', nap = state === 'nap', sit = state === 'sit' || state === 'perch' || state === 'groom';
    // legs: trot when walking, tucked when lying down
    legs.forEach((l, i) => { l.rotation.x = walk ? Math.sin(t * 11 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0; l.visible = !nap; });
    body.position.y = nap ? 0.07 : sit ? 0.15 : 0.17 + (walk ? Math.abs(Math.sin(t * 11)) * 0.008 : 0);
    body.rotation.x = sit ? -0.45 : 0;
    torso.scale.set(nap ? 1.2 : 0.95, nap ? 0.6 : 0.85, nap ? 1.2 : 1.6);
    head.rotation.x = nap ? 0.5 : state === 'groom' ? 0.6 + Math.sin(t * 6) * 0.15 : petted ? -0.2 : 0;
    head.rotation.y = nap ? 0.9 : walk ? 0 : Math.sin(t * 0.7) * 0.4;
    head.position.set(nap ? 0.06 : 0, nap ? 0.04 : 0.1, nap ? 0.12 : 0.17);
    eyes.forEach(e => { e.scale.y = nap || petted ? 0.15 : (Math.sin(t * 0.9) > 0.985 ? 0.15 : 1); });
    // the tail: swishes, curls round when asleep
    segs.forEach((sg, i) => { sg.rotation.y = nap ? 0.5 : Math.sin(t * (walk ? 6 : 2) - i * 0.6) * (walk ? 0.12 : 0.22); sg.rotation.x = nap ? 0 : -0.35 + (sit ? -0.1 : 0); });
    ears.forEach((e, i) => { e.rotation.x = Math.sin(t * 3 + i) > 0.97 ? -0.4 : 0; });
    hearts.visible = !!petted;
    if (petted) hearts.position.y = 0.45 + (t % 1) * 0.1;
  }
  function dispose() { group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  return { group, pose, dispose };
}
