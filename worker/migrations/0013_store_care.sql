-- The app store and the Customer Center.
-- A "root" is one independent space: "lapp" (the platform owner's own space) or "org:<id>" (an organisation).

-- which apps a root installed, and who in it may use each one
CREATE TABLE IF NOT EXISTS installs (
  root       TEXT NOT NULL,
  app        TEXT NOT NULL,
  who        TEXT NOT NULL DEFAULT '{"all":1}',   -- {"all":1} · {"roles":["teacher"]} · {"me":1}
  by_user    INTEGER,
  at         INTEGER NOT NULL,
  PRIMARY KEY (root, app)
);
-- a root that never opened the store keeps its first apps; this row marks that it chose for itself
CREATE TABLE IF NOT EXISTS install_roots (root TEXT PRIMARY KEY, at INTEGER NOT NULL);

-- every account and organisation has a public 10-character ID: the only thing support sees before consent
ALTER TABLE users ADD COLUMN pub_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_pub ON users(pub_id);
ALTER TABLE orgs ADD COLUMN pub_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orgs_pub ON orgs(pub_id);

-- support asks a root for access; the root answers; access ends by itself
CREATE TABLE IF NOT EXISTS care_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,                       -- user · org
  target     INTEGER NOT NULL,                    -- users.id or orgs.id
  reason     TEXT NOT NULL DEFAULT '',
  via        TEXT NOT NULL DEFAULT 'app,email',
  status     TEXT NOT NULL DEFAULT 'waiting',     -- waiting · approved · declined · ended · cancelled
  token_hash TEXT,                                -- the link in the e-mail
  by_user    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  answered_at INTEGER,
  expires    INTEGER
);
CREATE INDEX IF NOT EXISTS care_requests_target ON care_requests(kind, target);

-- what happened to an account (no content): sign-ins, wrong passwords, password changes, support actions
CREATE TABLE IF NOT EXISTS account_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL,                       -- signin · wrongpw · password · support · suspended · lifted
  country    TEXT NOT NULL DEFAULT '',
  device     TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_log_user ON account_log(user_id, at);
CREATE INDEX IF NOT EXISTS account_log_kind ON account_log(kind, at);

-- rules on behaviour, and the accounts that broke them
CREATE TABLE IF NOT EXISTS care_rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  signal     TEXT NOT NULL,                       -- wrongpw · countries · signins · devices
  amount     INTEGER NOT NULL,
  minutes    INTEGER NOT NULL,
  action     TEXT NOT NULL DEFAULT 'show',        -- show · signout · suspend
  on_        INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS care_flags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  done       TEXT NOT NULL DEFAULT '',            -- what the rule did
  status     TEXT NOT NULL DEFAULT 'open',        -- open · closed
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS care_flags_status ON care_flags(status, at);
INSERT INTO care_rules (name, signal, amount, minutes, action, on_, created_at) VALUES
  ('Sign-ins from two countries within an hour', 'countries', 2, 60, 'show', 1, 0),
  ('20 wrong passwords in 10 minutes', 'wrongpw', 20, 10, 'show', 1, 0);
