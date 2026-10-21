// Sakura Eights: the café's own colour-matching card game, for 2–6 players.
// Four colours (sakura, matcha, sky, honey), numbers 0–9, and in each colour
// skip, reverse and draw-two; plus wilds and wild draw-fours. Match the top
// card's colour or number (or play a wild and call a colour); can't, and you
// draw one — play it if it fits, or pass. First to empty their hand wins;
// with one card left you call "Sakura!".
//
// Each card is two characters: colour (p sakura, g matcha, b sky, y honey,
// x wild) and value (0–9, s skip, r reverse, d draw two, w wild, f wild four),
// so a hand or the whole deck is a short string — small enough to send.
//
// state: { started, order, turn, dir, deck, top, color, hands: { a: 'p5g2…' },
//          drew, last, winner }

export const COLORS = { p: 'sakura', g: 'matcha', b: 'sky', y: 'honey' };
export const HEX = { p: '#e58aa6', g: '#6f9f63', b: '#5f8fc4', y: '#e2b04a', x: '#3a2f3a' };
const cards = h => (h.match(/../g) || []);

export function fullDeck() {
  const d = [];
  for (const c of 'pgby') {
    d.push(c + '0');
    for (const v of '123456789srd') d.push(c + v, c + v);
  }
  for (let i = 0; i < 4; i++) d.push('xw', 'xf');
  return d;
}
function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function newEights(order, rnd = Math.random) {
  const deck = shuffle(fullDeck(), rnd);
  const hands = {};
  for (const s of order) hands[s] = deck.splice(0, 7).join('');
  // turn up a number card to start on
  let i = deck.findIndex(c => /[0-9]/.test(c[1]));
  const top = deck.splice(i, 1)[0];
  return { started: true, order: order.slice(), turn: order[0], dir: 1, deck: deck.join(''), top, color: top[0], hands, drew: false, last: null, winner: null };
}

export const canPlay = (s, card) => card[0] === 'x' || card[0] === s.color || card[1] === s.top[1];
export const playable = (s, seat) => cards(s.hands[seat]).filter(c => canPlay(s, c));
export const handOf = (s, seat) => cards(s.hands[seat] || '');
export const name = card => (card[0] === 'x' ? (card[1] === 'f' ? 'Wild draw four' : 'Wild') : `${COLORS[card[0]]} ${{ s: 'skip', r: 'reverse', d: 'draw two' }[card[1]] || card[1]}`);

const nextSeat = (s, from, steps = 1) => {
  const n = s.order.length, i = s.order.indexOf(from);
  return s.order[(((i + s.dir * steps) % n) + n) % n];
};
// take n cards off the deck (a fresh shuffle of what's not in anyone's hand when it runs out)
function take(s, n, rnd) {
  let deck = cards(s.deck), out = [];
  while (out.length < n) {
    if (!deck.length) {
      const held = [...Object.values(s.hands).flatMap(cards), s.top, ...out];
      const fresh = fullDeck();
      for (const c of held) { const k = fresh.indexOf(c); if (k >= 0) fresh.splice(k, 1); }
      deck = shuffle(fresh, rnd);
      if (!deck.length) break;
    }
    out.push(deck.shift());
  }
  return { drawn: out, deck: deck.join('') };
}

// Play a card from your hand (color: the colour you call, for a wild).
export function playCard(s, card, color, rnd = Math.random) {
  const seat = s.turn, hand = handOf(s, seat);
  const k = hand.indexOf(card);
  if (k < 0 || !canPlay(s, card) || s.winner) return s;
  hand.splice(k, 1);
  const n = { ...s, hands: { ...s.hands, [seat]: hand.join('') }, top: card, color: card[0] === 'x' ? (COLORS[color] ? color : 'p') : card[0], drew: false };
  n.last = { seat, play: card, color: n.color, sakura: hand.length === 1 };
  if (!hand.length) { n.winner = seat; n.turn = seat; return n; }
  const v = card[1];
  if (v === 'r') n.dir = -s.dir;
  const victim = nextSeat(n, seat);
  if (v === 'd' || v === 'f') {
    const { drawn, deck } = take(n, v === 'd' ? 2 : 4, rnd);
    n.hands[victim] = n.hands[victim] + drawn.join('');
    n.deck = deck;
    n.last.made = { seat: victim, draw: drawn.length };
    n.turn = nextSeat(n, seat, 2);
  } else if (v === 's' || (v === 'r' && s.order.length === 2)) n.turn = nextSeat(n, seat, 2);
  else n.turn = victim;
  return n;
}

// Can't (or won't) play: draw one. You may then play it if it fits, or pass.
export function drawCard(s, rnd = Math.random) {
  if (s.drew || s.winner) return s;
  const seat = s.turn;
  const { drawn, deck } = take(s, 1, rnd);
  return { ...s, deck, hands: { ...s.hands, [seat]: s.hands[seat] + drawn.join('') }, drew: true, last: { seat, drew: 1 } };
}
export function pass(s) {
  if (!s.drew || s.winner) return s;
  return { ...s, drew: false, turn: nextSeat(s, s.turn), last: { seat: s.turn, passed: true } };
}

// The team's way of playing: hold on to wilds, hurt whoever's about to win,
// and call the colour you've most of.
export function botTurn(s, rnd = Math.random) {
  const seat = s.turn;
  const can = playable(s, seat);
  if (!can.length) {
    if (s.drew) return pass(s);
    const d = drawCard(s, rnd);
    const fresh = handOf(d, seat).slice(-1)[0];
    return fresh && canPlay(d, fresh) ? playCard(d, fresh, bestColor(d, seat), rnd) : pass(d);
  }
  const nextLeft = handOf(s, nextSeat(s, seat)).length;
  const score = c => (c[0] === 'x' ? (handOf(s, seat).length <= 2 || nextLeft <= 2 ? 50 : -20) : 0)
    + ('sdr'.includes(c[1]) ? (nextLeft <= 3 ? 30 : 5) : 0) + (c[0] === s.color ? 3 : 0) + rnd();
  const card = can.sort((x, y) => score(y) - score(x))[0];
  return playCard(s, card, bestColor(s, seat, card), rnd);
}
function bestColor(s, seat, without) {
  const count = { p: 0, g: 0, b: 0, y: 0 };
  let skipped = false;
  for (const c of handOf(s, seat)) { if (c === without && !skipped) { skipped = true; continue; } if (count[c[0]] != null) count[c[0]]++; }
  return Object.entries(count).sort((x, y) => y[1] - x[1])[0][0];
}
