# AI Upskilling Ecosystem 2026 — market model (research workspace)

Staged study of the global AI upskilling / AI learning ecosystem (trend window Jan 2024 – Sep 2026).

| Run | Phases | Status |
|---|---|---|
| 1 | P0 scope · P1 discovery · P2 entity resolution | **Done, with limits.** P1 is partial and no category is saturated. See `01_Run1_P1_P2_report.md` §7. |
| 2 | P3 primary research · P4 validation · P5 mapping · P6 assessment | Not started |
| 3 | P7 analysis · P8 synthesis / final report | Not started |

## Files
- `00_P0_scope_and_plan.md`: definitions, inclusion rules, taxonomy, search budget (written before searching)
- `01_Run1_P1_P2_report.md`: Run 1 results, exit-criteria check, limitations, Run 2 hand-off
- `data/ai_upskilling_ecosystem_run1.xlsx`: all datasets, one tab each
- `data/*.csv`: the same datasets as CSV (`providers`, `orgs`, `programs`, `usage_signals_p1`, `sources`, `context_datapoints`, `search_log`, `dedup_log`, `saturation_log`, `p2_fuzzy_check`, `p1_raw_candidates_all`)
- `data/p1_raw/`: untouched outputs of the six discovery slices
- `scripts/p2_entity_resolution.py`: reproducible P2 build (`pip install rapidfuzz openpyxl`)

**Evidence caution.** Every figure in `usage_signals_p1` is a discovery signal. None are verified findings yet. Most were captured from search-result snippets.
