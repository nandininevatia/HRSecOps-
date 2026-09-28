"""P2 entity resolution: merge the P1 discovery slices into a deduplicated provider list.

Inputs  : data/p1_raw/*_candidates.csv  (one per discovery slice)
          data/p2_overrides.json        (manual merge / hierarchy decisions, reviewed by hand)
Outputs : data/p1_raw_candidates_all.csv, data/providers.csv, data/orgs.csv,
          data/programs.csv, data/dedup_log.csv, data/p2_merge_review.csv

Matching rule (see 00_P0_scope_and_plan.md §6):
  auto-candidate pair if  token_set_ratio(norm names) >= 90
                     or  (same host and first path segment AND ratio >= 70)
                     or  alias hit.
  Pairs are *proposed* in p2_merge_review.csv; only pairs confirmed (auto_accept) or
  listed in overrides["merge"] are merged. Everything merged is written to dedup_log.
"""
import csv, glob, json, os, re
from urllib.parse import urlparse
from rapidfuzz import fuzz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "p1_raw")
OUT = os.path.join(ROOT, "data")

STOP = {"the", "ai", "academy", "learn", "learning", "university", "online", "inc", "ltd",
        "course", "courses", "program", "programme", "for", "of", "and", "by", "with"}


def norm(s):
    s = (s or "").lower()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^a-z0-9À-￿ ]+", " ", s)
    return " ".join(s.split())


def core(s):
    toks = [t for t in norm(s).split() if t not in STOP]
    return " ".join(toks) or norm(s)


def hostpath(url):
    try:
        u = urlparse(url if "://" in (url or "") else "https://" + (url or ""))
    except ValueError:
        return "", ""
    host = (u.hostname or "").removeprefix("www.")
    seg = (u.path or "/").strip("/").split("/")[0].lower()
    return host, seg


def load_raw():
    rows = []
    for path in sorted(glob.glob(os.path.join(RAW, "*_candidates.csv"))):
        slice_ = os.path.basename(path).split("_")[0]
        with open(path, newline="", encoding="utf-8") as f:
            for i, r in enumerate(csv.DictReader(f)):
                r = {k.strip(): (v or "").strip() for k, v in r.items() if k}
                if not r.get("name"):
                    continue
                r["raw_id"] = f"R-{slice_}-{i+1:03d}"
                r["discovery_slice"] = slice_
                rows.append(r)
    return rows


def main():
    rows = load_raw()
    ov_path = os.path.join(OUT, "p2_overrides.json")
    ov = json.load(open(ov_path)) if os.path.exists(ov_path) else {}
    reject = {tuple(sorted(p)) for p in ov.get("reject_pairs", [])}
    forced = ov.get("merge", {})          # raw name -> canonical name
    exclude = set(ov.get("exclude", []))  # raw names removed (with reason in overrides)

    # write the unified raw file
    fields = ["raw_id", "discovery_slice"] + [k for k in rows[0] if k not in ("raw_id", "discovery_slice")]
    allf = sorted({k for r in rows for k in r}, key=lambda k: fields.index(k) if k in fields else 999)
    with open(os.path.join(OUT, "p1_raw_candidates_all.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=allf); w.writeheader(); w.writerows(rows)

    # union-find clustering
    parent = list(range(len(rows)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    def union(i, j):
        parent[find(j)] = find(i)

    review = []
    keyed = [(core(r["name"]), hostpath(r.get("url", "")),
              {core(a) for a in re.split(r"[;|/]", r.get("aliases", "")) if a.strip()}) for r in rows]
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            ni, (hi, si), ai = keyed[i]; nj, (hj, sj), aj = keyed[j]
            ratio = fuzz.token_set_ratio(ni, nj) if ni and nj else 0
            same_hp = hi and hi == hj and si == sj
            alias = ni in aj or nj in ai or bool(ai & aj)
            reason = None
            if ratio >= 90 and fuzz.ratio(ni, nj) >= 80:
                reason = f"name ratio {ratio:.0f}"
            elif same_hp and ratio >= 70:
                reason = f"same host/path + ratio {ratio:.0f}"
            elif alias:
                reason = "alias match"
            if not reason:
                continue
            pair = tuple(sorted((rows[i]["name"], rows[j]["name"])))
            decision = "reject (override)" if pair in reject else "merge"
            review.append({"raw_a": rows[i]["raw_id"], "name_a": rows[i]["name"],
                           "raw_b": rows[j]["raw_id"], "name_b": rows[j]["name"],
                           "reason": reason, "decision": decision})
            if decision == "merge":
                union(i, j)

    by_name = {}
    for i, r in enumerate(rows):
        by_name.setdefault(r["name"], []).append(i)
    for raw_name, canon in forced.items():
        if raw_name in by_name and canon in by_name:
            for i in by_name[raw_name]:
                union(by_name[canon][0], i)
                review.append({"raw_a": rows[by_name[canon][0]]["raw_id"], "name_a": canon,
                               "raw_b": rows[i]["raw_id"], "name_b": raw_name,
                               "reason": "manual override", "decision": "merge"})

    with open(os.path.join(OUT, "p2_merge_review.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["raw_a", "name_a", "raw_b", "name_b", "reason", "decision"])
        w.writeheader(); w.writerows(review)

    clusters = {}
    for i in range(len(rows)):
        clusters.setdefault(find(i), []).append(i)

    # choose the kept record: prefer an explicit canonical, then most filled fields
    def score(i):
        r = rows[i]
        return (r["name"] in forced.values(), sum(bool(v) for v in r.values()), r.get("source_tier", "").startswith("T1"))
    return rows, clusters, score, ov, exclude


if __name__ == "__main__":
    import p2_build  # noqa: F401  (build step lives in p2_build.py)
