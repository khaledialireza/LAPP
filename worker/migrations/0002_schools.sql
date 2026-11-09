-- Schools (organizations): their people, classes, timetable, material, homework and fees.
-- A person has one LAPP account; their role is per school (teacher in one, student in another).
CREATE TABLE orgs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,               -- lapp.khaledi.eu/s/<slug>
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#8B5CF6',
  currency    TEXT NOT NULL DEFAULT 'EUR',
  disabled    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE org_members (
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,                      -- admin · teacher · finance · student
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX org_members_user ON org_members(user_id);

CREATE TABLE classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  course      TEXT NOT NULL DEFAULT 'de',         -- de · nl · pl
  level       TEXT NOT NULL DEFAULT 'A1',
  teacher_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  place       TEXT NOT NULL DEFAULT 'Online',
  starts_on   TEXT NOT NULL DEFAULT '',
  ends_on     TEXT NOT NULL DEFAULT '',
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX classes_org ON classes(org_id);

CREATE TABLE class_students (
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX class_students_user ON class_students(user_id);

-- one lesson in the timetable
CREATE TABLE class_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  starts_at   INTEGER NOT NULL,                   -- ms
  ends_at     INTEGER NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'planned'     -- planned · live · done · cancelled
);
CREATE INDEX class_events_class ON class_events(class_id, starts_at);

CREATE TABLE attendance (
  event_id    INTEGER NOT NULL REFERENCES class_events(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  present     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (event_id, user_id)
);

-- small files kept in the database (PDF, images, audio up to 2 MB)
CREATE TABLE files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  data        BLOB NOT NULL,
  created_by  INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE TABLE materials (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                      -- text · link · file · lesson (LAPP library)
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  file_id     INTEGER REFERENCES files(id) ON DELETE SET NULL,
  shared      INTEGER NOT NULL DEFAULT 1,         -- visible to students
  created_by  INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX materials_class ON materials(class_id);

CREATE TABLE assignments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL,                      -- quiz (auto-graded) · write · speak
  instructions TEXT NOT NULL DEFAULT '',
  items       TEXT NOT NULL DEFAULT '[]',         -- quiz: [{q, options[], answer}] · gap: [{q, answer}]
  due_at      INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX assignments_class ON assignments(class_id);

CREATE TABLE submissions (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers     TEXT NOT NULL DEFAULT '{}',
  score       INTEGER,                            -- percent; null = waiting for the teacher
  feedback    TEXT NOT NULL DEFAULT '',
  file_id     INTEGER REFERENCES files(id) ON DELETE SET NULL,
  submitted_at INTEGER NOT NULL,
  PRIMARY KEY (assignment_id, user_id)
);

-- money: a fee (course price) split into installments
CREATE TABLE fees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id      INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id    INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  total       INTEGER NOT NULL,                   -- cents
  note        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX fees_org ON fees(org_id, student_id);

CREATE TABLE installments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fee_id      INTEGER NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  due_on      TEXT NOT NULL,                      -- YYYY-MM-DD
  amount      INTEGER NOT NULL,                   -- cents
  paid        INTEGER NOT NULL DEFAULT 0,
  paid_on     TEXT NOT NULL DEFAULT '',
  method      TEXT NOT NULL DEFAULT '',           -- cash · bank · card · voucher
  reminded_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX installments_fee ON installments(fee_id);
