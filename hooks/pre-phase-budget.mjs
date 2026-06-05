#!/usr/bin/env node
/**
 * FLOW pre-phase budget gate (Claude Code PreToolUse hook).
 *
 * Fires before a FLOW phase command/skill runs. Infers the phase from the
 * invocation name (e.g. `flow-plan` -> `plan`), calls `flow-budget check <phase>`,
 * and BLOCKS (exit 2) when the hard cap is exceeded — the deterministic governance
 * gate that matters precisely because FLOW avoids unbounded native fan-out.
 *
 * Plain Node ESM (no build step) for robust execution in minimal-PATH hook
 * environments. Wire via .claude/settings.json (see hooks/settings.example.json).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE_RE = /flow-(discuss|plan|review|execute|verify|ship)/i;

/** FLOW package/repo root = parent of this hook's own `hooks/` dir. */
const SELF_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/**
 * Resolve how to invoke a FLOW helper script. Prefer the compiled
 * `dist/scripts/<name>.js` (shipped to end users — no tsx needed); fall back to
 * the `--import tsx scripts/<name>.ts` dev form only in the source repo.
 * Returns { node, args } where args are the leading args before script params.
 */
function resolveFlowScript(root, name) {
  const compiled = join(root, "dist", "scripts", name + ".js");
  if (existsSync(compiled)) return { node: process.execPath, args: [compiled] };
  return {
    node: process.execPath,
    args: ["--import", "tsx", join(root, "scripts", name + ".ts")],
  };
}

let input = {};
try {
  input = JSON.parse(readStdin().trim() || "{}");
} catch {
  process.exit(0); // non-JSON stdin: nothing to gate
}
const ti = input.tool_input ?? {};
const name = String(ti.skill ?? ti.command ?? ti.name ?? input.prompt ?? "");
const m = name.match(PHASE_RE);
if (!m) process.exit(0); // not a phase boundary — nothing to gate

const phase = m[1].toLowerCase();
// Resolve the helper script from the package (this hook's location); run it in the
// PROJECT (input.cwd) so flow-budget locates that project's .flow/ state. When the
// installed package and the target project differ, these are two different dirs.
const projectDir = input.cwd ?? process.cwd();
const { node, args } = resolveFlowScript(SELF_ROOT, "flow-budget");
const res = spawnSync(node, [...args, "check", phase], {
  cwd: projectDir,
  encoding: "utf8",
});

const out = (res.stdout ?? "") + (res.stderr ?? "");
if (res.status === 2) {
  // Block the phase: exit 2 surfaces stderr to the model in Claude Code.
  process.stderr.write(`[FLOW budget gate] ${out.trim()}\n`);
  process.exit(2);
}
if (out.trim()) process.stdout.write(out.trim() + "\n");
process.exit(0);
