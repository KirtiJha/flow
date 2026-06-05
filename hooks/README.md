# FLOW hooks

Deterministic gates that run *between* steps so FLOW's guarantees don't depend on
the model remembering them. All three are plain Node ESM (`.mjs`) — no build step —
so they run reliably in minimal-PATH hook environments.

| Hook | Event | Behavior |
|------|-------|----------|
| `pre-phase-budget.mjs` | `PreToolUse` (Skill/SlashCommand) | Infers the phase from the invocation (`flow-plan` → `plan`), runs `flow-budget check`, and **blocks (exit 2) at the hard cap**. |
| `atomic-commit.mjs` | `PostToolUse` (Bash) | After a `git commit`, **blocks (exit 2)** unless HEAD's subject is Conventional Commits — enforcing one atomic, well-formed commit per task. |
| `post-session-metrics.mjs` | `Stop` | Appends one JSONL metrics record via `flow-metrics append` (token count from `FLOW_SESSION_TOKENS` env / LiteLLM accounting). |

## Wiring

Copy the entries from [`settings.example.json`](./settings.example.json) into your
project `.claude/settings.json`. The budget and metrics hooks shell out to the
TypeScript scripts via `node --import tsx scripts/…`, so `tsx` must be installed
(`npm install`). All hooks locate the project root by walking up for
`flow.config.json`.

## On Copilot

These are Claude Code hooks. Copilot has no equivalent deterministic hook surface,
so on Copilot the same guarantees are advisory — encoded in
`.github/copilot-instructions.md` (the budget gate, the verify→ship rule, and the
atomic-commit convention). This is part of the documented runtime asymmetry, not a
silent gap.
