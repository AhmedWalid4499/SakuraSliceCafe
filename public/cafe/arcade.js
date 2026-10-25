// The Games Room's tables you play on your own, against the house: ping-pong
// (keep the rally going against Yuto, who never misses but hits harder and
// harder), pool (pot as many of the seven as you can in ten shots) and
// baby-foot (ten shots past the keeper). Each is a little canvas game in a
// panel; your best goes up on the high-score board (server/rooms.js).

export const ARCADE = {
  pingpong: { name: 'Ping-pong', icon: '🏓', how: 'Move to keep the rally going — mouse, finger or ← →. Yuto never misses, but he hits harder every time.', unit: 'returns' },
  pool: { name: 'Pool', icon: '🎱', how: 'Drag back from the white ball and let go to shoot. Pot as many of the seven as you can in ten shots.', unit: 'potted' },
  foosball: { name: 'Baby-foot', icon: '⚽', how: 'Move your striker — mouse, finger or ← → — and click (or press space) to shoot. Ten shots past the keeper.', unit: 'goals' },
};

export function createArcade({ $, api, openPanel, toast, onScores }) {
  let run = null; // the game being played: { stop() }
  const canvas = () => $('arcadeCanvas');
  const status = t => { $('arcadeStatus').textContent = t; };

  function stop() { if (run) { run.stop(); run = null; } }

  async function finish(game, score) {
    status(`${ARCADE[game].icon} ${score} ${ARCADE[game].unit}. ${score ? 'Lovely!' : 'Next time!'}`);
    $('arcadeAgain').classList.remove('hidden');
    try {
      const r = await api('/arcade/score', { method: 'POST', body: { game, score } });
      if (r.best && r.newBest && score > 0) toast(`🏆 A new best at ${ARCADE[game].name}: ${score} ${ARCADE[game].unit}!`);
      onScores?.(r.scores);
      renderBoard(r.scores);
    } catch (e) { /* the game still counted for fun */ }
  }

  function renderBoard(scores) {
    const box = $('arcadeBoard');
    if (!box || !scores) return;
    const game = box.dataset.game;
    const list = (scores[game] || []).slice(0, 5);
    box.replaceChildren(...(list.length ? list.map((s, i) => {
      const li = document.createElement('li');
      li.textContent = `${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${s.name} — ${s.score}`;
      return li;
    }) : [Object.assign(document.createElement('li'), { textContent: 'Nobody yet — be the first on the board.' })]));
  }

  async function open(game) {
    stop();
    const g = ARCADE[game];
    $('arcadeTitle').textContent = `${g.icon} ${g.name}`;
    $('arcadeHow').textContent = g.how;
    $('arcadeAgain').classList.add('hidden');
    $('arcadeBoard').dataset.game = game;
    $('arcadeAgain').onclick = () => open(game);
    openPanel('arcadePanel');
    status('');
    api('/arcade/scores').then(r => renderBoard(r.scores)).catch(() => {});
    run = ({ pingpong, pool, foosball })[game](canvas(), score => { run = null; finish(game, score); }, status);
  }

  return { open, stop, ARCADE };
}

// ── shared bits: a canvas loop, the pointer's x, the arrow keys
function loop(step) {
  let last = performance.now(), raf = 0, on = true;
  const tick = t => {
    if (!on) return;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (step(dt) === false) { on = false; return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { on = false; cancelAnimationFrame(raf); };
}
function controls(cv, { onTap } = {}) {
  const c = { x: null, left: false, right: false };
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
  const move = e => { c.x = pos(e).x; };
  const down = e => { c.x = pos(e).x; onTap?.(pos(e)); };
  const key = on => e => {
    if (e.key === 'ArrowLeft') { c.left = on; e.preventDefault(); }
    if (e.key === 'ArrowRight') { c.right = on; e.preventDefault(); }
    if (on && e.key === ' ') { onTap?.(null); e.preventDefault(); }
  };
  const kd = key(true), ku = key(false);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerdown', down);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  c.off = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerdown', down); removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
  return c;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── ping-pong: you at the bottom, Yuto at the top
function pingpong(cv, done, status) {
  cv.width = 340; cv.height = 440;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const PW = 64, PH = 10;
  const c = controls(cv);
  let me = W / 2, yuto = W / 2, hits = 0, over = false, wait = 1.2;
  const ball = { x: W / 2, y: H / 2, vx: 90, vy: 170, r: 6 };
  status('Get ready…');
  const stopLoop = loop(dt => {
    if (c.left) me -= 380 * dt;
    if (c.right) me += 380 * dt;
    if (c.x != null && !c.left && !c.right) me += (c.x - me) * Math.min(1, dt * 16);
    me = clamp(me, PW / 2, W - PW / 2);
    if (wait > 0) { wait -= dt; if (wait <= 0) status(''); }
    else if (!over) {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < ball.r || ball.x > W - ball.r) { ball.vx *= -1; ball.x = clamp(ball.x, ball.r, W - ball.r); }
      // Yuto follows the ball, a little behind
      yuto += clamp(ball.x - yuto, -300 * dt, 300 * dt);
      if (ball.vy < 0 && ball.y < 30 + PH) { ball.vy = Math.abs(ball.vy); ball.vx += (Math.random() - 0.5) * 120; }
      if (ball.vy > 0 && ball.y > H - 30 - PH && ball.y < H - 20) {
        if (Math.abs(ball.x - me) < PW / 2 + ball.r) {
          hits++;
          const sp = Math.hypot(ball.vx, ball.vy) * 1.06 + 4;
          const a = ((ball.x - me) / (PW / 2)) * 0.9; // where it hit the bat sends it left or right
          ball.vx = Math.sin(a) * sp; ball.vy = -Math.cos(a) * sp;
          status(`🏓 ${hits}`);
        }
      }
      if (ball.y > H + 10) { over = true; c.off(); done(hits); return false; }
    }
    // the table
    g.fillStyle = '#1f4f7a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(4, 4, W - 8, H - 8);
    g.beginPath(); g.moveTo(W / 2, 4); g.lineTo(W / 2, H - 4); g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, H / 2 - 2, W, 4); // the net
    g.fillStyle = '#e8c98e'; g.fillRect(yuto - PW / 2, 20, PW, PH);
    g.fillStyle = '#e58aa6'; g.fillRect(me - PW / 2, H - 30, PW, PH);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 16px Georgia, serif'; g.fillText('Yuto', 8, 52); g.fillText(`You · ${hits}`, 8, H - 40);
  });
  return { stop() { stopLoop(); c.off(); } };
}

// ── pool: top down, ten shots to pot the seven
function pool(cv, done, status) {
  cv.width = 440; cv.height = 250;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, M = 18, R = 8;
  const pockets = [[M, M], [W / 2, M - 3], [W - M, M], [M, H - M], [W / 2, H - M + 3], [W - M, H - M]];
  const COL = ['#e2b04a', '#3a5fc4', '#c94a4a', '#7a3fa0', '#e07a2a', '#2f8a4a', '#8a2a2a'];
  const balls = [{ x: W * 0.27, y: H / 2, vx: 0, vy: 0, c: '#fffaf0', cue: true }];
  let k = 0;
  for (let row = 0; row < 4 && k < 7; row++) for (let i = 0; i <= row && k < 7; i++) balls.push({ x: W * 0.66 + row * R * 1.8, y: H / 2 + (i - row / 2) * R * 2.05, vx: 0, vy: 0, c: COL[k++] });
  let shots = 10, potted = 0, aim = null, ended = false;
  const cue = balls[0];
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  const moving = () => balls.some(b => !b.gone && (b.vx || b.vy));
  const down = e => { if (!moving() && shots > 0) aim = { from: pos(e), to: pos(e) }; };
  const move = e => { if (aim) aim.to = pos(e); };
  const up = () => {
    if (!aim) return;
    const dx = aim.from.x - aim.to.x, dy = aim.from.y - aim.to.y, len = Math.hypot(dx, dy);
    aim = null;
    if (len < 6) return;
    const power = Math.min(len, 120) * 8;
    cue.vx = dx / len * power; cue.vy = dy / len * power;
    shots--;
    status(`🎱 ${potted} potted · ${shots} shot${shots === 1 ? '' : 's'} left`);
  };
  cv.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);
  status('🎱 Drag back from anywhere on the table and let go — the white ball goes the other way.');
  const stopLoop = loop(dt => {
    for (let s = 0; s < 4; s++) {
      const h = dt / 4;
      for (const b of balls) {
        if (b.gone) continue;
        b.x += b.vx * h; b.y += b.vy * h;
        const f = Math.pow(0.3, h); b.vx *= f; b.vy *= f;
        if (Math.hypot(b.vx, b.vy) < 7) b.vx = b.vy = 0;
        if (b.x < M + R) { b.x = M + R; b.vx = Math.abs(b.vx) * 0.85; }
        if (b.x > W - M - R) { b.x = W - M - R; b.vx = -Math.abs(b.vx) * 0.85; }
        if (b.y < M + R) { b.y = M + R; b.vy = Math.abs(b.vy) * 0.85; }
        if (b.y > H - M - R) { b.y = H - M - R; b.vy = -Math.abs(b.vy) * 0.85; }
        for (const [px, py] of pockets) if (Math.hypot(b.x - px, b.y - py) < 15) {
          if (b.cue) { b.x = W * 0.27; b.y = H / 2; b.vx = b.vy = 0; status('🎱 In-off! The white goes back on the spot.'); }
          else { b.gone = true; potted++; status(`🎱 ${potted} potted · ${shots} shot${shots === 1 ? '' : 's'} left`); }
        }
      }
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        if (a.gone || b.gone) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < R * 2) {
          const nx = dx / d, ny = dy / d, over = (R * 2 - d) / 2;
          a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
          const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (p > 0) { a.vx -= p * nx; a.vy -= p * ny; b.vx += p * nx; b.vy += p * ny; }
        }
      }
    }
    if (!ended && !moving() && (potted === 7 || shots === 0)) { ended = true; setTimeout(() => { off(); done(potted); }, 400); }
    // draw
    g.fillStyle = '#5a3a26'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2f7a4a'; g.fillRect(M - 6, M - 6, W - 2 * M + 12, H - 2 * M + 12);
    g.fillStyle = '#111'; for (const [px, py] of pockets) { g.beginPath(); g.arc(px, py, 12, 0, Math.PI * 2); g.fill(); }
    for (const b of balls) if (!b.gone) { g.fillStyle = b.c; g.beginPath(); g.arc(b.x, b.y, R, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.stroke(); }
    if (aim) {
      const dx = aim.from.x - aim.to.x, dy = aim.from.y - aim.to.y;
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(cue.x, cue.y); g.lineTo(cue.x + dx * 2, cue.y + dy * 2); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#d9b37a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cue.x - dx * 0.2, cue.y - dy * 0.2); g.lineTo(cue.x - dx * 1.4 - dx / (Math.hypot(dx, dy) || 1) * 90, cue.y - dy * 1.4 - dy / (Math.hypot(dx, dy) || 1) * 90); g.stroke(); g.lineWidth = 1;
    }
  });
  const off = () => { stopLoop(); cv.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  return { stop: off };
}

// ── baby-foot: ten shots past the keeper
function foosball(cv, done, status) {
  cv.width = 340; cv.height = 440;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const GOAL = { x0: W / 2 - 64, x1: W / 2 + 64 };
  let me = W / 2, shots = 10, goals = 0, ball = null, t = 0, keeper = W / 2, speed = 1.6, ended = false, msg = 0;
  const shoot = () => { if (!ball && shots > 0 && !ended) { ball = { x: me, y: H - 70, vy: -520 }; shots--; } };
  const c = controls(cv, { onTap: shoot });
  status('⚽ Ten shots. Line up and shoot!');
  const stopLoop = loop(dt => {
    t += dt;
    if (c.left) me -= 300 * dt;
    if (c.right) me += 300 * dt;
    if (c.x != null && !c.left && !c.right) me += (c.x - me) * Math.min(1, dt * 14);
    me = clamp(me, 40, W - 40);
    // the keeper slides across the goal, quicker as you score
    keeper = W / 2 + Math.sin(t * speed) * 40 + Math.sin(t * speed * 2.3) * 12;
    if (ball) {
      ball.y += ball.vy * dt;
      if (ball.y < 70 && ball.y > 50 && Math.abs(ball.x - keeper) < 30) { status(`🧤 Saved! ${goals} goal${goals === 1 ? '' : 's'} · ${shots} left`); ball = null; msg = 1; }
      else if (ball && ball.y < 40) {
        if (ball.x > GOAL.x0 && ball.x < GOAL.x1) { goals++; speed += 0.25; status(`⚽ GOAL! ${goals} · ${shots} left`); }
        else status(`😬 Wide! ${goals} goal${goals === 1 ? '' : 's'} · ${shots} left`);
        ball = null;
      }
    }
    if (!ball && shots === 0 && !ended) { ended = true; setTimeout(() => { c.off(); stopLoop(); done(goals); }, 600); }
    // the pitch
    g.fillStyle = '#3f8a4a'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#43914e' : '#3b8346'; g.fillRect(0, i * H / 8, W, H / 8); }
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(10, 30, W - 20, H - 40);
    g.fillStyle = '#ddd'; g.fillRect(GOAL.x0, 14, GOAL.x1 - GOAL.x0, 16);
    g.strokeStyle = '#fff'; g.strokeRect(GOAL.x0, 14, GOAL.x1 - GOAL.x0, 16);
    // the rods
    g.fillStyle = '#c0c4c8'; g.fillRect(0, 58, W, 4); g.fillRect(0, H - 72, W, 4);
    g.fillStyle = '#2f5fc4'; g.fillRect(keeper - 22, 50, 44, 20); // their keeper
    g.fillStyle = '#c4627f'; g.fillRect(me - 14, H - 82, 28, 22); // your striker
    if (ball) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ball.x, ball.y, 7, 0, Math.PI * 2); g.fill(); }
    else if (shots > 0) { g.fillStyle = '#fff'; g.beginPath(); g.arc(me, H - 92, 7, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fff'; g.font = 'bold 16px Georgia, serif'; g.fillText(`⚽ ${goals}   · ${shots} shots left`, 14, H - 16);
    return msg >= 0;
  });
  return { stop() { stopLoop(); c.off(); } };
}
