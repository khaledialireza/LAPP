-- the voice desk: every spoken line is kept as a clip (a "take"), so only changed lines are made again;
-- the lesson's own sound files (music, ambience, effects) and the voices a school designs or clones.

-- one clip of one line: made by a voice (tts) or recorded by a person (mic); the sound is in blobs "clip/<lesson>/<key>"
CREATE TABLE IF NOT EXISTS voice_clips (
  lesson_id  INTEGER NOT NULL,
  key        TEXT NOT NULL,                  -- for tts: a hash of voice, speed, pitch, feeling, take and the spoken text
  line_id    TEXT NOT NULL,
  src        TEXT NOT NULL DEFAULT 'tts',    -- tts · mic
  type       TEXT NOT NULL DEFAULT 'audio/mpeg',
  params     TEXT NOT NULL DEFAULT '{}',
  dur        REAL NOT NULL DEFAULT 0,
  size       INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (lesson_id, key)
);
CREATE INDEX IF NOT EXISTS voice_clips_line ON voice_clips(lesson_id, line_id);

-- music, ambience and effects used on the lesson's extra tracks; the sound is in blobs "media/<lesson>/<id>"
CREATE TABLE IF NOT EXISTS lesson_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id  INTEGER NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  created_by INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lesson_media_lesson ON lesson_media(lesson_id);

-- voices of a library (org 0 = LAPP): designed from a description (a base voice + settings) or cloned from a
-- recording with the speaker's written consent; a clone's recording is in blobs "voice/<id>"
CREATE TABLE IF NOT EXISTS studio_voices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id       INTEGER NOT NULL DEFAULT 0,
  kind         TEXT NOT NULL,                -- design · clone
  name         TEXT NOT NULL,
  gender       TEXT NOT NULL DEFAULT 'f',
  course       TEXT NOT NULL DEFAULT 'de',
  description  TEXT NOT NULL DEFAULT '',
  settings     TEXT NOT NULL DEFAULT '{}',   -- design: { base, speed, pitch, feel, exaggeration }
  consent_name TEXT NOT NULL DEFAULT '',
  consent_text TEXT NOT NULL DEFAULT '',
  consent_at   INTEGER,
  ref_size     INTEGER NOT NULL DEFAULT 0,
  created_by   INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_voices_org ON studio_voices(org_id);

-- a voice job either makes some lines (new takes) or mixes the whole lesson
ALTER TABLE studio_jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'mix';
ALTER TABLE studio_jobs ADD COLUMN lines TEXT NOT NULL DEFAULT '[]';
-- the timings the runner measured, kept until the audio arrives
ALTER TABLE studio_jobs ADD COLUMN result TEXT NOT NULL DEFAULT '{}';
-- the clips the last mix used, line id → key (to show which lines changed since)
ALTER TABLE lessons ADD COLUMN mix TEXT NOT NULL DEFAULT '{}';
-- when every word is heard (per line: [[start, end], …]), for subtitles with word timing
ALTER TABLE lessons ADD COLUMN words TEXT NOT NULL DEFAULT '[]';
