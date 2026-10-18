// Someone's own room upstairs: the empty room (walls in their colour, their
// floor, a window onto Cairo, the door back to the hallway) and whatever
// furniture they've put in it. world.js gives us a floor ({ group, colliders,
// seats, surfaces, interactables }) and we keep its lists up to date as
// furniture comes and goes, so sitting, sleeping, putting a drink down and
// bumping into things all just work.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM_SIZE, BY_KIND, footprint } from './furniture.mjs';

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
    lid.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ color: '#cfe6f2' })), 0, 0.115, 0.007));
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
};
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
  const wallM = std('#efe6db', { roughness: 0.95 });
  const trimM = std('#93ab8c', { roughness: 0.85 });
  const wood = std('#6e472e', { roughness: 0.5 });
  const shell = new THREE.Group();
  group.add(shell);

  // the floor, with a texture per choice
  const floorTex = {};
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#ffffff', { roughness: 0.6 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.userData.floor = true;
  shell.add(floorMesh);
  floor.floorMesh = floorMesh;

  // walls: a window on the back wall and the left wall, the door on the front
  const walls = [];
  const wall = (w, h, x, y, z, ry = 0) => {
    const m = box(w, h, 0.16, wallM);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.userData.surface = 'wall';
    shell.add(m); walls.push(m);
    return m;
  };
  // back (z = minZ): window 3 m wide from y 0.9 to 2.5, centred at x = 1
  const bz = R.minZ - 0.08, wx0 = -0.5, wx1 = 2.5, wy0 = 0.9, wy1 = 2.5;
  wall(wx0 - R.minX, H, (R.minX + wx0) / 2, H / 2, bz);
  wall(R.maxX - wx1, H, (wx1 + R.maxX) / 2, H / 2, bz);
  wall(wx1 - wx0, wy0, (wx0 + wx1) / 2, wy0 / 2, bz);
  wall(wx1 - wx0, H - wy1, (wx0 + wx1) / 2, (wy1 + H) / 2, bz);
  // left (x = minX): window 2.2 m wide centred at z = 0
  const lx = R.minX - 0.08, lz0 = -1.1, lz1 = 1.1;
  wall(lz0 - R.minZ, H, lx, H / 2, (R.minZ + lz0) / 2, Math.PI / 2);
  wall(R.maxZ - lz1, H, lx, H / 2, (lz1 + R.maxZ) / 2, Math.PI / 2);
  wall(lz1 - lz0, wy0, lx, wy0 / 2, 0, Math.PI / 2);
  wall(lz1 - lz0, H - wy1, lx, (wy1 + H) / 2, 0, Math.PI / 2);
  // right, and the front with the door in the middle
  wall(D + 0.32, H, R.maxX + 0.08, H / 2, 0, Math.PI / 2);
  const fz = R.maxZ + 0.08, dw = 1.1, dh = 2.2;
  wall(-dw / 2 - R.minX, H, (R.minX - dw / 2) / 2, H / 2, fz);
  wall(R.maxX - dw / 2, H, (dw / 2 + R.maxX) / 2, H / 2, fz);
  wall(dw, H - dh, 0, (dh + H) / 2, fz);
  // window glass and frames
  const glassM = new THREE.MeshStandardMaterial({ color: '#dff1ff', roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false });
  for (const [w, x, z, ry] of [[wx1 - wx0, (wx0 + wx1) / 2, bz, 0], [lz1 - lz0, lx, 0, Math.PI / 2]]) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, wy1 - wy0), glassM);
    gl.position.set(x, (wy0 + wy1) / 2, z); gl.rotation.y = ry;
    shell.add(gl);
    const fr = new THREE.Group();
    for (const [fw, fh, fx, fy] of [[w + 0.1, 0.07, 0, wy0], [w + 0.1, 0.07, 0, wy1], [0.07, wy1 - wy0, -w / 2, (wy0 + wy1) / 2], [0.07, wy1 - wy0, w / 2, (wy0 + wy1) / 2], [0.05, wy1 - wy0, 0, (wy0 + wy1) / 2]]) {
      fr.add(at(box(fw, fh, 0.22, wood), fx, fy, 0));
    }
    fr.add(at(box(w + 0.2, 0.05, 0.3, wood), 0, wy0 - 0.03, 0.08)); // the sill
    fr.position.set(x, 0, z); fr.rotation.y = ry;
    shell.add(fr);
  }
  // a sage skirting band, and the door (closed, with a brass knob)
  for (const [w, x, z, ry] of [[W, 0, R.minZ + 0.005, 0], [W, 0, R.maxZ - 0.005, Math.PI], [D, R.minX + 0.005, 0, Math.PI / 2], [D, R.maxX - 0.005, 0, -Math.PI / 2]]) {
    const b = at(box(w, 0.12, 0.02, trimM), x, 0.06, z); b.rotation.y = ry; shell.add(b);
  }
  const door = at(rbox(dw - 0.06, dh - 0.03, 0.06, 0.02, std('#93ab8c', { roughness: 0.6 })), 0, dh / 2, R.maxZ + 0.04);
  shell.add(door);
  shell.add(at(ball(0.035, std('#c9a25b', { metalness: 0.8, roughness: 0.3 }), 12), 0.38, 1.0, R.maxZ));
  for (const [w, h, x, y] of [[0.08, dh, -dw / 2, dh / 2], [0.08, dh, dw / 2, dh / 2], [dw + 0.16, 0.08, 0, dh]]) shell.add(at(box(w, h, 0.22, wood), x, y, R.maxZ + 0.04));
  const doorHit = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ visible: false }));
  doorHit.position.set(0, dh / 2, R.maxZ - 0.05);
  doorHit.rotation.y = Math.PI;
  doorHit.userData = { kind: 'stairs-down', label: 'Out to the hallway, and back down to the café' };
  shell.add(doorHit);

  // the ceiling and a paper lamp
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, D + 0.4), std('#fbf3ea', { roughness: 1, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
  shell.add(ceil);
  const lampShade = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), std('#fffaf0', { roughness: 0.9, emissive: '#ffd9a0', emissiveIntensity: 0.6 }));
  lampShade.position.set(0, H - 0.65, 0);
  shell.add(lampShade, at(cyl(0.006, 0.006, 0.35, std('#3a2a26'), 6), 0, H - 0.18, 0));
  const ceilingLight = new THREE.PointLight('#ffd9a6', 4, 12, 1.4);
  ceilingLight.position.set(0, H - 0.8, 0);
  shell.add(ceilingLight);

  // the room's name on a little plaque by the door
  let plaque = null;
  function setPlaque(name) {
    if (plaque) { shell.remove(plaque); plaque.traverse(o => { o.material?.map?.dispose(); o.material?.dispose(); o.geometry?.dispose(); }); }
    plaque = makeSign([{ text: name, font: 'Dancing Script, cursive', size: 110, weight: '700' }], 1.3, 0.28);
    plaque.position.set(-1.35, 1.75, R.maxZ - 0.02);
    plaque.rotation.y = Math.PI;
    shell.add(plaque);
  }

  // ── furniture
  const items = new Map(); // id -> { item, def, group, meshes, seats }
  const things = new THREE.Group();
  group.add(things);
  const base = { colliders: [], interactables: [doorHit], surfaces: [...walls] };

  // Rebuild the floor's lists from the shell and the furniture.
  function sync() {
    const fy = group.position.y;
    floor.colliders.length = 0;
    floor.colliders.push({ type: 'room', fixed: true, minX: R.minX + 0.3, maxX: R.maxX - 0.3, minZ: R.minZ + 0.3, maxZ: R.maxZ - 0.3 });
    floor.seats.length = 0;
    floor.surfaces.length = 0;
    floor.surfaces.push(...base.surfaces);
    floor.interactables.length = 0;
    floor.interactables.push(...base.interactables);
    for (const e of items.values()) {
      const { item, def } = e;
      if (!def.flat && !def.onTop) {
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
  }

  function makeThing(item) {
    const def = BY_KIND.get(item.kind);
    if (!def) return null;
    const g = BUILD[item.kind](item.color, def);
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
    const kind = def.lie ? 'home-bed' : def.desk ? 'home-desk' : def.seats ? 'seat' : 'home-item';
    const label = def.lie ? `${def.name} — sleep here` : def.desk ? `${def.name} — start a study session` : def.seats ? `Sit on the ${def.name.toLowerCase()}` : def.name;
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
    if (f.minX < R.minX - 0.01 || f.maxX > R.maxX + 0.01 || f.minZ < R.minZ - 0.01 || f.maxZ > R.maxZ + 0.01) return false;
    if (def.flat || def.onTop) return true;
    if (f.maxZ > R.maxZ - 1.0 && f.minX < 0.75 && f.maxX > -0.75) return false; // keep the doorway clear
    for (const e of items.values()) {
      if (e.item.id === ignoreId || e.def.flat || e.def.onTop) continue;
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

  const tops = () => [...items.values()].map(e => e.top || e.bedTop).filter(Boolean);
  return {
    setRoom, setItems, add, update: add, remove, items, tops, sync,
    showGhost, moveGhost, hideGhost, canPlace, select, ghostKind: () => ghost && ghost.kind,
    arrival: { x: 0, z: R.maxZ - 0.9, ry: Math.PI },
    bounds: R, ceilingLight, lampShade,
  };
}
