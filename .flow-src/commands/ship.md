---
description: Phase 5. Open the PR, archive phase artifacts, update STATE, trigger metrics append. BLOCKED unless VERIFY.md shows PASS. Runnable standalone.
allowed-tools: read, grep, glob, bash, write
model: low
argument-hint: "[<phase>]"
---

# /flow-ship — only when verify passed

Read state and the verdict that gates this command:
@.flow/STATE.md
@plans/<phase>/VERIFY.md

## Hard gate (the one enforced cross-command constraint)
Confirm `plans/<phase>/VERIFY.md` records **Verdict: PASS** — substitute the phase
and check: `grep -iE "Verdict:\s*PASS" plans/<phase>/VERIFY.md`
If it does not show PASS, **STOP**: print why and route the user to `/flow-verify`
(or `/flow-execute` if there are defects). Do not open a PR.

## On PASS
1. Ensure the branch is pushed and open a PR. The PR body summarizes the phase:
   link DECISIONS / PLAN / REVIEWS / VERIFY and list the atomic commits.
2. **Archive** this phase's artifacts (move `plans/<phase>/` and `reviews/<phase>/`
   into an archived location so the next phase starts clean).
3. Update `.flow/STATE.md`: mark phase shipped, advance the milestone, set the next
   action.
4. Trigger the metrics append for this session (substitute the token spend):
   `npm run metrics -- append --phase ship --tokens <spend> --within-cap true`

Keep ship cheap (low tier) — it is bookkeeping, not reasoning.
