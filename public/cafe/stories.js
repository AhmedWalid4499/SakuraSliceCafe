// Little stories with Yuto. Ask him (talk to Yuto → 📖) and he comes out from
// behind the counter and walks round the building with you — up to the Pet
// Café to look for a cat who isn't really lost, to the observatory to whisper
// a wish to the moon, to the Karaoke Room so you can teach him to dance. He
// talks as you go, asks you things, and does things with you; at the end
// there's a sticker for your collection.
//
// A story is a list of steps:
//   { say }                      Yuto says it; you press Next
//   { say, choose: [{ label, reply, set }] }   you pick; he answers
//   { say, go: room, hint }      …until you're in that room
//   { say, find: [kinds], hint } …until you click one of those things
//   { say, move: kind, hint }    …until you do that move (🌸 → Dance…)
//   { npc: 'yuki', say }         one of the team says it (in the café)
//   { end, sticker }             the end
// Any step can have `yuto: 'dance'` (or another move) for Yuto to do.
// Text can use {name}, {moon} and anything a choice `set`.

import * as THREE from 'three';

export const STORIES = [
  {
    id: 'mishmish', title: 'Where Did Mishmish Go?', emoji: '🐱', blurb: 'The ginger cat wasn’t on her windowsill this morning…',
    steps: [
      { say: '{name}! Thank goodness. Mishmish — the ginger one from the Pet Café — wasn’t on her windowsill this morning. She always is. Will you help me look?', yuto: 'think' },
      { say: 'What do you think?', choose: [
        { label: 'Of course! Let’s go 🐾', reply: 'I knew I could count on you. Come on — all the way up to the fourth floor.' },
        { label: 'Maybe she’s just napping somewhere?', reply: 'That’s what I keep telling myself… but let’s go and look, just in case.' },
      ] },
      { say: 'Up the stairs to the Pet Café — fourth floor. I’ll be right behind you.', go: 'petcafe', hint: 'Go up to the Pet Café (fourth floor)' },
      { say: 'Look around… is she here? Try one of the cats.', find: ['pet'], hint: 'Click a cat (or a bunny)' },
      { say: 'Oh! There she is. And she looks very pleased with herself.', yuto: 'laugh' },
      { say: 'You know what I think? She wasn’t lost at all. She just wanted somebody to come and find her.', yuto: 'love' },
      { say: 'What shall we do?', choose: [
        { label: 'Give her a treat 🐟', reply: 'Spoiling her! Now she’ll either never hide again — or hide every single day.' },
        { label: 'Give her a long stroke 🤚', reply: 'Listen to that purr. That’s the sound of being found.' },
      ] },
      { end: 'Sometimes the ones who hide just want to be looked for. Thank you for looking with me, {name}.', sticker: '🐱' },
    ],
  },
  {
    id: 'ingredient', title: 'Yuki’s Secret Ingredient', emoji: '🍰', blurb: 'A brand-new cake, and two things missing.',
    steps: [
      { say: 'Shh — Yuki’s making a brand-new cake for spring, and she’s missing two things. She sent me to fetch them… want to come on a little errand?' },
      { say: 'Well?', choose: [
        { label: 'I love errands!', reply: 'Perfect. First stop: the flower shop.' },
        { label: 'Is it a secret? I’m good at secrets 🤫', reply: 'Then it’s our secret too. First stop: the flower shop.' },
      ] },
      { say: 'Up to the fourth floor — the Flower Shop & Greenhouse. We need sakura petals.', go: 'greenhouse', hint: 'Go to the Flower Shop & Greenhouse (fourth floor)' },
      { say: 'Find the sakura — try the counter, or the benches at the back.', find: ['flower-shop', 'flower-plant', 'flower-pots'], hint: 'Click the flower counter or the plants' },
      { say: 'A handful of petals. They smell like April! Now — matcha. Real matcha, from the Tea Room on the second floor.', yuto: 'cheer' },
      { say: 'Down to the second floor, to the Tea Room.', go: 'tearoom', hint: 'Go to the Japanese Tea Room (second floor)' },
      { say: 'The tea things are by the kettle. We’ll borrow two scoops.', find: ['tea-make'], hint: 'Click the tea things by the kettle' },
      { say: 'Two scoops of the good stuff. Now back down to the café — Yuki’s waiting at the counter.', go: 'main', hint: 'Go back down to the café' },
      { npc: 'yuki', say: 'Sakura AND matcha? Oh, you two are angels! 🍰' },
      { say: 'She says you get to name it. No pressure.', choose: [
        { label: 'The Sakura Whisper 🌸', set: { cake: 'The Sakura Whisper' } },
        { label: 'Matcha Moonlight 🌙', set: { cake: 'Matcha Moonlight' } },
        { label: 'Yuto’s Errand Cake 😄', set: { cake: 'Yuto’s Errand Cake' } },
      ], reply: '“{cake}”! Yuki says yes. It’s going on the board.' },
      { end: 'Thank you for running about with me, {name}. When it’s ready, the first slice of {cake} is yours.', sticker: '🍰' },
    ],
  },
  {
    id: 'letter', title: 'A Letter for a Stranger', emoji: '💌', blurb: 'Every week Yuto writes to someone he’ll never meet.',
    steps: [
      { say: 'Every week I write a letter to somebody I’ll never meet, and leave it in the Post Room for whoever needs it. This week I’m stuck. Will you help me?' },
      { say: 'What kind of letter should it be?', choose: [
        { label: 'Something hopeful 🌅', set: { tone: 'hope' }, reply: 'Hopeful. Yes — someone out there needs that today.' },
        { label: 'Something funny 😄', set: { tone: 'fun' }, reply: 'Funny! Laughing is a kind of medicine.', yuto: 'laugh' },
        { label: 'Something gentle 🫖', set: { tone: 'gentle' }, reply: 'Gentle. Like a cup of tea in an envelope.' },
      ] },
      { say: 'And how should it start?', choose: [
        { label: '“Dear stranger,”', set: { open: 'Dear stranger,' } },
        { label: '“Hello, you,”', set: { open: 'Hello, you,' } },
        { label: '“To whoever finds this,”', set: { open: 'To whoever finds this,' } },
      ], reply: 'Lovely. Let me write it out… there. Now let’s take it to the Post Room.' },
      { say: 'The Post Room is on the second floor.', go: 'post', hint: 'Go to the Post Room (second floor)' },
      { say: 'Pick a pigeonhole — any one. Somebody will find it.', find: ['post-hole', 'post-write', 'post-lost'], hint: 'Click the pigeonholes' },
      { letter: true },
      { end: 'Somebody is going to have a better day because of a letter you helped write. Thank you, {name}.', sticker: '💌' },
    ],
  },
  {
    id: 'moon', title: 'A Wish on the Moon', emoji: '🌙', blurb: 'His grandmother said the moon keeps wishes safe.',
    steps: [
      { say: 'Can I tell you something a bit silly? My grandmother used to say that if you whisper a wish to the moon, it keeps it safe for you. Come up to the observatory with me?' },
      { say: 'It’s up top — through the third floor, up the stairs.', go: 'observatory', hint: 'Go to the Observatory (from the third floor)' },
      { say: 'Have a look through the telescope.', find: ['obs-scope'], hint: 'Click the telescope' },
      { say: 'There she is. Tonight she’s a {moon}. Now — what will you wish for?', choose: [
        { label: 'For my family 👨‍👩‍👧', set: { wish: 'family' }, reply: 'The best kind of wish. She’ll keep it extra safe.' },
        { label: 'For myself ✨', set: { wish: 'me' }, reply: 'Good. People forget they’re allowed to wish for themselves.' },
        { label: 'For the whole world 🌍', set: { wish: 'world' }, reply: 'A big one! Good thing the moon is big too.' },
      ] },
      { say: 'Whisper it… I won’t listen. I’ll be over here, looking at Jupiter.', yuto: 'think' },
      { say: 'Done? I won’t ask what exactly. That’s between you and the moon.', yuto: 'love' },
      { end: 'Thank you for coming up here with me, {name}. My grandmother would have liked you.', sticker: '🌙' },
    ],
  },
  {
    id: 'dance', title: 'Dance Like Nobody’s Watching', emoji: '💃', blurb: 'Yuto can’t dance. At all. Can you teach him?',
    steps: [
      { say: 'Confession: I can’t dance. Hana says I dance like a folding chair. Will you teach me? Somewhere nobody will see us… the Karaoke Room!', yuto: 'laugh' },
      { say: 'Third floor. Quickly, before anyone notices.', go: 'karaoke', hint: 'Go to the Karaoke Room (third floor)' },
      { say: 'Okay. Show me. I’ll copy you.', move: 'dance', hint: 'Tap 🌸, then 💃 Dance' },
      { say: 'Like this?! Wait — I think I’m actually doing it!', yuto: 'dance' },
      { say: 'Now a big finish. Cheer!', move: 'cheer', hint: 'Tap 🌸, then 🎉 Cheer', yuto: 'jump' },
      { say: 'WOO! 🎉', yuto: 'cheer' },
      { end: 'Don’t tell Hana. Actually — do. I want her to know I’ve got moves now. Thank you, {name} 🕺', sticker: '💃' },
    ],
  },
  {
    id: 'felucca', title: 'Grandfather’s Felucca', emoji: '⛵', blurb: 'A story out on the Nile.',
    steps: [
      { say: 'My grandfather had a felucca on the Nile, you know. Want to hear about it — out on the water?' },
      { say: 'The sign for the café’s felucca is by the front door. Let’s go aboard.', go: 'felucca', hint: 'Click “Sail on the Nile” by the café’s front door' },
      { say: 'He’d go out before the sun was up, when the Nile is flat as glass and the whole city is still asleep.' },
      { say: 'Ask me anything.', choose: [
        { label: 'What did he catch?', reply: 'Mostly nothing! He said that was the point. You sit, you wait, and the river talks to you.', yuto: 'laugh' },
        { label: 'Did he take you sailing?', reply: 'Every summer. I always fell asleep in the shade of the sail, and he’d say I was “helping the wind”.' },
      ] },
      { say: 'When he got old he gave the boat to the boy next door, and told him: “Look after the river, and it will look after you.”', yuto: 'think' },
      { say: 'I think about that a lot. This café is my felucca, I suppose. And you’re one of the people on it.', yuto: 'love' },
      { end: 'Thank you for sailing with me, {name}.', sticker: '⛵' },
    ],
  },
  {
    id: 'firstline', title: 'The First Line', emoji: '✍️', blurb: 'Yuto has been stuck on one sentence for years.',
    steps: [
      { say: 'I’ve been trying to write a little book for years. I’ve never got past the first line. Will you help me choose one? The Writer’s Room is good for courage.' },
      { say: 'It’s on the fourth floor.', go: 'writers', hint: 'Go to the Writer’s Room (fourth floor)' },
      { say: 'Look at the stories board first — everyone up there started with one line.', find: ['writers-board'], hint: 'Click the stories board' },
      { say: 'Right. Which one?', choose: [
        { label: '“The café opened at six, but the cat had been waiting since five.”', set: { line: 'The café opened at six, but the cat had been waiting since five.' } },
        { label: '“Nobody in Cairo knew who left the letters, and that was the point.”', set: { line: 'Nobody in Cairo knew who left the letters, and that was the point.' } },
        { label: '“On the night the river turned pink, Noor decided to stay.”', set: { line: 'On the night the river turned pink, Noor decided to stay.' } },
      ], reply: '“{line}” — that’s it. That’s the one.', yuto: 'cheer' },
      { end: 'Now I have to write the second line. You’ll check on me? And pin a story of your own up there sometime, {name}.', sticker: '✍️' },
    ],
  },
];

const LETTERS = {
  hope: 'I don’t know what today has been like for you. But I know this: the sun has come up over the Nile every morning for a very long time, and it will tomorrow, too. Whatever is heavy right now won’t always be. Keep going — slowly is fine.',
  fun: 'I am writing this in a café where an owl is watching me very seriously. He hasn’t blinked in four minutes. I think he’s reading over my shoulder. If you’re having a hard day, imagine an owl in a bow tie judging your handwriting. Better? I thought so.',
  gentle: 'Put the kettle on, if you can. Sit somewhere soft. You don’t have to fix everything today, or anything at all. You’re allowed to just be here, and that is already enough.',
};

export function createStories({ scene, buildAvatar, disposeTree, world, player, state, ui, sound }) {
  const KEY = () => 'cafe.stories.' + (state.me ? state.me.id : 0);
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY()) || '{}'); } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(KEY(), JSON.stringify(d)); } catch (e) { /* fine */ } };

  let run = null;      // { story, i, vars, waiting }
  let buddy = null;    // Yuto, walking with you
  const yutoNpc = () => world.npcs.find(n => n.id === 'yuto');
  const fill = text => String(text).replace(/\{(\w+)\}/g, (_, k) => (k === 'name' ? (state.me ? state.me.displayName : 'friend') : run && run.vars[k] != null ? run.vars[k] : ui.fill(k)));

  function makeBuddy() {
    const n = yutoNpc();
    if (!n || buddy) return;
    const av = buildAvatar(n.avatar, { ...n.extra });
    av.group.position.copy(player.pos);
    scene.add(av.group);
    buddy = { av, pos: av.group.position, ry: 0 };
    placeBuddy();
  }
  function dropBuddy() {
    if (!buddy) return;
    scene.remove(buddy.av.group); disposeTree(buddy.av.group);
    buddy = null;
    const n = yutoNpc(); if (n) n.av.group.visible = true;
  }
  // just beside you and a step behind
  function besideYou() {
    const r = player.ry;
    return new THREE.Vector3(player.pos.x - Math.sin(r) * 0.9 + Math.cos(r) * 0.8, world.floorY, player.pos.z - Math.cos(r) * 0.9 - Math.sin(r) * 0.8);
  }
  function placeBuddy() {
    if (!buddy) return;
    buddy.pos.copy(besideYou());
    // (the real Yuto stays out of sight while he's with you)
    const n = yutoNpc(); if (n) n.av.group.visible = false;
  }

  function say(text, move) {
    if (!text) return;
    if (buddy) { ui.bubble(buddy.av.group, fill(text)); if (move) buddy.av.play(move); }
  }

  function show() {
    if (!run) return ui.card(null);
    const st = run.story.steps[run.i];
    const text = st.letter ? letter() : fill(st.say || st.end || '');
    const buttons = [];
    if (st.choose && !run.chose) for (const c of st.choose) buttons.push({ label: fill(c.label), act: () => choose(c) });
    else if (st.end) buttons.push({ label: `Collect the sticker ${st.sticker}`, act: finish });
    else if (!st.go && !st.find && !st.move) buttons.push({ label: 'Next →', act: next });
    ui.card({ title: `${run.story.emoji} ${run.story.title}`, who: st.npc ? ui.npcName(st.npc) : 'Yuto', text: run.reply ? fill(run.reply) : text, hint: st.go || st.find || st.move ? st.hint : null, buttons });
  }
  function letter() {
    const v = run.vars;
    return `“${v.open || 'Dear stranger,'}\n${LETTERS[v.tone] || LETTERS.gentle}\n— Yuto (and ${state.me ? state.me.displayName : 'a friend'}), Sakura Slice Café”`;
  }
  function enter(i) {
    run.i = i; run.reply = null; run.chose = false;
    const st = run.story.steps[i];
    if (!st) return finish();
    if (st.npc) ui.npcSay(st.npc, fill(st.say));
    else if (st.letter) say('Here — read it. Then into the pigeonhole it goes.', 'love');
    else say(st.say || st.end, st.yuto);
    show();
    // already where we need to be?
    if (st.go && state.room === st.go) setTimeout(() => run && run.story.steps[run.i] === st && next(), 1600);
  }
  function next() { if (run) { sound.cue('pin'); enter(run.i + 1); } }
  function choose(c) {
    if (!run) return;
    const st = run.story.steps[run.i];
    Object.assign(run.vars, c.set || {});
    run.chose = true;
    const reply = c.reply || st.reply;
    if (reply) { run.reply = reply; say(reply, c.yuto || null); }
    sound.cue('pin');
    if (reply) { ui.card({ title: `${run.story.emoji} ${run.story.title}`, who: 'Yuto', text: fill(reply), buttons: [{ label: 'Next →', act: next }] }); }
    else next();
  }
  function finish() {
    if (!run) return;
    const st = run.story.steps[run.story.steps.length - 1];
    const d = load();
    d.done = [...new Set([...(d.done || []), run.story.id])];
    save(d);
    if (buddy) buddy.av.play('cheer');
    ui.done(run.story, st.sticker);
    run = null;
    ui.card(null);
    setTimeout(() => { if (!run) dropBuddy(); }, 2500);
  }

  return {
    STORIES,
    active: () => !!run,
    done: () => load().done || [],
    start(id) {
      const story = STORIES.find(s => s.id === id);
      if (!story) return;
      run = { story, i: 0, vars: {}, chose: false, reply: null };
      makeBuddy();
      enter(0);
    },
    stop() { run = null; ui.card(null); dropBuddy(); },
    // you've arrived somewhere / clicked something / done a move
    onRoom(room) {
      if (buddy) placeBuddy();
      if (!run) return;
      if (buddy && room !== 'main') { const n = yutoNpc(); if (n) n.av.group.visible = true; }
      if (buddy && room === 'main') { const n = yutoNpc(); if (n) n.av.group.visible = false; }
      const st = run.story.steps[run.i];
      if (st.go && st.go === room) setTimeout(() => run && run.story.steps[run.i] === st && next(), 900);
    },
    onThing(kind) { const st = run && run.story.steps[run.i]; if (st && st.find && st.find.includes(kind)) setTimeout(() => run && run.story.steps[run.i] === st && next(), 700); },
    onMove(kind) {
      const st = run && run.story.steps[run.i];
      if (buddy && run) setTimeout(() => buddy && buddy.av.play(kind === 'hug' ? 'love' : kind), 500); // he joins in
      if (st && st.move === kind) setTimeout(() => run && run.story.steps[run.i] === st && next(), 1800);
    },
    update(dt) {
      if (!buddy) return;
      const want = besideYou();
      const dx = want.x - buddy.pos.x, dz = want.z - buddy.pos.z, d = Math.hypot(dx, dz);
      let moving = false;
      if (d > 8) buddy.pos.copy(want);
      else if (d > 0.35) {
        const step = Math.min(d, (d > 2.5 ? 4 : 2.2) * dt);
        buddy.pos.x += dx / d * step; buddy.pos.z += dz / d * step;
        const ry = Math.atan2(dx, dz);
        buddy.ry += Math.atan2(Math.sin(ry - buddy.ry), Math.cos(ry - buddy.ry)) * Math.min(1, dt * 8);
        moving = true;
      } else {
        const ry = Math.atan2(player.pos.x - buddy.pos.x, player.pos.z - buddy.pos.z);
        buddy.ry += Math.atan2(Math.sin(ry - buddy.ry), Math.cos(ry - buddy.ry)) * Math.min(1, dt * 3);
      }
      buddy.pos.y = world.floorY;
      buddy.av.group.rotation.y = buddy.ry;
      buddy.av.update(dt, { moving, look: moving ? null : player.pos, fidget: false });
    },
  };
}
