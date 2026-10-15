// Cairo weather for the café — the same imagined-but-honest weather as the
// website: built from Cairo's real monthly climate, seeded by the date so it
// holds all day and changes tomorrow. The café owner can set it by hand
// (site_content 'cafe.weather'), for a while or until they change it back.

const CAIRO_CLIMATE = [ // [avg high, avg low] °C, Jan → Dec
  [19, 9], [21, 10], [24, 12], [28, 15], [32, 18], [35, 21],
  [35, 23], [35, 23], [33, 21], [30, 18], [25, 14], [21, 11],
];

export const WEATHER = {
  clear: { icon: '☀️', nightIcon: '🌙', label: 'Clear', shift: 0,
    note: 'Not a cloud over the whole city. The front window is doing its best work.',
    nightNote: 'Clear enough that you can nearly make out stars over the rooftops.' },
  hazy: { icon: '🌤️', nightIcon: '🌘', label: 'Hazy', shift: 0,
    note: 'The city has gone soft at the edges, the way it does when the air is thick.',
    nightNote: 'Warm haze over everything. The streetlights all have rings around them.' },
  still: { icon: '🌡️', nightIcon: '🌙', label: 'Warm & still', shift: 2,
    note: 'No wind at all. The kind of heat that just sits in the room and waits.',
    nightNote: "Still warm out, and completely without wind. The door's propped open." },
  cloudy: { icon: '☁️', nightIcon: '☁️', label: 'Cloudy', shift: -2,
    note: 'Low and grey — the good kind, where the light comes in even and nobody squints.',
    nightNote: 'Cloud cover the whole way across. No stars tonight, but it stays warm.' },
  rain: { icon: '🌧️', nightIcon: '🌧️', label: 'Rain', shift: -4,
    note: 'Actual rain, in Cairo. Half the street has stopped to look at it and so have we.',
    nightNote: 'Raining quietly on the awning. Nobody inside is in any hurry to leave.' },
  storm: { icon: '⛈️', nightIcon: '⛈️', label: 'Thunderstorm', shift: -5,
    note: 'Thunder over the rooftops. Hana has lit the candles, just in case.',
    nightNote: "A real storm. Every flash shows the whole street for a second. Stay as long as you like." },
  fog: { icon: '🌫️', nightIcon: '🌫️', label: 'Mist', shift: -3,
    note: "A soft white morning. You can't see the end of the street, and that's fine.",
    nightNote: 'Mist under the streetlights. The minarets have disappeared for the night.' },
  khamaseen: { icon: '🌪️', nightIcon: '🌫️', label: 'Khamaseen', shift: 3,
    note: "There's sand in the air. Everyone outside is walking with their eyes half shut — we've shut the front window.",
    nightNote: 'Dust still hanging in the air from this afternoon. The glass needs wiping again.' },
};

// What each kind of weather does to the world outside (0–1 knobs).
export const LOOK = {
  clear:     { sun: 1.0,  clouds: 0.25, cloudGrey: 0,    rain: 0,   fog: 0,    fogColor: null,      sky: null,      wet: 0, birds: 1, flashes: 0 },
  hazy:      { sun: 0.75, clouds: 0.35, cloudGrey: 0.1,  rain: 0,   fog: 0.35, fogColor: '#e6d2b0', sky: '#e8d8bc', wet: 0, birds: 1, flashes: 0 },
  still:     { sun: 1.05, clouds: 0.1,  cloudGrey: 0,    rain: 0,   fog: 0.15, fogColor: '#f3dcb8', sky: '#f6e0bc', wet: 0, birds: 0.6, flashes: 0 },
  cloudy:    { sun: 0.35, clouds: 1.0,  cloudGrey: 0.45, rain: 0,   fog: 0.25, fogColor: '#c9ccd2', sky: '#aeb6c2', wet: 0, birds: 0.6, flashes: 0 },
  rain:      { sun: 0.15, clouds: 1.0,  cloudGrey: 0.7,  rain: 1,   fog: 0.45, fogColor: '#9aa3ae', sky: '#7d8896', wet: 1, birds: 0, flashes: 0 },
  storm:     { sun: 0.05, clouds: 1.0,  cloudGrey: 0.9,  rain: 1.6, fog: 0.55, fogColor: '#6f7884', sky: '#55606e', wet: 1, birds: 0, flashes: 1 },
  fog:       { sun: 0.3,  clouds: 0.6,  cloudGrey: 0.3,  rain: 0,   fog: 1.0,  fogColor: '#d9dcdf', sky: '#cfd4d8', wet: 0.3, birds: 0.2, flashes: 0 },
  khamaseen: { sun: 0.4,  clouds: 0.3,  cloudGrey: 0.2,  rain: 0,   fog: 0.85, fogColor: '#d2a86a', sky: '#d9b07a', wet: 0, birds: 0, flashes: 0 },
};

const SEASONS = {
  winter: ['clear', 'clear', 'cloudy', 'cloudy', 'rain', 'hazy'],
  spring: ['clear', 'clear', 'hazy', 'khamaseen', 'khamaseen', 'cloudy'],
  summer: ['clear', 'clear', 'clear', 'hazy', 'still', 'still'],
  autumn: ['clear', 'clear', 'hazy', 'cloudy', 'still', 'clear'],
};

function seasonOf(m) {
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

function hashInt(n) {
  let x = (n * 2654435761) % 4294967296;
  x = (x ^ (x >>> 13)) >>> 0;
  x = (x * 1274126177) % 4294967296;
  return (x ^ (x >>> 16)) >>> 0;
}

function cairoNow(date = new Date()) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(date).map(p => [p.type, p.value]));
    return { year: +parts.year, month: +parts.month - 1, day: +parts.day, hour: +parts.hour + (+parts.minute) / 60 };
  } catch (e) {
    return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate(), hour: date.getHours() + date.getMinutes() / 60 };
  }
}

// Is a hand-set weather still in force?
export function overrideActive(o, now = Date.now()) {
  return !!(o && o.mode === 'set' && WEATHER[o.condition] && (!o.until || Date.parse(o.until) > now));
}

// The weather right now. `override` is the 'cafe.weather' content row.
export function currentWeather(override = null, date = new Date()) {
  const t = cairoNow(date);
  const seed = t.year * 10000 + (t.month + 1) * 100 + t.day;
  const pool = SEASONS[seasonOf(t.month)];
  const manual = overrideActive(override, date.getTime());
  const key = manual ? override.condition : pool[hashInt(seed) % pool.length];
  const w = WEATHER[key];
  const [hi, lo] = CAIRO_CLIMATE[t.month];
  const mid = (hi + lo) / 2, amp = (hi - lo) / 2;
  const curve = mid + amp * Math.cos((t.hour - 16) * Math.PI / 12);
  const drift = (hashInt(seed + 7) % 5) - 2;
  const night = t.hour < 6 || t.hour >= 19;
  const temp = manual && Number.isFinite(override.temp) ? Math.round(override.temp) : Math.round(curve + drift + w.shift);
  return {
    key, manual, temp, night,
    icon: night ? w.nightIcon : w.icon,
    label: w.label,
    note: night ? w.nightNote : w.note,
    until: manual ? override.until || null : null,
    look: LOOK[key],
  };
}
