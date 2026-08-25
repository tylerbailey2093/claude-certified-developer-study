export const SNIPPETS = {
msg: {py:`import anthropic
client = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY

msg = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="You are a concise assistant.",   # top-level, NOT a message role
    messages=[{"role": "user", "content": "Hello, Claude"}],
)

# content is a LIST OF BLOCKS. Never index [0] blindly.
for block in msg.content:
    if block.type == "text":
        print(block.text)

print(msg.stop_reason)   # end_turn | max_tokens | tool_use | stop_sequence | refusal
print(msg.usage.input_tokens, msg.usage.output_tokens)`,
ts:`import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

const msg = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: 'You are a concise assistant.',   // top-level, NOT a message role
  messages: [{ role: 'user', content: 'Hello, Claude' }],
});

// content is a LIST OF BLOCKS. Never index [0] blindly.
for (const block of msg.content) {
  if (block.type === 'text') console.log(block.text);
}

console.log(msg.stop_reason);
console.log(msg.usage.input_tokens, msg.usage.output_tokens);`},
stream: {py:`with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Explain quantum tunneling."}],
) as stream:
    for event in stream:
        if event.type == "content_block_delta" and event.delta.type == "text_delta":
            print(event.delta.text, end="", flush=True)
        elif event.type == "message_delta":
            # final stop_reason and cumulative usage arrive HERE
            print("stop:", event.delta.stop_reason)
    final = stream.get_final_message()`,
ts:`const stream = await client.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Explain quantum tunneling.' }],
});

try {
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }
} catch (err) {
  // an error event can arrive AFTER the 200. Decide what to do
  // with the partial output the user has already seen.
  console.error('mid-stream failure', err);
}
const finalMessage = await stream.finalMessage();`},
tools: {py:`tools = [{
    "name": "get_weather",
    "description": "Get current weather for a location. Use when the user asks "
                   "about conditions, temperature, or forecast. Do NOT use for "
                   "historical climate data.",
    "input_schema": {
        "type": "object",
        "properties": {"location": {"type": "string",
                                    "description": "City name, e.g. 'Denver, CO'"}},
        "required": ["location"],
    },
}]

messages = [{"role": "user", "content": "Weather in Paris?"}]
resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                              tools=tools, messages=messages)

while resp.stop_reason == "tool_use":
    messages.append({"role": "assistant", "content": resp.content})
    results = []
    for block in resp.content:
        if block.type == "tool_use":
            try:
                out = run_tool(block.name, block.input)      # YOUR code runs it
                results.append({"type": "tool_result",
                                "tool_use_id": block.id, "content": out})
            except Exception as e:
                # give the model something actionable, do not throw
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": str(e), "is_error": True})
    messages.append({"role": "user", "content": results})
    resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=1024,
                                  tools=tools, messages=messages)`,
ts:`const tools = [{
  name: 'get_weather',
  description: 'Get current weather for a location. Use when the user asks about '
             + 'conditions or forecast. Do NOT use for historical climate data.',
  input_schema: {
    type: 'object',
    properties: { location: { type: 'string', description: "City, e.g. 'Denver, CO'" } },
    required: ['location'],
  },
}];

let messages = [{ role: 'user', content: 'Weather in Paris?' }];
let resp = await client.messages.create({ model: 'claude-sonnet-4-6',
  max_tokens: 1024, tools, messages });

while (resp.stop_reason === 'tool_use') {
  messages.push({ role: 'assistant', content: resp.content });
  const results = [];
  for (const block of resp.content) {
    if (block.type === 'tool_use') {
      try {
        const out = await runTool(block.name, block.input);   // YOUR code runs it
        results.push({ type: 'tool_result', tool_use_id: block.id, content: out });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: block.id,
                       content: String(e), is_error: true });
      }
    }
  }
  messages.push({ role: 'user', content: results });
  resp = await client.messages.create({ model: 'claude-sonnet-4-6',
    max_tokens: 1024, tools, messages });
}`},
cache: {py:`resp = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    # PREFIX ORDER IS FIXED: tools, then system, then messages.
    system=[
        {"type": "text", "text": "You are a support assistant."},
        {"type": "text",
         "text": PRODUCT_DOCS,                        # large + stable
         "cache_control": {"type": "ephemeral"}},     # 5-minute rolling TTL
        # {"cache_control": {"type": "ephemeral", "ttl": "1h"}}  # 1-hour option
    ],
    messages=[{"role": "user", "content": question}],
)

# Watch these two. A drop to zero means your prefix changed.
print("write:", resp.usage.cache_creation_input_tokens)
print("read: ", resp.usage.cache_read_input_tokens)

# ANTI-PATTERN — this kills every cache hit forever:
#   {"type": "text", "text": f"Current time: {datetime.now()}"}   <-- never
# Anything interpolated inside the cached prefix makes each request unique.`,
ts:`const resp = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  // PREFIX ORDER IS FIXED: tools, then system, then messages.
  system: [
    { type: 'text', text: 'You are a support assistant.' },
    { type: 'text',
      text: PRODUCT_DOCS,                          // large + stable
      cache_control: { type: 'ephemeral' } },      // 5-minute rolling TTL
  ],
  messages: [{ role: 'user', content: question }],
});

console.log('write:', resp.usage.cache_creation_input_tokens);
console.log('read: ', resp.usage.cache_read_input_tokens);

// ANTI-PATTERN: any interpolated value inside the cached prefix
// (timestamp, session id, user name) makes every request unique.`},
batch: {py:`# 50% off. No streaming. Results come back OUT OF ORDER.
batch = client.messages.batches.create(requests=[
    {"custom_id": f"doc-{i}",                    # 1-64 chars, your ONLY join key
     "params": {"model": "claude-sonnet-4-6", "max_tokens": 1024,
                "messages": [{"role": "user", "content": doc}]}}
    for i, doc in enumerate(documents)
])

import time
while True:
    b = client.messages.batches.retrieve(batch.id)
    if b.processing_status == "ended":
        break
    time.sleep(30)

# JOIN ON custom_id. Never zip positionally against your input list.
results = {}
for r in client.messages.batches.results(batch.id):
    if r.result.type == "succeeded":
        results[r.custom_id] = r.result.message
    elif r.result.type == "errored":
        retry_later.append(r.custom_id)   # individual failures inside a good batch`,
ts:`const batch = await client.messages.batches.create({
  requests: documents.map((doc, i) => ({
    custom_id: 'doc-' + i,               // 1-64 chars, your ONLY join key
    params: { model: 'claude-sonnet-4-6', max_tokens: 1024,
              messages: [{ role: 'user', content: doc }] },
  })),
});

let b;
do {
  await new Promise(r => setTimeout(r, 30000));
  b = await client.messages.batches.retrieve(batch.id);
} while (b.processing_status !== 'ended');

// JOIN ON custom_id. Never zip positionally against your input list.
const results = {};
for await (const r of client.messages.batches.results(batch.id)) {
  if (r.result.type === 'succeeded') results[r.custom_id] = r.result.message;
}`},
pdf: {py:`import base64, pathlib

pdf_b64 = base64.standard_b64encode(pathlib.Path("contract.pdf").read_bytes()).decode()

resp = client.messages.create(
    model="claude-sonnet-4-6", max_tokens=2048,
    messages=[{"role": "user", "content": [
        {"type": "document",
         "source": {"type": "base64", "media_type": "application/pdf",
                    "data": pdf_b64},
         "title": "contract.pdf",
         "citations": {"enabled": True}},        # grounds answers in real passages
        {"type": "text", "text": "List every payment milestone."},
    ]}],
)

# Three ingestion methods: url, base64, or Files API file_id.
# For anything reused, upload once and reference by file_id:
#   {"type": "document", "source": {"type": "file", "file_id": "file_abc123"}}
#
# Budget ~1500-3000 tokens per page. PDF support runs through VISION,
# so charts, tables and layout survive. .docx/.xlsx must be converted first.`,
ts:`import fs from 'node:fs';

const pdfB64 = fs.readFileSync('contract.pdf').toString('base64');

const resp = await client.messages.create({
  model: 'claude-sonnet-4-6', max_tokens: 2048,
  messages: [{ role: 'user', content: [
    { type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 },
      title: 'contract.pdf',
      citations: { enabled: true } },
    { type: 'text', text: 'List every payment milestone.' },
  ]}],
});

// For reused documents, upload once via the Files API and reference by file_id.
// Budget ~1500-3000 tokens per page; PDF support runs through vision.`},
errors: {py:`import anthropic, httpx

# SDKs ALREADY retry twice with exponential backoff, honouring retry-after.
# Do not wrap this in your own retry loop.
client = anthropic.Anthropic(
    max_retries=5,                                   # default 2, 0 disables
    timeout=httpx.Timeout(600.0, connect=30.0),      # default 10 minutes
)

try:
    msg = client.messages.create(model="claude-opus-5", max_tokens=1024,
                                 messages=[{"role": "user", "content": "Hi"}])
except anthropic.RateLimitError:
    pass          # 429 - RPM, input TPM, or output TPM. Shape concurrency.
except anthropic.APIStatusError as e:
    if e.status_code == 529:
        pass      # overloaded, transient, back off
    elif e.status_code == 400:
        raise     # malformed or unsupported param. Retrying is pointless.
except anthropic.APIConnectionError as e:
    print("unreachable", e.__cause__)

# Per-request override:
# client.with_options(max_retries=0).messages.create(...)`,
ts:`import Anthropic from '@anthropic-ai/sdk';

// SDKs ALREADY retry twice with exponential backoff, honouring retry-after.
const client = new Anthropic({
  maxRetries: 5,        // default 2, 0 disables
  timeout: 600 * 1000,  // default 10 minutes
});

try {
  await client.messages.create({ model: 'claude-opus-5', max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hi' }] });
} catch (err) {
  if (err instanceof Anthropic.RateLimitError) {
    // 429 - RPM, input TPM, or output TPM
  } else if (err instanceof Anthropic.APIStatusError && err.status === 529) {
    // overloaded, transient
  } else if (err instanceof Anthropic.APIStatusError && err.status === 400) {
    throw err;   // malformed or unsupported param. Retrying is pointless.
  }
}`},
effort: {py:`# CURRENT models: effort is the dial. Adaptive thinking is on by default.
resp = client.messages.create(
    model="claude-opus-5",
    max_tokens=8192,          # thinking eats this FIRST. Budget generously.
    effort="medium",          # low | medium | high (default) | xhigh | max
    messages=[{"role": "user", "content": prompt}],
)

# 400 ON OPUS 5 / SONNET 5 -- all four of these:
#   temperature=0.7
#   top_p=0.9
#   thinking={"type": "enabled", "budget_tokens": 4000}
#   messages=[..., {"role": "assistant", "content": "{"}]   # prefill

# OLDER models (Sonnet 4.5 and earlier) still need the manual form:
# thinking={"type": "enabled", "budget_tokens": 4000}

# Thinking tokens bill at OUTPUT rates. Log them separately or your
# cost model will be quietly wrong.`,
ts:`const resp = await client.messages.create({
  model: 'claude-opus-5',
  max_tokens: 8192,      // thinking eats this FIRST
  effort: 'medium',      // low | medium | high (default) | xhigh | max
  messages: [{ role: 'user', content: prompt }],
});

// 400 on Opus 5 / Sonnet 5:
//   temperature, top_p, top_k (non-default)
//   thinking: { type: 'enabled', budget_tokens: N }
//   assistant prefill
//
// Effort tuning is usually a better lever than swapping models:
// it preserves the behaviour you already evaluated.`},
agentsdk: {py:`# pip install claude-agent-sdk
import anyio
from claude_agent_sdk import (query, ClaudeAgentOptions, ClaudeSDKClient,
                              tool, create_sdk_mcp_server, HookMatcher)

# --- one-shot ---
async def simple():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Edit", "Bash"],    # LEAST PRIVILEGE
        system_prompt="You are a careful refactoring assistant.",
        setting_sources=["project"],   # v0.1.0+ no longer loads these by default
    )
    async for message in query(prompt="Fix the bug in auth.py", options=options):
        print(message)

# --- in-process tool + a hook that actually blocks ---
@tool("lookup_order", "Look up an order by ID", {"order_id": str})
async def lookup_order(args):
    return {"content": [{"type": "text", "text": fetch(args["order_id"])}]}

async def block_destructive(input_data, tool_use_id, context):
    cmd = input_data["tool_input"].get("command", "")
    if input_data["tool_name"] == "Bash" and "rm -rf" in cmd:
        return {"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "Recursive delete blocked by policy"}}
    return {}

server = create_sdk_mcp_server(name="ops", version="1.0.0", tools=[lookup_order])
options = ClaudeAgentOptions(
    allowed_tools=["Bash"],
    mcp_servers={"ops": server},
    hooks={"PreToolUse": [HookMatcher(matcher="Bash", hooks=[block_destructive])]},
)

anyio.run(simple)`,
ts:`// npm i @anthropic-ai/claude-agent-sdk
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({
  prompt: 'What files are in this directory?',
  options: {
    allowedTools: ['Bash', 'Glob'],     // LEAST PRIVILEGE
    settingSources: ['project'],
  },
})) {
  console.log(message);
}

// Package was renamed: claude-code-sdk -> claude-agent-sdk,
// ClaudeCodeOptions -> ClaudeAgentOptions.
// A PreToolUse deny holds even under bypassPermissions.`},
mcp: {py:`# pip install mcp
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("inventory-server")

@mcp.tool()                              # MODEL-controlled: an action
def check_stock(sku: str) -> int:
    """Return current stock level for a SKU."""
    return db.stock(sku)

@mcp.resource("catalog://{category}")    # APP-controlled: read-only data
def catalog(category: str) -> str:
    return db.catalog(category)

@mcp.prompt()                            # USER-controlled: a template
def restock_review(sku: str) -> str:
    return f"Review restocking needs for {sku}"

if __name__ == "__main__":
    mcp.run()                            # stdio by default (local, no network)
    # mcp.run(transport="streamable-http", host="0.0.0.0", port=8000)`,
ts:`// npm i @modelcontextprotocol/sdk zod
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'inventory-server', version: '1.0.0' });

server.registerTool('check_stock',
  { inputSchema: { sku: z.string() } },
  async ({ sku }) => ({ content: [{ type: 'text', text: String(db.stock(sku)) }] }));

const transport = new StdioServerTransport();
await server.connect(transport);

// Transport heuristic: docs give you a COMMAND -> stdio.
//                      docs give you a URL     -> streamable HTTP.
// HTTP+SSE is deprecated. Streamable HTTP needs OAuth 2.1.`},
hook: {json:`{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/guard.sh"
          }
        ]
      }
    ]
  }
}`,
sh:`#!/usr/bin/env bash
# .claude/hooks/guard.sh
input=$(cat)                       # hook payload arrives on stdin as JSON
command=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

if printf '%s' "$command" | grep -qiE '(^|[[:space:]])rm[[:space:]]+(-[a-z]*r|--recursive)'; then
  echo "Recursive rm is blocked by project policy." >&2
  exit 2      # EXIT 2 BLOCKS. stderr goes back to Claude as the reason.
fi

exit 0        # exit 0 proceeds. exit 1 is a NON-BLOCKING error - the footgun.`},
skill: {yaml:`---
name: brand-voice-check
description: Checks markdown files in drafts/ for forbidden brand phrases and
  passive voice before publication. Use when reviewing or editing any draft
  article, blog post, or marketing page.
---

# Brand Voice Check

## When to run
Any time a file under drafts/ is edited or the user asks for a voice review.

## Procedure
1. Read the file.
2. Flag every phrase in references/forbidden.md.
3. Flag passive constructions.
4. Report as a table: line number, issue, suggested rewrite.

## Notes
Never rewrite silently. Always show the user what changed and why.`},
structured: {py:`# Structured outputs replace the deprecated assistant-prefill trick.
resp = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": f"Extract fields from: {text}"}],
    extra_headers={"anthropic-beta": "structured-outputs-2025-11-13"},
    extra_body={"output_format": {"type": "json_schema", "schema": {
        "type": "object",
        "properties": {
            "vendor": {"type": "string"},
            # nullable so the model can DECLINE instead of fabricating
            "contract_end_date": {"type": ["string", "null"]},
            "status": {"type": "string", "enum": ["active", "expired", "pending"]},
        },
        "required": ["vendor", "contract_end_date", "status"],
    }}},
)

import json
# still check stop_reason before parsing - max_tokens truncation
# produces invalid JSON that no repair loop can fix
if resp.stop_reason == "max_tokens":
    raise ValueError("truncated: raise budget or decompose the task")
data = json.loads(resp.content[0].text)`,
ts:`const resp = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Extract fields from: ' + text }],
  betas: ['structured-outputs-2025-11-13'],
  output_format: { type: 'json_schema', schema: {
    type: 'object',
    properties: {
      vendor: { type: 'string' },
      contract_end_date: { type: ['string', 'null'] },  // nullable = can decline
      status: { type: 'string', enum: ['active', 'expired', 'pending'] },
    },
    required: ['vendor', 'contract_end_date', 'status'],
  }},
});

if (resp.stop_reason === 'max_tokens')
  throw new Error('truncated: raise budget or decompose');`},
count: {py:`# Ask before you send.
count = client.messages.count_tokens(
    model="claude-sonnet-4-6",
    system=SYSTEM,
    tools=TOOLS,
    messages=messages,
)
print(count.input_tokens)

# Query limits instead of hardcoding them.
for m in client.models.list():
    print(m.id, m.max_input_tokens, m.max_tokens)

# Token counts are MODEL-SPECIFIC. Re-measure after any migration -
# 4.7+ use a newer tokenizer producing ~30% more tokens for the same text.`,
ts:`const count = await client.messages.countTokens({
  model: 'claude-sonnet-4-6',
  system: SYSTEM,
  tools: TOOLS,
  messages,
});
console.log(count.input_tokens);

for await (const m of client.models.list()) {
  console.log(m.id, m.max_input_tokens, m.max_tokens);
}`}
};
