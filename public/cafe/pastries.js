// The pastry counter in 3D: each of the twelve pastries on a small plate,
// built from smooth shapes (the same `shape` names as the drawings in /art.js).
// About 17 cm across — the size of a real side plate.

import * as THREE from 'three';

const SEG = 24;
// Fresh materials per pastry: plates are disposed with disposeTree when they go.
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.7, ...opts });
const mesh = (geo, color, opts) => { const m = new THREE.Mesh(geo, mat(color, opts)); m.castShadow = true; return m; };
const ball = (r, color, opts) => mesh(new THREE.SphereGeometry(r, SEG, 16), color, opts);
const dome = (r, color, opts) => mesh(new THREE.SphereGeometry(r, SEG, 12, 0, Math.PI * 2, 0, Math.PI / 2), color, opts);
const disc = (r, h, color, opts) => mesh(new THREE.CylinderGeometry(r, r, h, SEG), color, opts);
const box = (w, h, d, color, opts) => mesh(new THREE.BoxGeometry(w, h, d), color, opts);

function sprinkle(g, n, r, y, color, size = 0.0035) {
  for (let i = 0; i < n; i++) {
    const a = i * 2.399, d = r * Math.sqrt((i + 0.5) / n);
    const s = ball(size, color);
    s.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    s.scale.y = 0.5;
    g.add(s);
  }
}

const BUILD = {
  dates(g) { // three dates on a little brass dish, the way iftar starts
    const dish = disc(0.05, 0.006, '#c9a25b', { metalness: 0.7, roughness: 0.3 }); dish.position.y = 0.003; g.add(dish);
    for (let i = 0; i < 3; i++) { const d = ball(0.012, '#4a2a18', { roughness: 0.35 }); d.scale.set(1, 0.75, 1.9); d.position.set(-0.018 + i * 0.018, 0.016, (i % 2) * 0.01); d.rotation.y = i * 0.6; g.add(d); }
  },
  qatayef(g) { // qatayef: little half-moon pancakes, filled with nuts, syrup on top
    const plate = disc(0.06, 0.004, '#f4ece0', { roughness: 0.3 }); plate.position.y = 0.002; g.add(plate);
    for (let i = 0; i < 3; i++) {
      const q = mesh(new THREE.SphereGeometry(0.024, SEG, 10, 0, Math.PI), '#d9a25a', { roughness: 0.6, side: THREE.DoubleSide });
      q.scale.set(1, 1, 0.45); q.rotation.set(-Math.PI / 2, 0, i * 2.1); q.position.set(Math.cos(i * 2.1) * 0.022, 0.006, Math.sin(i * 2.1) * 0.022); g.add(q);
    }
    sprinkle(g, 10, 0.03, 0.03, '#7ab05a', 0.003);
  },
  qamareldin(g) { // a glass of qamar el-din: apricot, thick and orange
    const glass = mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.075, SEG, 1, true), '#e8f2f4', { transparent: true, opacity: 0.4, roughness: 0.05, side: THREE.DoubleSide });
    glass.position.y = 0.038; g.add(glass);
    const juice = disc(0.02, 0.06, '#e8892a', { roughness: 0.3 }); juice.position.y = 0.031; g.add(juice);
  },
  teaglass(g) { // the ahwa's shai: a small glass of dark tea on a saucer, a sprig of mint
    const saucer = disc(0.045, 0.004, '#f4f1ea', { roughness: 0.3 }); saucer.position.y = 0.002; g.add(saucer);
    const glass = mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.07, SEG, 1, true), '#e8f2f4', { transparent: true, opacity: 0.45, roughness: 0.05, side: THREE.DoubleSide });
    glass.position.y = 0.039; g.add(glass);
    const tea = disc(0.02, 0.055, '#7a2e12', { roughness: 0.2, transparent: true, opacity: 0.9 }); tea.position.y = 0.033; g.add(tea);
    for (let i = 0; i < 3; i++) { const l = ball(0.006, '#4f8a3a'); l.scale.set(1.4, 0.4, 0.8); l.position.set(0.006 * i - 0.006, 0.073, 0.004 * i); g.add(l); }
  },
  coffeecup(g) { // ahwa mazboot: Turkish coffee in a little cup, the foam on top
    const saucer = disc(0.04, 0.004, '#f4f1ea', { roughness: 0.3 }); saucer.position.y = 0.002; g.add(saucer);
    const cup = mesh(new THREE.CylinderGeometry(0.022, 0.017, 0.04, SEG), '#f4f1ea', { roughness: 0.3 }); cup.position.y = 0.024; g.add(cup);
    const foam = disc(0.02, 0.002, '#b8875a', { roughness: 0.9 }); foam.position.y = 0.045; g.add(foam);
    const handle = mesh(new THREE.TorusGeometry(0.009, 0.003, 6, 12), '#f4f1ea'); handle.position.set(0.026, 0.026, 0); g.add(handle);
  },
  sahlab(g) { // sahlab: warm milk, cinnamon, coconut and pistachios
    const cup = mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.06, SEG), '#c4627f', { roughness: 0.5 }); cup.position.y = 0.03; g.add(cup);
    const milk = disc(0.03, 0.002, '#f7efe2', { roughness: 0.8 }); milk.position.y = 0.061; g.add(milk);
    sprinkle(g, 18, 0.026, 0.063, '#8a5a2a', 0.003); sprinkle(g, 8, 0.02, 0.064, '#7ab05a', 0.004);
  },
  koshari(g) { // Koshari Abu Saied's: a steel bowl — rice and lentils, macaroni, tomato sauce, chickpeas, crispy onions
    const bowl = mesh(new THREE.CylinderGeometry(0.07, 0.045, 0.045, SEG, 1, true), '#c8ccd2', { metalness: 0.75, roughness: 0.25, side: THREE.DoubleSide });
    bowl.position.y = 0.024;
    g.add(bowl);
    const base = disc(0.045, 0.004, '#c8ccd2', { metalness: 0.75, roughness: 0.25 }); base.position.y = 0.002; g.add(base);
    const heap = dome(0.064, '#a07a4a', { roughness: 0.95 }); // the rice and lentils
    heap.scale.y = 0.45; heap.position.y = 0.04;
    g.add(heap);
    for (let i = 0; i < 14; i++) { // macaroni
      const a = i * 2.4, r = 0.012 + (i % 5) * 0.008;
      const m = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.014, 6), '#efd69a', { roughness: 0.7 });
      m.position.set(Math.cos(a) * r, 0.064, Math.sin(a) * r); m.rotation.set(Math.PI / 2, a, 0.4);
      g.add(m);
    }
    const sauce = dome(0.035, '#b8341f', { roughness: 0.4 }); sauce.scale.y = 0.35; sauce.position.y = 0.064;
    g.add(sauce);
    for (let i = 0; i < 6; i++) { const c = ball(0.006, '#e3c27a'); c.position.set(Math.cos(i) * 0.03, 0.066, Math.sin(i) * 0.03); g.add(c); } // chickpeas
    for (let i = 0; i < 16; i++) { const o = box(0.012, 0.002, 0.006, '#7a4318', { roughness: 0.8 }); o.position.set((Math.random() - 0.5) * 0.05, 0.075, (Math.random() - 0.5) * 0.05); o.rotation.y = i; g.add(o); } // crispy onions
  },
  slice(g) { // white chocolate & strawberry mochi cake, one pressed sakura
    const layers = [['#f0d8c6', 0.008], ['#fff4f0', 0.012], ['#f5a8b8', 0.006], ['#fff4f0', 0.012], ['#fbe0e6', 0.006]];
    let y = 0;
    for (const [c, h] of layers) { const b = box(0.11, h, 0.05, c); b.position.y = y + h / 2; g.add(b); y += h; }
    for (let i = 0; i < 5; i++) {
      const p = ball(0.007, '#f2a7bb');
      const a = i * Math.PI * 2 / 5;
      p.scale.set(1, 0.3, 1.6);
      p.position.set(Math.cos(a) * 0.008, y + 0.002, Math.sin(a) * 0.008);
      p.rotation.y = -a;
      g.add(p);
    }
    const mid = ball(0.004, '#d4678a'); mid.position.y = y + 0.003; g.add(mid);
  },
  domes(g) { // maamoul mochi: three powdered moons
    for (let i = 0; i < 3; i++) {
      const d = dome(0.022, '#fffdf9', { roughness: 0.95 });
      d.scale.y = 0.85;
      d.position.set((i - 1) * 0.047, 0, (i === 1 ? -0.012 : 0.01));
      g.add(d);
      const ring = mesh(new THREE.TorusGeometry(0.012, 0.0015, 6, SEG), '#eadfd2');
      ring.rotation.x = Math.PI / 2;
      ring.position.set(d.position.x, 0.016, d.position.z);
      g.add(ring);
    }
  },
  square(g) { // matcha basbousa
    const b = box(0.07, 0.03, 0.07, '#e8b45c'); b.position.y = 0.015; g.add(b);
    const top = box(0.07, 0.005, 0.07, '#8fbf6a', { roughness: 0.4 }); top.position.y = 0.0325; g.add(top);
    const almond = ball(0.009, '#f3e2c4'); almond.scale.set(1.6, 0.5, 1); almond.position.y = 0.037; g.add(almond);
  },
  cookies(g) { // Hana's sesame cookies, a little stack
    for (let i = 0; i < 4; i++) {
      const c = disc(0.034, 0.007, i % 2 ? '#e2b77a' : '#d9a865');
      c.position.set((i % 2 ? 0.004 : -0.003), 0.004 + i * 0.0075, 0);
      c.rotation.y = i;
      g.add(c);
    }
    sprinkle(g, 18, 0.03, 0.034, '#fff6e2', 0.0028);
  },
  nest(g) { // hojicha konafa nest
    const n = mesh(new THREE.TorusGeometry(0.03, 0.013, 10, SEG), '#e3a23f', { roughness: 0.95 });
    n.rotation.x = Math.PI / 2; n.position.y = 0.013; g.add(n);
    const base = disc(0.03, 0.008, '#d8932f'); base.position.y = 0.004; g.add(base);
    const cream = dome(0.022, '#c9a07a', { roughness: 0.5 }); cream.scale.y = 0.7; cream.position.y = 0.012; g.add(cream);
    const honey = mesh(new THREE.TorusGeometry(0.012, 0.0022, 6, SEG), '#f3c64f', { roughness: 0.2 });
    honey.rotation.x = Math.PI / 2; honey.position.y = 0.026; g.add(honey);
  },
  melonpan(g) { // a soft bun wearing a sweater: a crackled sugar crust
    const d = dome(0.04, '#f2c56a', { roughness: 0.85 }); d.scale.y = 0.75; g.add(d);
    for (let i = 0; i < 22; i++) {
      const lat = Math.acos(1 - (i + 0.5) / 22), lon = i * 2.399;
      const c = ball(0.007, i % 2 ? '#e0a94a' : '#f8d98f', { roughness: 0.9 });
      const r = 0.0395;
      c.position.set(Math.sin(lat) * Math.cos(lon) * r, Math.cos(lat) * r * 0.75, Math.sin(lat) * Math.sin(lon) * r);
      c.scale.set(1, 0.35, 1);
      c.lookAt(c.position.clone().multiplyScalar(2));
      c.rotateX(Math.PI / 2);
      g.add(c);
    }
  },
  daifuku(g) { // rosewater daifuku
    const b = ball(0.03, '#f7c3cf', { roughness: 0.6 }); b.scale.y = 0.72; b.position.y = 0.021; g.add(b);
    const petal = ball(0.007, '#e7849f'); petal.scale.set(1, 0.3, 1.6); petal.position.y = 0.043; g.add(petal);
  },
  dorayaki(g) { // honey dorayaki
    const lo = disc(0.036, 0.011, '#c9823f'); lo.position.y = 0.0055; g.add(lo);
    const bean = disc(0.033, 0.004, '#7b3a35'); bean.position.y = 0.013; g.add(bean);
    const hi = dome(0.036, '#d28d48'); hi.scale.y = 0.32; hi.position.y = 0.015; g.add(hi);
    const honey = ball(0.006, '#f0b93a', { roughness: 0.15 }); honey.position.set(0.012, 0.027, 0.01); honey.scale.y = 0.4; g.add(honey);
  },
  anpan(g) { // fig and walnut anpan, sesame on top
    const d = dome(0.036, '#b8763f', { roughness: 0.55 }); d.scale.y = 0.8; g.add(d);
    const s = ball(0.0035, '#fff4dc'); s.scale.set(1, 0.5, 1.6); s.position.y = 0.029; g.add(s);
  },
  shells(g) { // yuzu lemon madeleines
    for (let i = 0; i < 3; i++) {
      const m = dome(0.022, '#f3cc6c', { roughness: 0.6 });
      m.scale.set(1, 0.45, 1.35);
      m.position.set((i - 1) * 0.045, 0, 0);
      m.rotation.y = (i - 1) * 0.3;
      g.add(m);
    }
  },
  waffle(g) { // Me3temed's mini waffle
    const w = box(0.07, 0.014, 0.06, '#e5ad5a'); w.position.y = 0.007; g.add(w);
    for (let i = -2; i <= 2; i++) {
      const a = box(0.002, 0.003, 0.06, '#c58a37'); a.position.set(i * 0.014, 0.0145, 0); g.add(a);
      if (Math.abs(i) < 2) { const b = box(0.07, 0.003, 0.002, '#c58a37'); b.position.set(0, 0.0145, i * 0.015); g.add(b); }
    }
    const cream = dome(0.02, '#a9cf86', { roughness: 0.5 }); cream.scale.y = 0.6; cream.position.y = 0.015; g.add(cream);
    const leaf = ball(0.01, '#5a3826'); leaf.scale.set(1.6, 0.25, 0.8); leaf.position.set(0.006, 0.029, 0); leaf.rotation.y = 0.5; g.add(leaf);
  },
  bites(g) { // date and tahini mochi bites
    const at = [[-0.03, 0.014], [0, 0.02], [0.03, 0.014], [-0.015, -0.014], [0.016, -0.014]];
    for (const [x, z] of at) { const b = ball(0.0125, '#e9cf9e', { roughness: 0.9 }); b.position.set(x, 0.0115, z); g.add(b); }
  },
};

// A pastry on its plate. `bites` (0–3) takes it down a little at a time.
export function makeDessert(shape, bites = 0) {
  const g = new THREE.Group();
  const plate = mesh(new THREE.CylinderGeometry(0.085, 0.06, 0.012, SEG), '#fffaf2', { roughness: 0.35 });
  plate.position.y = 0.006;
  const rim = mesh(new THREE.TorusGeometry(0.08, 0.004, 6, SEG * 2), '#f6ece0', { roughness: 0.35 });
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.012;
  g.add(plate, rim);
  const pastry = new THREE.Group();
  pastry.position.y = 0.012;
  (BUILD[shape] || BUILD.daifuku)(pastry);
  g.add(pastry);
  setBites(g, bites);
  return g;
}

// 0 = untouched, 3 = only crumbs left.
export function setBites(g, bites) {
  const pastry = g.children[2];
  const left = Math.max(0, 1 - bites / 3);
  pastry.visible = left > 0;
  pastry.scale.set(0.45 + 0.55 * left, 0.6 + 0.4 * left, 0.45 + 0.55 * left);
  if (!g.userData.crumbs) {
    const crumbs = new THREE.Group();
    sprinkle(crumbs, 9, 0.04, 0.014, '#d9b07a', 0.003);
    g.add(crumbs);
    g.userData.crumbs = crumbs;
  }
  g.userData.crumbs.visible = bites > 0;
}
