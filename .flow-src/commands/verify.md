---
description: Phase 4. Adversarially verify built work against the plan's success criteria. Delegates to the verifier subagent. Writes VERIFY.md. Gates Ship. Runnable standalone.
allowed-tools: read, grep, glob, bash, task, write
model: high
argument-hint: "[<phase>] [--no-repair]"
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

## Auto-repair on FAIL (bounded, budget-safe)
Unless `--no-repair` was passed or the path is `quick`, attempt the verifier's fix
plan automatically instead of stopping:
1. Run the budget gate for `execute`, then for `verify`. **If either hard cap would be
   exceeded, stop the loop now** — report FAIL and the remaining work.
2. Spawn an `executor` subagent scoped to the fix plan (one atomic commit per task).
3. Re-spawn the verifier; it overwrites `plans/<phase>/VERIFY.md` with a fresh verdict.
4. Repeat from step 1 — at most **2 repair rounds** (3 verify attempts total).

Stop when verify PASSES, after 2 rounds, or when a budget cap would be hit. This keeps
"verify has teeth" self-healing without unbounded burn — the budget gate is the
backstop. Surface each round's verdict and spend.

## After
- Surface the final verdict prominently and the spend vs. the `verify` cap.
- **If still FAIL** (repair exhausted/off): leave `VERIFY.md` = FAIL, route the fix
  plan to `/flow-execute`, and **do not** proceed to ship.
- **If PASS:** ship is now unblocked. **Update `.flow/STATE.md` in place** (no
  duplicate rows): set **Active phase** = `verify`; update the `verify` row (Status
  `done`, Artifact = real `plans/<phase>/VERIFY.md`, Last gate = `PASS`/`FAIL`); append
  one dated decisions-log line; replace **Next action**.
