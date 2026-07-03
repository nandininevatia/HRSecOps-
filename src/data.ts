// ---------------------------------------------------------------------------
// Shared configuration + pure helpers (no database, no I/O).
// This is the single source of truth for roles, stages, employment types,
// the task template, and the notification matrix.
// ---------------------------------------------------------------------------

// ---- Roles ----------------------------------------------------------------
export type Role =
  | "admin"
  | "management"
  | "ta"
  | "hr"
  | "it"
  | "manager"
  | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  management: "Management",
  ta: "Talent Acquisition",
  hr: "HR",
  it: "IT",
  manager: "Hiring Manager",
  viewer: "Viewer (no role yet)",
};

export const ALL_ROLES: Role[] = ["admin", "management", "ta", "hr", "it", "manager", "viewer"];

// Roles used as task/stage owners.
export type Team = "ta" | "hr" | "it" | "manager";
export const TEAM_LABELS: Record<Team, string> = {
  ta: "TA",
  hr: "HR",
  it: "IT",
  manager: "Manager",
};

// Permissions
export const canConfigure = (r: Role) => r === "admin";
export const canManageTeam = (r: Role) => r === "admin";
export const canSeeAll = (r: Role) => r === "admin" || r === "hr" || r === "management" || r === "viewer";
export const canAct = (r: Role) => r !== "viewer" && r !== "management";
export const canDelete = (r: Role) => r === "admin" || r === "hr";
export const roleTeam = (r: Role): Team | null =>
  r === "ta" || r === "hr" || r === "it" || r === "manager" ? r : null;

// ---- Employment types & case types ----------------------------------------
export type EmploymentType = "permanent" | "freelancer" | "consultant" | "intern" | "contractor";
export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "permanent", "freelancer", "consultant", "intern", "contractor",
];
export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  permanent: "Permanent",
  freelancer: "Freelancer",
  consultant: "Consultant",
  intern: "Intern",
  contractor: "Contractor",
};

export type CaseType = "pre_onboarding" | "immediate";
export const CASE_LABELS: Record<CaseType, string> = {
  pre_onboarding: "Pre-onboarding",
  immediate: "Immediate",
};

export type Status = "in_progress" | "onboarded" | "backed_out" | "offboarded";
export const STATUS_LABELS: Record<Status, string> = {
  in_progress: "In progress",
  onboarded: "Onboarded",
  backed_out: "Backed out",
  offboarded: "Offboarded",
};

// ---- Funnel milestones (ordered) ------------------------------------------
// The candidate's "current stage" for pipeline/funnel analytics.
export const FUNNEL_STAGES = [
  { key: "offer_released", label: "Offer Released", owner: "ta" as Team },
  { key: "offer_accepted", label: "Offer Accepted", owner: "ta" as Team },
  { key: "pofu_nda", label: "POFU / NDA", owner: "hr" as Team },
  { key: "pre_onboarding", label: "Pre-onboarding", owner: "hr" as Team },
  { key: "joining_confirmed", label: "Joining Confirmed", owner: "ta" as Team },
  { key: "ticket_raised", label: "Onboarding Ticket Raised", owner: "ta" as Team },
  { key: "day1_setup", label: "Day 1 Setup", owner: "it" as Team },
  { key: "manager_induction", label: "Manager Induction", owner: "manager" as Team },
  { key: "onboarded", label: "Onboarded", owner: "hr" as Team },
] as const;

export const LAST_STAGE = FUNNEL_STAGES.length - 1;

// ---- Task template --------------------------------------------------------
// Generated per candidate. "anchor"+"offset" auto-calculate a target date.
// anchor: "join" = DOJ (or DOP for pre-onboarding), "offer" = offered date.
export type TaskDef = {
  key: string;
  label: string;
  team: Team;
  phase: string;
  anchor: "offer" | "join";
  offset: number; // days relative to anchor
  automated?: string; // integration that automates it, if any
};

export const TASK_TEMPLATE: TaskDef[] = [
  // Pre-offer / offer
  { key: "shortlist_docs", label: "Shortlist & documents collected", team: "ta", phase: "Offer", anchor: "offer", offset: -3 },
  { key: "offer_release", label: "Offer released (Keka)", team: "ta", phase: "Offer", anchor: "offer", offset: 0, automated: "keka" },
  { key: "share_details", label: "Share candidate details → HR & IT (Freshservice ticket)", team: "ta", phase: "Offer", anchor: "offer", offset: 0, automated: "freshservice" },
  // POFU / NDA / pre-onboarding
  { key: "pofu", label: "Post-offer follow-up (POFU)", team: "hr", phase: "Pre-join", anchor: "join", offset: -14 },
  { key: "nda", label: "NDA signed (non-immediate)", team: "hr", phase: "Pre-join", anchor: "join", offset: -12 },
  { key: "pre_onboarding_email", label: "Pre-onboarding email + manager connect", team: "hr", phase: "Pre-join", anchor: "join", offset: -10 },
  { key: "join_confirm", label: "Joining confirmed (1 day before)", team: "ta", phase: "Pre-join", anchor: "join", offset: -1 },
  { key: "onboarding_ticket", label: "Onboarding ticket raised (Freshservice)", team: "ta", phase: "Pre-join", anchor: "offer", offset: 0, automated: "freshservice" },
  // Day 1 - Account & system setup (IT)
  { key: "email_id", label: "Email ID created", team: "it", phase: "Day 1 · Accounts", anchor: "join", offset: 0, automated: "freshservice" },
  { key: "laptop", label: "Laptop handover", team: "it", phase: "Day 1 · Accounts", anchor: "join", offset: 0 },
  { key: "jumpcloud", label: "Mapping in JumpCloud", team: "it", phase: "Day 1 · Accounts", anchor: "join", offset: 0, automated: "jumpcloud" },
  { key: "hrms_setup", label: "HRMS/Keka setup (dept mapping)", team: "hr", phase: "Day 1 · Accounts", anchor: "join", offset: 0, automated: "keka" },
  // Day 1 - Orientation & communication (HR)
  { key: "orientation", label: "Orientation session", team: "hr", phase: "Day 1 · Orientation", anchor: "join", offset: 0 },
  { key: "emp_agreement", label: "Employee Agreement + BGV (Ongrid)", team: "hr", phase: "Day 1 · Orientation", anchor: "join", offset: 0, automated: "ongrid" },
  { key: "slack_welcome", label: "Slack welcome + manager mapping", team: "hr", phase: "Day 1 · Orientation", anchor: "join", offset: 0, automated: "slack" },
  { key: "office_tv", label: "Photo on office TV", team: "hr", phase: "Day 1 · Orientation", anchor: "join", offset: 0 },
  { key: "intro_team", label: "Introduction to manager & team", team: "hr", phase: "Day 1 · Orientation", anchor: "join", offset: 0 },
  // Day 1 - Compliance & access (IT/Hardware)
  { key: "biometric", label: "Biometric / fingerprint setup (office access)", team: "it", phase: "Day 1 · Compliance", anchor: "join", offset: 0 },
  { key: "dls_groups", label: "Added to DLs / Google Groups", team: "it", phase: "Day 1 · Compliance", anchor: "join", offset: 0, automated: "google" },
  { key: "slack_channels", label: "Added to common Slack channels", team: "it", phase: "Day 1 · Compliance", anchor: "join", offset: 0, automated: "slack" },
  { key: "asset_tag", label: "Asset tagged in Keka", team: "it", phase: "Day 1 · Compliance", anchor: "join", offset: 0, automated: "keka" },
  // Manager induction
  { key: "buddy", label: "Assign a buddy", team: "manager", phase: "Induction", anchor: "join", offset: 1 },
  { key: "training_material", label: "Share training material", team: "manager", phase: "Induction", anchor: "join", offset: 1 },
  { key: "training_quiz", label: "Training quiz completed", team: "manager", phase: "Induction", anchor: "join", offset: 5 },
  { key: "security_training", label: "Security Training complete", team: "manager", phase: "Induction", anchor: "join", offset: 5 },
  { key: "posh_training", label: "POSH Training complete", team: "manager", phase: "Induction", anchor: "join", offset: 5 },
  // Wrap-up
  { key: "friday_intro", label: "Friday formal introduction", team: "hr", phase: "Wrap-up", anchor: "join", offset: 4 },
  { key: "employer_branding", label: "Employer branding (LinkedIn post)", team: "ta", phase: "Wrap-up", anchor: "join", offset: 5 },
  { key: "update_records", label: "Update HR records", team: "hr", phase: "Wrap-up", anchor: "join", offset: 6 },
];

// ---- Notification matrix (default recipients by role) ----------------------
export type NotifEvent =
  | "pre_boarding_created"
  | "ticket_created"
  | "back_out"
  | "candidate_joined"
  | "blocker_raised"
  | "sla_breach";

export const NOTIF_LABELS: Record<NotifEvent, string> = {
  pre_boarding_created: "Pre-boarding created",
  ticket_created: "Onboarding ticket created",
  back_out: "Candidate backed out",
  candidate_joined: "Candidate joined",
  blocker_raised: "Blocker raised",
  sla_breach: "Stage delayed (SLA breach)",
};

// Default recipient roles per event (resolved to emails via the users table).
export const DEFAULT_NOTIF_MATRIX: Record<NotifEvent, Role[]> = {
  pre_boarding_created: ["ta", "hr", "it", "manager", "admin"],
  ticket_created: ["it", "hr", "ta", "admin"],
  back_out: ["it", "ta", "hr", "manager", "admin"],
  candidate_joined: ["ta", "hr", "it", "manager", "admin"],
  blocker_raised: ["admin"], // owning team is always added dynamically
  sla_breach: ["admin"],
};

// ---- Integrations ----------------------------------------------------------
export type IntegrationKey = "freshservice" | "keka" | "jumpcloud" | "slack" | "google" | "ongrid";
export const INTEGRATIONS: { key: IntegrationKey; label: string; purpose: string }[] = [
  { key: "freshservice", label: "Freshservice", purpose: "Ticket create/cancel & status" },
  { key: "keka", label: "Keka", purpose: "Offer / HRMS / personnel / asset tag" },
  { key: "jumpcloud", label: "JumpCloud", purpose: "Account & device mapping" },
  { key: "slack", label: "Slack", purpose: "Announcements, welcome, channels" },
  { key: "google", label: "Google Workspace", purpose: "DLs / Groups / email" },
  { key: "ongrid", label: "Ongrid", purpose: "Background verification" },
];

// ---- Types -----------------------------------------------------------------
export type Candidate = {
  id: string;
  name: string;
  phone: string;
  personalEmail: string;
  department: string;
  designation: string;
  costCenter: string;
  employmentType: EmploymentType;
  reportingManager: string;
  assetRequired: boolean;
  caseType: CaseType;
  dop: string | null;
  doj: string | null;
  funnelStage: number;
  status: Status;
  backoutStage: string | null;
  backoutReason: string | null;
  backoutAt: string | null;
  offeredAt: string | null;
  onboardedAt: string | null;
  offboardedAt: string | null;
  createdAt: string;
  createdBy: string;
};

export type Task = {
  id: string;
  candidateId: string;
  key: string;
  label: string;
  team: Team;
  phase: string;
  targetDate: string | null;
  automated: string | null;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
  blocked: string | null;
  sort: number;
};

// ---- Date helpers ----------------------------------------------------------
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(fromISO: string, to: Date): number {
  const from = new Date(fromISO + "T00:00:00Z");
  const ms = from.getTime() - Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
export function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// Target date for a task given a candidate's anchor dates.
export function taskTargetDate(def: TaskDef, c: { doj: string | null; dop: string | null; offeredAt: string | null }): string | null {
  const joinAnchor = c.doj ?? c.dop;
  const anchor = def.anchor === "offer" ? c.offeredAt : joinAnchor;
  if (!anchor) return null;
  return addDays(anchor.slice(0, 10), def.offset);
}

export type Tone = "good" | "warn" | "bad" | "done" | "muted";
export function statusTone(c: Candidate, now: Date): { label: string; tone: Tone } {
  if (c.status === "onboarded") return { label: "Onboarded", tone: "done" };
  if (c.status === "backed_out") return { label: "Backed out", tone: "bad" };
  if (c.status === "offboarded") return { label: "Offboarded", tone: "muted" };
  const anchor = c.doj ?? c.dop;
  if (anchor) {
    const days = daysBetween(anchor, now);
    if (days < 0) return { label: "Overdue", tone: "bad" };
    if (days <= 7) return { label: "Joining soon", tone: "warn" };
  }
  return { label: "In progress", tone: "good" };
}
