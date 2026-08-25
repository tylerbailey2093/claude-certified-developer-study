# CCDV-F Study Platform

A study platform for Anthropic's **Claude Certified Developer – Foundations**
exam (CCDV-F): all 8 domains, all 25 scored objectives at mastery depth, a
145-item original question bank, a timed 53-item mock exam, and localStorage
progress tracking with spaced repetition.

## Start here

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. Every objective, the practice quiz, the
timed mock exam, and your progress dashboard are all there. Progress persists
to your browser's localStorage — export it from the Progress page before
clearing site data or switching machines.

To build the static site (what actually deploys):

```bash
npm run build      # emits dist/
npm run preview    # serve the build locally to sanity-check it
```

**Want the hands-on work?** `labs/` has 11 notebooks, each sized for one
sitting. Read `labs/README.md` first. If you only run three, run 02 (caching),
06 (structured output), and 09 (hooks) — no API key needed for the last two.

## What's here

```
src/
  content/objectives/   25 MDX files: mastery-depth content, one per objective
  content.config.ts     Zod schema — build fails if an objective is missing
                         or its weight disagrees with blueprint.json
  islands/               5 React islands: Quiz, MockExam, ProgressDashboard,
                         ConfidenceRating, Search — everything else is static
  data/questions/        145-item question bank, split by domain + all.json
  data/legacy-objectives.json   the original guide's content, kept as a
                         fallback floor for anything not yet re-authored
  lib/store.ts           localStorage layer: misses, spaced repetition,
                         mock history, confidence ratings, export/import
  pages/                 index, domain/[n], objective/[id], quiz, mock,
                         progress, logistics
scripts/
  check_originality.py   NDA originality gate (difflib + 4-gram Jaccard,
                         threshold 0.55 against the 3 published samples)
  check_coverage.mjs     per-objective item counts + mock-pool variance gate
  merge_new_questions.mjs   folds authored question sets into the main bank
  verify_links.py        resolves every doc URL cited in the content
blueprint.json            machine-readable blueprint: 25 objectives, weights,
                         scope, traps — the authoritative source for content
labs/                     11 hands-on notebooks + README
legacy/guide/              the original single-file HTML guide, frozen
CLAUDE.md                 project memory / working agreements
```

## The three facts that shape everything here

1. **Domain 2 is 33.1% of the exam.** More than Claude Code, Eval/Debugging,
   Security, and Tools/MCP combined. Claude Application Design alone (8.6%) is
   the heaviest single objective and gets no dedicated lesson in the official
   prep course — it has the deepest treatment in this platform to match.
2. **There is no per-domain minimum.** Per-domain percentages on the score
   report are diagnostic only; pass/fail is the total scaled score. That is
   why every objective here is depth-tiered by blueprint weight, not by how
   interesting the topic is.
3. **Anthropic's own prep guidance puts "build and operate at least one
   Claude application" in its own bullet.** Not read about. Not watch.
   `labs/` exists for exactly that.

## Verify before trusting a claim

```bash
npm run verify
```

Runs, in order: `astro check` (types), `check_coverage.mjs` (every objective
has enough items, and every domain's pool exceeds its mock-exam sampling need
by at least 1.5x so repeat mocks don't draw an identical set), and
`check_originality.py` against the full 145-item bank. All three must pass
before the originality or coverage numbers below are trustworthy.

```bash
python3 scripts/verify_links.py dist/links.json
```

Needs network egress. Resolves every cited doc URL after a build. On a
restricted network everything reports connection errors, which is a network
result, not a link result — read the output rather than the exit code alone.

## Honest caveats

- **The labs have never been run against the live API.** Python is
  syntax-clean and the two offline labs (08, 09) execute end to end, but
  expect to fix a cell or two elsewhere.
- **Model IDs and pricing drift.** Every objective's factual claims were
  checked against live documentation during authoring (this machine has
  working egress), but re-verify anything specific against
  platform.claude.com before relying on it for the exam.
- **Candidate-experience claims are low confidence.** The exam launched
  around 13 July 2026 and there are very few public accounts. No official
  pass rates exist.
- **The scaled-score estimate on the mock exam is a linear approximation**
  (`100 + 900 × percent-correct`, cut at 720). Anthropic does not publish the
  real raw-to-scaled mapping; the mock UI labels this an estimate for exactly
  that reason.
- **localStorage is per-browser.** Progress does not sync across devices —
  export/import from the Progress page is the manual bridge.

Not affiliated with, endorsed by, or sponsored by Anthropic. Contains no real
exam content — every practice item is original and gated against the three
published sample questions.
