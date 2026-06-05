# Changelog

All notable changes to `@kirtijha1986/flow`. Dates are UTC.

## [0.4.1] — cross-platform hardening
- Quote the test glob so POSIX shells pass it literally to Node (unquoted, `sh`
  mis-expands `**`).
- Normalize hook `.mjs` files to LF (a CRLF shebang is a latent break if exec'd directly).
- Add a **GitHub Actions CI matrix** (Linux / macOS / Windows) running build, typecheck,
  the full test suite (incl. the installer integration test), and the generator
  round-trip — compatibility is now continuously verified on all three.

## [0.4.0] — concise responses
- **Concise-by-default** response convention (brief announce, gate pauses, one compact
  end summary; detail in artifacts + `/flow-status`). Pass **`--verbose`** to any
  command for the full phase-by-phase narration.

## [0.3.0] — power-user enhancements
- **#1 Real cost loop:** `flow-metrics calibrate` reports per-phase p50/p95 and
  suggested caps from recorded spend; triage estimates use recorded medians.
- **#2 Auto-repair verify:** on `standard`/`full`, a FAIL auto-repairs within budget
  (executor → re-verify, up to 2 rounds, hard-stopped by the budget cap). `--no-repair`
  disables; `quick` never repairs.
- **#4 Project adaptability:** `.flow/CONTEXT.md` gains **Verification gates** (the
  commands the verifier runs) and an optional **Routing policy** (raise the path for
  sensitive areas). `new-project` seeds the gates from the detected project.

## [0.2.0] — post-test fixes
- STATE phase-status table is now a fixed six-row in-place snapshot (no per-milestone
  duplicate rows); quick/standard runs keep `Active phase`/`execute`/`review` truthful.
- `new-project` uses `$ARGUMENTS` instead of positional `$1`/`$2` (unsupported in Skills).
- Milestone-aware rework signal in `flow-metrics` (no longer false-flags distinct
  milestones).
- Docs: quick-path work isn't shippable via the gate; ship needs a remote; the Stop
  hook records 0 tokens (per-phase recording is authoritative); status re-checks stale
  inlined metrics.

## [0.1.0] — initial release
- Five-phase loop (Discuss → Plan → Review → Execute → Verify → Ship) with proportional
  `quick`/`standard`/`full` paths and the adversarial review→verify pattern.
- 11 commands + 5 subagents authored once in `.flow-src/`, generated into Claude Code
  (Skills) and GitHub Copilot layouts.
- Cost-control layer (`flow-budget`, `flow-metrics`, `flow-compress`) and deterministic
  hooks (budget gate, atomic-commit, metrics).
- Zero-install **`npx` installer** shipping precompiled `dist/` (global or per-project,
  idempotent, state-preserving uninstall).
