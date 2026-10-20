// The Nile, at the end of the street. The road in front of the café runs on
// east between two rows of flats to the corniche: a promenade with lamps,
// benches and palms, an iron railing, and the river — wide and slow, with
// feluccas under their white sails and, after dark, a party boat strung with
// coloured lights. In the middle of the river, Gezira, green, with Cairo Tower
// rising from it; a bridge across to the far bank and its line of buildings.
//
// world.js's buildCairo calls this with its own building() so the flats along
// the way match the rest of the street.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stripedKerb } from './cairo.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const flat = (w, d, x, y, z, m) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; return p; };
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  return t;
}

// where it all is (world coordinates); the street's road ends at x = 25
export const NILE = {
  lane: { z0: 14.5, z1: 21 },          // the road running east to the river (the front road, carried on)
  walk: { n: 12.4, s: 23.2 },          // its pavements' outer edges
  corniche: { x0: 58, x1: 62.5 },       // the promenade
  river: { x0: 62.5, x1: 140 },
  island: { x0: 86, x1: 110, z0: -45, z1: 95 },
  tower: { x: 98, z: 26 },
};

export function buildNile({ scene, r, nightMats, lampGlows, building, sand, paveMap, roadMap, glowTex, palm }) {
  const N = NILE;
  const animated = [];
  const roadM = new THREE.MeshStandardMaterial({ color: '#ffffff', map: roadMap, roughness: 0.9 });
  const paveM = new THREE.MeshStandardMaterial({ color: '#ffffff', map: paveMap, roughness: 0.95 });

  // ── the road on to the river, its pavements and kerbs, flats either side
  const len = N.corniche.x0 - 25, mid = 25 + len / 2;
  scene.add(flat(len, N.lane.z1 - N.lane.z0, mid, -0.03, (N.lane.z0 + N.lane.z1) / 2, roadM));
  scene.add(flat(len - 3, N.lane.z0 - N.walk.n, mid + 1.5, -0.02, (N.walk.n + N.lane.z0) / 2, paveM));
  scene.add(flat(len - 3, N.walk.s - N.lane.z1, mid + 1.5, -0.02, (N.walk.s + N.lane.z1) / 2, paveM));
  for (const z of [N.lane.z0, N.lane.z1]) { const k = at(new THREE.Mesh(new THREE.BoxGeometry(len - 3, 0.14, 0.25), stripedKerb(len - 3)), mid + 1.5, 0.04, z); scene.add(k); }
  const dashM = new THREE.MeshBasicMaterial({ color: '#f1ead8' });
  for (let x = 27; x < N.corniche.x0 - 1; x += 3) { const d = at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.14), dashM), x, -0.025, (N.lane.z0 + N.lane.z1) / 2); d.rotation.x = -Math.PI / 2; scene.add(d); }
  const rowAlong = (z, ry, x0, x1) => {
    let x = x0;
    while (x < x1 - 3) {
      const w = Math.min(x1 - x, 5 + r() * 4), h = 9 + r() * 9;
      const b = building(w, h, 7, new THREE.MeshStandardMaterial({ color: sand[Math.floor(r() * sand.length)], roughness: 0.95 }));
      b.position.set(x + w / 2, 0, z); b.rotation.y = ry;
      scene.add(b);
      x += w + 0.15;
    }
  };
  rowAlong(N.walk.n, 0, 35.6, N.corniche.x0 - 0.5);
  rowAlong(N.walk.s, Math.PI, 33.6, N.corniche.x0 - 0.5);
  // a street sign at the corner
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#1f4a7a'; g.fillRect(0, 0, 512, 160); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(8, 8, 496, 144);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 64px serif'; g.fillText('كورنيش النيل', 256, 72);
    g.font = 'bold 34px sans-serif'; g.fillText('Nile Corniche  →', 256, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), std('#ffffff', { map: t })), 25.6, 2.7, N.lane.z0 - 0.6);
    sign.rotation.y = -Math.PI / 2;
    const post = at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8), std('#2f3a33', { metalness: 0.4 })), 25.65, 1.3, N.lane.z0 - 0.6);
    scene.add(sign, post);
  }

  // ── the corniche: a long promenade along the river with lamps, benches, palms, a railing
  const C = N.corniche;
  scene.add(flat(C.x1 - C.x0, 520, (C.x0 + C.x1) / 2, -0.015, 0, paveM));
  const iron = std('#2a3a2f', { roughness: 0.5, metalness: 0.4 });
  const lampHead = std('#fff3d6', { emissive: '#ffcf8a', emissiveIntensity: 0 });
  nightMats.push({ mat: lampHead, max: 1.6 });
  const rail = new THREE.Group();
  rail.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 520), iron), C.x1 - 0.1, 1.0, 0));
  rail.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 520), iron), C.x1 - 0.1, 0.5, 0));
  for (let z = -150; z <= 150; z += 1.2) rail.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 5), iron), C.x1 - 0.1, 0.5, z));
  scene.add(rail);
  for (let z = -60; z <= 90; z += 12) {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 4, 10), iron), 0, 2, 0));
    for (const s of [-1, 1]) {
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), lampHead), s * 0.45, 3.9, 0));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffcf8a', transparent: true, depthWrite: false, opacity: 0 }));
      glow.scale.set(2.6, 2.6, 1); glow.position.set(s * 0.45, 3.9, 0); g.add(glow);
      lampGlows.push(glow);
    }
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), iron), 0, 3.95, 0));
    g.position.set(C.x0 + 0.6, 0, z);
    scene.add(g);
    // a bench facing the water
    const b = new THREE.Group();
    b.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 1.6), std('#8a5a3a')), 0, 0.45, 0));
    b.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 1.6), std('#8a5a3a')), -0.22, 0.7, 0));
    for (const s of [-1, 1]) b.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.05), iron), 0, 0.22, s * 0.7));
    b.position.set(C.x1 - 1.0, 0, z + 6);
    scene.add(b);
    if (palm) palm(C.x0 + 0.8, z + 6, 7 + r() * 2);
  }
  // the river wall: stone, down to the water
  scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 520), std('#cdb58f', { roughness: 1 })), C.x1 + 0.2, 0.12, 0));

  // ── the river
  const water = tex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#4a7a74'); gr.addColorStop(1, '#3d6862');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(220,240,240,0.18)'; g.lineWidth = 2;
    for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * h, l = 10 + Math.random() * 30; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke(); }
  }, [10, 60]);
  const waterM = new THREE.MeshStandardMaterial({ color: '#ffffff', map: water, roughness: 0.15, metalness: 0.25, emissive: '#ffffff', emissiveMap: water, emissiveIntensity: 0 });
  nightMats.push({ mat: waterM, max: 0.12 }); // after dark the river still catches the city's light
  // and the lamps of both banks lie on the water in long shimmering streaks
  const streakTex = tex(32, 256, (g, w, h) => { for (let y = 0; y < h; y += 6) { g.fillStyle = `rgba(255,214,150,${0.15 + Math.random() * 0.6})`; g.fillRect(Math.random() * 8, y, w - Math.random() * 16, 3); } }, [1, 1]);
  const streaks = [];
  const streak = (x, z, len, color = '#ffd696') => {
    const m = new THREE.MeshBasicMaterial({ map: streakTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const p = flat(1.1, len, x, -0.02, z, m); p.rotation.z = Math.PI / 2;
    scene.add(p); lampGlows.push(p); streaks.push(p);
  };
  for (let z = -60; z <= 90; z += 12) streak(N.corniche.x1 + 4, z, 8);
  for (let z = -150; z <= 150; z += 14) streak(N.river.x1 - 5, z + 3, 12, '#ffe2b0');
  scene.add(flat(N.river.x1 - N.river.x0 + 4, 900, (N.river.x0 + N.river.x1) / 2, -0.03, 0, waterM)); // (just above the city's ground)
  animated.push((dt, t) => {
    water.offset.y -= dt * 0.004; water.offset.x += dt * 0.0015;
    streakTex.offset.y = (t * 0.05) % 1; // the reflections tremble
  });

  // Gezira: the island in the middle, green, with Cairo Tower (world.js moves the tower here)
  const I = N.island;
  const grass = std('#6f9a5a', { roughness: 1 });
  scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(I.x1 - I.x0, 0.5, I.z1 - I.z0), std('#cdb58f', { roughness: 1 })), (I.x0 + I.x1) / 2, 0.2, (I.z0 + I.z1) / 2));
  scene.add(flat(I.x1 - I.x0, I.z1 - I.z0, (I.x0 + I.x1) / 2, 0.46, (I.z0 + I.z1) / 2, grass));
  if (palm) for (let i = 0; i < 16; i++) palm(I.x0 + 2 + r() * (I.x1 - I.x0 - 4), I.z0 + 4 + r() * (I.z1 - I.z0 - 8), 8 + r() * 4);
  const treeM = std('#4f7a45', { roughness: 1 });
  for (let i = 0; i < 26; i++) { const t = at(new THREE.Mesh(new THREE.SphereGeometry(2 + r() * 2, 12, 10), treeM), I.x0 + 2 + r() * (I.x1 - I.x0 - 4), 2.5, I.z0 + 2 + r() * (I.z1 - I.z0 - 4)); t.scale.y = 0.75; scene.add(t); }

  // the bridge across, on stone piers, its lamps along the top
  {
    const z = -32, y = 7;
    const stone = std('#d9c7a8', { roughness: 0.95 });
    scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(N.river.x1 - N.river.x0 + 6, 0.8, 12), stone), (N.river.x0 + N.river.x1) / 2, y, z));
    for (const s of [-1, 1]) scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(N.river.x1 - N.river.x0 + 6, 0.8, 0.3), iron), (N.river.x0 + N.river.x1) / 2, y + 0.8, z + s * 5.9));
    for (let x = N.river.x0 + 8; x < N.river.x1; x += 16) scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(3, y + 1, 9), stone), x, (y + 1) / 2 - 1, z));
    for (let x = N.river.x0 + 2; x < N.river.x1; x += 8) for (const s of [-1, 1]) {
      scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 8), iron), x, y + 1.9, z + s * 5.9));
      scene.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lampHead), x, y + 3.5, z + s * 5.9));
    }
  }

  // the far bank: hotels and flats, lit windows after dark
  {
    const farM = sand.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    const litM = std('#4b4038', { emissive: '#ffd08f', emissiveIntensity: 0 });
    nightMats.push({ mat: litM, max: 1.0 });
    for (let z = -200; z < 220; z += 9 + r() * 6) {
      const w = 8 + r() * 6, h = 12 + r() * (Math.abs(z) < 60 ? 40 : 20), d = 10;
      const b = at(new THREE.Mesh(new THREE.BoxGeometry(d, h, w), farM[Math.floor(r() * farM.length)]), N.river.x1 + 8 + r() * 4, h / 2, z);
      scene.add(b);
      // a column of lit windows facing the river
      for (let k = 0; k < Math.floor(h / 4); k++) if (r() < 0.6) {
        const lit = at(new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.8), litM), b.position.x - d / 2 - 0.02, 3 + k * 3.6, z);
        lit.rotation.y = -Math.PI / 2; // facing the river
        scene.add(lit);
      }
    }
    scene.add(flat(30, 900, N.river.x1 + 14, -0.02, 0, std('#cdb58f', { roughness: 1 })));
  }

  // ── on the water: feluccas under white sails, and a party boat strung with lights
  const boats = [];
  const sailM = std('#f6f2ea', { roughness: 0.9, side: THREE.DoubleSide });
  function felucca(color) {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new RoundedBoxGeometry(5, 0.7, 1.7, 2, 0.3), std(color, { roughness: 0.6 })), 0, 0.1, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 1.5), std('#c9a27e')), 0, 0.45, 0));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), std('#6e472e')), 0.6, 3.3, 0));
    const sh = new THREE.Shape(); sh.moveTo(-2.4, 0); sh.lineTo(2.4, 0); sh.lineTo(1.8, 7.4); sh.closePath(); // the lateen sail, tipped back
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), sailM);
    sail.position.set(0.4, 0.9, 0.1); sail.rotation.z = 0.12;
    g.add(sail);
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 7.6, 6), std('#6e472e')), 1.5, 4.4, 0.12)); // the yard along the sail
    return { g, sail };
  }
  const lanes = [[70, 1.4], [78, -1.1], [118, 1.2], [128, -0.9], [74, -0.7]];
  lanes.forEach(([x, speed], i) => {
    const f = felucca(['#3f6a8a', '#f4f1ea', '#c8352f', '#3f7a55', '#e8b44a'][i]);
    f.g.position.set(x, -0.9, -150 + i * 70);
    f.g.rotation.y = speed > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(f.g);
    boats.push({ g: f.g, sail: f.sail, speed, ph: i });
  });
  {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new RoundedBoxGeometry(16, 1.6, 5, 2, 0.4), std('#f4f1ea', { roughness: 0.5 })), 0, 0.3, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(13, 2.2, 4.4), std('#e9e4dc', { roughness: 0.5 })), -0.5, 2.2, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.15, 4.6), std('#c8352f')), -0.5, 3.35, 0));
    const neon = ['#ff4a8a', '#3fd0ff', '#ffd23f', '#7dff6a', '#c56aff'].map(c => { const m = std(c, { emissive: c, emissiveIntensity: 0 }); nightMats.push({ mat: m, max: 2.2 }); return m; });
    for (let i = 0; i < 40; i++) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), neon[i % neon.length]), -7 + (i % 20) * 0.7, 3.6 + Math.abs(Math.sin(i * 0.4)) * 0.4, i < 20 ? 2.2 : -2.2));
    for (let i = 0; i < 12; i++) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), neon[i % neon.length]), -6 + i * 1.05, 2.2, 2.21));
    g.position.set(104 + 20, -0.6, 0);
    g.rotation.y = Math.PI / 2;
    scene.add(g);
    boats.push({ g, speed: -0.8, ph: 0, big: true });
  }

  function update(dt, t) {
    animated.forEach(f => f(dt, t));
    for (const b of boats) {
      b.g.position.z += b.speed * dt;
      if (b.g.position.z > 220) b.g.position.z = -220;
      if (b.g.position.z < -220) b.g.position.z = 220;
      b.g.position.y = (b.big ? 0.15 : -0.1) + Math.sin(t * 0.8 + b.ph) * 0.05;
      b.g.rotation.z = Math.sin(t * 0.6 + b.ph) * 0.02;
      if (b.sail) b.sail.rotation.y = Math.sin(t * 0.4 + b.ph) * 0.08;
    }
  }
  return { update };
}
