// Uploads (songs for the café radio, the book-of-the-week cover), the radio
// itself, and the story shelf's Google Sheet sync.
//
// The radio is one schedule everyone shares: a list of songs and the moment
// it started. From that, every browser works out the same song and the same
// second, so the whole café hears it together.

const express = require('express');
const { query, pool } = require('./db');
const auth = require('./auth');
const realtime = require('./realtime');
const { cleanText, wrap, publicContent } = require('./util');

const AUDIO = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/flac'];
const IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX = 30 * 1024 * 1024;

const kindOf = mime => (AUDIO.includes(mime) ? 'audio' : IMAGE.includes(mime) ? 'image' : null);

async function saveMedia({ mime, bytes, name, title, artist, duration, userId }) {
  const kind = kindOf(mime);
  const { rows } = await query(
    `INSERT INTO media (kind, mime, name, title, artist, duration, size, bytes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, kind, mime, name, title, artist, duration, size`,
    [kind, mime, cleanText(name, 160), cleanText(title, 160), cleanText(artist, 160), Math.max(0, Math.min(3600, Number(duration) || 0)), bytes.length, bytes, userId]);
  return rows[0];
}

// A site_content row, saved with history and sent to everyone (like /admin does).
async function setContent(key, value, userId, description) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prev = await client.query('SELECT value FROM site_content WHERE key = $1 FOR UPDATE', [key]);
    if (prev.rows[0]) {
      await client.query('INSERT INTO site_content_history (key, value, changed_by) VALUES ($1, $2, $3)', [key, JSON.stringify(prev.rows[0].value), userId]);
    }
    await client.query(
      `INSERT INTO site_content (key, value, description, updated_at, updated_by) VALUES ($1, $2, $3, now(), $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = $4`,
      [key, JSON.stringify(value), description || '', userId]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  realtime.broadcast({ t: 'content', key, value: publicContent(key, value) });
}

async function getContent(key) {
  const { rows } = await query('SELECT value FROM site_content WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : null;
}

// ── uploads: the raw file is the body (Content-Type audio/* or image/*,
// which a cross-site form can't send, so no CSRF), details in the query string
const uploadRouter = express.Router();
uploadRouter.use(auth.loadUser, auth.requireAdmin);
uploadRouter.post('/', express.raw({ type: () => true, limit: MAX }), wrap(async (req, res) => {
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!kindOf(mime)) return res.status(415).json({ error: 'That kind of file isn\'t supported — songs (mp3, m4a, ogg, wav) or pictures (jpg, png, webp).' });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'The file was empty.' });
  const q = req.query;
  const item = await saveMedia({ mime, bytes: req.body, name: q.name, title: q.title || String(q.name || '').replace(/\.[a-z0-9]+$/i, ''), artist: q.artist, duration: q.duration, userId: req.user.id });
  res.json({ media: item });
}));

// Turn a Google Drive share link into a direct download.
function directLink(url) {
  const m = String(url).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
}

const router = express.Router();

// a file from a link (a Google Drive share link works) — fetched once, kept here
router.post('/admin/media/from-url', auth.requireAdmin, wrap(async (req, res) => {
  const url = String(req.body.url || '').trim();
  if (!/^https:\/\//.test(url)) return res.status(400).json({ error: 'Paste a link that starts with https://' });
  let r;
  try { r = await fetch(directLink(url), { redirect: 'follow' }); } catch (e) { return res.status(400).json({ error: 'Couldn\'t reach that link.' }); }
  if (!r.ok) return res.status(400).json({ error: `That link answered ${r.status}. On Google Drive, set the file to "Anyone with the link".` });
  const mime = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!kindOf(mime)) return res.status(400).json({ error: 'That link isn\'t a picture or a song (on Google Drive, set the file to "Anyone with the link").' });
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > MAX) return res.status(413).json({ error: 'That file is too big (30 MB at most).' });
  const item = await saveMedia({ mime, bytes, name: req.body.name || url.split('/').pop().slice(0, 80), title: req.body.title, artist: req.body.artist, duration: req.body.duration, userId: req.user.id });
  res.json({ media: item });
}));

router.patch('/admin/media/:id', auth.requireAdmin, wrap(async (req, res) => {
  const { rows } = await query(
    `UPDATE media SET title = COALESCE($2, title), artist = COALESCE($3, artist), duration = COALESCE($4, duration)
     WHERE id = $1 RETURNING id, kind, mime, name, title, artist, duration, size`,
    [Number(req.params.id), req.body.title == null ? null : cleanText(req.body.title, 160), req.body.artist == null ? null : cleanText(req.body.artist, 160),
      req.body.duration == null ? null : Math.max(0, Math.min(3600, Number(req.body.duration) || 0))]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json({ media: rows[0] });
}));

router.delete('/admin/media/:id', auth.requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  await query('DELETE FROM media WHERE id = $1', [id]);
  const radio = (await getContent('cafe.radio')) || {};
  if (Array.isArray(radio.order) && radio.order.includes(id)) {
    await setContent('cafe.radio', { ...radio, order: radio.order.filter(x => x !== id) }, req.user.id);
  }
  res.json({ ok: true });
}));

// the file itself, with byte ranges (browsers seek songs this way)
router.get('/media/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query('SELECT mime, size FROM media WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).end();
  const { mime, size } = rows[0];
  res.set({ 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' });
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let start = 0, end = size - 1;
  if (range) {
    if (range[1]) start = Number(range[1]);
    if (range[2]) end = Math.min(size - 1, Number(range[2]));
    if (!range[1] && range[2]) { start = Math.max(0, size - Number(range[2])); end = size - 1; }
    if (start > end || start >= size) return res.status(416).set('Content-Range', `bytes */${size}`).end();
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  // Postgres hands back just the slice that was asked for
  const part = await query('SELECT substring(bytes from $2 for $3) AS b FROM media WHERE id = $1', [id, start + 1, end - start + 1]);
  res.set('Content-Length', String(end - start + 1));
  res.end(part.rows[0].b);
}));

// ── the café radio: the songs, in order, and when it started
router.get('/radio', wrap(async (_req, res) => {
  const radio = (await getContent('cafe.radio')) || { on: true, order: [], startedAt: null };
  const { rows } = await query("SELECT id, title, artist, duration, mime FROM media WHERE kind = 'audio' ORDER BY id");
  const byId = new Map(rows.map(r => [r.id, r]));
  const order = (Array.isArray(radio.order) ? radio.order : []).filter(id => byId.has(id));
  // songs uploaded but not yet placed go on the end
  for (const r of rows) if (!order.includes(r.id)) order.push(r.id);
  res.set('Cache-Control', 'no-store').json({
    serverNow: Date.now(), on: radio.on !== false, startedAt: radio.startedAt || null,
    tracks: order.map(id => byId.get(id)).filter(t => t.duration > 0),
    waiting: order.map(id => byId.get(id)).filter(t => !(t.duration > 0)).length,
  });
}));

// ── the story shelf: stories from a Google Sheet (the one the letters come from)
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function sheetCsvUrl(url) {
  const m = String(url).match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (!m) return url;
  if (/\/pub\?/.test(url)) return url.replace(/output=\w+/, 'output=csv').replace(/\/pub\?(?!.*output=)/, '/pub?output=csv&');
  const gid = (String(url).match(/[#&?]gid=(\d+)/) || [])[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? '&gid=' + gid : ''}`;
}

// Columns are found by their headings: title, story/text/body, date,
// type/kind (morning or night), edition, day, image.
function storiesFromRows(rows) {
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = re => head.findIndex(h => re.test(h));
  const c = {
    title: col(/title|subject|name/), text: col(/story|text|body|content|letter/), date: col(/date|sent|when/),
    kind: col(/type|kind|morning|night|time of day/), edition: col(/edition|version|week|theme/), day: col(/^day|weekday/),
    image: col(/image|cover|picture|photo/),
  };
  if (c.text < 0) return [];
  const out = [];
  for (const r of rows.slice(1)) {
    const text = String(r[c.text] || '').trim();
    if (text.length < 40) continue;
    const kindRaw = c.kind >= 0 ? String(r[c.kind] || '').toLowerCase() : '';
    out.push({
      title: cleanText(c.title >= 0 ? r[c.title] : '', 140) || cleanText(text.split(/[.\n]/)[0], 80),
      kind: /night|bed|evening/.test(kindRaw) ? 'night' : 'morning',
      edition: c.edition >= 0 ? cleanText(r[c.edition], 60) : '',
      day: c.day >= 0 ? cleanText(r[c.day], 20) : '',
      date: c.date >= 0 ? cleanText(r[c.date], 40) : '',
      image: c.image >= 0 ? cleanText(r[c.image], 300) : '',
      paragraphs: text.split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean).slice(0, 200).map(p => p.slice(0, 3000)),
    });
  }
  return out;
}

async function syncStories(userId) {
  const conf = (await getContent('stories.sheet')) || {};
  if (!conf.url) return { error: 'Add the Google Sheet link first.' };
  const r = await fetch(sheetCsvUrl(conf.url), { redirect: 'follow' });
  const body = await r.text();
  if (!r.ok || /<html/i.test(body.slice(0, 200))) return { error: 'Google didn\'t share the sheet. In the sheet: Share → General access → "Anyone with the link" (Viewer).' };
  const stories = storiesFromRows(parseCSV(body));
  if (!stories.length) return { error: 'Found the sheet, but no column of stories. Give the story column a heading like "Story" (and "Title", "Date", "Type").' };
  await setContent('stories.library', stories, userId || null, 'The story shelf in the 3D café (the bookshelf). Filled from the Google Sheet in stories.sheet, or by hand: [{ title, kind: "morning"|"night", edition, day, date, paragraphs: [] }].');
  await setContent('stories.sheet', { ...conf, lastSync: new Date().toISOString(), count: stories.length }, userId || null);
  return { count: stories.length };
}

router.post('/admin/stories/sheet', auth.requireAdmin, wrap(async (req, res) => {
  const url = String(req.body.url || '').trim();
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) return res.status(400).json({ error: 'Paste the Google Sheet\'s link (docs.google.com/spreadsheets/…).' });
  const conf = (await getContent('stories.sheet')) || {};
  await setContent('stories.sheet', { ...conf, url }, req.user.id, 'The Google Sheet the story shelf reads from (shared as "Anyone with the link").');
  const out = await syncStories(req.user.id);
  res.status(out.error ? 400 : 200).json(out);
}));
router.get('/admin/stories/sheet', auth.requireAdmin, wrap(async (_req, res) => {
  res.json((await getContent('stories.sheet')) || {});
}));
router.post('/admin/stories/sync', auth.requireAdmin, wrap(async (req, res) => {
  const out = await syncStories(req.user.id);
  res.status(out.error ? 400 : 200).json(out);
}));

// keep the shelf fresh: read the sheet again every six hours
setInterval(() => { syncStories(null).catch(() => {}); }, 6 * 3600e3).unref();

module.exports = { uploadRouter, router, storiesFromRows, parseCSV, sheetCsvUrl };
