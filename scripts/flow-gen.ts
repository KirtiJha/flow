/**
 * flow-gen — generate per-runtime layouts from the single canonical source.
 *
 * Reads `.flow-src/commands/*.md` and `.flow-src/agents/*.md`, parses each once,
 * then hands the parsed docs to each runtime adapter (claude-code, copilot). Every
 * generated file carries the GENERATED banner; shared files (CLAUDE.md,
 * copilot-instructions.md) are updated via marker injection so non-FLOW content is
 * never disturbed.
 *
 * Usage:
 *   flow-gen [--legacy-commands] [--only claude-code|copilot] [--check] [--root DIR]
 *
 *   --legacy-commands  emit .claude/commands/ instead of the Skills layout
 *   --only <id>        generate just one runtime
 *   --check            do not write; report what WOULD change (round-trip check)
 *   --root <dir>       project root (default: nearest dir containing flow.config.json)
 */

import {
  readdirSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  parseDoc,
  loadConfig,
  type Adapter,
  type CanonicalDoc,
  type GenContext,
  type GeneratedFile,
} from "./adapters/shared.js";
import { claudeCodeAdapter } from "./adapters/claude-code.js";
import { copilotAdapter } from "./adapters/copilot.js";

const ADAPTERS: Adapter[] = [claudeCodeAdapter, copilotAdapter];

function findRoot(start: string): string {
  let cur = resolve(start);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(join(cur, "flow.config.json"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) {
      throw new Error(
        "Could not find flow.config.json walking up from " + resolve(start) + ". Use --root.",
      );
    }
    cur = parent;
  }
}

function loadDocs(dir: string, kind: "command" | "agent"): CanonicalDoc[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseDoc(f.replace(/\.md$/, ""), kind, readFileSync(join(dir, f), "utf8")));
}

function strFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
}

function main(argv: string[]): number {
  const legacyCommands = argv.includes("--legacy-commands");
  const check = argv.includes("--check");
  const only = strFlag(argv, "--only");
  const root = findRoot(strFlag(argv, "--root") ?? process.cwd());

  const config = loadConfig(join(root, "flow.config.json"));
  const commands = loadDocs(join(root, ".flow-src", "commands"), "command");
  const agents = loadDocs(join(root, ".flow-src", "agents"), "agent");

  if (commands.length === 0 && agents.length === 0) {
    console.error("No canonical docs found under .flow-src/. Nothing to generate.");
    return 1;
  }

  const ctx: GenContext = { root, config, legacyCommands };
  const selected = ADAPTERS.filter((a) => !only || a.id === only);
  if (selected.length === 0) {
    console.error(`--only "${only}" matched no adapter. Known: ${ADAPTERS.map((a) => a.id).join(", ")}.`);
    return 1;
  }

  console.log(`flow-gen — root ${root}`);
  console.log(`  ${commands.length} command(s), ${agents.length} agent(s); layout: ${legacyCommands ? "legacy-commands" : "skills"}${check ? "; CHECK (dry-run)" : ""}`);

  let changed = 0;
  let total = 0;
  const allWarnings: string[] = [];

  for (const adapter of selected) {
    if (adapter.id === "claude-code" && !config.runtimes["claude-code"].enabled) continue;
    if (adapter.id === "copilot" && !config.runtimes.copilot.enabled) continue;

    const result = adapter.generate(commands, agents, ctx);
    console.log(`\n[${adapter.label}]`);
    for (const f of result.files) {
      total++;
      const status = writeFile(f, check);
      if (status !== "unchanged") changed++;
      console.log(`  ${status.padEnd(9)} ${relativize(root, f.path)}`);
    }
    for (const n of result.notices) console.log(`  • ${n}`);
    for (const w of result.warnings) {
      allWarnings.push(`[${adapter.label}] ${w}`);
    }
  }

  if (allWarnings.length) {
    console.log("\nWarnings (isolation / parity):");
    for (const w of allWarnings) console.log(`  ⚠️  ${w}`);
  }

  console.log(
    `\n${check ? "Would change" : "Wrote"} ${changed}/${total} file(s). ` +
      "Generated files are not source — edit .flow-src/ and re-run flow-gen.",
  );

  // In --check mode, a non-zero exit signals drift (useful in CI).
  return check && changed > 0 ? 3 : 0;
}

type WriteStatus = "created" | "changed" | "unchanged";

function writeFile(f: GeneratedFile, check: boolean): WriteStatus {
  const exists = existsSync(f.path);
  const current = exists ? readFileSync(f.path, "utf8") : null;
  const status: WriteStatus = !exists ? "created" : current === f.content ? "unchanged" : "changed";
  if (!check && status !== "unchanged") {
    mkdirSync(dirname(f.path), { recursive: true });
    writeFileSync(f.path, f.content, "utf8");
  }
  return status;
}

function relativize(root: string, p: string): string {
  return p.startsWith(root) ? p.slice(root.length + 1) : p;
}

process.exit(main(process.argv.slice(2)));
