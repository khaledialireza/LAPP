-- Studio: lessons made in the site (by LAPP staff for everyone, or by a school for its own students)

CREATE TABLE lessons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id       INTEGER NOT NULL DEFAULT 0,      -- 0 = LAPP library, else the school that owns it
  created_by   INTEGER NOT NULL,
  course       TEXT NOT NULL,                   -- de · nl · pl
  type         TEXT NOT NULL,                   -- talk · lesson · story
  level        TEXT NOT NULL,                   -- A1 … C2
  topic        TEXT NOT NULL DEFAULT '',        -- daily · travel · food · health · work · story · other
  series       TEXT NOT NULL DEFAULT '',        -- lessons planned together share a series name
  title        TEXT NOT NULL,
  brief        TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft',   -- draft · review · published
  access       TEXT NOT NULL DEFAULT 'free',    -- free · plus (LAPP library only)
  data         TEXT NOT NULL DEFAULT '{}',      -- the script: cast, scenes (lines), phrases, tr
  rev          INTEGER NOT NULL DEFAULT 1,      -- goes up on every save
  audio_rev    INTEGER NOT NULL DEFAULT 0,      -- the rev the audio was made from (0 = no audio)
  audio_size   INTEGER NOT NULL DEFAULT 0,
  timings      TEXT NOT NULL DEFAULT '[]',
  published    TEXT NOT NULL DEFAULT '',        -- what learners get: lesson + translations, frozen at publishing
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  published_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX lessons_org ON lessons(org_id, status);

-- audio in pieces (a D1 value holds up to 2 MB); key = "lesson/<id>/<rev>"
CREATE TABLE blobs (
  key   TEXT NOT NULL,
  part  INTEGER NOT NULL,
  data  BLOB NOT NULL,
  PRIMARY KEY (key, part)
);

-- heavy work done elsewhere (the voice runs in GitHub Actions); the token is shown once
CREATE TABLE studio_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id   INTEGER NOT NULL,
  kind        TEXT NOT NULL,                    -- voice
  status      TEXT NOT NULL DEFAULT 'queued',   -- queued · running · done · failed
  token_hash  TEXT NOT NULL,
  rev         INTEGER NOT NULL,                 -- the script rev being voiced
  log         TEXT NOT NULL DEFAULT '',
  created_by  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX studio_jobs_lesson ON studio_jobs(lesson_id, id);

-- the LAPP universe: characters that come back in many lessons, each with a fixed voice
CREATE TABLE characters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL DEFAULT 0,
  name        TEXT NOT NULL,
  age         INTEGER NOT NULL DEFAULT 0,
  bio         TEXT NOT NULL DEFAULT '',
  traits      TEXT NOT NULL DEFAULT '[]',
  emoji       TEXT NOT NULL DEFAULT '🙂',
  color       TEXT NOT NULL DEFAULT '#8B5CF6',
  gender      TEXT NOT NULL DEFAULT 'f',        -- f · m (picks the voice pool)
  voices      TEXT NOT NULL DEFAULT '{}',       -- per course: { "de": "piper:eva_k-x_low" }
  created_at  INTEGER NOT NULL
);
CREATE INDEX characters_org ON characters(org_id);

-- what learners do in a lesson, for the studio's insights (no text, no audio)
CREATE TABLE lesson_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson   INTEGER NOT NULL,                    -- the lesson id the app uses
  kind     TEXT NOT NULL,                       -- open · say (value = score 0–1) · reach (line reached)
  line     INTEGER NOT NULL DEFAULT -1,
  value    REAL NOT NULL DEFAULT 0,
  user_id  INTEGER NOT NULL DEFAULT 0,
  at       INTEGER NOT NULL
);
CREATE INDEX lesson_events_l ON lesson_events(lesson, kind, at);
