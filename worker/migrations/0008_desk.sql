-- Each person's work desktop in /manage: windows, icons, widgets, wallpaper, their own shortcuts
CREATE TABLE desks (
  user_id     INTEGER PRIMARY KEY,
  data        TEXT NOT NULL DEFAULT '{}',
  updated_at  INTEGER NOT NULL
);
-- files people put on their desktop (the bytes are in blobs, key "ufile/<id>")
CREATE TABLE user_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT '',
  size        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX user_files_user ON user_files(user_id);
