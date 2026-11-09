-- Accounts a school creates by hand: a username and a password from the school, no e-mail.
-- Their users.email holds "@<username>" (never a real address, so nothing is ever mailed to it)
-- and managed_by names the school that may reset their password.
ALTER TABLE users ADD COLUMN managed_by INTEGER NOT NULL DEFAULT 0;
