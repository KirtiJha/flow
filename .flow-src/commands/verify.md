---
description: Phase 4. Adversarially verify built work against the plan's success criteria. Delegates to the verifier subagent. Writes VERIFY.md. Gates Ship. Runnable standalone.
allowed-tools: read, grep, glob, bash, task, write
model: high
argument-hint: "[<phase>]"
---

# /flow-verify — Verify has teeth

Read context, plan, and the diff under review:
@.flow/STATE.md
@.flow/CONTEXT.md
@plans/<phase>/PLAN.md

Current diff against the base:
!`git diff --stat`

## Run
Spawn the **verifier** subagent in a fresh context. It must:
- Run the plan's **verification hooks** (tests/build) and reproduce results — never
  trust a summary's assertions.
- Check **every** plan success criterion, seeking a counterexample for each
  (adversarial pattern). Treat untested/vacuous criteria as defects.
- Write `plans/<phase>/VERIFY.md` with a one-word **Verdict: PASS|FAIL**, a
  per-criterion evidence table, adversarial probes, and (if FAIL) a fix plan.

## After
- Surface the verdict prominently and the spend vs. the `verify` cap.
- **If FAIL:** route the fix plan back to `/flow-execute`; do not proceed to ship.
- **If PASS:** ship is now unblocked. Update `.flow/STATE.md`.
