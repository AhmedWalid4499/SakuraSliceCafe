// Soft, rounded characters built from smooth geometry — no pixels, no
// textures to blur. Used for visitors, for the café team, and for the
// preview in the avatar creator.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeDessert, setBites } from './pastries.js';

const SEG = 32; // generous segment counts keep silhouettes round up close

// While an avatar is being built, the same colour and finish gives the same
// material, so its parts can be drawn together (see bundle() below).
let matCache = null;
const mat = (color, opts = {}) => {
  const make = () => new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.75, metalness: opts.metalness ?? 0, ...opts });
  if (!matCache) return make();
  const key = new THREE.Color(color).getHexString() + JSON.stringify(opts, (k, v) => (v && v.isColor ? v.getHexString() : v));
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
};

// Segments by size: a head stays round up close, an eye or a curl doesn't
// need two thousand triangles.
const segsFor = r => Math.max(10, Math.min(SEG, Math.round(r * 110)));

function capsule(r, len, color, m) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, Math.max(12, segsFor(r))), m || mat(color));
  mesh.castShadow = true;
  return mesh;
}

function sphere(r, color, m) {
  const n = segsFor(r);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, n, Math.max(8, Math.round(n * 0.75))), m || mat(color));
  mesh.castShadow = true;
  return mesh;
}

// Draw an avatar in a handful of pieces, not seventy: inside each moving part
// (the body, the head, an arm, an eye…), meshes that share a material become
// one mesh. Only the bigger pieces cast shadows.
function bundle(root, keep) {
  const groups = [];
  root.traverse(o => { if (!o.isMesh && o.children.length) groups.push(o); });
  for (const g of groups) {
    const byMat = new Map();
    for (const c of g.children) {
      if (!c.isMesh || c.children.length || keep.has(c) || !c.geometry.index) continue;
      const k = c.material;
      if (!byMat.has(k)) byMat.set(k, []);
      byMat.get(k).push(c);
    }
    for (const [m, list] of byMat) {
      if (list.length < 2) continue;
      const geos = list.map(c => { c.updateMatrix(); const geo = c.geometry.clone().applyMatrix4(c.matrix); for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name); return geo; });
      const merged = mergeGeometries(geos, false);
      geos.forEach(x => x.dispose());
      if (!merged) continue;
      const one = new THREE.Mesh(merged, m);
      merged.computeBoundingSphere();
      one.castShadow = merged.boundingSphere.radius > 0.07;
      one.receiveShadow = false;
      for (const c of list) { g.remove(c); c.geometry.dispose(); }
      g.add(one);
    }
  }
  root.traverse(o => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere.radius < 0.07) o.castShadow = false;
  });
}

// Soft textures, drawn once and shared: a fine knit for clothes (so they look
// like cloth, not plastic) and strands for hair (so it reads as hair, not a hat).
const sharedTex = {};
function softTex(kind) {
  if (sharedTex[kind]) return sharedTex[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  let s = kind === 'hair' ? 5 : 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  if (kind === 'knit') {
    for (let y = 0; y < 128; y += 4) for (let x = 0; x < 128; x += 4) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; g.fillRect(x + ((y / 4) % 2) * 2, y, 2, 3); }
  } else {
    for (let i = 0; i < 90; i++) {
      const x = r() * 128, w = 1 + r() * 2;
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.06 + r() * 0.12})` : `rgba(255,255,255,${0.08 + r() * 0.12})`;
      g.fillRect(x, 0, w, 128);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'hair' ? 6 : 4, kind === 'hair' ? 1 : 4);
  t.userData.shared = true; // (never disposed with an avatar)
  return (sharedTex[kind] = t);
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return c;
}

// Soft puffs for steam, and droplets for a cold glass (drawn once, shared).
let steamTex = null, dropTex = null;
function steamTexture() {
  if (steamTex) return steamTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  steamTex = new THREE.CanvasTexture(c);
  steamTex.userData.shared = true;
  return steamTex;
}
function dropTexture() {
  if (dropTex) return dropTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 140; i++) {
    const px = Math.random() * 128, py = Math.random() * 128, r = 0.6 + Math.random() * 1.8;
    x.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.5})`;
    x.beginPath(); x.ellipse(px, py, r, r * 1.3, 0, 0, Math.PI * 2); x.fill();
  }
  // a few drops that have run down the glass
  for (let i = 0; i < 6; i++) { const px = Math.random() * 128; x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(px, Math.random() * 60, 1.2, 20 + Math.random() * 40); }
  dropTex = new THREE.CanvasTexture(c);
  dropTex.wrapS = dropTex.wrapT = THREE.RepeatWrapping;
  dropTex.repeat.set(2, 1);
  dropTex.userData.shared = true;
  return dropTex;
}

// Is this drink served hot or iced? (from the menu's temp, or its name)
export function tempOf(d = {}) {
  const t = String(d.temp || '').toLowerCase();
  if (/ice|cold|chill/.test(t)) return 'iced';
  if (/warm|hot/.test(t)) return 'hot';
  return /iced|cold|smoothie|slush|float|lemonade|sparkling|soda|juice|frapp|tonic|spritz|cooler|shake/i.test(d.name || '') ? 'iced' : 'hot';
}

// A drink, held in the right hand or set on a table. `level` (0–1) is how
// full it is; g.userData.setLevel changes it as the drink goes down.
// Hot drinks come in a ceramic cup with steam rising off them; iced ones in
// a clear glass with ice, a straw, and condensation beading on the outside.
export function makeCup(drinkColor, level = 1, temp = 'hot') {
  return temp === 'iced' ? makeGlass(drinkColor, level) : makeMug(drinkColor, level);
}

function makeMug(drinkColor, level) {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.045, 0.11, SEG, 1, true),
    mat('#fffaf4', { roughness: 0.35, side: THREE.DoubleSide }));
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.045, SEG), mat('#fffaf4'));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.055;
  const drink = new THREE.Mesh(new THREE.CircleGeometry(0.052, SEG), mat(drinkColor, { roughness: 0.2 }));
  drink.rotation.x = -Math.PI / 2;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.052, 0.04, SEG, 1, true), mat('#d4678a'));
  cup.castShadow = true;
  g.add(cup, base, drink, sleeve);
  // steam: a few soft puffs drifting up and fading, animated as they're drawn
  const steam = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTexture(), transparent: true, depthWrite: false, opacity: 0, fog: false }));
    sp.userData.phase = i / 4 + Math.random() * 0.1;
    sp.userData.drift = (Math.random() - 0.5) * 0.03;
    sp.onBeforeRender = () => {
      const t = (performance.now() / 2600 + sp.userData.phase) % 1;
      sp.position.set(sp.userData.drift * t * 4 + Math.sin(t * 6 + i) * 0.008, 0.06 + t * 0.2, 0);
      const k = 0.03 + t * 0.07;
      sp.scale.set(k, k * 1.4, 1);
      sp.material.opacity = Math.sin(Math.PI * t) * 0.32 * steam.userData.strength;
    };
    puffs.push(sp);
    steam.add(sp);
  }
  steam.userData.strength = 1;
  g.add(steam);
  g.userData.setLevel = l => {
    l = Math.max(0, Math.min(1, l));
    drink.visible = l > 0.02;
    drink.position.y = -0.048 + 0.088 * l;
    drink.scale.setScalar(0.85 + 0.15 * l); // the cup narrows towards the bottom
    steam.visible = l > 0.05;
    steam.userData.strength = 0.4 + 0.6 * l;
  };
  g.userData.setLevel(level);
  return g;
}

function makeGlass(drinkColor, level) {
  const g = new THREE.Group();
  const H = 0.13, R0 = 0.042, R1 = 0.05;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R1, R0, H, SEG, 1, true),
    new THREE.MeshStandardMaterial({ color: '#eef6fb', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, 0.012, SEG), new THREE.MeshStandardMaterial({ color: '#eef6fb', roughness: 0.1, transparent: true, opacity: 0.5 }));
  base.position.y = -H / 2 + 0.006;
  // condensation, beading on the outside of a cold glass
  const wet = new THREE.Mesh(new THREE.CylinderGeometry(R1 + 0.0015, R0 + 0.0015, H * 0.82, SEG, 1, true),
    new THREE.MeshStandardMaterial({ color: '#ffffff', map: dropTexture(), transparent: true, opacity: 0.55, roughness: 0.05, depthWrite: false }));
  wet.position.y = -H * 0.06;
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(R1 - 0.004, R0 - 0.003, 1, SEG),
    new THREE.MeshStandardMaterial({ color: drinkColor, roughness: 0.15, transparent: true, opacity: 0.82 }));
  const ice = new THREE.Group();
  const iceM = new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 0.05, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.024, 0.026), iceM);
    c.position.set(Math.cos(i * 2.1) * 0.018, 0, Math.sin(i * 2.1) * 0.018);
    c.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    ice.add(c);
  }
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 10), new THREE.MeshStandardMaterial({ color: '#f2a7bb', roughness: 0.4 }));
  straw.position.set(0.015, 0.04, 0.008);
  straw.rotation.z = -0.18;
  g.add(base, liquid, ice, straw, glass, wet);
  glass.renderOrder = 2; wet.renderOrder = 3;
  g.userData.setLevel = l => {
    l = Math.max(0, Math.min(1, l));
    const h = Math.max(0.001, (H - 0.016) * l);
    liquid.visible = l > 0.02;
    liquid.scale.y = h;
    liquid.position.y = -H / 2 + 0.012 + h / 2;
    ice.position.y = -H / 2 + 0.024 + Math.max(0.006, h - 0.012);
    wet.visible = l > 0.15;
  };
  g.userData.setLevel(level);
  return g;
}

// Name tag that floats above a head. Drawn at 2x so it stays crisp.
export function makeLabel(text, opts = {}) {
  const scale = 4;
  const font = `600 ${16 * scale}px Nunito, sans-serif`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28 * scale;
  const h = 30 * scale;
  c.width = w; c.height = h;
  ctx.font = font;
  ctx.fillStyle = opts.bg || 'rgba(255,250,247,0.92)';
  const r = h / 2;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  ctx.fillStyle = opts.color || '#6b4c4c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + scale);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false }));
  const worldH = opts.height || 0.2;
  sprite.scale.set(worldH * w / h, worldH, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/**
 * avatar: { body, skin, hair, hairStyle, outfit, accent, accessory }
 * extra:  { apron, pocket, bowtie, bow, neckerchief, glasses: 'tortoise', scale }
 *
 * Storybook proportions — a gently large head on a rounded body, but not
 * chibi — faces that blink and smile, and a few details per kind: a fox's bushy tail and dark
 * paws, a rabbit's floppy ear, an owl's half-shut eyes and feathered chest.
 */
export function buildAvatar(avatar = {}, extra = {}) {
  matCache = new Map();
  try { return buildAvatarParts(avatar, extra); } finally { matCache = null; }
}

// Pyjamas (worn upstairs, if you like — app.js decides when): a soft cotton
// set in your colour with a pattern, fluffy slippers, and a nightcap if you want one.
export const PJ_PATTERNS = ['stripes', 'dots', 'stars', 'hearts', 'checks', 'plain'];
const pjTexCache = new Map();
function pjTexture(pattern, color) {
  const key = pattern + color;
  if (pjTexCache.has(key)) return pjTexCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  const ink = new THREE.Color(color).getHSL({}).l > 0.6 ? 'rgba(90,70,90,0.45)' : 'rgba(255,250,242,0.75)';
  g.fillStyle = ink; g.strokeStyle = ink;
  if (pattern === 'stripes') for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 12, 128);
  else if (pattern === 'checks') { for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 14, 128); for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 14); }
  else if (pattern === 'dots') for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.beginPath(); g.arc(16 + x * 32 + (y % 2) * 16, 16 + y * 32, 6, 0, Math.PI * 2); g.fill(); }
  else if (pattern === 'stars' || pattern === 'hearts') {
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) {
      const cx = 22 + x * 42 + (y % 2) * 21, cy = 22 + y * 42;
      g.beginPath();
      if (pattern === 'stars') for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5 : 11; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      else { g.moveTo(cx, cy + 9); g.bezierCurveTo(cx - 14, cy - 2, cx - 6, cy - 12, cx, cy - 4); g.bezierCurveTo(cx + 6, cy - 12, cx + 14, cy - 2, cx, cy + 9); }
      g.closePath(); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  pjTexCache.set(key, t);
  return t;
}

function buildAvatarParts(avatar, extra) {
  const a = {
    body: 'person', skin: '#e0b48c', hair: '#3b2a22', hairStyle: 'short',
    outfit: '#7aab7a', accent: '#fef9f5', accessory: 'none', ...avatar,
  };
  // in pyjamas: the outfit becomes the pyjama set (always trousers), the shoes slippers
  const pj = extra.pj && a.body !== 'owl' ? extra.pj : null;
  if (pj) {
    a.outfit = pj.color || '#9fb8d6';
    a.accent = '#fffaf2';
    a.bottom = 'trousers';
    if (pj.cap) a.accessory = 'nightcap';
  }
  const root = new THREE.Group();
  const rig = new THREE.Group();     // everything that bobs and turns
  root.add(rig);

  const isOwl = a.body === 'owl';
  const furry = a.body !== 'person';
  const isFox = a.body === 'fox', isCat = a.body === 'cat', isRabbit = a.body === 'rabbit';
  const she = a.gender === 'she', he = a.gender === 'he';
  const skirt = a.bottom === 'skirt' && !isOwl;
  const skinM = mat(a.skin, { roughness: furry ? 0.95 : 0.55 });
  const outfitM = pj
    ? new THREE.MeshStandardMaterial({ color: '#ffffff', map: pjTexture(pj.pattern || 'stripes', a.outfit), roughness: 0.95 })
    : furry ? mat(a.outfit, { roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: a.outfit, map: softTex('knit'), roughness: 0.9 });
  const accentM = mat(a.accent, { roughness: 0.95 });
  const darkM = mat('#2a1d1d', { roughness: 0.25 });
  const pawM = isFox ? mat('#3b2722', { roughness: 0.95 }) : skinM; // foxes wear dark "socks"
  const parts = {};
  const blinkers = [];

  const HIP = 0.56, TORSO = 0.5, SHOULDER = 0.92, HEAD = furry ? 1.39 : 1.43;

  // ── legs and shoes (or paws)
  if (!isOwl) {
    const legM = furry ? pawM : pj ? outfitM : skirt ? mat(shade(a.skin, -0.04), { roughness: 0.6 }) : mat(shade(a.outfit, -0.28), { roughness: 0.9 });
    const shoeM = furry ? pawM : pj ? mat('#fbf3ea', { roughness: 1 }) : mat('#5a3e36', { roughness: 0.5 }); // fluffy slippers
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.092 * side, HIP, 0);
      const leg = capsule(furry ? 0.078 : 0.086, furry ? 0.26 : 0.24, null, legM);
      leg.position.y = -0.19;
      const shoe = sphere(furry ? 0.1 : 0.108, null, shoeM);
      shoe.scale.set(pj ? 1.0 : 0.88, pj ? 0.66 : 0.62, pj ? 1.35 : 1.3);
      shoe.position.set(0, -0.47, 0.035);
      hip.add(leg, shoe);
      if (!furry) {
        const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.02, SEG), mat('#f3e9df', { roughness: 0.8 }));
        sole.scale.z = 1.3;
        sole.position.set(0, -0.515, 0.035);
        hip.add(sole);
      }
      rig.add(hip);
      parts[side < 0 ? 'legL' : 'legR'] = hip;
    }
  }

  // ── torso: a soft bell shape (owls: one round, feathered body)
  let torso;
  if (isOwl) {
    torso = sphere(0.42, null, skinM);
    torso.scale.set(1, 1.06, 0.95);
    torso.position.y = 0.45;
    const belly = sphere(0.31, null, accentM);
    belly.scale.set(1, 1.12, 0.5);
    belly.position.set(0, 0.4, 0.25);
    rig.add(belly);
    // feet
    const footM = mat('#e8a64a', { roughness: 0.45 });
    for (const side of [-1, 1]) for (let k = -1; k <= 1; k++) {
      const toe = capsule(0.022, 0.05, null, footM);
      toe.rotation.x = Math.PI / 2;
      toe.rotation.y = k * 0.45;
      toe.position.set(0.13 * side + k * 0.03, 0.035, 0.3);
      rig.add(toe);
    }
  } else {
    // he: a little broader across the shoulders; she: a softer waist
    const sh = he ? 1.06 : she ? 0.96 : 1, wa = she ? 0.95 : 1;
    // a soft, rounded little body — wider at the hem, round at the shoulders
    const prof = furry
      ? [[0, 0], [0.19, 0], [0.215, 0.05], [0.223 * wa, 0.16], [0.216 * wa, 0.3], [0.2 * sh, 0.4], [0.15 * sh, 0.48], [0.07, 0.52], [0, 0.53]]
      : [[0, 0], [0.215, 0], [0.24, 0.035], [0.245 * wa, 0.14], [0.236 * wa, 0.28], [0.214 * sh, 0.4], [0.17 * sh, 0.48], [0.09, 0.525], [0, 0.54]];
    const profile = prof.map(([r, y]) => new THREE.Vector2(r, y));
    torso = new THREE.Mesh(new THREE.LatheGeometry(profile, SEG), outfitM);
    torso.castShadow = true;
    torso.position.y = TORSO;
    // collar and three buttons
    const collarM = mat(furry ? a.accent : shade(a.outfit, 0.25), { roughness: 0.85 });
    if (furry) {
      for (const side of [-1, 1]) {
        const flap = new THREE.Mesh(new THREE.CircleGeometry(0.06, 3), collarM);
        flap.material.side = THREE.DoubleSide;
        flap.position.set(0.045 * side, 1.0, 0.13);
        flap.rotation.set(-0.55, 0, side * 0.5 + Math.PI);
        rig.add(flap);
      }
    } else {
      // a round, soft collar in the accent colour, and a band round the hem
      const cm = mat(pj ? '#fffaf2' : a.accent, { roughness: 0.9 });
      for (const side of [-1, 1]) {
        const c = sphere(0.075, null, cm);
        c.scale.set(1.1, 0.32, 0.85);
        c.position.set(0.06 * side, 1.015, 0.085);
        c.rotation.set(-0.35, side * 0.5, side * -0.35);
        rig.add(c);
      }
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.236, 0.016, 8, SEG * 2), mat(shade(pj ? a.outfit : a.outfit, -0.12), { roughness: 0.9 }));
      hem.rotation.x = Math.PI / 2; hem.position.y = TORSO + 0.03;
      rig.add(hem);
      if (!extra.apron && !pj) { // a little pocket
        const pocket = new THREE.Mesh(new THREE.CircleGeometry(0.042, SEG, 0, Math.PI), mat(shade(a.outfit, -0.08), { roughness: 0.9 }));
        pocket.rotation.z = Math.PI; pocket.position.set(-0.11, TORSO + 0.36, 0.2); pocket.rotation.y = -0.4;
        rig.add(pocket);
      }
    }
    if (!extra.apron) {
      for (let i = 0; i < 3; i++) {
        const b = sphere(furry ? 0.013 : 0.016, null, furry ? collarM : mat(pj ? '#fffaf2' : a.accent, { roughness: 0.6 }));
        b.position.set(0, 0.93 - i * 0.1, (furry ? 0.205 : 0.218) + (i === 2 ? 0.014 : 0));
        rig.add(b);
      }
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, SEG), skinM);
    neck.position.y = 1.06;
    rig.add(neck);
  }
  rig.add(torso);
  parts.torso = torso;

  if (skirt) {
    const sk = [[0.218, 0.13], [0.24, 0.04], [0.29, -0.14], [0.325, -0.27], [0.3, -0.285]].map(([r, y]) => new THREE.Vector2(r, y));
    const skirtMesh = new THREE.Mesh(new THREE.LatheGeometry(sk, SEG * 2), mat(shade(a.outfit, -0.1), { roughness: 0.85, side: THREE.DoubleSide }));
    skirtMesh.castShadow = true;
    skirtMesh.position.y = TORSO;
    rig.add(skirtMesh);
  }

  // Apron (the café team wear them): bib, skirt, waist tie, neck strap, a pocket.
  if (extra.apron && !isOwl) {
    const apM = mat(extra.apron, { roughness: 0.9, side: THREE.DoubleSide });
    const bib = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.229, 0.27, SEG, 1, true, -Math.PI * 0.27, Math.PI * 0.54), apM);
    bib.position.y = TORSO + 0.29;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.29, 0.4, SEG, 1, true, -Math.PI * 0.4, Math.PI * 0.8), apM);
    skirt.position.y = TORSO + 0.0;
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.018, 8, SEG * 2), mat(shade(extra.apron, -0.12)));
    tie.rotation.x = Math.PI / 2;
    tie.position.y = TORSO + 0.17;
    const knot = new THREE.Group();
    for (const side of [-1, 1]) {
      const loop = sphere(0.04, null, mat(shade(extra.apron, -0.12)));
      loop.scale.set(1.3, 0.7, 0.4);
      loop.position.x = 0.045 * side;
      knot.add(loop);
    }
    knot.position.set(0, TORSO + 0.17, -0.23);
    for (const side of [-1, 1]) {
      const strap = capsule(0.012, 0.2, null, mat(extra.apron));
      strap.position.set(0.085 * side, TORSO + 0.5, 0.06);
      strap.rotation.set(-0.5, 0, -0.18 * side);
      rig.add(strap);
    }
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.012), mat(shade(extra.apron, -0.06)));
    pocket.position.set(0.07, TORSO - 0.04, 0.262);
    pocket.rotation.x = 0.13;
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.022, SEG), mat('#f2a7bb', { roughness: 0.6 }));
    badge.position.set(-0.07, TORSO + 0.33, 0.226);
    badge.rotation.x = -0.12;
    rig.add(bib, skirt, tie, knot, pocket, badge);
    if (extra.pocket === 'pencil') {
      const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 10), mat('#e8b44a'));
      pencil.position.set(0.1, TORSO + 0.0, 0.268);
      pencil.rotation.z = 0.15;
      rig.add(pencil);
    }
  }
  if (extra.neckerchief && !isOwl) {
    const nm = mat(extra.neckerchief, { roughness: 0.9 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.025, 10, SEG), nm);
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.03;
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 3), nm);
    tri.rotation.set(Math.PI + 0.35, 0, 0);
    tri.position.set(0, 0.97, 0.1);
    rig.add(band, tri);
  }

  // ── arms: sleeves with cuffs, mitten hands with a thumb (owls: layered wings)
  const handM = furry ? pawM : skinM;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    if (isOwl) {
      shoulder.position.set(0.39 * side, 0.58, 0);
      for (let k = 0; k < 3; k++) {
        const wing = sphere(0.2 - k * 0.035, null, mat(shade(a.skin, -0.06 - k * 0.05), { roughness: 0.95 }));
        wing.scale.set(0.32, 1, 0.75);
        wing.position.set(0.01 * side * k, -0.12 - k * 0.07, -0.02 * k);
        wing.rotation.z = 0.2 * side;
        shoulder.add(wing);
      }
    } else {
      shoulder.position.set(0.235 * side, SHOULDER, 0);
      const arm = capsule(furry ? 0.064 : 0.072, furry ? 0.25 : 0.22, null, outfitM);
      arm.position.y = -0.16;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(furry ? 0.06 : 0.068, 0.017, 8, SEG), mat(furry ? a.accent : pj ? '#fffaf2' : shade(a.outfit, -0.12)));
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.31;
      const hand = sphere(furry ? 0.064 : 0.068, null, handM);
      hand.scale.set(1, 1.05, 0.9);
      hand.position.y = -0.395;
      const thumb = sphere(0.027, null, handM);
      thumb.position.set(-0.038 * side, -0.365, 0.045);
      shoulder.add(arm, cuff, hand, thumb);
      shoulder.rotation.z = 0.09 * side;
    }
    rig.add(shoulder);
    parts[side < 0 ? 'armL' : 'armR'] = shoulder;
  }

  // ── head
  const head = new THREE.Group();
  head.position.y = isOwl ? 0.97 : HEAD;
  rig.add(head);
  parts.head = head;
  if (!isOwl) head.scale.setScalar(furry ? 1.12 : 1.3); // big and friendly, like a storybook (people a little bigger still)

  const headR = isOwl ? 0.3 : 0.25;
  const skull = sphere(headR, null, skinM);
  skull.scale.set(furry ? 1 : 1.04, isFox ? 0.94 : furry ? 0.96 : 0.95, isOwl ? 0.95 : 0.96);
  head.add(skull);

  // muzzle / snout / face disc
  if (isFox || isCat) {
    const muzzle = sphere(0.12, null, accentM);
    muzzle.scale.set(1, 0.72, isFox ? 1.4 : 0.85);
    muzzle.position.set(0, -0.08, isFox ? 0.2 : 0.18);
    const nose = sphere(0.03, null, darkM);
    nose.scale.set(1.2, 0.85, 1);
    nose.position.set(0, -0.045, isFox ? 0.365 : 0.285);
    head.add(muzzle, nose);
    // cheek fluff
    for (const side of [-1, 1]) {
      const fluff = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, SEG), accentM);
      fluff.scale.z = 0.6;
      fluff.rotation.z = (Math.PI / 2 + 0.7) * side;
      fluff.position.set(0.21 * side, -0.11, 0.07);
      head.add(fluff);
    }
    if (isCat) {
      const wM = mat('#fffaf4', { roughness: 0.5 });
      for (const side of [-1, 1]) for (const k of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.17, 6), wM);
        w.rotation.z = Math.PI / 2 + k * 0.15 * side;
        w.position.set(0.14 * side, -0.07 + k * 0.012, 0.25);
        head.add(w);
      }
    }
  } else if (isRabbit) {
    for (const side of [-1, 1]) {
      const cheek = sphere(0.065, null, accentM);
      cheek.scale.set(1, 0.8, 0.7);
      cheek.position.set(0.04 * side, -0.085, 0.205);
      head.add(cheek);
    }
    const nose = sphere(0.024, null, mat('#e89aaa'));
    nose.scale.set(1.3, 0.8, 0.8);
    nose.position.set(0, -0.045, 0.252);
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), mat('#ffffff', { roughness: 0.3 }));
    teeth.position.set(0, -0.135, 0.235);
    head.add(nose, teeth);
  } else if (isOwl) {
    for (const side of [-1, 1]) {
      const disc = sphere(0.14, null, accentM);
      disc.scale.set(1, 1, 0.35);
      disc.position.set(0.085 * side, 0.02, 0.23);
      head.add(disc);
    }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, SEG), mat('#e8a64a', { roughness: 0.4 }));
    beak.rotation.x = Math.PI / 2 + 0.45;
    beak.position.set(0, -0.07, 0.31);
    head.add(beak);
  } else {
    const nose = sphere(0.016, null, mat(shade(a.skin, -0.05), { roughness: 0.55 }));
    nose.scale.set(1.2, 0.8, 0.8);
    nose.position.set(0, -0.045, 0.24);
    head.add(nose);
    for (const side of [-1, 1]) {
      const ear = sphere(0.042, null, skinM);
      ear.scale.set(0.45, 0.9, 0.75);
      ear.position.set(0.256 * side, -0.02, 0);
      head.add(ear);
    }
  }

  // eyes: glossy dark ovals with two catch-lights; they blink
  const person = !furry;
  const eyeY = isOwl ? 0.035 : person ? -0.012 : 0.005;
  const eyeX = isOwl ? 0.09 : person ? 0.092 : 0.09;
  const eyeZ = isOwl ? 0.285 : person ? 0.218 : 0.214;
  const irisM = mat(a.eyes || (person ? '#6b4532' : '#3a2a22'), { roughness: 0.25 });
  const shineM = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(eyeX * side, eyeY, eyeZ);
    eye.rotation.y = side * (isOwl ? 0.32 : 0.4);
    if (person) {
      // a big glossy eye: dark outline, a warm iris, two catch-lights, a lash line over the top
      const ball = sphere(0.043, null, darkM);
      ball.scale.set(0.82, 1.12, 0.42);
      const iris = sphere(0.031, null, irisM);
      iris.scale.set(0.82, 1.0, 0.42);
      iris.position.set(0, -0.008, 0.006);
      const big = sphere(0.012, null, shineM);
      big.position.set(0.011, 0.017, 0.017);
      const small = sphere(0.0055, null, shineM);
      small.position.set(-0.01, -0.019, 0.016);
      const lash = new THREE.Mesh(new THREE.TorusGeometry(0.037, she ? 0.0075 : 0.0055, 6, 20, Math.PI), darkM);
      lash.scale.set(0.95, 1.2, 1); lash.position.set(0, 0.002, 0.006);
      eye.add(ball, iris, big, small, lash);
    } else {
      const ball = sphere(isOwl ? 0.058 : 0.03, null, darkM);
      ball.scale.set(1, isOwl ? 1 : 1.15, 0.55);
      const big = sphere(isOwl ? 0.016 : 0.0075, null, shineM);
      big.position.set(isOwl ? 0.012 : 0.009, isOwl ? 0.02 : 0.013, isOwl ? 0.022 : 0.016);
      const small = sphere(isOwl ? 0.008 : 0.0035, null, shineM);
      small.position.set(-0.008, -0.011, isOwl ? 0.022 : 0.016);
      eye.add(ball, big, small);
    }
    if (isOwl) {
      // Me3temed's soft, half-open eyes: a lid over the top half
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.062, SEG, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(shade(a.accent, -0.12), { roughness: 0.9 }));
      lid.scale.z = 0.62;
      lid.rotation.x = 0.6;
      eye.add(lid);
      const iris = sphere(0.064, null, mat('#e8b84a', { roughness: 0.3 }));
      iris.scale.z = 0.4;
      iris.position.z = -0.012;
      eye.add(iris);
    }
    if (she && !isOwl) {
      // lashes, flicking out at the corner
      for (const [x, y, r] of person ? [[0.034, 0.03, -1.0], [0.026, 0.04, -0.6]] : [[0.022, 0.027, -0.85], [0.013, 0.034, -0.45]]) {
        const lash = capsule(0.0035, 0.014, null, darkM);
        lash.position.set(x * side, y, 0.014);
        lash.rotation.z = r * side;
        eye.add(lash);
      }
    }
    head.add(eye);
    blinkers.push(eye);
    if (!isOwl) {
      // brows
      const browM = mat(furry ? shade(a.skin, -0.3) : shade(a.hair, -0.05), { roughness: 0.6 });
      const brow = person
        ? new THREE.Mesh(new THREE.TorusGeometry(0.032, he ? 0.009 : 0.0065, 6, 14, Math.PI * 0.6), browM)
        : capsule(he ? 0.011 : 0.008, 0.035, null, browM);
      if (person) { brow.rotation.z = Math.PI * 0.2; brow.position.set(eyeX * side, eyeY + 0.068, eyeZ + 0.004); brow.rotation.y = side * 0.4; }
      else { brow.rotation.z = Math.PI / 2 + 0.18 * side; brow.position.set(eyeX * side, eyeY + 0.062, eyeZ + 0.01); brow.rotation.y = side * 0.4; }
      head.add(brow);
    }
    const blush = new THREE.Mesh(new THREE.CircleGeometry(person ? 0.038 : 0.034, SEG),
      new THREE.MeshBasicMaterial({ color: '#f09aa8', transparent: true, opacity: furry ? 0.18 : 0.38, depthWrite: false }));
    blush.scale.y = person ? 0.7 : 1;
    blush.position.set((eyeX + (person ? 0.05 : 0.065)) * side, eyeY - (person ? 0.06 : 0.07), eyeZ - (person ? 0.02 : 0.035));
    blush.lookAt(blush.position.clone().multiplyScalar(3));
    head.add(blush);
  }
  // a small smile
  if (!isOwl) {
    const smile = new THREE.Mesh(new THREE.TorusGeometry(person ? 0.024 : 0.02, person ? 0.0055 : 0.0045, 8, 18, Math.PI), mat(she ? '#b0566a' : '#8a4a46', { roughness: 0.5 }));
    smile.rotation.z = Math.PI;
    const mz = isFox ? 0.33 : isCat ? 0.27 : isRabbit ? 0.237 : 0.226;
    smile.position.set(0, isFox ? -0.115 : isRabbit ? -0.105 : -0.095, mz);
    smile.rotation.x = isFox ? -0.25 : -0.15;
    head.add(smile);
  }

  // ears
  if (isFox || isCat) {
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(0.14 * side, 0.2, -0.01);
      ear.rotation.z = -0.32 * side;
      const outer = new THREE.Mesh(new THREE.ConeGeometry(isFox ? 0.095 : 0.08, isFox ? 0.24 : 0.16, SEG), skinM);
      outer.scale.z = 0.55;
      outer.position.y = isFox ? 0.08 : 0.05;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(isFox ? 0.06 : 0.05, isFox ? 0.16 : 0.11, SEG), isFox ? accentM : mat('#f2a7bb'));
      inner.scale.z = 0.4;
      inner.position.set(0, isFox ? 0.06 : 0.04, 0.025);
      ear.add(outer, inner);
      if (isFox) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.07, SEG), pawM);
        tip.scale.z = 0.6;
        tip.position.y = 0.175;
        ear.add(tip);
      }
      outer.castShadow = true;
      head.add(ear);
      parts[side < 0 ? 'earL' : 'earR'] = ear;
    }
  } else if (isRabbit) {
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(0.085 * side, 0.2, -0.02);
      const outer = capsule(0.06, 0.3, null, skinM);
      outer.scale.z = 0.55;
      outer.position.y = 0.19;
      const inner = capsule(0.034, 0.24, null, mat('#f6c6d2'));
      inner.scale.z = 0.35;
      inner.position.set(0, 0.19, 0.03);
      ear.add(outer, inner);
      // one ear always flops a little
      ear.rotation.z = side < 0 ? 0.12 : -0.55;
      ear.userData.rest = ear.rotation.z;
      head.add(ear);
      parts[side < 0 ? 'earL' : 'earR'] = ear;
    }
  } else if (isOwl) {
    for (const side of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.15, SEG), skinM);
      tuft.scale.z = 0.6;
      tuft.position.set(0.19 * side, 0.25, 0);
      tuft.rotation.z = -0.55 * side;
      head.add(tuft);
    }
    const crown = sphere(0.12, null, mat(shade(a.skin, -0.06), { roughness: 0.95 }));
    crown.scale.set(1.6, 0.5, 1);
    crown.position.set(0, 0.24, -0.04);
    head.add(crown);
  }

  // tails
  if (isFox) {
    // a big bushy tail with a cream tip, curling up
    const tail = new THREE.Group();
    tail.position.set(0, 0.62, -0.2);
    const tailM = skinM;
    const bits = [[0, 0, 0, 0.09], [0, 0.07, -0.1, 0.12], [0, 0.17, -0.18, 0.14], [0, 0.29, -0.21, 0.13], [0, 0.4, -0.19, 0.1]];
    bits.forEach(([x, y, z, r], i) => {
      const b = sphere(r, null, i === bits.length - 1 ? accentM : tailM);
      b.scale.set(0.9, 1.1, 1);
      b.position.set(x, y, z);
      tail.add(b);
    });
    rig.add(tail);
    parts.tail = tail;
  } else if (isCat) {
    const tail = new THREE.Group();
    tail.position.set(0, 0.62, -0.2);
    const t = capsule(0.035, 0.42, null, skinM);
    t.position.set(0, 0.18, -0.12);
    t.rotation.x = -0.6;
    const tip = sphere(0.04, null, skinM);
    tip.position.set(0, 0.38, -0.25);
    tail.add(t, tip);
    rig.add(tail);
    parts.tail = tail;
  } else if (isRabbit) {
    const puff = sphere(0.1, null, accentM);
    puff.position.set(0, 0.6, -0.22);
    rig.add(puff);
  }

  // hair (people only) — sculpted, smooth volumes that hug the head: a cap
  // that follows the skull, a soft scalloped fringe, and the style's shape.
  if (a.body === 'person' && a.hairStyle !== 'none') {
    const hairM = new THREE.MeshStandardMaterial({ color: a.hair, map: softTex('hair'), roughness: 0.5 });
    const R0 = 0.27;
    // a piece of a sphere round the head: phi runs round (π/2 is the face), theta down from the crown
    const shell = (r, phi0, phiLen, th0, thLen, m = hairM) => {
      const g = new THREE.Mesh(new THREE.SphereGeometry(r, SEG * 2, SEG, phi0, phiLen, th0, thLen), m);
      g.material.side = THREE.DoubleSide;
      g.scale.set(1.05, 0.97, 1.0);
      g.castShadow = true;
      head.add(g);
      return g;
    };
    // a soft lock sitting on the head's surface at (phi, theta), pointing down it
    const lock = (phi, th, w, len, r = R0 + 0.004) => {
      const l = sphere(0.06, null, hairM);
      l.scale.set(w, len, 0.42);
      // lie flat on the head: thin across its normal, long down the surface
      const n = new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
      const down = new THREE.Vector3(Math.cos(phi) * Math.cos(th), Math.sin(th), -Math.sin(phi) * Math.cos(th));
      const x = new THREE.Vector3().crossVectors(down, n);
      l.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, down, n));
      l.position.copy(n).multiplyScalar(r).multiply(new THREE.Vector3(1.05, 0.97, 1));
      head.add(l);
      return l;
    };
    const FACE = Math.PI / 2;
    // the fringe: a smooth band over the forehead, its edge softly scalloped
    const fringe = (n, spread, th, len, sweep = 0) => {
      shell(R0 + 0.004, FACE - spread / 2 - 0.15 + sweep, spread + 0.3, Math.PI * 0.2, th - Math.PI * 0.2 - 0.06);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        lock(FACE + t * spread + sweep, th - Math.abs(t) * 0.12, 1.25 * spread / n * 2.4, len * 0.7);
      }
    };
    // the cap: all round the back and sides, down to the hairline at the front
    shell(R0, 0, Math.PI * 2, 0, Math.PI * 0.36);                   // crown, all round
    shell(R0, FACE + 0.62, Math.PI * 2 - 1.24, Math.PI * 0.3, Math.PI * 0.26); // back and sides, clear of the face
    if (a.hairStyle === 'short') {
      fringe(5, 1.3, 0.95, 1.35, -0.12);
      for (const side of [-1, 1]) lock(FACE + side * 1.2, 1.45, 0.9, 1.0); // neat sideburns
      const tuft = sphere(0.12, null, hairM); tuft.scale.set(1.3, 0.5, 1.2); tuft.position.set(0.02, 0.235, 0.03); head.add(tuft);
    } else if (a.hairStyle === 'long') {
      fringe(4, 1.1, 0.95, 1.4);
      // a smooth curtain down the back and over the shoulders
      // (a cylinder's angle 0 faces forward: leave the face open)
      const curtain = new THREE.Mesh(new THREE.CylinderGeometry(R0 * 1.02, R0 * 1.12, 0.42, SEG * 2, 1, true, 0.9, Math.PI * 2 - 1.8), hairM);
      curtain.material.side = THREE.DoubleSide;
      curtain.position.set(0, -0.16, -0.01);
      curtain.scale.set(1.05, 1, 0.95);
      head.add(curtain);
      // (a torus starts at +x; turned, its angle π/2 faces forward)
      const end = new THREE.Mesh(new THREE.TorusGeometry(R0 * 1.1, 0.035, 8, SEG * 2, Math.PI * 2 - 1.8), hairM);
      end.rotation.set(Math.PI / 2, 0, FACE + 0.9);
      end.position.y = -0.37; end.scale.set(1.05, 1, 0.95);
      head.add(end);
      for (const side of [-1, 1]) { const f = capsule(0.05, 0.3, null, hairM); f.scale.z = 0.6; f.position.set(0.24 * side, -0.14, 0.07); f.rotation.z = 0.06 * side; head.add(f); }
    } else if (a.hairStyle === 'bun') {
      fringe(4, 1.0, 0.95, 1.2, 0.1);
      const bun = sphere(0.105, null, hairM);
      bun.position.set(0, 0.25, -0.13);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, SEG), mat(a.accent === '#fef9f5' ? '#d4678a' : a.accent));
      tie.position.set(0, 0.2, -0.1); tie.rotation.x = -0.9;
      head.add(bun, tie);
    } else if (a.hairStyle === 'curly') {
      // soft round curls all over, clear of the face
      for (let ring = 0; ring < 3; ring++) {
        const th = 0.35 + ring * 0.45, n = 8 + ring * 3;
        for (let i = 0; i < n; i++) {
          const phi = (i / n) * Math.PI * 2 + ring * 0.3;
          const d = Math.abs(((phi - FACE + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (ring > 0 && d < 0.75) continue;
          const c = sphere(ring === 2 ? 0.07 : 0.08, null, hairM);
          c.position.set(-Math.cos(phi) * Math.sin(th) * (R0 + 0.02) * 1.05, Math.cos(th) * (R0 + 0.02), Math.sin(phi) * Math.sin(th) * (R0 + 0.02));
          head.add(c);
        }
      }
      fringe(4, 1.0, 0.85, 0.9);
    } else if (a.hairStyle === 'bob') {
      // a rounded bob: full at the sides, cut straight above the shoulders, with straight bangs
      shell(R0 + 0.02, FACE + 0.7, Math.PI * 2 - 1.4, Math.PI * 0.2, Math.PI * 0.5);
      // the ends, curled softly under, right at the bottom of the bob
      const flick = new THREE.Mesh(new THREE.TorusGeometry((R0 + 0.02) * 0.79, 0.028, 8, SEG * 2, Math.PI * 2 - 1.4), hairM);
      flick.rotation.set(Math.PI / 2, 0, FACE + 0.7);
      flick.position.y = -0.16; flick.scale.set(1.05, 1, 1);
      head.add(flick);
      fringe(6, 1.25, 0.88, 1.0);
    }
  }

  // accessories
  const acc = a.accessory;
  if (acc === 'glasses' || extra.glasses) {
    const frameM = mat(extra.glasses === 'tortoise' ? '#6b3e1f' : '#3a2a26', { roughness: 0.35 });
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.009, 10, SEG), frameM);
      rim.position.set(0.09 * side, 0.01, 0.238);
      rim.rotation.y = side * 0.25;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), frameM);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(0.15 * side, 0.02, 0.13);
      arm.rotation.z = side * 0.12;
      head.add(rim, arm);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 12, Math.PI), frameM);
    bridge.position.set(0, 0.025, 0.25);
    head.add(bridge);
  }
  if (acc === 'beanie') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.278, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(a.accent, { roughness: 1 }));
    b.position.y = 0.05;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 10, SEG * 2), mat(shade(a.accent, -0.08), { roughness: 1 }));
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 0.06;
    const pom = sphere(0.065, null, mat(a.accent, { roughness: 1 }));
    pom.position.y = 0.34;
    head.add(b, rib, pom);
  }
  if (acc === 'nightcap') {
    // a long soft cap that flops over to one side, with a pompom on the end
    const cm = mat(a.outfit, { roughness: 1 });
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 10, SEG * 2), mat('#fffaf2', { roughness: 1 }));
    brim.rotation.x = Math.PI / 2; brim.position.y = 0.07;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.55, SEG), cm);
    cap.position.set(0.09, 0.3, -0.04); cap.rotation.z = -0.75;
    const pom = sphere(0.06, null, mat('#fffaf2', { roughness: 1 }));
    pom.position.set(0.34, 0.33, -0.06);
    head.add(brim, cap, pom);
  }
  if (acc === 'flower') {
    const f = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const p = sphere(0.035, null, mat('#f2a7bb', { roughness: 0.8 }));
      p.scale.set(1, 0.4, 1.4);
      p.position.set(Math.cos(i * 1.256) * 0.04, 0, Math.sin(i * 1.256) * 0.04);
      p.rotation.y = -i * 1.256;
      f.add(p);
    }
    const mid = sphere(0.022, null, mat('#f6d365'));
    f.add(mid);
    f.position.set(0.17, 0.18, 0.08);
    f.rotation.set(0.3, 0, -0.8);
    head.add(f);
  }
  if (acc === 'headphones') {
    const hm = mat(a.accent === '#fef9f5' ? '#d4678a' : a.accent, { roughness: 0.4 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 10, SEG, Math.PI), hm);
    band.position.y = 0.02;
    head.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.055, SEG), hm);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(0.27 * side, 0, 0);
      const pad = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 8, SEG), mat('#3a2a26', { roughness: 0.8 }));
      pad.rotation.y = Math.PI / 2;
      pad.position.set(0.245 * side, 0, 0);
      head.add(cup, pad);
    }
  }
  if (acc === 'scarf') {
    const sm = mat(a.accent === '#fef9f5' ? '#d4678a' : a.accent, { roughness: 1 });
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 14, SEG), sm);
    s.rotation.x = Math.PI / 2;
    s.position.y = isOwl ? 0.75 : 1.03;
    const tail = capsule(0.045, 0.16, null, sm);
    tail.position.set(0.08, isOwl ? 0.62 : 0.9, isOwl ? 0.36 : 0.17);
    tail.rotation.z = 0.15;
    rig.add(s, tail);
  }
  if (extra.bow) {
    // a little ribbon (Yuki wears one on her standing ear)
    const bm = mat(extra.bow, { roughness: 0.6 });
    const bow = new THREE.Group();
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, SEG), bm);
      w.rotation.z = (Math.PI / 2) * side;
      w.position.x = 0.04 * side;
      bow.add(w);
    }
    bow.add(sphere(0.02, null, bm));
    if (parts.earL) { bow.position.set(0, 0.06, 0.04); parts.earL.add(bow); } else { bow.position.set(0.15, 0.2, 0.08); head.add(bow); }
  }
  if (extra.bowtie) {
    const bm = mat(extra.bowtie, { roughness: 0.6 });
    const bow = new THREE.Group();
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.11, SEG), bm);
      w.rotation.z = (Math.PI / 2) * side;
      w.position.x = 0.055 * side;
      w.scale.z = 0.6;
      bow.add(w);
    }
    bow.add(sphere(0.028, null, bm));
    bow.position.set(0, isOwl ? 0.72 : 1.02, isOwl ? 0.37 : 0.15);
    rig.add(bow);
  }

  root.scale.setScalar(extra.scale || 1);
  bundle(root, new Set([torso]));

  // ── a drink in the right hand
  let cup = null, cupColor = null;
  function setDrink(color, level = 1, temp = 'hot') {
    const key = color && color + temp;
    if (cup && color && key === cupColor) { cup.userData.setLevel(level); return; }
    if (cup) { cup.parent.remove(cup); disposeTree(cup); cup = null; cupColor = null; }
    if (!color || isOwl) return;
    cup = makeCup(color, level, temp);
    cupColor = key;
    cup.position.set(0, -0.44, 0.08);
    parts.armR.add(cup);
  }

  // ── a pastry on a plate, held in the left hand
  let plate = null, plateShape = null;
  function setDessert(shape, bites = 0) {
    if (!shape || isOwl) {
      if (plate) { plate.parent.remove(plate); disposeTree(plate); plate = null; plateShape = null; }
      return;
    }
    if (plate && plateShape === shape) { setBites(plate, bites); return; }
    if (plate) { plate.parent.remove(plate); disposeTree(plate); }
    plate = makeDessert(shape, bites);
    plateShape = shape;
    plate.position.set(0, -0.47, 0.1);
    plate.scale.setScalar(1.1);
    parts.armL.add(plate);
  }

  // ── animation
  let t = Math.random() * 10;
  let walkPhase = 0;
  let sitBlend = 0;
  let nextBlink = 1 + Math.random() * 3;
  // a sip or a bite: the hand comes up to the mouth and back (about a second)
  let gesture = null, gestureT = 0;
  function play(kind) { if (!isOwl) { gesture = kind; gestureT = 0; } }
  let sitDrop = 0.13;

  // Asleep: little Zzz drift up from the head, one after another, and fade.
  // They're made the first time someone falls asleep, and kept upright
  // whichever way the head is lying.
  let zzz = null, zzzShow = 0;
  const zq = new THREE.Quaternion();
  function makeZzz() {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.font = '800 104px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 14; x.strokeStyle = '#fffaf2'; x.strokeText('Z', 64, 70);
    x.fillStyle = '#8f8bd6'; x.fillText('Z', 64, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, fog: false }));
      sp.userData.phase = i / 3;
      sp.renderOrder = 11;
      g.add(sp);
    }
    head.add(g);
    return g;
  }
  function updateZzz(dt, asleep) {
    zzzShow += ((asleep ? 1 : 0) - zzzShow) * Math.min(1, dt * 2);
    if (!zzz) { if (!asleep) return; zzz = makeZzz(); }
    zzz.visible = zzzShow > 0.02;
    if (!zzz.visible) return;
    // keep the little column of Zs pointing up in the world, not along the pillow
    head.getWorldQuaternion(zq);
    zzz.quaternion.copy(zq).invert();
    for (const sp of zzz.children) {
      const k = (t * 0.32 + sp.userData.phase) % 1; // 0 → 1 as each one rises
      sp.position.set(0.12 + k * 0.16 + Math.sin(k * 6 + sp.userData.phase * 9) * 0.02, 0.2 + k * 0.42, 0);
      const size = 0.07 + k * 0.11;
      sp.scale.set(size, size, 1);
      sp.material.opacity = Math.sin(Math.PI * k) * 0.95 * zzzShow;
      sp.material.rotation = -0.25 + Math.sin(k * 4) * 0.12;
    }
  }
  // sitH: how high the seat's cushion is, so you sit on it rather than in it
  // asleep: eyes closed, very still. typing: hands forward on a keyboard.
  function update(dt, { moving = false, sitting = false, sitH = 0.54, waving = 0, asleep = false, typing = false } = {}) {
    t += dt;
    sitBlend += ((sitting ? 1 : 0) - sitBlend) * Math.min(1, dt * 8);
    if (sitting) sitDrop = 0.48 - sitH;
    if (moving) walkPhase += dt * 9;
    const swing = moving ? Math.sin(walkPhase) * 0.55 : 0;

    const breathe = asleep ? Math.sin(t * 0.9) * 0.018 : Math.sin(t * 1.6) * 0.012;
    rig.position.y = breathe + (moving ? Math.abs(Math.sin(walkPhase)) * 0.04 : 0) - sitBlend * sitDrop;
    head.rotation.y = moving || asleep || typing ? 0 : Math.sin(t * 0.35) * 0.25;
    head.rotation.z = asleep ? 0 : Math.sin(t * 0.5) * 0.04;
    if (!gesture) head.rotation.x = typing ? 0.22 : 0; // looking down at the screen

    // blink every few seconds (Me3temed blinks slowly, on purpose)
    nextBlink -= dt;
    const blinkLen = isOwl ? 0.45 : 0.14;
    const closed = nextBlink < 0 && nextBlink > -blinkLen;
    const lid = asleep ? 0.07 : closed ? Math.max(0.08, Math.abs(Math.cos((-nextBlink / blinkLen) * Math.PI))) : 1;
    for (const e of blinkers) e.scale.y = lid;
    if (nextBlink < -blinkLen) nextBlink = 2 + Math.random() * 4;
    updateZzz(dt, asleep);

    if (parts.legL) {
      parts.legL.rotation.x = swing * (1 - sitBlend) - sitBlend * 1.45;
      parts.legR.rotation.x = -swing * (1 - sitBlend) - sitBlend * 1.45;
    }
    if (parts.armL) {
      if (isOwl) {
        const flap = waving > 0 ? Math.sin(t * 14) * 0.5 : 0;
        parts.armL.rotation.z = -0.1 - flap;
        parts.armR.rotation.z = 0.1 + flap;
      } else {
        parts.armL.rotation.x = plate ? -0.95 : -swing * 0.8 - sitBlend * 0.5;
        const holding = cup ? -0.9 : 0;
        parts.armR.rotation.x = waving > 0 ? 0 : swing * 0.8 + holding - sitBlend * (cup ? 0 : 0.5);
        parts.armR.rotation.z = waving > 0 ? 2.6 + Math.sin(t * 12) * 0.3 : -0.09;
        if (typing && waving <= 0) {
          // both hands out on the keys, fingers going
          parts.armL.rotation.x = -1.2 + Math.sin(t * 15) * 0.06;
          parts.armL.rotation.z = 0.28;
          if (!cup) { parts.armR.rotation.x = -1.2 + Math.sin(t * 15 + 1.7) * 0.06; parts.armR.rotation.z = -0.28; }
        } else parts.armL.rotation.z = 0;
      }
    }
    if (gesture) {
      gestureT += dt / 1.1;
      const k = Math.sin(Math.min(1, gestureT) * Math.PI); // up, then down
      if (gesture === 'sip' && parts.armR) {
        parts.armR.rotation.x = parts.armR.rotation.x * (1 - k) - 2.25 * k;
        parts.armR.rotation.z = -0.09 + 0.45 * k;
        if (cup) cup.rotation.x = 0.9 * k;
      } else if (gesture === 'bite' && parts.armL) {
        parts.armL.rotation.x = parts.armL.rotation.x * (1 - k) - 1.75 * k;
        parts.armL.rotation.z = -0.45 * k;
      }
      head.rotation.x = 0.12 * k;
      if (gestureT >= 1) { gesture = null; head.rotation.x = 0; if (cup) cup.rotation.x = 0; }
    }
    if (plate) plate.rotation.x = -parts.armL.rotation.x; // keep the plate level
    if (parts.tail) {
      parts.tail.rotation.y = Math.sin(t * 2.2) * (moving ? 0.5 : 0.3);
      parts.tail.rotation.x = -0.15 + Math.sin(t * 1.3) * 0.06;
    }
    if (parts.earL) {
      const restL = parts.earL.userData.rest ?? parts.earL.rotation.z;
      const restR = parts.earR.userData.rest ?? parts.earR.rotation.z;
      parts.earL.userData.rest = restL; parts.earR.userData.rest = restR;
      parts.earL.rotation.z = restL + Math.sin(t * 0.9) * 0.05;
      parts.earR.rotation.z = restR + Math.sin(t * 0.9 + 1) * 0.05;
    }
  }

  const height = (isOwl ? 1.35 : 1.86) * (extra.scale || 1);
  return { group: root, parts, setDrink, setDessert, update, height, play };
}

export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { if (m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); });
    }
  });
}
