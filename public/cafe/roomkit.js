// A few pieces every room off the hallway needs: a plank floor, a ceiling,
// walls (with real openings for windows, so you see the actual street
// outside), the door back out to the hallway, plants and lamps. The Music
// Room (music.js) and the Prayer Room (prayer.js) are built from these.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
export const shade = m => { m.castShadow = true; m.receiveShadow = true; return m; };
export const rbox = (w, h, d, r, m) => shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m));
export const box = (w, h, d, m) => shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
export const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

export function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export function plankTex(R, rgb = [150, 104, 70], seed = 41) {
  return canvasTex(512, 512, g => {
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let row = 0; row < 8; row++) {
      for (let x = -(row % 2) * 128; x < 512; x += 256) {
        const k = 0.82 + r() * 0.18;
        g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
        g.fillRect(x, row * 64, 256, 64);
        g.fillStyle = 'rgba(50,30,15,0.28)'; g.fillRect(x, row * 64, 3, 64);
      }
      g.fillStyle = 'rgba(50,30,15,0.28)'; g.fillRect(0, row * 64, 512, 3);
    }
  }, [(R.maxX - R.minX) / 5, (R.maxZ - R.minZ) / 5]);
}

// Floor, ceiling and four walls. `windows` = { east: [z…], west: [z…] }:
// openings with clear glass and a wooden frame.
export function shell({ group, R, floor, floorMap, wallColor, lowColor, ceilColor = '#fbf3ea', windows = {}, wallsAreSurfaces = true }) {
  const W = R.maxX - R.minX, D = R.maxZ - R.minZ;
  const surfaces = [];
  const wood = std('#7a4e33', { roughness: 0.55 });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std('#ffffff', { map: floorMap, roughness: 0.7 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.userData.floor = true;
  group.add(floorMesh);
  floor.floorMesh = floorMesh;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(ceilColor, { roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = R.h;
  group.add(ceil);
  const wallM = std(wallColor, { roughness: 0.95 });
  const lowM = std(lowColor, { roughness: 0.9 });
  const WIN = { w: 1.5, y0: 1.05, y1: 2.4 };
  const wall = (w, x, z, ry, wins = []) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, R.h); sh.lineTo(-w / 2, R.h); sh.closePath();
    for (const c of wins) {
      const hole = new THREE.Path();
      hole.moveTo(c - WIN.w / 2, WIN.y0); hole.lineTo(c + WIN.w / 2, WIN.y0); hole.lineTo(c + WIN.w / 2, WIN.y1); hole.lineTo(c - WIN.w / 2, WIN.y1); hole.closePath();
      sh.holes.push(hole);
    }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), wallM);
    m.position.set(x, 0, z); m.rotation.y = ry; m.receiveShadow = true;
    if (wallsAreSurfaces) { m.userData.surface = 'wall'; surfaces.push(m); }
    group.add(m);
    const low = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.95), lowM);
    low.position.set(x, 0.475, z); low.rotation.y = ry; low.translateZ(0.004);
    group.add(low);
  };
  wall(W, 0, R.minZ, 0);
  wall(W, 0, R.maxZ, Math.PI);
  // the west wall faces +x, so its local x runs towards −z; the east the other way
  wall(D, R.minX, 0, Math.PI / 2, (windows.west || []).map(z => -z));
  wall(D, R.maxX, 0, -Math.PI / 2, windows.east || []);
  const glassM = new THREE.MeshStandardMaterial({ color: '#dff1ff', roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false });
  for (const [x, ry, zs] of [[R.minX + 0.02, Math.PI / 2, windows.west || []], [R.maxX - 0.02, -Math.PI / 2, windows.east || []]]) {
    for (const z of zs) {
      const yc = (WIN.y0 + WIN.y1) / 2, hh = WIN.y1 - WIN.y0;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, hh), glassM);
      gl.position.set(x, yc, z); gl.rotation.y = ry;
      group.add(gl);
      const f = new THREE.Group();
      f.position.set(x, yc, z); f.rotation.y = ry;
      for (const [fw, fh, fx, fy] of [[WIN.w + 0.1, 0.08, 0, hh / 2], [WIN.w + 0.1, 0.08, 0, -hh / 2], [0.08, hh + 0.1, WIN.w / 2, 0], [0.08, hh + 0.1, -WIN.w / 2, 0], [0.05, hh, 0, 0]]) f.add(at(box(fw, fh, 0.06, wood), fx, fy, 0.03));
      f.add(at(box(WIN.w + 0.2, 0.06, 0.22, wood), 0, -hh / 2 - 0.04, 0.1));
      group.add(f);
    }
  }
  return { surfaces, wood, floorMesh };
}

// The door back out to the hallway, in the middle of the south wall.
export function doorOut({ group, R, makeSign, kind, interactables, color = '#6e472e' }) {
  const wood = std('#7a4e33', { roughness: 0.55 });
  const g = new THREE.Group();
  g.position.set(0, 0, R.maxZ); g.rotation.y = Math.PI;
  for (const s of [-1, 1]) g.add(at(rbox(0.7, 2.25, 0.05, 0.015, std(color, { roughness: 0.55 })), s * 0.36, 1.125, 0.025));
  for (const [w, h, dx, y] of [[0.1, 2.35, -0.77, 1.175], [0.1, 2.35, 0.77, 1.175], [1.64, 0.1, 0, 2.35]]) g.add(at(box(w, h, 0.08, wood), dx, y, 0.04));
  const sign = makeSign([{ text: '⬅ The hallway', size: 100, weight: '700' }], 0.9, 0.24);
  sign.position.set(0, 2.62, 0.04);
  g.add(sign);
  const hit = at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), new THREE.MeshBasicMaterial({ visible: false })), 0, 1.15, 0.1);
  hit.userData = { kind, label: 'Back out to the hallway' };
  g.add(hit); interactables.push(hit);
  group.add(g);
}

export function plant(group, colliders, x, z, s = 1) {
  const p = new THREE.Group();
  p.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.17 * s, 0.4 * s, 18), std('#d8a07a')), 0, 0.2 * s, 0));
  for (let i = 0; i < 9; i++) {
    const a = i * 0.8, leaf = at(new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 10, 8), std('#5f8f52')), Math.cos(a) * 0.14 * s, (0.55 + (i % 3) * 0.16) * s, Math.sin(a) * 0.14 * s);
    leaf.scale.set(0.7, 1.5, 0.7); p.add(leaf);
  }
  group.add(at(p, x, 0, z));
  colliders.push({ type: 'circle', fixed: true, x, z, r: 0.3 * s });
}

// A pendant lamp hanging from the ceiling, with its light.
export function pendant(group, R, x, z, { color = '#fff1d6', light = '#ffd9a6', intensity = 2.4, drop = 0.8 } = {}) {
  group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, drop, 6), std('#333')), x, R.h - drop / 2, z));
  const shadeM = std(color, { emissive: light, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  group.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 24, 1, true), shadeM), x, R.h - drop - 0.08, z));
  const l = new THREE.PointLight(light, intensity, 7, 1.6);
  l.position.set(x, R.h - drop - 0.25, z);
  group.add(l);
  return l;
}
