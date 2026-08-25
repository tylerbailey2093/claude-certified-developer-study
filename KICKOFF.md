# Paste this as your first message in Claude Code

---

I'm preparing for Anthropic's **Claude Certified Developer – Foundations** exam (CCDV-F) and I have an existing study system I want you to take over, verify, and extend. Read `CLAUDE.md` and `blueprint.json` before doing anything else — they carry the exam facts, the scope corrections, and the constraints you must not violate.

## What already exists in this repo

- `guide/ccdv-f-glass.html` — a complete single-file interactive study guide. All 8 domains, all 25 scored objectives, 15 dual-language code blocks, a 64-item quiz engine that samples to blueprint weights, per-objective doc links. Glass theme with light/dark.
- `guide/ccdv-f-prep.html` — same content, Atom One theme. Kept as an alternate.
- `labs/` — 11 Jupyter notebooks covering the hands-on objectives, plus a README.
- `research/` — **not included.** The source research report lives in the originating chat. Export it to `research/research-report.md` if you want it in-repo; nothing depends on it.

**Do not rebuild any of this.** It is verified against the official exam guide v1.0 and is content-complete. Your job is the work that could not be done in the environment where it was built.

## Phase 1 — Verification (do this first, report before proceeding)

The previous environment had **no network egress**, so several things were written from documentation but never actually executed or resolved. Fix that:

1. **Run every notebook in `labs/` against the live API.** Fix any cell that fails because a field, parameter, or model ID has drifted. Report exactly what changed. Notebooks 08 and 09 need no API key and were already verified — re-run them anyway to confirm they work on my machine.
2. **Resolve all 51 documentation links** in the guide's `SRC` map. Roughly a dozen were verified; the rest follow documented URL structure but were constructed. Report every 404 and replace it with the correct path.
3. **Verify the model lineup and pricing** in the guide against the live Models API and the pricing page. Report every discrepancy. Do not silently edit — show me the diff first.
4. **Verify the code samples** in the guide's `C` object still match current SDK syntax.

Report findings as a table before you change anything in the guide.

## Phase 2 — Extend the question bank to 150 items

Currently 64. Grow to 150, weighted to the blueprint (`blueprint.json` has exact per-objective weights).

Hard requirements:

- **Every item must be original.** The exam is NDA-protected. Never reproduce, paraphrase, or closely track real exam content.
- **Build an automated originality gate.** `scripts/check_originality.py` must compare every stem against the three sample questions in `blueprint.json` using difflib ratio and **fail the build above 0.55**. An earlier item scored 0.86 against Sample 3 and had to be rewritten; this gate exists so that cannot recur.
- **Match the published item style:** 2–4 sentence stem, four options, exactly one correct, and three distractors that each fail for a *nameable* reason. State the reason in the explanation.
- **Bias toward the buried-constraint pattern.** The deciding detail should sit mid-stem, not in the final sentence.
- Shuffle correct-answer position. A previous version had 60 of 64 answers in position B.
- Tag each item with its domain and sub-objective so the mock can sample correctly.

## Phase 3 — Make it a real app

The guide currently cannot persist anything because it was built as a chat artifact. Running locally, it can. Add:

- **localStorage persistence** for checklist state, quiz history, and per-objective confidence self-ratings
- **Miss tracking** — record wrong answers by objective and surface a "weakest objectives" view driven by real data rather than my guesses
- **Spaced repetition** on missed items: anything wrong reappears at 1 day, 3 days, 7 days
- **A timed mock mode** — 53 items, 120 minutes, countdown visible, no explanations until submission, then a full review with a scaled-score estimate
- **Export/import** of progress as JSON so it survives a browser wipe

## Phase 4 — Maintainability

The guide is a 180KB single file. Split it into `src/` (content data, questions, CSS, JS) with a build script that emits the single file, so the artifact stays self-contained but the source is editable. Add `npm run build`, `npm run verify` (originality + link check + JS parse), and a pre-commit hook running verify.

## Rules for working with me

- **Verify before asserting.** If you write a specific fact — a price, a limit, a parameter name — either cite the doc you read it in or mark it uncertain. Three separate overclaims were caught by auditing earlier output; assume you will make some too.
- **Weight by blueprint, not by interest.** Domain 2 is 33.1% of the exam and Claude Code is 3.1%. Effort should track that ratio.
- **Flag confidence** on claims that matter: [Certain] / [Likely] / [Guessing].
- **Push back** if you think a request is wrong. Say so with a reason and an alternative.
- Direct and concise. Skip preamble. I'm a senior data engineer; skip fundamentals.

Start with Phase 1. Report before you edit.
