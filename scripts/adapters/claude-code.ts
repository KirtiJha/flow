/**
 * adapters/claude-code — emit the Claude Code layout from canonical .flow-src/.
 *
 * Commands  -> .claude/skills/<name>/SKILL.md   (default; same /<name> + autonomous)
 *           -> .claude/commands/<name>.md        (when --legacy-commands)
 * Agents    -> .claude/agents/<name>.md
 * Context   -> reference .flow/CONTEXT.md from CLAUDE.md (marker-injected)
 *
 * Tool tier -> resolved to LiteLLM model_list names, never hard-coded IDs.
 * Spawn     -> native Claude subagent invocation (lives here, never in bodies).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Adapter,
  type CanonicalDoc,
  type GenContext,
  type AdapterResult,
  type GeneratedFile,
  CANONICAL_TO_CLAUDE,
  translateTools,
  resolveModel,
  buildFrontmatter,
  withBanner,
} from "./shared.js";
import { replaceMarkerRegion } from "../flow-core.js";

/** `flow` stays bare; every other command is namespaced `flow-<name>`. */
function invocation(name: string): string {
  return name === "flow" ? "flow" : `flow-${name}`;
}

function commandFile(doc: CanonicalDoc, ctx: GenContext): GeneratedFile {
  const banner = ctx.config.generatedBanner;
  const inv = invocation(doc.name);
  const tools = translateTools(doc.tools, CANONICAL_TO_CLAUDE).join(", ");
  const model = resolveModel(doc.frontmatter["model"], ctx.config);

  if (ctx.legacyCommands) {
    // .claude/commands/<name>.md — filename is the command name.
    const fm = buildFrontmatter([
      ["description", doc.frontmatter["description"] ?? ""],
      ["allowed-tools", tools],
      ["model", model],
      ["argument-hint", doc.frontmatter["argument-hint"] ?? ""],
    ]);
    return {
      path: join(ctx.root, ".claude", "commands", `${inv}.md`),
      content: withBanner(banner, fm + "\n" + doc.body),
    };
  }

  // Skills layout (default): .claude/skills/<name>/SKILL.md
  const fm = buildFrontmatter([
    ["name", inv],
    ["description", doc.frontmatter["description"] ?? ""],
    ["allowed-tools", tools],
    ["model", model],
    ["argument-hint", doc.frontmatter["argument-hint"] ?? ""],
  ]);
  return {
    path: join(ctx.root, ".claude", "skills", inv, "SKILL.md"),
    content: withBanner(banner, fm + "\n" + doc.body),
  };
}

function agentFile(doc: CanonicalDoc, ctx: GenContext): GeneratedFile {
  const banner = ctx.config.generatedBanner;
  const tools = translateTools(doc.tools, CANONICAL_TO_CLAUDE).join(", ");
  const model = resolveModel(doc.frontmatter["model"], ctx.config);
  const fm = buildFrontmatter([
    ["name", doc.frontmatter["name"] ?? doc.name],
    ["description", doc.frontmatter["description"] ?? ""],
    ["tools", tools],
    ["model", model],
  ]);
  return {
    path: join(ctx.root, ".claude", "agents", `${doc.name}.md`),
    content: withBanner(banner, fm + "\n" + doc.body),
  };
}

/** Inject a FLOW block into CLAUDE.md that references .flow/CONTEXT.md. */
function claudeMd(commands: CanonicalDoc[], ctx: GenContext): GeneratedFile {
  const path = join(ctx.root, "CLAUDE.md");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const list = commands
    .map((c) => `- \`/${invocation(c.name)}\` — ${c.frontmatter["description"] ?? ""}`)
    .join("\n");
  const body = [
    ctx.config.generatedBanner,
    "## FLOW",
    "",
    "This project uses **FLOW** (Fresh-context Loop for Orchestrated Work).",
    "Durable context lives in `.flow/CONTEXT.md` — read it for architecture, stack,",
    "and non-negotiable conventions. Live state is in `.flow/STATE.md`; budgets in",
    "`.flow/BUDGET.md`.",
    "",
    "@.flow/CONTEXT.md",
    "",
    "### Commands",
    list,
    "",
    "> Heavy work runs in fresh-context subagents. Ship is blocked until VERIFY passes.",
    "> Runtime files under `.claude/` are GENERATED — edit `.flow-src/` and re-run `flow-gen`.",
  ].join("\n");
  return { path, content: replaceMarkerRegion(existing, "CLAUDE", body) };
}

export const claudeCodeAdapter: Adapter = {
  id: "claude-code",
  label: "Claude Code",
  generate(commands, agents, ctx): AdapterResult {
    const files: GeneratedFile[] = [];
    const notices: string[] = [];
    const warnings: string[] = [];

    for (const c of commands) files.push(commandFile(c, ctx));
    for (const a of agents) files.push(agentFile(a, ctx));
    files.push(claudeMd(commands, ctx));

    notices.push(
      ctx.legacyCommands
        ? "Emitted legacy commands to .claude/commands/ (--legacy-commands)."
        : "Emitted Skills layout to .claude/skills/<name>/SKILL.md (default).",
    );
    notices.push("Claude Code is the full-fidelity target: native subagents isolate context per phase.");
    return { files, notices, warnings };
  },
};
