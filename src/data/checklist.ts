// Readiness checklist. Ids are stable: progress is stored by id, so items can be
// reordered or regrouped without scrambling saved state. Add new items with new ids.
export type CheckItem = { id: string; html: string };
export type CheckGroup = { title: string; items: CheckItem[] };

export const CHECKLIST: CheckGroup[] = [
  {
    "title": "Domain 2: 33.1% · the one that decides it",
    "items": [
      {
        "id": "ck-explain-why-system-is-not-a",
        "html": "Explain why <code>system</code> is not a message role"
      },
      {
        "id": "ck-name-the-five-stop-reason-values",
        "html": "Name the five <code>stop_reason</code> values and why none is an error"
      },
      {
        "id": "ck-describe-the-cache-prefix-order-and",
        "html": "Describe the cache prefix order and three things that invalidate it"
      },
      {
        "id": "ck-state-four-properties-of-the-batch",
        "html": "State four properties of the Batch API without hesitating"
      },
      {
        "id": "ck-explain-when-a-cloud-vendor-endpoint",
        "html": "Explain when a cloud vendor endpoint beats the first-party API"
      },
      {
        "id": "ck-place-an-instruction-correctly-system-claude",
        "html": "Place an instruction correctly: system, CLAUDE.md, settings.json, or hook"
      },
      {
        "id": "ck-explain-content-boundaries-and-why-user",
        "html": "Explain content boundaries and why user content never enters the system prompt"
      },
      {
        "id": "ck-define-session-hygiene-and-say-when",
        "html": "Define session hygiene and say when to start fresh"
      },
      {
        "id": "ck-describe-safe-large-scale-refactoring-with",
        "html": "Describe safe large-scale refactoring with Claude"
      }
    ]
  },
  {
    "title": "Domain 5: 16.8%",
    "items": [
      {
        "id": "ck-distinguish-context-window-from-max-output",
        "html": "Distinguish context window from max output tokens"
      },
      {
        "id": "ck-explain-what-effort-is-and-what",
        "html": "Explain what effort is and what it is not"
      },
      {
        "id": "ck-state-the-cost-optimization-order-in",
        "html": "State the cost optimization order in sequence"
      },
      {
        "id": "ck-explain-why-thinking-tokens-are-the",
        "html": "Explain why thinking tokens are the most-missed cost line"
      },
      {
        "id": "ck-name-what-an-sdk-adds-over",
        "html": "Name what an SDK adds over raw REST"
      },
      {
        "id": "ck-identify-claude-streaming-as-sse-not",
        "html": "Identify Claude streaming as SSE, not WebSocket"
      },
      {
        "id": "ck-name-three-breaking-changes-that-appear",
        "html": "Name three breaking changes that appear as 400s after migration"
      },
      {
        "id": "ck-distinguish-zero-single-and-multi-shot",
        "html": "Distinguish zero-, single-, and multi-shot prompting"
      }
    ]
  },
  {
    "title": "Domain 1: 14.7%",
    "items": [
      {
        "id": "ck-state-the-workflow-versus-agent-criterion",
        "html": "State the workflow-versus-agent criterion in one sentence"
      },
      {
        "id": "ck-name-the-five-workflow-patterns-and",
        "html": "Name the five workflow patterns and when each applies"
      },
      {
        "id": "ck-explain-the-primary-reason-subagents-exist",
        "html": "Explain the primary reason subagents exist"
      },
      {
        "id": "ck-explain-why-a-hook-beats-a",
        "html": "Explain why a hook beats a prompt instruction for a must-happen rule"
      },
      {
        "id": "ck-choose-self-hosted-vs-managed-from",
        "html": "Choose self-hosted vs managed from a named constraint"
      }
    ]
  },
  {
    "title": "Domain 6: 11.0%",
    "items": [
      {
        "id": "ck-distinguish-context-drift-from-context-bloat",
        "html": "Distinguish context drift from context bloat and fix each"
      },
      {
        "id": "ck-explain-why-an-eval-set-must",
        "html": "Explain why an eval set must precede prompt tuning"
      },
      {
        "id": "ck-describe-defensive-parsing-concretely",
        "html": "Describe defensive parsing concretely"
      },
      {
        "id": "ck-explain-why-truncated-output-must-not",
        "html": "Explain why truncated output must not be sent for repair"
      }
    ]
  },
  {
    "title": "Domain 8: 10.6%",
    "items": [
      {
        "id": "ck-explain-who-executes-a-tool",
        "html": "Explain who executes a tool"
      },
      {
        "id": "ck-explain-why-tool-descriptions-are-prompts",
        "html": "Explain why tool descriptions are prompts"
      },
      {
        "id": "ck-name-the-three-mcp-primitives-and",
        "html": "Name the three MCP primitives and who controls each"
      },
      {
        "id": "ck-name-the-current-mcp-transports-and",
        "html": "Name the current MCP transports and which is deprecated"
      },
      {
        "id": "ck-choose-among-built-in-tool-custom",
        "html": "Choose among built-in tool, custom tool, Skill, and MCP server"
      }
    ]
  },
  {
    "title": "Domain 7: 8.1%",
    "items": [
      {
        "id": "ck-name-the-structural-injection-mitigations-and",
        "html": "Name the structural injection mitigations and the four that don't work"
      },
      {
        "id": "ck-explain-why-a-tool-request-is",
        "html": "Explain why a tool request is not authorization"
      },
      {
        "id": "ck-explain-least-privilege-for-an-agent",
        "html": "Explain least privilege for an agent acting for a user"
      },
      {
        "id": "ck-name-the-blocking-hook-event-its",
        "html": "Name the blocking hook event, its exit code, and what exit 1 does"
      }
    ]
  },
  {
    "title": "Domains 3 & 4: 5.7%",
    "items": [
      {
        "id": "ck-name-claude-code-s-core-components",
        "html": "Name Claude Code's core components and the CLAUDE.md hierarchy"
      },
      {
        "id": "ck-explain-description-as-trigger-in-a",
        "html": "Explain description-as-trigger in a Skill"
      },
      {
        "id": "ck-isolate-a-failure-between-integration-layer",
        "html": "Isolate a failure between integration layer and model output"
      },
      {
        "id": "ck-explain-why-an-llm-judge-must",
        "html": "Explain why an LLM judge must be validated against human labels"
      }
    ]
  }
];
