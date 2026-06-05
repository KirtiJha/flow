#!/usr/bin/env node
/**
 * FLOW installer — `npx flow [flags]`.
 *
 * Generates FLOW's runtime layout into a target project (or `~` for global),
 * scaffolds `.flow/` state from templates, and merges FLOW's three governance
 * hooks into `.claude/settings.json`. Re-running is idempotent: generated files
 * are overwritten, user state under `.flow/` is never clobbered, and hooks are
 * de-duped. `--uninstall` removes FLOW-managed files and hook entries while
 * preserving `.flow/` entirely.
 *
 * Plain ESM JavaScript — no compile step. Node builtins only.
 *
 * Flags:
 *   --claude            install the Claude Code layout (default)
 *   --copilot           install the GitHub Copilot layout
 *   --all               install both runtimes
 *   --global, -g        target the user home dir (~/.claude, ~/.flow, …)
 *   --local, -l         target the current working directory (default)
 *   --uninstall, -u     remove FLOW-managed files + hooks (keeps .flow/)
 *   --help, -h          show usage
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOOK_DEFS = [
  {
    event: "PreToolUse",
    matcher: "Skill|SlashCommand",
    file: "pre-phase-budget.mjs",
  },
  { event: "PostToolUse", matcher: "Bash", file: "atomic-commit.mjs" },
  { event: "Stop", matcher: undefined, file: "post-session-metrics.mjs" },
];

const STATE_TEMPLATES = ["STATE.md", "CONTEXT.md", "BUDGET.md"];

const FLOW_AGENTS = [
  "researcher",
  "planner",
  "executor",
  "reviewer",
  "verifier",
];

// --- arg parsing ----------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    claude: false,
    copilot: false,
    all: false,
    global: false,
    uninstall: false,
    help: false,
  };
  for (const a of argv) {
    switch (a) {
      case "--claude":
        flags.claude = true;
        break;
      case "--copilot":
        flags.copilot = true;
        break;
      case "--all":
        flags.all = true;
        break;
      case "--global":
      case "-g":
        flags.global = true;
        break;
      case "--local":
      case "-l":
        flags.global = false;
        break;
      case "--uninstall":
      case "-u":
        flags.uninstall = true;
        break;
      case "--help":
      case "-h":
        flags.help = true;
        break;
      default:
        // Unknown flag: ignore but note. Keeps the installer forgiving.
        if (a.startsWith("-")) console.warn(`Ignoring unknown flag: ${a}`);
    }
  }
  return flags;
}

/** Map runtime flags to the `only` value runGen / uninstall expects. */
function resolveOnly(flags) {
  if (flags.all) return undefined; // both
  if (flags.copilot && !flags.claude) return "copilot";
  if (flags.claude && !flags.copilot) return "claude-code";
  if (flags.claude && flags.copilot) return undefined; // both
  return "claude-code"; // default
}

// --- path resolution ------------------------------------------------------

/** Package root = the dir containing dist/, .flow-src/, hooks/, flow.config.json. */
function resolvePackageRoot() {
  // bin/install.js -> packageRoot is the parent of bin/.
  const here = dirname(fileURLToPath(import.meta.url));
  return dirname(here);
}

function resolveTargetRoot(flags) {
  return flags.global ? os.homedir() : process.cwd();
}

// --- hook merge -----------------------------------------------------------

/** Build the absolute, quoted, forward-slashed hook command for a hook file. */
function hookCommand(packageRoot, file) {
  const hookPath = join(packageRoot, "hooks", file).replace(/\\/g, "/");
  return `"${process.execPath}" "${hookPath}"`;
}

/**
 * Merge FLOW's three hooks into a settings object (de-duped by matcher+command).
 * Mutates and returns `settings`. Non-FLOW hooks are preserved untouched.
 */
export function mergeHooks(settings, packageRoot) {
  if (!settings || typeof settings !== "object") settings = {};
  if (!settings.hooks || typeof settings.hooks !== "object") settings.hooks = {};
  const hooks = settings.hooks;

  for (const def of HOOK_DEFS) {
    const cmd = hookCommand(packageRoot, def.file);
    if (!Array.isArray(hooks[def.event])) hooks[def.event] = [];
    const arr = hooks[def.event];

    // De-dupe: skip if an entry with the same matcher already contains this cmd.
    const already = arr.some((entry) => {
      const matcherMatches = (entry && entry.matcher) === def.matcher;
      const cmds = Array.isArray(entry && entry.hooks)
        ? entry.hooks.map((h) => h && h.command)
        : [];
      return matcherMatches && cmds.includes(cmd);
    });
    if (already) continue;

    const entry = { hooks: [{ type: "command", command: cmd }] };
    if (def.matcher !== undefined) entry.matcher = def.matcher;
    // Put matcher first for readability when present.
    const ordered = def.matcher !== undefined
      ? { matcher: def.matcher, hooks: entry.hooks }
      : entry;
    arr.push(ordered);
  }
  return settings;
}

/** Remove FLOW's three hook entries (matched by hook-file basename in command). */
export function removeHooks(settings) {
  if (!settings || !settings.hooks) return { settings, removed: 0 };
  const files = HOOK_DEFS.map((d) => `hooks/${d.file}`);
  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    const arr = settings.hooks[event];
    if (!Array.isArray(arr)) continue;
    const kept = arr.filter((entry) => {
      const cmds = Array.isArray(entry && entry.hooks)
        ? entry.hooks.map((h) => (h && h.command) || "")
        : [];
      const isFlow = cmds.some((c) => files.some((f) => c.includes(f)));
      if (isFlow) removed++;
      return !isFlow;
    });
    if (kept.length === 0) delete settings.hooks[event];
    else settings.hooks[event] = kept;
  }
  return { settings, removed };
}

function readJsonTolerant(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.warn(`Could not parse ${path} as JSON; starting from {}.`);
    return {};
  }
}

// --- install --------------------------------------------------------------

export async function runInstall(flags) {
  const packageRoot = resolvePackageRoot();
  const targetRoot = resolveTargetRoot(flags);
  const only = resolveOnly(flags);

  const created = [];

  // 1. Generate the runtime layout into the target via the compiled generator.
  const genUrl = pathToFileURL(
    join(packageRoot, "dist", "scripts", "flow-gen.js"),
  ).href;
  const { runGen } = await import(genUrl);
  const code = runGen({
    source: packageRoot,
    target: targetRoot,
    only,
    invocationMode: "install",
    installDir: packageRoot,
  });
  if (code !== 0) {
    throw new Error(`flow-gen exited with code ${code}.`);
  }

  // 2. Scaffold .flow/ state from templates — never overwrite existing state.
  const flowDir = join(targetRoot, ".flow");
  mkdirSync(flowDir, { recursive: true });
  for (const name of STATE_TEMPLATES) {
    const dest = join(flowDir, name);
    if (existsSync(dest)) continue;
    const src = join(packageRoot, ".flow-src", "templates", name);
    if (!existsSync(src)) continue;
    copyFileSync(src, dest);
    created.push(dest);
  }
  const metricsDir = join(flowDir, "metrics");
  mkdirSync(metricsDir, { recursive: true });
  const gitkeep = join(metricsDir, ".gitkeep");
  if (!existsSync(gitkeep)) {
    writeFileSync(gitkeep, "");
    created.push(gitkeep);
  }

  // 3. Merge hooks into <target>/.claude/settings.json (Claude runtime only).
  let hookSummary = "skipped (copilot-only install)";
  const wantsClaude = only === "claude-code" || only === undefined;
  if (wantsClaude) {
    const claudeDir = join(targetRoot, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    const settingsPath = join(claudeDir, "settings.json");
    const settings = readJsonTolerant(settingsPath);
    mergeHooks(settings, packageRoot);
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    hookSummary = `merged 3 hooks into ${settingsPath}`;
  }

  // 4. Summary.
  console.log("\nFLOW installed.");
  console.log(`  package:  ${packageRoot}`);
  console.log(`  target:   ${targetRoot} (${flags.global ? "global" : "local"})`);
  console.log(
    `  runtime:  ${only ?? "claude-code + copilot"} (generated runtime layout)`,
  );
  console.log(`  state:    .flow/ scaffolded (existing files preserved)`);
  console.log(`  hooks:    ${hookSummary}`);
  console.log("\nnext: open Claude Code in this project and run /flow");

  return { packageRoot, targetRoot, created };
}

// --- uninstall ------------------------------------------------------------

/** Remove a path (file or dir) if it exists; record it. */
function removePath(p, removed) {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    removed.push(p);
  }
}

/** Remove dirs/files under `dir` whose basename matches `predicate`. */
function removeMatching(dir, predicate, removed) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (predicate(name)) removePath(join(dir, name), removed);
  }
}

/** Strip a FLOW marker region (and the markers) from a file in place. */
function stripMarkerRegion(path, marker, stripped) {
  if (!existsSync(path)) return;
  const src = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const re = new RegExp(
    `\\n?<!-- FLOW:${marker}:START -->[\\s\\S]*?<!-- FLOW:${marker}:END -->\\n?`,
    "g",
  );
  if (!re.test(src)) return;
  const out = src.replace(re, "\n").replace(/^\n+/, "");
  writeFileSync(path, out);
  stripped.push(`${path} (FLOW:${marker} region)`);
}

export function runUninstall(flags) {
  const targetRoot = resolveTargetRoot(flags);
  const removed = [];

  // Claude-managed generated files.
  const claudeDir = join(targetRoot, ".claude");
  removeMatching(
    join(claudeDir, "skills"),
    (n) => n === "flow" || n.startsWith("flow-"),
    removed,
  );
  for (const a of FLOW_AGENTS) {
    removePath(join(claudeDir, "agents", `${a}.md`), removed);
  }
  // Legacy .claude/commands/flow*.md, if a legacy layout was ever installed.
  removeMatching(
    join(claudeDir, "commands"),
    (n) => (n === "flow.md" || n.startsWith("flow-")) && n.endsWith(".md"),
    removed,
  );

  // Copilot-managed generated files.
  const githubDir = join(targetRoot, ".github");
  removeMatching(
    join(githubDir, "prompts"),
    (n) => n.startsWith("flow") && n.endsWith(".prompt.md"),
    removed,
  );
  for (const a of FLOW_AGENTS) {
    removePath(join(githubDir, "agents", `${a}.agent.md`), removed);
  }

  // Strip marker regions from shared instruction files.
  const stripped = [];
  stripMarkerRegion(join(targetRoot, "CLAUDE.md"), "CLAUDE", stripped);
  stripMarkerRegion(
    join(githubDir, "copilot-instructions.md"),
    "WORKFLOW",
    stripped,
  );

  // Remove FLOW hook entries from settings.json, preserving others.
  const settingsPath = join(claudeDir, "settings.json");
  let hookSummary = "no settings.json";
  if (existsSync(settingsPath)) {
    const settings = readJsonTolerant(settingsPath);
    const { removed: nHooks } = removeHooks(settings);
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    hookSummary = `removed ${nHooks} FLOW hook entr${nHooks === 1 ? "y" : "ies"}`;
  }

  console.log("\nFLOW uninstalled.");
  console.log(`  target:   ${targetRoot} (${flags.global ? "global" : "local"})`);
  console.log(`  removed:  ${removed.length} generated path(s)`);
  for (const p of removed) console.log(`              - ${p}`);
  for (const s of stripped) console.log(`  stripped: ${s}`);
  console.log(`  hooks:    ${hookSummary}`);
  console.log(`  state:    .flow/ PRESERVED (STATE/CONTEXT/BUDGET/metrics intact)`);

  return { targetRoot, removed, stripped };
}

// --- help -----------------------------------------------------------------

function printHelp() {
  console.log(
    [
      "flow — install FLOW (Fresh-context Loop for Orchestrated Work)",
      "",
      "Usage: npx flow [options]",
      "",
      "Runtime:",
      "  --claude         install the Claude Code layout (default)",
      "  --copilot        install the GitHub Copilot layout",
      "  --all            install both runtimes",
      "",
      "Scope:",
      "  --local, -l      target the current directory (default)",
      "  --global, -g     target your home directory (~)",
      "",
      "Other:",
      "  --uninstall, -u  remove FLOW files + hooks (keeps .flow/ state)",
      "  --help, -h       show this help",
      "",
      "Examples:",
      "  npx flow --claude            # install into ./ for Claude Code",
      "  npx flow --all --global      # install both runtimes into ~",
      "  npx flow --uninstall         # remove FLOW, keep .flow/ state",
    ].join("\n"),
  );
}

// --- main -----------------------------------------------------------------

async function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    printHelp();
    return 0;
  }
  try {
    if (flags.uninstall) runUninstall(flags);
    else await runInstall(flags);
    return 0;
  } catch (err) {
    console.error(`\nFLOW install failed: ${err && err.message ? err.message : err}`);
    return 1;
  }
}

// Only auto-run when invoked directly (not when imported for testing).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
