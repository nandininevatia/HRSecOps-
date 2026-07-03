# GoComet Onboarding & Facilitators Platform

A free, self-hosted platform that gives **IT, HR, and TA** teams a shared way to
run and monitor employee onboarding — with **read-only dashboards for
Management** and a single **Admin**. Built on Cloudflare's free tier.

See **[docs/PRD.md](docs/PRD.md)** for the full product spec and
**[docs/BUILD_PROMPT.md](docs/BUILD_PROMPT.md)** for the build brief.

---

## What it does

- **Two interfaces:** an input backend (team-scoped) and monitoring dashboards.
- **Freshservice-style intake** + **CSV import** from the sheets teams already keep.
- **Full onboarding journey** modelled from the TA/HR/IT notes, incl. the Day-1
  automation bundle (email, JumpCloud, Slack, Google DL, Keka) and manager induction.
- **Analytics:** offered→onboarded funnel, back-out % and back-out by stage,
  offered/onboarded/offboarded, average cycle times, tasks-on-time, live blockers —
  all filterable by department, employment type, case type, status, and date.
- **Alerts & triggers:** blocker alerts, overdue/SLA alerts, and a configurable
  notification matrix (pre-seeded with the recipient lists from the notes).
- **Scheduled reports:** daily pipeline digest & weekly funnel summary via
  Cloudflare Cron, with a GitHub Actions fallback.
- **Roles:** Admin, Management (read-only), TA, HR, IT, Hiring Manager, Viewer.
- **Audit trail** + **notifications/integrations log** for full traceability.
- **Integration-ready:** pluggable adapters for Freshservice, Keka, JumpCloud,
  Slack, Google Workspace, Ongrid (feature-flagged; simulated + logged until
  live API keys are added — the flow never breaks).

---

## How it's built (all free tiers)

- **Cloudflare Workers** (app) · **Hono** (framework) · **Cloudflare D1** (database)
- **Cloudflare Access** (company login, ≤50 users) · **Cloudflare Cron** (schedules)
- **Resend** (email, optional) · **GitHub Actions** (deploy + cron fallback)

The database schema is **auto-created on first run** — no manual migration step.

---

## Run locally

```bash
npm install
# simulate a logged-in user locally (production uses Cloudflare Access):
echo 'DEV_EMAIL="you@gocomet.com"' > .dev.vars
npm run dev
```

Open the printed URL (usually http://localhost:8787). The first user becomes Admin.

## Go live

1. Cloudflare **Workers & Pages → Connect to Git** → this repo → deploy command `npx wrangler deploy`.
2. Ensure the free **D1 database** ID is set in `wrangler.jsonc`.
3. Turn on **Cloudflare Access** (Zero Trust) in front of the app for login.
4. (Optional) Add `RESEND_API_KEY` + `MAIL_FROM` for real emails, and `CRON_SECRET`
   to protect the `/cron` endpoint.

---

## Configuration (Admin → Settings)

- **Notification matrix** — who is notified for each event.
- **Integrations** — enable/disable each external system.
- **Scheduled reports** — cadence + recipients.

## Roadmap

- [x] Data model, Freshservice-parity intake, CSV import
- [x] Team cuts, task checklists, blockers, back-out, offboard
- [x] Analytics dashboards + filters + Management overview (GoComet theme)
- [x] Alerts/triggers (blocker + SLA) + notification matrix
- [x] Scheduled reports (Cron + Actions fallback)
- [x] Integration adapter layer (simulated + logged)
- [ ] Live integration API wiring (Freshservice/Slack first)
- [ ] Full offboarding flow
