// BookBeans Corner: the little coffee-and-books shop next door to the café, at
// street level (in through the sign by the café's front door). Warm wood, a
// coffee counter with an espresso machine and a chalk menu, shelves full of
// books with some face out, armchairs and a window seat, and the "blind date
// with a book" table — books wrapped in brown paper and string, a handwritten
// hint on each. Click the counter for a coffee, the shelves to browse the
// covers, or the table for a blind date (app.js; the books are BB_BOOKS).
//
// Like music.js, world.js hands us a floor ({ group, colliders, seats,
// surfaces, interactables }) and we fill its lists.

import * as THREE from 'three';
import { std, rbox, box, at, canvasTex, plankTex, shell, doorOut, chair, plant, pendant } from './roomkit.js';

export const BOOKBEANS = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, h: 3.4 };
const R = BOOKBEANS;
const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

// The books on the shelves, and on the blind-date table.
export const BB_BOOKS = [
  { title: 'Palace Walk', author: 'Naguib Mahfouz', genre: 'Egyptian classic', mood: 'warm · family · old Cairo', hint: 'a strict father, a house full of secrets, and the alleys of old Cairo ☕', firstLine: 'Before dawn, a mother waits up on the balcony for the sound of her husband coming home.', color: '#8a4a2a' },
  { title: 'Midaq Alley', author: 'Naguib Mahfouz', genre: 'Egyptian classic', mood: 'lively · bittersweet', hint: 'one little street, a café, and everybody’s dreams of getting out 🌙', firstLine: 'A crooked lane of the old city, where the café lamp comes on before the stars do.', color: '#c98a3a' },
  { title: 'Snow Country', author: 'Yasunari Kawabata', genre: 'Japanese literature', mood: 'quiet · wintry · aching', hint: 'a train through a long tunnel, a hot-spring town, a love that melts like snow ❄️', firstLine: 'The train comes out of the tunnel and the whole world on the other side is white.', color: '#9fb8d6' },
  { title: 'Kitchen', author: 'Banana Yoshimoto', genre: 'Japanese literature', mood: 'gentle · healing', hint: 'grief, midnight cooking, and the kindest strangers you’ll ever meet 🍜', firstLine: 'The place she loves most in all the world is a kitchen — any kitchen, humming in the night.', color: '#e8b44a' },
  { title: 'Norwegian Wood', author: 'Haruki Murakami', genre: 'Japanese literature', mood: 'nostalgic · melancholy', hint: 'an old song on a plane, and a whole lost summer comes flooding back 🎶', firstLine: 'A song plays on a landing plane, and suddenly he is nineteen again in a meadow.', color: '#3e5a4a' },
  { title: 'Before the Coffee Gets Cold', author: 'Toshikazu Kawaguchi', genre: 'cosy', mood: 'tender · magical', hint: 'a tiny café, one special chair, and a journey that lasts one cup ☕⏳', firstLine: 'In a basement café with no windows, one seat can carry you back in time — if you follow the rules.', color: '#6e472e' },
  { title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', genre: 'classic', mood: 'wise · whimsical', hint: 'a pilot, a desert, a boy from a very small planet, and one rose 🌹', firstLine: 'A stranded pilot is asked, very politely, to draw a sheep.', color: '#2f6b8a' },
  { title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'romance', mood: 'witty · swoony', hint: 'five sisters, one proud gentleman, and a first impression that is very, very wrong 💌', firstLine: 'Everyone agrees a rich single man must be in want of a wife — especially the neighbours.', color: '#c4627f' },
  { title: 'Jane Eyre', author: 'Charlotte Brontë', genre: 'romance', mood: 'gothic · brave', hint: 'a plain governess with a fierce heart, a dark house, and a secret in the attic 🕯️', firstLine: 'There is no walk to be had that cold, grey day — so a girl hides behind a curtain with a book.', color: '#4a2a3a' },
  { title: 'And Then There Were None', author: 'Agatha Christie', genre: 'mystery', mood: 'tense · clever', hint: 'ten strangers, one island, a nursery rhyme… and fewer of them every night 🔍', firstLine: 'Ten guests arrive on an island to find their host has not come — only a strange little poem.', color: '#2a2a3a' },
  { title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', genre: 'mystery', mood: 'foggy · thrilling', hint: 'a legend, the moors at night, and a detective who never misses a footprint 🐾', firstLine: 'A walking stick is left behind, and from it alone a great detective reads a whole life.', color: '#5a4a2a' },
  { title: 'The Hobbit', author: 'J. R. R. Tolkien', genre: 'fantasy', mood: 'cosy · adventurous', hint: 'a very comfortable homebody, thirteen surprise guests, and a dragon’s gold 🐉', firstLine: 'In a snug round hole under a hill lives someone who very much does not want an adventure.', color: '#6e8f5a' },
  { title: 'Howl’s Moving Castle', author: 'Diana Wynne Jones', genre: 'fantasy', mood: 'funny · magical', hint: 'a hatter cursed old overnight, a fire demon, and a castle that walks 🏰', firstLine: 'Being the eldest of three sisters, she knows she is the one who will never have the adventure.', color: '#7c5aa0' },
  { title: 'Anne of Green Gables', author: 'L. M. Montgomery', genre: 'cosy', mood: 'sunny · heartwarming', hint: 'a red-haired chatterbox, a farm that wanted a boy, and so much imagination 🍎', firstLine: 'The farm sent for an orphan boy — and at the station waits a freckled girl with a carpetbag.', color: '#d9a35a' },
  { title: 'Little Women', author: 'Louisa May Alcott', genre: 'classic', mood: 'warm · sisterly', hint: 'four sisters, one winter, big dreams and burnt hair 🎄', firstLine: 'Christmas won’t be Christmas without presents, grumbles one sister by the fire.', color: '#a04a4a' },
  { title: 'The Essential Rumi', author: 'Rumi', genre: 'poetry', mood: 'spiritual · luminous', hint: 'love, longing and dancing — 800 years old and still glowing ✨', firstLine: 'Listen to the reed flute, and how it tells the story of being cut from the reed bed.', color: '#1f3a5a' },
  { title: 'The Prophet', author: 'Kahlil Gibran', genre: 'poetry', mood: 'wise · gentle', hint: 'a ship comes to take a wise man home, and the townsfolk ask him about everything 🌊', firstLine: 'For twelve years a stranger has waited in a harbour city for the ship that will take him home.', color: '#8a6a4a' },
  { title: 'The Alchemist', author: 'Paulo Coelho', genre: 'fable', mood: 'hopeful · dreamy', hint: 'a shepherd’s dream, the Egyptian desert, and treasure at the pyramids 🐪', firstLine: 'A shepherd boy dreams the same dream twice, beneath a sycamore in a ruined church.', color: '#c98a3a' },
];

const MOTIF = { 'Egyptian classic': 'lantern', 'Japanese literature': 'blossom', cosy: 'cup', classic: 'star', romance: 'heart', mystery: 'key', fantasy: 'moon', poetry: 'feather', fable: 'sun' };

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function wrap(g, text, x, y, maxW, lineH, maxLines = 4) {
  const words = String(text || '').split(/\s+/);
  let line = '', n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { if (++n >= maxLines) { g.fillText(line + '…', x, y); return y + lineH; } g.fillText(line, x, y); y += lineH; line = w; } else line = test;
  }
  if (line) { g.fillText(line, x, y); y += lineH; }
  return y;
}
function motif(g, kind, x, y, s) {
  g.save(); g.translate(x, y); g.fillStyle = 'rgba(255,240,220,.92)'; g.strokeStyle = 'rgba(255,240,220,.92)'; g.lineWidth = s * 0.08;
  if (kind === 'blossom') { for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; g.beginPath(); g.ellipse(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42, s * 0.36, s * 0.24, a, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#ffe7a0'; g.beginPath(); g.arc(0, 0, s * 0.15, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'heart') { g.beginPath(); g.moveTo(0, s * 0.5); g.bezierCurveTo(-s, -s * 0.1, -s * 0.4, -s * 0.8, 0, -s * 0.25); g.bezierCurveTo(s * 0.4, -s * 0.8, s, -s * 0.1, 0, s * 0.5); g.fill(); }
  else if (kind === 'moon') { g.beginPath(); g.arc(0, 0, s * 0.6, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(s * 0.28, -s * 0.12, s * 0.52, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'star' || kind === 'sun') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * (kind === 'sun' ? 0.45 : 0.25) : s * 0.62; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }
  else if (kind === 'cup') { g.beginPath(); g.roundRect(-s * 0.45, -s * 0.2, s * 0.75, s * 0.6, s * 0.12); g.fill(); g.beginPath(); g.arc(s * 0.36, s * 0.08, s * 0.17, -Math.PI / 2, Math.PI / 2); g.stroke(); for (const dx of [-0.2, 0, 0.2]) { g.beginPath(); g.moveTo(dx * s - s * 0.05, -s * 0.3); g.quadraticCurveTo(dx * s + s * 0.1, -s * 0.5, dx * s - s * 0.05, -s * 0.7); g.stroke(); } }
  else if (kind === 'key') { g.beginPath(); g.arc(-s * 0.3, 0, s * 0.25, 0, Math.PI * 2); g.stroke(); g.fillRect(-s * 0.05, -s * 0.05, s * 0.7, s * 0.1); g.fillRect(s * 0.45, 0, s * 0.08, s * 0.22); g.fillRect(s * 0.28, 0, s * 0.08, s * 0.16); }
  else if (kind === 'feather') { g.rotate(-0.6); g.beginPath(); g.ellipse(0, 0, s * 0.2, s * 0.65, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(0, s * 0.8); g.lineTo(0, -s * 0.6); g.stroke(); }
  else { // a fanous lantern
    g.beginPath(); g.moveTo(-s * 0.3, -s * 0.3); g.lineTo(s * 0.3, -s * 0.3); g.lineTo(s * 0.4, s * 0.25); g.lineTo(0, s * 0.6); g.lineTo(-s * 0.4, s * 0.25); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-s * 0.2, -s * 0.3); g.lineTo(0, -s * 0.62); g.lineTo(s * 0.2, -s * 0.3); g.fill(); g.fillStyle = '#ffe7a0'; g.beginPath(); g.arc(0, s * 0.05, s * 0.12, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// A pretty generated cover: the colour, a motif for its genre, the title and author.
function coverCanvas(book, w = 180, h = 270) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w * 0.4, h); gr.addColorStop(0, shadeHex(book.color, 0.18)); gr.addColorStop(1, shadeHex(book.color, -0.35));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, w * 0.05, h); // the spine's shadow
  g.strokeStyle = 'rgba(255,240,220,.6)'; g.lineWidth = Math.max(1.5, w / 90); g.strokeRect(w * 0.09, h * 0.05, w * 0.84, h * 0.9);
  motif(g, MOTIF[book.genre] || 'star', w / 2, h * 0.62, w * 0.2);
  g.fillStyle = '#fffaf0'; g.textAlign = 'center';
  g.font = `bold ${Math.round(w * 0.12)}px Georgia, serif`;
  wrap(g, book.title, w / 2 + w * 0.02, h * 0.2, w * 0.72, w * 0.135, 3);
  g.font = `italic ${Math.round(w * 0.075)}px Georgia, serif`; g.fillStyle = 'rgba(255,240,220,.9)';
  g.fillText(book.author, w / 2 + w * 0.02, h * 0.88);
  return c;
}
export function coverDataURL(book, w = 180, h = 270) { return coverCanvas(book, w, h).toDataURL(); }
function coverTexture(book) { const t = new THREE.CanvasTexture(coverCanvas(book, 256, 384)); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function buildBookbeans({ floor, makeSign, animate }) {
  const group = floor.group;
  const colliders = [], seats = [], interactables = [];
  const { surfaces } = shell({
    group, R, floor, floorMap: plankTex(R, [160, 112, 74], 17),
    wallColor: '#f4e6d2', lowColor: '#3f5a46', ceilColor: '#fbf3ea', windows: { west: [-1.6, 2.0] },
  });
  const clickable = (o, data) => { o.traverse(m => { if (m.isMesh) { m.userData = data; interactables.push(m); } }); return o; };
  const block = (x, z, w, d) => colliders.push({ type: 'box', fixed: true, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const fy = group.position.y;
  const wood = std('#8a5a36', { roughness: 0.55 }), darkWood = std('#4a3020', { roughness: 0.5 });
  const chrome = std('#d0d4d8', { metalness: 0.85, roughness: 0.22 }), brass = std('#c9a25b', { metalness: 0.75, roughness: 0.3 });
  const cream = std('#fbf6ea', { roughness: 0.45 });
  const lights = [];
  const CZ = R.minZ + 0.95; // the counter's front line

  // ── the coffee counter, along the north wall on the left
  {
    const counter = new THREE.Group();
    counter.add(at(rbox(4.8, 1.0, 0.7, 0.03, std('#6e472e', { roughness: 0.6 })), 0, 0.5, 0));
    for (let i = 0; i < 8; i++) counter.add(at(box(0.04, 0.8, 0.02, std('#5a3a24', { roughness: 0.6 })), -2.2 + i * 0.63, 0.5, 0.36)); // panelling
    counter.add(at(rbox(4.95, 0.06, 0.8, 0.02, std('#e8dcc8', { roughness: 0.3 })), 0, 1.03, 0)); // the top
    // the espresso machine
    const em = new THREE.Group();
    em.add(at(rbox(0.8, 0.46, 0.46, 0.05, std('#c4627f', { roughness: 0.3, metalness: 0.3 })), 0, 0.23, 0));
    em.add(at(rbox(0.82, 0.05, 0.48, 0.02, chrome), 0, 0.48, 0));
    for (const x of [-0.2, 0.2]) { em.add(at(cyl(0.05, 0.05, 0.08, chrome, 14), x, 0.1, 0.25)); em.add(at(cyl(0.012, 0.012, 0.14, darkWood, 8).rotateX(Math.PI / 2), x, 0.08, 0.34)); }
    em.add(at(cyl(0.008, 0.008, 0.2, chrome, 6), 0.36, 0.2, 0.22).rotateZ(0.3));
    for (const x of [-0.25, 0, 0.25]) em.add(at(cyl(0.035, 0.03, 0.06, cream, 12), x, 0.54, 0)); // cups warming on top
    em.add(at(cyl(0.04, 0.04, 0.01, chrome, 16), -0.3, 0.32, 0.235).rotateX(Math.PI / 2));
    em.position.set(-1.1, 1.06, -0.05); counter.add(em);
    // the grinder, the till, a cake stand under a dome, a jar of biscotti, cups
    const gr = new THREE.Group();
    gr.add(at(rbox(0.2, 0.32, 0.22, 0.03, std('#2a2a2a', { roughness: 0.35 })), 0, 0.16, 0));
    gr.add(at(cyl(0.1, 0.06, 0.18, std('#c9a25b', { transparent: true, opacity: 0.6, roughness: 0.1 }), 14), 0, 0.42, 0));
    gr.position.set(-0.3, 1.06, -0.05); counter.add(gr);
    counter.add(at(rbox(0.32, 0.18, 0.26, 0.03, std('#3a3a3a', { roughness: 0.4 })), 1.85, 1.15, -0.05));
    counter.add(at(cyl(0.2, 0.2, 0.02, cream, 20), 0.75, 1.07, 0.1));
    counter.add(at(cyl(0.03, 0.04, 0.12, cream, 10), 0.75, 1.13, 0.1));
    counter.add(at(cyl(0.18, 0.18, 0.02, cream, 20), 0.75, 1.2, 0.1));
    for (let i = 0; i < 4; i++) { const sl = at(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 20, 1, false, i * 1.5, 1.2), std(['#d9a35a', '#5a3020', '#f2c6d0', '#e8dcc4'][i], { roughness: 0.7 })), 0.75, 1.25, 0.1); counter.add(sl); }
    counter.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff', { transparent: true, opacity: 0.25, roughness: 0.05 })), 0.75, 1.21, 0.1));
    counter.add(at(cyl(0.08, 0.08, 0.22, std('#ffffff', { transparent: true, opacity: 0.4, roughness: 0.05 }), 14), 1.35, 1.17, 0.12));
    for (let i = 0; i < 6; i++) counter.add(at(cyl(0.012, 0.012, 0.16, std('#d9b07a'), 6), 1.35 + (i % 3 - 1) * 0.03, 1.17, 0.12 + (i > 2 ? 0.02 : -0.02)).rotateZ((i - 2.5) * 0.06));
    for (let i = 0; i < 4; i++) counter.add(at(cyl(0.045, 0.035, 0.1, std(i % 2 ? '#fbf6ea' : '#3e5a4a', { roughness: 0.4 }), 12), -2.1 + (i % 2) * 0.12, 1.11 + Math.floor(i / 2) * 0.1, 0.05));
    counter.position.set(-2.95, 0, CZ); group.add(counter);
    clickable(counter, { kind: 'bb-counter', label: 'The counter — order a coffee ☕' });
    block(-2.95, CZ, 5.0, 0.85);
    // behind it: shelves of jars and mugs, and the chalk menu
    const back = new THREE.Group();
    for (const y of [1.45, 1.85]) back.add(at(box(4.6, 0.04, 0.28, wood), 0, y, 0));
    const JAR = ['#6e472e', '#3a2a20', '#c98a3a', '#8a5a36'];
    for (let i = 0; i < 12; i++) { const y = i < 6 ? 1.47 : 1.87; const x = -2.0 + (i % 6) * 0.8; back.add(at(cyl(0.08, 0.08, 0.22, std('#ffffff', { transparent: true, opacity: 0.35, roughness: 0.05 }), 14), x, y + 0.11, 0)); back.add(at(cyl(0.07, 0.07, 0.14, std(JAR[i % 4], { roughness: 1 }), 12), x, y + 0.08, 0)); back.add(at(cyl(0.083, 0.083, 0.03, darkWood, 14), x, y + 0.235, 0)); }
    back.position.set(-2.95, 0, R.minZ + 0.16); group.add(back);
    const menu = makeSign([
      { text: 'BookBeans', font: 'Dancing Script, cursive', size: 110, weight: '700', color: '#f4ece0' },
      { text: 'BookBeans Latte · 75', size: 60, color: '#ffe7a0' },
      { text: 'Cardamom Coffee · 60', size: 60, color: '#f4ece0' },
      { text: 'Hot Chocolate · 70', size: 60, color: '#f4ece0' },
      { text: 'Karak Tea · 55', size: 60, color: '#f4ece0' },
    ], 2.2, 1.0, { bg: '#24372c', border: '#6e472e' });
    menu.position.set(-2.95, 2.6, R.minZ + 0.04); group.add(menu);
  }
  lights.push(pendant(group, R, -3.8, CZ + 0.15, { intensity: 1.6, drop: 0.9 }));
  lights.push(pendant(group, R, -2.0, CZ + 0.15, { intensity: 1.6, drop: 0.9 }));

  // ── the big sign: a coffee bean and an open book
  {
    const tex = canvasTex(1024, 384, (g, w, h) => {
      g.fillStyle = '#3f5a46'; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 40); g.fill();
      g.strokeStyle = '#e8c98e'; g.lineWidth = 8; g.beginPath(); g.roundRect(24, 24, w - 48, h - 48, 30); g.stroke();
      // the open book
      g.fillStyle = '#fbf6ea';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(190, 250); g.quadraticCurveTo(190 + s * 60, 220, 190 + s * 120, 236); g.lineTo(190 + s * 120, 140); g.quadraticCurveTo(190 + s * 60, 124, 190, 154); g.closePath(); g.fill(); }
      g.strokeStyle = '#c9b49a'; g.lineWidth = 3; for (let k = 0; k < 3; k++) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(190 + s * 20, 175 + k * 22); g.lineTo(190 + s * 100, 168 + k * 22); g.stroke(); }
      // the bean, sitting on it
      g.save(); g.translate(190, 118); g.rotate(-0.5); g.fillStyle = '#6e472e'; g.beginPath(); g.ellipse(0, 0, 36, 52, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a2214'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(-16, -15, 16, 15, 0, 46); g.stroke(); g.restore();
      g.fillStyle = '#fbf6ea'; g.textAlign = 'left'; g.font = 'bold 128px Georgia, serif'; g.fillText('BookBeans', 340, 205);
      g.fillStyle = '#e8c98e'; g.font = 'italic 52px Georgia, serif'; g.fillText('coffee · books · corners', 348, 280);
    });
    const sign = at(new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.125), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 })), 2.9, 2.55, R.minZ + 0.03);
    group.add(sign);
  }

  // ── the shelves: the whole east wall, and low ones under the sign
  const SPINE = ['#7c2f3a', '#2f6b8a', '#6e8f5a', '#c98a3a', '#3a3a5a', '#c4627f', '#e8dcc4', '#4a3020', '#8a6aa0', '#d9a35a'];
  let bi = 0;
  const shelfUnit = (x, z, ry, w, hgt, rows, faceOut) => {
    const g = new THREE.Group();
    g.add(at(box(w, hgt, 0.04, darkWood), 0, hgt / 2, -0.17));
    for (const s of [-1, 1]) g.add(at(box(0.05, hgt, 0.38, wood), s * (w / 2 - 0.025), hgt / 2, 0));
    const gap = (hgt - 0.1) / rows;
    for (let k = 0; k <= rows; k++) g.add(at(box(w, 0.04, 0.38, wood), 0, 0.05 + k * gap, 0));
    let s = Math.round(x * 31 + z * 17 + 7);
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < rows; k++) {
      let bx = -w / 2 + 0.08;
      const fo = faceOut && (k % 2 === 1);
      while (bx < w / 2 - 0.1) {
        if (fo && r() < 0.35 && bx < w / 2 - 0.36) { // a book face out, its cover showing
          const book = BB_BOOKS[bi++ % BB_BOOKS.length];
          const m = new THREE.MeshStandardMaterial({ map: coverTexture(book), roughness: 0.6 });
          const side = std(book.color, { roughness: 0.7 });
          const c = at(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.025), [side, side, side, side, m, side]), bx + 0.13, 0.07 + k * gap + 0.175, 0.08);
          c.rotation.x = -0.12; g.add(c); bx += 0.3; continue;
        }
        const bw = 0.035 + r() * 0.045, bh = Math.min(gap - 0.06, 0.24 + r() * 0.14);
        if (r() < 0.06) { bx += 0.1; continue; }
        const b = at(box(bw, bh, 0.22 + r() * 0.08, std(SPINE[Math.floor(r() * SPINE.length)], { roughness: 0.8 })), bx + bw / 2, 0.07 + k * gap + bh / 2, 0.02);
        if (r() < 0.05) b.rotation.z = 0.22;
        g.add(b); bx += bw + 0.004;
      }
    }
    g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    return g;
  };
  const east = [];
  for (const z of [-3.6, -1.4, 0.8, 3.0]) east.push(shelfUnit(R.maxX - 0.22, z, -Math.PI / 2, 2.1, 2.7, 5, true));
  east.push(shelfUnit(2.9, R.minZ + 0.22, 0, 3.0, 1.2, 2, true));
  for (const g of east) clickable(g, { kind: 'bb-browse', label: 'Browse the shelves 📚' });
  for (const z of [-3.6, -1.4, 0.8, 3.0]) block(R.maxX - 0.22, z, 0.44, 2.1);
  block(2.9, R.minZ + 0.22, 3.0, 0.44);
  const browse = makeSign([{ text: 'Browse the shelves', size: 100, weight: '700' }, { text: 'staff picks face out 📚', size: 64, color: '#c4627f' }], 1.3, 0.34, { bg: '#fbf6ea', border: '#6e472e' });
  browse.position.set(R.maxX - 0.03, 2.95, -0.3); browse.rotation.y = -Math.PI / 2; group.add(browse);

  // ── the blind-date table: wrapped books with string and a handwritten hint
  {
    const BX = 2.2, BZ = -0.5;
    const t = new THREE.Group();
    t.add(at(rbox(2.0, 0.06, 1.0, 0.02, wood), 0, 0.82, 0));
    for (const a of [-1, 1]) for (const b of [-1, 1]) t.add(at(box(0.06, 0.8, 0.06, darkWood), a * 0.9, 0.4, b * 0.42));
    t.add(at(box(1.9, 0.02, 0.6, std('#c4627f', { roughness: 1 })), 0, 0.855, 0)); // a runner
    const paperTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#c9a272'; g.fillRect(0, 0, w, h);
      let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,60,30,.18)' : 'rgba(255,240,210,.18)'; g.fillRect(r() * w, r() * h, 2, 2); }
    });
    const paperM = std('#ffffff', { map: paperTex, roughness: 1 });
    const stringM = std('#f4ece0', { roughness: 1 });
    const HINTS = ['tears & tea', 'magic!', 'a mystery', 'swoon 💕', 'old Cairo', 'cosy ☕', 'snow & longing', 'adventure'];
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Group();
      const bw = 0.24, bh = 0.06 + (i % 3) * 0.012, bd = 0.33;
      b.add(at(rbox(bw, bh, bd, 0.006, paperM), 0, bh / 2, 0));
      b.add(at(box(bw + 0.004, bh + 0.004, 0.012, stringM), 0, bh / 2, 0));
      b.add(at(box(0.012, bh + 0.004, bd + 0.004, stringM), 0, bh / 2, 0));
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h); g.fillStyle = '#6e472e'; g.textAlign = 'center'; g.font = 'italic 40px Georgia, serif'; g.fillText(HINTS[i], w / 2, 78); }) }));
      tag.rotation.x = -Math.PI / 2; tag.position.set(0.0, bh + 0.002, 0.09); tag.rotation.z = (i % 2 ? 0.15 : -0.12);
      b.add(tag);
      const row = Math.floor(i / 4), col = i % 4;
      b.position.set(-0.72 + col * 0.48, 0.86, -0.2 + row * 0.4); b.rotation.y = ((i * 37) % 5 - 2) * 0.08;
      if (i === 2) { const top = b.clone(); top.position.y += bh + 0.002; top.rotation.y += 0.3; t.add(top); }
      t.add(b);
    }
    const card = makeSign([{ text: 'Blind date', font: 'Dancing Script, cursive', size: 110, weight: '700', color: '#c4627f' }, { text: 'with a book 💌', size: 70 }], 0.6, 0.3, { bg: '#fffaf0', border: '#c4627f' });
    card.position.set(0, 1.08, 0.1); card.rotation.x = -0.15; t.add(card);
    t.position.set(BX, 0, BZ); group.add(t);
    clickable(t, { kind: 'bb-blind', label: 'Blind date with a book 💌' });
    block(BX, BZ, 2.05, 1.05);
    lights.push(pendant(group, R, BX, BZ, { intensity: 1.8, drop: 1.0, color: '#f2c6d0' }));
  }

  // ── somewhere to sit: a window seat, two armchairs round a little table, a café table
  {
    // the window seat, under the north-west window
    const ws = new THREE.Group();
    ws.add(at(rbox(1.7, 0.42, 0.55, 0.05, wood), 0, 0.21, 0));
    ws.add(at(rbox(1.6, 0.12, 0.5, 0.05, std('#c4627f', { roughness: 1 })), 0, 0.48, 0));
    for (let i = 0; i < 3; i++) ws.add(at(rbox(0.42, 0.34, 0.12, 0.06, std(['#f2c6d0', '#e8dcc4', '#9fb8d6'][i], { roughness: 1 })), -0.55 + i * 0.55, 0.7, -0.2));
    ws.position.set(R.minX + 0.3, 0, -1.6); ws.rotation.y = Math.PI / 2; group.add(ws);
    const s0 = { id: 'bb-window-0', label: 'the window seat', x: R.minX + 0.42, z: -2.0, y: fy, h: 0.54, ry: Math.PI / 2 };
    const s1 = { id: 'bb-window-1', label: 'the window seat', x: R.minX + 0.42, z: -1.2, y: fy, h: 0.54, ry: Math.PI / 2 };
    seats.push(s0, s1);
    clickable(ws, { kind: 'seat', seat: s0, label: 'Curl up on the window seat with a book' });
    block(R.minX + 0.3, -1.6, 0.6, 1.7);
  }
  const armM = std('#8a6aa0', { roughness: 0.95 }), armM2 = std('#d9a35a', { roughness: 0.95 });
  [[R.minX + 0.85, 2.0, Math.PI / 2, armM], [-3.15, 2.0, -Math.PI / 2, armM2]].forEach(([x, z, ry, m], i) => {
    const c = new THREE.Group();
    c.add(at(rbox(0.8, 0.38, 0.76, 0.1, m), 0, 0.22, 0));
    c.add(at(rbox(0.68, 0.14, 0.6, 0.06, std('#fbf6ea', { roughness: 1 })), 0, 0.46, 0.04));
    c.add(at(rbox(0.8, 0.7, 0.18, 0.08, m), 0, 0.68, -0.3));
    for (const s of [-1, 1]) c.add(at(rbox(0.14, 0.5, 0.72, 0.06, m), s * 0.39, 0.5, 0));
    c.position.set(x, 0, z); c.rotation.y = ry; group.add(c);
    const seat = { id: `bb-arm-${i}`, label: 'an armchair', x, z, y: fy, h: 0.5, ry };
    seats.push(seat);
    clickable(c, { kind: 'seat', seat, label: 'Sink into an armchair' });
    block(x, z, 0.82, 0.82);
  });
  {
    const t = new THREE.Group();
    t.add(at(cyl(0.34, 0.34, 0.04, wood, 24), 0, 0.5, 0));
    t.add(at(cyl(0.05, 0.07, 0.48, darkWood, 10), 0, 0.25, 0));
    t.add(at(cyl(0.22, 0.24, 0.03, darkWood, 18), 0, 0.015, 0));
    t.add(at(cyl(0.045, 0.035, 0.08, cream, 14), 0.1, 0.56, 0.05));
    t.add(at(cyl(0.04, 0.04, 0.005, std('#8a5a32'), 14), 0.1, 0.598, 0.05));
    t.add(at(rbox(0.17, 0.035, 0.24, 0.01, std('#2f6b8a')), -0.1, 0.54, -0.04));
    t.position.set(-4.15, 0, 2.0); group.add(t);
    block(-4.15, 2.0, 0.7, 0.7);
    // a rug under them
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), std('#ffffff', { map: canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#3f5a46'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8c98e'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24); g.fillStyle = '#c4627f'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(40 + i * 44, h / 2, 10, 0, Math.PI * 2); g.fill(); } }), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-4.15, 0.005, 2.0); rug.receiveShadow = true; group.add(rug);
  }
  {
    // a café table for two, in the middle
    const t = new THREE.Group();
    t.add(at(cyl(0.36, 0.36, 0.04, std('#e8dcc8', { roughness: 0.3 }), 24), 0, 0.74, 0));
    t.add(at(cyl(0.04, 0.04, 0.72, darkWood, 10), 0, 0.37, 0));
    t.add(at(cyl(0.22, 0.24, 0.03, darkWood, 18), 0, 0.015, 0));
    t.add(at(cyl(0.03, 0.04, 0.12, std('#fbf6ea', { roughness: 0.3 }), 10), 0, 0.82, 0));
    t.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std('#f2a7bb')), 0, 0.92, 0));
    t.position.set(-1.1, 0, 0.6); group.add(t);
    block(-1.1, 0.6, 0.75, 0.75);
    chair(group, seats, interactables, { id: 'bb-chair-0', label: 'a chair at the café table', x: -1.1, z: 0.0, ry: 0, color: '#3f5a46', y0: fy });
    chair(group, seats, interactables, { id: 'bb-chair-1', label: 'a chair at the café table', x: -1.1, z: 1.2, ry: Math.PI, color: '#3f5a46', y0: fy });
    lights.push(pendant(group, R, -2.6, 1.6, { intensity: 1.6, drop: 0.9 }));
  }
  plant(group, colliders, R.minX + 0.5, R.maxZ - 0.5, 1.1);
  plant(group, colliders, R.maxX - 0.6, R.maxZ - 0.55, 1.0);
  plant(group, colliders, 0.9, R.minZ + 0.55, 0.8);
  // a welcome mat, and a little stand of postcards by the door
  {
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), std('#6e472e', { roughness: 1 }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.006, R.maxZ - 0.6); group.add(mat);
  }

  doorOut({ group, R, makeSign, interactables, color: '#3f5a46', to: 'main', sign: '⬅ Back to Sakura Slice', label: 'Back next door to Sakura Slice Café' });

  // the steam off the cups by the machine
  const steam = [];
  for (let i = 0; i < 6; i++) { const s = at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false })), -4.05 + (i % 3) * 0.25, 1.7, CZ - 0.05); group.add(s); steam.push({ s, p: i * 0.7 }); }
  animate?.((dt, t) => {
    steam.forEach(o => { const k = ((t * 0.4 + o.p) % 1); o.s.position.y = 1.66 + k * 0.4; o.s.material.opacity = 0.3 * (1 - k); o.s.scale.setScalar(1 + k * 1.5); });
  });

  floor.colliders.push({ type: 'room', fixed: true, walk: [{ minX: R.minX + 0.35, maxX: R.maxX - 0.35, minZ: R.minZ + 0.35, maxZ: R.maxZ - 0.35 }] }, ...colliders);
  floor.surfaces.push(...surfaces);
  floor.interactables.push(...interactables);
  floor.seats.push(...seats);

  return {
    lights, bounds: R,
    arrival: { x: 0, z: R.maxZ - 1.3, ry: Math.PI },
  };
}
