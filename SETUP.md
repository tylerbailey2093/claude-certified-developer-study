# Moving this into Claude Code

## 1. Create the repo

```bash
mkdir ccdv-f-prep && cd ccdv-f-prep
git init
```

## 2. Drop this bundle in

Copy the contents of `ccdv-f-handoff/` into the repo root so you get:

```
CLAUDE.md                  project memory - Claude Code reads this automatically
blueprint.json             machine-readable blueprint, all 25 objectives
KICKOFF.md                 the first message to paste
SETUP.md                   this file
guide/                     the two study guides
labs/                      11 notebooks + README
scripts/                   originality gate + link checker
```

```bash
git add -A && git commit -m "Import CCDV-F study system"
```

## 3. Verify the tooling works before you start

```bash
python3 scripts/check_originality.py guide/ccdv-f-glass.html
```
Expect: `checked 64 items ... PASS`. If it fails, stop and fix that first.

```bash
python3 scripts/verify_links.py guide/ccdv-f-glass.html
```
Needs egress. On a restricted network everything reports connection errors,
which is a network result and not a link result.

## 4. Start Claude Code and paste KICKOFF.md

```bash
claude
```

Paste the contents of `KICKOFF.md` as your first message. It points at
`CLAUDE.md` and `blueprint.json` and lays out four phases.

## 5. Optional but recommended: a blocking hook

Lab 09 teaches this and it applies here. Before letting Claude Code work
unattended, add `.claude/settings.json` with a `PreToolUse` guard so a bad
command cannot delete your work. Remember exit 2 blocks and **exit 1 fails
open** - a crashing guard protects nothing.

## What to expect from each phase

**Phase 1 is the point of this handoff.** The guide and labs were built without
network access, so nothing was executed against the live API and most doc links
were constructed from documented URL structure rather than fetched. Claude Code
can run all of it. Expect real findings.

**Phase 2** grows the bank from 64 to 150. The originality gate is not optional
- one earlier item scored 0.86 against a published sample before that gate
existed.

**Phase 3** is the real upgrade. Running locally rather than as a chat artifact,
the guide can use localStorage, so progress, miss tracking, spaced repetition,
and a timed 53-item mock all become possible.

**Phase 4** is maintainability. Do it last, or skip it if you sit the exam first.
