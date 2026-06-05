# FLOW hooks

Deterministic gates that run *between* steps so FLOW's guarantees don't depend on
the model remembering them. All three are plain Node ESM (`.mjs`) — no build step —
so they run reliably in minimal-PATH hook environments.

| Hook | Event | Behavior |
|------|-------|----------|
| `pre-phase-budget.mjs` | `PreToolUse` (Skill/SlashCommand) | Infers the phase from the invocation (`flow-plan` → `plan`), runs `flow-budget check`, and **blocks (exit 2) at the hard cap**. |
| `atomic-commit.mjs` | `PostToolUse` (Bash) | After a `git commit`, **blocks (exit 2)** unless HEAD's subject is Conventional Commits — enforcing one atomic, well-formed commit per task. |
| `post-session-metrics.mjs` | `Stop` | Appends one JSONL metrics record into the project's `.flow/metrics/` via `flow-metrics append`. |

> **Token counts at session end:** the `Stop` hook records `tokens: 0` unless
> `FLOW_SESSION_TOKENS` is set (Claude Code does not surface a session total to hooks).
> This is expected — the **authoritative spend** is the per-phase totals that `/flow`
> runs record in-band during each phase (visible in `/flow-status` and
> `flow-metrics summary`). The 0-token `session` rows are just session markers.

## Wiring

The `npx` installer wires these automatically (absolute paths into the installed
package). To wire by hand, copy the entries from
[`settings.example.json`](./settings.example.json) into your project
`.claude/settings.json`. Each hook resolves its helper script **relative to its own
location** — the compiled `dist/scripts/*.js` when installed (no `tsx` needed), or the
`tsx` dev form when run from the source repo — and runs it against the **project**
(`cwd`) so `flow-budget`/`flow-metrics` find that project's `.flow/`.

## On Copilot

These are Claude Code hooks. Copilot has no equivalent deterministic hook surface,
so on Copilot the same guarantees are advisory — encoded in
`.github/copilot-instructions.md` (the budget gate, the verify→ship rule, and the
atomic-commit convention). This is part of the documented runtime asymmetry, not a
silent gap.
