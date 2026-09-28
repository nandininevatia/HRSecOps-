# P0 — Scope, Definitions & Research Plan

**Study:** Global AI Upskilling & AI Learning Ecosystem — defensible market model
**Trend window:** January 2024 – September 2026
**Research date (P0 written):** 2026-09-28
**Run structure:** Run 1 = P0–P2 (this delivery) · Run 2 = P3–P6 · Run 3 = P7–P8

> Written before any searching, per the protocol. Nothing in this file is a finding.

---

## 1. Central research question

> If a person or organisation wants to upskill in AI today, what is the full ecosystem of resources available to them, how do those resources differ, which learner needs does each serve, how widely are they being used, how do learners move between them, and where are the major gaps and opportunities?

Five analytical questions: **Supply · Demand · Engagement · Outcomes · White space.**

## 2. Definitions

| Term | Working definition used in this study |
|---|---|
| **AI upskilling resource** | Any resource, platform, institution, community, program, product or experience that *materially* helps individuals or organisations build AI knowledge, skills or applied competence in capability layers A–F. "Materially" = a named, findable AI learning offering (course, path, program, credential, curriculum, channel, repo, community) — not a single blog post or a passing mention. |
| **Parent org (`O-###`)** | Legal/corporate owner (e.g. Microsoft). |
| **Platform / product (`P-###`)** | The unit of profiling: a distinct learner experience (e.g. Microsoft Learn, LinkedIn Learning). |
| **Program (`G-###`)** | A named program/path/credential under a platform (e.g. Azure AI Engineer path; Google AI Essentials on Coursera). |
| **Learner** | Whatever the source defines — never assumed. Registered user ≠ learner ≠ active user ≠ enrollment ≠ completion ≠ certificate. The definition is recorded verbatim with every metric. |
| **AI as subject vs. mechanism** | *Subject* = the resource teaches about/with AI tools. *Mechanism* = AI is used to deliver the learning (tutor, adaptive path, AI feedback). Tracked separately throughout. |
| **Teaching about AI vs. changing work** | Enterprise spectrum: knowledge acquisition (courses, completions) vs. behaviour/workflow change (adoption telemetry, productivity, redesign). |

### Capability layers
A AI Literacy · B AI Productivity/AI-for-Work · C Technical AI · D Builder Skills · E Leadership/Business AI · F Career.

## 3. Inclusion / exclusion rules

| Rule | Treatment |
|---|---|
| Has named AI learning offering in any layer A–F, active in trend window | `in_scope = yes` |
| General data/software training with no AI component | `adjacent` — kept out of core analysis |
| AI product with no learning offering (ChatGPT, Claude, Gemini as tools) | `adjacent`; appears only in AI-native learning analysis as a learning *tool* |
| Research lab with no educational output | `no` |
| Consulting firm without a named, productised training offering | `no` (or `adjacent` if only thought-leadership) |
| Content not updated since 2023 | `no`, **unless canonical** (fast.ai, CS229, 3Blue1Brown NN series, d2l.ai…) → `legacy-canonical` |
| Syndicated / licensed / republished content | Attributed to creator; host recorded in `hosted_on`; **not** counted as independent supply |
| Regional sites / locales of one platform | One platform |
| Creator across YouTube + newsletter + courses | One entity |

## 4. Resource-type taxonomy (controlled vocabulary for `category`)

Formal/structured · Self-directed · Interactive · Community · Live/high-touch · Enterprise · AI-native learning · Government/public · Nonprofit/NGO · K-12/teacher · Professional body · Consulting academy · AI-lab developer program · Vendor academy · Apprenticeship · Credential/skills-benchmarking · Digital adoption · Regional-language edtech · Directory/curation

The last 12 are the "often-missed" categories from §5 of the brief, promoted to first-class categories so that saturation can be tested for each. Additional categories are added only with evidence (P2 log records any additions and the justification).

## 5. Research plan & search budget (Run 1: discovery)

Discovery is split into six parallel slices, each running passes from §7.1 of the brief, in batches of 5 queries, with the §7.5 saturation rule (stop when 3 consecutive batches each add < 2 new in-scope entities).

| Slice | Categories covered | Passes | Planned budget (queries) | Target candidates |
|---|---|---|---|---|
| S1 Formal | MOOCs, marketplaces, AI-ed platforms, universities, degrees, prof. certs, bootcamps, cohorts, exec-ed | A, B, C, D, H | 40–70 | 50–90 |
| S2 Vendor/lab | Hyperscaler & frontier-lab academies, vendor academies, certifications, dev programs/cookbooks, credential & benchmarking, labs | B, C, H | 40–70 | 50–90 |
| S3 Enterprise | LMS/LXP, corporate AI training, consulting academies, digital adoption, skills intelligence, professional bodies, apprenticeships, regulatory drivers | A, C, D, H | 40–70 | 50–90 |
| S4 Creator/community | YouTube, podcasts, newsletters, GitHub, books, docs, communities, hackathons, directories, creator businesses | G, H, I | 40–70 | 60–100 |
| S5 Regional/public | 8 regions, 10 languages, government programs, NGOs, K-12/teacher | F, H | 60–90 | 70–110 |
| S6 AI-native + reports | AI tutors/adaptive/AI assessment, learning apps; Pass E authoritative reports | E, G(app stores), H | 40–70 | 30–60 + report datapoints |

**Total target:** 150–300 deduplicated candidates; ≥30 significant non-seed providers incl. non-US/non-English.

### Search hygiene (applies to every slice)
- Add `2025`/`2026` to time-sensitive queries; ≥ 2 phrasings per concept.
- Trace press statistics to the original source; never cite a snippet when the page is reachable.
- Log dead ends ("no public learner data" is a finding).
- Engine: web search tool (US index) + direct page fetch. **Known limitation:** US-indexed search under-represents Chinese-, Korean- and Arabic-language web; recorded as a blind spot.

## 6. Entity-resolution plan (P2)

1. Normalise names (case, punctuation, "Academy/Learn/University" suffixes) and domains.
2. Fuzzy match (token-set ratio ≥ 0.85 or same registrable domain) → human-style review → merge or keep.
3. Build hierarchy Parent (`O-`) → Platform (`P-`) → Program (`G-`). Programs are never counted as platforms.
4. Creator vs. distributor: content attributed to creator; `hosted_on` records host.
5. Co-branded university programs delivered by Emeritus/Great Learning/etc. → programs under the delivery platform with `academic_partner`.
6. M&A verified as of observed date; brands kept separate if learners still experience them separately.
7. Every merge logged in `dedup_log` (kept ID · merged ID · reason).

## 7. Major-provider threshold (for Run 2 profiling)
Any of: ≥1M reported learners or ≥100k on AI content · ≥100k AI-learning subscribers/members · ≥10k GitHub stars on a learning repo · top-3 in a region/language · official academy of a frontier lab or hyperscaler · cited as leading by ≥2 T1/T2 sources · structurally distinctive though small (`distinctive-small`). In Run 1 this is a **provisional flag (`major_hint`)** only; it is confirmed with evidence in Run 2 (P3–P4).

## 8. Evidence rules carried into every dataset
- Labels: `FACT` · `PLATFORM-REPORTED` · `THIRD-PARTY ESTIMATE` · `PROXY` · `INTERPRETATION` · `UNKNOWN`.
- Every metric: value · definition · scope · as-of · observed · source · label. Blank = not observed (never guessed).
- Metrics > 12 months old tagged `stale`; > 24 months trend-context only.
- Source tiers T1–T4 per §9.1 of the brief.

## 9. Exit criteria for Run 1
- [ ] P0 written before searching (this file)
- [ ] P1 raw candidate list with search log and per-category saturation status
- [ ] P2 deduplicated provider list with `O-`/`P-`/`G-` IDs, parent mapping and a complete dedup log
- [ ] Hand-off notes for Run 2 (which providers get full profiles; open verification questions)
