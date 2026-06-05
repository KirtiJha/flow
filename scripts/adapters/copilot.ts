/**
 * adapters/copilot — emit the GitHub Copilot layout from canonical .flow-src/.
 *
 * Commands     -> .github/prompts/<name>.prompt.md     (VS Code / JetBrains chat)
 * Agents       -> .github/agents/<name>.agent.md        (handoffs ≈ subagent spawn)
 * Instructions -> .github/copilot-instructions.md       (marker-injected; read by CLI)
 *
 * The runtimes are NOT a clean mirror. Copilot is first-class in IDE chat and
 * DEGRADED in the CLI (the CLI ignores .github/prompts/). This adapter encodes that
 * asymmetry rather than faking parity, and flags phases whose fresh-context
 * isolation guarantees can't be fully met via Copilot agent handoffs.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Adapter,
  type CanonicalDoc,
  type GenContext,
  type AdapterResult,
  type GeneratedFile,
  CANONICAL_TO_COPILOT,
  translateTools,
  resolveModel,
  buildFrontmatter,
  withBanner,
} from "./shared.js";
import { replaceMarkerRegion } from "../flow-core.js";

function invocation(name: string): string {
  return name === "flow" ? "flow" : `flow-${name}`;
}

/**
 * Translate a canonical body to Copilot prompt-file conventions. Copilot prompt
 * files cannot inline-execute bash or auto-inline files, so those become explicit
 * instructions instead of silent native behavior.
 */
function translateBody(body: string): string {
  let out = body;
  // Inline bash `!`cmd`` -> explicit "run this" instruction.
  out = out.replace(/!`([^`]+)`/g, "Run `$1` and use its output.");
  // File inlining `@path` (line-leading) -> explicit reference.
  out = out.replace(/(^|\n)@([^\s]+)/g, "$1Refer to `$2`.");
  // Argument placeholders -> Copilot input variables.
  out = out.replace(/\$ARGUMENTS/g, "${input:args}");
  out = out.replace(/\$(\d+)/g, (_m, d) => `\${input:arg${d}}`);
  return out;
}

function promptFile(doc: CanonicalDoc, ctx: GenContext): GeneratedFile {
  const banner = ctx.config.generatedBanner;
  const inv = invocation(doc.name);
  // Copilot wants a comma-separated tool string (per the reference installer).
  const tools = translateTools(doc.tools, CANONICAL_TO_COPILOT).join(", ");
  const model = resolveModel(doc.frontmatter["model"], ctx.config);
  const fm = buildFrontmatter([
    ["description", doc.frontmatter["description"] ?? ""],
    ["model", model],
    ["tools", tools],
  ]);
  return {
    path: join(ctx.targetRoot, ".github", "prompts", `${inv}.prompt.md`),
    content: withBanner(banner, fm + "\n" + translateBody(doc.body)),
  };
}

function agentFile(doc: CanonicalDoc, ctx: GenContext): GeneratedFile {
  const banner = ctx.config.generatedBanner;
  const tools = translateTools(doc.tools, CANONICAL_TO_COPILOT).join(", ");
  const model = resolveModel(doc.frontmatter["model"], ctx.config);
  const fm = buildFrontmatter([
    ["name", doc.frontmatter["name"] ?? doc.name],
    ["description", doc.frontmatter["description"] ?? ""],
    ["tools", tools],
    ["model", model],
  ]);
  const handoffNote =
    "\n\n---\n_Fresh-context note: on Copilot this agent is reached via **agent " +
    "handoffs**, the nearest equivalent to a fresh-context subagent. Handoffs may " +
    "not isolate context as cleanly as a Claude subagent — keep inputs explicit._\n";
  return {
    path: join(ctx.targetRoot, ".github", "agents", `${doc.name}.agent.md`),
    content: withBanner(banner, fm + "\n" + translateBody(doc.body) + handoffNote),
  };
}

/** Marker-injected workflow summary + CONTEXT essentials into the instructions file. */
function instructionsFile(
  commands: CanonicalDoc[],
  ctx: GenContext,
): GeneratedFile {
  const path = join(ctx.targetRoot, ".github", "copilot-instructions.md");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const cmdList = commands
    .map((c) => `- \`/${invocation(c.name)}\` — ${c.frontmatter["description"] ?? ""}`)
    .join("\n");
  const body = [
    ctx.config.generatedBanner,
    "## FLOW workflow (auto-injected — read by the Copilot CLI)",
    "",
    "This project uses **FLOW** (Fresh-context Loop for Orchestrated Work): a",
    "five-phase loop — Discuss → Plan → Review → Execute → Verify → Ship — with",
    "heavy work in fresh-context agents and cost visible at every phase boundary.",
    "",
    "**Proportional paths:** `quick` (execute→verify, no review), `standard`",
    "(plan→execute→verify, single self-critique), `full` (all phases, multi-model",
    "review). Triage suggests; you may override.",
    "",
    "**Hard rule:** Ship is blocked until VERIFY records PASS. Verify is adversarial.",
    "",
    "**Conventions:** Conventional Commits, one atomic commit per task. Durable",
    "context and rules live in `.flow/CONTEXT.md`; live state in `.flow/STATE.md`.",
    "",
    "**Commands** (prompt files; see CLI note below):",
    cmdList,
    "",
    "> ⚠️ The Copilot **CLI** does not support custom prompt files / slash commands",
    "> (open feature request). In the CLI, drive FLOW using the workflow described in",
    "> THIS file — the one customization the CLI reads. Prompt files in",
    "> `.github/prompts/` work in **VS Code / JetBrains Copilot Chat**, not the CLI.",
    "",
    "> Files under `.github/prompts/` and `.github/agents/` are GENERATED — edit",
    "> `.flow-src/` and re-run `flow-gen`.",
  ].join("\n");
  return { path, content: replaceMarkerRegion(existing, "WORKFLOW", body) };
}

/** Phases whose isolation depends on a fresh-context subagent. */
const ISOLATION_SENSITIVE = ["discuss", "plan", "review", "execute", "verify"];

export const copilotAdapter: Adapter = {
  id: "copilot",
  label: "GitHub Copilot",
  generate(commands, agents, ctx): AdapterResult {
    const files: GeneratedFile[] = [];
    const notices: string[] = [];
    const warnings: string[] = [];

    for (const c of commands) files.push(promptFile(c, ctx));
    for (const a of agents) files.push(agentFile(a, ctx));
    files.push(instructionsFile(commands, ctx));

    notices.push(
      "Emitted .github/prompts/ (IDE chat), .github/agents/, and marker-injected .github/copilot-instructions.md.",
    );
    if (!ctx.config.runtimes.copilot.cliSupportsPromptFiles) {
      notices.push(
        "Copilot CLI limitation surfaced: prompt files work in VS Code/JetBrains chat only; CLI gets FLOW via copilot-instructions.md.",
      );
    }
    warnings.push(
      `Fresh-context isolation for phase(s) [${ISOLATION_SENSITIVE.join(", ")}] is expressed via Copilot agent handoffs, ` +
        "which may not isolate context as cleanly as Claude subagents. Treat isolation as best-effort on Copilot.",
    );
    return { files, notices, warnings };
  },
};
