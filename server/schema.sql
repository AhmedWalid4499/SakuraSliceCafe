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

-- ─────────────────────────────────────────── talking with the team (AI)

-- One conversation with one character. A new one starts after a quiet
-- spell, so each conversation is short and only ever appended to.
CREATE TABLE IF NOT EXISTS npc_sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  npc         TEXT NOT NULL,                          -- 'yuto' | 'hana' | 'yuki' | 'me3temed'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS npc_sessions_user_idx ON npc_sessions(user_id, npc, updated_at DESC);
-- which version of the characters' prompt + tools a conversation started with
ALTER TABLE npc_sessions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Every message exactly as sent to / received from the model (content is
-- the raw message content, replayed verbatim). `display` is what the guest
-- sees in the chat window; null for tool plumbing.
CREATE TABLE IF NOT EXISTS npc_messages (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES npc_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,                          -- 'user' | 'assistant'
  content     JSON NOT NULL,                          -- JSON, not JSONB: kept byte-for-byte
  display     TEXT,
  meta        JSONB,                                  -- e.g. a drink recommendation
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS npc_messages_session_idx ON npc_messages(session_id, id);
-- (early databases had JSONB here, which re-sorts keys; the replayed history must match exactly)
ALTER TABLE npc_messages ALTER COLUMN content TYPE JSON USING content::text::json;

-- Small things the team remembers about a guest ("loves cardamom",
-- "doesn't drink caffeine after 6"), shared by all four characters.
CREATE TABLE IF NOT EXISTS guest_memories (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  learned_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guest_memories_user_idx ON guest_memories(user_id, created_at DESC);

-- ─────────────────────────────────────────── groups & the second floor

CREATE TABLE IF NOT EXISTS groups (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#d4678a',
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',         -- 'owner' | 'member'
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id);

-- Which room a note or chat message belongs to: 'main' is the ground
-- floor; 'group:<id>' is that group's room upstairs.
ALTER TABLE cafe_notes    ADD COLUMN IF NOT EXISTS room TEXT NOT NULL DEFAULT 'main';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS room TEXT NOT NULL DEFAULT 'main';
CREATE INDEX IF NOT EXISTS cafe_notes_room_idx ON cafe_notes(room, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_room_idx ON chat_messages(room, created_at DESC);

-- Files the owner uploads: songs for the café radio, the book-of-the-week
-- cover. Kept in Postgres so everything lives in one place on Railway.
CREATE TABLE IF NOT EXISTS media (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,                          -- 'audio' | 'image' | 'photo' (someone's own, for a frame)
  mime        TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL DEFAULT '',
  artist      TEXT NOT NULL DEFAULT '',
  duration    REAL NOT NULL DEFAULT 0,                -- seconds (songs)
  size        INTEGER NOT NULL DEFAULT 0,
  bytes       BYTEA NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- What the kindness check didn't let through (see server/moderation.js), for the owner to look over.
CREATE TABLE IF NOT EXISTS moderation_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  place TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_log_created ON moderation_log (created_at DESC);

-- The loyalty stamp card: a stamp for each drink, ten for a slice of the sakura cake.
CREATE TABLE IF NOT EXISTS loyalty_cards (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stamps INTEGER NOT NULL DEFAULT 0,
  rewards INTEGER NOT NULL DEFAULT 0,
  last_stamp TIMESTAMPTZ
);

-- The roof garden (the third floor, open to everyone): the shared beds,
-- and how much each person has helped in them. See server/garden.js.
CREATE TABLE IF NOT EXISTS garden_beds (
  id         TEXT PRIMARY KEY,
  state      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS garden_helpers (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plants     INTEGER NOT NULL DEFAULT 0,
  waters     INTEGER NOT NULL DEFAULT 0,
  weeds      INTEGER NOT NULL DEFAULT 0,
  harvests   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Living upstairs: everyone's own room along the hallway, the furniture in
-- it, who they've let in, and their study and sleep record. See server/homes.js.
CREATE TABLE IF NOT EXISTS home_rooms (
  owner_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  wall       TEXT NOT NULL DEFAULT '#efe6db',
  floor      TEXT NOT NULL DEFAULT 'oak',
  open       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS home_items (
  id         SERIAL PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  x REAL NOT NULL, y REAL NOT NULL DEFAULT 0, z REAL NOT NULL, ry REAL NOT NULL DEFAULT 0,
  color      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS home_items_owner_idx ON home_items(owner_id);
-- frames: the owner's own photo (a 'photo' row in media) and a line under it
ALTER TABLE home_items ADD COLUMN IF NOT EXISTS image_id INTEGER;
ALTER TABLE home_items ADD COLUMN IF NOT EXISTS caption TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS home_guests (
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, guest_id)
);
CREATE INDEX IF NOT EXISTS home_guests_guest_idx ON home_guests(guest_id);
ALTER TABLE home_rooms ADD COLUMN IF NOT EXISTS wallpaper TEXT NOT NULL DEFAULT 'plain';
-- each flat's own door upstairs (0–13 in the first hallway, 14–27 in the upper one; the same for everyone)
ALTER TABLE home_rooms ADD COLUMN IF NOT EXISTS door INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS home_rooms_door ON home_rooms (door) WHERE door IS NOT NULL;
-- your cat (one each)
CREATE TABLE IF NOT EXISTS home_pets (
  owner_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  coat       TEXT NOT NULL DEFAULT 'ginger',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- pastries kept on the snack shelf (anyone in the room can leave one, or take one)
CREATE TABLE IF NOT EXISTS home_snacks (
  id         SERIAL PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pastry_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS home_snacks_owner_idx ON home_snacks(owner_id);
-- presents: a piece of furniture or a drink, with a note, waiting by the door
CREATE TABLE IF NOT EXISTS home_gifts (
  id          SERIAL PRIMARY KEY,
  from_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  to_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_kind   TEXT,
  color       TEXT,
  drink       JSONB,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS home_gifts_to_idx ON home_gifts(to_id) WHERE opened_at IS NULL;
CREATE INDEX IF NOT EXISTS home_gifts_from_idx ON home_gifts(from_id, created_at);
CREATE TABLE IF NOT EXISTS home_stats (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  sessions      INTEGER NOT NULL DEFAULT 0,
  nights        INTEGER NOT NULL DEFAULT 0,
  last_slept    TIMESTAMPTZ
);

-- The Games Room's high scores: each player's best at each table (server/rooms.js).
CREATE TABLE IF NOT EXISTS arcade_scores (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  score      INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game)
);
-- The library's word count: words each writer logged on a (Cairo) day.
CREATE TABLE IF NOT EXISTS library_words (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  words   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
-- The Post Room's letters: one neighbour to another, waiting in a pigeonhole (server/rooms.js).
CREATE TABLE IF NOT EXISTS letters (
  id         SERIAL PRIMARY KEY,
  from_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS letters_to_idx ON letters(to_id, created_at DESC);
-- Bedroom partners: two people sharing one flat. The flat stays its owner's;
-- the partner can come and go, decorate and sleep there, and both names go on
-- the door. One partner per flat, one shared flat per person (server/homes.js).
CREATE TABLE IF NOT EXISTS home_partners (
  owner_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS home_partner_invites (
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, to_id)
);
-- The fourth floor (server/upstairs.js).
-- The Writer's Room: short stories pinned on the stories board.
CREATE TABLE IF NOT EXISTS writer_stories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The Pottery Studio: the cups people have shaped, glazed and fired.
CREATE TABLE IF NOT EXISTS pottery_cups (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shape      JSONB NOT NULL,
  glaze      TEXT NOT NULL,
  pattern    TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The Greenhouse: a plant grows a stage for every (Cairo) day it's watered.
CREATE TABLE IF NOT EXISTS flower_pots (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flower       TEXT NOT NULL,
  growth       INTEGER NOT NULL DEFAULT 0,
  last_watered DATE,
  planted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The Pet Café: the pets' names (the first person to name one names it), and
-- how fond each pet is of each person.
CREATE TABLE IF NOT EXISTS pet_names (
  pet      TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  named_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  named_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pet_love (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet       TEXT NOT NULL,
  love      INTEGER NOT NULL DEFAULT 0,
  petted_at TIMESTAMPTZ,
  fed_at    TIMESTAMPTZ,
  PRIMARY KEY (user_id, pet)
);
-- The Party Hall: who's booked it, for what, and when.
CREATE TABLE IF NOT EXISTS party_bookings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occasion   TEXT NOT NULL,
  title      TEXT NOT NULL,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS party_bookings_when_idx ON party_bookings(ends_at);
