-- AI providers for the studio, set up in /admin → AI (worker/src/ai.js)
CREATE TABLE ai_providers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,                 -- workers · openai · gemini · anthropic · compatible
  model       TEXT NOT NULL,
  base_url    TEXT NOT NULL DEFAULT '',      -- for compatible ones (e.g. our own server)
  api_key     TEXT NOT NULL DEFAULT '',      -- never sent to the browser
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  used_at     INTEGER NOT NULL DEFAULT 0,
  uses        INTEGER NOT NULL DEFAULT 0
);
-- the built-in one: an open-source model on our own Cloudflare account, no key, the default
INSERT INTO ai_providers (id, name, kind, model, created_at) VALUES (1, 'LAPP AI', 'workers', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 0);
INSERT INTO settings (key, value) VALUES ('ai', '{"default":1,"tasks":{}}') ON CONFLICT(key) DO NOTHING;
