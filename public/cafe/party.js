// The Party Hall: on the fourth floor, off its landing. Book it for a
// birthday, a wedding, a graduation, Eid, a baby shower or just a party
// (app.js keeps the bookings), and while yours is on the hall dresses up for
// it: a banner over the stage with your words on it, balloons and streamers
// in the colours of the occasion, the dance floor lights up, and there's a big
// cake on the long table to cut. Anyone can fire the confetti cannon, and
// everyone in the hall sees it go off.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, shell, doorOut, chair, plant } from './roomkit.js';

export const PARTY = { minX: -8, maxX: 8, minZ: -6, maxZ: 6, h: 4 };
const R = PARTY;
const cyl = (rt, rb, h, m, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const ball = (r, m, seg = 18) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.6)), m);

// each occasion's look: the banner, the balloons and streamers
export const THEMES = {
  birthday: { bg: '#fff0f5', ink: '#d4678a', edge: '#f4c95d', colors: ['#ff8ac0', '#ffd23f', '#7fd8ff', '#b28aff'] },
  wedding: { bg: '#fffaf0', ink: '#b08a3a', edge: '#e8d3a0', colors: ['#ffffff', '#f4e2c8', '#f2c6d0', '#e8d3a0'] },
  graduation: { bg: '#1f2a44', ink: '#f4c95d', edge: '#f4c95d', colors: ['#1f2a44', '#f4c95d', '#ffffff', '#3f5a8a'] },
  eid: { bg: '#0f4a4a', ink: '#f4d38a', edge: '#f4d38a', colors: ['#2f8a7a', '#f4d38a', '#ffffff', '#7a3fa0'] },
  baby: { bg: '#f0f8ff', ink: '#6a9ac4', edge: '#f2c6d0', colors: ['#bfe0ff', '#f2c6d0', '#fff3b0', '#c8f0d8'] },
  party: { bg: '#2a1a40', ink: '#ff8ad0', edge: '#3fd0ff', colors: ['#ff4a8a', '#3fd0ff', '#ffd23f', '#7dff6a'] },
};

function drawBanner(g, w, h, text, theme) {
  const T = THEMES[theme] || null;
  g.clearRect(0, 0, w, h);
  g.fillStyle = T ? T.bg : '#fbf3ea'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 40); g.fill();
  g.lineWidth = 12; g.strokeStyle = T ? T.edge : '#d4678a'; g.stroke();
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const star = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  const heart = (x, y, s, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4); g.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); g.fill(); };
  if (theme === 'birthday') {
    // bunting along the top, little candles at the ends
    for (let i = 0; i < 22; i++) { g.fillStyle = T.colors[i % 4]; const x = 40 + i * ((w - 80) / 22); g.beginPath(); g.moveTo(x, 24); g.lineTo(x + 70, 24); g.lineTo(x + 35, 96); g.fill(); }
    for (const x of [120, w - 120]) { g.fillStyle = '#ffffff'; g.fillRect(x - 14, h - 190, 28, 120); g.fillStyle = T.colors[0]; for (let k = 0; k < 4; k++) g.fillRect(x - 14, h - 180 + k * 30, 28, 10); g.fillStyle = '#ffb020'; g.beginPath(); g.ellipse(x, h - 212, 14, 24, 0, 0, Math.PI * 2); g.fill(); }
  } else if (theme === 'wedding') {
    for (let i = 0; i < 14; i++) heart(80 + rnd() * (w - 160), 50 + rnd() * (h - 100), 14 + rnd() * 14, i % 2 ? '#f2c6d0' : '#e8d3a0');
    g.lineWidth = 10; g.strokeStyle = '#d4af37';
    for (const [x, d] of [[150, -26], [150, 26]]) { g.beginPath(); g.arc(x + d, h / 2, 46, 0, Math.PI * 2); g.stroke(); }
    for (const [x, d] of [[w - 150, -26], [w - 150, 26]]) { g.beginPath(); g.arc(x + d, h / 2, 46, 0, Math.PI * 2); g.stroke(); }
  } else if (theme === 'graduation') {
    for (const x of [150, w - 150]) {
      g.fillStyle = '#0d1424'; g.beginPath(); g.moveTo(x - 90, h / 2 - 20); g.lineTo(x, h / 2 - 60); g.lineTo(x + 90, h / 2 - 20); g.lineTo(x, h / 2 + 20); g.closePath(); g.fill();
      g.fillRect(x - 45, h / 2, 90, 50);
      g.strokeStyle = '#f4c95d'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, h / 2 - 20); g.lineTo(x + 70, h / 2 + 10); g.lineTo(x + 70, h / 2 + 80); g.stroke();
    }
    for (let i = 0; i < 18; i++) star(80 + rnd() * (w - 160), 40 + rnd() * (h - 80), 10 + rnd() * 8, '#f4c95d');
  } else if (theme === 'eid') {
    for (const x of [160, w - 160]) {
      g.fillStyle = '#f4d38a'; g.beginPath(); g.arc(x, h / 2, 70, 0, Math.PI * 2); g.fill();
      g.fillStyle = T.bg; g.beginPath(); g.arc(x + 32, h / 2 - 16, 62, 0, Math.PI * 2); g.fill();
      star(x + 40, h / 2 + 30, 18, '#f4d38a');
    }
    for (let i = 0; i < 9; i++) { // little lanterns hanging from the top
      const x = 320 + i * ((w - 640) / 8); g.strokeStyle = '#f4d38a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 12); g.lineTo(x, 50); g.stroke();
      g.fillStyle = ['#e04a4a', '#2f8a7a', '#f4d38a'][i % 3]; g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 16, 70); g.lineTo(x + 12, 100); g.lineTo(x - 12, 100); g.lineTo(x - 16, 70); g.closePath(); g.fill();
    }
  } else if (theme === 'baby') {
    for (let i = 0; i < 6; i++) { g.fillStyle = '#ffffff'; const x = 100 + rnd() * (w - 200), y = 60 + rnd() * (h - 120); for (const [dx, r] of [[-30, 26], [0, 36], [32, 24]]) { g.beginPath(); g.arc(x + dx, y, r, 0, Math.PI * 2); g.fill(); } }
    for (let i = 0; i < 16; i++) star(80 + rnd() * (w - 160), 40 + rnd() * (h - 80), 12, i % 2 ? '#f2c6d0' : '#fff3b0');
  } else if (theme === 'party') {
    for (let i = 0; i < 120; i++) { g.fillStyle = T.colors[i % 4]; g.save(); g.translate(30 + rnd() * (w - 60), 30 + rnd() * (h - 60)); g.rotate(rnd() * 3); g.fillRect(-8, -4, 16, 8); g.restore(); }
  } else {
    for (let i = 0; i < 12; i++) star(80 + rnd() * (w - 160), 40 + rnd() * (h - 80), 10, '#f2c6d0');
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 150; g.font = `700 ${size}px Georgia, serif`;
  while (g.measureText(text).width > w - 420 && size > 60) { size -= 6; g.font = `700 ${size}px Georgia, serif`; }
  if (T && (theme === 'graduation' || theme === 'eid' || theme === 'party')) { g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 12; }
  g.fillStyle = T ? T.ink : '#d4678a'; g.fillText(text, w / 2, h / 2 + 8);
  g.shadowBlur = 0;
}

export function buildParty({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [214, 176, 136], 23),
    wallColor: '#fdf3ec', lowColor: '#f2c6d0', ceilColor: '#fffaf4', windows: { east: [-3, 0, 3], west: [-3, 3] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const white = std('#fffaf2', { roughness: 0.5 }), gold = std('#d4af37', { metalness: 0.7, roughness: 0.3 });
  const cloth = std('#ffffff', { roughness: 0.9 });
  let party = false, theme = 'birthday';

  // ── the stage at the north end, curtains either side, the banner over it
  const STAGE = { minX: -4, maxX: 4, minZ: R.minZ, maxZ: R.minZ + 1.8, h: 0.35 };
  group.add(at(rbox(STAGE.maxX - STAGE.minX, STAGE.h, STAGE.maxZ - STAGE.minZ, 0.04, std('#b86a7a', { roughness: 0.6 })), 0, STAGE.h / 2, (STAGE.minZ + STAGE.maxZ) / 2));
  group.add(at(box(STAGE.maxX - STAGE.minX, 0.04, 0.04, gold), 0, STAGE.h, STAGE.maxZ));
  colliders.push({ type: 'box', fixed: true, minX: STAGE.minX, maxX: STAGE.maxX, minZ: STAGE.minZ, maxZ: STAGE.maxZ - 0.6 });
  for (const s of [-1, 1]) {
    const curtain = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, R.h - 0.2, 24, 1, true, 0, Math.PI), std('#c0304a', { roughness: 0.9, side: THREE.DoubleSide }));
    curtain.scale.set(1.2, 1, 0.35); curtain.position.set(s * 4.6, (R.h - 0.2) / 2, R.minZ + 0.3); curtain.rotation.y = Math.PI; group.add(curtain);
    group.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 16), gold), s * 4.4, 1.3, R.minZ + 0.45));
  }
  const bc = document.createElement('canvas'); bc.width = 2048; bc.height = 400;
  const bannerTex = new THREE.CanvasTexture(bc); bannerTex.colorSpace = THREE.SRGBColorSpace;
  const banner = at(new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.21), new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.8, transparent: true })), 0, 3.15, R.minZ + 0.06);
  group.add(banner);
  let bannerText = 'The Party Hall — book it for your celebration 🎉', bannerTheme = null;
  const redrawBanner = () => { drawBanner(bc.getContext('2d'), bc.width, bc.height, bannerText, bannerTheme); bannerTex.needsUpdate = true; };
  redrawBanner();
  // a mic stand on the stage, and speakers
  group.add(at(cyl(0.012, 0.012, 1.4, std('#c0c4c8', { metalness: 0.7, roughness: 0.3 }), 8), 0.8, STAGE.h + 0.7, R.minZ + 1.0));
  group.add(at(cyl(0.035, 0.025, 0.14, std('#2a2a2a'), 10), 0.8, STAGE.h + 1.45, R.minZ + 1.0));
  for (const s of [-1, 1]) {
    group.add(at(rbox(0.55, 0.9, 0.45, 0.04, std('#2a2630', { roughness: 0.5 })), s * 3.4, STAGE.h + 0.45, R.minZ + 0.5));
    for (const y of [0.25, 0.62]) group.add(at(new THREE.Mesh(new THREE.CircleGeometry(y > 0.5 ? 0.1 : 0.17, 20), std('#555060', { roughness: 0.4 })), s * 3.4, STAGE.h + y, R.minZ + 0.73));
  }

  // ── the dance floor: light-up tiles
  const DF = { x0: -2.5, z0: -3.6, n: 6, s: 0.84 };
  const tiles = [];
  for (let i = 0; i < DF.n; i++) for (let j = 0; j < DF.n; j++) {
    const m = new THREE.MeshStandardMaterial({ color: (i + j) % 2 ? '#3a2e4a' : '#f4ece0', roughness: 0.25, emissive: '#000000' });
    const t = new THREE.Mesh(new THREE.BoxGeometry(DF.s - 0.04, 0.03, DF.s - 0.04), m);
    t.position.set(DF.x0 + (i + 0.5) * DF.s, 0.015, DF.z0 + (j + 0.5) * DF.s); t.receiveShadow = true;
    group.add(t); tiles.push({ m, i, j });
  }
  const DFC = { x: DF.x0 + DF.n * DF.s / 2, z: DF.z0 + DF.n * DF.s / 2 };
  const disco = ['#ff4a8a', '#3fd0ff', '#ffd23f'].map((c, i) => { const l = new THREE.PointLight(c, 0, 7, 1.4); l.position.set(DFC.x, 3.2, DFC.z); group.add(l); return l; });
  const ball2 = at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 2), std('#e8e8f0', { metalness: 0.55, roughness: 0.15, flatShading: true, emissive: '#9a9aa8', emissiveIntensity: 0.35 })), DFC.x, R.h - 0.5, DFC.z);
  group.add(ball2); group.add(at(cyl(0.006, 0.006, 0.25, std('#c0c4c8'), 4), DFC.x, R.h - 0.13, DFC.z));

  // ── the long table along the west wall: tablecloth, drinks, the cake
  const LT = { x: R.minX + 0.75, z: 0, w: 0.9, d: 4.2 };
  {
    group.add(at(rbox(LT.w, 0.05, LT.d, 0.02, std('#c9a27e', { roughness: 0.6 })), LT.x, 0.76, LT.z));
    const tc = at(box(LT.w + 0.06, 0.62, LT.d + 0.06, cloth), LT.x, 0.47, LT.z); group.add(tc);
    // a pink ruffle round the tablecloth, with little bows
    group.add(at(box(0.03, 0.09, LT.d + 0.08, std('#f2c6d0', { roughness: 0.9 })), LT.x + LT.w / 2 + 0.05, 0.71, LT.z));
    for (let i = 0; i < 6; i++) for (const k of [-1, 1]) { const bw = at(ball(0.035, std('#ff8ac0', { roughness: 0.7 }), 8), LT.x + LT.w / 2 + 0.07, 0.71, LT.z - LT.d / 2 + 0.35 + i * 0.7 + k * 0.035); bw.scale.set(0.4, 0.6, 1); group.add(bw); }
    block(LT.x, LT.z, LT.w + 0.1, LT.d + 0.1);
    // drinks: a jug of lemonade, glasses, a bowl of sweets
    const glassM = std('#e8f6ff', { transparent: true, opacity: 0.5, roughness: 0.05 });
    group.add(at(cyl(0.08, 0.07, 0.26, glassM), LT.x, 0.92, LT.z + 1.55));
    group.add(at(cyl(0.072, 0.065, 0.18, std('#ffe680', { roughness: 0.3 })), LT.x, 0.88, LT.z + 1.55));
    for (let i = 0; i < 6; i++) { const gx = LT.x - 0.25 + (i % 2) * 0.5, gz = LT.z + 1.15 + Math.floor(i / 2) * 0.22 - 0.05; group.add(at(cyl(0.035, 0.03, 0.1, glassM, 12), gx, 0.835, gz)); group.add(at(cyl(0.031, 0.027, 0.06, std(['#ff8ac0', '#ffd23f', '#7fd8ff'][i % 3]), 12), gx, 0.815, gz)); }
    group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#ffffff', { roughness: 0.3, side: THREE.DoubleSide })), LT.x, 0.94, LT.z - 1.5));
    for (let i = 0; i < 14; i++) group.add(at(ball(0.025, std(['#ff4a8a', '#3fd0ff', '#ffd23f', '#7dff6a'][i % 4], { roughness: 0.4 }), 8), LT.x + Math.cos(i * 2.4) * 0.08, 0.83 + (i % 3) * 0.02, LT.z - 1.5 + Math.sin(i * 2.4) * 0.08));
    // stacked plates and forks
    for (let i = 0; i < 6; i++) group.add(at(cyl(0.11, 0.09, 0.012, white, 20), LT.x, 0.79 + i * 0.013, LT.z - 0.9));
  }
  // the cake: three tiers, frosting swirls, candles with flames
  const cake = new THREE.Group(); cake.position.set(LT.x, 0.785, LT.z + 0.2);
  const flames = [];
  {
    cake.add(at(cyl(0.3, 0.32, 0.02, gold, 32), 0, 0.01, 0));
    const tierM = [std('#fff0f5', { roughness: 0.6 }), std('#ffd6e4', { roughness: 0.6 }), std('#fff0f5', { roughness: 0.6 })];
    let y = 0.02;
    for (let k = 0; k < 3; k++) {
      const r = 0.26 - k * 0.07, h = 0.17 - k * 0.02;
      cake.add(at(cyl(r, r, h, tierM[k], 32), 0, y + h / 2, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 8, 40), std(k === 1 ? '#ffffff' : '#ff8ac0', { roughness: 0.5 })); ring.rotation.x = Math.PI / 2; ring.position.y = y + h; cake.add(ring);
      for (let i = 0; i < 10 - k * 2; i++) { const a = i / (10 - k * 2) * Math.PI * 2; cake.add(at(ball(0.018, std('#e04a6a', { roughness: 0.3 }), 8), Math.cos(a) * r * 0.97, y + h * 0.5, Math.sin(a) * r * 0.97)); }
      y += h;
    }
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, x = Math.cos(a) * 0.07, z = Math.sin(a) * 0.07;
      cake.add(at(cyl(0.007, 0.007, 0.08, std(['#7fd8ff', '#ffd23f', '#ff8ac0', '#b28aff', '#7dff6a'][i]), 6), x, y + 0.04, z));
      const f = at(ball(0.011, new THREE.MeshBasicMaterial({ color: '#ffb020' }), 8), x, y + 0.095, z); f.scale.y = 1.7; cake.add(f); flames.push(f);
    }
    const flameLight = new THREE.PointLight('#ffb060', 0.5, 2, 2); flameLight.position.set(0, y + 0.15, 0); cake.add(flameLight);
    cake.visible = false;
    group.add(cake);
    const hit = at(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 12), new THREE.MeshBasicMaterial({ visible: false })), 0, 0.3, 0);
    cake.add(hit); hit.userData = { kind: 'party-cake', label: 'The cake — cut a slice 🎂' };
    interactables.push(hit);
  }

  // ── the gift table by the stage, presents piled up
  {
    const gx = 5.6, gz = -4.4;
    group.add(at(rbox(1.4, 0.05, 0.8, 0.02, std('#c9a27e', { roughness: 0.6 })), gx, 0.72, gz));
    group.add(at(box(1.44, 0.6, 0.84, std('#f2c6d0', { roughness: 0.9 })), gx, 0.42, gz));
    block(gx, gz, 1.5, 0.9);
    const GIFT = [['#7fd8ff', '#ffffff'], ['#ff8ac0', '#ffd23f'], ['#b28aff', '#ffffff'], ['#ffd23f', '#e04a6a'], ['#7dff6a', '#ff8ac0']];
    GIFT.forEach(([c, r], i) => {
      const s = 0.18 + (i % 3) * 0.06, x = gx - 0.5 + i * 0.25, z = gz + (i % 2 ? 0.15 : -0.12), y = 0.745 + (i === 4 ? 0.26 : 0) + s / 2;
      group.add(at(rbox(s, s, s, 0.015, std(c, { roughness: 0.6 })), i === 4 ? gx - 0.38 : x, y, z));
      const rm = std(r, { roughness: 0.5 });
      group.add(at(box(s + 0.005, s + 0.005, 0.03, rm), i === 4 ? gx - 0.38 : x, y, z));
      group.add(at(box(0.03, s + 0.005, s + 0.005, rm), i === 4 ? gx - 0.38 : x, y, z));
      for (const k of [-1, 1]) { const bow = at(ball(0.03, rm, 8), (i === 4 ? gx - 0.38 : x) + k * 0.03, y + s / 2 + 0.02, z); bow.scale.set(1.2, 0.6, 0.6); group.add(bow); }
    });
  }

  // ── round tables with four chairs each
  let tn = 0;
  for (const [x, z] of [[-4.6, 3.6], [4.6, 3.6], [5.4, -0.8], [-4.4, -4.0]]) {
    group.add(at(cyl(0.6, 0.6, 0.04, std('#c9a27e', { roughness: 0.6 }), 32), x, 0.75, z));
    group.add(at(cyl(0.64, 0.66, 0.5, cloth, 32), x, 0.5, z));
    group.add(at(cyl(0.08, 0.08, 0.14, std('#e8f6ff', { transparent: true, opacity: 0.5 }), 12), x, 0.84, z));
    for (let k = 0; k < 3; k++) { const fl = at(ball(0.04, std(['#ff8ac0', '#ffd23f', '#ffffff'][k], { roughness: 0.8 }), 8), x + (k - 1) * 0.03, 0.93 + (k % 2) * 0.02, z); group.add(fl); }
    block(x, z, 1.25, 1.25);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, cx = x + Math.cos(a) * 0.95, cz = z + Math.sin(a) * 0.95;
      chair(group, seats, interactables, { id: `party-t${tn}-${k}`, label: 'a party chair', x: cx, z: cz, ry: Math.atan2(x - cx, z - cz), color: '#f4ece0', y0: fy });
    }
    tn++;
  }

  // ── fairy lights strung across the ceiling, in swags
  {
    const N = 26 * 5, bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff1c0' }), N);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let row = 0; row < 5; row++) {
      const z = R.minZ + 2.2 + row * 1.9;
      for (let i = 0; i < 26; i++) {
        const k = i / 25, x = R.minX + 0.3 + k * (R.maxX - R.minX - 0.6);
        const sag = Math.sin(((k * 3) % 1) * Math.PI) * 0.35;
        m4.setPosition(x, R.h - 0.15 - sag, z); bulb.setMatrixAt(n, m4);
        bulb.setColorAt(n, new THREE.Color(['#fff1c0', '#ffd0e0', '#d0f0ff'][n % 3])); n++;
      }
    }
    group.add(bulb);
  }

  // ── decorations for a party: balloon bunches and streamers, in the theme's colours
  const decor = new THREE.Group(); decor.visible = false; group.add(decor);
  const balloonM = [0, 1, 2, 3].map(() => std('#ff8ac0', { roughness: 0.25, metalness: 0.05 }));
  const balloons = [];
  const bunch = (x, z, n = 5, h = 1.8) => {
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group();
      const a = i / n * Math.PI * 2, r = i ? 0.22 : 0;
      const bm = ball(0.2, balloonM[(i + Math.round(x)) & 3], 18); bm.scale.set(1, 1.18, 1); b.add(bm);
      b.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 8), balloonM[(i + Math.round(x)) & 3]), 0, -0.25, 0).rotateX(Math.PI));
      const y = h + (i ? 0.1 : 0.35) + (i % 2) * 0.12;
      b.add(at(cyl(0.003, 0.003, y - 0.2, std('#ffffff'), 4), 0, -(y - 0.2) / 2 - 0.26, 0));
      b.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      decor.add(b); balloons.push({ b, y, p: i * 1.3 + x });
    }
    decor.add(at(cyl(0.06, 0.08, 0.1, gold, 12), x, 0.05, z)); // the weight
  };
  bunch(-4.6, -1.0); bunch(4.6, -2.6); bunch(-5.6, 5.2, 4); bunch(5.6, 5.2, 4); bunch(-3.6, R.minZ + 0.6, 6, 2.2); bunch(3.6, R.minZ + 0.6, 6, 2.2);
  const streamerM = [0, 1, 2, 3].map(() => std('#ff8ac0', { roughness: 0.7, side: THREE.DoubleSide }));
  for (let i = 0; i < 8; i++) {
    const pts = [];
    const z0 = R.minZ + 0.5 + i * 1.5, sx = R.minX + 0.2, ex = R.maxX - 0.2;
    for (let k = 0; k <= 30; k++) { const u = k / 30; pts.push(new THREE.Vector3(sx + (ex - sx) * u, R.h - 0.1 - Math.sin(u * Math.PI) * 0.6, z0 + Math.sin(u * Math.PI * 8) * 0.12)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.022, 5), streamerM[i % 4]);
    decor.add(tube);
  }
  const setColors = th => {
    const T = THEMES[th] || THEMES.party;
    balloonM.forEach((m, i) => m.color.set(T.colors[i]));
    streamerM.forEach((m, i) => m.color.set(T.colors[(i + 1) % 4]));
  };

  // ── the bookings board by the door, and the confetti cannon
  const bk = document.createElement('canvas'); bk.width = 512; bk.height = 640;
  const boardTex = new THREE.CanvasTexture(bk); boardTex.colorSpace = THREE.SRGBColorSpace;
  const drawBoard = list => {
    const g = bk.getContext('2d'), w = bk.width, h = bk.height;
    g.fillStyle = '#7a4e33'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fbf3ea'; g.fillRect(18, 18, w - 36, h - 36);
    g.fillStyle = '#d4678a'; g.font = '700 50px Georgia, serif'; g.textAlign = 'center'; g.fillText('🗓️ Bookings', w / 2, 82);
    g.fillStyle = '#8a5a3a'; g.font = 'italic 26px Georgia, serif'; g.fillText('click to book the hall', w / 2, 120);
    g.textAlign = 'left';
    if (!list.length) { g.fillStyle = '#5f8f52'; g.font = '700 46px Georgia, serif'; g.textAlign = 'center'; g.fillText('Free — book it!', w / 2, 330); g.font = '64px serif'; g.fillText('🎉', w / 2, 420); return; }
    list.slice(0, 5).forEach((b, i) => {
      const y = 175 + i * 92;
      g.fillStyle = i % 2 ? '#fde3ea' : '#e8f4ee'; g.fillRect(40, y - 40, w - 80, 80);
      g.fillStyle = '#4a3530'; g.font = '700 30px Georgia, serif'; g.fillText(String(b.title || '').slice(0, 26), 56, y - 4);
      g.fillStyle = '#8a5a3a'; g.font = '24px Georgia, serif'; g.fillText(String(b.when || '').slice(0, 34), 56, y + 28);
    });
  };
  drawBoard([]);
  {
    const board = at(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.19), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.8 })), 2.0, 1.55, R.maxZ - 0.05);
    board.rotation.y = Math.PI; group.add(board);
    clickable(board, { kind: 'party-book', label: 'The bookings board — book the hall 🗓️' });
  }
  const CANNON = { x: STAGE.maxX - 0.5, z: STAGE.maxZ + 0.5 };
  {
    const c = new THREE.Group(); c.position.set(CANNON.x, 0, CANNON.z);
    c.add(at(cyl(0.22, 0.26, 0.5, std('#7a3fa0', { roughness: 0.5 })), 0, 0.25, 0));
    const tube = at(cyl(0.09, 0.12, 0.55, std('#ffd23f', { roughness: 0.4 })), 0, 0.72, -0.08); tube.rotation.x = -0.35; c.add(tube);
    for (let i = 0; i < 5; i++) c.add(at(ball(0.035, std(['#ff4a8a', '#3fd0ff', '#ffd23f', '#7dff6a', '#ffffff'][i]), 8), Math.cos(i * 1.3) * 0.23, 0.2 + i * 0.06, Math.sin(i * 1.3) * 0.23));
    c.add(at(cyl(0.08, 0.08, 0.05, std('#e04a4a', { emissive: '#e04a4a', emissiveIntensity: 0.4 })), 0, 0.52, 0.17));
    group.add(c);
    clickable(c, { kind: 'party-confetti', label: 'Confetti! 🎊' });
    block(CANNON.x, CANNON.z, 0.55, 0.55);
  }
  // the confetti itself: one InstancedMesh, reused for every burst
  const CN = 600;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.045), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CN);
  conf.visible = false; conf.frustumCulled = false; group.add(conf);
  const CC = ['#ff4a8a', '#3fd0ff', '#ffd23f', '#7dff6a', '#b28aff', '#ffffff', '#ff8a3a'];
  for (let i = 0; i < CN; i++) conf.setColorAt(i, new THREE.Color(CC[i % CC.length]));
  const bits = Array.from({ length: CN }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }));
  let confT = -1;
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), m4 = new THREE.Matrix4();

  {
    const s = makeSign([{ text: 'The Party Hall', size: 120, weight: '700', color: '#d4678a' }, { text: 'birthdays · weddings · graduations · Eid', font: 'Dancing Script, cursive', size: 58, color: '#8a5a3a' }], 2.2, 0.5, { bg: '#fffaf2', border: '#f2c6d0' });
    s.position.set(-3.0, 2.85, R.maxZ - 0.06); s.rotation.y = Math.PI; group.add(s);
  }
  plant(group, colliders, R.maxX - 0.5, R.maxZ - 0.6, 1);
  plant(group, colliders, R.minX + 0.5, R.maxZ - 0.6, 1);
  const warm = [[-4, 0], [4, 0], [0, 3.5]].map(([x, z]) => { const l = new THREE.PointLight('#ffe6c8', 2.2, 9, 1.4); l.position.set(x, R.h - 0.6, z); group.add(l); return l; });
  doorOut({ group, R, makeSign, interactables, color: '#d4678a', to: 'landing4', sign: '⬅ The landing', label: 'Back out to the landing' });

  animate?.((dt, t) => {
    // the dance floor and the disco lights, while a party's on
    for (const { m, i, j } of tiles) {
      if (party) {
        const k = Math.sin(t * 2.4 + i * 0.9 + j * 1.3) * 0.5 + 0.5;
        const cols = (THEMES[theme] || THEMES.party).colors;
        m.emissive.set(cols[(i + j + Math.floor(t * 1.5)) % 4]); m.emissiveIntensity = 0.25 + k * 0.55;
      } else m.emissiveIntensity = 0;
    }
    ball2.rotation.y += dt * (party ? 0.7 : 0.15);
    disco.forEach((l, i) => { const a = t * 0.9 + i * 2.1; l.position.set(DFC.x + Math.cos(a) * 2, 3.0, DFC.z + Math.sin(a) * 2); l.intensity = party ? 1.6 + Math.sin(t * 3 + i) * 0.5 : 0; });
    if (decor.visible) for (const o of balloons) { o.b.position.y = o.y + Math.sin(t * 1.1 + o.p) * 0.05; o.b.rotation.z = Math.sin(t * 0.8 + o.p) * 0.06; }
    if (cake.visible) flames.forEach((f, i) => { f.scale.set(1, 1.5 + Math.sin(t * 13 + i * 2) * 0.35, 1); });
    // confetti: up out of the cannon and over the dance floor, then fluttering down
    if (confT >= 0) {
      confT += dt;
      for (let i = 0; i < CN; i++) {
        const b = bits[i];
        if (b.p.y > 0.02) {
          b.v.y -= 2.2 * dt;
          b.v.multiplyScalar(1 - Math.min(0.9, dt * (b.v.y < 0 ? 2.6 : 0.6)));
          if (b.v.y < -0.55) b.v.y = -0.55;
          b.p.addScaledVector(b.v, dt);
          b.p.x += Math.sin(confT * 3 + i) * dt * 0.15;
          b.r.x += b.w.x * dt; b.r.y += b.w.y * dt; b.r.z += b.w.z * dt;
          if (b.p.y < 0.02) b.p.y = 0.015;
        }
        m4.compose(b.p, q.setFromEuler(b.r), sc);
        conf.setMatrixAt(i, m4);
      }
      conf.instanceMatrix.needsUpdate = true;
      if (confT > 7.5) { confT = -1; conf.visible = false; }
    }
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights: [...warm, ...disco], bounds: R, dance: { x: DFC.x, z: DFC.z, r: DF.n * DF.s / 2 },
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
    // the words over the stage, in the occasion's style (null theme: the plain banner)
    setBanner(text, th = null) { bannerText = String(text || '').slice(0, 60) || 'The Party Hall'; bannerTheme = THEMES[th] ? th : null; redrawBanner(); },
    // dressed for a party (balloons, streamers, the dance floor lit) or not
    setDecor(on, th = 'party') {
      party = !!on; theme = THEMES[th] ? th : 'party';
      decor.visible = party; setColors(theme);
      if (!party) { bannerText = 'The Party Hall — book it for your celebration 🎉'; bannerTheme = null; redrawBanner(); }
    },
    setCake(on) { cake.visible = !!on; },
    setBoard(list = []) { drawBoard(Array.isArray(list) ? list : []); boardTex.needsUpdate = true; },
    // a burst of confetti from the cannon, over the dance floor
    confetti() {
      for (let i = 0; i < CN; i++) {
        const b = bits[i], a = Math.random() * Math.PI * 2;
        b.p.set(CANNON.x + (Math.random() - 0.5) * 0.1, 0.95, CANNON.z - 0.1);
        // aim at a random point over the dance floor
        const tx = DFC.x + Math.cos(a) * Math.random() * 2.6, tz = DFC.z + Math.sin(a) * Math.random() * 2.6;
        b.v.set((tx - b.p.x) * (0.9 + Math.random() * 0.5), 4.2 + Math.random() * 1.6, (tz - b.p.z) * (0.9 + Math.random() * 0.5));
        b.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        b.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      }
      confT = 0; conf.visible = true;
    },
  };
}
