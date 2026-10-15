// The café: room, furniture, the team, the view of Cairo outside, and the
// light — which follows Cairo's real time of day.
//
// Units are metres. The room runs x −11…11, z −8…8, and is 4.2 m tall.
// The entrance is on the front wall (z = +8); the back door (z = −8) opens
// onto a Cairo street with minarets and palms.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildAvatar, makeLabel } from './avatar.js';
import { mapX, mapZ, deltaAt, OLD } from './layout.mjs';

export const ROOM = { minX: -15, maxX: 15, minZ: -11, maxZ: 11, h: 4.2 };
export const FLOOR2_Y = 4.4;      // the upstairs floor
export const FLOOR2_H = 3.6;      // upstairs ceiling height
export const STAIRS = { x: mapX(1.1), z: mapZ(-6.7), r: 1.15 };

const COLORS = {
  plaster: '#f6ece2', sage: '#9fbf98', sageDark: '#6f9a6c', wood: '#a8754f', woodDark: '#7a5236',
  woodLight: '#c99b72', cream: '#fef9f5', sakura: '#f2a7bb', sakuraDark: '#d4678a', forest: '#2f5d3a',
  amber: '#f0b56a', text: '#2d1f1f',
};

const SEG = 48;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

// Keep something clear of the outdoor haze (mist, dust, rain).
export function noFog(obj) {
  obj.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.fog = false; }); });
  return obj;
}

// Built at the café's real size already — not spread out by layout.mjs.
function fixed(obj) {
  obj.userData.fixed = true;
  return obj;
}

function shadowy(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function rbox(w, h, d, r, material) {
  return shadowy(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), material));
}

// ───────────────────────────────────────── generated textures (high-res, smooth)

function canvasTex(size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}

function rand(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function woodFloorTexture() {
  return canvasTex(1024, (ctx, s) => {
    const r = rand(7);
    const rows = 8;
    const ph = s / rows;
    for (let row = 0; row < rows; row++) {
      let x = -r() * 300;
      while (x < s) {
        const len = 260 + r() * 300;
        const l = 52 + r() * 12;
        ctx.fillStyle = `hsl(${26 + r() * 6}, ${38 + r() * 10}%, ${l}%)`;
        ctx.fillRect(x, row * ph, len, ph);
        // grain
        ctx.globalAlpha = 0.08;
        for (let g = 0; g < 9; g++) {
          ctx.strokeStyle = r() < 0.5 ? '#5a3a22' : '#f3d2b0';
          ctx.lineWidth = 1 + r() * 2;
          ctx.beginPath();
          const y = row * ph + r() * ph;
          ctx.moveTo(x, y);
          ctx.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 10, x + len * 0.7, y + (r() - 0.5) * 10, x + len, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(70,40,20,0.35)';
        ctx.fillRect(x, row * ph, 2, ph);
        x += len;
      }
      ctx.fillStyle = 'rgba(70,40,20,0.3)';
      ctx.fillRect(0, row * ph, s, 2);
    }
  }, { repeat: [5, 4] });
}

function corkTexture() {
  return canvasTex(512, (ctx, s) => {
    ctx.fillStyle = '#c69c6d';
    ctx.fillRect(0, 0, s, s);
    const r = rand(3);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(120,80,40,0.35)' : 'rgba(240,210,170,0.35)';
      const d = 1 + r() * 2.5;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, d, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: [3, 1.4] });
}

function rugTexture() {
  return canvasTex(1024, (ctx, s) => {
    ctx.fillStyle = '#e9d9c4';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = COLORS.sageDark;
    ctx.lineWidth = 26;
    ctx.strokeRect(50, 50, s - 100, s - 100);
    ctx.strokeStyle = COLORS.sakura;
    ctx.lineWidth = 10;
    ctx.strokeRect(100, 100, s - 200, s - 200);
    // little sakura flowers in the middle
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const cx = 220 + i * 145, cy = 220 + j * 145;
        ctx.fillStyle = (i + j) % 2 ? COLORS.sakura : '#f7c9d5';
        for (let p = 0; p < 5; p++) {
          const a = p * Math.PI * 2 / 5;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, 14, 9, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#f6d365';
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
}

function petalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 70, 4, 64, 64, 60);
  g.addColorStop(0, '#fff0f4');
  g.addColorStop(1, '#f2a7bb');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(64, 8);
  ctx.bezierCurveTo(120, 30, 112, 110, 64, 122);
  ctx.bezierCurveTo(16, 110, 8, 30, 64, 8);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A sign painted on a canvas. lines: [{ text, font, color }]
export function makeSign(lines, w, h, { bg = COLORS.cream, border = COLORS.woodDark, radius = 40, pad = 0 } = {}) {
  const px = 1024;
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round(px * h / w);
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(pad, pad, c.width - pad * 2, c.height - pad * 2, radius);
    ctx.fill();
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 14;
      ctx.stroke();
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let total = lines.reduce((a, l) => a + (l.size || 100) * 1.25, 0);
  const fit = Math.min(1, (c.height * 0.9) / total);
  if (fit < 1) { lines = lines.map(l => ({ ...l, size: Math.floor((l.size || 100) * fit) })); total *= fit; }
  let y = c.height / 2 - total / 2;
  for (const l of lines) {
    let size = l.size || 100;
    ctx.font = `${l.weight || ''} ${size}px ${l.font || 'Playfair Display, serif'}`;
    const room = c.width - 80;
    const wText = ctx.measureText(l.text).width;
    if (wText > room) {
      size = Math.floor(size * room / wText);
      ctx.font = `${l.weight || ''} ${size}px ${l.font || 'Playfair Display, serif'}`;
    }
    ctx.fillStyle = l.color || COLORS.text;
    y += size * 1.25 / 2;
    ctx.fillText(l.text, c.width / 2, y);
    y += size * 1.25 / 2;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, transparent: !bg }));
}

// A wall with rectangular openings. holes: [[x0, y0, x1, y1], ...] in wall-local coords.
function wallWithHoles(width, height, holes, material, depth = 0.2) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();
  for (const [x0, y0, x1, y1] of holes) {
    const p = new THREE.Path();
    p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath();
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return shadowy(new THREE.Mesh(geo, material));
}

// ───────────────────────────────────────── the world

export function buildWorld(renderer) {
  const scene = new THREE.Scene();
  // Two floors share one scene: the café downstairs and the room upstairs
  // (FLOOR2_Y above it). Each floor has its own furniture, seats, walls you
  // can leave notes on, and things you bump into; only the floor you're on
  // is shown.
  const mkFloor = () => ({
    colliders: [],     // { type: 'circle', x, z, r } | { type: 'box', minX, maxX, minZ, maxZ } | { type: 'room', ... }
    seats: [],         // { id, label, x, z, y, ry, chair }
    surfaces: [],      // meshes notes can be left on (userData.surface)
    interactables: [], // meshes that respond to hover/click (userData.kind)
    group: new THREE.Group(),
  });
  const floors = { main: mkFloor(), up: mkFloor() };
  scene.add(floors.main.group, floors.up.group);
  floors.up.group.position.y = FLOOR2_Y;
  floors.up.group.visible = false;
  let { colliders, seats, surfaces, interactables } = floors.main;
  let root = floors.main.group;
  let FY = 0; // world height of the floor being built
  const animated = [];    // (dt, t) => void
  const npcs = [];

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // ── materials
  const M = {
    plaster: std(COLORS.plaster, { roughness: 0.95 }),
    sage: std(COLORS.sage, { roughness: 0.85 }),
    wood: std(COLORS.wood, { roughness: 0.6 }),
    woodDark: std(COLORS.woodDark, { roughness: 0.55 }),
    woodLight: std(COLORS.woodLight, { roughness: 0.55 }),
    cream: std(COLORS.cream, { roughness: 0.7 }),
    cushion: std(COLORS.sakura, { roughness: 0.95 }),
    cushionSage: std(COLORS.sage, { roughness: 0.95 }),
    forest: std(COLORS.forest, { roughness: 0.35, metalness: 0.25 }),
    brass: std('#c9a25b', { roughness: 0.3, metalness: 0.9 }),
    ceramic: std('#fffaf4', { roughness: 0.25 }),
    glass: new THREE.MeshStandardMaterial({ color: '#dff1ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
    leaf: std('#5f9a5a', { roughness: 0.8 }),
    pot: std('#d9a07a', { roughness: 0.8 }),
  };

  // ── floor (the room is built at its full size; furniture is laid out on
  // the original plan and spread out to fit at the end — see layout.mjs)
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ;
  const floorTex = woodFloorTexture();
  floorTex.anisotropy = maxAniso;
  floorTex.repeat.set(5 * W / 22, 4 * D / 16);
  const floor = fixed(new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#ffffff', { map: floorTex, roughness: 0.55 })));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.floor = true;
  root.add(floor);
  floors.main.floorMesh = floor;

  // ── walls (built as one piece each, with real openings)
  const H = ROOM.h;
  const hole = (cx, w, y0, y1) => [cx - w / 2, y0, cx + w / 2, y1];
  const back = wallWithHoles(W + 0.4, H, [hole(mapX(-8), 2, 0, 2.7)], M.plaster);
  back.position.set(0, 0, ROOM.minZ - 0.1);
  const front = wallWithHoles(W + 0.4, H, [hole(mapX(-6), 4, 1.0, 3.0), hole(0, 2.2, 0, 2.8), hole(mapX(6), 4, 1.0, 3.0)], M.plaster);
  front.position.set(0, 0, ROOM.maxZ + 0.1);
  // the left wall is turned a quarter, so its local x runs along −z
  const left = wallWithHoles(D + 0.4, H, [hole(-mapZ(-3.5), 3, 1.0, 3.0), hole(-mapZ(2.5), 3, 1.0, 3.0)], M.plaster);
  left.rotation.y = Math.PI / 2;
  left.position.set(ROOM.minX - 0.1, 0, 0);
  const right = wallWithHoles(D + 0.4, H, [], M.plaster);
  right.rotation.y = -Math.PI / 2;
  right.position.set(ROOM.maxX + 0.1, 0, 0);
  for (const w of [back, front, left, right]) {
    w.userData.surface = 'wall';
    surfaces.push(w);
    root.add(fixed(w));
  }

  // sage wainscoting all round (below 1 m), with a wooden rail
  const wains = [
    { x: 0, z: ROOM.minZ + 0.01, w: W, ry: 0, skip: [mapX(-8) - 1, mapX(-8) + 1] },
    { x: 0, z: ROOM.maxZ - 0.01, w: W, ry: Math.PI, skip: [-1.1, 1.1] },
    { x: ROOM.minX + 0.01, z: 0, w: D, ry: Math.PI / 2 },
    { x: ROOM.maxX - 0.01, z: 0, w: D, ry: -Math.PI / 2 },
  ];
  for (const wn of wains) {
    const segs = wn.skip ? [[-wn.w / 2, wn.skip[0]], [wn.skip[1], wn.w / 2]] : [[-wn.w / 2, wn.w / 2]];
    for (const [a, b] of segs) {
      const len = b - a;
      const g = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(len, 1.0, 0.04), M.sage);
      panel.position.set((a + b) / 2, 0.5, 0);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.08), M.woodDark);
      rail.position.set((a + b) / 2, 1.02, 0.01);
      panel.receiveShadow = rail.receiveShadow = true;
      g.add(panel, rail);
      g.rotation.y = wn.ry;
      g.position.set(wn.x, 0, wn.z);
      // flip local x so the "skip" opening lines up when the wall is rotated
      if (wn.ry === Math.PI) g.scale.x = -1;
      root.add(fixed(g));
    }
  }

  // ceiling + beams
  const ceiling = fixed(new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, D + 0.4), std('#fbf3ea', { roughness: 1 })));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  root.add(ceiling);
  for (let x = -13.5; x <= 13.5; x += 3) {
    const beam = fixed(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, D), M.woodDark));
    beam.position.set(x, H - 0.12, 0);
    root.add(beam);
  }

  // window glass + frames
  function windowFrame(w, h, mullions = 1) {
    const g = new THREE.Group();
    const t = 0.08;
    const parts = [
      [w + t, t, 0, h / 2], [w + t, t, 0, -h / 2], [t, h, -w / 2, 0], [t, h, w / 2, 0],
    ];
    for (let i = 1; i <= mullions; i++) parts.push([t * 0.7, h, -w / 2 + (w * i) / (mullions + 1), 0]);
    parts.push([w, t * 0.7, 0, h * 0.1]);
    for (const [pw, ph, px, py] of parts) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.12), M.woodDark);
      b.position.set(px, py, 0);
      b.castShadow = true;
      g.add(b);
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
    g.add(glass);
    // a deep sill to sit things on
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.06, 0.35), M.woodLight);
    sill.position.set(0, -h / 2 - 0.03, 0.12);
    sill.receiveShadow = true;
    g.add(sill);
    return g;
  }
  const windows = [
    { x: -6, y: 2, z: 8.1, ry: Math.PI, w: 4, h: 2 },
    { x: 6, y: 2, z: 8.1, ry: Math.PI, w: 4, h: 2 },
    { x: -11.1, y: 2, z: -3.5, ry: Math.PI / 2, w: 3, h: 2 },
    { x: -11.1, y: 2, z: 2.5, ry: Math.PI / 2, w: 3, h: 2 },
  ];
  for (const wd of windows) {
    const f = windowFrame(wd.w, wd.h, wd.w > 3 ? 2 : 1);
    f.position.set(wd.x, wd.y, wd.z);
    f.rotation.y = wd.ry;
    root.add(f);
  }

  // back door (open a little, glass upper half) — Cairo is through here
  {
    const frame = windowFrame(2, 2.7, 0);
    frame.position.set(-8, 1.35, -8.1);
    frame.children.forEach(ch => { if (ch.geometry?.parameters?.depth === 0.35) ch.visible = false; });
    root.add(frame);
    const door = new THREE.Group();
    const panel = rbox(0.95, 2.6, 0.06, 0.02, M.wood);
    panel.position.set(0.475, 1.3, 0);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.2), M.glass);
    pane.position.set(0.475, 1.75, 0.04);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 24), M.brass);
    knob.position.set(0.85, 1.1, 0.06);
    door.add(panel, pane, knob);
    door.position.set(-9, 0, -8.05);
    door.rotation.y = -0.9; // ajar, letting the morning in
    root.add(door);
    // cutting out the panel's glass area: simple trick — a second frame half
    const half = new THREE.Group();
    const p2 = rbox(0.95, 2.6, 0.06, 0.02, M.wood);
    p2.position.set(-0.475, 1.3, 0);
    half.add(p2);
    half.position.set(-7, 0, -8.05);
    half.rotation.y = 0.9;
    root.add(half);
    const hover = new THREE.Mesh(new THREE.BoxGeometry(2, 2.7, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(-8, 1.35, -8.2);
    hover.userData = { kind: 'info', label: 'The back door — Cairo, just outside', text: 'Through the back door: a Cairo street, the minarets, the palms, and whatever the sky is doing right now in Cairo.' };
    interactables.push(hover);
    root.add(hover);
  }

  // front door (closed, glass top, OPEN sign)
  {
    const door = rbox(2.1, 2.75, 0.08, 0.03, M.wood);
    door.position.set(0, 1.375, 8.08);
    root.add(door);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), M.glass);
    pane.position.set(0, 2.0, 8.03);
    pane.rotation.y = Math.PI;
    root.add(pane);
    const sign = makeSign([
      { text: 'open', font: 'Dancing Script, cursive', size: 210, color: COLORS.sakuraDark, weight: '700' },
    ], 0.7, 0.32, { bg: COLORS.cream });
    sign.position.set(0, 1.3, 8.02);
    sign.rotation.y = Math.PI;
    root.add(sign);
    // wind chime above the door
    const chime = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25 + i * 0.05, 12), M.brass);
      rod.position.set(-0.12 + i * 0.06, -0.2 - i * 0.02, 0);
      chime.add(rod);
    }
    chime.position.set(0.8, 3.2, 7.75);
    root.add(chime);
    animated.push((dt, t) => { chime.rotation.z = Math.sin(t * 0.8) * 0.05; chime.rotation.x = Math.sin(t * 0.6) * 0.04; });
  }

  colliders.push({ type: 'room', minX: ROOM.minX + 0.35, maxX: ROOM.maxX - 0.35, minZ: ROOM.minZ + 0.35, maxZ: ROOM.maxZ - 0.35 });

  // ── furniture helpers
  function chair(x, z, ry, cushion = M.cushion) {
    const g = new THREE.Group();
    const seat = rbox(0.46, 0.07, 0.46, 0.03, M.woodLight);
    seat.position.y = 0.46;
    const pad = rbox(0.4, 0.05, 0.4, 0.025, cushion);
    pad.position.y = 0.515;
    g.add(seat, pad);
    for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
      const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.46, 16), M.woodDark));
      leg.position.set(lx, 0.23, lz);
      g.add(leg);
    }
    const backrest = rbox(0.44, 0.42, 0.05, 0.025, M.woodLight);
    backrest.position.set(0, 0.74, -0.21);
    backrest.rotation.x = -0.08;
    g.add(backrest);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    root.add(g);
    return g;
  }

  function roundTable(x, z, r = 0.55, h = 0.76, top = M.wood) {
    const g = new THREE.Group();
    const t = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, SEG), top));
    t.position.y = h;
    const edge = shadowy(new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 12, SEG), M.woodDark));
    edge.rotation.x = Math.PI / 2;
    edge.position.y = h;
    const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 24), M.woodDark));
    leg.position.y = h / 2;
    const foot = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.04, SEG), M.woodDark));
    foot.position.y = 0.02;
    g.add(t, edge, leg, foot);
    g.position.set(x, 0, z);
    root.add(g);
    t.userData.surface = 'table';
    t.userData.top = h + 0.026 + FY;
    surfaces.push(t);
    colliders.push({ type: 'circle', x, z, r: r + 0.15 });
    return { group: g, top: t };
  }

  // a little vase of sakura on a table
  function vase(x, y, z) {
    const g = new THREE.Group();
    const v = shadowy(new THREE.Mesh(new THREE.LatheGeometry(
      [[0, 0], [0.045, 0], [0.06, 0.05], [0.04, 0.13], [0.025, 0.17], [0.03, 0.18]].map(p => new THREE.Vector2(...p)), 32), M.ceramic));
    g.add(v);
    const blossomM = std(COLORS.sakura, { roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 6), std('#6b4a32'));
      stem.position.set((i - 1) * 0.02, 0.27, 0);
      stem.rotation.z = (i - 1) * 0.3;
      g.add(stem);
      for (let j = 0; j < 4; j++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), blossomM);
        b.position.set((i - 1) * 0.05 + Math.sin(j * 2) * 0.02, 0.32 + j * 0.025, Math.cos(j * 3) * 0.02);
        g.add(b);
      }
    }
    g.position.set(x, y, z);
    root.add(g);
  }

  function addTable(id, label, x, z, chairAngles, { reserved = false, sign = null } = {}) {
    const t = roundTable(x, z);
    vase(x, t.top.userData.top - FY, z);
    chairAngles.forEach((ang, i) => {
      const cx = x + Math.sin(ang) * 0.85;
      const cz = z + Math.cos(ang) * 0.85;
      const ry = ang + Math.PI; // facing the table
      const c = chair(cx, cz, ry);
      colliders.push({ type: 'circle', x: cx, z: cz, r: 0.28 });
      if (!reserved) {
        const seat = { id: `${id}-${i}`, label, x: cx, z: cz, y: FY, ry, chair: c };
        seats.push(seat);
        c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: `Sit at ${label}` }; interactables.push(o); } });
      } else {
        c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'info', label, text: sign?.text }; interactables.push(o); } });
      }
    });
    return t;
  }

  // ── tables
  addTable('t1', 'the middle table', -5.5, 1.2, [0, Math.PI]);
  addTable('t2', 'the table by the rug', -2.2, 4.4, [Math.PI / 2, -Math.PI / 2]);
  addTable('t3', 'the sunny table', 1.6, 1.0, [0, Math.PI, Math.PI / 2]);
  addTable('t5', 'the table by the tree', 4.6, 4.8, [Math.PI / 2, -Math.PI / 2]);
  addTable('t6', 'the quiet table', -5.6, -3.6, [Math.PI / 2, -Math.PI / 2]);
  addTable('t7', 'the table in the middle of everything', -1.8, -1.2, [0, Math.PI * 2 / 3, -Math.PI * 2 / 3]);

  // Table Four, at the window
  addTable('four', 'Table Four', -9.6, -3.5, [Math.PI / 2 + 0.5, Math.PI / 2 - 0.5 + Math.PI]);
  {
    const s = makeSign([
      { text: 'Table Four', size: 120, weight: '700' },
      { text: 'the best seat in Cairo', font: 'Dancing Script, cursive', size: 80, color: COLORS.sakuraDark },
    ], 0.34, 0.2);
    s.position.set(-9.6, 0.9, -3.5);
    s.rotation.y = Math.PI / 2;
    root.add(s);
  }

  // Mariam's corner — always reserved
  const mariam = addTable('mariam', "Mariam's corner", -9.6, 6.6, [Math.PI / 2 + 0.6, 0.6 + Math.PI], {
    reserved: true,
    sign: { text: "This one is always kept for Mariam — the reason the café exists. You're welcome to leave her a note on the table." },
  });
  {
    const s = makeSign([
      { text: 'Reserved', size: 120, weight: '700' },
      { text: 'for Mariam 🌸', font: 'Dancing Script, cursive', size: 92, color: COLORS.sakuraDark },
    ], 0.34, 0.2);
    s.position.set(-9.45, mariam.top.userData.top + 0.1, 6.55);
    s.rotation.y = 0.9;
    root.add(s);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.01), M.cream);
    card.position.copy(s.position).add(new THREE.Vector3(-0.004, 0, -0.005));
    card.rotation.y = 0.9;
    root.add(card);
    const hover = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(-9.6, 0.4, 6.6);
    hover.userData = { kind: 'info', label: "Mariam's corner", text: "This one is always kept for Mariam — the reason the café exists. You're welcome to leave her a note on the table." };
    interactables.push(hover);
    root.add(hover);
  }

  // ── rugs
  const rugTex = rugTexture();
  const rug1 = new THREE.Mesh(new THREE.CircleGeometry(1.9, 96), std('#ffffff', { map: rugTex, roughness: 1 }));
  rug1.rotation.x = -Math.PI / 2;
  rug1.position.set(-2.2, 0.006, 4.4);
  rug1.receiveShadow = true;
  root.add(rug1);
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.2), std('#ffffff', { map: rugTex, roughness: 1 }));
  rug2.rotation.x = -Math.PI / 2;
  rug2.position.set(8.9, 0.006, 1.5);
  rug2.receiveShadow = true;
  root.add(rug2);

  // ── fireplace on the right wall + two armchairs
  const fire = { x: 10.6, z: 1.5 };
  {
    const g = new THREE.Group();
    const brick = std('#c98b6e', { roughness: 0.95 });
    const body = rbox(0.6, 1.3, 2.0, 0.05, brick);
    body.position.set(0, 0.65, 0);
    const opening = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 1.1), std('#2a1a14', { roughness: 1 }));
    opening.position.set(-0.27, 0.45, 0);
    const mantel = rbox(0.8, 0.1, 2.3, 0.03, M.woodDark);
    mantel.position.set(-0.05, 1.33, 0);
    const chimney = rbox(0.5, 2.85, 1.4, 0.04, brick);
    chimney.position.set(0.05, 2.78, 0);
    g.add(body, opening, mantel, chimney);
    // logs and flames
    const logM = std('#5a3a26', { roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 20), logM);
      log.rotation.x = Math.PI / 2;
      log.rotation.y = (i - 1) * 0.25;
      log.position.set(-0.32, 0.17 + (i === 1 ? 0.08 : 0), (i - 1) * 0.12);
      g.add(log);
    }
    const flames = [];
    const flameColors = ['#ffb347', '#ff8a3d', '#ffd27a'];
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.07 + Math.random() * 0.05, 0.3 + Math.random() * 0.2, 24),
        new THREE.MeshBasicMaterial({ color: flameColors[i % 3], transparent: true, opacity: 0.85 }));
      f.position.set(-0.34, 0.35, -0.35 + i * 0.12);
      g.add(f);
      flames.push(f);
    }
    // little things on the mantel
    for (let i = 0; i < 3; i++) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14 + i * 0.05, 24), M.cream);
      candle.position.set(-0.1, 1.45 + i * 0.025, -0.7 + i * 0.12);
      g.add(candle);
    }
    const framePic = makeSign([
      { text: '🦉', size: 260, font: 'sans-serif' },
    ], 0.5, 0.6, { bg: '#fdf3e6' });
    framePic.position.set(-0.32, 1.75, 0.55);
    framePic.rotation.y = -Math.PI / 2;
    g.add(framePic);
    g.position.set(fire.x, 0, fire.z);
    root.add(g);
    const light = new THREE.PointLight('#ff9a4a', 6, 7, 2);
    light.position.set(fire.x - 0.8, 0.6, fire.z);
    root.add(light);
    animated.push((dt, t) => {
      flames.forEach((f, i) => {
        const s = 0.8 + Math.sin(t * (7 + i) + i) * 0.15 + Math.sin(t * 13 + i * 2) * 0.08;
        f.scale.set(1, s, 1);
        f.position.y = 0.3 + s * 0.12;
      });
      light.intensity = 5 + Math.sin(t * 9) * 0.8 + Math.sin(t * 23) * 0.5;
    });
    colliders.push({ type: 'box', minX: 10.0, maxX: 11, minZ: 0.3, maxZ: 2.7 });
    const hover = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 2), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(fire.x - 0.1, 0.7, fire.z);
    hover.userData = { kind: 'info', label: 'The fireplace', text: 'Walk closer — you can hear it crackle.' };
    interactables.push(hover);
    root.add(hover);
  }

  function armchair(x, z, ry, id, label) {
    const g = new THREE.Group();
    const base = rbox(0.9, 0.42, 0.85, 0.12, M.cushionSage);
    base.position.y = 0.3;
    const back = rbox(0.9, 0.7, 0.22, 0.1, M.cushionSage);
    back.position.set(0, 0.75, -0.34);
    const armL = rbox(0.18, 0.4, 0.8, 0.08, M.cushionSage);
    armL.position.set(-0.4, 0.58, 0);
    const armR = armL.clone();
    armR.position.x = 0.4;
    const cushion = rbox(0.6, 0.12, 0.6, 0.05, M.cushion);
    cushion.position.set(0, 0.55, 0.05);
    g.add(base, back, armL, armR, cushion);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    root.add(g);
    colliders.push({ type: 'circle', x, z, r: 0.5 });
    const seat = { id, label, x, z, y: 0.02 + FY, ry, chair: g };
    seats.push(seat);
    g.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: `Sit in ${label}` }; interactables.push(o); } });
  }
  armchair(8.4, 0.3, Math.PI / 2 + 0.35, 'arm1', 'the armchair by the fire');
  armchair(8.4, 2.7, Math.PI / 2 - 0.35, 'arm2', 'the other armchair by the fire');
  {
    const low = roundTable(8.9, 1.5, 0.4, 0.42, M.woodLight);
    low.top.userData.label = 'the fireside table';
  }

  // ── the counter
  const counter = new THREE.Group();
  {
    const body = rbox(7.2, 1.0, 0.9, 0.04, M.sage);
    body.position.set(6.5, 0.5, -4.7);
    const top = rbox(7.5, 0.08, 1.15, 0.03, M.woodLight);
    top.position.set(6.5, 1.04, -4.72);
    top.userData.surface = 'table';
    top.userData.top = 1.085;
    surfaces.push(top);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.1, 0.92), M.woodDark);
    kick.position.set(6.5, 0.05, -4.69);
    // vertical slats on the front
    for (let x = 3.1; x <= 9.9; x += 0.34) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.82, 0.02), std(COLORS.sageDark));
      slat.position.set(x, 0.52, -4.24);
      counter.add(slat);
    }
    counter.add(body, top, kick);
    root.add(counter);
    colliders.push({ type: 'box', minX: 2.75, maxX: 10.3, minZ: -8, maxZ: -4.05 });

    // forest green coffee machine
    const machine = new THREE.Group();
    const mb = rbox(0.8, 0.5, 0.5, 0.06, M.forest);
    mb.position.y = 0.25;
    const mtop = rbox(0.84, 0.05, 0.52, 0.02, M.brass);
    mtop.position.y = 0.52;
    for (const gx of [-0.2, 0.2]) {
      const group = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 24), M.brass);
      group.position.set(gx, 0.1, 0.27);
      const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.14, 6, 12), M.woodDark);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(gx, 0.08, 0.38);
      machine.add(group, handle);
    }
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), std('#fffaf4', { roughness: 0.2 }));
    gauge.position.set(0, 0.36, 0.252);
    const gaugeRim = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 32), M.brass);
    gaugeRim.position.copy(gauge.position);
    machine.add(mb, mtop, gauge, gaugeRim);
    for (let i = 0; i < 4; i++) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.07, 24), M.ceramic);
      cup.position.set(-0.3 + i * 0.2, 0.59, -0.1);
      machine.add(cup);
    }
    machine.position.set(8.6, 1.08, -4.95);
    machine.rotation.y = Math.PI;
    machine.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.add(machine);
    // steam
    const steamTex = canvasTex(128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    const puffs = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      p.userData.phase = i / 6;
      root.add(p);
      puffs.push(p);
    }
    animated.push((dt, t) => {
      puffs.forEach(p => {
        const k = (t * 0.18 + p.userData.phase) % 1;
        p.position.set(machine.position.x + Math.sin(t + p.userData.phase * 6) * 0.05, 1.65 + k * 0.7, machine.position.z - 0.1);
        const s = 0.12 + k * 0.35;
        p.scale.set(s, s, 1);
        p.material.opacity = Math.sin(k * Math.PI) * 0.35;
      });
    });

    // cake case with the Sakura Slice inside
    const caseG = new THREE.Group();
    const caseBase = rbox(1.1, 0.08, 0.6, 0.02, M.woodDark);
    caseBase.position.y = 0.04;
    const caseGlass = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.42, 0.58), M.glass);
    caseGlass.position.y = 0.29;
    caseG.add(caseBase, caseGlass);
    const cakeColors = ['#f7c9d5', '#efe0c4', '#8fbf6a'];
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 32), M.ceramic);
      plate.position.set(-0.33 + i * 0.33, 0.09, 0);
      const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 32, 1, false, 0, Math.PI * 1.7), std(cakeColors[i], { roughness: 0.7 }));
      cake.position.set(-0.33 + i * 0.33, 0.16, 0);
      const cream = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 16), std('#fffaf4'));
      cream.position.set(-0.33 + i * 0.33, 0.235, 0);
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 16), std(i === 0 ? COLORS.sakuraDark : '#c0392b'));
      berry.position.set(-0.33 + i * 0.33, 0.26, 0);
      caseG.add(plate, cake, cream, berry);
    }
    caseG.position.set(4.6, 1.08, -4.75);
    root.add(caseG);

    const reg = rbox(0.35, 0.25, 0.3, 0.04, M.cream);
    reg.position.set(6.4, 1.2, -4.8);
    root.add(reg);

    // click the counter to order
    const orderZone = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ visible: false }));
    orderZone.position.set(6.5, 0.7, -4.6);
    orderZone.userData = { kind: 'order', label: 'Order a drink' };
    interactables.push(orderZone);
    root.add(orderZone);
  }

  // shelves behind the counter, with Me3temed's top shelf
  {
    const g = new THREE.Group();
    const ys = [1.5, 2.05, 2.6];
    ys.forEach((y, i) => {
      const s = rbox(6.4, 0.05, 0.36, 0.015, M.woodLight);
      s.position.set(6.5, y, -7.75);
      g.add(s);
      const jarColors = ['#8fbf6a', '#a0714f', '#efe0c4', '#f2a7bb', '#e8b44a', '#d9b48f'];
      for (let j = 0; j < 11; j++) {
        if (i === 2 && j > 3 && j < 7) continue; // Me3temed's spot
        const x = 3.6 + j * 0.55;
        if (j % 3 === 0) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 32), new THREE.MeshStandardMaterial({ color: '#f5fbff', transparent: true, opacity: 0.35, roughness: 0.05 }));
          jar.position.set(x, y + 0.145, -7.75);
          const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 32), std(jarColors[(j + i) % 6]));
          fill.position.set(x, y + 0.1, -7.75);
          const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 32), M.woodDark);
          lid.position.set(x, y + 0.28, -7.75);
          g.add(jar, fill, lid);
        } else {
          for (let k = 0; k < 2; k++) {
            const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.11, 32), std(k ? '#fffaf4' : jarColors[(j * 2 + i) % 6], { roughness: 0.3 }));
            mug.position.set(x - 0.08 + k * 0.17, y + 0.08, -7.72);
            g.add(mug);
          }
        }
      }
    });
    root.add(g);
    const plaque = makeSign([{ text: "Me3temed's shelf", font: 'Dancing Script, cursive', size: 110, color: COLORS.forest, weight: '700' }], 0.7, 0.14, { bg: COLORS.cream, radius: 30 });
    plaque.position.set(6.6, 2.5, -7.55);
    root.add(plaque);

    // chalk menu on the back wall above the shelves
    const menu = makeSign([
      { text: 'today', font: 'Dancing Script, cursive', size: 70, color: '#f7c9d5' },
      { text: 'matcha · hojicha · cardamom milk', font: 'Nunito, sans-serif', size: 46, color: '#fef9f5' },
      { text: 'sakura tea · the sakura slice', font: 'Nunito, sans-serif', size: 46, color: '#fef9f5' },
    ], 3.2, 0.9, { bg: '#2f3a33', border: COLORS.woodDark, radius: 24 });
    menu.position.set(6.5, 3.35, -7.97);
    root.add(menu);
  }

  // ── the community board (back wall)
  const board = { x: -2.8, y: 1.85, z: -7.96, w: 4.4, h: 1.9 };
  {
    const cork = new THREE.Mesh(new THREE.BoxGeometry(board.w, board.h, 0.04), std('#ffffff', { map: corkTexture(), roughness: 1 }));
    cork.position.set(board.x, board.y, board.z);
    cork.receiveShadow = true;
    cork.userData.surface = 'board';
    surfaces.push(cork);
    root.add(cork);
    const frameParts = [
      [board.w + 0.16, 0.08, 0, board.h / 2 + 0.04], [board.w + 0.16, 0.08, 0, -board.h / 2 - 0.04],
      [0.08, board.h, -board.w / 2 - 0.04, 0], [0.08, board.h, board.w / 2 + 0.04, 0],
    ];
    for (const [w, h, x, y] of frameParts) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), M.woodDark);
      f.position.set(board.x + x, board.y + y, board.z + 0.01);
      f.castShadow = true;
      root.add(f);
    }
  }
  const boardSign = { mesh: null };
  function setBoardSign(title, subtitle) {
    if (boardSign.mesh) { boardSign.mesh.parent.remove(boardSign.mesh); boardSign.mesh.material.map.dispose(); }
    const s = makeSign([
      { text: title, size: 120, weight: '700' },
      { text: subtitle, font: 'Dancing Script, cursive', size: 92, color: COLORS.sakuraDark },
    ], 3.2, 0.62, { bg: null });
    s.position.set(board.x, board.y + board.h / 2 + 0.42, board.z - 0.02);
    s.userData.fixed = board.placed; // after the spread-out, it's already in place
    floors.main.group.add(noFog(s));
    boardSign.mesh = s;
  }
  setBoardSign('The Community Board', 'pin something kind for a stranger');

  // ── a bookshelf on the right wall
  {
    const g = new THREE.Group();
    const caseM = M.woodDark;
    const sides = [[0.05, 2.4, 0.4, -0.95, 1.2], [0.05, 2.4, 0.4, 0.95, 1.2]];
    for (const [w, h, d, x, y] of sides) {
      const s = rbox(w, h, d, 0.01, caseM);
      s.position.set(x, y, 0);
      g.add(s);
    }
    const bookColors = ['#d4678a', '#7aab7a', '#e8b44a', '#6b8fb5', '#a0714f', '#f2a7bb', '#4d7a4d', '#efe0c4', '#8a6bb0'];
    const r = rand(11);
    for (let i = 0; i < 5; i++) {
      const y = 0.08 + i * 0.5;
      const shelf = rbox(1.9, 0.04, 0.38, 0.01, caseM);
      shelf.position.set(0, y, 0);
      g.add(shelf);
      if (i === 4) break;
      let x = -0.88;
      while (x < 0.82) {
        const w = 0.04 + r() * 0.04;
        const h = 0.26 + r() * 0.14;
        const book = rbox(w, h, 0.26, 0.008, std(bookColors[Math.floor(r() * bookColors.length)], { roughness: 0.8 }));
        const lean = r() < 0.1 ? 0.2 : 0;
        book.position.set(x + w / 2, y + 0.02 + h / 2, 0);
        book.rotation.z = lean;
        g.add(book);
        x += w + 0.005 + (lean ? 0.05 : 0);
      }
    }
    g.position.set(10.75, 0, 5.4);
    g.rotation.y = -Math.PI / 2;
    root.add(g);
    colliders.push({ type: 'box', minX: 10.3, maxX: 11, minZ: 4.3, maxZ: 6.5 });
    const hover = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 2), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(10.7, 1.2, 5.4);
    hover.userData = { kind: 'info', label: 'The bookshelf', text: "This month's picks: Project Hail Mary (Yuto's) and A Study in Drowning (Yuki's). Borrow anything — bring it back whenever." };
    interactables.push(hover);
    root.add(hover);
  }

  // ── a framed sign between the left windows
  {
    const s = makeSign([
      { text: 'Sakura Slice Café', size: 120, weight: '700' },
      { text: 'est. in imagination · Cairo', font: 'Dancing Script, cursive', size: 80, color: COLORS.sakuraDark },
    ], 2.2, 0.7);
    s.position.set(-10.97, 2.1, -0.5);
    s.rotation.y = Math.PI / 2;
    root.add(s);
  }

  // ── plants
  function plant(x, z, s = 1) {
    const g = new THREE.Group();
    const pot = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 32), M.pot));
    pot.position.y = 0.2;
    g.add(pot);
    const r = rand(Math.floor(x * 100 + z * 7) + 99);
    for (let i = 0; i < 9; i++) {
      const leaf = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), M.leaf));
      leaf.scale.set(0.5, 1.4, 0.18);
      const a = (i / 9) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.12, 0.6 + r() * 0.25, Math.sin(a) * 0.12);
      leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    root.add(g);
    colliders.push({ type: 'circle', x, z, r: 0.3 * s });
    animated.push((dt, t) => { g.rotation.z = Math.sin(t * 0.6 + x) * 0.015; });
  }
  plant(-10.4, -7.4, 1.2);
  plant(-10.4, -0.5, 1.0);
  plant(10.4, 7.4, 1.3);
  plant(2.0, 7.4, 1.0);
  plant(-2.0, 7.4, 1.0);
  plant(10.4, -3.4, 1.0);

  // ── the indoor sakura tree, with falling petals
  const tree = { x: 7.6, z: 6.4 };
  {
    const g = new THREE.Group();
    const planter = rbox(1.2, 0.5, 1.2, 0.1, M.woodDark);
    planter.position.y = 0.25;
    g.add(planter);
    const barkM = std('#5d4232', { roughness: 0.95 });
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(0.1, 1.2, 0.05), new THREE.Vector3(-0.05, 1.9, 0), new THREE.Vector3(0.1, 2.5, -0.05),
    ]);
    const trunk = shadowy(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.09, 16), barkM));
    g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.6 + i * 0.12, 0),
        new THREE.Vector3(Math.cos(a) * 0.5, 2.1 + i * 0.08, Math.sin(a) * 0.5),
        new THREE.Vector3(Math.cos(a) * 0.95, 2.4, Math.sin(a) * 0.95),
      ]);
      g.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.035, 10), barkM)));
    }
    const blossomM = [std('#f7c9d5', { roughness: 0.9 }), std('#f2a7bb', { roughness: 0.9 }), std('#fde8ef', { roughness: 0.9 })];
    const r = rand(5);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.3 + r() * 0.85;
      const b = shadowy(new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + r() * 0.2, 3), blossomM[i % 3]));
      b.position.set(Math.cos(a) * d, 2.35 + r() * 0.6, Math.sin(a) * d);
      g.add(b);
    }
    g.position.set(tree.x, 0, tree.z);
    root.add(g);
    colliders.push({ type: 'circle', x: tree.x, z: tree.z, r: 0.8 });

    // petals: soft textured planes drifting down and spinning
    const count = 60;
    const petals = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.06, 0.08),
      new THREE.MeshStandardMaterial({ map: petalTexture(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.05, roughness: 0.9 }),
      count);
    const state = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 2.6, y: Math.random() * 3, z: (Math.random() - 0.5) * 2.6,
      sp: 0.12 + Math.random() * 0.15, ph: Math.random() * 10, rot: Math.random() * 6,
    }));
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    root.add(petals);
    animated.push((dt, t) => {
      state.forEach((p, i) => {
        p.y -= p.sp * dt;
        if (p.y < 0.02) { p.y = 3.0; p.x = (Math.random() - 0.5) * 2.6; p.z = (Math.random() - 0.5) * 2.6; }
        e.set(t * 0.8 + p.ph, t * 0.5 + p.rot, Math.sin(t + p.ph));
        q.setFromEuler(e);
        v.set(tree.x + p.x + Math.sin(t * 0.7 + p.ph) * 0.3, p.y, tree.z + p.z + Math.cos(t * 0.5 + p.ph) * 0.2);
        m4.compose(v, q, one);
        petals.setMatrixAt(i, m4);
      });
      petals.instanceMatrix.needsUpdate = true;
    });
  }

  // ── pendant lamps (the warm light of the room)
  const lamps = [];
  for (const [x, z] of [[-5.5, 1.2], [-2.2, 4.4], [1.6, 1.0], [4.6, 4.8], [-9.6, -3.5], [-5.6, -3.6], [5, -4.6], [8, -4.6]]) {
    const g = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.3, 8), std('#3a2a26'));
    cord.position.y = -0.65;
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55),
      std('#fbe9d2', { side: THREE.DoubleSide, roughness: 0.8, emissive: '#ffcf8f', emissiveIntensity: 0.25 }));
    shade.position.y = -1.3;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 24), new THREE.MeshBasicMaterial({ color: '#fff1d6' }));
    bulb.position.y = -1.42;
    g.add(cord, shade, bulb);
    g.position.set(x, ROOM.h, z);
    root.add(g);
    const light = new THREE.PointLight('#ffcf94', 4, 6.5, 1.6);
    light.position.set(x, ROOM.h - 1.55, z);
    root.add(light);
    lamps.push({ light, shade, bulb });
  }

  // string lights along the top of the walls
  const bulbs = [];
  {
    const bulbM = new THREE.MeshBasicMaterial({ color: '#ffe2b0' });
    const geo = new THREE.SphereGeometry(0.035, 16, 16);
    const ex = ROOM.maxX - 0.2, ez = ROOM.maxZ - 0.15;
    const runs = [[[-ex, -ez], [ex, -ez]], [[-ex - 0.05, -ez + 0.05], [-ex - 0.05, ez - 0.05]], [[ex + 0.05, mapZ(-3.8)], [ex + 0.05, ez - 0.05]], [[-ex, ez], [ex, ez]]];
    for (const [[x0, z0], [x1, z1]] of runs) {
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.5);
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const b = new THREE.Mesh(geo, bulbM);
        b.position.set(x0 + (x1 - x0) * k, 3.75 - Math.sin(k * Math.PI * (n / 6)) ** 2 * 0.12, z0 + (z1 - z0) * k);
        root.add(fixed(b));
        bulbs.push(b);
      }
    }
  }

  // ── the café team
  const team = [
    {
      id: 'hana', name: 'Hana', role: 'Head Barista', x: 8.6, z: -5.9, ry: 0,
      avatar: { body: 'fox', skin: '#b5562b', accent: '#fdf3e6', outfit: '#fef9f5' }, extra: { apron: '#efe0c4' },
      lines: ["What can I make you?", "Sit anywhere — I'll bring it over.", "The hojicha is very good today. I'm not biased. I'm a little biased."],
    },
    {
      id: 'yuki', name: 'Yuki', role: 'Pastry Chef', x: 4.6, z: -5.9, ry: 0.1,
      avatar: { body: 'rabbit', skin: '#f6f2ee', accent: '#fde8ef', outfit: '#f2a7bb' }, extra: { apron: '#efe0c4' },
      lines: ["The Sakura Slice? I won't say how. Sorry.", "I've been here since five. It's the best part of the day.", "If you sit at table four, you'll come back. Everyone does."],
    },
    {
      id: 'yuto', name: 'Yuto', role: 'Owner · Co-founder', x: 2.2, z: -3.4, ry: 0.5,
      avatar: { body: 'person', skin: '#c99a74', hair: '#2a1d1a', hairStyle: 'short', outfit: '#6f9a6c' }, extra: { apron: '#efe0c4', glasses: 'tortoise' },
      lines: ["Welcome in. Take your time.", "You don't have to be ready yet.", "Leave a note on the board if you like — someone will need it."],
    },
    {
      id: 'me3temed', name: 'Me3temed', role: 'Co-founder · Mascot', x: 6.5, z: -7.6, y: 2.625, ry: 0, scale: 0.42,
      avatar: { body: 'owl', skin: '#9c8a6a', accent: '#f4ead8' }, extra: { bowtie: '#2f5d3a' },
      lines: ['…', '(a soft, approving stillness)', '(he blinks, slowly. it means: yes.)'],
    },
  ];
  for (const p of team) {
    const av = buildAvatar(p.avatar, { ...p.extra, scale: p.scale || 1 });
    av.group.position.set(p.x, p.y || 0, p.z);
    av.group.rotation.y = p.ry;
    root.add(av.group);
    const label = makeLabel(`${p.name} · ${p.role}`, { height: p.scale ? 0.13 : 0.18 });
    label.position.y = av.height + 0.1;
    label.visible = false;
    av.group.add(label);
    av.group.traverse(o => {
      if (o.isMesh) { o.userData = { kind: 'npc', npc: p, label: `${p.name} · ${p.role}` }; interactables.push(o); }
    });
    npcs.push({ ...p, av, label });
  }
  colliders.push({ type: 'circle', x: 2.2, z: -3.4, r: 0.4 });

  // ── the spiral staircase up to the second floor
  {
    const g = new THREE.Group();
    const steps = 20;
    const rise = FLOOR2_Y / steps;
    for (let i = 0; i < steps; i++) {
      const a = i * 0.32;
      const step = rbox(0.95, 0.06, 0.36, 0.02, M.woodLight);
      step.position.set(Math.sin(a) * 0.58, rise * (i + 1) - 0.03, Math.cos(a) * 0.58);
      step.rotation.y = a + Math.PI / 2;
      g.add(step);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 10), M.woodDark);
      post.position.set(Math.sin(a) * 1.04, rise * (i + 1) + 0.45, Math.cos(a) * 1.04);
      g.add(post);
    }
    const pole = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, ROOM.h, 24), M.woodDark));
    pole.position.y = ROOM.h / 2;
    g.add(pole);
    const helix = new THREE.CatmullRomCurve3(Array.from({ length: 41 }, (_, k) => {
      const t = k / 40, a = t * (steps - 1) * 0.32;
      return new THREE.Vector3(Math.sin(a) * 1.04, rise * (t * (steps - 1) + 1) + 0.9, Math.cos(a) * 1.04);
    }));
    g.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(helix, 160, 0.025, 10), M.woodDark)));
    g.position.set(STAIRS.x, 0, STAIRS.z);
    root.add(fixed(g));
    // the opening in the ceiling the stairs disappear into
    const hole = new THREE.Mesh(new THREE.CircleGeometry(STAIRS.r + 0.1, 64), new THREE.MeshBasicMaterial({ color: '#3a2a22' }));
    hole.rotation.x = Math.PI / 2;
    hole.position.set(STAIRS.x, ROOM.h - 0.005, STAIRS.z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(STAIRS.r + 0.1, 0.05, 12, 64), M.woodDark);
    rim.rotation.x = Math.PI / 2;
    rim.position.copy(hole.position);
    root.add(fixed(hole), fixed(rim));
    colliders.push({ type: 'circle', x: STAIRS.x, z: STAIRS.z, r: STAIRS.r - 0.1, fixed: true });
    const sign = makeSign([
      { text: 'upstairs ↑', font: 'Dancing Script, cursive', size: 150, color: COLORS.sakuraDark, weight: '700' },
      { text: 'rooms for groups', size: 70 },
    ], 0.7, 0.32);
    sign.position.set(STAIRS.x - 0.02, 1.2, STAIRS.z + 1.3);
    root.add(fixed(sign));
    const hover = new THREE.Mesh(new THREE.CylinderGeometry(STAIRS.r + 0.2, STAIRS.r + 0.2, ROOM.h, 24), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(STAIRS.x, ROOM.h / 2, STAIRS.z);
    hover.userData = { kind: 'stairs-up', label: 'Go upstairs — rooms for groups' };
    interactables.push(hover);
    root.add(fixed(hover));
  }

  // ════════════════════════════════════════ UPSTAIRS
  // A quieter loft above the café. Every group gets its own copy of this
  // room: their own people, their own notes on the board, their own chat.
  ({ colliders, seats, surfaces, interactables } = floors.up);
  root = floors.up.group;
  FY = FLOOR2_Y;
  const upLamps = [];
  const upBanner = { mesh: null };
  {
    const H2 = FLOOR2_H;
    colliders.push({ type: 'room', minX: ROOM.minX + 0.35, maxX: ROOM.maxX - 0.35, minZ: ROOM.minZ + 0.35, maxZ: ROOM.maxZ - 0.35 });
    colliders.push({ type: 'circle', x: STAIRS.x, z: STAIRS.z, r: STAIRS.r + 0.05, fixed: true });

    // floor, with the stair opening cut out of it
    const fs = new THREE.Shape();
    fs.moveTo(ROOM.minX, ROOM.minZ); fs.lineTo(ROOM.maxX, ROOM.minZ); fs.lineTo(ROOM.maxX, ROOM.maxZ); fs.lineTo(ROOM.minX, ROOM.maxZ); fs.closePath();
    const fh = new THREE.Path();
    fh.absarc(STAIRS.x, -STAIRS.z, STAIRS.r, 0, Math.PI * 2, true);
    fs.holes.push(fh);
    const tex2 = woodFloorTexture();
    tex2.anisotropy = maxAniso;
    tex2.repeat.set(5 / 22, 4 / 16);
    const floor2 = new THREE.Mesh(new THREE.ShapeGeometry(fs, 64), std('#ffffff', { map: tex2, roughness: 0.55 }));
    floor2.rotation.x = -Math.PI / 2;
    floor2.receiveShadow = true;
    floor2.userData.floor = true;
    root.add(fixed(floor2));
    floors.up.floorMesh = floor2;

    // walls with big windows — the view is the point up here
    const back2 = wallWithHoles(W + 0.4, H2, [hole(mapX(-5.5), 8, 0.5, 3.1), hole(mapX(5.5), 4, 0.8, 3.0)], M.plaster);
    back2.position.set(0, 0, ROOM.minZ - 0.1);
    const front2 = wallWithHoles(W + 0.4, H2, [hole(mapX(-5.5), 5, 0.8, 3.0), hole(mapX(5.5), 5, 0.8, 3.0)], M.plaster);
    front2.position.set(0, 0, ROOM.maxZ + 0.1);
    const left2 = wallWithHoles(D + 0.4, H2, [hole(-mapZ(-3.5), 3, 0.8, 3.0), hole(-mapZ(2.5), 3, 0.8, 3.0)], M.plaster);
    left2.rotation.y = Math.PI / 2;
    left2.position.set(ROOM.minX - 0.1, 0, 0);
    const right2 = wallWithHoles(D + 0.4, H2, [], M.plaster);
    right2.rotation.y = -Math.PI / 2;
    right2.position.set(ROOM.maxX + 0.1, 0, 0);
    for (const w of [back2, front2, left2, right2]) { w.userData.surface = 'wall'; surfaces.push(w); root.add(fixed(w)); }
    for (const wd of [
      { x: -5.5, y: 1.8, z: -8.1, ry: 0, w: 8, h: 2.6, m: 3 }, { x: 5.5, y: 1.9, z: -8.1, ry: 0, w: 4, h: 2.2, m: 1 },
      { x: -5.5, y: 1.9, z: 8.1, ry: Math.PI, w: 5, h: 2.2, m: 2 }, { x: 5.5, y: 1.9, z: 8.1, ry: Math.PI, w: 5, h: 2.2, m: 2 },
      { x: -11.1, y: 1.9, z: -3.5, ry: Math.PI / 2, w: 3, h: 2.2, m: 1 }, { x: -11.1, y: 1.9, z: 2.5, ry: Math.PI / 2, w: 3, h: 2.2, m: 1 },
    ]) {
      const f = windowFrame(wd.w, wd.h, wd.m);
      f.position.set(wd.x, wd.y, wd.z);
      f.rotation.y = wd.ry;
      root.add(f);
    }
    // a low sage band round the room
    for (const [x, z, w, ry] of [[0, ROOM.minZ + 0.01, W, 0], [0, ROOM.maxZ - 0.01, W, Math.PI], [ROOM.minX + 0.01, 0, D, Math.PI / 2], [ROOM.maxX - 0.01, 0, D, -Math.PI / 2]]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.04), M.sage);
      band.position.set(x, 0.25, z);
      band.rotation.y = ry;
      root.add(fixed(band));
    }

    // ceiling with two skylights
    const cs = new THREE.Shape();
    cs.moveTo(ROOM.minX - 0.2, ROOM.minZ - 0.2); cs.lineTo(ROOM.maxX + 0.2, ROOM.minZ - 0.2); cs.lineTo(ROOM.maxX + 0.2, ROOM.maxZ + 0.2); cs.lineTo(ROOM.minX - 0.2, ROOM.maxZ + 0.2); cs.closePath();
    const skyZ = mapZ(0.25);
    for (const [x0, z0, x1, z1] of [[mapX(-5) - 2, skyZ - 1.75, mapX(-5) + 2, skyZ + 1.75], [mapX(5) - 2, skyZ - 1.75, mapX(5) + 2, skyZ + 1.75]]) {
      const p = new THREE.Path();
      p.moveTo(x0, z0); p.lineTo(x0, z1); p.lineTo(x1, z1); p.lineTo(x1, z0); p.closePath();
      cs.holes.push(p);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.glass);
      glass.rotation.x = Math.PI / 2;
      glass.position.set((x0 + x1) / 2, H2 + 0.05, (z0 + z1) / 2);
      root.add(fixed(glass));
      for (const [w, d, x, z] of [[x1 - x0 + 0.2, 0.1, (x0 + x1) / 2, z0], [x1 - x0 + 0.2, 0.1, (x0 + x1) / 2, z1], [0.1, z1 - z0, x0, (z0 + z1) / 2], [0.1, z1 - z0, x1, (z0 + z1) / 2]]) {
        const fr = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), M.woodDark);
        fr.position.set(x, H2 - 0.05, z);
        root.add(fixed(fr));
      }
    }
    const ceil2 = new THREE.Mesh(new THREE.ShapeGeometry(cs, 8), std('#fbf3ea', { roughness: 1, side: THREE.DoubleSide }));
    ceil2.rotation.x = Math.PI / 2;
    ceil2.position.y = H2;
    root.add(fixed(ceil2));
    for (const x of [-9, -1, 1.2, 9].map(mapX)) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, D), M.woodDark);
      beam.position.set(x, H2 - 0.11, 0);
      root.add(fixed(beam));
    }

    // the stair opening: a railing round it, the stairs going down inside
    {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(STAIRS.r + 0.05, 0.035, 12, 64, Math.PI * 1.55), M.woodDark);
      rail.rotation.x = Math.PI / 2;
      rail.rotation.z = Math.PI * 0.72; // leave a gap facing into the room
      rail.position.set(STAIRS.x, 0.95, STAIRS.z);
      root.add(fixed(rail));
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * 0.72 + (i / 12) * Math.PI * 1.55;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 10), M.woodDark);
        post.position.set(STAIRS.x + Math.cos(a) * (STAIRS.r + 0.05), 0.475, STAIRS.z - Math.sin(a) * (STAIRS.r + 0.05));
        root.add(fixed(post));
      }
      const well = new THREE.Mesh(new THREE.CylinderGeometry(STAIRS.r, STAIRS.r, 1.2, 48, 1, true), std('#4a362c', { side: THREE.BackSide }));
      well.position.set(STAIRS.x, -0.6, STAIRS.z);
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(STAIRS.r, 48), std('#2a1d18'));
      bottom.rotation.x = -Math.PI / 2;
      bottom.position.set(STAIRS.x, -1.2, STAIRS.z);
      root.add(fixed(well), fixed(bottom));
      for (let i = 0; i < 4; i++) {
        const a = (16 + i) * 0.32;
        const step = rbox(0.95, 0.06, 0.36, 0.02, M.woodLight);
        step.position.set(STAIRS.x + Math.sin(a) * 0.58, -0.9 + i * 0.22, STAIRS.z + Math.cos(a) * 0.58);
        step.rotation.y = a + Math.PI / 2;
        root.add(fixed(step));
      }
      const hover = new THREE.Mesh(new THREE.CylinderGeometry(STAIRS.r + 0.2, STAIRS.r + 0.2, 1.2, 24), new THREE.MeshBasicMaterial({ visible: false }));
      hover.position.set(STAIRS.x, 0.5, STAIRS.z);
      hover.userData = { kind: 'stairs-down', label: 'Go back downstairs' };
      interactables.push(hover);
      root.add(fixed(hover));
    }

    // the big shared table, for the whole group
    {
      const x = -1, z = 1.6, w = 5.2, d = 1.4, h = 0.76;
      const top = rbox(w, 0.07, d, 0.03, M.wood);
      top.position.set(x, h, z);
      top.userData.surface = 'table';
      top.userData.top = h + 0.035 + FY;
      surfaces.push(top);
      root.add(top);
      for (const [lx, lz] of [[-w / 2 + 0.2, -d / 2 + 0.2], [w / 2 - 0.2, -d / 2 + 0.2], [-w / 2 + 0.2, d / 2 - 0.2], [w / 2 - 0.2, d / 2 - 0.2]]) {
        const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 16), M.woodDark));
        leg.position.set(x + lx, h / 2, z + lz);
        root.add(leg);
      }
      colliders.push({ type: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      let n = 0;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const cx = x - w / 2 + 0.75 + i * ((w - 1.5) / 3);
          const cz = z + side * (d / 2 + 0.38);
          const ry = side < 0 ? 0 : Math.PI;
          const c = chair(cx, cz, ry, side < 0 ? M.cushion : M.cushionSage);
          const seat = { id: `long-${n++}`, label: 'the big table', x: cx, z: cz, y: FY, ry, chair: c };
          seats.push(seat);
          c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: 'Sit at the big table' }; interactables.push(o); } });
        }
      }
      for (const [cx, ry] of [[x - w / 2 - 0.45, Math.PI / 2], [x + w / 2 + 0.45, -Math.PI / 2]]) {
        const c = chair(cx, z, ry);
        const seat = { id: `long-${n++}`, label: 'the head of the table', x: cx, z, y: FY, ry, chair: c };
        seats.push(seat);
        c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: 'Sit at the head of the table' }; interactables.push(o); } });
      }
      vase(x - 1.2, h + 0.035, z);
      vase(x + 1.2, h + 0.035, z);
    }

    // a sofa nook by the big back window
    function sofa(x, z, ry, n, id, label) {
      const g = new THREE.Group();
      const w = n * 0.75 + 0.4;
      const base = rbox(w, 0.42, 0.9, 0.12, M.cushionSage); base.position.y = 0.3;
      const back = rbox(w, 0.65, 0.22, 0.1, M.cushionSage); back.position.set(0, 0.75, -0.34);
      const armL = rbox(0.2, 0.36, 0.86, 0.08, M.cushionSage); armL.position.set(-w / 2 + 0.1, 0.56, 0);
      const armR = armL.clone(); armR.position.x = w / 2 - 0.1;
      g.add(base, back, armL, armR);
      for (let i = 0; i < n; i++) {
        const cushion = rbox(0.62, 0.11, 0.6, 0.05, i % 2 ? M.cushion : M.cream);
        cushion.position.set(-((n - 1) * 0.75) / 2 + i * 0.75, 0.56, 0.05);
        g.add(cushion);
      }
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      root.add(g);
      const along = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
      colliders.push({ type: 'circle', x, z, r: Math.min(1.1, w / 2) });
      for (let i = 0; i < n; i++) {
        const off = -((n - 1) * 0.75) / 2 + i * 0.75;
        const seat = { id: `${id}-${i}`, label, x: x + along.x * off, z: z + along.z * off, y: 0.02 + FY, ry, chair: g };
        seats.push(seat);
      }
      g.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat: seats[seats.length - n], label: `Sit on ${label}` }; interactables.push(o); } });
    }
    sofa(-5.6, -3.6, Math.PI, 3, 'sofa1', 'the window sofa');
    sofa(-9.4, -5.6, Math.PI / 2, 2, 'sofa2', 'the corner sofa');
    {
      const low = roundTable(-5.6, -5.4, 0.55, 0.42, M.woodLight);
      low.top.userData.label = 'the coffee table';
    }
    const rugU = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.6), std('#ffffff', { map: rugTexture(), roughness: 1 }));
    rugU.rotation.x = -Math.PI / 2;
    rugU.position.set(-6.2, 0.006, -5.2);
    rugU.receiveShadow = true;
    root.add(rugU);
    const rugL = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.6), std('#ffffff', { map: rugTexture(), roughness: 1 }));
    rugL.rotation.x = -Math.PI / 2;
    rugL.position.set(-1, 0.006, 1.6);
    rugL.receiveShadow = true;
    root.add(rugL);

    // floor cushions by the front windows, for sitting low and looking out
    const cushionColors = [M.cushion, M.cushionSage, M.cream];
    [[-7.2, 6.6], [-5.5, 6.9], [-3.8, 6.6], [3.8, 6.6], [5.5, 6.9], [7.2, 6.6]].forEach(([x, z], i) => {
      const bag = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), cushionColors[i % 3]));
      bag.scale.set(1, 0.55, 1);
      bag.position.set(x, 0.23, z);
      root.add(bag);
      const seat = { id: `cushion-${i}`, label: 'a floor cushion by the window', x, z, y: FY - 0.25, ry: Math.PI, chair: bag };
      seats.push(seat);
      bag.userData = { kind: 'seat', seat, label: 'Sit on the floor cushion' };
      interactables.push(bag);
      colliders.push({ type: 'circle', x, z, r: 0.3 });
    });

    // the group's own board on the right wall, with their name above it
    {
      const cork = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.7, 0.04), std('#ffffff', { map: corkTexture(), roughness: 1 }));
      cork.position.set(10.96, 1.75, 0.5);
      cork.rotation.y = -Math.PI / 2;
      cork.userData.surface = 'board';
      surfaces.push(cork);
      root.add(cork);
      for (const [w, h, dz, dy] of [[4.56, 0.08, 0, 0.89], [4.56, 0.08, 0, -0.89], [0.08, 1.7, -2.24, 0], [0.08, 1.7, 2.24, 0]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), M.woodDark);
        f.position.set(10.95, 1.75 + dy, 0.5 + dz);
        f.rotation.y = -Math.PI / 2;
        root.add(f);
      }
    }

    // a sideboard with a kettle and cups, and plants
    {
      const sb = rbox(2.4, 0.9, 0.6, 0.05, M.woodDark);
      sb.position.set(7.4, 0.45, -7.55);
      root.add(sb);
      colliders.push({ type: 'box', minX: 6.2, maxX: 8.6, minZ: -8, maxZ: -7.2 });
      const kettle = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 24), M.forest));
      kettle.scale.set(1, 0.85, 1);
      kettle.position.set(6.8, 1.05, -7.55);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.18, 12), M.forest);
      spout.rotation.z = -0.9;
      spout.position.set(6.98, 1.08, -7.55);
      root.add(kettle, spout);
      for (let i = 0; i < 4; i++) {
        const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 24), std(['#f2a7bb', '#fffaf4', '#8fbf6a', '#efe0c4'][i], { roughness: 0.3 }));
        mug.position.set(7.3 + i * 0.22, 0.95, -7.5);
        root.add(mug);
      }
    }
    plant(10.4, -7.4, 1.2);
    plant(-10.4, 7.4, 1.2);
    plant(10.4, 7.4, 1.1);
    plant(-1.6, -7.4, 1.0);

    // lamps and string lights
    for (const [x, z] of [[-2.2, 1.6], [0.2, 1.6], [-5.6, -5.0], [6.5, 3.5]]) {
      const g = new THREE.Group();
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 8), std('#3a2a26'));
      cord.position.y = -0.5;
      const shade = new THREE.Mesh(new THREE.SphereGeometry(0.24, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55),
        std('#e8f5e8', { side: THREE.DoubleSide, roughness: 0.8, emissive: '#ffcf8f', emissiveIntensity: 0.25 }));
      shade.position.y = -1.0;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 24), new THREE.MeshBasicMaterial({ color: '#fff1d6' }));
      bulb.position.y = -1.12;
      g.add(cord, shade, bulb);
      g.position.set(x, H2, z);
      root.add(g);
      const light = new THREE.PointLight('#ffcf94', 4, 6.5, 1.6);
      light.position.set(x, H2 - 1.25, z);
      root.add(light);
      upLamps.push({ light, shade, bulb });
    }
  }
  function setUpstairsSign(title, subtitle, color = COLORS.sakuraDark) {
    if (upBanner.mesh) { floors.up.group.remove(upBanner.mesh); upBanner.mesh.material.map.dispose(); }
    const s = makeSign([
      { text: title, size: 120, weight: '700' },
      { text: subtitle, font: 'Dancing Script, cursive', size: 88, color },
    ], 3.6, 0.62, { bg: null });
    s.position.set(mapX(10.98), 2.95, mapZ(0.5));
    s.rotation.y = -Math.PI / 2;
    s.userData.fixed = true;
    floors.up.group.add(noFog(s));
    upBanner.mesh = s;
  }
  setUpstairsSign('Upstairs', 'a room of your own');

  // back to the ground floor for anything built after this
  ({ colliders, seats, surfaces, interactables } = floors.main);
  root = floors.main.group;
  FY = 0;

  // ── spread everything out onto the café's full size (see layout.mjs)
  const box = new THREE.Box3();
  const centre = new THREE.Vector3();
  for (const [name, f] of Object.entries(floors)) {
    for (const o of [...f.group.children]) {
      if (o.userData.fixed) continue;
      let rx = o.position.x, rz = o.position.z;
      // groups built with their parts at absolute positions (the counter,
      // the shelves) sit at the origin: use where their parts actually are
      if (Math.abs(rx) < 1e-6 && Math.abs(rz) < 1e-6 && o.children.length) {
        box.setFromObject(o);
        if (!box.isEmpty()) { box.getCenter(centre); rx = centre.x; rz = centre.z; }
      }
      const [dx, dz] = deltaAt(name, rx, rz);
      o.position.x += dx;
      o.position.z += dz;
    }
    for (const seat of f.seats) {
      const [dx, dz] = deltaAt(name, seat.x, seat.z);
      seat.x += dx; seat.z += dz;
    }
    for (const c of f.colliders) {
      if (c.fixed) continue;
      if (c.type === 'room') {
        Object.assign(c, { minX: ROOM.minX + 0.35, maxX: ROOM.maxX - 0.35, minZ: ROOM.minZ + 0.35, maxZ: ROOM.maxZ - 0.35 });
      } else if (c.type === 'circle') {
        const [dx, dz] = deltaAt(name, c.x, c.z);
        c.x += dx; c.z += dz;
      } else if (c.type === 'box') {
        const [dx, dz] = deltaAt(name, (c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2);
        const wall = { minX: c.minX <= -OLD.hx + 0.05, maxX: c.maxX >= OLD.hx - 0.05, minZ: c.minZ <= -OLD.hz + 0.05, maxZ: c.maxZ >= OLD.hz - 0.05 };
        c.minX += dx; c.maxX += dx; c.minZ += dz; c.maxZ += dz;
        if (wall.minX) c.minX = ROOM.minX; if (wall.maxX) c.maxX = ROOM.maxX;
        if (wall.minZ) c.minZ = ROOM.minZ; if (wall.maxZ) c.maxZ = ROOM.maxZ;
      }
    }
  }
  for (const obj of [board, fire, tree]) {
    const [dx, dz] = deltaAt('main', obj.x, obj.z);
    obj.x += dx; obj.z += dz;
  }
  board.placed = true;

  // Weather haze is for outside: nothing inside the café fogs up.
  for (const f of Object.values(floors)) noFog(f.group);

  // ── outside: Cairo
  const outside = buildCairo(scene);

  // ── light
  const hemi = new THREE.HemisphereLight('#fff3e0', '#c9a27c', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(3072, 3072);
  sun.shadow.camera.left = -19; sun.shadow.camera.right = 19;
  sun.shadow.camera.top = 19; sun.shadow.camera.bottom = -19;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const fill = new THREE.AmbientLight('#ffe9d6', 0.35);
  scene.add(fill);

  // The weather (see weather.js LOOK): how much sun gets through, rain,
  // fog, lightning. Set by the app; the light below takes it into account.
  let wx = { sun: 1, clouds: 0.25, cloudGrey: 0, rain: 0, fog: 0, fogColor: null, sky: null, wet: 0, birds: 1, flashes: 0 };
  let lastHour = 12;
  let flash = 0;
  let nextFlash = 4;
  const api_ = { onThunder: null };
  function setWeather(look) {
    wx = { ...wx, ...look };
    outside.setWeather(wx);
    setTimeOfDay(lastHour);
  }

  function setTimeOfDay(hour) {
    lastHour = hour;
    // 0 = deep night, 1 = full day
    const day = hour >= 6 && hour < 18.5 ? Math.min(1, (hour - 6) / 1.5, (18.5 - hour) / 1.5) : 0;
    const dusk = Math.max(0, 1 - Math.abs(hour - 18) / 1.3) + Math.max(0, 1 - Math.abs(hour - 6.3) / 1.0) * 0.7;
    const night = 1 - day;

    // sun arcs from east (+x) to west (−x), behind the back wall so the
    // light comes in through the back door and the left windows
    const a = ((hour - 6) / 12.5) * Math.PI;
    sun.position.set(Math.cos(a) * -30 - 10, Math.max(3, Math.sin(a) * 34), -26);
    // clouds, rain and dust soften the daylight; the sun itself can vanish
    const daylight = day * (0.45 + 0.55 * wx.sun);
    sun.intensity = 3.2 * day * wx.sun;
    sun.color.set(dusk > 0.3 ? '#ffb27a' : wx.fogColor && wx.fog > 0.6 ? wx.fogColor : '#ffe8c4');
    hemi.intensity = 0.12 + daylight * 0.78;
    hemi.color.set(night > 0.5 ? '#9fa9d6' : wx.sun < 0.4 ? '#dfe4ea' : '#fff3e0');
    fill.intensity = 0.1 + daylight * 0.3;
    scene.environmentIntensity = 0.08 + daylight * 0.27;
    baseHemi = hemi.intensity;

    // lamps glow more after dark — at night the room is lit by them alone
    const lampK = 0.55 + night * 0.85;
    [...lamps, ...upLamps].forEach(l => { l.light.intensity = 3.5 * lampK; l.shade.material.emissiveIntensity = 0.2 + night * 0.5; });
    bulbs.forEach(b => b.material.color.set(night > 0.5 ? '#ffd49a' : '#ffe9c9'));

    // after dark, cloud and rain make the night darker and the lamps matter more
    const lampK2 = lampK * (1 + (1 - wx.sun) * 0.2 * day);
    [...lamps, ...upLamps].forEach(l => { l.light.intensity = 3.5 * lampK2; });
    outside.setSky(hour, day, dusk, night);
    return { day, night };
  }
  let baseHemi = 0.9;

  function update(dt, t) {
    animated.forEach(f => f(dt, t));
    npcs.forEach(n => n.av.update(dt, {}));
    outside.update(dt, t);
    // lightning: a sudden white flash, then thunder a moment later
    if (wx.flashes) {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flash = 1;
        nextFlash = 7 + Math.random() * 12;
        const delay = 600 + Math.random() * 2200;
        if (api_.onThunder) setTimeout(() => api_.onThunder(), delay);
      }
    }
    if (flash > 0) {
      flash = Math.max(0, flash - dt * (flash > 0.6 ? 5 : 2.2));
      const flicker = flash > 0.3 && Math.random() < 0.3 ? 0.4 : 1;
      hemi.intensity = baseHemi + flash * 3.2 * flicker;
      outside.setFlash(flash * flicker);
      if (flash === 0) { hemi.intensity = baseHemi; outside.setFlash(0); }
    }
  }

  const api = Object.assign(api_, {
    scene, npcs, update, setTimeOfDay, setWeather, setBoardSign, setUpstairsSign, setFloor, floors,
    fire: { x: fire.x - 0.4, y: 0.5, z: fire.z }, board, tree,
  });
  // Show one floor and point colliders/seats/surfaces/interactables at it.
  function setFloor(name) {
    for (const [k, f] of Object.entries(floors)) f.group.visible = k === name;
    const f = floors[name];
    Object.assign(api, {
      floor: name,
      floorY: name === 'up' ? FLOOR2_Y : 0,
      floorH: name === 'up' ? FLOOR2_H : ROOM.h,
      colliders: f.colliders, seats: f.seats, surfaces: f.surfaces, interactables: f.interactables, floorMesh: f.floorMesh,
    });
  }
  setFloor('main');
  return api;
}

// ───────────────────────────────────────── Cairo, outside
//
// The café sits on its own little block: a stone pavement all round, then a
// road with cars going by slowly, then a row of Cairo buildings across the
// street — shops with striped awnings, shutters, balconies, satellite dishes
// on the roofs. Behind the back street: the mosque and its minarets. Far off:
// Cairo Tower. People stroll along the pavement, birds cross the sky, clouds
// drift, and the street lamps come on at dusk.

const STREET = {
  pave: { x: 18.5, z: 14.5 },   // the café's pavement reaches this far
  road: { x: 25, z: 21 },       // the road's outer edge
  far: { x: 28, z: 24 },        // the far pavement's outer edge (buildings start here)
};

function softTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildCairo(scene) {
  const animated = [];
  const nightMats = [];     // emissive things that glow after dark
  const lampGlows = [];
  const r = rand(42);

  // sky dome with a smooth gradient
  const skyU = {
    top: { value: new THREE.Color('#8ec5ff') },
    horizon: { value: new THREE.Color('#ffe9c7') },
    bottom: { value: new THREE.Color('#e8d2b0') },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 64, 32), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.6, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  // a soft haze so the city fades into the distance instead of stopping
  scene.fog = new THREE.Fog('#f3e2c8', 80, 260);

  // stars (soft round sprites, only at night)
  const starTex = softTexture(64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 600; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.42;
    sp.push(Math.cos(th) * Math.sin(ph) * 280, Math.cos(ph) * 280, Math.sin(th) * Math.sin(ph) * 280);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2.2, map: starTex, transparent: true, depthWrite: false, opacity: 0, fog: false }));
  scene.add(stars);

  // sun and moon, with a soft glow
  const glowTex = softTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.25, 'rgba(255,245,220,0.35)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshBasicMaterial({ color: '#fff4d6', transparent: true, fog: false }));
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe2b0', transparent: true, depthWrite: false, fog: false }));
  sunGlow.scale.set(60, 60, 1);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), new THREE.MeshBasicMaterial({ color: '#f4f1e6', transparent: true, fog: false }));
  scene.add(sunDisc, sunGlow, moon);

  // clouds: soft puffs drifting slowly across
  const cloudTex = softTexture(256, (ctx, s) => {
    for (let i = 0; i < 9; i++) {
      const x = s * (0.2 + Math.random() * 0.6), y = s * (0.4 + Math.random() * 0.25), rr = s * (0.12 + Math.random() * 0.14);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    }
  });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.8, fog: false }));
    const a = r() * Math.PI * 2, d = 120 + r() * 120;
    c.position.set(Math.cos(a) * d, 55 + r() * 45, Math.sin(a) * d);
    const sc = 50 + r() * 60;
    c.scale.set(sc, sc * 0.45, 1);
    c.userData.speed = 0.6 + r() * 0.8;
    scene.add(c);
    clouds.push(c);
  }

  // ── the ground: sand-coloured city floor, the café's pavement, the road
  const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64), new THREE.MeshStandardMaterial({ color: '#cdb58f', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const paveTex = canvasTex(512, (ctx, s) => {
    ctx.fillStyle = '#e6d8c0'; ctx.fillRect(0, 0, s, s);
    const n = 8, t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = `hsl(36, ${18 + r() * 10}%, ${80 + r() * 8}%)`;
      ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  }, { repeat: [8, 6] });
  function slab(w, d, x, z, y, mat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  const paveM = new THREE.MeshStandardMaterial({ color: '#ffffff', map: paveTex, roughness: 0.95 });
  const wetMats = [];
  slab(STREET.pave.x * 2, STREET.pave.z * 2, 0, 0, -0.012, paveM);
  const roadTex = canvasTex(512, (ctx, s) => {
    ctx.fillStyle = '#5c5753'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(r() * s, r() * s, 2, 2); }
  }, { repeat: [10, 8] });
  const roadM = new THREE.MeshStandardMaterial({ color: '#ffffff', map: roadTex, roughness: 0.9 });
  slab(STREET.road.x * 2, STREET.road.z * 2, 0, 0, -0.03, roadM);
  wetMats.push({ mat: paveM, rough: 0.95 }, { mat: roadM, rough: 0.9 });
  // the far pavement (in four strips, around the road)
  const farPave = new THREE.MeshStandardMaterial({ color: '#ffffff', map: paveTex.clone(), roughness: 0.95 });
  farPave.map.repeat.set(12, 1);
  const fw = STREET.far.x * 2, fd = STREET.far.z - STREET.road.z;
  slab(fw, fd, 0, -(STREET.road.z + fd / 2), -0.02, farPave);
  slab(fw, fd, 0, STREET.road.z + fd / 2, -0.02, farPave);
  const sideW = STREET.far.x - STREET.road.x;
  slab(sideW, STREET.road.z * 2, -(STREET.road.x + sideW / 2), 0, -0.02, farPave);
  slab(sideW, STREET.road.z * 2, STREET.road.x + sideW / 2, 0, -0.02, farPave);

  // kerbs and lane markings
  const kerbM = new THREE.MeshStandardMaterial({ color: '#d9cdb8', roughness: 0.9 });
  function kerbRect(hx, hz) {
    for (const [w, d, x, z] of [[hx * 2, 0.25, 0, -hz], [hx * 2, 0.25, 0, hz], [0.25, hz * 2, -hx, 0], [0.25, hz * 2, hx, 0]]) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), kerbM);
      k.position.set(x, 0.04, z);
      k.receiveShadow = true;
      scene.add(k);
    }
  }
  kerbRect(STREET.pave.x, STREET.pave.z);
  kerbRect(STREET.road.x, STREET.road.z);
  const midX = (STREET.pave.x + STREET.road.x) / 2, midZ = (STREET.pave.z + STREET.road.z) / 2;
  const dashM = new THREE.MeshBasicMaterial({ color: '#f1ead8' });
  const dashGeo = new THREE.PlaneGeometry(1.4, 0.14);
  function dashes(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 3);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const m = new THREE.Mesh(dashGeo, dashM);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
      m.position.set(x0 + (x1 - x0) * k, -0.025, z0 + (z1 - z0) * k);
      scene.add(m);
    }
  }
  dashes(-midX, -midZ, midX, -midZ); dashes(-midX, midZ, midX, midZ);
  dashes(-midX, -midZ, -midX, midZ); dashes(midX, -midZ, midX, midZ);
  // a zebra crossing outside the front door
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, STREET.road.z - STREET.pave.z - 0.4), dashM);
    m.rotation.x = -Math.PI / 2;
    m.position.set(-1.8 + i * 0.6, -0.022, midZ);
    scene.add(m);
  }

  // ── street lamps, palms and planters on the café's pavement
  const lampHeadM = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf8a', emissiveIntensity: 0 });
  nightMats.push({ mat: lampHeadM, max: 1.6 });
  const poleM = new THREE.MeshStandardMaterial({ color: '#2f3a33', roughness: 0.5, metalness: 0.4 });
  function streetLamp(x, z, faceX, faceZ) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.2, 16), poleM);
    pole.position.y = 2.1;
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 10), poleM);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.4, 4.1, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), lampHeadM);
    head.scale.y = 0.7;
    head.position.set(0.85, 3.98, 0);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffcf8a', transparent: true, depthWrite: false, opacity: 0 }));
    glow.scale.set(3, 3, 1);
    glow.position.copy(head.position);
    g.add(pole, arm, head, glow);
    lampGlows.push(glow);
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-faceZ, faceX); // arm reaches toward the road
    scene.add(g);
  }

  function palm(x, z, h) {
    const g = new THREE.Group();
    const trunkM = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 1 });
    const lean = (r() - 0.5) * 0.6;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.4, h * 0.5, 0), new THREE.Vector3(lean, h, lean * 0.3),
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.17, 12), trunkM);
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 9; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16), trunkM);
      const p = curve.getPoint(i / 9);
      ring.position.copy(p);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }
    const frondM = new THREE.MeshStandardMaterial({ color: '#4f8a4a', roughness: 0.85, side: THREE.DoubleSide });
    const fronds = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.7, 0.4, 2.8, 0);
      shape.quadraticCurveTo(0.7, -0.4, 0, 0);
      const f = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), frondM);
      f.rotation.set(-0.45 - r() * 0.45, (i / 10) * Math.PI * 2, 0, 'YXZ');
      f.castShadow = true;
      fronds.add(f);
    }
    fronds.position.set(lean, h, lean * 0.3);
    g.add(fronds);
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#8b6a4a', roughness: 1 }));
    pit.position.y = 0.0;
    g.add(pit);
    g.position.set(x, 0, z);
    scene.add(g);
    const ph = r() * 10;
    animated.push((dt, t) => { fronds.rotation.z = Math.sin(t * 0.7 + ph) * 0.04; fronds.rotation.x = Math.sin(t * 0.5 + ph * 2) * 0.03; });
  }

  // lamps and palms alternate along each side of the café
  const lx = STREET.pave.x - 0.8, lz = STREET.pave.z - 0.8;
  for (let x = -16; x <= 16; x += 8) { streetLamp(x, lz, 0, 1); streetLamp(x + 0.01, -lz, 0, -1); }
  for (const z of [-8, 0, 8]) { streetLamp(lx, z, 1, 0); streetLamp(-lx, z, -1, 0); }
  for (let x = -12; x <= 12; x += 8) { palm(x, lz - 0.2, 7 + r() * 2); palm(x, -lz + 0.2, 7 + r() * 2); }
  for (const z of [-12, -4, 4, 12]) { palm(lx - 0.2, z, 7 + r() * 2); palm(-lx + 0.2, z, 7 + r() * 2); }

  // a little terrace outside the front door
  function terraceTable(x, z, color) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 32), new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.6 }));
    top.position.y = 0.74;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.74, 12), poleM);
    leg.position.y = 0.37;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 10), poleM);
    pole.position.y = 1.2;
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.5, 8, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }));
    umb.position.y = 2.35;
    g.add(top, leg, pole, umb);
    for (const a of [0, Math.PI]) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), new THREE.MeshStandardMaterial({ color: '#d9c3a3' }));
      seat.position.set(Math.sin(a) * 0.75, 0.45, Math.cos(a) * 0.75);
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), poleM);
      sl.position.set(seat.position.x, 0.225, seat.position.z);
      g.add(seat, sl);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z);
    scene.add(g);
  }
  terraceTable(-4.5, 12.9, '#f2a7bb');
  terraceTable(4.5, 12.9, '#9fbf98');

  // ── across the road: a row of Cairo buildings, facing the café
  const sand = ['#e6cfa6', '#dcbf92', '#efdcbc', '#d4b58a', '#e9d4b4', '#cfae86', '#e3c7a0', '#d9b99a'];
  const awningColors = [['#d4678a', '#fdf3e6'], ['#4d7a4d', '#fdf3e6'], ['#c0763a', '#fdf3e6'], ['#3f6a8a', '#fdf3e6'], ['#8a4d6a', '#fdf3e6']];
  const awningTex = awningColors.map(([a, b]) => canvasTex(128, (ctx, s) => {
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? b : a; ctx.fillRect(i * s / 8, 0, s / 8, s); }
  }, { repeat: [2, 1] }));
  const winM = new THREE.MeshStandardMaterial({ color: '#4b4038', roughness: 0.4, emissive: '#ffc77a', emissiveIntensity: 0 });
  const winLitM = new THREE.MeshStandardMaterial({ color: '#4b4038', roughness: 0.4, emissive: '#ffd08f', emissiveIntensity: 0 });
  nightMats.push({ mat: winLitM, max: 1.1 }, { mat: winM, max: 0.15 });
  const shutterM = [new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#4f6f5a', roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.8 })];
  const shopGlassM = new THREE.MeshStandardMaterial({ color: '#2f3640', roughness: 0.15, metalness: 0.3, emissive: '#ffcf8f', emissiveIntensity: 0 });
  nightMats.push({ mat: shopGlassM, max: 0.6 });
  const dishM = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.5, side: THREE.DoubleSide });
  const tankM = new THREE.MeshStandardMaterial({ color: '#3c4a56', roughness: 0.6 });
  const shopSigns = ['مخبز', 'كافيه', 'صيدلية', 'زهور', 'كتب', 'عصير', 'حلويات', 'بقالة'];

  function building(w, h, d, mat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.12), mat);
    body.position.set(0, h / 2, -d / 2);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    // a ledge between the shop and the flats
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.18, 0.35), new THREE.MeshStandardMaterial({ color: '#efe3cc', roughness: 0.9 }));
    ledge.position.set(0, 3.3, 0.1);
    g.add(ledge);
    // ground floor: a shop with a glass front, a striped awning and a sign
    const shop = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, 2.3), shopGlassM);
    shop.position.set(0, 1.3, 0.02);
    g.add(shop);
    const ai = Math.floor(r() * awningTex.length);
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.9, 1.3), new THREE.MeshStandardMaterial({ map: awningTex[ai], roughness: 0.9, side: THREE.DoubleSide }));
    awn.rotation.x = -1.0;
    awn.position.set(0, 2.85, 0.55);
    awn.castShadow = true;
    g.add(awn);
    const sign = makeSign([{ text: shopSigns[Math.floor(r() * shopSigns.length)], font: 'serif', size: 150, weight: '700', color: '#fdf3e6' }],
      Math.min(2.4, w - 1.4), 0.5, { bg: awningColors[ai][0], border: null, radius: 12 });
    sign.position.set(0, 3.12, 0.3);
    g.add(sign);
    // the flats above: shuttered windows, some lit, some with balconies
    const floorsN = Math.max(1, Math.floor((h - 3.6) / 2.6));
    const cols = Math.max(1, Math.floor(w / 1.9));
    for (let f = 0; f < floorsN; f++) {
      const y = 4.6 + f * 2.6;
      const balcony = r() < 0.35;
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + (c + 0.5) * (w / cols);
        const wdw = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.3), r() < 0.35 ? winLitM : winM);
        wdw.position.set(x, y, 0.02);
        g.add(wdw);
        const sm = shutterM[Math.floor(r() * shutterM.length)];
        for (const side of [-1, 1]) {
          const sh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.34, 0.04), sm);
          sh.position.set(x + side * 0.66, y, 0.04);
          g.add(sh);
        }
        if (balcony) {
          const slabB = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: '#efe3cc' }));
          slabB.position.set(x, y - 0.75, 0.35);
          const rail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: '#3a2f2a', roughness: 0.5 }));
          rail.position.set(x, y - 0.45, 0.68);
          g.add(slabB, rail);
          if (r() < 0.4) {
            const pot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: '#5f9a5a', roughness: 0.9 }));
            pot.position.set(x + 0.45, y - 0.5, 0.45);
            g.add(pot);
          }
        }
      }
    }
    // the roof: a parapet, water tanks and satellite dishes
    const par = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.15), mat);
    par.position.set(0, h + 0.25, 0);
    g.add(par);
    const dishes = 1 + Math.floor(r() * 3);
    for (let i = 0; i < dishes; i++) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), dishM);
      dish.rotation.x = -1.1;
      dish.position.set(-w / 2 + 0.8 + r() * (w - 1.6), h + 0.45, -0.8 - r() * (d - 1.6));
      g.add(dish);
    }
    if (r() < 0.6) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 16), tankM);
      tank.position.set(-w / 2 + 1 + r() * (w - 2), h + 0.45, -d / 2);
      g.add(tank);
    }
    return g;
  }

  // one street-front row per side, buildings shoulder to shoulder
  function row(side) {
    const along = side === 'n' || side === 's' ? STREET.far.x * 2 + 10 : STREET.far.z * 2 - 2;
    let pos = -along / 2;
    while (pos < along / 2) {
      const w = 5 + r() * 4;
      // the back street stays low, so the mosque shows over the roofs
      const h = side === 'n' ? 6 + r() * 3.5 : 8 + r() * 9;
      const b = building(w, h, 7, new THREE.MeshStandardMaterial({ color: sand[Math.floor(r() * sand.length)], roughness: 0.95 }));
      const c = pos + w / 2;
      if (side === 'n') { b.position.set(c, 0, -STREET.far.z); }
      else if (side === 's') { b.position.set(c, 0, STREET.far.z); b.rotation.y = Math.PI; }
      else if (side === 'w') { b.position.set(-STREET.far.x, 0, c); b.rotation.y = Math.PI / 2; }
      else { b.position.set(STREET.far.x, 0, c); b.rotation.y = -Math.PI / 2; }
      scene.add(b);
      pos += w + 0.15;
    }
  }
  ['n', 's', 'w', 'e'].forEach(row);

  // further out, the rest of the city: lower and hazier
  const farM = sand.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 45 + r() * 110;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (z < -36 && x > -30 && x < 20 && d < 70) continue; // keep the mosque clear
    const w = 6 + r() * 12, h = 6 + r() * 22, dd = 6 + r() * 10;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), farM[Math.floor(r() * farM.length)]);
    b.position.set(x, h / 2, z);
    b.rotation.y = r() * Math.PI;
    scene.add(b);
  }

  // ── the mosque behind the back street, and Cairo Tower far away
  const stoneM = new THREE.MeshStandardMaterial({ color: '#efe0c4', roughness: 0.9 });
  function minaret(x, z, h) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, h * 0.45, 8), stoneM);
    base.position.y = h * 0.225;
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, h * 0.35, 32), stoneM);
    mid.position.y = h * 0.625;
    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.85, 0.4, 32), stoneM);
    balcony.position.y = h * 0.62;
    const balcony2 = balcony.clone();
    balcony2.scale.setScalar(0.8);
    balcony2.position.y = h * 0.8;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, h * 0.16, 32), stoneM);
    top.position.y = h * 0.88;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, h * 0.14, 32), new THREE.MeshStandardMaterial({ color: '#7aab7a', roughness: 0.6 }));
    cap.position.y = h * 1.0;
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), new THREE.MeshStandardMaterial({ color: '#c9a25b', metalness: 0.8, roughness: 0.3 }));
    fin.position.y = h * 1.09;
    g.add(base, mid, balcony, balcony2, top, cap, fin);
    g.position.set(x, 0, z);
    scene.add(g);
  }
  function dome(x, z, rad) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(rad * 3.4, 7, rad * 3.4), stoneM);
    base.position.set(x, 3.5, z);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.95, rad, rad * 0.8, 48), stoneM);
    drum.position.set(x, 7 + rad * 0.4, z);
    const d = new THREE.Mesh(new THREE.SphereGeometry(rad, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), stoneM);
    d.position.set(x, 7 + rad * 0.8, z);
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 24, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: '#c9a25b', metalness: 0.8, roughness: 0.3 }));
    crescent.position.set(x, 7 + rad * 1.8 + 0.6, z);
    [base, drum, d, crescent].forEach(o => scene.add(o));
  }
  minaret(-17, -46, 28);
  minaret(5, -50, 32);
  dome(-6, -50, 6);
  minaret(55, 30, 26);
  minaret(-70, 40, 30);
  // Cairo Tower: a slender lattice shaft with its lotus crown
  {
    const g = new THREE.Group();
    const towerM = new THREE.MeshStandardMaterial({ color: '#c99a72', roughness: 0.8 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 80, 24, 12, true), towerM);
    shaft.position.y = 40;
    const lattice = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.5, 80, 24, 20, true), new THREE.MeshStandardMaterial({ color: '#a9785a', wireframe: true }));
    lattice.position.y = 40;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 2.4, 6, 24), towerM);
    crown.position.y = 83;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 4, 16), towerM);
    top.position.y = 88;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 10, 8), towerM);
    mast.position.y = 95;
    g.add(shaft, lattice, crown, top, mast);
    g.position.set(95, 0, -150);
    scene.add(g);
  }

  // ── life on the street
  // cars driving slowly round the block
  const carColors = ['#d9d4c7', '#8a2e2e', '#2f4f6f', '#e8b44a', '#f4f1ea', '#3a3a3a'];
  function car(color) {
    const g = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(3.8, 0.75, 1.7, 3, 0.25), bodyM);
    body.position.y = 0.6;
    const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.6, 1.5, 3, 0.22), new THREE.MeshStandardMaterial({ color: '#2a3138', roughness: 0.1, metalness: 0.4 }));
    cabin.position.set(-0.2, 1.2, 0);
    g.add(body, cabin);
    for (const [x, z] of [[1.2, 0.8], [-1.2, 0.8], [1.2, -0.8], [-1.2, -0.8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 20), new THREE.MeshStandardMaterial({ color: '#1e1e1e', roughness: 0.8 }));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.34, z);
      g.add(w);
    }
    const lightM = new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe9b0', emissiveIntensity: 0 });
    nightMats.push({ mat: lightM, max: 2 });
    for (const z of [0.55, -0.55]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), lightM);
      hl.position.set(1.9, 0.68, z);
      g.add(hl);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    return g;
  }
  // the loop runs anticlockwise in the inner lane
  const laneX = midX - 1.4, laneZ = midZ - 1.4;
  const loopLen = 4 * laneX + 4 * laneZ;
  function onLoop(s) {
    s = ((s % loopLen) + loopLen) % loopLen;
    const a = 2 * laneX, b = 2 * laneZ;
    if (s < a) return { x: -laneX + s, z: laneZ, ry: 0 };
    s -= a; if (s < b) return { x: laneX, z: laneZ - s, ry: Math.PI / 2 };
    s -= b; if (s < a) return { x: laneX - s, z: -laneZ, ry: Math.PI };
    s -= a; return { x: -laneX, z: -laneZ + s, ry: -Math.PI / 2 };
  }
  const cars = [0, 1, 2].map(i => ({ g: car(carColors[i]), s: i * loopLen / 3, speed: 3.2 + i * 0.6 }));
  // and two parked ones on the far side of the road
  const parked1 = car(carColors[3]); parked1.position.set(-9, 0, -(STREET.road.z - 1.3));
  const parked2 = car(carColors[4]); parked2.position.set(12, 0, STREET.road.z - 1.3); parked2.rotation.y = Math.PI;

  // people strolling round the café's pavement
  const walkers = [];
  const looks = [
    { body: 'person', skin: '#c99a74', hair: '#2a1d1a', hairStyle: 'bun', outfit: '#6b8fb5', accent: '#fef9f5', accessory: 'scarf' },
    { body: 'person', skin: '#e0b48c', hair: '#3b2a22', hairStyle: 'short', outfit: '#a0714f', accent: '#efe0c4', accessory: 'none' },
    { body: 'person', skin: '#7d5236', hair: '#2a1d1a', hairStyle: 'curly', outfit: '#e8b44a', accent: '#fef9f5', accessory: 'headphones' },
    { body: 'cat', skin: '#c9b8a8', accent: '#fef9f5', outfit: '#9fbf98' },
  ];
  const walkX = STREET.pave.x - 1.6, walkZ = STREET.pave.z - 1.6;
  const walkLen = 4 * walkX + 4 * walkZ;
  function onWalk(s) {
    s = ((s % walkLen) + walkLen) % walkLen;
    const a = 2 * walkX, b = 2 * walkZ;
    if (s < a) return { x: -walkX + s, z: walkZ, ry: Math.PI / 2 };
    s -= a; if (s < b) return { x: walkX, z: walkZ - s, ry: Math.PI };
    s -= b; if (s < a) return { x: walkX - s, z: -walkZ, ry: -Math.PI / 2 };
    s -= a; return { x: -walkX, z: -walkZ + s, ry: 0 };
  }
  looks.forEach((look, i) => {
    const av = buildAvatar(look);
    scene.add(av.group);
    walkers.push({ av, s: i * walkLen / looks.length + r() * 5, speed: (i % 2 ? -1 : 1) * (0.9 + r() * 0.3) });
  });

  // birds: a few soft V shapes gliding in slow circles
  const birdM = new THREE.MeshBasicMaterial({ color: '#4a3a3a', side: THREE.DoubleSide, transparent: true });
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.18), birdM);
      wing.position.x = side * 0.42;
      g.add(wing);
      g.userData[side < 0 ? 'l' : 'r'] = wing;
    }
    g.userData = { ...g.userData, rad: 30 + r() * 40, h: 26 + r() * 14, ph: r() * Math.PI * 2, sp: 0.05 + r() * 0.04 };
    scene.add(g);
    birds.push(g);
  }

  // rain: streaks falling everywhere outside the building
  const RAIN_N = 2400;
  const rainPos = new Float32Array(RAIN_N * 6);
  const rainSeed = new Float32Array(RAIN_N * 3);
  function dropAt(i, y) {
    let x, z;
    do { x = (Math.random() - 0.5) * 100; z = (Math.random() - 0.5) * 90; }
    while (Math.abs(x) < 15.6 && Math.abs(z) < 11.6); // the café has a roof
    rainSeed[i * 3] = x; rainSeed[i * 3 + 1] = y; rainSeed[i * 3 + 2] = z;
  }
  for (let i = 0; i < RAIN_N; i++) dropAt(i, Math.random() * 30);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainM = new THREE.LineBasicMaterial({ color: '#e2e9f0', transparent: true, opacity: 0.6, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainM);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  let wx = { sun: 1, clouds: 0.25, cloudGrey: 0, rain: 0, fog: 0, fogColor: null, sky: null, wet: 0, birds: 1, flashes: 0 };
  let flashK = 0;
  let skyState = [12, 1, 0, 0];
  function setWeather(look) {
    wx = look;
    rain.visible = wx.rain > 0;
    rainM.opacity = Math.min(0.85, 0.5 + wx.rain * 0.22);
    for (const { mat, rough } of wetMats) {
      mat.roughness = rough - wx.wet * 0.6;
      mat.color.setScalar(1 - wx.wet * 0.28);
    }
    setSky(...skyState);
  }
  function setFlash(k) {
    flashK = k;
    if (k > 0) {
      skyU.top.value.lerp(new THREE.Color('#e8ecff'), k * 0.6);
      skyU.horizon.value.lerp(new THREE.Color('#f4f6ff'), k * 0.6);
    } else setSky(...skyState);
  }

  function setSky(hour, day, dusk, night) {
    skyState = [hour, day, dusk, night];
    const dayTop = new THREE.Color('#7fb8f0'), dayHor = new THREE.Color('#fbe8cc');
    const duskTop = new THREE.Color('#6d6aa8'), duskHor = new THREE.Color('#ffb48a');
    const nightTop = new THREE.Color('#0d1530'), nightHor = new THREE.Color('#2b3159');
    const top = nightTop.clone().lerp(dayTop, day).lerp(duskTop, Math.min(1, dusk) * 0.7);
    const hor = nightHor.clone().lerp(dayHor, day).lerp(duskHor, Math.min(1, dusk) * 0.8);
    // the weather greys, dims or tints the sky
    if (wx.sky) {
      const tint = new THREE.Color(wx.sky);
      const k = Math.min(1, wx.clouds * 0.6 + wx.fog * 0.5);
      top.lerp(tint.clone().multiplyScalar(0.25 + 0.75 * day), k);
      hor.lerp(tint.clone().multiplyScalar(0.3 + 0.7 * day), k);
    }
    skyU.top.value.copy(top);
    skyU.horizon.value.copy(hor);
    skyU.bottom.value.copy(hor.clone().multiplyScalar(0.85));
    // haze, mist or dust close in the distance
    const fogC = wx.fogColor ? hor.clone().lerp(new THREE.Color(wx.fogColor).multiplyScalar(0.3 + 0.7 * day), wx.fog) : hor;
    scene.fog.color.copy(fogC);
    // (the inside of the café doesn't fog up — see noFog)
    scene.fog.near = 80 * (1 - wx.fog) ** 2 + 1;
    scene.fog.far = 260 * (1 - wx.fog) ** 1.5 + 35 * wx.fog;
    stars.material.opacity = Math.max(0, night - 0.3);
    const a = ((hour - 6) / 12.5) * Math.PI;
    sunDisc.position.set(Math.cos(a) * -170 - 40, Math.max(-20, Math.sin(a) * 190), -160);
    sunDisc.lookAt(0, 0, 0);
    sunGlow.position.copy(sunDisc.position);
    sunDisc.material.opacity = day;
    sunGlow.material.opacity = day * 0.8;
    sunDisc.material.color.set(dusk > 0.3 ? '#ffc58f' : '#fff4d6');
    moon.position.set(80, 140, -200);
    moon.lookAt(0, 0, 0);
    moon.material.opacity = night;
    const showClouds = Math.round(clouds.length * wx.clouds);
    clouds.forEach((c, i) => {
      c.visible = i < showClouds;
      const base = new THREE.Color(night > 0.5 ? '#3a4266' : dusk > 0.3 ? '#ffd2b8' : '#ffffff');
      c.material.color.copy(base.lerp(new THREE.Color(night > 0.5 ? '#2a2f40' : '#8d939c'), wx.cloudGrey));
      c.material.opacity = (0.5 + day * 0.35) * (0.7 + wx.clouds * 0.3);
    });
    stars.material.opacity *= 1 - Math.min(1, wx.clouds * 0.8 + wx.fog * 0.6);
    moon.material.opacity *= 1 - Math.min(0.9, wx.clouds * 0.7 + wx.fog * 0.5);
    for (const { mat, max } of nightMats) mat.emissiveIntensity = night * max + (dusk > 0.4 ? 0.2 * max : 0);
    lampGlows.forEach(g => { g.material.opacity = night * 0.9; });
    birds.forEach(b => { b.visible = day > 0.2 && wx.birds > 0.5; });
    ground.material.color.set(night > 0.5 ? '#5e5a66' : '#cdb58f');
  }

  function update(dt, t) {
    animated.forEach(f => f(dt, t));
    if (rain.visible) {
      const fall = (18 + wx.rain * 10) * dt;
      const slant = 0.12 + wx.rain * 0.12;
      for (let i = 0; i < RAIN_N; i++) {
        let y = rainSeed[i * 3 + 1] - fall;
        if (y < 0) { dropAt(i, 30); y = 30; }
        rainSeed[i * 3 + 1] = y;
        const x = rainSeed[i * 3], z = rainSeed[i * 3 + 2];
        rainPos.set([x, y, z, x + slant, y + 1.0, z], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    clouds.forEach(c => {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 260) c.position.x = -260;
    });
    for (const c of cars) {
      c.s += c.speed * dt;
      const p = onLoop(c.s);
      c.g.position.set(p.x, 0, p.z);
      c.g.rotation.y = lerpAngleW(c.g.rotation.y, p.ry, Math.min(1, dt * 4));
    }
    for (const w of walkers) {
      w.s += w.speed * dt;
      const p = onWalk(w.s);
      w.av.group.position.set(p.x, 0, p.z);
      w.av.group.rotation.y = lerpAngleW(w.av.group.rotation.y, w.speed > 0 ? p.ry : p.ry + Math.PI, Math.min(1, dt * 5));
      w.av.update(dt, { moving: true });
    }
    birds.forEach(b => {
      const u = b.userData;
      const a = t * u.sp + u.ph;
      b.position.set(Math.cos(a) * u.rad, u.h + Math.sin(t * 0.3 + u.ph) * 2, Math.sin(a) * u.rad - 20);
      b.rotation.y = -a;
      const flap = Math.sin(t * 6 + u.ph) * 0.4;
      u.l.rotation.z = flap; u.r.rotation.z = -flap;
    });
  }

  return { setSky, setWeather, setFlash, update };
}

function lerpAngleW(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
