// Today's prayer times in Cairo, worked out from where the sun is — the
// Egyptian General Authority of Survey's method (Fajr at the sun 19.5° below
// the horizon, Isha at 17.5°, Asr when a shadow is its own length plus noon's).
// No network needed; the times are shown as Cairo's clock reads them
// (summer time included). Plain functions, so the server could use them too.

const CAIRO = { lat: 30.0444, lon: 31.2357 };
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const fix = (a, b) => a - b * Math.floor(a / b);

// the sun's declination and the equation of time for a Julian day
function sun(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA };
}

// hours after (or before) noon until the sun stands at `angle` below the horizon
function hourAngle(angle, decl, lat) {
  const c = (-Math.sin(rad(angle)) - Math.sin(rad(lat)) * Math.sin(rad(decl))) / (Math.cos(rad(lat)) * Math.cos(rad(decl)));
  return deg(Math.acos(Math.max(-1, Math.min(1, c)))) / 15;
}

// The six times for the Cairo date `ymd` ({ y, m, d }), as UTC Date objects.
export function prayerTimes(ymd, at = CAIRO) {
  const jd = Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12) / 86400000 + 2440587.5;
  const { decl, eqt } = sun(jd);
  const noon = fix(12 - at.lon / 15 - eqt, 24); // hours, UTC
  const asrAlt = -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(at.lat - decl)))))); // a shadow its own length (Shafi'i)
  const h = {
    fajr: noon - hourAngle(19.5, decl, at.lat),
    sunrise: noon - hourAngle(0.833, decl, at.lat),
    dhuhr: noon + 1 / 60,                 // just after the sun passes its highest
    asr: noon + hourAngle(asrAlt, decl, at.lat),
    maghrib: noon + hourAngle(0.833, decl, at.lat) + 1 / 60,
    isha: noon + hourAngle(17.5, decl, at.lat),
  };
  const base = Date.UTC(ymd.y, ymd.m - 1, ymd.d);
  const out = {};
  for (const [k, v] of Object.entries(h)) out[k] = new Date(base + Math.round(v * 60) * 60000);
  return out;
}

export const PRAYERS = [
  ['fajr', 'Fajr', 'الفجر'], ['sunrise', 'Sunrise', 'الشروق'], ['dhuhr', 'Dhuhr', 'الظهر'],
  ['asr', 'Asr', 'العصر'], ['maghrib', 'Maghrib', 'المغرب'], ['isha', 'Isha', 'العشاء'],
];

// today in Cairo, the times as Cairo's clock shows them, and which comes next
export function cairoPrayerDay(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  const times = prayerTimes({ y: parts.year, m: parts.month, d: parts.day });
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false });
  const next = PRAYERS.find(([k]) => k !== 'sunrise' && times[k] > now);
  return {
    list: PRAYERS.map(([k, en, ar]) => ({ key: k, en, ar, at: times[k], clock: fmt.format(times[k]) })),
    next: next ? next[0] : 'fajr', // after Isha, the next is tomorrow's Fajr
  };
}

// From Cairo, Makkah is a little east of south-east.
export const QIBLA_BEARING = 136;

// The Hijri date in Cairo (Umm al-Qura, the way the browser counts it), and
// where Ramadan is: in it (which day), Eid al-Fitr, or how many days to go.
const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'numeric', year: 'numeric' });
export function hijri(now = new Date()) {
  const p = Object.fromEntries(hijriFmt.formatToParts(now).filter(x => ['day', 'month', 'year'].includes(x.type)).map(x => [x.type, parseInt(x.value, 10)]));
  return { day: p.day, month: p.month, year: p.year };
}
export function ramadan(now = new Date()) {
  const h = hijri(now);
  if (h.month === 9) return { now: true, day: h.day, eid: false, daysUntil: 0 };
  if (h.month === 10 && h.day <= 3) return { now: false, day: 0, eid: true, daysUntil: 0 };
  for (let d = 1; d < 400; d++) {
    const x = hijri(new Date(now.getTime() + d * 86400e3));
    if (x.month === 9) return { now: false, day: 0, eid: false, daysUntil: d };
  }
  return { now: false, day: 0, eid: false, daysUntil: null };
}
