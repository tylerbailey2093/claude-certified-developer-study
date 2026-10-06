# Objective authoring spec

The contract for every `src/content/objectives/<id>.mdx`. `scripts/check_blueprint.ts --strict --objective <id>` enforces the mechanical parts. Read `QUESTION_SPEC.md`, `GLOSSARY.md` and `src/data/facts.json` too.

## Reader

A senior data engineer (Databricks stack, Python first, TypeScript second) who already holds Claude Certified Architect. Skip "what is an API". Go deep on mechanism, decisions, and the exact cue that separates the right answer from a plausible one. Every page exists to win exam points, weighted by the blueprint.

## Voice

- Direct and concise. Lead with the answer. Bullets and tables over long paragraphs where they carry structure better.
- **No em dashes** (the user's rule). Use colons, commas, parentheses or a new sentence.
- Flag confidence on anything that drifts (model behaviour, limits, prices, beta headers): **[Certain]** verified on the cited page, **[Likely]** strong but not confirmed, **[Guessing]** reasoned. Unflagged statements must be stable facts.
- Say "the guide" for the Exam Guide v1.0. Never speculate about "real exam questions".

## Frontmatter (v2)

```yaml
---
id: "prompt-engineering"            # must match blueprint.json and the filename
domain: 6
domainName: "Prompt and Context Engineering"
name: "Prompt Engineering"          # exact blueprint name
weight: 4.6                         # exact blueprint weight
tier: 2
hot: false                          # true only for claude-application-design
summary: "One or two sentences used on cards and in search."
subskills: ["pe.clarity", "pe.few-shot", ...]   # exactly the blueprint subskill ids for this objective
related: ["llm-fundamentals", "context-engineering", "output-handling"]   # 3+ objective ids
scope: [...]                        # keep the blueprint scope list
traps:                              # 4+ structured traps
  - name: "Tool descriptions are not prompts"
    looksRight: "They are API metadata, so wording seems irrelevant to behaviour."
    failsBecause: "Claude reads the description to decide when and how to call the tool; vague descriptions cause wrong or missing calls."
    cue: "Stem says the model 'never calls the tool' or 'calls the wrong one' and every option except one changes code, not the description."
sources:                            # 3+; official first
  - { label: "Prompt engineering overview", url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview", kind: "docs", verified: "2026-10-06" }
lastReviewed: "2026-10-06"
authored: true
---
```

Source `kind`: `docs` (platform.claude.com, code.claude.com), `guide` (exam guide), `engineering` (anthropic.com/engineering), `spec` (modelcontextprotocol.io, RFCs), `swe-ref` (MDN, git-scm, semver.org, OWASP, NIST, ITIL/Agile references), `course` (Anthropic Academy). Only add a URL you fetched and read. If you cannot fetch it, do not cite it.

## Body: required sections, in this order

Do **not** add a "Named traps" or "What this objective tests" section: traps render from frontmatter in the Traps tab, and the guide text renders in the Overview tab. Duplicating them was a defect in v1.

### `## Concept`
- What the objective is really testing, in plain terms, in 2 to 4 short paragraphs.
- **Scope boundary**: what belongs to neighbouring objectives instead, with `<ObjLink>` to each. Include a short "Not this:" list.
- One `<Callout type="key">` with the single idea that wins the most points.

### `## Mechanism`
- One `###` per guide sub-skill, in blueprint order, each immediately followed by `<SubskillAnchor id="..." />`. Every sub-skill id in frontmatter must appear exactly once.
- Teach how it actually works: behaviour, defaults, failure modes, limits. Use tables for comparisons.
- End each sub-skill with one line: `**Exam angle:** ...` naming the cue words that point to it and the distractor it is usually confused with.
- Mark post-guide changes with `<PostGuide since="2026-08">...</PostGuide>`.

### `## Decision table`
A markdown table with columns `| If the stem says... | Choose | Why the runner-up loses |`. At least 6 rows. Each row is a buried-constraint cue.

### `## Worked walkthrough`
At least one `<Walkthrough title="Scenario: ...">` with 4 to 6 `<Step title="...">` children: read the scenario, find the constraint, eliminate distractors one by one with the reason each fails, choose, and a final step titled "The deciding cue" that names the exact words. Scenarios must be original: **never** reuse the three published sample scenarios (overnight non-urgent batch job; summarizer hit by hidden-text injection; internal REST inventory exposed to several apps via MCP), even reworded.

### `## Code`
- Python and TypeScript pairs, as **adjacent** fenced blocks (```python then ```typescript). The site renders each pair as one tabbed notebook cell. Shell/JSON blocks may stand alone.
- Short headings (`**Bold lead-in**` paragraphs) before each pair saying what it proves.
- Rules (enforced by `lint_code.ts`):
  - Model IDs only from `src/data/facts.json` `allowedModelIds`. Default to `claude-sonnet-5-5`; `claude-haiku-4-5` for cheap high-volume calls; `claude-opus-5-5` where the point is deep reasoning. Migration examples may name legacy IDs only from `legacyIdsAllowedInMigrationExamples`, and must say so.
  - Every `messages.create`, `messages.stream`, batch `params` and `count_tokens`-adjacent call sets `max_tokens`.
  - Never read `content[0].text`: the first block can be a thinking block on current models. Iterate blocks and pick `type == "text"` (`text_of(resp)` helper is fine if defined in the snippet).
  - No `temperature`/`top_p`/`top_k`, no assistant prefill, no `budget_tokens`, no forced `tool_choice` (`any`/`tool`) with current models. Use `output_config: {format: ...}` for structured output, not `output_format`. When showing why one of these breaks, put it in `<PostGuide>` and show the error.
  - Snippets must be runnable given `import anthropic; client = anthropic.Anthropic()` (or the TS equivalent). Define helpers you use.
- Use `<Output kind="illustrative">` after a cell to show what a real response looks like; label it illustrative unless you executed it.

### Diagrams
At least one `<Flow>` or `<Sequence>` in Mechanism or the walkthrough. Show the real mechanism (who calls whom, in what order, where state lives), not decoration.

```mdx
<Sequence title="Client tool loop" actors={["App", "Claude API", "Your tool"]}
  messages={[["App", "Claude API", "messages.create(tools)"],
             ["Claude API", "App", "stop_reason: tool_use", "reply"],
             ["App", "Your tool", "run(input)"],
             ["Your tool", "App", "result", "reply"],
             ["App", "Claude API", "tool_result block"]]} />

<Flow title="Guardrail layers" steps={[{label: "Input filter", kind: "guard"}, {label: "Model", kind: "model"}, {label: "Output validator", kind: "guard", note: "schema + policy"}]} />
```

### `## Recall checks`
At least 5 `<Recall q="...">answer</Recall>`, at least one per sub-skill when the objective has 5 or fewer. Answers are 1 to 4 sentences and state the reason, not just the fact.

### Cross-links
At least 3 `<ObjLink id="..."/>` in the body. Unknown ids fail the build.

## Length

Prose words (excluding code, tables and frontmatter) target `max(1200, weight x 600)`, rounded to 50. Over-target objectives are restructured, not padded. Depth beats breadth: one precise paragraph on a failure mode is worth more than three general ones.

## Accuracy protocol

1. Fetch the official page before asserting any behaviour, default, limit, header, or parameter. Cite it in `sources` with today's date.
2. Prefer the guide's wording for scope. The guide's lists are introduced with "including", so they are examples, not boundaries.
3. Anything that changed after July 2026 goes in `<PostGuide>` and is never the only basis for a question.
4. If two sources disagree, say so and mark [Likely].
5. Never open or cite sites selling "real exam questions", "dumps" or "actual questions".

## Available components (no import needed)

`<Callout type="key|trap|tip|note" title?>`, `<PostGuide since?>`, `<Recall q>`, `<ObjLink id hash?>`, `<SubskillAnchor id>`, `<Walkthrough title>` + `<Step title>`, `<Output kind date?>`, `<Flow steps title? caption?>`, `<Sequence actors messages title? caption?>`.

MDX rules: `{` and `<` in prose must be escaped or inside backticks; JSX props take JS expressions in `{}`; leave a blank line before and after block components.
