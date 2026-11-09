// The view from the windows upstairs. While you're in a room in the building
// (the hallways, the rooms off the landings, your own room) the real street
// below is hidden — it's at ground level, and without the building drawn round
// you, a room up there would look as if it were floating in the air. Instead a
// painted ring of Cairo stands round the room, at the right height: the flats
// across the way with their balconies, water tanks and satellite dishes, the
// domes and minarets and Cairo Tower further off, and the sky — by day, at
// dusk (tinted) and at night (lit windows, stars).

import * as THREE from 'three';

const R = 30, H = 64, BELOW = 22; // ring radius; height; how far it reaches below the floor

function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// The panorama, drawn on a canvas: one copy goes three times round the ring.
function paint(night) {
  const W = 2048, Hc = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = Hc;
  const g = c.getContext('2d');
  const r = rand(77);
  const eye = Math.round(Hc * (1 - (BELOW + 1.6) / H)); // the horizon, at eye height
  // the sky
  const sky = g.createLinearGradient(0, 0, 0, eye);
  if (night) { sky.addColorStop(0, '#0c1230'); sky.addColorStop(1, '#2a2a52'); }
  else { sky.addColorStop(0, '#7fbcf2'); sky.addColorStop(0.7, '#cfe5f5'); sky.addColorStop(1, '#ffe9c7'); }
  g.fillStyle = sky; g.fillRect(0, 0, W, eye + 4);
  if (night) for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.6})`; g.fillRect(r() * W, r() * (eye - 60), 1.5, 1.5); }
  else for (let i = 0; i < 9; i++) { // soft clouds
    const x = r() * W, y = 40 + r() * (eye - 200), w = 120 + r() * 220;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + k * w / 5, y + Math.sin(k) * 8, w / 4, 18 + r() * 10, 0, 0, Math.PI * 2); g.fill(); }
  }
  // far off: the skyline — domes, minarets, Cairo Tower — pale in the haze
  const far = night ? '#262640' : '#c9b8a6';
  g.fillStyle = far;
  for (let x = 0; x < W;) {
    const w = 30 + r() * 70, h = 20 + r() * 50;
    g.fillRect(x, eye - h, w, h + 2);
    if (r() < 0.25) { g.beginPath(); g.arc(x + w / 2, eye - h, w / 3, Math.PI, 0); g.fill(); }
    if (r() < 0.2) { const mx = x + r() * w; g.fillRect(mx - 3, eye - h - 70, 6, 72); g.beginPath(); g.arc(mx, eye - h - 70, 6, Math.PI, 0); g.fill(); g.fillRect(mx - 0.75, eye - h - 84, 1.5, 10); }
    x += w;
  }
  { // Cairo Tower, a lotus on a stem
    const tx = W * 0.62;
    g.fillStyle = night ? '#30305a' : '#b7a48f';
    g.beginPath(); g.moveTo(tx - 9, eye); g.lineTo(tx - 5, eye - 170); g.lineTo(tx + 5, eye - 170); g.lineTo(tx + 9, eye); g.fill();
    g.beginPath(); g.ellipse(tx, eye - 178, 13, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(tx - 1, eye - 215, 2, 30);
    if (night) { g.fillStyle = '#ff6a6a'; g.fillRect(tx - 2, eye - 217, 4, 4); }
  }
  // a back row of flats behind them, filling every gap, with little windows
  g.fillStyle = night ? '#2c2838' : '#c9ae92';
  g.fillRect(0, eye - 4, W, Hc - eye + 4);
  for (let y = eye + 8; y < Hc; y += 30) for (let x = 6; x < W; x += 26) {
    g.fillStyle = night ? (r() < 0.25 ? '#e8c27a' : '#221e2c') : 'rgba(90,100,110,0.45)';
    g.fillRect(x, y, 12, 14);
  }
  // the flats across the street: blocks of every height, right down to the street
  const WALLS = night ? ['#3a3448', '#423a4a', '#38323e', '#463c44'] : ['#e8cfa8', '#dcb894', '#efdcc0', '#d9a888', '#e4c4a4', '#cfb89c', '#f0d8c8'];
  for (let x = -20; x < W;) {
    const w = 110 + r() * 120;
    const top = eye - 30 + r() * 90; // some taller than you, some shorter
    const wall = WALLS[Math.floor(r() * WALLS.length)];
    g.fillStyle = wall; g.fillRect(x, top, w, Hc - top);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + w - 6, top, 6, Hc - top); // a shadowed edge
    // a parapet, and on the roof: water tanks, satellite dishes, a little room
    g.fillStyle = night ? '#2a2632' : '#bfa080'; g.fillRect(x - 2, top - 6, w + 4, 8);
    if (r() < 0.7) { g.fillStyle = night ? '#2c2a34' : '#8a8a90'; g.fillRect(x + 10 + r() * (w - 40), top - 22, 20, 16); }
    for (let k = 0, n = Math.floor(r() * 3); k < n; k++) { g.strokeStyle = night ? '#55506a' : '#e8e8ec'; g.lineWidth = 3; g.beginPath(); g.arc(x + 15 + r() * (w - 30), top - 10, 8, Math.PI * 0.9, Math.PI * 1.9); g.stroke(); }
    if (r() < 0.3) { g.fillStyle = night ? '#302c3a' : '#cdb294'; g.fillRect(x + w * 0.55, top - 28, w * 0.3, 28); }
    // windows, in rows: shutters by day; some lit, warm, at night
    const cols = Math.max(2, Math.floor(w / 34)), dx = w / cols;
    for (let y = top + 22; y < Hc - 20; y += 46) {
      for (let k = 0; k < cols; k++) {
        const wx = x + k * dx + dx * 0.25, ww = dx * 0.5;
        if (night) g.fillStyle = r() < 0.38 ? (r() < 0.5 ? '#ffd98a' : '#ffe9b8') : '#1e1a26';
        else g.fillStyle = r() < 0.5 ? '#5a6e7a' : (r() < 0.5 ? '#7a9a86' : '#8a6a52');
        g.fillRect(wx, y, ww, 26);
        if (!night && r() < 0.35) { g.fillStyle = '#ffffff'; g.fillRect(wx - 3, y + 26, ww + 6, 3); } // a balcony ledge
        if (r() < 0.12) { g.fillStyle = night ? '#4a4458' : '#f2f2f2'; g.fillRect(wx + ww + 2, y + 6, 10, 9); } // an AC unit
        if (!night && r() < 0.08) { g.fillStyle = ['#d4678a', '#5f8fc4', '#e2b04a'][Math.floor(r() * 3)]; g.fillRect(wx - 2, y + 30, ww + 4, 6); } // washing on a line
      }
    }
    x += w + (r() < 0.3 ? 8 : 0);
  }
  // the street, far below, in shadow
  const st = g.createLinearGradient(0, Hc - 90, 0, Hc);
  st.addColorStop(0, 'rgba(0,0,0,0)'); st.addColorStop(1, night ? 'rgba(0,0,0,0.6)' : 'rgba(60,40,30,0.35)');
  g.fillStyle = st; g.fillRect(0, Hc - 90, W, 90);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
  t.anisotropy = 4;
  return t;
}

export function buildWindowView() {
  const group = new THREE.Group();
  group.visible = false;
  const tex = { day: paint(false), night: paint(true) };
  const mat = new THREE.MeshBasicMaterial({ map: tex.day, side: THREE.BackSide, fog: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 96, 1, true), mat);
  ring.position.y = H / 2 - BELOW;
  const skyM = new THREE.MeshBasicMaterial({ color: '#7fbcf2', side: THREE.DoubleSide, fog: false, toneMapped: false });
  const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 64), skyM);
  cap.rotation.x = Math.PI / 2; cap.position.y = H - BELOW;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshBasicMaterial({ color: '#3a2e28', side: THREE.DoubleSide, fog: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -BELOW;
  group.add(ring, cap, ground);
  group.traverse(o => { if (o.isMesh) { o.renderOrder = -1; o.frustumCulled = false; } });
  let isNight = false;
  return {
    group,
    // at the floor of the room you're in
    place(y) { group.position.set(0, y, 0); },
    setSky(day, dusk, night) {
      const n = night > 0.6;
      if (n !== isNight) { isNight = n; mat.map = n ? tex.night : tex.day; mat.needsUpdate = true; }
      // dusk warms everything; between day and night it dims
      const k = n ? 1 : 0.55 + 0.45 * day;
      mat.color.setRGB(k * (1 + dusk * 0.12), k * (1 - dusk * 0.06), k * (1 - dusk * 0.2));
      skyM.color.set(n ? '#0c1230' : '#7fbcf2').multiplyScalar(n ? 1 : k);
    },
  };
}
