# Glossary and cross-objective consistency

Several facts are taught in more than one objective. They must be stated the same way everywhere. If you find a page that disagrees, flag it in your report; do not silently pick one. Anything marked *verify* must be checked against the cited doc before you rely on it.

## Naming

| Use | Not |
|---|---|
| the guide (Exam Guide v1.0, July 2026) | the blueprint PDF, the syllabus |
| Messages API | chat API, completions API |
| Message Batches API (Batch API is fine after first use) | bulk API |
| system prompt (top-level `system` parameter) | system message role (except Claude's mid-conversation system messages, which are post-guide) |
| content block | content part |
| tool use / tool_result | function call result |
| client tools (you execute) vs server tools (Anthropic executes) | local/remote tools |
| Claude Agent SDK | Claude Code SDK (old name) |
| Managed Agents (Anthropic-hosted) vs self-hosted (Agent SDK, your own loop) | |
| subagent (Claude Code, Agent SDK) | sub-agent (fine in the guide's phrase "sub-agents") |
| Skill / SKILL.md | plugin (a plugin can *package* skills, commands, agents, hooks, MCP servers) |
| MCP server / MCP client / MCP host | MCP plugin |
| hook (deterministic, runs in the harness) | prompt rule |
| CLAUDE.md (memory: instructions the model reads) vs settings.json (configuration the harness enforces: permissions, hooks, env) | config file |

## Facts that must agree across pages (verify against current docs)

- **Advisory vs enforced.** CLAUDE.md and system prompts are *requests* the model usually follows. Permissions, hooks and schemas are *enforced* by code. "Must / always / guaranteed" in a stem points to the enforced layer. (Applies in D1, D2, D3, D6, D7.)
- **Prompt cache prefix order** is `tools`, then `system`, then `messages`; any byte change invalidates everything after it. Minimum cacheable length is model-dependent. Cached prefixes still occupy the context window (caching changes price, not size). Changing `tool_choice` or images invalidates only the messages segment; changing tool definitions invalidates everything. Teach reads at 0.1x and writes at 1.25x (5m) / 2x (1h); per-model read overrides are post-guide (`facts.json` `caching`). *verify* current minimums and pricing multipliers on the prompt caching page before quoting numbers.
- **Batch**: asynchronous, results within 24 hours, 50% of standard price, results unordered and joined on `custom_id`. *verify* on the batch processing page.
- **stop_reason** values (`end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal`, `model_context_window_exceeded`) arrive on an HTTP 200. None is an HTTP error. `refusal` carries `stop_details`. A `max_tokens` truncation can be raised or continued; the mistake is sending truncated output for *repair* as if it were complete.
- **Streaming** uses server-sent events (SSE), not WebSockets. Final usage arrives in `message_delta`. An `error` event can arrive after the 200.
- **SDK retries**: default 2 retries with backoff on connection errors, 408, 409, 429 and 5xx; honours retry-after; timeouts are retried too. Default timeout 10 minutes. The spend-cap 429 has no retry-after and retrying will not fix it. Do not stack your own retry loop on top of the SDK's (2 x 3 attempts becomes 9). (`facts.json` `sdkDefaults`.)
- **Thinking usage**: thinking tokens are billed as output at full length (even when display is omitted) and counted inside `output_tokens`. `usage.output_tokens_details.thinking_tokens` is documented on the thinking cost page (when streaming, only on the final `message_delta`) [Likely post-guide]: fine to teach, avoid making it the crux of a question.
- **Partner platforms** (as of 2026-10-06): Bedrock and Vertex lack Message Batches, Files API, Models API and URL sources; Foundry lacks Message Batches and the Models API. Claude Platform on AWS is Anthropic-operated with near same-day parity. Vertex uses bare model IDs (older models `@date`); Bedrock Mantle uses an `anthropic.` prefix.
- **Streaming recovery on 4.6+**: prefill is gone, so continue an interrupted response with a user message.
- **Auth header**: the API overview now lists `Authorization: Bearer` with `x-api-key` as a still-supported legacy form [Likely post-guide]; code examples may use either, pages should not claim only one works.
- **Retry safety depends on idempotency**: GET, HEAD, OPTIONS, PUT, DELETE are idempotent; POST is not, so a timeout on a POST is an unknown outcome and needs an idempotency key before retrying. Because SDK timeouts are retried, worst-case wall clock is about timeout x (max_retries + 1).
- **Hooks (Claude Code)**: `PreToolUse` can block a tool call. Exit code 2 blocks and feeds stderr back to Claude; other non-zero exit codes are non-blocking errors (the action proceeds). *verify* event names and exit-code semantics on code.claude.com/docs/en/hooks before teaching details.
- **Permission evaluation**: deny rules beat allow rules; hooks run before permission rules and can deny even an allowed call. *verify* the exact order on the permissions page.
- **CLAUDE.md hierarchy**: enterprise/managed policy, user (`~/.claude/CLAUDE.md`), project (`./CLAUDE.md` or `./.claude/CLAUDE.md`), local overrides, plus nested directory files loaded on demand. *verify* names and precedence on the memory page.
- **settings.json scopes**: managed > command line > local project (`.claude/settings.local.json`) > shared project (`.claude/settings.json`) > user (`~/.claude/settings.json`). *verify* on the settings page.
- **MCP primitives**: tools (model-controlled), resources (application-controlled), prompts (user-controlled). Transports: stdio for local processes, Streamable HTTP for remote; the older HTTP+SSE transport is deprecated. *verify* on modelcontextprotocol.io.
- **MCP connector on the Messages API** needs both `mcp_servers` and an `mcp_toolset` entry in `tools` (beta). Post-guide detail: mark PostGuide if you teach the exact shape.
- **Data residency** ("must stay in region"): on the first-party API, `inference_geo` (us or global today) plus workspace-allowed geos; on Bedrock and Google Cloud, regional endpoints. Teach the concept; parameter details are drifting engineering knowledge. *verify* on platform.claude.com/docs/en/manage-claude/data-residency.
- **Redirected doc URLs**: cite `/docs/en/manage-claude/data-residency` (not the old data-residency path) and `/docs/en/test-and-evaluate/develop-tests` (not define-success).
- **Subagents exist mainly for context isolation** (a fresh, focused context that returns a summary), and secondarily for parallelism and tool restriction.
- **Few-shot**: taxonomy (zero/single/multi-shot) is listed in D5 LLM Fundamentals; building and placing examples is listed in D6 Prompt Engineering. Both domains can ask about examples.
- **Model tiers**: Opus for hardest reasoning and long-horizon agents, Sonnet for balanced everyday and agentic work, Haiku for fast, cheap, high-volume work. Note the docs disagree on the default starting tier (models overview: start on Opus 5.5; pricing page: Sonnet for most production) [Likely]; exam items follow the classic Haiku/Sonnet/Opus split. Current IDs and prices live only in `facts.json`; teach tradeoffs, not version numbers.
- **Thinking**: current models use adaptive thinking controlled by `effort`; fixed `budget_tokens` is legacy. Thinking tokens are billed as output tokens. Detailed per-model restrictions are post-guide: use `<PostGuide>`.

## Scope corrections (from the guide)

- Claude Application Design (8.6%) is instruction interpretation across surfaces, content boundaries, schema design, session hygiene, plugin management. Workflow-pattern selection belongs to D1.
- Technical Fundamentals lists SDKs over REST and websockets as *examples* ("including").
- Batch API is listed in D2 API Mechanics; cost-framed batch questions are still plausible in D5.
- Secrets management is D7 (Identity, Secrets, and Key Management), not D2 Configuration Management.
- Systems Life Cycle is generic IT life cycle (frameworks such as Waterfall, Agile, DevOps, ITIL are reasonable examples; the guide names none).
- CLAUDE.md and settings.json appear in both D2 Configuration Management and D3 Claude Code Operation.
