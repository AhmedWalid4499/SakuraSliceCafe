// The Pottery Studio: on the fourth floor, off its landing. Three potter's
// wheels with a stool each (sit at one and shape a cup — app.js), a brick kiln
// that glows when it's firing, glaze buckets, shelves of pots drying, aprons
// on their hooks, and the cup shelf: everyone's finished cups, newest first.
//
// makeCupMesh() builds a cup from its shape (the same numbers the shaping
// panel gives); drawCupProfile() draws the same cup flat, for the panel.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, shell, doorOut, plant, pendant } from './roomkit.js';

export const POTTERY = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, h: 3.3 };
const R = POTTERY;
const cyl = (rt, rb, h, m, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const CLAY = '#b9805a';

export const GLAZES = [
  ['#9cc4a8', 'Celadon'], ['#f2b8c6', 'Sakura pink'], ['#3f7fb0', 'Nile blue'], ['#e2a948', 'Honey'],
  ['#3a3a3e', 'Charcoal'], ['#f4ecdc', 'Cream'], ['#c8643c', 'Terracotta'], ['#8ab05a', 'Matcha'],
];
export const PATTERNS = [['plain', 'Plain'], ['speckle', 'Speckled'], ['drip', 'Drip'], ['stripes', 'Stripes'], ['dots', 'Dots']];

const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
const lift = (hex, k) => { const c = new THREE.Color(hex); return k > 0 ? c.lerp(new THREE.Color('#ffffff'), k) : c.lerp(new THREE.Color('#000000'), -k); };
const css = c => '#' + c.getHexString();

// The cup's outside profile, bottom to rim, in metres: [radius, height].
function profile(shape) {
  const h = 0.08 + clamp01(shape.h) * 0.07, belly = clamp01(shape.belly), lip = clamp01(shape.lip), foot = clamp01(shape.foot);
  const base = 0.028 + foot * 0.012, mid = 0.036 + belly * 0.016, rim = 0.034 + lip * 0.016;
  const pts = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // a soft curve: foot → belly (around 40% up) → rim
    const bulge = Math.sin(Math.min(1, t / 0.85) * Math.PI) * (mid - (base + (rim - base) * t));
    pts.push([base + (rim - base) * t + Math.max(0, bulge), t * h]);
  }
  return { pts, h, rim, base };
}

// A cup in the round. Base at y = 0, about 8–15 cm tall.
export function makeCupMesh(shape = {}, glaze = GLAZES[0][0], pattern = 'plain') {
  const g = new THREE.Group();
  const { pts, h, rim, base } = profile(shape);
  const tex = canvasTex(256, 128, (c, w, hh) => {
    c.fillStyle = glaze; c.fillRect(0, 0, w, hh);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const dark = css(lift(glaze, -0.35)), light = css(lift(glaze, 0.45));
    if (pattern === 'speckle') for (let i = 0; i < 260; i++) { c.fillStyle = r() < 0.7 ? dark : light; c.fillRect(r() * w, r() * hh, 1.5 + r() * 2, 1.5 + r() * 2); }
    if (pattern === 'stripes') { c.fillStyle = light; for (let y = 18; y < hh; y += 26) c.fillRect(0, y, w, 8); }
    if (pattern === 'dots') { c.fillStyle = light; for (let y = 16; y < hh; y += 32) for (let x = (y / 32 % 2) * 16 + 8; x < w; x += 32) { c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); } }
    if (pattern === 'drip') {
      // a second glaze running down from the rim (v = 1 is the rim, the top of the canvas)
      c.fillStyle = dark;
      c.fillRect(0, 0, w, 16);
      for (let x = 0; x < w; x += 10 + r() * 14) { const len = 16 + r() * 46, ww = 6 + r() * 8; c.fillRect(x, 0, ww, len); c.beginPath(); c.arc(x + ww / 2, len, ww / 2, 0, Math.PI * 2); c.fill(); }
    }
    // the bare clay foot
    c.fillStyle = CLAY; c.fillRect(0, hh - 7, w, 7);
  });
  const outM = std('#ffffff', { map: tex, roughness: 0.28, metalness: 0.02 });
  const outer = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28), outM);
  outer.castShadow = true;
  // (Lathe UVs run v = 0 at the bottom: flip so the rim is the top of the canvas)
  tex.flipY = true; tex.needsUpdate = true;
  g.add(outer);
  const inM = std(css(lift(glaze, -0.18)), { roughness: 0.25, side: THREE.BackSide });
  const inner = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(0.001, x - 0.004), Math.max(0.006, y))), 28), inM);
  g.add(inner);
  const lipRing = new THREE.Mesh(new THREE.TorusGeometry(rim - 0.002, 0.0025, 6, 28), std(css(lift(glaze, -0.08)), { roughness: 0.3 }));
  lipRing.rotation.x = Math.PI / 2; lipRing.position.y = h; g.add(lipRing);
  const floorDisc = new THREE.Mesh(new THREE.CircleGeometry(base, 24), inM.clone()); floorDisc.material.side = THREE.FrontSide;
  floorDisc.rotation.x = -Math.PI / 2; floorDisc.position.y = 0.006; g.add(floorDisc);
  if (shape.handle) {
    const hr = h * 0.28;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(hr, 0.0055, 8, 18, Math.PI * 1.2), std(glaze, { roughness: 0.3 }));
    // the outside radius halfway up, roughly
    const midR = pts[Math.round(pts.length * 0.5)][0];
    handle.position.set(midR + hr * 0.55, h * 0.52, 0);
    handle.rotation.z = -Math.PI * 0.6;
    g.add(handle);
  }
  return g;
}

// The same cup, flat, side on, centred in the canvas (for the shaping panel).
export function drawCupProfile(canvas, shape = {}, glaze = GLAZES[0][0], pattern = 'plain') {
  const c = canvas.getContext('2d'), w = canvas.width, hh = canvas.height;
  c.clearRect(0, 0, w, hh);
  const { pts, h } = profile(shape);
  const scale = (hh * 0.78) / 0.15, cx = w / 2, by = hh * 0.9;
  const P = (x, y) => [cx + x * scale, by - y * scale];
  // a little shadow, then the body
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(cx, by + 4, pts[0][0] * scale * 1.3, 6, 0, 0, Math.PI * 2); c.fill();
  const body = new Path2D();
  body.moveTo(...P(-pts[0][0], 0));
  for (const [x, y] of pts) body.lineTo(...P(-x, y));
  for (let i = pts.length - 1; i >= 0; i--) body.lineTo(...P(pts[i][0], pts[i][1]));
  body.closePath();
  if (shape.handle) {
    const midR = pts[Math.round(pts.length * 0.5)][0], hr = h * 0.28;
    c.strokeStyle = glaze; c.lineWidth = Math.max(4, 0.011 * scale);
    c.beginPath(); c.arc(...P(midR + hr * 0.3, h * 0.52), hr * scale * 0.9, -Math.PI * 0.55, Math.PI * 0.55); c.stroke();
  }
  const gr = c.createLinearGradient(cx - 0.06 * scale, 0, cx + 0.06 * scale, 0);
  gr.addColorStop(0, css(lift(glaze, -0.25))); gr.addColorStop(0.4, css(lift(glaze, 0.18))); gr.addColorStop(1, css(lift(glaze, -0.3)));
  c.fillStyle = gr; c.fill(body);
  c.save(); c.clip(body);
  const dark = css(lift(glaze, -0.35)), light = css(lift(glaze, 0.45));
  const top = by - h * scale;
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  if (pattern === 'speckle') for (let i = 0; i < 160; i++) { c.fillStyle = r() < 0.7 ? dark : light; c.fillRect(cx - 0.07 * scale + r() * 0.14 * scale, top + r() * h * scale, 2.5, 2.5); }
  if (pattern === 'stripes') { c.fillStyle = light; for (let y = top + 12; y < by - 8; y += 18) c.fillRect(0, y, w, 6); }
  if (pattern === 'dots') { c.fillStyle = light; for (let y = top + 12; y < by - 8; y += 20) for (let x = cx - 0.07 * scale + ((y / 20) % 2) * 10; x < cx + 0.07 * scale; x += 20) { c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); } }
  if (pattern === 'drip') { c.fillStyle = dark; c.fillRect(0, top, w, 10); for (let x = cx - 0.07 * scale; x < cx + 0.07 * scale; x += 9 + r() * 10) { const len = 10 + r() * h * scale * 0.4; c.fillRect(x, top, 6, len); c.beginPath(); c.arc(x + 3, top + len, 3, 0, Math.PI * 2); c.fill(); } }
  c.fillStyle = CLAY; c.fillRect(0, by - 5, w, 5);
  c.restore();
  // the rim, seen a little from above
  const rim = pts[pts.length - 1][0];
  c.fillStyle = css(lift(glaze, -0.28)); c.beginPath(); c.ellipse(cx, top, rim * scale, Math.max(3, rim * scale * 0.18), 0, 0, Math.PI * 2); c.fill();
}

export function buildPottery({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [176, 150, 124], 23),
    wallColor: '#f1e6d8', lowColor: '#b9805a', ceilColor: '#fbf6ee', windows: { east: [-2.4, 1.2], west: [-1.2] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const wood = std('#8a6040', { roughness: 0.6 }), dark = std('#4a3a32', { roughness: 0.5 }), steel = std('#b8bcc0', { metalness: 0.6, roughness: 0.35 });
  const clayM = std(CLAY, { roughness: 0.9 }), wetClay = std('#a86c48', { roughness: 0.45 });
  const lights = [];

  // clay dust on the floor, in soft patches
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.4 + (i % 3) * 0.25, 20), new THREE.MeshBasicMaterial({ color: '#d8b89a', transparent: true, opacity: 0.35, depthWrite: false }));
    d.rotation.x = -Math.PI / 2; d.position.set(-3.5 + i * 1.2, 0.006, -1.2 + Math.sin(i * 2.1) * 0.8); group.add(d);
  }

  // ── three wheels in a row, each with its stool facing it
  const wheels = [];
  for (let i = 0; i < 3; i++) {
    const x = -3.2 + i * 2.6, z = -0.8;
    const w = new THREE.Group(); w.position.set(x, 0, z); group.add(w);
    w.add(at(rbox(0.9, 0.42, 0.8, 0.12, std('#6f8fa8', { roughness: 0.5 })), 0, 0.21, 0)); // the body
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.1, 28, 1, true), std('#5f7f98', { roughness: 0.5, side: THREE.DoubleSide }));
    tray.position.y = 0.47; w.add(tray);
    const head = new THREE.Group(); head.position.y = 0.48; w.add(head);
    head.add(at(cyl(0.27, 0.27, 0.035, steel, 28), 0, 0, 0));
    for (let k = 0; k < 4; k++) head.add(at(box(0.5, 0.004, 0.02, dark), 0, 0.019, 0).rotateY(k * Math.PI / 4));
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), wetClay);
    lump.scale.set(1, 0.85, 1); lump.position.y = 0.1; head.add(lump);
    const pedal = at(rbox(0.16, 0.05, 0.24, 0.02, dark), 0.32, 0.03, 0.5); w.add(pedal);
    block(x, z, 0.95, 0.85);
    // the stool, behind it (you sit facing the wheel: −z)
    const stool = new THREE.Group(); stool.position.set(x, 0, z + 0.85); group.add(stool);
    stool.add(at(cyl(0.2, 0.2, 0.06, std(['#e8b4c0', '#a8c8b0', '#f0d08a'][i], { roughness: 0.6 })), 0, 0.46, 0));
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; const leg = at(cyl(0.018, 0.018, 0.46, wood, 8), Math.cos(a) * 0.13, 0.23, Math.sin(a) * 0.13); stool.add(leg); }
    const seat = { id: `pottery-wheel-${i}`, label: 'a potter’s wheel', x, z: z + 0.85, y: fy, h: 0.49, ry: Math.PI };
    seats.push(seat);
    clickable(head, { kind: 'pottery-wheel', seat, label: 'A potter’s wheel — shape a cup 🏺' });
    clickable(stool, { kind: 'pottery-wheel', seat, label: 'A potter’s wheel — shape a cup 🏺' });
    // a bucket of water and a sponge beside it
    const b = at(cyl(0.11, 0.09, 0.2, std('#e8e2d8', { roughness: 0.6 }), 16), x - 0.62, 0.1, z + 0.1); group.add(b);
    group.add(at(cyl(0.1, 0.1, 0.01, std('#7aa8c0', { roughness: 0.1 }), 16), x - 0.62, 0.19, z + 0.1));
    wheels.push({ head, lump, on: false });
  }

  // ── the kiln, in the north-west corner: brick, with a round door that glows
  const brickTex = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#e4d8cc'; g.fillRect(0, 0, w, w);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
      const x = col * 64 + (row % 2) * 32;
      g.fillStyle = ['#b65a3c', '#a8523a', '#c06a48', '#9a4a34'][(row * 3 + col + 8) % 4];
      g.fillRect(x + 2, row * 32 + 2, 60, 28);
    }
  }, [1.5, 1.5]);
  const brick = std('#ffffff', { map: brickTex, roughness: 0.9 });
  const KX = R.minX + 1.3, KZ = R.minZ + 1.2;
  const kiln = new THREE.Group(); kiln.position.set(KX, 0, KZ); group.add(kiln);
  kiln.add(at(rbox(1.8, 1.7, 1.6, 0.1, brick), 0, 0.85, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brick); dome.scale.set(1, 0.45, 0.9); dome.position.y = 1.7; kiln.add(dome);
  kiln.add(at(cyl(0.14, 0.16, 1.2, brick, 12), 0.45, 2.4, -0.3)); // the chimney
  const doorM = std('#2a1e1a', { roughness: 0.6, emissive: '#ff6a1a', emissiveIntensity: 0 });
  const kdoor = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), doorM); kdoor.position.set(0, 0.85, 0.81); kiln.add(kdoor);
  const kring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 8, 28), steel); kring.position.set(0, 0.85, 0.82); kiln.add(kring);
  const peep = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), std('#ffb060', { emissive: '#ff8a2a', emissiveIntensity: 0.2 })); peep.position.set(0, 0.85, 0.815); kiln.add(peep);
  const kilnLight = new THREE.PointLight('#ff8a3a', 0, 4, 1.5); kilnLight.position.set(KX, 0.9, KZ + 1.2); group.add(kilnLight);
  lights.push(kilnLight);
  block(KX, KZ, 1.9, 1.7);
  clickable(kiln, { kind: 'pottery-kiln', label: 'The kiln 🔥' });
  {
    const s = makeSign([{ text: 'KILN', size: 120, weight: '700', color: '#7a2a18' }, { text: 'hot! 1,200°', size: 60 }], 0.7, 0.3, { bg: '#f6eadc', border: '#b65a3c' });
    s.position.set(KX, 2.05, KZ + 0.83); group.add(s);
  }

  // ── the glaze table: buckets in all eight glazes, and brushes in a jar
  {
    const tx = 1.6, tz = R.minZ + 0.6;
    group.add(at(rbox(2.6, 0.06, 0.8, 0.02, wood), tx, 0.82, tz));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) group.add(at(box(0.06, 0.8, 0.06, dark), tx + a * 1.2, 0.4, tz + b * 0.32));
    GLAZES.forEach(([c], i) => {
      const bx = tx - 1.05 + (i % 4) * 0.7 / 1.0 * 1, bz = tz - 0.18 + Math.floor(i / 4) * 0.36;
      group.add(at(cyl(0.12, 0.1, 0.22, std('#f2efe8', { roughness: 0.5 }), 16), bx, 0.96, bz));
      group.add(at(cyl(0.11, 0.11, 0.01, std(c, { roughness: 0.2 }), 16), bx, 1.065, bz));
    });
    block(tx, tz, 2.7, 0.9);
    const jar = at(cyl(0.06, 0.06, 0.16, std('#cfe0e8', { roughness: 0.1, transparent: true, opacity: 0.6 }), 12), tx + 1.15, 0.93, tz + 0.3); group.add(jar);
    for (let k = 0; k < 4; k++) { const br = at(cyl(0.007, 0.007, 0.3, wood, 6), tx + 1.15 + (k - 1.5) * 0.02, 1.06, tz + 0.3); br.rotation.z = (k - 1.5) * 0.12; group.add(br); }
    const s = makeSign([{ text: 'Glazes', font: 'Dancing Script, cursive', size: 120, color: '#7a4e33' }], 0.8, 0.28, { bg: '#fbf6ee', border: '#c8643c' });
    s.position.set(tx, 1.9, R.minZ + 0.03); group.add(s);
  }

  // ── shelves of pots drying (bare clay), on the west wall
  {
    const sx = R.minX + 0.28, sz = 1.6;
    for (let k = 0; k < 3; k++) group.add(at(box(0.4, 0.04, 2.4, wood), sx, 0.6 + k * 0.55, sz));
    for (const dz of [-1.2, 1.2]) group.add(at(box(0.4, 1.8, 0.04, wood), sx, 0.9, sz + dz));
    for (let k = 0; k < 3; k++) for (let j = 0; j < 6; j++) {
      const shape = { h: (j * 37 % 10) / 10, belly: (j * 53 % 10) / 10, lip: (k * 3 + j) % 5 / 5, foot: 0.5, handle: false };
      const pot = makeCupMesh(shape, '#d8b89a', 'plain');
      pot.scale.setScalar(1.3); pot.position.set(sx, 0.62 + k * 0.55, sz - 1.0 + j * 0.4); group.add(pot);
    }
    block(sx, sz, 0.45, 2.5);
    const s = makeSign([{ text: 'drying — please don’t touch!', size: 64 }], 1.1, 0.2, { bg: '#fbf6ee' });
    s.position.set(R.minX + 0.03, 2.35, sz); s.rotation.y = Math.PI / 2; group.add(s);
  }

  // ── aprons on hooks by the door
  for (let i = 0; i < 4; i++) {
    const ax = -4.3 + i * 0.55, az = R.maxZ - 0.06;
    group.add(at(cyl(0.012, 0.012, 0.08, steel, 6).rotateX(Math.PI / 2), ax, 1.85, az - 0.04));
    const ap = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.75), std(['#c8643c', '#6f8fa8', '#8ab05a', '#e8b4c0'][i], { roughness: 1, side: THREE.DoubleSide }));
    ap.position.set(ax, 1.42, az - 0.07); ap.rotation.y = Math.PI; group.add(ap);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 16, Math.PI), ap.material); strap.position.set(ax, 1.78, az - 0.07); group.add(strap);
  }

  // ── the cup shelf: everyone's finished cups, newest first, on the east wall
  const SHELF = { x: R.maxX - 0.25, z: 3.0, w: 2.6 };
  const shelfGroup = new THREE.Group(); group.add(shelfGroup);
  {
    const back = at(box(0.06, 1.9, SHELF.w + 0.1, std('#e8dccc', { roughness: 0.9 })), R.maxX - 0.04, 1.35, SHELF.z); group.add(back);
    for (let k = 0; k < 3; k++) group.add(at(box(0.36, 0.035, SHELF.w, wood), SHELF.x, 0.75 + k * 0.6, SHELF.z));
    for (const dz of [-1, 1]) group.add(at(box(0.36, 1.85, 0.04, wood), SHELF.x, 1.35, SHELF.z + dz * SHELF.w / 2));
    block(SHELF.x, SHELF.z, 0.4, SHELF.w);
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.9, SHELF.w), new THREE.MeshBasicMaterial({ visible: false })), SHELF.x, 1.35, SHELF.z);
    group.add(hit); clickable(hit, { kind: 'pottery-shelf', label: 'The cup shelf — everyone’s cups 🍵' });
    const s = makeSign([{ text: 'The Cup Shelf', size: 100, weight: '700', color: '#7a4e33' }, { text: 'made here, by everyone 🍵', font: 'Dancing Script, cursive', size: 64, color: '#c4627f' }], 1.3, 0.36, { bg: '#fbf6ee', border: '#c8643c' });
    s.position.set(R.maxX - 0.03, 2.55, SHELF.z); s.rotation.y = -Math.PI / 2; group.add(s);
  }
  const tagTex = (name) => canvasTex(128, 40, (g, w, h) => {
    g.fillStyle = '#fffaf2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8643c'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = '#5a3e36'; g.font = '22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(name || '').slice(0, 12), w / 2, h / 2 + 1);
  });
  function setShelf(cups = []) {
    for (const o of [...shelfGroup.children]) { shelfGroup.remove(o); o.traverse(m => { if (m.isMesh) { m.geometry.dispose(); [].concat(m.material).forEach(mm => { mm.map?.dispose(); mm.dispose(); }); } }); }
    cups.slice(0, 18).forEach((c, i) => {
      const row = Math.floor(i / 6), col = i % 6;
      const cup = makeCupMesh(c.shape || {}, c.glaze || GLAZES[0][0], c.pattern || 'plain');
      cup.scale.setScalar(1.6);
      cup.position.set(SHELF.x, 0.77 + (2 - row) * 0.6, SHELF.z - SHELF.w / 2 + 0.22 + col * ((SHELF.w - 0.44) / 5));
      cup.rotation.y = -Math.PI / 2 + 0.5;
      shelfGroup.add(cup);
      const label = c.by || c.name;
      if (label) {
        const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.0625), new THREE.MeshBasicMaterial({ map: tagTex(label) }));
        tag.position.set(SHELF.x - 0.185, 0.725 + (2 - row) * 0.6, cup.position.z); tag.rotation.y = -Math.PI / 2;
        shelfGroup.add(tag);
      }
    });
  }

  // ── a work table in the middle with tools, and a sink in the corner
  {
    const tx = 0.6, tz = 2.4;
    group.add(at(rbox(2.0, 0.08, 1.0, 0.03, std('#c8a880', { roughness: 0.8 })), tx, 0.86, tz));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) group.add(at(box(0.07, 0.84, 0.07, dark), tx + a * 0.9, 0.42, tz + b * 0.42));
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), clayM); l.scale.set(1.2, 0.7, 1); l.position.set(tx - 0.6 + k * 0.35, 0.94, tz - 0.15); group.add(l); }
    const rolling = at(cyl(0.035, 0.035, 0.5, wood, 12), tx + 0.5, 0.94, tz + 0.15); rolling.rotation.z = Math.PI / 2; group.add(rolling);
    for (let k = 0; k < 4; k++) group.add(at(box(0.015, 0.008, 0.16, k % 2 ? steel : wood), tx - 0.2 + k * 0.08, 0.905, tz + 0.25));
    block(tx, tz, 2.1, 1.1);
    const sink = new THREE.Group(); sink.position.set(R.maxX - 0.55, 0, R.minZ + 0.55); group.add(sink);
    sink.add(at(rbox(0.9, 0.85, 0.8, 0.04, std('#e8e2d8', { roughness: 0.4 })), 0, 0.425, 0));
    sink.add(at(cyl(0.015, 0.015, 0.3, steel, 8), 0, 1.0, -0.25));
    sink.add(at(cyl(0.012, 0.012, 0.18, steel, 8).rotateX(Math.PI / 2), 0, 1.14, -0.17));
    block(R.maxX - 0.55, R.minZ + 0.55, 0.95, 0.85);
  }

  plant(group, colliders, R.maxX - 0.6, R.maxZ - 0.7, 1.1);
  plant(group, colliders, R.minX + 0.6, R.maxZ - 0.7, 0.9);
  lights.push(pendant(group, R, -2.0, -0.8, { intensity: 2.2 }), pendant(group, R, 2.0, -0.8, { intensity: 2.2 }), pendant(group, R, 0.6, 2.4, { intensity: 1.8 }));
  {
    const s = makeSign([{ text: 'The Pottery Studio', size: 110, weight: '700', color: '#7a4e33' }, { text: 'shape it · glaze it · fire it 🏺', font: 'Dancing Script, cursive', size: 66, color: '#c8643c' }], 2.0, 0.5, { bg: '#fbf6ee', border: '#c8643c' });
    s.position.set(-1.2, 2.75, R.minZ + 0.04); group.add(s);
  }
  doorOut({ group, R, makeSign, interactables, color: '#c8643c', to: 'landing4', sign: '⬅ The landing', label: 'Back out to the landing' });

  let firing = false;
  animate?.((dt, t) => {
    for (const w of wheels) if (w.on) { w.head.rotation.y += dt * 9; w.lump.scale.y = 0.85 + Math.sin(t * 2) * 0.12; w.lump.scale.x = w.lump.scale.z = 1 - Math.sin(t * 2) * 0.06; }
    const f = firing ? 0.75 + Math.sin(t * 7) * 0.12 + Math.sin(t * 13.3) * 0.08 : 0;
    doorM.emissiveIntensity = f * 1.4;
    peep.material.emissiveIntensity = firing ? 1.5 + f : 0.2;
    kilnLight.intensity = f * 3;
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.2, ry: Math.PI },
    setSpinning(i, on) { if (wheels[i]) { wheels[i].on = !!on; if (!on) wheels[i].lump.scale.set(1, 0.85, 1); } },
    setKiln(on) { firing = !!on; },
    setShelf,
  };
}
