# FLOW — Decision guide

## Which path? (proportional process)

Triage picks the smallest sufficient path. You can always override with a flag.

| Path | Pick when | Phases | Review |
|------|-----------|--------|--------|
| **quick** | single-file / mechanical / low risk | execute → verify | none |
| **standard** | multi-file, touches existing patterns | plan → execute → verify | single self-critique |
| **full** | new subsystem / high risk / cross-cutting | discuss → plan → review → execute → verify → ship | independent multi-model |

**Rule of thumb:** if you can describe the change in one sentence and it touches one
file, it's `quick`. If it spans modules or changes a shared pattern, it's
`standard`. If it introduces a new subsystem, crosses team boundaries, or is hard to
reverse, it's `full`.

Proportionality is FLOW's main defense against cost blow-ups: a small change should
cost almost nothing in orchestration overhead (target ≈ 0 for quick; ≤ 1.5 : 1 for
real work).

## Why no native Dynamic Workflows / Agent Teams?

Claude Code ships native **Dynamic Workflows** (a Claude-authored JS script
orchestrating up to ~1,000 subagents, 16 concurrent, with adversarial verification)
and **Agent Teams**. FLOW does **not** build on either, for reasons specific to this
environment:

1. **The proxy path is the blocker.** This org runs **Claude Code → LiteLLM →
   Bedrock**. LiteLLM's own docs say Claude Code feature compatibility varies by
   provider and changes across releases. A research-preview feature that needs a
   specific client version and a background runtime is exactly what a translation
   proxy is most likely to break. Treat it as unavailable.
2. **Defaults fight FLOW's goals.** Native workflow subagents run in `acceptEdits`
   mode, fan out to hundreds of agents, and consume substantially more tokens —
   undermining the determinism, auditability, and cost governance FLOW exists to
   provide for a metered team on a Bedrock gateway.
3. **Research preview = moving target.** Don't bet core architecture on a preview
   feature reached over an unsupported path.

**What FLOW borrows anyway (no dependency):** the *pattern* of **adversarial
verification** — one subagent refutes another's findings, iterating to convergence.
FLOW's `reviewer` and `verifier` implement this with ordinary subagents. It needs no
native feature and works through the proxy.

> Do **not** add capability-detection or delegate-to-native code paths anywhere.
> Own engine only.

## When to update state files

- **STATE.md** — every phase boundary (status table, decisions log append, next
  action). The decisions log is **append-only**.
- **CONTEXT.md** — when conventions, architecture, or the directory map change.
  Keep the runtime/proxy assumption block intact.
- **BUDGET.md** — tune caps from real runs: `flow-metrics calibrate` prints each
  phase's p50/p95 and suggested soft/hard caps (vs. your current ones). The running-
  spend table is auto-appended; don't hand-edit it.

## When verify FAILS

On `standard`/`full`, `/flow-verify` **auto-repairs within budget**: it spawns an
executor for the verifier's fix plan and re-verifies, up to **2 rounds**, stopping
immediately if a budget hard cap would be hit. Pass `--no-repair` to disable; `quick`
never repairs. If repair is exhausted or off, the verdict stays `FAIL` — route the fix
plan to `/flow-execute` (one atomic commit per fix) and re-run. **Never ship on FAIL**;
`/flow-ship` is hard-gated on PASS. A *single milestone* verified more than once shows
up in `flow-metrics` as a rework signal — use it to tune plan quality.

## Per-project configuration (`.flow/CONTEXT.md`)

Two project-level knobs live in CONTEXT, so they travel with the repo (not the
read-only package):
- **Verification gates** — the exact `typecheck` / `test` / `lint` / `build` commands
  the verifier runs and reproduces; a non-zero exit on any is a defect.
- **Routing policy** (optional) — rules that **raise** the triaged path for sensitive
  areas (e.g. changes under `auth/` → `full`). They never lower it; an explicit
  `--quick/--standard/--full` flag still wins.

## Runtime-specific isolation caveat

Fresh-context isolation is clean on Claude Code (native subagents). On Copilot it is
expressed via **agent handoffs**, which may not isolate context as cleanly. The
generator emits a warning naming the isolation-sensitive phases. Treat Copilot
isolation as best-effort and keep handoff inputs explicit.
