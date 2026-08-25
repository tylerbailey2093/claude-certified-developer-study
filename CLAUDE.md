# CCDV-F Study System

Preparing for **Claude Certified Developer – Foundations** (exam code CCDV-F).
Goal: pass on the first attempt. Authoritative source is the official Exam Guide
v1.0, effective July 2026. `blueprint.json` is the machine-readable version.

## Who I am

Senior data engineer, client delivery on a Databricks stack (Unity Catalog,
Lakeflow Declarative Pipelines, MLflow, Databricks SDK). Already hold Claude
Certified Architect – Foundations. Comfortable with Python; TypeScript is
secondary. Skip fundamentals, engage at senior IC level.

**Communication:** direct, concise, no preamble, no sycophancy. Lead with the
answer. Bullets over paragraphs. When I'm wrong, say so with a reason and an
alternative. Flag confidence — [Certain] / [Likely] / [Guessing] — on anything
factual, financial, or strategic. No em dashes.

**Environment constraint:** my work machine has corporate egress restrictions
that block outbound API calls and MCP connections. If something fails with a
connection error rather than an auth error, that's the network. API-dependent
work may need to run on a personal machine.

## Exam facts — verified against the guide, treat as ground truth

| | |
|---|---|
| Items | 53, multiple-choice and multiple-response (each states how many to select) |
| Time | 120 minutes (~2.3 min/item) |
| Scoring | Scaled 100–1000, **cut score 720**, criterion-referenced |
| Fee | $125 USD per attempt |
| Delivery | Pearson VUE, online proctored or test center |
| Validity | 12 months; free non-proctored renewal if on time, full exam if lapsed |
| Retakes | 14 / 30 / 90 day waits; max 4 per rolling 12 months |
| Prerequisites | **None.** Awarded on exam performance alone |

**The most strategically important fact:** per-domain percentages on the score
report are **diagnostic only**. Pass/fail comes from the total scaled score and
there is **no per-domain minimum**. This is why weighting study time by blueprint
percentage works — a strong Domain 2 can carry a weak Domain 3.

## Domain weights

| Domain | Weight | Items |
|---|---|---|
| 2 · Applications and Integration | **33.1%** | ~17 |
| 5 · Model Selection and Optimization | 16.8% | ~9 |
| 1 · Agents and Workflows | 14.7% | ~8 |
| 6 · Prompt and Context Engineering | 11.0% | ~6 |
| 8 · Tools and MCPs | 10.6% | ~6 |
| 7 · Security and Safety | 8.1% | ~4 |
| 3 · Claude Code | 3.1% | ~2 |
| 4 · Eval, Testing, and Debugging | 2.6% | ~1 |

**Claude Application Design (8.6%, inside Domain 2) is the single heaviest
objective on the exam** — worth more than Claude Code, Eval/Debugging, and Hooks
combined. It also has no dedicated lesson in the official prep course.

Effort must track these weights. Do not spend a session polishing Claude Code
content worth two items.

## Scope corrections — these are counterintuitive and cost points

- **Claude Application Design (8.6%)** = how Claude interprets instructions
  across interfaces, content boundaries, schema design, session hygiene, plugin
  management. It is **not** workflow pattern selection — that's Domain 1.
- **Technical Fundamentals (6.1%)** is narrow: SDKs wrapping REST APIs, and
  websockets. Not context-window theory, not rate-limit mechanics.
- **Zero/single/multi-shot prompting** is scored in **Domain 5**, not Domain 6.
- **Batch API** is scored in **Domain 2** API Mechanics, not Domain 5 Cost.
- **Secrets management** is **Domain 7**, not Domain 2 Configuration Management.
- **Systems Life Cycle** is generic IT lifecycle including named frameworks
  (Waterfall, Agile, DevOps, ITIL), not LLM-specific delivery.
- **CLAUDE.md and settings.json** are scored in **both** Domain 2 and Domain 3.

## Item style calibration

From the three published samples: stems are **2–4 sentences**, not multi-paragraph
incident reports. Four options. Three distractors engineered to look defensible,
each failing for a *nameable* reason.

The dominant pattern: **one buried constraint in the stem decides the answer.**
"Not needed until morning" → batch. "Must stay in region" → regional endpoints.
"Reusable across applications" → MCP server. "Must happen every time" → a hook.

Second pattern: when a stem says something **must** or **always** happen, the
answer is a deterministic control (hook, permission rule, schema constraint),
never a system-prompt instruction. A prompt is a request; only code is a guarantee.

## Hard constraints

1. **NDA.** Exam content is confidential. Never reproduce, paraphrase, or closely
   track real exam items. All practice questions must be original. The three
   samples in `blueprint.json` exist **only** as originality reference — check
   against them, never copy from them. Threshold: difflib ratio must stay
   **below 0.55**.
2. **No dump sites.** Any source claiming "real exam questions," "dumps," or
   "actual questions" is both an NDA violation and almost certainly lying. Do not
   consult or cite them.
3. **Verify before asserting.** Model IDs, pricing, parameter support, and doc
   URLs all drift. Cite the page you read it on, or mark it uncertain.
4. **Post-guide API changes are low confidence for exam purposes.** Several
   parameter restrictions (sampling params returning 400, prefill removal) landed
   *after* the July 2026 guide, so exam items were probably not written against
   them. Keep them labelled as engineering knowledge, not exam content.

## Known defects that were found and fixed — do not reintroduce

- A syntax highlighter that stashed strings as `\u0000<index>\u0000` placeholders,
  then ran a number-matching rule that ate the placeholder indices. Every string
  in every code block silently became an integer. **Fixed with a single-pass
  tokenizer.** Never use placeholder substitution for highlighting.
- 60 of 64 correct answers sat in position B. **Options now shuffle at render.**
- One practice item scored 0.86 similarity against published Sample 3.
  **Rewritten; originality gate added.**
- A claim that course Module 5 mapped to "zero exam objectives." The full module
  description showed partial overlap. **Corrected.** Watch for this failure mode:
  a concrete, specific, satisfying claim asserted past the evidence.

## The official prep course

774 minutes, five modules on Anthropic Partner Academy. Runtime and exam weight
are close to inversely correlated.

| # | Module | Run | Covers |
|---|---|---|---|
| 1 | MSO Foundations | 57m | All of D5 (16.8%). Densest ratio in the course |
| 2 | Production-Grade Prompting, Agents & Tool Use | 209m | D1, D6, most of D8 |
| 3 | Claude Code, MCP & Integration | 142m | D3, MCP dev, **D2 Config Management** |
| 4 | Production Engineering, Evals & Security | 211m | All of D7, D4, D2 SWE + Lifecycle |
| 5 | Accelerators & IP Contribution | 155m | Thin. Reuse decisions, code review. Lowest ROI |

Roughly 12% of the exam (App Design 8.6% + Requirements 3.4%) has **no home
module** and lives in the seams. That gap is what the study guide exists to fill.

## Anthropic's own prep prescription (guide Section 7)

Anthropic states plainly that there is no single required course and that no
resource guarantees a pass. The recommended combination:

1. Study the blueprint and self-assess against each objective by name
2. Review official docs for API, models, prompt engineering, Claude Code, Skills, MCP
3. **Build and operate at least one Claude application** exercising the API, a
   tool, prompt and context engineering, and basic security and eval practice
4. Practise the competencies directly
5. Work the sample questions to calibrate to item style

**Item 3 gets its own bullet.** The `labs/` notebooks exist to satisfy it.

## Repo layout

```
guide/    ccdv-f-glass.html      primary study guide (glass theme)
          ccdv-f-prep.html       alternate (Atom One theme)
labs/     00–10 *.ipynb          hands-on notebooks + README
scripts/  check_originality.py   similarity gate against published samples
          verify_links.py        resolve every doc URL
blueprint.json                   machine-readable blueprint
```

## Working agreements

- Weight effort by blueprint percentage, always.
- Report findings before editing when verifying something.
- Show diffs for factual changes rather than silently editing.
- Prefer self-contained, zero-dependency output. Single-file HTML is a feature.
- Verify before claiming anything is done:
  ```
  python3 scripts/check_originality.py guide/ccdv-f-glass.html
  python3 scripts/verify_links.py guide/ccdv-f-glass.html      # needs egress
  ```
  `npm run verify` does not exist yet. Phase 4 creates it and should wrap exactly
  these checks plus a JS parse of the guide's inline script.
