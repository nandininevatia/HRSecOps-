# Onboarding Tracker

A simple, free web app that tracks every new joiner's onboarding journey — from
the moment they accept the offer until they are fully onboarded.

This is **Phase 0–1**: a working dashboard with demo data. It runs entirely on
free services (Cloudflare + GitHub), so there is nothing to pay for.

---

## What it does right now

- Shows a **dashboard** of all new joiners.
- For each joiner, shows their **current onboarding stage**, a **progress bar**,
  the **owning team**, and a **status** (On track / Joining soon / Blocked /
  Overdue / Onboarded).
- Shows summary counts at the top (total, in progress, blocked, onboarded).

The list of joiners is **demo data** for now (in `src/data.ts`). The next step
replaces it with a real database so you can add live joiners.

---

## The onboarding stages (from the company flowchart)

1. Offer Accepted (TA)
2. Details Shared to HR (TA → HR)
3. Post-Offer Follow-up (HR)
4. NDA (HR)
5. Pre-onboarding Email (HR)
6. Joining Confirmed (HR)
7. Onboarding Ticket Raised (HR)
8. Day 1 Setup — IT / Admin
9. Manager Induction (Manager)
10. Onboarded (HR)

---

## How it's built (plain language)

- **Cloudflare Workers** — where the app lives and runs (free).
- **Hono** — a small toolkit for building the web pages.
- **GitHub** — stores the code (free).
- No database yet — that comes next, using **Cloudflare D1** (also free).

---

## Running it on your own computer (optional)

You do **not** need to do this — Cloudflare can run it for you. But if you want
to see it locally:

```bash
npm install      # download the building blocks (one time)
npm run dev       # start the app on your computer
```

Then open the address it prints (usually http://localhost:8787).

---

## Publishing it live (free)

The easiest way: in the Cloudflare dashboard, go to **Workers & Pages →
Create → Connect to Git**, pick this repository, and Cloudflare will publish it
automatically every time the code changes. Your app will get a free address
like `onboarding-tracker.workers.dev`.

---

## Roadmap

- [x] Phase 0–1: Dashboard with demo data
- [ ] Phase 2: Real database (add/edit live joiners) + auto-calculated due dates
- [ ] Phase 3: Logins & team roles (Cloudflare Access, free for up to 50 users)
- [ ] Phase 4: Email reminders & overdue alerts (daily "alarm clock")
- [ ] Phase 5: Per-joiner timeline & full audit trail
- [ ] Phase 6: Scheduled reports for leadership
- [ ] Phase 7: Real integrations (Keka, Slack, Google, JumpCloud, Ongrid)
