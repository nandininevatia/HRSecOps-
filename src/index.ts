// ---------------------------------------------------------------------------
// Onboarding Tracker - main application.
//
// This is the "brain" that runs on Cloudflare. Right now it does one job:
// show a dashboard of all new joiners and the onboarding stage each one is at.
//
// It uses Hono, a small toolkit for building web apps. The dashboard is built
// as plain HTML so there is no complicated build step to learn yet.
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import { STAGES, JOINERS, type Joiner } from "./data";

const app = new Hono();

// --- Small helpers -----------------------------------------------------------

function daysBetween(fromISO: string, to: Date): number {
  const from = new Date(fromISO + "T00:00:00Z");
  const ms = from.getTime() - Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

type Status = { label: string; tone: "good" | "warn" | "bad" | "done" };

function statusFor(j: Joiner, today: Date): Status {
  const isOnboarded = j.stageIndex >= STAGES.length - 1;
  if (isOnboarded) return { label: "Onboarded", tone: "done" };
  if (j.blocked) return { label: "Blocked", tone: "bad" };

  const days = daysBetween(j.joiningDate, today);
  if (days < 0) return { label: "Overdue", tone: "bad" }; // joined but not onboarded
  if (days <= 7) return { label: "Joining soon", tone: "warn" };
  return { label: "On track", tone: "good" };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- The dashboard page ------------------------------------------------------

function renderDashboard(today: Date): string {
  const total = JOINERS.length;
  const onboarded = JOINERS.filter((j) => j.stageIndex >= STAGES.length - 1).length;
  const blocked = JOINERS.filter((j) => j.blocked && j.stageIndex < STAGES.length - 1).length;
  const inProgress = total - onboarded;

  const rows = JOINERS
    .slice()
    .sort((a, b) => a.joiningDate.localeCompare(b.joiningDate))
    .map((j) => {
      const stage = STAGES[j.stageIndex];
      const status = statusFor(j, today);
      const pct = Math.round(((j.stageIndex + 1) / STAGES.length) * 100);
      const days = daysBetween(j.joiningDate, today);
      const dayLabel =
        days === 0 ? "Joins today" : days > 0 ? `Joins in ${days}d` : `Joined ${Math.abs(days)}d ago`;
      const typeLabel = j.joinerType === "immediate" ? "Immediate" : "Non-immediate";

      return `
        <tr>
          <td>
            <div class="name">${escapeHtml(j.name)}</div>
            <div class="sub">${escapeHtml(j.role)} &middot; ${escapeHtml(j.department)}</div>
          </td>
          <td><span class="chip">${typeLabel}</span></td>
          <td>
            <div>${escapeHtml(j.joiningDate)}</div>
            <div class="sub">${dayLabel}</div>
          </td>
          <td style="min-width:220px">
            <div class="stage">${escapeHtml(stage.label)}</div>
            <div class="bar"><span style="width:${pct}%"></span></div>
            <div class="sub">${pct}% &middot; owner: ${escapeHtml(stage.owner)}</div>
          </td>
          <td>
            <span class="status status-${status.tone}">${status.label}</span>
            ${j.blocked ? `<div class="sub blocked">${escapeHtml(j.blocked)}</div>` : ""}
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Onboarding Tracker</title>
  <style>
    :root {
      --bg:#f5f6fa; --card:#ffffff; --ink:#1f2440; --muted:#71748a;
      --line:#e7e9f2; --brand:#4b40c9; --good:#1a8a55; --warn:#b97400; --bad:#c33636;
    }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 60px; }
    header h1 { margin:0 0 4px; font-size: 26px; }
    header p { margin:0; color: var(--muted); }
    .cards { display:grid; grid-template-columns: repeat(4, 1fr); gap:14px; margin:24px 0; }
    @media (max-width:720px){ .cards{ grid-template-columns: repeat(2,1fr);} }
    .stat { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; }
    .stat .num { font-size:28px; font-weight:700; }
    .stat .lbl { color:var(--muted); font-size:13px; margin-top:2px; }
    .panel { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
    .panel h2 { margin:0; padding:16px 18px; font-size:16px; border-bottom:1px solid var(--line); }
    .tablewrap { overflow-x:auto; }
    table { width:100%; border-collapse: collapse; font-size:14px; }
    th { text-align:left; color:var(--muted); font-weight:600; font-size:12px;
      text-transform:uppercase; letter-spacing:.03em; padding:12px 18px; border-bottom:1px solid var(--line); }
    td { padding:14px 18px; border-bottom:1px solid var(--line); vertical-align:top; }
    tr:last-child td { border-bottom:none; }
    .name { font-weight:600; }
    .sub { color:var(--muted); font-size:12.5px; margin-top:3px; }
    .sub.blocked { color:var(--bad); }
    .chip { background:#eef0fb; color:var(--brand); border-radius:999px; padding:3px 10px; font-size:12px; font-weight:600; }
    .stage { font-weight:600; margin-bottom:6px; }
    .bar { background:#eef0f6; border-radius:999px; height:8px; overflow:hidden; }
    .bar span { display:block; height:100%; background:var(--brand); border-radius:999px; }
    .status { border-radius:999px; padding:4px 11px; font-size:12px; font-weight:700; white-space:nowrap; }
    .status-good { background:#e4f6ec; color:var(--good); }
    .status-warn { background:#fbf0dc; color:var(--warn); }
    .status-bad  { background:#fbe4e4; color:var(--bad); }
    .status-done { background:#e9e7fb; color:var(--brand); }
    footer { color:var(--muted); font-size:12.5px; margin-top:20px; text-align:center; }
    .demo { background:#fff7e6; border:1px solid #ffe2a8; color:#7a5200;
      padding:10px 14px; border-radius:10px; font-size:13px; margin-bottom:20px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Onboarding Tracker</h1>
      <p>Every new joiner, from offer acceptance to fully onboarded.</p>
    </header>

    <div class="demo">Showing <strong>demo data</strong> for now. The next step connects a real database so you can add live joiners.</div>

    <div class="cards">
      <div class="stat"><div class="num">${total}</div><div class="lbl">Total joiners</div></div>
      <div class="stat"><div class="num">${inProgress}</div><div class="lbl">In progress</div></div>
      <div class="stat"><div class="num">${blocked}</div><div class="lbl">Blocked</div></div>
      <div class="stat"><div class="num">${onboarded}</div><div class="lbl">Onboarded</div></div>
    </div>

    <div class="panel">
      <h2>New joiners</h2>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Joiner</th><th>Type</th><th>Joining date</th><th>Current stage</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <footer>Onboarding Tracker &middot; running free on Cloudflare</footer>
  </div>
</body>
</html>`;
}

// --- Routes ------------------------------------------------------------------

app.get("/", (c) => {
  const today = new Date();
  return c.html(renderDashboard(today));
});

// A simple health check, handy later for the daily "alarm clock".
app.get("/health", (c) => c.json({ ok: true }));

export default app;
