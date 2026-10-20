// Sakura Slice Café — web server.
// Serves the website and the 3D café from /public, the API under /api,
// and the live café over a WebSocket at /ws.

const http = require('http');
const path = require('path');
const express = require('express');
const { migrate } = require('./db');
const api = require('./api');
const realtime = require('./realtime');
const groups = require('./groups');

const app = express();
app.set('trust proxy', 1); // Railway sits behind a proxy; needed for secure cookies + req.ip
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});

// Which version is running (Railway sets RAILWAY_GIT_COMMIT_SHA) — handy for
// "is my update live yet?": open /version in the browser.
const VERSION = {
  release: 'Flats & doors button in the hallway',
  commit: (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || null,
  started: new Date().toISOString(),
};
app.get('/healthz', (_req, res) => res.json({ ok: true, ...VERSION }));
app.get('/version', (_req, res) => res.set('Cache-Control', 'no-cache').json(VERSION));
// uploads come in raw (a song or a picture), so they go before the JSON-only API
app.use('/api/admin/upload', require('./media').uploadRouter);
app.use('/api/home/photo-upload', require('./homes').photoUpload);
app.use('/api', api);

// Three.js comes from npm (version pinned in package.json), not a CDN.
const three = path.join(__dirname, '..', 'node_modules', 'three');
app.use('/vendor/three/build', express.static(path.join(three, 'build'), { maxAge: '7d' }));
app.use('/vendor/three/addons', express.static(path.join(three, 'examples', 'jsm'), { maxAge: '7d' }));
app.use('/vendor/chess', express.static(path.join(__dirname, '..', 'node_modules', 'chess.js', 'dist', 'esm'), { maxAge: '7d' }));

const pub = path.join(__dirname, '..', 'public');
// The two pages carry link previews (Open Graph) for WhatsApp, Instagram,
// iMessage and the rest: a picture of the café, and — for an invite link —
// who's saving you a seat. Previews need full addresses, so the site's own
// address is filled in per request.
const fs = require('fs');
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function page(req, res, file, preview) {
  let html;
  try { html = await fs.promises.readFile(path.join(pub, file), 'utf8'); } catch (e) { return res.status(500).end(); }
  const origin = `${(req.get('x-forwarded-proto') || req.protocol).split(',')[0]}://${req.get('x-forwarded-host') || req.get('host')}`;
  const p = { url: origin + req.originalUrl, ...(await preview(req)) };
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Sakura Slice Café">`,
    `<meta property="og:title" content="${esc(p.title)}">`,
    `<meta property="og:description" content="${esc(p.description)}">`,
    `<meta property="og:url" content="${esc(p.url)}">`,
    `<meta property="og:image" content="${origin}${p.image}">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(p.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(p.title)}">`,
    `<meta name="twitter:description" content="${esc(p.description)}">`,
    `<meta name="twitter:image" content="${origin}${p.image}">`,
    `<meta name="theme-color" content="#f2a7bb">`,
  ].join('\n');
  res.set('Cache-Control', 'no-cache').type('html').send(html.replace('</head>', tags + '\n</head>'));
}
const sitePreview = async () => ({
  title: 'Sakura Slice Café — a cozy café in Cairo, imagined with love',
  description: 'Letters, stories and a little 3D café you can walk into from anywhere. Make an avatar, order a drink, leave a kind note for a stranger.',
  image: '/og/site.jpg', alt: 'Inside Sakura Slice Café: warm wood, sakura and lamplight',
});
async function cafePreview(req) {
  const base = {
    title: 'Come in, stay a while — Sakura Slice Café',
    description: 'A quiet 3D café in Cairo you can sit in from anywhere. Find a seat, order a drink, play tawla, and leave a note for whoever needs it next.',
    image: '/og/cafe.jpg', alt: 'People sitting at tables in Sakura Slice Café',
  };
  const who = String(req.query.invite || '').toLowerCase().slice(0, 24);
  if (!/^[a-z0-9_.]{3,24}$/.test(who)) return base;
  try {
    const { rows } = await require('./db').query('SELECT display_name FROM users WHERE username = $1', [who]);
    if (!rows[0]) return base;
    return { ...base, title: `${rows[0].display_name} saved you a seat at Sakura Slice Café 🌸`, description: 'Come and sit with me — order something warm, play a game of tawla, and stay as long as you like.' };
  } catch (e) { return base; }
}
app.get(['/', '/index.html'], (req, res) => page(req, res, 'index.html', sitePreview));
// /cafe is the page; /cafe/*.js are its modules (the folder would otherwise win).
app.get('/cafe', (req, res) => page(req, res, 'cafe.html', cafePreview));
app.use(express.static(pub, { extensions: ['html'], maxAge: '1h', setHeaders(res, file) {
  // pages and the café's code are always checked for a newer version (a quick
  // 304 when nothing changed), so a deploy shows up on the next reload
  if (/\.(html|js|mjs|css)$/.test(file)) res.set('Cache-Control', 'no-cache');
} }));

// The old GitHub Pages filename still works.
app.get('/sakura-cafe-3d.html', (_req, res) => res.redirect(301, '/cafe'));
app.use((_req, res) => res.status(404).sendFile(path.join(pub, 'index.html')));

const port = Number(process.env.PORT || 3000);

migrate()
  .then(() => {
    const server = http.createServer(app);
    realtime.attach(server, { canEnter: groups.canEnter });
    server.listen(port, () => console.log(`🌸 Sakura Slice Café is open on :${port}`));
  })
  .catch(err => {
    console.error('Could not prepare the database:', err);
    process.exit(1);
  });
