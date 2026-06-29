// ---------------------------------------------------------------------------
// Onboarding Tracker - main application.
//
// Phase 3: logins & team roles.
//  - Identity comes from Cloudflare Access (company login). See src/auth.ts.
//  - Each person has a role (Admin, HR, TA, IT, Office Admin, Manager, Viewer).
//  - Dashboard shows "My queue" (joiners my team owns right now) and
//    "All joiners". Admins manage the team directory on the Team page.
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import {
  STAGES,
  LAST_STAGE,
  ROLE_LABELS,
  ALL_ROLES,
  canSeeAll,
  canAct,
  canManageTeam,
  canDeleteJoiner,
  stageOwnedByRole,
  computeSchedule,
  daysBetween,
  statusFor,
  type Joiner,
  type JoinerType,
  type Role,
} from "./data";
import {
  ensureSchema,
  listJoiners,
  getJoiner,
  createJoiner,
  moveStage,
  setBlocked,
  deleteJoiner,
  listUsers,
  upsertUser,
  deleteUser,
  type User,
} from "./db";
import { identityEmail, resolveUser } from "./auth";

type Env = { DB: D1Database; DEV_EMAIL?: string };
type Variables = { user: User };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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
  .wrap { max-width: 1080px; margin: 0 auto; padding: 22px 20px 60px; }
  .nav { display:flex; align-items:center; justify-content:space-between; gap:16px;
    padding:12px 20px; background:#fff; border-bottom:1px solid var(--line); }
  .nav .brand { font-weight:700; }
  .nav .links a { margin-left:16px; font-size:14px; font-weight:600; }
  .nav .who { font-size:13px; color:var(--muted); }
  .nav .who .role { background:#eef0fb; color:var(--brand); border-radius:999px; padding:2px 9px; font-weight:700; margin-left:6px; }
  header h1 { margin:0 0 4px; font-size: 26px; }
  header p { margin:0; color: var(--muted); }
  .topbar { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
  .btn { display:inline-block; background:var(--brand); color:#fff; border:none; border-radius:10px;
    padding:9px 15px; font-size:14px; font-weight:600; cursor:pointer; }
  .btn.secondary { background:#eef0fb; color:var(--brand); }
  .btn.ghost { background:transparent; color:var(--muted); border:1px solid var(--line); }
  .btn.danger { background:#fbe4e4; color:var(--bad); }
  .btn.small { padding:6px 11px; font-size:13px; border-radius:8px; }
  .tabs { display:flex; gap:8px; margin:20px 0 4px; }
  .tabs a { padding:8px 14px; border-radius:999px; font-size:14px; font-weight:600;
    background:#eef0f6; color:var(--muted); }
  .tabs a.active { background:var(--brand); color:#fff; }
  .cards { display:grid; grid-template-columns: repeat(4, 1fr); gap:14px; margin:18px 0; }
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
  .banner { background:#fff7e6; border:1px solid #ffe2a8; color:#7a5200;
    padding:10px 14px; border-radius:10px; font-size:13px; margin:16px 0; }
`;

function nav(user: User): string {
  const links = [`<a href="/">Dashboard</a>`];
  if (canManageTeam(user.role)) links.push(`<a href="/team">Team</a>`);
  return `<div class="nav">
    <div><span class="brand">Onboarding Tracker</span></div>
    <div class="links">${links.join("")}</div>
    <div class="who">${esc(user.name || user.email)}<span class="role">${ROLE_LABELS[user.role]}</span></div>
  </div>`;
}

function layout(title: string, body: string, user?: User): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title><style>${STYLES}</style>
</head><body>
${user ? nav(user) : ""}
<div class="wrap">${body}
<footer>Onboarding Tracker · running free on Cloudflare</footer>
</div></body></html>`;
}

function signInRequiredPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign-in required</title><style>${STYLES}</style></head>
<body><div class="wrap">
  <header><h1>Sign-in required</h1></header>
  <div class="banner">This app must be opened through your company login
  (Cloudflare Access). If you are seeing this, sign-in is not configured yet,
  or your session has expired. Please contact your administrator.</div>
</div></body></html>`;
}

// --- Dashboard ---------------------------------------------------------------

function dashboardBody(all: Joiner[], user: User, today: Date, view: "mine" | "all"): string {
  const role = user.role;
  const mine = all.filter((j) => j.stageIndex < LAST_STAGE && stageOwnedByRole(j.stageIndex, role));
  const shown = view === "mine" ? mine : all;

  const total = all.length;
  const onboarded = all.filter((j) => j.stageIndex >= LAST_STAGE).length;
  const blocked = all.filter((j) => j.blocked && j.stageIndex < LAST_STAGE).length;
  const inProgress = total - onboarded;

  const rows = shown
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
          <td><div class="name"><a href="/joiners/${j.id}">${esc(j.name)}</a></div>
            <div class="sub">${esc(j.role)}${j.department ? " · " + esc(j.department) : ""}</div></td>
          <td><span class="chip">${typeLabel}</span></td>
          <td><div>${esc(j.joiningDate)}</div><div class="sub">${dayLabel}</div></td>
          <td style="min-width:220px"><div class="stage">${esc(stage.label)}</div>
            <div class="bar"><span style="width:${pct}%"></span></div>
            <div class="sub">${pct}% · owner: ${esc(stage.owner)}</div></td>
          <td><span class="status status-${status.tone}">${status.label}</span>
            ${j.blocked ? `<div class="sub blocked">${esc(j.blocked)}</div>` : ""}</td>
        </tr>`;
    })
    .join("");

  const emptyMsg =
    view === "mine"
      ? "Nothing in your queue right now. 🎉"
      : "No joiners yet. Click <strong>Add joiner</strong> to create the first one.";
  const emptyRow = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px">${emptyMsg}</td></tr>`;

  const addBtn = canAct(role) ? `<a class="btn" href="/joiners/new">+ Add joiner</a>` : "";
  const viewerBanner =
    role === "viewer"
      ? `<div class="banner">You don't have a team role yet, so this is read-only.
         Ask an admin to assign your role on the Team page.</div>`
      : "";

  return `
    <div class="topbar">
      <header><h1>Onboarding Tracker</h1>
        <p>Every new joiner, from offer acceptance to fully onboarded.</p></header>
      ${addBtn}
    </div>
    ${viewerBanner}
    <div class="cards">
      <div class="stat"><div class="num">${total}</div><div class="lbl">Total joiners</div></div>
      <div class="stat"><div class="num">${inProgress}</div><div class="lbl">In progress</div></div>
      <div class="stat"><div class="num">${blocked}</div><div class="lbl">Blocked</div></div>
      <div class="stat"><div class="num">${onboarded}</div><div class="lbl">Onboarded</div></div>
    </div>
    <div class="tabs">
      <a href="/?view=mine" class="${view === "mine" ? "active" : ""}">My queue (${mine.length})</a>
      <a href="/?view=all" class="${view === "all" ? "active" : ""}">All joiners (${total})</a>
    </div>
    <div class="panel">
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

function detailBody(j: Joiner, user: User, today: Date): string {
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
  const mayAct = canAct(user.role);

  const controls = mayAct
    ? `<div class="panel" style="margin-bottom:16px"><div style="padding:16px 18px">
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
      </div></div>`
    : "";

  const deleteBtn = canDeleteJoiner(user.role)
    ? `<form method="post" action="/joiners/${j.id}/delete"
         onsubmit="return confirm('Remove this joiner permanently?')">
         <button class="btn danger small">Remove joiner</button></form>`
    : "";

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
    ${controls}

    <div class="panel" style="margin-bottom:16px"><h2>Onboarding journey</h2>
      <div style="padding:6px 18px 14px"><ul class="steps">${steps}</ul></div></div>

    <div class="panel" style="margin-bottom:16px"><h2>Key dates (auto-calculated)</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>Milestone</th><th>Target date</th></tr></thead>
        <tbody>${scheduleRows}</tbody></table></div></div>

    ${deleteBtn}`;
}

// --- Team management ---------------------------------------------------------

function teamBody(users: User[], me: User): string {
  const roleOptions = (selected: Role) =>
    ALL_ROLES.map(
      (r) => `<option value="${r}" ${r === selected ? "selected" : ""}>${ROLE_LABELS[r]}</option>`,
    ).join("");

  const rows = users
    .map((u) => {
      const isMe = u.email === me.email;
      return `<tr>
        <td><div class="name">${esc(u.name || u.email)}${isMe ? " (you)" : ""}</div>
          <div class="sub">${esc(u.email)}</div></td>
        <td>
          <form class="inline" method="post" action="/team/save">
            <input type="hidden" name="email" value="${esc(u.email)}" />
            <input type="hidden" name="name" value="${esc(u.name)}" />
            <select name="role" onchange="this.form.submit()">${roleOptions(u.role)}</select>
          </form>
        </td>
        <td>${
          isMe
            ? `<span class="sub">—</span>`
            : `<form class="inline" method="post" action="/team/delete"
                 onsubmit="return confirm('Remove ${esc(u.email)}?')">
                 <input type="hidden" name="email" value="${esc(u.email)}" />
                 <button class="btn danger small">Remove</button></form>`
        }</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="topbar"><header><h1>Team</h1>
      <p>Who can use the app and what each person can see and do.</p></header>
      <a class="back" href="/">← Back to dashboard</a></div>

    <div class="panel" style="margin-bottom:16px">
      <h2>Members</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>Person</th><th>Role</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>

    <div class="panel"><h2>Add / invite a person</h2><div style="padding:18px">
      <p class="sub" style="margin-top:0">Add someone by their company email so their
      role is ready the moment they first sign in.</p>
      <form method="post" action="/team/save">
        <div class="row2">
          <div class="field"><label>Email</label>
            <input name="email" type="email" required placeholder="name@company.com" /></div>
          <div class="field"><label>Name</label>
            <input name="name" placeholder="Full name" /></div>
        </div>
        <div class="field"><label>Role</label>
          <select name="role">${roleOptions("hr")}</select></div>
        <button class="btn">Save person</button>
      </form>
    </div></div>`;
}

function forbiddenBody(): string {
  return `<div class="topbar"><header><h1>Not allowed</h1>
    <p>Your role doesn't have permission for that action.</p></header>
    <a class="back" href="/">← Back to dashboard</a></div>`;
}

// --- Middleware: ensure schema + identity ------------------------------------

app.use("*", async (c, next) => {
  if (c.req.path === "/health") return next();
  if (!c.env.DB) return c.text("Database not configured", 500);
  await ensureSchema(c.env.DB);

  const email = identityEmail(c);
  if (!email) return c.html(signInRequiredPage(), 401);

  const user = await resolveUser(c.env.DB, email);
  c.set("user", user);
  await next();
});

// --- Routes ------------------------------------------------------------------

app.get("/", async (c) => {
  const user = c.get("user");
  const joiners = await listJoiners(c.env.DB);
  const requested = c.req.query("view");
  const view: "mine" | "all" =
    requested === "all" ? "all" : requested === "mine" ? "mine" : canSeeAll(user.role) ? "all" : "mine";
  return c.html(layout("Onboarding Tracker", dashboardBody(joiners, user, new Date(), view), user));
});

app.get("/joiners/new", (c) => {
  const user = c.get("user");
  if (!canAct(user.role)) return c.html(layout("Not allowed", forbiddenBody(), user), 403);
  return c.html(layout("Add joiner", newJoinerBody(), user));
});

app.post("/joiners", async (c) => {
  const user = c.get("user");
  if (!canAct(user.role)) return c.html(layout("Not allowed", forbiddenBody(), user), 403);
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
  const user = c.get("user");
  const j = await getJoiner(c.env.DB, c.req.param("id"));
  if (!j) return c.notFound();
  return c.html(layout(j.name, detailBody(j, user, new Date()), user));
});

app.post("/joiners/:id/move", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!canAct(user.role)) return c.html(layout("Not allowed", forbiddenBody(), user), 403);
  const form = await c.req.formData();
  const direction = String(form.get("direction")) === "-1" ? -1 : 1;
  await moveStage(c.env.DB, id, direction);
  return c.redirect(`/joiners/${id}`);
});

app.post("/joiners/:id/block", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!canAct(user.role)) return c.html(layout("Not allowed", forbiddenBody(), user), 403);
  const form = await c.req.formData();
  await setBlocked(c.env.DB, id, String(form.get("reason") ?? ""));
  return c.redirect(`/joiners/${id}`);
});

app.post("/joiners/:id/delete", async (c) => {
  const user = c.get("user");
  if (!canDeleteJoiner(user.role)) return c.html(layout("Not allowed", forbiddenBody(), user), 403);
  await deleteJoiner(c.env.DB, c.req.param("id"));
  return c.redirect("/");
});

// Team management (admins only)
app.get("/team", async (c) => {
  const user = c.get("user");
  if (!canManageTeam(user.role)) return c.html(layout("Not allowed", forbiddenBody(), user), 403);
  const users = await listUsers(c.env.DB);
  return c.html(layout("Team", teamBody(users, user), user));
});

app.post("/team/save", async (c) => {
  const user = c.get("user");
  if (!canManageTeam(user.role)) return c.html(layout("Not allowed", forbiddenBody(), user), 403);
  const form = await c.req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "viewer") as Role;
  const validRole = ALL_ROLES.includes(role) ? role : "viewer";
  if (email.includes("@")) {
    await upsertUser(c.env.DB, { email, name: String(form.get("name") ?? "").trim(), role: validRole });
  }
  return c.redirect("/team");
});

app.post("/team/delete", async (c) => {
  const user = c.get("user");
  if (!canManageTeam(user.role)) return c.html(layout("Not allowed", forbiddenBody(), user), 403);
  const form = await c.req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email && email !== user.email) await deleteUser(c.env.DB, email); // can't delete yourself
  return c.redirect("/team");
});

// Health check (no login needed), handy for the daily "alarm clock".
app.get("/health", (c) => c.json({ ok: true }));

export default app;
