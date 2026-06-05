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
import { dirname, join, resolve } from "node:path";

const PHASE_RE = /flow-(discuss|plan|review|execute|verify|ship)/i;

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function findRoot(start) {
  let cur = resolve(start);
  for (;;) {
    if (existsSync(join(cur, "flow.config.json"))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
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

const input = JSON.parse(readStdin() || "{}");
const ti = input.tool_input ?? {};
const name = String(ti.skill ?? ti.command ?? ti.name ?? input.prompt ?? "");
const m = name.match(PHASE_RE);
if (!m) process.exit(0); // not a phase boundary — nothing to gate

const phase = m[1].toLowerCase();
const root = findRoot(input.cwd ?? process.cwd());
if (!root) process.exit(0);

const { node, args } = resolveFlowScript(root, "flow-budget");
const res = spawnSync(node, [...args, "check", phase], {
  cwd: root,
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
