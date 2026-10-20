// The Prayer Room: a quiet room upstairs, off the hallway. Soft carpet and
// prayer mats in rows facing the qibla wall, a mihrab niche showing the way
// to Makkah, lanterns and low warm light, cushions along the walls for
// sitting and reflecting, a shelf with the Quran on a rehal, today's prayer
// times for Cairo, and a rack for shoes by the door. No chat in here, no
// notes on the walls; the café's music and murmur fade away (see app.js).

import * as THREE from 'three';
import { std, rbox, box, at, plankTex, canvasTex, shell, doorOut } from './roomkit.js';
import { QIBLA_BEARING } from './prayertimes.mjs';

export const PRAYER = { minX: -5.5, maxX: 5.5, minZ: -4.5, maxZ: 4.5, h: 3.4 };
const R = PRAYER;
const rot = (o, axis, v) => { o.rotation[axis] = v; return o; };

const MATS = ['#7c1f2c', '#2f5d3a', '#2f3f6e', '#8a5a2a'];
function matTex(color) {
  return canvasTex(160, 280, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8c98e'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 3; g.strokeRect(18, 18, w - 36, h - 36);
    // the arch, at the end that points to the qibla
    g.fillStyle = 'rgba(255,240,210,0.22)';
    g.beginPath(); g.moveTo(34, 150); g.lineTo(34, 70); g.quadraticCurveTo(34, 30, w / 2, 26); g.quadraticCurveTo(w - 34, 30, w - 34, 70); g.lineTo(w - 34, 150); g.closePath(); g.fill();
    g.strokeStyle = '#e8c98e'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#e8c98e';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(40 + i * 20, 220, 4, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 9; i++) g.fillRect(20 + i * 14, h - 12, 3, 12); // the fringe
  });
}
function starTex() {
  return canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#f6efe3'; g.fillRect(0, 0, w, w);
    const c = w / 2;
    g.strokeStyle = '#c9a46a'; g.lineWidth = 4;
    for (const r of [230, 200]) { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
    // an eight-pointed star, and smaller ones round it
    const star = (cx, cy, r, fill) => {
      g.beginPath();
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * 0.62 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fillStyle = fill; g.fill(); g.stroke();
    };
    star(c, c, 150, '#2f5d6e');
    star(c, c, 70, '#e8c98e');
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; star(c + Math.cos(a) * 178, c + Math.sin(a) * 178, 18, '#2f5d6e'); }
  });
}
function mihrabTex() {
  return canvasTex(400, 640, (g, w, h) => {
    g.fillStyle = '#f1e8da'; g.fillRect(0, 0, w, h);
    const arch = inset => {
      g.beginPath();
      g.moveTo(inset, h); g.lineTo(inset, 250);
      g.quadraticCurveTo(inset, 90 + inset, w / 2, 40 + inset);
      g.quadraticCurveTo(w - inset, 90 + inset, w - inset, 250);
      g.lineTo(w - inset, h); g.closePath();
    };
    arch(20); g.fillStyle = '#c9a46a'; g.fill();
    arch(40); g.fillStyle = '#1f4a52'; g.fill();
    // tiles inside the niche
    g.save(); arch(40); g.clip();
    for (let y = 60; y < h; y += 46) for (let x = 40; x < w; x += 46) {
      g.fillStyle = (x / 46 + y / 46) % 2 < 1 ? '#2f6b72' : '#285c63';
      g.fillRect(x, y, 44, 44);
      g.fillStyle = '#e8c98e'; g.beginPath(); g.arc(x + 22, y + 22, 5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    arch(40); g.strokeStyle = '#f6efe3'; g.lineWidth = 4; g.stroke();
  });
}
function calligraphyTex() {
  return canvasTex(720, 220, (g, w, h) => {
    g.fillStyle = '#1f4a52'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a46a'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#f0d9a8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.font = '600 62px "Amiri", "Noto Naskh Arabic", "Scheherazade New", serif';
    g.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', w / 2, h / 2 + 6);
  });
}

export function buildPrayer({ floor, makeSign }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const lights = [];
  // no notes on these walls: it's a quiet room
  shell({
    group, R, floor, floorMap: plankTex(R, [176, 140, 104], 19),
    wallColor: '#f1e8da', lowColor: '#d9c7a8', ceilColor: '#f6efe3',
    windows: { east: [-1.8], west: [1.8] }, wallsAreSurfaces: false,
  });
  const dark = std('#4a3326', { roughness: 0.6 });
  const seat = (id, label, x, z, ry, h, mesh) => {
    const s = { id: `prayer-${id}`, label, x, z, y: group.position.y, h, ry };
    seats.push(s);
    if (mesh) mesh.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat: s, label: `Sit on ${label}` }; interactables.push(o); } });
    return s;
  };

  // the soft carpet, wall to wall but for a border of floor by the door
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(R.maxX - R.minX - 0.6, R.maxZ - R.minZ - 1.8), std('#ffffff', {
    roughness: 1,
    map: canvasTex(512, 512, (g, w) => {
      g.fillStyle = '#5b7a5f'; g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(232,201,142,0.35)'; g.lineWidth = 2;
      for (let i = 0; i < w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke(); }
    }, [2, 2]),
  }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.005, -0.6); carpet.receiveShadow = true;
  group.add(carpet);

  // the mihrab, in the middle of the qibla wall (north), with columns either side
  {
    const m = at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), new THREE.MeshStandardMaterial({ map: mihrabTex(), roughness: 0.7 })), 0, 1.2, R.minZ + 0.02);
    group.add(m);
    const gold = std('#c9a46a', { metalness: 0.3, roughness: 0.45 });
    for (const s of [-1, 1]) {
      group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.0, 16), std('#e9dcc8', { roughness: 0.6 })), s * 0.84, 1.0, R.minZ + 0.1));
      group.add(at(box(0.18, 0.1, 0.18, gold), s * 0.84, 2.05, R.minZ + 0.1));
      group.add(at(box(0.2, 0.08, 0.2, gold), s * 0.84, 0.04, R.minZ + 0.1));
    }
    const sign = makeSign([
      { text: 'القبلة · Qibla', size: 100, weight: '700' },
      { text: `towards Makkah — ${QIBLA_BEARING}°, south-east of Cairo`, size: 58 },
    ], 1.5, 0.34, { bg: '#f6efe3', border: '#c9a46a' });
    sign.position.set(0, 2.78, R.minZ + 0.03);
    group.add(sign);
    // a soft glow in the niche
    const glow = new THREE.PointLight('#ffd9a6', 1.1, 4, 1.8);
    glow.position.set(0, 1.6, R.minZ + 0.7);
    group.add(glow); lights.push(glow);
  }

  // prayer mats in two rows, all facing the qibla
  const rows = [-2.6, -1.1], cols = [-2.25, -0.75, 0.75, 2.25];
  let n = 0;
  for (const z of rows) for (const x of cols) {
    const mat = at(new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.24), std('#ffffff', { map: matTex(MATS[n % 4]), roughness: 1 })), x, 0.012, z);
    mat.rotation.x = -Math.PI / 2;
    mat.receiveShadow = true;
    group.add(mat);
    seat(`mat-${n}`, 'a prayer mat', x, z + 0.25, Math.PI, 0.1, mat);
    n++;
  }

  // floor cushions along the side walls, for sitting quietly
  ['#e7d3b0', '#c9b3d9', '#b8cfc4'].forEach((c, i) => {
    for (const s of [-1, 1]) {
      const x = s * (R.maxX - 0.55), z = 0.4 + i * 0.95;
      const g = new THREE.Group();
      g.add(at(rbox(0.62, 0.16, 0.62, 0.07, std(c, { roughness: 1 })), 0, 0.08, 0));
      g.add(rot(at(rbox(0.6, 0.42, 0.14, 0.06, std(c, { roughness: 1 })), s * 0.28, 0.3, 0), 'y', Math.PI / 2));
      g.position.set(x, 0, z); group.add(g);
      seat(`cushion-${s < 0 ? 'w' : 'e'}${i}`, 'a floor cushion by the wall', x, z, s < 0 ? Math.PI / 2 : -Math.PI / 2, 0.18, g);
    }
  });

  // lanterns (fanous) hanging low, the room's light
  const lampGlass = std('#ffe2a8', { emissive: '#ffb860', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
  const brass = std('#b08a4a', { metalness: 0.6, roughness: 0.35 });
  for (const [x, z] of [[-2.2, -1.9], [2.2, -1.9], [-2.2, 1.4], [2.2, 1.4]]) {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.9, 6), brass), 0, 0.45, 0));
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 8), brass), 0, -0.04, 0));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.3, 8), lampGlass), 0, -0.26, 0));
    g.add(rot(at(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.1, 8), brass), 0, -0.46, 0), 'x', Math.PI));
    g.position.set(x, R.h - 0.9, z);
    group.add(g);
    const l = new THREE.PointLight('#ffc98a', 1.3, 5.5, 1.7);
    l.position.set(x, R.h - 1.2, z);
    group.add(l); lights.push(l);
  }
  // the ceiling medallion
  const med = at(new THREE.Mesh(new THREE.CircleGeometry(1.5, 64), std('#ffffff', { map: starTex(), roughness: 1 })), 0, R.h - 0.01, -0.4);
  med.rotation.x = Math.PI / 2;
  group.add(med);

  // the calligraphy on the west wall
  const cal = at(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.58), new THREE.MeshStandardMaterial({ map: calligraphyTex(), roughness: 0.6 })), R.minX + 0.02, 2.1, -1.5);
  cal.rotation.y = Math.PI / 2;
  group.add(cal);

  // a low shelf with the Quran on a rehal, and books of reflection
  {
    const g = new THREE.Group();
    g.add(at(rbox(1.5, 0.5, 0.36, 0.02, dark), 0, 0.25, 0));
    ['#2f5d3a', '#7c1f2c', '#2f3f6e', '#8a5a2a', '#2f5d3a', '#5b3a4a'].forEach((c, i) => g.add(at(box(0.07, 0.3, 0.24, std(c)), -0.62 + i * 0.09, 0.15, 0)));
    // the rehal: a folding wooden stand, the book open on it
    const rehal = new THREE.Group();
    for (const s of [-1, 1]) { const leaf = at(box(0.3, 0.02, 0.36, std('#8a5a3a')), s * 0.13, 0.08, 0); leaf.rotation.z = -s * 0.5; rehal.add(leaf); }
    for (const s of [-1, 1]) { const page = at(box(0.24, 0.015, 0.3, std('#f6efe3')), s * 0.12, 0.13, 0); page.rotation.z = -s * 0.42; rehal.add(page); }
    rehal.position.set(0.4, 0.5, 0);
    g.add(rehal);
    g.position.set(R.minX + 0.3, 0, -3.2); g.rotation.y = Math.PI / 2;
    group.add(g);
    colliders.push({ type: 'box', fixed: true, minX: R.minX, maxX: R.minX + 0.5, minZ: -4.0, maxZ: -2.4 });
    const hit = at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 1.6), new THREE.MeshBasicMaterial({ visible: false })), R.minX + 0.3, 0.4, -3.2);
    hit.userData = { kind: 'prayer-read', label: 'The Quran on its rehal, and books for reflection' };
    group.add(hit); interactables.push(hit);
  }

  // today's prayer times, on a board by the door (east wall)
  const timesM = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  {
    const b = at(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), timesM), R.maxX - 0.075, 1.55, 2.6);
    b.rotation.y = -Math.PI / 2;
    group.add(b);
    group.add(at(box(0.04, 1.4, 1.2, dark), R.maxX - 0.04, 1.55, 2.6));
    b.userData = { kind: 'prayer-times', label: "Today's prayer times in Cairo" };
    interactables.push(b);
  }
  function setTimes(day) {
    const t = canvasTex(440, 520, (g, w, h) => {
      g.fillStyle = '#1f4a52'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9a46a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#f0d9a8'; g.textAlign = 'center';
      g.font = 'bold 34px Georgia, serif'; g.fillText('Prayer times · Cairo', w / 2, 62);
      g.font = 'italic 22px Georgia, serif'; g.fillStyle = '#cfe0dc'; g.fillText('today', w / 2, 92);
      day.list.forEach((p, i) => {
        const y = 150 + i * 60, next = p.key === day.next;
        if (next) { g.fillStyle = 'rgba(232,201,142,0.22)'; g.fillRect(30, y - 38, w - 60, 52); }
        g.textAlign = 'left'; g.font = `${next ? 'bold ' : ''}30px Georgia, serif`; g.fillStyle = next ? '#ffe7b0' : '#f6efe3';
        g.fillText(p.en, 50, y);
        g.textAlign = 'center'; g.font = '26px serif'; g.fillStyle = '#cfe0dc'; g.fillText(p.ar, w / 2 + 20, y);
        g.textAlign = 'right'; g.font = `${next ? 'bold ' : ''}30px Georgia, serif`; g.fillStyle = next ? '#ffe7b0' : '#f6efe3';
        g.fillText(p.clock, w - 50, y);
      });
    });
    if (timesM.map) timesM.map.dispose();
    timesM.map = t; timesM.needsUpdate = true;
  }

  // shoes off by the door: a low rack, a few pairs already on it
  {
    const g = new THREE.Group();
    g.add(at(rbox(1.3, 0.04, 0.34, 0.01, dark), 0, 0.42, 0));
    g.add(at(rbox(1.3, 0.04, 0.34, 0.01, dark), 0, 0.12, 0));
    for (const s of [-1, 1]) g.add(at(box(0.04, 0.44, 0.34, dark), s * 0.63, 0.22, 0));
    [['#3a2a22', -0.4, 0.44], ['#e7d3b0', 0.05, 0.44], ['#7c1f2c', 0.4, 0.14], ['#2f3f6e', -0.25, 0.14]].forEach(([c, x, y]) => {
      for (const k of [-1, 1]) g.add(at(rbox(0.1, 0.07, 0.26, 0.03, std(c, { roughness: 0.7 })), x + k * 0.065, y + 0.05, 0));
    });
    g.position.set(-2.3, 0, R.maxZ - 0.25); g.rotation.y = Math.PI;
    group.add(g);
    colliders.push({ type: 'box', fixed: true, minX: -3.0, maxX: -1.6, minZ: R.maxZ - 0.45, maxZ: R.maxZ });
    const sign = makeSign([{ text: 'Shoes off, please 🤍', size: 80 }], 0.8, 0.2);
    sign.position.set(-2.3, 0.85, R.maxZ - 0.03); sign.rotation.y = Math.PI;
    group.add(sign);
  }
  // a hush sign over the door, inside
  {
    const s = makeSign([{ text: 'A quiet room', size: 90, weight: '700' }, { text: 'for prayer and reflection — no chat in here', size: 54 }], 1.5, 0.32, { bg: '#f6efe3', border: '#c9a46a' });
    s.position.set(2.4, 2.1, R.maxZ - 0.03); s.rotation.y = Math.PI;
    group.add(s);
  }
  doorOut({ group, R, makeSign, kind: 'prayer-out', interactables, color: '#8a6a50' });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R, setTimes,
    arrival: { x: 0, z: R.maxZ - 1.4, ry: Math.PI }, // just in from the door, facing the qibla
  };
}
