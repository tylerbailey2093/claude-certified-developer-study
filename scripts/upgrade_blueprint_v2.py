"""One-shot: upgrade blueprint.json to schema v2.

Adds per objective: id, guide (verbatim Section 6 description from the
Exam Guide v1.0), and subskills derived from the guide's own enumerations.
Fixes two factual problems found against the guide:
  - few-shot: guide p7 lists "few-shot examples" under D6 Prompt Engineering
    AND zero/single/multi-shot under D5 LLM Fundamentals. The old trap said
    few-shot is scored only in D5.
  - Technical Fundamentals: the guide says "including", so its list is
    examples, not an exhaustive boundary.
Restores guide phrases the v1 scope dropped and records the published
sample options for the originality gate. Idempotent.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / "blueprint.json"

GUIDE = {
 "Agent Architecture": "Principles, patterns, and tradeoffs of agent and workflow architecture, including the decision criteria for using a workflow versus an agent, the structure of manager/supervisor hierarchies, and the role of subagents in improving task execution.",
 "Agent Construction with Claude": "Methods, tools, and platforms for constructing Claude agents, including the Claude Agent SDK, custom agent loops and harnesses, managed agent deployment models (self-hosted vs. Anthropic-hosted), and hooks for deterministic actions.",
 "Agent Patterns and Frameworks": "Common agent design patterns (tool-use loops, sub-agents, memory, context-window management) and agentic abstraction frameworks (e.g., Strands, LangGraph, PydanticAI) for building agents and workflows for multi-step tasks.",
 "Understanding Requirements": "Functional and infrastructure requirements based on business requirements and solution architecture.",
 "Systems Life Cycle": "Systems life cycle management concepts and frameworks used to develop, implement, operate, and maintain IT systems.",
 "Claude API Mechanics": "Claude API behavior and mechanics, including messages, tools, streaming, vision, thinking, caching, invoking Claude through third-party vendors, Messages API data access patterns, batch API use, and tradeoffs between realtime and batch API selection.",
 "Software Engineering Foundations": "Core software engineering principles and practices, including REST APIs, JSON, asynchronous programming, version control, SDLC integration, code review, and small- and large-scale refactoring.",
 "Claude Application Design": "Design considerations for building Claude applications, including how Claude interprets instructions across interfaces (Claude Code, Desktop, claude.ai, API, SDKs), content boundaries, schema design, session hygiene, and plugin management.",
 "Configuration Management": "Configuration management for Claude system components, including CLAUDE.md files, settings.json, model version pinning, prompt versioning, and plugin dependencies.",
 "Claude Code Operation": "Claude Code core components (Rules, Skills, Commands, Agents, Agent Memory), features (session management, built-in and custom slash commands, headless mode, streaming mode, auto-mode), the CLAUDE.md hierarchy, repository initialization, and settings.json configuration.",
 "Debugging and Error Handling": "Debugging and error handling techniques for Claude applications, including error type identification, recovery strategy selection, trace analysis to identify failure modes, and problem origin isolation between the integration layer and model output.",
 "LLM Fundamentals": "Basic understanding of LLMs (tokens, context windows, sampling, non-determinism, next-token generation), model options (fast mode, extended thinking, adaptive thinking, effort levels), and fundamental prompting techniques (zero-shot, single-shot, multi-shot).",
 "Technical Fundamentals": "Foundational technical concepts supporting AI application development, including basic engineering practices (integrating with SDKs that wrap REST APIs, websockets).",
 "Model Selection and Tradeoffs": "Claude model capabilities (Opus vs. Sonnet vs. Haiku use cases, adaptive thinking support), tradeoffs across quality/latency/cost parameters, and breaking behavior changes across model releases when selecting models for tasks.",
 "Cost and Token Management": "Token budgeting and cost management techniques for Claude applications, including token usage tracking, cost modeling, and caching techniques (prompt caching, cache check-pointing) for cost optimization.",
 "Context Engineering": "Context and memory management techniques for Claude applications, including context window management, prevention of context drift and bloat (tool output pruning, compaction), and context isolation through subagents or multi-step agentic workflows.",
 "Prompt Engineering": "Prompt engineering principles and methods (instruction clarity, few-shot examples, system versus user placement, output constraints, prompt and instruction placement across components, iterative refinement, prompt adjustment, input sanitization) when writing and iterating on prompts for Claude.",
 "Output Handling": "Established patterns and techniques for producing, validating, and consuming Claude output, including structured output patterns, response validation, defensive parsing, and skepticism toward confident output.",
 "AI Application Security": "Data privacy and security best practices, including prompt injection awareness and mitigation, jailbreak defense, untrusted input handling, data leakage prevention, PII handling, and ensuring authentication, authorization, confidentiality, privacy, and integrity.",
 "Guardrails and Safe Deployment": "Safe and responsible deployment practices (content policy, guardrail layering) and secure-by-design principles (privacy, identity and access management, least privilege).",
 "Claude Hooks": "Leveraging hooks for guardrails and safety controls to prevent destructive actions within Claude applications.",
 "Identity, Secrets, and Key Management": "Managing secrets, credentials, and API keys across Claude development and production environments, including identity validation and authentication, access approval and level verification, and authorized access monitoring.",
 "Tool Implementation": "Tool implementation practices for Claude applications, including tool use and function calling, configuration for external system interaction, tool description writing, error handling, tool usage patterns (agentic harness dispatch, client-side vs. server-side tools, approval patterns), and tool set construction best practices.",
 "MCP Server Development": "MCP server development practices, including server authoring, deployment, integration with Claude applications, MCP resources, tools, and prompts, and communication patterns (stdio, sockets, client vs. server).",
 "Agentic Customization": "Tradeoffs among built-in Tools, custom Tools, Skills, and MCPs for selecting and applying the appropriate approach for a given use case.",
}

S = lambda *pairs: [{"id": i, "label": l} for i, l in pairs]
SUBSKILLS = {
 "Agent Architecture": S(("aa.principles", "Architecture principles, patterns and tradeoffs"), ("aa.workflow-vs-agent", "Workflow versus agent decision criteria"), ("aa.hierarchies", "Manager/supervisor hierarchies"), ("aa.subagents", "Role of subagents in task execution")),
 "Agent Construction with Claude": S(("ac.agent-sdk", "Claude Agent SDK"), ("ac.custom-loops", "Custom agent loops and harnesses"), ("ac.deployment", "Managed deployment models: self-hosted vs Anthropic-hosted"), ("ac.hooks", "Hooks for deterministic actions")),
 "Agent Patterns and Frameworks": S(("ap.tool-loops", "Tool-use loops"), ("ap.sub-agents", "Sub-agents"), ("ap.memory", "Agent memory"), ("ap.context-window", "Context-window management in agents"), ("ap.frameworks", "Abstraction frameworks (Strands, LangGraph, PydanticAI)"), ("ap.multi-step", "Agents and workflows for multi-step tasks")),
 "Understanding Requirements": S(("ur.functional", "Functional requirements"), ("ur.infrastructure", "Infrastructure requirements"), ("ur.business", "Deriving requirements from business requirements"), ("ur.architecture", "Solution architecture")),
 "Systems Life Cycle": S(("slc.concepts", "Life cycle management concepts"), ("slc.frameworks", "Life cycle frameworks"), ("slc.develop-implement", "Developing and implementing systems"), ("slc.operate-maintain", "Operating and maintaining systems")),
 "Claude API Mechanics": S(("api.messages", "Messages and content blocks"), ("api.tools", "Tools on the API"), ("api.streaming", "Streaming"), ("api.vision", "Vision and document input"), ("api.thinking", "Thinking"), ("api.caching", "Prompt caching mechanics"), ("api.vendors", "Third-party vendors (Bedrock, Vertex AI, Foundry)"), ("api.data-access", "Messages API data access patterns"), ("api.batch", "Message Batches API"), ("api.realtime-vs-batch", "Realtime versus batch selection")),
 "Software Engineering Foundations": S(("swe.rest", "REST APIs"), ("swe.json", "JSON"), ("swe.async", "Asynchronous programming"), ("swe.vcs", "Version control"), ("swe.sdlc", "SDLC integration"), ("swe.code-review", "Code review"), ("swe.refactoring", "Small- and large-scale refactoring")),
 "Claude Application Design": S(("cad.interfaces", "Instruction interpretation across Claude Code, Desktop, claude.ai, API and SDKs"), ("cad.content-boundaries", "Content boundaries"), ("cad.schema", "Schema design"), ("cad.session-hygiene", "Session hygiene"), ("cad.plugins", "Plugin management")),
 "Configuration Management": S(("cfg.claude-md", "CLAUDE.md files"), ("cfg.settings-json", "settings.json"), ("cfg.model-pinning", "Model version pinning"), ("cfg.prompt-versioning", "Prompt versioning"), ("cfg.plugin-deps", "Plugin dependencies")),
 "Claude Code Operation": S(("cc.rules", "Rules"), ("cc.skills", "Skills"), ("cc.commands", "Commands"), ("cc.agents", "Agents (subagents)"), ("cc.memory", "Agent memory"), ("cc.sessions", "Session management"), ("cc.slash", "Built-in and custom slash commands"), ("cc.headless", "Headless mode"), ("cc.streaming", "Streaming mode"), ("cc.auto", "Auto mode"), ("cc.hierarchy", "CLAUDE.md hierarchy"), ("cc.init", "Repository initialization"), ("cc.settings", "settings.json configuration")),
 "Debugging and Error Handling": S(("dbg.error-types", "Error type identification"), ("dbg.recovery", "Recovery strategy selection"), ("dbg.traces", "Trace analysis to identify failure modes"), ("dbg.isolation", "Isolating integration-layer versus model-output problems")),
 "LLM Fundamentals": S(("llm.tokens", "Tokens"), ("llm.context-windows", "Context windows"), ("llm.sampling", "Sampling"), ("llm.nondeterminism", "Non-determinism"), ("llm.next-token", "Next-token generation"), ("llm.fast-mode", "Fast mode"), ("llm.extended-thinking", "Extended thinking"), ("llm.adaptive-thinking", "Adaptive thinking"), ("llm.effort", "Effort levels"), ("llm.shot", "Zero-, single- and multi-shot prompting")),
 "Technical Fundamentals": S(("tf.sdk-rest", "SDKs that wrap REST APIs"), ("tf.websockets", "Websockets and streaming transports"), ("tf.engineering", "Basic engineering practices for AI applications")),
 "Model Selection and Tradeoffs": S(("ms.tiers", "Opus vs Sonnet vs Haiku use cases"), ("ms.adaptive", "Adaptive thinking support"), ("ms.tradeoffs", "Quality, latency and cost tradeoffs"), ("ms.breaking", "Breaking behaviour changes across releases")),
 "Cost and Token Management": S(("cost.budgeting", "Token budgeting"), ("cost.tracking", "Token usage tracking"), ("cost.modeling", "Cost modeling"), ("cost.prompt-caching", "Prompt caching for cost"), ("cost.checkpointing", "Cache checkpointing")),
 "Context Engineering": S(("ctx.memory", "Memory management"), ("ctx.window", "Context window management"), ("ctx.drift-bloat", "Preventing context drift and bloat"), ("ctx.pruning", "Tool output pruning"), ("ctx.compaction", "Compaction"), ("ctx.isolation", "Isolation through subagents or multi-step workflows")),
 "Prompt Engineering": S(("pe.clarity", "Instruction clarity"), ("pe.few-shot", "Few-shot examples"), ("pe.system-user", "System versus user placement"), ("pe.output-constraints", "Output constraints"), ("pe.component-placement", "Placement across components"), ("pe.iterative", "Iterative refinement"), ("pe.adjustment", "Prompt adjustment"), ("pe.sanitization", "Input sanitization")),
 "Output Handling": S(("out.structured", "Structured output patterns"), ("out.validation", "Response validation"), ("out.defensive-parsing", "Defensive parsing"), ("out.skepticism", "Skepticism toward confident output")),
 "AI Application Security": S(("sec.injection", "Prompt injection awareness and mitigation"), ("sec.jailbreak", "Jailbreak defense"), ("sec.untrusted", "Untrusted input handling"), ("sec.leakage", "Data leakage prevention"), ("sec.pii", "PII handling"), ("sec.authn-authz", "Authentication and authorization"), ("sec.cia", "Confidentiality, privacy and integrity")),
 "Guardrails and Safe Deployment": S(("gr.content-policy", "Content policy"), ("gr.layering", "Guardrail layering"), ("gr.secure-by-design", "Secure-by-design principles"), ("gr.privacy", "Privacy by design"), ("gr.iam", "Identity and access management"), ("gr.least-privilege", "Least privilege")),
 "Claude Hooks": S(("hk.guardrails", "Hooks as guardrails and safety controls"), ("hk.destructive", "Preventing destructive actions")),
 "Identity, Secrets, and Key Management": S(("id.secrets", "Secrets and API keys across dev and prod"), ("id.validation", "Identity validation and authentication"), ("id.approval", "Access approval and level verification"), ("id.monitoring", "Authorized access monitoring")),
 "Tool Implementation": S(("tool.function-calling", "Tool use and function calling"), ("tool.external-config", "Configuration for external system interaction"), ("tool.descriptions", "Tool description writing"), ("tool.errors", "Tool error handling"), ("tool.dispatch", "Agentic harness dispatch"), ("tool.client-server", "Client-side versus server-side tools"), ("tool.approval", "Approval patterns"), ("tool.toolset", "Tool set construction")),
 "MCP Server Development": S(("mcp.authoring", "Server authoring"), ("mcp.deployment", "Deployment"), ("mcp.integration", "Integration with Claude applications"), ("mcp.primitives", "Resources, tools and prompts"), ("mcp.transports", "Communication: stdio, sockets and HTTP"), ("mcp.client-server", "Client versus server roles")),
 "Agentic Customization": S(("cust.built-in", "Built-in tools"), ("cust.custom-tools", "Custom tools"), ("cust.skills", "Skills"), ("cust.mcp", "MCP servers"), ("cust.selection", "Choosing the right extension for a use case")),
}

SCOPE_ADD = {
 "Cost and Token Management": ["token budgeting"],
 "Context Engineering": ["memory management"],
 "Understanding Requirements": ["derived from business requirements"],
 "Agent Construction with Claude": ["managed agent deployment models (self-hosted vs Anthropic-hosted)"],
 "Debugging and Error Handling": ["trace analysis to identify failure modes"],
}

TRAP_FIX = {
 "few-shot prompting is scored HERE, not in Domain 6":
   "the shot taxonomy (zero/single/multi-shot) is scored here; building and placing few-shot examples is ALSO scored in D6 Prompt Engineering (guide p7)",
 "NARROW objective - not context theory, not rate limits":
   "the guide's list is examples ('including'), not a boundary: SDKs over REST and websockets are named, but basic engineering practice around them is fair game",
}

SAMPLE_OPTIONS = [
 ["Send every request synchronously through the Messages API in parallel to finish as quickly as possible.",
  "Use the Message Batches API, which processes large asynchronous workloads within a 24-hour window at reduced cost.",
  "Lower max_tokens on synchronous calls to minimize cost.",
  "Switch to the smallest available model regardless of output quality."],
 ["Raise the model's temperature so its behavior is harder to predict.",
  "Treat retrieved page content as untrusted input, keep it separate from trusted instructions, and use guardrails or hooks so injected instructions cannot trigger sensitive actions.",
  "Add a line to the system prompt asking users not to include malicious instructions.",
  "Switch to a larger model that follows instructions more reliably."],
 ["Hard-code the inventory logic into each application's system prompt.",
  "Build an MCP server that exposes the inventory operations as tools so multiple Claude applications can connect to it.",
  "Paste the current inventory data into the context window on every request.",
  "Rely on a built-in tool, since built-in tools can reach any internal REST API."],
]

def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("&", "and")).strip("-")

b = json.loads(BP.read_text())
b["schema_version"] = 2
for d in b["domains"]:
    for o in d["objectives"]:
        n = o["name"]
        o["id"] = slug(n)
        o["guide"] = GUIDE[n]
        o["subskills"] = SUBSKILLS[n]
        for s in SCOPE_ADD.get(n, []):
            if s not in o["scope"]:
                o["scope"].insert(0, s)
        o["traps"] = [TRAP_FIX.get(t, t) for t in o["traps"]]
        # key order: id, name, weight, guide, subskills, scope, traps
        keys = ["id", "name", "weight", "guide", "subskills", "scope", "traps"]
        ordered = {k: o[k] for k in keys if k in o}
        ordered.update({k: v for k, v in o.items() if k not in ordered})
        o.clear(); o.update(ordered)
b["item_style"]["correct"] = {"single": 1, "multi": "exactly the number stated in the stem (Select two / Select three)"}
b["item_style"]["types"] = ["multiple-choice (one answer)", "multiple-response (stem states how many)"]
b["official_samples_for_originality_check_only"]["options"] = SAMPLE_OPTIONS
b["official_samples_for_originality_check_only"]["forbidden_scenarios"] = [
 "overnight / non-urgent bulk document job choosing batch vs realtime",
 "summarizer of user-submitted web pages hit by hidden-text prompt injection",
 "internal REST inventory service exposed to several apps via a shared MCP server",
]
BP.write_text(json.dumps(b, indent=2, ensure_ascii=False) + "\n")
total = sum(len(o["subskills"]) for d in b["domains"] for o in d["objectives"])
print(f"blueprint v2 written: {total} subskills")
