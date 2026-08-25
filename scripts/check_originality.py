#!/usr/bin/env python3
"""Originality gate for CCDV-F practice questions.

Exam content is NDA-protected. This script fails the build if any authored
question tracks one of the three published sample items too closely.

An earlier item in this project scored 0.86 against Sample 3 before this gate
existed. That is why it exists.

Usage:
    python3 scripts/check_originality.py guide/ccdv-f-glass.html
    python3 scripts/check_originality.py --json questions.json
"""
import argparse, difflib, json, re, sys, unicodedata
from pathlib import Path


def load_blueprint(root: Path) -> dict:
    return json.loads((root / "blueprint.json").read_text())


def normalise(s: str) -> str:
    """Lowercase, strip accents and punctuation, collapse whitespace.

    Comparing raw strings understates similarity: swapping 'inventory' for
    'routing' while keeping the sentence skeleton is still a copy.
    """
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def shingles(s: str, n: int = 4) -> set:
    w = normalise(s).split()
    return {" ".join(w[i:i + n]) for i in range(max(0, len(w) - n + 1))}


def scores(candidate: str, reference: str) -> dict:
    """Two independent measures. Either one tripping is a failure."""
    ratio = difflib.SequenceMatcher(None, normalise(candidate), normalise(reference)).ratio()
    a, b = shingles(candidate), shingles(reference)
    jaccard = len(a & b) / len(a | b) if (a | b) else 0.0
    return {"ratio": ratio, "shingle": jaccard}


def extract_from_html(path: Path) -> list:
    """Pull q:"..." stems out of the guide's inline question bank."""
    h = path.read_text()
    out = []
    for m in re.finditer(r'\{d:(\d+),s:"([^"]*)",q:"((?:[^"\\]|\\.)*)"', h):
        out.append({"domain": int(m.group(1)), "objective": m.group(2),
                    "stem": m.group(3).replace('\\"', '"')})
    return out


def extract_from_json(path: Path) -> list:
    data = json.loads(path.read_text())
    items = data if isinstance(data, list) else data.get("questions", [])
    return [{"domain": q.get("d") or q.get("domain"),
             "objective": q.get("s") or q.get("objective", ""),
             "stem": q.get("q") or q.get("stem", "")} for q in items]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="guide HTML or questions JSON")
    ap.add_argument("--json", action="store_true", help="target is JSON")
    ap.add_argument("--threshold", type=float, default=None)
    ap.add_argument("--root", default=".")
    a = ap.parse_args()

    root = Path(a.root)
    bp = load_blueprint(root)
    ref = bp["official_samples_for_originality_check_only"]
    refs = ref["stems"]
    thr = a.threshold if a.threshold is not None else ref.get("threshold", 0.55)

    target = Path(a.target)
    items = extract_from_json(target) if a.json or target.suffix == ".json" \
        else extract_from_html(target)

    if not items:
        print("FAIL: no questions found in", target)
        return 2

    worst, fails = 0.0, []
    for it in items:
        for i, r in enumerate(refs, 1):
            sc = scores(it["stem"], r)
            peak = max(sc["ratio"], sc["shingle"])
            worst = max(worst, peak)
            if peak >= thr:
                fails.append((it, i, sc, peak))

    print(f"checked {len(items)} items against {len(refs)} published samples")
    print(f"threshold {thr:.2f} | highest similarity observed {worst:.2f}")

    if fails:
        print(f"\nFAIL: {len(fails)} item(s) track a published sample too closely.\n")
        for it, i, sc, peak in fails:
            print(f"  Sample {i}  ratio={sc['ratio']:.2f} shingle={sc['shingle']:.2f} peak={peak:.2f}")
            print(f"  D{it['domain']} · {it['objective']}")
            print(f"  {it['stem'][:150]}\n")
        print("Rewrite these from a different scenario. Do not reword the same one.")
        return 1

    print("\nPASS: all items are sufficiently original.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
