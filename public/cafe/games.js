// Games at the tables: chess, tawla (backgammon) the way Cairo plays it,
// snakes and ladders on a Cairo board, and Sakura Eights, the café's own
// colour-matching card game. Sit at a table, open 🎲, and play whoever sits
// with you — or the team: Yuto plays chess and tawla, and Yuto, Hana, Yuki and
// Me3temed will fill empty seats for snakes and ladders and cards. The board
// sits on the table for everyone to see; anyone can walk over and watch. The
// server keeps the board and whose turn it is (realtime.js); the rules run
// here (chess.js, tawla.mjs, snakes.mjs, eights.mjs).

import * as THREE from 'three';
import { Chess } from 'chess.js';
import { newTawla, roll, move as tawlaMove, legalMoves, bestMove, endTurn } from './tawla.mjs';
import { newSnakes, rollSnakes, LADDERS, SNAKES, cellOf } from './snakes.mjs';
import { newEights, playCard, drawCard, pass as passTurn, botTurn, canPlay, handOf, COLORS, HEX, name as cardName } from './eights.mjs';

// the team, when they sit in for snakes and ladders or cards
const TEAM = [['yuto', 'Yuto'], ['hana', 'Hana'], ['yuki', 'Yuki'], ['me3temed', 'Me3temed']];
const TEAM_IDS = new Set(TEAM.map(t => t[0]));
const MULTI = { snakes: 4, eights: 6 }; // the games for more than two
const TOKENS = ['#d4678a', '#3f6a8a', '#e8b44a', '#4f8a4a', '#8a4d6a', '#c0763a'];
const KIND_NAME = { chess: '♟️ Chess', tawla: '🎲 Tawla', snakes: '🐍 Snakes and ladders', eights: '🌸 Sakura Eights' };
const SET_OUT = { chess: 'a chess board', tawla: 'a tawla board', snakes: 'a snakes and ladders board', eights: 'a deck of Sakura Eights' };

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const VALUE = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 };
const YUTO_LINES = ['Hmm… there.', 'Your move 🌸', 'Ah — I see what you did.', 'Take your time.', 'This is a good game.', 'Careful now…'];

export function createGames({ world, send, me, seatTable, toast, bubble, sound, openPanel, isOpen, $ }) {
  const games = new Map(); // table id → game
  const boards = new Map(); // table id → 3D board on the table
  let viewing = null;       // the table whose game is open in the panel
  let pick = null;          // the square / point picked up
  let thinking = false;     // Yuto is thinking

  const mine = g => Object.keys(g.players).find(k => g.players[k] && g.players[k].id === me()?.id) || null;
  const seated = g => Object.keys(g.players).filter(k => g.players[k]).sort();
  const isBot = p => p && TEAM_IDS.has(p.id);
  const npc = id => world.npcs.find(n => n.id === id);
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
    } else if (g.kind === 'snakes') {
      drawSnakes(x, g);
    } else if (g.kind === 'eights') {
      drawEights(x, g);
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

  // snakes and ladders, seen from above: the snaking squares, the ladders and snakes, the tokens
  function drawSnakes(x, g) {
    const S = 512 / 10;
    for (let n = 1; n <= 100; n++) {
      const { row, col } = cellOf(n);
      x.fillStyle = ['#fbe3ea', '#e3eedf', '#fdf3e6', '#e1e7f0'][(row + col) % 4];
      x.fillRect(col * S, row * S, S, S);
      x.fillStyle = '#8a6a5a'; x.font = '13px sans-serif'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.fillText(n, col * S + 3, row * S + 2);
    }
    const mid = n => { const { row, col } = cellOf(n); return [col * S + S / 2, row * S + S / 2]; };
    x.lineCap = 'round';
    for (const [a, [b]] of Object.entries(LADDERS)) {
      const [x0, y0] = mid(+a), [x1, y1] = mid(b), dx = y1 - y0, dy = x0 - x1, l = Math.hypot(dx, dy) || 1, ox = dx / l * 7, oy = dy / l * 7;
      x.strokeStyle = '#8a5a3a'; x.lineWidth = 4;
      for (const k of [-1, 1]) { x.beginPath(); x.moveTo(x0 + ox * k, y0 + oy * k); x.lineTo(x1 + ox * k, y1 + oy * k); x.stroke(); }
      const rungs = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 18));
      x.lineWidth = 3;
      for (let r = 1; r < rungs; r++) { const t = r / rungs, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t; x.beginPath(); x.moveTo(cx - ox, cy - oy); x.lineTo(cx + ox, cy + oy); x.stroke(); }
    }
    for (const [a, [b]] of Object.entries(SNAKES)) {
      const [x0, y0] = mid(+a), [x1, y1] = mid(b);
      x.strokeStyle = '#3f7a35'; x.lineWidth = 8;
      x.beginPath(); x.moveTo(x0, y0);
      x.bezierCurveTo(x0 + 40, (y0 * 2 + y1) / 3, x1 - 40, (y0 + y1 * 2) / 3, x1, y1); x.stroke();
      x.fillStyle = '#2f5d2a'; x.beginPath(); x.arc(x0, y0, 9, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ffe7a0'; x.beginPath(); x.arc(x0 - 3, y0 - 2, 2, 0, Math.PI * 2); x.arc(x0 + 3, y0 - 2, 2, 0, Math.PI * 2); x.fill();
    }
    const st = g.state;
    if (st && st.started) seated(g).forEach((k, i) => {
      const n = st.pos[k] || 0;
      const [cx, cy] = n ? mid(n) : [-20, -20];
      if (!n) return;
      x.fillStyle = TOKENS[i % TOKENS.length]; x.strokeStyle = '#fff'; x.lineWidth = 3;
      x.beginPath(); x.arc(cx + (i % 2 ? 9 : -9), cy + (i > 1 ? 9 : -9), 11, 0, Math.PI * 2); x.fill(); x.stroke();
    });
  }
  // Sakura Eights, seen from above: the draw pile, the top card, everyone's hands face down
  function cardFace(x, card, cx, cy, w, h) {
    x.fillStyle = '#fffaf2'; x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, 10); x.fill();
    x.fillStyle = HEX[card[0]]; x.beginPath(); x.roundRect(cx - w / 2 + 6, cy - h / 2 + 6, w - 12, h - 12, 8); x.fill();
    x.fillStyle = '#fffaf2'; x.beginPath(); x.ellipse(cx, cy, w * 0.32, h * 0.36, 0.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = HEX[card[0]]; x.font = `bold ${Math.round(h * 0.36)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText({ s: '⊘', r: '⇄', d: '+2', w: '✿', f: '+4' }[card[1]] || card[1], cx, cy + 2);
  }
  function drawEights(x, g) {
    x.fillStyle = '#2f5d3a'; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = '#c9a25b'; x.lineWidth = 6; x.strokeRect(10, 10, 492, 492);
    const st = g.state;
    if (!st || !st.started) {
      x.fillStyle = '#fbe3ea'; x.font = 'bold 44px Georgia, serif'; x.textAlign = 'center'; x.fillText('Sakura Eights', 256, 250);
      x.font = '24px Georgia, serif'; x.fillText('pull up a chair…', 256, 292);
      return;
    }
    // the draw pile and the card turned up, with the colour being played
    for (let k = 0; k < 4; k++) { x.fillStyle = '#7a2f4a'; x.beginPath(); x.roundRect(150 - k * 2, 196 - k * 2, 90, 130, 10); x.fill(); x.strokeStyle = '#f2c6d0'; x.lineWidth = 3; x.stroke(); }
    cardFace(x, st.top, 320, 260, 92, 132);
    x.fillStyle = HEX[st.color]; x.beginPath(); x.arc(400, 200, 18, 0, Math.PI * 2); x.fill();
    // everyone's hand, face down, round the table
    seated(g).forEach((k, i, all) => {
      const a = Math.PI / 2 + (i / all.length) * Math.PI * 2, n = handOf(st, k).length;
      const cx = 256 + Math.cos(a) * 200, cy = 256 + Math.sin(a) * 200;
      for (let c = 0; c < Math.min(n, 8); c++) { x.fillStyle = '#7a2f4a'; x.save(); x.translate(cx + (c - Math.min(n, 8) / 2) * 9, cy); x.rotate(a + Math.PI / 2); x.beginPath(); x.roundRect(-14, -20, 28, 40, 5); x.fill(); x.strokeStyle = '#f2c6d0'; x.lineWidth = 2; x.stroke(); x.restore(); }
    });
  }

  // take a board off its table (and out of the things you can click)
  function remove3D(old) {
    old.mesh.parent && old.mesh.parent.remove(old.mesh);
    old.face.map.dispose();
    // in place: the world keeps a reference to this same list
    if (old.floor) for (const o of old.parts) { const i = old.floor.interactables.indexOf(o); if (i >= 0) old.floor.interactables.splice(i, 1); }
  }
  function show3D(table) {
    const g = games.get(table);
    const top = topOf(table);
    const old = boards.get(table);
    if (!g) {
      if (old) { remove3D(old); boards.delete(table); }
      if (top && top.userData.vase) top.userData.vase.visible = true;
      return;
    }
    if (!top) return;
    const tex = drawBoard(g);
    if (old && old.kind === g.kind) { old.face.map.dispose(); old.face.map = tex; old.face.needsUpdate = true; return; }
    if (old) remove3D(old);
    const size = g.kind === 'chess' ? 0.4 : g.kind === 'snakes' ? 0.5 : 0.46;
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
    const label = { chess: 'A game of chess', tawla: 'A game of tawla', snakes: 'Snakes and ladders', eights: 'A game of Sakura Eights' }[g.kind];
    const who = seated(g).map(k => g.players[k].name);
    board.traverse(o => { if (o.isMesh) o.userData = { kind: 'game', table, label: `${label} — ${who.length > 1 ? who.slice(0, -1).join(', ') + ' and ' + who.slice(-1) : who[0] + ' and …'} · click to watch` }; });
    top.parent.add(board);
    // it goes in the same floor's list of things you can click
    const floor = Object.values(world.floors).find(f => f.surfaces && f.surfaces.includes(top));
    if (floor) floor.interactables.push(base, face);
    if (top.userData.vase) top.userData.vase.visible = false;
    boards.set(table, { kind: g.kind, mesh: board, face: face.material, parts: [base, face], floor });
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
      const free = seated(g).length < (MULTI[g.kind] || 2);
      if (!before && !side && free && seatTable() === g.table) toast(`🎲 ${g.players.a.name} set out ${SET_OUT[g.kind]} at your table — press 🎲 Games to play.`);
      if (before && side === 'a') for (const k of seated(g)) if (!before.players[k] && !isBot(g.players[k])) toast(`🎲 ${g.players[k].name} sat down to play.${MULTI[g.kind] ? ' Start when everyone\'s in!' : ' You start!'}`);
      if (side && g.turn === side && before && before.turn !== side && !g.over) sound.cue('chat');
      if (g.over && !(before && before.over)) {
        const w = g.over.winner ? g.players[g.over.winner] : null;
        if (side || viewing === g.table) toast(w ? `🏆 ${w.name} won${g.over.why ? ' — ' + g.over.why : ''}!` : `🤝 A draw${g.over.why ? ' — ' + g.over.why : ''}.`);
        if (w && w.id === 'yuto') { const y = yuto(); if (y) bubble(y.av.group, 'Good game! Another? 🌸', 'npc'); }
      }
      maybeYuto(g);
      maybeTeam(g);
    } else if (m.t === 'game:end') {
      games.delete(m.table);
      show3D(m.table);
    }
    if (viewing && isOpen()) render();
  }

  // ── Yuto's turn (played by the browser of whoever invited him)
  function maybeYuto(g) {
    if (!g || g.over || MULTI[g.kind] || !yutoPlays(g) || g.turn !== 'b' || mine(g) !== 'a' || thinking) return; // (the team plays the other games: maybeTeam)
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

  // The team's turns at snakes and ladders and Sakura Eights (played by the
  // browser of whoever set the game out, like Yuto's chess).
  let teamBusy = false;
  function maybeTeam(g) {
    if (!g || g.over || !MULTI[g.kind] || !g.state || !g.state.started || mine(g) !== 'a' || teamBusy) return;
    const p = g.players[g.turn];
    if (!isBot(p)) return;
    teamBusy = true;
    setTimeout(() => {
      teamBusy = false;
      const cur = games.get(g.table);
      if (!cur || cur.over || cur.turn !== g.turn || !isBot(cur.players[cur.turn])) return;
      const n = cur.kind === 'snakes' ? rollSnakes(cur.state) : botTurn(cur.state);
      say(cur, n);
      sendMove(cur, n);
      maybeTeam(games.get(g.table));
    }, cur0Delay(g));
  }
  const cur0Delay = g => (g.kind === 'snakes' ? 1300 : 1500) + Math.random() * 700;
  // a word from whoever just played, now and then
  function say(g, n) {
    const l = n.last;
    if (!l) return;
    const p = g.players[l.seat];
    const who = p && isBot(p) ? npc(p.id) : null;
    let line = null;
    if (g.kind === 'snakes') {
      if (l.via === 'ladder') line = `Up ${l.name}! 🪜`;
      else if (l.via === 'snake') line = `Oh no — ${l.name} 🐍`;
      else if (l.again && Math.random() < 0.6) line = 'A six! Again 🎲';
    } else {
      if (l.sakura) line = 'Sakura! 🌸';
      else if (l.play && l.play[0] === 'x') line = `${l.play[1] === 'f' ? 'Draw four — and' : 'Wild —'} ${COLORS[l.color]}!`;
      else if (l.play && l.play[1] === 's' && Math.random() < 0.5) line = 'Skip! Sorry 🙈';
    }
    if (line && who) bubble(who.av.group, line, 'npc');
    if (n.winner && isBot(g.players[n.winner])) { const w = npc(g.players[n.winner].id); if (w) setTimeout(() => bubble(w.av.group, 'Good game! Another round? 🌸', 'npc'), 900); }
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
    const over = !state.winner ? null : g.kind === 'tawla' ? { winner: state.winner, why: 'all fifteen home' }
      : g.kind === 'snakes' ? { winner: state.winner, why: 'first to square 100' } : g.kind === 'eights' ? { winner: state.winner, why: 'no cards left' } : null;
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
  function start(kind, vs, bots = []) {
    const table = seatTable();
    if (!table) return toast('Sit at a table first — then set out a board.');
    if (MULTI[kind]) {
      // first everyone sits down (and the team, if you ask them); then you start it
      send({ t: 'game', action: 'start', table, kind, bots, state: { started: false } });
      const first = bots[0] && npc(bots[0]);
      if (first) bubble(first.av.group, kind === 'snakes' ? 'Snakes and ladders! I love this one 🐍' : 'Cards? Deal me in 🌸', 'npc');
      return;
    }
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
      for (const [kind, name, blurb] of [['tawla', '🎲 Tawla', 'Backgammon, the Cairo way: two dice, fifteen checkers, race them home.'], ['chess', '♟️ Chess', 'The old game. You play white.'],
        ['snakes', '🐍 Snakes and ladders', 'السلم والثعبان — up Cairo Tower, down into the Nile. Roll a six, roll again; land on 100 exactly. 2–4 players.'],
        ['eights', '🌸 Sakura Eights', 'The café\'s own card game: match the colour or the number; skip, reverse, draw two, wilds. Empty your hand first — and say "Sakura!" on your last card. 2–6 players.']]) {
        const card = el('div', 'game-choice');
        card.append(el('b', null, name), el('p', 'fine', blurb));
        const row = el('div', 'row');
        if (MULTI[kind]) row.append(btn('Play with the team', () => start(kind, null, kind === 'snakes' ? ['yuto', 'hana'] : ['yuto', 'hana', 'yuki'])), btn('Wait for friends', () => start(kind, null, []), 'btn ghost'));
        else row.append(btn('Play Yuto', () => start(kind, 'yuto')), btn('Wait for a friend', () => start(kind, 'open'), 'btn ghost'));
        card.append(row);
        box.append(card);
      }
      return;
    }
    if (MULTI[g.kind]) return renderMulti(g, box, sat);
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

  // ── snakes and ladders and Sakura Eights: the seats, then the game
  function renderMulti(g, box, sat) {
    const side = mine(g), seats = seated(g), st = g.state || {};
    $('gameTitle').textContent = KIND_NAME[g.kind];
    const max = MULTI[g.kind];
    const names = el('div', 'multi-seats');
    seats.forEach((k, i) => {
      const p = g.players[k];
      const n = g.kind === 'eights' && st.started ? handOf(st, k).length : null;
      const chip = el('span', `seat${st.started && g.turn === k && !g.over ? ' now' : ''}`, `${p.name}${k === side ? ' (you)' : ''}${g.kind === 'snakes' && st.started ? ` · ${st.pos[k] || 'start'}` : ''}${n != null ? ` · ${n} 🂠` : ''}`);
      chip.style.setProperty('--tok', TOKENS[i % TOKENS.length]);
      names.append(chip);
    });
    box.append(names);
    if (!st.started) {
      box.append(el('p', 'lede', `${seats.length} of ${max} seats taken. ${side === 'a' ? 'Ask the team to join you, or wait for friends to sit down — then start.' : side ? 'Waiting for ' + g.players.a.name + ' to start…' : 'There\'s room at this table.'}`));
      const row = el('div', 'row');
      if (!side && sat && seats.length < max) row.append(btn('Sit in and play', () => send({ t: 'game', action: 'join', table: g.table })));
      if (side === 'a') {
        for (const [id, nm] of TEAM) if (seats.length < max && !seats.some(k => g.players[k].id === id)) row.append(btn(`+ ${nm}`, () => send({ t: 'game', action: 'addbot', table: g.table, bot: id }), 'btn ghost'));
        if (seats.length >= 2) row.append(btn(g.kind === 'snakes' ? '🎲 Start the game' : '🃏 Deal the cards', () => {
          const order = seated(g);
          const s0 = g.kind === 'snakes' ? newSnakes(order) : newEights(order);
          sound.cue('chat');
          sendMove(g, s0);
          maybeTeam(games.get(g.table));
        }));
      }
      if (side) row.append(btn('Put it away', () => send({ t: 'game', action: 'end', table: g.table }), 'btn ghost'));
      box.append(row);
      return;
    }
    if (g.kind === 'snakes') renderSnakes(g, side, box); else renderEights(g, side, box);
    const status = el('p', 'game-status');
    if (g.over) {
      const w = g.over.winner ? g.players[g.over.winner] : null;
      status.textContent = w ? `🏆 ${w.name} won — ${g.over.why}!` : 'The game is over.';
    } else {
      const p = g.players[g.turn];
      status.textContent = side === g.turn ? 'Your turn.' : `${p.name}'s turn${isBot(p) ? ' — thinking…' : '.'}`;
    }
    box.append(status);
    const row = el('div', 'row');
    if (g.over && side === 'a') row.append(btn('Play again', () => start(g.kind, null, seats.map(k => g.players[k].id).filter(id => TEAM_IDS.has(id)))));
    if (side) row.append(btn(g.over ? 'Put it away' : 'Stop the game', () => { if (g.over || confirm('Stop this game and put it away?')) send({ t: 'game', action: 'end', table: g.table }); }, 'btn ghost'));
    box.append(row);
  }

  function renderSnakes(g, side, box) {
    const st = g.state, seats = seated(g);
    const grid = el('div', 'snakes');
    const here = {};
    seats.forEach((k, i) => { const n = st.pos[k]; if (n) (here[n] = here[n] || []).push(i); });
    for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) {
      // the square at this row and column
      const r = 9 - row, n = r * 10 + (r % 2 ? 9 - col : col) + 1;
      const cell = el('div', `sq${LADDERS[n] ? ' ladder' : SNAKES[n] ? ' snake' : ''}${(row + col) % 2 ? ' alt' : ''}`);
      cell.append(el('small', null, String(n)));
      if (LADDERS[n]) cell.title = `🪜 ${LADDERS[n][1]} — up to ${LADDERS[n][0]}`;
      if (SNAKES[n]) cell.title = `🐍 ${SNAKES[n][1]} — down to ${SNAKES[n][0]}`;
      if (LADDERS[n]) cell.append(el('em', null, `🪜${LADDERS[n][0]}`));
      if (SNAKES[n]) cell.append(el('em', null, `🐍${SNAKES[n][0]}`));
      for (const i of here[n] || []) { const t = el('i', 'tok'); t.style.background = TOKENS[i % TOKENS.length]; cell.append(t); }
      grid.append(cell);
    }
    box.append(grid);
    const l = st.last;
    if (l) {
      const p = g.players[l.seat];
      box.append(el('p', 'fine', `${p ? p.name : ''} rolled a ${l.die}${l.landed === l.from ? ' — too many, so they stay put' : ''}${l.via === 'ladder' ? ` and climbed ${l.name} up to ${l.to}! 🪜` : l.via === 'snake' ? ` — ${l.name}, down to ${l.to} 🐍` : l.landed !== l.from ? `, to ${l.to}` : ''}.${l.again ? ' A six — again!' : ''}`));
    }
    if (side && side === g.turn && !g.over) box.append(btn('🎲 Roll the die', () => { const n = rollSnakes(st); sound.cue('chat'); say(g, n); sendMove(g, n); maybeTeam(games.get(g.table)); }));
  }

  let wildCard = null; // a wild you're about to play: pick its colour
  function renderEights(g, side, box) {
    const st = g.state;
    const myTurn = side && side === g.turn && !g.over;
    const table = el('div', 'eights-table');
    const top = el('div', 'pcard big', '');
    paintCard(top, st.top);
    const now = el('div', 'fine', `Colour in play: `);
    const dot = el('b', null, COLORS[st.color]); dot.style.color = HEX[st.color];
    now.append(dot, document.createTextNode(` · ${st.dir > 0 ? '↻' : '↺'} · ${st.deck.length / 2} in the pile`));
    table.append(top, now);
    box.append(table);
    const l = st.last;
    if (l) {
      const p = g.players[l.seat];
      box.append(el('p', 'fine', l.play ? `${p.name} played ${cardName(l.play)}${l.play[0] === 'x' ? ` — and called ${COLORS[l.color]}` : ''}.${l.made ? ` ${g.players[l.made.seat].name} draws ${l.made.draw}.` : ''}${l.sakura ? ' Sakura! 🌸 One card left.' : ''}` : l.drew ? `${p.name} drew a card.` : `${p.name} passed.`));
    }
    if (!side) return;
    const hand = handOf(st, side);
    const row = el('div', 'hand');
    hand.forEach(c => {
      const b = el('button', `pcard${myTurn && canPlay(st, c) ? ' can' : ''}`);
      b.type = 'button';
      paintCard(b, c);
      b.onclick = () => {
        if (!myTurn || !canPlay(st, c)) return;
        if (c[0] === 'x') { wildCard = c; render(); return; }
        play(c);
      };
      row.append(b);
    });
    box.append(el('p', 'eyebrow', 'Your hand'), row);
    const play = (c, color) => { wildCard = null; const n = playCard(st, c, color); sound.cue('chat'); say(g, n); if (n.last && n.last.sakura) toast('🌸 Sakura! One card left.'); sendMove(g, n); maybeTeam(games.get(g.table)); };
    if (myTurn && wildCard) {
      const pick = el('div', 'row');
      pick.append(el('span', 'fine', 'Call a colour:'));
      for (const [k, nm] of Object.entries(COLORS)) { const b = btn(nm, () => play(wildCard, k), 'btn'); b.style.background = HEX[k]; pick.append(b); }
      box.append(pick);
    } else if (myTurn) {
      const acts = el('div', 'row');
      if (!st.drew) acts.append(btn('Draw a card', () => { const n = drawCard(st); sound.cue('chat'); sendMove(g, n); }, 'btn ghost'));
      else acts.append(btn('Pass', () => { const n = passTurn(st); sendMove(g, n); maybeTeam(games.get(g.table)); }, 'btn ghost'));
      box.append(acts);
    }
  }
  function paintCard(elm, card) {
    elm.style.setProperty('--c', HEX[card[0]]);
    elm.dataset.v = { s: '⊘', r: '⇄', d: '+2', w: '✿', f: '+4' }[card[1]] || card[1];
    elm.title = cardName(card);
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
