// A welcome tour for first-timers: Hana walks you round the café in about
// half a minute — the counter, a table, the board, the shelf, the fire,
// the stairs — the camera turning to each as she talks. It runs once, on
// your first visit; "Take the tour" in the help panel runs it again.

import * as THREE from 'three';

export function createTour({ world, stairs, player, $, bubble, sound, onDone, onOrder }) {
  const find = test => { let m = null; world.scene.traverse(o => { if (!m && o.userData && test(o.userData)) m = o; }); return m; };
  const at = o => { const v = new THREE.Vector3(); if (o) o.getWorldPosition(v); return v; };
  const counterTop = () => { const b = new THREE.Box3().setFromObject(world.counter); return new THREE.Vector3((b.min.x + b.max.x) / 2, 1.3, b.max.z); };

  const STEPS = [
    {
      title: 'Welcome in 🌸',
      text: "I'm Hana. Let me show you round — it takes half a minute. You can skip any time.",
      say: 'Welcome in! Let me show you round.',
      look: () => { const h = world.npcs.find(n => n.id === 'hana'); return h ? at(h.av.group).add(new THREE.Vector3(0, 1.3, 0)) : counterTop(); },
      dist: 3.2,
    },
    {
      title: 'The counter',
      text: "Order here — or press ☕ Order from anywhere. Every drink and bake is free. The menu board changes every day, and the A-frame has the week's specials. Each drink earns a 🎟️ stamp: ten, and Yuto brings you a slice of the sakura cake.",
      say: 'Everything here is free. Really.',
      look: () => { const m = find(u => u.label === 'The menu — click to order'); return m ? at(m) : counterTop(); },
      dist: 5.5,
    },
    {
      title: 'Sit anywhere',
      text: 'Click any chair to sit. Set your cup down, take a sip (C), a bite (B). Sitting at a table? Tick "bring it to my table" and we\'ll carry it over — or press 🎲 Games for tawla, chess, snakes and ladders or Sakura Eights.',
      say: 'Pick any seat you like.',
      look: () => { const t = find(u => u.tableId === 't3') || find(u => u.tableId); return at(t).add(new THREE.Vector3(0, 0.4, 0)); },
      dist: 4,
    },
    {
      title: 'The community board',
      text: 'Pin something kind for a stranger — 📌 Leave a note. Notes can go on the board, on a table, or on a wall, and everyone who comes in sees them.',
      say: 'Leave a kind word for whoever comes next.',
      look: () => new THREE.Vector3(world.board.x, world.board.y, world.board.z),
      dist: 5,
    },
    {
      title: 'Stories & the book of the week',
      text: "Click the bookshelf to read every morning and bedtime story from the letters. The framed cover above it is this week's book. The photo wall on the other side holds pictures from the café.",
      say: 'The stories from the letters live here.',
      look: () => { const s = find(u => u.kind === 'shelf'); return at(s).add(new THREE.Vector3(0, 0.3, 0)); },
      dist: 4.5,
    },
    {
      title: 'By the fire',
      text: "The armchairs are the coziest seats in Cairo. The easel says what's on — story evenings and book club. Come along; nobody has to say a word.",
      say: 'Story evenings are on Fridays, by the fire.',
      look: () => { const e = find(u => u.kind === 'events'); return e ? at(e).add(new THREE.Vector3(0, 0.6, 0)) : new THREE.Vector3(world.fire.x, 1, world.fire.z); },
      dist: 4.5,
    },
    {
      title: 'Upstairs, and the roof',
      text: 'Up the spiral stairs: rooms for groups of friends, a room of your own to make yours — and the roof garden, where everyone tends the plants together.',
      say: 'There\'s more upstairs.',
      look: () => new THREE.Vector3(stairs.x, 2.2, stairs.z),
      dist: 5,
    },
    {
      title: 'That\'s the café',
      text: '🎧 at the top is the café radio, 🔊 the sound, ? the help, 💬 the chat. Talk to any of us with 🗣️ Talk — we remember what you like. Would you like your first drink?',
      say: 'Shall I make you something?',
      look: () => { const h = world.npcs.find(n => n.id === 'hana'); return h ? at(h.av.group).add(new THREE.Vector3(0, 1.3, 0)) : counterTop(); },
      dist: 3.4,
      last: true,
    },
  ];

  const tour = { on: false, i: 0, focus: null, yaw: 0, dist: 4, pitch: 0.28 };

  function show() {
    const st = STEPS[tour.i];
    const target = st.look();
    tour.focus = target;
    tour.dist = st.dist;
    // look at it from where you're standing, so it turns naturally
    tour.yaw = Math.atan2(player.pos.x - target.x, player.pos.z - target.z);
    $('tourStep').textContent = `A quick look round · ${tour.i + 1} of ${STEPS.length}`;
    $('tourTitle').textContent = st.title;
    $('tourText').textContent = st.text;
    $('tourBack').classList.toggle('hidden', tour.i === 0);
    $('tourNext').textContent = st.last ? 'Explore on my own' : 'Next →';
    $('tourOrder').classList.toggle('hidden', !st.last);
    const hana = world.npcs.find(n => n.id === 'hana');
    if (hana) bubble(hana.av.group, st.say, 'npc');
    sound.cue('chat');
  }
  function start() {
    if (world.floor !== 'main') return false;
    tour.on = true; tour.i = 0;
    $('tourCard').classList.remove('hidden');
    show();
    return true;
  }
  function stop() {
    tour.on = false; tour.focus = null;
    $('tourCard').classList.add('hidden');
    onDone && onDone();
  }
  $('tourNext').onclick = () => { if (tour.i >= STEPS.length - 1) return stop(); tour.i++; show(); };
  $('tourBack').onclick = () => { if (tour.i > 0) { tour.i--; show(); } };
  $('tourSkip').onclick = stop;
  $('tourOrder').onclick = () => { stop(); onOrder && onOrder(); };

  return {
    start, stop,
    active: () => tour.on,
    // for the camera: where to look while the tour is on
    view: () => (tour.on && tour.focus ? tour : null),
  };
}
