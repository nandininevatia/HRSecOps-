// ---------------------------------------------------------------------------
// Static onboarding configuration + pure helper logic (no database here).
//
//   STAGES          - the ordered steps of your onboarding journey
//   SCHEDULE_RULES  - key dates auto-calculated from the joining date
//   helper functions for status and date maths
// ---------------------------------------------------------------------------

// The ordered onboarding journey. Each joiner moves through these in order.
export const STAGES = [
  { key: "offer_accepted", label: "Offer Accepted", owner: "TA" },
  { key: "details_shared", label: "Details Shared to HR", owner: "TA → HR" },
  { key: "pofu", label: "Post-Offer Follow-up", owner: "HR" },
  { key: "nda", label: "NDA", owner: "HR" },
  { key: "pre_onboarding", label: "Pre-onboarding Email", owner: "HR" },
  { key: "joining_confirmed", label: "Joining Confirmed", owner: "HR" },
  { key: "ticket_raised", label: "Onboarding Ticket Raised", owner: "HR" },
  { key: "day1_setup", label: "Day 1 Setup (IT / Admin)", owner: "IT + Admin" },
  { key: "manager_induction", label: "Manager Induction", owner: "Manager" },
  { key: "onboarded", label: "Onboarded", owner: "HR" },
] as const;

export const LAST_STAGE = STAGES.length - 1;

export type JoinerType = "immediate" | "non_immediate";

export type Joiner = {
  id: string;
  name: string;
  role: string;
  department: string;
  joinerType: JoinerType;
  joiningDate: string; // YYYY-MM-DD
  stageIndex: number;
  blocked: string | null;
  createdAt: string;
};

// "Key dates" auto-calculated relative to the joining date.
// offsetDays is counted from the joining date: negative = before, 0 = day one.
export const SCHEDULE_RULES = [
  { label: "Pre-onboarding email sent", offsetDays: -14 },
  { label: "Joining confirmed by candidate", offsetDays: -10 },
  { label: "Onboarding ticket raised (email + laptop + groups)", offsetDays: -7 },
  { label: "Day 1 setup complete", offsetDays: 0 },
  { label: "Manager induction", offsetDays: 0 },
  { label: "Training (Security + POSH) complete", offsetDays: 5 },
] as const;

// --- Date helpers ------------------------------------------------------------

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

export type Status = { label: string; tone: "good" | "warn" | "bad" | "done" };

export function statusFor(j: Joiner, today: Date): Status {
  if (j.stageIndex >= LAST_STAGE) return { label: "Onboarded", tone: "done" };
  if (j.blocked) return { label: "Blocked", tone: "bad" };
  const days = daysBetween(j.joiningDate, today);
  if (days < 0) return { label: "Overdue", tone: "bad" };
  if (days <= 7) return { label: "Joining soon", tone: "warn" };
  return { label: "On track", tone: "good" };
}

export function computeSchedule(joiningDate: string) {
  return SCHEDULE_RULES.map((r) => ({ label: r.label, date: addDays(joiningDate, r.offsetDays) }));
}
