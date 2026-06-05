---
description: Phase 2. Decompose into atomic, verifiable tasks grouped into waves. Delegates to the planner subagent. Writes PLAN.md. Runnable standalone.
allowed-tools: read, grep, glob, task, write
model: high
argument-hint: "[<phase/milestone>]"
---

# /flow-plan — atomic, verifiable plan

Read context:
@.flow/STATE.md
@.flow/CONTEXT.md

If a codebase map exists (brownfield), include it: @.flow/codebase-map.md

## Run
Spawn the **planner** subagent in a fresh context. Give it: the `DECISIONS.md` for
this phase, `CONTEXT.md`, the codebase map (if any), and any researcher findings.
Ask it to produce `plans/<phase>/PLAN.md` with:
- Goal and chosen approach (+ rejected alternatives, one line each).
- **Atomic tasks**, each sized to one fresh context window, each with explicit
  success criteria, files touched, dependencies, and an assigned **wave**.
- Risks/unknowns and the **verification hooks** the verifier will run.

The planner reads everything but **writes only the PLAN** — no source, no commits.

## After
- Summarize the plan: task count, waves, top risks, estimated tokens vs. the `plan`
  cap (`npm run budget -- check plan`).
- Update `.flow/STATE.md` (phase status, next action).
- On `full`, the next phase is **review**; on `standard`, proceed toward execute.
