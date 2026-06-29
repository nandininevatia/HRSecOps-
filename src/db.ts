// ---------------------------------------------------------------------------
// Database access. Every function that reads or writes joiners lives here, so
// the rest of the app never has to know the database details.
// ---------------------------------------------------------------------------

import { LAST_STAGE, type Joiner, type JoinerType } from "./data";

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
