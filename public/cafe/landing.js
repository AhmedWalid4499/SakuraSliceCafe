// The landings: corridors at the top of the stairs, with a door to each of
// the rooms everyone shares up there. The second floor's (from the upper
// hallway): the Sleepover Room, the Games Room, the BookBeans Library and the
// rest, and the stairs on up to the third floor's — Karaoke, the Escape Room,
// and the stairs up again to the rooftop pool and the observatory. The stairs
// come up at the west end; a window looks out at the east end.
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, plankTex, shell, plant, pendant, sharedDoor } from './roomkit.js';

export const LANDING = { minX: -12, maxX: 12, minZ: -2.2, maxZ: 2.2, h: 3.2 };
const R = LANDING;

// the doors along it: which room, which wall (-1 north, +1 south), where
export const LANDING_DOORS = [
  { room: 'sleepover', x: -7.2, side: -1, color: '#4f7a5a', glass: '#e8e0ff', bg: '#f6eefa', label: 'The Sleepover Room — beds for everyone, and a TV anyone can put on',
    lines: [{ text: 'Sleepover Room', size: 104, weight: '700' }, { text: 'beds · bathroom · TV 🌙', size: 64 }] },
  { room: 'cinema', x: -4.4, side: -1, color: '#7c1f2c', glass: '#ffe7a0', bg: '#16131f', label: 'Up the stairs to the Rooftop Cinema — covered, rain or shine 🎬',
    lines: [{ text: '⬆ Rooftop Cinema', size: 100, weight: '700', color: '#ffd98a' }, { text: 'up the stairs · films 🎬', size: 60, color: '#f4ece0' }] },
  { room: 'games', x: -1.6, side: -1, color: '#2f5d6e', glass: '#d9f2ff', bg: '#e3eef0', label: 'The Games Room — pool, ping-pong, foosball and the game tables',
    lines: [{ text: 'Games Room', size: 110, weight: '700' }, { text: 'pool · ping-pong · baby-foot 🎱', size: 60 }] },
  { room: 'library', x: 4.0, side: -1, color: '#6e472e', glass: '#ffe9c4', bg: '#f3e1d0', label: 'The BookBeans Library — books, armchairs and the writers’ nook',
    lines: [{ text: 'BookBeans Library', size: 100, weight: '700' }, { text: 'books · armchairs · writers’ nook 📚', size: 56 }] },
  { room: 'bakery', x: 9.6, side: -1, color: '#e8c98e', glass: '#fff6e6', bg: '#fbe3ea', label: 'The Kitchen — a baking class: konafa, basbousa, sakura mochi',
    lines: [{ text: 'The Kitchen', size: 110, weight: '700' }, { text: 'baking class 🍰', size: 64 }] },
  { room: 'gym', x: -6.4, side: 1, color: '#93ab8c', glass: '#eaf6ff', bg: '#e3eef0', label: 'The Gym and Yoga Studio — treadmills, bikes, mats and a mirror wall',
    lines: [{ text: 'Gym & Yoga', size: 110, weight: '700' }, { text: 'run · ride · stretch 🧘', size: 62 }] },
  { room: 'art', x: -0.6, side: 1, color: '#c94a4a', glass: '#fff1d6', bg: '#fbf8f2', label: 'The Art Studio — easels, paint, and the gallery wall',
    lines: [{ text: 'Art Studio', size: 110, weight: '700' }, { text: 'paint · hang it up 🎨', size: 62 }] },
  { room: 'laundry', x: 5.2, side: 1, color: '#9fb8d6', glass: '#eaf6ff', bg: '#e3eef0', label: 'The Laundry Room — washing machines and dryers',
    lines: [{ text: 'Laundry', size: 110, weight: '700' }, { text: 'wash · dry · fold 🧺', size: 62 }] },
  { room: 'tearoom', x: 1.2, side: -1, color: '#8a6a4a', glass: '#fbf6ea', bg: '#f4ecd8', label: 'The Japanese Tea Room — tatami, matcha, a branch of sakura',
    lines: [{ text: '茶室 Tea Room', size: 104, weight: '700' }, { text: 'tatami · matcha 🍵', size: 62 }] },
  { room: 'studio', x: 6.8, side: -1, color: '#4a4258', glass: '#ffd0e0', bg: '#16131f', label: 'The Recording Studio — record a book chat or read a story aloud',
    lines: [{ text: 'Studio', size: 110, weight: '700', color: '#f2a7bb' }, { text: 'ON AIR 🎙️', size: 64, color: '#f4ece0' }] },
  { room: 'hammam', x: -3.5, side: 1, color: '#2f6b72', glass: '#e3eef0', bg: '#f4efe8', label: 'The Hammam and Spa — warm marble, steam, robes and cucumber water',
    lines: [{ text: 'Hammam & Spa', size: 104, weight: '700' }, { text: 'steam · marble · rest ♨️', size: 60 }] },
  { room: 'playroom', x: 2.3, side: 1, color: '#e2b04a', glass: '#dff1ff', bg: '#fffaf0', label: 'The Kids’ Playroom — a ball pit, blocks and Hana’s story corner',
    lines: [{ text: 'Playroom', size: 110, weight: '700', color: '#5f8fc4' }, { text: 'ball pit · stories 🧸', size: 62 }] },
  { room: 'post', x: 8.2, side: 1, color: '#7a1f2c', glass: '#f4ecd8', bg: '#f4ecd8', label: 'The Post Room — pigeonholes for every flat, letters between neighbours',
    lines: [{ text: 'Post Room', size: 110, weight: '700' }, { text: 'letters · lost & found 💌', size: 60 }] },
  { room: 'landing3', x: -9.4, side: 1, color: '#5f8fc4', glass: '#eaf6ff', bg: '#e3eef0', label: 'Up the stairs to the third floor — karaoke, the escape room, the pool and the observatory',
    lines: [{ text: '⬆ Third floor', size: 104, weight: '700' }, { text: 'karaoke · escape · pool · stars', size: 54 }] },
];
// …and the third floor's
export const LANDING3_DOORS = [
  { room: 'karaoke', x: -5.0, side: -1, color: '#7a3fa0', glass: '#ffd0f0', bg: '#16131f', label: 'The Karaoke Room — the big screen, the mics and the disco lights 🎤',
    lines: [{ text: 'Karaoke 🎤', size: 110, weight: '700', color: '#ff8ad0' }, { text: 'sing your heart out', size: 60, color: '#f4ece0' }] },
  { room: 'escape', x: 1.6, side: -1, color: '#3a2a20', glass: '#e8c98e', bg: '#e8dcc4', label: 'The Escape Room — the Pharaoh’s Study: solve it before the sand runs out',
    lines: [{ text: 'Escape Room', size: 110, weight: '700' }, { text: 'the Pharaoh’s Study 🔐', size: 60 }] },
  { room: 'pool', x: -3.0, side: 1, color: '#2f8ab0', glass: '#d9f2ff', bg: '#dff1ff', label: 'Up the stairs to the rooftop pool — swim with all of Cairo below 🏊',
    lines: [{ text: '⬆ Rooftop Pool', size: 104, weight: '700' }, { text: 'swim · sun · city views 🌴', size: 58 }] },
  { room: 'observatory', x: 4.4, side: 1, color: '#1b2240', glass: '#c9d2f0', bg: '#1b2240', label: 'Up the stairs to the observatory — the telescope, the moon and the stars 🔭',
    lines: [{ text: '⬆ Observatory', size: 104, weight: '700', color: '#ffe7a0' }, { text: 'telescope · tonight’s sky', size: 58, color: '#c9d2f0' }] },
];

export const buildLanding = args => makeLanding({
  ...args, doors: LANDING_DOORS, prefix: 'landing',
  down: { to: 'hall2', label: 'Down the stairs to the upper hallway', sign: 'the upper hallway · Rooms 15–28' },
  title: [{ text: 'The second floor', size: 110, weight: '700' }, { text: 'everyone’s rooms 🌸', font: 'Dancing Script, cursive', size: 76, color: '#c4627f' }],
});
export const buildLanding3 = args => makeLanding({
  ...args, doors: LANDING3_DOORS, prefix: 'landing3', runner: ['#2f6b8a', '#9fd0e0'], lowColor: '#2f6b8a',
  down: { to: 'landing', label: 'Down the stairs to the second floor', sign: 'the second floor' },
  title: [{ text: 'The third floor', size: 110, weight: '700' }, { text: 'sing · solve · swim · stargaze ✨', font: 'Dancing Script, cursive', size: 70, color: '#2f6b8a' }],
});

function makeLanding({ floor, makeSign, doors, down, title, prefix, runner: RUN = ['#7c5aa0', '#c9b2e0'], lowColor = '#c4627f' }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [150, 108, 76], 91),
    wallColor: '#f1e7dc', lowColor, windows: { east: [0] },
  });
  // a long runner down the middle
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(R.maxX - R.minX - 2, 1.3), std(RUN[0], { roughness: 1 }));
  runner.rotation.x = -Math.PI / 2; runner.position.y = 0.004; runner.receiveShadow = true;
  group.add(runner);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(R.maxX - R.minX - 2.2, 1.1), std(RUN[1], { roughness: 1 }));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.006;
  group.add(inner);

  // the stairs down, through an opening in the west wall
  {
    const x = R.minX + 0.02, SW = 1.6;
    const opening = new THREE.Mesh(new THREE.PlaneGeometry(SW, 2.4), new THREE.MeshBasicMaterial({ color: '#3a2c26' }));
    opening.position.set(x + 0.01, 1.2, 0); opening.rotation.y = Math.PI / 2;
    group.add(opening);
    const wood = std('#7a4e33', { roughness: 0.55 });
    for (const z of [-SW / 2, SW / 2]) group.add(at(box(0.08, 2.4, 0.22, wood), x + 0.05, 1.2, z));
    group.add(at(box(0.08, 0.08, SW + 0.08, wood), x + 0.05, 2.4, 0));
    for (let i = 0; i < 5; i++) group.add(at(rbox(0.28, 0.06, SW - 0.1, 0.02, std('#b58a63', { roughness: 0.6 })), x + 0.25 + i * 0.28, 0.03 - i * 0.001, 0)); // the top steps
    const sign = makeSign([{ text: '⬇ Downstairs', size: 110, weight: '700' }, { text: down.sign, size: 62 }], 1.0, 0.36);
    sign.position.set(x + 0.06, 2.75, 0); sign.rotation.y = Math.PI / 2;
    group.add(sign);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(SW, 2.4), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(x + 0.4, 1.2, 0); hit.rotation.y = Math.PI / 2;
    hit.userData = { kind: 'room-out', to: down.to, label: down.label };
    group.add(hit); interactables.push(hit);
  }

  // the doors
  for (const d of doors) {
    sharedDoor({
      group, makeSign, interactables, x: d.x, z: d.side < 0 ? R.minZ : R.maxZ, ry: d.side < 0 ? 0 : Math.PI,
      color: d.color, glass: d.glass, bg: d.bg, lines: d.lines, data: { kind: 'room-door', to: d.room, label: d.label },
    });
  }

  // the name of the floor, a board of what's where, a bench, plants, lamps
  const name = makeSign(title, 1.4, 0.44, { bg: '#f6eefa' });
  name.position.set(R.maxX - 0.03, 2.9, -1.35); name.rotation.y = -Math.PI / 2; // (high on the end wall, over the board)
  group.add(name);
  const board = makeSign([
    { text: 'What’s up here', size: 92, weight: '700' },
    ...doors.map(d => ({ text: '· ' + d.lines[0].text, size: 60 })),
  ], 1.0, 0.24 + doors.length * 0.12, { bg: '#fbf3ea', border: '#7a4e33' });
  board.position.set(R.maxX - 0.03, 1.6, -1.35); board.rotation.y = -Math.PI / 2;
  group.add(board);
  {
    const b = new THREE.Group();
    b.add(at(rbox(1.5, 0.08, 0.42, 0.03, std('#8a5a3c', { roughness: 0.6 })), 0, 0.45, 0));
    b.add(at(rbox(1.4, 0.08, 0.38, 0.04, std('#c9b2e0', { roughness: 1 })), 0, 0.52, 0));
    for (const s of [-1, 1]) b.add(at(box(0.08, 0.45, 0.38, std('#6e472e')), s * 0.66, 0.225, 0));
    b.position.set(R.maxX - 0.4, 0, 1.0); b.rotation.y = -Math.PI / 2;
    group.add(b);
    colliders.push({ type: 'box', fixed: true, minX: R.maxX - 0.62, maxX: R.maxX, minZ: 0.25, maxZ: 1.75 });
    [0.6, 1.4].forEach((z, i) => {
      const s = { id: `${prefix}-bench-${i}`, label: 'the bench by the window', x: R.maxX - 0.42, z, y: group.position.y, h: 0.52, ry: -Math.PI / 2 };
      seats.push(s);
      if (!i) b.traverse(o => { if (o.isMesh) { o.userData = { kind: 'seat', seat: s, label: 'Sit on the bench' }; interactables.push(o); } });
    });
  }
  plant(group, colliders, R.maxX - 0.45, R.minZ + 0.45, 1.0);
  plant(group, colliders, R.minX + 1.1, R.minZ + 0.4, 0.9);
  const lights = [-8, -2, 4, 9].map(x => pendant(group, R, x, 0, { intensity: 1.8, drop: 0.5 }));

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.3, maxZ: R.maxZ - 0.3 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: R.minX + 1.4, z: 0.2, ry: Math.PI / 2 }, // at the top of the stairs
    // just outside a room's door, facing away from it
    doorFront(room) {
      const d = doors.find(d => d.room === room);
      return d ? { x: d.x, z: d.side < 0 ? R.minZ + 0.9 : R.maxZ - 0.9, ry: d.side < 0 ? 0 : Math.PI } : null;
    },
  };
}
