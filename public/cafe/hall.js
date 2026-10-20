// The hallway upstairs: a long corridor everyone can walk along, with the
// rooms off it. Your own door is first on the left from the stairs; then the
// rooms you're invited into and the ones with their doors left open; the rest
// are other people's, closed. At the west end the stairs go back down to the
// café, at the east end they go on up to the roof garden, and the big double
// door there is the group study rooms.
//
// Like home.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const HALL = { minX: -15, maxX: 15, minZ: -1.8, maxZ: 1.8, h: 3.0 };
const H = HALL;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, m) => shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m));
const box = (w, h, d, m) => shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// seven doors down each side; side −1 is the north wall (z = minZ), +1 the south
const DOOR_XS = [-10.2, -6.8, -3.4, 0, 3.4, 6.8, 10.2];
export const SLOTS = [];
for (const x of DOOR_XS) for (const side of [-1, 1]) SLOTS.push({ x, side });
const DOOR_COLORS = ['#a8c3a0', '#e7b7c4', '#9db6cf', '#e8c98e', '#c9b3d9', '#d9a08b', '#b8cfc4'];
const DOOR_W = 1.0, DOOR_H = 2.2;

function woodTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  let s = 23; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 8; row++) {
    for (let x = -(row % 2) * 64; x < 256; x += 128) {
      const k = 0.85 + r() * 0.15;
      g.fillStyle = `rgb(${Math.round(176 * k)},${Math.round(128 * k)},${Math.round(88 * k)})`;
      g.fillRect(x, row * 32, 128, 32);
      g.fillStyle = 'rgba(60,35,20,0.25)'; g.fillRect(x, row * 32, 2, 32);
    }
    g.fillStyle = 'rgba(60,35,20,0.25)'; g.fillRect(0, row * 32, 256, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set((H.maxX - H.minX) / 4, (H.maxZ - H.minZ) / 4);
  return t;
}

export function buildHall({ floor, makeSign }) {
  const group = floor.group;
  const W = H.maxX - H.minX, D = H.maxZ - H.minZ;
  const wallM = std('#f1e7dc', { roughness: 0.95 });
  const wood = std('#8a5a3c', { roughness: 0.6 });
  const surfaces = [], interactables = [], seats = [];

  // floor, a long runner, the ceiling
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#ffffff', { map: woodTex(), roughness: 0.7 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);
  floor.floorMesh = floorMesh;
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.4, 1.3), std('#c4627f', { roughness: 1 }));
  runner.rotation.x = -Math.PI / 2; runner.position.y = 0.004; runner.receiveShadow = true;
  group.add(runner);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.6, 1.1), std('#e7b7c4', { roughness: 1 }));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.006; inner.receiveShadow = true;
  group.add(inner);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#fbf3ea', { roughness: 1, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H.h;
  group.add(ceil);

  // the long walls (notes can go on them) with a sage band along the bottom
  const wall = (w, h, x, y, z, ry = 0) => {
    const m = at(box(w, h, 0.16, wallM), x, y, z);
    m.rotation.y = ry;
    m.userData.surface = 'wall';
    group.add(m); surfaces.push(m);
    return m;
  };
  for (const side of [-1, 1]) {
    const z = side < 0 ? H.minZ - 0.08 : H.maxZ + 0.08;
    wall(W + 0.32, H.h, 0, H.h / 2, z);
    group.add(at(box(W, 0.14, 0.03, std('#93ab8c')), 0, 0.07, z - side * 0.095));
    group.add(at(box(W, 0.04, 0.03, std('#fbf3ea')), 0, H.h - 0.1, z - side * 0.095));
  }
  // the end walls, each with an opening onto the stairs
  const SW = 1.6, SH = 2.4;
  for (const end of [-1, 1]) {
    const x = end < 0 ? H.minX - 0.08 : H.maxX + 0.08;
    const side = (D - SW) / 2;
    wall(side, H.h, x, H.h / 2, H.minZ + side / 2, Math.PI / 2);
    wall(side, H.h, x, H.h / 2, H.maxZ - side / 2, Math.PI / 2);
    wall(SW, H.h - SH, x, SH + (H.h - SH) / 2, 0, Math.PI / 2);
    for (const z of [-SW / 2, SW / 2]) group.add(at(box(0.22, SH, 0.08, wood), x, SH / 2, z));
    group.add(at(box(0.22, 0.08, SW + 0.08, wood), x, SH, 0));
    // the stairwell beyond: steps going down (west) or up (east), into soft light
    const well = new THREE.Group();
    well.position.set(x, 0, 0);
    well.add(at(box(3.4, 0.1, SW + 0.4, std('#e9dccb')), end * 1.7, end < 0 ? -2.6 : 3.4, 0));
    for (const s of [-1, 1]) well.add(at(box(3.4, 6, 0.1, wallM), end * 1.7, end < 0 ? -1 : 2, s * (SW / 2 + 0.2)));
    well.add(at(box(0.1, 6, SW + 0.4, wallM), end * 3.4, end < 0 ? -1 : 2, 0));
    // covered all the way up: a roof over the well, the walls meeting it, a skylight
    const top = end < 0 ? H.h + 0.05 : 5.05;
    well.add(at(box(3.6, 0.14, SW + 0.6, std('#e6d8c6', { roughness: 1 })), end * 1.7, top + 0.07, 0));
    if (end < 0) {
      for (const s of [-1, 1]) well.add(at(box(3.4, H.h + 0.05 - 2, 0.1, wallM), end * 1.7, 2 + (H.h + 0.05 - 2) / 2, s * (SW / 2 + 0.2)));
      well.add(at(box(0.1, H.h + 0.05 - 2, SW + 0.4, wallM), end * 3.4, 2 + (H.h + 0.05 - 2) / 2, 0));
    }
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ color: '#dceaf5' }));
    sky.rotation.x = Math.PI / 2;
    well.add(at(sky, end * 1.9, top - 0.01, 0));
    for (let i = 0; i < 12; i++) {
      const step = rbox(0.3, 0.07, SW - 0.1, 0.02, std('#b58a63', { roughness: 0.6 }));
      well.add(at(step, end * (0.2 + i * 0.27), end < 0 ? -0.2 * (i + 1) : 0.2 * (i + 1), 0));
    }
    const glow = new THREE.PointLight('#ffe2b8', 1.2, 5, 1.6);
    glow.position.set(end * 1.6, end < 0 ? -0.6 : 2.4, 0);
    well.add(glow);
    group.add(well);
    const sign = makeSign(end < 0
      ? [{ text: '⬇ The café', size: 110, weight: '700' }, { text: 'back downstairs', size: 70 }]
      : [{ text: '⬆ Roof garden', size: 110, weight: '700' }, { text: 'up the stairs', size: 70 }], 1.0, 0.36);
    sign.position.set(x - end * 0.1, SH + 0.3, 0);
    sign.rotation.y = -end * Math.PI / 2;
    group.add(sign);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(x - end * 0.05, SH / 2, 0);
    hit.rotation.y = -end * Math.PI / 2;
    hit.userData = end < 0
      ? { kind: 'hall-down', label: 'Down the stairs to the café' }
      : { kind: 'hall-up', label: 'Up the stairs to the roof garden' };
    group.add(hit); interactables.push(hit);
  }

  // lights down the middle, paper shades
  const lights = [];
  for (const x of [-10, 0, 10]) {
    const l = new THREE.PointLight('#ffd9a6', 3, 12, 1.4);
    l.position.set(x, H.h - 0.5, 0);
    group.add(l); lights.push(l);
    const shadeM = std('#fff4e2', { emissive: '#ffe2b8', emissiveIntensity: 0.6, roughness: 1 });
    const lamp = at(new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), shadeM), x, H.h - 0.4, 0);
    lamp.scale.y = 0.8;
    group.add(lamp);
    group.add(at(box(0.01, 0.2, 0.01, std('#3a3030')), x, H.h - 0.1, 0));
  }
  for (const x of [-5.1, 5.1]) {
    const lamp = at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), std('#fff4e2', { emissive: '#ffe2b8', emissiveIntensity: 0.5 })), x, H.h - 0.3, 0);
    group.add(lamp);
  }

  // a bench by the stairs, and a couple of plants, a window at the far end
  const bench = new THREE.Group();
  bench.position.set(-12.15, 0, H.minZ + 0.32);
  bench.add(at(rbox(1.5, 0.08, 0.44, 0.03, wood), 0, 0.45, 0));
  bench.add(at(rbox(1.42, 0.06, 0.4, 0.03, std('#e7b7c4', { roughness: 1 })), 0, 0.52, 0));
  for (const s of [-1, 1]) bench.add(at(box(0.06, 0.45, 0.4, wood), s * 0.66, 0.225, 0));
  group.add(bench);
  for (const [i, x] of [-12.55, -11.75].entries()) seats.push({ id: `hall-bench-${i}`, label: 'the bench by the stairs', x, z: H.minZ + 0.55, y: group.position.y, h: 0.55, ry: 0 });
  bench.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', label: 'Sit on the bench', seat: seats[0] }; interactables.push(o); } });
  const plant = (x, z) => {
    const p = new THREE.Group();
    p.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.36, 18), std('#d8c3a5')), 0, 0.18, 0));
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, leaf = at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std('#6f9a5c')), Math.cos(a) * 0.12, 0.5 + (i % 3) * 0.12, Math.sin(a) * 0.12);
      leaf.scale.set(0.7, 1.4, 0.7); p.add(leaf);
    }
    group.add(at(p, x, 0, z));
  };
  plant(-11.6, H.maxZ - 0.35); plant(14.6, H.minZ + 0.35);
  // a round window above the bench by the stairs
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshBasicMaterial({ color: '#cfe6f5' }));
  win.position.set(-12.15, 2.0, H.minZ + 0.01);
  group.add(win);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 40), wood);
  ring.position.set(-12.15, 2.0, H.minZ + 0.03);
  group.add(ring);
  // the rooms everyone shares, each behind its own door at an end of the hallway:
  // the Common room (north wall, east end), the Music Room (south wall, west
  // end) and the Prayer Room (a single door, north wall, west end)
  const sharedDoor = ({ x, side, double = true, color, glass = '#fff1d6', lines, bg, kind, label }) => {
    const g = new THREE.Group();
    g.position.set(x, 0, side < 0 ? H.minZ : H.maxZ);
    g.rotation.y = side < 0 ? 0 : Math.PI; // facing into the corridor
    const hw = double ? 0.77 : 0.55;
    if (double) for (const s of [-1, 1]) g.add(at(rbox(0.7, DOOR_H + 0.1, 0.05, 0.015, std(color, { roughness: 0.55 })), s * 0.36, (DOOR_H + 0.1) / 2, 0.025));
    else g.add(at(rbox(1.0, DOOR_H + 0.1, 0.05, 0.015, std(color, { roughness: 0.55 })), 0, (DOOR_H + 0.1) / 2, 0.025));
    for (const s of double ? [-1, 1] : [0]) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.9), std(glass, { roughness: 0.1, emissive: '#ffd9a6', emissiveIntensity: 0.45 })), s * 0.36, 1.45, 0.055));
    for (const [w, h, dx, y] of [[0.1, DOOR_H + 0.15, -hw, (DOOR_H + 0.15) / 2], [0.1, DOOR_H + 0.15, hw, (DOOR_H + 0.15) / 2], [hw * 2 + 0.1, 0.1, 0, DOOR_H + 0.15]]) g.add(at(box(w, h, 0.08, wood), dx, y, 0.04));
    const sign = makeSign(lines, 1.1, 0.36, { bg });
    sign.position.set(0, DOOR_H + 0.45, 0.03);
    g.add(sign);
    const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 - 0.05, DOOR_H + 0.1), new THREE.MeshBasicMaterial({ visible: false })), 0, DOOR_H / 2, 0.1);
    hit.userData = { kind, label };
    g.add(hit); interactables.push(hit);
    group.add(g);
  };
  sharedDoor({ x: 13.2, side: -1, color: '#93ab8c', bg: '#fbe3ea', kind: 'hall-common', label: 'The Common room — sofas, the big TV, everyone who lives upstairs',
    lines: [{ text: 'Common Room', size: 110, weight: '700' }, { text: 'sofas · the big TV · tea', size: 66 }] });
  sharedDoor({ x: -13.2, side: 1, color: '#5b3a4a', glass: '#ffe0c0', bg: '#f3e1d0', kind: 'hall-music', label: 'The Music Room — a piano, a guitar and an open-mic stage',
    lines: [{ text: 'Music Room', size: 110, weight: '700' }, { text: 'piano · guitar · open mic 🎶', size: 66 }] });
  sharedDoor({ x: -13.95, side: -1, double: false, color: '#8a6a50', glass: '#f6efe3', bg: '#f6efe3', kind: 'hall-prayer', label: 'The Prayer Room — a quiet room for prayer and reflection',
    lines: [{ text: 'Prayer Room', size: 110, weight: '700' }, { text: 'غرفة الصلاة · a quiet room', size: 66 }] });

  // ── the doors
  const doorAt = ({ x, side }, color) => {
    const g = new THREE.Group();
    g.position.set(x, 0, side < 0 ? H.minZ : H.maxZ);
    g.rotation.y = side < 0 ? 0 : Math.PI; // facing into the corridor
    for (const [w, h, dx, y] of [[0.1, DOOR_H + 0.05, -DOOR_W / 2 - 0.05, DOOR_H / 2], [0.1, DOOR_H + 0.05, DOOR_W / 2 + 0.05, DOOR_H / 2], [DOOR_W + 0.2, 0.1, 0, DOOR_H + 0.05]]) {
      g.add(at(box(w, h, 0.08, wood), dx, y, 0.04));
    }
    const panelM = std(color, { roughness: 0.6 });
    g.add(at(rbox(DOOR_W, DOOR_H, 0.05, 0.015, panelM), 0, DOOR_H / 2, 0.025));
    for (const y of [0.6, 1.55]) g.add(at(rbox(DOOR_W - 0.3, y < 1 ? 0.7 : 0.8, 0.02, 0.01, std(new THREE.Color(color).multiplyScalar(0.92), { roughness: 0.6 })), 0, y, 0.055));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), std('#c9a25b', { metalness: 0.8, roughness: 0.3 })), DOOR_W / 2 - 0.12, 1.0, 0.08));
    const mat = at(rbox(0.8, 0.02, 0.5, 0.01, std('#d9c6a8', { roughness: 1 })), 0, 0.01, 0.35);
    g.add(mat);
    // warm light under the door when someone's in
    const under = at(new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W - 0.1, 0.25), new THREE.MeshBasicMaterial({ color: '#ffd59a', transparent: true, opacity: 0.55, depthWrite: false })), 0, 0.012, 0.16);
    under.rotation.x = -Math.PI / 2;
    under.visible = false;
    g.add(under);
    const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W + 0.2, DOOR_H + 0.1), new THREE.MeshBasicMaterial({ visible: false })), 0, DOOR_H / 2, 0.1);
    g.add(hit);
    interactables.push(hit);
    group.add(g);
    return { g, panelM, under, hit, plaque: null };
  };
  const doors = SLOTS.map((s, i) => doorAt(s, DOOR_COLORS[i % DOOR_COLORS.length]));
  // the group study rooms: a wide double door on the south wall at the east end
  const groupDoor = (() => {
    const g = new THREE.Group();
    g.position.set(13.2, 0, H.maxZ); g.rotation.y = Math.PI;
    for (const s of [-1, 1]) g.add(at(rbox(0.7, DOOR_H + 0.1, 0.05, 0.015, std('#6e472e', { roughness: 0.55 })), s * 0.36, (DOOR_H + 0.1) / 2, 0.025));
    for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.9), std('#dff1ff', { roughness: 0.1, emissive: '#fff1d6', emissiveIntensity: 0.3 })), s * 0.36, 1.45, 0.055));
    for (const [w, h, dx, y] of [[0.1, DOOR_H + 0.15, -0.77, (DOOR_H + 0.15) / 2], [0.1, DOOR_H + 0.15, 0.77, (DOOR_H + 0.15) / 2], [1.64, 0.1, 0, DOOR_H + 0.15]]) g.add(at(box(w, h, 0.08, wood), dx, y, 0.04));
    const sign = makeSign([{ text: 'Study rooms', size: 110, weight: '700' }, { text: 'for groups & clubs', size: 70 }], 1.1, 0.36);
    sign.position.set(0, DOOR_H + 0.45, 0.03);
    g.add(sign);
    const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, DOOR_H + 0.1), new THREE.MeshBasicMaterial({ visible: false })), 0, DOOR_H / 2, 0.1);
    hit.userData = { kind: 'hall-groups', label: 'The group study rooms — make one, or join with a code' };
    g.add(hit); interactables.push(hit);
    group.add(g);
    return g;
  })();
  void groupDoor;

  // Who's behind which door. mine: { ownerId, name }; others: [{ ownerId, name, ownerName, here, invited, open }]
  const byOwner = new Map();
  function setDoors(mine, others = []) {
    byOwner.clear();
    const list = [mine ? { ...mine, mine: true } : null, ...others].filter(Boolean).slice(0, doors.length);
    doors.forEach((d, i) => {
      const r = list[i] || null;
      if (d.plaque) { d.g.remove(d.plaque); d.plaque.material.map?.dispose(); d.plaque.material.dispose(); d.plaque.geometry.dispose(); d.plaque = null; }
      const n = String(i + 1).padStart(2, '0');
      const lines = r
        ? [{ text: r.mine ? 'Your room' : r.name, size: 100, weight: '700' }, { text: r.mine ? r.name : `${r.ownerName}'s · ${r.invited ? 'invited' : 'door open'}`, size: 62 }]
        : [{ text: `Room ${n}`, size: 110, weight: '700' }];
      d.plaque = makeSign(lines, 0.78, 0.26, r && r.mine ? { bg: '#fbe3ea' } : {});
      d.plaque.position.set(0, DOOR_H + 0.3, 0.05);
      d.g.add(d.plaque);
      d.under.visible = !!(r && r.here);
      d.hit.userData = r
        ? { kind: 'hall-door', ownerId: r.ownerId, label: r.mine ? `Your room — ${r.name}` : `Knock on ${r.ownerName}'s door${r.here ? ` · ${r.here} in there` : ''}` }
        : { kind: 'hall-door', ownerId: null, label: `Room ${n} — someone's room; the door is shut` };
      if (r) byOwner.set(Number(r.ownerId), i);
    });
  }
  setDoors(null, []);

  // standing in front of someone's door, your back to it (coming out of the room)
  function doorFront(ownerId) {
    const i = byOwner.get(Number(ownerId));
    if (i === undefined) return null;
    const s = SLOTS[i];
    return { x: s.x, z: s.side < 0 ? H.minZ + 0.9 : H.maxZ - 0.9, ry: s.side < 0 ? 0 : Math.PI };
  }

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: H.minX + 0.35, maxX: H.maxX - 0.35, minZ: H.minZ + 0.3, maxZ: H.maxZ - 0.3 }] });
  floor.colliders.push({ type: 'box', fixed: true, minX: -12.95, maxX: -11.35, minZ: H.minZ, maxZ: H.minZ + 0.56 });
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    setDoors, doorFront, lights, bounds: H,
    arrival: { x: H.minX + 1.4, z: 0.3, ry: Math.PI / 2 },   // at the top of the stairs from the café
    fromGarden: { x: H.maxX - 1.4, z: 0, ry: -Math.PI / 2 }, // down from the roof
    fromGroups: { x: 13.2, z: H.maxZ - 0.9, ry: Math.PI },
    fromCommon: { x: 13.2, z: H.minZ + 0.9, ry: 0 },       // out of the Common room's door
    fromMusic: { x: -13.2, z: H.maxZ - 0.9, ry: Math.PI },
    fromPrayer: { x: -13.95, z: H.minZ + 0.9, ry: 0 },
  };
}
