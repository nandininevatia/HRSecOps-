// ---------------------------------------------------------------------------
// Database access. Every function that reads or writes joiners lives here, so
// the rest of the app never has to know the database details.
// ---------------------------------------------------------------------------

import { LAST_STAGE, type Joiner, type JoinerType, type Role } from "./data";

export type User = { email: string; name: string; role: Role; createdAt: string };

type UserRow = { email: string; name: string; role: string; created_at: string };

function rowToUser(r: UserRow): User {
  return { email: r.email, name: r.name, role: r.role as Role, createdAt: r.created_at };
}

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listUsers(db: D1Database): Promise<User[]> {
  const { results } = await db.prepare("SELECT * FROM users ORDER BY name, email").all<UserRow>();
  return (results ?? []).map(rowToUser);
}

export async function getUser(db: D1Database, email: string): Promise<User | null> {
  const row = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function upsertUser(
  db: D1Database,
  user: { email: string; name: string; role: Role },
): Promise<void> {
  const createdAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO users (email, name, role, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, role = excluded.role`,
    )
    .bind(user.email, user.name, user.role, createdAt)
    .run();
}

export async function deleteUser(db: D1Database, email: string): Promise<void> {
  await db.prepare("DELETE FROM users WHERE email = ?").bind(email).run();
}

// Make sure the joiners table exists. This runs the same "CREATE TABLE" as the
// migration file, but automatically, so a freshly created database just works
// without any manual migration step. It is safe to run repeatedly (IF NOT
// EXISTS) and we only actually run it once per running copy of the app.
let schemaReady = false;
export async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS joiners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      joiner_type TEXT NOT NULL DEFAULT 'non_immediate',
      joining_date TEXT NOT NULL,
      stage_index INTEGER NOT NULL DEFAULT 0,
      blocked TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_joiners_joining_date ON joiners (joining_date)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL
    )`),
  ]);
  schemaReady = true;
}

// What one row looks like coming back from the database (snake_case columns).
type Row = {
  id: string;
  name: string;
  role: string;
  department: string;
  joiner_type: string;
  joining_date: string;
  stage_index: number;
  blocked: string | null;
  created_at: string;
};

function rowToJoiner(r: Row): Joiner {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    department: r.department,
    joinerType: (r.joiner_type === "immediate" ? "immediate" : "non_immediate") as JoinerType,
    joiningDate: r.joining_date,
    stageIndex: r.stage_index,
    blocked: r.blocked,
    createdAt: r.created_at,
  };
}

export async function listJoiners(db: D1Database): Promise<Joiner[]> {
  const { results } = await db
    .prepare("SELECT * FROM joiners ORDER BY joining_date ASC")
    .all<Row>();
  return (results ?? []).map(rowToJoiner);
}

export async function getJoiner(db: D1Database, id: string): Promise<Joiner | null> {
  const row = await db.prepare("SELECT * FROM joiners WHERE id = ?").bind(id).first<Row>();
  return row ? rowToJoiner(row) : null;
}

export type NewJoiner = {
  name: string;
  role: string;
  department: string;
  joinerType: JoinerType;
  joiningDate: string;
};

export async function createJoiner(db: D1Database, input: NewJoiner): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO joiners (id, name, role, department, joiner_type, joining_date, stage_index, blocked, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
    )
    .bind(id, input.name, input.role, input.department, input.joinerType, input.joiningDate, createdAt)
    .run();
  return id;
}

export async function moveStage(db: D1Database, id: string, direction: 1 | -1): Promise<void> {
  const j = await getJoiner(db, id);
  if (!j) return;
  const next = Math.max(0, Math.min(LAST_STAGE, j.stageIndex + direction));
  await db.prepare("UPDATE joiners SET stage_index = ? WHERE id = ?").bind(next, id).run();
}

export async function setBlocked(db: D1Database, id: string, reason: string | null): Promise<void> {
  const clean = reason && reason.trim() ? reason.trim() : null;
  await db.prepare("UPDATE joiners SET blocked = ? WHERE id = ?").bind(clean, id).run();
}

export async function deleteJoiner(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM joiners WHERE id = ?").bind(id).run();
}
