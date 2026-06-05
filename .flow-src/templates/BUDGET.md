# BUDGET

> Cost governance for FLOW. `flow-budget` parses the cap table below, compares it
> against recorded session spend, warns at the soft cap and **blocks at the hard
> cap**. Tokens are the unit. **Tune from real runs:** `flow-metrics calibrate`
> prints each phase's p50/p95 and suggested soft/hard caps — adjust the table to fit
> your project rather than trusting the seed defaults.

## Model tiers

> Tiers are FLOW-canonical. They map to LiteLLM `model_list` names at build time
> via `flow.config.json` — never hard-code Anthropic/Bedrock model IDs here.

| Tier | LiteLLM model name | Typical use                          |
|------|--------------------|--------------------------------------|
| low  | flow-haiku         | ship, status, mechanical work        |
| mid  | flow-sonnet        | discuss, execute                     |
| high | flow-opus          | plan, verify, deep review            |

## Per-phase caps

<!-- FLOW:CAPS:START -->
| Phase            | Soft (tokens) | Hard (tokens) |
|------------------|---------------|---------------|
| discuss          | 30000         | 60000         |
| plan             | 80000         | 150000        |
| review           | 60000         | 120000        |
| execute          | 150000        | 300000        |
| verify           | 80000         | 150000        |
| quick            | 40000         | 80000         |
<!-- FLOW:CAPS:END -->

> `execute` caps are **per wave**. `quick` is the whole quick-path budget.

## Overhead targets

- **Real work (standard/full):** ≤ 1.5 : 1 (FLOW orchestration tokens : useful output).
- **Quick path:** ≈ 0 added overhead beyond the work itself.

## Running spend (auto-appended)

> `flow-metrics` / `flow-budget` append rows here. Do not hand-edit.

<!-- FLOW:SPEND:START -->
| Timestamp (UTC) | Phase | Tokens | Within cap |
|-----------------|-------|--------|------------|
<!-- FLOW:SPEND:END -->
