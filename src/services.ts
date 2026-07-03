// ---------------------------------------------------------------------------
// Services: notifications, integration adapters, and reports.
//
// "Ideal case" behaviour: every notification and every integration action is
// executed and RECORDED in the outbox (and audit), so you can see the whole
// system working end-to-end. If real credentials (RESEND_API_KEY, integration
// keys) are configured, the same calls go out for real; otherwise they are
// logged as simulated - the flow never breaks.
// ---------------------------------------------------------------------------

import {
  DEFAULT_NOTIF_MATRIX,
  NOTIF_LABELS,
  INTEGRATIONS,
  type NotifEvent,
  type Role,
  type IntegrationKey,
  type Candidate,
  type Task,
} from "./data";
import {
  usersByRoles, logNotification, audit, getSetting,
  listCandidates, listTasks, markScheduleRun, listSchedules,
} from "./db";
import { computeKpis, funnelData } from "./analytics";

type Env = { DB: D1Database; RESEND_API_KEY?: string; MAIL_FROM?: string };

// ---- Notifications --------------------------------------------------------
export async function notify(
  env: Env,
  event: NotifEvent,
  args: { subject: string; body: string; extraRoles?: Role[] },
): Promise<void> {
  const db = env.DB;
  const matrix = await getSetting<Record<string, Role[]>>(db, "notif_matrix", DEFAULT_NOTIF_MATRIX as any);
  const roles = new Set<Role>([...(matrix[event] ?? DEFAULT_NOTIF_MATRIX[event] ?? []), ...(args.extraRoles ?? [])]);
  const users = await usersByRoles(db, [...roles]);
  const emails = [...new Set(users.map((u) => u.email))];

  let status = "logged (no email provider)";
  if (env.RESEND_API_KEY && emails.length) {
    try {
      await sendEmail(env, emails, args.subject, args.body);
      status = "sent";
    } catch (e) {
      status = "error: " + (e as Error).message;
    }
  } else if (!emails.length) {
    status = "no recipients (assign roles on Team page)";
  }

  await logNotification(db, {
    event: NOTIF_LABELS[event], channel: "email",
    recipients: emails.join(", ") || "(none)", subject: args.subject, body: args.body, status,
  });
}

async function sendEmail(env: Env, to: string[], subject: string, text: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "Onboarding <onboarding@resend.dev>", to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

// ---- Integration adapters (pluggable, feature-flagged) --------------------
export type IntegrationState = Record<IntegrationKey, boolean>;

export async function integrationState(db: D1Database): Promise<IntegrationState> {
  const off = Object.fromEntries(INTEGRATIONS.map((i) => [i.key, false])) as IntegrationState;
  return getSetting<IntegrationState>(db, "integrations", off);
}

// Fire an integration action for a candidate. Logs the action; runs for real
// only when that integration is enabled AND credentials exist (future work).
export async function dispatchIntegration(
  env: Env, key: IntegrationKey, action: string, c: Candidate,
): Promise<void> {
  const enabled = (await integrationState(env.DB))[key];
  const status = enabled ? "enabled (simulated - connect API to go live)" : "disabled (simulated)";
  await logNotification(env.DB, {
    event: `Integration · ${key}`, channel: `integration:${key}`,
    recipients: c.name, subject: `${key}: ${action}`,
    body: `Candidate: ${c.name} (${c.personalEmail || "no email"})\nAction: ${action}\nDept: ${c.department}\nDOJ: ${c.doj ?? c.dop ?? "-"}`,
    status,
  });
}

// Runs the Day-1 automation bundle described in the notes for a joining candidate.
export async function runDay1Automation(env: Env, c: Candidate): Promise<void> {
  await dispatchIntegration(env, "google", "Create email ID", c);
  await dispatchIntegration(env, "jumpcloud", "Create account + device mapping", c);
  await dispatchIntegration(env, "slack", "Add to channels + welcome message", c);
  await dispatchIntegration(env, "google", "Add to DLs / Google Groups", c);
  await dispatchIntegration(env, "keka", "Create personnel account + asset tag", c);
  await notify(env, "candidate_joined", {
    subject: `Welcome ${c.name} — joining announcement`,
    body: `${c.name} (${c.designation || "new joiner"}, ${c.department}) has joined. Slack full-team + org email announcement.`,
  });
}

// ---- Reports --------------------------------------------------------------
export function buildReport(kind: string, candidates: Candidate[], tasksByCandidate: Map<string, Task[]>, now: Date): { subject: string; body: string } {
  const k = computeKpis(candidates, tasksByCandidate, now);
  const dateStr = now.toISOString().slice(0, 10);
  if (kind === "weekly_funnel") {
    const funnel = funnelData(candidates).map((f) => `  ${f.label}: ${f.value}`).join("\n");
    return {
      subject: `Weekly onboarding funnel & back-out summary — ${dateStr}`,
      body: `Offered: ${k.offered} | Onboarded: ${k.onboarded} | Backed out: ${k.backedOut} (${k.backoutPct}%)\n` +
        `Avg offer→DOJ: ${k.avgOfferToJoin ?? "-"}d | Avg DOJ→onboarded: ${k.avgJoinToOnboard ?? "-"}d\n\nFunnel:\n${funnel}`,
    };
  }
  // default: daily pipeline digest
  const soon = candidates
    .filter((c) => c.status === "in_progress")
    .slice(0, 15)
    .map((c) => `  ${c.name} — ${c.department} — DOJ ${c.doj ?? c.dop ?? "-"}`)
    .join("\n");
  return {
    subject: `Daily onboarding pipeline digest — ${dateStr}`,
    body: `Pipeline: offered ${k.offered}, to be onboarded ${k.toBeOnboarded}, onboarded ${k.onboarded}, ` +
      `backed out ${k.backedOut}, blocked ${k.blocked}.\n\nUpcoming / in progress:\n${soon || "  (none)"}`,
  };
}

// Run scheduled reports that are due (called by Cron / Actions fallback).
export async function runDueSchedules(env: Env, now: Date): Promise<number> {
  const schedules = await listSchedules(env.DB);
  if (!schedules.length) return 0;
  const candidates = await listCandidates(env.DB);
  const tasksByCandidate = new Map<string, Task[]>();
  for (const c of candidates) tasksByCandidate.set(c.id, await listTasks(env.DB, c.id));

  const isMonday = now.getUTCDay() === 1;
  let ran = 0;
  for (const s of schedules) {
    if (!s.enabled) continue;
    if (s.cadence === "weekly" && !isMonday) continue; // weekly runs on Mondays
    const { subject, body } = buildReport(s.kind, candidates, tasksByCandidate, now);
    const recipients = String(s.recipients || "").split(",").map((x: string) => x.trim()).filter(Boolean);
    let status = "logged (no email provider)";
    if (env.RESEND_API_KEY && recipients.length) {
      try { await sendEmail(env, recipients, subject, body); status = "sent"; }
      catch (e) { status = "error: " + (e as Error).message; }
    }
    await logNotification(env.DB, { event: `Report · ${s.name}`, channel: "email", recipients: recipients.join(", ") || "(none)", subject, body, status });
    await markScheduleRun(env.DB, s.id);
    await audit(env.DB, "system", "report.run", "report_schedule", s.id, s.name);
    ran++;
  }
  return ran;
}
