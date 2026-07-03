// ---------------------------------------------------------------------------
// Analytics: pure functions that turn a list of candidates (+ their tasks) into
// the KPIs and chart data the dashboards need. No I/O here.
// ---------------------------------------------------------------------------

import {
  FUNNEL_STAGES,
  EMPLOYMENT_LABELS,
  daysBetween,
  type Candidate,
  type Task,
  type EmploymentType,
} from "./data";

export type Filters = {
  department?: string;
  employmentType?: string;
  caseType?: string;
  status?: string;
  from?: string; // filter on doj/dop
  to?: string;
};

export function applyFilters(list: Candidate[], f: Filters): Candidate[] {
  return list.filter((c) => {
    if (f.department && c.department !== f.department) return false;
    if (f.employmentType && c.employmentType !== f.employmentType) return false;
    if (f.caseType && c.caseType !== f.caseType) return false;
    if (f.status && c.status !== f.status) return false;
    const anchor = c.doj ?? c.dop;
    if (f.from && anchor && anchor < f.from) return false;
    if (f.to && anchor && anchor > f.to) return false;
    return true;
  });
}

export function departments(list: Candidate[]): string[] {
  return [...new Set(list.map((c) => c.department).filter(Boolean))].sort();
}

export type Kpis = {
  offered: number;
  accepted: number;
  toBeOnboarded: number;
  onboarded: number;
  backedOut: number;
  offboarded: number;
  blocked: number;
  backoutPct: number;
  avgOfferToJoin: number | null;
  avgJoinToOnboard: number | null;
  onTimePct: number | null;
};

export function computeKpis(list: Candidate[], tasksByCandidate: Map<string, Task[]>, now: Date): Kpis {
  const offered = list.length;
  const accepted = list.filter((c) => c.funnelStage >= 1 && c.status !== "backed_out").length;
  const onboarded = list.filter((c) => c.status === "onboarded").length;
  const backedOut = list.filter((c) => c.status === "backed_out").length;
  const offboarded = list.filter((c) => c.status === "offboarded").length;
  const toBeOnboarded = list.filter((c) => {
    if (c.status !== "in_progress") return false;
    const anchor = c.doj ?? c.dop;
    return anchor ? daysBetween(anchor, now) >= 0 : true;
  }).length;

  let blocked = 0;
  for (const c of list) {
    const ts = tasksByCandidate.get(c.id) ?? [];
    if (c.status === "in_progress" && ts.some((t) => t.blocked && !t.done)) blocked++;
  }

  // cycle times
  const offerToJoin: number[] = [];
  const joinToOnboard: number[] = [];
  for (const c of list) {
    if (c.offeredAt && c.doj) offerToJoin.push(Math.max(0, dayDiff(c.offeredAt, c.doj)));
    if (c.doj && c.onboardedAt) joinToOnboard.push(Math.max(0, dayDiff(c.doj, c.onboardedAt.slice(0, 10))));
  }

  // on-time completion of done tasks
  let doneTasks = 0, onTime = 0;
  for (const ts of tasksByCandidate.values()) {
    for (const t of ts) {
      if (t.done && t.doneAt && t.targetDate) {
        doneTasks++;
        if (t.doneAt.slice(0, 10) <= t.targetDate) onTime++;
      }
    }
  }

  return {
    offered, accepted, toBeOnboarded, onboarded, backedOut, offboarded, blocked,
    backoutPct: offered ? Math.round((backedOut / offered) * 100) : 0,
    avgOfferToJoin: avg(offerToJoin),
    avgJoinToOnboard: avg(joinToOnboard),
    onTimePct: doneTasks ? Math.round((onTime / doneTasks) * 100) : null,
  };
}

export function funnelData(list: Candidate[]): { label: string; value: number }[] {
  // How many candidates reached at least each milestone (excludes backed-out from having "progressed" beyond their backout).
  return FUNNEL_STAGES.map((s, i) => ({
    label: s.label,
    value: list.filter((c) => c.status !== "backed_out" && c.funnelStage >= i).length,
  }));
}

export function backoutByStage(list: Candidate[]): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const c of list) {
    if (c.status === "backed_out") {
      const key = c.backoutStage || "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

export function byEmploymentType(list: Candidate[]): { label: string; value: number; color: string }[] {
  const colors: Record<EmploymentType, string> = {
    permanent: "#1B4DFF", freelancer: "#12B76A", consultant: "#F79009", intern: "#7A5AF8", contractor: "#0BA5EC",
  };
  const types: EmploymentType[] = ["permanent", "freelancer", "consultant", "intern", "contractor"];
  return types
    .map((t) => ({ label: EMPLOYMENT_LABELS[t], value: list.filter((c) => c.employmentType === t).length, color: colors[t] }))
    .filter((s) => s.value > 0);
}

export function byDepartment(list: Candidate[]): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const c of list) counts.set(c.department || "—", (counts.get(c.department || "—") ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

// ---- helpers ----
function dayDiff(a: string, b: string): number {
  const da = new Date(a.slice(0, 10) + "T00:00:00Z").getTime();
  const db = new Date(b.slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}
function avg(xs: number[]): number | null {
  return xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null;
}
