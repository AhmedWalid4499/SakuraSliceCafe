// Games at the tables: chess, and tawla (backgammon) the way Cairo plays it.
// Sit at a table, open 🎲, and play whoever sits across from you — or Yuto,
// who's always happy to (gently). The board sits on the table for everyone to
// see; anyone can walk over and watch. The server keeps the board and whose
// turn it is (realtime.js); the rules run here (chess.js, tawla.mjs).

import * as THREE from 'three';
import { Chess } from 'chess.js';
import { newTawla, roll, move as tawlaMove, legalMoves, bestMove, endTurn } from './tawla.mjs';

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const VALUE = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 };
const YUTO_LINES = ['Hmm… there.', 'Your move 🌸', 'Ah — I see what you did.', 'Take your time.', 'This is a good game.', 'Careful now…'];

export function createGames({ world, send, me, seatTable, toast, bubble, sound, openPanel, isOpen, $ }) {
  const games = new Map(); // table id → game
  const boards = new Map(); // table id → 3D board on the table
  let viewing = null;       // the table whose game is open in the panel
  let pick = null;          // the square / point picked up
  let thinking = false;     // Yuto is thinking

  const mine = g => (g.players.a && g.players.a.id === me()?.id ? 'a' : g.players.b && g.players.b.id === me()?.id ? 'b' : null);
  const yutoPlays = g => g.players.b && g.players.b.id === 'yuto';
  const yuto = () => world.npcs.find(n => n.id === 'yuto');

  // ── the table tops, by id
  function topOf(table) {
    let found = null;
    world.scene.traverse(o => { if (!found && o.userData && o.userData.tableId === table) found = o; });
    return found;
  }

  // ── the board on the table, drawn from above
  function drawBoard(g) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    if (g.kind === 'chess') {
      const ch = new Chess(g.state.fen);
      const sq = 512 / 8;
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
        x.fillStyle = (r + f) % 2 ? '#8a5a3a' : '#f1dfc4';
        x.fillRect(f * sq, r * sq, sq, sq);
      }
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${sq * 0.8}px serif`;
      ch.board().forEach((row, r) => row.forEach((p, f) => {
        if (!p) return;
        x.fillStyle = p.color === 'w' ? '#fffaf2' : '#2b1d18';
        x.strokeStyle = p.color === 'w' ? '#3b2a22' : '#f1dfc4'; x.lineWidth = 2;
        x.strokeText(GLYPH[p.type], f * sq + sq / 2, r * sq + sq / 2 + 3);
        x.fillText(GLYPH[p.type], f * sq + sq / 2, r * sq + sq / 2 + 3);
      }));
    } else {
      const s = g.state;
      x.fillStyle = '#6b4226'; x.fillRect(0, 0, 512, 512);
      x.fillStyle = '#e9d6b4'; x.fillRect(16, 16, 230, 480); x.fillRect(266, 16, 230, 480);
      const colX = i => { const k = i % 12; const left = k >= 6; return (left ? 16 : 266) + (left ? 11 - k : 5 - k) * 38.3 + 19; };
      for (let i = 0; i < 24; i++) {
        const top = i >= 12, cx = top ? 512 - colX(i) : colX(i);
        x.fillStyle = i % 2 ? '#a8452e' : '#2f5d3a';
        x.beginPath();
        if (top) { x.moveTo(cx - 17, 16); x.lineTo(cx + 17, 16); x.lineTo(cx, 200); }
        else { x.moveTo(cx - 17, 496); x.lineTo(cx + 17, 496); x.lineTo(cx, 312); }
        x.fill();
        const n = Math.abs(s.pts[i]);
        for (let k = 0; k < Math.min(n, 5); k++) {
          x.fillStyle = s.pts[i] > 0 ? '#fffaf2' : '#2b1d18';
          x.beginPath(); x.arc(cx, top ? 34 + k * 34 : 478 - k * 34, 16, 0, Math.PI * 2); x.fill();
          x.strokeStyle = '#00000055'; x.stroke();
        }
      }
      for (const [p, y] of [['a', 300], ['b', 212]]) for (let k = 0; k < s.bar[p]; k++) {
        x.fillStyle = p === 'a' ? '#fffaf2' : '#2b1d18';
        x.beginPath(); x.arc(256, y + (p === 'a' ? k * 20 : -k * 20), 9, 0, Math.PI * 2); x.fill();
      }
      (s.dice || []).forEach((d, k) => {
        x.fillStyle = '#fffaf2'; x.fillRect(150 + k * 40, 240, 30, 30);
        x.fillStyle = '#2b1d18'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(d, 165 + k * 40, 256);
      });
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  function show3D(table) {
    const g = games.get(table);
    const top = topOf(table);
    const old = boards.get(table);
    if (!g) {
      if (old) { old.mesh.parent && old.mesh.parent.remove(old.mesh); old.mesh.material.map.dispose(); boards.delete(table); }
      if (top && top.userData.vase) top.userData.vase.visible = true;
      return;
    }
    if (!top) return;
    const tex = drawBoard(g);
    if (old && old.kind === g.kind) { old.mesh.material.map.dispose(); old.mesh.material.map = tex; old.mesh.material.needsUpdate = true; return; }
    if (old) { old.mesh.parent && old.mesh.parent.remove(old.mesh); old.mesh.material.map.dispose(); }
    const size = g.kind === 'chess' ? 0.4 : 0.46;
    const board = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(size + 0.03, 0.018, size + 0.03), new THREE.MeshStandardMaterial({ color: '#5a3a26', roughness: 0.6 }));
    base.position.y = 0.009;
    base.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.0185;
    board.add(base, face);
    const p = new THREE.Vector3(); top.getWorldPosition(p);
    board.position.set(p.x, top.userData.top, p.z);
    board.rotation.y = Math.random() * 0.3 - 0.15;
    const label = g.kind === 'chess' ? 'A game of chess' : 'A game of tawla';
    board.traverse(o => { if (o.isMesh) o.userData = { kind: 'game', table, label: `${label} — ${g.players.a.name} and ${g.players.b ? g.players.b.name : '…'} · click to watch` }; });
    top.parent.add(board);
    // it goes in the same floor's list of things you can click
    for (const f of Object.values(world.floors)) if (f.surfaces && f.surfaces.includes(top)) f.interactables.push(base, face);
    if (top.userData.vase) top.userData.vase.visible = false;
    boards.set(table, { kind: g.kind, mesh: board, face: face.material });
  }

  // ── messages from the server
  function onMessage(m) {
    if (m.t === 'games') {
      for (const t of [...games.keys()]) { games.delete(t); show3D(t); }
      for (const g of m.games) { games.set(g.table, g); show3D(g.table); }
    } else if (m.t === 'game') {
      const before = games.get(m.game.table);
      games.set(m.game.table, m.game);
      show3D(m.game.table);
      const g = m.game, side = mine(g);
      // someone starts a game at your table, with a seat free for you
      if (!before && !side && !g.players.b && seatTable() === g.table) toast(`🎲 ${g.players.a.name} set out a ${g.kind === 'chess' ? 'chess board' : 'tawla board'} at your table — press 🎲 Games to play.`);
      if (before && !before.players.b && g.players.b && side === 'a' && g.players.b.id !== 'yuto') toast(`🎲 ${g.players.b.name} sat down to play. You start!`);
      if (side && g.turn === side && before && before.turn !== side && !g.over) sound.cue('chat');
      if (g.over && !(before && before.over)) {
        const w = g.over.winner ? g.players[g.over.winner] : null;
        if (side || viewing === g.table) toast(w ? `🏆 ${w.name} won${g.over.why ? ' — ' + g.over.why : ''}!` : `🤝 A draw${g.over.why ? ' — ' + g.over.why : ''}.`);
        if (w && w.id === 'yuto') { const y = yuto(); if (y) bubble(y.av.group, 'Good game! Another? 🌸', 'npc'); }
      }
      maybeYuto(g);
    } else if (m.t === 'game:end') {
      games.delete(m.table);
      show3D(m.table);
    }
    if (viewing && isOpen()) render();
  }

  // ── Yuto's turn (played by the browser of whoever invited him)
  function maybeYuto(g) {
    if (!g || g.over || !yutoPlays(g) || g.turn !== 'b' || mine(g) !== 'a' || thinking) return;
    thinking = true;
    const table = g.table;
    setTimeout(() => {
      const cur = games.get(table);
      if (!cur || cur.over || cur.turn !== 'b') { thinking = false; return; }
      if (cur.kind === 'chess') {
        const ch = new Chess(cur.state.fen);
        const mv = chessBest(ch);
        if (mv) ch.move(mv);
        commitChess(cur, ch);
        if (Math.random() < 0.3) { const y = yuto(); if (y) bubble(y.av.group, YUTO_LINES[Math.floor(Math.random() * YUTO_LINES.length)], 'npc'); }
        thinking = false;
      } else {
        // roll, then move his checkers one at a time
        let s = roll(cur.state);
        if (s.passed) { s = endTurn(s); sendMove(cur, s); thinking = false; return; }
        sendMove(cur, s);
        const step = () => {
          const c2 = games.get(table);
          if (!c2 || c2.over) { thinking = false; return; }
          const mv = bestMove(s);
          if (!mv) { s = endTurn(s); sendMove(c2, s); thinking = false; return; }
          s = tawlaMove(s, mv);
          sendMove(c2, s);
          if (s.turn === 'b' && !s.winner) setTimeout(step, 700); else thinking = false;
        };
        setTimeout(step, 900);
      }
    }, 900 + Math.random() * 900);
  }

  // Yuto's chess: two moves ahead, likes material, not a grandmaster.
  function chessBest(ch) {
    const evalBoard = c => {
      let v = 0;
      c.board().forEach((row, r) => row.forEach((p, f) => {
        if (!p) return;
        const centre = 0.08 * (3.5 - Math.abs(3.5 - f)) * (p.type === 'p' || p.type === 'n' ? 1 : 0.3);
        v += (VALUE[p.type] + centre) * (p.color === 'b' ? 1 : -1);
      }));
      return v;
    };
    const search = (c, depth, alpha, beta, max) => {
      if (c.isCheckmate()) return max ? -1000 : 1000;
      if (c.isDraw()) return 0;
      if (depth === 0) return evalBoard(c);
      const moves = c.moves();
      if (max) {
        let best = -Infinity;
        for (const m of moves) { c.move(m); best = Math.max(best, search(c, depth - 1, alpha, beta, false)); c.undo(); alpha = Math.max(alpha, best); if (beta <= alpha) break; }
        return best;
      }
      let best = Infinity;
      for (const m of moves) { c.move(m); best = Math.min(best, search(c, depth - 1, alpha, beta, true)); c.undo(); beta = Math.min(beta, best); if (beta <= alpha) break; }
      return best;
    };
    const moves = ch.moves();
    if (!moves.length) return null;
    let best = null, bestV = -Infinity;
    for (const m of moves.sort(() => Math.random() - 0.5)) {
      ch.move(m);
      const v = search(ch, 2, -Infinity, Infinity, false) + Math.random() * 0.2;
      ch.undo();
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  }

  // ── sending moves
  function sendMove(g, state) {
    const over = g.kind === 'tawla' && state.winner ? { winner: state.winner, why: 'all fifteen home' } : null;
    send({ t: 'game', action: 'move', table: g.table, state, turn: state.turn, over });
    // show it straight away here too
    games.set(g.table, { ...g, state, turn: state.turn, over: over || null });
    show3D(g.table);
    if (viewing === g.table) render();
  }
  function commitChess(g, ch) {
    let over = null;
    if (ch.isCheckmate()) over = { winner: ch.turn() === 'w' ? 'b' : 'a', why: 'checkmate' };
    else if (ch.isStalemate()) over = { winner: null, why: 'stalemate' };
    else if (ch.isDraw()) over = { winner: null, why: 'a draw' };
    const state = { fen: ch.fen(), last: (ch.history({ verbose: true }).slice(-1)[0] || {}).san || null };
    const turn = ch.turn() === 'w' ? 'a' : 'b';
    send({ t: 'game', action: 'move', table: g.table, state, turn, over });
    games.set(g.table, { ...g, state, turn, over });
    show3D(g.table);
    if (viewing === g.table) render();
  }

  // ── the panel
  function open(table) {
    viewing = table || seatTable();
    pick = null;
    render();
    openPanel('gamePanel');
  }
  function start(kind, vs) {
    const table = seatTable();
    if (!table) return toast('Sit at a table first — then set out a board.');
    const state = kind === 'chess' ? { fen: new Chess().fen(), last: null } : newTawla();
    send({ t: 'game', action: 'start', table, kind, vs, state });
    if (vs === 'yuto') { const y = yuto(); if (y) bubble(y.av.group, kind === 'chess' ? 'Chess? Gladly. You play white 🌸' : 'Tawla! I warn you — I grew up on this.', 'npc'); }
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, fn, cls = 'btn') { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; }

  function render() {
    const g = games.get(viewing);
    const box = $('gameBody');
    box.replaceChildren();
    const sat = seatTable() === viewing;
    if (!g) {
      $('gameTitle').textContent = 'Games at the table';
      if (!sat) { box.append(el('p', 'fine', 'No game at this table right now. Sit down at a table to set one out.')); return; }
      box.append(el('p', 'lede', 'Set out a board. Play whoever sits across from you — or Yuto, who never says no to a game.'));
      for (const [kind, name, blurb] of [['tawla', '🎲 Tawla', 'Backgammon, the Cairo way: two dice, fifteen checkers, race them home.'], ['chess', '♟️ Chess', 'The old game. You play white.']]) {
        const card = el('div', 'game-choice');
        card.append(el('b', null, name), el('p', 'fine', blurb));
        const row = el('div', 'row');
        row.append(btn('Play Yuto', () => start(kind, 'yuto')), btn('Wait for a friend', () => start(kind, 'open'), 'btn ghost'));
        card.append(row);
        box.append(card);
      }
      return;
    }
    const side = mine(g);
    const names = `${g.players.a.name} ${g.kind === 'chess' ? '(white)' : '(light)'} · ${g.players.b ? g.players.b.name : 'a free seat'} ${g.kind === 'chess' ? '(black)' : '(dark)'}`;
    $('gameTitle').textContent = g.kind === 'chess' ? '♟️ Chess' : '🎲 Tawla';
    box.append(el('p', 'fine game-names', names));
    if (g.kind === 'chess') renderChess(g, side, box); else renderTawla(g, side, box);
    const status = el('p', 'game-status');
    if (g.over) {
      const w = g.over.winner ? g.players[g.over.winner] : null;
      status.textContent = w ? `🏆 ${w.name} won — ${g.over.why}.` : `🤝 ${g.over.why}.`;
    } else if (!g.players.b) status.textContent = side ? 'Waiting for someone to sit down across from you…' : 'There\'s a free seat — sit at this table to play.';
    else {
      const p = g.players[g.turn];
      status.textContent = side === g.turn ? 'Your turn.' : p.id === 'yuto' ? 'Yuto is thinking…' : `${p.name}'s turn.`;
    }
    box.append(status);
    const row = el('div', 'row');
    if (!g.players.b && !side && sat) row.append(btn('Sit in and play', () => send({ t: 'game', action: 'join', table: g.table })));
    if (!g.players.b && side === 'a') row.append(btn('Play Yuto instead', () => start(g.kind, 'yuto'), 'btn ghost'));
    if (g.over && side) row.append(btn('Play again', () => start(g.kind, yutoPlays(g) ? 'yuto' : 'open')));
    if (side) row.append(btn(g.over ? 'Put the board away' : 'Stop the game', () => { if (g.over || confirm('Stop this game and put the board away?')) send({ t: 'game', action: 'end', table: g.table }); }, 'btn ghost'));
    box.append(row);
  }

  function renderChess(g, side, box) {
    const ch = new Chess(g.state.fen);
    const myTurn = side && !g.over && g.players.b && g.turn === side;
    const color = side === 'b' ? 'b' : 'w';
    const files = 'abcdefgh';
    const targets = new Set(pick && myTurn ? ch.moves({ square: pick, verbose: true }).map(m => m.to) : []);
    const grid = el('div', 'chess');
    for (let i = 0; i < 64; i++) {
      const r = color === 'w' ? Math.floor(i / 8) : 7 - Math.floor(i / 8);
      const f = color === 'w' ? i % 8 : 7 - (i % 8);
      const sq = files[f] + (8 - r);
      const p = ch.get(sq);
      const cell = el('button', `sq ${(r + f) % 2 ? 'dark' : 'light'}${pick === sq ? ' picked' : ''}${targets.has(sq) ? ' target' : ''}${ch.inCheck() && p && p.type === 'k' && p.color === ch.turn() ? ' check' : ''}`);
      cell.type = 'button';
      if (p) { const s = el('span', p.color === 'w' ? 'pw' : 'pb', GLYPH[p.type]); cell.append(s); }
      cell.onclick = () => {
        if (!myTurn) return;
        if (pick && targets.has(sq)) {
          ch.move({ from: pick, to: sq, promotion: 'q' });
          pick = null;
          sound.cue('chat');
          commitChess(g, ch);
          return;
        }
        pick = p && p.color === color ? sq : null;
        render();
      };
      grid.append(cell);
    }
    box.append(grid);
    if (g.state.last) box.append(el('p', 'fine', `Last move: ${g.state.last}`));
  }

  function renderTawla(g, side, box) {
    const s = g.state;
    const myTurn = side && !g.over && g.players.b && g.turn === side;
    const moves = myTurn ? legalMoves(s) : [];
    const from = new Set(moves.map(m => String(m.from)));
    const to = new Set(moves.filter(m => String(m.from) === String(pick)).map(m => String(m.to)));
    const board = el('div', 'tawla');
    const point = i => {
      const top = i >= 12;
      const cell = el('button', `pt ${top ? 'top' : 'bottom'} ${i % 2 ? 'red' : 'green'}${String(pick) === String(i) ? ' picked' : ''}${to.has(String(i)) ? ' target' : ''}${from.has(String(i)) && !pick ? ' can' : ''}`);
      cell.type = 'button';
      const n = Math.abs(s.pts[i]);
      for (let k = 0; k < Math.min(n, 5); k++) cell.append(el('i', s.pts[i] > 0 ? 'ck light' : 'ck dark'));
      if (n > 5) cell.append(el('em', null, `+${n - 5}`));
      cell.onclick = () => click(String(i));
      return cell;
    };
    const topRow = el('div', 'row-pts'), botRow = el('div', 'row-pts');
    for (let i = 12; i <= 23; i++) { topRow.append(point(i)); if (i === 17) topRow.append(el('div', 'bar-gap')); }
    for (let i = 11; i >= 0; i--) { botRow.append(point(i)); if (i === 6) botRow.append(el('div', 'bar-gap')); }
    const mid = el('div', 'tawla-mid');
    const bar = btn(`Bar · light ${s.bar.a} · dark ${s.bar.b}`, () => click('bar'), `bar-btn${String(pick) === 'bar' ? ' picked' : ''}${from.has('bar') ? ' can' : ''}`);
    const dice = el('div', 'dice');
    (s.dice || []).forEach(d => dice.append(el('span', s.left.includes(d) ? 'die' : 'die used', String(d))));
    mid.append(bar, dice);
    if (to.has('off')) mid.append(btn('Bear off ↗', () => click('off'), 'btn'));
    board.append(topRow, mid, botRow);
    box.append(board);
    box.append(el('p', 'fine', `Home: light ${s.off.a} / 15 · dark ${s.off.b} / 15. ${side ? `You play ${side === 'a' ? 'light — towards the bottom right' : 'dark — towards the top right'}.` : ''}`));
    if (myTurn && !s.left.length) {
      const r = btn('🎲 Roll the dice', () => {
        let n = roll(s);
        sound.cue('chat');
        if (n.passed) { toast('No moves with that roll — the turn passes.'); n = endTurn(n); }
        pick = null;
        sendMove(g, n);
      });
      box.append(r);
    }
    function click(where) {
      if (!myTurn || !s.left.length) return;
      if (pick != null && to.has(where)) {
        const mv = moves.find(m => String(m.from) === String(pick) && String(m.to) === where);
        pick = null;
        const n = tawlaMove(s, mv);
        if (n.hit) toast('Hit! 💥 Back to the bar it goes.');
        sendMove(g, n);
        return;
      }
      pick = from.has(where) ? where : null;
      render();
    }
  }

  return {
    onMessage, open,
    // is there a game going at this table?
    at: table => games.get(table) || null,
    hasGame: table => { const g = games.get(table); return !!(g && !g.over); },
    viewing: () => viewing,
  };
}
