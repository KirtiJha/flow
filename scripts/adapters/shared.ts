/**
 * shared — types, frontmatter parsing, tool-name translation tables, and model
 * tier resolution used by both runtime adapters and the generator.
 *
 * The single-source → per-runtime transform pattern (and the marker-injection and
 * frontmatter-flattening techniques) are borrowed as engineering from the reference
 * implementation's installer. None of its naming/branding is carried over.
 */

import { readFileSync } from "node:fs";

// --- canonical model ------------------------------------------------------

export type DocKind = "command" | "agent";

export interface CanonicalDoc {
  /** basename without extension — becomes the command/agent name. */
  name: string;
  kind: DocKind;
  frontmatter: Record<string, string>;
  body: string;
  /** Parsed canonical tool names (from `allowed-tools` or `tools`). */
  tools: string[];
}

export interface FlowConfig {
  modelTiers: Record<string, string>;
  generatedBanner: string;
  runtimes: {
    "claude-code": { enabled: boolean; commandLayout: string };
    copilot: { enabled: boolean; cliSupportsPromptFiles: boolean };
  };
}

export interface GenContext {
  root: string;
  config: FlowConfig;
  /** When true, Claude commands go to `.claude/commands/` instead of Skills. */
  legacyCommands: boolean;
}

export interface GeneratedFile {
  path: string; // absolute
  content: string;
}

export interface AdapterResult {
  files: GeneratedFile[];
  notices: string[];
  warnings: string[];
}

export interface Adapter {
  id: string;
  label: string;
  generate(
    commands: CanonicalDoc[],
    agents: CanonicalDoc[],
    ctx: GenContext,
  ): AdapterResult;
}

// --- frontmatter parsing --------------------------------------------------

/** Split a markdown doc into its YAML-ish frontmatter map and body. */
export function parseDoc(name: string, kind: DocKind, raw: string): CanonicalDoc {
  const fm: Record<string, string> = {};
  let body = raw;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (m) {
    body = m[2];
    for (const line of m[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      val = stripQuotes(val);
      if (key) fm[key] = val;
    }
  }
  const toolField = fm["allowed-tools"] ?? fm["tools"] ?? "";
  const tools = toolField
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return { name, kind, frontmatter: fm, body: body.replace(/^\n+/, ""), tools };
}

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

// --- tool-name translation tables ----------------------------------------
//
// Canonical FLOW tool names on the left. These tables mirror the proven
// mappings used by the reference implementation's installer.

export const CANONICAL_TO_CLAUDE: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  bash: "Bash",
  grep: "Grep",
  glob: "Glob",
  "web-search": "WebSearch",
  "web-fetch": "WebFetch",
  task: "Task",
  todo: "TodoWrite",
  "ask-user": "AskUserQuestion",
};

export const CANONICAL_TO_COPILOT: Record<string, string> = {
  read: "read",
  write: "edit",
  edit: "edit",
  bash: "execute",
  grep: "search",
  glob: "search",
  "web-search": "web",
  "web-fetch": "web",
  task: "agent",
  todo: "todo",
  "ask-user": "ask_user",
};

/** Translate + de-duplicate a canonical tool list for a target runtime. */
export function translateTools(
  tools: string[],
  table: Record<string, string>,
): string[] {
  const out: string[] = [];
  for (const t of tools) {
    const mapped = table[t];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

// --- model tier resolution ------------------------------------------------

/**
 * Resolve a tier (low/mid/high) — or `inherit` — to the LiteLLM model_list name
 * configured in flow.config.json. Never returns a hard-coded Anthropic ID.
 */
export function resolveModel(tier: string | undefined, cfg: FlowConfig): string {
  if (!tier || tier === "inherit") return "inherit";
  const t = tier.toLowerCase();
  const resolved = cfg.modelTiers[t];
  if (!resolved) {
    throw new Error(
      `Unknown model tier "${tier}". Expected one of: ${Object.keys(cfg.modelTiers).join(", ")} (define it in flow.config.json modelTiers).`,
    );
  }
  return resolved;
}

// --- helpers --------------------------------------------------------------

export function loadConfig(path: string): FlowConfig {
  return JSON.parse(readFileSync(path, "utf8")) as FlowConfig;
}

/** Build a YAML frontmatter block from ordered key/value pairs. */
export function buildFrontmatter(pairs: [string, string][]): string {
  const lines = pairs
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${needsQuote(v) ? JSON.stringify(v) : v}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

function needsQuote(v: string): boolean {
  // Quote values that could be misread as YAML flow syntax or contain colons.
  return /[:#\[\]{}"']/.test(v) || /^\s|\s$/.test(v);
}

/** Prefix a generated file with the canonical banner. */
export function withBanner(banner: string, content: string): string {
  return `${banner}\n${content}`;
}
