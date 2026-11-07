-- LAPP accounts. Applied by the deploy workflow: wrangler d1 migrations apply lapp --remote
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,              -- lower case
  username    TEXT NOT NULL UNIQUE,              -- lower case, [a-z0-9_.]{3,20}
  name        TEXT NOT NULL DEFAULT '',
  pw_hash     TEXT NOT NULL,                     -- base64 PBKDF2-SHA256
  salt        TEXT NOT NULL,
  iter        INTEGER NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',      -- user · designer · manager · admin
  verified    INTEGER NOT NULL DEFAULT 0,
  disabled    INTEGER NOT NULL DEFAULT 0,
  plus_until  INTEGER NOT NULL DEFAULT 0,        -- Plus given by hand, until this time (ms)
  country     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,                  -- SHA-256 of the cookie value
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires     INTEGER NOT NULL,
  ua          TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sessions_user ON sessions(user_id);

-- one-time codes: e-mail verification (6 digits) and password reset (long token)
CREATE TABLE codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                     -- verify · reset
  code_hash   TEXT NOT NULL,
  expires     INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  tries       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX codes_user ON codes(user_id, kind);

-- the learner's progress: every lapp:* key of the browser, as one JSON object
CREATE TABLE progress (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL
);

-- Stripe subscriptions, kept in step by the webhook
CREATE TABLE subscriptions (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL DEFAULT '',
  sub_id      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',          -- trialing · active · past_due · canceled …
  interval    TEXT NOT NULL DEFAULT '',          -- month · year
  period_end  INTEGER NOT NULL DEFAULT 0,        -- ms
  cancel_at_end INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX subscriptions_customer ON subscriptions(customer_id);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL
);

-- fixed-window rate limits
CREATE TABLE hits (
  key         TEXT PRIMARY KEY,
  n           INTEGER NOT NULL,
  reset       INTEGER NOT NULL
);
