-- the history of a lesson: earlier versions of its script, so every change (also the assistant's) can be undone
CREATE TABLE IF NOT EXISTS lesson_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  by_user INTEGER,
  by_ai INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lesson_versions_lesson ON lesson_versions(lesson_id, id);
