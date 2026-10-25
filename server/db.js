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

  await moveNotesToTheBiggerCafe();
  // Emails and usernames are kept in lower case (sign-in ignores capitals); an
  // account made with capitals before that is put right, unless it would clash.
  await pool.query(`UPDATE users u SET username = lower(u.username) WHERE u.username <> lower(u.username)
    AND NOT EXISTS (SELECT 1 FROM users o WHERE o.id <> u.id AND lower(o.username) = lower(u.username))`);
  await pool.query(`UPDATE users u SET email = lower(u.email) WHERE u.email <> lower(u.email)
    AND NOT EXISTS (SELECT 1 FROM users o WHERE o.id <> u.id AND lower(o.email) = lower(u.email))`);
  await giveEveryFlatADoor();

  // Promote the owner. Set ADMIN_EMAIL in Railway; whoever registers (or has
  // registered) with that email becomes an admin.
  if (process.env.ADMIN_EMAIL) {
    await pool.query('UPDATE users SET is_admin = TRUE WHERE lower(email) = lower($1)', [process.env.ADMIN_EMAIL]);
  }

  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
}

// Every flat has its own door in the hallway upstairs, the same one for
// everyone who walks along it (doors 0–27: public/cafe/hall.js SLOTS, two
// to each spot, facing each other). Flats used to be shown with your own
// always behind the first door, so everyone's looked like the same door.
// Once, for the flats that don't have a door yet: the owner's (ADMIN_EMAIL)
// is Room 01, Zanaty's the one across the hallway from it (Room 02), and
// the rest take the next free door in the order they were made.
const DOORS = 28; // 14 along each hallway: the first (0–13) and the upper one (14–27)
async function giveEveryFlatADoor() {
  const claim = (door, where, params) => pool.query(
    `UPDATE home_rooms SET door = ${door} WHERE door IS NULL AND NOT EXISTS (SELECT 1 FROM home_rooms WHERE door = ${door})
       AND owner_id = (SELECT id FROM users WHERE ${where} ORDER BY id LIMIT 1)`, params);
  if (process.env.ADMIN_EMAIL) await claim(0, 'lower(email) = lower($1)', [process.env.ADMIN_EMAIL]);
  await claim(1, "lower(username) IN ('zanaty', 'zananty') OR lower(display_name) IN ('zanaty', 'zananty')", []);
  const { rows } = await pool.query('SELECT owner_id FROM home_rooms WHERE door IS NULL ORDER BY created_at, owner_id');
  for (const { owner_id: id } of rows) {
    await pool.query(
      `UPDATE home_rooms SET door = (SELECT s FROM generate_series(0, $2 - 1) s WHERE NOT EXISTS (SELECT 1 FROM home_rooms h WHERE h.door = s) ORDER BY s LIMIT 1)
       WHERE owner_id = $1 AND door IS NULL`, [id, DOORS]);
  }
}

// The café grew from 22 × 16 m to 30 × 22 m (see public/cafe/layout.mjs).
// Notes pinned before then are moved once, with the same rules as the
// furniture, so they stay on their board, table or wall.
async function moveNotesToTheBiggerCafe() {
  await pool.query('ALTER TABLE cafe_notes ADD COLUMN IF NOT EXISTS layout INTEGER NOT NULL DEFAULT 1');
  const { rows } = await pool.query('SELECT id, room, pos_x, pos_z FROM cafe_notes WHERE layout = 1');
  if (rows.length) {
    const { pathToFileURL } = require('url');
    const layout = await import(pathToFileURL(path.join(__dirname, '..', 'public', 'cafe', 'layout.mjs')).href);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const n of rows) {
        const [dx, dz] = layout.deltaAt(n.room === 'main' ? 'main' : 'up', n.pos_x, n.pos_z);
        await client.query('UPDATE cafe_notes SET pos_x = pos_x + $2, pos_z = pos_z + $3, layout = 2 WHERE id = $1 AND layout = 1', [n.id, dx, dz]);
      }
      await client.query('COMMIT');
      console.log(`moved ${rows.length} note(s) into the bigger café`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  // notes pinned from now on are already on the new plan
  await pool.query('ALTER TABLE cafe_notes ALTER COLUMN layout SET DEFAULT 2');
}

module.exports = { pool, query, migrate };
