// The Kitchen: the baking class on the second floor, off the landing. An open
// kitchen with a big island of mixing stations, ovens along the back wall, a
// rack of trays cooling, jars of semolina and pistachios and rice flour, and
// a recipe board. Take a station and bake konafa, basbousa or sakura mochi a
// step at a time (app.js); what comes out goes on the snack shelf in your flat.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, shell, doorOut, plant, pendant } from './roomkit.js';

export const BAKERY = { minX: -7, maxX: 7, minZ: -5, maxZ: 5, h: 3.3 };
const R = BAKERY;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

function tilesTex() {
  return canvasTex(256, 256, (g, w) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#f4ece0' : '#2f5d6e'; g.fillRect(i * 32, j * 32, 32, 32); }
  }, [(R.maxX - R.minX) / 1.6, (R.maxZ - R.minZ) / 1.6]);
}

export function buildBakery({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: tilesTex(),
    wallColor: '#fbf3ea', lowColor: '#e8c98e', windows: { west: [-1.8, 1.8] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const steel = std('#c0c4c8', { metalness: 0.7, roughness: 0.3 });
  const wood = std('#8a5a3c', { roughness: 0.55 });

  // ── the ovens and counters along the back (north) wall
  const ovenGlow = [];
  {
    group.add(at(box(R.maxX - R.minX - 0.4, 0.9, 0.65, std('#f4ece0', { roughness: 0.6 })), 0, 0.45, R.minZ + 0.33));
    group.add(at(box(R.maxX - R.minX - 0.4, 0.05, 0.7, std('#e8dccb', { roughness: 0.3 })), 0, 0.92, R.minZ + 0.35));
    block(0, R.minZ + 0.33, R.maxX - R.minX - 0.4, 0.66);
    [-3.6, -1.2, 1.2, 3.6].forEach(x => {
      group.add(at(rbox(1.1, 1.0, 0.6, 0.04, steel), x, 1.45, R.minZ + 0.32));
      const win = at(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), std('#3a2418', { emissive: '#ff8a3a', emissiveIntensity: 0.15 })), x, 1.4, R.minZ + 0.625);
      group.add(win); ovenGlow.push(win.material);
      group.add(at(box(0.8, 0.04, 0.04, std('#333')), x, 1.75, R.minZ + 0.64));
      for (let k = 0; k < 3; k++) group.add(at(cyl(0.03, 0.03, 0.03, std('#222'), 10).rotateX(Math.PI / 2), x - 0.3 + k * 0.3, 1.88, R.minZ + 0.63));
    });
    // shelves of jars above
    const JAR = ['#e8c98e', '#9fd08a', '#fff6e6', '#d4678a', '#c98a4a', '#f4f0e8'];
    for (let i = 0; i < 12; i++) {
      const x = -5.6 + i * 1.0;
      group.add(at(cyl(0.1, 0.1, 0.24, std('#e8f2f4', { transparent: true, opacity: 0.45, roughness: 0.05 }), 14), x, 2.38, R.minZ + 0.2));
      group.add(at(cyl(0.085, 0.085, 0.15, std(JAR[i % JAR.length], { roughness: 0.9 }), 14), x, 2.33, R.minZ + 0.2));
      group.add(at(cyl(0.105, 0.105, 0.04, wood, 14), x, 2.52, R.minZ + 0.2));
    }
    group.add(at(box(R.maxX - R.minX - 0.6, 0.05, 0.32, wood), 0, 2.24, R.minZ + 0.17));
  }

  // ── the island: four baking stations, bowls, rolling pins, a tray each
  const stations = [];
  {
    const W = 6.0, D = 1.5, z = -0.6;
    group.add(at(rbox(W, 0.88, D, 0.04, std('#2f5d6e', { roughness: 0.6 })), 0, 0.44, z));
    group.add(at(rbox(W + 0.1, 0.06, D + 0.1, 0.02, std('#f4f0e8', { roughness: 0.25 })), 0, 0.91, z));
    block(0, z, W + 0.1, D + 0.1);
    const BOWL = ['#f2a7bb', '#93ab8c', '#9fb8d6', '#e8c98e'];
    [-2.2, -0.75, 0.75, 2.2].forEach((x, i) => {
      for (const side of [-1, 1]) {
        const sz = z + side * 0.4;
        const bowl = at(cyl(0.18, 0.11, 0.14, std(BOWL[(i + (side > 0 ? 1 : 0)) % 4], { roughness: 0.4 }), 20), x - 0.25, 1.01, sz);
        group.add(bowl);
        const pin = at(cyl(0.03, 0.03, 0.42, wood, 10).rotateZ(Math.PI / 2), x + 0.2, 0.97, sz);
        group.add(pin);
        group.add(at(box(0.34, 0.02, 0.24, steel), x + 0.25, 0.95, sz - side * 0.05));
      }
      // the station itself: what you click to bake
      const hit = at(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, D + 0.2), new THREE.MeshBasicMaterial({ visible: false })), x, 1.05, z);
      group.add(hit);
      clickable(hit, { kind: 'bake', label: 'A baking station — bake konafa, basbousa or sakura mochi 🍰' });
      stations.push({ x, z });
    });
    const sign = makeSign([{ text: 'Baking class', size: 110, weight: '700' }, { text: 'konafa · basbousa · sakura mochi', size: 60 }], 1.5, 0.4, { bg: '#fbe3ea' });
    sign.position.set(0, 2.25, z); group.add(sign);
    group.add(at(cyl(0.008, 0.008, 1.0, std('#333'), 6), -0.7, 2.85, z));
    group.add(at(cyl(0.008, 0.008, 1.0, std('#333'), 6), 0.7, 2.85, z));
  }

  // ── a cooling rack of finished trays, and a recipe board
  {
    const x = R.maxX - 0.5, z = 1.6;
    const g = new THREE.Group();
    for (const a of [-1, 1]) for (const b of [-1, 1]) g.add(at(box(0.04, 1.8, 0.04, steel), a * 0.3, 0.9, b * 0.5));
    const TRAY = [['#c98a4a', '#e8c98e'], ['#e2b04a', '#f4ece0'], ['#f6d8e0', '#ffffff'], ['#d9a25a', '#9fd08a']];
    for (let i = 0; i < 6; i++) {
      g.add(at(box(0.56, 0.02, 0.96, steel), 0, 0.3 + i * 0.26, 0));
      const [c1, c2] = TRAY[i % TRAY.length];
      for (let k = 0; k < 6; k++) g.add(at(rbox(0.14, 0.05, 0.14, 0.02, std(k % 2 ? c1 : c2, { roughness: 0.8 })), -0.16 + (k % 3) * 0.16, 0.34 + i * 0.26, -0.3 + Math.floor(k / 3) * 0.55));
    }
    g.position.set(x, 0, z); group.add(g);
    block(x, z, 0.65, 1.05);
    clickable(g, { kind: 'bake-rack', label: 'The cooling rack' });
    const board = makeSign([
      { text: '📋 Today’s recipes', size: 96, weight: '700' },
      { text: 'Konafa — butter, kataifi, cream', size: 58 },
      { text: 'Basbousa — semolina, syrup', size: 58 },
      { text: 'Sakura mochi — rice, red bean', size: 58 },
      { text: 'Wash your hands first! 🧼', size: 58 },
    ], 1.1, 0.85, { bg: '#fbf3ea', border: '#7a4e33' });
    board.position.set(R.maxX - 0.03, 1.7, -2.4); board.rotation.y = -Math.PI / 2;
    group.add(board);
  }
  // stools along the south side of the island, for watching
  [-2.2, -0.75, 0.75, 2.2].forEach((x, i) => {
    const s = new THREE.Group();
    s.add(at(cyl(0.2, 0.2, 0.06, std('#f2a7bb', { roughness: 0.9 }), 18), 0, 0.68, 0));
    s.add(at(cyl(0.03, 0.03, 0.66, steel, 8), 0, 0.33, 0));
    s.add(at(cyl(0.18, 0.18, 0.02, steel, 16), 0, 0.01, 0));
    s.position.set(x, 0, 0.75); group.add(s);
    const seat = { id: `bakery-stool-${i}`, label: 'a stool at the island', x, z: 0.8, y: group.position.y, h: 0.7, ry: Math.PI };
    seats.push(seat);
    clickable(s, { kind: 'seat', seat, label: 'Sit at the island' });
  });
  const name = makeSign([{ text: 'The Kitchen', size: 120, weight: '700' }, { text: 'bake something sweet 🍰', font: 'Dancing Script, cursive', size: 76, color: '#c4627f' }], 1.6, 0.44, { bg: '#fbe3ea' });
  name.position.set(-3.6, 2.85, R.maxZ - 0.03); name.rotation.y = Math.PI; group.add(name);
  plant(group, colliders, R.minX + 0.45, R.maxZ - 0.45, 1.0);
  plant(group, colliders, R.maxX - 0.45, R.maxZ - 0.45, 1.0);
  const lights = [pendant(group, R, -2.0, -0.6, { intensity: 2.6 }), pendant(group, R, 2.0, -0.6, { intensity: 2.6 }), pendant(group, R, 0, 3.0, { intensity: 1.8 })];
  doorOut({ group, R, makeSign, interactables, color: '#e8c98e', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  // the ovens glow while something's baking
  let baking = 0;
  animate?.((dt, t) => { for (const m of ovenGlow) m.emissiveIntensity += ((baking > 0 ? 0.9 + Math.sin(t * 6) * 0.1 : 0.15) - m.emissiveIntensity) * Math.min(1, dt * 3); if (baking > 0) baking -= dt; });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.6, ry: Math.PI },
    bake(seconds = 4) { baking = seconds; },
  };
}
