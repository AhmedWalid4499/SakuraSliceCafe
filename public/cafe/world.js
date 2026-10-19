// The café: room, furniture, the team, the view of Cairo outside, and the
// light — which follows Cairo's real time of day.
//
// Units are metres. The room runs x −11…11, z −8…8, and is 4.2 m tall.
// The entrance is on the front wall (z = +8); the back door (z = −8) opens
// onto a Cairo street with minarets and palms.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildAvatar, makeLabel } from './avatar.js';
import { makeDessert } from './pastries.js';
import { mapX, mapZ, deltaAt, OLD } from './layout.mjs';
import { buildHome } from './home.js';
import { buildHall, HALL } from './hall.js';
import { buildCommon, COMMON } from './common.js';
import { ROOM_SIZE as HOME_SIZE } from './furniture.mjs';

export const ROOM = { minX: -15, maxX: 15, minZ: -11, maxZ: 11, h: 4.2 };
export const FLOOR2_Y = 4.4;      // the upstairs floor
export const FLOOR2_H = 3.6;      // upstairs ceiling height
export const FLOOR3_Y = FLOOR2_Y + FLOOR2_H + 0.3; // the roof garden, on top of it all
export const STAIRS = { x: mapX(1.1), z: mapZ(-6.7), r: 1.15 };

const COLORS = {
  plaster: '#efe6db', sage: '#93ab8c', sageDark: '#6a8c66', wood: '#9a6a46', woodDark: '#6e472e',
  woodLight: '#bf9168', cream: '#f8f2ea', sakura: '#dd9aab', sakuraDark: '#c4627f', forest: '#2f5d3a',
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

// A soft print for an empty photo frame: a sakura branch on warm paper.
function sakuraPrint(seed, aspect) {
  const w = 512, h = Math.round(512 / aspect);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const r = rand(31 + seed * 7);
  const bg = x.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, ['#f6efe6', '#eef1ea', '#f7ece9'][seed % 3]); bg.addColorStop(1, '#efe4d6');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#5a3c2c'; x.lineCap = 'round';
  const branch = (x0, y0, a, len, wd, depth) => {
    if (depth > 4 || len < 14) return;
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    x.lineWidth = wd; x.beginPath(); x.moveTo(x0, y0);
    x.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 20, (y0 + y1) / 2 + (r() - 0.5) * 20, x1, y1); x.stroke();
    for (let i = 0; i < 4; i++) {
      x.fillStyle = `rgba(${226 + r() * 20},${150 + r() * 40},${168 + r() * 30},${0.55 + r() * 0.35})`;
      x.beginPath(); x.arc(x1 + (r() - 0.5) * 34, y1 + (r() - 0.5) * 34, 5 + r() * 9, 0, Math.PI * 2); x.fill();
    }
    branch(x1, y1, a - 0.5 - r() * 0.3, len * 0.7, wd * 0.65, depth + 1);
    branch(x1, y1, a + 0.35 + r() * 0.3, len * 0.62, wd * 0.6, depth + 1);
  };
  branch(seed % 2 ? w * 0.95 : w * 0.05, h * (0.75 + r() * 0.2), seed % 2 ? Math.PI + 0.45 : -0.45, w * 0.32, 11, 0);
  x.fillStyle = 'rgba(90,60,44,.55)'; x.font = 'italic 22px Georgia, serif'; x.textAlign = 'right';
  x.fillText('Sakura Slice', w - 24, h - 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Surfaces that read as real things up close: near-white maps (the
// material's colour still decides the hue) with a matching bump, so light
// rakes across plaster, wood grain and woven fabric instead of flat paint.
function surface(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(...repeat);
  map.anisotropy = 8;
  const bump = map.clone();
  bump.colorSpace = THREE.NoColorSpace;
  return { map, bump };
}
function plasterSurface() {
  return surface(512, (ctx, s) => {
    ctx.fillStyle = '#f4f1ec'; ctx.fillRect(0, 0, s, s);
    const r = rand(11);
    // soft trowel clouds, then a fine grit
    for (let i = 0; i < 260; i++) {
      const x = r() * s, y = r() * s, rad = 20 + r() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const v = r() < 0.5 ? '255,255,255' : '214,204,192';
      g.addColorStop(0, `rgba(${v},0.09)`); g.addColorStop(1, `rgba(${v},0)`);
      ctx.fillStyle = g;
      for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) { ctx.save(); ctx.translate(dx, dy); ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); ctx.restore(); }
    }
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(190,178,164,0.1)' : 'rgba(255,255,255,0.14)';
      ctx.fillRect(r() * s, r() * s, 1 + r() * 1.5, 1 + r() * 1.5);
    }
  }, [3, 3]);
}
function woodSurface() {
  return surface(512, (ctx, s) => {
    ctx.fillStyle = '#ece4da'; ctx.fillRect(0, 0, s, s);
    const r = rand(23);
    for (let i = 0; i < 120; i++) {
      const y0 = r() * s, amp = 3 + r() * 8, f = 1 + Math.floor(r() * 3);
      ctx.strokeStyle = r() < 0.6 ? `rgba(120,90,60,${0.08 + r() * 0.14})` : `rgba(255,250,240,${0.1 + r() * 0.15})`;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= s; x += 8) {
        const y = y0 + Math.sin((x / s) * Math.PI * 2 * f + i) * amp;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // a knot or two
    for (let k = 0; k < 2; k++) {
      const x = r() * s, y = r() * s;
      for (let j = 6; j > 0; j--) { ctx.strokeStyle = `rgba(110,75,45,${0.06 * j})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y, j * 5, j * 2.2, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
  }, [1, 1]);
}
function fabricSurface() {
  return surface(256, (ctx, s) => {
    ctx.fillStyle = '#f2eee9'; ctx.fillRect(0, 0, s, s);
    const r = rand(5);
    for (let y = 0; y < s; y += 4) for (let x = 0; x < s; x += 4) {
      const over = ((x + y) / 4) % 2;
      ctx.fillStyle = over ? `rgba(255,255,255,${0.35 + r() * 0.2})` : `rgba(170,160,150,${0.2 + r() * 0.15})`;
      ctx.fillRect(x, y, 4, 2);
      ctx.fillRect(x + (over ? 0 : 2), y + 2, 2, 2);
    }
  }, [4, 4]);
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
  const floors = { main: mkFloor(), up: mkFloor(), garden: mkFloor(), home: mkFloor(), hall: mkFloor(), common: mkFloor() };
  scene.add(floors.main.group, floors.up.group, floors.garden.group, floors.home.group, floors.hall.group, floors.common.group);
  // the Common room (common.js), off the hallway, for everyone who lives upstairs
  floors.common.group.position.y = FLOOR2_Y;
  floors.common.group.visible = false;
  let common = null;
  // the hallway upstairs (hall.js), with everyone's doors off it
  floors.hall.group.position.y = FLOOR2_Y;
  floors.hall.group.visible = false;
  let hall = null;
  // someone's own room upstairs (home.js), at the same height as the group rooms
  floors.home.group.position.y = FLOOR2_Y;
  floors.home.group.visible = false;
  let home = null;
  floors.up.group.position.y = FLOOR2_Y;
  floors.up.group.visible = false;
  floors.garden.group.position.y = FLOOR3_Y;
  floors.garden.group.visible = false;
  let { colliders, seats, surfaces, interactables } = floors.main;
  let root = floors.main.group;
  let FY = 0; // world height of the floor being built
  const animated = [];    // (dt, t) => void
  const npcs = [];

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // ── materials
  const plasterS = plasterSurface(), woodS = woodSurface(), fabricS = fabricSurface();
  const tex = (S, bumpScale) => ({ map: S.map, bumpMap: S.bump, bumpScale });
  const M = {
    plaster: std(COLORS.plaster, { roughness: 0.95, ...tex(plasterS, 1.2) }),
    sage: std(COLORS.sage, { roughness: 0.88, ...tex(plasterS, 1.0) }),
    wood: std(COLORS.wood, { roughness: 0.58, ...tex(woodS, 0.8) }),
    woodDark: std(COLORS.woodDark, { roughness: 0.5, ...tex(woodS, 0.8) }),
    woodLight: std(COLORS.woodLight, { roughness: 0.55, ...tex(woodS, 0.8) }),
    cream: std(COLORS.cream, { roughness: 0.7 }),
    cushion: std(COLORS.sakura, { roughness: 0.98, ...tex(fabricS, 1.5) }),
    cushionSage: std(COLORS.sage, { roughness: 0.98, ...tex(fabricS, 1.5) }),
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

  // the front door itself is built after the remap (to fit its opening exactly)
  {
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
    return g;
  }

  // A little standing card with the table's number, readable from both sides.
  function numberCard(n, x, y, z, ry) {
    const g = new THREE.Group();
    for (const side of [0, Math.PI]) {
      const s = makeSign([
        { text: String(n), size: 330, weight: '700', color: COLORS.sakuraDark },
        { text: 'table', font: 'Dancing Script, cursive', size: 120, color: COLORS.woodDark },
      ], 0.13, 0.17, { radius: 60 });
      s.rotation.y = side;
      s.position.z = side ? -0.004 : 0.004;
      g.add(s);
    }
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.05), M.woodDark);
    foot.position.y = -0.085;
    g.add(foot);
    g.position.set(x, y + 0.09, z);
    g.rotation.y = ry;
    root.add(g);
    return g;
  }

  function addTable(id, label, x, z, chairAngles, { reserved = false, sign = null, number = null } = {}) {
    const t = roundTable(x, z);
    // the table's id and its vase (moved aside when a game is set out on it)
    t.top.userData.tableId = id;
    t.top.userData.vase = vase(x, t.top.userData.top - FY, z);
    if (number != null) {
      label = `Table ${number}`;
      t.top.userData.tableName = label;
      // the card stands off to one side of the vase, turned to face most of the room
      numberCard(number, x + 0.26, t.top.userData.top - FY, z + 0.16, 0.4);
    }
    chairAngles.forEach((ang, i) => {
      const cx = x + Math.sin(ang) * 0.85;
      const cz = z + Math.cos(ang) * 0.85;
      const ry = ang + Math.PI; // facing the table
      const c = chair(cx, cz, ry);
      colliders.push({ type: 'circle', x: cx, z: cz, r: 0.28 });
      if (!reserved) {
        const seat = { id: `${id}-${i}`, label, x: cx, z: cz, y: FY, h: 0.54, ry, chair: c, table: id };
        seats.push(seat);
        c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: `Sit at ${label}` }; interactables.push(o); } });
      } else {
        c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'info', label, text: sign?.text }; interactables.push(o); } });
      }
    });
    return t;
  }

  // ── tables
  // numbered, so you can find Table 4 (the one by the window)
  addTable('t1', 'the middle table', -5.5, 1.2, [0, Math.PI], { number: 1 });
  addTable('t2', 'the table by the rug', -2.2, 4.4, [Math.PI / 2, -Math.PI / 2], { number: 2 });
  addTable('t3', 'the sunny table', 1.6, 1.0, [0, Math.PI, Math.PI / 2], { number: 3 });
  addTable('t5', 'the table by the tree', 4.6, 4.8, [Math.PI / 2, -Math.PI / 2], { number: 5 });
  addTable('t6', 'the quiet table', -5.6, -3.6, [Math.PI / 2, -Math.PI / 2], { number: 6 });
  addTable('t7', 'the table in the middle of everything', -1.8, -1.2, [0, Math.PI * 2 / 3, -Math.PI * 2 / 3], { number: 7 });

  // Table Four, at the window
  addTable('four', 'Table Four', -9.6, -3.5, [Math.PI / 2 + 0.5, Math.PI / 2 - 0.5 + Math.PI], { number: 4 });
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
    const seat = { id, label, x, z, y: 0.02 + FY, h: 0.59, ry, chair: g };
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
  const menuBoard = { slate: null };
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
    // players can't walk behind the counter; the team can (see the nav grid)
    colliders.push({ type: 'box', minX: 2.75, maxX: 10.3, minZ: -8, maxZ: -4.05, staffOnly: true });

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

    // the menu board: a big chalkboard on the back wall above the shelves,
    // written out from the day's menu (see setMenuBoard)
    const mb = new THREE.Group();
    const frame = rbox(4.5, 1.55, 0.05, 0.02, M.woodDark);
    const slate = new THREE.Mesh(new THREE.PlaneGeometry(4.36, 1.42), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }));
    slate.position.z = 0.027;
    mb.add(frame, slate);
    mb.position.set(6.5, 3.33, -7.96);
    root.add(mb);
    menuBoard.slate = slate;
    const hover = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.55, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    hover.userData = { kind: 'order', label: 'The menu — click to order' };
    mb.add(hover);
    interactables.push(hover);
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
  const bookCover = { mesh: null };
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
    // the Book of the week, framed on the wall above the shelf
    {
      const frame = new THREE.Group();
      const outer = rbox(0.8, 1.1, 0.06, 0.015, M.woodDark);
      const mount = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), M.cream);
      mount.position.z = 0.032;
      bookCover.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.84), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }));
      bookCover.mesh.position.z = 0.034;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.08, depthWrite: false }));
      glass.position.z = 0.045;
      frame.add(outer, mount, bookCover.mesh, glass);
      frame.position.set(0, 3.25, 0.05);
      g.add(frame);
      const plaque = makeSign([
        { text: 'Book of the week', font: 'Dancing Script, cursive', size: 150, color: COLORS.sakuraDark, weight: '700' },
      ], 0.5, 0.12, { radius: 30 });
      plaque.position.set(0, 2.6, 0.08);
      g.add(plaque);
      const fh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
      fh.position.set(0, 3.1, 0.1);
      fh.userData = { kind: 'bookweek', label: 'The Book of the week' };
      g.add(fh);
      interactables.push(fh);
    }
    g.position.set(10.75, 0, 5.4);
    g.rotation.y = -Math.PI / 2;
    root.add(g);
    colliders.push({ type: 'box', minX: 10.3, maxX: 11, minZ: 4.3, maxZ: 6.5 });
    const hover = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 2), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(10.7, 1.2, 5.4);
    hover.userData = { kind: 'shelf', label: 'The story shelf — the stories from the letters' };
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
      id: 'hana', name: 'Hana', role: 'Head Barista', x: 7.3, z: -5.9, ry: 0.15,
      avatar: { body: 'fox', skin: '#b5562b', accent: '#fdf3e6', outfit: '#fef9f5', gender: 'she' }, extra: { apron: '#efe0c4', neckerchief: '#7aab7a' },
      lines: ["What can I make you?", "Sit anywhere — I'll bring it over.", "The hojicha is very good today. I'm not biased. I'm a little biased."],
    },
    {
      id: 'yuki', name: 'Yuki', role: 'Pastry Chef', x: 4.6, z: -5.9, ry: 0.1,
      avatar: { body: 'rabbit', skin: '#f6f2ee', accent: '#fde8ef', outfit: '#f2a7bb', gender: 'she', bottom: 'skirt' }, extra: { apron: '#fffaf4', bow: '#d4678a' },
      lines: ["The Sakura Slice? I won't say how. Sorry.", "I've been here since five. It's the best part of the day.", "If you sit at table four, you'll come back. Everyone does."],
    },
    {
      id: 'yuto', name: 'Yuto', role: 'Owner · Co-founder', x: 2.2, z: -3.4, ry: 0.5,
      avatar: { body: 'person', skin: '#c99a74', hair: '#2a1d1a', hairStyle: 'short', outfit: '#6f9a6c', gender: 'he' }, extra: { apron: '#efe0c4', glasses: 'tortoise', pocket: 'pencil' },
      lines: ["Welcome in. Take your time.", "You don't have to be ready yet.", "Leave a note on the board if you like — someone will need it."],
    },
    {
      id: 'me3temed', name: 'Me3temed', role: 'Co-founder · Mascot', x: 6.5, z: -7.6, y: 2.625, ry: 0, scale: 0.42,
      avatar: { body: 'owl', skin: '#9c8a6a', accent: '#f4ead8', gender: 'he' }, extra: { bowtie: '#2f5d3a' },
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
      { text: 'group rooms · roof garden', size: 70 },
    ], 0.7, 0.32);
    sign.position.set(STAIRS.x - 0.02, 1.2, STAIRS.z + 1.3);
    root.add(fixed(sign));
    const hover = new THREE.Mesh(new THREE.CylinderGeometry(STAIRS.r + 0.2, STAIRS.r + 0.2, ROOM.h, 24), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(STAIRS.x, ROOM.h / 2, STAIRS.z);
    hover.userData = { kind: 'stairs-up', label: 'Go upstairs — the hallway, your room and the roof garden' };
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
      hover.userData = { kind: 'stairs-down', label: 'Out to the hallway' };
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
          const seat = { id: `long-${n++}`, label: 'the big table', x: cx, z: cz, y: FY, h: 0.54, ry, chair: c };
          seats.push(seat);
          c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: 'Sit at the big table' }; interactables.push(o); } });
        }
      }
      for (const [cx, ry] of [[x - w / 2 - 0.45, Math.PI / 2], [x + w / 2 + 0.45, -Math.PI / 2]]) {
        const c = chair(cx, z, ry);
        const seat = { id: `long-${n++}`, label: 'the head of the table', x: cx, z, y: FY, h: 0.54, ry, chair: c };
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
        const seat = { id: `${id}-${i}`, label, x: x + along.x * off, z: z + along.z * off, y: 0.02 + FY, h: 0.595, ry, chair: g };
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
      const seat = { id: `cushion-${i}`, label: 'a floor cushion by the window', x, z, y: FY, h: 0.42, ry: Math.PI, chair: bag };
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

  // ════════════════════════════════════════ THE ROOF GARDEN (third floor)
  // Open to everyone, like the ground floor: café tables under a sakura
  // pergola, benches looking out over Cairo, a coffee cart, and eight raised
  // beds the whole café looks after together (server/garden.js). Built at its
  // real size, after the spread-out above.
  ({ colliders, seats, surfaces, interactables } = floors.garden);
  root = floors.garden.group;
  FY = FLOOR3_Y;
  const gardenLamps = [];
  const gardenBeds = new Map(); // id -> { soil, plants, hover, spot, label }
  {
    const W3 = ROOM.maxX - ROOM.minX, D3 = ROOM.maxZ - ROOM.minZ;
    colliders.push({ type: 'room', fixed: true, minX: ROOM.minX + 0.55, maxX: ROOM.maxX - 0.55, minZ: ROOM.minZ + 0.55, maxZ: ROOM.maxZ - 0.55 });

    // terracotta tiles, warm in the sun
    const tileTex = canvasTex(512, (g, s) => {
      g.fillStyle = '#c98f6b'; g.fillRect(0, 0, s, s);
      const n = 4, c = s / n, r = rand(311);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const k = 0.9 + r() * 0.2;
        g.fillStyle = `rgb(${Math.round(205 * k)}, ${Math.round(146 * k)}, ${Math.round(110 * k)})`;
        g.fillRect(i * c + 3, j * c + 3, c - 6, c - 6);
      }
    }, { repeat: [W3 / 2.4, D3 / 2.4] });
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(W3, D3), std('#ffffff', { map: tileTex, roughness: 0.9 }));
    deck.rotation.x = -Math.PI / 2;
    deck.receiveShadow = true;
    deck.userData.floor = true;
    root.add(deck);
    floors.garden.floorMesh = deck;
    // a gravel path between the beds
    const gravel = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 1.6), std('#d8cbb3', { roughness: 1 }));
    gravel.rotation.x = -Math.PI / 2;
    gravel.position.set(8.3, 0.004, -0.7);
    gravel.receiveShadow = true;
    root.add(gravel);

    // the low wall round the roof (notes can go on it), and the building below
    const parapetM = std(COLORS.plaster, { roughness: 0.95 });
    const capM = std('#e3d4c0', { roughness: 0.8 });
    for (const [x, z, w, d] of [[0, ROOM.minZ - 0.1, W3 + 0.4, 0.3], [0, ROOM.maxZ + 0.1, W3 + 0.4, 0.3], [ROOM.minX - 0.1, 0, 0.3, D3 + 0.4], [ROOM.maxX + 0.1, 0, 0.3, D3 + 0.4]]) {
      const wall = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, 1.05, d), parapetM));
      wall.position.set(x, 0.525, z);
      wall.userData.surface = 'wall';
      surfaces.push(wall);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.07, d + 0.12), capM);
      cap.position.set(x, 1.085, z);
      root.add(wall, cap);
      // the outside of the building, all the way down to the street
      const face = new THREE.Mesh(new THREE.BoxGeometry(w, FLOOR3_Y, d), std('#e9dccb', { roughness: 1 }));
      face.position.set(x, -FLOOR3_Y / 2, z);
      root.add(face);
    }
    // windows on the outside walls, two storeys of them
    {
      const winM = std('#4b5a63', { roughness: 0.2, metalness: 0.3 });
      const frameM = std('#f6efe4', { roughness: 0.7 });
      for (const y of [-FLOOR3_Y + 1.9, -FLOOR3_Y + FLOOR2_Y + 1.7]) {
        for (let x = ROOM.minX + 2.5; x <= ROOM.maxX - 2.4; x += 3.4) {
          for (const z of [ROOM.minZ - 0.27, ROOM.maxZ + 0.27]) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 0.05), frameM); f.position.set(x, y, z);
            const g = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.7, 0.06), winM); g.position.set(x, y, z + Math.sign(z) * 0.01);
            root.add(f, g);
          }
        }
        for (let z = ROOM.minZ + 2.4; z <= ROOM.maxZ - 2.3; z += 3.4) {
          for (const x of [ROOM.minX - 0.27, ROOM.maxX + 0.27]) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 1.6), frameM); f.position.set(x, y, z);
            const g = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 1.4), winM); g.position.set(x + Math.sign(x) * 0.01, y, z);
            root.add(f, g);
          }
        }
      }
    }

    // the little stair house the spiral stairs come up into
    {
      const hx = STAIRS.x, hz = STAIRS.z - 0.2, hw = 3.2, hd = 2.6, hh = 2.5;
      const body = shadowy(new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), parapetM));
      body.position.set(hx, hh / 2, hz);
      body.userData.surface = 'wall';
      surfaces.push(body);
      const roof = shadowy(new THREE.Mesh(new THREE.BoxGeometry(hw + 0.4, 0.14, hd + 0.4), std(COLORS.forest, { roughness: 0.6 })));
      roof.position.set(hx, hh + 0.07, hz);
      const door = rbox(1.1, 2.1, 0.08, 0.02, std(COLORS.sage, { roughness: 0.6 }));
      door.position.set(hx, 1.05, hz + hd / 2 + 0.02);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), M.brass);
      knob.position.set(hx + 0.4, 1.0, hz + hd / 2 + 0.08);
      const lampM = std('#fff1d6', { emissive: '#ffcf8f', emissiveIntensity: 0.4 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), lampM);
      lamp.position.set(hx, 2.3, hz + hd / 2 + 0.12);
      root.add(body, roof, door, knob, lamp);
      colliders.push({ type: 'box', fixed: true, minX: hx - hw / 2, maxX: hx + hw / 2, minZ: hz - hd / 2, maxZ: hz + hd / 2 });
      const sign = makeSign([
        { text: 'downstairs ↓', font: 'Dancing Script, cursive', size: 140, color: COLORS.sakuraDark, weight: '700' },
        { text: 'back to the café', size: 70 },
      ], 0.9, 0.36);
      sign.position.set(hx - 1.05, 1.5, hz + hd / 2 + 0.02);
      root.add(sign);
      // just the door (a flat target facing out): a big box here would sit
      // round the camera when you arrive and swallow every click
      const hover = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), new THREE.MeshBasicMaterial({ visible: false }));
      hover.position.set(hx, 1.15, hz + hd / 2 + 0.07);
      hover.userData = { kind: 'stairs-down', label: 'Down the stairs to the hallway' };
      interactables.push(hover);
      root.add(hover);
    }

    // a garden sign over the stair house
    {
      const s = makeSign([
        { text: 'The Roof Garden', size: 120, weight: '700' },
        { text: 'sit a while · help us grow things 🌿', font: 'Dancing Script, cursive', size: 80, color: COLORS.sakuraDark },
      ], 3.0, 0.62, { bg: COLORS.cream });
      s.position.set(STAIRS.x, 3.1, STAIRS.z + 1.12);
      root.add(s);
    }

    // ── the sakura pergola, with café tables under it
    const PX0 = -12.2, PX1 = -3.2, PZ0 = -4.6, PZ1 = 3.6, PH = 2.75;
    {
      const postM = M.woodDark;
      for (const x of [PX0, (PX0 + PX1) / 2, PX1]) for (const z of [PZ0, PZ1]) {
        const p = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.16, PH, 0.16), postM));
        p.position.set(x, PH / 2, z);
        root.add(p);
        colliders.push({ type: 'circle', fixed: true, x, z, r: 0.14 });
      }
      for (const z of [PZ0, PZ1]) {
        const beam = shadowy(new THREE.Mesh(new THREE.BoxGeometry(PX1 - PX0 + 0.6, 0.18, 0.14), postM));
        beam.position.set((PX0 + PX1) / 2, PH + 0.05, z);
        root.add(beam);
      }
      for (let x = PX0 - 0.1; x <= PX1 + 0.1; x += 0.6) {
        const slat = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, PZ1 - PZ0 + 0.5), M.wood));
        slat.position.set(x, PH + 0.19, (PZ0 + PZ1) / 2);
        root.add(slat);
      }
      // blossom hanging through the slats (instanced, so it stays light)
      const r = rand(77);
      const n = 300;
      const blossom = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 1), std(COLORS.sakura, { roughness: 0.9 }), n);
      const blossom2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 1), std('#f6c9d4', { roughness: 0.9 }), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        for (const inst of [blossom, blossom2]) {
          const edge = r() < 0.3;
          pos.set(PX0 + r() * (PX1 - PX0), PH + 0.28 - (edge ? r() * 0.7 : r() * 0.15), PZ0 + r() * (PZ1 - PZ0));
          if (edge) pos.z = r() < 0.5 ? PZ0 + r() * 0.3 : PZ1 - r() * 0.3;
          sc.setScalar(0.6 + r() * 0.7);
          inst.setMatrixAt(i, m4.compose(pos, q, sc));
        }
      }
      blossom.castShadow = blossom2.castShadow = true;
      root.add(blossom, blossom2);
      // string lights along the beams
      const bulbM = new THREE.MeshBasicMaterial({ color: '#ffe2b0' });
      const bgeo = new THREE.SphereGeometry(0.04, 12, 12);
      for (const z of [PZ0 + 0.05, PZ1 - 0.05, (PZ0 + PZ1) / 2]) {
        for (let i = 0; i <= 18; i++) {
          const k = i / 18;
          const b = new THREE.Mesh(bgeo, bulbM);
          b.position.set(PX0 + (PX1 - PX0) * k, PH - 0.05 - Math.sin(k * Math.PI) * 0.35, z);
          root.add(b);
        }
      }
      // café tables under it
      const tableSpots = [[-10.4, -2.4], [-6.0, -2.6], [-10.2, 1.6], [-5.8, 1.4]];
      tableSpots.forEach(([x, z], ti) => {
        const t = roundTable(x, z, 0.5, 0.76, M.woodLight);
        t.top.userData.label = 'a garden table';
        t.top.userData.tableId = `garden-t${ti}`;
        t.top.userData.vase = vase(x, 0.76 + 0.026, z);
        const chairs = [[x, z - 0.9, 0], [x, z + 0.9, Math.PI], [x - 0.9, z, Math.PI / 2], [x + 0.9, z, -Math.PI / 2]];
        chairs.forEach(([cx, cz, ry], ci) => {
          const c = chair(cx, cz, ry, ci % 2 ? M.cushionSage : M.cushion);
          const seat = { id: `garden-t${ti}-${ci}`, label: 'a table under the sakura', x: cx, z: cz, y: FY, h: 0.54, ry, chair: c, table: `garden-t${ti}` };
          seats.push(seat);
          c.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: 'Sit under the sakura' }; interactables.push(o); } });
        });
      });
      // two lamps for the evenings
      for (const [x, z] of [[-8.2, -0.5], [-4.2, -0.5]]) {
        const g = new THREE.Group();
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 8), std('#3a2a26'));
        cord.position.y = -0.3;
        const shade = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
          std('#fde8ef', { side: THREE.DoubleSide, roughness: 0.8, emissive: '#ffcf8f', emissiveIntensity: 0.25 }));
        shade.position.y = -0.6;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), new THREE.MeshBasicMaterial({ color: '#fff1d6' }));
        bulb.position.y = -0.7;
        g.add(cord, shade, bulb);
        g.position.set(x, PH, z);
        root.add(g);
        const light = new THREE.PointLight('#ffcf94', 3, 8, 1.6);
        light.position.set(x, PH - 0.85, z);
        root.add(light);
        gardenLamps.push({ light, shade, bulb });
      }
    }

    // Me3temed, supervising from the corner of the pergola
    {
      const p = { id: 'me3temed', name: 'Me3temed', role: 'Co-founder · Head of the garden (self-appointed)' };
      const av = buildAvatar({ body: 'owl', skin: '#9c8a6a', accent: '#f4ead8', gender: 'he' }, { bowtie: '#2f5d3a', scale: 0.42 });
      av.group.position.set(PX1, PH + 0.14, PZ1);
      av.group.rotation.y = 0.5;
      root.add(av.group);
      av.group.traverse(o => { if (o.isMesh) { o.userData = { kind: 'npc', npc: p, label: `${p.name} · keeping an eye on the garden` }; interactables.push(o); } });
      animated.push(dt => { if (floors.garden.group.visible) av.update(dt, {}); });
    }

    // benches along the front wall, looking out over the street
    for (const [x, z] of [[-9.5, ROOM.maxZ - 1.0], [-4.5, ROOM.maxZ - 1.0], [0.5, ROOM.maxZ - 1.0]]) {
      const g = new THREE.Group();
      const seatB = rbox(2.0, 0.08, 0.5, 0.03, M.woodLight); seatB.position.y = 0.45;
      const back = rbox(2.0, 0.42, 0.06, 0.03, M.woodLight); back.position.set(0, 0.75, 0.24); back.rotation.x = 0.1;
      g.add(seatB, back);
      for (const lx of [-0.85, 0.85]) {
        const leg = rbox(0.08, 0.45, 0.45, 0.02, M.woodDark); leg.position.set(lx, 0.225, 0);
        g.add(leg);
      }
      g.position.set(x, 0, z);
      root.add(g);
      colliders.push({ type: 'box', fixed: true, minX: x - 1.0, maxX: x + 1.0, minZ: z - 0.3, maxZ: z + 0.3 });
      [-0.5, 0.5].forEach((off, i) => {
        const seat = { id: `garden-bench-${x}-${i}`, label: 'a bench looking out over Cairo', x: x + off, z: z - 0.05, y: FY, h: 0.49, ry: Math.PI, chair: g };
        seats.push(seat);
      });
      g.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat: seats[seats.length - 2], label: 'Sit and look out over Cairo' }; interactables.push(o); } });
    }

    // the coffee cart
    {
      const x = 4.6, z = 6.6;
      const g = new THREE.Group();
      const body = rbox(1.8, 0.95, 0.8, 0.05, std(COLORS.forest, { roughness: 0.5 }));
      body.position.y = 0.62;
      const top = rbox(1.9, 0.06, 0.88, 0.02, M.woodLight);
      top.position.y = 1.12;
      g.add(body, top);
      for (const sx of [-0.7, 0.7]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 10, 24), M.woodDark);
        wheel.position.set(sx, 0.17, 0.42);
        g.add(wheel);
      }
      // the striped canopy
      const awn = canvasTex(256, (c, s) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fffaf4' : COLORS.sakura; c.fillRect(i * s / 8, 0, s / 8, s); } });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 1.1), std('#ffffff', { map: awn, roughness: 0.9 }));
      canopy.position.y = 2.15;
      canopy.rotation.x = -0.12;
      for (const sx of [-0.9, 0.9]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 10), M.woodDark);
        pole.position.set(sx, 1.65, -0.35);
        g.add(pole);
      }
      const machine = rbox(0.45, 0.4, 0.35, 0.04, std('#d9d2c8', { roughness: 0.3, metalness: 0.6 }));
      machine.position.set(-0.45, 1.35, -0.1);
      g.add(canopy, machine);
      for (let i = 0; i < 3; i++) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 16), M.ceramic);
        cup.position.set(0.15 + i * 0.16, 1.2, 0.1);
        g.add(cup);
      }
      const sign = makeSign([{ text: 'the garden cart', font: 'Dancing Script, cursive', size: 110, color: COLORS.sakuraDark, weight: '700' }, { text: 'order anything from the menu ☕', size: 64 }], 1.1, 0.34);
      sign.position.set(0, 0.7, 0.41);
      g.add(sign);
      g.position.set(x, 0, z);
      g.rotation.y = Math.PI;
      root.add(g);
      colliders.push({ type: 'box', fixed: true, minX: x - 1.0, maxX: x + 1.0, minZ: z - 0.5, maxZ: z + 0.5 });
      g.traverse(o => { if (o.isMesh) { o.userData = { kind: 'order', label: 'The garden cart — order a drink' }; interactables.push(o); } });
    }

    // a sakura tree in a big planter, and potted lemon trees
    {
      const x = -0.8, z = 1.0;
      const planter = rbox(1.8, 0.6, 1.8, 0.06, M.woodDark);
      planter.position.set(x, 0.3, z);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.6), std('#5a3d2a', { roughness: 1 }));
      soil.position.set(x, 0.6, z);
      const trunk = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.0, 12), std('#6b4a32', { roughness: 0.9 })));
      trunk.position.set(x, 1.6, z);
      root.add(planter, soil, trunk);
      const r = rand(5);
      for (let i = 0; i < 9; i++) {
        const c = shadowy(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + r() * 0.3, 2), std(i % 3 ? COLORS.sakura : '#f6c9d4', { roughness: 0.9 })));
        c.position.set(x + (r() - 0.5) * 1.6, 2.6 + r() * 0.8, z + (r() - 0.5) * 1.6);
        root.add(c);
      }
      colliders.push({ type: 'box', fixed: true, minX: x - 0.95, maxX: x + 0.95, minZ: z - 0.95, maxZ: z + 0.95 });
      // a ring seat round the planter
      const ring = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 2.1), M.woodLight);
      ring.position.set(x, 0.62, z);
      root.add(ring);
    }
    const lemonTree = (x, z) => {
      const pot = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.7, 24), M.pot));
      pot.position.set(x, 0.35, z);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8), std('#6b4a32'));
      stem.position.set(x, 1.1, z);
      const crown = shadowy(new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), M.leaf));
      crown.position.set(x, 1.85, z);
      root.add(pot, stem, crown);
      const r = rand(Math.round(x * 13 + z * 7));
      for (let i = 0; i < 9; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), std('#f0d24a', { roughness: 0.5 }));
        l.scale.set(1, 0.85, 1.2);
        const a = r() * Math.PI * 2, e = (r() - 0.3) * 1.2;
        l.position.set(x + Math.cos(a) * 0.58 * Math.cos(e), 1.85 + Math.sin(e) * 0.5, z + Math.sin(a) * 0.58 * Math.cos(e));
        root.add(l);
      }
      colliders.push({ type: 'circle', fixed: true, x, z, r: 0.42 });
    };
    lemonTree(ROOM.minX + 1.2, ROOM.minZ + 1.2);
    lemonTree(ROOM.minX + 1.2, ROOM.maxZ - 1.2);
    lemonTree(ROOM.maxX - 1.2, ROOM.maxZ - 1.2);
    lemonTree(-2.2, ROOM.minZ + 1.2);

    // ── the beds: eight raised beds in two rows, a gravel path between
    const BED_LAYOUT = ['mint', 'basil', 'chamomile', 'lavender', 'strawberries', 'tomatoes', 'sunflowers', 'jasmine'];
    const bedX = [3.8, 6.9, 10.0, 13.1], bedZ = [-3.1, 1.7], BW = 2.5, BD = 1.1, BH = 0.5;
    BED_LAYOUT.forEach((id, i) => {
      const x = bedX[i % 4], z = bedZ[Math.floor(i / 4)];
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      for (const [w, d, px, pz] of [[BW, 0.1, 0, -BD / 2], [BW, 0.1, 0, BD / 2], [0.1, BD, -BW / 2, 0], [0.1, BD, BW / 2, 0]]) {
        const plank = rbox(w, BH, d, 0.02, M.wood);
        plank.position.set(px, BH / 2, pz);
        g.add(plank);
      }
      const soil = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.1, 0.06, BD - 0.1), std('#8a6a4a', { roughness: 1 }));
      soil.position.y = BH - 0.08;
      soil.receiveShadow = true;
      g.add(soil);
      const plants = new THREE.Group();
      plants.position.y = BH - 0.05;
      g.add(plants);
      // a little name stake at the path end
      const stake = makeSign([{ text: id === 'tomatoes' ? 'tomatoes' : id, font: 'Dancing Script, cursive', size: 120, color: COLORS.woodDark, weight: '700' }], 0.5, 0.16);
      const toPath = z < -0.7 ? 1 : -1;
      stake.position.set(-BW / 2 + 0.35, BH + 0.12, toPath * (BD / 2 + 0.02));
      if (toPath < 0) stake.rotation.y = Math.PI;
      g.add(stake);
      root.add(g);
      colliders.push({ type: 'box', fixed: true, minX: x - BW / 2, maxX: x + BW / 2, minZ: z - BD / 2, maxZ: z + BD / 2 });
      const hover = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.1, 1.4, BD + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
      hover.position.set(x, 0.7, z);
      hover.userData = { kind: 'garden-bed', bed: id, label: `The ${id} bed` };
      interactables.push(hover);
      root.add(hover);
      // where you stand to work on it: on the path side
      gardenBeds.set(id, { soil, plants, hover, key: '', spot: { x, z: z + toPath * (BD / 2 + 0.45), bx: x, bz: z }, seed: i * 101 + 7 });
    });

    // Yuto's garden list, by the beds
    {
      const x = 8.4, z = -6.2;
      const g = new THREE.Group();
      for (const sx of [-0.55, 0.55]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), M.woodDark);
        leg.position.set(sx, 0.8, 0);
        g.add(leg);
      }
      const board = rbox(1.3, 0.9, 0.05, 0.02, M.woodDark);
      board.position.y = 1.25;
      const face = makeSign([
        { text: "Yuto's garden list", font: 'Dancing Script, cursive', size: 110, color: '#f8f2ea', weight: '700' },
        { text: 'water · weed · plant · pick', size: 60, color: '#e6dccd' },
        { text: 'tap me to see what needs doing', size: 52, color: '#cfc3b2' },
      ], 1.18, 0.78, { bg: '#2f3b33', border: '#2f3b33' });
      face.position.set(0, 1.25, 0.03);
      g.add(board, face);
      g.position.set(x, 0, z);
      root.add(g);
      colliders.push({ type: 'box', fixed: true, minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.15, maxZ: z + 0.15 });
      g.traverse(o => { if (o.isMesh) { o.userData = { kind: 'garden-list', label: "Yuto's garden list — what needs doing" }; interactables.push(o); } });
    }

    // the potting bench, a tap and watering cans by the back wall
    {
      const x = 12.2, z = ROOM.minZ + 0.95;
      const bench = rbox(2.4, 0.08, 0.7, 0.02, M.woodLight);
      bench.position.set(x, 0.9, z);
      root.add(bench);
      for (const [lx, lz] of [[-1.1, -0.28], [1.1, -0.28], [-1.1, 0.28], [1.1, 0.28]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), M.woodDark);
        leg.position.set(x + lx, 0.45, z + lz);
        root.add(leg);
      }
      for (let i = 0; i < 4; i++) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 16), M.pot);
        pot.position.set(x - 0.8 + i * 0.3, 1.02, z);
        root.add(pot);
        const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.leaf);
        sprout.position.set(x - 0.8 + i * 0.3, 1.13, z);
        sprout.scale.y = 0.7;
        root.add(sprout);
      }
      const canM = std('#7aab7a', { roughness: 0.4, metalness: 0.3 });
      for (const [cx, cz] of [[x + 0.6, z], [x - 1.6, z + 0.5]]) {
        const can = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.28, 20), canM));
        can.position.set(cx, cx > x ? 1.08 : 0.14, cz);
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.32, 10), canM);
        spout.position.set(cx + 0.18, can.position.y + 0.08, cz);
        spout.rotation.z = -0.9;
        root.add(can, spout);
      }
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 10), M.brass);
      tap.rotation.x = Math.PI / 2;
      tap.position.set(x - 1.7, 0.7, ROOM.minZ + 0.1);
      root.add(tap);
      colliders.push({ type: 'box', fixed: true, minX: x - 1.25, maxX: x + 1.25, minZ: z - 0.4, maxZ: z + 0.4 });
    }

    // planter boxes along the low wall, full of herbs and flowers
    {
      const r = rand(909);
      const flowerCols = ['#f2a7bb', '#fffaf4', '#f0d24a', '#b8a6d9', '#e07b5a'];
      const runs = [[ROOM.minX + 0.45, -8.5, ROOM.minX + 0.45, 8.5], [-12.5, ROOM.minZ + 0.45, -4.0, ROOM.minZ + 0.45], [ROOM.maxX - 0.45, 4.5, ROOM.maxX - 0.45, 9.0]];
      for (const [x0, z0, x1, z1] of runs) {
        const len = Math.hypot(x1 - x0, z1 - z0), along = Math.abs(x1 - x0) > 0.01;
        const box = rbox(along ? len : 0.5, 0.45, along ? 0.5 : len, 0.03, M.wood);
        box.position.set((x0 + x1) / 2, 0.225, (z0 + z1) / 2);
        root.add(box);
        colliders.push({ type: 'box', fixed: true, minX: Math.min(x0, x1) - 0.3, maxX: Math.max(x0, x1) + 0.3, minZ: Math.min(z0, z1) - 0.3, maxZ: Math.max(z0, z1) + 0.3 });
        const n = Math.round(len / 0.35);
        for (let i = 0; i < n; i++) {
          const k = (i + 0.5) / n;
          const px = x0 + (x1 - x0) * k, pz = z0 + (z1 - z0) * k;
          const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17 + r() * 0.06, 1), M.leaf);
          bush.position.set(px, 0.52, pz);
          bush.scale.y = 0.8;
          root.add(bush);
          if (r() < 0.6) {
            const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std(flowerCols[Math.floor(r() * flowerCols.length)], { roughness: 0.8 }));
            f.position.set(px + (r() - 0.5) * 0.15, 0.68, pz + (r() - 0.5) * 0.15);
            root.add(f);
          }
        }
      }
    }

    // butterflies, drifting over the beds in the daytime
    {
      const wingM = [std('#f6d36b', { side: THREE.DoubleSide }), std('#fde8ef', { side: THREE.DoubleSide }), std('#bfe3f0', { side: THREE.DoubleSide })];
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Group();
        const wl = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), wingM[i % 3]);
        const wr = wl.clone();
        wl.position.x = -0.06; wr.position.x = 0.06;
        b.add(wl, wr);
        root.add(b);
        const cx = 5 + i * 2.6, cz = -0.7 + (i % 2 ? 1.5 : -1.5), ph = i * 1.7;
        animated.push((dt, t) => {
          if (!floors.garden.group.visible) return;
          b.position.set(cx + Math.sin(t * 0.45 + ph) * 2.2, 1.1 + Math.sin(t * 1.3 + ph) * 0.35, cz + Math.cos(t * 0.37 + ph) * 1.6);
          b.rotation.y = t * 0.45 + ph;
          const f = Math.sin(t * 14 + ph) * 0.9;
          wl.rotation.y = f; wr.rotation.y = -f;
        });
      }
    }
  }

  // What's growing in a bed, drawn from its state ({ stage, water, weeds }).
  const GROWS = {
    mint: { leaf: '#5fae6a', flower: '#d9c8ef', kind: 'herb' },
    basil: { leaf: '#4f9a4a', flower: '#fffaf4', kind: 'herb' },
    chamomile: { leaf: '#8fbf6a', flower: '#fffaf4', centre: '#f0c43a', kind: 'daisy' },
    lavender: { leaf: '#9fb08a', flower: '#9a7fd1', kind: 'spike' },
    strawberries: { leaf: '#4e8f45', flower: '#e8384f', kind: 'berry' },
    tomatoes: { leaf: '#4f8a3f', flower: '#e5482f', kind: 'vine' },
    sunflowers: { leaf: '#5f9a4a', flower: '#f2c12e', centre: '#5a3a1e', kind: 'tall' },
    jasmine: { leaf: '#3f7a45', flower: '#fffaf4', kind: 'climber' },
  };
  function drawBed(id, b, s) {
    const g = GROWS[id];
    b.plants.children.slice().forEach(c => { b.plants.remove(c); c.geometry?.dispose(); c.material?.dispose(); });
    const r = rand(b.seed + s.stage * 13);
    const leafM = std(g.leaf, { roughness: 0.85 }), flowerM = std(g.flower, { roughness: 0.7 });
    const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; b.plants.add(o); return o; };
    const spots = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) spots.push([-0.96 + i * 0.48 + (r() - 0.5) * 0.08, -0.22 + j * 0.44 + (r() - 0.5) * 0.08]);
    if (s.stage === 0) {
      // freshly turned soil: three furrows
      for (let k = -1; k <= 1; k++) add(new THREE.BoxGeometry(2.2, 0.03, 0.08), std('#6b4f36', { roughness: 1 }), 0, 0.01, k * 0.28);
    } else if (s.stage === 1) {
      const geo = new THREE.ConeGeometry(0.03, 0.12, 6);
      spots.forEach(([x, z]) => { add(geo, leafM, x - 0.03, 0.06, z); add(geo, leafM, x + 0.03, 0.05, z + 0.02).rotation.z = -0.4; });
    } else {
      const big = s.stage === 3;
      if (g.kind === 'herb' || g.kind === 'berry' || g.kind === 'daisy' || g.kind === 'spike') {
        const geo = new THREE.IcosahedronGeometry(g.kind === 'berry' ? 0.15 : 0.14, 1);
        spots.forEach(([x, z]) => add(geo, leafM, x, 0.1, z, 1.1, g.kind === 'spike' ? 1.2 : 0.75, 1.1));
        if (big) spots.forEach(([x, z]) => {
          if (g.kind === 'spike') for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.012, 0.02, 0.24, 6), flowerM, x + (r() - 0.5) * 0.18, 0.32, z + (r() - 0.5) * 0.18);
          else if (g.kind === 'daisy') for (let k = 0; k < 3; k++) { const fx = x + (r() - 0.5) * 0.2, fz = z + (r() - 0.5) * 0.2; add(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10), flowerM, fx, 0.22, fz); add(new THREE.SphereGeometry(0.014, 8, 6), std(g.centre), fx, 0.23, fz); }
          else if (g.kind === 'berry') for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.03, 10, 8), flowerM, x + (r() - 0.5) * 0.22, 0.06, z + (r() - 0.5) * 0.22, 1, 1.2, 1);
          else for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.022, 8, 6), flowerM, x + (r() - 0.5) * 0.16, 0.2, z + (r() - 0.5) * 0.16);
        });
      } else if (g.kind === 'vine' || g.kind === 'climber') {
        const stakeM = std('#8a6a4a');
        for (const x of [-0.8, 0, 0.8]) {
          add(new THREE.CylinderGeometry(0.015, 0.015, big ? 1.1 : 0.8, 6), stakeM, x, big ? 0.55 : 0.4, 0);
          for (let k = 0; k < (big ? 6 : 4); k++) add(new THREE.IcosahedronGeometry(0.13, 1), leafM, x + (r() - 0.5) * 0.3, 0.15 + k * 0.17, (r() - 0.5) * 0.3, 1, 0.8, 1);
          if (big) for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(g.kind === 'vine' ? 0.04 : 0.025, 10, 8), flowerM, x + (r() - 0.5) * 0.35, 0.25 + r() * 0.75, (r() - 0.5) * 0.35);
        }
      } else if (g.kind === 'tall') {
        const h = big ? 1.5 : 0.8;
        for (const x of [-0.85, -0.3, 0.3, 0.85]) {
          const zx = (r() - 0.5) * 0.2;
          add(new THREE.CylinderGeometry(0.025, 0.03, h, 8), leafM, x, h / 2, zx);
          for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.1, 10, 6), leafM, x + (k % 2 ? 0.1 : -0.1), 0.25 + k * h * 0.25, zx, 1, 0.2, 0.6);
          if (big) {
            const head = add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20), flowerM, x, h + 0.05, zx + 0.05);
            head.rotation.x = Math.PI / 2 - 0.3;
            const c = add(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16), std(g.centre), x, h + 0.05, zx + 0.07);
            c.rotation.x = Math.PI / 2 - 0.3;
          }
        }
      }
    }
    if (s.weeds) {
      const weedM = std('#a3b04a', { roughness: 0.9 });
      for (let k = 0; k < 7; k++) {
        const w = add(new THREE.ConeGeometry(0.035, 0.2, 4), weedM, (r() - 0.5) * 2.2, 0.08, (r() < 0.5 ? -1 : 1) * (0.32 + r() * 0.1));
        w.rotation.z = (r() - 0.5) * 0.8;
      }
    }
  }
  // { id: { stage, water, weeds, plant } } from the server — redraw what changed.
  function setGarden(list = []) {
    for (const s of list) {
      const b = gardenBeds.get(s.id);
      if (!b) continue;
      // dry soil is pale and dusty; watered soil is dark
      b.soil.material.color.set('#9a7a58').lerp(new THREE.Color('#4a3324'), Math.min(1, s.water * 1.4));
      const key = `${s.stage}|${s.weeds ? 1 : 0}`;
      if (key !== b.key) { b.key = key; drawBed(s.id, b, s); }
      const what = s.stage === 0 ? 'bare soil — ready for seeds' : s.stage === 3 ? 'ready to pick' : s.stage === 1 ? 'seedlings' : 'growing';
      const extra = [s.water < 0.35 && s.stage > 0 ? 'thirsty 💧' : '', s.weeds ? 'weedy 🌿' : ''].filter(Boolean).join(', ');
      b.hover.userData.label = `${s.plant} · ${what}${extra ? ' · ' + extra : ''}`;
    }
  }
  const gardenSpots = () => Object.fromEntries([...gardenBeds].map(([id, b]) => [id, b.spot]));

  // back to the ground floor for anything built after this
  ({ colliders, seats, surfaces, interactables } = floors.main);
  root = floors.main.group;
  FY = 0;

  // ── more tables, added after the café grew (already at their real places,
  // so built after the spread-out above). A mix of round tables, little square
  // tables for two, and a bar along each front window with stools — the way a
  // real café fills its floor.
  function squareTable(x, z, w = 0.72, h = 0.76, ry = 0) {
    const g = new THREE.Group();
    const t = rbox(w, 0.05, w, 0.015, M.wood);
    t.position.y = h;
    const apron = rbox(w - 0.08, 0.08, w - 0.08, 0.01, M.woodDark);
    apron.position.y = h - 0.065;
    g.add(t, apron);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, h - 0.03, 16), M.woodDark));
      leg.position.set(lx * (w / 2 - 0.07), (h - 0.03) / 2, lz * (w / 2 - 0.07));
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    root.add(g);
    t.userData.surface = 'table';
    t.userData.top = h + 0.026 + FY;
    surfaces.push(t);
    colliders.push({ type: 'circle', x, z, r: w * 0.62 + 0.12 });
    return { group: g, top: t };
  }
  function seatAt(id, label, cx, cz, ry, i, h, mesh) {
    colliders.push({ type: 'circle', x: cx, z: cz, r: 0.26 });
    const seat = { id: `${id}-${i}`, label, x: cx, z: cz, y: FY, h, ry, chair: mesh, table: id };
    seats.push(seat);
    mesh.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat, label: `Sit at ${label}` }; interactables.push(o); } });
  }
  function addSquare(id, number, x, z, ry, sides) {
    const t = squareTable(x, z, 0.72, 0.76, ry);
    const label = `Table ${number}`;
    t.top.userData.tableName = label;
    t.top.userData.tableId = id;
    t.top.userData.vase = vase(x - 0.12, t.top.userData.top - FY, z - 0.1);
    numberCard(number, x + 0.16, t.top.userData.top - FY, z + 0.12, ry + 0.4);
    sides.forEach((a, i) => {
      const ang = ry + a;
      const cx = x + Math.sin(ang) * 0.72, cz = z + Math.cos(ang) * 0.72;
      seatAt(id, label, cx, cz, ang + Math.PI, i, 0.54, chair(cx, cz, ang + Math.PI, i % 2 ? M.cushionSage : M.cushion));
    });
  }
  function addRound(id, number, x, z, angles) {
    const label = `Table ${number}`;
    const t = roundTable(x, z);
    t.top.userData.tableName = label;
    t.top.userData.tableId = id;
    t.top.userData.vase = vase(x, t.top.userData.top - FY, z);
    numberCard(number, x + 0.26, t.top.userData.top - FY, z + 0.16, 0.4);
    angles.forEach((ang, i) => {
      const cx = x + Math.sin(ang) * 0.85, cz = z + Math.cos(ang) * 0.85;
      seatAt(id, label, cx, cz, ang + Math.PI, i, 0.54, chair(cx, cz, ang + Math.PI));
    });
  }
  // a tall stool: round seat, four splayed legs, a footrest ring
  function stool(x, z, ry) {
    const g = new THREE.Group();
    const top = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.18, 0.05, 32), M.woodLight));
    top.position.y = 0.7;
    const pad = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.035, 32), M.cushion));
    pad.position.y = 0.74;
    g.add(top, pad);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.72, 12), M.woodDark));
      leg.position.set(Math.cos(a) * 0.15, 0.35, Math.sin(a) * 0.15);
      leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
      g.add(leg);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 32), M.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.26;
    g.add(ring);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    root.add(g);
    return g;
  }
  // a bar along a front window: a deep wooden ledge on brackets, stools facing the street
  function windowBar(id, label, x0, x1, n) {
    const z = ROOM.maxZ - 0.32, h = 0.98, w = x1 - x0;
    const top = rbox(w, 0.05, 0.42, 0.015, M.wood);
    top.position.set((x0 + x1) / 2, h, z);
    root.add(top);
    top.userData.surface = 'table';
    top.userData.top = h + 0.026 + FY;
    top.userData.tableName = label;
    surfaces.push(top);
    for (let k = 0; k <= 2; k++) {
      const bx = x0 + 0.2 + (w - 0.4) * k / 2;
      const post = rbox(0.06, h - 0.03, 0.06, 0.01, M.woodDark);
      post.position.set(bx, (h - 0.03) / 2, z + 0.1);
      root.add(post);
    }
    colliders.push({ type: 'box', minX: x0, maxX: x1, minZ: z - 0.25, maxZ: ROOM.maxZ, fixed: true });
    for (let i = 0; i < n; i++) {
      const sx = x0 + w * (i + 0.5) / n, sz = z - 0.55;
      seatAt(id, label, sx, sz, 0, i, 0.75, stool(sx, sz, 0));
    }
    // a couple of small things on the ledge, like a real one
    vase((x0 + x1) / 2, h + 0.026, z + 0.05);
    const card = makeSign([{ text: label, size: 110, weight: '700' }, { text: 'watch Cairo go by', font: 'Dancing Script, cursive', size: 80, color: COLORS.sakuraDark }], 0.3, 0.17);
    card.position.set(x0 + 0.35, h + 0.12, z - 0.02);
    card.rotation.y = Math.PI;
    root.add(card);
  }

  addRound('t8', 8, -11.6, 2.4, [0, Math.PI / 2, Math.PI]);
  addSquare('t9', 9, -8.6, 7.0, 0.2, [Math.PI / 2, -Math.PI / 2]);
  addSquare('t10', 10, 8.6, -2.0, 0, [Math.PI / 2, -Math.PI / 2]);
  addRound('t11', 11, 6.2, 2.6, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  addSquare('t12', 12, -5.4, 4.6, -0.15, [0, Math.PI]);
  windowBar('bar-left', 'the window bar', mapX(-6) - 1.8, mapX(-6) + 1.8, 4);
  windowBar('bar-right', 'the street bar', mapX(6) - 2.8, mapX(6) + 0.6, 4); // kept clear of the sakura tree

  // ── sunlight on the floor: each window throws its shape (panes and all)
  // across the boards, following the sun — long and golden in the morning
  // through the front, amber through the left windows late in the day.
  const paneTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 256, 128);
    const g = x.createRadialGradient(128, 64, 10, 128, 64, 150);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#bbb');
    x.fillStyle = g; x.fillRect(8, 6, 240, 116);
    x.fillStyle = '#000';
    for (const bx of [84, 170]) x.fillRect(bx - 4, 0, 8, 128); // mullions
    x.fillRect(0, 60, 256, 7);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const windowsLit = [
    { wall: 'front', a: mapX(-6) - 2, b: mapX(-6) + 2 }, { wall: 'front', a: mapX(6) - 2, b: mapX(6) + 2 },
    { wall: 'left', a: mapZ(-3.5) - 1.5, b: mapZ(-3.5) + 1.5 }, { wall: 'left', a: mapZ(2.5) - 1.5, b: mapZ(2.5) + 1.5 },
  ].map(w => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: paneTex, color: '#ffd9a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
    }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    root.add(fixed(mesh));
    return { ...w, mesh };
  });
  function lightWindows(sunDir, strength, color) {
    // sunDir: from the room towards the sun
    const L = sunDir.clone().negate(); // the way the light travels
    for (const w of windowsLit) {
      const into = w.wall === 'front' ? -L.z : L.x; // how squarely it comes in through this wall
      const ok = L.y < -0.05 && into > 0.08;
      const k = ok ? strength * Math.min(1, into * 1.6) * Math.min(1, -L.y * 4) : 0;
      w.mesh.visible = k > 0.01;
      if (!w.mesh.visible) continue;
      w.mesh.material.opacity = 0.42 * k;
      w.mesh.material.color.copy(color);
      const pos = w.mesh.geometry.attributes.position;
      // the window's corners: [along the wall, height]
      const corners = [[w.a, 1.0], [w.b, 1.0], [w.b, 3.0], [w.a, 3.0]];
      corners.forEach(([u, y], i) => {
        const t = Math.min(14, y / -L.y);
        const px = w.wall === 'front' ? u : ROOM.minX, pz = w.wall === 'front' ? ROOM.maxZ : u;
        pos.setXYZ(i, px + L.x * t, 0.012, pz + L.z * t);
      });
      pos.needsUpdate = true;
    }
  }

  // ── the photo wall: frames on the left wall for real photos of the café
  // (the owner hangs them from inside the café — see setPhotos). Until a
  // photo goes in, each one holds a soft sakura print.
  const PHOTO_FRAMES = [
    // either side of the café's name sign, and a row past the second window
    { id: 'p1', z: -2.75, y: 2.05, w: 0.62, h: 0.8 },
    { id: 'p2', z: 1.25, y: 2.15, w: 0.9, h: 0.66 },
    { id: 'p3', z: 8.4, y: 1.95, w: 0.56, h: 0.72 },
    { id: 'p4', z: 5.9, y: 2.0, w: 0.86, h: 0.64 },
    { id: 'p5', z: 7.15, y: 2.05, w: 0.6, h: 0.78 },
  ];
  const photoMeshes = {};
  for (const [n, f] of PHOTO_FRAMES.entries()) {
    const g = new THREE.Group();
    const outer = rbox(f.w + 0.1, f.h + 0.1, 0.04, 0.012, n % 2 ? M.woodDark : M.wood);
    const mount = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), M.cream);
    mount.position.z = 0.021;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(f.w - 0.1, f.h - 0.1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }));
    pic.position.z = 0.023;
    pic.material.map = sakuraPrint(n, f.w / f.h);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.06, depthWrite: false }));
    glass.position.z = 0.026;
    g.add(outer, mount, pic, glass);
    g.position.set(ROOM.minX + 0.04, f.y, f.z);
    g.rotation.y = Math.PI / 2;
    root.add(g);
    photoMeshes[f.id] = pic;
    const hover = new THREE.Mesh(new THREE.BoxGeometry(f.w + 0.1, f.h + 0.1, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.copy(g.position);
    hover.rotation.y = Math.PI / 2;
    hover.userData = { kind: 'photo', id: f.id, label: 'A photo from the café' };
    interactables.push(hover);
    root.add(hover);
  }

  // Weather haze is for outside: nothing inside the café fogs up.
  for (const f of Object.values(floors)) noFog(f.group);

  // ── outside: Cairo
  const outside = buildCairo(scene);

  // ════════════════════════════════════════════════════════════════
  //  Built after the spread-out, in the café's real coordinates:
  //  the front door (fitted to its opening), the kitchen behind the
  //  back door, and the clock over the entrance.
  // ════════════════════════════════════════════════════════════════
  root = floors.main.group;
  const main = floors.main;
  const late = new THREE.Group();
  root.add(late);
  const add = (...objs) => { for (const o of objs) { fixed(o); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); late.add(o); } };
  const kbox = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  // A door leaf with a window cut through it (rect: [x0, y0, x1, y1], or a round porthole).
  function doorLeaf(w, h, win, material) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(w, 0); shape.lineTo(w, h); shape.lineTo(0, h); shape.closePath();
    const hole = new THREE.Path();
    if (win.r) hole.absarc(win.x, win.y, win.r, 0, Math.PI * 2, true);
    else { hole.moveTo(win[0], win[1]); hole.lineTo(win[0], win[3]); hole.lineTo(win[2], win[3]); hole.lineTo(win[2], win[1]); hole.closePath(); }
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
    geo.translate(0, 0, -0.0275);
    const leaf = new THREE.Group();
    leaf.add(new THREE.Mesh(geo, material));
    const glass = win.r ? new THREE.Mesh(new THREE.CircleGeometry(win.r, 40), M.glass)
      : new THREE.Mesh(new THREE.PlaneGeometry(win[2] - win[0], win[3] - win[1]), M.glass);
    glass.position.set(win.r ? win.x : (win[0] + win[2]) / 2, win.r ? win.y : (win[1] + win[3]) / 2, 0);
    leaf.add(glass);
    const ringGeo = win.r ? new THREE.TorusGeometry(win.r, 0.022, 10, 40) : null;
    if (ringGeo) { for (const z of [-0.035, 0.035]) { const r = new THREE.Mesh(ringGeo, M.brass); r.position.set(win.x, win.y, z); leaf.add(r); } }
    return leaf;
  }

  // A proper frame for an opening in a wall at z = wz (jambs, head, and trim on both faces).
  function doorCasing(cx, wz, w, h) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const jamb = kbox(0.08, h, 0.26, M.woodDark); jamb.position.set(cx + s * (w / 2 - 0.04), h / 2, wz); g.add(jamb);
      for (const f of [-1, 1]) {
        const trim = kbox(0.13, h + 0.12, 0.035, M.woodDark); trim.position.set(cx + s * (w / 2 + 0.05), (h + 0.12) / 2, wz + f * 0.118); g.add(trim);
      }
    }
    const head = kbox(w, 0.08, 0.26, M.woodDark); head.position.set(cx, h - 0.04, wz); g.add(head);
    for (const f of [-1, 1]) {
      const ht = kbox(w + 0.36, 0.14, 0.04, M.woodDark); ht.position.set(cx, h + 0.06, wz + f * 0.12); g.add(ht);
    }
    const sill = kbox(w, 0.025, 0.3, M.woodLight); sill.position.set(cx, 0.012, wz); g.add(sill);
    return g;
  }

  // ── the front door: two glazed leaves that fill the opening exactly
  const doorSigns = [];
  // The opening hours (10am–10pm; later in Ramadan), on the door and for the open/closed sign.
  const doorHours = { open: 10, close: 22, mesh: null, at: null, add: null, label: '' };
  const fmtH = h => { const k = ((h % 24) + 24) % 24; return k === 0 ? 'midnight' : k === 12 ? 'noon' : k < 12 ? `${k}am` : `${k - 12}pm`; };
  function setHours(open, close, label = 'every day') {
    Object.assign(doorHours, { open, close, label });
    if (!doorHours.at) return;
    if (doorHours.mesh) { doorHours.mesh.parent.remove(doorHours.mesh); doorHours.mesh.material.map.dispose(); }
    const m = makeSign([{ text: label, size: 70, color: COLORS.woodDark }, { text: `${fmtH(open)} – ${fmtH(close)}`, size: 96, weight: '700' }], 0.38, 0.2, { bg: COLORS.cream });
    m.position.copy(doorHours.at);
    doorHours.add(m);
    doorHours.mesh = m;
    if (doorHours.ready) setTimeOfDay(lastHour);
  }
  const isOpenAt = h => (doorHours.close > doorHours.open ? h >= doorHours.open && h < doorHours.close : h >= doorHours.open || h < doorHours.close);
  {
    const wz = ROOM.maxZ + 0.1, W2 = 2.2, H2 = 2.8;
    add(doorCasing(0, wz, W2, H2));
    const leafW = (W2 - 0.16) / 2 - 0.004, leafH = H2 - 0.08;
    for (const s of [-1, 1]) {
      const leaf = doorLeaf(leafW, leafH, [0.16, 1.25, leafW - 0.16, leafH - 0.2], M.wood);
      leaf.position.set(s < 0 ? -W2 / 2 + 0.08 : W2 / 2 - 0.08 - leafW, 0, wz);
      add(leaf);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 12), M.brass);
      bar.position.set(s < 0 ? -0.14 : 0.14, 1.05, wz - 0.07);
      add(bar);
    }
    // a little hanging sign that turns over at opening and closing time
    for (const [state, text, color] of [['open', 'open', COLORS.sakuraDark], ['closed', 'closed', COLORS.woodDark]]) {
      for (const [dz, ry] of [[-0.06, Math.PI], [0.06, 0]]) {
        const sign = makeSign([{ text, font: 'Dancing Script, cursive', size: 210, color, weight: '700' }], 0.5, 0.24, { bg: COLORS.cream });
        sign.position.set(-0.5, 1.62, wz + dz);
        sign.rotation.y = ry;
        sign.visible = state === 'open';
        doorSigns.push({ state, sign });
        add(sign);
      }
    }
    doorHours.at = new THREE.Vector3(0.5, 1.5, wz + 0.06);
    doorHours.add = add;
    setHours(10, 22);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), std('#b98a62', { roughness: 1 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(0, 0.006, wz - 0.75);
    add(mat);
  }

  // ── a clock over the entrance, on Cairo time (the same face as the street clock)
  {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.07, 48), M.woodDark);
    rim.rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.32, 48), new THREE.MeshStandardMaterial({ map: outside.faceTex, roughness: 0.5 }));
    face.position.z = 0.037;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.018, 10, 48), M.brass);
    ring.position.z = 0.04;
    g.add(rim, face, ring);
    g.position.set(0, 3.5, ROOM.maxZ - 0.04);
    g.rotation.y = Math.PI;
    add(g);
    const hover = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.copy(g.position).add(new THREE.Vector3(0, 0, -0.05));
    hover.rotation.y = Math.PI;
    hover.userData = { kind: 'info', label: 'The café clock — Cairo time', text: 'The same time as the street clock outside. The café opens at 10 and closes at 10.' };
    main.interactables.push(hover);
    late.add(hover);
  }

  // ── the kitchen, through the back door
  const KX = mapX(-8);                                  // the door's centre on the back wall
  const KIT = { minX: -14.8, maxX: -7.0, minZ: -14.4, maxZ: ROOM.minZ - 0.2 };
  const KH = 3.2;
  const kitchenDoor = { x: KX, z: ROOM.minZ - 0.1, open: 0, leaves: [] };
  {
    const wz = ROOM.minZ - 0.1;
    add(doorCasing(KX, wz, 2, 2.7));
    // two swinging leaves with round portholes, hinged at the sides, opening into the kitchen
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(KX + s * 0.92, 0, wz);
      const leaf = doorLeaf(0.91, 2.6, { x: 0.455, y: 1.62, r: 0.17 }, std(COLORS.sage, { roughness: 0.6 }));
      if (s > 0) leaf.position.x = -0.91;
      const plate = kbox(0.5, 0.18, 0.065, M.brass);
      plate.position.set(s < 0 ? 0.6 : -0.6, 1.0, 0);
      hinge.add(leaf, plate);
      add(hinge);
      kitchenDoor.leaves.push({ hinge, s });
    }
    const sign = makeSign([
      { text: 'Kitchen', size: 150, weight: '700' },
      { text: 'Hana & Yuki · knock gently', font: 'Dancing Script, cursive', size: 78, color: COLORS.sakuraDark },
    ], 0.62, 0.24);
    sign.position.set(KX, 2.98, ROOM.minZ + 0.02);
    add(sign);
  }
  {
    const tileTex = softTexture(512, (c, S) => {
      const n = 8, t = S / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        c.fillStyle = (i + j) % 2 ? '#f6efe2' : '#cfe0c7';
        c.fillRect(i * t, j * t, t, t);
      }
      c.strokeStyle = 'rgba(120,100,80,0.25)'; c.lineWidth = 3;
      for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * t, 0); c.lineTo(i * t, S); c.stroke(); c.beginPath(); c.moveTo(0, i * t); c.lineTo(S, i * t); c.stroke(); }
    });
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set((KIT.maxX - KIT.minX) / 2, (KIT.maxZ - KIT.minZ) / 2);
    const floorK = new THREE.Mesh(new THREE.PlaneGeometry(KIT.maxX - KIT.minX + 0.2, KIT.maxZ - KIT.minZ + 0.2), std('#ffffff', { map: tileTex, roughness: 0.4 }));
    floorK.rotation.x = -Math.PI / 2;
    floorK.position.set((KIT.minX + KIT.maxX) / 2, 0.004, (KIT.minZ + KIT.maxZ) / 2);
    floorK.userData = { floor: true };
    add(floorK);
    main.interactables.push(floorK);

    // walls: plaster outside, subway tiles to shoulder height inside
    const subway = softTexture(512, (c, S) => {
      c.fillStyle = '#fbf7f0'; c.fillRect(0, 0, S, S);
      c.strokeStyle = 'rgba(150,130,110,0.35)'; c.lineWidth = 3;
      const rows = 8, h = S / rows;
      for (let r = 0; r < rows; r++) {
        c.beginPath(); c.moveTo(0, r * h); c.lineTo(S, r * h); c.stroke();
        for (let k = 0; k < 4; k++) { const x = (k + (r % 2) * 0.5) * S / 4; c.beginPath(); c.moveTo(x, r * h); c.lineTo(x, (r + 1) * h); c.stroke(); }
      }
    });
    subway.wrapS = subway.wrapT = THREE.RepeatWrapping;
    const tileM = (len) => { const t = subway.clone(); t.needsUpdate = true; t.repeat.set(len / 1.2, 1.5 / 1.2); return std('#ffffff', { map: t, roughness: 0.35 }); };
    const creamM = std('#f6ead6', { roughness: 0.9 });
    const back = wallWithHoles(KIT.maxX - KIT.minX + 0.4, KH, [[-12.1 - (KIT.minX + KIT.maxX) / 2 - 0.7, 1.25, -12.1 - (KIT.minX + KIT.maxX) / 2 + 0.7, 2.25]], M.plaster);
    back.position.set((KIT.minX + KIT.maxX) / 2, 0, KIT.minZ - 0.1);
    const west = kbox(0.2, KH, KIT.maxZ - KIT.minZ + 0.4, M.plaster); west.position.set(KIT.minX - 0.1, KH / 2, (KIT.minZ + KIT.maxZ) / 2);
    const east = west.clone(); east.position.x = KIT.maxX + 0.1;
    const roof = kbox(KIT.maxX - KIT.minX + 0.6, 0.2, KIT.maxZ - KIT.minZ + 0.6, std('#c99a74', { roughness: 0.9 }));
    roof.position.set((KIT.minX + KIT.maxX) / 2, KH + 0.1, (KIT.minZ + KIT.maxZ) / 2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(KIT.maxX - KIT.minX, KIT.maxZ - KIT.minZ), creamM);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set((KIT.minX + KIT.maxX) / 2, KH - 0.001, (KIT.minZ + KIT.maxZ) / 2);
    add(back, west, east, roof, ceil);
    // tiles inside: the back wall (left and right of the window) and the side walls
    const tiles = [
      [KIT.minX, -12.8, 0], [-11.4, KIT.maxX, 0],
    ];
    for (const [x0, x1] of tiles) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 1.5), tileM(x1 - x0));
      p.position.set((x0 + x1) / 2, 0.75, KIT.minZ + 0.005);
      add(p);
    }
    const under = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.25), tileM(1.4));
    under.position.set(-12.1, 0.625, KIT.minZ + 0.005);
    add(under);
    for (const [x, ry] of [[KIT.minX + 0.005, Math.PI / 2], [KIT.maxX - 0.005, -Math.PI / 2]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(KIT.maxZ - KIT.minZ, 1.5), tileM(KIT.maxZ - KIT.minZ));
      p.position.set(x, 0.75, (KIT.minZ + KIT.maxZ) / 2);
      p.rotation.y = ry;
      add(p);
    }
    // the café's back wall, seen from the kitchen side: cream above the tiles
    const winFrame = windowFrame(1.4, 1.0, 1);
    winFrame.position.set(-12.1, 1.75, KIT.minZ - 0.1);
    add(winFrame);
    const glassK = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), M.glass);
    glassK.position.set(-12.1, 1.75, KIT.minZ - 0.1);
    add(glassK);

    // the long counter along the back wall, with a sink under the window
    const counterM = std('#9fbf98', { roughness: 0.8 });
    const topM = std(COLORS.woodLight, { roughness: 0.5 });
    const cBody = rbox(KIT.maxX - 1.9 - KIT.minX, 0.86, 0.62, 0.03, counterM);
    cBody.position.set((KIT.minX + KIT.maxX - 1.9) / 2, 0.43, KIT.minZ + 0.31);
    const cTop = rbox(KIT.maxX - 1.9 - KIT.minX + 0.04, 0.05, 0.66, 0.015, topM);
    cTop.position.set(cBody.position.x, 0.885, KIT.minZ + 0.33);
    const sink = kbox(0.62, 0.02, 0.42, std('#d8dde0', { roughness: 0.2, metalness: 0.6 }));
    sink.position.set(-12.1, 0.912, KIT.minZ + 0.33);
    const tap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 8, 20, Math.PI), M.brass);
    tap.position.set(-12.1, 1.0, KIT.minZ + 0.1);
    add(cBody, cTop, sink, tap);
    for (let x = KIT.minX + 0.35; x < KIT.maxX - 2.0; x += 0.6) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), M.brass);
      knob.position.set(x, 0.72, KIT.minZ + 0.625);
      add(knob);
    }
    main.colliders.push({ type: 'box', minX: KIT.minX, maxX: KIT.maxX - 1.9, minZ: KIT.minZ, maxZ: KIT.minZ + 0.66, fixed: true });

    // the oven and hob at the end, with a pink kettle and a copper hood
    const oven = rbox(1.0, 0.9, 0.66, 0.04, std('#f6ead6', { roughness: 0.45 }));
    oven.position.set(KIT.maxX - 1.35, 0.45, KIT.minZ + 0.33);
    const ovenWin = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.32), new THREE.MeshStandardMaterial({ color: '#ffb36b', emissive: '#ff8a3c', emissiveIntensity: 0.9 }));
    ovenWin.position.set(oven.position.x, 0.42, KIT.minZ + 0.665);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.7, 10), M.brass);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(oven.position.x, 0.7, KIT.minZ + 0.69);
    add(oven, ovenWin, handle);
    for (const [dx, dz] of [[-0.22, 0.15], [0.22, 0.15], [-0.22, 0.45], [0.22, 0.45]]) {
      const burner = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.014, 8, 24), std('#3a3332', { roughness: 0.6 }));
      burner.rotation.x = Math.PI / 2;
      burner.position.set(oven.position.x + dx, 0.905, KIT.minZ + dz);
      add(burner);
    }
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), std('#f2a7bb', { roughness: 0.35 }));
    kettle.scale.y = 0.85;
    kettle.position.set(oven.position.x - 0.22, 1.0, KIT.minZ + 0.45);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.14, 10), kettle.material);
    spout.position.set(oven.position.x - 0.1, 1.04, KIT.minZ + 0.45); spout.rotation.z = -0.9;
    add(kettle, spout);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 0.5, 4, 1), std('#c17f4a', { roughness: 0.35, metalness: 0.7 }));
    hood.rotation.y = Math.PI / 4;
    hood.scale.z = 0.6;
    hood.position.set(oven.position.x, 2.2, KIT.minZ + 0.3);
    add(hood);
    main.colliders.push({ type: 'box', minX: KIT.maxX - 1.9, maxX: KIT.maxX, minZ: KIT.minZ, maxZ: KIT.minZ + 0.7, fixed: true });
    // steam from the kettle
    const steamM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false });
    const puffs = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), steamM.clone());
      late.add(fixed(p));
      puffs.push(p);
    }
    animated.push((dt, t) => puffs.forEach((p, i) => {
      const k = (t * 0.35 + i / puffs.length) % 1;
      p.position.set(oven.position.x - 0.03 + Math.sin(t + i) * 0.03, 1.12 + k * 0.5, KIT.minZ + 0.45);
      p.scale.setScalar(0.6 + k * 1.6);
      p.material.opacity = 0.32 * (1 - k);
    }));

    // the mint fridge in the corner by the door
    const fridge = rbox(0.78, 1.85, 0.7, 0.12, std('#bfe0d0', { roughness: 0.4 }));
    fridge.position.set(KIT.minX + 0.42, 0.925, KIT.maxZ - 0.6);
    const fHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.5, 10), M.brass);
    fHandle.position.set(KIT.minX + 0.8, 1.15, KIT.maxZ - 0.35);
    const note = makeSign([{ text: 'milk, oat milk,', size: 70 }, { text: 'more cardamom ♡', font: 'Dancing Script, cursive', size: 80, color: COLORS.sakuraDark }], 0.2, 0.16);
    note.position.set(KIT.minX + 0.82, 1.45, KIT.maxZ - 0.65);
    note.rotation.y = Math.PI / 2;
    add(fridge, fHandle, note);
    main.colliders.push({ type: 'box', minX: KIT.minX, maxX: KIT.minX + 0.85, minZ: KIT.maxZ - 0.98, maxZ: KIT.maxZ, fixed: true });

    // open shelves with jars, either side of the window
    const jarColors = ['#8fbf6a', '#a0714f', '#f2a7bb', '#e8b44a', '#efe0c4', '#c2405a'];
    let jn = 0;
    for (const [x0, x1] of [[KIT.minX + 0.1, -13.0], [-11.2, KIT.maxX - 2.1]]) {
      for (const y of [1.6, 2.15]) {
        const shelf = kbox(x1 - x0, 0.04, 0.26, M.woodLight);
        shelf.position.set((x0 + x1) / 2, y, KIT.minZ + 0.14);
        add(shelf);
        for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.22) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.17, 16), new THREE.MeshStandardMaterial({ color: jarColors[jn++ % jarColors.length], roughness: 0.3, transparent: true, opacity: 0.85 }));
          jar.position.set(x, y + 0.105, KIT.minZ + 0.14);
          const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 16), M.woodDark);
          lid.position.set(x, y + 0.205, KIT.minZ + 0.14);
          add(jar, lid);
        }
      }
    }
    // hanging copper pans on a rail by the hob
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 10), M.brass);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(KIT.maxX - 0.9, 2.55, KIT.maxZ - 1.2);
    rail.rotation.y = Math.PI / 2;
    add(rail);
    for (let i = 0; i < 3; i++) {
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.13 - i * 0.02, 0.11 - i * 0.02, 0.06, 24), std('#c17f4a', { roughness: 0.3, metalness: 0.8 }));
      pan.rotation.z = Math.PI / 2;
      pan.position.set(KIT.maxX - 0.15, 2.3, KIT.maxZ - 0.75 - i * 0.4);
      add(pan);
    }

    // a wooden prep table: dough, a rolling pin, flour, the recipe book, and pastries cooling
    const prep = rbox(1.5, 0.06, 0.75, 0.02, M.woodLight);
    prep.position.set(-13.2, 0.88, -12.75);
    add(prep);
    for (const [dx, dz] of [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]]) {
      const leg = kbox(0.06, 0.86, 0.06, M.woodDark);
      leg.position.set(-13.2 + dx, 0.43, -12.75 + dz);
      add(leg);
    }
    const dough = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), std('#f3e2c4', { roughness: 0.95 }));
    dough.scale.y = 0.55; dough.position.set(-13.65, 0.94, -12.75);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 14), M.woodLight);
    pin.rotation.z = Math.PI / 2; pin.position.set(-13.55, 0.94, -12.5);
    const flour = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), std('#ffffff', { roughness: 1 }));
    flour.rotation.x = -Math.PI / 2; flour.position.set(-13.6, 0.912, -12.72);
    const book = kbox(0.32, 0.04, 0.24, std('#d4678a', { roughness: 0.8 }));
    book.position.set(-12.65, 0.93, -12.95); book.rotation.y = 0.3;
    const pages = kbox(0.3, 0.02, 0.22, std('#fffaf2'));
    pages.position.set(-12.65, 0.955, -12.95); pages.rotation.y = 0.3;
    add(dough, pin, flour, book, pages);
    const rack = kbox(0.6, 0.015, 0.4, M.brass);
    rack.position.set(-13.05, 0.95, -12.75);
    add(rack);
    [['slice', -13.22, -12.85], ['daifuku', -12.95, -12.62], ['shells', -12.95, -12.88], ['melonpan', -13.25, -12.6]].forEach(([shape, x, z]) => {
      const d = makeDessert(shape);
      d.scale.setScalar(0.9);
      d.position.set(x, 0.958, z);
      add(d);
    });
    main.colliders.push({ type: 'box', minX: -14.0, maxX: -12.4, minZ: -13.15, maxZ: -12.35, fixed: true });

    // today's bakes, chalked on the side wall
    const board = makeSign([
      { text: "Today's bakes", font: 'Dancing Script, cursive', size: 120, color: '#fdf6ee' },
      { text: 'sakura slice · maamoul mochi', size: 64, color: '#f6c6d2' },
      { text: 'melon pan · madeleines', size: 64, color: '#f6c6d2' },
      { text: '— Hana & Yuki', font: 'Dancing Script, cursive', size: 70, color: '#b9d7b9' },
    ], 0.9, 0.62, { bg: '#2f3a33', border: '#8a5a3a' });
    board.position.set(KIT.maxX - 0.03, 1.7, KIT.maxZ - 0.9);
    board.rotation.y = -Math.PI / 2;
    add(board);
    // a jar of sakura on the counter, and a little lamp light
    const jarS = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 16), M.glass);
    jarS.position.set(-10.6, 1.01, KIT.minZ + 0.3);
    add(jarS);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), std(COLORS.sakura, { roughness: 0.9 }));
      b.position.set(-10.6 + Math.sin(i * 2) * 0.07, 1.2 + (i % 3) * 0.06, KIT.minZ + 0.3 + Math.cos(i * 3) * 0.05);
      add(b);
    }
    for (const x of [-12.9, -9.6]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 6), M.woodDark);
      cord.position.set(x, KH - 0.3, -12.7);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 24, 1, true), std('#fffaf2', { emissive: '#ffd9a0', emissiveIntensity: 0.6, side: THREE.DoubleSide }));
      shade.position.set(x, KH - 0.66, -12.7);
      add(cord, shade);
    }
    const kLight = new THREE.PointLight('#ffd9a8', 7, 9, 1.6);
    kLight.position.set(-11, KH - 0.8, -12.7);
    late.add(fixed(kLight));
  }
  noFog(late);

  // ── where people can walk: the room, the doorway, and the kitchen
  const walk = [
    { minX: ROOM.minX + 0.35, maxX: ROOM.maxX - 0.35, minZ: ROOM.minZ + 0.35, maxZ: ROOM.maxZ - 0.35 },
    { minX: KX - 0.62, maxX: KX + 0.62, minZ: KIT.maxZ - 0.35, maxZ: ROOM.minZ + 0.4 },
    { minX: KIT.minX + 0.3, maxX: KIT.maxX - 0.3, minZ: KIT.minZ + 0.3, maxZ: KIT.maxZ - 0.3 },
  ];
  for (const c of main.colliders) if (c.type === 'room') c.walk = walk;

  // The kitchen doors swing open when anyone walks up to them, and close behind.
  function updateDoors(dt, points) {
    let near = false;
    for (const p of points) if (Math.hypot(p.x - kitchenDoor.x, p.z - kitchenDoor.z) < 1.9) { near = true; break; }
    kitchenDoor.open += ((near ? 1 : 0) - kitchenDoor.open) * Math.min(1, dt * (near ? 5 : 2.5));
    for (const { hinge, s } of kitchenDoor.leaves) hinge.rotation.y = -s * kitchenDoor.open * 1.35;
  }

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
    details.setRainy(wx.rain > 0);
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
    // Morning sun comes low and golden through the front windows (from the
    // street side, +z), climbs high at midday, and goes down through the
    // left windows (−x) in the late afternoon — long patches of light on the floor.
    const tt = Math.min(1, Math.max(0, (hour - 6) / 12.5));
    const elev = (6 + Math.sin(tt * Math.PI) * 58) * Math.PI / 180;
    const az = 0.42 - tt * 1.95; // angle round from the front (+z) towards the left (−x)
    sun.position.set(Math.sin(az) * Math.cos(elev) * 40, Math.sin(elev) * 40, Math.cos(az) * Math.cos(elev) * 40);
    sun.target.position.set(0, 0, 0);
    // clouds, rain and dust soften the daylight; the sun itself can vanish
    const daylight = day * (0.45 + 0.55 * wx.sun);
    sun.intensity = 3.2 * day * wx.sun;
    // the lower the sun, the warmer the light: golden mornings, amber evenings
    const low = Math.max(0, 1 - (elev * 180 / Math.PI - 6) / 30);
    sun.color.set(wx.fogColor && wx.fog > 0.6 ? wx.fogColor : '#fff1dc').lerp(new THREE.Color(dusk > 0.3 ? '#ff9a5a' : '#ffbe78'), Math.min(1, low * 1.1 + dusk * 0.4));
    lightWindows(sun.position.clone().normalize(), day * Math.max(0, wx.sun - 0.15) / 0.85, sun.color);
    hemi.intensity = 0.1 + daylight * 0.5;
    hemi.color.set(night > 0.5 ? '#9fa9d6' : wx.sun < 0.4 ? '#dfe4ea' : '#fff3e0');
    fill.intensity = 0.06 + daylight * 0.12;
    scene.environmentIntensity = 0.14 + daylight * 0.42;
    baseHemi = hemi.intensity;

    // lamps glow more after dark — at night the room is lit by them alone
    const open = isOpenAt(hour);
    doorSigns.forEach(d => { d.sign.visible = d.state === (open ? 'open' : 'closed'); });
    // after closing the café keeps a few lamps low — still warm, never dark
    const lampK = (0.55 + night * 0.85) * (open ? 1 : 0.72);
    [...lamps, ...upLamps, ...gardenLamps].forEach(l => { l.light.intensity = 3.5 * lampK; l.shade.material.emissiveIntensity = 0.2 + night * 0.5; });
    bulbs.forEach(b => b.material.color.set(night > 0.5 ? '#ffd49a' : '#ffe9c9'));

    // after dark, cloud and rain make the night darker and the lamps matter more
    const lampK2 = lampK * (1 + (1 - wx.sun) * 0.2 * day);
    [...lamps, ...upLamps].forEach(l => { l.light.intensity = 3.5 * lampK2; });
    // the roof garden is open air: its lamps only really matter after dark
    gardenLamps.forEach(l => { l.light.intensity = 3.5 * lampK2 * (0.15 + night * 0.85); });
    if (home) { home.ceilingLight.intensity = 2.2 + night * 2.6; home.sideLights.forEach(l => { l.intensity = 1.6 + night * 1.8; }); }
    if (hall) hall.lights.forEach(l => { l.intensity = 2.4 + night * 2.2; });
    outside.setSky(hour, day, dusk, night);
    return { day, night, open };
  }
  let baseHemi = 0.9;

  function update(dt, t) {
    animated.forEach(f => f(dt, t));
    npcs.forEach(n => { if (!n.controlled) n.av.update(dt, {}); });
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

  // The cover in the frame: an uploaded picture (same site, so WebGL can use
  // it), or a drawn cover with the title until there is one.
  let coverKey = '';
  function setBookOfWeek(b = {}) {
    const key = JSON.stringify([b.title, b.author, b.cover]);
    if (key === coverKey || !bookCover.mesh) return;
    coverKey = key;
    const m = bookCover.mesh.material;
    const drawn = () => {
      const c = document.createElement('canvas');
      c.width = 560; c.height = 840;
      const x = c.getContext('2d');
      const grad = x.createLinearGradient(0, 0, 0, 840);
      grad.addColorStop(0, '#2f3a33'); grad.addColorStop(1, '#1d2420');
      x.fillStyle = grad; x.fillRect(0, 0, 560, 840);
      x.strokeStyle = '#c9a25b'; x.lineWidth = 6; x.strokeRect(30, 30, 500, 780);
      x.fillStyle = '#fdf6ee'; x.textAlign = 'center';
      const words = String(b.title || 'Book of the week').split(' ');
      const lines = []; let line = '';
      x.font = '700 64px Georgia, serif';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > 440) { lines.push(line); line = w; } else line = t; }
      lines.push(line);
      lines.forEach((l, i) => x.fillText(l, 280, 330 + i * 76 - (lines.length - 1) * 38));
      x.font = 'italic 36px Georgia, serif'; x.fillStyle = '#f2a7bb';
      x.fillText(b.author || '', 280, 620);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    const set = tex => { if (m.map) m.map.dispose(); m.map = tex; m.needsUpdate = true; };
    set(drawn());
    const src = b.cover == null || b.cover === '' ? null : /^\d+$/.test(String(b.cover)) ? `/api/media/${b.cover}` : String(b.cover);
    if (src) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(src, tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; set(tex); }, undefined, () => {});
    }
  }

  // ── chalk: the menu board and the week's specials, drawn like a barista would
  function chalkCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#26302b'; x.fillRect(0, 0, w, h);
    // old chalk, rubbed out: soft smudges
    const r = rand(5);
    for (let i = 0; i < 60; i++) {
      const px = r() * w, py = r() * h, rad = 30 + r() * 140;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.035)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    return { c, x };
  }
  const chalk = (x, text, px, py, { size = 40, font = 'Nunito, sans-serif', weight = '600', color = '#f4efe6', align = 'left', max = 9999 } = {}) => {
    let s = size;
    x.font = `${weight} ${s}px ${font}`;
    while (x.measureText(text).width > max && s > 12) { s -= 2; x.font = `${weight} ${s}px ${font}`; }
    x.textAlign = align; x.textBaseline = 'alphabetic';
    x.fillStyle = color; x.globalAlpha = 0.92;
    x.fillText(text, px, py);
    x.globalAlpha = 0.18; x.fillText(text, px + 1.5, py + 1); // the grain of chalk
    x.globalAlpha = 1;
    return s;
  };
  function doodle(x, cx, cy, k = 1) {
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      x.fillStyle = 'rgba(247,201,213,0.85)';
      x.beginPath(); x.ellipse(cx + Math.cos(a) * 9 * k, cy + Math.sin(a) * 9 * k, 7 * k, 5 * k, a, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#f0c35a'; x.beginPath(); x.arc(cx, cy, 3.5 * k, 0, Math.PI * 2); x.fill();
  }
  // board: { title, columns: [{ head, items: [name] }], note }
  function setMenuBoard(board) {
    if (!menuBoard.slate) return;
    const W = 2048, H = 668;
    const { c, x } = chalkCanvas(W, H);
    chalk(x, board.title || 'Menu', W / 2, 96, { size: 92, font: 'Dancing Script, cursive', weight: '700', color: '#f7c9d5', align: 'center' });
    doodle(x, W / 2 - 230, 66); doodle(x, W / 2 + 230, 66, 0.8);
    const cols = board.columns || [];
    const cw = (W - 160) / Math.max(1, cols.length);
    cols.forEach((col, i) => {
      const x0 = 80 + i * cw, x1 = x0 + cw - 50;
      chalk(x, col.head, x0, 178, { size: 46, weight: '800', color: '#bfe3b0' });
      x.strokeStyle = 'rgba(191,227,176,0.6)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(x0, 192); x.lineTo(x0 + 180, 194); x.stroke();
      col.items.slice(0, 6).forEach((name, k) => {
        const y = 250 + k * 62;
        chalk(x, name, x0, y, { size: 36, max: cw - 190 });
        chalk(x, 'free', x1, y, { size: 32, font: 'Dancing Script, cursive', weight: '700', color: '#f7c9d5', align: 'right' });
        // a row of chalk dots between the name and the price
        x.font = '600 36px Nunito, sans-serif';
        const nameEnd = x0 + Math.min(x.measureText(name).width, cw - 190) + 14;
        x.fillStyle = 'rgba(244,239,230,0.35)';
        for (let d = nameEnd; d < x1 - 70; d += 14) x.fillRect(d, y - 6, 3, 3);
      });
    });
    chalk(x, board.note || 'Everything here is free — pay it forward with a kind note 🌸', W / 2, H - 34, { size: 34, font: 'Dancing Script, cursive', color: '#f4efe6', align: 'center', max: W - 200 });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const m = menuBoard.slate.material;
    if (m.map) m.map.dispose();
    m.map = t; m.needsUpdate = true;
  }

  // the week's specials, on an A-frame chalkboard by the counter
  const specials = { face: null };
  {
    const g = new THREE.Group();
    for (const s of [1, -1]) {
      const leg = new THREE.Group();
      const board = rbox(0.66, 1.0, 0.03, 0.012, M.woodDark);
      board.position.y = 0.5;
      leg.add(board);
      if (s > 0) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.88), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }));
        face.position.set(0, 0.52, 0.017);
        leg.add(face);
        specials.face = face;
      }
      leg.rotation.x = -0.17 * s; // the two boards lean together at the top, like an A
      leg.position.z = 0.22 * s;
      if (s < 0) leg.rotation.y = Math.PI;
      g.add(leg);
    }
    g.position.set(cbMinX() - 1.1, 0, ROOM.minZ + 5.6);
    g.rotation.y = 0.35;
    root.add(g);
    colliders.push({ type: 'circle', x: g.position.x, z: g.position.z, r: 0.45, fixed: true });
    const hover = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.35), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.y = 0.5;
    hover.userData = { kind: 'specials', label: "This week's specials" };
    g.add(hover);
    interactables.push(hover);
  }
  function cbMinX() { const b = new THREE.Box3().setFromObject(counter); return b.min.x; }
  // specials: { title, items: [{ name, note }] }
  function setSpecials(sp) {
    if (!specials.face) return;
    const W = 560, H = 880;
    const { c, x } = chalkCanvas(W, H);
    chalk(x, sp.title || 'This week', W / 2, 92, { size: 72, font: 'Dancing Script, cursive', weight: '700', color: '#f7c9d5', align: 'center', max: W - 60 });
    doodle(x, 70, 70, 0.9); doodle(x, W - 70, 70, 0.9);
    (sp.items || []).slice(0, 3).forEach((it, k) => {
      const y = 200 + k * 210;
      chalk(x, it.name, W / 2, y, { size: 42, weight: '800', align: 'center', max: W - 50, color: k % 2 ? '#bfe3b0' : '#f4efe6' });
      // the note, wrapped over two lines
      const words = String(it.note || '').split(' ');
      const lines = ['']; x.font = '600 28px Nunito, sans-serif';
      for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (x.measureText(t).width > W - 70 && lines.length < 3) lines.push(w); else lines[lines.length - 1] = t; }
      lines.slice(0, 3).forEach((l, i) => chalk(x, l, W / 2, y + 46 + i * 34, { size: 28, align: 'center', color: 'rgba(244,239,230,0.85)', max: W - 50 }));
    });
    chalk(x, 'free, like everything 🌸', W / 2, H - 40, { size: 32, font: 'Dancing Script, cursive', align: 'center', color: '#f7c9d5' });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const m = specials.face.material;
    if (m.map) m.map.dispose();
    m.map = t; m.needsUpdate = true;
  }

  // ── the small things a real café has
  const details = { umbrellas: [], setRainy: () => {} };
  {
    const fz = ROOM.maxZ;
    // a coat rail by the door, with a couple of coats, a scarf and a tote bag
    const rail = rbox(1.6, 0.1, 0.04, 0.01, M.woodDark);
    rail.position.set(4.2, 1.85, fz - 0.05);
    root.add(rail);
    const coatColors = ['#5d6b7a', '#b48a62', '#7d4f4f'];
    [3.6, 4.05, 4.5, 4.95].forEach((hx, i) => {
      const hook = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.06, 4, 8), M.brass);
      hook.rotation.x = Math.PI / 2;
      hook.position.set(hx, 1.83, fz - 0.1);
      root.add(hook);
      if (i === 0 || i === 2) {
        const coat = new THREE.Group();
        const body = rbox(0.36, 0.78, 0.07, 0.03, std(coatColors[i / 2], { roughness: 0.9 }));
        body.position.y = -0.42;
        const collar = rbox(0.22, 0.08, 0.09, 0.03, std(coatColors[i / 2], { roughness: 0.9 }));
        collar.position.y = -0.04;
        const sleeve = rbox(0.09, 0.55, 0.07, 0.03, std(coatColors[i / 2], { roughness: 0.9 }));
        sleeve.position.set(0.15, -0.38, 0.03); sleeve.rotation.z = 0.08;
        coat.add(body, collar, sleeve);
        coat.position.set(hx, 1.83, fz - 0.14);
        coat.rotation.y = Math.PI;
        root.add(coat);
      } else if (i === 1) {
        const scarf = rbox(0.1, 0.7, 0.025, 0.01, std('#d4678a', { roughness: 1 }));
        scarf.position.set(hx, 1.48, fz - 0.12);
        root.add(scarf);
      } else {
        const bag = rbox(0.3, 0.32, 0.05, 0.02, std('#e8dcc4', { roughness: 1 }));
        bag.position.set(hx, 1.45, fz - 0.12);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI), std('#e8dcc4', { roughness: 1 }));
        handle.position.set(hx, 1.6, fz - 0.12);
        const logo = makeSign([{ text: 'BookBeans', font: 'Dancing Script, cursive', size: 120, color: COLORS.woodDark, weight: '700' }], 0.22, 0.08, { bg: null });
        logo.position.set(hx, 1.45, fz - 0.15);
        logo.rotation.y = Math.PI;
        root.add(bag, handle, logo);
      }
    });
    // an umbrella stand: more umbrellas in it on rainy days
    const stand = new THREE.Group();
    const pot = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.48, 24, 1, true), std('#4f6b5a', { roughness: 0.5, side: THREE.DoubleSide })));
    pot.position.y = 0.24;
    const potBase = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), std('#3c5245'));
    potBase.rotation.x = -Math.PI / 2; potBase.position.y = 0.02;
    stand.add(pot, potBase);
    const umbColors = ['#2f3a4a', '#d4678a', '#c9a24a', '#5f7a64'];
    umbColors.forEach((c, i) => {
      const u = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.85, 8), M.woodDark);
      shaft.position.y = 0.45;
      const canopy = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55, 8), std(c, { roughness: 0.6 })));
      canopy.position.y = 0.42; canopy.rotation.x = Math.PI;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 14, Math.PI), M.woodDark);
      handle.position.set(0.035, 0.88, 0);
      u.add(shaft, canopy, handle);
      u.position.set(Math.cos(i * 1.6) * 0.05, 0, Math.sin(i * 1.6) * 0.05);
      u.rotation.set(Math.sin(i * 2) * 0.12, i, Math.cos(i * 2) * 0.12);
      u.visible = i === 0;
      stand.add(u);
      details.umbrellas.push(u);
    });
    stand.position.set(1.75, 0, fz - 0.45);
    root.add(stand);
    colliders.push({ type: 'circle', x: stand.position.x, z: stand.position.z, r: 0.22, fixed: true });
    details.setRainy = on => details.umbrellas.forEach((u, i) => { u.visible = i === 0 || on; });
    // "please seat yourself" — a little stand inside the door
    const sy = new THREE.Group();
    const foot = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 24), M.brass));
    const pole = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 10), M.brass));
    pole.position.y = 0.5;
    sy.add(foot, pole);
    for (const ry of [0, Math.PI]) {
      const sg = makeSign([{ text: 'Please seat yourself', size: 92, weight: '700' }, { text: "anywhere you like — we'll come to you 🌸", font: 'Dancing Script, cursive', size: 70, color: COLORS.sakuraDark }], 0.46, 0.22, { bg: COLORS.cream });
      sg.position.set(0, 1.08, ry ? -0.006 : 0.006);
      sg.rotation.y = ry;
      sy.add(sg);
    }
    sy.position.set(-1.8, 0, fz - 0.95);
    sy.rotation.y = 0.25;
    root.add(sy);
    colliders.push({ type: 'circle', x: sy.position.x, z: sy.position.z, r: 0.25, fixed: true });
    // on the counter: a tip jar and a card reader (nothing to pay — it says so)
    const cb = new THREE.Box3().setFromObject(counter);
    const ctop = 1.085, cz = cb.max.z - 0.3;
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.17, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: '#eef6fb', roughness: 0.05, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    jar.position.set(cb.min.x + 0.7, ctop + 0.085, cz);
    const coins = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 12), M.brass);
      coin.position.set((Math.random() - 0.5) * 0.08, 0.006 + i * 0.004, (Math.random() - 0.5) * 0.08);
      coin.rotation.set(Math.random() * 0.6, 0, Math.random() * 0.6);
      coins.add(coin);
    }
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.002), std('#a8c79a'));
    note.position.set(0.01, 0.07, 0.01); note.rotation.set(0.2, 0.4, 0.3);
    coins.add(note);
    coins.position.set(jar.position.x, ctop, cz);
    const jarLabel = makeSign([{ text: 'kindness', font: 'Dancing Script, cursive', size: 110, color: COLORS.sakuraDark, weight: '700' }, { text: 'pay it forward', size: 60, color: COLORS.woodDark }], 0.13, 0.07, { bg: COLORS.cream, radius: 30 });
    jarLabel.position.set(jar.position.x, ctop + 0.08, cz + 0.072);
    root.add(jar, coins, jarLabel);
    const reader = new THREE.Group();
    const rb = rbox(0.09, 0.025, 0.16, 0.01, std('#2b2d31', { roughness: 0.4 }));
    rb.position.y = 0.012;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.05), new THREE.MeshStandardMaterial({ color: '#cfe9d8', emissive: '#9fd6b0', emissiveIntensity: 0.4 }));
    screen.rotation.x = -Math.PI / 2; screen.position.set(0, 0.026, -0.035);
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), std('#4a4d55'));
    keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.026, 0.035);
    reader.add(rb, screen, keys);
    reader.position.set(cb.min.x + 1.1, ctop, cz);
    reader.rotation.y = 0.3;
    root.add(reader);
    const rh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.25), new THREE.MeshBasicMaterial({ visible: false }));
    rh.position.set(cb.min.x + 0.9, ctop + 0.1, cz);
    rh.userData = { kind: 'info', label: 'The tip jar and the card reader', text: "Nothing here costs anything, so the card reader just says \"free 🌸\". The jar is for kindness: leave a note for a stranger on the board, and that's the tip." };
    interactables.push(rh);
    root.add(rh);
  }

  // ── the seasons, Ramadan and Eid: decorations that come and go with the calendar
  const decor = {};
  {
    const mk = () => { const g = new THREE.Group(); g.visible = false; root.add(g); return g; };
    for (const k of ['spring', 'summer', 'autumn', 'winter', 'ramadan', 'eid']) decor[k] = mk();
    // bunting (or a garland of leaves) strung across the room under the beams
    function garland(into, x0, z0, x1, z1, y, colors, shape = 'flag', sag = 0.35) {
      const pts = [];
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.32));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(Math.PI * t) * sag, z0 + (z1 - z0) * t));
      }
      const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.006, 4), std('#efe4d2'));
      into.add(cord);
      const geo = shape === 'flag'
        ? new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.09, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0, -0.2)]))
        : new THREE.CircleGeometry(0.07, 7);
      const mats = colors.map(c => std(c, { roughness: 0.9, side: THREE.DoubleSide }));
      const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      pts.forEach((p, i) => {
        if (i === 0 || i === pts.length - 1) return;
        const f = new THREE.Mesh(geo, mats[i % mats.length]);
        f.position.copy(p);
        f.rotation.y = ry;
        if (shape !== 'flag') { f.scale.set(0.8, 1.35, 1); f.position.y -= 0.08; f.rotation.z = (i % 3 - 1) * 0.5; }
        into.add(f);
      });
    }
    const lines = [[-14.5, -3, 14.5, -3], [-14.5, 4, 14.5, 4], [-14.2, 9.6, 14.2, 9.6]];
    for (const [a, b, c, d] of lines) {
      garland(decor.spring, a, b, c, d, 3.75, ['#f2a7bb', '#fef9f5', '#d4678a', '#c9dcc0']);
      garland(decor.summer, a, b, c, d, 3.75, ['#f3df7a', '#bfe3b0', '#fef9f5', '#9fd0d6']);
      garland(decor.autumn, a, b, c, d, 3.75, ['#c8703a', '#a8452e', '#e0a23f', '#8a5a2e'], 'leaf');
      garland(decor.winter, a, b, c, d, 3.75, ['#3f6b4f', '#2f5d3a', '#4f7d5a'], 'leaf', 0.25);
    }
    // summer: a bowl of lemons on the counter
    {
      const cb = new THREE.Box3().setFromObject(counter);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#fffaf4', { roughness: 0.3, side: THREE.DoubleSide }));
      bowl.position.set(cb.max.x - 0.8, 1.215, cb.max.z - 0.35);
      decor.summer.add(bowl);
      for (let i = 0; i < 5; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), std('#f0d24a', { roughness: 0.5 }));
        l.scale.set(1, 0.85, 1.25);
        l.position.set(bowl.position.x + Math.cos(i * 1.3) * 0.06, 1.16 + (i > 3 ? 0.05 : 0), bowl.position.z + Math.sin(i * 1.3) * 0.06);
        decor.summer.add(l);
      }
    }
    // autumn: pumpkins — piles by the front door and the hearth, a few on the
    // mantel, the counter and the tables. Only floor spots off the walking paths,
    // since they come and go with the season and have no colliders.
    {
      const PUMPKINS = { orange: '#e07b2a', deep: '#c8641c', cream: '#efe2c4', sage: '#9fb08a' };
      const stemM = std('#6b5233', { roughness: 0.9 });
      const leafM = std('#6f8f4f', { roughness: 0.8, side: THREE.DoubleSide });
      const bodyM = {};
      const pumpkin = (x, y, z, r, colour = 'orange', ry = 0) => {
        const m = bodyM[colour] || (bodyM[colour] = std(PUMPKINS[colour], { roughness: 0.55 }));
        const g = new THREE.Group();
        const core = shadowy(new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 20, 14), m));
        core.scale.set(1.15, 0.78, 1.15);
        core.position.y = r * 0.62;
        g.add(core);
        for (let i = 0; i < 8; i++) {   // the ribs
          const a = (i / 8) * Math.PI * 2;
          const rib = shadowy(new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 14, 10), m));
          rib.scale.set(0.75, 1.15, 0.75);
          rib.position.set(Math.cos(a) * r * 0.5, r * 0.6, Math.sin(a) * r * 0.5);
          g.add(rib);
        }
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.07, r * 0.11, r * 0.42, 8), stemM);
        stem.position.y = r * 1.3; stem.rotation.z = 0.25;
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(r * 0.22, 7), leafM);
        leaf.scale.set(1.5, 0.8, 1);
        leaf.position.set(r * 0.22, r * 1.2, 0.02); leaf.rotation.set(-1.2, 0, -0.3);
        g.add(stem, leaf);
        g.position.set(x, y, z);
        g.rotation.y = ry;
        decor.autumn.add(g);
        return g;
      };
      // either side of the front door, against the wall — past the umbrella
      // stand (x 1.75) and the "please seat yourself" sign (x -1.8)
      const dz = ROOM.maxZ - 0.4;
      pumpkin(-2.65, 0, dz, 0.3, 'orange', 0.4); pumpkin(-3.0, 0, dz - 0.05, 0.18, 'cream', 1); pumpkin(-2.4, 0, dz - 0.36, 0.14, 'deep');
      pumpkin(2.6, 0, dz, 0.32, 'deep', 0.9); pumpkin(2.6, 0.44, dz, 0.14, 'orange'); pumpkin(2.95, 0, dz - 0.12, 0.17, 'sage', 2);
      pumpkin(2.38, 0, dz - 0.32, 0.12, 'cream');
      // the hearth: a pile at each end, and two small ones on the mantel
      pumpkin(fire.x - 0.45, 0, fire.z - 1.3, 0.24, 'orange', 0.3); pumpkin(fire.x - 0.2, 0, fire.z - 1.6, 0.15, 'cream');
      pumpkin(fire.x - 0.45, 0, fire.z + 1.35, 0.2, 'deep', 1.2);
      pumpkin(fire.x - 0.15, 1.38, fire.z + 0.1, 0.12, 'orange');
      pumpkin(fire.x - 0.15, 1.38, fire.z + 0.85, 0.09, 'cream', 1);
      // the counter, by the lemons' spot
      const cb = new THREE.Box3().setFromObject(counter);
      pumpkin(cb.max.x - 1.2, 1.16, cb.max.z - 0.3, 0.1, 'orange');
      pumpkin(cb.max.x - 1.42, 1.16, cb.max.z - 0.36, 0.075, 'cream', 1);
      // one little pumpkin on every other café table
      surfaces.filter(m => m.userData.surface === 'table' && m.userData.tableName && m.userData.top < 0.9).forEach((t, i) => {
        if (i % 2) return;
        const p = new THREE.Vector3(); t.getWorldPosition(p);
        pumpkin(p.x - 0.24, t.userData.top, p.z + 0.14, 0.075, ['orange', 'cream', 'deep', 'sage'][(i / 2) % 4], i);
      });
    }
    // winter: a candle in a little glass on every table, and blankets on the armchairs
    const flameM = new THREE.MeshBasicMaterial({ color: '#ffcf7a' });
    for (const t of surfaces.filter(m => m.userData.surface === 'table' && m.userData.tableName && m.userData.top < 0.9)) {
      const p = new THREE.Vector3(); t.getWorldPosition(p);
      const c = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.07, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#ffe6c4', transparent: true, opacity: 0.35, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
      glass.position.y = 0.035;
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 16), std('#fff6e8'));
      wax.position.y = 0.02;
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), flameM);
      flame.scale.y = 2;
      flame.position.y = 0.056;
      flame.onBeforeRender = () => { const k = 1 + Math.sin(performance.now() / 90 + p.x) * 0.15; flame.scale.set(k, 2 * k, k); };
      c.add(glass, wax, flame);
      c.position.set(p.x - 0.2, t.userData.top, p.z - 0.2);
      decor.winter.add(c);
    }
    for (const id of ['arm1', 'arm2']) {
      const seat = seats.find(x => x.id === id);
      if (!seat) continue;
      const blanket = new THREE.Group();
      const fold = rbox(0.62, 0.05, 0.42, 0.02, std(id === 'arm1' ? '#c7605a' : '#d9c3a3', { roughness: 1 }));
      fold.position.set(0, 0.68, -0.05);
      const drape = rbox(0.62, 0.42, 0.05, 0.02, std(id === 'arm1' ? '#c7605a' : '#d9c3a3', { roughness: 1 }));
      drape.position.set(0, 0.95, -0.35); drape.rotation.x = 0.15;
      blanket.add(fold, drape);
      blanket.position.set(seat.x, 0, seat.z);
      blanket.rotation.y = seat.ry;
      decor.winter.add(blanket);
    }
    // Ramadan: fanous lanterns hanging through the room, a string of crescents and stars, the greeting
    const lanternColors = ['#c0392b', '#2e7d4f', '#2f5fa8', '#e0a23f', '#8e44ad'];
    const lanternSpots = [[-11, -6], [-6, 1], [-1, -4], [3, 2], [8, 6], [-8, 7], [12, -1], [1, 8.5]];
    lanternSpots.forEach(([lx, lz], i) => {
      const L = new THREE.Group();
      const brass = M.brass;
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 6), brass); top.position.y = 0.2;
      const glassM = new THREE.MeshStandardMaterial({ color: lanternColors[i % 5], emissive: lanternColors[i % 5], emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.3 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.24, 6), glassM);
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 6), brass); bottom.position.y = -0.17; bottom.rotation.x = Math.PI;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12), brass); ring.position.y = 0.3;
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe2a0' }));
      const len = 0.5 + (i % 3) * 0.25;
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 5), M.woodDark); cord.position.y = 0.3 + len / 2;
      L.add(top, body, bottom, ring, glow, cord);
      L.position.set(lx, ROOM.h - 0.3 - len, lz);
      decor.ramadan.add(L);
    });
    {
      const crescentM = new THREE.MeshBasicMaterial({ color: '#ffd98a' });
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = -14 + t * 28, y = 3.3 - Math.sin(Math.PI * ((t * 4) % 1)) * 0.18;
        const shape = i % 2
          ? (() => { const sh = new THREE.Shape(); sh.absarc(0, 0, 0.06, 0.6, Math.PI * 2 - 0.6, false); sh.absarc(0.03, 0, 0.05, Math.PI * 2 - 0.9, 0.9, true); return sh; })()
          : (() => { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 0.022 : 0.05; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return sh; })();
        const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), crescentM);
        m.position.set(x, y, ROOM.maxZ - 0.15);
        m.rotation.y = Math.PI;
        decor.ramadan.add(m);
      }
    }
    for (const [k, lines] of [['ramadan', [{ text: 'رمضان كريم', size: 120, weight: '700', color: '#7a4e1e' }, { text: 'Ramadan Kareem 🌙', font: 'Dancing Script, cursive', size: 92, color: COLORS.sakuraDark }]],
      ['eid', [{ text: 'عيد مبارك', size: 120, weight: '700', color: '#7a4e1e' }, { text: 'Eid Mubarak ✨', font: 'Dancing Script, cursive', size: 92, color: COLORS.sakuraDark }]]]) {
      for (const ry of [0, Math.PI]) {
        const b = makeSign(lines, 2.4, 0.62, { bg: '#fbf0dc' });
        b.position.set(0, 3.35, 2.0 + (ry ? -0.006 : 0.006));
        b.rotation.y = ry;
        decor[k].add(b);
      }
    }
    noFog(root);
  }
  // { season: 'spring'|'summer'|'autumn'|'winter', ramadan: bool, eid: bool }
  function setSeason({ season, ramadan = false, eid = false } = {}) {
    for (const k of ['spring', 'summer', 'autumn', 'winter']) decor[k].visible = k === season && !ramadan;
    decor.ramadan.visible = !!ramadan;
    decor.eid.visible = !!eid && !ramadan;
  }

  // ── "What's on": story readings and book-club nights, on an easel by the fire
  const easel = { face: null };
  {
    const g = new THREE.Group();
    const legM = M.woodDark;
    for (const [lx, lz, rx, rz] of [[-0.32, 0.12, 0.12, -0.06], [0.32, 0.12, 0.12, 0.06], [0, -0.38, -0.35, 0]]) {
      const leg = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.75, 8), legM));
      leg.position.set(lx, 0.85, lz);
      leg.rotation.set(rx, 0, rz);
      g.add(leg);
    }
    const ledge = rbox(0.8, 0.04, 0.08, 0.01, legM);
    ledge.position.set(0, 0.62, 0.2);
    const board = rbox(0.78, 0.95, 0.03, 0.01, legM);
    board.position.set(0, 1.12, 0.17);
    board.rotation.x = -0.12;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.86), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }));
    face.position.set(0, 1.12, 0.19);
    face.rotation.x = -0.12;
    g.add(ledge, board, face);
    easel.face = face;
    g.position.set(ROOM.maxX - 1.1, 0, 4.9); // between the fire and the bookshelf, clear of both
    g.rotation.y = -Math.PI / 2 - 0.45;
    root.add(g);
    colliders.push({ type: 'circle', x: g.position.x, z: g.position.z, r: 0.5, fixed: true });
    const hover = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.1, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(0, 1.1, 0.15);
    hover.userData = { kind: 'events', label: "What's on — story evenings and book club" };
    g.add(hover);
    interactables.push(hover);
  }
  // events: [{ when: 'Fri 8pm', title, now: bool }]
  function setEvents(list = []) {
    if (!easel.face) return;
    const W = 700, H = 860;
    const { c, x } = chalkCanvas(W, H);
    chalk(x, "What's on", W / 2, 96, { size: 84, font: 'Dancing Script, cursive', weight: '700', color: '#f7c9d5', align: 'center' });
    doodle(x, 90, 70); doodle(x, W - 90, 70, 0.8);
    if (!list.length) chalk(x, 'Story evenings — coming soon', W / 2, 300, { size: 40, align: 'center', max: W - 60 });
    list.slice(0, 4).forEach((e, k) => {
      const y = 200 + k * 160;
      chalk(x, e.now ? '✨ happening now' : e.when, W / 2, y, { size: 36, weight: '800', align: 'center', color: e.now ? '#f0c35a' : '#bfe3b0', max: W - 60 });
      chalk(x, e.title, W / 2, y + 56, { size: 44, align: 'center', max: W - 50 });
      if (e.where) chalk(x, e.where, W / 2, y + 100, { size: 28, align: 'center', color: 'rgba(244,239,230,0.75)', max: W - 60 });
    });
    chalk(x, 'everyone welcome 🌸', W / 2, H - 36, { size: 36, font: 'Dancing Script, cursive', align: 'center', color: '#f7c9d5' });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const m = easel.face.material;
    if (m.map) m.map.dispose();
    m.map = t; m.needsUpdate = true;
  }

  // Photos in the frames: { p1: { cover, caption }, … } (cover: media id or link).
  const photoKeys = {};
  function setPhotos(photos = {}) {
    for (const [id, pic] of Object.entries(photoMeshes)) {
      const p = photos[id] || {};
      const src = p.cover == null || p.cover === '' ? null : /^\d+$/.test(String(p.cover)) ? `/api/media/${p.cover}` : String(p.cover);
      if (photoKeys[id] === src) continue;
      photoKeys[id] = src;
      const n = Object.keys(photoMeshes).indexOf(id);
      const f = PHOTO_FRAMES[n];
      const set = tex => { if (pic.material.map) pic.material.map.dispose(); pic.material.map = tex; pic.material.needsUpdate = true; };
      if (!src) { set(sakuraPrint(n, f.w / f.h)); continue; }
      new THREE.TextureLoader().setCrossOrigin('anonymous').load(src, tex => {
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        // cover the frame without stretching: crop the picture to the frame's shape
        const ia = tex.image.width / tex.image.height, fa = (f.w - 0.1) / (f.h - 0.1);
        if (ia > fa) { tex.repeat.set(fa / ia, 1); tex.offset.set((1 - fa / ia) / 2, 0); } else { tex.repeat.set(1, ia / fa); tex.offset.set(0, (1 - ia / fa) / 2); }
        if (photoKeys[id] === src) set(tex);
      }, undefined, () => {});
    }
  }

  home = buildHome({ floor: floors.home, makeSign });
  noFog(floors.home.group);
  hall = buildHall({ floor: floors.hall, makeSign });
  noFog(floors.hall.group);
  common = buildCommon({ floor: floors.common, makeSign });
  noFog(floors.common.group);
  doorHours.ready = true;
  const api = Object.assign(api_, {
    scene, npcs, update, setTimeOfDay, setWeather, setBoardSign, setUpstairsSign, setFloor, floors, setGarden, gardenSpots, home, hall, common,
    setClock: (hour, label, w) => outside.setClock(hour, label, w),
    setBookOfWeek, setPhotos, photoFrames: PHOTO_FRAMES, setMenuBoard, setSpecials, setSeason, setEvents, setHours,
    walk, kitchen: { ...KIT, door: { x: KX, z: ROOM.minZ - 0.1 } }, updateDoors, counter,
    fire: { x: fire.x - 0.4, y: 0.5, z: fire.z }, board, tree,
  });
  // Show one floor and point colliders/seats/surfaces/interactables at it.
  function setFloor(name) {
    for (const [k, f] of Object.entries(floors)) f.group.visible = k === name;
    const f = floors[name];
    Object.assign(api, {
      floor: name,
      floorY: name === 'up' || name === 'home' || name === 'hall' || name === 'common' ? FLOOR2_Y : name === 'garden' ? FLOOR3_Y : 0,
      floorH: name === 'up' ? FLOOR2_H : name === 'home' ? HOME_SIZE.h : name === 'hall' ? HALL.h : name === 'common' ? COMMON.h : name === 'garden' ? 7 : ROOM.h,
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
  // (nothing grows or stands where the kitchen juts out behind the back door)
  const inKitchen = (x, z) => x > -15.6 && x < -6.2 && z > -15 && z < -10.5;
  for (let x = -16; x <= 16; x += 8) { streetLamp(x, lz, 0, 1); if (!inKitchen(x, -lz)) streetLamp(x + 0.01, -lz, 0, -1); }
  for (const z of [-8, 0, 8]) { streetLamp(lx, z, 1, 0); streetLamp(-lx, z, -1, 0); }
  for (let x = -12; x <= 12; x += 8) { palm(x, lz - 0.2, 7 + r() * 2); if (!inKitchen(x, -lz + 0.2)) palm(x, -lz + 0.2, 7 + r() * 2); }
  for (const z of [-12, -4, 4, 12]) { palm(lx - 0.2, z, 7 + r() * 2); palm(-lx + 0.2, z, 7 + r() * 2); }


  // ── Cairo's time and weather, out on the pavement: a street clock you can
  // see through the front window, and a chalkboard by each door.
  const brassM = new THREE.MeshStandardMaterial({ color: '#b8925a', roughness: 0.35, metalness: 0.6 });
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 256;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 4;
  const faceM = new THREE.MeshStandardMaterial({ map: faceTex, emissive: '#fff1d6', emissiveMap: faceTex, emissiveIntensity: 0.15, roughness: 0.5 });
  nightMats.push({ mat: faceM, max: 0.9 });
  function drawFace(hour) {
    const c = faceCanvas.getContext('2d'), S = 256, R = 120;
    c.clearRect(0, 0, S, S);
    c.fillStyle = '#fbf3e6';
    c.beginPath(); c.arc(S / 2, S / 2, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#d4678a'; c.lineWidth = 5;
    c.beginPath(); c.arc(S / 2, S / 2, R - 8, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#4a3a3a';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
      const r0 = R - (big ? 26 : 18), r1 = R - 14;
      c.lineWidth = big ? 5 : 2;
      c.strokeStyle = big ? '#4a3a3a' : '#a08a7a';
      c.beginPath();
      c.moveTo(S / 2 + Math.sin(a) * r0, S / 2 - Math.cos(a) * r0);
      c.lineTo(S / 2 + Math.sin(a) * r1, S / 2 - Math.cos(a) * r1);
      c.stroke();
    }
    c.font = 'italic 600 22px Georgia, serif';
    c.textAlign = 'center';
    c.fillStyle = '#7aab7a';
    c.fillText('Cairo', S / 2, S / 2 + 48);
    const h = ((hour % 12) + 12) % 12, m = (hour % 1) * 60;
    const hand = (ang, len, w, col) => {
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(S / 2, S / 2); c.lineTo(S / 2 + Math.sin(ang) * len, S / 2 - Math.cos(ang) * len); c.stroke();
    };
    hand((h / 12) * Math.PI * 2 + (m / 60) * (Math.PI / 6), 58, 9, '#3a2a2a');
    hand((m / 60) * Math.PI * 2, 86, 6, '#3a2a2a');
    c.fillStyle = '#d4678a';
    c.beginPath(); c.arc(S / 2, S / 2, 8, 0, Math.PI * 2); c.fill();
    faceTex.needsUpdate = true;
  }
  function streetClock(x, z) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 2.2, 16), poleM);
    post.position.y = 1.1;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 20), poleM);
    foot.position.y = 0.15;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.16, 40), poleM);
    drum.rotation.x = Math.PI / 2;
    drum.position.y = 2.6;
    g.add(post, foot, drum);
    for (const side of [1, -1]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), faceM);
      face.position.set(0, 2.6, 0.081 * side);
      if (side < 0) face.rotation.y = Math.PI;
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 10, 48), brassM);
      bezel.position.copy(face.position);
      g.add(face, bezel);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), brassM);
    cap.position.y = 3.1;
    g.add(cap);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z);
    scene.add(g);
  }

  const chalkCanvas = document.createElement('canvas');
  chalkCanvas.width = 360; chalkCanvas.height = 480;
  const chalkTex = new THREE.CanvasTexture(chalkCanvas);
  chalkTex.colorSpace = THREE.SRGBColorSpace;
  chalkTex.anisotropy = 4;
  const chalkM = new THREE.MeshStandardMaterial({ map: chalkTex, roughness: 0.95, emissive: '#ffffff', emissiveMap: chalkTex, emissiveIntensity: 0.05 });
  nightMats.push({ mat: chalkM, max: 0.35 });
  function drawChalk(label, w) {
    const c = chalkCanvas.getContext('2d'), W = 360, H = 480;
    c.fillStyle = '#2f3a33'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) c.fillRect((i * 97) % W, (i * 61) % H, 40, 2);
    c.textAlign = 'center';
    c.fillStyle = '#f6c6d2';
    c.font = 'italic 600 34px Georgia, serif';
    c.fillText('Cairo, right now', W / 2, 70);
    c.fillStyle = '#fdf6ee';
    c.font = '700 74px Georgia, serif';
    c.fillText(label || '', W / 2, 170);
    if (w) {
      c.font = '64px sans-serif';
      c.fillText(w.icon, W / 2, 268);
      c.font = '600 40px Georgia, serif';
      c.fillText(`${w.temp}° · ${w.label}`, W / 2, 330);
    }
    c.fillStyle = '#b9d7b9';
    c.font = 'italic 30px Georgia, serif';
    c.fillText('come in, stay a while', W / 2, 410);
    c.fillStyle = '#f2a7bb';
    c.fillText('✿', W / 2, 452);
    chalkTex.needsUpdate = true;
  }
  const woodM = new THREE.MeshStandardMaterial({ color: '#8a5a3a', roughness: 0.8 });
  function chalkBoard(x, z, ry) {
    const g = new THREE.Group();
    for (const side of [1, -1]) {
      const leaf = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.92, 0.04), woodM);
      frame.position.y = 0.5;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.75), chalkM);
      board.position.set(0, 0.52, 0.022);
      leaf.add(frame, board);
      // two boards leaning together, one facing each way
      leaf.position.z = 0.16 * side;
      leaf.rotation.set(-0.2, side < 0 ? Math.PI : 0, 0, 'YXZ');
      g.add(leaf);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }
  streetClock(mapX(-6), 12.4);                      // framed by the left front window
  chalkBoard(1.9, 11.75, 0);                         // by the front door
  let clockShown = '';
  function setClock(hour, label, w) {
    const key = `${label}|${w ? w.icon + w.temp + w.label : ''}`;
    if (key === clockShown) return;
    clockShown = key;
    drawFace(hour);
    drawChalk(label, w);
  }
  setClock(12, '', null);

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
  // Round the block: along the café's pavement at the front and sides, and
  // along the far pavement at the back (the kitchen takes up the near one).
  const walkX = STREET.pave.x - 1.6, walkZ = STREET.pave.z - 1.6;
  const backZ = -(STREET.road.z + (STREET.far.z - STREET.road.z) / 2);
  const route = [[-walkX, walkZ], [walkX, walkZ], [walkX, backZ], [-walkX, backZ]];
  const legs = route.map((p, i) => { const q = route[(i + 1) % route.length]; return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) }; });
  const walkLen = legs.reduce((a, l) => a + l.len, 0);
  function onWalk(s) {
    s = ((s % walkLen) + walkLen) % walkLen;
    for (const l of legs) {
      if (s <= l.len) {
        const k = s / l.len, dx = l.q[0] - l.p[0], dz = l.q[1] - l.p[1];
        return { x: l.p[0] + dx * k, z: l.p[1] + dz * k, ry: Math.atan2(dx, dz) };
      }
      s -= l.len;
    }
    return { x: route[0][0], z: route[0][1], ry: 0 };
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
    // the café has a roof — and so does the kitchen behind the back door
    while ((Math.abs(x) < 15.6 && Math.abs(z) < 11.6) || (x > -15.4 && x < -6.4 && z > -15 && z < -10.6)
      || (Math.abs(x) < 19 && Math.abs(z) < 1.6)); // the covered stairwells off the hallway upstairs
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

  return { setSky, setWeather, setFlash, update, setClock, faceTex };
}

function lerpAngleW(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
