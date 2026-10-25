// The Gym and Yoga Studio: on the second floor, off the landing. One half is
// the gym — treadmills and exercise bikes (step on and you run, or pedal;
// everyone sees you go), a rack of dumbbells, a water cooler — and the other
// half the yoga studio: mats on a soft floor, plants, and a mirror wall that
// really reflects. Sit on a mat for a calm, guided stretch (app.js).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { std, rbox, box, at, plankTex, shell, doorOut, plant, pendant } from './roomkit.js';

export const GYM = { minX: -8, maxX: 8, minZ: -5, maxZ: 5, h: 3.4 };
const R = GYM;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

export function buildGym({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [176, 140, 104], 5),
    wallColor: '#eef4f0', lowColor: '#93ab8c', windows: { east: [-2.2, 2.2] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const dark = std('#2a2d33', { roughness: 0.5 }), steel = std('#c0c4c8', { metalness: 0.7, roughness: 0.3 });

  // ── the gym (west half): a rubber floor, treadmills facing the wall, bikes
  const rubber = new THREE.Mesh(new THREE.PlaneGeometry(7.6, R.maxZ - R.minZ), std('#3a3d44', { roughness: 1 }));
  rubber.rotation.x = -Math.PI / 2; rubber.position.set(R.minX + 3.8, 0.005, 0); group.add(rubber);
  const belts = [];
  [-5.8, -3.8, -1.8].forEach((x, i) => {
    const z = R.minZ + 1.3;
    const g = new THREE.Group();
    g.add(at(rbox(0.8, 0.16, 1.9, 0.04, dark), 0, 0.08, 0));
    const belt = at(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.7), std('#18191c', { roughness: 1 })), 0, 0.165, 0.05);
    belt.rotation.x = -Math.PI / 2; g.add(belt); belts.push(belt);
    for (const s of [-1, 1]) g.add(at(box(0.05, 1.15, 0.05, steel), s * 0.36, 0.7, -0.85));
    g.add(at(box(0.8, 0.05, 0.05, steel), 0, 1.25, -0.85));
    g.add(at(rbox(0.6, 0.32, 0.12, 0.03, dark), 0, 1.35, -0.9));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.2), std('#0f1a14', { emissive: '#3fd08a', emissiveIntensity: 0.6 })), 0, 1.36, -0.835));
    g.position.set(x, 0, z); group.add(g);
    block(x, z - 0.85, 0.85, 0.2);
    const seat = { id: `gym-tread-${i}`, label: 'a treadmill', x, z: z + 0.2, y: fy + 0.17, h: 0, ry: Math.PI, run: true };
    seats.push(seat);
    clickable(g, { kind: 'gym-run', seat, label: 'A treadmill — step on and run 🏃' });
  });
  const wheels = [];
  [-5.6, -3.4].forEach((x, i) => {
    const z = 0.8;
    const g = new THREE.Group();
    g.add(at(box(0.12, 0.1, 1.1, dark), 0, 0.05, 0));
    g.add(at(box(0.08, 0.75, 0.08, steel).rotateX(-0.25), 0, 0.45, 0.2));
    g.add(at(rbox(0.26, 0.07, 0.34, 0.03, std('#c4627f', { roughness: 0.9 })), 0, 0.82, 0.25));
    g.add(at(box(0.08, 0.9, 0.08, steel).rotateX(0.2), 0, 0.5, -0.32));
    g.add(at(box(0.5, 0.04, 0.04, steel), 0, 1.0, -0.42));
    const wheel = at(cyl(0.25, 0.25, 0.06, std('#c4627f', { roughness: 0.4 }), 24).rotateZ(Math.PI / 2), 0, 0.3, -0.3);
    g.add(wheel); wheels.push(wheel);
    g.position.set(x, 0, z); group.add(g);
    block(x, z - 0.3, 0.3, 0.5);
    const seat = { id: `gym-bike-${i}`, label: 'an exercise bike', x, z: z + 0.25, y: fy + 0.3, h: 0.52, ry: Math.PI, run: true };
    seats.push(seat);
    clickable(g, { kind: 'gym-run', seat, label: 'An exercise bike — hop on and pedal 🚴' });
  });
  // the dumbbell rack and a water cooler
  {
    const x = R.minX + 0.35, z = 2.6;
    group.add(at(box(0.5, 0.7, 2.0, dark), x, 0.35, z));
    block(x, z, 0.55, 2.0);
    const COL = ['#c4627f', '#5f8fc4', '#93ab8c', '#e2b04a', '#7a3fa0'];
    for (let i = 0; i < 5; i++) for (const y of [0.45, 0.75]) {
      const db = new THREE.Group();
      db.add(at(cyl(0.015, 0.015, 0.26, steel, 8).rotateX(Math.PI / 2), 0, 0, 0));
      for (const s of [-1, 1]) db.add(at(cyl(0.05 + i * 0.01, 0.05 + i * 0.01, 0.05, std(COL[i]), 12).rotateX(Math.PI / 2), 0, 0, s * 0.12));
      db.position.set(x + 0.05, y, z - 0.8 + i * 0.4); group.add(db);
    }
    const hitW = at(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 2.0), new THREE.MeshBasicMaterial({ visible: false })), x, 0.5, z);
    group.add(hitW); clickable(hitW, { kind: 'gym-weights', label: 'The dumbbells — lift a few' });
    const cx = -1.0, cz = R.maxZ - 0.4;
    group.add(at(rbox(0.36, 1.0, 0.36, 0.04, std('#fffaf4', { roughness: 0.4 })), cx, 0.5, cz));
    group.add(at(cyl(0.15, 0.15, 0.42, std('#9fd0ff', { transparent: true, opacity: 0.6, roughness: 0.05 }), 18), cx, 1.21, cz));
    block(cx, cz, 0.4, 0.4);
    const hitC = at(new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.5, 0.45), new THREE.MeshBasicMaterial({ visible: false })), cx, 0.75, cz);
    group.add(hitC); clickable(hitC, { kind: 'gym-water', label: 'The water cooler 💧' });
  }

  // ── the yoga studio (east half): a soft floor, mats facing the mirror wall
  const soft = new THREE.Mesh(new THREE.PlaneGeometry(7.4, R.maxZ - R.minZ), std('#e8dccb', { roughness: 1 }));
  soft.rotation.x = -Math.PI / 2; soft.position.set(R.maxX - 3.7, 0.005, 0); group.add(soft);
  {
    // the mirror: a real reflection, along the north wall of the studio
    const mirror = new Reflector(new THREE.PlaneGeometry(6.6, 2.3), { textureWidth: 768, textureHeight: 256, color: '#c8d0d4' });
    mirror.position.set(R.maxX - 3.8, 1.35, R.minZ + 0.04);
    group.add(mirror);
    group.add(at(box(6.8, 2.5, 0.04, std('#c9a25b', { metalness: 0.5, roughness: 0.4 })), R.maxX - 3.8, 1.35, R.minZ + 0.015));
    group.add(at(box(6.8, 0.06, 0.08, std('#e8dccb')), R.maxX - 3.8, 2.62, R.minZ + 0.05));
  }
  const MAT = ['#c9a0d6', '#9fd0c0', '#f2a7bb', '#e8c98e', '#9fb8d6', '#b5d6a0'];
  let n = 0;
  for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
    const x = 1.6 + i * 1.9, z = -1.6 + r * 2.4;
    const mat = at(rbox(0.7, 0.02, 1.8, 0.01, std(MAT[n % MAT.length], { roughness: 1 })), x, 0.012, z);
    group.add(mat);
    const seat = { id: `gym-mat-${n}`, label: 'a yoga mat', x, z: z + 0.2, y: fy, h: 0.06, ry: Math.PI };
    seats.push(seat);
    clickable(mat, { kind: 'gym-yoga', seat, label: 'A yoga mat — sit for a calm stretch 🧘' });
    n++;
  }
  // a rack of rolled mats, blocks, a singing bowl
  {
    const x = R.maxX - 0.4, z = 3.2;
    for (let i = 0; i < 5; i++) group.add(at(cyl(0.08, 0.08, 0.62, std(MAT[i], { roughness: 1 }), 14), x, 0.31, z - 0.8 + i * 0.2));
    for (let i = 0; i < 3; i++) group.add(at(rbox(0.22, 0.12, 0.15, 0.02, std('#a98ed6', { roughness: 1 })), x - 0.05, 0.06 + i * 0.12, z + 0.4));
    group.add(at(cyl(0.12, 0.08, 0.08, std('#c9a25b', { metalness: 0.8, roughness: 0.3 }), 20), x - 0.6, 0.04, z + 0.9));
    block(x, z, 0.4, 2.0);
  }
  const sign1 = makeSign([{ text: 'The Gym', size: 120, weight: '700' }, { text: 'run · ride · lift 💪', size: 70 }], 1.2, 0.4, { bg: '#e3eef0' });
  sign1.position.set(-3.8, 2.85, R.minZ + 0.02); group.add(sign1);
  const sign2 = makeSign([{ text: 'Yoga Studio', size: 110, weight: '700' }, { text: 'breathe in · breathe out', font: 'Dancing Script, cursive', size: 72, color: '#c4627f' }], 1.3, 0.4, { bg: '#f6eefa' });
  sign2.position.set(R.maxX - 3.8, 2.95, R.minZ + 0.06); group.add(sign2);
  plant(group, colliders, R.maxX - 0.45, R.maxZ - 0.45, 1.2);
  plant(group, colliders, 0.6, R.minZ + 0.45, 1.0);
  plant(group, colliders, R.minX + 0.45, R.maxZ - 0.45, 1.0);
  const lights = [pendant(group, R, -4, -0.5, { intensity: 2.6 }), pendant(group, R, 3.8, -0.5, { intensity: 2.2, light: '#ffe8d0' }), pendant(group, R, 3.8, 2.8, { intensity: 1.8, light: '#ffe8d0' })];
  doorOut({ group, R, makeSign, interactables, color: '#93ab8c', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  // the belts and the wheels turn while someone's on them (app.js says who)
  const busy = new Set();
  animate?.(dt => {
    belts.forEach((b, i) => { if (busy.has(`gym-tread-${i}`)) { b.material.color.offsetHSL(0, 0, Math.sin(performance.now() / 60) * 0.002); } });
    wheels.forEach((w, i) => { if (busy.has(`gym-bike-${i}`)) w.rotation.x += dt * 9; });
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.6, ry: Math.PI },
    setBusy(ids) { busy.clear(); for (const id of ids) busy.add(id); },
  };
}
