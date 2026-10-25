// The Observatory: up on the very top, beside the pool — a round room under
// a dome painted with tonight's stars and the lines of the constellations, a
// slot in the dome open to the real sky, and a big brass telescope on its
// mount. Look through it and you see the moon as it really is tonight (its
// phase worked out from the date), and the constellations up over Cairo this
// time of year (app.js, skyTonight below).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, doorOut } from './roomkit.js';

export const OBSERVATORY = { minX: -6, maxX: 6, minZ: -6, maxZ: 6, h: 6 };
const R = OBSERVATORY;
const RAD = 5.6;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

// ── the sky tonight, from Cairo (30°N): the moon's phase and what's up in the evening
const SYNODIC = 29.530588853;
export function moonTonight(now = new Date()) {
  const ref = Date.UTC(2000, 0, 6, 18, 14); // a new moon
  const age = (((now.getTime() - ref) / 86400e3) % SYNODIC + SYNODIC) % SYNODIC;
  const f = age / SYNODIC;
  const lit = (1 - Math.cos(f * Math.PI * 2)) / 2;
  const name = age < 1.8 ? 'New moon' : age < 6.4 ? 'Waxing crescent' : age < 8.6 ? 'First quarter' : age < 13.8 ? 'Waxing gibbous' : age < 15.8 ? 'Full moon' : age < 21 ? 'Waning gibbous' : age < 23.2 ? 'Last quarter' : age < 27.7 ? 'Waning crescent' : 'New moon';
  return { age, f, lit, name };
}
// the constellations high in the evening sky over Cairo, month by month
const BY_MONTH = [
  ['Orion', 'Taurus', 'Gemini', 'Canis Major'], ['Orion', 'Gemini', 'Canis Major', 'Auriga'], ['Gemini', 'Cancer', 'Leo', 'Orion'],
  ['Leo', 'Cancer', 'Ursa Major', 'Hydra'], ['Leo', 'Virgo', 'Boötes', 'Ursa Major'], ['Virgo', 'Boötes', 'Scorpius', 'Corona Borealis'],
  ['Scorpius', 'Sagittarius', 'Hercules', 'Lyra'], ['Sagittarius', 'Lyra', 'Cygnus', 'Aquila'], ['Cygnus', 'Aquila', 'Lyra', 'Capricornus'],
  ['Pegasus', 'Cygnus', 'Andromeda', 'Aquarius'], ['Pegasus', 'Andromeda', 'Perseus', 'Pisces'], ['Taurus', 'Perseus', 'Orion', 'Aries'],
];
export const constellationsTonight = (now = new Date()) => BY_MONTH[now.getUTCMonth()];
// a few constellations as dots and lines (x, y in 0..1), to draw on the dome and in the eyepiece
export const SHAPES = {
  Orion: { stars: [[0.3, 0.1], [0.7, 0.15], [0.42, 0.48], [0.5, 0.5], [0.58, 0.52], [0.35, 0.9], [0.72, 0.85]], lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  Leo: { stars: [[0.2, 0.3], [0.3, 0.2], [0.42, 0.25], [0.45, 0.4], [0.35, 0.55], [0.75, 0.5], [0.85, 0.65]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [3, 5]] },
  Scorpius: { stars: [[0.15, 0.15], [0.25, 0.2], [0.35, 0.3], [0.45, 0.45], [0.5, 0.6], [0.55, 0.75], [0.7, 0.85], [0.85, 0.8], [0.88, 0.68]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]] },
  Cygnus: { stars: [[0.5, 0.1], [0.5, 0.4], [0.5, 0.85], [0.15, 0.35], [0.85, 0.45]], lines: [[0, 1], [1, 2], [3, 1], [1, 4]] },
  Pegasus: { stars: [[0.25, 0.25], [0.7, 0.25], [0.7, 0.7], [0.25, 0.7], [0.05, 0.85], [0.9, 0.05]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [1, 5]] },
  'Ursa Major': { stars: [[0.1, 0.3], [0.25, 0.25], [0.4, 0.3], [0.52, 0.38], [0.55, 0.6], [0.85, 0.62], [0.85, 0.4]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
};
function domeTex() {
  return canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05081a'); gr.addColorStop(1, '#1b2240');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,${240 + r() * 15},${200 + r() * 55},${0.3 + r() * 0.7})`; g.beginPath(); g.arc(r() * w, r() * h * 0.9, r() * 1.8 + 0.3, 0, Math.PI * 2); g.fill(); }
    // the constellations, drawn round the dome, with their names
    Object.entries(SHAPES).forEach(([nm, c], i) => {
      const ox = 80 + i * (w - 160) / 6, oy = 140 + (i % 2) * 220, sz = 260;
      g.strokeStyle = 'rgba(160,200,255,.55)'; g.lineWidth = 2;
      for (const [a, b] of c.lines) { g.beginPath(); g.moveTo(ox + c.stars[a][0] * sz, oy + c.stars[a][1] * sz); g.lineTo(ox + c.stars[b][0] * sz, oy + c.stars[b][1] * sz); g.stroke(); }
      g.fillStyle = '#fff8e0'; for (const [x, y] of c.stars) { g.beginPath(); g.arc(ox + x * sz, oy + y * sz, 5, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#c9d2f0'; g.font = 'italic 30px Georgia, serif'; g.fillText(nm, ox, oy + sz + 40);
    });
  });
}

export function buildObservatory({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [], surfaces = [];
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const fy = group.position.y;
  const brass = std('#c9a25b', { metalness: 0.8, roughness: 0.25 });

  // ── the round room: a wooden floor, a low wall, and the dome of stars over it
  const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(RAD, 48), std('#ffffff', { map: plankTex(R, [110, 78, 52], 13), roughness: 0.7 }));
  floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true; floorMesh.userData.floor = true;
  group.add(floorMesh); floor.floorMesh = floorMesh;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, 2.2, 48, 1, true), std('#2a3050', { roughness: 0.9, side: THREE.BackSide }));
  wall.position.y = 1.1; group.add(wall);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RAD, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: domeTex(), side: THREE.BackSide }));
  dome.position.y = 2.2; dome.scale.y = 0.68; group.add(dome);
  clickable(dome, { kind: 'obs-chart', label: 'The star map on the dome ✨' });
  // the slot, open to the night
  const slot = at(new THREE.Mesh(new THREE.PlaneGeometry(1.0, 4.2), new THREE.MeshBasicMaterial({ color: '#02040c' })), 0, 4.6, -1.6);
  slot.rotation.x = Math.PI / 2 + 0.75; group.add(slot);

  // ── the telescope on its mount, aimed up at the slot
  {
    const g = new THREE.Group();
    g.add(at(cyl(0.5, 0.6, 0.2, std('#2a2422'), 24), 0, 0.1, 0));
    g.add(at(cyl(0.12, 0.16, 1.3, std('#2a2422'), 12), 0, 0.85, 0));
    const tube = new THREE.Group();
    tube.add(at(cyl(0.24, 0.2, 2.6, brass, 24), 0, 0, 0));
    tube.add(at(cyl(0.26, 0.26, 0.12, std('#2a2422'), 24), 0, 1.3, 0));
    tube.add(at(cyl(0.05, 0.05, 0.25, std('#2a2422'), 10).rotateZ(Math.PI / 2), 0.18, -1.1, 0)); // the eyepiece
    tube.position.set(0, 1.7, -0.4); tube.rotation.x = -0.75; g.add(tube);
    g.position.set(0, 0, -0.5); group.add(g);
    colliders.push({ type: 'circle', fixed: true, x: 0, z: -0.5, r: 0.7 });
    clickable(g, { kind: 'obs-scope', label: 'The telescope — look at tonight’s sky 🔭' });
  }
  // ── benches round the wall, a desk with star charts, the stairs down
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.25 + i * Math.PI * 0.38, x = Math.cos(a) * (RAD - 0.6), z = Math.sin(a) * (RAD - 0.6);
    if (z > RAD - 1.6) continue; // (not in front of the door)
    const b = at(rbox(1.2, 0.08, 0.45, 0.03, std('#6e472e', { roughness: 0.6 })), x, 0.45, z);
    b.rotation.y = -a + Math.PI / 2; group.add(b);
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.45 });
    const s = { id: `obs-bench-${i}`, label: 'a bench under the dome', x: x * 0.92, z: z * 0.92, y: fy, h: 0.48, ry: Math.atan2(-x, -z) };
    seats.push(s);
    clickable(b, { kind: 'seat', seat: s, label: 'Sit and look up at the dome' });
  }
  {
    const x = -3.4, z = -2.6;
    group.add(at(rbox(1.4, 0.06, 0.7, 0.02, std('#5a3a26', { roughness: 0.5 })), x, 0.78, z));
    for (const a of [-1, 1]) group.add(at(box(0.06, 0.76, 0.6, std('#3a2418')), x + a * 0.62, 0.38, z));
    group.add(at(box(0.6, 0.005, 0.4, std('#e8dcc4')), x, 0.815, z));
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.75 });
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.7), new THREE.MeshBasicMaterial({ visible: false })), x, 0.9, z);
    group.add(hit); clickable(hit, { kind: 'obs-chart', label: 'Star charts on the desk' });
  }
  const name = makeSign([{ text: 'The Observatory', size: 110, weight: '700', color: '#ffe7a0' }, { text: 'tonight’s sky over Cairo 🔭', font: 'Dancing Script, cursive', size: 66, color: '#c9d2f0' }], 1.6, 0.44, { bg: '#1b2240', border: '#c9a25b' });
  name.position.set(0, 1.9, RAD - 0.08); name.rotation.y = Math.PI; group.add(name);
  doorOut({ group, R: { ...R, maxZ: RAD - 0.02 }, makeSign, interactables, color: '#1b2240', to: 'landing3', sign: '⬇ The third floor', label: 'Down the stairs to the third floor' });
  const lights = [new THREE.PointLight('#ffcf8f', 1.2, 8, 1.6), new THREE.PointLight('#9fb8ff', 0.8, 10, 1.4)];
  lights[0].position.set(-3.4, 1.8, -2.6); lights[1].position.set(0, 3, 0); lights.forEach(l => group.add(l));

  animate?.(dt => { dome.rotation.y += dt * 0.004; }); // the sky turns, very slowly

  // walk inside the circle (a box just inside it, near enough)
  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: -RAD + 1.0, maxX: RAD - 1.0, minZ: -RAD + 1.0, maxZ: RAD - 0.6 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return { lights, bounds: R, arrival: { x: 0, z: RAD - 1.4, ry: Math.PI } };
}
