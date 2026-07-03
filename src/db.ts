// ---------------------------------------------------------------------------
// Database access (Cloudflare D1). Schema is auto-created on first use so a
// fresh database works with no manual migration step.
// ---------------------------------------------------------------------------

import {
  TASK_TEMPLATE,
  taskTargetDate,
  type Candidate,
  type Task,
  type Role,
  type EmploymentType,
  type CaseType,
  type Status,
  type NotifEvent,
} from "./data";

// ---- Schema ---------------------------------------------------------------
let schemaReady = false;
export async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '', personal_email TEXT DEFAULT '',
      department TEXT DEFAULT '', designation TEXT DEFAULT '', cost_center TEXT DEFAULT '',
      employment_type TEXT DEFAULT 'permanent', reporting_manager TEXT DEFAULT '',
      asset_required INTEGER DEFAULT 0, case_type TEXT DEFAULT 'immediate',
      dop TEXT, doj TEXT, funnel_stage INTEGER DEFAULT 0, status TEXT DEFAULT 'in_progress',
      backout_stage TEXT, backout_reason TEXT, backout_at TEXT,
      offered_at TEXT, onboarded_at TEXT, offboarded_at TEXT,
      created_at TEXT NOT NULL, created_by TEXT DEFAULT '')`),
    db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, key TEXT, label TEXT, team TEXT, phase TEXT,
      target_date TEXT, automated TEXT, done INTEGER DEFAULT 0, done_at TEXT, done_by TEXT,
      blocked TEXT, sort INTEGER DEFAULT 0)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_candidate ON tasks (candidate_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY, name TEXT DEFAULT '', role TEXT DEFAULT 'viewer', created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, at TEXT NOT NULL, actor TEXT, action TEXT, entity TEXT, entity_id TEXT, detail TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY, at TEXT NOT NULL, event TEXT, channel TEXT, recipients TEXT,
      subject TEXT, body TEXT, status TEXT DEFAULT 'logged')`),
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS report_schedules (
      id TEXT PRIMARY KEY, name TEXT, kind TEXT, cadence TEXT, hour INTEGER DEFAULT 9,
      recipients TEXT, enabled INTEGER DEFAULT 1, last_run_at TEXT)`),
  ]);
  schemaReady = true;
}

// ---- Row mappers ----------------------------------------------------------
function rowToCandidate(r: any): Candidate {
  return {
    id: r.id, name: r.name, phone: r.phone ?? "", personalEmail: r.personal_email ?? "",
    department: r.department ?? "", designation: r.designation ?? "", costCenter: r.cost_center ?? "",
    employmentType: (r.employment_type ?? "permanent") as EmploymentType,
    reportingManager: r.reporting_manager ?? "", assetRequired: !!r.asset_required,
    caseType: (r.case_type ?? "immediate") as CaseType, dop: r.dop, doj: r.doj,
    funnelStage: r.funnel_stage ?? 0, status: (r.status ?? "in_progress") as Status,
    backoutStage: r.backout_stage, backoutReason: r.backout_reason, backoutAt: r.backout_at,
    offeredAt: r.offered_at, onboardedAt: r.onboarded_at, offboardedAt: r.offboarded_at,
    createdAt: r.created_at, createdBy: r.created_by ?? "",
  };
}
function rowToTask(r: any): Task {
  return {
    id: r.id, candidateId: r.candidate_id, key: r.key, label: r.label, team: r.team, phase: r.phase,
    targetDate: r.target_date, automated: r.automated, done: !!r.done, doneAt: r.done_at,
    doneBy: r.done_by, blocked: r.blocked, sort: r.sort ?? 0,
  };
}

// ---- Candidates -----------------------------------------------------------
export type NewCandidate = {
  name: string; phone: string; personalEmail: string; department: string; designation: string;
  costCenter: string; employmentType: EmploymentType; reportingManager: string; assetRequired: boolean;
  caseType: CaseType; dop: string | null; doj: string | null;
};

export async function createCandidate(db: D1Database, input: NewCandidate, actor: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO candidates (id,name,phone,personal_email,department,designation,cost_center,
      employment_type,reporting_manager,asset_required,case_type,dop,doj,funnel_stage,status,
      offered_at,created_at,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,'in_progress',?,?,?)`,
  ).bind(
    id, input.name, input.phone, input.personalEmail, input.department, input.designation,
    input.costCenter, input.employmentType, input.reportingManager, input.assetRequired ? 1 : 0,
    input.caseType, input.dop, input.doj, now.slice(0, 10), now, actor,
  ).run();

  // Generate the task checklist from the template.
  const anchorCtx = { doj: input.doj, dop: input.dop, offeredAt: now.slice(0, 10) };
  const stmts = TASK_TEMPLATE.map((def, i) =>
    db.prepare(
      `INSERT INTO tasks (id,candidate_id,key,label,team,phase,target_date,automated,done,sort)
       VALUES (?,?,?,?,?,?,?,?,0,?)`,
    ).bind(
      crypto.randomUUID(), id, def.key, def.label, def.team, def.phase,
      taskTargetDate(def, anchorCtx), def.automated ?? null, i,
    ),
  );
  await db.batch(stmts);
  return id;
}

export async function listCandidates(db: D1Database): Promise<Candidate[]> {
  const { results } = await db.prepare(
    `SELECT * FROM candidates ORDER BY COALESCE(doj,dop,created_at) ASC`,
  ).all();
  return (results ?? []).map(rowToCandidate);
}

export async function getCandidate(db: D1Database, id: string): Promise<Candidate | null> {
  const r = await db.prepare(`SELECT * FROM candidates WHERE id=?`).bind(id).first();
  return r ? rowToCandidate(r) : null;
}

export async function listTasks(db: D1Database, candidateId: string): Promise<Task[]> {
  const { results } = await db.prepare(
    `SELECT * FROM tasks WHERE candidate_id=? ORDER BY sort ASC`,
  ).bind(candidateId).all();
  return (results ?? []).map(rowToTask);
}

export async function getTask(db: D1Database, id: string): Promise<Task | null> {
  const r = await db.prepare(`SELECT * FROM tasks WHERE id=?`).bind(id).first();
  return r ? rowToTask(r) : null;
}

export async function setTaskDone(db: D1Database, id: string, done: boolean, actor: string): Promise<void> {
  await db.prepare(`UPDATE tasks SET done=?, done_at=?, done_by=? WHERE id=?`)
    .bind(done ? 1 : 0, done ? new Date().toISOString() : null, done ? actor : null, id).run();
}

export async function setTaskBlocked(db: D1Database, id: string, reason: string | null): Promise<void> {
  const clean = reason && reason.trim() ? reason.trim() : null;
  await db.prepare(`UPDATE tasks SET blocked=? WHERE id=?`).bind(clean, id).run();
}

export async function moveStage(db: D1Database, id: string, dir: 1 | -1, lastStage: number): Promise<Candidate | null> {
  const c = await getCandidate(db, id);
  if (!c) return null;
  const next = Math.max(0, Math.min(lastStage, c.funnelStage + dir));
  const onboardedAt = next >= lastStage ? (c.onboardedAt ?? new Date().toISOString()) : c.onboardedAt;
  const status: Status = next >= lastStage ? "onboarded" : c.status === "onboarded" ? "in_progress" : c.status;
  await db.prepare(`UPDATE candidates SET funnel_stage=?, status=?, onboarded_at=? WHERE id=?`)
    .bind(next, status, onboardedAt, id).run();
  return getCandidate(db, id);
}

export async function setBackedOut(db: D1Database, id: string, stageLabel: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE candidates SET status='backed_out', backout_stage=?, backout_reason=?, backout_at=? WHERE id=?`,
  ).bind(stageLabel, reason, now, id).run();
}

export async function setOffboarded(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE candidates SET status='offboarded', offboarded_at=? WHERE id=?`)
    .bind(new Date().toISOString(), id).run();
}

export async function deleteCandidate(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM tasks WHERE candidate_id=?`).bind(id),
    db.prepare(`DELETE FROM candidates WHERE id=?`).bind(id),
  ]);
}

// ---- Users ----------------------------------------------------------------
export type User = { email: string; name: string; role: Role; createdAt: string };
const rowToUser = (r: any): User => ({ email: r.email, name: r.name ?? "", role: (r.role ?? "viewer") as Role, createdAt: r.created_at });

export async function countUsers(db: D1Database): Promise<number> {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>();
  return r?.n ?? 0;
}
export async function listUsers(db: D1Database): Promise<User[]> {
  const { results } = await db.prepare(`SELECT * FROM users ORDER BY name,email`).all();
  return (results ?? []).map(rowToUser);
}
export async function getUser(db: D1Database, email: string): Promise<User | null> {
  const r = await db.prepare(`SELECT * FROM users WHERE email=?`).bind(email).first();
  return r ? rowToUser(r) : null;
}
export async function usersByRoles(db: D1Database, roles: Role[]): Promise<User[]> {
  if (!roles.length) return [];
  const ph = roles.map(() => "?").join(",");
  const { results } = await db.prepare(`SELECT * FROM users WHERE role IN (${ph})`).bind(...roles).all();
  return (results ?? []).map(rowToUser);
}
export async function upsertUser(db: D1Database, u: { email: string; name: string; role: Role }): Promise<void> {
  await db.prepare(
    `INSERT INTO users (email,name,role,created_at) VALUES (?,?,?,?)
     ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role`,
  ).bind(u.email, u.name, u.role, new Date().toISOString()).run();
}
export async function deleteUser(db: D1Database, email: string): Promise<void> {
  await db.prepare(`DELETE FROM users WHERE email=?`).bind(email).run();
}

// ---- Audit ----------------------------------------------------------------
export async function audit(db: D1Database, actor: string, action: string, entity: string, entityId: string, detail = ""): Promise<void> {
  await db.prepare(`INSERT INTO audit_log (id,at,actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), new Date().toISOString(), actor, action, entity, entityId, detail).run();
}
export async function listAudit(db: D1Database, limit = 200): Promise<any[]> {
  const { results } = await db.prepare(`SELECT * FROM audit_log ORDER BY at DESC LIMIT ?`).bind(limit).all();
  return results ?? [];
}

// ---- Outbox (notifications log) -------------------------------------------
export async function logNotification(db: D1Database, n: { event: string; channel: string; recipients: string; subject: string; body: string; status?: string }): Promise<void> {
  await db.prepare(`INSERT INTO outbox (id,at,event,channel,recipients,subject,body,status) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), new Date().toISOString(), n.event, n.channel, n.recipients, n.subject, n.body, n.status ?? "logged").run();
}
export async function listOutbox(db: D1Database, limit = 200): Promise<any[]> {
  const { results } = await db.prepare(`SELECT * FROM outbox ORDER BY at DESC LIMIT ?`).bind(limit).all();
  return results ?? [];
}

// ---- Settings (JSON key/value: notification matrix, integrations) ----------
export async function getSetting<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const r = await db.prepare(`SELECT value FROM settings WHERE key=?`).bind(key).first<{ value: string }>();
  if (!r?.value) return fallback;
  try { return JSON.parse(r.value) as T; } catch { return fallback; }
}
export async function setSetting(db: D1Database, key: string, value: unknown): Promise<void> {
  await db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .bind(key, JSON.stringify(value)).run();
}

// ---- Report schedules -----------------------------------------------------
export async function listSchedules(db: D1Database): Promise<any[]> {
  const { results } = await db.prepare(`SELECT * FROM report_schedules ORDER BY name`).all();
  return results ?? [];
}
export async function upsertSchedule(db: D1Database, s: { id?: string; name: string; kind: string; cadence: string; hour: number; recipients: string; enabled: boolean }): Promise<void> {
  const id = s.id || crypto.randomUUID();
  await db.prepare(
    `INSERT INTO report_schedules (id,name,kind,cadence,hour,recipients,enabled) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,cadence=excluded.cadence,hour=excluded.hour,recipients=excluded.recipients,enabled=excluded.enabled`,
  ).bind(id, s.name, s.kind, s.cadence, s.hour, s.recipients, s.enabled ? 1 : 0).run();
}
export async function markScheduleRun(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE report_schedules SET last_run_at=? WHERE id=?`).bind(new Date().toISOString(), id).run();
}
export async function deleteSchedule(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM report_schedules WHERE id=?`).bind(id).run();
}
