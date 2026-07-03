# Claude Code Build Prompt
## GoComet Onboarding & Facilitators Platform

Copy everything in the block below and paste it into Claude Code as your build
instruction. It is written to build the product incrementally, test each part,
and keep everything free-tier and on the main branch.

> Tip: You don't have to paste the whole thing at once. You can paste the
> "Context & rules" section first, then feed one "Phase" at a time as you go —
> testing after each. The prompt is designed to work either way.

---

```
You are my product architect and senior engineer. Build the "GoComet Onboarding
& Facilitators Platform" described in docs/PRD.md. Read docs/PRD.md fully before
writing any code, and treat it as the source of truth. I am non-technical:
explain each step in plain language, and after each phase tell me exactly what to
click to see it working.

CONTEXT & RULES
- Build on the existing foundation in this repo: Cloudflare Workers + Hono +
  Cloudflare D1 + Cloudflare Access (login) + Resend (email) + Cloudflare Cron.
  Reuse what's already here (joiners/stages/roles) and evolve it toward the PRD.
- Everything MUST stay on FREE tiers (Cloudflare, GitHub incl. Actions, Resend).
  Never introduce a paid service without asking me first. If something needs a
  one-time free setup from me (a database, an API key, a webhook), pause and give
  me click-by-click instructions.
- Work directly on the main branch. Commit after each phase with a clear message.
  Do not open pull requests unless I ask.
- The app holds employee PII. Enforce company-login (Cloudflare Access) and
  role-based access. Fail closed if no identity is present. Keep secrets in
  Cloudflare, never in code.
- Type-check and run the app locally to verify each phase before committing.
  Show me the test results.

ROLES (seed these; Admin = Nandini, Tech Founder's Office)
Admin, TA (head Sayali; Shailaja, Isha), HR (head Angela; Shalom),
IT (head Ankith; IT Analyst; Hardware: Kumar), Hiring Manager, Management
(read-only). Use company-email login; first Admin bootstraps; unknown = viewer.

TWO INTERFACES
1) Input interface (facilitators' backend): team-scoped forms to create/update
   candidates and tasks, raise/clear blockers, record back-outs (with stage +
   reason), and BULK-IMPORT from existing sheets (CSV/Excel upload with guided
   column mapping). The "create candidate" form must mirror the Freshservice
   intake fields in the PRD (Name, phone, personal email, DOP or DOJ, department,
   designation, cost center, employment type, reporting manager, asset shipment
   required).
2) Dashboard interface: role-based cuts for TA, HR, IT; a read-only Management
   overview; and Admin (everything + config).

DATA MODEL: implement the entities in PRD §12 (candidates, stages/tasks, users,
notifications, alert_rules, report_schedules, integrations, audit_log). Support
employment types (permanent/freelancer/consultant/intern/contractor), case types
(pre-onboarding via DOP / immediate via DOJ), and statuses (in_progress /
onboarded / backed_out / offboarded). Auto-create schema on first run (no manual
migration step) and also keep migration files.

CANONICAL STAGES & DAY-1 AUTOMATION: implement the full stage list and the
day-of-joining automation exactly as in PRD §5, including which steps are
"Automated (Freshservice/JumpCloud/Keka/Google/Slack)" vs manual. Where an
integration isn't wired yet, the step is a manual "mark done" that an integration
can later upgrade — do not block the flow.

ANALYTICS (PRD §8 & §13): build a dashboard with back-out %, back-out by stage,
offered→onboarded funnel, total offered vs onboarded vs offboarded, average
onboarding time (offer→DOJ and DOJ→onboarded), what's blocked, pipeline load,
on-time %, and aging. Every analytic must be filterable by department,
employment type, team/owner, date range, case type, and status. Charts should be
clean and self-contained (no external CDNs — inline everything).

ALERTS & TRIGGERS (PRD §7): configurable notification matrix pre-seeded with the
recipient lists from the PRD (pre-boarding created, ticket created, back-out,
join). Blocker triggers alert the owning team + Admin. SLA/delay triggers fire
when a stage misses its target date (derived from DOP/DOJ) with an escalation
ladder (owner → team head → Admin/Founder). Send via email (Resend); make Slack
a pluggable channel.

SCHEDULED REPORTS (PRD §7.3): let Admin/Management schedule recurring reports
(e.g. daily 9am pipeline digest, weekly funnel & back-out summary) delivered by
email. Run them with Cloudflare Cron; expose a single protected endpoint the
scheduler calls, and add a GitHub Actions fallback that hits the same endpoint.

INTEGRATIONS (PRD §9): create a pluggable adapter interface (connect / push
event / pull status) so any platform can be added without touching core logic.
Stub adapters for Freshservice, Keka, JumpCloud, Slack, Google Workspace, Ongrid,
each feature-flagged and OFF by default. Implement inbound webhooks for
Freshservice and Slack first. Built-in: email + CSV/Excel import.

UI / BRANDING (PRD §10): clean, professional, corporate SaaS look matching
GoComet (gocomet.com). Put ALL theme tokens (colors, font, spacing) in ONE file
so exact brand hex/font can be swapped in later. Use the approximate palette in
the PRD until I confirm exact values. Top nav with role badge, left section nav,
KPI stat cards, filterable tables, funnel/bar/trend charts, status chips, blocker
banners. Light theme primary, responsive for laptop/tablet.

AUDIT & SECURITY: write every create/update/stage-change/blocker/back-out to an
immutable audit_log (actor, action, entity, before/after, timestamp).

BUILD ORDER (do these as separate, individually-tested phases; after each, run
locally, show me results, commit, and tell me what to click):
Phase A: data model + Freshservice-parity intake form + CSV/Excel sheet import.
Phase B: TA/HR/IT input queues; advance stage, complete task, blocker, back-out.
Phase C: analytics dashboards + filters + Management overview (apply GoComet theme).
Phase D: alerts & triggers (blocker + SLA + escalation + notification matrix).
Phase E: scheduled reports (Cron + GitHub Actions fallback).
Phase F: integration adapter layer + Freshservice/Slack webhooks first.
Phase G (later): full offboarding flow.

Start with Phase A now. Before coding, give me a one-paragraph plan for Phase A
and list anything you need from me (e.g. a sample of each team's sheet columns).
```

---

## What to have ready before you paste this
- A **sample export (CSV) of each team's existing sheet** (TA, HR POFU, IT) —
  even a few rows — so the import column-mapping matches reality.
- Your **Cloudflare D1 database** (already created) and the **Cloudflare Access
  login** turned on.
- Later, when you choose to wire real integrations: **API keys** for Freshservice
  / Keka / JumpCloud / Slack / Google / Ongrid (added in Cloudflare, never in
  chat), and permission to enable each.
- The **exact GoComet brand hex codes and font** when you have them.
