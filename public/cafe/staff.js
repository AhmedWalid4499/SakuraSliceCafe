// The café team, out from behind the counter. Each of them has a little
// routine — Yuto drifts between the tables, Hana works the counter and pops
// into the kitchen, Yuki fetches bakes from the kitchen, Me3temed flies down
// from his shelf now and then — and Hana or Yuki will bring an order to
// your table. They find their way with a walking grid built from the
// furniture (A*, then the corners pulled tight).

import * as THREE from 'three';

const CELL = 0.2;
const R = 0.3; // how much room a person needs

export function createStaff(world, { say } = {}) {
  const main = world.floors.main;
  const rects = world.walk;
  const minX = Math.min(...rects.map(r => r.minX)), maxX = Math.max(...rects.map(r => r.maxX));
  const minZ = Math.min(...rects.map(r => r.minZ)), maxZ = Math.max(...rects.map(r => r.maxZ));
  const nx = Math.ceil((maxX - minX) / CELL) + 1, nz = Math.ceil((maxZ - minZ) / CELL) + 1;
  const cx = i => minX + i * CELL, cz = j => minZ + j * CELL;
  const obstacles = main.colliders.filter(c => c.type !== 'room' && !c.staffOnly);
  const guestOnly = main.colliders.filter(c => c.staffOnly); // behind the counter: team only
  // the counter itself (its collider for guests also covers the space behind it)
  const cbox = new THREE.Box3().setFromObject(world.counter);
  obstacles.push({ type: 'box', minX: cbox.min.x, maxX: cbox.max.x, minZ: cbox.min.z, maxZ: cbox.max.z });

  function walkable(x, z, list) {
    if (!rects.some(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)) return false;
    for (const c of list) {
      if (c.type === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + R) return false; }
      else if (c.type === 'box' && x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R) return false;
    }
    return true;
  }
  // two maps: one for the team, one for guests (who can't go behind the counter)
  const staffFree = new Uint8Array(nx * nz), guestFree = new Uint8Array(nx * nz);
  const guestList = [...obstacles, ...guestOnly];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    staffFree[k] = walkable(cx(i), cz(j), obstacles) ? 1 : 0;
    guestFree[k] = staffFree[k] && walkable(cx(i), cz(j), guestList) ? 1 : 0;
  }
  let free = staffFree;

  const cellOf = (x, z) => [Math.round((x - minX) / CELL), Math.round((z - minZ) / CELL)];
  const ok = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && free[j * nx + i] === 1;

  // the nearest free cell to a point (a ring search outwards)
  function nearestFree(x, z) {
    const [i0, j0] = cellOf(x, z);
    if (ok(i0, j0)) return [i0, j0];
    for (let r = 1; r < 40; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !ok(i0 + di, j0 + dj)) continue;
        const d = Math.hypot(cx(i0 + di) - x, cz(j0 + dj) - z);
        if (d < bd) { bd = d; best = [i0 + di, j0 + dj]; }
      }
      if (best) return best;
    }
    return null;
  }

  function lineFree(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5));
    for (let k = 1; k < n; k++) {
      const [i, j] = cellOf(ax + (bx - ax) * k / n, az + (bz - az) * k / n);
      if (!ok(i, j)) return false;
    }
    return true;
  }

  function findPath(from, to, { guest = false } = {}) {
    free = guest ? guestFree : staffFree;
    const s = nearestFree(from.x, from.z), g = nearestFree(to.x, to.z);
    if (!s || !g) return null;
    const key = (i, j) => j * nx + i;
    const gScore = new Float32Array(nx * nz).fill(Infinity);
    const came = new Int32Array(nx * nz).fill(-1);
    const open = [[0, s[0], s[1]]];
    gScore[key(...s)] = 0;
    const h = (i, j) => { const dx = Math.abs(i - g[0]), dz = Math.abs(j - g[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const closed = new Uint8Array(nx * nz);
    let found = false;
    while (open.length) {
      // a small binary heap would be faster; the grid is small enough for this
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, i, j] = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      const k0 = key(i, j);
      if (closed[k0]) continue;
      closed[k0] = 1;
      if (i === g[0] && j === g[1]) { found = true; break; }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (!ok(ni, nj) || (di && dj && (!ok(i + di, j) || !ok(i, j + dj)))) continue;
        const k1 = key(ni, nj);
        const t = gScore[k0] + (di && dj ? 1.414 : 1);
        if (t < gScore[k1]) { gScore[k1] = t; came[k1] = k0; open.push([t + h(ni, nj), ni, nj]); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = key(...g); k !== -1; k = came[k]) cells.push([cx(k % nx), cz(Math.floor(k / nx))]);
    cells.reverse();
    // pull the corners tight
    const pts = [cells[0]];
    let a = 0;
    for (let b = 2; b < cells.length; b++) {
      if (!lineFree(cells[a][0], cells[a][1], cells[b][0], cells[b][1])) { pts.push(cells[b - 1]); a = b - 1; }
    }
    pts.push(cells[cells.length - 1]);
    return pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  }

  // ── places worth walking to
  const tables = main.surfaces.filter(s => s.userData.surface === 'table' && (s.userData.top ?? 9) < 1.0)
    .map(s => { const p = new THREE.Vector3(); s.getWorldPosition(p); return { x: p.x, z: p.z, top: s.userData.top, name: s.userData.tableName }; });
  const kitchenSpots = [{ x: -13.2, z: -12.0 }, { x: -10.6, z: -13.3 }, { x: -9.0, z: -13.2 }];
  const behindCounter = () => ({ x: THREE.MathUtils.lerp(cbox.min.x + 0.7, cbox.max.x - 0.7, Math.random()), z: cbox.min.z - 0.55 });
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const team = new Map();
  for (const n of world.npcs) {
    const g = n.av.group;
    const s = {
      n, g, id: n.id, home: { x: g.position.x, y: g.position.y, z: g.position.z, ry: g.rotation.y },
      path: [], wait: 1 + Math.random() * 4, face: null, task: null, onArrive: null, moving: false,
      flight: null, perch: null, speed: n.id === 'yuto' ? 1.1 : 1.35,
    };
    n.controlled = true;
    team.set(n.id, s);
  }

  function goTo(s, target, onArrive, face = null) {
    const path = findPath(s.g.position, target);
    if (!path) { s.wait = 3; return false; }
    s.path = path.slice(1);
    s.onArrive = onArrive || null;
    s.face = face;
    return true;
  }

  // what each of them does next, when they've nothing to do
  function nextIdle(s) {
    const r = Math.random();
    if (s.id === 'yuto') {
      if (r < 0.15) return goTo(s, { x: 0.8, z: 8.6 }, () => { s.wait = 6 + Math.random() * 6; }, { x: 0, z: 11 });
      const t = pick(tables);
      const a = Math.random() * Math.PI * 2;
      return goTo(s, { x: t.x + Math.cos(a) * 1.25, z: t.z + Math.sin(a) * 1.25 }, () => {
        s.wait = 7 + Math.random() * 10;
        if (say && Math.random() < 0.35) say(s.n, pick(s.n.lines));
      }, t);
    }
    if (s.id === 'hana' || s.id === 'yuki') {
      const toKitchen = Math.random() < (s.id === 'yuki' ? 0.3 : 0.15);
      if (toKitchen) {
        return goTo(s, pick(kitchenSpots), () => {
          s.wait = 5 + Math.random() * 5;
          s.after = () => {
            // back out with something on a plate (Yuki) or a fresh cup (Hana)
            if (s.id === 'yuki') s.n.av.setDessert(pick(['slice', 'domes', 'daifuku', 'shells', 'melonpan']), 0);
            else s.n.av.setDrink('#8fbf6a');
            goTo(s, behindCounter(), () => { s.n.av.setDessert(null); s.n.av.setDrink(null); s.wait = 4 + Math.random() * 6; }, { x: cbox.min.x + 2, z: cbox.max.z + 3 });
          };
        });
      }
      return goTo(s, Math.random() < 0.6 ? behindCounter() : { x: s.home.x, z: s.home.z }, () => { s.wait = 5 + Math.random() * 9; }, { x: s.g.position.x, z: cbox.max.z + 3 });
    }
    return false;
  }

  // Me3temed flies: from his shelf to a table or the counter, and back.
  function flyTo(s, to, then) {
    const from = s.g.position.clone();
    const dist = from.distanceTo(to);
    s.flight = { from, to: to.clone(), t: 0, dur: Math.max(1.4, dist / 2.4), apex: Math.max(from.y, to.y) + 0.7 + dist * 0.05, then };
  }
  const perches = () => [
    ...tables.filter(t => t.name).map(t => new THREE.Vector3(t.x - 0.25, t.top, t.z - 0.12)),
    new THREE.Vector3(cbox.max.x - 0.45, cbox.max.y, (cbox.min.z + cbox.max.z) / 2),
  ];

  // ── deliveries: carry it to a spot on someone's table
  function deliver(id, item, spot, done) {
    const s = team.get(id);
    if (!s) return false;
    s.task = 'deliver';
    s.after = null;
    s.n.av.setDessert(item.dessertShape || null, 0);
    s.n.av.setDrink(item.drinkColor || null);
    const ok1 = goTo(s, spot, () => {
      s.n.av.play('bite');
      setTimeout(() => {
        s.n.av.setDessert(null); s.n.av.setDrink(null);
        done && done();
        s.task = null;
        s.wait = 2.5;
        s.after = () => goTo(s, s.id === 'yuto' ? { x: s.home.x, z: s.home.z } : behindCounter(), () => { s.wait = 6; }, { x: s.home.x, z: cbox.max.z + 3 });
      }, 650);
      s.wait = 99;
    }, spot);
    if (!ok1) {
      // can't find a way (very unlikely): put it down anyway
      s.n.av.setDessert(null); s.n.av.setDrink(null); s.task = null; done && done();
    }
    return true;
  }

  const tmp = new THREE.Vector3();
  function update(dt) {
    for (const s of team.values()) {
      const g = s.g;
      let moving = false;
      if (s.id === 'me3temed') {
        if (s.flight) {
          const f = s.flight;
          f.t = Math.min(1, f.t + dt / f.dur);
          const k = f.t * f.t * (3 - 2 * f.t);
          g.position.lerpVectors(f.from, f.to, k);
          g.position.y = THREE.MathUtils.lerp(f.from.y, f.to.y, k) + Math.sin(Math.PI * f.t) * (f.apex - Math.max(f.from.y, f.to.y));
          const ry = Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z);
          g.rotation.y += Math.atan2(Math.sin(ry - g.rotation.y), Math.cos(ry - g.rotation.y)) * Math.min(1, dt * 6);
          s.n.av.update(dt, { waving: 1 });
          if (f.t >= 1) { s.flight = null; const then = f.then; then && then(); }
          continue;
        }
        s.wait -= dt;
        if (s.wait <= 0) {
          if (s.perch) { s.perch = null; flyTo(s, new THREE.Vector3(s.home.x, s.home.y, s.home.z), () => { g.rotation.y = s.home.ry; s.wait = 40 + Math.random() * 50; }); }
          else { s.perch = pick(perches()); flyTo(s, s.perch, () => { s.wait = 15 + Math.random() * 20; if (say && Math.random() < 0.5) say(s.n, pick(s.n.lines)); }); }
        }
        s.n.av.update(dt, {});
        continue;
      }
      if (s.path.length) {
        const p = s.path[0];
        tmp.set(p.x - g.position.x, 0, p.z - g.position.z);
        const d = tmp.length();
        const step = (s.task === 'deliver' ? 2.1 : s.speed) * dt; // a brisker step with an order
        if (d <= step) { g.position.x = p.x; g.position.z = p.z; s.path.shift(); }
        else { g.position.x += (tmp.x / d) * step; g.position.z += (tmp.z / d) * step; }
        const ry = Math.atan2(tmp.x, tmp.z);
        g.rotation.y += Math.atan2(Math.sin(ry - g.rotation.y), Math.cos(ry - g.rotation.y)) * Math.min(1, dt * 8);
        moving = true;
        if (!s.path.length) { const a = s.onArrive; s.onArrive = null; a && a(); }
      } else {
        if (s.face) {
          const ry = Math.atan2(s.face.x - g.position.x, s.face.z - g.position.z);
          g.rotation.y += Math.atan2(Math.sin(ry - g.rotation.y), Math.cos(ry - g.rotation.y)) * Math.min(1, dt * 4);
        }
        s.wait -= dt;
        if (s.wait <= 0 && !s.task) {
          if (s.after) { const f = s.after; s.after = null; f(); }
          else nextIdle(s);
        }
      }
      s.n.av.update(dt, { moving });
    }
  }

  // stop what you're doing and turn to someone for a while (they're talking to you)
  function attend(id, who, secs = 25) {
    const s = team.get(id);
    if (!s || s.task || s.flight || s.id === 'me3temed') return;
    s.path = []; s.onArrive = null; s.after = null;
    s.face = who; s.wait = secs;
  }

  return {
    update, deliver, findPath, attend,
    busy: id => !!(team.get(id) && team.get(id).task),
    positions: () => [...team.values()].filter(s => s.id !== 'me3temed').map(s => s.g.position),
    grid: { staffFree, guestFree, nx, nz, minX, minZ, CELL },
  };
}
