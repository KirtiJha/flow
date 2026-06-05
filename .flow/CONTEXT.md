# CONTEXT

> Durable project knowledge for FLOW itself. Referenced from `CLAUDE.md` on Claude
> Code; essentials mirrored into `.github/copilot-instructions.md` by `flow-gen`.

## Architecture

FLOW is a **single-authored, multi-runtime agent workflow**. Canonical command and
agent bodies live in `.flow-src/`. A generator (`flow-gen`) reads those bodies plus
two adapters and emits native layouts for Claude Code and GitHub Copilot. Runtime
state (STATE/CONTEXT/BUDGET + artifacts) lives in `.flow/` and is committed so a
team shares one source of truth. Three TypeScript scripts provide the cost-control
layer (`flow-budget`, `flow-compress`, `flow-metrics`) on top of `flow-core`.

## Stack

- **Helper scripts:** TypeScript on Node (ESM, Node ≥ 18), dependency-light. `tsx`
  for direct execution, `tsc` for type-checking / build.
- **Authoring format:** Markdown + YAML frontmatter in `.flow-src/`.
- **Runtimes:** Claude Code (primary, full-fidelity) and GitHub Copilot (IDE chat
  first-class; CLI degraded).

## Non-negotiable conventions

- **Style:** Prettier defaults; 2-space indent; no unused exports.
- **Naming:** `kebab-case` files, `camelCase` symbols, `flow-*` branches.
- **Testing:** `npm run typecheck` must pass; generator output is validated by
  re-running `flow-gen` and diffing.
- **Commits:** Conventional Commits, **one atomic commit per task**.
- **Branching:** feature branches off `main`.
- **PR rules:** verify must pass before ship; PR body summarizes phase artifacts.

## Directory map

- `.flow-src/commands/` — eleven canonical command bodies (the single source).
- `.flow-src/agents/` — five canonical subagent definitions.
- `.flow-src/templates/` — STATE / CONTEXT / BUDGET templates for new projects.
- `scripts/` — `flow-core`, `flow-budget`, `flow-compress`, `flow-metrics`, `flow-gen`.
- `scripts/adapters/` — `claude-code.ts`, `copilot.ts` (per-runtime transforms).
- `hooks/` — atomic-commit enforcement, pre-phase budget gate, post-session metrics.
- `docs/flow/` — ONBOARDING, COMMANDS, DECISION-GUIDE.
- `.flow/` — live runtime state + metrics for this project.

## Gotchas

- **Generated files are not source.** Every file under `.claude/` and `.github/`
  (prompts/agents) carries the GENERATED banner and is git-ignored. Edit `.flow-src/`
  and re-run `npm run gen`.
- **No native orchestration.** Do not add capability-detection or delegate-to-native
  code paths anywhere. See the proxy assumption below.
- **Tool-name translation is per-runtime** and lives only in the adapters, never in
  agent/command bodies, which use FLOW-canonical tool names.

## External services

- LiteLLM gateway in front of Amazon Bedrock. Model tiers resolve to LiteLLM
  `model_list` names via `flow.config.json`.

## Documentation pointers

- `docs/flow/ONBOARDING.md`, `docs/flow/COMMANDS.md`, `docs/flow/DECISION-GUIDE.md`.

## Runtime / proxy assumption (do not remove)

FLOW runs through **Claude Code → LiteLLM → Amazon Bedrock**. Native Dynamic
Workflows and Agent Teams are **out of scope**: the LiteLLM proxy path makes a
research-preview feature (specific client version + background runtime) unreliable,
and native fan-out runs in `acceptEdits` mode with unbounded token burn, which
defeats FLOW's determinism, auditability, and cost governance. FLOW provides its
own modest, governed orchestration and implements the **adversarial verification**
pattern with ordinary subagents. Model tiers (low/mid/high) map to LiteLLM
`model_list` names at build time — never hard-code Anthropic/Bedrock model IDs.
