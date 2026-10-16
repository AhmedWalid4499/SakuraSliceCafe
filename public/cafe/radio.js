// The café radio: songs the owner uploaded, played on one schedule the whole
// café shares. The server sends the songs (in order) and the moment the radio
// started; every browser works out the same song and the same second from
// that, so everyone hears it together — and someone arriving late comes in
// mid-song, like walking into a café with the radio already on.

export function createRadio({ api, onChange }) {
  const el = new Audio();
  el.preload = 'auto';
  const next = new Audio(); // warms up the next song so the change is seamless
  next.preload = 'auto';
  const r = {
    tracks: [], on: true, startedAt: null, waiting: 0,
    skew: 0,           // server clock minus ours
    listening: false,  // this visitor wants to hear it
    playing: false,
    blocked: false,    // the browser wants a tap first
    current: null, offset: 0, volume: 0.7,
  };
  el.volume = r.volume;

  const total = () => r.tracks.reduce((s, t) => s + t.duration, 0);
  const now = () => Date.now() + r.skew;

  // Which song, and how far in, at this moment?
  function where(at = now()) {
    const len = total();
    if (!len) return null;
    let t = (((at - (r.startedAt || 0)) / 1000) % len + len) % len;
    for (let i = 0; i < r.tracks.length; i++) {
      if (t < r.tracks[i].duration) return { i, track: r.tracks[i], offset: t };
      t -= r.tracks[i].duration;
    }
    return { i: 0, track: r.tracks[0], offset: 0 };
  }

  async function load() {
    const t0 = Date.now();
    const d = await api('/radio');
    const t1 = Date.now();
    r.skew = d.serverNow - (t0 + t1) / 2;
    r.tracks = d.tracks || [];
    r.on = d.on !== false;
    r.startedAt = d.startedAt;
    r.waiting = d.waiting || 0;
    sync(true);
    return r;
  }

  function stop() {
    el.pause();
    r.playing = false;
  }

  // Put the right song on at the right second (and nudge it back if it drifted).
  function sync(force = false) {
    const w = where();
    r.current = w && w.track;
    r.offset = w ? w.offset : 0;
    if (!r.listening || !r.on || !w) { if (r.playing) stop(); onChange && onChange(r); return; }
    const src = `/api/media/${w.track.id}`;
    const same = el.dataset.id === String(w.track.id);
    if (!same) {
      el.dataset.id = String(w.track.id);
      el.src = src;
      force = true;
    }
    if (force || Math.abs(el.currentTime - w.offset) > 1.5) {
      try { el.currentTime = w.offset; } catch (e) { /* not ready yet: set on loadedmetadata */ }
    }
    if (el.paused) {
      el.play().then(() => { r.playing = true; r.blocked = false; onChange && onChange(r); })
        .catch(() => { r.playing = false; r.blocked = true; onChange && onChange(r); });
    }
    // warm up the one after
    const n = r.tracks[(w.i + 1) % r.tracks.length];
    if (n && next.dataset.id !== String(n.id)) { next.dataset.id = String(n.id); next.src = `/api/media/${n.id}`; }
    onChange && onChange(r);
  }

  el.addEventListener('loadedmetadata', () => {
    const w = where();
    if (w && el.dataset.id === String(w.track.id)) { try { el.currentTime = w.offset; } catch (e) { /* ignore */ } }
  });
  el.addEventListener('ended', () => sync(true));
  el.addEventListener('pause', () => { if (!el.ended) { r.playing = false; onChange && onChange(r); } });
  el.addEventListener('playing', () => { r.playing = true; onChange && onChange(r); });
  el.addEventListener('error', () => { r.playing = false; onChange && onChange(r); });

  // Every few seconds: keep in step, and move on when a song ends.
  setInterval(() => { if (r.listening && r.on && r.tracks.length) sync(); else if (r.tracks.length) { const w = where(); r.current = w && w.track; r.offset = w ? w.offset : 0; onChange && onChange(r); } }, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && r.listening) sync(true); });

  return {
    state: r,
    load,
    where,
    total,
    listen(on) { r.listening = !!on; if (!on) stop(); sync(true); },
    setVolume(v) { r.volume = v; el.volume = v; },
    progress() {
      if (r.playing && el.dataset.id && r.current && el.dataset.id === String(r.current.id)) return el.currentTime;
      const w = where(); return w ? w.offset : 0;
    },
  };
}

// How long a song is, read from the file before it's uploaded.
export function audioDuration(file) {
  return new Promise(resolve => {
    const a = document.createElement('audio');
    const url = URL.createObjectURL(file);
    a.preload = 'metadata';
    a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(url); resolve(Number.isFinite(d) ? d : 0); };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    a.src = url;
  });
}
