// Postgres connection + migrations.
// Railway provides DATABASE_URL when a Postgres service is linked.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function sslFor(url) {
  if (process.env.PGSSLMODE === 'disable') return false;
  if (process.env.PGSSLMODE === 'require') return { rejectUnauthorized: false };
  // Railway's private network and local databases don't use TLS;
  // the public proxy (and most hosted Postgres) does.
  if (!url || /localhost|127\.0\.0\.1|\.railway\.internal/.test(url)) return false;
  return { rejectUnauthorized: false };
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Link a Postgres service in Railway, or set it in .env for local work.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslFor(process.env.DATABASE_URL),
  max: Number(process.env.PG_POOL_MAX || 10),
});

pool.on('error', err => console.error('postgres pool error', err));

const query = (text, params) => pool.query(text, params);

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  // Seed site content once. Existing rows are never overwritten, so edits
  // made through the admin page (or straight in the database) survive deploys.
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-content.json'), 'utf8'));
  for (const [key, { value, description }] of Object.entries(seed)) {
    await pool.query(
      `INSERT INTO site_content (key, value, description) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(value), description || '']
    );
  }

  // Promote the owner. Set ADMIN_EMAIL in Railway; whoever registers (or has
  // registered) with that email becomes an admin.
  if (process.env.ADMIN_EMAIL) {
    await pool.query('UPDATE users SET is_admin = TRUE WHERE lower(email) = lower($1)', [process.env.ADMIN_EMAIL]);
  }

  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
}

module.exports = { pool, query, migrate };
