// The Sleepover Room: the second floor, up the stairs from the upper hallway.
// One big room for everyone: bunk beds along one wall and a row of beds along
// the other, each with a reading lamp; a big TV with a rug, beanbags and
// floor cushions in front of it (anyone in the room can put something on —
// everyone watches together, see app.js); a bathroom block with toilets in
// their stalls, showers and a row of sinks; and a midnight-snack corner with
// the kettle on. Fairy lights along the ceiling.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, plankTex, canvasTex, shell, doorOut, plant, pendant } from './roomkit.js';
import { furniturePiece } from './home.js';

export const SLEEPOVER = { minX: -10, maxX: 10, minZ: -6, maxZ: 6, h: 3.4 };
const R = SLEEPOVER;
// the bathroom block, in the north-east corner
const BATH = { minX: 5.2, maxX: R.maxX, minZ: R.minZ, maxZ: 1.6 };
const BATH_DOOR = { z0: -0.9, z1: 0.5 }; // the opening in its west wall
const QUILTS = ['#f2a7bb', '#93ab8c', '#9fb8d6', '#e8c98e', '#c9a0d6', '#f4b183', '#bfe3d6'];

function rugTex() {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#e9d5c0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c4627f'; g.lineWidth = 14; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = '#93ab8c'; g.lineWidth = 6; g.strokeRect(40, 40, w - 80, h - 80);
    g.fillStyle = '#f2a7bb';
    for (let y = 80; y < h - 60; y += 56) for (let x = 80; x < w - 60; x += 64) { g.beginPath(); g.arc(x + ((y / 56) % 2) * 32, y, 9, 0, Math.PI * 2); g.fill(); }
  });
}
function tileTex() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#eef3f1'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#c9d6d2'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, w); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  }, [(BATH.maxX - BATH.minX) / 1.2, (BATH.maxZ - BATH.minZ) / 1.2]);
}
// the TV's screen: off, or what's on
function screenTex(movie) {
  return canvasTex(768, 432, (g, w, h) => {
    if (!movie) {
      g.fillStyle = '#15171c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a8090'; g.font = 'italic 32px Georgia, serif'; g.textAlign = 'center';
      g.fillText('Click the TV to put something on', w / 2, h / 2 - 6);
      g.font = '24px Georgia, serif'; g.fillText('a film, a series, a playlist — anyone can', w / 2, h / 2 + 36);
      return;
    }
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1f2a4a'); gr.addColorStop(1, '#4a2a4c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(344, 120); g.lineTo(344, 240); g.lineTo(448, 180); g.fill();
    g.textAlign = 'center';
    g.font = 'bold 34px Georgia, serif'; g.fillStyle = '#fbe3ea'; g.fillText('Now showing', w / 2, 310);
    g.font = 'italic 28px Georgia, serif'; g.fillStyle = '#f4ece0'; g.fillText(String(movie.title || 'a film').slice(0, 44), w / 2, 352);
    if (movie.by) { g.font = '22px Georgia, serif'; g.fillStyle = '#c9c2d6'; g.fillText(`put on by ${movie.by}`.slice(0, 50), w / 2, 390); }
  });
}

export function buildSleepover({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces, wood } = shell({
    group, R, floor, floorMap: plankTex(R, [160, 118, 84], 53),
    wallColor: '#efe4f0', lowColor: '#9fb8d6', ceilColor: '#1f2340',
    windows: { west: [-2.9, 2.3] },
  });
  const fy = () => group.position.y;
  const put = (o, x, z, ry = 0, y = 0) => { o.position.set(x, y, z); o.rotation.y = ry; group.add(o); return o; };
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  // a box collider for something of footprint w × d at (x, z), turned by ry (0 or ±π/2 or π)
  const block = (x, z, w, d, ry = 0) => {
    const turned = Math.abs(Math.sin(ry)) > 0.5;
    const hw = (turned ? d : w) / 2, hd = (turned ? w : d) / 2;
    colliders.push({ type: 'box', fixed: true, minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
  };
  let beds = 0;
  // a bed to lie down in: where you lie, the same as a bed in your own room
  const bedSpot = (x, z, ry, top, label) => {
    const s = { id: `sleepover-bed-${beds++}`, label, x: x + 0.75 * Math.sin(ry), z: z + 0.75 * Math.cos(ry), y: fy() + top + 0.16, h: 0.2, ry, lie: true };
    seats.push(s);
    return s;
  };

  // ── bunk beds along the west wall, heads to the wall
  const BED = { w: 1.1, d: 2.1 };
  const postM = std('#6e472e', { roughness: 0.55 });
  [-4.2, -1.6, 1.0, 3.6].forEach((z, i) => {
    const x = R.minX + BED.d / 2 + 0.08, ry = Math.PI / 2;
    const g = new THREE.Group();
    const low = furniturePiece('bed', QUILTS[i % QUILTS.length]);
    const high = furniturePiece('bed', QUILTS[(i + 3) % QUILTS.length]);
    high.position.y = 1.3;
    g.add(low, high);
    // the posts, the guard rail up top and the ladder at the foot
    for (const a of [-1, 1]) for (const b of [-1, 1]) g.add(at(box(0.07, 2.3, 0.07, postM), a * (BED.w / 2 + 0.01), 1.15, b * (BED.d / 2 - 0.02)));
    for (const y of [1.98, 2.14]) g.add(at(box(0.04, 0.04, BED.d * 0.7, postM), BED.w / 2 + 0.01, y, -0.2));
    const lad = new THREE.Group();
    for (const s of [-1, 1]) lad.add(at(box(0.04, 1.75, 0.04, postM), s * 0.2, 0.88, 0));
    for (let r = 0; r < 5; r++) lad.add(at(box(0.4, 0.03, 0.03, postM), 0, 0.35 + r * 0.32, 0));
    lad.position.set(-BED.w / 2 - 0.05, 0, BED.d / 2 - 0.35); lad.rotation.y = Math.PI / 2;
    g.add(lad);
    put(g, x, z, ry);
    block(x, z, BED.w + 0.12, BED.d, ry);
    const lower = bedSpot(x, z, ry, 0.55, 'a bottom bunk');
    const upper = bedSpot(x, z, ry, 1.85, 'a top bunk');
    clickable(low, { kind: 'sleep-bed', seat: lower, label: 'Lie down on the bottom bunk 💤' });
    clickable(high, { kind: 'sleep-bed', seat: upper, label: 'Climb up to the top bunk 💤' });
  });

  // ── a row of beds along the south wall, either side of the door, with a lamp each
  [-7.4, -5.8, -4.2, -2.6, 2.3, 3.9].forEach((x, i) => {
    const z = R.maxZ - BED.d / 2 - 0.08, ry = Math.PI;
    const b = put(furniturePiece('bed', QUILTS[(i + 1) % QUILTS.length]), x, z, ry);
    block(x, z, BED.w, BED.d, ry);
    clickable(b, { kind: 'sleep-bed', seat: bedSpot(x, z, ry, 0.55, 'a bed by the wall'), label: 'Lie down here 💤' });
    if (i !== 3 && i !== 5) {
      const nx = x + 0.8, nz = R.maxZ - 0.3;
      put(furniturePiece('nightstand', '#9a6a46'), nx, nz, Math.PI);
      block(nx, nz, 0.46, 0.4);
      const lamp = at(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.16, 16, 1, true), std('#fff1d6', { emissive: '#ffcf8f', emissiveIntensity: 0.7, side: THREE.DoubleSide })), nx, 0.76, nz);
      group.add(lamp);
    }
  });
  // two floor futons by the windows, for when it's a big sleepover
  [[-6.6, -1.0], [-6.6, 1.6]].forEach(([x, z], i) => {
    const f = put(furniturePiece('futon', QUILTS[(i + 4) % QUILTS.length]), x, z, Math.PI / 2);
    clickable(f, { kind: 'sleep-bed', seat: bedSpot(x, z, Math.PI / 2, 0.16, 'a futon on the floor'), label: 'Curl up on the futon 💤' });
  });

  // ── the big TV on the north wall, the rug and somewhere to sit in front of it
  const TVX = -2.2;
  let screen;
  {
    const W = 3.2, H = 1.8, y = 1.75;
    group.add(at(rbox(W + 0.16, H + 0.16, 0.1, 0.03, std('#1b1c20', { roughness: 0.4 })), TVX, y, R.minZ + 0.07));
    screen = at(new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: screenTex(null), toneMapped: false })), TVX, y, R.minZ + 0.125);
    group.add(screen);
    clickable(screen, { kind: 'sleep-tv', label: 'The big TV — put something on for everyone 📺' });
    const console_ = at(rbox(2.6, 0.45, 0.45, 0.04, std('#7a4e33', { roughness: 0.6 })), TVX, 0.225, R.minZ + 0.25);
    group.add(console_);
    block(TVX, R.minZ + 0.25, 2.6, 0.45);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2), std('#ffffff', { map: rugTex(), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(TVX, 0.006, -2.6);
    group.add(rug);
    let n = 0;
    const sit = (kind, color, x, z, label) => {
      const o = put(furniturePiece(kind, color), x, z, 0);
      const s = { id: `sleepover-${kind}-${n++}`, label, x, z, y: fy(), h: kind === 'beanbag' ? 0.42 : 0.2, ry: Math.PI };
      seats.push(s);
      clickable(o, { kind: 'seat', seat: s, label: `Sit on ${label}` });
    };
    [-1.4, 0, 1.4].forEach((dx, i) => sit('beanbag', QUILTS[i], TVX + dx, -1.9, 'a beanbag in front of the TV'));
    [-2.0, -0.7, 0.7, 2.0].forEach((dx, i) => sit('floor-cushion', QUILTS[(i + 2) % QUILTS.length], TVX + dx, -3.2, 'a floor cushion by the TV'));
    const name = makeSign([{ text: 'The Sleepover Room', size: 120, weight: '700' }, { text: 'pyjamas on · lights low · film on 🌙', font: 'Dancing Script, cursive', size: 70, color: '#c4627f' }], 1.9, 0.48, { bg: '#f6eefa' });
    name.position.set(TVX, 3.0, R.minZ + 0.06);
    group.add(name);
  }

  // ── the bathroom block: tiled, behind its own walls, the opening on the west
  {
    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(BATH.maxX - BATH.minX, BATH.maxZ - BATH.minZ), std('#ffffff', { map: tileTex(), roughness: 0.35 }));
    tiles.rotation.x = -Math.PI / 2; tiles.position.set((BATH.minX + BATH.maxX) / 2, 0.008, (BATH.minZ + BATH.maxZ) / 2);
    group.add(tiles);
    const wallM = std('#e3eef0', { roughness: 0.9 }), WH = 2.5;
    const wallSeg = (x0, x1, z0, z1) => {
      const w = Math.max(0.14, x1 - x0), d = Math.max(0.14, z1 - z0);
      const m = at(box(w, WH, d, wallM), (x0 + x1) / 2, WH / 2, (z0 + z1) / 2);
      group.add(m);
      colliders.push({ type: 'box', fixed: true, minX: (x0 + x1) / 2 - w / 2, maxX: (x0 + x1) / 2 + w / 2, minZ: (z0 + z1) / 2 - d / 2, maxZ: (z0 + z1) / 2 + d / 2 });
    };
    wallSeg(BATH.minX - 0.07, BATH.minX + 0.07, BATH.minZ, BATH_DOOR.z0);
    wallSeg(BATH.minX - 0.07, BATH.minX + 0.07, BATH_DOOR.z1, BATH.maxZ);
    wallSeg(BATH.minX - 0.07, BATH.maxX, BATH.maxZ - 0.07, BATH.maxZ + 0.07);
    const sign = makeSign([{ text: '🚿 Bathroom', size: 110, weight: '700' }, { text: 'toilets · showers · sinks', size: 64 }], 1.0, 0.32, { bg: '#e3eef0' });
    sign.position.set(BATH.minX - 0.09, 2.2, (BATH_DOOR.z0 + BATH_DOOR.z1) / 2); sign.rotation.y = -Math.PI / 2;
    group.add(sign);
    // three toilets in their stalls along the north wall
    const stallM = std('#9fb8d6', { roughness: 0.6 });
    [6.1, 7.5, 8.9].forEach((x, i) => {
      const t = put(furniturePiece('toilet', '#fffaf4'), x, R.minZ + 0.42, 0);
      block(x, R.minZ + 0.42, 0.42, 0.68);
      clickable(t, { kind: 'sleep-thing', label: 'A toilet', say: ['🚽 All yours. The lock works, the paper is stocked — someone even folded the end into a little triangle.', '🚽 Lovely and clean. A little sign says: “Please put the seat down. Love, the café.”', '🚽 There is a tiny pot of jasmine on the cistern. Somebody cares.'][i] });
      for (const s of [-1, 1]) {
        const px = x + s * 0.7;
        if (px > BATH.minX + 0.1 && px < BATH.maxX - 0.1) group.add(at(box(0.05, 1.9, 1.35, stallM), px, 1.0, R.minZ + 0.68));
      }
      // a half-open stall door
      const door = at(box(0.05, 1.7, 0.62, stallM), x - 0.66, 0.95, R.minZ + 1.66);
      door.rotation.y = 0.9; group.add(door);
    });
    // a row of sinks with mirrors on the east wall
    [-2.6, -1.6, -0.6].forEach(z => {
      put(furniturePiece('bath-sink', '#fffaf4'), BATH.maxX - 0.24, z, -Math.PI / 2);
      block(BATH.maxX - 0.24, z, 0.62, 0.46, -Math.PI / 2);
    });
    clickable(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 3.0), new THREE.MeshBasicMaterial({ visible: false })), BATH.maxX - 0.25, 1.1, -1.6), { kind: 'sleep-thing', label: 'The sinks', say: '🪥 You wash your face and brush your teeth. There are spare toothbrushes in a jar, still in their wrappers, and the soap smells of orange blossom.' });
    // two showers against the bathroom's south wall
    [6.0, 7.2].forEach((x, i) => {
      const sh = put(furniturePiece('shower', i ? '#f2c6d0' : '#dff1ff'), x, BATH.maxZ - 0.55, Math.PI);
      clickable(sh, { kind: 'sleep-thing', label: 'A shower', say: '🚿 Hot water straight away, and fluffy towels on the rail. You come out pink and sleepy.' });
    });
    put(furniturePiece('towel-rail', '#f2a7bb'), 8.4, BATH.maxZ - 0.17, Math.PI);
    put(furniturePiece('towel-rail', '#93ab8c'), 9.2, BATH.maxZ - 0.17, Math.PI);
    pendant(group, R, 7.6, -1.6, { color: '#f4fbff', light: '#eaf6ff', intensity: 2.0, drop: 0.5 });
  }

  // ── the midnight-snack corner (south-east): a counter, the kettle, a fridge, lockers
  {
    const cz = 3.4;
    group.add(at(rbox(0.6, 0.9, 2.2, 0.03, std('#93ab8c', { roughness: 0.6 })), R.maxX - 0.32, 0.45, cz));
    group.add(at(rbox(0.66, 0.05, 2.26, 0.02, std('#f4ece0', { roughness: 0.4 })), R.maxX - 0.32, 0.92, cz));
    block(R.maxX - 0.32, cz, 0.6, 2.2);
    const kettle = at(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 18), std('#c4627f', { roughness: 0.3, metalness: 0.2 })), R.maxX - 0.32, 1.06, cz - 0.6);
    group.add(kettle);
    for (let i = 0; i < 4; i++) group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 12), std(QUILTS[i], { roughness: 0.4 })), R.maxX - 0.4 + (i % 2) * 0.12, 0.99, cz - 0.1 + Math.floor(i / 2) * 0.14));
    const jar = at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 16), std('#e8f2f4', { roughness: 0.05, transparent: true, opacity: 0.6 })), R.maxX - 0.32, 1.07, cz + 0.5);
    group.add(jar);
    for (let i = 0; i < 6; i++) group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std('#c98a4a')), R.maxX - 0.36 + (i % 2) * 0.06, 0.99 + Math.floor(i / 2) * 0.05, cz + 0.48));
    group.add(at(rbox(0.7, 1.7, 0.66, 0.04, std('#fffaf4', { roughness: 0.35 })), R.maxX - 0.38, 0.85, cz + 1.75));
    block(R.maxX - 0.38, cz + 1.75, 0.7, 0.66);
    clickable(at(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 3.0), new THREE.MeshBasicMaterial({ visible: false })), R.maxX - 0.35, 0.9, cz + 0.4), { kind: 'sleep-thing', label: 'The midnight-snack corner', say: '🫖 The kettle’s just boiled. There’s hot chocolate, karkadeh and mint tea, a jar of ghorayeba, and leftover basbousa in the fridge with a note: “for whoever’s up late 💗”.' });
    const sign = makeSign([{ text: '🌙 Midnight snacks', size: 100, weight: '700' }, { text: 'help yourself', font: 'Dancing Script, cursive', size: 70, color: '#c4627f' }], 0.95, 0.34, { bg: '#fbf3ea' });
    sign.position.set(R.maxX - 0.03, 1.75, cz - 0.2); sign.rotation.y = -Math.PI / 2;
    group.add(sign);
    // lockers along the bathroom's outside wall, for your things
    for (let i = 0; i < 5; i++) {
      const lx = 5.75 + i * 0.62;
      group.add(at(rbox(0.58, 1.8, 0.45, 0.02, std(QUILTS[i % QUILTS.length], { roughness: 0.55 })), lx, 0.9, BATH.maxZ + 0.3));
      group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std('#c9a25b', { metalness: 0.7, roughness: 0.3 })), lx + 0.2, 1.0, BATH.maxZ + 0.53));
    }
    colliders.push({ type: 'box', fixed: true, minX: 5.45, maxX: 8.6, minZ: BATH.maxZ, maxZ: BATH.maxZ + 0.55 });
  }

  // ── fairy lights round the ceiling, a few soft lamps, plants, a moon on the ceiling
  const fairy = [];
  {
    const bulbM = std('#fff3c8', { emissive: '#ffd98a', emissiveIntensity: 1.2 });
    const along = (x0, z0, x1, z1, n) => {
      for (let i = 0; i <= n; i++) {
        const t = i / n, sag = Math.sin(t * Math.PI * 6) * 0.1;
        const b = at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bulbM.clone()), x0 + (x1 - x0) * t, R.h - 0.18 - Math.abs(sag), z0 + (z1 - z0) * t);
        group.add(b); fairy.push(b);
      }
    };
    along(R.minX + 0.15, R.minZ + 0.15, BATH.minX - 0.2, R.minZ + 0.15, 40);
    along(R.minX + 0.15, R.minZ + 0.15, R.minX + 0.15, R.maxZ - 0.15, 36);
    along(R.minX + 0.15, R.maxZ - 0.15, R.maxX - 0.15, R.maxZ - 0.15, 60);
    const moon = at(new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshBasicMaterial({ color: '#fff4cf' })), -1.0, R.h - 0.01, 0.8);
    moon.rotation.x = Math.PI / 2; group.add(moon);
    const starM = new THREE.MeshBasicMaterial({ color: '#fff9e6' });
    for (let i = 0; i < 70; i++) {
      const s = at(new THREE.Mesh(new THREE.CircleGeometry(0.02 + (i % 4) * 0.012, 6), starM), R.minX + 0.5 + ((i * 7.31) % 1) * 14.5, R.h - 0.012, R.minZ + 0.4 + ((i * 3.77) % 1) * 11.2);
      s.rotation.x = Math.PI / 2; group.add(s);
    }
  }
  animate?.((dt, t) => { fairy.forEach((b, i) => { b.material.emissiveIntensity = 0.8 + 0.5 * Math.sin(t * 1.6 + i * 0.7); }); });
  const lights = [pendant(group, R, -2.2, -0.2, { intensity: 2.0, drop: 0.6 }), pendant(group, R, -6.5, 0.3, { intensity: 1.8, drop: 0.6 }), pendant(group, R, 2.4, 2.6, { intensity: 1.8, drop: 0.6 })];
  plant(group, colliders, 1.5, R.minZ + 0.45, 1.0);
  plant(group, colliders, -1.1, R.maxZ - 0.4, 0.9);
  {
    const board = makeSign([
      { text: '🛏️ Sleepover rules', size: 96, weight: '700' },
      { text: 'Any bed is yours tonight.', size: 58 },
      { text: 'Anyone can put the TV on —', size: 58 },
      { text: 'be kind about what you pick.', size: 58 },
      { text: 'Whisper after midnight 🤫', size: 58 },
    ], 0.95, 0.82, { bg: '#f6eefa', border: '#7a4e33' });
    board.position.set(1.4, 1.55, R.maxZ - 0.03); board.rotation.y = Math.PI;
    group.add(board);
  }
  doorOut({ group, R, makeSign, interactables, color: '#4f7a5a', to: 'landing', sign: '⬅ The landing', label: 'Back out to the landing' });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R, screen,
    arrival: { x: 0, z: R.maxZ - 2.8, ry: Math.PI }, // a few steps in from the stairs, the TV ahead
    setMovie(m) {
      const old = screen.material.map;
      screen.material.map = screenTex(m || null);
      screen.material.needsUpdate = true;
      if (old) old.dispose();
    },
  };
}
