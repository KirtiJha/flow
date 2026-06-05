# FLOW

**Fresh-context Loop for Orchestrated Work.**

FLOW drives an AI coding agent through five disciplined phases — **Discuss → Plan →
Execute → Verify → Ship** (with an optional **Review** before execute) — to prevent
quality degradation ("context rot") on long or complex work. Heavy work runs in
**fresh-context subagents** so the main session stays lean. Durable state lives in
committed files so a team shares one source of truth. Cost is visible and capped at
every phase boundary. Commands and agents are **authored once** and **generated**
into Claude Code and GitHub Copilot layouts.

```bash
npm install      # tsx + typescript
npm run gen      # generate Claude Code (Skills) + Copilot layouts from .flow-src/
```

Then in Claude Code: `/flow "add rate limiting to the public API"` — FLOW triages
the request, announces the path and a token estimate, and runs it pausing at gates.

## Install

To **use** FLOW in your own project — no clone, no toolchain. Install the package
**persistently** (globally or as a dev dependency), then run `flow`:

```bash
# Recommended: global install (stable, available in every project)
npm install -g @kirtijha1986/flow
flow --claude          # install into THIS project (default, local scope)
flow --global          # install into ~/.claude (all projects)
flow --copilot         # GitHub Copilot layout instead
flow --all             # both runtimes
flow --uninstall       # remove FLOW files + hooks (keeps .flow/ state)
```

Or pin it to a single project as a dev dependency:

```bash
npm install -D @kirtijha1986/flow
npx flow --claude
```

The installer scaffolds `.flow/` state, generates the runtime layout
(`.claude/skills/…` and/or `.github/…`), and wires the three governance hooks into
`.claude/settings.json` with absolute paths. Restart Claude Code afterward so it
loads the hooks.

- **Zero build.** The package ships **precompiled `dist/`**, so you need no `tsx`,
  no `tsc`, and no build step.
- **Idempotent.** Re-run any time to update — generated files are refreshed, your
  `.flow/` state is never clobbered, and hooks are de-duped (never doubled).
- **`--global` vs `--local`.** `--local` (the default) targets the current project;
  `--global` targets `~/.claude/` so the layout is available across all projects.
- **`--uninstall`** removes FLOW-managed files and hook entries while **preserving
  your `.flow/` state** (STATE / CONTEXT / BUDGET / metrics) entirely.

> **Why a persistent install (not bare `npx @kirtijha1986/flow`)?** The installer wires
> hooks and command invocations using absolute paths into the installed package. A
> one-shot `npx @kirtijha1986/flow` runs from npm's temporary `_npx` cache, which can be
> evicted later — breaking those paths. A global or dev-dependency install gives the
> package a stable home, so the wiring keeps working.

> **Users install the package; contributors clone.** The "First run" steps below are
> only for cloning the dev repo to **develop FLOW itself** (they build from
> `.flow-src/` with `tsx`). If you just want to *use* FLOW, the install above is all
> you need.

## First run

> This section is for **contributors** developing FLOW itself. To merely use FLOW in
> your project, see [Install](#install) above.

The runtime layouts and hook wiring are **not** committed (they are generated and
machine-local), so a fresh clone needs two setup steps before the slash commands and
governance gates work:

```bash
npm install                                   # tsx + typescript
npm run gen                                   # REQUIRED: generate .claude/ + .github/ layouts
cp hooks/settings.example.json .claude/settings.json   # wire the budget / commit / metrics hooks
```

- **`npm run gen` is mandatory.** Without it there is no `.claude/skills/` directory,
  so `/flow` and the phase commands do not exist. Re-run it after any edit to
  `.flow-src/`.
- **Copy the hooks** to activate the deterministic gates (budget block, atomic-commit
  enforcement, metrics). Restart Claude Code afterward so it loads `.claude/settings.json`.
- **Sanity check:** `npm run typecheck && npm test` should both pass, and
  `npm run gen -- --check` should report no drift.

> On Windows, model tiers in `flow.config.json` resolve to native Claude Code aliases
> (`haiku`/`sonnet`/`opus`); switch them to your LiteLLM `model_list` names when
> routing through the gateway.

## Why FLOW

- **Ceremony earns its keep.** Triage routes one-line changes to a `quick` path and
  new subsystems to a `full` path. You can always override.
- **Fresh context for heavy work.** Research, plan, execute, review, and verify each
  run in a subagent that starts clean.
- **State in files, not context.** `.flow/STATE.md`, `CONTEXT.md`, `BUDGET.md`, plus
  per-phase artifacts and metrics — all committed.
- **Cost is first-class.** `flow-budget` warns at the soft cap and **blocks at the
  hard cap**; `flow-compress` trims tool output before it enters context;
  `flow-metrics` appends one record per session.
- **Verify has teeth.** `/flow-ship` is blocked until `VERIFY.md` records `PASS`.
- **One source, two runtimes.** Author in `.flow-src/`; `flow-gen` emits each
  runtime's native layout with a `GENERATED` banner.

## Runtime model

FLOW is built for the **Claude Code → LiteLLM → Amazon Bedrock** path. It provides
its **own** orchestration and does **not** depend on Claude Code's native Dynamic
Workflows or Agent Teams — that path is unreliable through a translation proxy and
burns unbounded tokens. FLOW implements the **adversarial verification** pattern (one
agent refutes another) with ordinary subagents. Model tiers (`low`/`mid`/`high`) map
to **LiteLLM `model_list` names** at build time via `flow.config.json`; no
hard-coded Anthropic/Bedrock model IDs. See
[`docs/flow/DECISION-GUIDE.md`](docs/flow/DECISION-GUIDE.md) for the full rationale.

## Two runtimes (not a clean mirror)

| | Claude Code | GitHub Copilot |
|--|-------------|----------------|
| Commands | `.claude/skills/<n>/SKILL.md` (or `--legacy-commands`) | `.github/prompts/<n>.prompt.md` (IDE chat) |
| Agents | `.claude/agents/<n>.md` (native subagents) | `.github/agents/<n>.agent.md` (handoffs) |
| Context | referenced from `CLAUDE.md` | injected into `.github/copilot-instructions.md` |
| Hooks | deterministic (budget / commit / metrics) | advisory (via instructions) |
| Fidelity | **full** | **first-class in IDE chat; CLI degraded** |

> The Copilot **CLI** does not support custom prompt files / slash commands. CLI
> users get FLOW through the injected `copilot-instructions.md` (the one file the CLI
> reads). FLOW does not claim CLI parity.

## Layout

```
.flow-src/            canonical source — edit here
  commands/           11 command bodies
  agents/             5 subagent definitions
  templates/          STATE / CONTEXT / BUDGET templates
scripts/              flow-core, flow-budget, flow-compress, flow-metrics, flow-gen
  adapters/           claude-code.ts, copilot.ts (per-runtime transforms)
hooks/                budget gate, atomic-commit, post-session metrics
docs/flow/            ONBOARDING, COMMANDS, DECISION-GUIDE
.flow/                live state + metrics (committed)
.claude/ .github/     GENERATED by flow-gen — do not edit
flow.config.json      tier→LiteLLM mapping, runtime toggles, banner
```

## Scripts

| Command | What |
|---------|------|
| `npm run gen` | Generate both runtimes (Skills layout). |
| `npm run gen:legacy` | Generate Claude `.claude/commands/` instead of Skills. |
| `npm run gen -- --check` | Report drift without writing (CI). |
| `npm run gen -- --only copilot` | Generate a single runtime. |
| `npm run budget -- show` / `check <phase>` | Inspect / enforce per-phase caps. |
| `npm run compress` | Compress tool output on stdin (preserves errors/summaries). |
| `npm run metrics -- summary` | Spend / rework summary from `.flow/metrics/`. |
| `npm run typecheck` | Type-check all scripts. |

## Documentation

- [Onboarding](docs/flow/ONBOARDING.md)
- [Commands & agents reference](docs/flow/COMMANDS.md)
- [Decision guide](docs/flow/DECISION-GUIDE.md)

## License

MIT — see [LICENSE](LICENSE).
