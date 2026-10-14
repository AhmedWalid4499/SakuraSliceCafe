// Soft, rounded characters built from smooth geometry — no pixels, no
// textures to blur. Used for visitors, for the café team, and for the
// preview in the avatar creator.

import * as THREE from 'three';

const SEG = 32; // generous segment counts keep silhouettes round up close

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, roughness: opts.roughness ?? 0.75, metalness: opts.metalness ?? 0, ...opts,
});

function capsule(r, len, color, m) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 12, SEG), m || mat(color));
  mesh.castShadow = true;
  return mesh;
}

function sphere(r, color, m) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, SEG, SEG), m || mat(color));
  mesh.castShadow = true;
  return mesh;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return c;
}

// A cup with a drink in it, held in the right hand.
export function makeCup(drinkColor) {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.045, 0.11, SEG, 1, true),
    mat('#fffaf4', { roughness: 0.35, side: THREE.DoubleSide }));
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.045, SEG), mat('#fffaf4'));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.055;
  const drink = new THREE.Mesh(new THREE.CircleGeometry(0.052, SEG), mat(drinkColor, { roughness: 0.2 }));
  drink.rotation.x = -Math.PI / 2;
  drink.position.y = 0.04;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.052, 0.04, SEG, 1, true), mat('#d4678a'));
  cup.castShadow = true;
  g.add(cup, base, drink, sleeve);
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const worldH = opts.height || 0.2;
  sprite.scale.set(worldH * w / h, worldH, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/**
 * avatar: { body, skin, hair, hairStyle, outfit, accent, accessory }
 * extra:  { apron, bowtie, glasses: 'tortoise', scale }
 */
export function buildAvatar(avatar = {}, extra = {}) {
  const a = {
    body: 'person', skin: '#e0b48c', hair: '#3b2a22', hairStyle: 'short',
    outfit: '#7aab7a', accent: '#fef9f5', accessory: 'none', ...avatar,
  };
  const root = new THREE.Group();
  const rig = new THREE.Group();     // everything that bobs and turns
  root.add(rig);

  const isOwl = a.body === 'owl';
  const furry = a.body !== 'person';
  const skinM = mat(a.skin, { roughness: furry ? 0.95 : 0.6 });
  const outfitM = mat(a.outfit, { roughness: 0.85 });
  const darkM = mat('#2a1d1d', { roughness: 0.3 });
  const parts = {};

  // ── legs
  if (!isOwl) {
    const legM = mat(shade(a.outfit, -0.22), { roughness: 0.9 });
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.09 * side, 0.62, 0);
      const leg = capsule(0.07, 0.42, null, legM);
      leg.position.y = -0.29;
      const shoe = capsule(0.07, 0.06, null, mat(furry ? a.skin : '#5a3e36', { roughness: 0.6 }));
      shoe.rotation.x = Math.PI / 2;
      shoe.position.set(0, -0.56, 0.04);
      hip.add(leg, shoe);
      rig.add(hip);
      parts[side < 0 ? 'legL' : 'legR'] = hip;
    }
  }

  // ── torso
  const torso = isOwl
    ? sphere(0.42, null, skinM)
    : capsule(0.22, 0.38, null, outfitM);
  torso.position.y = isOwl ? 0.45 : 0.98;
  if (isOwl) torso.scale.set(1, 1.05, 0.95);
  rig.add(torso);
  parts.torso = torso;

  if (isOwl) {
    const belly = sphere(0.3, null, mat(a.accent, { roughness: 0.95 }));
    belly.scale.set(1, 1.1, 0.5);
    belly.position.set(0, 0.4, 0.24);
    rig.add(belly);
  }

  // Apron (the café team wear cream ones).
  if (extra.apron) {
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(0.235, 0.27, 0.62, SEG, 1, true, -Math.PI * 0.42, Math.PI * 0.84),
      mat(extra.apron, { roughness: 0.9, side: THREE.DoubleSide }));
    apron.position.y = 0.86;
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 8, SEG, Math.PI), mat(extra.apron));
    strap.position.set(0, 1.18, 0.08);
    strap.rotation.x = -0.25;
    rig.add(apron, strap);
  }

  // ── arms
  const armM = isOwl ? skinM : outfitM;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    if (isOwl) {
      shoulder.position.set(0.38 * side, 0.55, 0);
      const wing = sphere(0.2, null, mat(shade(a.skin, -0.08), { roughness: 0.95 }));
      wing.scale.set(0.35, 1, 0.8);
      wing.position.y = -0.12;
      wing.rotation.z = 0.2 * side;
      shoulder.add(wing);
    } else {
      shoulder.position.set(0.28 * side, 1.18, 0);
      const arm = capsule(0.06, 0.36, null, armM);
      arm.position.y = -0.22;
      const hand = sphere(0.065, null, skinM);
      hand.position.y = -0.46;
      shoulder.add(arm, hand);
      shoulder.rotation.z = 0.08 * side;
    }
    rig.add(shoulder);
    parts[side < 0 ? 'armL' : 'armR'] = shoulder;
  }

  // ── head
  const head = new THREE.Group();
  head.position.y = isOwl ? 0.98 : 1.5;
  rig.add(head);
  parts.head = head;

  if (!isOwl) head.scale.setScalar(1.22); // a little bigger-headed: softer, friendlier
  const headR = isOwl ? 0.3 : 0.25;
  const skull = sphere(headR, null, skinM);
  if (a.body === 'fox') skull.scale.set(1, 0.95, 1);
  head.add(skull);

  // muzzle / snout
  if (a.body === 'fox' || a.body === 'cat') {
    const muzzle = sphere(0.12, null, mat(a.accent, { roughness: 0.95 }));
    muzzle.scale.set(1, 0.75, a.body === 'fox' ? 1.35 : 0.9);
    muzzle.position.set(0, -0.07, 0.19);
    const nose = sphere(0.03, null, darkM);
    nose.position.set(0, -0.04, a.body === 'fox' ? 0.36 : 0.29);
    head.add(muzzle, nose);
  } else if (a.body === 'rabbit') {
    const muzzle = sphere(0.09, null, mat(a.accent, { roughness: 0.95 }));
    muzzle.scale.set(1.2, 0.8, 0.8);
    muzzle.position.set(0, -0.08, 0.2);
    const nose = sphere(0.025, null, mat('#e89aaa'));
    nose.position.set(0, -0.04, 0.27);
    head.add(muzzle, nose);
  } else if (isOwl) {
    const face = sphere(0.24, null, mat(a.accent, { roughness: 0.95 }));
    face.scale.set(1.15, 0.85, 0.5);
    face.position.set(0, 0, 0.17);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, SEG), mat('#e8a64a', { roughness: 0.4 }));
    beak.rotation.x = Math.PI / 2 + 0.4;
    beak.position.set(0, -0.06, 0.32);
    head.add(face, beak);
  }

  // eyes — soft dark ovals with a catch-light
  const eyeY = isOwl ? 0.03 : 0.02;
  const eyeX = isOwl ? 0.1 : 0.085;
  const eyeZ = isOwl ? 0.27 : 0.215;
  for (const side of [-1, 1]) {
    const eye = sphere(isOwl ? 0.05 : 0.032, null, darkM);
    eye.scale.set(1, isOwl ? 0.7 : 1.25, 0.6); // owls: soft half-open eyes
    eye.position.set(eyeX * side, eyeY, eyeZ);
    const shine = sphere(0.01, '#ffffff', mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }));
    shine.position.set(eyeX * side + 0.012, eyeY + 0.018, eyeZ + 0.02);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.035, SEG),
      new THREE.MeshBasicMaterial({ color: '#f2a7bb', transparent: true, opacity: 0.55 }));
    blush.position.set((eyeX + 0.06) * side, eyeY - 0.07, eyeZ - 0.025);
    blush.lookAt(blush.position.clone().multiplyScalar(3));
    head.add(eye, shine, blush);
  }

  // ears
  if (a.body === 'fox' || a.body === 'cat') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(a.body === 'fox' ? 0.09 : 0.075, a.body === 'fox' ? 0.2 : 0.15, SEG), skinM);
      ear.position.set(0.14 * side, 0.22, 0);
      ear.rotation.z = -0.35 * side;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, SEG), mat(a.body === 'fox' ? '#2a1d1d' : '#f2a7bb'));
      inner.position.set(0.14 * side, 0.21, 0.03);
      inner.rotation.z = -0.35 * side;
      ear.castShadow = true;
      head.add(ear, inner);
    }
  } else if (a.body === 'rabbit') {
    for (const side of [-1, 1]) {
      const ear = capsule(0.055, 0.3, null, skinM);
      ear.scale.z = 0.6;
      ear.position.set(0.09 * side, 0.38, -0.02);
      ear.rotation.z = -0.12 * side;
      const inner = capsule(0.03, 0.24, null, mat('#f6c6d2'));
      inner.scale.z = 0.4;
      inner.position.set(0.09 * side, 0.38, 0.01);
      inner.rotation.z = -0.12 * side;
      head.add(ear, inner);
      parts[side < 0 ? 'earL' : 'earR'] = ear;
    }
  } else if (isOwl) {
    for (const side of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, SEG), skinM);
      tuft.position.set(0.18 * side, 0.24, 0);
      tuft.rotation.z = -0.5 * side;
      head.add(tuft);
    }
  }

  // tails
  if (a.body === 'fox' || a.body === 'cat') {
    const tail = new THREE.Group();
    tail.position.set(0, 0.72, -0.18);
    const t = capsule(a.body === 'fox' ? 0.1 : 0.04, a.body === 'fox' ? 0.4 : 0.45, null, skinM);
    t.position.set(0, 0.12, -0.18);
    t.rotation.x = -0.9;
    tail.add(t);
    if (a.body === 'fox') {
      const tip = sphere(0.1, null, mat(a.accent, { roughness: 0.95 }));
      tip.position.set(0, 0.3, -0.35);
      tail.add(tip);
    }
    rig.add(tail);
    parts.tail = tail;
  } else if (a.body === 'rabbit') {
    const puff = sphere(0.09, null, mat(a.accent, { roughness: 1 }));
    puff.position.set(0, 0.7, -0.22);
    rig.add(puff);
  }

  // hair (people only)
  if (a.body === 'person' && a.hairStyle !== 'none') {
    const hairM = mat(a.hair, { roughness: 0.7 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.265, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
    cap.rotation.x = -0.25;
    cap.position.y = 0.02;
    cap.castShadow = true;
    head.add(cap);
    if (a.hairStyle === 'long') {
      const back = capsule(0.22, 0.3, null, hairM);
      back.scale.set(1.05, 1, 0.55);
      back.position.set(0, -0.18, -0.12);
      head.add(back);
    } else if (a.hairStyle === 'bun') {
      const bun = sphere(0.11, null, hairM);
      bun.position.set(0, 0.2, -0.17);
      head.add(bun);
    } else if (a.hairStyle === 'curly') {
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const curl = sphere(0.075, null, hairM);
        curl.position.set(Math.cos(ang) * 0.21, 0.1 + Math.sin(i * 1.7) * 0.04, Math.sin(ang) * 0.21 - 0.03);
        head.add(curl);
      }
    } else if (a.hairStyle === 'bob') {
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.28, SEG, SEG, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.7), hairM);
      bob.rotation.y = Math.PI;
      bob.position.y = 0.0;
      head.add(bob);
    }
  }

  // accessories
  const acc = a.accessory;
  if (acc === 'glasses' || extra.glasses) {
    const frameM = mat(extra.glasses === 'tortoise' ? '#6b3e1f' : '#3a2a26', { roughness: 0.35 });
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 10, SEG), frameM);
      rim.position.set(0.085 * side, 0.02, 0.235);
      head.add(rim);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), frameM);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.03, 0.24);
    head.add(bridge);
  }
  if (acc === 'beanie') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.275, SEG, SEG, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(a.accent, { roughness: 1 }));
    b.position.y = 0.04;
    const pom = sphere(0.06, null, mat(a.accent, { roughness: 1 }));
    pom.position.y = 0.32;
    head.add(b, pom);
  }
  if (acc === 'flower') {
    const f = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const p = sphere(0.035, null, mat('#f2a7bb', { roughness: 0.8 }));
      p.scale.set(1, 0.4, 1.4);
      p.position.set(Math.cos(i * 1.256) * 0.04, 0, Math.sin(i * 1.256) * 0.04);
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
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 10, SEG, Math.PI), hm);
    band.position.y = 0.02;
    head.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, SEG), hm);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(0.26 * side, 0, 0);
      head.add(cup);
    }
  }
  if (acc === 'scarf') {
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 14, SEG), mat(a.accent === '#fef9f5' ? '#d4678a' : a.accent, { roughness: 1 }));
    s.rotation.x = Math.PI / 2;
    s.position.y = isOwl ? 0.75 : 1.3;
    rig.add(s);
  }
  if (extra.bowtie) {
    const bm = mat(extra.bowtie, { roughness: 0.6 });
    const bow = new THREE.Group();
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, SEG), bm);
      w.rotation.z = (Math.PI / 2) * side;
      w.position.x = 0.05 * side;
      bow.add(w);
    }
    bow.add(sphere(0.025, null, bm));
    bow.position.set(0, isOwl ? 0.72 : 1.28, isOwl ? 0.36 : 0.2);
    rig.add(bow);
  }

  root.scale.setScalar(extra.scale || 1);

  // ── a drink in hand
  let cup = null;
  function setDrink(color) {
    if (cup) { cup.parent.remove(cup); cup = null; }
    if (!color || isOwl) return;
    cup = makeCup(color);
    cup.position.set(0, -0.48, 0.07);
    parts.armR.add(cup);
  }

  // ── animation
  let t = Math.random() * 10;
  let walkPhase = 0;
  let sitBlend = 0;
  function update(dt, { moving = false, sitting = false, waving = 0 } = {}) {
    t += dt;
    sitBlend += ((sitting ? 1 : 0) - sitBlend) * Math.min(1, dt * 8);
    if (moving) walkPhase += dt * 9;
    const swing = moving ? Math.sin(walkPhase) * 0.55 : 0;

    const breathe = Math.sin(t * 1.6) * 0.012;
    rig.position.y = breathe + (moving ? Math.abs(Math.sin(walkPhase)) * 0.04 : 0) - sitBlend * 0.17;
    head.rotation.y = moving ? 0 : Math.sin(t * 0.35) * 0.25;
    head.rotation.z = Math.sin(t * 0.5) * 0.04;

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
        parts.armL.rotation.x = -swing * 0.8 - sitBlend * 0.5;
        const holding = cup ? -0.9 : 0;
        parts.armR.rotation.x = waving > 0 ? 0 : swing * 0.8 + holding - sitBlend * (cup ? 0 : 0.5);
        parts.armR.rotation.z = waving > 0 ? 2.6 + Math.sin(t * 12) * 0.3 : 0.08;
      }
    }
    if (parts.tail) parts.tail.rotation.y = Math.sin(t * 2.2) * 0.35;
    if (parts.earL) {
      parts.earL.rotation.x = Math.sin(t * 0.9) * 0.08;
      parts.earR.rotation.x = Math.sin(t * 0.9 + 1) * 0.08;
    }
  }

  const height = (isOwl ? 1.35 : 1.9) * (extra.scale || 1);
  return { group: root, parts, setDrink, update, height };
}

export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}
