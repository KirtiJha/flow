# FLOW — Onboarding

**FLOW = Fresh-context Loop for Orchestrated Work.** It drives an AI coding agent
through five disciplined phases — **Discuss → Plan → Execute → Verify → Ship** (with
an optional **Review** before execute) — to prevent quality degradation ("context
rot") on long or complex work.

## Install (npx)

To use FLOW in your own project, install it with `npx` — zero-install (the package
ships precompiled `dist/`, so no `tsx`/build is needed on your machine):

```bash
npx @kirtijha1986/flow@latest --claude       # install into THIS project (default, local)
npx @kirtijha1986/flow@latest --global       # install into ~/.claude (all projects)
npx @kirtijha1986/flow@latest --copilot      # GitHub Copilot layout instead
npx @kirtijha1986/flow@latest --all          # both runtimes
npx @kirtijha1986/flow@latest --uninstall    # remove FLOW files + hooks (keeps .flow/ state)
```

It is **idempotent** (re-run to update; `.flow/` state is never clobbered and hooks
are de-duped) and `--uninstall` **preserves `.flow/`** state. **Users install via
`npx`; contributors clone** — the "Get started" steps below build FLOW from source
and are only for developing FLOW itself.

## The core ideas

1. **Ceremony earns its keep.** A one-line change must never trigger a full loop.
   Triage routes work to the smallest sufficient path (see DECISION-GUIDE).
2. **Fresh context for heavy work.** Research, planning, execution, review, and
   verification each run in a **fresh-context subagent** so the main session stays
   lean.
3. **State lives in files.** Anything that must survive a session is in `.flow/`
   (`STATE.md`, `CONTEXT.md`, `BUDGET.md`, artifacts, metrics) — committed, so the
   whole team shares one source of truth.
4. **Cost is first-class.** Spend vs. cap is shown at every phase boundary; tool
   output is compressed before it enters context; metrics append per session.
5. **Verify has teeth.** Ship is **blocked** until VERIFY records PASS.
6. **One authored source.** Commands/agents are authored once in `.flow-src/` and
   **generated** into Claude Code and Copilot layouts. Never hand-edit generated
   files.

## Runtime model (important)

FLOW runs through **Claude Code → LiteLLM → Amazon Bedrock**. It deliberately does
**not** use Claude Code's native Dynamic Workflows or Agent Teams — that path is
unreliable through a translation proxy and burns unbounded tokens. FLOW provides its
**own** modest, governed orchestration and implements the **adversarial verification**
pattern (one agent refutes another) with ordinary subagents. Model tiers
(`low`/`mid`/`high`) map to **LiteLLM model_list names** at build time via
`flow.config.json` — there are no hard-coded Anthropic/Bedrock model IDs.

## Two runtimes, not a clean mirror

- **Claude Code** — full-fidelity: custom commands (Skills), subagents with scoped
  tools, deterministic hooks. Primary target.
- **GitHub Copilot** — **first-class in IDE chat** (VS Code / JetBrains): prompt
  files, custom agents, instructions. **The Copilot CLI does not support custom
  prompt files / slash commands** — so CLI users get FLOW via the injected
  `.github/copilot-instructions.md` (the one file the CLI reads). We do not claim CLI
  parity.

## Get started

```bash
npm install            # install dev deps (tsx, typescript)
npm run gen            # generate Claude Code (Skills) + Copilot layouts
npm run gen:legacy     # OR generate Claude .claude/commands/ instead of Skills
npm run gen -- --check # CI-friendly: report drift without writing
```

Then, in Claude Code, start with `/flow "<your request>"` — it triages, announces
the path and a token estimate, and runs it pausing at gates. Every phase is also
runnable standalone (`/flow-plan`, `/flow-verify`, …). To bootstrap a brand-new
project's state, run `/flow-new-project "<name>"` (and `/flow-map-codebase` first for
brownfield).

Wire the deterministic gates by copying `hooks/settings.example.json` into
`.claude/settings.json` (see `hooks/README.md`).

## Where things live

| Path | What |
|------|------|
| `.flow-src/commands/` | Canonical command bodies (single source) |
| `.flow-src/agents/` | Canonical subagent definitions |
| `.flow-src/templates/` | STATE/CONTEXT/BUDGET templates |
| `scripts/` | `flow-core`, `flow-budget`, `flow-compress`, `flow-metrics`, `flow-gen` |
| `scripts/adapters/` | Per-runtime transforms |
| `hooks/` | Budget gate, atomic-commit, metrics hooks |
| `.flow/` | Live state + metrics (committed) |
| `.claude/`, `.github/` | **Generated** — do not edit |

## Publishing (maintainers)

FLOW is published to npm as **`@kirtijha1986/flow`** and consumed via `npx` (see
[Install](#install-npx)). The package ships **precompiled `dist/`** so end users need
no toolchain:

- The `files` whitelist in `package.json` ships only `dist/`, `bin/`, `.flow-src/`,
  `hooks/`, `flow.config.json`, `docs/flow/`, and `README.md` — nothing else lands in
  the tarball (verify with `npm pack --dry-run`).
- `prepublishOnly` runs `npm run build`, so `dist/` is always recompiled from current
  source before a publish.
- The package is **scoped** (`@kirtijha1986/flow`), so it must be published with public
  access. `publishConfig.access` is set to `public`, but pass the flag explicitly to
  be safe — scoped packages default to *restricted* otherwise.

To cut a release: `npm login`, bump the `version` in `package.json`, then:

```bash
npm publish --access public   # triggers prepublishOnly -> build automatically
```
