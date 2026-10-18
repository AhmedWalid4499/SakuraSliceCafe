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
  release: 'the kitchen, table service and a moving team',
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

const pub = path.join(__dirname, '..', 'public');
// /cafe is the page; /cafe/*.js are its modules (the folder would otherwise win).
app.get('/cafe', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(pub, 'cafe.html')));
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
