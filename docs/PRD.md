# Product Requirements Document (PRD)
## GoComet Onboarding & Facilitators Platform

**Version:** 1.0
**Owner:** Tech Founder's Office (Nandini)
**Status:** Draft for build
**Last updated:** 2026-07-03

---

## 1. Purpose & vision

Today, onboarding at GoComet is run across **disconnected tools and spreadsheets** —
Freshservice tickets, a POFU sheet, Keka, JumpCloud, Slack, Google Groups, Ongrid,
and manual email chains. No single place shows *who has been offered, where each
person is in the pipeline, what is blocked, and how healthy the funnel is.*

This platform is a **facilitators' dashboard + input system** shared by three
teams — **IT, HR, and TA** — with **read-only visibility for Management** and a
single **Admin**. It provides:

- **One input interface** where each team records and updates its part of the
  onboarding journey (and can seed data from the sheets they already maintain).
- **One dashboard interface** with team-specific "cuts", a management overview,
  and deep analytics on the hiring-to-onboarding funnel.
- **Automated scheduled reports** delivered on a fixed cadence.
- **Automatic triggers/alerts** whenever a step is blocked or running late.
- An **integration layer** designed to connect to any existing platform
  (Freshservice, Keka, JumpCloud, Slack, Google Workspace, Ongrid, email, …).

**The core promise:** holistic, real-time visibility of the entire pipeline —
number offered, number to be onboarded, each candidate's current stage, DOJ,
pre-onboarding cases, and every blocker — at all times.

---

## 2. Goals & non-goals

### Goals
1. Give every stakeholder a live, accurate view of the onboarding pipeline.
2. Replace the "which sheet / which ticket / which email" hunt with one system.
3. Surface blockers and delays automatically, to the right people.
4. Provide leadership-grade analytics (back-out %, funnel, cycle time, etc.).
5. Stay **free to run** (Cloudflare + GitHub + free tiers) and easy to maintain.
6. Be integration-ready so it augments — not replaces — existing tools.

### Non-goals (for v1)
- Replacing Freshservice / Keka / JumpCloud as systems of record.
- Payroll, performance management, or offboarding workflows (offboarding is
  tracked as a *status/metric* only in v1; full offboarding flow is a later phase).
- Being the candidate-facing careers/ATS product.

---

## 3. Personas & roles

| Role | People (from notes) | What they do in the system |
|---|---|---|
| **Admin** | Tech Founder's Office — **Nandini** | Full control: manage users/roles, configure integrations, report schedules, alert rules; see everything. |
| **TA Team** | Head: **Sayali**; Team: **Shailaja, Isha** | Create candidates/tickets, run shortlist→offer→POFU, confirm join/back-out, employer branding. |
| **HR Team** | Head: **Angela**; Team: **Shalom** | POFU, NDA, pre-onboarding email, HRMS/Keka setup, orientation, employee agreement/BGV, records. |
| **IT Team** | Head: **Ankith**; Team: **IT Analyst**; Hardware: **Kumar / IT Analyst** | Email/JumpCloud/Slack/Google provisioning, laptop handover, biometric/asset, Keka asset tagging. |
| **Hiring Manager** | Per candidate | Day-1 induction, buddy assignment, training material, quiz/training completion. |
| **Management** | Founders & leaders | **Read-only** dashboards and analytics; receives scheduled reports. |

> Access is granted via company login (Cloudflare Access). Each person's role
> determines the "cut" of data they see and the actions they can take.

---

## 4. The two interfaces

### 4.1 Input interface ("facilitators' backend")
A structured, form-driven workspace where each team enters and updates data for
their part of the journey. Principles:
- **Team-scoped:** a person sees the fields and tasks their team owns, plus
  read context for the rest of the journey.
- **Sheet import:** each team can **bulk-import from their existing sheets**
  (CSV/Excel upload, or paste) to seed and periodically sync data. Column
  mapping is guided (map sheet columns → system fields).
- **Freshservice-form parity:** the "create candidate/ticket" form mirrors the
  Freshservice fields the TA team already fills (see §6), so it's familiar.
- **Fast updates:** advance a stage, mark a task done, raise/clear a blocker,
  record a back-out with reason and stage.

### 4.2 Dashboard interface
Read-and-monitor views with **role-based cuts**:
- **TA cut, HR cut, IT cut:** each team's queue, pending/overdue/blocked items,
  upcoming DOJs, and their KPIs.
- **Management overview:** funnel, back-out %, cycle time, headcount pipeline,
  blockers — filterable, no edit rights.
- **Admin:** all of the above + configuration.

---

## 5. Onboarding lifecycle (canonical model)

The system models one **Candidate** record that moves through **stages**. Stages
carry an **owner team**, **automation flag**, and **notification list**. This is
the merged, authoritative flow from all notes.

### 5.1 Employment types
`permanent` · `freelancer` · `consultant` · `intern` · `contractor`
(used everywhere as a filter dimension).

### 5.2 Case types
- **Pre-onboarding case** — candidate engaged ahead of time; tracked from
  **DOP (Date of Pre-boarding)**.
- **Immediate onboarding case** — standard flow to **DOJ (Date of Joining)**.
- **Back-out** — candidate withdraws before DOJ (can occur at any stage).

### 5.3 Stages

| # | Stage | Owner | Automation | Key notes |
|---|---|---|---|---|
| 1 | Candidate identified / shortlist & documents | TA | Manual | TA carries end-to-end. |
| 2 | Offer release | TA | Keka | Offer via Keka; acceptance email to HR & TA. |
| 3 | Share candidate details → HR & IT | TA | **Freshservice ticket** | TA creates ticket (fields in §6). |
| 4 | Post-offer follow-up (POFU) | HR | Manual | Multiple touch points; HR keeps a POFU sheet. |
| 5 | NDA | HR (Shalom) | Manual | Immediate: not mandatory. Non-immediate: signed after offer. Special: interview-stage NDA before internal docs; onboarding still waits for offer acceptance. |
| 6 | Pre-onboarding email + manager connect | HR | Manual | Virtual connect; sometimes "facilitate email + asset". |
| 7 | Joining confirmed | Candidate → TA/HR | Form | TA gets a form **1 day before joining** to confirm join / back-out. |
| 8 | Onboarding ticket raised | TA on Freshservice | **Freshservice** | Raised on day of offer release. |
| 9a | **Day 1 · Account & system setup** | IT / Hardware | **Automated (Freshservice)** | Email ID (auto), Laptop handover, JumpCloud mapping (auto); HRMS/Keka setup by HR (Shalom) — correct dept mapping. |
| 9b | **Day 1 · Orientation & communication** | HR | Manual | Orientation session (10:30 AM, Tuesdays); Employee Agreement + BGV via Ongrid (Shalom); Slack welcome + manager mapping; photo on office TV; intro to manager & team. |
| 9c | **Day 1 · Compliance & access** | IT / Hardware (Kumar) | Mixed | Biometric/fingerprint (Kumar) → office access; add to DLs/Google Groups (auto); add to common Slack channels (auto). |
| 10 | Handover to manager | Manager (overseen by HR) | Manual | Manager owns team integration + training. |
| 11 | Manager Day-1 induction | Manager | Manual | Intro to team; assign buddy; share training material; ensure training quiz; **Security Training**; **POSH Training**. |
| 12 | Friday formal introduction | HR | Recurring | Wider-team intro, every Friday. |
| 13 | Employer branding | TA | Manual | LinkedIn post. |
| 14 | Update HR records | HR | Manual | Finalize records. |
| 15 | **Onboarded** | HR | — | Fully integrated (terminal success state). |
| — | **Backed out** | TA | Freshservice cancel | Terminal state; captures stage + reason. |
| — | **Offboarded** | HR | — | Post-onboarding status/metric (v1 = flag + date). |

### 5.4 Day-of-joining automation (from IT notes)
On **DOJ**, for a candidate who joins:
- **10:00 AM** — Account creation: Email + **JumpCloud** account (automatic).
- Added to **Slack channel** + **Google DL** (auto).
- **Keka** personnel account created (automated) → **Kumar tags the asset**
  against the employee in Keka (later, asset tagging moves to IT Analyst).
- **10:30 AM** — HR onboarding call.
- **2 automated emails:** (1) Security Training + Org Policy + BYOD;
  (2) Asset Acknowledgement.
- **Announcements:** Slack full-team channel + email to entire org.

---

## 6. Ticket / candidate intake fields (Freshservice parity)

The intake form (and sheet import mapping) must capture:

**Common:** Name · Phone · Personal email · Department · Designation ·
Cost center · Employment type · Reporting manager · Asset shipment required (Y/N).

**Case-specific date:**
- Pre-onboarding case → **DOP (Date of Pre-boarding)**.
- Immediate case → **DOJ (Date of Joining)**.

---

## 7. Notifications, triggers & alerts

### 7.1 Event-driven notifications (matrix from notes)

| Event | Notify |
|---|---|
| **Pre-boarding created** | TA, HR, IT, Hiring Manager, respective Founder (Tech → Nandini). |
| **Onboarding ticket created** | Hardware (Kumar/IT Analyst, Ankith), IT (Ankith), HR (Angela), TA head (Sayali), ticket creator. |
| **Candidate backs off** | IT (Ankith, Vivek), TA head (Sayali) + ticket creator, HR head (Angela), Hiring Manager, respective Founder (Tech → Nandini). |
| **Candidate joins** | Joining announcement: Slack full-team channel + email to entire org; plus the stakeholder list above. |

> The notification recipient lists are **configurable** per event by the Admin,
> pre-seeded with the values above.

### 7.2 Blocker & delay triggers (the "triggers wherever anything is blocked")
- Any task/stage can be marked **Blocked** with a reason and owner.
- A **blocker trigger** immediately alerts the owning team + Admin (and,
  optionally, Management if unresolved beyond a threshold).
- A **delay/SLA trigger**: if a stage isn't complete by its target date
  (auto-derived from DOP/DOJ, e.g. IT setup due by DOJ), the system escalates.
- **Escalation ladder** (configurable): owner → team head → Admin/Founder.

### 7.3 Scheduled reports
- Admin/Management can schedule recurring reports (e.g. **daily 9 AM pipeline
  digest**, **weekly funnel & back-out summary**) delivered by email (and
  optionally Slack).
- Each report = a saved dashboard view + filters, rendered to email/PDF/CSV.

---

## 8. Dashboards & analytics

### 8.1 Always-on pipeline visibility
- Count **offered**, **accepted**, **in pre-boarding**, **to be onboarded
  (upcoming DOJs)**, **onboarded**, **backed out**, **offboarded**.
- Per-candidate: **current stage**, **DOJ/DOP**, **owner**, **status**,
  **blockers**, **pre-onboarding case flag**.

### 8.2 Core KPIs / analyses
1. **Back-out %** = backed-out ÷ offered (overall and by segment).
2. **Back-out by stage** — at which stage candidates drop off.
3. **Offered → Onboarded funnel** — conversion at each stage.
4. **Total offered vs onboarded vs offboarded** over time.
5. **Average onboarding time** — offer→DOJ and DOJ→fully-onboarded cycle times.
6. **What's blocked** — live list of blockers by team, age, and severity.
7. **Pipeline load** — upcoming joiners by week / by team.
8. **On-time completion rate** — stages/tasks completed by target date.
9. **Aging** — candidates stuck too long at a stage.

### 8.3 Filters (apply across all analytics)
- **Department**
- **Employment type** (permanent / freelancer / consultant / intern / contractor)
- **Team / owner** (TA / HR / IT / Manager)
- **Date range** (offer date, DOJ, DOP)
- **Case type** (pre-onboarding / immediate)
- **Status** (in progress / blocked / onboarded / backed out / offboarded)

### 8.4 Role-based cuts
- **TA:** offers out, POFU status, join-confirmation queue, back-outs, branding tasks.
- **HR:** NDA/agreement/BGV status, orientation schedule, HRMS/Keka setup, records.
- **IT:** provisioning queue (email/JumpCloud/Slack/Google), laptop/asset, biometric,
  Keka asset tagging; upcoming DOJs needing Day-1 setup.
- **Management:** funnel, back-out %, cycle time, blockers — read-only.
- **Admin:** everything + configuration.

---

## 9. Integrations (integration-ready architecture)

The platform must integrate with **any existing platform** via a pluggable
**adapter layer**. Each integration is optional and independently toggled.

| System | Purpose | Direction | v1 approach |
|---|---|---|---|
| **Freshservice** | Ticket create/cancel, status sync | Two-way | Webhook in + API out (adapter) |
| **Keka** | Offer/HRMS/personnel account, asset tag | Read/write | Adapter (start read/manual) |
| **JumpCloud** | Account/device mapping | Write | Adapter (Day-1 automation) |
| **Slack** | Announcements, welcome, channel add | Write | Adapter (webhook/bot) |
| **Google Workspace** | DL/Groups, email provisioning | Write | Adapter |
| **Ongrid** | Background verification status | Read | Adapter |
| **Email (Resend/SMTP)** | Notifications, reports | Write | Built-in |
| **CSV/Excel sheets** | Bulk import from existing sheets | Read | Built-in import |

**Design rule:** a common `Integration` interface (connect, push event, pull
status) so new platforms are added without touching core logic. Where an API
isn't available yet, the same event is handled **manually** (mark-as-done)
without breaking the flow — integrations upgrade a manual step to an automatic one.

---

## 10. UI / UX & branding

- **Look & feel:** clean, corporate, data-dense but uncluttered — matching
  **GoComet** (https://www.gocomet.com). Professional SaaS aesthetic.
- **Brand palette (APPROXIMATION — confirm exact hex from GoComet brand assets
  and set once in a single theme file):**
  - Primary brand blue: `#1B4DFF` (vivid blue)
  - Deep navy / ink: `#0B1F3A`
  - Accent / success: `#12B76A`
  - Warning: `#F79009` · Danger: `#D92D20`
  - Neutrals: `#FFFFFF`, `#F5F7FB`, `#E4E7EC`, `#667085`
  - Typography: clean geometric sans (e.g. Inter/Poppins-like); confirm brand font.
- **Components:** top nav with role badge, left section nav, KPI stat cards,
  filterable data tables, funnel/bar/trend charts, status chips, blocker banners.
- **Accessibility & responsiveness:** works on laptop and tablet; light theme
  primary (matches GoComet), readable contrast.

---

## 11. Non-functional requirements

- **Cost:** must run entirely on **free tiers** (Cloudflare Workers, D1, Cron,
  Access ≤50 users; GitHub incl. Actions; Resend free email). No paid services
  without explicit approval.
- **Security & privacy:** holds employee **PII** — company-login only
  (Cloudflare Access), role-based authorization, least-privilege, secrets stored
  in Cloudflare (never in code). Fail-closed if login isn't present.
- **Auditability:** every create/update/stage-change/blocker/back-out is written
  to an immutable **audit log** (who, what, when).
- **Reliability:** scheduled jobs via Cloudflare Cron with GitHub Actions as a
  free fallback.
- **Maintainability:** one language (TypeScript), modular, documented in
  plain language for a non-technical owner.

---

## 12. Technical architecture (recommended)

Builds on the existing foundation already in this repo.

- **Hosting/runtime:** Cloudflare Workers (free).
- **Web framework:** Hono (TypeScript).
- **Database:** Cloudflare D1 (SQLite, free).
- **Auth:** Cloudflare Access (company login, free ≤50 users) → verified email →
  role lookup in `users` table.
- **Scheduler:** Cloudflare Cron Triggers (daily digests, SLA checks); GitHub
  Actions fallback.
- **Email:** Resend (free tier) for notifications & reports.
- **Integrations:** adapter modules + inbound webhooks (Freshservice, Slack) and
  outbound API clients; feature-flagged.
- **Frontend:** server-rendered pages + charts; progressively enhanced. (React
  can be introduced for the analytics interface if interactivity demands it.)

### Core data model (entities)
- `candidates` — person + employment type, department, designation, cost center,
  reporting manager, personal email, phone, case type, DOP, DOJ, asset flag,
  current stage, status (in_progress / onboarded / backed_out / offboarded),
  backout_stage, backout_reason, offered_at, joined_at, onboarded_at.
- `stages` / `tasks` — per-candidate checklist with owner team, target date,
  status, blocker reason, completed_at, completed_by.
- `users` — email, name, team/role.
- `notifications` — event, recipients, channel, sent_at.
- `alert_rules` — blocker/SLA/escalation configuration.
- `report_schedules` — cadence, view/filters, recipients, channel.
- `integrations` — type, config, enabled, last_sync.
- `audit_log` — actor, action, entity, before/after, timestamp.

---

## 13. Analytics metric definitions (precise)

- **Offered:** candidates with an offer released (stage ≥ Offer release).
- **Accepted:** offer accepted (join intent confirmed).
- **To be onboarded:** accepted, DOJ in the future, not yet onboarded.
- **Onboarded:** reached terminal "Onboarded" stage.
- **Backed out:** status = backed_out; `backout_stage` records where.
- **Offboarded:** status = offboarded (flag + date).
- **Back-out % =** backed_out ÷ offered × 100 (segmentable).
- **Offer→DOJ time =** DOJ − offer_accepted_date.
- **DOJ→Onboarded time =** onboarded_at − DOJ.
- **Average onboarding time =** mean of the above across a filtered set.
- **On-time % =** tasks completed on/before target ÷ total tasks.

---

## 14. Phased delivery roadmap

1. **Phase A — Data model & intake:** candidates + Freshservice-parity intake
   form + sheet import; canonical stages/tasks; employment types & case types.
2. **Phase B — Team cuts & input UX:** TA/HR/IT queues; advance stage, complete
   task, raise/clear blocker, record back-out (stage + reason).
3. **Phase C — Analytics dashboards:** funnel, back-out %, cycle time, blockers,
   filters, management overview (GoComet theme applied).
4. **Phase D — Alerts & triggers:** blocker + SLA/delay triggers, escalation
   ladder, configurable notification matrix.
5. **Phase E — Scheduled reports:** daily/weekly digests by email/Slack.
6. **Phase F — Integrations:** Freshservice + Slack first, then Keka/JumpCloud/
   Google/Ongrid via the adapter layer; Day-1 automation.
7. **Phase G — Offboarding (later):** full offboarding flow beyond the v1 metric.

Each phase is independently testable and shippable on the free stack.

---

## 15. Open questions (to confirm)
1. Exact GoComet brand hex codes and font (for the single theme file).
2. Is `Vivek` (in back-out notifications) IT team — confirm role/email.
3. Should Management be able to export raw data, or dashboards/reports only?
4. Which integrations have API access available **now** vs. manual-first?
5. Offboarding scope for v1 — flag only, or a minimal flow?
6. Report cadences and default recipients per report.
