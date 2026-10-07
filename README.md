# CCDV-F Field Lab

An offline-first study site for Anthropic's **Claude Certified Developer – Foundations** exam (CCDV-F): every scored objective at depth, an original question bank weighted to the blueprint, a Pearson-style exam simulator, walkthrough labs, and progress tracking with spaced repetition. Lakehouse-styled, installable as an app, and usable on a plane.

Live: https://tylerbailey2093.github.io/claude-certified-developer-study/

<!-- stats:start -->
| | |
|---|---|
| Objectives | 25 (all 8 domains), every page on the v2 structure |
| Question bank | 360 active original items (target 453), 18.6% multi-response; `npm run coverage` for per-objective counts |
| Labs | 11 |
<!-- stats:end -->

## Use it

- **Install it** (Chrome/Edge: install icon in the address bar; iOS Safari: Share, Add to Home Screen). The whole site, the question bank and search are cached, so everything works offline, including the exam timer.
- **Practice** (`/practice/`): exam-weighted mixes, due reviews, weak spots, by domain or objective, multi-response only. Every option explains why it is right or wrong.
- **Exam simulator** (`/exam/`): 53 items in 120 minutes drawn by blueprint weight, flag for review, review grid, resumable after reload, pacing analytics afterwards.
- **Progress** (`/progress/`): mastery against exam weight, spaced-repetition forecast, calibration, exam trend.
- Progress lives in your browser. Back it up from **Settings**.

## Develop

```bash
npm ci
npm run dev           # http://localhost:4321
npm run verify        # every gate, then a production build
npm run test:e2e      # Playwright against the built site (offline, exam, migration, smoke)
```

Build with the Pages base path to reproduce production: `BASE_PATH=/claude-certified-developer-study npm run build`.

## Content model

- `blueprint.json`: the exam blueprint (v2) with the guide's verbatim objective text and 144 sub-skills.
- `src/content/objectives/<id>.mdx`: one page per objective, written to `docs/authoring/AUTHORING_SPEC.md`.
- `src/data/questions/<id>.json`: original items written to `docs/authoring/QUESTION_SPEC.md`.
- `labs/*.ipynb` + `labs/annotations/*.json`: notebooks; `npm run labs:build` generates the lab pages.
- `src/data/facts.json`: model IDs, prices and defaults. Drifting facts live here and nowhere else.

## Gates

| Script | Checks |
|---|---|
| `check_blueprint.ts` | blueprint invariants; page structure against the spec (strict for pages in `scripts/strict-objectives.json`) |
| `check_mdx.ts` | every page compiles |
| `lint_code.ts` | model IDs, `max_tokens`, first-block reads, rejected params, Python and TypeScript syntax |
| `lint_questions.ts` | schema, rationales, cue, positional references, length and absolute-word tells, near-duplicates, source allowlist |
| `check_originality.py` | stems and options against the three published samples (< 0.55) |
| `check_coverage.ts` | items per objective and sub-skill against blueprint-derived targets |
| `check_contrast.ts`, `check_budget.ts` | WCAG contrast in both themes; offline precache size |
| `check_links.mjs`, `check_external_links.ts` | internal links (blocking); cited URLs (weekly, informational) |

## Disclaimers

Original material written against the CCDV-F Exam Guide v1.0 (July 2026). Contains no real exam content; every practice item is original and checked against the published samples. Independent project, not affiliated with, endorsed by, or sponsored by Anthropic or Databricks. The visual style is lakehouse-inspired; no third-party logos are used.
