-- Sakura Slice Café — Postgres schema
-- Safe to run on every boot: everything is IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- skin, hair, outfit, accessory…
  prefs         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- sound mix, favourite seat…
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,                       -- sha256 of the cookie token
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Notes and pins left inside the 3D café. Everyone sees them.
CREATE TABLE IF NOT EXISTS cafe_notes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'note',           -- 'note' (paper) | 'pin' (photo-less pin)
  surface     TEXT NOT NULL,                          -- 'board' | 'table' | 'wall'
  text        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#fde8ef',
  pos_x       REAL NOT NULL,
  pos_y       REAL NOT NULL,
  pos_z       REAL NOT NULL,
  rot_y       REAL NOT NULL DEFAULT 0,
  tilt        REAL NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cafe_notes_created_idx ON cafe_notes(created_at DESC);

CREATE TABLE IF NOT EXISTS note_hearts (
  note_id    INTEGER NOT NULL REFERENCES cafe_notes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, user_id)
);

-- Quiet chat inside the café.
CREATE TABLE IF NOT EXISTS chat_messages (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_created_idx ON chat_messages(created_at DESC);

-- Table Four guestbook on the main website (no account needed).
CREATE TABLE IF NOT EXISTS guestbook_notes (
  id          SERIAL PRIMARY KEY,
  who         TEXT NOT NULL DEFAULT 'anonymous',
  text        TEXT NOT NULL,
  hidden      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Morning & evening letter subscribers.
CREATE TABLE IF NOT EXISTS subscribers (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  source      TEXT NOT NULL DEFAULT 'website',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

-- Everything editable about the site: story of the day, letters, moods,
-- café settings… One JSON document per key. Changing a row changes the
-- live site, no redeploy needed.
CREATE TABLE IF NOT EXISTS site_content (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Every change to site_content is kept, so nothing is ever lost.
CREATE TABLE IF NOT EXISTS site_content_history (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS content_history_key_idx ON site_content_history(key, changed_at DESC);
