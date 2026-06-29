-- The team directory: who can use the app and what role they have.
-- Email is the unique identity (it comes from the company login via Cloudflare
-- Access). Role decides what each person sees and can do.

CREATE TABLE IF NOT EXISTS users (
  email      TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL
);
