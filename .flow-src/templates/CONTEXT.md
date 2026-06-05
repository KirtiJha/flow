# CONTEXT

> Durable project knowledge that every phase and subagent should assume. This is
> the contract. On Claude Code it is referenced from `CLAUDE.md`; on Copilot its
> essentials are mirrored into `.github/copilot-instructions.md` by the generator.

## Architecture

- <high-level shape of the system; major components and how they talk>

## Stack

- <languages, frameworks, runtimes, package managers, versions>

## Non-negotiable conventions

- **Style:** <formatter, lint rules>
- **Naming:** <files, symbols, branches>
- **Testing:** <framework, where tests live, coverage expectations>
- **Commits:** Conventional Commits, **one atomic commit per task**.
- **Branching:** <branch model, e.g. trunk-based / feature branches>
- **PR rules:** <review requirements, CI gates, merge policy>

## Verification gates

> The exact commands the **verifier** runs to check built work, on top of each plan's
> success criteria. Keep them fast and deterministic — the verifier reproduces them and
> treats a non-zero exit as a defect. Use `none` where a gate doesn't apply.

- **typecheck:** <command, e.g. `npm run typecheck` — or `none`>
- **test:** <command, e.g. `npm test` — or `none`>
- **lint:** <command — or `none`>
- **build:** <command — or `none`>

## Routing policy (optional)

> Project-specific triage overrides for `/flow`. Triage still classifies the request;
> a matching rule here **raises** the path (never lowers it). Leave empty for default
> triage.

- <e.g. changes under `migrations/` or `auth/` → always `full`>
- <e.g. anything touching the public API surface → at least `standard` (force review)>

## Directory map

- <dir> — <purpose>

## Gotchas

- <sharp edges, footguns, surprising behavior>

## External services

- <service> — <how it's reached, auth, env vars>

## Documentation pointers

- <where deeper docs live>

## Runtime / proxy assumption (do not remove)

FLOW runs through **Claude Code → LiteLLM → Amazon Bedrock**. Native Dynamic
Workflows and Agent Teams are **out of scope**: the LiteLLM proxy path makes a
research-preview feature (specific client version + background runtime) unreliable,
and native fan-out runs in `acceptEdits` mode with unbounded token burn, which
defeats FLOW's determinism, auditability, and cost governance. FLOW provides its
own modest, governed orchestration and implements the **adversarial verification**
pattern with ordinary subagents. Model tiers (low/mid/high) map to LiteLLM
`model_list` names at build time — never hard-code Anthropic/Bedrock model IDs.
