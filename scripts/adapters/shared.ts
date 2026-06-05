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
  /** Where canonical docs/config/banner are read from. */
  sourceRoot: string;
  /** Where generated runtime files are written. */
  targetRoot: string;
  config: FlowConfig;
  /** When true, Claude commands go to `.claude/commands/` instead of Skills. */
  legacyCommands: boolean;
  /**
   * "dev" (default): generated command bodies keep their repo-relative
   * invocations (`npm run …`, `node --import tsx scripts/…`) which only resolve
   * inside this repo. "install": rewrite those invocations to the installed
   * package's compiled scripts by absolute path (see `installDir`).
   */
  invocationMode: "dev" | "install";
  /**
   * Absolute path to the installed package root (the dir containing `dist/`).
   * Required when `invocationMode === "install"`; the rewrite targets
   * `<installDir>/dist/scripts/<x>.js`.
   */
  installDir?: string;
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
export function parseDoc(name: string, kind: DocKind, rawInput: string): CanonicalDoc {
  // Normalize line endings up front: source authored on Windows arrives as CRLF
  // (and Git autocrlf rewrites it), which would otherwise defeat the LF-anchored
  // frontmatter regex below and silently drop every frontmatter field.
  const raw = rawInput.replace(/\r\n/g, "\n");
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

// --- install-mode invocation rewrite -------------------------------------
//
// Canonical command bodies reference the dev repo's invocations
// (`npm run budget -- …`, `node --import tsx scripts/flow-budget.ts …`). Those
// only resolve inside this repository. When generating into a user's installed
// project we rewrite them to call the package's compiled scripts by absolute
// path so they work regardless of the user's cwd or toolchain.

/**
 * Rewrite the known cost-script invocations in a generated command body to the
 * installed package's compiled scripts under `<installDir>/dist/scripts`.
 *
 * Replaces both the `npm run <x> --` forms and the
 * `node --import tsx scripts/<x>.ts` forms with `node "<DIST>/<x>.js"`, leaving
 * any trailing arguments intact. The dist path is normalized to forward slashes
 * (Node accepts `/` on Windows) so the embedded command is shell-safe.
 */
export function rewriteInvocations(body: string, installDir: string): string {
  const dist = `${installDir.replace(/\\/g, "/").replace(/\/+$/, "")}/dist/scripts`;
  let out = body.replace(/\r\n/g, "\n");
  for (const name of ["budget", "metrics", "compress"]) {
    const target = `node "${dist}/flow-${name}.js"`;
    // `npm run <name> --` → installed compiled script.
    out = out.replaceAll(`npm run ${name} --`, target);
    // `node --import tsx scripts/flow-<name>.ts` → installed compiled script.
    out = out.replaceAll(`node --import tsx scripts/flow-${name}.ts`, target);
  }
  return out;
}
