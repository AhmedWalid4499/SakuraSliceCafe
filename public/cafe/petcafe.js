// The Pet Café: on the fourth floor, off its landing. Four café cats and two
// bunnies live here — floor cushions and low tables to sit at, a tall cat tree,
// shelves along the wall the cats walk on, a window seat in the sun, a bunny
// pen with hay and a little hutch, food bowls, yarn balls and a feather wand,
// a menu board and the treats jar. Click a pet to name it, pet it or feed it
// (app.js); the ones that know you come over when you walk in.
//
// The pets wander on a timetable worked out from the clock (like the felucca),
// so everyone in the room sees them in about the same place.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, shell, doorOut, plant, pendant } from './roomkit.js';
import { makeCat } from './home.js';

export const PETCAFE = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, h: 3.2 };
const R = PETCAFE;
const cyl = (rt, rb, h, m, seg = 18) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const ball = (r, m, seg = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.6)), m);

export const PETS = [
  { id: 'mishmish', kind: 'cat', coat: 'ginger' },
  { id: 'luna', kind: 'cat', coat: 'black' },
  { id: 'simsim', kind: 'cat', coat: 'tabby' },
  { id: 'kiki', kind: 'cat', coat: 'calico' },
  { id: 'qamar', kind: 'bunny', color: '#f4ede4' },
  { id: 'bondo', kind: 'bunny', color: '#a07850' },
];

// ── a bunny: about 35 cm nose to tail, facing +z — the same pose() as the cat
export function makeBunny(color = '#f4ede4') {
  const group = new THREE.Group();
  const fur = std(color, { roughness: 1 }), light = std('#fbf6ee', { roughness: 1 }), pink = std('#f2a7bb', { roughness: 0.8 });
  const body = new THREE.Group(); body.position.y = 0.12; group.add(body);
  const torso = ball(0.11, fur, 18); torso.scale.set(0.95, 0.9, 1.3); body.add(torso);
  const belly = at(ball(0.07, light, 12), 0, -0.03, 0.07); belly.scale.set(1, 0.9, 0.8); body.add(belly);
  const head = new THREE.Group(); head.position.set(0, 0.08, 0.13); body.add(head);
  const skull = ball(0.07, fur, 18); skull.scale.set(1, 0.95, 1.05); head.add(skull);
  for (const s of [-1, 1]) { const ch = at(ball(0.035, light, 10), s * 0.03, -0.025, 0.04); head.add(ch); }
  const nose = at(ball(0.012, pink, 8), 0, -0.005, 0.072); nose.scale.set(1.2, 0.8, 0.8); head.add(nose);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = at(ball(0.014, std('#2a1d1d', { roughness: 0.2 }), 10), s * 0.038, 0.018, 0.052); e.scale.z = 0.6; head.add(e); eyes.push(e);
    head.add(at(ball(0.004, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 6), s * 0.038 + 0.004, 0.024, 0.06));
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * 0.03, 0.05, -0.01);
    const outer = at(ball(0.03, fur, 12), 0, 0.075, 0); outer.scale.set(0.75, 2.6, 0.45);
    const inner = at(ball(0.02, pink, 10), 0, 0.075, 0.009); inner.scale.set(0.6, 2.4, 0.3);
    ear.add(outer, inner); ear.rotation.z = -s * 0.18; ear.rotation.x = -0.15;
    head.add(ear); ears.push(ear);
  }
  const tail = at(ball(0.04, light, 12), 0, 0.02, -0.14); body.add(tail);
  const feet = [];
  for (const [x, z, big] of [[-0.05, 0.08, 0], [0.05, 0.08, 0], [-0.065, -0.06, 1], [0.065, -0.06, 1]]) {
    const f = at(ball(big ? 0.035 : 0.025, fur, 10), x, 0.02, z); f.scale.set(1, 0.6, big ? 2 : 1.4); group.add(f); feet.push(f);
  }
  const hearts = new THREE.Group(); group.add(hearts); hearts.position.y = 0.42; hearts.visible = false;
  for (let i = 0; i < 3; i++) hearts.add(at(ball(0.018, new THREE.MeshBasicMaterial({ color: '#e7849f' }), 8), (i - 1) * 0.05, i * 0.03, 0));

  function pose(state, t, petted) {
    const walk = state === 'walk', nap = state === 'nap';
    const hop = walk ? Math.max(0, Math.sin(t * 9)) : 0;
    body.position.y = (nap ? 0.09 : 0.12) + hop * 0.07;
    body.rotation.x = walk ? -Math.cos(t * 9) * 0.15 : 0;
    feet.forEach((f, i) => { f.position.y = 0.02 + (i > 1 ? hop * 0.03 : hop * 0.06); });
    torso.scale.set(nap ? 1.1 : 0.95, nap ? 0.75 : 0.9, nap ? 1.4 : 1.3);
    head.rotation.x = nap ? 0.35 : petted ? -0.15 : state === 'groom' ? 0.3 + Math.sin(t * 5) * 0.12 : 0;
    head.rotation.y = nap || walk ? 0 : Math.sin(t * 0.6) * 0.35;
    nose.scale.y = 0.8 + (nap ? 0 : Math.max(0, Math.sin(t * 14)) * 0.35); // twitch, twitch
    ears.forEach((e, i) => { e.rotation.x = (nap ? 0.9 : -0.15) + Math.sin(t * 1.7 + i * 2) * 0.08; });
    eyes.forEach(e => { e.scale.y = nap || petted ? 0.15 : (Math.sin(t * 0.8) > 0.985 ? 0.15 : 1); });
    tail.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    hearts.visible = !!petted;
    if (petted) hearts.position.y = 0.42 + (t % 1) * 0.1;
  }
  function dispose() { group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  return { group, pose, dispose };
}

// a little name tag that always faces you
function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const g = c.getContext('2d');
  g.font = '700 38px Georgia, serif';
  const w = Math.min(244, g.measureText(text).width + 36);
  g.fillStyle = 'rgba(255,250,244,0.94)'; g.strokeStyle = '#d4678a'; g.lineWidth = 4;
  g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 54, 26); g.fill(); g.stroke();
  g.fillStyle = '#8a4a5a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 37, 220);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set(0.5, 0.14, 1);
  return s;
}

export function buildPetCafe({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [196, 150, 110], 57),
    wallColor: '#fbefe4', lowColor: '#e9b8a8', ceilColor: '#fff8f0', windows: { east: [-1.6, 2.0] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const wood = std('#c9a27e', { roughness: 0.6 }), woodDark = std('#8a5a3a', { roughness: 0.6 });
  const sisal = std('#d9c29a', { roughness: 1, map: canvasTex(64, 64, (g, w) => { g.fillStyle = '#d9c29a'; g.fillRect(0, 0, w, w); g.strokeStyle = '#b89a6a'; g.lineWidth = 2; for (let y = 0; y < w; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 2); g.stroke(); } }, [1, 4]) });
  const plush = std('#f2c6d0', { roughness: 1 });

  // a round rug in the middle, paw prints on it
  {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), std('#ffffff', { roughness: 1, map: canvasTex(512, 512, (g, w) => {
      g.fillStyle = '#f6d9c8'; g.fillRect(0, 0, w, w);
      g.strokeStyle = '#e9b8a8'; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 20, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#e8a6a0';
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7, r = 90 + (i % 3) * 50, x = w / 2 + Math.cos(a) * r, y = w / 2 + Math.sin(a) * r;
        g.beginPath(); g.ellipse(x, y, 14, 11, a, 0, Math.PI * 2); g.fill();
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(x + Math.cos(a + k * 0.6 - Math.PI / 2) * 20, y + Math.sin(a + k * 0.6 - Math.PI / 2) * 20, 6, 0, Math.PI * 2); g.fill(); }
      }
    }) }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-0.6, 0.006, 0.9); rug.receiveShadow = true; group.add(rug);
  }

  // ── low tables with floor cushions round them
  const CUSH = ['#f2a7bb', '#a8d0c8', '#f4d38a', '#c9b3d9', '#f6b89a', '#b8cfe8'];
  let ci = 0;
  for (const [tx, tz] of [[-2.0, 0.4], [1.0, 2.0], [-2.6, 3.2]]) {
    const top = at(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32), wood), tx, 0.36, tz); group.add(top);
    group.add(at(cyl(0.12, 0.18, 0.34, woodDark), tx, 0.17, tz));
    group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 20), std('#ffffff', { roughness: 0.4 })), tx + 0.15, 0.4, tz - 0.1)); // a saucer
    const cup = at(cyl(0.04, 0.032, 0.07, std('#fffaf2', { roughness: 0.35 })), tx + 0.15, 0.445, tz - 0.1); group.add(cup);
    block(tx, tz, 0.9, 0.9);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.4, x = tx + Math.cos(a) * 0.95, z = tz + Math.sin(a) * 0.95;
      const c = at(rbox(0.56, 0.14, 0.56, 0.06, std(CUSH[ci++ % CUSH.length], { roughness: 1 })), x, 0.07, z);
      c.rotation.y = -a; group.add(c);
      const knot = at(ball(0.035, std('#ffffff', { roughness: 1 }), 10), x, 0.145, z); knot.scale.y = 0.4; group.add(knot);
      const s = { id: `petcafe-cushion-${tx}-${k}`, label: 'a floor cushion', x, z, y: fy, h: 0.15, ry: Math.atan2(tx - x, tz - z) };
      seats.push(s);
      clickable(c, { kind: 'seat', seat: s, label: 'Sit on a floor cushion' });
    }
  }

  // ── the cat tree, in the north-west corner: three platforms and a little house
  const TREE = { x: -4.7, z: -3.7 };
  {
    const g = new THREE.Group(); g.position.set(TREE.x, 0, TREE.z);
    g.add(at(rbox(1.1, 0.08, 1.1, 0.03, plush), 0, 0.04, 0));
    for (const [x, z, h] of [[-0.3, -0.3, 1.8], [0.32, 0.25, 1.25], [0.3, -0.32, 0.7]]) g.add(at(cyl(0.07, 0.07, h, sisal, 14), x, h / 2, z));
    for (const [x, y, z, r] of [[0.25, 0.72, 0.0, 0.42], [-0.05, 1.27, 0.15, 0.38], [-0.3, 1.82, -0.3, 0.36]]) {
      g.add(at(cyl(r, r, 0.06, plush, 24), x, y, z));
      g.add(at(cyl(r * 0.85, r * 0.85, 0.02, std('#fbe3ea', { roughness: 1 }), 24), x, y + 0.035, z));
    }
    // a cosy cube with a round door at the bottom
    const hut = at(rbox(0.5, 0.42, 0.5, 0.06, plush), -0.2, 0.3, 0.2); g.add(hut);
    const hole = at(new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), std('#5a3e36', { roughness: 1 })), -0.2, 0.28, 0.452); g.add(hole);
    // a dangling pom-pom
    g.add(at(cyl(0.003, 0.003, 0.3, std('#eeeeee'), 4), 0.25 + 0.3, 0.57, 0.0));
    g.add(at(ball(0.04, std('#ff8ac0', { roughness: 1 }), 10), 0.55, 0.42, 0.0));
    group.add(g);
    block(TREE.x, TREE.z, 1.1, 1.1);
  }

  // ── shelves along the north wall, staggered, for the cats to walk along
  const SHELF_Z = R.minZ + 0.18;
  for (const [x, y] of [[-2.6, 0.9], [-1.6, 1.35], [-0.6, 1.8], [0.4, 1.35]]) {
    group.add(at(rbox(0.8, 0.05, 0.34, 0.015, wood), x, y, SHELF_Z));
    group.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), std('#f2c6d0', { roughness: 1 })), x, y + 0.027, SHELF_Z).rotateX(-Math.PI / 2));
    for (const s of [-1, 1]) group.add(at(box(0.03, 0.14, 0.2, woodDark), x + s * 0.3, y - 0.08, SHELF_Z - 0.04));
  }

  // ── the window seat along the east wall, in the sun
  const WIN = { x: R.maxX - 0.4, z: -1.6 };
  {
    group.add(at(rbox(0.7, 0.42, 1.8, 0.04, std('#f4ece0', { roughness: 0.7 })), WIN.x, 0.21, WIN.z));
    group.add(at(rbox(0.66, 0.1, 1.74, 0.05, std('#a8d0c8', { roughness: 1 })), WIN.x, 0.47, WIN.z));
    for (const dz of [-0.6, 0.6]) { const p = at(rbox(0.16, 0.32, 0.42, 0.08, std('#f4d38a', { roughness: 1 })), WIN.x + 0.22, 0.65, WIN.z + dz); p.rotation.x = 0.15; group.add(p); }
    block(WIN.x, WIN.z, 0.7, 1.8);
    for (const dz of [-0.45, 0.45]) seats.push({ id: `petcafe-window-${dz < 0 ? 'n' : 's'}`, label: 'the window seat', x: WIN.x - 0.05, z: WIN.z + dz, y: fy, h: 0.52, ry: -Math.PI / 2 });
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.8), new THREE.MeshBasicMaterial({ visible: false })), WIN.x, 0.3, WIN.z);
    group.add(hit); clickable(hit, { kind: 'seat', seat: seats[seats.length - 1], label: 'Sit on the window seat' });
  }

  // ── the bunny pen, in the north-east corner: a low fence, hay, a hutch, a water bottle
  const PEN = { minX: 2.2, maxX: R.maxX - 0.15, minZ: R.minZ + 0.15, maxZ: -3.0 };
  {
    const pw = PEN.maxX - PEN.minX, pd = PEN.maxZ - PEN.minZ, cx = (PEN.minX + PEN.maxX) / 2, cz = (PEN.minZ + PEN.maxZ) / 2;
    const hay = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), std('#ffffff', { roughness: 1, map: canvasTex(256, 256, (g, w) => {
      g.fillStyle = '#e8d08a'; g.fillRect(0, 0, w, w);
      for (let i = 0; i < 500; i++) { g.strokeStyle = i % 3 ? '#d4b46a' : '#f4e2a8'; g.lineWidth = 2; const x = (i * 71) % w, y = (i * 37) % w, a = i * 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); }
    }, [2, 1]) }));
    hay.rotation.x = -Math.PI / 2; hay.position.set(cx, 0.008, cz); group.add(hay);
    const fenceM = std('#fffaf2', { roughness: 0.6 });
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.2));
      for (let i = 0; i <= n; i++) group.add(at(rbox(0.05, 0.46, 0.05, 0.02, fenceM), x0 + (x1 - x0) * i / n, 0.23, z0 + (z1 - z0) * i / n));
      const rail = at(box(len, 0.05, 0.04, fenceM), (x0 + x1) / 2, 0.4, (z0 + z1) / 2); rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0); group.add(rail);
      const rail2 = rail.clone(); rail2.position.y = 0.15; group.add(rail2);
    };
    fence(PEN.minX, PEN.maxZ, PEN.maxX, PEN.maxZ);
    fence(PEN.minX, PEN.minZ, PEN.minX, PEN.maxZ);
    colliders.push({ type: 'box', fixed: true, minX: PEN.minX - 0.05, maxX: PEN.maxX, minZ: PEN.minZ, maxZ: PEN.maxZ + 0.05 });
    // the hutch: a little wooden house with a red roof
    const hx = PEN.maxX - 0.5, hz = PEN.minZ + 0.45;
    group.add(at(rbox(0.8, 0.45, 0.6, 0.03, std('#e8c9a0', { roughness: 0.7 })), hx, 0.25, hz));
    for (const s of [-1, 1]) { const roof = at(box(0.5, 0.04, 0.72, std('#d4678a', { roughness: 0.6 })), hx + s * 0.2, 0.58, hz); roof.rotation.z = -s * 0.5; group.add(roof); }
    group.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.14, 20, 0, Math.PI), std('#5a3e36', { roughness: 1 })), hx - 0.1, 0.03, hz + 0.302));
    // a water bottle on the fence, a carrot bowl
    group.add(at(cyl(0.035, 0.035, 0.2, std('#bfe6ff', { transparent: true, opacity: 0.7, roughness: 0.1 })), PEN.minX + 0.6, 0.45, PEN.maxZ - 0.04));
    group.add(at(cyl(0.12, 0.09, 0.06, std('#f2a7bb', { roughness: 0.5 })), PEN.minX + 0.7, 0.03, PEN.maxZ - 0.5));
    for (let i = 0; i < 3; i++) { const c = at(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.1, 8), std('#ff8a3a', { roughness: 0.6 })), PEN.minX + 0.66 + i * 0.04, 0.07, PEN.maxZ - 0.5); c.rotation.z = Math.PI / 2 + i * 0.4; group.add(c); }
  }

  // ── food bowls, yarn balls, a feather wand
  for (const [x, c] of [[-5.2, '#a8d0c8'], [-4.8, '#f2a7bb']]) {
    group.add(at(cyl(0.14, 0.1, 0.07, std(c, { roughness: 0.5 })), x, 0.035, 1.8));
    group.add(at(cyl(0.11, 0.11, 0.01, std(c === '#a8d0c8' ? '#bfe6ff' : '#b07a4a', { roughness: 0.4 })), x, 0.065, 1.8));
  }
  for (const [x, z, c] of [[0.4, -0.6, '#ff8ac0'], [-3.6, 1.6, '#8ac0ff'], [2.6, 0.2, '#ffd23f']]) {
    const y = at(ball(0.07, std(c, { roughness: 1 }), 14), x, 0.07, z); group.add(y);
    const strand = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 6, 20), std(c)); strand.position.copy(y.position); strand.rotation.set(0.7, 0.3, 0); group.add(strand);
  }
  {
    const wand = at(cyl(0.008, 0.008, 0.9, std('#c9a27e'), 6), -5.6, 0.45, 0.4); wand.rotation.z = 0.25; group.add(wand);
    for (let i = 0; i < 3; i++) { const f = at(ball(0.04, std(['#ff8ac0', '#8ac0ff', '#ffd23f'][i], { roughness: 1 }), 8), -5.5 + i * 0.03, 0.9 + i * 0.02, 0.4); f.scale.set(0.4, 1.6, 0.4); f.rotation.z = -0.5 + i * 0.4; group.add(f); }
  }

  // ── the counter by the west wall: the treats jar and the menu board above it
  {
    group.add(at(rbox(0.6, 0.95, 1.8, 0.03, std('#f4ece0', { roughness: 0.7 })), R.minX + 0.35, 0.475, -1.0));
    group.add(at(rbox(0.66, 0.05, 1.86, 0.02, wood), R.minX + 0.35, 0.97, -1.0));
    block(R.minX + 0.35, -1.0, 0.6, 1.8);
    const jar = new THREE.Group(); jar.position.set(R.minX + 0.4, 0.995, -1.3);
    jar.add(at(cyl(0.11, 0.11, 0.24, std('#e8f6ff', { transparent: true, opacity: 0.55, roughness: 0.05 }), 20), 0, 0.12, 0));
    jar.add(at(cyl(0.115, 0.115, 0.05, std('#d4678a', { roughness: 0.5 }), 20), 0, 0.265, 0));
    jar.add(at(ball(0.03, std('#d4678a'), 10), 0, 0.3, 0));
    for (let i = 0; i < 10; i++) { const tr = at(ball(0.025, std(i % 2 ? '#e8a64a' : '#ff8a3a', { roughness: 0.7 }), 8), Math.cos(i) * 0.06, 0.03 + (i % 4) * 0.04, Math.sin(i * 2) * 0.06); tr.scale.set(1.3, 0.7, 0.8); jar.add(tr); }
    group.add(jar);
    clickable(jar, { kind: 'pet-treats', label: 'The treats jar 🐟🥕' });
    const kettle = at(cyl(0.08, 0.1, 0.16, std('#a8d0c8', { roughness: 0.4 })), R.minX + 0.4, 1.075, -0.5); group.add(kettle);
    const menu = makeSign([
      { text: 'The Pet Café', size: 96, weight: '700', color: '#d4678a' },
      { text: 'cat latte · bunny matcha', size: 50 },
      { text: 'paw-print cookies · hay & carrots', size: 50 },
      { text: 'please be gentle 🐾', font: 'Dancing Script, cursive', size: 60, color: '#8a5a3a' },
    ], 1.4, 0.9, { bg: '#2f3a34', border: '#c9a27e' });
    menu.position.set(R.minX + 0.04, 1.95, -1.0); menu.rotation.y = Math.PI / 2; group.add(menu);
  }
  const sign = makeSign([{ text: 'The Pet Café', size: 130, weight: '700', color: '#d4678a' }, { text: 'Mishmish · Luna · Simsim · Kiki · Qamar · Bondo', font: 'Dancing Script, cursive', size: 54, color: '#8a5a3a' }], 2.2, 0.5, { bg: '#fffaf2', border: '#e9b8a8' });
  sign.position.set(2.0, 2.65, R.minZ + 0.04); group.add(sign);
  plant(group, colliders, R.minX + 0.5, R.maxZ - 0.6, 0.9);
  plant(group, colliders, R.maxX - 0.5, R.maxZ - 0.6, 0.9);
  const lights = [pendant(group, R, -2.0, 0.4, { light: '#ffd9b0', intensity: 2.2 }), pendant(group, R, 1.0, 2.0, { light: '#ffd9b0', intensity: 2.2 }), pendant(group, R, 3.6, -2.2, { light: '#ffe6c0', intensity: 1.8 })];
  doorOut({ group, R, makeSign, interactables, color: '#e9b8a8', to: 'landing4', sign: '⬅ The landing', label: 'Back out to the landing' });

  // ── the pets and their day: where each one likes to be, and what it does there
  const TOP = 1.86; // (the cat tree's top platform)
  const ROUTINE = {
    mishmish: [{ x: TREE.x - 0.3, y: TOP, z: TREE.z - 0.3, s: 'nap' }, { x: -1.0, y: 0, z: 1.4, s: 'sit' }, { x: WIN.x - 0.05, y: 0.53, z: WIN.z - 0.4, s: 'nap' }, { x: -5.0, y: 0, z: 1.55, s: 'groom' }],
    luna: [{ x: -0.6, y: 1.83, z: SHELF_Z, s: 'sit' }, { x: WIN.x - 0.05, y: 0.53, z: WIN.z + 0.4, s: 'nap' }, { x: 0.3, y: 0, z: 3.4, s: 'groom' }, { x: -3.4, y: 0, z: 0.8, s: 'sit' }],
    simsim: [{ x: 2.6, y: 0, z: 0.6, s: 'groom' }, { x: TREE.x + 0.25, y: 0.76, z: TREE.z, s: 'nap' }, { x: -1.5, y: 0, z: 2.6, s: 'sit' }, { x: 0.4, y: 1.38, z: SHELF_Z, s: 'sit' }],
    kiki: [{ x: -0.2, y: 0, z: -0.3, s: 'sit' }, { x: -4.4, y: 0, z: 2.2, s: 'nap' }, { x: TREE.x - 0.05, y: 1.31, z: TREE.z + 0.15, s: 'groom' }, { x: 3.2, y: 0, z: 2.6, s: 'sit' }],
    qamar: [{ x: 2.8, y: 0, z: -3.4, s: 'sit' }, { x: 4.6, y: 0, z: -3.6, s: 'groom' }, { x: 3.1, y: 0, z: -4.4, s: 'nap' }, { x: 5.2, y: 0, z: -3.3, s: 'sit' }],
    bondo: [{ x: 5.0, y: 0, z: -4.2, s: 'nap' }, { x: 3.4, y: 0, z: -3.6, s: 'sit' }, { x: 2.7, y: 0, z: -4.5, s: 'groom' }, { x: 4.2, y: 0, z: -3.3, s: 'sit' }],
  };
  // each pet's day as a loop of "stay a while" and "walk on to the next spot" legs
  const plan = id => {
    const pts = ROUTINE[id], legs = [];
    let seed = [...id].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) % 997;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      legs.push({ stay: true, a, d: (a.s === 'nap' ? 40 : 18) + rnd() * 16 });
      legs.push({ stay: false, a, b, d: Math.hypot(b.x - a.x, b.z - a.z) / 0.45 + 1.5 });
    }
    return { legs, period: legs.reduce((n, l) => n + l.d, 0), phase: rnd() * 300 };
  };
  const pets = new Map();
  for (const p of PETS) {
    const m = p.kind === 'cat' ? makeCat(p.coat) : makeBunny(p.color);
    m.group.scale.setScalar(p.kind === 'cat' ? 1.25 : 1.2);
    group.add(m.group);
    const hit = ball(0.3, new THREE.MeshBasicMaterial({ visible: false }), 8);
    hit.position.y = 0.2; m.group.add(hit);
    hit.userData = { kind: 'pet', pet: p.id, label: p.kind === 'cat' ? 'A cat' : 'A bunny' };
    interactables.push(hit);
    pets.set(p.id, { ...p, m, hit, plan: plan(p.id), x: 0, y: 0, z: 0, ry: 0, state: 'sit', pettedUntil: 0, tag: null, come: null });
  }
  // where a pet would be by its timetable, at time t (seconds)
  const scheduled = (pt, t) => {
    let tt = (t + pt.plan.phase) % pt.plan.period;
    for (const l of pt.plan.legs) {
      if (tt < l.d) {
        if (l.stay) return { x: l.a.x, y: l.a.y, z: l.a.z, s: l.a.s, ry: null };
        const k = tt / l.d, e = k * k * (3 - 2 * k);
        const x = l.a.x + (l.b.x - l.a.x) * e, z = l.a.z + (l.b.z - l.a.z) * e;
        // a jump up or down: the height changes in the first / last bit of the walk
        const y = l.b.y > l.a.y ? (k > 0.8 ? l.a.y + (l.b.y - l.a.y) * Math.sin((k - 0.8) / 0.2 * Math.PI / 2) : l.a.y)
          : l.b.y < l.a.y ? (k < 0.2 ? l.a.y + (l.b.y - l.a.y) * Math.sin(k / 0.2 * Math.PI / 2) : l.b.y) : l.a.y;
        return { x, y, z, s: 'walk', ry: Math.atan2(l.b.x - l.a.x, l.b.z - l.a.z) };
      }
      tt -= l.d;
    }
    return { x: pt.plan.legs[0].a.x, y: pt.plan.legs[0].a.y, z: pt.plan.legs[0].a.z, s: 'sit', ry: null };
  };
  const clampIn = (x, z, bunny) => (bunny
    ? [Math.max(PEN.minX + 0.3, Math.min(PEN.maxX - 0.3, x)), Math.max(PEN.minZ + 0.3, Math.min(PEN.maxZ - 0.3, z))]
    : [Math.max(R.minX + 0.4, Math.min(R.maxX - 0.4, x)), Math.max(R.minZ + 0.4, Math.min(R.maxZ - 0.4, z))]);
  const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

  let first = true;
  animate?.((dt, t) => {
    const now = Date.now() / 1000;
    for (const pt of pets.values()) {
      const sch = scheduled(pt, now);
      let tx = sch.x, ty = sch.y, tz = sch.z, state = sch.s, face = sch.ry;
      const c = pt.come;
      if (c) {
        if (c.phase === 'go') {
          const dx = c.x - pt.x, dz = c.z - pt.z, d = Math.hypot(dx, dz);
          if (d < 0.05) { c.phase = 'stay'; c.until = now + 20; }
          const step = Math.min(d, dt * 0.8);
          tx = pt.x + (d ? dx / d * step : 0); tz = pt.z + (d ? dz / d * step : 0); ty = 0;
          state = d < 0.05 ? 'sit' : 'walk'; face = Math.atan2(dx, dz);
        } else if (c.phase === 'stay') {
          tx = c.x; tz = c.z; ty = 0; state = 'sit'; face = Math.atan2(c.lookX - c.x, c.lookZ - c.z);
          if (now > c.until) c.phase = 'back';
        } else { // back to its routine: walk to wherever the timetable says it should be
          const dx = sch.x - pt.x, dz = sch.z - pt.z, d = Math.hypot(dx, dz);
          if (d < 0.1) pt.come = null;
          const step = Math.min(d, dt * 0.8);
          tx = pt.x + (d ? dx / d * step : 0); tz = pt.z + (d ? dz / d * step : 0); ty = pt.y + (sch.y - pt.y) * Math.min(1, dt * 2);
          state = d < 0.1 ? sch.s : 'walk'; face = Math.atan2(dx, dz);
        }
      }
      if (first || !c) { pt.x = tx; pt.z = tz; } else { pt.x = tx; pt.z = tz; }
      pt.y = first ? ty : pt.y + (ty - pt.y) * Math.min(1, dt * (c ? 4 : 6));
      if (face !== null) pt.ry = first ? face : lerpAng(pt.ry, face, Math.min(1, dt * 6));
      pt.state = state;
      pt.m.group.position.set(pt.x, pt.y, pt.z);
      pt.m.group.rotation.y = pt.ry;
      const petted = now < pt.pettedUntil;
      pt.m.pose(petted ? (state === 'walk' ? 'sit' : state === 'nap' ? 'sit' : state) : state, t, petted);
    }
    first = false;
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R, pets: PETS,
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
    // { petId: name } — a little tag floats over every pet with a name
    setNames(map = {}) {
      for (const pt of pets.values()) {
        const name = map[pt.id] || null;
        if (pt.tag) { pt.m.group.remove(pt.tag); pt.tag.material.map.dispose(); pt.tag.material.dispose(); pt.tag = null; }
        if (name) { pt.tag = nameTag(name); pt.tag.position.y = pt.kind === 'cat' ? 0.5 : 0.52; pt.m.group.add(pt.tag); }
        pt.hit.userData.label = name ? `${name} the ${pt.kind === 'cat' ? 'cat' : 'bunny'}` : pt.kind === 'cat' ? 'A cat' : 'A bunny';
        pt.hit.userData.name = name;
      }
    },
    pet(id) { const pt = pets.get(id); if (pt) pt.pettedUntil = Date.now() / 1000 + 2.5; },
    // a pet that knows you trots over to (x, z) and sits looking up at you for a while
    comeTo(id, x, z) {
      const pt = pets.get(id); if (!pt) return;
      const dx = x - pt.x, dz = z - pt.z, d = Math.hypot(dx, dz) || 1;
      const k = Math.max(0, d - 0.5) / d;
      const [cx, cz] = clampIn(pt.x + dx * k, pt.z + dz * k, pt.kind === 'bunny');
      pt.come = { phase: 'go', x: cx, z: cz, lookX: x, lookZ: z, until: 0 };
    },
    where(id) { const pt = pets.get(id); return pt ? { x: pt.x, z: pt.z } : null; },
  };
}
