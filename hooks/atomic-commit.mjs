#!/usr/bin/env node
/**
 * FLOW atomic-commit enforcement (Claude Code PostToolUse hook on Bash).
 *
 * FLOW's contract is "one atomic commit per task" in Conventional Commits format.
 * After a `git commit` runs, this hook inspects HEAD and BLOCKS (exit 2) if the
 * message is not Conventional Commits, nudging the agent to fix the commit before
 * proceeding. Non-commit Bash calls pass through untouched.
 *
 * Plain Node ESM, no build step.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONVENTIONAL =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: .+/;

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let input = {};
try {
  input = JSON.parse(readStdin().trim() || "{}");
} catch {
  process.exit(0); // non-JSON stdin: nothing to check
}
const cmd = String(input.tool_input?.command ?? "");
// Only react to commands that actually create a commit.
if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);

const cwd = input.cwd ?? process.cwd();
const head = spawnSync("git", ["log", "-1", "--pretty=%s"], { cwd, encoding: "utf8" });
if (head.status !== 0) process.exit(0); // no commits / not a repo — nothing to check

const subject = (head.stdout ?? "").trim();
if (!CONVENTIONAL.test(subject)) {
  process.stderr.write(
    `[FLOW atomic-commit] Last commit subject is not Conventional Commits:\n  "${subject}"\n` +
      "Use e.g. `feat(scope): summary`. One atomic commit per task. Amend it before continuing.\n",
  );
  process.exit(2);
}
process.exit(0);
