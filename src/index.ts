// ---------------------------------------------------------------------------
// GoComet Onboarding & Facilitators Platform - main application.
// Wires together data, auth, analytics, and services into pages + APIs, plus
// the Cron handler for scheduled reports and SLA checks.
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import {
  FUNNEL_STAGES, LAST_STAGE, ROLE_LABELS, ALL_ROLES, EMPLOYMENT_TYPES, EMPLOYMENT_LABELS,
  CASE_LABELS, STATUS_LABELS, TEAM_LABELS, NOTIF_LABELS, INTEGRATIONS, DEFAULT_NOTIF_MATRIX,
  canAct, canDelete, canManageTeam, canConfigure, canSeeAll, roleTeam,
  daysBetween, statusTone,
  type Role, type EmploymentType, type CaseType, type Team, type NotifEvent, type IntegrationKey,
  type Candidate, type Task,
} from "./data";
import * as db from "./db";
import { identityEmail, resolveUser } from "./auth";
import * as A from "./analytics";
import { notify, runDay1Automation, dispatchIntegration, integrationState, runDueSchedules, buildReport } from "./services";
import {
  layout, esc, stat, chip, statusPill, barChart, funnelChart, donut,
} from "./ui";

type Env = { DB: D1Database; DEV_EMAIL?: string; RESEND_API_KEY?: string; MAIL_FROM?: string; CRON_SECRET?: string };
type Vars = { user: db.User };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const now = () => new Date();

// ---- Middleware: schema + identity (fail closed) --------------------------
app.use("*", async (c, next) => {
  const p = c.req.path;
  if (p === "/health" || p === "/cron") { if (c.env.DB) await db.ensureSchema(c.env.DB); return next(); }
  if (!c.env.DB) return c.text("Database not configured", 500);
  await db.ensureSchema(c.env.DB);
  const email = identityEmail(c);
  if (!email) return c.html(signInPage(), 401);
  c.set("user", await resolveUser(c.env.DB, email));
  await next();
});

function signInPage(): string {
  return layout({ title: "Sign-in required", body:
    `<h1 style="margin-top:0">Sign-in required</h1>
     <div class="banner">This app must be opened through your company login (Cloudflare Access).
     If you see this, sign-in isn't configured yet or your session expired. Contact your administrator.</div>` });
}
const forbidden = (u: db.User) => layout({ title: "Not allowed", user: u, active: "",
  body: `<div class="banner bad">Your role (${ROLE_LABELS[u.role]}) can't perform that action.</div><a href="/">← Dashboard</a>` });

// ===========================================================================
// DASHBOARD
// ===========================================================================
app.get("/", async (c) => {
  const user = c.get("user");
  const list = await db.listCandidates(c.env.DB);
  const tasksBy = new Map<string, Task[]>();
  for (const cc of list) tasksBy.set(cc.id, await db.listTasks(c.env.DB, cc.id));
  const k = A.computeKpis(list, tasksBy, now());

  // Blocked list
  const blocked: { c: Candidate; t: Task }[] = [];
  for (const cc of list) for (const t of tasksBy.get(cc.id) ?? []) if (t.blocked && !t.done && cc.status === "in_progress") blocked.push({ c: cc, t });

  // Upcoming joiners (next 14 days)
  const upcoming = list.filter((cc) => cc.status === "in_progress").filter((cc) => {
    const a = cc.doj ?? cc.dop; if (!a) return false; const d = daysBetween(a, now()); return d >= 0 && d <= 14;
  }).slice(0, 12);

  // Team open tasks (for team roles)
  const team = roleTeam(user.role);
  let teamPanel = "";
  if (team) {
    const open: { c: Candidate; t: Task }[] = [];
    for (const cc of list) if (cc.status === "in_progress") for (const t of tasksBy.get(cc.id) ?? []) if (t.team === team && !t.done) open.push({ c: cc, t });
    teamPanel = `<div class="panel"><h2>Your team's open tasks (${TEAM_LABELS[team]}) — ${open.length}</h2>
      <div class="tablewrap"><table><thead><tr><th>Candidate</th><th>Task</th><th>Target</th><th>Status</th></tr></thead><tbody>
      ${open.slice(0, 15).map(({ c: cc, t }) => `<tr>
        <td><a href="/candidates/${cc.id}">${esc(cc.name)}</a><div class="sub">${esc(cc.department)}</div></td>
        <td>${esc(t.label)}${t.automated ? " " + chip(t.automated, true) : ""}</td>
        <td>${esc(t.targetDate ?? "-")}</td>
        <td>${t.blocked ? statusPill("Blocked", "bad") : dueTone(t.targetDate)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">Nothing open 🎉</td></tr>`}
      </tbody></table></div></div>`;
  }

  const body = `
    ${user.role === "viewer" ? `<div class="banner">You don't have a team role yet — read-only. Ask an admin to set your role.</div>` : ""}
    <div class="cards">
      ${stat(k.offered, "Offered")}
      ${stat(k.toBeOnboarded, "To be onboarded")}
      ${stat(k.onboarded, "Onboarded")}
      ${stat(k.backedOut, "Backed out", `${k.backoutPct}% back-out rate`)}
    </div>
    <div class="cards">
      ${stat(k.blocked, "Blocked now")}
      ${stat(k.avgOfferToJoin ?? "—", "Avg offer→DOJ (days)")}
      ${stat(k.avgJoinToOnboard ?? "—", "Avg DOJ→onboarded (days)")}
      ${stat(k.onTimePct != null ? k.onTimePct + "%" : "—", "Tasks on time")}
    </div>
    <div class="grid2">
      <div class="panel"><h2>Onboarding funnel</h2><div class="body">${funnelChart(A.funnelData(list))}</div></div>
      <div class="panel"><h2>Blockers (${blocked.length})</h2><div class="body">
        ${blocked.length ? blocked.slice(0, 10).map(({ c: cc, t }) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)">
          <a href="/candidates/${cc.id}">${esc(cc.name)}</a> — <span class="muted">${esc(t.label)}</span>
          <div class="sub bad">${esc(t.blocked)}</div></div>`).join("") : `<div class="muted">No active blockers 🎉</div>`}
      </div></div>
    </div>
    ${teamPanel}
    <div class="panel"><h2>Upcoming joiners (next 14 days)</h2>
      <div class="tablewrap"><table><thead><tr><th>Candidate</th><th>Type</th><th>Dept</th><th>DOJ/DOP</th><th>Stage</th><th>Status</th></tr></thead><tbody>
      ${upcoming.map((cc) => candidateRow(cc)).join("") || `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">No joiners in the next 14 days.</td></tr>`}
      </tbody></table></div></div>`;
  return c.html(layout({ title: "Dashboard", user, active: "/", body }));
});

function dueTone(target: string | null): string {
  if (!target) return statusPill("No date", "muted");
  const d = daysBetween(target, now());
  if (d < 0) return statusPill("Overdue", "bad");
  if (d <= 2) return statusPill("Due soon", "warn");
  return statusPill("On track", "good");
}

function candidateRow(cc: Candidate): string {
  const s = statusTone(cc, now());
  const stage = FUNNEL_STAGES[cc.funnelStage];
  const anchor = cc.doj ?? cc.dop;
  return `<tr>
    <td><a href="/candidates/${cc.id}" class="name">${esc(cc.name)}</a><div class="sub">${esc(cc.designation)}</div></td>
    <td>${chip(EMPLOYMENT_LABELS[cc.employmentType])}</td>
    <td>${esc(cc.department)}</td>
    <td>${esc(anchor ?? "-")}<div class="sub">${esc(CASE_LABELS[cc.caseType])}</div></td>
    <td>${esc(stage?.label ?? "-")}</td>
    <td>${statusPill(s.label, s.tone)}</td></tr>`;
}

// ===========================================================================
// ANALYTICS
// ===========================================================================
app.get("/analytics", async (c) => {
  const user = c.get("user");
  const all = await db.listCandidates(c.env.DB);
  const f: A.Filters = {
    department: c.req.query("department") || undefined,
    employmentType: c.req.query("employmentType") || undefined,
    caseType: c.req.query("caseType") || undefined,
    status: c.req.query("status") || undefined,
    from: c.req.query("from") || undefined,
    to: c.req.query("to") || undefined,
  };
  const list = A.applyFilters(all, f);
  const tasksBy = new Map<string, Task[]>();
  for (const cc of list) tasksBy.set(cc.id, await db.listTasks(c.env.DB, cc.id));
  const k = A.computeKpis(list, tasksBy, now());

  const sel = (name: keyof A.Filters, val: string, label: string) =>
    `<option value="${esc(val)}" ${f[name] === val ? "selected" : ""}>${esc(label)}</option>`;
  const filterBar = `<form method="get" class="panel"><div class="body row">
    <div class="field" style="margin:0;min-width:150px"><label>Department</label><select name="department"><option value="">All</option>${A.departments(all).map((d) => sel("department", d, d)).join("")}</select></div>
    <div class="field" style="margin:0;min-width:150px"><label>Employment</label><select name="employmentType"><option value="">All</option>${EMPLOYMENT_TYPES.map((t) => sel("employmentType", t, EMPLOYMENT_LABELS[t])).join("")}</select></div>
    <div class="field" style="margin:0;min-width:140px"><label>Case</label><select name="caseType"><option value="">All</option>${sel("caseType", "pre_onboarding", "Pre-onboarding")}${sel("caseType", "immediate", "Immediate")}</select></div>
    <div class="field" style="margin:0;min-width:140px"><label>Status</label><select name="status"><option value="">All</option>${(["in_progress","onboarded","backed_out","offboarded"] as const).map((s) => sel("status", s, STATUS_LABELS[s])).join("")}</select></div>
    <div class="field" style="margin:0"><label>DOJ/DOP from</label><input type="date" name="from" value="${esc(f.from ?? "")}"/></div>
    <div class="field" style="margin:0"><label>to</label><input type="date" name="to" value="${esc(f.to ?? "")}"/></div>
    <button class="btn">Apply</button> <a class="btn ghost" href="/analytics">Reset</a>
  </div></form>`;

  const body = `${filterBar}
    <div class="cards">
      ${stat(k.offered, "Offered")}${stat(k.onboarded, "Onboarded")}${stat(k.offboarded, "Offboarded")}${stat(k.backoutPct + "%", "Back-out rate", `${k.backedOut} of ${k.offered}`)}
    </div>
    <div class="grid2">
      <div class="panel"><h2>Offered → Onboarded funnel</h2><div class="body">${funnelChart(A.funnelData(list))}</div></div>
      <div class="panel"><h2>By employment type</h2><div class="body">${A.byEmploymentType(list).length ? donut(A.byEmploymentType(list)) : `<div class="muted">No data</div>`}</div></div>
      <div class="panel"><h2>Back-out by stage</h2><div class="body">${A.backoutByStage(list).length ? barChart(A.backoutByStage(list), { color: "#D92D20" }) : `<div class="muted">No back-outs 🎉</div>`}</div></div>
      <div class="panel"><h2>By department</h2><div class="body">${A.byDepartment(list).length ? barChart(A.byDepartment(list)) : `<div class="muted">No data</div>`}</div></div>
    </div>
    <div class="cards">
      ${stat(k.avgOfferToJoin ?? "—", "Avg offer→DOJ (days)")}${stat(k.avgJoinToOnboard ?? "—", "Avg DOJ→onboarded (days)")}${stat(k.onTimePct != null ? k.onTimePct + "%" : "—", "Tasks on time")}${stat(k.blocked, "Blocked now")}
    </div>`;
  return c.html(layout({ title: "Analytics", user, active: "/analytics", body }));
});

// ===========================================================================
// CANDIDATES
// ===========================================================================
app.get("/candidates", async (c) => {
  const user = c.get("user");
  const all = await db.listCandidates(c.env.DB);
  const view = c.req.query("view") === "mine" ? "mine" : "all";
  const team = roleTeam(user.role);
  const tasksBy = new Map<string, Task[]>();
  let mine = all;
  if (team) {
    for (const cc of all) tasksBy.set(cc.id, await db.listTasks(c.env.DB, cc.id));
    mine = all.filter((cc) => cc.status === "in_progress" && (tasksBy.get(cc.id) ?? []).some((t) => t.team === team && !t.done));
  }
  const shown = view === "mine" && team ? mine : all;
  const tabs = team ? `<div class="tabs">
    <a href="/candidates?view=mine" class="${view === "mine" ? "active" : ""}">My team (${mine.length})</a>
    <a href="/candidates?view=all" class="${view === "all" ? "active" : ""}">All (${all.length})</a></div>` : "";
  const addBtn = canAct(user.role) ? `<a class="btn" href="/candidates/new" style="float:right">+ Add candidate</a>` : "";
  const body = `${addBtn}${tabs}
    <div class="panel"><div class="tablewrap"><table>
      <thead><tr><th>Candidate</th><th>Type</th><th>Dept</th><th>DOJ/DOP</th><th>Stage</th><th>Status</th></tr></thead>
      <tbody>${shown.map((cc) => candidateRow(cc)).join("") || `<tr><td colspan="6" class="muted" style="text-align:center;padding:28px">No candidates yet.</td></tr>`}</tbody>
    </table></div></div>`;
  return c.html(layout({ title: "Candidates", user, active: "/candidates", body }));
});

app.get("/candidates/new", (c) => {
  const user = c.get("user");
  if (!canAct(user.role)) return c.html(forbidden(user), 403);
  const empOpts = EMPLOYMENT_TYPES.map((t) => `<option value="${t}">${EMPLOYMENT_LABELS[t]}</option>`).join("");
  const body = `<a href="/candidates" class="muted">← Candidates</a>
    <div class="panel"><h2>Add candidate (Freshservice-style intake)</h2><div class="body">
    <form method="post" action="/candidates">
      <div class="row2">
        <div class="field"><label>Full name *</label><input name="name" required/></div>
        <div class="field"><label>Phone</label><input name="phone"/></div>
      </div>
      <div class="row2">
        <div class="field"><label>Personal email</label><input name="personalEmail" type="email"/></div>
        <div class="field"><label>Reporting manager</label><input name="reportingManager"/></div>
      </div>
      <div class="row3">
        <div class="field"><label>Department</label><input name="department"/></div>
        <div class="field"><label>Designation</label><input name="designation"/></div>
        <div class="field"><label>Cost center</label><input name="costCenter"/></div>
      </div>
      <div class="row3">
        <div class="field"><label>Employment type</label><select name="employmentType">${empOpts}</select></div>
        <div class="field"><label>Case type</label><select name="caseType">
          <option value="immediate">Immediate (DOJ)</option><option value="pre_onboarding">Pre-onboarding (DOP)</option></select></div>
        <div class="field"><label>Asset shipment required</label><select name="assetRequired"><option value="0">No</option><option value="1">Yes</option></select></div>
      </div>
      <div class="row2">
        <div class="field"><label>DOJ (Date of Joining)</label><input type="date" name="doj"/></div>
        <div class="field"><label>DOP (Date of Pre-boarding)</label><input type="date" name="dop"/></div>
      </div>
      <button class="btn">Create candidate</button>
    </form></div></div>`;
  return c.html(layout({ title: "Add candidate", user, active: "/candidates/new", body }));
});

app.post("/candidates", async (c) => {
  const user = c.get("user");
  if (!canAct(user.role)) return c.html(forbidden(user), 403);
  const fm = await c.req.formData();
  const name = String(fm.get("name") ?? "").trim();
  if (!name) return c.redirect("/candidates/new");
  const caseType = (String(fm.get("caseType")) === "pre_onboarding" ? "pre_onboarding" : "immediate") as CaseType;
  const empRaw = String(fm.get("employmentType"));
  const employmentType = (EMPLOYMENT_TYPES as string[]).includes(empRaw) ? (empRaw as EmploymentType) : "permanent";
  const id = await db.createCandidate(c.env.DB, {
    name, phone: String(fm.get("phone") ?? "").trim(), personalEmail: String(fm.get("personalEmail") ?? "").trim(),
    department: String(fm.get("department") ?? "").trim(), designation: String(fm.get("designation") ?? "").trim(),
    costCenter: String(fm.get("costCenter") ?? "").trim(), employmentType,
    reportingManager: String(fm.get("reportingManager") ?? "").trim(), assetRequired: String(fm.get("assetRequired")) === "1",
    caseType, dop: (String(fm.get("dop") ?? "").trim() || null), doj: (String(fm.get("doj") ?? "").trim() || null),
  }, user.email);
  await db.audit(c.env.DB, user.email, "candidate.create", "candidate", id, name);
  const cc = await db.getCandidate(c.env.DB, id);
  if (cc) await notify(c.env, caseType === "pre_onboarding" ? "pre_boarding_created" : "ticket_created", {
    subject: `${caseType === "pre_onboarding" ? "Pre-boarding" : "Onboarding ticket"} created — ${name}`,
    body: `${name} (${cc.designation || "-"}, ${cc.department}) | ${EMPLOYMENT_LABELS[employmentType]} | DOJ/DOP: ${cc.doj ?? cc.dop ?? "-"}`,
  });
  return c.redirect(`/candidates/${id}`);
});

app.get("/candidates/:id", async (c) => {
  const user = c.get("user");
  const cc = await db.getCandidate(c.env.DB, c.req.param("id"));
  if (!cc) return c.notFound();
  const tasks = await db.listTasks(c.env.DB, cc.id);
  const s = statusTone(cc, now());
  const mayAct = canAct(user.role);

  const steps = FUNNEL_STAGES.map((st, i) => {
    const cls = i < cc.funnelStage ? "done" : i === cc.funnelStage ? "current" : "";
    return `<li><span class="dot ${cls}"></span><span>${esc(st.label)} <span class="sub" style="margin:0">· ${TEAM_LABELS[st.owner]}</span></span></li>`;
  }).join("");

  // Tasks grouped by phase
  const phases: string[] = [];
  const byPhase = new Map<string, Task[]>();
  for (const t of tasks) { if (!byPhase.has(t.phase)) { byPhase.set(t.phase, []); phases.push(t.phase); } byPhase.get(t.phase)!.push(t); }
  const taskHtml = phases.map((ph) => `<div class="panel"><h2>${esc(ph)}</h2><div class="tablewrap"><table><tbody>
    ${byPhase.get(ph)!.map((t) => `<tr>
      <td style="width:24px">${mayAct ? `<form class="inline" method="post" action="/tasks/${t.id}/done"><input type="hidden" name="done" value="${t.done ? "0" : "1"}"/>
        <button class="btn ${t.done ? "secondary" : "ghost"} small" title="toggle">${t.done ? "✓" : "○"}</button></form>` : (t.done ? "✓" : "○")}</td>
      <td><span style="${t.done ? "text-decoration:line-through;color:var(--muted)" : ""}">${esc(t.label)}</span>
        ${t.automated ? " " + chip(t.automated, true) : ""} <span class="chip gray">${TEAM_LABELS[t.team]}</span>
        ${t.blocked ? `<div class="sub bad">⛔ ${esc(t.blocked)}</div>` : ""}</td>
      <td class="right">${esc(t.targetDate ?? "-")}<br>${t.done ? statusPill("Done", "done") : t.blocked ? statusPill("Blocked", "bad") : dueTone(t.targetDate)}</td>
      ${mayAct ? `<td style="width:200px"><form class="inline" method="post" action="/tasks/${t.id}/block">
        <input name="reason" placeholder="blocker (empty=clear)" value="${esc(t.blocked ?? "")}" style="padding:6px 8px;font-size:12px;width:130px"/>
        <button class="btn ghost small">Save</button></form></td>` : ""}
    </tr>`).join("")}
  </tbody></table></div></div>`).join("");

  const actions = mayAct && cc.status === "in_progress" ? `<div class="panel"><div class="body">
    <div class="row">
      <form class="inline" method="post" action="/candidates/${cc.id}/move"><input type="hidden" name="dir" value="1"/>
        <button class="btn" ${cc.funnelStage >= LAST_STAGE ? "disabled style=opacity:.5" : ""}>Advance stage →</button></form>
      <form class="inline" method="post" action="/candidates/${cc.id}/move"><input type="hidden" name="dir" value="-1"/>
        <button class="btn secondary" ${cc.funnelStage <= 0 ? "disabled style=opacity:.5" : ""}>← Back</button></form>
    </div>
    <form method="post" action="/candidates/${cc.id}/backout" style="margin-top:14px" onsubmit="return confirm('Mark as backed out?')">
      <div class="field" style="margin-bottom:8px"><label>Record back-out (reason)</label><input name="reason" placeholder="e.g. accepted another offer"/></div>
      <button class="btn danger small">Mark backed out</button></form>
  </div></div>` : "";

  const wrapActions = mayAct ? `<div class="row" style="margin-top:12px">
    ${cc.status === "onboarded" ? `<form class="inline" method="post" action="/candidates/${cc.id}/offboard" onsubmit="return confirm('Mark offboarded?')"><button class="btn ghost small">Mark offboarded</button></form>` : ""}
    ${canDelete(user.role) ? `<form class="inline" method="post" action="/candidates/${cc.id}/delete" onsubmit="return confirm('Delete permanently?')"><button class="btn danger small">Delete candidate</button></form>` : ""}
  </div>` : "";

  const body = `<a href="/candidates" class="muted">← Candidates</a>
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><h1 style="margin:6px 0 2px">${esc(cc.name)}</h1>
        <div class="muted">${esc(cc.designation || "-")} · ${esc(cc.department || "-")} · ${EMPLOYMENT_LABELS[cc.employmentType]} · ${CASE_LABELS[cc.caseType]}</div></div>
      <div>${statusPill(s.label, s.tone)}</div></div>
    <div class="cards" style="margin-top:14px">
      ${stat(cc.doj ?? cc.dop ?? "—", cc.caseType === "pre_onboarding" ? "DOP" : "DOJ")}
      ${stat(FUNNEL_STAGES[cc.funnelStage]?.label ?? "-", "Current stage")}
      ${stat(cc.reportingManager || "—", "Reporting manager")}
      ${stat(cc.assetRequired ? "Yes" : "No", "Asset required")}
    </div>
    ${cc.status === "backed_out" ? `<div class="banner bad">Backed out at "${esc(cc.backoutStage ?? "-")}" — ${esc(cc.backoutReason ?? "")}</div>` : ""}
    ${actions}
    <div class="panel"><h2>Onboarding journey</h2><div class="body"><ul class="steps">${steps}</ul></div></div>
    ${taskHtml}
    ${wrapActions}`;
  return c.html(layout({ title: cc.name, user, active: "/candidates", body }));
});

app.post("/candidates/:id/move", async (c) => {
  const user = c.get("user"); if (!canAct(user.role)) return c.html(forbidden(user), 403);
  const id = c.req.param("id");
  const before = await db.getCandidate(c.env.DB, id);
  const dir = String((await c.req.formData()).get("dir")) === "-1" ? -1 : 1;
  const after = await db.moveStage(c.env.DB, id, dir, LAST_STAGE);
  if (before && after) {
    await db.audit(c.env.DB, user.email, "candidate.move", "candidate", id, `${FUNNEL_STAGES[before.funnelStage]?.label} → ${FUNNEL_STAGES[after.funnelStage]?.label}`);
    // Day-1 automation fires when crossing into "Day 1 Setup" (index 6)
    if (before.funnelStage < 6 && after.funnelStage >= 6) await runDay1Automation(c.env, after);
  }
  return c.redirect(`/candidates/${id}`);
});

app.post("/candidates/:id/backout", async (c) => {
  const user = c.get("user"); if (!canAct(user.role)) return c.html(forbidden(user), 403);
  const id = c.req.param("id");
  const cc = await db.getCandidate(c.env.DB, id); if (!cc) return c.notFound();
  const reason = String((await c.req.formData()).get("reason") ?? "").trim() || "(no reason given)";
  const stageLabel = FUNNEL_STAGES[cc.funnelStage]?.label ?? "-";
  await db.setBackedOut(c.env.DB, id, stageLabel, reason);
  await db.audit(c.env.DB, user.email, "candidate.backout", "candidate", id, `${stageLabel}: ${reason}`);
  await notify(c.env, "back_out", { subject: `Back-out — ${cc.name}`, body: `${cc.name} backed out at "${stageLabel}". Reason: ${reason}` });
  return c.redirect(`/candidates/${id}`);
});

app.post("/candidates/:id/offboard", async (c) => {
  const user = c.get("user"); if (!canAct(user.role)) return c.html(forbidden(user), 403);
  await db.setOffboarded(c.env.DB, c.req.param("id"));
  await db.audit(c.env.DB, user.email, "candidate.offboard", "candidate", c.req.param("id"), "");
  return c.redirect(`/candidates/${c.req.param("id")}`);
});

app.post("/candidates/:id/delete", async (c) => {
  const user = c.get("user"); if (!canDelete(user.role)) return c.html(forbidden(user), 403);
  await db.deleteCandidate(c.env.DB, c.req.param("id"));
  await db.audit(c.env.DB, user.email, "candidate.delete", "candidate", c.req.param("id"), "");
  return c.redirect("/candidates");
});

// ---- Tasks ----
app.post("/tasks/:id/done", async (c) => {
  const user = c.get("user"); if (!canAct(user.role)) return c.html(forbidden(user), 403);
  const t = await db.getTask(c.env.DB, c.req.param("id")); if (!t) return c.notFound();
  const done = String((await c.req.formData()).get("done")) === "1";
  await db.setTaskDone(c.env.DB, t.id, done, user.email);
  await db.audit(c.env.DB, user.email, done ? "task.done" : "task.reopen", "task", t.id, t.label);
  return c.redirect(`/candidates/${t.candidateId}`);
});

app.post("/tasks/:id/block", async (c) => {
  const user = c.get("user"); if (!canAct(user.role)) return c.html(forbidden(user), 403);
  const t = await db.getTask(c.env.DB, c.req.param("id")); if (!t) return c.notFound();
  const reason = String((await c.req.formData()).get("reason") ?? "").trim();
  await db.setTaskBlocked(c.env.DB, t.id, reason || null);
  if (reason) {
    const cc = await db.getCandidate(c.env.DB, t.candidateId);
    await db.audit(c.env.DB, user.email, "task.block", "task", t.id, `${t.label}: ${reason}`);
    await notify(c.env, "blocker_raised", { subject: `Blocker — ${cc?.name ?? ""}: ${t.label}`, body: `Blocker on "${t.label}" for ${cc?.name ?? ""}: ${reason}`, extraRoles: [t.team as Role] });
  } else {
    await db.audit(c.env.DB, user.email, "task.unblock", "task", t.id, t.label);
  }
  return c.redirect(`/candidates/${t.candidateId}`);
});

// ===========================================================================
// IMPORT (from existing sheets)
// ===========================================================================
app.get("/import", (c) => {
  const user = c.get("user");
  if (!canAct(user.role)) return c.html(forbidden(user), 403);
  const body = `<div class="panel"><h2>Import candidates from a sheet (CSV)</h2><div class="body">
    <p class="muted">Export your existing sheet as CSV and paste it below. The first row must be the header.
    Recognised columns: <code>name, phone, personal_email, department, designation, cost_center,
    employment_type, reporting_manager, asset_required, case_type, dop, doj</code>. Only <b>name</b> is required.</p>
    <form method="post" action="/import">
      <div class="field"><label>Paste CSV</label>
        <textarea name="csv" rows="12" placeholder="name,department,designation,employment_type,doj&#10;Aarav Sharma,Engineering,Backend Engineer,permanent,2026-08-01"></textarea></div>
      <button class="btn">Import</button>
    </form></div></div>`;
  return c.html(layout({ title: "Import", user, active: "/import", body }));
});

app.post("/import", async (c) => {
  const user = c.get("user"); if (!canAct(user.role)) return c.html(forbidden(user), 403);
  const csv = String((await c.req.formData()).get("csv") ?? "");
  const rows = parseCsv(csv);
  let created = 0; const errors: string[] = [];
  for (const r of rows) {
    const name = (r["name"] || r["full name"] || "").trim();
    if (!name) continue;
    const empRaw = (r["employment_type"] || r["employment type"] || "permanent").toLowerCase().trim();
    const employmentType = (EMPLOYMENT_TYPES as string[]).includes(empRaw) ? (empRaw as EmploymentType) : "permanent";
    const caseRaw = (r["case_type"] || r["case type"] || "").toLowerCase();
    const caseType: CaseType = caseRaw.includes("pre") ? "pre_onboarding" : "immediate";
    try {
      const id = await db.createCandidate(c.env.DB, {
        name, phone: (r["phone"] || "").trim(), personalEmail: (r["personal_email"] || r["personal email"] || r["email"] || "").trim(),
        department: (r["department"] || "").trim(), designation: (r["designation"] || "").trim(),
        costCenter: (r["cost_center"] || r["cost center"] || "").trim(), employmentType,
        reportingManager: (r["reporting_manager"] || r["reporting manager"] || "").trim(),
        assetRequired: /^(y|yes|true|1)$/i.test((r["asset_required"] || r["asset shipment required"] || "").trim()),
        caseType, dop: (r["dop"] || "").trim() || null, doj: (r["doj"] || "").trim() || null,
      }, user.email);
      await db.audit(c.env.DB, user.email, "candidate.import", "candidate", id, name);
      created++;
    } catch (e) { errors.push(`${name}: ${(e as Error).message}`); }
  }
  const body = `<div class="banner">Imported <b>${created}</b> candidate(s).${errors.length ? ` ${errors.length} error(s).` : ""}</div>
    ${errors.length ? `<div class="panel"><div class="body"><pre>${esc(errors.join("\n"))}</pre></div></div>` : ""}
    <a class="btn" href="/candidates">View candidates</a> <a class="btn ghost" href="/import">Import more</a>`;
  return c.html(layout({ title: "Import result", user, active: "/import", body }));
});

function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); lines.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); lines.push(row); }
  const nonEmpty = lines.filter((l) => l.some((x) => x.trim() !== ""));
  if (nonEmpty.length < 2) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = (cells[i] ?? "").trim()));
    return o;
  });
}

// ===========================================================================
// TEAM (admin)
// ===========================================================================
app.get("/team", async (c) => {
  const user = c.get("user"); if (!canManageTeam(user.role)) return c.html(forbidden(user), 403);
  const users = await db.listUsers(c.env.DB);
  const roleOpts = (sel: Role) => ALL_ROLES.map((r) => `<option value="${r}" ${r === sel ? "selected" : ""}>${ROLE_LABELS[r]}</option>`).join("");
  const rows = users.map((u) => `<tr>
    <td><div class="name">${esc(u.name || u.email)}${u.email === user.email ? " (you)" : ""}</div><div class="sub">${esc(u.email)}</div></td>
    <td><form class="inline" method="post" action="/team/save"><input type="hidden" name="email" value="${esc(u.email)}"/><input type="hidden" name="name" value="${esc(u.name)}"/>
      <select name="role" onchange="this.form.submit()">${roleOpts(u.role)}</select></form></td>
    <td>${u.email === user.email ? `<span class="muted">—</span>` : `<form class="inline" method="post" action="/team/delete" onsubmit="return confirm('Remove?')"><input type="hidden" name="email" value="${esc(u.email)}"/><button class="btn danger small">Remove</button></form>`}</td>
  </tr>`).join("");
  const body = `<div class="panel"><h2>Members</h2><div class="tablewrap"><table><thead><tr><th>Person</th><th>Role</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="panel"><h2>Add / invite a person</h2><div class="body"><form method="post" action="/team/save">
      <div class="row2"><div class="field"><label>Email</label><input name="email" type="email" required placeholder="name@company.com"/></div>
        <div class="field"><label>Name</label><input name="name"/></div></div>
      <div class="field"><label>Role</label><select name="role">${roleOpts("hr")}</select></div>
      <button class="btn">Save person</button></form></div></div>`;
  return c.html(layout({ title: "Team", user, active: "/team", body }));
});

app.post("/team/save", async (c) => {
  const user = c.get("user"); if (!canManageTeam(user.role)) return c.html(forbidden(user), 403);
  const fm = await c.req.formData();
  const email = String(fm.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(fm.get("role") ?? "viewer") as Role;
  const role = ALL_ROLES.includes(roleRaw) ? roleRaw : "viewer";
  if (email.includes("@")) { await db.upsertUser(c.env.DB, { email, name: String(fm.get("name") ?? "").trim(), role }); await db.audit(c.env.DB, user.email, "user.upsert", "user", email, role); }
  return c.redirect("/team");
});

app.post("/team/delete", async (c) => {
  const user = c.get("user"); if (!canManageTeam(user.role)) return c.html(forbidden(user), 403);
  const email = String((await c.req.formData()).get("email") ?? "").trim().toLowerCase();
  if (email && email !== user.email) { await db.deleteUser(c.env.DB, email); await db.audit(c.env.DB, user.email, "user.delete", "user", email, ""); }
  return c.redirect("/team");
});

// ===========================================================================
// SETTINGS (admin): notification matrix, integrations, report schedules
// ===========================================================================
app.get("/settings", async (c) => {
  const user = c.get("user"); if (!canConfigure(user.role)) return c.html(forbidden(user), 403);
  const matrix = await db.getSetting<Record<string, Role[]>>(c.env.DB, "notif_matrix", DEFAULT_NOTIF_MATRIX as any);
  const integ = await integrationState(c.env.DB);
  const schedules = await db.listSchedules(c.env.DB);

  const events = Object.keys(NOTIF_LABELS) as NotifEvent[];
  const rolePickRoles: Role[] = ["ta", "hr", "it", "manager", "management", "admin"];
  const matrixRows = events.map((ev) => {
    const chosen = matrix[ev] ?? DEFAULT_NOTIF_MATRIX[ev] ?? [];
    const checks = rolePickRoles.map((r) => `<label style="margin-right:12px;font-weight:500;font-size:13px">
      <input type="checkbox" name="${ev}" value="${r}" ${chosen.includes(r) ? "checked" : ""}/> ${ROLE_LABELS[r]}</label>`).join("");
    return `<tr><td style="white-space:nowrap"><b>${NOTIF_LABELS[ev]}</b></td><td>${checks}</td></tr>`;
  }).join("");

  const integRows = INTEGRATIONS.map((i) => `<tr><td><b>${esc(i.label)}</b><div class="sub">${esc(i.purpose)}</div></td>
    <td><label class="chip ${integ[i.key] ? "" : "gray"}"><input type="checkbox" name="${i.key}" ${integ[i.key] ? "checked" : ""}/> ${integ[i.key] ? "Enabled" : "Disabled"}</label></td></tr>`).join("");

  const schedRows = schedules.map((s: any) => `<tr>
    <td><b>${esc(s.name)}</b><div class="sub">${esc(s.kind)} · ${esc(s.cadence)} · ${s.enabled ? "on" : "off"} · last: ${esc(s.last_run_at ?? "never")}</div><div class="sub">${esc(s.recipients)}</div></td>
    <td><form class="inline" method="post" action="/settings/schedule/delete"><input type="hidden" name="id" value="${esc(s.id)}"/><button class="btn danger small">Delete</button></form></td></tr>`).join("");

  const body = `
    <div class="panel"><h2>Notification matrix</h2><div class="body">
      <form method="post" action="/settings/matrix"><div class="tablewrap"><table><tbody>${matrixRows}</tbody></table></div>
      <p class="muted" style="font-size:12px">The owning team is always notified on blockers automatically, in addition to the roles above.</p>
      <button class="btn">Save matrix</button></form></div></div>

    <div class="panel"><h2>Integrations</h2><div class="body">
      <form method="post" action="/settings/integrations"><div class="tablewrap"><table><tbody>${integRows}</tbody></table></div>
      <p class="muted" style="font-size:12px">Enabling flags an integration as active. Live API calls are wired per-integration in a later step; until then actions are simulated and logged.</p>
      <button class="btn">Save integrations</button></form></div></div>

    <div class="panel"><h2>Scheduled reports</h2><div class="body">
      ${schedules.length ? `<div class="tablewrap"><table><tbody>${schedRows}</tbody></table></div>` : `<p class="muted">No schedules yet.</p>`}
      <form method="post" action="/settings/schedule" style="margin-top:14px">
        <div class="row2"><div class="field"><label>Name</label><input name="name" required placeholder="Daily pipeline digest"/></div>
          <div class="field"><label>Recipients (comma-separated emails)</label><input name="recipients" placeholder="angela@company.com, nandini@company.com"/></div></div>
        <div class="row3">
          <div class="field"><label>Report</label><select name="kind"><option value="daily_pipeline">Daily pipeline digest</option><option value="weekly_funnel">Weekly funnel & back-out</option></select></div>
          <div class="field"><label>Cadence</label><select name="cadence"><option value="daily">Daily</option><option value="weekly">Weekly (Mondays)</option></select></div>
          <div class="field"><label>Hour (UTC)</label><input type="number" name="hour" value="9" min="0" max="23"/></div>
        </div>
        <button class="btn">Add schedule</button></form>
      <p class="muted" style="font-size:12px;margin-top:10px">Runs are triggered by Cloudflare Cron (and a GitHub Actions fallback) hitting <code>/cron</code>.</p>
    </div></div>`;
  return c.html(layout({ title: "Settings", user, active: "/settings", body }));
});

app.post("/settings/matrix", async (c) => {
  const user = c.get("user"); if (!canConfigure(user.role)) return c.html(forbidden(user), 403);
  const fm = await c.req.formData();
  const events = Object.keys(NOTIF_LABELS) as NotifEvent[];
  const matrix: Record<string, Role[]> = {};
  for (const ev of events) matrix[ev] = fm.getAll(ev).map((x) => String(x) as Role);
  await db.setSetting(c.env.DB, "notif_matrix", matrix);
  await db.audit(c.env.DB, user.email, "settings.matrix", "settings", "notif_matrix", "");
  return c.redirect("/settings");
});

app.post("/settings/integrations", async (c) => {
  const user = c.get("user"); if (!canConfigure(user.role)) return c.html(forbidden(user), 403);
  const fm = await c.req.formData();
  const state: Record<string, boolean> = {};
  for (const i of INTEGRATIONS) state[i.key] = fm.get(i.key) != null;
  await db.setSetting(c.env.DB, "integrations", state);
  await db.audit(c.env.DB, user.email, "settings.integrations", "settings", "integrations", JSON.stringify(state));
  return c.redirect("/settings");
});

app.post("/settings/schedule", async (c) => {
  const user = c.get("user"); if (!canConfigure(user.role)) return c.html(forbidden(user), 403);
  const fm = await c.req.formData();
  await db.upsertSchedule(c.env.DB, {
    name: String(fm.get("name") ?? "Report").trim(), kind: String(fm.get("kind") ?? "daily_pipeline"),
    cadence: String(fm.get("cadence") ?? "daily"), hour: parseInt(String(fm.get("hour") ?? "9")) || 9,
    recipients: String(fm.get("recipients") ?? "").trim(), enabled: true,
  });
  await db.audit(c.env.DB, user.email, "settings.schedule.add", "report_schedule", "", String(fm.get("name") ?? ""));
  return c.redirect("/settings");
});

app.post("/settings/schedule/delete", async (c) => {
  const user = c.get("user"); if (!canConfigure(user.role)) return c.html(forbidden(user), 403);
  await db.deleteSchedule(c.env.DB, String((await c.req.formData()).get("id") ?? ""));
  return c.redirect("/settings");
});

// ===========================================================================
// LOGS (admin)
// ===========================================================================
app.get("/outbox", async (c) => {
  const user = c.get("user"); if (!canConfigure(user.role)) return c.html(forbidden(user), 403);
  const items = await db.listOutbox(c.env.DB);
  const rows = items.map((o: any) => `<tr><td class="sub" style="white-space:nowrap">${esc((o.at ?? "").slice(0, 16).replace("T", " "))}</td>
    <td>${chip(o.channel)}<div class="name" style="margin-top:4px">${esc(o.subject)}</div><div class="sub">${esc(o.event)} → ${esc(o.recipients)}</div></td>
    <td class="sub">${esc(o.status)}</td></tr>`).join("");
  const body = `<div class="panel"><h2>Notifications & integrations log</h2><div class="tablewrap"><table>
    <thead><tr><th>When</th><th>Message</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="muted" style="text-align:center;padding:24px">Nothing yet.</td></tr>`}</tbody></table></div></div>`;
  return c.html(layout({ title: "Notifications log", user, active: "/outbox", body }));
});

app.get("/audit", async (c) => {
  const user = c.get("user"); if (!canConfigure(user.role)) return c.html(forbidden(user), 403);
  const items = await db.listAudit(c.env.DB);
  const rows = items.map((a: any) => `<tr><td class="sub" style="white-space:nowrap">${esc((a.at ?? "").slice(0, 16).replace("T", " "))}</td>
    <td>${esc(a.actor)}</td><td>${chip(a.action)}</td><td>${esc(a.entity)} <span class="sub">${esc(a.detail ?? "")}</span></td></tr>`).join("");
  const body = `<div class="panel"><h2>Audit trail</h2><div class="tablewrap"><table>
    <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">Nothing yet.</td></tr>`}</tbody></table></div></div>`;
  return c.html(layout({ title: "Audit trail", user, active: "/audit", body }));
});

// ===========================================================================
// SYSTEM: health + cron
// ===========================================================================
app.get("/health", (c) => c.json({ ok: true }));

// Cron endpoint (called by Cloudflare Cron and/or GitHub Actions fallback).
// Protected by CRON_SECRET when set.
async function runCron(env: Env): Promise<{ reports: number; slaAlerts: number }> {
  const reports = await runDueSchedules(env, now());
  // SLA / delay check: overdue, not-done, not-blocked tasks for in-progress candidates.
  const candidates = await db.listCandidates(env.DB);
  let slaAlerts = 0;
  for (const cc of candidates) {
    if (cc.status !== "in_progress") continue;
    const tasks = await db.listTasks(env.DB, cc.id);
    for (const t of tasks) {
      if (!t.done && !t.blocked && t.targetDate && daysBetween(t.targetDate, now()) < 0) {
        await notify(env, "sla_breach", { subject: `Overdue — ${cc.name}: ${t.label}`, body: `Task "${t.label}" for ${cc.name} was due ${t.targetDate}.`, extraRoles: [t.team as Role] });
        slaAlerts++;
      }
    }
  }
  return { reports, slaAlerts };
}

app.all("/cron", async (c) => {
  const secret = c.env.CRON_SECRET;
  if (secret && c.req.query("key") !== secret) return c.text("unauthorized", 401);
  const r = await runCron(c.env);
  return c.json({ ok: true, ...r });
});

export default {
  fetch: app.fetch,
  // Cloudflare Cron Trigger entrypoint.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await db.ensureSchema(env.DB);
    await runCron(env);
  },
};
