// The Rooftop Cinema: up on the roof, through the door in the side of the
// stair house. Covered — a solid roof on beams, glass all down both sides —
// so the films go on rain or shine, with Cairo's lights out past the glass.
// Rows of red seats stepping up, a popcorn cart, and a big screen that shows
// whatever film the café owner has on the programme (the events board,
// kind 'film', site_content 'cafe.events'): everyone in the cinema watches
// it together, from the moment it started.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, plankTex, canvasTex, plant } from './roomkit.js';

export const CINEMA = { minX: -7, maxX: 7, minZ: -5.5, maxZ: 5.5, h: 4.2 };
const R = CINEMA;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

function screenTex(film, next) {
  return canvasTex(1024, 540, (g, w, h) => {
    if (!film) {
      g.fillStyle = '#121218'; g.fillRect(0, 0, w, h);
      g.textAlign = 'center';
      g.fillStyle = '#f2a7bb'; g.font = 'bold 54px Georgia, serif'; g.fillText('The Rooftop Cinema', w / 2, h / 2 - 50);
      g.fillStyle = '#c9c2d6'; g.font = 'italic 34px Georgia, serif';
      g.fillText(next ? `Next: “${String(next.title).slice(0, 36)}”` : 'No film on just now', w / 2, h / 2 + 20);
      if (next) g.fillText(next.when, w / 2, h / 2 + 70);
      g.font = '26px Georgia, serif'; g.fillStyle = '#8a8398'; g.fillText('click the screen for the programme', w / 2, h - 50);
      return;
    }
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1f2a4a'); gr.addColorStop(1, '#4a2a3c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(460, 160); g.lineTo(460, 320); g.lineTo(590, 240); g.fill();
    g.textAlign = 'center';
    g.font = 'bold 44px Georgia, serif'; g.fillStyle = '#fbe3ea'; g.fillText('Now showing', w / 2, 410);
    g.font = 'italic 36px Georgia, serif'; g.fillStyle = '#f4ece0'; g.fillText(String(film.title || 'a film').slice(0, 48), w / 2, 462);
  });
}

export function buildCinema({ floor, makeSign }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [], surfaces = [];
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const W = R.maxX - R.minX, D = R.maxZ - R.minZ;
  const wood = std('#5a3a26', { roughness: 0.55 });

  // the deck, the roof on its beams, the walls at each end, glass down the sides
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#ffffff', { map: plankTex(R, [110, 74, 50], 17), roughness: 0.7 }));
  deck.rotation.x = -Math.PI / 2; deck.receiveShadow = true; deck.userData.floor = true;
  group.add(deck); floor.floorMesh = deck;
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(W - 3.6, D - 2.4), std('#5a1f2c', { roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.004, 0.4); group.add(carpet);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#2a2230', { roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = R.h; group.add(ceil);
  group.add(at(box(W + 1.2, 0.2, D + 1.2, std('#3a5a40', { roughness: 0.7 })), 0, R.h + 0.1, 0)); // the roof, overhanging
  for (let i = 0; i <= 6; i++) group.add(at(box(0.16, 0.22, D, wood), R.minX + i * W / 6, R.h - 0.11, 0)); // the beams
  const wallM = std('#2e2a36', { roughness: 0.95 });
  for (const [z, ry] of [[R.minZ, 0], [R.maxZ, Math.PI]]) {
    const m = at(new THREE.Mesh(new THREE.PlaneGeometry(W, R.h), wallM), 0, R.h / 2, z);
    m.rotation.y = ry; m.userData.surface = 'wall'; group.add(m); surfaces.push(m);
  }
  const glass = new THREE.MeshStandardMaterial({ color: '#dff1ff', roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  for (const x of [R.minX, R.maxX]) {
    group.add(at(box(0.2, 0.9, D, std('#e3d4c0', { roughness: 0.8 })), x, 0.45, 0)); // a low wall under the glass
    const gl = at(new THREE.Mesh(new THREE.PlaneGeometry(D, R.h - 0.9), glass), x, 0.9 + (R.h - 0.9) / 2, 0);
    gl.rotation.y = Math.PI / 2; group.add(gl);
    for (let i = 0; i <= 5; i++) group.add(at(box(0.1, R.h - 0.9, 0.1, wood), x, 0.9 + (R.h - 0.9) / 2, R.minZ + i * D / 5));
  }
  const cover = makeSign([{ text: '☔ Covered', size: 100, weight: '700' }, { text: 'films on, rain or shine', size: 64 }], 0.9, 0.3, { bg: '#e3eef0' });
  cover.position.set(R.maxX - 0.12, 2.9, 3.6); cover.rotation.y = -Math.PI / 2; group.add(cover);

  // ── the screen, with its curtains and its little stage
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex(null, null), toneMapped: false });
  {
    const sw = 6.4, sh = 3.4, y = 2.25;
    group.add(at(box(sw + 0.3, sh + 0.3, 0.06, std('#0d0d10')), 0, y, R.minZ + 0.04));
    const screen = at(new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat), 0, y, R.minZ + 0.08);
    group.add(screen);
    clickable(screen, { kind: 'cinema-screen', label: 'The screen — what’s on, and when 🎬' });
    const velvet = std('#7c1f2c', { roughness: 1 });
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
      const fold = box(0.18, R.h - 0.3, 0.1 + (i % 2) * 0.06, velvet);
      group.add(at(fold, s * (sw / 2 + 0.3 + i * 0.15), (R.h - 0.3) / 2, R.minZ + 0.12));
    }
    group.add(at(box(W - 0.4, 0.35, 1.0, std('#3a2a22', { roughness: 0.6 })), 0, 0.175, R.minZ + 0.5));
    colliders.push({ type: 'box', fixed: true, minX: R.minX, maxX: R.maxX, minZ: R.minZ, maxZ: R.minZ + 1.0 });
  }

  // ── rows of seats, stepping up towards the back
  const seatM = std('#b3263a', { roughness: 0.9 }), armM = std('#2a1e1a', { roughness: 0.5 });
  const ROWS = 4, PER = 8;
  for (let r = 0; r < ROWS; r++) {
    const z = -1.2 + r * 1.25, rise = r * 0.18;
    if (rise) group.add(at(box(5.4, rise, 1.25, std('#4a1a24', { roughness: 1 })), 0, rise / 2, z + 0.1));
    for (let i = 0; i < PER; i++) {
      const x = -(PER - 1) / 2 * 0.62 + i * 0.62;
      const c = new THREE.Group();
      c.add(at(rbox(0.52, 0.12, 0.5, 0.04, seatM), 0, 0.42, 0));
      c.add(at(rbox(0.52, 0.62, 0.1, 0.05, seatM), 0, 0.78, 0.24));
      for (const s of [-1, 1]) c.add(at(box(0.06, 0.6, 0.5, armM), s * 0.29, 0.3, 0));
      c.position.set(x, rise, z); group.add(c);
      const s = { id: `cinema-${r}-${i}`, label: `row ${'ABCD'[r]}, seat ${i + 1}`, x, z, y: group.position.y + rise, h: 0.48, ry: Math.PI };
      seats.push(s);
      clickable(c, { kind: 'seat', seat: s, label: `Sit in ${s.label}` });
    }
  }

  // ── the popcorn cart, and the programme board by the door
  {
    const x = R.maxX - 1.3, z = R.maxZ - 1.0;
    const g = new THREE.Group();
    g.add(at(rbox(0.8, 0.8, 0.55, 0.04, std('#c94a4a', { roughness: 0.5 })), 0, 0.5, 0));
    g.add(at(box(0.7, 0.6, 0.5, std('#fff6d8', { transparent: true, opacity: 0.35, roughness: 0.05 })), 0, 1.2, 0));
    for (let i = 0; i < 40; i++) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), std('#fff3c8')), ((i * 7) % 10) / 10 * 0.6 - 0.3, 0.95 + (i % 4) * 0.04, ((i * 3) % 8) / 8 * 0.4 - 0.2));
    g.add(at(box(0.84, 0.08, 0.6, std('#e2b04a')), 0, 1.54, 0));
    for (const s of [-1, 1]) g.add(at(cyl(0.12, 0.12, 0.05, std('#333'), 16).rotateZ(Math.PI / 2), s * 0.42, 0.12, 0));
    g.position.set(x, 0, z); group.add(g);
    colliders.push({ type: 'box', fixed: true, minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.3, maxZ: z + 0.3 });
    clickable(g, { kind: 'cinema-popcorn', label: 'The popcorn cart 🍿' });
    const sign = makeSign([{ text: '🍿 Popcorn', size: 110, weight: '700' }, { text: 'sweet · salty · free', size: 64 }], 0.8, 0.28, { bg: '#fff6d8' });
    sign.position.set(0, 1.85, 0); g.add(sign);
  }
  const progMat = new THREE.MeshBasicMaterial({ map: canvasTex(4, 4, () => {}), toneMapped: false });
  const prog = at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), progMat), R.minX + 1.8, 1.7, R.maxZ - 0.03);
  prog.rotation.y = Math.PI; group.add(prog);
  clickable(prog, { kind: 'cinema-screen', label: 'What’s on at the Rooftop Cinema' });
  const progTex = list => canvasTex(384, 512, (g, w, h) => {
    g.fillStyle = '#16131f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e2b04a'; g.lineWidth = 10; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'center'; g.fillStyle = '#ffd98a'; g.font = 'bold 36px Georgia, serif'; g.fillText('NOW & NEXT', w / 2, 58);
    g.font = '22px Georgia, serif';
    if (!list.length) { g.fillStyle = '#8a8398'; g.fillText('nothing on the programme', w / 2, 150); g.fillText('just yet', w / 2, 180); }
    list.slice(0, 5).forEach((f, i) => {
      g.fillStyle = f.now ? '#f2a7bb' : '#f4ece0';
      g.font = 'bold 24px Georgia, serif'; g.fillText(String(f.title).slice(0, 24), w / 2, 120 + i * 78);
      g.font = 'italic 20px Georgia, serif'; g.fillStyle = '#c9c2d6'; g.fillText(f.now ? '✨ showing now' : f.when, w / 2, 148 + i * 78);
    });
  });
  // the door back out to the roof garden
  {
    const g = new THREE.Group();
    g.position.set(-3.6, 0, R.maxZ); g.rotation.y = Math.PI;
    for (const s of [-1, 1]) g.add(at(rbox(0.7, 2.25, 0.05, 0.015, std('#3a5a40', { roughness: 0.55 })), s * 0.36, 1.125, 0.025));
    for (const [w, h, dx, y] of [[0.1, 2.35, -0.77, 1.175], [0.1, 2.35, 0.77, 1.175], [1.64, 0.1, 0, 2.35]]) g.add(at(box(w, h, 0.08, wood), dx, y, 0.04));
    const sign = makeSign([{ text: '⬅ The roof garden', size: 96, weight: '700' }], 1.0, 0.24);
    sign.position.set(0, 2.62, 0.04); g.add(sign);
    const exit = makeSign([{ text: 'EXIT', size: 120, weight: '700', color: '#e8fbe8' }], 0.4, 0.16, { bg: '#2f8a4a', border: '#1f5a30' });
    exit.position.set(0, 3.0, 0.04); g.add(exit);
    const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), new THREE.MeshBasicMaterial({ visible: false })), 0, 1.15, 0.1);
    hit.userData = { kind: 'room-out', to: 'garden', label: 'Back out to the roof garden' };
    g.add(hit); interactables.push(hit);
    group.add(g);
  }
  const name = makeSign([{ text: 'The Rooftop Cinema', size: 120, weight: '700', color: '#ffd98a' }, { text: 'films under the Cairo sky 🎬', font: 'Dancing Script, cursive', size: 72, color: '#f2a7bb' }], 2.0, 0.5, { bg: '#16131f', border: '#e2b04a' });
  name.position.set(1.6, 3.4, R.maxZ - 0.04); name.rotation.y = Math.PI; group.add(name);
  plant(group, colliders, R.minX + 0.5, R.maxZ - 0.5, 1.0);

  // low lights along the aisles, and a soft glow off the screen
  const lights = [];
  for (const x of [-3.1, 3.1]) for (let i = 0; i < 4; i++) group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), std('#fff1d6', { emissive: '#ffcf8f', emissiveIntensity: 1 })), x, 0.02, -1.0 + i * 1.25));
  const glow = new THREE.PointLight('#9fb8ff', 2.2, 10, 1.4); glow.position.set(0, 2.2, R.minZ + 2.5); group.add(glow); lights.push(glow);
  const back = new THREE.PointLight('#ffd9a6', 1.6, 9, 1.6); back.position.set(0, 3.2, R.maxZ - 1.5); group.add(back); lights.push(back);

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: -3.6, z: R.maxZ - 1.2, ry: Math.PI },
    // what's on: the film showing now (or null), and the programme
    setProgramme(film, list) {
      const old = screenMat.map; screenMat.map = screenTex(film, list.find(f => !f.now) || null); screenMat.needsUpdate = true; old?.dispose();
      const o2 = progMat.map; progMat.map = progTex(list); progMat.needsUpdate = true; o2?.dispose();
    },
  };
}
