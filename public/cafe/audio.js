// The café's soundscape — all generated live with the Web Audio API, so
// there are no audio files to load and the music never loops the same way
// twice. Everything is soft on purpose: slow tempo, long gentle envelopes,
// low-passed tones, nothing sharp.
//
//   music   a slow, warm electric-piano progression with a wandering melody
//   rain    soft rain on the windows
//   murmur  the far-off hum of a café that isn't too busy
//   fire    the fireplace (it gets louder as you walk closer)
//   birds   sparrows outside in the day, crickets at night
//   chimes  the door's wind chime + the little sounds when you pin a note

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.levels = { master: 0.7, music: 0.55, rain: 0.35, murmur: 0.25, fire: 0.3, birds: 0.15, chimes: 0.4 };
    this.muted = false;
    this.night = false;
    this.timers = [];
    // the weather turns some channels up or down (on top of the guest's own mix)
    this.weather = { rain: 0.55, birds: 1 };
  }

  // Must be called from a user gesture (browsers keep audio asleep until then).
  start(levels) {
    if (levels) Object.assign(this.levels, levels);
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    // master → gentle compressor → speakers
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -20;
    this.comp.ratio.value = 3;
    this.comp.attack.value = 0.02;
    this.comp.release.value = 0.4;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.comp).connect(ctx.destination);

    // a soft room reverb everyone can send into
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.6);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.55;
    this.reverb.connect(this.reverbOut).connect(this.master);

    this.bus = {};
    for (const k of ['music', 'rain', 'murmur', 'fire', 'birds', 'chimes']) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      this.bus[k] = g;
    }

    this.noise = this.noiseBuffer(6);
    this.startRain();
    this.startMurmur();
    this.startFire();
    this.startMusic();
    this.loop(() => this.birdOrCricket(), 2500, 9000);
    this.loop(() => this.windChime(), 9000, 26000);
    this.loop(() => this.cupClink(), 7000, 22000);

    this.apply(1.2);
    // fade the whole room in, slowly
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.levels.master, ctx.currentTime, 1.5);
  }

  set(name, value) {
    this.levels[name] = value;
    this.apply(0.15);
  }

  duckMusic(on) {
    this.ducked = !!on;
    this.apply(1.2);
  }

  setMuted(m) {
    this.muted = m;
    this.apply(0.2);
  }

  setNight(n) { this.night = n; }

  // 0 = the middle of the room, 1 = right by a window (the rain gets louder)
  setNearWindow(k) {
    k = Math.max(0, Math.min(1, k));
    if (Math.abs(k - (this.nearWindow ?? -1)) < 0.04) return;
    this.nearWindow = k;
    this.apply(0.8);
  }
  // how busy it is: 0 = empty, 1 = full (the hum of the room follows)
  setCrowd(k) {
    k = Math.max(0, Math.min(1, k));
    if (Math.abs(k - (this.crowd ?? -1)) < 0.05) return;
    this.crowd = k;
    this.apply(2);
  }

  // ───────────────────────────────────────── sounds of the café, where they happen

  // A sound placed in the room: it comes from where it happens and fades with distance.
  at(pos, bus = 'murmur', ref = 2) {
    const ctx = this.ctx;
    const p = ctx.createPanner();
    Object.assign(p, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: ref, rolloffFactor: 1.4, maxDistance: 40 });
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y ?? 1, pos.z);
    p.connect(this.bus[bus]);
    p.connect(this.reverb);
    return p;
  }
  ok() { return this.ctx && this.ctx.state === 'running'; }

  // The espresso machine: the grinder, the pump's low hum while it pours,
  // and the steam wand hissing as the milk spins.
  espresso(pos, milk = true, quick = false) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, out = this.at(pos, 'murmur', 2.5);
    const white = this.whiteBuffer(2);
    // a quick one (your own order, ready in a moment) is just the grind and a burst of steam
    const grindFor = quick ? 0.7 : 1.8, p0 = t + grindFor + 0.6, pumpFor = quick ? 0 : 4.5;
    const s0 = quick ? t + grindFor + 0.15 : p0 + pumpFor + 0.9, steamFor = quick ? 1.1 : 4.2;
    // grinder: a gritty burr
    const g1 = ctx.createBufferSource(); g1.buffer = white; g1.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
    const grind = ctx.createGain();
    grind.gain.setValueAtTime(0, t); grind.gain.linearRampToValueAtTime(0.16, t + 0.08);
    grind.gain.setValueAtTime(0.16, t + grindFor); grind.gain.linearRampToValueAtTime(0, t + grindFor + 0.2);
    const wob = ctx.createOscillator(); wob.frequency.value = 38; const wg = ctx.createGain(); wg.gain.value = 0.05;
    wob.connect(wg).connect(grind.gain);
    g1.connect(bp).connect(grind).connect(out);
    g1.start(t); g1.stop(t + grindFor + 0.3); wob.start(t); wob.stop(t + grindFor + 0.3);
    // pump: a low buzz while the shot pours
    if (pumpFor) {
      const pump = ctx.createOscillator(); pump.type = 'sawtooth'; pump.frequency.value = 50;
      const plp = ctx.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 220;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0, p0); pg.gain.linearRampToValueAtTime(0.07, p0 + 0.2);
      pg.gain.setValueAtTime(0.07, p0 + pumpFor); pg.gain.linearRampToValueAtTime(0, p0 + pumpFor + 0.3);
      pump.connect(plp).connect(pg).connect(out);
      pump.start(p0); pump.stop(p0 + pumpFor + 0.5);
    }
    // steam wand: a bright hiss that deepens as the milk warms
    if (milk) {
      const st = ctx.createBufferSource(); st.buffer = white; st.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 0.6;
      hp.frequency.setValueAtTime(5200, s0); hp.frequency.linearRampToValueAtTime(2600, s0 + steamFor + 0.3);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, s0); sg.gain.linearRampToValueAtTime(0.09, s0 + 0.25);
      sg.gain.setValueAtTime(0.09, s0 + steamFor); sg.gain.linearRampToValueAtTime(0, s0 + steamFor + 0.4);
      st.connect(hp).connect(sg).connect(out);
      st.start(s0); st.stop(s0 + steamFor + 0.6);
    }
    // the knock of the portafilter being emptied
    if (!quick) this.knock(pos, (milk ? s0 + steamFor : p0 + pumpFor) + 0.9);
  }
  knock(pos, when) {
    const ctx = this.ctx, out = this.at(pos, 'murmur', 2);
    for (const [dt, f] of [[0, 140], [0.16, 120]]) {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, when + dt); o.frequency.exponentialRampToValueAtTime(60, when + dt + 0.12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.12, when + dt); g.gain.exponentialRampToValueAtTime(0.0001, when + dt + 0.15);
      o.connect(g).connect(out); o.start(when + dt); o.stop(when + dt + 0.2);
    }
  }
  // A cup set down on its saucer or a table: a soft ceramic knock and a ring.
  cupDown(pos) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, out = this.at(pos, 'murmur', 1.5);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
    const base = 1900 + Math.random() * 500;
    [1, 2.31, 3.9].forEach((m, i) => {
      const r = ctx.createOscillator(); r.frequency.value = base * m;
      const rg = ctx.createGain(); rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(0.022 / (i + 1), t + 0.003);
      rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 / (i + 1));
      r.connect(rg).connect(out); r.start(t); r.stop(t + 0.4);
    });
  }
  // A chair pulled out or pushed in: wood dragging on the floor.
  chair(pos) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, out = this.at(pos, 'murmur', 1.5);
    const src = ctx.createBufferSource(); src.buffer = this.whiteBuffer(0.6);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
    const f0 = 260 + Math.random() * 120, dur = 0.25 + Math.random() * 0.2;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f0 * 1.6, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.03);
    // the judder of legs catching on the boards
    for (let k = 0.04; k < dur; k += 0.035) g.gain.setValueAtTime(0.18 + Math.random() * 0.2, t + k);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.04);
    src.connect(bp).connect(g).connect(out);
    src.start(t); src.stop(t + dur + 0.1);
  }
  // The little bell on the counter: an order is ready.
  counterBell(pos) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, out = this.at(pos, 'chimes', 3);
    [[2637, 0.07, 2.2], [3520 * 1.003, 0.03, 1.4], [5274, 0.012, 0.8]].forEach(([f, gain, d]) => {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.1);
    });
  }
  // A page turning, close by.
  page(pos) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, out = this.at(pos, 'murmur', 1);
    const src = ctx.createBufferSource(); src.buffer = this.whiteBuffer(0.4);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.1); g.gain.linearRampToValueAtTime(0, t + 0.32);
    src.connect(hp).connect(g).connect(out); src.start(t); src.stop(t + 0.4);
  }

  // look: see weather.js LOOK. Rain is softer on dry days, fuller when it
  // actually rains; the birds go quiet in rain, storms and sandstorms.
  setWeather(look) {
    this.weather = {
      rain: look.rain > 0 ? Math.min(1.35, 0.95 + look.rain * 0.25) : 0.55,
      birds: look.birds,
    };
    this.apply(1.5);
  }

  // Far-off thunder: a long, low, rolling rumble.
  thunder() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.35 + Math.random() * 0.15;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    lp.frequency.exponentialRampToValueAtTime(90, now + 4);
    const g = ctx.createGain();
    const peak = 0.55 + Math.random() * 0.35;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.12 + Math.random() * 0.3);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, now + 1.2);
    g.gain.exponentialRampToValueAtTime(peak * 0.5, now + 1.8);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 5 + Math.random() * 2);
    src.connect(lp).connect(g);
    g.connect(this.bus.rain);
    g.connect(this.reverb);
    src.start(now, Math.random() * 3);
    src.stop(now + 7.5);
  }

  apply(ramp = 0.3) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.levels.master, now, ramp);
    // perceptual curve: sliders feel even all the way along
    for (const [k, g] of Object.entries(this.bus)) {
      // while Spotify is playing, the café's own piano steps aside
      const v = (this.levels[k] ?? 0) * (this.weather[k] ?? 1) * (k === 'music' && this.ducked ? 0 : 1)
        * (k === 'rain' ? 0.7 + (this.nearWindow ?? 0.3) * 0.75 : 1)   // louder by the glass
        * (k === 'murmur' ? 0.55 + (this.crowd ?? 0.4) * 0.9 : 1);      // fuller when the café is busy
      g.gain.setTargetAtTime(v * v * 1.4, now, ramp);
    }
  }

  // The listener follows the camera so the fireplace sits where it is.
  setListener(pos, forward) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.1);
      l.positionY.setTargetAtTime(pos.y, t, 0.1);
      l.positionZ.setTargetAtTime(pos.z, t, 0.1);
      l.forwardX.setTargetAtTime(forward.x, t, 0.1);
      l.forwardY.setTargetAtTime(forward.y, t, 0.1);
      l.forwardZ.setTargetAtTime(forward.z, t, 0.1);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  // ───────────────────────────────────────── building blocks

  noiseBuffer(seconds) {
    // brown-ish noise: warm, no hiss
    const ctx = this.ctx;
    const buf = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.035 * white) / 1.035;
        d[i] = last * 3.2;
      }
    }
    return buf;
  }

  whiteBuffer(seconds) {
    const ctx = this.ctx;
    this.whites = this.whites || {};
    if (this.whites[seconds]) return this.whites[seconds];
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.whites[seconds] = buf;
    return buf;
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  loopNoise(buffer, rate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = rate;
    src.start(this.ctx.currentTime + Math.random() * 0.5, Math.random() * buffer.duration);
    return src;
  }

  lfo(param, rate, depth) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
  }

  loop(fn, minMs, maxMs) {
    const slot = this.timers.length;
    const tick = () => {
      if (!this.ctx) return;
      if (this.ctx.state === 'running') fn();
      this.timers[slot] = setTimeout(tick, minMs + Math.random() * (maxMs - minMs));
    };
    this.timers[slot] = setTimeout(tick, minMs * Math.random());
  }

  // ───────────────────────────────────────── rain

  startRain() {
    const ctx = this.ctx;
    const white = this.whiteBuffer(4);
    // the wash
    const src = this.loopNoise(white);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    const g = ctx.createGain(); g.gain.value = 0.06;
    this.lfo(g.gain, 0.07, 0.015);
    src.connect(hp).connect(lp).connect(g).connect(this.bus.rain);
    // a low body under it, like rain on a roof
    const body = this.loopNoise(this.noise, 0.6);
    const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 400;
    const bg = ctx.createGain(); bg.gain.value = 0.25;
    body.connect(blp).connect(bg).connect(this.bus.rain);
    // individual drops tapping the glass
    this.loop(() => {
      for (let i = 0; i < 3; i++) this.drop(ctx.currentTime + Math.random() * 0.35);
    }, 120, 420);
  }

  drop(when) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 1800 + Math.random() * 2600;
    o.frequency.setValueAtTime(f, when);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, when + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.012, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; o.connect(g).connect(pan).connect(this.bus.rain); }
    else o.connect(g).connect(this.bus.rain);
    o.start(when);
    o.stop(when + 0.08);
  }

  // ───────────────────────────────────────── café murmur

  startMurmur() {
    const ctx = this.ctx;
    // two bands of voice-range noise drifting in and out = distant chatter
    [[320, 0.8, 0.09], [620, 1.2, 0.11]].forEach(([freq, q, rate]) => {
      const src = this.loopNoise(this.noise, 1.4);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
      this.lfo(bp.frequency, rate * 0.7, freq * 0.25);
      const g = ctx.createGain(); g.gain.value = 0.5;
      this.lfo(g.gain, rate, 0.22);
      src.connect(bp).connect(g).connect(this.bus.murmur);
    });
  }

  cupClink() {
    // a spoon touching a cup, somewhere across the room
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const base = 2200 + Math.random() * 1400;
    const count = Math.random() < 0.4 ? 2 : 1;
    for (let n = 0; n < count; n++) {
      const t = now + n * 0.13;
      [1, 2.76, 5.4].forEach((m, i) => {
        const o = ctx.createOscillator();
        o.frequency.value = base * m;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.02 / (i + 1), t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 / (i + 1));
        o.connect(g);
        g.connect(this.bus.murmur);
        g.connect(this.reverb);
        o.start(t); o.stop(t + 0.6);
      });
    }
  }

  // ───────────────────────────────────────── fireplace (spatial)

  startFire() {
    const ctx = this.ctx;
    this.firePanner = ctx.createPanner();
    Object.assign(this.firePanner, {
      panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 2.2, rolloffFactor: 1.3, maxDistance: 40,
    });
    this.setFirePosition({ x: 10.5, y: 0.6, z: 2 });
    this.firePanner.connect(this.bus.fire);

    const rumble = this.loopNoise(this.noise, 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const g = ctx.createGain(); g.gain.value = 0.5;
    this.lfo(g.gain, 0.3, 0.12);
    rumble.connect(lp).connect(g).connect(this.firePanner);

    this.crackleBuf = this.whiteBuffer(0.05);
    this.loop(() => {
      const bursts = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < bursts; i++) this.crackle(ctx.currentTime + Math.random() * 0.25);
    }, 90, 700);
  }

  setFirePosition(p) {
    if (!this.firePanner) return;
    if (this.firePanner.positionX) {
      this.firePanner.positionX.value = p.x;
      this.firePanner.positionY.value = p.y;
      this.firePanner.positionZ.value = p.z;
    } else this.firePanner.setPosition(p.x, p.y, p.z);
  }

  crackle(when) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.crackleBuf;
    src.playbackRate.value = 0.5 + Math.random();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 2500; bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.08 + Math.random() * 0.12, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03 + Math.random() * 0.04);
    src.connect(bp).connect(g).connect(this.firePanner);
    src.start(when);
  }

  // ───────────────────────────────────────── birds / crickets

  birdOrCricket() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = Math.random() * 1.4 - 0.7;
    pan.connect(this.bus.birds);
    pan.connect(this.reverb);

    if (this.night) {
      // crickets: soft, slow pulses
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
        const t = now + i * 0.32;
        const o = ctx.createOscillator();
        o.frequency.value = 4200 + Math.random() * 300;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.008, t + 0.02);
        g.gain.linearRampToValueAtTime(0, t + 0.12);
        o.connect(g).connect(pan);
        o.start(t); o.stop(t + 0.15);
      }
      return;
    }
    // a sparrow: a few quick, sweet pitch sweeps
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1600;
    for (let i = 0; i < notes; i++) {
      const t = now + i * (0.09 + Math.random() * 0.08);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = base * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.7), t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g).connect(pan);
      o.start(t); o.stop(t + 0.1);
    }
  }

  // ───────────────────────────────────────── chimes & little UI sounds

  bell(freq, when, gain = 0.05, decay = 3, bus = 'chimes') {
    const ctx = this.ctx;
    if (!ctx) return;
    [1, 2.0, 3.01].forEach((m, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(gain / (1 + i * 2.5), when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + decay / (1 + i));
      o.connect(g);
      g.connect(this.bus[bus]);
      g.connect(this.reverb);
      o.start(when); o.stop(when + decay + 0.1);
    });
  }

  windChime() {
    const scale = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0]; // C major pentatonic, high
    const now = this.ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      this.bell(scale[Math.floor(Math.random() * scale.length)], now + i * (0.18 + Math.random() * 0.4), 0.025, 4);
    }
  }

  // Played when a note is pinned, a heart is given, a drink arrives…
  cue(kind) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (kind === 'pin') { this.bell(1318.5, now, 0.07, 2.5); this.bell(1975.5, now + 0.12, 0.05, 3); }
    else if (kind === 'heart') { this.bell(1568, now, 0.05, 2); this.bell(2093, now + 0.09, 0.04, 2.5); }
    else if (kind === 'drink') { this.cupClink(); this.bell(1046.5, now + 0.1, 0.04, 2.5); }
    else if (kind === 'chat') { this.bell(1760, now, 0.025, 1.5); }
    else if (kind === 'join') { this.doorBell(0.7); }
    else if (kind === 'sit') { this.bell(880, now, 0.03, 1.5); }
  }

  // The little brass bell over the front door, when someone comes in:
  // a few quick strikes that ring out, and the wind chime answering.
  doorBell(gain = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const strikes = [0, 0.11, 0.2, 0.34, 0.5];
    strikes.forEach((t, i) => {
      const k = gain * (1 - i * 0.16);
      this.bell(2093 * (1 + (i % 2) * 0.006), now + t, 0.085 * k, 2.4);
      this.bell(2637, now + t + 0.012, 0.04 * k, 1.8);
    });
    setTimeout(() => this.windChime(), 450);
  }

  // A soft, wordless voice for the team when they talk — a few little
  // syllables, each with its own pitch (Me3temed hoots instead).
  voice(who, text = '') {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const base = { hana: 520, yuki: 760, yuto: 360, me3temed: 300 }[who] || 600;
    const now = ctx.currentTime;
    if (who === 'me3temed') {
      // hoo… hoo
      [0, 0.42].forEach((t, i) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(base * (i ? 0.92 : 1), now + t);
        o.frequency.linearRampToValueAtTime(base * (i ? 0.84 : 0.95), now + t + 0.3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now + t);
        g.gain.linearRampToValueAtTime(0.09, now + t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.34);
        o.connect(g); g.connect(this.bus.chimes); g.connect(this.reverb);
        o.start(now + t); o.stop(now + t + 0.4);
      });
      return;
    }
    const words = String(text).split(/\s+/).filter(Boolean);
    const n = Math.max(3, Math.min(9, Math.round(words.length * 0.8)));
    let seed = [...String(text)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const t = now + i * 0.085 + rnd() * 0.02;
      const f = base * Math.pow(2, (Math.floor(rnd() * 5) - 2) / 12) * (i === n - 1 ? 1.12 : 1);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(f * 0.9, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.08, t + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
      o.connect(g); g.connect(this.bus.chimes);
      o.start(t); o.stop(t + 0.09);
    }
  }

  // A soft sip, and a little crunch for a bite.
  sip() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(1600, t + 0.3);
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(this.bus.chimes);
    src.start(t);
    this.bell(1046.5, t + 0.32, 0.018, 0.8);
  }
  bite() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 0.07, 0.13].forEach((dt, i) => {
      const src = ctx.createBufferSource();
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 2);
      src.buffer = buf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800 + i * 400;
      const g = ctx.createGain(); g.gain.value = 0.07 - i * 0.015;
      src.connect(hp).connect(g).connect(this.bus.chimes);
      src.start(t + dt);
    });
  }

  // A message you send: a little rising pop. One you receive: a soft two-note ding.
  chatSend() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(620, t);
    o.frequency.exponentialRampToValueAtTime(1240, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(this.bus.chimes);
    o.start(t); o.stop(t + 0.2);
    this.bell(1568, t + 0.07, 0.025, 0.9);
  }
  chatGet() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bell(1318.5, t, 0.05, 1.4);
    this.bell(1760, t + 0.13, 0.045, 1.8);
  }

  // ───────────────────────────────────────── music

  startMusic() {
    const ctx = this.ctx;
    // warm tone: everything through a low-pass with a slow wobble, like tape
    this.musicIn = ctx.createGain();
    this.musicIn.gain.value = 0.9;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2100; lp.Q.value = 0.4;
    this.lfo(lp.frequency, 0.05, 300);
    const send = ctx.createGain(); send.gain.value = 0.45;
    this.musicIn.connect(lp);
    lp.connect(this.bus.music);
    lp.connect(send).connect(this.reverb);

    // Slow, open chords. Each list is MIDI notes; bass is the first one.
    // Fmaj9 → Em7 → Dm9 → Cmaj7(add9) — around and around, never in a hurry.
    this.progressions = [
      [[41, 57, 60, 64, 67], [40, 55, 59, 62, 67], [38, 53, 57, 60, 64], [36, 55, 59, 62, 64]],
      [[45, 57, 60, 64, 67], [41, 57, 60, 64, 69], [43, 55, 59, 62, 66], [36, 55, 60, 64, 67]],
      [[38, 53, 57, 60, 64], [43, 53, 57, 59, 62], [36, 52, 55, 59, 62], [45, 55, 60, 64, 67]],
    ];
    this.pentatonic = [72, 74, 76, 79, 81, 84, 86]; // C pentatonic, the melody never clashes
    this.bar = 0;
    this.prog = 0;
    this.beat = 60 / 64;                // 64 bpm
    this.nextBar = ctx.currentTime + 1.2;
    this.lastMelody = 76;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 200);
  }

  scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    while (this.nextBar < ctx.currentTime + 1.5) {
      const t = this.nextBar;
      const chords = this.progressions[this.prog];
      const chord = chords[this.bar % chords.length];
      const barLen = this.beat * 4;

      // bass: one soft, round note
      this.epiano(chord[0], t, barLen * 1.1, 0.16, true);
      // chord: rolled gently, like fingers settling on the keys
      chord.slice(1).forEach((n, i) => this.epiano(n, t + 0.04 * i + Math.random() * 0.02, barLen * 1.05, 0.07));
      // second half of the bar: a soft re-strike of the upper notes, sometimes
      if (Math.random() < 0.55) {
        chord.slice(2).forEach((n, i) => this.epiano(n, t + this.beat * 2.5 + 0.05 * i, barLen * 0.6, 0.04));
      }
      // melody: a few notes that wander by step, with lots of space
      let beatPos = Math.random() < 0.5 ? 0.5 : 1;
      while (beatPos < 4) {
        if (Math.random() < 0.45) {
          const idx = this.pentatonic.indexOf(this.lastMelody);
          const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
          const next = this.pentatonic[Math.max(0, Math.min(this.pentatonic.length - 1, (idx < 0 ? 2 : idx) + step))];
          this.lastMelody = next;
          this.epiano(next, t + beatPos * this.beat + (Math.random() - 0.5) * 0.04, this.beat * 2.5, 0.05 + Math.random() * 0.025);
        }
        beatPos += [0.5, 1, 1, 1.5, 2][Math.floor(Math.random() * 5)];
      }

      this.bar++;
      if (this.bar % 8 === 0) this.prog = (this.prog + 1 + Math.floor(Math.random() * 2)) % this.progressions.length;
      this.nextBar += barLen;
    }
  }

  // A soft electric piano voice: a few sine partials, slightly detuned,
  // with a quick-but-not-sharp attack and a long, gentle fade.
  epiano(midi, when, dur, vel, isBass = false) {
    const ctx = this.ctx;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(vel, when + (isBass ? 0.04 : 0.015));
    out.gain.setTargetAtTime(vel * 0.45, when + 0.05, 0.4);
    out.gain.setTargetAtTime(0, when + dur * 0.75, dur * 0.25);
    out.connect(this.musicIn);

    const partials = isBass ? [[1, 1], [2, 0.12]] : [[1, 1], [2, 0.18], [3, 0.05], [4.01, 0.02]];
    partials.forEach(([mult, amp]) => {
      for (const detune of isBass ? [0] : [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = amp / (isBass ? 1 : 2);
        // gentle tremolo on the upper voices, like an old Rhodes
        o.connect(g).connect(out);
        o.start(when);
        o.stop(when + dur + 1.5);
      }
    });
    // a tiny felt "tine" at the very start, very quiet
    if (!isBass) {
      const tine = ctx.createOscillator();
      tine.frequency.value = f * 7;
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0, when);
      tg.gain.linearRampToValueAtTime(vel * 0.05, when + 0.004);
      tg.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
      tine.connect(tg).connect(out);
      tine.start(when); tine.stop(when + 0.3);
    }
  }

  stop() {
    this.timers.forEach(clearTimeout);
    clearInterval(this.musicTimer);
    if (this.ctx) this.ctx.close();
    this.ctx = null;
  }
}
