-- the person's own language: every page (app, studio, admin, school) shows in it
ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT '';
