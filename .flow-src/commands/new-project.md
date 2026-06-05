---
description: Initialize FLOW state for a new project — seed .flow/ STATE/CONTEXT/BUDGET from templates and capture the runtime/proxy assumption.
allowed-tools: read, write, bash
model: low
argument-hint: "<project name> [greenfield|brownfield]"
---

# /flow-new-project — bootstrap FLOW state

Arguments: **$ARGUMENTS**

Parse them as `<project name> [greenfield|brownfield]`: the first token is the
project name, an optional second token is the mode (default `greenfield`). If no name
is given, infer one from the workspace folder and state your inference.

## Do
1. Create `.flow/` (and `.flow/metrics/`) if missing.
2. Seed the three state files from the canonical templates, filling in the project
   name and mode:
   - `.flow/STATE.md`  ← template STATE
   - `.flow/CONTEXT.md` ← template CONTEXT
   - `.flow/BUDGET.md`  ← template BUDGET
   Do **not** overwrite files that already exist; report which were skipped.
3. In `.flow/CONTEXT.md`, confirm the **runtime/proxy assumption** block is present
   (Claude Code → LiteLLM → Bedrock; native workflows out of scope) and fill in the
   architecture / stack / conventions sections with what is known.
4. If brownfield, recommend running `/flow-map-codebase` before the first plan.

## After
- Print the seeded paths and the single **next action** written to STATE.md.
- Remind the user that runtime layouts are generated with `npm run gen` (and that
  generated files under `.claude/` and `.github/` must never be hand-edited).
