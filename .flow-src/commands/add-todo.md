---
description: Park an idea or out-of-scope discovery in STATE without derailing the current phase. Append-only.
allowed-tools: read, write
model: low
argument-hint: <the idea or task to park>
---

# /flow-add-todo — park it, don't chase it

Idea: **$ARGUMENTS**

Read state:
@.flow/STATE.md

## Do
Append the idea to the **Open items** list in `.flow/STATE.md` with today's date and,
if obvious, a one-word category (bug/cleanup/feature/risk). Do **not** start working
on it. Do **not** touch the active phase, the decisions log, or the next-action line.

This exists so a mid-phase discovery can be captured without blowing the phase's
focus or budget. Confirm in one line what was parked and where.
