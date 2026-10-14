// Notes and pins people leave in the café. Each one is a small piece of
// paper with its text drawn onto a high-resolution canvas, so it reads
// cleanly even up close.

import * as THREE from 'three';

export const NOTE_COLORS = ['#fde8ef', '#fff4c7', '#e8f5e8', '#e6eefc', '#fbe3cf', '#efe6fb'];
const PIN_COLORS = ['#d4678a', '#4d7a4d', '#e8a64a', '#6b8fb5'];

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

function paperTexture(note) {
  const W = 512;
  const H = note.kind === 'pin' ? 340 : 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = note.color;
  ctx.fillRect(0, 0, W, H);
  // soft paper shading
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(120,80,60,0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (note.kind === 'pin') {
    // index card: a pink header line and faint blue rules
    ctx.strokeStyle = 'rgba(212,103,138,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 74); ctx.lineTo(W, 74); ctx.stroke();
    ctx.strokeStyle = 'rgba(107,143,181,0.22)';
    ctx.lineWidth = 2;
    for (let y = 120; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  // the words — size down until they fit
  let size = 54;
  let lines;
  const maxW = W - 70;
  const maxH = H - (note.kind === 'pin' ? 150 : 140);
  do {
    ctx.font = `600 ${size}px "Dancing Script", cursive`;
    lines = wrap(ctx, note.text, maxW);
    size -= 2;
  } while (lines.length * size * 1.15 > maxH && size > 22);
  ctx.fillStyle = '#3a2a2a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = (size + 2) * 1.15;
  const startY = (note.kind === 'pin' ? 92 : 40) + (maxH - lines.length * lh) / 2 + lh / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lh));

  ctx.font = '600 26px Nunito, sans-serif';
  ctx.fillStyle = 'rgba(107,76,76,0.85)';
  ctx.fillText('— ' + (note.author || 'someone'), W / 2, H - 40);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Returns a Group for a note, positioned and oriented on its surface.
export function makeNote(note) {
  const g = new THREE.Group();
  const isPin = note.kind === 'pin';
  const w = isPin ? 0.5 : 0.36;
  const h = isPin ? 0.33 : 0.36;

  const geo = new THREE.PlaneGeometry(w, h, 8, 8);
  // a gentle curl at the bottom edge, so it reads as paper
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = Math.max(0, (-y / (h / 2)) - 0.3);
    pos.setZ(i, k * k * 0.018);
  }
  geo.computeVertexNormals();

  const paper = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: paperTexture(note), roughness: 0.95, side: THREE.DoubleSide,
  }));
  paper.castShadow = true;
  paper.receiveShadow = true;
  g.add(paper);

  if (note.surface !== 'table') {
    // push pin
    const pinColor = PIN_COLORS[note.id % PIN_COLORS.length];
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.018, 24, 24),
      new THREE.MeshStandardMaterial({ color: pinColor, roughness: 0.3 }));
    head.position.set(0, h / 2 - 0.03, 0.02);
    head.castShadow = true;
    g.add(head);
  }

  // hearts badge
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  badge.visible = false;
  g.add(badge);

  function setHearts(n) {
    if (badge.material.map) badge.material.map.dispose();
    if (!n) { badge.visible = false; return; }
    const c = document.createElement('canvas');
    c.width = 160; c.height = 72;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,250,247,0.95)';
    ctx.beginPath(); ctx.roundRect(0, 0, 160, 72, 36); ctx.fill();
    ctx.font = '700 40px Nunito, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d4678a';
    ctx.fillText('♥ ' + n, 80, 38);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    badge.material.map = t;
    badge.material.needsUpdate = true;
    badge.scale.set(0.12, 0.054, 1);
    badge.position.set(w / 2 - 0.02, -h / 2 + 0.01, 0.03);
    badge.visible = true;
  }
  setHearts(note.hearts);

  if (note.surface === 'table') {
    g.position.set(note.x, note.y + 0.004, note.z);
    g.rotation.set(-Math.PI / 2, 0, note.ry || 0);
  } else {
    g.position.set(note.x, note.y, note.z);
    g.rotation.set(0, note.ry || 0, note.tilt || 0);
  }

  g.traverse(o => { if (o.isMesh || o.isSprite) o.userData = { kind: 'note', note, label: 'A note from ' + note.author }; });
  g.userData.note = note;
  g.userData.setHearts = setHearts;
  return g;
}

// The faint preview that follows your cursor while choosing where to put a note.
export function makeGhost() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36),
    new THREE.MeshBasicMaterial({ color: '#f2a7bb', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.23, 0.255, 48),
    new THREE.MeshBasicMaterial({ color: '#d4678a', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  g.add(m, ring);
  g.visible = false;
  g.renderOrder = 20;
  return g;
}
