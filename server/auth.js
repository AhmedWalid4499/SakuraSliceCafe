// Accounts and sessions. Sessions are random tokens in an httpOnly cookie;
// only their sha256 is stored, so a database leak can't be replayed.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

const COOKIE = 'ssc_session';
const SESSION_DAYS = 30;

const hashToken = t => crypto.createHash('sha256').update(t).digest('hex');

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatar: u.avatar || {},
    prefs: u.prefs || {},
    isAdmin: !!u.is_admin,
    createdAt: u.created_at,
  };
}

async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(token), userId, expires]);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  });
}

async function userFromCookieHeader(cookieHeader) {
  const token = parseCookies(cookieHeader)[COOKIE];
  if (!token) return null;
  const { rows } = await query(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`, [hashToken(token)]);
  return rows[0] || null;
}

// Express middleware: sets req.user (raw row) when signed in.
async function loadUser(req, _res, next) {
  try { req.user = await userFromCookieHeader(req.headers.cookie); }
  catch (e) { req.user = null; }
  next();
}

const requireUser = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Please sign in first.' });

const requireAdmin = (req, res, next) =>
  req.user && req.user.is_admin ? next() : res.status(403).json({ error: 'Only the café owner can do that.' });

async function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  res.clearCookie(COOKIE, { path: '/' });
}

const hashPassword = pw => bcrypt.hash(pw, 11);
const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

module.exports = {
  loadUser, requireUser, requireAdmin, createSession, destroySession,
  userFromCookieHeader, publicUser, hashPassword, checkPassword,
};
