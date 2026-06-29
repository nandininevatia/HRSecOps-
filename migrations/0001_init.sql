-- Onboarding Tracker - initial database structure.
-- A "joiner" is one new employee being onboarded. Each row is one person.

CREATE TABLE IF NOT EXISTS joiners (
  id            TEXT PRIMARY KEY,          -- unique id, generated automatically
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT '',
  department    TEXT NOT NULL DEFAULT '',
  joiner_type   TEXT NOT NULL DEFAULT 'non_immediate', -- 'immediate' or 'non_immediate'
  joining_date  TEXT NOT NULL,             -- YYYY-MM-DD
  stage_index   INTEGER NOT NULL DEFAULT 0,-- which onboarding step they are on
  blocked       TEXT,                      -- if set, explains why they are stuck
  created_at    TEXT NOT NULL              -- when this record was created
);

-- Helps the dashboard list people by joining date quickly.
CREATE INDEX IF NOT EXISTS idx_joiners_joining_date ON joiners (joining_date);
