---
description: Phase 2.5. Adversarial, proportional critique of the PLAN before execution. Delegates to the reviewer subagent. Writes REVIEWS.md. Runnable standalone.
allowed-tools: read, grep, glob, bash, task, write
model: high
argument-hint: "[<phase>]"
---

# /flow-review — refute the plan before building

Read context:
@.flow/STATE.md
@.flow/CONTEXT.md

## Run
Spawn the **reviewer** subagent against `plans/<phase>/PLAN.md`. Depth is
**proportional to path**:
- `full` → independent **multi-model** critique using whatever model CLIs are present.
- `standard` → a **single self-critique** pass.
- If only one model exists anywhere, fall back to a structured self-critique and say so.

The reviewer applies the **adversarial pattern**: one critique tries to refute
another's findings; only surviving points are kept. It writes
`reviews/<phase>/REVIEWS.md` and changes nothing else.

## After
- Summarize blockers/majors/minors and the overall verdict
  (proceed / revise-then-proceed / replan).
- If blockers exist, loop back to `/flow-plan` to revise before executing.
- Show spend vs. the `review` cap; update `.flow/STATE.md`.
