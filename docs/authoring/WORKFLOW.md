# Content workflow

How the 25 objectives and the question bank are rebuilt by parallel agents without stepping on each other.

## Ownership

| Owner | May edit |
|---|---|
| A content work package | `src/content/objectives/<its ids>.mdx` only |
| A question work package | `src/data/questions/<its ids>.json` and may append to `src/data/questions/retired.json` |
| Labs agents | `labs/**` |
| Orchestrator only | `blueprint.json`, `src/data/facts.json`, components, specs, config, scripts |

An agent that needs a new component, a facts change or a blueprint change asks for it in its final report.

## Stages

1. **F (foundations)**: facts verification; exemplar objective (Prompt Engineering) and its items, then independent verification.
2. **Wave 1 content** (about 59% of exam weight): App Design; SWE Foundations; API Mechanics; Configuration + Claude Code; Requirements + Life Cycle; Technical Fundamentals + Debugging; LLM Fundamentals + Model Selection; Cost + Context Engineering.
3. **Wave 2 content**: Architecture + Patterns; Construction + Hooks; Tools + MCP; Customization + Output Handling; the security trio.
4. **Questions** follow content per work package, so items are written against the finished page.
5. **Verification** after each author: a fresh agent that sees only the files and the specs. Content verifiers fetch the docs for every load-bearing claim. Question verifiers blind-solve every item from stem and options before reading the key.
6. **Bank-level review**: a tell-hunter answers items from options alone (well above 25% means a tell); a consistency reviewer reads all 25 pages against `GLOSSARY.md`.

## Gates every agent runs before reporting

```
npx tsx scripts/check_blueprint.ts --strict --objective <id>
npx tsx scripts/lint_code.ts --objective <id>
npx tsx scripts/lint_questions.ts --strict --objective <id>
python3 scripts/check_originality.py src/data/questions --root .
npx astro check
```

## Report format (final message of every author agent)

JSON with: `files`, `wordCounts`, `itemCounts`, `gapsClosed`, `claims` (statement plus URL for each load-bearing claim), `openQuestions`, `requests` (component, facts or blueprint changes).
