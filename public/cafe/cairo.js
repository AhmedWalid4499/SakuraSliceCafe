// Cairo's street life, round the café's block (world.js builds the street
// itself — the road, the pavements, the buildings — and hands it here):
//
//   traffic    white Cairo taxis with their black-checked band, an old
//              black-and-white Fiat taxi, a white microbus, tuk-tuks, a
//              delivery motorbike, a donkey cart with its vegetables, and the
//              bread man on his bicycle with a tray of aish baladi on his
//              head. Everyone queues behind the donkey cart, and everyone
//              honks (world.setStreetSound passes the honks to audio.js).
//   vendors    a foul cart with its big copper pot, a sweet-potato oven cart
//              smoking away, a sugarcane-juice stand, a kiosk hung with
//              snacks, and an ahwa — a street café — with men on their
//              chairs over tea, tawla and shisha. Street cats about.
//   overhead   strings of colourful zeena flags across the roads, tangles of
//              electric cable, and in Ramadan, lanterns (fawanees) on them.
//   the people on the far pavements, going about their day.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, m) => shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m));
const box = (w, h, d, m) => shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
const cyl = (rt, rb, h, m, seg = 16) => shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m));
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const rot = (o, axis, v) => { o.rotation[axis] = v; return o; }; // (add() hands back the parent, so turn the child first)
function tex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

export function buildCairoLife({ scene, r, STREET, nightMats, glowTex, makeSign, buildAvatar }) {
  const animated = [];
  const life = { onSound: null };
  const say = (kind, pos) => { if (life.onSound) life.onSound(kind, pos); };
  const tire = std('#1e1e1e', { roughness: 0.85 });
  const glassM = std('#2a3138', { roughness: 0.1, metalness: 0.4 });
  const chrome = std('#c8c8c8', { metalness: 0.8, roughness: 0.3 });
  const lightM = std('#fff6e0', { emissive: '#ffe9b0', emissiveIntensity: 0 });
  nightMats.push({ mat: lightM, max: 2 });
  const wheel = (g, x, z, rad = 0.32, w = 0.22) => { const m = at(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, w, 18), tire), x, rad, z); m.rotation.x = Math.PI / 2; g.add(m); return m; };
  const lights = (g, x, y, zs) => zs.forEach(z => g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), lightM), x, y, z)));

  // ── the vehicles (each built facing +x, on y = 0)
  const checker = tex(256, 32, (g, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f4f1ea'; g.fillRect(i * 16, j * 16, 16, 16); } });
  const VEHICLES = {
    // today's white taxi, with the black-and-white checked band along its side
    taxi() {
      const g = new THREE.Group();
      g.add(at(rbox(3.9, 0.75, 1.7, 0.25, std('#f4f2ec', { roughness: 0.35, metalness: 0.2 })), 0, 0.6, 0));
      g.add(at(rbox(2.1, 0.58, 1.5, 0.2, glassM), -0.2, 1.18, 0));
      for (const s of [-1, 1]) { const b = at(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.16), std('#ffffff', { map: checker })), 0, 0.72, s * 0.856); if (s < 0) b.rotation.y = Math.PI; g.add(b); }
      g.add(at(rbox(0.5, 0.14, 0.24, 0.04, std('#f4f1ea', { emissive: '#ffe9a0', emissiveIntensity: 0.3 })), -0.2, 1.54, 0)); // the roof sign
      for (const [x, z] of [[1.2, 0.78], [-1.2, 0.78], [1.2, -0.78], [-1.2, -0.78]]) wheel(g, x, z);
      lights(g, 1.95, 0.68, [0.55, -0.55]);
      return { g, len: 3.9, speed: 4.2 + r() * 1.2, horn: 'honk' };
    },
    // the old black-and-white Fiat 128 taxi, still going
    oldTaxi() {
      const g = new THREE.Group();
      const black = std('#1c1c1c', { roughness: 0.4, metalness: 0.3 }), white = std('#f1eee6', { roughness: 0.45 });
      g.add(at(rbox(3.6, 0.6, 1.6, 0.12, black), 0, 0.55, 0));
      for (const x of [1.45, -1.45]) g.add(at(rbox(0.7, 0.62, 1.62, 0.12, white), x, 0.55, 0)); // white wings front and back
      g.add(at(rbox(1.8, 0.55, 1.45, 0.08, black), -0.15, 1.1, 0));
      for (const s of [-1, 1]) g.add(at(box(1.5, 0.36, 0.02, glassM), -0.15, 1.12, s * 0.73));
      for (const [x, z] of [[1.15, 0.75], [-1.15, 0.75], [1.15, -0.75], [-1.15, -0.75]]) wheel(g, x, z, 0.3);
      g.add(at(box(0.2, 0.08, 1.4, chrome), 1.82, 0.4, 0));
      lights(g, 1.82, 0.62, [0.5, -0.5]);
      return { g, len: 3.6, speed: 3.6 + r() * 0.8, horn: 'honk' };
    },
    // the white microbus, sliding door open, someone calling out where it's going
    microbus() {
      const g = new THREE.Group();
      const body = std('#f2f0ea', { roughness: 0.4, metalness: 0.15 });
      g.add(at(rbox(4.8, 1.6, 1.9, 0.2, body), 0, 1.15, 0));
      g.add(at(box(4.7, 0.12, 1.92, std('#3f6a8a')), 0, 0.85, 0)); // its stripe
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.add(at(box(0.85, 0.5, 0.02, glassM), 1.3 - i * 1.0, 1.55, s * 0.96));
      g.add(at(box(0.02, 0.62, 1.7, glassM), 2.41, 1.5, 0));
      g.add(at(box(0.9, 0.9, 0.02, std('#1a1a1a')), 0.2, 1.1, 0.965)); // the open door
      for (const [x, z] of [[1.6, 0.85], [-1.6, 0.85], [1.6, -0.85], [-1.6, -0.85]]) wheel(g, x, z, 0.36);
      g.add(at(box(1.2, 0.2, 1.4, std('#7a5236')), -0.8, 2.05, 0)); // luggage on the roof
      lights(g, 2.42, 0.8, [0.65, -0.65]);
      return { g, len: 4.8, speed: 4.6 + r() * 0.8, horn: 'honk' };
    },
    // a tuk-tuk (a "toktok"): three wheels, a canvas roof, bright red or blue
    toktok() {
      const g = new THREE.Group();
      const c = r() < 0.5 ? '#c8352f' : '#2f5f9a';
      const shell_ = std(c, { roughness: 0.4, metalness: 0.2 });
      g.add(at(rbox(1.9, 0.55, 1.2, 0.2, shell_), -0.1, 0.55, 0));
      g.add(at(rbox(0.5, 0.9, 1.0, 0.18, shell_), 0.75, 0.95, 0));
      g.add(at(rbox(1.9, 0.08, 1.3, 0.04, std('#1a1a1a', { roughness: 0.9 })), -0.1, 1.65, 0));
      for (const [x, z] of [[0.75, 0.55], [-0.6, 0.55], [-0.6, -0.55], [0.75, -0.55]]) g.add(at(cyl(0.025, 0.025, 0.85, chrome, 6), x, 1.22, z));
      g.add(at(box(0.04, 0.5, 0.9, glassM), 1.02, 1.2, 0));
      wheel(g, 0.95, 0, 0.22, 0.14); wheel(g, -0.75, 0.55, 0.22, 0.14); wheel(g, -0.75, -0.55, 0.22, 0.14);
      g.add(at(box(0.3, 0.1, 0.5, std('#e8b44a')), -1.05, 0.9, 0)); // stickers, tassels, a plate
      lights(g, 1.0, 0.72, [0]);
      return { g, len: 2.1, speed: 3.4 + r() * 1.2, horn: 'toktok' };
    },
    // a delivery motorbike with its box on the back
    moto() {
      const g = new THREE.Group();
      wheel(g, 0.65, 0, 0.3, 0.1); wheel(g, -0.65, 0, 0.3, 0.1);
      g.add(at(rbox(1.2, 0.3, 0.3, 0.1, std('#2f3a33', { metalness: 0.4 })), 0, 0.6, 0));
      g.add(at(rbox(0.5, 0.5, 0.5, 0.06, std(r() < 0.5 ? '#e8b44a' : '#c8352f')), -0.6, 1.05, 0));
      g.add(rot(at(cyl(0.02, 0.02, 0.6, chrome, 6), 0.62, 0.9, 0), 'z', 0.3));
      const rider = buildAvatar({ body: 'person', skin: '#b98a64', hair: '#1f1612', hairStyle: 'short', outfit: '#3a4a5a', accent: '#efe0c4', accessory: 'none' });
      rider.group.position.set(0, 0.3, 0); rider.group.rotation.y = Math.PI / 2; rider.group.scale.setScalar(0.92);
      g.add(rider.group);
      lights(g, 0.85, 0.8, [0]);
      return { g, len: 1.7, speed: 5 + r(), horn: 'toktok', rider, riderH: 0.5 };
    },
    // a donkey cart piled with tomatoes, oranges and watermelons; everyone waits
    donkey() {
      const g = new THREE.Group();
      const donkeyM = std('#8f857a', { roughness: 1 });
      const d = new THREE.Group();
      d.add(at(rbox(0.9, 0.42, 0.36, 0.15, donkeyM), 0, 0.85, 0));
      d.add(rot(at(rbox(0.36, 0.3, 0.24, 0.1, donkeyM), 0.55, 1.12, 0), 'z', 0.5));
      d.add(at(rbox(0.28, 0.2, 0.2, 0.08, std('#6f675e')), 0.75, 1.0, 0));
      for (const s of [-1, 1]) d.add(rot(at(box(0.05, 0.22, 0.06, donkeyM), 0.55, 1.36, s * 0.07), 'z', -0.3));
      const legs = [];
      for (const [x, z] of [[0.33, 0.12], [0.33, -0.12], [-0.33, 0.12], [-0.33, -0.12]]) { const l = at(box(0.08, 0.66, 0.08, donkeyM), x, 0.33, z); d.add(l); legs.push(l); }
      d.position.x = 1.25;
      g.add(d);
      const wood = std('#8a5a3a', { roughness: 0.9 });
      g.add(at(box(1.6, 0.1, 1.2, wood), -0.4, 0.62, 0));
      for (const s of [-1, 1]) g.add(at(box(1.6, 0.25, 0.05, wood), -0.4, 0.78, s * 0.6));
      for (const s of [-1, 1]) g.add(at(box(1.3, 0.05, 0.05, wood), 0.75, 0.75, s * 0.32));
      wheel(g, -0.4, 0.68, 0.5, 0.08); wheel(g, -0.4, -0.68, 0.5, 0.08);
      const fruit = [['#d23a2a', 0.09], ['#ef8a2a', 0.09], ['#3f7a35', 0.2]];
      for (let i = 0; i < 26; i++) { const [c, rad] = fruit[i % 3]; g.add(at(new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), std(c, { roughness: 0.6 })), -1.05 + (i % 7) * 0.2, 0.75 + rad + Math.floor(i / 7) * 0.12, -0.42 + ((i * 37) % 9) * 0.1)); }
      const driver = buildAvatar({ body: 'person', skin: '#9a6a46', hair: '#2a1d1a', hairStyle: 'short', outfit: '#d8cfbf', accent: '#7a5236', accessory: 'scarf' });
      driver.group.position.set(0.15, 0.36, 0); driver.group.rotation.y = Math.PI / 2; driver.group.scale.setScalar(0.92);
      g.add(driver.group);
      return { g, len: 3.2, speed: 1.3, horn: null, rider: driver, riderH: 0.4, legs, hooves: true };
    },
    // the bread man on his bicycle, a tray of aish baladi balanced on his head
    bread() {
      const g = new THREE.Group();
      for (const x of [0.55, -0.55]) { const w = at(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 24), tire), x, 0.35, 0); g.add(w); }
      const frame = std('#2f4f6f', { metalness: 0.5 });
      g.add(at(box(1.1, 0.04, 0.04, frame), 0, 0.55, 0));
      g.add(at(box(0.04, 0.5, 0.04, frame), -0.15, 0.65, 0));
      const rider = buildAvatar({ body: 'person', skin: '#a8754e', hair: '#1f1612', hairStyle: 'short', outfit: '#e9e2d0', accent: '#c9a27e', accessory: 'none' });
      rider.group.position.set(-0.1, 0.42, 0); rider.group.rotation.y = Math.PI / 2; rider.group.scale.setScalar(0.92);
      g.add(rider.group);
      const tray = new THREE.Group();
      tray.add(at(rbox(1.3, 0.05, 0.7, 0.02, std('#a07a50')), 0, 0, 0));
      const loaf = std('#d9a868', { roughness: 0.9 });
      for (let i = 0; i < 18; i++) { const l = at(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 14), loaf), -0.55 + (i % 6) * 0.22, 0.04 + Math.floor(i / 6) * 0.03, -0.22 + (Math.floor(i / 6) % 3) * 0.22); l.rotation.z = (i % 2) * 0.1; tray.add(l); }
      tray.position.set(-0.1, 2.0, 0);
      g.add(tray);
      return { g, len: 1.6, speed: 2.4, horn: null, rider, riderH: 0.5, bob: tray };
    },
  };

  // ── the outer lane: clockwise round the block (the inner lane goes the other way)
  const midX = (STREET.pave.x + STREET.road.x) / 2, midZ = (STREET.pave.z + STREET.road.z) / 2;
  const LX = midX + 1.45, LZ = midZ + 1.45;
  const L = 4 * LX + 4 * LZ;
  function onLane(s) {
    s = ((s % L) + L) % L;
    const a = 2 * LX, b = 2 * LZ;
    if (s < a) return { x: LX - s, z: LZ, ry: Math.PI };
    s -= a; if (s < b) return { x: -LX, z: LZ - s, ry: Math.PI / 2 };
    s -= b; if (s < a) return { x: -LX + s, z: -LZ, ry: 0 };
    s -= a; return { x: LX, z: -LZ + s, ry: -Math.PI / 2 };
  }
  const order = ['taxi', 'donkey', 'microbus', 'toktok', 'taxi', 'oldTaxi', 'moto', 'bread', 'toktok', 'taxi'];
  const traffic = order.map((k, i) => {
    const v = VEHICLES[k]();
    scene.add(v.g);
    v.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { ...v, kind: k, s: i * L / order.length, cur: v.speed, honkIn: 4 + r() * 20, ry: 0 };
  });

  // ── stalls and stands on the far pavements (they face the road)
  const placed = (g, x, z, ry) => { g.position.set(x, 0, z); g.rotation.y = ry; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g; };
  const nearZ = STREET.road.z + 0.9, nearX = STREET.road.x + 0.9;
  const wood = std('#8a5a3a', { roughness: 0.85 });
  const smoke = [];
  const smokeTex = tex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(235,235,235,0.7)'); gr.addColorStop(1, 'rgba(235,235,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const smokeFrom = (x, y, z, n = 6) => {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.5 }));
      scene.add(s);
      smoke.push({ s, x, y, z, k: i / n });
    }
  };
  const signBoard = (lines, w, h, bg) => makeSign(lines, w, h, { bg, border: '#3a2a1e', radius: 16 });
  const glowSign = m => { m.material.emissive = new THREE.Color('#ffffff'); m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = 0; nightMats.push({ mat: m.material, max: 0.7 }); return m; };

  // the foul cart: a painted wooden cart, the big copper qidra of beans, bread, a glass case
  {
    const g = new THREE.Group();
    g.add(at(rbox(2.0, 0.9, 1.0, 0.04, std('#e8b44a', { roughness: 0.7 })), 0, 0.85, 0));
    g.add(at(box(2.0, 0.12, 1.02, std('#c8352f')), 0, 1.0, 0));
    for (const s of [-1, 1]) { const w = at(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 18), wood), 0.55 * s, 0.38, 0.55); w.rotation.x = Math.PI / 2; g.add(w); }
    const copper = std('#b8733a', { metalness: 0.7, roughness: 0.3 });
    const pot = at(new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), copper), -0.45, 1.5, 0); pot.scale.y = 1.15; g.add(pot);
    g.add(at(cyl(0.12, 0.2, 0.3, copper), -0.45, 1.95, 0));
    g.add(at(box(0.9, 0.5, 0.6, std('#dff1ff', { transparent: true, opacity: 0.35, roughness: 0.05 })), 0.45, 1.32, 0));
    for (let i = 0; i < 8; i++) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), std('#d9a868')), 0.3 + (i % 4) * 0.1, 1.1 + Math.floor(i / 4) * 0.03, 0));
    g.add(at(glowSign(signBoard([{ text: 'فول وطعمية', font: 'serif', size: 130, weight: '700', color: '#c8352f' }], 1.4, 0.36, '#fdf3e6')), 0, 2.05, 0.3));
    for (const s of [-1, 1]) g.add(at(cyl(0.025, 0.025, 1.3, wood, 6), 0.95 * s, 1.6, 0.45));
    g.add(at(box(2.1, 0.06, 1.1, std('#3f7a55', { side: THREE.DoubleSide })), 0, 2.28, 0.1)); // a little roof
    const cook = buildAvatar({ body: 'person', skin: '#a8754e', hair: '#1f1612', hairStyle: 'short', outfit: '#f1eee6', accent: '#c8352f', accessory: 'none' });
    cook.group.position.set(0.2, 0, -0.8); g.add(cook.group);
    animated.push(dt => cook.update(dt, {}));
    placed(g, -9.5, nearZ + 0.3, Math.PI);
  }
  // the sweet-potato man: a black iron oven on wheels, its chimney smoking
  {
    const g = new THREE.Group();
    const iron = std('#2a2422', { roughness: 0.6, metalness: 0.4 });
    g.add(at(rbox(1.3, 0.7, 0.8, 0.05, iron), 0, 0.95, 0));
    for (const s of [-1, 1]) { const w = at(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 18), wood), 0, 0.36, s * 0.45); w.rotation.x = Math.PI / 2; g.add(w); }
    g.add(at(cyl(0.08, 0.08, 1.4, iron), 0.45, 2.0, 0));
    const fire = std('#ff8a3a', { emissive: '#ff6a1a', emissiveIntensity: 1.2 });
    g.add(at(box(0.5, 0.25, 0.02, fire), -0.1, 0.85, 0.41));
    for (let i = 0; i < 6; i++) g.add(at(rbox(0.26, 0.09, 0.1, 0.04, std('#7a3f2a')), -0.4 + i * 0.13, 1.33, -0.1 + (i % 2) * 0.15));
    const man = buildAvatar({ body: 'person', skin: '#8a5a3a', hair: '#2a1d1a', hairStyle: 'short', outfit: '#6b5a4a', accent: '#efe0c4', accessory: 'scarf' });
    man.group.position.set(-0.4, 0, -0.75); g.add(man.group);
    animated.push(dt => man.update(dt, {}));
    placed(g, 9.5, nearZ + 0.3, Math.PI);
    smokeFrom(9.5 - 0.45 * -1, 2.75, nearZ + 0.3, 7);
    const glow = new THREE.PointLight('#ff8a3a', 0.8, 4, 2); glow.position.set(9.6, 0.9, nearZ - 0.2); scene.add(glow);
  }
  // sugarcane juice: a counter with the press, the stalks stacked against the wall
  {
    const g = new THREE.Group();
    g.add(at(rbox(1.8, 1.0, 0.7, 0.04, std('#f1eee6')), 0, 0.5, 0));
    g.add(at(box(1.8, 0.2, 0.72, std('#3f7a35')), 0, 0.9, 0));
    g.add(at(rbox(0.6, 0.6, 0.5, 0.05, std('#c8c8c8', { metalness: 0.6, roughness: 0.3 })), -0.4, 1.3, 0)); // the press
    for (let i = 0; i < 5; i++) g.add(at(cyl(0.05, 0.05, 0.14, std('#c7d36a', { transparent: true, opacity: 0.85 }), 10), 0.2 + i * 0.13, 1.07, 0.1));
    const cane = std('#8aa04a', { roughness: 0.8 });
    for (let i = 0; i < 14; i++) { const c = at(cyl(0.025, 0.025, 2.2, cane, 6), -0.85 + i * 0.12, 1.1, -0.55); c.rotation.z = 0.12 - (i % 3) * 0.04; g.add(c); }
    g.add(at(glowSign(signBoard([{ text: 'عصير قصب', font: 'serif', size: 130, weight: '700', color: '#ffffff' }], 1.5, 0.4, '#3f7a35')), 0, 2.4, -0.4));
    const man = buildAvatar({ body: 'person', skin: '#b98a64', hair: '#2a1d1a', hairStyle: 'curly', outfit: '#3f7a35', accent: '#ffffff', accessory: 'none' });
    man.group.position.set(0.3, 0, -0.75); g.add(man.group);
    animated.push(dt => man.update(dt, {}));
    placed(g, 12, -(nearZ + 0.4), 0);
  }
  // the kiosk (koshk): a little booth hung with crisps and sweets, its fridge humming
  {
    const g = new THREE.Group();
    g.add(at(rbox(1.6, 2.3, 1.4, 0.04, std('#3f6a8a', { roughness: 0.6 })), 0, 1.15, 0));
    g.add(at(box(1.3, 0.9, 0.02, std('#1a1a1a')), 0, 1.45, 0.71));
    const bags = ['#e8b44a', '#c8352f', '#3f7a35', '#d4678a', '#3f6a8a', '#efe0c4'];
    for (let i = 0; i < 16; i++) g.add(at(rbox(0.16, 0.22, 0.05, 0.03, std(bags[i % bags.length], { roughness: 0.4 })), -0.62 + (i % 8) * 0.18, 2.0 - Math.floor(i / 8) * 0.25, 0.76));
    g.add(at(rbox(0.7, 1.4, 0.6, 0.04, std('#c8352f', { roughness: 0.4 })), 1.2, 0.7, 0.1)); // the fridge
    g.add(at(box(0.55, 1.1, 0.02, std('#dff1ff', { emissive: '#e8f4ff', emissiveIntensity: 0.4, roughness: 0.05 })), 1.2, 0.75, 0.41));
    g.add(at(box(1.9, 0.08, 1.7, std('#e8b44a')), 0, 2.34, 0.1));
    const man = buildAvatar({ body: 'person', skin: '#9a6a46', hair: '#c9c2b8', hairStyle: 'short', outfit: '#7a5236', accent: '#efe0c4', accessory: 'glasses' });
    man.group.position.set(0, 0.2, 0.15); g.add(man.group);
    animated.push(dt => man.update(dt, {}));
    placed(g, nearX + 0.4, -6, -Math.PI / 2);
  }
  // the ahwa: tin tables, wooden chairs, men over tea, tawla and shisha; the tea boy
  {
    const g = new THREE.Group();
    const tin = std('#c9c2b0', { metalness: 0.4, roughness: 0.5 });
    const chairW = std('#7a5236', { roughness: 0.8 });
    const sitters = [];
    const men = [
      { skin: '#9a6a46', hair: '#c9c2b8', hairStyle: 'short', outfit: '#d8cfbf', accent: '#7a5236', accessory: 'scarf' },
      { skin: '#b98a64', hair: '#2a1d1a', hairStyle: 'short', outfit: '#3a4a5a', accent: '#efe0c4', accessory: 'glasses' },
      { skin: '#7d5236', hair: '#1f1612', hairStyle: 'curly', outfit: '#e9e2d0', accent: '#3f6a8a', accessory: 'none' },
      { skin: '#a8754e', hair: '#8a8a8a', hairStyle: 'short', outfit: '#6b5a4a', accent: '#efe0c4', accessory: 'none' },
    ];
    [[-3.2, 0], [0, 1], [3.2, 2]].forEach(([z, n]) => {
      g.add(at(cyl(0.32, 0.32, 0.03, tin, 20), 0, 0.62, z));
      g.add(at(cyl(0.03, 0.05, 0.62, tin, 8), 0, 0.31, z));
      for (const s of [-1, 1]) {
        const c = new THREE.Group();
        c.add(at(box(0.4, 0.04, 0.4, chairW), 0, 0.42, 0));
        c.add(at(box(0.4, 0.4, 0.03, chairW), 0, 0.66, -0.19));
        for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(at(box(0.03, 0.42, 0.03, chairW), a * 0.17, 0.21, b * 0.17));
        c.position.set(0, 0, z + s * 0.6); c.rotation.y = s < 0 ? 0 : Math.PI;
        g.add(c);
        const look = men[(n * 2 + (s > 0 ? 1 : 0)) % men.length];
        if (n === 2 && s > 0) continue; // an empty chair, for whoever's next
        const av = buildAvatar({ body: 'person', ...look });
        av.group.position.set(0, 0, z + s * 0.62); av.group.rotation.y = s < 0 ? 0 : Math.PI;
        g.add(av.group);
        sitters.push(av);
      }
      // tea in little glasses, and on one table a tawla board open between two players
      for (const k of [-1, 1]) g.add(at(cyl(0.025, 0.02, 0.07, std('#a34a22', { transparent: true, opacity: 0.85, roughness: 0.1 }), 10), k * 0.12, 0.67, z + k * 0.08));
      if (n === 1) {
        const board = at(box(0.5, 0.03, 0.36, std('#8a5a3a')), 0, 0.65, z);
        g.add(board);
        for (let i = 0; i < 10; i++) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10), std(i % 2 ? '#f4ece0' : '#2a1d1a')), -0.2 + (i % 5) * 0.1, 0.672, z - 0.1 + Math.floor(i / 5) * 0.2));
      }
    });
    // a shisha by the end table
    {
      const sh = new THREE.Group();
      sh.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), std('#3f7a55', { transparent: true, opacity: 0.8, roughness: 0.1 })), 0, 0.16, 0));
      sh.add(at(cyl(0.025, 0.035, 0.6, chrome, 8), 0, 0.6, 0));
      sh.add(at(cyl(0.08, 0.05, 0.1, std('#7a3f2a'), 10), 0, 0.95, 0));
      const coal = at(cyl(0.05, 0.05, 0.03, std('#ff6a1a', { emissive: '#ff4a0a', emissiveIntensity: 1 }), 8), 0, 1.01, 0);
      sh.add(coal);
      sh.position.set(0.45, 0, -2.6);
      g.add(sh);
    }
    const sign = glowSign(signBoard([{ text: 'قهوة', font: 'serif', size: 160, weight: '700', color: '#fdf3e6' }, { text: 'ahwa', font: 'Dancing Script, cursive', size: 80, color: '#f2c6d0' }], 1.4, 0.6, '#7a3f2a'));
    sign.position.set(-0.6, 2.5, 0); sign.rotation.y = -Math.PI / 2; // facing the road
    g.add(sign);
    // strings of bulbs over the tables
    const bulbM = std('#fff3c9', { emissive: '#ffd98a', emissiveIntensity: 0 });
    nightMats.push({ mat: bulbM, max: 1.6 });
    for (let i = 0; i < 18; i++) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), bulbM), -0.4, 2.45 - Math.abs(Math.sin(i * 0.5)) * 0.25, -4.2 + i * 0.5));
    placed(g, nearX + 0.5, 6, 0); // the tables run along the pavement
    animated.push(dt => { for (const av of sitters) av.update(dt, { sitting: true, sitH: 0.44 }); });
    // the tea boy, back and forth with his tray
    const boy = buildAvatar({ body: 'person', skin: '#b98a64', hair: '#1f1612', hairStyle: 'short', outfit: '#f1eee6', accent: '#3f6a8a', accessory: 'none' });
    scene.add(boy.group);
    const tray = at(cyl(0.16, 0.16, 0.02, std('#c9c2b0', { metalness: 0.5 }), 16), 0.25, 1.15, 0.2);
    boy.group.add(tray);
    let bt = 0;
    animated.push(dt => {
      bt += dt * 0.35;
      const k = (Math.sin(bt) + 1) / 2;
      const z = 6 - 4.2 + k * 8.4, prev = boy.group.position.z;
      boy.group.position.set(nearX + 1.45, 0, z);
      boy.group.rotation.y = z > prev ? 0 : Math.PI;
      boy.update(dt, { moving: true });
    });
  }
  // street cats, dozing about
  [[-8.3, nearZ + 1.1], [10.8, -(nearZ + 0.2)], [nearX + 1.6, 1.4], [-20, nearZ + 1.5]].forEach(([x, z], i) => {
    const coat = ['#d98a4a', '#2b2a2e', '#f1e3c8', '#9c7a5a'][i];
    const cat = buildAvatar({ body: 'cat', skin: coat, accent: '#fef9f5', outfit: coat }); // no jumpers on street cats
    cat.group.position.set(x, 0, z); cat.group.rotation.y = r() * Math.PI * 2;
    scene.add(cat.group);
    const sleepy = i % 2 === 0;
    animated.push(dt => cat.update(dt, { sitting: true, sitH: 0.2, asleep: sleepy }));
  });

  // ── overhead: zeena flags across the roads, electric cable, Ramadan lanterns
  const flagColors = ['#c8352f', '#e8b44a', '#3f7a35', '#3f6a8a', '#d4678a', '#f4ece0'].map(c => std(c, { roughness: 0.9, side: THREE.DoubleSide }));
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.14, 0, 0), new THREE.Vector3(0.14, 0, 0), new THREE.Vector3(0, -0.32, 0)]);
  flagGeo.computeVertexNormals();
  const cordM = new THREE.LineBasicMaterial({ color: '#2a2422' });
  const lanternGlass = std('#ffd08a', { emissive: '#ffa040', emissiveIntensity: 0, transparent: true, opacity: 0.9 });
  nightMats.push({ mat: lanternGlass, max: 1.4 });
  const lanterns = new THREE.Group();
  lanterns.visible = false;
  scene.add(lanterns);
  const sag = (a, b, drop, n = 24) => { const pts = []; for (let i = 0; i <= n; i++) { const k = i / n; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * drop, a.z + (b.z - a.z) * k)); } return pts; };
  function zeena(a, b) {
    const pts = sag(a, b, 0.9);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cordM));
    const len = a.distanceTo(b), n = Math.floor(len / 0.5);
    const dir = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
    const ry = Math.atan2(-dir.z, dir.x);
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n);
      const f = new THREE.Mesh(flagGeo, flagColors[i % flagColors.length]);
      f.position.copy(p); f.rotation.y = ry;
      scene.add(f);
      animated.push((dt, t) => { f.rotation.x = Math.sin(t * 2 + i) * 0.15; });
      if (i % 4 === 2) {
        const lg = new THREE.Group();
        lg.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 6), std('#b08a4a', { metalness: 0.6 })), 0, -0.1, 0));
        lg.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.28, 6), lanternGlass), 0, -0.3, 0));
        lg.add(rot(at(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 6), std('#b08a4a', { metalness: 0.6 })), 0, -0.48, 0), 'x', Math.PI));
        lg.position.copy(p);
        lanterns.add(lg);
      }
    }
  }
  const cafeTop = 8.6, across = 9.2;
  // across the front road, the back road and the sides, from the café's roof to the flats opposite
  for (const x of [-15, -5, 5, 15]) zeena(new THREE.Vector3(x, cafeTop, STREET.pave.z - 3.4), new THREE.Vector3(x + 1.5, across, STREET.far.z + 0.2));
  for (const x of [-3, 9]) zeena(new THREE.Vector3(x, cafeTop, -(STREET.pave.z - 3.4)), new THREE.Vector3(x - 1.5, across - 1.5, -(STREET.far.z + 0.2)));
  for (const z of [-6, 6]) { zeena(new THREE.Vector3(STREET.pave.x - 3.4, cafeTop, z), new THREE.Vector3(STREET.far.x + 0.2, across, z + 1)); zeena(new THREE.Vector3(-(STREET.pave.x - 3.4), cafeTop, z), new THREE.Vector3(-(STREET.far.x + 0.2), across, z - 1)); }
  // cables: from pole to pole along the far pavements, sagging, crossing
  const cableM = new THREE.LineBasicMaterial({ color: '#1a1614', transparent: true, opacity: 0.8 });
  for (const s of [-1, 1]) {
    for (let x = -26; x < 26; x += 8) {
      for (const dy of [0, 0.35, 0.8]) {
        const a = new THREE.Vector3(x, 6.4 + dy, s * (STREET.far.z - 0.3)), b = new THREE.Vector3(x + 8, 6.6 + dy * 0.7, s * (STREET.far.z - 0.3 - dy * 0.3));
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sag(a, b, 0.5 + dy * 0.4, 12)), cableM));
      }
    }
    // and a couple slung right across the road
    for (const x of [-20, 2, 22]) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sag(new THREE.Vector3(x, 6.8, s * (STREET.far.z - 0.3)), new THREE.Vector3(x + 3, 7.2, s * (STREET.pave.z + 2)), 1.0, 16)), cableM));
  }

  // ── more people on the far pavements: round the outside of the block
  const outerX = STREET.far.x - 0.7, outerZ = STREET.far.z - 0.75;
  const perim = 4 * outerX + 4 * outerZ;
  const onOuter = s => {
    s = ((s % perim) + perim) % perim;
    const a = 2 * outerX, b = 2 * outerZ;
    if (s < a) return { x: -outerX + s, z: outerZ, ry: Math.PI / 2 };
    s -= a; if (s < b) return { x: outerX, z: outerZ - s, ry: Math.PI };
    s -= b; if (s < a) return { x: outerX - s, z: -outerZ, ry: -Math.PI / 2 };
    s -= a; return { x: -outerX, z: -outerZ + s, ry: 0 };
  };
  const people = [
    { skin: '#c99a74', hair: '#2a1d1a', hairStyle: 'bun', outfit: '#3a2a3a', accent: '#d4678a', accessory: 'scarf' },
    { skin: '#9a6a46', hair: '#1f1612', hairStyle: 'short', outfit: '#e9e2d0', accent: '#7a5236', accessory: 'none' },
    { skin: '#e0b48c', hair: '#3b2a22', hairStyle: 'long', outfit: '#6b8fb5', accent: '#fef9f5', accessory: 'headphones' },
    { skin: '#7d5236', hair: '#2a1d1a', hairStyle: 'bun', outfit: '#2f5d3a', accent: '#e8b44a', accessory: 'scarf' },
    { skin: '#b98a64', hair: '#c9c2b8', hairStyle: 'short', outfit: '#6b5a4a', accent: '#efe0c4', accessory: 'glasses' },
    { skin: '#a8754e', hair: '#1f1612', hairStyle: 'curly', outfit: '#c8352f', accent: '#fef9f5', accessory: 'none' },
  ].map((look, i) => {
    const av = buildAvatar({ body: 'person', ...look });
    scene.add(av.group);
    return { av, s: i * perim / 6 + r() * 6, speed: (i % 2 ? -1 : 1) * (0.8 + r() * 0.4) };
  });

  // ── every frame
  function update(dt, t) {
    animated.forEach(f => f(dt, t));
    // traffic: keep a car's length behind whoever's ahead (the donkey sets the pace), and honk about it
    const sorted = [...traffic].sort((a, b) => a.s - b.s);
    sorted.forEach((v, i) => {
      const ahead = sorted[(i + 1) % sorted.length];
      const gap = (((ahead.s - v.s) % L) + L) % L - (v.len + ahead.len) / 2;
      const want = gap < 1.2 ? 0 : gap < 4 ? Math.min(v.speed, ahead.cur) : v.speed;
      v.cur += (want - v.cur) * Math.min(1, dt * 2);
      v.s += v.cur * dt;
      const p = onLane(v.s);
      v.g.position.set(p.x, 0, p.z);
      v.ry = lerpAngle(v.ry, p.ry, Math.min(1, dt * 4));
      v.g.rotation.y = v.ry;
      if (v.rider) v.rider.update(dt, { sitting: true, sitH: v.riderH });
      if (v.legs) v.legs.forEach((l, k) => { l.rotation.z = Math.sin(t * 6 + k * Math.PI / 2) * 0.35 * Math.min(1, v.cur); });
      if (v.bob) v.bob.position.y = 2.0 + Math.sin(t * 5) * 0.02;
      if (v.horn) {
        v.honkIn -= dt * (gap < 4 ? 4 : 1); // stuck behind someone: much more honking
        if (v.honkIn <= 0) { v.honkIn = 6 + r() * 22; say(v.horn, v.g.position); }
      } else if (v.hooves && Math.floor(t * 2.6) !== v.lastHoof) { v.lastHoof = Math.floor(t * 2.6); say('hoof', v.g.position); }
    });
    for (const w of people) {
      w.s += w.speed * dt;
      const p = onOuter(w.s);
      w.av.group.position.set(p.x, 0, p.z);
      w.av.group.rotation.y = lerpAngle(w.av.group.rotation.y, w.speed > 0 ? p.ry : p.ry + Math.PI, Math.min(1, dt * 5));
      w.av.update(dt, { moving: true });
    }
    for (const m of smoke) {
      m.k = (m.k + dt * 0.18) % 1;
      m.s.position.set(m.x + Math.sin(t * 0.5 + m.k * 6) * 0.25 + m.k * 0.6, m.y + m.k * 3.2, m.z);
      const sc = 0.4 + m.k * 1.6;
      m.s.scale.set(sc, sc, 1);
      m.s.material.opacity = 0.45 * (1 - m.k);
    }
  }

  life.update = update;
  life.setRamadan = on => { lanterns.visible = !!on; };
  return life;
}

// Kerbs painted in black-and-white stripes, the way Cairo paints them.
export function stripedKerb(len) {
  const t = tex(128, 16, g => { for (let i = 0; i < 2; i++) { g.fillStyle = i ? '#f1eee6' : '#1d1d1d'; g.fillRect(i * 64, 0, 64, 16); } });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(len / 1.0, 1);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}
