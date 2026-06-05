---
description: Generate .flow/codebase-map.md for a brownfield project before the first plan. Delegates exploration to the researcher subagent.
allowed-tools: read, grep, glob, bash, task, write
model: mid
argument-hint: "[<area to focus>]"
---

# /flow-map-codebase — orient before planning brownfield work

Focus (optional): **$ARGUMENTS**

Read what we already know:
@.flow/CONTEXT.md

## Run
Spawn the **researcher** subagent (read-only) to survey the repository and produce a
durable map. It should capture, compactly:
- **Top-level layout** — directories and their purpose.
- **Entry points & key modules** — where execution starts, the load-bearing files.
- **Patterns & conventions** observed in code (so plans match them).
- **Build/test/run commands** — how to exercise the project.
- **Hotspots & gotchas** — areas that are risky, coupled, or surprising.
- **External services / config** the code depends on.

Prefer `path:line` citations over large pastes; this is a map, not a copy.

## Write
`.flow/codebase-map.md` (committed — shared state). Note the date and that it should
be refreshed if the structure drifts. Update `.flow/STATE.md` next action to point
at `/flow-plan`.
