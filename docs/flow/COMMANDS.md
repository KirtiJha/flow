# FLOW — Commands & Agents reference

All commands are **independently runnable**. Triage via `/flow` only *suggests* a
path. The only enforced cross-command constraint is **verify → ship**.

Names below are the generated invocations (`flow` is bare; the rest are namespaced
`flow-<name>`). Canonical sources live in `.flow-src/commands/`.

## Commands

| Command | Phase | Default tier | Reads | Writes |
|---------|-------|--------------|-------|--------|
| `/flow` | smart entry | mid | request, STATE, CONTEXT, BUDGET | runs the chosen path |
| `/flow-discuss` | Discuss | mid | request, CONTEXT | `plans/<phase>/DECISIONS.md` |
| `/flow-plan` | Plan | high | DECISIONS, CONTEXT, map | `plans/<phase>/PLAN.md` |
| `/flow-review` | Review | high | PLAN | `reviews/<phase>/REVIEWS.md` |
| `/flow-execute` | Execute | mid | PLAN | code + atomic commits |
| `/flow-verify` | Verify | high | PLAN, diff | `plans/<phase>/VERIFY.md` |
| `/flow-ship` | Ship | low | VERIFY | PR + archived state |
| `/flow-map-codebase` | (brownfield) | mid | CONTEXT | `.flow/codebase-map.md` |
| `/flow-new-project` | (bootstrap) | low | templates | seeds `.flow/` |
| `/flow-status` | (read-only) | low | STATE, BUDGET, metrics | — |
| `/flow-add-todo` | (anytime) | low | STATE | appends to Open items |

### Notes
- **`/flow`** triages (quick/standard/full), announces the path + token estimate
  (based on recorded medians where available), and runs it pausing at gates.
  Overridable with `--quick` / `--standard` / `--full`.
- **`/flow-execute`** is FLOW's own orchestrator: it runs plan tasks in **parallel
  waves** (modest concurrency, never hundreds of agents) via fresh-context
  executors, **one atomic commit per task**. The `execute` budget cap is per wave.
- **`/flow-verify`** runs the project's **Verification gates** (from CONTEXT) + the
  plan's hooks, adversarially. On `standard`/`full` a FAIL **auto-repairs** within
  budget (executor → re-verify, up to 2 rounds); `--no-repair` disables it.
- **`/flow-ship`** is **blocked** unless `VERIFY.md` shows `Verdict: PASS`.
- **`/flow-add-todo`** parks an idea in STATE without touching the active phase.

### Output & flags
- **Concise by default:** commands announce briefly, pause at gates, and end with one
  compact summary. Detail lives in the artifacts and `/flow-status`. Pass **`--verbose`**
  to any command for the full phase-by-phase narration.
- **Helper scripts:** `npm run budget -- show|check`, `npm run metrics -- summary`,
  and `npm run metrics -- calibrate` (per-phase p50/p95 → suggested caps).

## Agents (subagents)

Canonical sources in `.flow-src/agents/`. Each runs in its own fresh context and
returns a compact summary. Least-privilege tool scoping per role.

| Agent | Role | Tools (canonical) | Writes |
|-------|------|-------------------|--------|
| `researcher` | Read-only investigation | read, grep, glob, web-search, web-fetch | (summary only) |
| `planner` | Atomic, verifiable plan | + write | PLAN.md only |
| `executor` | Implement one task | read, write, edit, bash, grep, glob | code + one commit |
| `reviewer` | Adversarial plan critique | read, grep, glob, bash, web-*, write | REVIEWS.md only |
| `verifier` | Adversarial verification | read, grep, glob, bash, write | VERIFY.md only (gates ship) |

**Adversarial pattern:** `reviewer` and `verifier` actively try to *refute* the
plan / the built work against explicit success criteria, iterating until they
converge. This is the borrowed *pattern* of adversarial verification — implemented
with ordinary subagents, requiring no native workflow feature.

## Tool-name translation

Canonical tool names are translated per runtime by the adapters:

| Canonical | Claude Code | Copilot |
|-----------|-------------|---------|
| read | Read | read |
| write / edit | Write / Edit | edit |
| bash | Bash | execute |
| grep / glob | Grep / Glob | search |
| web-search / web-fetch | WebSearch / WebFetch | web |
| task | Task | agent |
| todo | TodoWrite | todo |
| ask-user | AskUserQuestion | ask_user |

## Model tiers

Tiers map to LiteLLM `model_list` names at build time (`flow.config.json`):

| Tier | LiteLLM name (default) |
|------|------------------------|
| low | `flow-haiku` |
| mid | `flow-sonnet` |
| high | `flow-opus` |

Edit the right-hand side to match your gateway, then re-run `npm run gen`.
