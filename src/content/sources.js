// Extracted from legacy/guide/ccdv-f-glass.html (var SRC), Aug 2026.
// Doc-link map keyed by objective name. P/E are base URL prefixes.
const P = 'https://platform.claude.com/docs/en/';
const E = 'https://www.anthropic.com/engineering/';
// Claude Code docs live under a separate domain/path now; the legacy guide's P
// prefix ('platform.claude.com/docs/en/') was stale for these paths — corrected
// after multiple content-authoring agents independently hit 404s and verified
// the current location live.
const CC = 'https://code.claude.com/docs/en/';

export const SRC = {
 "Understanding Requirements":[["Choosing a model",P+"about-claude/models/choosing-a-model"],["Pricing",P+"about-claude/pricing"]],
 "Systems Life Cycle":[["Model deprecations",P+"about-claude/model-deprecations"],["Versioning",P+"api/versioning"]],
 "Agent Architecture":[["Building effective agents",E+"building-effective-agents"]],
 "Agent Construction with Claude":[["Agent SDK",P+"api/agent-sdk/overview"],["Building effective agents",E+"building-effective-agents"]],
 "Agent Patterns & Frameworks":[["Context engineering",E+"effective-context-engineering-for-ai-agents"],["Building effective agents",E+"building-effective-agents"]],
 "Claude API Mechanics":[["Messages",P+"build-with-claude/working-with-messages"],["Streaming",P+"build-with-claude/streaming"],["Prompt caching",P+"build-with-claude/prompt-caching"],["Batch",P+"build-with-claude/batch-processing"],["Tool use",P+"agents-and-tools/tool-use"],["PDF support",P+"build-with-claude/pdf-support"],["Files API",P+"build-with-claude/files"],["Citations",P+"build-with-claude/citations"]],
 "Software Engineering Foundations":[["Python SDK",P+"api/sdks/python"],["Errors",P+"api/errors"]],
 "Claude Application Design":[["Structured outputs",P+"build-with-claude/structured-outputs"],["Claude Code settings",CC+"settings"]],
 "Configuration Management":[["Claude Code settings",CC+"settings"],["Model deprecations",P+"about-claude/model-deprecations"]],
 "Claude Code Operation":[["Claude Code",CC+"overview"],["Agent Skills",P+"agents-and-tools/agent-skills/best-practices"],["Hooks",CC+"hooks"]],
 "Debugging & Error Handling":[["Errors",P+"api/errors"],["Demystifying evals",E+"demystifying-evals-for-ai-agents"]],
 "LLM Fundamentals":[["Context windows",P+"build-with-claude/context-windows"],["Extended thinking",P+"build-with-claude/extended-thinking"]],
 "Technical Fundamentals":[["Python SDK",P+"api/sdks/python"],["TypeScript SDK",P+"api/sdks/typescript"]],
 "Model Selection & Tradeoffs":[["Migration guide",P+"about-claude/models/migration-guide"],["Models overview",P+"about-claude/models/overview"]],
 "Cost & Token Management":[["Pricing",P+"about-claude/pricing"],["Prompt caching",P+"build-with-claude/prompt-caching"],["Token counting",P+"build-with-claude/token-counting"]],
 "Context Engineering":[["Context engineering",E+"effective-context-engineering-for-ai-agents"],["Context windows",P+"build-with-claude/context-windows"]],
 "Prompt Engineering":[["Prompt engineering",P+"build-with-claude/prompt-engineering/overview"]],
 "Output Handling":[["Structured outputs",P+"build-with-claude/structured-outputs"]],
 "AI Application Security":[["Mitigate jailbreaks",P+"test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks"]],
 "Guardrails & Safe Deployment":[["Strengthen guardrails",P+"test-and-evaluate/strengthen-guardrails/reduce-hallucinations"]],
 "Claude Hooks":[["Hooks reference",CC+"hooks"]],
 "Identity, Secrets & Key Management":[["API keys & security",P+"api/overview"]],
 "Tool Implementation":[["Tool use",P+"agents-and-tools/tool-use"],["Writing tools for agents",E+"writing-tools-for-agents"]],
 "MCP Server Development":[["MCP spec",'https://modelcontextprotocol.io'],["MCP connector",P+"agents-and-tools/mcp-connector"]],
 "Agentic Customization":[["Agent Skills",P+"agents-and-tools/agent-skills/best-practices"],["Tool use",P+"agents-and-tools/tool-use"]]
}
;
