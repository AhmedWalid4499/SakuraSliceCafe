// The Music Room: upstairs, off the hallway. A little stage with a velvet
// curtain, a mic and a stool (sit on it to take the stage — the spotlight
// comes up), an upright piano and a guitar anyone can play (everyone in the
// room hears it — see app.js), a cajón, and a record player that plays the
// café radio. A sofa, chairs and floor cushions for the audience.
//
// Like common.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, plankTex, canvasTex, shell, doorOut, plant, pendant } from './roomkit.js';

export const MUSIC = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, h: 3.3 };
const R = MUSIC;
const STAGE = { minX: -2.6, maxX: 2.6, minZ: R.minZ, maxZ: R.minZ + 2.0, h: 0.3 };

function recordArt(hue) {
  return canvasTex(256, 256, g => {
    g.fillStyle = `hsl(${hue},45%,62%)`; g.fillRect(0, 0, 256, 256);
    g.fillStyle = `hsl(${(hue + 40) % 360},55%,78%)`;
    for (let i = 0; i < 5; i++) g.fillRect(0, 30 + i * 46, 256, 14);
    g.fillStyle = '#141414'; g.beginPath(); g.arc(150, 128, 92, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
    for (let r = 30; r < 90; r += 7) { g.beginPath(); g.arc(150, 128, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = `hsl(${(hue + 180) % 360},60%,70%)`; g.beginPath(); g.arc(150, 128, 26, 0, Math.PI * 2); g.fill();
  });
}

export function buildMusic({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const lights = [];
  const { surfaces, wood } = shell({
    group, R, floor, floorMap: plankTex(R, [118, 78, 52], 77),
    wallColor: '#e8d6c6', lowColor: '#5b3a4a', ceilColor: '#2d2430',
    windows: { east: [2.6], west: [2.6] },
  });
  const dark = std('#2a1e1a', { roughness: 0.5 });
  const seat = (id, label, x, z, ry, h = 0.48, mesh = null, y = 0) => {
    const s = { id: `music-${id}`, label, x, z, y: group.position.y + y, h, ry };
    seats.push(s);
    if (mesh) mesh.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat: s, label: `Sit on ${label}` }; interactables.push(o); } });
    return s;
  };
  const hitbox = (w, h, d, x, y, z, data) => {
    const m = at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false })), x, y, z);
    m.userData = data; interactables.push(m); group.add(m);
    return m;
  };

  // ── the stage: a low wooden platform, a velvet curtain behind it
  {
    const W = STAGE.maxX - STAGE.minX, D = STAGE.maxZ - STAGE.minZ, cz = (STAGE.minZ + STAGE.maxZ) / 2;
    group.add(at(box(W, STAGE.h, D, std('#4a2f22', { roughness: 0.6 })), 0, STAGE.h / 2, cz));
    group.add(at(box(W + 0.04, 0.05, 0.06, std('#c9a46a', { metalness: 0.4, roughness: 0.4 })), 0, STAGE.h - 0.02, STAGE.maxZ));
    colliders.push({ type: 'box', fixed: true, ...STAGE });
    const velvet = std('#7c1f2c', { roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const x = STAGE.minX + 0.1 + i * (W - 0.2) / 25;
      group.add(at(box(0.2, 2.85, 0.08 + (i % 2) * 0.06, velvet), x, 0.3 + 2.85 / 2, R.minZ + 0.08));
    }
    group.add(at(box(W + 0.3, 0.3, 0.2, std('#5a1520', { roughness: 1 })), 0, R.h - 0.15, R.minZ + 0.12));
    // the stool and the mic
    const stool = new THREE.Group();
    stool.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), std('#2b2b2b')), 0, 0.66, 0));
    for (let k = 0; k < 3; k++) { const a = k * 2.094; const leg = at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.66, 8), std('#b8b8b8', { metalness: 0.7, roughness: 0.3 })), Math.cos(a) * 0.13, 0.33, Math.sin(a) * 0.13); leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); stool.add(leg); }
    stool.position.set(-0.3, STAGE.h, -3.9);
    group.add(stool);
    seat('stage', 'the stool on stage', -0.3, -3.9, 0, 0.62, stool, STAGE.h);
    const mic = new THREE.Group();
    const chrome = std('#c8c8c8', { metalness: 0.8, roughness: 0.25 });
    mic.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20), dark), 0, 0.015, 0));
    mic.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 8), chrome), 0, 0.73, 0));
    mic.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), std('#3a3a3a', { roughness: 0.9 })), 0, 1.5, 0.04));
    mic.position.set(0.25, STAGE.h, -3.45);
    group.add(mic);
    // fairy lights along the curtain rail
    const bulbM = std('#fff3c9', { emissive: '#ffd98a', emissiveIntensity: 1.2 });
    for (let i = 0; i < 22; i++) group.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), bulbM), STAGE.minX + i * W / 21, R.h - 0.36 - Math.abs(Math.sin(i * 0.7)) * 0.1, R.minZ + 0.3));
  }
  // the spotlight: low until someone takes the stage
  const spot = new THREE.SpotLight('#fff0d0', 2, 10, 0.5, 0.5, 1.1);
  spot.position.set(0, R.h - 0.1, -0.8);
  spot.target.position.set(-0.2, STAGE.h + 0.6, -3.8);
  group.add(spot, spot.target);
  const spotCan = at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.26, 16), dark), 0, R.h - 0.13, -0.8);
  spotCan.rotation.x = 0.9;
  group.add(spotCan);
  let stageLit = false, spotK = 0;
  animate(dt => { spotK += ((stageLit ? 1 : 0) - spotK) * Math.min(1, dt * 3); spot.intensity = 2 + spotK * 45; });

  // ── the upright piano, against the west wall
  const piano = new THREE.Group();
  {
    const body = std('#1d1412', { roughness: 0.35 });
    piano.add(at(rbox(0.62, 1.25, 1.55, 0.03, body), 0, 0.625, 0));          // the case
    piano.add(at(rbox(0.36, 0.08, 1.55, 0.02, body), 0.42, 0.74, 0));         // the key bed
    piano.add(at(box(0.16, 0.025, 1.42, std('#f5f1e6', { roughness: 0.4 })), 0.5, 0.79, 0)); // white keys
    // black keys between the white ones: after C, D, F, G and A
    for (let i = 0; i < 19; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) piano.add(at(box(0.09, 0.03, 0.035, body), 0.47, 0.805, -0.71 + (i + 1) * 0.071));
    piano.add(at(box(0.04, 0.4, 0.5, std('#e9dcc0', { roughness: 0.6 })), 0.33, 1.05, 0)); // the music stand, with a page
    piano.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 12), std('#c9a46a', { metalness: 0.5, roughness: 0.4 })), 0, 1.32, -0.55)); // a little lamp
    for (const s of [-1, 1]) piano.add(at(box(0.08, 0.6, 0.08, body), 0.5, 0.3, s * 0.72));
  }
  piano.position.set(R.minX + 0.35, 0, -1.0);
  group.add(piano);
  colliders.push({ type: 'box', fixed: true, minX: R.minX, maxX: R.minX + 0.95, minZ: -1.8, maxZ: -0.2 });
  hitbox(0.9, 1.3, 1.6, R.minX + 0.45, 0.65, -1.0, { kind: 'music-piano', label: 'Play the piano' });
  {
    const bench = new THREE.Group();
    bench.add(at(rbox(0.38, 0.06, 0.9, 0.02, std('#1d1412', { roughness: 0.4 })), 0, 0.48, 0));
    bench.add(at(rbox(0.36, 0.05, 0.86, 0.02, std('#7c1f2c', { roughness: 1 })), 0, 0.53, 0));
    for (const a of [-1, 1]) for (const b of [-1, 1]) bench.add(at(box(0.04, 0.46, 0.04, std('#1d1412')), a * 0.15, 0.23, b * 0.4));
    bench.position.set(R.minX + 1.25, 0, -1.0);
    group.add(bench);
    seat('piano', 'the piano bench', R.minX + 1.22, -1.0, -Math.PI / 2, 0.52, bench);
  }

  // ── the guitar on its stand, and the cajón, either side of the stage
  {
    const g = new THREE.Group();
    const top = std('#c98a4b', { roughness: 0.45 }), back = std('#5a3220', { roughness: 0.5 });
    const lower = at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 28), top), 0, 0.42, 0); lower.rotation.x = Math.PI / 2; g.add(lower);
    const upper = at(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 28), top), 0, 0.7, 0); upper.rotation.x = Math.PI / 2; g.add(upper);
    const hole = at(new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), std('#1a100a')), 0, 0.58, 0.052); g.add(hole);
    g.add(at(box(0.06, 0.62, 0.035, back), 0, 1.08, 0.02));                  // the neck
    g.add(at(box(0.09, 0.16, 0.04, back), 0, 1.45, 0.02));                   // the head
    for (let k = 0; k < 6; k++) g.add(at(box(0.003, 0.95, 0.003, std('#e8e8e8', { metalness: 0.8 })), (k - 2.5) * 0.008, 0.95, 0.06));
    const stand = std('#222', { metalness: 0.4, roughness: 0.5 });
    for (const s of [-1, 1]) { const leg = at(box(0.025, 0.42, 0.025, stand), s * 0.12, 0.21, -0.08); leg.rotation.z = s * 0.3; g.add(leg); }
    g.rotation.x = -0.12;
    g.position.set(3.3, 0, -3.5);
    g.rotation.y = -0.5;
    group.add(g);
    colliders.push({ type: 'circle', fixed: true, x: 3.3, z: -3.5, r: 0.32 });
    hitbox(0.6, 1.6, 0.6, 3.3, 0.8, -3.5, { kind: 'music-guitar', label: 'Play the guitar' });
  }
  {
    const caj = new THREE.Group();
    caj.add(at(rbox(0.32, 0.48, 0.32, 0.02, std('#b5814f', { roughness: 0.55 })), 0, 0.24, 0));
    caj.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), std('#2a1a10')), 0, 0.2, -0.161));
    caj.position.set(-3.3, 0, -3.4);
    group.add(caj);
    colliders.push({ type: 'circle', fixed: true, x: -3.3, z: -3.4, r: 0.28 });
    hitbox(0.45, 0.6, 0.45, -3.3, 0.3, -3.4, { kind: 'music-cajon', label: 'Play the cajón (a box drum)' });
  }

  // ── the record player on a low cabinet (east wall), crates of records, records on the wall
  const platter = new THREE.Group();
  {
    const cab = new THREE.Group();
    cab.add(at(rbox(0.5, 0.72, 1.4, 0.03, std('#8a5a3a', { roughness: 0.6 })), 0, 0.36, 0));
    for (let i = 0; i < 18; i++) cab.add(at(box(0.3, 0.3, 0.012, std(`hsl(${(i * 47) % 360},40%,${45 + (i % 3) * 10}%)`)), -0.05, 0.25, -0.6 + i * 0.07)); // the records, end on
    cab.add(at(rbox(0.42, 0.1, 0.5, 0.02, std('#3a2a22', { roughness: 0.4 })), 0, 0.77, 0.25));            // the turntable
    platter.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.015, 32), std('#111', { roughness: 0.3 })), 0, 0, 0));
    platter.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.017, 20), std('#d4678a')), 0, 0.001, 0));
    platter.add(at(box(0.11, 0.019, 0.01, std('#f4ece0')), 0.09, 0.001, 0)); // a mark, so you see it turn
    platter.position.set(0, 0.83, 0.25);
    cab.add(platter);
    const arm = at(box(0.015, 0.015, 0.22, std('#c8c8c8', { metalness: 0.8 })), -0.15, 0.85, 0.32); arm.rotation.y = 0.35; cab.add(arm);
    cab.position.set(R.maxX - 0.3, 0, -0.7);
    group.add(cab);
    colliders.push({ type: 'box', fixed: true, minX: R.maxX - 0.6, maxX: R.maxX, minZ: -1.45, maxZ: 0.05 });
    hitbox(0.6, 0.95, 1.5, R.maxX - 0.3, 0.5, -0.7, { kind: 'music-records', label: 'The record player — the café radio' });
    [12, 200, 300].forEach((hue, i) => {
      const f = at(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshStandardMaterial({ map: recordArt(hue), roughness: 0.6 })), R.maxX - 0.02, 1.75, -1.5 + i * 0.6);
      f.rotation.y = -Math.PI / 2; group.add(f);
      const fr = at(box(0.03, 0.5, 0.5, dark), R.maxX - 0.03, 1.75, -1.5 + i * 0.6); group.add(fr);
    });
  }
  let spinning = false;
  animate(dt => { if (spinning) platter.rotation.y -= dt * 3.5; });

  // ── felt panels on the walls, for the sound
  const felt = ['#4c6a6a', '#7c4a5a', '#c9a46a', '#3f4d6e'];
  for (const [x, z, ry, n] of [[-4.4, R.minZ + 0.03, 0, 0], [4.4, R.minZ + 0.03, 0, 1], [R.minX + 0.03, 2.6 - 1.6, Math.PI / 2, 2], [R.maxX - 0.03, 2.6 - 1.6, -Math.PI / 2, 3]]) {
    for (let k = 0; k < 2; k++) {
      const p = at(rbox(0.7, 0.7, 0.05, 0.03, std(felt[(n + k) % 4], { roughness: 1 })), x, 1.45 + k * 0.85, z);
      p.rotation.y = ry; group.add(p);
    }
  }

  // ── the audience: a rug, a sofa, two little tables with chairs, cushions
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.2), std('#ffffff', {
    roughness: 1,
    map: canvasTex(512, 300, (g, w, h) => {
      g.fillStyle = '#7a3b3f'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8c98e'; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
      g.fillStyle = '#c9a46a';
      for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(70 + i * 62, 80 + j * 70, 10, 0, Math.PI * 2); g.fill(); }
    }),
  }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.4); rug.receiveShadow = true;
  group.add(rug);
  {
    const sofaM = std('#3f5d6e', { roughness: 1 });
    const g = new THREE.Group();
    g.add(at(rbox(2.6, 0.42, 0.9, 0.12, sofaM), 0, 0.28, 0));
    g.add(at(rbox(2.6, 0.6, 0.22, 0.1, sofaM), 0, 0.7, 0.36));
    for (const s of [-1, 1]) g.add(at(rbox(0.22, 0.58, 0.9, 0.1, sofaM), s * 1.3, 0.48, 0));
    for (const s of [-1, 1]) { const c = at(rbox(0.4, 0.4, 0.13, 0.06, std('#e8c98e', { roughness: 1 })), s * 0.9, 0.76, 0.24); c.rotation.set(-0.25, s * 0.3, 0); g.add(c); }
    g.position.set(0, 0, 2.3);
    group.add(g);
    colliders.push({ type: 'box', fixed: true, minX: -1.4, maxX: 1.4, minZ: 1.85, maxZ: 2.75 });
    for (let i = 0; i < 3; i++) seat(`sofa-${i}`, 'the sofa', (i - 1) * 0.85, 2.2, Math.PI, 0.52, i === 0 ? g : null);
  }
  for (const s of [-1, 1]) {
    const tx = s * 3.9, tz = 1.4;
    const t = new THREE.Group();
    t.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 24), std('#2a1e1a', { roughness: 0.4 })), 0, 0.72, 0));
    t.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 10), dark), 0, 0.36, 0));
    t.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.12, 12), std('#fff1d6', { emissive: '#ffcf8f', emissiveIntensity: 0.8 })), 0, 0.8, 0)); // a candle jar
    t.position.set(tx, 0, tz); group.add(t);
    colliders.push({ type: 'circle', fixed: true, x: tx, z: tz, r: 0.36 });
    for (const k of [-1, 1]) {
      const cx = tx + k * 0.62, ry = Math.PI + (k < 0 ? 0.4 : -0.4) * -s;
      const c = new THREE.Group();
      c.add(at(rbox(0.42, 0.05, 0.42, 0.02, std('#7a4e33', { roughness: 0.6 })), 0, 0.46, 0));
      c.add(at(rbox(0.42, 0.42, 0.04, 0.02, std('#7a4e33', { roughness: 0.6 })), 0, 0.7, 0.2));
      for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(at(box(0.035, 0.46, 0.035, dark), a * 0.18, 0.23, b * 0.18));
      c.position.set(cx, 0, tz + 0.15); c.rotation.y = ry + Math.PI;
      group.add(c);
      seat(`chair-${s < 0 ? 'l' : 'r'}${k < 0 ? 0 : 1}`, 'a chair by the little table', cx, tz + 0.15, ry, 0.48, c);
    }
  }
  ['#d4678a', '#e8c98e', '#93ab8c'].forEach((c, i) => {
    const x = (i - 1) * 1.3, z = -1.6;
    const g = new THREE.Group();
    const cu = at(rbox(0.6, 0.16, 0.6, 0.07, std(c, { roughness: 1 })), 0, 0.08, 0); g.add(cu);
    g.position.set(x, 0, z); group.add(g);
    seat(`cushion-${i}`, 'a floor cushion by the stage', x, z, Math.PI, 0.18, g);
  });

  // ── lamps, plants, the open-mic board by the door, the name over the curtain
  lights.push(pendant(group, R, -2.8, 1.2, { intensity: 3.2 }), pendant(group, R, 2.8, 1.2, { intensity: 3.2 }), pendant(group, R, 0, 3.4, { intensity: 2.4 }));
  plant(group, colliders, R.minX + 0.45, R.maxZ - 0.45, 1.1);
  plant(group, colliders, R.maxX - 0.45, R.maxZ - 0.45, 1.1);
  {
    const board = makeSign([
      { text: '🎤 Open mic', size: 110, weight: '700' },
      { text: 'Thursdays, 8pm — or whenever', size: 62 },
      { text: 'the stage is free. Sit on the', size: 62 },
      { text: 'stool to take it; play the', size: 62 },
      { text: 'piano or the guitar. Be kind.', size: 62 },
    ], 1.0, 0.9, { bg: '#f3e1d0', border: '#7a4e33' });
    board.position.set(2.2, 1.55, R.maxZ - 0.03); board.rotation.y = Math.PI;
    group.add(board);
    const name = makeSign([{ text: 'The Music Room', size: 120, weight: '700' }, { text: 'play something 🎶', font: 'Dancing Script, cursive', size: 80, color: '#c4627f' }], 1.6, 0.42);
    name.position.set(0, 2.92, R.minZ + 0.2);
    group.add(name);
  }
  doorOut({ group, R, makeSign, kind: 'music-out', interactables, color: '#5b3a4a' });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  const worldPos = (x, y, z) => new THREE.Vector3(x, group.position.y + y, z);
  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.5, ry: Math.PI },
    stageSeat: 'music-stage',
    // where each instrument's sound comes from
    soundAt: { piano: worldPos(R.minX + 0.6, 1, -1.0), guitar: worldPos(3.3, 1, -3.5), cajon: worldPos(-3.3, 0.5, -3.4), records: worldPos(R.maxX - 0.3, 1, -0.7) },
    setStage(on) { stageLit = !!on; },
    setSpinning(on) { spinning = !!on; },
  };
}
