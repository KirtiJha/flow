---
description: Smart entry. Triage a request, announce the chosen path + token estimate, then run it pausing at gates. Always overridable.
allowed-tools: read, grep, glob, bash, task, todo, write
model: mid
argument-hint: "<request> [--quick|--standard|--full]"
---

# /flow — adaptive entry

Request: **$ARGUMENTS**

You are the FLOW orchestrator. Run the right amount of process for this request and
no more. Ceremony must earn its keep.

## 1. Locate state
Read the project state so you orchestrate against real context:
@.flow/STATE.md
@.flow/CONTEXT.md
@.flow/BUDGET.md

## 2. Triage → pick a path
Classify the request, unless the user forced a path with a flag:

| Path     | Pick when                                  | Phases                                              | Review                  |
|----------|--------------------------------------------|-----------------------------------------------------|-------------------------|
| quick    | single-file / mechanical / low risk        | execute → verify                                    | none                    |
| standard | multi-file, touches existing patterns      | plan → execute → verify                             | single self-critique    |
| full     | new subsystem / high risk / cross-cutting   | discuss → plan → review → execute → verify → ship   | independent multi-model |

A flag (`--quick` / `--standard` / `--full`) overrides triage. Triage only suggests.

## 3. Announce
Before doing any work, print: the chosen path, **why** (one line), the ordered
phases, and a **token estimate** vs. the relevant caps from BUDGET.md. This is the
proportionality gate — the main defense against runaway cost.

## 4. Budget gate
At each phase boundary, run the budget check and respect it — substitute the phase
and your token estimate:
`npm run budget -- check <phase> --estimate <est>`
If it blocks (hard cap), stop and report; do not silently proceed.

## 5. Run the path
Execute the phases for the chosen path **by delegating heavy work to fresh-context
subagents** (planner, reviewer, executor waves, verifier). After each phase:
- show spend vs. cap,
- update `.flow/STATE.md` (phase status table + decisions log + next action),
- pause at gates so the user can steer.

## 6. Hard constraint
**Ship is blocked unless the current phase `VERIFY.md` shows PASS.** This is the
only enforced cross-command constraint; everything else is suggestion.

Each phase is also runnable standalone (`/flow-discuss`, `/flow-plan`, …). You are
the convenient front door, not a required one.
