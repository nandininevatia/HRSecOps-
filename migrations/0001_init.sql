-- Full schema for the GoComet Onboarding & Facilitators Platform.
-- The app also auto-creates these tables on first run (see src/db.ts
-- ensureSchema), so applying migrations manually is optional.

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '', personal_email TEXT DEFAULT '',
  department TEXT DEFAULT '', designation TEXT DEFAULT '', cost_center TEXT DEFAULT '',
  employment_type TEXT DEFAULT 'permanent', reporting_manager TEXT DEFAULT '',
  asset_required INTEGER DEFAULT 0, case_type TEXT DEFAULT 'immediate',
  dop TEXT, doj TEXT, funnel_stage INTEGER DEFAULT 0, status TEXT DEFAULT 'in_progress',
  backout_stage TEXT, backout_reason TEXT, backout_at TEXT,
  offered_at TEXT, onboarded_at TEXT, offboarded_at TEXT,
  created_at TEXT NOT NULL, created_by TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, key TEXT, label TEXT, team TEXT, phase TEXT,
  target_date TEXT, automated TEXT, done INTEGER DEFAULT 0, done_at TEXT, done_by TEXT,
  blocked TEXT, sort INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tasks_candidate ON tasks (candidate_id);

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY, name TEXT DEFAULT '', role TEXT DEFAULT 'viewer', created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, at TEXT NOT NULL, actor TEXT, action TEXT, entity TEXT, entity_id TEXT, detail TEXT
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY, at TEXT NOT NULL, event TEXT, channel TEXT, recipients TEXT,
  subject TEXT, body TEXT, status TEXT DEFAULT 'logged'
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS report_schedules (
  id TEXT PRIMARY KEY, name TEXT, kind TEXT, cadence TEXT, hour INTEGER DEFAULT 9,
  recipients TEXT, enabled INTEGER DEFAULT 1, last_run_at TEXT
);
