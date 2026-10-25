// The Art Studio: on the second floor, off the landing. Easels by the big
// windows (click one to paint — a little canvas with brushes, app.js), a
// long table of paint pots and jars of brushes, a sink splashed with colour,
// and the gallery wall: the latest paintings anyone has hung, for everyone
// to see (server/rooms.js). You can hang yours in your own flat too.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, plankTex, canvasTex, shell, doorOut, plant, pendant } from './roomkit.js';

export const ART = { minX: -7, maxX: 7, minZ: -5, maxZ: 5, h: 3.6 };
const R = ART;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const PAINT = ['#e58aa6', '#5f8fc4', '#e2b04a', '#6f9f63', '#c94a4a', '#7a3fa0', '#f4ece0', '#2a2d33'];

// the floor: old boards, with splashes of paint
function splashTex() {
  const base = plankTex(R, [196, 170, 140], 3);
  const img = base.image, g = img.getContext('2d');
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) { g.fillStyle = PAINT[Math.floor(r() * 6)]; g.globalAlpha = 0.5; g.beginPath(); g.arc(r() * 512, r() * 512, 3 + r() * 9, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1; base.needsUpdate = true;
  return base;
}
const blankTex = () => canvasTex(4, 4, g => { g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, 4, 4); });

export function buildArt({ floor, makeSign }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: splashTex(),
    wallColor: '#fbf8f2', lowColor: '#c9b49a', ceilColor: '#ffffff', windows: { west: [-2.6, 0, 2.6] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const wood = std('#b58a63', { roughness: 0.7 });
  const fy = group.position.y;

  // ── easels by the windows, each with a stool
  const easelCanvases = [];
  [-2.8, 0, 2.8].forEach((z, i) => {
    const x = R.minX + 1.6;
    const g = new THREE.Group();
    for (const s of [-1, 1]) g.add(at(box(0.04, 1.7, 0.04, wood).rotateZ(s * 0.12), s * 0.3, 0.85, 0));
    g.add(at(box(0.04, 1.6, 0.04, wood).rotateX(-0.35), 0, 0.8, -0.3));
    g.add(at(box(0.7, 0.04, 0.08, wood), 0, 0.78, 0.04));
    const cv = at(new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.48), new THREE.MeshStandardMaterial({ map: blankTex(), roughness: 0.9 })), 0, 1.06, 0.07);
    cv.rotation.x = -0.08;
    g.add(cv); easelCanvases.push(cv);
    g.add(at(box(0.66, 0.5, 0.02, std('#e8dccb')), 0, 1.06, 0.055).rotateX(-0.08));
    // facing the window? no — facing into the room, so the painter has the light behind
    g.position.set(x, 0, z); g.rotation.y = Math.PI / 2; group.add(g);
    block(x, z, 0.5, 0.8);
    const sx = x + 0.75;
    const st = new THREE.Group();
    st.add(at(cyl(0.18, 0.18, 0.05, std(PAINT[i], { roughness: 0.8 }), 16), 0, 0.6, 0));
    for (let k = 0; k < 3; k++) st.add(at(cyl(0.015, 0.015, 0.6, wood, 6), Math.cos(k * 2.1) * 0.12, 0.3, Math.sin(k * 2.1) * 0.12));
    st.position.set(sx, 0, z); group.add(st);
    const seat = { id: `art-stool-${i}`, label: 'the stool at an easel', x: sx, z, y: fy, h: 0.62, ry: -Math.PI / 2 };
    seats.push(seat);
    clickable(g, { kind: 'art-easel', seat, label: 'An easel — paint something 🎨' });
    clickable(st, { kind: 'art-easel', seat, label: 'An easel — paint something 🎨' });
  });

  // ── the long paint table in the middle, pots and brush jars
  {
    const x = 1.0, z = 0.2;
    group.add(at(rbox(3.6, 0.06, 1.1, 0.02, wood), x, 0.82, z));
    for (const a of [-1, 1]) for (const b of [-1, 1]) group.add(at(box(0.07, 0.8, 0.07, wood), x + a * 1.7, 0.4, z + b * 0.45));
    block(x, z, 3.6, 1.1);
    for (let i = 0; i < 14; i++) {
      const px = x - 1.5 + (i % 7) * 0.5, pz = z - 0.25 + Math.floor(i / 7) * 0.5;
      group.add(at(cyl(0.06, 0.06, 0.09, std('#fffaf4', { roughness: 0.4 }), 14), px, 0.9, pz));
      group.add(at(cyl(0.052, 0.052, 0.01, std(PAINT[i % PAINT.length], { roughness: 0.6 }), 14), px, 0.94, pz));
    }
    for (const bx of [x - 1.75, x + 1.75]) {
      group.add(at(cyl(0.07, 0.06, 0.16, std('#cfe6f5', { transparent: true, opacity: 0.5, roughness: 0.05 }), 14), bx, 0.93, z));
      for (let k = 0; k < 6; k++) group.add(at(cyl(0.006, 0.006, 0.3, std(PAINT[k]), 6).rotateZ((k - 2.5) * 0.08), bx + (k - 2.5) * 0.012, 1.05, z));
    }
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 1.1), new THREE.MeshBasicMaterial({ visible: false })), x, 0.95, z);
    group.add(hit);
    clickable(hit, { kind: 'art-table', label: 'The paint table' });
  }

  // ── the gallery wall: the latest paintings, in frames along the east wall
  const frames = [];
  {
    const FR = ['#2a2d33', '#c9a25b', '#7a4e33', '#f4ece0'];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
      const z = -3.3 + i * 2.2, y = 1.25 + r * 1.15;
      group.add(at(box(0.04, 0.84, 1.08, std(FR[(r * 4 + i) % 4], { roughness: 0.5 })), R.maxX - 0.03, y, z));
      const pic = at(new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.72), new THREE.MeshBasicMaterial({ map: blankTex(), toneMapped: false })), R.maxX - 0.06, y, z);
      pic.rotation.y = -Math.PI / 2;
      group.add(pic);
      clickable(pic, { kind: 'art-gallery', index: frames.length, label: 'A painting on the gallery wall' });
      frames.push(pic);
    }
    const sign = makeSign([{ text: 'The gallery wall', size: 100, weight: '700' }, { text: 'painted here, by all of us', font: 'Dancing Script, cursive', size: 70, color: '#c4627f' }], 1.5, 0.4, { bg: '#fbf8f2' });
    sign.position.set(R.maxX - 0.05, 3.2, 0); sign.rotation.y = -Math.PI / 2; group.add(sign);
  }
  // a paint-splashed sink, an apron rack, a drying rack of sketches
  {
    const x = 4.4, z = R.minZ + 0.35;
    group.add(at(rbox(1.2, 0.9, 0.6, 0.03, std('#e3eef0', { roughness: 0.5 })), x, 0.45, z));
    group.add(at(box(0.8, 0.04, 0.4, std('#c94a4a', { roughness: 0.4 })), x - 0.1, 0.91, z));
    group.add(at(cyl(0.015, 0.015, 0.25, std('#c0c4c8', { metalness: 0.7 }), 8), x, 1.05, z - 0.2));
    block(x, z, 1.2, 0.6);
    for (let i = 0; i < 4; i++) group.add(at(rbox(0.36, 0.7, 0.03, 0.01, std(PAINT[i], { roughness: 1 })), 1.5 + i * 0.45, 1.5, R.minZ + 0.06));
    const sign = makeSign([{ text: 'The Art Studio', size: 120, weight: '700' }, { text: 'make a mess · make something 🎨', font: 'Dancing Script, cursive', size: 66, color: '#c4627f' }], 1.6, 0.44, { bg: '#fbf8f2' });
    sign.position.set(-2.4, 2.9, R.minZ + 0.03); group.add(sign);
  }
  plant(group, colliders, R.minX + 0.45, R.maxZ - 0.45, 1.1);
  plant(group, colliders, R.maxX - 0.45, R.minZ + 0.45, 1.0);
  const lights = [pendant(group, R, -3.5, 0, { intensity: 2.6 }), pendant(group, R, 1.0, 0.2, { intensity: 2.4 }), pendant(group, R, 4.6, 0, { intensity: 2.4 })];
  doorOut({ group, R, makeSign, interactables, color: '#c94a4a', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  // pictures, from their URLs, into frames (or onto the easels)
  const loader = new THREE.TextureLoader();
  const put = (mesh, url) => {
    if (!url) { const old = mesh.material.map; mesh.material.map = blankTex(); mesh.material.needsUpdate = true; old?.dispose(); return; }
    loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; const old = mesh.material.map; mesh.material.map = t; mesh.material.needsUpdate = true; old?.dispose(); });
  };
  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.6, ry: Math.PI },
    // the latest paintings: [{ id, url, title, by }]
    setGallery(list = []) {
      frames.forEach((f, i) => { put(f, list[i] && list[i].url); f.userData.label = list[i] ? `“${list[i].title || 'Untitled'}” by ${list[i].by}` : 'An empty frame — paint something to hang here'; f.userData.painting = list[i] || null; });
      easelCanvases.forEach((c, i) => put(c, list[i + frames.length] && list[i + frames.length].url));
    },
  };
}
