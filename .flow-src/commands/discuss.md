---
description: Phase 1. Surface and record implementation decisions before any planning. Writes DECISIONS.md. Runnable standalone.
allowed-tools: read, grep, glob, task, write
model: mid
argument-hint: "<request or topic> [--verbose]"
---

# /flow-discuss — decide before you plan

Topic: **$ARGUMENTS**

Read context first:
@.flow/STATE.md
@.flow/CONTEXT.md

## Goal
Convert a fuzzy request into explicit, recorded decisions so the plan has firm
ground. This is the (main) session's phase — keep it lean; delegate any non-trivial
investigation to the **researcher** subagent and consume only its summary.

## Do
1. Restate the request in your own words; confirm scope and non-goals.
2. List the **open decisions** that must be made (approach, trade-offs, constraints,
   affected areas). For each, give options and a recommendation with one-line
   rationale.
3. Where facts are needed, spawn the **researcher** subagent and fold its cited
   summary in — do not read the whole codebase yourself.
4. Resolve the decisions with the user where they are genuinely the user's to make;
   otherwise pick sensible defaults and note them.

## Write
`plans/<phase>/DECISIONS.md`:
- Request + scope/non-goals
- Decisions (decision → choice → rationale → alternatives rejected)
- Constraints and assumptions
- Inputs the planner will need

## Update STATE (in place — keep it truthful)
Edit `.flow/STATE.md` directly; never append a duplicate phase row:
- If this starts a **new milestone**, set **Current milestone** and reset all six
  phase-status rows to `not-started` first.
- Set **Active phase** = `discuss` and **Path**.
- Update the `discuss` row in the phase-status table in place (Status `done`,
  Artifact = the real `plans/<phase>/DECISIONS.md`, Last gate).
- Append one dated line to the **decisions log** (replace the `<YYYY-MM-DD>` example
  on first use); replace **Next action**. Note spend in one line (`--verbose` or
  `/flow-status` for the breakdown).
