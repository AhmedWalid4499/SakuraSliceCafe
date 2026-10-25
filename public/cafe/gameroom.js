// The Games Room: on the second floor, off the landing. A pool table under a
// long green lamp, a ping-pong table, a baby-foot table (every ahwa in Cairo
// has one), three game tables where chess, tawla, snakes and ladders and
// Sakura Eights are played like at the café's tables downstairs, a shelf of
// board games, and the high-score board (arcade.js, server/rooms.js).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, plankTex, canvasTex, shell, doorOut, plant, pendant, chair } from './roomkit.js';

export const GAMEROOM = { minX: -8, maxX: 8, minZ: -6, maxZ: 6, h: 3.4 };
const R = GAMEROOM;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const ARCADE_NAMES = { pingpong: '🏓 Ping-pong', pool: '🎱 Pool', foosball: '⚽ Baby-foot' };

function scoreTex(scores) {
  return canvasTex(768, 512, (g, w, h) => {
    g.fillStyle = '#16131f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2a7bb'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#ffd98a'; g.font = 'bold 50px Georgia, serif'; g.textAlign = 'center';
    g.fillText('★ HIGH SCORES ★', w / 2, 72);
    const cols = Object.keys(ARCADE_NAMES);
    cols.forEach((k, i) => {
      const x = 40 + i * ((w - 80) / 3) + (w - 80) / 6;
      g.fillStyle = '#9fe0ff'; g.font = 'bold 30px Georgia, serif'; g.fillText(ARCADE_NAMES[k], x, 136);
      const list = (scores && scores[k]) || [];
      g.font = '26px Georgia, serif';
      if (!list.length) { g.fillStyle = '#8a8398'; g.fillText('— nobody yet —', x, 190); }
      list.slice(0, 5).forEach((s, j) => {
        g.fillStyle = j ? '#f4ece0' : '#ffd98a';
        g.fillText(`${j + 1}. ${String(s.name).slice(0, 12)}  ${s.score}`, x, 190 + j * 52);
      });
    });
    g.fillStyle = '#c4627f'; g.font = 'italic 24px Georgia, serif'; g.fillText('click a table to play — your best goes up here', w / 2, h - 34);
  });
}

export function buildGameRoom({ floor, makeSign }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [150, 110, 80], 23),
    wallColor: '#eef4f2', lowColor: '#4f8a9a', ceilColor: '#3a3646',
    windows: { west: [-3.5, 2.5] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const wood = std('#5a3a26', { roughness: 0.5 });

  // ── the pool table, under its long lamp
  {
    const x = -3.2, z = -2.4, W = 2.6, D = 1.4;
    const t = new THREE.Group();
    t.add(at(rbox(W + 0.24, 0.22, D + 0.24, 0.05, wood), 0, 0.72, 0));
    t.add(at(box(W, 0.02, D, std('#2f7a4a', { roughness: 1 })), 0, 0.835, 0));
    for (const a of [-1, 1]) for (const b of [-1, 1]) t.add(at(box(0.16, 0.65, 0.16, wood), a * (W / 2 - 0.05), 0.32, b * (D / 2 - 0.05)));
    for (const [px, pz] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) t.add(at(cyl(0.06, 0.06, 0.03, std('#111')), px * (W / 2 - 0.02), 0.84, pz * (D / 2 - 0.02)));
    const COL = ['#e2b04a', '#3a5fc4', '#c94a4a', '#7a3fa0', '#e07a2a', '#2f8a4a', '#8a2a2a', '#111'];
    let k = 0;
    for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) if (k < 8) t.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), std(COL[k++], { roughness: 0.2 })), 0.6 + row * 0.055, 0.876, (i - row / 2) * 0.062));
    t.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), std('#fffaf0', { roughness: 0.2 })), -0.7, 0.876, 0));
    const cueStick = at(cyl(0.008, 0.014, 1.45, std('#d9b37a', { roughness: 0.5 })), -0.2, 0.9, 0.3); cueStick.rotation.z = Math.PI / 2 - 0.06; cueStick.rotation.y = 0.3; t.add(cueStick);
    t.position.set(x, 0, z); group.add(t);
    block(x, z, W + 0.3, D + 0.3);
    clickable(t, { kind: 'arcade', game: 'pool', label: 'The pool table — play a frame 🎱' });
    // the lamp over it
    group.add(at(box(1.8, 0.14, 0.34, std('#2f5d3a', { roughness: 0.5, emissive: '#1d3a24', emissiveIntensity: 0.3 })), x, 2.25, z));
    for (const s of [-1, 1]) group.add(at(cyl(0.006, 0.006, 1.05, std('#333'), 6), x + s * 0.7, 2.85, z));
    const l = new THREE.PointLight('#ffe7b8', 3, 5, 1.6); l.position.set(x, 2.0, z); group.add(l);
    // a cue rack on the west wall
    const rack = new THREE.Group();
    rack.add(at(box(0.06, 0.12, 0.9, wood), 0, 0.9, 0));
    rack.add(at(box(0.06, 0.12, 0.9, wood), 0, 1.55, 0));
    for (let i = 0; i < 5; i++) rack.add(at(cyl(0.008, 0.014, 1.45, std(i % 2 ? '#d9b37a' : '#b58a63', { roughness: 0.5 })), 0.04, 1.05, -0.36 + i * 0.18));
    rack.position.set(R.minX + 0.05, 0, -0.6); group.add(rack);
  }

  // ── the ping-pong table
  {
    const x = 3.9, z = -3.0, W = 2.74, D = 1.52;
    const t = new THREE.Group();
    t.add(at(box(W, 0.04, D, std('#1f4f7a', { roughness: 0.6 })), 0, 0.76, 0));
    t.add(at(box(W, 0.002, 0.02, std('#ffffff')), 0, 0.782, 0));
    t.add(at(box(0.02, 0.002, D, std('#ffffff')), 0, 0.782, 0));
    for (const s of [-1, 1]) t.add(at(box(0.02, 0.002, D, std('#ffffff')), s * (W / 2 - 0.02), 0.782, 0));
    t.add(at(box(0.02, 0.15, D + 0.1, std('#f4f4f4', { transparent: true, opacity: 0.8 })), 0, 0.855, 0)); // the net
    for (const a of [-1, 1]) for (const b of [-1, 1]) t.add(at(box(0.06, 0.74, 0.06, std('#333')), a * (W / 2 - 0.25), 0.37, b * (D / 2 - 0.15)));
    for (const s of [-1, 1]) {
      const bat = new THREE.Group();
      bat.add(at(cyl(0.08, 0.08, 0.012, std(s < 0 ? '#c94a4a' : '#222'), 20), 0, 0, 0));
      bat.add(at(box(0.03, 0.012, 0.1, std('#b58a63')), 0, 0, 0.12));
      bat.position.set(s * 0.9, 0.79, s * 0.3); t.add(bat);
    }
    t.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), std('#fff8e8')), 0.3, 0.8, -0.2));
    t.position.set(x, 0, z); group.add(t);
    block(x, z, W, D);
    clickable(t, { kind: 'arcade', game: 'pingpong', label: 'The ping-pong table — rally with Yuto 🏓' });
  }

  // ── baby-foot
  {
    const x = 4.4, z = 1.2, W = 1.2, D = 0.7;
    const t = new THREE.Group();
    t.add(at(rbox(W, 0.28, D, 0.03, std('#7a4e33', { roughness: 0.5 })), 0, 0.82, 0));
    t.add(at(box(W - 0.1, 0.01, D - 0.08, std('#3f8a4a', { roughness: 1 })), 0, 0.82, 0));
    for (const a of [-1, 1]) for (const b of [-1, 1]) t.add(at(box(0.08, 0.7, 0.08, std('#5a3a26')), a * (W / 2 - 0.06), 0.35, b * (D / 2 - 0.06)));
    for (let i = 0; i < 8; i++) {
      const rx = -W / 2 + 0.12 + i * (W - 0.24) / 7;
      const rod = at(cyl(0.008, 0.008, D + 0.36, std('#c0c4c8', { metalness: 0.7, roughness: 0.3 }), 8), rx, 0.92, 0); rod.rotation.x = Math.PI / 2; t.add(rod);
      for (const s of [-1, 0, 1]) t.add(at(box(0.03, 0.1, 0.03, std(i % 2 ? '#2f5fc4' : '#c4627f')), rx, 0.89, s * 0.18));
      for (const s of [-1, 1]) t.add(at(cyl(0.02, 0.02, 0.08, std('#222'), 8).rotateX(Math.PI / 2), rx, 0.92, s * (D / 2 + 0.2)));
    }
    t.position.set(x, 0, z); t.rotation.y = Math.PI / 2; group.add(t);
    block(x, z, D + 0.5, W);
    clickable(t, { kind: 'arcade', game: 'foosball', label: 'The baby-foot table — ten shots past the keeper ⚽' });
  }

  // ── three game tables, for the board and card games (games.js finds them by tableId)
  const tableTops = [];
  [[-6.0, 0.9], [-6.0, 3.9], [-3.0, 3.9]].forEach(([x, z], i) => {
    const id = `games-t${i + 1}`;
    const top = at(rbox(1.0, 0.05, 1.0, 0.02, std('#8a5a3c', { roughness: 0.5 })), x, 0.75, z);
    top.userData = { tableId: id, top: 0.775, label: 'a game table' };
    group.add(top); surfaces.push(top); tableTops.push(top);
    group.add(at(cyl(0.05, 0.05, 0.72, std('#2a1e1a'), 10), x, 0.37, z));
    group.add(at(cyl(0.3, 0.3, 0.03, std('#2a1e1a'), 18), x, 0.015, z));
    colliders.push({ type: 'circle', fixed: true, x, z, r: 0.55 });
    [[0, -0.85, 0], [0, 0.85, Math.PI], [-0.85, 0, Math.PI / 2], [0.85, 0, -Math.PI / 2]].forEach(([dx, dz, ry], ci) => {
      chair(group, seats, interactables, { id: `${id}-${ci}`, label: 'a game table', x: x + dx, z: z + dz, ry, color: ci % 2 ? '#2f5d6e' : '#c4627f', y0: group.position.y, table: id });
    });
  });
  // the board-game shelf
  {
    const x = R.minX + 0.25, z = -4.6;
    const sh = new THREE.Group();
    sh.add(at(box(0.4, 2.0, 1.5, wood), 0, 1.0, 0));
    const BOX = ['#c94a4a', '#3a5fc4', '#e2b04a', '#2f8a4a', '#7a3fa0', '#e58aa6', '#e07a2a', '#5f8fc4'];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) sh.add(at(box(0.32, 0.08 + ((r + i) % 3) * 0.03, 0.42, std(BOX[(r * 3 + i) % BOX.length], { roughness: 0.6 })), 0.06, 0.32 + r * 0.45, -0.48 + i * 0.47));
    sh.position.set(x, 0, z); group.add(sh);
    block(x, z, 0.45, 1.5);
    clickable(sh, { kind: 'games-shelf', label: 'The board games' });
  }

  // ── the high-score board on the north wall, and the name in lights
  const boardMat = new THREE.MeshBasicMaterial({ map: scoreTex(null), toneMapped: false });
  {
    const board = at(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), boardMat), 0.2, 1.8, R.minZ + 0.09);
    group.add(board);
    group.add(at(box(2.56, 1.76, 0.06, std('#2a1e1a')), 0.2, 1.8, R.minZ + 0.02));
    clickable(board, { kind: 'arcade-board', label: 'The high scores' });
    const neon = makeSign([{ text: 'GAMES ROOM', size: 130, weight: '700', color: '#f2a7bb' }], 1.8, 0.36, { bg: '#16131f', border: '#9fe0ff' });
    neon.position.set(0.2, 2.98, R.minZ + 0.06);
    group.add(neon);
  }

  plant(group, colliders, R.maxX - 0.45, R.maxZ - 0.45, 1.0);
  plant(group, colliders, R.minX + 0.45, R.maxZ - 0.45, 1.0);
  const lights = [pendant(group, R, 3.9, -3.0, { intensity: 3.2 }), pendant(group, R, -4.5, 2.4, { intensity: 3.0 }), pendant(group, R, 3.5, 2.6, { intensity: 2.6 }), pendant(group, R, 0, 0.5, { intensity: 2.6 })];
  doorOut({ group, R, makeSign, interactables, color: '#2f5d6e', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 2.2, ry: Math.PI },
    setScores(scores) {
      const old = boardMat.map;
      boardMat.map = scoreTex(scores); boardMat.needsUpdate = true;
      old?.dispose();
    },
  };
}
