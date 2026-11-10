-- Files app: a person's own folders; a file lives in one folder (0 = top) and can be starred
CREATE TABLE IF NOT EXISTS user_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  parent INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS user_folders_user ON user_folders(user_id);
ALTER TABLE user_files ADD COLUMN folder INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_files ADD COLUMN star INTEGER NOT NULL DEFAULT 0;
