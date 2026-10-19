// Tawla (backgammon), the way it's played in Cairo cafés: fifteen checkers
// each, two dice, race them round and bear them off. Plain rules, no
// doubling cube. Pure functions over a small state, so the same state can be
// sent to the server and drawn anywhere.
//
// pts[i] > 0: player a's checkers on point i; < 0: player b's.
// a moves from point 23 down to 0 and bears off below 0; b moves up from 0
// and bears off above 23. a's home is 0–5, b's is 18–23.

const SIGN = { a: 1, b: -1 };
const other = p => (p === 'a' ? 'b' : 'a');

export function newTawla() {
  const pts = Array(24).fill(0);
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;       // a
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;  // b
  return { pts, bar: { a: 0, b: 0 }, off: { a: 0, b: 0 }, turn: 'a', dice: [], left: [], winner: null };
}

const own = (s, p, i) => s.pts[i] * SIGN[p] > 0;
const count = (s, p, i) => Math.max(0, s.pts[i] * SIGN[p]);
const blocked = (s, p, i) => s.pts[i] * SIGN[p] <= -2;
const home = (p, i) => (p === 'a' ? i <= 5 : i >= 18);

function allHome(s, p) {
  if (s.bar[p]) return false;
  for (let i = 0; i < 24; i++) if (own(s, p, i) && !home(p, i)) return false;
  return true;
}

// Every move the player whose turn it is can make with one of the dice left.
export function legalMoves(s) {
  const p = s.turn;
  const out = [];
  if (s.winner || !s.left.length) return out;
  const dice = [...new Set(s.left)];
  if (s.bar[p]) {
    for (const d of dice) {
      const to = p === 'a' ? 24 - d : d - 1;
      if (!blocked(s, p, to)) out.push({ from: 'bar', to, die: d });
    }
    return out;
  }
  const bearing = allHome(s, p);
  for (let i = 0; i < 24; i++) {
    if (!own(s, p, i)) continue;
    for (const d of dice) {
      const to = p === 'a' ? i - d : i + d;
      if (to >= 0 && to <= 23) {
        if (!blocked(s, p, to)) out.push({ from: i, to, die: d });
      } else if (bearing) {
        const exact = p === 'a' ? to === -1 : to === 24;
        // a bigger die than needed only bears off the checker furthest back
        let furthest = true;
        if (!exact) {
          if (p === 'a') { for (let j = i + 1; j <= 5; j++) if (own(s, p, j)) furthest = false; }
          else { for (let j = 18; j < i; j++) if (own(s, p, j)) furthest = false; }
        }
        if (exact || furthest) out.push({ from: i, to: 'off', die: d });
      }
    }
  }
  return out;
}

export function roll(s, rnd = Math.random) {
  const d1 = 1 + Math.floor(rnd() * 6), d2 = 1 + Math.floor(rnd() * 6);
  const n = clone(s);
  n.dice = [d1, d2];
  n.left = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  if (!legalMoves(n).length) n.passed = true; // nothing to play: the turn goes over
  return n;
}

export function move(s, mv) {
  const p = s.turn, sg = SIGN[p];
  const n = clone(s);
  if (mv.from === 'bar') n.bar[p]--;
  else n.pts[mv.from] -= sg;
  if (mv.to === 'off') n.off[p]++;
  else {
    if (n.pts[mv.to] * sg === -1) { n.pts[mv.to] = 0; n.bar[other(p)]++; n.hit = true; } // a lone checker is hit
    n.pts[mv.to] += sg;
  }
  n.left.splice(n.left.indexOf(mv.die), 1);
  if (n.off[p] === 15) n.winner = p;
  else if (!n.left.length || !legalMoves(n).length) endTurn(n);
  return n;
}

export function endTurn(n) {
  n.turn = other(n.turn);
  n.dice = []; n.left = []; n.passed = false;
  return n;
}

function clone(s) {
  return { ...s, pts: s.pts.slice(), bar: { ...s.bar }, off: { ...s.off }, dice: s.dice.slice(), left: s.left.slice(), hit: false, passed: false };
}

// Yuto's tawla: a sensible, unhurried player — he likes hitting a lone
// checker, making points, and bearing off; he doesn't like leaving blots.
export function bestMove(s) {
  const p = s.turn, sg = SIGN[p];
  const moves = legalMoves(s);
  let best = null, bestScore = -Infinity;
  for (const mv of moves) {
    const n = move({ ...s, turn: p }, mv);
    let sc = Math.random() * 2;
    if (mv.to === 'off') sc += 30;
    if (n.hit) sc += 25;
    if (mv.from === 'bar') sc += 8;
    if (mv.to !== 'off') {
      const c = n.pts[mv.to] * sg;
      if (c === 2) sc += 14;            // made a point
      if (c === 1) sc -= home(other(p), mv.to) ? 4 : 8; // left a blot where it lands
    }
    if (mv.from !== 'bar' && n.pts[mv.from] * sg === 1) sc -= 7; // left a blot behind
    sc += mv.die * 0.6;                 // and get on with the race
    if (sc > bestScore) { bestScore = sc; best = mv; }
  }
  return best;
}

export const tawlaScore = s => ({ a: s.off.a, b: s.off.b });
