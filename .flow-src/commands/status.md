---
description: Print milestone, active phase, last gate, next action, and spend vs. caps. Truthful, read-only snapshot of FLOW state.
allowed-tools: read, bash
model: low
argument-hint: ""
---

# /flow-status — where are we?

Read state:
@.flow/STATE.md

Current budgets and recorded spend:
!`node --import tsx scripts/flow-budget.ts show`
!`node --import tsx scripts/flow-metrics.ts summary`

## Print a tight snapshot
- **Project / milestone** — name, mode, milestone in flight.
- **Active phase / path** — and the phase-status table.
- **Last gate** — what passed/failed most recently (e.g. last VERIFY verdict).
- **Spend vs. caps** — per phase, soft/hard, from the budget output above.
- **Open / blocked items** — counts and the most important one of each.
- **Next action** — the single next-action line from STATE.md, verbatim.

Be truthful: report what STATE actually says. If STATE is stale or inconsistent
(e.g. phase marked done but no artifact), say so rather than papering over it. This
command never mutates state.
