-- Content as a drive: folders with rules, lessons inside them, a bin for 30 days.
CREATE TABLE folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL DEFAULT 0,      -- 0 = LAPP library, else the school
  parent_id   INTEGER NOT NULL DEFAULT 0,      -- 0 = the top
  name        TEXT NOT NULL,
  rules       TEXT NOT NULL DEFAULT '{}',      -- {access: "plus"|"", level: "A1"…|"", approved: bool}
  created_by  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX folders_org ON folders(org_id, parent_id);

ALTER TABLE lessons ADD COLUMN folder_id INTEGER NOT NULL DEFAULT 0;
-- the lesson's own choice ('' = as its folder); lessons.access stays the effective value learners get
ALTER TABLE lessons ADD COLUMN access_own TEXT NOT NULL DEFAULT '';
-- in the bin since (0 = not in the bin)
ALTER TABLE lessons ADD COLUMN binned_at INTEGER NOT NULL DEFAULT 0;
UPDATE lessons SET access_own = 'plus' WHERE access = 'plus';
