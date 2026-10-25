// The Recording Studio: on the second floor, off the landing. A soundproofed
// booth behind glass with a microphone on a stand, headphones and an ON AIR
// light; the desk outside with its mixing board and speakers; foam on the
// walls; a sofa for listeners; and a shelf of the latest recordings people
// have made here — a BookBeans book chat, a story read aloud — that anyone
// can play (app.js, server/rooms.js).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, shell, doorOut, plant, pendant, chair } from './roomkit.js';

export const STUDIO = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, h: 3.2 };
const R = STUDIO;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

function foamTex() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#3a3346'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 64, y = j * 64, gr = g.createLinearGradient(x, y, x + ((i + j) % 2 ? 64 : 0), y + ((i + j) % 2 ? 0 : 64));
      gr.addColorStop(0, '#4a4258'); gr.addColorStop(1, '#2a2434');
      g.fillStyle = gr; g.fillRect(x + 2, y + 2, 60, 60);
    }
  }, [6, 2]);
}
function listTex(list) {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#16131f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c4627f'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'center'; g.fillStyle = '#f2a7bb'; g.font = 'bold 36px Georgia, serif'; g.fillText('🎙️ Recorded here', w / 2, 56);
    g.font = '24px Georgia, serif';
    if (!list.length) { g.fillStyle = '#8a8398'; g.fillText('nothing yet — step into the booth', w / 2, 170); }
    list.slice(0, 6).forEach((r, i) => {
      g.fillStyle = '#f4ece0'; g.fillText(`“${String(r.title).slice(0, 26)}”`, w / 2, 104 + i * 46);
      g.fillStyle = '#c9c2d6'; g.font = 'italic 18px Georgia, serif'; g.fillText(`${r.by} · ${Math.round(r.seconds || 0)}s`, w / 2, 124 + i * 46); g.font = '24px Georgia, serif';
    });
  });
}

export function buildStudio({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: canvasTex(64, 64, (g, w) => { g.fillStyle = '#2f2a3a'; g.fillRect(0, 0, w, w); }, [1, 1]),
    wallColor: '#3a3346', lowColor: '#2a2434', ceilColor: '#2a2434', wallsAreSurfaces: false,
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const dark = std('#1d1b22', { roughness: 0.5 }), steel = std('#c0c4c8', { metalness: 0.7, roughness: 0.3 });
  // foam panels on the walls, and a rug
  const foam = std('#ffffff', { map: foamTex(), roughness: 1 });
  for (const [w, x, z, ry] of [[11, 0, R.minZ + 0.05, 0], [9, R.minX + 0.05, 0, Math.PI / 2], [9, R.maxX - 0.05, 0, -Math.PI / 2]]) {
    const m = at(new THREE.Mesh(new THREE.PlaneGeometry(w, 2.2), foam), x, 1.5, z); m.rotation.y = ry; group.add(m);
  }
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), std('#7a3f5a', { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(1.6, 0.006, 1.4); group.add(rug);

  // ── the booth: glass at the front, the mic inside, the ON AIR light over it
  const BOOTH = { minX: R.minX, maxX: -1.2, minZ: R.minZ, maxZ: -1.4 };
  let onAir;
  {
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe6f5', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
    const fw = BOOTH.maxX - BOOTH.minX, fd = BOOTH.maxZ - BOOTH.minZ;
    group.add(at(box(fw, 1.0, 0.12, std('#2a2434')), (BOOTH.minX + BOOTH.maxX) / 2, 0.5, BOOTH.maxZ));
    group.add(at(new THREE.Mesh(new THREE.PlaneGeometry(fw - 1.0, 1.6), glass), (BOOTH.minX + BOOTH.maxX) / 2 - 0.5, 1.8, BOOTH.maxZ));
    group.add(at(box(0.12, R.h, fd, std('#2a2434')), BOOTH.maxX, R.h / 2, (BOOTH.minZ + BOOTH.maxZ) / 2));
    colliders.push({ type: 'box', fixed: true, minX: BOOTH.minX, maxX: BOOTH.maxX - 1.0, minZ: BOOTH.maxZ - 0.08, maxZ: BOOTH.maxZ + 0.08 });
    colliders.push({ type: 'box', fixed: true, minX: BOOTH.maxX - 0.08, maxX: BOOTH.maxX + 0.08, minZ: BOOTH.minZ, maxZ: BOOTH.maxZ });
    // the door into the booth (the gap at its east end), padded
    group.add(at(box(0.9, 2.3, 0.08, std('#4a4258', { roughness: 1 })), BOOTH.maxX - 0.5, 1.15, BOOTH.maxZ + 0.35).rotateY(0.9));
    // the mic, the stool, the headphones on a hook
    const mx = (BOOTH.minX + BOOTH.maxX) / 2, mz = (BOOTH.minZ + BOOTH.maxZ) / 2;
    const mic = new THREE.Group();
    mic.add(at(cyl(0.18, 0.2, 0.03, dark, 16), 0, 0.015, 0));
    mic.add(at(cyl(0.012, 0.012, 1.45, steel, 8), 0, 0.73, 0));
    mic.add(at(cyl(0.008, 0.008, 0.4, steel, 8).rotateZ(1.1), 0.16, 1.5, 0));
    mic.add(at(cyl(0.045, 0.04, 0.16, std('#2a2a2a', { metalness: 0.5, roughness: 0.4 }), 14).rotateZ(-0.4), 0.34, 1.6, 0));
    mic.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 6, 20), steel), 0.48, 1.6, 0)); // the pop filter
    mic.position.set(mx, 0, mz + 0.4); mic.rotation.y = -Math.PI / 2; group.add(mic);
    colliders.push({ type: 'circle', fixed: true, x: mx, z: mz + 0.4, r: 0.2 });
    clickable(mic, { kind: 'studio-mic', label: 'The microphone — record something 🎙️' });
    const seat = chair(group, seats, interactables, { id: 'studio-booth', label: 'the stool in the booth', x: mx, z: mz - 0.3, ry: 0, color: '#c4627f', y0: fy });
    seat.label = 'the stool in the booth';
    const phones = new THREE.Group();
    phones.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20, Math.PI), dark), 0, 0, 0));
    for (const s of [-1, 1]) phones.add(at(cyl(0.045, 0.045, 0.04, std('#c4627f'), 14).rotateZ(Math.PI / 2), s * 0.1, -0.02, 0));
    phones.position.set(BOOTH.minX + 0.08, 1.6, mz); phones.rotation.y = Math.PI / 2; group.add(phones);
    // ON AIR, over the glass
    onAir = std('#3a1418', { emissive: '#ff2a3a', emissiveIntensity: 0.05 });
    group.add(at(rbox(1.0, 0.3, 0.06, 0.04, onAir), mx, 2.85, BOOTH.maxZ + 0.08));
    const label = makeSign([{ text: 'ON AIR', size: 150, weight: '700', color: '#ffe0e4' }], 0.9, 0.22, { bg: '#7a1f2c', border: '#3a1418', radius: 30 });
    label.position.set(mx, 2.85, BOOTH.maxZ + 0.12); group.add(label);
    const sign = makeSign([{ text: 'The booth', size: 100, weight: '700' }, { text: 'quiet please 🤫', size: 64 }], 0.8, 0.28, { bg: '#f4ece0' });
    sign.position.set(BOOTH.maxX - 0.5, 2.5, BOOTH.maxZ + 0.6); sign.rotation.y = 0.9; group.add(sign);
  }

  // ── the desk outside: the mixing board, a laptop, the speakers
  {
    const x = 2.2, z = -3.6;
    group.add(at(rbox(3.0, 0.06, 0.9, 0.02, std('#5a3a26', { roughness: 0.5 })), x, 0.76, z));
    for (const a of [-1, 1]) group.add(at(box(0.06, 0.74, 0.8, dark), x + a * 1.4, 0.37, z));
    block(x, z, 3.0, 0.9);
    const board = at(rbox(1.2, 0.08, 0.5, 0.02, dark), x, 0.83, z); board.rotation.x = -0.15; group.add(board);
    for (let i = 0; i < 12; i++) group.add(at(box(0.025, 0.02, 0.08, std(i % 4 ? '#c0c4c8' : '#c4627f')), x - 0.5 + i * 0.09, 0.89, z + 0.05 - (i % 3) * 0.05));
    for (let i = 0; i < 12; i++) group.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), new THREE.MeshBasicMaterial({ color: i % 5 ? '#3fd08a' : '#ffd23f' })), x - 0.5 + i * 0.09, 0.9, z - 0.16).rotateX(-Math.PI / 2));
    for (const s of [-1, 1]) group.add(at(rbox(0.3, 0.45, 0.28, 0.03, dark), x + s * 1.15, 1.02, z - 0.1));
    for (const s of [-1, 1]) group.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), std('#444', { roughness: 0.6 })), x + s * 1.15, 1.0, z + 0.05));
    chair(group, seats, interactables, { id: 'studio-desk', label: 'the producer’s chair', x, z: z + 0.75, ry: Math.PI, color: '#2a2434', y0: fy });
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.6, 0.9), new THREE.MeshBasicMaterial({ visible: false })), x, 1.0, z);
    group.add(hit);
    clickable(hit, { kind: 'studio-play', label: 'The desk — listen to what’s been recorded here 🎧' });
  }
  // ── the board of recordings, the sofa for listeners
  const listMat = new THREE.MeshBasicMaterial({ map: listTex([]), toneMapped: false });
  {
    const b = at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), listMat), R.maxX - 0.08, 1.7, -1.2);
    b.rotation.y = -Math.PI / 2; group.add(b);
    clickable(b, { kind: 'studio-play', label: 'What’s been recorded here' });
    const sofaM = std('#c4627f', { roughness: 1 });
    const g = new THREE.Group();
    g.add(at(rbox(2.4, 0.45, 0.85, 0.12, sofaM), 0, 0.25, 0));
    g.add(at(rbox(2.4, 0.6, 0.22, 0.1, sofaM), 0, 0.6, -0.35));
    for (const s of [-1, 1]) g.add(at(rbox(0.2, 0.55, 0.85, 0.08, sofaM), s * 1.2, 0.4, 0));
    g.position.set(2.6, 0, 2.6); g.rotation.y = Math.PI; group.add(g);
    block(2.6, 2.6, 2.6, 0.9);
    [1.8, 2.6, 3.4].forEach((x, i) => {
      const s = { id: `studio-sofa-${i}`, label: 'the sofa', x, z: 2.5, y: fy, h: 0.5, ry: Math.PI };
      seats.push(s);
      if (!i) clickable(g, { kind: 'seat', seat: s, label: 'Sit and listen' });
    });
  }
  const name = makeSign([{ text: 'The Studio', size: 120, weight: '700', color: '#f2a7bb' }, { text: 'book chats · stories read aloud 🎙️', font: 'Dancing Script, cursive', size: 64, color: '#f4ece0' }], 1.6, 0.44, { bg: '#16131f', border: '#c4627f' });
  name.position.set(2.2, 2.6, R.minZ + 0.1); group.add(name);
  plant(group, colliders, R.maxX - 0.45, R.maxZ - 0.45, 1.0);
  const lights = [pendant(group, R, 2.2, -2.6, { intensity: 2.2, light: '#ffd0e0' }), pendant(group, R, 1.4, 2.0, { intensity: 2.0 }), pendant(group, R, -3.6, -3.2, { intensity: 1.6 })];
  doorOut({ group, R, makeSign, interactables, color: '#4a4258', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  let live = false;
  animate?.((dt, t) => { onAir.emissiveIntensity = live ? 1.6 + Math.sin(t * 3) * 0.2 : 0.05; });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.2, ry: Math.PI },
    setOnAir(on) { live = !!on; },
    setList(list = []) { const old = listMat.map; listMat.map = listTex(list); listMat.needsUpdate = true; old?.dispose(); },
  };
}
