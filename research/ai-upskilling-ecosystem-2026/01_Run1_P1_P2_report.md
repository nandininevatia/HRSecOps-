# Run 1 Report: P1 Discovery & P2 Entity Resolution

**Study:** Global AI Upskilling & AI Learning Ecosystem (trend window Jan 2024 – Sep 2026)
**Run date:** 2026-09-28 · **Phases covered:** P0 (see `00_P0_scope_and_plan.md`), P1, P2
**Datasets:** `data/ai_upskilling_ecosystem_run1.xlsx` (one tab per dataset), with the same tables as CSVs in `data/`
**Reproduce:** `python3 scripts/p2_entity_resolution.py` (needs `rapidfuzz` and `openpyxl`). Every merge and re-levelling decision is written in the script's `DECISIONS` table and written again to `dedup_log.csv`.

> **Status: Run 1 is complete for P0 and P2, but P1 is only partly complete.** Discovery stopped because of two environment limits, not because the market was exhausted. **No category reached saturation** (§7.5). See §2 and §7 of this report. This report contains **no market findings**. The observations in §5 are discovery signals to be verified in Run 2.

---

## 1. What Run 1 produced

| Dataset (tab / CSV) | Rows | Contents |
|---|---|---|
| `p1_raw_candidates_all` | 414 | Every raw discovery record from 6 parallel slices, with IDs `R-<slice><nnn>` |
| `providers` | **315 platforms** (`P-001…P-315`) | Deduplicated platform list: parent, category, layers, scope, provisional tier, region, seed-list flag, source raw IDs |
| `orgs` | 283 parent orgs (`O-###`) | Parent organisations with platform/program counts and ownership as reported. Most orgs own a single platform. |
| `programs` | 73 programs (`G-###`) | Programs, certifications, AI features, repos, books and skilling pledges re-levelled out of the platform list |
| `dedup_log` | 106 actions | 32 merges, 64 re-levelled to program, 9 re-levelled to initiative, 1 re-levelled to parent org. Each has a reason. |
| `p2_fuzzy_check` | 9 pairs | Automatic safety net over the final list (name token-set ≥ 88, or same host). All 9 pairs reviewed and kept separate. |
| `usage_signals_p1` | 306 | One discovery signal per raw record: label, as-of date, source IDs. **All are unverified** (status column). |
| `sources` | 370 | Source directory skeleton (`S-####`). Authority, freshness, directness and relevance scoring is deferred to P4. |
| `context_datapoints` | 35 | Report, regulatory and M&A data points (demand and context side) |
| `search_log` | 304 log rows | Includes about 248 executed searches/fetches and about 56 logged as *not run* or *blocked* (dead ends) |
| `saturation_log` | 45 | Saturation status per slice × category |

### Scope breakdown of the 315 platforms

| in_scope | Count | Treatment |
|---|---|---|
| yes | 228 | Core analysis |
| legacy-canonical | 13 | Core analysis, flagged (e.g. fast.ai, MIT OCW, 3Blue1Brown NN series, d2l.ai, StatQuest) |
| adjacent | 70 | Kept out of the core (directories, general coding apps, adjacent enterprise tools, product-access initiatives) |
| no | 4 | Kept for traceability only (Unacademy, kept for M&A; Instructure; Blinkist; Exercism) |

**Core (yes + legacy-canonical) = 241 platforms.** Brief target: 150–300 raw candidates. Met.

### Core platforms by category

| Category | n | Category | n |
|---|---|---|---|
| Self-directed (YouTube, repos, books, newsletters, podcasts) | 56 | Live/high-touch | 9 |
| Formal/structured | 49 | Interactive | 6 |
| Enterprise (LMS/LXP, AI-adoption vendors) | 22 | K-12/teacher | 6 |
| Vendor academy | 22 | Digital adoption | 5 |
| Consulting academy | 12 | Regional-language edtech | 5 |
| Government/public | 11 | Directory/curation | 4 |
| AI-lab developer program | 9 | Credential/skills-benchmarking | 3 |
| AI-native learning | 9 | Nonprofit/NGO | 2 |
| Community | 9 | Apprenticeship · Professional body | 1 · 1 |

A further 9 government/pledge **initiatives** sit in `programs`, because they are not platforms. Examples: Microsoft Elevate, AWS AI Ready, IndiaAI FutureSkills, ADVANTA(I)GE India, elevAIte Indonesia.

### Core platforms by region (HQ or programme region)

North America 94 · Global/unspecified 77 (mostly creators and repos with no stated HQ) · India 31 · Europe 21 · Southeast Asia 13 · East Asia 2 · Asia-Pacific (other) 2 · Middle East 1 · **Africa 0 · Latin America 0**.

This regional skew reflects where searching was possible. It is **not** a finding about where supply exists (see §7).

---

## 2. Exit-criteria check (P0 §9)

| Criterion | Status | Notes |
|---|---|---|
| P0 written before searching | ✅ | Committed before discovery results arrived |
| P1 raw list, with search log | ✅ | 414 raw records; 304 log rows including dead ends |
| P1 saturation reached per category | ❌ **Not reached in any category** | 45 slice × category rows, all `N`. Some categories were still returning 20+ new entities per batch when stopped. |
| ≥ 30 significant non-seed providers, incl. non-US / non-English | ⚠️ **Partly met** | 185 core platforms are not on the brief's seed list. 40 of these are *provisionally* major or distinctive, but only **11 are outside North America / global creators**, and very few are non-English (see §4). |
| P2 dedup with O-/P-/G- IDs and parent mapping | ✅ | See `providers`, `orgs`, `programs` |
| Dedup log complete | ✅ | 106 actions with reasons; fuzzy check reviewed |
| Hand-off for Run 2 | ✅ | §8 |

---

## 3. Entity-resolution rules applied (P2)

| Rule (brief §8) | How it was applied, with examples |
|---|---|
| Unit = Platform/Product; commercial variants merged | Coursera for Business → Coursera. Udemy Business → Udemy. LinkedIn Learning Hub → LinkedIn Learning. DataCamp for Business → DataCamp. |
| Separate brands kept where the learner experience differs, linked to a common parent | Coursera and Udemy stay 2 platforms under Coursera, Inc. (combination completed 2026-05-11; see §5). Microsoft Learn, LinkedIn Learning and the Microsoft GitHub curricula are 3 platforms under Microsoft. |
| Programs are never counted as platforms | 64 re-levelled: certifications (AI-103, AWS GenAI Developer Pro, GH-300, OpenAI Certifications), AI features (Coursera Coach, Project Helix, Udemy AI Role Play, DataCamp Optima, CS50 Duck), courses (HF Agents/LLM course), regional instances (OpenAI Academy India, Hour of AI Thailand) |
| Pledges / public-private initiatives | 9 initiatives are held as programs owned by an org, with no platform, because they run across several platforms |
| Creator = one entity across channels | Karpathy (YouTube + nanoGPT, nanochat, micrograd, LLM101n). Raschka (book + 2 repos). Chip Huyen (book + repo). Alammar & Grootendorst. Nir Diamant (3 repos + newsletter). DataTalks.Club (2 Zoomcamps). DeepLearning.AI YouTube merged into DeepLearning.AI. freeCodeCamp YouTube merged into freeCodeCamp. |
| Rebrands use the current name, with the old name kept as an alias | Google Cloud Skills Boost → **Google Skills** (renamed Oct 2025 per vendor slice; verify). anthropic-cookbook → Claude Cookbooks. |
| Creator vs. distributor (`hosted_on`) | Google AI Essentials (creator Google; hosted on Coursera and grow.google). Microsoft CxO Edge (hosted on edX). IIT Roorkee (via Scaler) and IIT Guwahati (via Simplilearn) set as `academic_partner`. AIM programmes delivered by Emeritus. |
| Vendor communities folded into the vendor's learning platform | HF Discord → Hugging Face Learn. LangChain community → LangChain Academy. Kaggle discussions → Kaggle Learn. |
| Synthetic entities (created in P2 from observed parent/creator fields; basis recorded) | 7: Microsoft 'For Beginners' curricula, Raschka, Huyen, Alammar/Grootendorst, DiamantAI, DataTalks.Club, AI Singapore |
| Scope conflicts between slices | 9 resolved explicitly with a reason (`scope_resolution` column). Example: Brilliant was tagged *yes* by one slice and *adjacent* by another. It is held as *adjacent* until its AI catalogue is checked in P3. |
| Layers left blank by 2 slices | Filled **provisionally** from name/subcategory and labelled `layers_basis = P2 provisional (researcher)`. This is an `INTERPRETATION` and must be verified in P3. |

---

## 4. Provisional "major provider" list for Run 2 full profiles (brief §7.6)

**65 platforms** are tagged `major (provisional)` and 1 is tagged `distinctive-small (provisional)`. The basis for each tag is in `providers.tier_basis`. **"Provisional" means the tag rests on a discovery signal that has not yet been verified.** Ten tags were corrected by hand after reading each signal against §7.6: 8 upgraded and 2 demoted. For example, AI Ready ASEAN was demoted because its figure is a *target*, not learners.

- **Seed-list majors or distinctive (26):** Coursera, Udemy, edX, LinkedIn Learning, DataCamp, Pluralsight, Codecademy, DeepLearning.AI, fast.ai, freeCodeCamp, Great Learning, Harvard CS50 AI, Kaggle Learn, Hugging Face Learn, Microsoft Learn, AWS Skill Builder, Google Skills, IBM SkillsBuild, Salesforce Trailhead, OpenAI Academy, Anthropic Academy, NPTEL, Scaler, Simplilearn, upGrad, plus Maven (`distinctive-small`).
- **Non-seed majors, North America or global (29):**
  - *Vendor and AI-lab:* Gemini API Cookbook, Cisco Networking Academy, ServiceNow University, Cognizant Synapse.
  - *Formal and interactive:* Georgia Tech OMSCS, Sololearn.
  - *Creator repos:* roadmap.sh, awesome-llm-apps, Awesome-LLM, llm-course, Made With ML, labml.ai, AI Engineering Hub, Prompt Engineering Guide, d2l.ai, Microsoft 'For Beginners' curricula, and the Raschka, Huyen, Alammar/Grootendorst and DiamantAI entities.
  - *YouTube and communities:* 3Blue1Brown, StatQuest, Matt Wolfe, Matthew Berman, AI Explained, Jeff Su, Tina Huang, AI Automation Society (Skool), DataTalks.Club.
- **Non-seed majors outside North America (11):** Google DeepMind Education (UK), Le Wagon (FR), Capgemini GenAI Campus (FR), HCL GUVI (IN), Krish Naik (IN), TCS iON (IN), PW Alakh AI (IN), iGOT Karmayogi (IN), Dicoding (ID), Squirrel AI (CN), Go1 (AU).

**QA flag:** the ≥30 non-seed target is met in count (40). But the requirement to include non-US and non-English providers is **only weakly met**. Only 11 are outside North America, and nearly all of those are English- or Hindi/English-language. Chinese, Japanese, Korean, Arabic, Spanish, Portuguese, German and French providers are essentially absent (§7).

---

## 5. Discovery observations to verify in Run 2 (not findings)

Each observation is labelled as it was captured. **Most were read from search-result snippets because the original pages could not be fetched.** Under brief §7.3 they cannot be cited in the final report until the original source is opened.

| # | Observation (dated) | Label (as captured) | Source (from P1) | Verification needed |
|---|---|---|---|---|
| 1 | Coursera–Udemy combination announced 2025-12-17, approved by stockholders 2026-04-09, **completed 2026-05-11**. All-stock deal of about $2.5B. Combined company claims "more than 290 million learners, 18,000 enterprise customers, 95,000 instructors". | FACT (deal) / PLATFORM-REPORTED (reach) | Coursera 10-Q Q2 2026 (sec.gov); investor.coursera.com; insidehighered.com | Found independently by 3 slices. Learner definition not seen. |
| 2 | Workday agreed to acquire Sana on 2025-09-16 and completed it on 2025-11-04 (~$1.1B per one slice, ~$1.0B per another). | FACT / conflicting value | newsroom.workday.com | Resolve the value conflict (brief §9.5) |
| 3 | 2U (edX parent) emerged from Chapter 11 as a private company on 2024-09-13. edX states "more than 100 million learners". | FACT / PLATFORM-REPORTED | 2u.com | — |
| 4 | Accenture owns Udacity (announced 2024-03-05) and acquired Ascendient Learning (2025). Udacity launched an MS in AI (Oct 2025) and an AI MBA (Mar 2026). | FACT | accenture.com / udacity.com | — |
| 5 | Skillsoft sold its Global Knowledge instructor-led business; completed 2026-07-06. | FACT (8-K) | SEC 8-K via enterprise slice | Open the filing |
| 6 | SAP completed its WalkMe acquisition on 2024-09-12. | FACT | news.sap.com | — |
| 7 | Microsoft Elevate announced 2025-07-09: $4B over 5 years and 20M people credentialed within 2 years. | PLATFORM-REPORTED | blogs.microsoft.com | — |
| 8 | OpenAI pledged to certify 10M Americans by 2030 (Sep 2025). AI Foundations credential launched Dec 2025. OpenAI Academy reports "4M+ people engaged" over two years. | PLATFORM-REPORTED | openai.com; techrepublic.com | Engagement definition |
| 9 | Kaggle AI Agents Intensive: 1.5M sign-ups (Nov 2025). | PLATFORM-REPORTED | vendor slice | Sign-ups ≠ learners |
| 10 | ChatGPT Study Mode launched 2025-07-29. Claude for Education / Learning mode 2025-04-02. Gemini Guided Learning about 2025-08-06. NotebookLM flashcards and quizzes 2025-09-08. | FACT (launch dates) | ainative slice (snippets) | Open the launch posts |
| 11 | Coursera Coach: "34M+ messages with 2.4M+ learners" (no as-of date seen). Coursera **Project Helix** (AI-native platform) previewed Sept 2026; announced, not generally available. | PLATFORM-REPORTED | blog.coursera.org / investor.coursera.com | As-of date |
| 12 | IndiaAI Mission (launched Mar 2024, Rs 10,371 crore). YUVA AI for ALL launched 2025-11-18 with a target of 1 crore citizens. CBSE CT & AI curriculum for Classes 3–8 from 2026-04-01. | PLATFORM-REPORTED (government) | pib.gov.in; cbseacademic.nic.in | Pages were blocked; figures seen in snippets only |
| 13 | US DOL AI Literacy Framework published 2026-02-13 (five content areas). | FACT | dol.gov | — |
| 14 | **EU AI Act Art. 4 AI-literacy obligation applicable from 2025-02-02.** | **UNVERIFIED** | EUR-Lex blocked | Must be verified before use |
| 15 | Microsoft AI-102 retired 2026-06-30, replaced by AI-103. AWS Certified Generative AI Developer – Professional generally available 2026-03-17. | FACT | learn.microsoft.com / aws.amazon.com | — |
| 16 | GitHub learning repos (stars read directly off github.com on 2026-09-28). Examples: developer-roadmap 368.4k, generative-ai-for-beginners 120.7k, LLMs-from-scratch 105.7k, llm-course 83.2k. anthropics/courses was archived 2026-09-15. | PROXY | github.com | Current; these are the strongest reach data in Run 1 |

---

## 6. Categories tested for the brief's "often-missed" list (§5)

| Category | Found in Run 1 | Gap |
|---|---|---|
| Government / national AI-skilling | ✅ India (8+), SE Asia (10+), US DOL framework | Europe, East Asia, Middle East, Africa, LatAm **not searched** |
| Public-private skilling pledges | ✅ Microsoft, AWS, Google.org, IBM, OpenAI, Cisco, ServiceNow, Databricks | Pledge figures are targets and must never be reported as reach |
| Nonprofit / NGO | ⚠️ WorldQuant University, AI Ready ASEAN, Pratham, Wadhwani AI | Code.org, AI4ALL, Raspberry Pi/Experience AI, Generation, Per Scholas **not searched** |
| K-12 & teacher | ⚠️ Khanmigo, CBSE, KITE Kerala, TN SCERT, DepEd, Synthesis, Wild Zebra | AFT/OpenAI/Microsoft teacher academy, UNESCO frameworks, ISTE **not searched** |
| Professional bodies | ❌ Only IAPP AIGP and NACE | SHRM, CIPD, CFA, ACCA, ICAEW, ABA/Law Society, AMA, PMI, ISACA **not searched** (search budget exhausted) |
| Consulting-firm academies | ✅ 12 (Accenture LearnVantage, McKinsey/QuantumBlack Horizon, BCG U, Deloitte, PwC, KPMG, Capgemini, Infosys, TCS, Wipro, Cognizant, NTT DATA) | EY, IBM Consulting |
| AI-lab developer programs & cookbooks | ✅ OpenAI, Anthropic, Google (DeepMind, Gemini cookbook), Meta, Mistral, Cohere | — |
| Apprenticeships | ⚠️ Multiverse, AI Singapore AIAP | UK providers (QA, Cambridge Spark) and US apprenticeships |
| Credential verification / skills benchmarking | ⚠️ Credly, Workera, CodeSignal, TechWolf, Eightfold, Gloat, Viva Skills | CompTIA, ISACA, PMI-CPMAI, Linux Foundation, HackerRank, iMocha **not searched** |
| In-product onboarding / digital adoption | ✅ WalkMe, Whatfix, Pendo, Userlane, MeltingSpot, Microsoft Adoption | — |
| Regional-language edtech | ⚠️ GUVI, PW Skills, Dicoding, FUNiX, SWAYAM Plus (Hindi) | CN/JP/KR/AR/ES/PT/DE/FR **absent** |

---

## 7. Why discovery stopped (research limitations for Run 1)

1. **Search budget.** The session had one budget of 200 web searches, shared by all six discovery agents. It ran out after about 25–45 queries per slice. Batches that were planned but never ran are logged in `search_log` as dead ends.
2. **Blocked page fetches.** The environment's network policy blocked page fetches for most hosts. Hosts reported blocked include:
   - *Company and lab sites:* openai.com, blog.google, blogs.microsoft.com, investor.coursera.com, blog.udemy.com
   - *Government and regulatory:* sec.gov, pib.gov.in, whitehouse.gov, eur-lex.europa.eu
   - *Professional bodies:* iapp.org, isaca.org, comptia.org, pmi.org, shrm.org
   - *Education programmes:* code.org, elementsofai.com, ki-campus.org
   - *Platforms and communities:* youtube.com, reddit.com, huggingface.co, classcentral.com, promptingguide.ai, substack.com

   Only github.com was consistently reachable. As a result:
   - most signals come from **search-result snippets**, which the brief forbids citing when the page itself exists;
   - YouTube, newsletter and community counts are unverified;
   - the Reddit/HN sentiment pass (Pass I) could not run.
3. **Pass E (authoritative reports) was essentially not run.** Stanford AI Index, Coursera skills reports, LinkedIn WLR, WEF, Microsoft WTI, OECD, UNESCO, McKinsey, BCG, PwC, Octoverse and the Stack Overflow survey were not mined. **The demand side of the model (Q2) therefore has almost no evidence yet.**
4. **Regional blind spots.** East Asia, Europe (non-English), the Middle East, Africa and Latin America had **zero** search batches. The search index is US-based. Chinese, Korean and Arabic web coverage would be limited even with budget.
5. **Podcasts and app stores** were not searched.

---

## 8. Hand-off to Run 2 (P3–P6)

**Precondition.** Run 2 cannot meet the brief's evidence standard (T1 page for every headline figure, §9.4) unless one of the following is true:
- the environment's network access is widened, so official pages can be fetched; or
- Run 2 is carried out where pages can be opened.

**Priority order for Run 2**
1. **Finish P1 discovery in the untouched segments** (about 60–80 queries):
   - *Regions:* East Asia, Europe, the Middle East, Africa and LatAm, searching in local languages.
   - *Categories:* professional bodies, certification bodies, podcasts, app stores and interactive labs.
   - *Named seeds still missing:* Elements of AI, Zapier.

   Re-run the saturation check afterwards.
2. **Pass E report mining** (demand side). This is needed before P5/P7.
3. **P3 primary research on the 66 provisional majors.** Use the §7.7 stopping rule and fill the §10.1 profile fields. Start with the 25 seed-list majors and the frontier-lab and hyperscaler academies.
4. **P4 validation of every signal in `usage_signals_p1`.** Replace snippet-sourced values with the original page or mark them "Public data unavailable". Resolve conflicts: Sana deal value, Skillsoft/Global Knowledge value, Khanmigo usage attribution.
5. **Open verification items:**
   - EU AI Act Art. 4 date
   - upGrad–Unacademy acquisition (T4 source only)
   - whether Google Cloud Skills Boost → Google Skills is a rebrand or a merger
   - Papers with Code and Buildspace status
   - the claimed Go1 merger
   - Gartner "60% by 2026" (vendor-blog citation only)

**Files Run 2 should start from:** `data/providers.csv`, `data/programs.csv`, `data/orgs.csv`, `data/usage_signals_p1.csv`, `data/sources.csv`, `data/search_log.csv` and `data/saturation_log.csv`. Re-run the script after adding new raw slices to `data/p1_raw/`.
