// The café: room, furniture, the team, the view of Cairo outside, and the
// light — which follows Cairo's real time of day.
//
// Units are metres. The room runs x −11…11, z −8…8, and is 4.2 m tall.
// The entrance is on the front wall (z = +8); the back door (z = −8) opens
// onto a Cairo street with minarets and palms.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildAvatar, makeLabel } from './avatar.js';

export const ROOM = { minX: -11, maxX: 11, minZ: -8, maxZ: 8, h: 4.2 };

const COLORS = {
  plaster: '#f6ece2', sage: '#9fbf98', sageDark: '#6f9a6c', wood: '#a8754f', woodDark: '#7a5236',
  woodLight: '#c99b72', cream: '#fef9f5', sakura: '#f2a7bb', sakuraDark: '#d4678a', forest: '#2f5d3a',
  amber: '#f0b56a', text: '#2d1f1f',
};

const SEG = 48;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

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
  const colliders = [];   // { type: 'circle', x, z, r } | { type: 'box', minX, maxX, minZ, maxZ }
  const seats = [];       // { id, label, x, z, y, ry, chair }
  const surfaces = [];    // meshes notes can be left on (userData.surface)
  const interactables = []; // meshes that respond to hover/click (userData.kind)
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

  // ── floor
  const floorTex = woodFloorTexture();
  floorTex.anisotropy = maxAniso;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), std('#ffffff', { map: floorTex, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.floor = true;
  scene.add(floor);

  // ── walls (built as one piece each, with real openings)
  const H = ROOM.h;
  const back = wallWithHoles(22.4, H, [[-9, 0, -7, 2.7]], M.plaster);
  back.position.set(0, 0, -8.1);
  const front = wallWithHoles(22.4, H, [[-8, 1.0, -4, 3.0], [-1.1, 0, 1.1, 2.8], [4, 1.0, 8, 3.0]], M.plaster);
  front.position.set(0, 0, 8.1);
  const left = wallWithHoles(16.4, H, [[-5, 1.0, -2, 3.0], [1, 1.0, 4, 3.0]], M.plaster);
  left.rotation.y = Math.PI / 2;
  left.position.set(-11.1, 0, 0);
  const right = wallWithHoles(16.4, H, [], M.plaster);
  right.rotation.y = -Math.PI / 2;
  right.position.set(11.1, 0, 0);
  for (const w of [back, front, left, right]) {
    w.userData.surface = 'wall';
    surfaces.push(w);
    scene.add(w);
  }

  // sage wainscoting all round (below 1 m), with a wooden rail
  const wains = [
    { x: 0, z: -7.99, w: 22, ry: 0, skip: [-9, -7] },
    { x: 0, z: 7.99, w: 22, ry: Math.PI, skip: [-1.1, 1.1] },
    { x: -10.99, z: 0, w: 16, ry: Math.PI / 2 },
    { x: 10.99, z: 0, w: 16, ry: -Math.PI / 2 },
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
      scene.add(g);
    }
  }

  // ceiling + beams
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(22.4, 16.4), std('#fbf3ea', { roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);
  for (let x = -9; x <= 9; x += 3) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 16), M.woodDark);
    beam.position.set(x, H - 0.12, 0);
    scene.add(beam);
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
    scene.add(f);
  }

  // back door (open a little, glass upper half) — Cairo is through here
  {
    const frame = windowFrame(2, 2.7, 0);
    frame.position.set(-8, 1.35, -8.1);
    frame.children.forEach(ch => { if (ch.geometry?.parameters?.depth === 0.35) ch.visible = false; });
    scene.add(frame);
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
    scene.add(door);
    // cutting out the panel's glass area: simple trick — a second frame half
    const half = new THREE.Group();
    const p2 = rbox(0.95, 2.6, 0.06, 0.02, M.wood);
    p2.position.set(-0.475, 1.3, 0);
    half.add(p2);
    half.position.set(-7, 0, -8.05);
    half.rotation.y = 0.9;
    scene.add(half);
    const hover = new THREE.Mesh(new THREE.BoxGeometry(2, 2.7, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(-8, 1.35, -8.2);
    hover.userData = { kind: 'info', label: 'The back door — Cairo, just outside', text: 'Through the back door: a Cairo street, the minarets, the palms, and whatever the sky is doing right now in Cairo.' };
    interactables.push(hover);
    scene.add(hover);
  }

  // front door (closed, glass top, OPEN sign)
  {
    const door = rbox(2.1, 2.75, 0.08, 0.03, M.wood);
    door.position.set(0, 1.375, 8.08);
    scene.add(door);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), M.glass);
    pane.position.set(0, 2.0, 8.03);
    pane.rotation.y = Math.PI;
    scene.add(pane);
    const sign = makeSign([
      { text: 'open', font: 'Dancing Script, cursive', size: 210, color: COLORS.sakuraDark, weight: '700' },
    ], 0.7, 0.32, { bg: COLORS.cream });
    sign.position.set(0, 1.3, 8.02);
    sign.rotation.y = Math.PI;
    scene.add(sign);
    // wind chime above the door
    const chime = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25 + i * 0.05, 12), M.brass);
      rod.position.set(-0.12 + i * 0.06, -0.2 - i * 0.02, 0);
      chime.add(rod);
    }
    chime.position.set(0.8, 3.2, 7.75);
    scene.add(chime);
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
    scene.add(g);
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
    scene.add(g);
    t.userData.surface = 'table';
    t.userData.top = h + 0.026;
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
    scene.add(g);
  }

  function addTable(id, label, x, z, chairAngles, { reserved = false, sign = null } = {}) {
    const t = roundTable(x, z);
    vase(x, t.top.userData.top, z);
    chairAngles.forEach((ang, i) => {
      const cx = x + Math.sin(ang) * 0.85;
      const cz = z + Math.cos(ang) * 0.85;
      const ry = ang + Math.PI; // facing the table
      const c = chair(cx, cz, ry);
      colliders.push({ type: 'circle', x: cx, z: cz, r: 0.28 });
      if (!reserved) {
        const seat = { id: `${id}-${i}`, label, x: cx, z: cz, y: 0.0, ry, chair: c };
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

  // Table Four, at the window
  addTable('four', 'Table Four', -9.6, -3.5, [Math.PI / 2 + 0.5, Math.PI / 2 - 0.5 + Math.PI]);
  {
    const s = makeSign([
      { text: 'Table Four', size: 120, weight: '700' },
      { text: 'the best seat in Cairo', font: 'Dancing Script, cursive', size: 80, color: COLORS.sakuraDark },
    ], 0.34, 0.2);
    s.position.set(-9.6, 0.9, -3.5);
    s.rotation.y = Math.PI / 2;
    scene.add(s);
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
    scene.add(s);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.01), M.cream);
    card.position.copy(s.position).add(new THREE.Vector3(-0.004, 0, -0.005));
    card.rotation.y = 0.9;
    scene.add(card);
    const hover = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(-9.6, 0.4, 6.6);
    hover.userData = { kind: 'info', label: "Mariam's corner", text: "This one is always kept for Mariam — the reason the café exists. You're welcome to leave her a note on the table." };
    interactables.push(hover);
    scene.add(hover);
  }

  // ── rugs
  const rugTex = rugTexture();
  const rug1 = new THREE.Mesh(new THREE.CircleGeometry(1.9, 96), std('#ffffff', { map: rugTex, roughness: 1 }));
  rug1.rotation.x = -Math.PI / 2;
  rug1.position.set(-2.2, 0.006, 4.4);
  rug1.receiveShadow = true;
  scene.add(rug1);
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.2), std('#ffffff', { map: rugTex, roughness: 1 }));
  rug2.rotation.x = -Math.PI / 2;
  rug2.position.set(8.9, 0.006, 1.5);
  rug2.receiveShadow = true;
  scene.add(rug2);

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
    scene.add(g);
    const light = new THREE.PointLight('#ff9a4a', 6, 7, 2);
    light.position.set(fire.x - 0.8, 0.6, fire.z);
    scene.add(light);
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
    scene.add(hover);
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
    scene.add(g);
    colliders.push({ type: 'circle', x, z, r: 0.5 });
    const seat = { id, label, x, z, y: 0.02, ry, chair: g };
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
    scene.add(counter);
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
    scene.add(machine);
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
      scene.add(p);
      puffs.push(p);
    }
    animated.push((dt, t) => {
      puffs.forEach(p => {
        const k = (t * 0.18 + p.userData.phase) % 1;
        p.position.set(8.6 + Math.sin(t + p.userData.phase * 6) * 0.05, 1.65 + k * 0.7, -5.05);
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
    scene.add(caseG);

    const reg = rbox(0.35, 0.25, 0.3, 0.04, M.cream);
    reg.position.set(6.4, 1.2, -4.8);
    scene.add(reg);

    // click the counter to order
    const orderZone = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ visible: false }));
    orderZone.position.set(6.5, 0.7, -4.6);
    orderZone.userData = { kind: 'order', label: 'Order a drink' };
    interactables.push(orderZone);
    scene.add(orderZone);
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
    scene.add(g);
    const plaque = makeSign([{ text: "Me3temed's shelf", font: 'Dancing Script, cursive', size: 110, color: COLORS.forest, weight: '700' }], 0.7, 0.14, { bg: COLORS.cream, radius: 30 });
    plaque.position.set(6.6, 2.5, -7.55);
    scene.add(plaque);

    // chalk menu on the back wall above the shelves
    const menu = makeSign([
      { text: 'today', font: 'Dancing Script, cursive', size: 70, color: '#f7c9d5' },
      { text: 'matcha · hojicha · cardamom milk', font: 'Nunito, sans-serif', size: 46, color: '#fef9f5' },
      { text: 'sakura tea · the sakura slice', font: 'Nunito, sans-serif', size: 46, color: '#fef9f5' },
    ], 3.2, 0.9, { bg: '#2f3a33', border: COLORS.woodDark, radius: 24 });
    menu.position.set(6.5, 3.35, -7.97);
    scene.add(menu);
  }

  // ── the community board (back wall)
  const board = { x: -2.8, y: 1.85, z: -7.96, w: 4.4, h: 1.9 };
  {
    const cork = new THREE.Mesh(new THREE.BoxGeometry(board.w, board.h, 0.04), std('#ffffff', { map: corkTexture(), roughness: 1 }));
    cork.position.set(board.x, board.y, board.z);
    cork.receiveShadow = true;
    cork.userData.surface = 'board';
    surfaces.push(cork);
    scene.add(cork);
    const frameParts = [
      [board.w + 0.16, 0.08, 0, board.h / 2 + 0.04], [board.w + 0.16, 0.08, 0, -board.h / 2 - 0.04],
      [0.08, board.h, -board.w / 2 - 0.04, 0], [0.08, board.h, board.w / 2 + 0.04, 0],
    ];
    for (const [w, h, x, y] of frameParts) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), M.woodDark);
      f.position.set(board.x + x, board.y + y, board.z + 0.01);
      f.castShadow = true;
      scene.add(f);
    }
  }
  const boardSign = { mesh: null };
  function setBoardSign(title, subtitle) {
    if (boardSign.mesh) { scene.remove(boardSign.mesh); boardSign.mesh.material.map.dispose(); }
    const s = makeSign([
      { text: title, size: 120, weight: '700' },
      { text: subtitle, font: 'Dancing Script, cursive', size: 92, color: COLORS.sakuraDark },
    ], 3.2, 0.62, { bg: null });
    s.position.set(board.x, board.y + board.h / 2 + 0.42, -7.98);
    scene.add(s);
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
    scene.add(g);
    colliders.push({ type: 'box', minX: 10.3, maxX: 11, minZ: 4.3, maxZ: 6.5 });
    const hover = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 2), new THREE.MeshBasicMaterial({ visible: false }));
    hover.position.set(10.7, 1.2, 5.4);
    hover.userData = { kind: 'info', label: 'The bookshelf', text: "This month's picks: Project Hail Mary (Yuto's) and A Study in Drowning (Yuki's). Borrow anything — bring it back whenever." };
    interactables.push(hover);
    scene.add(hover);
  }

  // ── a framed sign between the left windows
  {
    const s = makeSign([
      { text: 'Sakura Slice Café', size: 120, weight: '700' },
      { text: 'est. in imagination · Cairo', font: 'Dancing Script, cursive', size: 80, color: COLORS.sakuraDark },
    ], 2.2, 0.7);
    s.position.set(-10.97, 2.1, -0.5);
    s.rotation.y = Math.PI / 2;
    scene.add(s);
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
    scene.add(g);
    colliders.push({ type: 'circle', x, z, r: 0.3 * s });
    animated.push((dt, t) => { g.rotation.z = Math.sin(t * 0.6 + x) * 0.015; });
  }
  plant(-10.4, -7.4, 1.2);
  plant(-10.4, -0.5, 1.0);
  plant(10.4, 7.4, 1.3);
  plant(2.0, 7.4, 1.0);
  plant(-2.0, 7.4, 1.0);
  plant(2.3, -7.4, 1.1);
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
    scene.add(g);
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
    scene.add(petals);
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
    scene.add(g);
    const light = new THREE.PointLight('#ffcf94', 4, 6.5, 1.6);
    light.position.set(x, ROOM.h - 1.55, z);
    scene.add(light);
    lamps.push({ light, shade, bulb });
  }

  // string lights along the top of the walls
  const bulbs = [];
  {
    const bulbM = new THREE.MeshBasicMaterial({ color: '#ffe2b0' });
    const geo = new THREE.SphereGeometry(0.035, 16, 16);
    const runs = [[[-10.8, -7.85], [10.8, -7.85]], [[-10.85, -7.8], [-10.85, 7.8]], [[10.85, -3.8], [10.85, 7.8]], [[-10.8, 7.85], [10.8, 7.85]]];
    for (const [[x0, z0], [x1, z1]] of runs) {
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.5);
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const b = new THREE.Mesh(geo, bulbM);
        b.position.set(x0 + (x1 - x0) * k, 3.75 - Math.sin(k * Math.PI * (n / 6)) ** 2 * 0.12, z0 + (z1 - z0) * k);
        scene.add(b);
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
    scene.add(av.group);
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

  // ── outside: Cairo
  const outside = buildCairo(scene);

  // ── light
  const hemi = new THREE.HemisphereLight('#fff3e0', '#c9a27c', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const fill = new THREE.AmbientLight('#ffe9d6', 0.35);
  scene.add(fill);

  function setTimeOfDay(hour) {
    // 0 = deep night, 1 = full day
    const day = hour >= 6 && hour < 18.5 ? Math.min(1, (hour - 6) / 1.5, (18.5 - hour) / 1.5) : 0;
    const dusk = Math.max(0, 1 - Math.abs(hour - 18) / 1.3) + Math.max(0, 1 - Math.abs(hour - 6.3) / 1.0) * 0.7;
    const night = 1 - day;

    // sun arcs from east (+x) to west (−x), behind the back wall so the
    // light comes in through the back door and the left windows
    const a = ((hour - 6) / 12.5) * Math.PI;
    sun.position.set(Math.cos(a) * -30 - 10, Math.max(3, Math.sin(a) * 34), -26);
    sun.intensity = 3.2 * day;
    sun.color.set(dusk > 0.3 ? '#ffb27a' : '#ffe8c4');
    hemi.intensity = 0.12 + day * 0.78;
    hemi.color.set(night > 0.5 ? '#9fa9d6' : '#fff3e0');
    fill.intensity = 0.1 + day * 0.3;
    scene.environmentIntensity = 0.08 + day * 0.27;

    // lamps glow more after dark — at night the room is lit by them alone
    const lampK = 0.55 + night * 0.85;
    lamps.forEach(l => { l.light.intensity = 3.5 * lampK; l.shade.material.emissiveIntensity = 0.2 + night * 0.5; });
    bulbs.forEach(b => b.material.color.set(night > 0.5 ? '#ffd49a' : '#ffe9c9'));

    outside.setSky(hour, day, dusk, night);
    return { day, night };
  }

  function update(dt, t) {
    animated.forEach(f => f(dt, t));
    npcs.forEach(n => n.av.update(dt, {}));
    outside.update(dt, t);
  }

  return {
    scene, colliders, seats, surfaces, interactables, npcs, update, setTimeOfDay, setBoardSign,
    fire: { x: fire.x - 0.4, y: 0.5, z: fire.z }, board, tree,
  };
}

// ───────────────────────────────────────── Cairo, outside

function buildCairo(scene) {
  // sky dome with a smooth gradient
  const skyU = {
    top: { value: new THREE.Color('#8ec5ff') },
    horizon: { value: new THREE.Color('#ffe9c7') },
    bottom: { value: new THREE.Color('#e8d2b0') },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.6, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);

  // stars (soft round sprites, only at night)
  const starTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 500; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.45;
    sp.push(Math.cos(th) * Math.sin(ph) * 140, Math.cos(ph) * 140, Math.sin(th) * Math.sin(ph) * 140);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.6, map: starTex, transparent: true, depthWrite: false, opacity: 0 }));
  scene.add(stars);

  // sun and moon discs
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshBasicMaterial({ color: '#fff4d6', transparent: true }));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshBasicMaterial({ color: '#f4f1e6', transparent: true }));
  scene.add(sunDisc, moon);

  // the ground outside
  const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64), new THREE.MeshStandardMaterial({ color: '#d9c19a', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  scene.add(ground);
  // a pavement strip and kerb around the café
  const pave = new THREE.Mesh(new THREE.RingGeometry(0, 1, 4), new THREE.MeshStandardMaterial({ color: '#e8dcc8', roughness: 1 }));
  pave.scale.set(24, 24, 1);
  pave.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  pave.position.y = -0.02;
  scene.add(pave);

  const sand = ['#e6cfa6', '#dcbf92', '#efdcbc', '#d4b58a', '#e9d4b4', '#cfae86'];
  const r = rand(42);
  const buildingM = sand.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  const winM = new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 0.6, emissive: '#ffcf8a', emissiveIntensity: 0 });

  function building(x, z, w, d, h) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.15), buildingM[Math.floor(r() * buildingM.length)]);
    b.position.y = h / 2;
    b.castShadow = b.receiveShadow = true;
    g.add(b);
    // windows on the face toward the café
    const cols = Math.max(1, Math.floor(w / 1.6));
    const rows = Math.max(1, Math.floor(h / 2.4));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (r() < 0.2) continue;
        const wdw = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), winM);
        wdw.position.set(-w / 2 + (i + 0.5) * (w / cols), 1.4 + j * 2.4, 0);
        g.add(wdw);
      }
    }
    g.position.set(x, 0, z);
    g.lookAt(0, 0, 0);
    g.children.slice(1).forEach(c => { c.position.z = d / 2 + 0.01; });
    scene.add(g);
  }

  function minaret(x, z, h) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: '#efe0c4', roughness: 0.9 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, h * 0.45, 8), m);
    base.position.y = h * 0.225;
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, h * 0.35, 32), m);
    mid.position.y = h * 0.45 + h * 0.175;
    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 0.35, 32), m);
    balcony.position.y = h * 0.62;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, h * 0.2, 32), m);
    top.position.y = h * 0.8 + h * 0.1 - h * 0.08;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, h * 0.16, 32), new THREE.MeshStandardMaterial({ color: '#7aab7a', roughness: 0.6 }));
    cap.position.y = h * 0.94;
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshStandardMaterial({ color: '#c9a25b', metalness: 0.8, roughness: 0.3 }));
    fin.position.y = h * 1.03;
    g.add(base, mid, balcony, top, cap, fin);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function dome(x, z, rad) {
    const m = new THREE.MeshStandardMaterial({ color: '#efe0c4', roughness: 0.9 });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.95, rad, rad * 0.8, 48), m);
    drum.position.set(x, rad * 0.4 + 4, z);
    const d = new THREE.Mesh(new THREE.SphereGeometry(rad, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), m);
    d.position.set(x, rad * 0.8 + 4, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(rad * 3, 4, rad * 3), m);
    base.position.set(x, 2, z);
    [drum, d, base].forEach(o => { o.castShadow = true; scene.add(o); });
  }

  function palm(x, z, h) {
    const g = new THREE.Group();
    const trunkM = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 1 });
    const lean = (r() - 0.5) * 0.6;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.4, h * 0.5, 0), new THREE.Vector3(lean, h, lean * 0.3),
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.16, 12), trunkM);
    trunk.castShadow = true;
    g.add(trunk);
    const frondM = new THREE.MeshStandardMaterial({ color: '#4f8a4a', roughness: 0.85, side: THREE.DoubleSide });
    const fronds = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.6, 0.35, 2.6, 0);
      shape.quadraticCurveTo(0.6, -0.35, 0, 0);
      const f = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), frondM);
      f.rotation.set(-0.5 - r() * 0.4, (i / 9) * Math.PI * 2, 0, 'YXZ');
      f.castShadow = true;
      fronds.add(f);
    }
    fronds.position.set(lean, h, lean * 0.3);
    g.add(fronds);
    g.position.set(x, 0, z);
    scene.add(g);
    return fronds;
  }

  // behind the back door: a street, a mosque, two minarets
  minaret(-16, -34, 22);
  minaret(4, -40, 26);
  dome(-6, -40, 4.5);
  for (let i = 0; i < 26; i++) {
    const ang = r() * Math.PI * 2;
    const dist = 34 + r() * 40;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    if (z < -28 && x > -22 && x < 10) continue; // keep the mosque in view
    building(x, z, 5 + r() * 7, 5 + r() * 6, 4 + r() * 9);
  }
  const fronds = [
    palm(-9, -13, 7), palm(-4, -15, 8.5), palm(-14, -12, 6.5),
    palm(-15, -4, 7.5), palm(-16, 3, 8), palm(-6, 13, 7), palm(6, 14, 8), palm(14, 12, 7),
  ];

  function setSky(hour, day, dusk, night) {
    const dayTop = new THREE.Color('#7fb8f0'), dayHor = new THREE.Color('#fbe8cc');
    const duskTop = new THREE.Color('#6d6aa8'), duskHor = new THREE.Color('#ffb48a');
    const nightTop = new THREE.Color('#0d1530'), nightHor = new THREE.Color('#2b3159');
    const top = nightTop.clone().lerp(dayTop, day).lerp(duskTop, Math.min(1, dusk) * 0.7);
    const hor = nightHor.clone().lerp(dayHor, day).lerp(duskHor, Math.min(1, dusk) * 0.8);
    skyU.top.value.copy(top);
    skyU.horizon.value.copy(hor);
    skyU.bottom.value.copy(hor.clone().multiplyScalar(0.85));
    stars.material.opacity = Math.max(0, night - 0.3);
    const a = ((hour - 6) / 12.5) * Math.PI;
    sunDisc.position.set(Math.cos(a) * -100 - 30, Math.max(-10, Math.sin(a) * 110), -90);
    sunDisc.lookAt(0, 0, 0);
    sunDisc.material.opacity = day;
    sunDisc.material.color.set(dusk > 0.3 ? '#ffc58f' : '#fff4d6');
    moon.position.set(40, 70, -100);
    moon.lookAt(0, 0, 0);
    moon.material.opacity = night;
    winM.emissiveIntensity = night * 0.9;
    ground.material.color.set(night > 0.5 ? '#6f6a7c' : '#d9c19a');
  }

  function update(dt, t) {
    fronds.forEach((f, i) => { f.rotation.z = Math.sin(t * 0.7 + i) * 0.04; f.rotation.x = Math.sin(t * 0.5 + i * 2) * 0.03; });
  }

  return { setSky, update };
}
