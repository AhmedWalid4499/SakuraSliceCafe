// The Laundry Room: every building has one. A row of washing machines and a
// row of dryers (click one and it fills, sloshes and spins — everyone in the
// room sees it go; app.js), a folding table with baskets of washing, a shelf
// of soap powder, a clothes horse, and the lost-socks board.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, shell, doorOut, plant, pendant } from './roomkit.js';

export const LAUNDRY = { minX: -6, maxX: 6, minZ: -4, maxZ: 4, h: 3.2 };
const R = LAUNDRY;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const CLOTHES = ['#f2a7bb', '#9fb8d6', '#93ab8c', '#e8c98e', '#fffaf4', '#c9a0d6'];

function lino() {
  return canvasTex(256, 256, (g, w) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#e3eef0' : '#cfe0e4'; g.fillRect(i * 32, j * 32, 32, 32); }
  }, [(R.maxX - R.minX) / 1.2, (R.maxZ - R.minZ) / 1.2]);
}
// a drum's window: suds and clothes, turned as it spins
function drumTex(colors) {
  return canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#cfe6f5'; g.fillRect(0, 0, w, w);
    colors.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.ellipse(30 + (i * 37) % 70, 50 + (i * 23) % 50, 26, 14, i, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc((i * 47) % 128, (i * 29) % 40 + 6, 5 + (i % 3) * 3, 0, Math.PI * 2); g.fill(); }
  });
}

export function buildLaundry({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: lino(), wallColor: '#f4f7f6', lowColor: '#9fb8d6', windows: { east: [0] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const white = std('#fbfbf8', { roughness: 0.35 }), steel = std('#c0c4c8', { metalness: 0.7, roughness: 0.3 });

  // ── the machines along the north wall: four washers, then three dryers stacked on a shelf
  const machines = [];
  const machine = (x, y, kind, i) => {
    const g = new THREE.Group();
    g.add(at(rbox(0.66, 0.82, 0.62, 0.04, white), 0, 0.41, 0));
    g.add(at(box(0.6, 0.1, 0.02, std('#e3e6e8')), 0, 0.74, 0.31));
    for (let k = 0; k < 3; k++) g.add(at(cyl(0.025, 0.025, 0.02, std(k ? '#9fb8d6' : '#c4627f'), 10).rotateX(Math.PI / 2), -0.2 + k * 0.08, 0.74, 0.325));
    const light = at(new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), new THREE.MeshBasicMaterial({ color: '#555' })), 0.22, 0.74, 0.325);
    g.add(light);
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 28), steel), 0, 0.38, 0.31));
    const drum = at(new THREE.Mesh(new THREE.CircleGeometry(0.19, 28), new THREE.MeshStandardMaterial({ map: drumTex(kind === 'wash' ? CLOTHES.slice(i % 3, i % 3 + 3) : CLOTHES.slice(3)), roughness: 0.2 })), 0, 0.38, 0.312);
    g.add(drum);
    g.position.set(x, y, R.minZ + 0.33); group.add(g);
    const m = { g, drum, light, kind, left: 0, x, y };
    machines.push(m);
    clickable(g, { kind: 'laundry-machine', index: machines.length - 1, label: kind === 'wash' ? 'A washing machine — put a wash on 🧺' : 'A dryer — dry your washing' });
    return m;
  };
  [-4.8, -4.05, -3.3, -2.55].forEach((x, i) => machine(x, 0, 'wash', i));
  block(-3.675, R.minZ + 0.33, 3.0, 0.64);
  group.add(at(box(2.3, 0.05, 0.66, steel), -0.5, 0.84, R.minZ + 0.33));
  [-1.25, -0.5, 0.25].forEach((x, i) => machine(x, 0.86, 'dry', i));
  group.add(at(box(2.3, 0.84, 0.64, std('#e3e6e8', { roughness: 0.6 })), -0.5, 0.42, R.minZ + 0.33)); // the cupboard under the dryers
  block(-0.5, R.minZ + 0.33, 2.3, 0.64);

  // ── the folding table, baskets of washing, the soap shelf, a clothes horse
  {
    const x = 1.8, z = 0.6;
    group.add(at(rbox(2.0, 0.05, 0.8, 0.02, std('#e8dccb', { roughness: 0.5 })), x, 0.88, z));
    for (const a of [-1, 1]) for (const b of [-1, 1]) group.add(at(box(0.05, 0.86, 0.05, steel), x + a * 0.92, 0.43, z + b * 0.34));
    block(x, z, 2.0, 0.8);
    for (let i = 0; i < 5; i++) group.add(at(rbox(0.32, 0.04 + (i % 2) * 0.02, 0.26, 0.02, std(CLOTHES[i], { roughness: 1 })), x - 0.6 + (i % 3) * 0.4, 0.93 + Math.floor(i / 3) * 0.06, z - 0.1 + Math.floor(i / 3) * 0.2));
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.8), new THREE.MeshBasicMaterial({ visible: false })), x, 1.0, z);
    group.add(hit);
    clickable(hit, { kind: 'laundry-fold', label: 'The folding table' });
  }
  for (const [x, z, c] of [[-4.6, 1.4, '#c98a4a'], [-3.6, 1.8, '#9fb8d6']]) {
    const b = new THREE.Group();
    b.add(at(cyl(0.3, 0.24, 0.4, std(c, { roughness: 0.9 }), 18, 1, true), 0, 0.2, 0));
    for (let i = 0; i < 4; i++) b.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), std(CLOTHES[(i + 2) % 6], { roughness: 1 })), Math.cos(i * 1.6) * 0.12, 0.38, Math.sin(i * 1.6) * 0.12));
    b.position.set(x, 0, z); group.add(b);
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.32 });
    clickable(b, { kind: 'laundry-basket', label: 'A basket of washing' });
  }
  {
    const x = R.maxX - 0.3, z = -2.4;
    group.add(at(box(0.3, 0.04, 1.4, std('#8a5a3c')), x, 1.5, z));
    for (let i = 0; i < 5; i++) group.add(at(rbox(0.2, 0.3, 0.14, 0.03, std(['#5f8fc4', '#e58aa6', '#fffaf4', '#e2b04a', '#93ab8c'][i], { roughness: 0.6 })), x, 1.67, z - 0.56 + i * 0.28));
    // a clothes horse by the window
    const ch = new THREE.Group();
    for (const s of [-1, 1]) ch.add(at(box(0.03, 1.2, 0.03, steel).rotateX(s * 0.25), 0, 0.58, s * 0.15));
    for (let i = 0; i < 3; i++) ch.add(at(box(0.9, 0.02, 0.02, steel), 0, 0.6 + i * 0.25, 0));
    for (let i = 0; i < 4; i++) ch.add(at(box(0.18, 0.3, 0.01, std(CLOTHES[i], { roughness: 1 })), -0.3 + i * 0.2, 0.92, 0.01));
    ch.position.set(R.maxX - 0.9, 0, 1.8); ch.rotation.y = Math.PI / 2; group.add(ch);
    block(R.maxX - 0.9, 1.8, 0.4, 1.0);
  }
  // the lost-socks board, and the name
  const socks = makeSign([
    { text: '🧦 Lost socks', size: 100, weight: '700' },
    { text: 'one blue, stripy — Room 07?', size: 56 },
    { text: 'one pink, with a cat on', size: 56 },
    { text: 'one very small (whose?!)', size: 56 },
  ], 0.95, 0.66, { bg: '#fffaf4', border: '#7a4e33' });
  socks.position.set(3.6, 1.6, R.minZ + 0.03); group.add(socks);
  const name = makeSign([{ text: 'The Laundry Room', size: 110, weight: '700' }, { text: 'wash · dry · fold · repeat 🧺', font: 'Dancing Script, cursive', size: 66, color: '#c4627f' }], 1.6, 0.42, { bg: '#e3eef0' });
  name.position.set(-2.4, 2.65, R.minZ + 0.03); group.add(name);
  // a bench to wait on
  {
    const b = new THREE.Group();
    b.add(at(rbox(1.4, 0.06, 0.4, 0.02, std('#8a5a3c', { roughness: 0.6 })), 0, 0.45, 0));
    for (const s of [-1, 1]) b.add(at(box(0.06, 0.45, 0.36, steel), s * 0.62, 0.22, 0));
    b.position.set(-2.8, 0, R.maxZ - 0.5); b.rotation.y = Math.PI; group.add(b);
    block(-2.8, R.maxZ - 0.5, 1.4, 0.42);
    [-3.2, -2.4].forEach((x, i) => {
      const s = { id: `laundry-bench-${i}`, label: 'the bench, waiting for your washing', x, z: R.maxZ - 0.55, y: group.position.y, h: 0.48, ry: Math.PI };
      seats.push(s);
      if (!i) clickable(b, { kind: 'seat', seat: s, label: 'Sit and watch the machines go round' });
    });
  }
  plant(group, colliders, R.maxX - 0.45, R.maxZ - 0.45, 0.9);
  const lights = [pendant(group, R, -3, 0, { intensity: 2.4, color: '#f4fbff', light: '#f0f6ff' }), pendant(group, R, 2, 0, { intensity: 2.2, color: '#f4fbff', light: '#f0f6ff' })];
  doorOut({ group, R, makeSign, interactables, color: '#9fb8d6', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  // the machines: their drums turn and they shake a little while they run
  animate?.((dt, t) => {
    for (const m of machines) {
      if (m.left > 0) {
        m.left -= dt;
        m.drum.rotation.z += dt * (m.left < 3 ? 14 : 4);
        m.g.position.x = m.x + (m.left < 3 ? Math.sin(t * 60) * 0.006 : 0);
        m.light.material.color.set(Math.sin(t * 4) > 0 ? '#3fd08a' : '#1f6a45');
        if (m.left <= 0) { m.left = 0; m.g.position.x = m.x; m.light.material.color.set('#555'); m.onDone?.(); }
      }
    }
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.4, ry: Math.PI },
    // start a machine (for `seconds`); onDone when it stops. Returns false if it's already going.
    run(i, seconds, onDone) {
      const m = machines[i];
      if (!m || m.left > 0) return false;
      m.left = seconds; m.onDone = onDone;
      return true;
    },
    machineAt(i) { const m = machines[i]; return m ? new THREE.Vector3(m.x, group.position.y + m.y + 0.4, R.minZ + 0.4) : null; },
    kindOf(i) { return machines[i] && machines[i].kind; },
  };
}
