// The Karaoke Room: on the third floor, off its landing. A little stage with
// two microphones on stands and a stool, the big screen behind it (whatever
// karaoke video anyone puts on plays on it, for everyone in the room —
// tvscreen.js, app.js), a mirror ball and coloured lights sweeping round, a
// neon sign, booths and a song book.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, shell, doorOut } from './roomkit.js';

export const KARAOKE = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, h: 3.4 };
const R = KARAOKE;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const NEON = ['#ff4a8a', '#3fd0ff', '#ffd23f', '#7dff6a', '#c56aff'];

function screenTex(m) {
  return canvasTex(1024, 576, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a0f3a'); gr.addColorStop(1, '#0f2a4a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.fillStyle = '#ff8ad0'; g.font = 'bold 72px Georgia, serif'; g.fillText(m ? '🎤 ' + String(m.title || 'a song').slice(0, 30) : '🎤 KARAOKE', w / 2, h / 2 - 20);
    g.fillStyle = '#c9d2f0'; g.font = 'italic 34px Georgia, serif'; g.fillText(m ? `put on by ${m.by || 'someone'}` : 'click the screen or the song book to pick a song', w / 2, h / 2 + 50);
  });
}

export function buildKaraoke({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: canvasTex(128, 128, (g, w) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#1d1830' : '#2a2240'; g.fillRect(i * 32, j * 32, 32, 32); } }, [6, 5]),
    wallColor: '#241c34', lowColor: '#16131f', ceilColor: '#120f1c', wallsAreSurfaces: false,
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const dark = std('#1d1b22', { roughness: 0.5 }), steel = std('#c0c4c8', { metalness: 0.7, roughness: 0.3 });

  // ── the stage, the screen behind it, the mics
  const STAGE = { minX: -3.4, maxX: 3.4, minZ: R.minZ, maxZ: R.minZ + 2.0, h: 0.3 };
  group.add(at(box(STAGE.maxX - STAGE.minX, STAGE.h, STAGE.maxZ - STAGE.minZ, std('#3a2a4a', { roughness: 0.5 })), 0, STAGE.h / 2, (STAGE.minZ + STAGE.maxZ) / 2));
  for (let i = 0; i < 14; i++) group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(NEON[i % 5], { emissive: NEON[i % 5], emissiveIntensity: 1.2 })), STAGE.minX + 0.2 + i * 0.49, STAGE.h + 0.02, STAGE.maxZ - 0.02));
  colliders.push({ type: 'box', fixed: true, minX: STAGE.minX, maxX: STAGE.maxX, minZ: STAGE.minZ, maxZ: STAGE.maxZ - 0.9 });
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex(null), toneMapped: false });
  const screen = at(new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.48), screenMat), 0, 1.85, R.minZ + 0.08);
  group.add(screen);
  group.add(at(box(4.6, 2.68, 0.06, dark), 0, 1.85, R.minZ + 0.04));
  clickable(screen, { kind: 'karaoke-pick', label: 'The big screen — pick a song 🎤' });
  for (const x of [-1.0, 1.0]) {
    const mic = new THREE.Group();
    mic.add(at(cyl(0.16, 0.18, 0.03, dark, 16), 0, 0.015, 0));
    mic.add(at(cyl(0.012, 0.012, 1.4, steel, 8), 0, 0.7, 0));
    mic.add(at(cyl(0.035, 0.025, 0.16, std('#2a2a2a', { metalness: 0.6, roughness: 0.3 }), 12).rotateX(-0.4), 0, 1.45, 0.05));
    mic.position.set(x, STAGE.h, STAGE.maxZ - 0.5); group.add(mic);
    clickable(mic, { kind: 'karaoke-sing', label: 'The microphone — take the stage 🎤' });
  }
  const stool = at(cyl(0.2, 0.2, 0.06, std('#ff4a8a', { roughness: 0.6 }), 16), 0, STAGE.h + 0.62, STAGE.maxZ - 0.75);
  group.add(stool); group.add(at(cyl(0.025, 0.025, 0.6, steel, 8), 0, STAGE.h + 0.3, STAGE.maxZ - 0.75));
  const singSeat = { id: 'karaoke-stage', label: 'the stage', x: 0, z: STAGE.maxZ - 0.75, y: fy + STAGE.h, h: 0.66, ry: 0 };
  seats.push(singSeat);
  clickable(stool, { kind: 'karaoke-sing', label: 'Take the stage 🎤' });
  const spot = new THREE.PointLight('#fff1f8', 0, 5, 1.4); spot.position.set(0, 2.9, STAGE.maxZ - 0.4); group.add(spot);

  // ── the mirror ball and the lights
  const ball = at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 2), std('#e8e8f0', { metalness: 1, roughness: 0.08, flatShading: true })), 0, R.h - 0.55, 0.6);
  group.add(ball); group.add(at(cyl(0.006, 0.006, 0.3, steel, 4), 0, R.h - 0.25, 0.6));
  const disco = NEON.slice(0, 4).map((c, i) => { const l = new THREE.PointLight(c, 1.6, 7, 1.4); group.add(l); return { l, i }; });
  const dots = [];
  for (let i = 0; i < 40; i++) { const d = at(new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), new THREE.MeshBasicMaterial({ color: NEON[i % 5], transparent: true, opacity: 0.7 })), 0, 0, 0); group.add(d); dots.push({ d, a: i * 2.4, r: 2 + (i % 5) * 0.8, y: 0.6 + (i % 7) * 0.35 }); }

  // ── booths along the side walls, a low table each, and the song book
  const boothM = std('#7a3fa0', { roughness: 1 });
  for (const side of [-1, 1]) {
    const x = side * (R.maxX - 0.45);
    for (const z of [-0.6, 2.4]) {
      group.add(at(rbox(0.7, 0.42, 2.0, 0.1, boothM), x, 0.21, z));
      group.add(at(rbox(0.2, 0.7, 2.0, 0.08, boothM), x + side * 0.3, 0.6, z));
      block(x, z, 0.75, 2.0);
      group.add(at(rbox(0.7, 0.05, 1.1, 0.02, std('#2a2240', { roughness: 0.3 })), x - side * 0.9, 0.5, z));
      for (const s of [-1, 1]) group.add(at(cyl(0.02, 0.02, 0.48, steel, 6), x - side * 0.9, 0.25, z + s * 0.4));
      block(x - side * 0.9, z, 0.7, 1.1);
      for (const dz of [-0.6, 0, 0.6]) seats.push({ id: `karaoke-booth-${side < 0 ? 'w' : 'e'}${z}-${dz}`, label: 'a booth', x: x - side * 0.05, z: z + dz, y: fy, h: 0.44, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
      const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 2.0), new THREE.MeshBasicMaterial({ visible: false })), x, 0.45, z);
      group.add(hit); clickable(hit, { kind: 'seat', seat: seats[seats.length - 2], label: 'Sit in a booth' });
    }
  }
  {
    const book = at(rbox(0.36, 0.06, 0.26, 0.02, std('#ff4a8a', { roughness: 0.6 })), -(R.maxX - 1.35), 0.56, -0.6);
    group.add(book);
    clickable(book, { kind: 'karaoke-pick', label: 'The song book — pick a song 🎶' });
  }
  const neon = makeSign([{ text: 'KARAOKE', size: 150, weight: '700', color: '#ff8ad0' }, { text: 'sing like nobody’s listening', font: 'Dancing Script, cursive', size: 64, color: '#9fe0ff' }], 2.0, 0.5, { bg: '#16131f', border: '#ff4a8a' });
  neon.position.set(0, 3.05, R.minZ + 0.06); group.add(neon);
  doorOut({ group, R, makeSign, interactables, color: '#7a3fa0', to: 'landing3', sign: '⬅ The landing', label: 'Back out to the landing' });

  let singing = false;
  animate?.((dt, t) => {
    ball.rotation.y += dt * 0.6;
    disco.forEach(({ l, i }) => { const a = t * 0.8 + i * Math.PI / 2; l.position.set(Math.cos(a) * 3.2, 2.6, 0.6 + Math.sin(a) * 2.6); l.intensity = 1.2 + Math.sin(t * 3 + i) * 0.6; });
    dots.forEach(o => { const a = o.a + t * 0.5; const x = Math.cos(a) * o.r, z = 0.6 + Math.sin(a) * o.r; const cx = Math.max(R.minX + 0.05, Math.min(R.maxX - 0.05, x)); const wall = Math.abs(x) > R.maxX - 0.2; o.d.position.set(wall ? Math.sign(x) * (R.maxX - 0.02) : cx, wall ? o.y + 0.5 : 0.01, wall ? z : z); o.d.rotation.set(wall ? 0 : -Math.PI / 2, wall ? -Math.sign(x) * Math.PI / 2 : 0, 0); });
    spot.intensity = singing ? 3.5 : 0;
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights: disco.map(d => d.l), bounds: R, screen, singSeat,
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
    setMovie(m) { const old = screenMat.map; screenMat.map = screenTex(m || null); screenMat.needsUpdate = true; old?.dispose(); },
    setSinging(on) { singing = !!on; },
  };
}
