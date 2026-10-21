// Snakes and ladders (السلم والثعبان), on a Cairo board: climb the café's
// stairs, a felucca's mast, a minaret, all the way up Cairo Tower; slip into
// the Nile, get cut off by a tuk-tuk, spill your tea. Roll a six and you roll
// again; you have to land on 100 exactly. Pure functions over a small state,
// so the same state goes to the server and is drawn anywhere.
//
// state: { started, order: ['a', 'b', …], turn, pos: { a: 0 … 100 }, last, winner }

export const LADDERS = {
  4: [14, 'the café stairs'], 9: [31, 'a felucca mast'], 21: [42, 'a minaret'], 28: [84, 'Cairo Tower'],
  36: [44, 'the roof-garden ladder'], 51: [67, 'a pigeon tower'], 71: [91, 'the bridge over the Nile'], 80: [100, 'a hot-air balloon over Luxor'],
};
export const SNAKES = {
  16: [6, 'spilled your tea'], 47: [26, 'a tuk-tuk cut you off'], 49: [11, 'slipped into the Nile'], 56: [53, 'stepped on a sleeping cat'],
  62: [19, 'lost your way in Khan el-Khalili'], 64: [60, 'the koshari was too hot'], 87: [24, 'the power went out'],
  93: [73, 'missed the microbus'], 95: [75, 'a sandstorm blew in'], 98: [78, 'dropped your basbousa'],
};

export function newSnakes(order) {
  const pos = {};
  for (const s of order) pos[s] = 0;
  return { started: true, order: order.slice(), turn: order[0], pos, last: null, winner: null };
}

// Roll for whoever's turn it is. rnd: () => [0, 1)
export function rollSnakes(s, rnd = Math.random) {
  if (s.winner) return s;
  const seat = s.turn, die = 1 + Math.floor(rnd() * 6);
  const from = s.pos[seat];
  let to = from + die, via = null, name = null;
  if (to > 100) to = from; // you have to land on 100 exactly
  else if (LADDERS[to]) { [to, name] = [LADDERS[to][0], LADDERS[to][1]]; via = 'ladder'; }
  else if (SNAKES[to]) { [to, name] = [SNAKES[to][0], SNAKES[to][1]]; via = 'snake'; }
  const pos = { ...s.pos, [seat]: to };
  const winner = to === 100 ? seat : null;
  // a six rolls again (unless you've just won)
  const i = s.order.indexOf(seat);
  const turn = winner || die === 6 ? seat : s.order[(i + 1) % s.order.length];
  return { ...s, pos, turn, winner, last: { seat, die, from, to, via, name, landed: from + die <= 100 ? from + die : from, again: !winner && die === 6 } };
}

// square n (1–100) to its row and column on the board, 1 in the bottom left, snaking up
export function cellOf(n) {
  const r = Math.floor((n - 1) / 10), c = (n - 1) % 10;
  return { row: 9 - r, col: r % 2 ? 9 - c : c };
}
