/**
 * flow-metrics — append one JSONL record per session phase and summarize.
 *
 * Records land in `.flow/metrics/<YYYY-MM>.jsonl`, one object per line:
 *   { ts, phase, tokens, withinCap, path?, note? }
 *
 * Token counts come from Bedrock accounting surfaced via LiteLLM where available;
 * otherwise pass the usage returned in API responses with --tokens. A post-session
 * hook calls `append`; `summary` reports spend vs. rework for tuning BUDGET.md.
 *
 * Usage:
 *   flow-metrics append --phase <p> --tokens N [--within-cap true|false] [--path quick|standard|full] [--note "..."]
 *   flow-metrics summary [--month YYYY-MM]
 */

import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { flowPaths } from "./flow-core.js";

export interface MetricRecord {
  ts: string;
  phase: string;
  tokens: number;
  withinCap: boolean;
  path?: string;
  note?: string;
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function metricsFile(month: string): string {
  const { metricsDir } = flowPaths();
  mkdirSync(metricsDir, { recursive: true });
  return join(metricsDir, `${month}.jsonl`);
}

export function appendRecord(rec: MetricRecord): string {
  const file = metricsFile(monthKey(new Date(rec.ts)));
  appendFileSync(file, JSON.stringify(rec) + "\n", "utf8");
  return file;
}

export function readRecords(month: string): MetricRecord[] {
  const file = metricsFile(month);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as MetricRecord);
}

function strFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
}

function cmdAppend(args: string[]): number {
  const phase = strFlag(args, "--phase");
  const tokensRaw = strFlag(args, "--tokens");
  if (!phase || tokensRaw === undefined) {
    console.error('usage: flow-metrics append --phase <p> --tokens N [--within-cap true|false] [--path ...] [--note "..."]');
    return 1;
  }
  const tokens = parseInt(tokensRaw.replace(/[_,\s]/g, ""), 10);
  if (!Number.isFinite(tokens)) {
    console.error(`--tokens must be a number, got "${tokensRaw}"`);
    return 1;
  }
  const withinCap = (strFlag(args, "--within-cap") ?? "true").toLowerCase() !== "false";
  const rec: MetricRecord = {
    ts: new Date().toISOString(),
    phase,
    tokens,
    withinCap,
    path: strFlag(args, "--path"),
    note: strFlag(args, "--note"),
  };
  const file = appendRecord(rec);
  console.log(`[metrics] appended ${phase} ${tokens.toLocaleString("en-US")} tok (within-cap=${withinCap}) → ${file}`);
  return 0;
}

function cmdSummary(args: string[]): number {
  const month = strFlag(args, "--month") ?? monthKey();
  const recs = readRecords(month);
  if (recs.length === 0) {
    console.log(`No metrics for ${month}.`);
    return 0;
  }
  const byPhase = new Map<string, { tokens: number; n: number; overCap: number }>();
  let total = 0;
  let overCap = 0;
  for (const r of recs) {
    total += r.tokens;
    if (!r.withinCap) overCap++;
    const e = byPhase.get(r.phase) ?? { tokens: 0, n: 0, overCap: 0 };
    e.tokens += r.tokens;
    e.n += 1;
    if (!r.withinCap) e.overCap += 1;
    byPhase.set(r.phase, e);
  }

  // Rework proxy: tokens spent re-entering verify/review after a first pass.
  const verifyRuns = byPhase.get("verify")?.n ?? 0;
  const reworkSignal = verifyRuns > 1 ? `${verifyRuns} verify passes (possible rework)` : "no rework signal";

  console.log(`FLOW metrics — ${month}`);
  console.log(`  sessions/phases recorded: ${recs.length}`);
  console.log(`  total tokens:            ${total.toLocaleString("en-US")}`);
  console.log(`  over-cap occurrences:    ${overCap}`);
  console.log(`  rework:                  ${reworkSignal}`);
  console.log("  by phase:");
  for (const [phase, e] of [...byPhase.entries()].sort((a, b) => b[1].tokens - a[1].tokens)) {
    console.log(
      `    ${phase.padEnd(10)} ${e.tokens.toLocaleString("en-US").padStart(10)} tok  ${String(e.n).padStart(3)} run(s)  ${e.overCap} over-cap`,
    );
  }
  return 0;
}

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "append":
      return cmdAppend(rest);
    case "summary":
    case undefined:
      return cmdSummary(rest);
    default:
      console.error(`unknown subcommand "${cmd}". Use "append" or "summary".`);
      return 1;
  }
}

// Cross-platform direct-invocation guard (see flow-budget.ts for the Windows note).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
