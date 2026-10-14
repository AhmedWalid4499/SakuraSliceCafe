// Small helpers shared by the routes.

// Fixed-window rate limiter kept in memory. Good enough for one Railway
// instance; keyed by user id when signed in, otherwise by IP.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = req.user ? 'u' + req.user.id : 'ip' + req.ip;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
    if (++h.n > max) {
      res.set('Retry-After', Math.ceil((h.reset - now) / 1000));
      return res.status(429).json({ error: message || 'Slow down a little — the café is not going anywhere.' });
    }
    next();
  };
}

// Plain text in, plain text out: no control characters, collapsed spaces,
// trimmed to a maximum length. Everything is rendered with textContent on
// the client, so this is about tidiness, not escaping.
function cleanText(s, max) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

const isHexColor = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n)));

// Async route wrapper so thrown errors reach the error handler.
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { rateLimit, cleanText, isHexColor, clamp, wrap };
