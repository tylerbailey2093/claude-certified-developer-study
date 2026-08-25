# CCDV-F hands-on labs

Eleven notebooks. Each stands alone and fits in one sitting. Together they satisfy
Section 7 of the exam guide, which puts *"build and operate at least one Claude
application"* in its own bullet — not read about, not watch.

```
pip install anthropic jupyter
export ANTHROPIC_API_KEY=sk-ant-...
jupyter notebook
```

**Total cost across all eleven: under $0.20.** Most use Haiku with small payloads.
Lab 02 is the priciest at roughly $0.05 because caching needs a prefix over ~1,024
tokens to engage at all.

---

## Order, and what each one buys you

| # | Lab | Time | Domain | The thing you can't learn by reading |
|---|-----|------|--------|--------------------------------------|
| 00 | Setup | 5m | — | Real model IDs, so the rest use live strings |
| 01 | Response anatomy | 20m | D2, D6 | `stop_reason` on a 200; blocks are a list; the `system`-as-role 400 |
| 02 | **Caching** | 25m | D2, D5 | Your own hit rate collapsing from one timestamp |
| 03 | Tool loop | 30m | D8, D1 | The model self-correcting from `is_error`; selection degrading as tools multiply |
| 04 | Batch | 15m + wait | D2 | Positional join silently mislabelling rows |
| 05 | Streaming | 20m | D2, D5 | Final `usage` in `message_delta`; an error after the 200 |
| 06 | Structured output | 25m | **D2 (8.6%)**, D6 | Fabrication vs `null`, from one schema change |
| 07 | Tokens & migration | 20m | D5 (16.8%) | Counts differing per model; which params now 400 |
| 08 | MCP server | 30m | D8 | Three primitives, stdio transport, zero API cost |
| 09 | **Hooks** | 20m | D7, D3 | Exit 2 blocks, exit 1 **fails open** |
| 10 | Eval harness | 30m | D4, gates D5/D6 | A prompt fix repairing one case and breaking two |

**If you only do three:** 02, 06, 09. Caching is the root of most cost questions,
06 exercises the heaviest objective on the exam, and 09 teaches the request-versus-
control distinction that decides questions in three separate domains.

**Cheapest possible session:** 08 and 09 cost nothing at all and need no API key.

---

## What these deliberately do not cover

Fifteen of the 25 objectives cannot be learned by running code, and a notebook for
them would be busywork that *feels* like preparation:

- Agent Architecture — a taxonomy and a decision criterion, not an observable behaviour
- Understanding Requirements, Systems Life Cycle — analysis and process
- Model Selection tradeoffs — judgement, though lab 07 makes the parameters concrete
- Application Design's cross-interface half — go click around Claude Desktop and
  claude.ai Projects instead. That is the real exercise, and it is the 8.6% objective
  the prep course never teaches directly.

Read those. Run these.

---

## Caveats, stated plainly

- **Written against verified documentation, not executed against the live API.**
  I had no network egress when building them. The Python is syntax-checked and the
  two offline labs (08, 09) were run end to end, but if a response field has been
  renamed since, a cell may need a small fix. That is normal for API notebooks.
- **Your corporate network may block this.** If you hit `APIConnectionError` rather
  than `AuthenticationError`, it is egress, not your key. Run from a personal machine.
- **Model IDs drift.** Lab 00 prints the live list. Set `MODEL` from that output
  rather than trusting the defaults I hardcoded.
- **Lab 04 costs wall-clock time, not attention.** Submit the batch, go read a
  domain, come back. That is the point of batch.
- **Lab 07's last cell deliberately triggers errors.** A 400 there is the lesson,
  not a bug.

---

## Checkpoint discipline

Every notebook ends with three questions. Answer them **out loud, without scrolling
back**. If you can run the cells but not answer the questions, you watched a demo
rather than learned a mechanism — and the exam tests the mechanism.
