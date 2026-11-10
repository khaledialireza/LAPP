-- a small profile photo (data URL, resized in the browser to 128 px)
ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT '';
