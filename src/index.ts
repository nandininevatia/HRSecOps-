// ---------------------------------------------------------------------------
// Onboarding Tracker - main application.
//
// Phase 2: joiners now live in a real database (Cloudflare D1). You can add a
// joiner, move them through stages, mark/clear a blocker, view a detail page
// with auto-calculated key dates, and remove a joiner.
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import {
  STAGES,
  LAST_STAGE,
  computeSchedule,
  daysBetween,
  statusFor,
  type Joiner,
  type JoinerType,
} from "./data";
import {
  listJoiners,
  getJoiner,
  createJoiner,
  moveStage,
  setBlocked,
  deleteJoiner,
} from "./db";

type Env = { DB: D1Database };

const app = new Hono<{ Bindings: Env }>();

// --- Shared bits -------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLES = `
  :root {
    --bg:#f5f6fa; --card:#ffffff; --ink:#1f2440; --muted:#71748a;
    --line:#e7e9f2; --brand:#4b40c9; --good:#1a8a55; --warn:#b97400; --bad:#c33636;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  a { color: var(--brand); text-decoration: none; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 60px; }
  header h1 { margin:0 0 4px; font-size: 26px; }
  header p { margin:0; color: var(--muted); }
  .topbar { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
  .btn { display:inline-block; background:var(--brand); color:#fff; border:none; border-radius:10px;
    padding:9px 15px; font-size:14px; font-weight:600; cursor:pointer; }
  .btn.secondary { background:#eef0fb; color:var(--brand); }
  .btn.ghost { background:transparent; color:var(--muted); border:1px solid var(--line); }
  .btn.danger { background:#fbe4e4; color:var(--bad); }
  .btn.small { padding:6px 11px; font-size:13px; border-radius:8px; }
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
  form.inline { display:inline; }
  .field { margin-bottom:14px; }
  .field label { display:block; font-size:13px; font-weight:600; margin-bottom:5px; }
  .field input, .field select { width:100%; padding:10px 12px; border:1px solid var(--line);
    border-radius:10px; font-size:14px; background:#fff; }
  .row2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:560px){ .row2{ grid-template-columns:1fr;} }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
  .steps { list-style:none; padding:0; margin:0; }
  .steps li { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); }
  .steps li:last-child { border-bottom:none; }
  .dot { width:18px; height:18px; border-radius:50%; border:2px solid var(--line); flex:none; }
  .dot.done { background:var(--brand); border-color:var(--brand); }
  .dot.current { border-color:var(--brand); box-shadow:0 0 0 3px #e9e7fb; }
  .back { font-size:13px; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title><style>${STYLES}</style>
</head><body><div class="wrap">${body}
<footer>Onboarding Tracker · running free on Cloudflare</footer>
</div></body></html>`;
}

// --- Dashboard ---------------------------------------------------------------

function dashboardBody(joiners: Joiner[], today: Date): string {
  const total = joiners.length;
  const onboarded = joiners.filter((j) => j.stageIndex >= LAST_STAGE).length;
  const blocked = joiners.filter((j) => j.blocked && j.stageIndex < LAST_STAGE).length;
  const inProgress = total - onboarded;

  const rows = joiners
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
            <div class="name"><a href="/joiners/${j.id}">${esc(j.name)}</a></div>
            <div class="sub">${esc(j.role)}${j.department ? " · " + esc(j.department) : ""}</div>
          </td>
          <td><span class="chip">${typeLabel}</span></td>
          <td><div>${esc(j.joiningDate)}</div><div class="sub">${dayLabel}</div></td>
          <td style="min-width:220px">
            <div class="stage">${esc(stage.label)}</div>
            <div class="bar"><span style="width:${pct}%"></span></div>
            <div class="sub">${pct}% · owner: ${esc(stage.owner)}</div>
          </td>
          <td>
            <span class="status status-${status.tone}">${status.label}</span>
            ${j.blocked ? `<div class="sub blocked">${esc(j.blocked)}</div>` : ""}
          </td>
        </tr>`;
    })
    .join("");

  const emptyRow = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px">
    No joiners yet. Click <strong>Add joiner</strong> to create the first one.</td></tr>`;

  return `
    <div class="topbar">
      <header>
        <h1>Onboarding Tracker</h1>
        <p>Every new joiner, from offer acceptance to fully onboarded.</p>
      </header>
      <a class="btn" href="/joiners/new">+ Add joiner</a>
    </div>

    <div class="cards">
      <div class="stat"><div class="num">${total}</div><div class="lbl">Total joiners</div></div>
      <div class="stat"><div class="num">${inProgress}</div><div class="lbl">In progress</div></div>
      <div class="stat"><div class="num">${blocked}</div><div class="lbl">Blocked</div></div>
      <div class="stat"><div class="num">${onboarded}</div><div class="lbl">Onboarded</div></div>
    </div>

    <div class="panel">
      <h2>New joiners</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>Joiner</th><th>Type</th><th>Joining date</th><th>Current stage</th><th>Status</th></tr></thead>
        <tbody>${rows || emptyRow}</tbody>
      </table></div>
    </div>`;
}

// --- Add-joiner form ---------------------------------------------------------

function newJoinerBody(): string {
  return `
    <div class="topbar"><header><h1>Add joiner</h1>
      <p>Enter the basics. The journey starts at "Offer Accepted".</p></header>
      <a class="back" href="/">← Back to dashboard</a></div>
    <div class="panel"><div style="padding:18px">
      <form method="post" action="/joiners">
        <div class="field"><label>Full name</label>
          <input name="name" required placeholder="e.g. Aarav Sharma" /></div>
        <div class="row2">
          <div class="field"><label>Role</label>
            <input name="role" placeholder="e.g. Backend Engineer" /></div>
          <div class="field"><label>Department</label>
            <input name="department" placeholder="e.g. Engineering" /></div>
        </div>
        <div class="row2">
          <div class="field"><label>Joiner type</label>
            <select name="joinerType">
              <option value="non_immediate">Non-immediate (NDA required)</option>
              <option value="immediate">Immediate (NDA not mandatory)</option>
            </select></div>
          <div class="field"><label>Joining date</label>
            <input type="date" name="joiningDate" required /></div>
        </div>
        <button class="btn" type="submit">Create joiner</button>
      </form>
    </div></div>`;
}

// --- Joiner detail -----------------------------------------------------------

function detailBody(j: Joiner, today: Date): string {
  const status = statusFor(j, today);
  const schedule = computeSchedule(j.joiningDate);
  const steps = STAGES.map((s, i) => {
    const cls = i < j.stageIndex ? "done" : i === j.stageIndex ? "current" : "";
    return `<li><span class="dot ${cls}"></span>
      <span>${esc(s.label)} <span class="sub" style="margin:0">· ${esc(s.owner)}</span></span></li>`;
  }).join("");

  const scheduleRows = schedule
    .map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.date)}</td></tr>`)
    .join("");

  const atStart = j.stageIndex <= 0;
  const atEnd = j.stageIndex >= LAST_STAGE;

  return `
    <div class="topbar"><header>
      <h1>${esc(j.name)}</h1>
      <p>${esc(j.role)}${j.department ? " · " + esc(j.department) : ""} ·
         ${j.joinerType === "immediate" ? "Immediate joiner" : "Non-immediate joiner"}</p>
    </header><a class="back" href="/">← Back to dashboard</a></div>

    <div class="cards" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat"><div class="num">${esc(j.joiningDate)}</div><div class="lbl">Joining date</div></div>
      <div class="stat"><div class="num">${esc(STAGES[j.stageIndex].label)}</div><div class="lbl">Current stage</div></div>
      <div class="stat"><div class="num"><span class="status status-${status.tone}">${status.label}</span></div><div class="lbl">Status</div></div>
    </div>

    ${j.blocked ? `<div class="panel" style="margin-bottom:16px"><div style="padding:14px 18px;color:var(--bad)">
      <strong>Blocked:</strong> ${esc(j.blocked)}</div></div>` : ""}

    <div class="panel" style="margin-bottom:16px"><div style="padding:16px 18px">
      <div class="actions">
        <form class="inline" method="post" action="/joiners/${j.id}/move">
          <input type="hidden" name="direction" value="1" />
          <button class="btn" ${atEnd ? "disabled style=opacity:.5" : ""}>Advance to next stage →</button>
        </form>
        <form class="inline" method="post" action="/joiners/${j.id}/move">
          <input type="hidden" name="direction" value="-1" />
          <button class="btn secondary" ${atStart ? "disabled style=opacity:.5" : ""}>← Move back</button>
        </form>
      </div>
      <form method="post" action="/joiners/${j.id}/block" style="margin-top:16px">
        <div class="field" style="margin-bottom:8px"><label>Blocker (leave empty to clear)</label>
          <input name="reason" value="${j.blocked ? esc(j.blocked) : ""}" placeholder="e.g. Laptop not allocated" /></div>
        <button class="btn ghost small">Save blocker</button>
      </form>
    </div></div>

    <div class="panel" style="margin-bottom:16px"><h2>Onboarding journey</h2>
      <div style="padding:6px 18px 14px"><ul class="steps">${steps}</ul></div></div>

    <div class="panel" style="margin-bottom:16px"><h2>Key dates (auto-calculated)</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>Milestone</th><th>Target date</th></tr></thead>
        <tbody>${scheduleRows}</tbody></table></div></div>

    <form method="post" action="/joiners/${j.id}/delete"
      onsubmit="return confirm('Remove this joiner permanently?')">
      <button class="btn danger small">Remove joiner</button>
    </form>`;
}

// --- Routes ------------------------------------------------------------------

app.get("/", async (c) => {
  const joiners = await listJoiners(c.env.DB);
  return c.html(layout("Onboarding Tracker", dashboardBody(joiners, new Date())));
});

app.get("/joiners/new", (c) => c.html(layout("Add joiner", newJoinerBody())));

app.post("/joiners", async (c) => {
  const form = await c.req.formData();
  const name = String(form.get("name") ?? "").trim();
  const joiningDate = String(form.get("joiningDate") ?? "").trim();
  if (!name || !joiningDate) return c.redirect("/joiners/new");
  const joinerType: JoinerType =
    String(form.get("joinerType")) === "immediate" ? "immediate" : "non_immediate";
  await createJoiner(c.env.DB, {
    name,
    role: String(form.get("role") ?? "").trim(),
    department: String(form.get("department") ?? "").trim(),
    joinerType,
    joiningDate,
  });
  return c.redirect("/");
});

app.get("/joiners/:id", async (c) => {
  const j = await getJoiner(c.env.DB, c.req.param("id"));
  if (!j) return c.notFound();
  return c.html(layout(j.name, detailBody(j, new Date())));
});

app.post("/joiners/:id/move", async (c) => {
  const id = c.req.param("id");
  const form = await c.req.formData();
  const direction = String(form.get("direction")) === "-1" ? -1 : 1;
  await moveStage(c.env.DB, id, direction);
  return c.redirect(`/joiners/${id}`);
});

app.post("/joiners/:id/block", async (c) => {
  const id = c.req.param("id");
  const form = await c.req.formData();
  await setBlocked(c.env.DB, id, String(form.get("reason") ?? ""));
  return c.redirect(`/joiners/${id}`);
});

app.post("/joiners/:id/delete", async (c) => {
  await deleteJoiner(c.env.DB, c.req.param("id"));
  return c.redirect("/");
});

// Health check, handy later for the daily "alarm clock".
app.get("/health", (c) => c.json({ ok: true }));

export default app;
