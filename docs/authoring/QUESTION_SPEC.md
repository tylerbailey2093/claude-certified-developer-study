# Question authoring spec

Every item lives in `src/data/questions/<objective-id>.json` (a JSON array). The schema is `src/lib/bank/schema.ts`; `scripts/lint_questions.ts --strict --objective <id>` enforces the rules below. All items must be **original**.

## Hard constraints (NDA)

- Never reproduce, paraphrase, or closely track real exam items. Never open sites offering "real exam questions", "dumps" or "actual questions".
- The three published samples in `blueprint.json` are an originality reference only. **Do not reuse their scenario skeletons**, even reworded: (1) overnight / non-urgent bulk job choosing batch vs realtime, (2) summarizer of user-submitted pages hit by hidden-text injection, (3) internal REST service exposed to several apps through a shared MCP server. The lexical gate cannot catch semantic copying; you must.
- `check_originality.py` must stay below 0.55 for stems and options.

## Shape

```json
{
  "id": "prompt-engineering-007",
  "objective": "prompt-engineering",
  "domain": 6,
  "subskills": ["pe.component-placement", "pe.clarity"],
  "type": "single",
  "select": 1,
  "stem": "A support assistant follows its persona rules in testing, but in production it starts ignoring the refund policy once conversations pass about 40 turns. The policy text is pasted into the first user message of each conversation. Which change most directly fixes the cause?",
  "options": [
    { "id": "a", "text": "Move the refund policy into the system prompt so it is durable instructions rather than early conversation content", "why": "Correct. Durable rules belong in system, which the model treats as standing instructions; a policy buried in an early user turn loses influence as the conversation grows." },
    { "id": "b", "text": "Repeat the refund policy in every user message so it stays near the end of the context window", "why": "Treats the symptom: it burns tokens on every turn, breaks prompt caching of the history, and still mixes operator rules into user content." },
    { "id": "c", "text": "Raise max_tokens so the model has more room to consider the policy before answering", "why": "max_tokens caps the response length; it does not change how much weight earlier context gets." },
    { "id": "d", "text": "Switch to a larger model tier so long conversations are followed more faithfully", "why": "A bigger model may drift less, but the placement problem remains and the cost rises for every request." }
  ],
  "answer": ["a"],
  "explanation": "The cue is that the rule lives in the first user message. Standing operator rules belong in the system prompt; user turns carry task data. Moving it fixes the cause at zero ongoing cost.",
  "cue": "pasted into the first user message",
  "pattern": "buried-constraint",
  "difficulty": 2,
  "tags": [],
  "sources": [{ "label": "Prompt engineering overview", "url": "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview" }],
  "verified": "2026-10-06",
  "author": "agent:q-prompt-engineering",
  "status": "active"
}
```

## Rules (lint-enforced for `status: "active"`)

**Stem**
- 2 to 4 sentences, a realistic developer scenario, ending in a question mark, or for multi-response ending in `Select two.` / `Select three.`
- One buried constraint decides the answer. Put it **mid-stem**, not in the last sentence. Copy those exact words into `cue` (verbatim substring of the stem).
- Multi-response items say `Select two.` or `Select three.` in the stem and set `select` to match. Single items never say "select".
- No model version pinning in stems ("on Opus 5.5..."). If the answer depends on post-guide behaviour, set `postGuide: {note}`; such items never appear in the simulator.

**Options**
- Single: exactly 4 options. Multi: 4 to 6 options with 2 or 3 correct.
- **Every option has a `why` of at least 8 words**: for the correct option, why it is right; for each distractor, the *nameable* reason it fails (wrong mechanism for this constraint, unenforceable control, wrong layer, does not address the tradeoff, real but irrelevant).
- Distractors are **real mechanisms used in the wrong place**, not nonsense. A candidate who half-knows the topic should find at least two options plausible.
- **Length tell**: the correct option must not be the longest by habit. At least one distractor within 15% of the correct option's length; correct option at most 1.25x the longest distractor. Across each objective, the correct option is strictly longest in at most 40% of single items. Write distractors with the same specificity and qualifiers as the answer.
- **Absolute-word tell**: do not put "always", "never", "only", "guaranteed" only in distractors. Sometimes the right answer is the absolute one (a hook *always* runs).
- No "all of the above" / "none of the above". No positional references anywhere ("option A", "the first choice", "(B)"): options are shuffled at render.

**Explanation**
- 2 to 4 sentences: the deciding cue, the principle, and why the most tempting distractor fails. Teach, do not restate.

**Classification**
- `subskills`: 1 to 2 ids from this objective's blueprint subskills (primary first). Every subskill needs at least 2 items across the bank.
- `pattern`: `buried-constraint`, `must-means-deterministic`, `wrong-place-mechanism`, `scope-boundary`, `tradeoff`, `diagnosis`, `sequence`.
- `difficulty`: 1 foundational recall in context, 2 exam-level (two plausible options), 3 hard (three plausible options or a two-step inference). Target mix per objective: 25% / 45% / 30%.
- `sources`: at least one URL you read, from the allowlist in `lint_questions.ts` (official Anthropic docs first; MDN, RFC, git-scm, semver.org, OWASP, NIST for generic SWE and security). `verified`: today's date.

## Mix targets per objective

- Item count: `max(8, round(weight x 4.5))` (see `scripts/check_coverage.ts`).
- About 20% multi-response (at least 1 per objective with 8+ items).
- Patterns: buried-constraint in 40%+, wrong-place-mechanism distractors in 30%+, must-means-deterministic wherever the objective has a "must/always" decision.
- Domain 2 is about one third generic software engineering (REST, versioning, async, git, code review, refactoring, life cycle). Write those items as generic SWE, set in a Claude application where natural.

## Repairing legacy items

Items with `status: "needs-rationale"` predate this spec. When you own an objective:
1. Keep an item's `id` if the concept survives (spaced-repetition history carries over). Rewrite the stem to 2 to 4 sentences, add `why` to every option, remove positional references, rebalance option lengths, set `cue`, `subskills`, `pattern`, `difficulty`, `sources`, `verified`, `author`, then `status: "active"`.
2. If an item is weak, duplicative, or tracks a published sample, move it to `retired.json` with `status: "retired"` and a `tags: ["retired:<reason>"]` entry.

## Self-check before reporting

```
npx tsx scripts/lint_questions.ts --strict --objective <id>
python3 scripts/check_originality.py src/data/questions --root .
npx tsx scripts/check_coverage.ts
```
Then answer every new item yourself from stem and options only, without looking at `answer`. If you can name two defensible answers, rewrite it.
