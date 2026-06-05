---
description: Phase 3. Run plan tasks in parallel waves via fresh-context executor subagents — one atomic commit per task. FLOW's own orchestration. Runnable standalone.
allowed-tools: read, grep, glob, bash, task, todo, write
model: mid
argument-hint: "[<phase>] [--wave N]"
---

# /flow-execute — build it, one atomic commit per task

Read context and plan:
@.flow/STATE.md
@.flow/CONTEXT.md
@plans/<phase>/PLAN.md

## Orchestrate (FLOW's own engine — not native workflows)
You are the orchestrator. Walk the plan **wave by wave**:
1. Select the next wave: tasks whose dependencies are all satisfied and whose file
   scopes do not overlap.
2. For each task in the wave, **spawn an `executor` subagent in a fresh context**,
   scoped to that single task. Use **modest concurrency** (a handful per wave — never
   hundreds of agents). Each executor writes code + tests and makes **one atomic
   commit** for its task.
3. When the wave completes, collect each executor's summary (compressed), update the
   todo/wave status, and check the budget before the next wave (substitute your
   estimate): `npm run budget -- check execute --estimate <wave_est>`
   The `execute` cap is **per wave** — stop at the hard cap and report.
4. Repeat until all waves are done or a gate halts you.

## Constraints
- One task → one commit (Conventional Commits). Never bundle tasks.
- Executors stay inside their task's file scope; out-of-scope discoveries are parked
  via `/flow-add-todo`, not silently absorbed.
- Compress noisy build/test output before it enters context.

## After
**Update `.flow/STATE.md` in place** (never append a duplicate row): set **Active
phase** = `execute`; update the `execute` row (Status `done`, Artifact = the atomic
commits, e.g. `bin/cli.js +N (M commits)`); append one dated decisions-log line;
replace **Next action**. Execution does **not** ship; the next phase is **verify**.
