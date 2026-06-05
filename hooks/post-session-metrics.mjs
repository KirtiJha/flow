#!/usr/bin/env node
/**
 * FLOW post-session metrics append (Claude Code Stop / SessionEnd hook).
 *
 * Appends one JSONL record per session by calling `flow-metrics append`. Token
 * counts come from Bedrock accounting surfaced via LiteLLM where available; pass
 * them through env (FLOW_SESSION_TOKENS / FLOW_SESSION_PHASE), otherwise the
 * session is recorded with 0 and flagged so it can be reconciled later.
 *
 * Plain Node ESM, no build step.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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

const input = JSON.parse(readStdin() || "{}");
const root = findRoot(input.cwd ?? process.cwd());
if (!root) process.exit(0);

const tokens = process.env.FLOW_SESSION_TOKENS ?? "0";
const phase = process.env.FLOW_SESSION_PHASE ?? "session";
const note =
  tokens === "0"
    ? "no token count surfaced (reconcile from LiteLLM/Bedrock accounting)"
    : "from session usage";

const res = spawnSync(
  "node",
  [
    "--import",
    "tsx",
    join(root, "scripts", "flow-metrics.ts"),
    "append",
    "--phase",
    phase,
    "--tokens",
    tokens,
    "--note",
    note,
  ],
  { cwd: root, encoding: "utf8" },
);
if ((res.stdout ?? "").trim()) process.stdout.write(res.stdout.trim() + "\n");
process.exit(0);
