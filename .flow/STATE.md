# STATE

> Single source of truth for the active work. Read at the start of every phase;
> each phase writes its artifact back.

## Project

- **Name:** FLOW
- **Mode:** greenfield

## Current milestone

- Initial end-to-end build of FLOW (foundations → scripts → agents → commands →
  adapters/generator → hooks → validation).

## Active phase

- **Phase:** ship
- **Path:** full

## Phase status

| Phase   | Status      | Artifact                       | Last gate |
|---------|-------------|--------------------------------|-----------|
| discuss | done        | (this spec)                     | passed    |
| plan    | done        | (build order §12)               | passed    |
| review  | done        | (verified facts §A)             | passed    |
| execute | done        | code + atomic commits           | passed    |
| verify  | done        | typecheck + gen round-trip      | passed    |
| ship    | in-progress | initial commit                  | —         |

## Decisions log (append-only)

- 2026-06-04 — Built FLOW as a standalone project (own git repo), separate from any
  host repo, per request.
- 2026-06-04 — Generator emits Claude Code Skills layout by default; `--legacy-commands`
  emits `.claude/commands/`.
- 2026-06-04 — Native Dynamic Workflows / Agent Teams kept out of scope; own engine
  only; adversarial verification implemented with ordinary subagents.
- 2026-06-04 — Model tiers (low/mid/high) resolve to LiteLLM `model_list` names via
  `flow.config.json`; no hard-coded Anthropic/Bedrock IDs.

## Open items

- Tune per-phase caps in BUDGET.md from real runs through the proxy.

## Blocked items

- (none)

## Next action

- Publish the repository to GitHub and run the validation pass (§12.7).
