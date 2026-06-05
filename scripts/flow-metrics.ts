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
import { flowPaths, readState, parseCaps, capFor } from "./flow-core.js";

export interface MetricRecord {
  ts: string;
  phase: string;
  tokens: number;
  withinCap: boolean;
  path?: string;
  note?: string;
  /** Milestone/phase-slug this record belongs to (e.g. "cli"); enables per-milestone rework detection. */
  milestone?: string;
}

/**
 * Rework signal: re-entering verify for the SAME milestone (a second verify pass
 * after a first) is the real rework marker. Counting verify runs globally would
 * false-positive across distinct milestones (each verified once), so only records
 * that carry a `milestone` count — and only a milestone verified more than once
 * trips the signal. Untagged records never raise a false alarm.
 */
export function detectRework(recs: MetricRecord[]): string {
  const verifyByMilestone = new Map<string, number>();
  for (const r of recs) {
    if (r.phase !== "verify" || !r.milestone) continue;
    verifyByMilestone.set(r.milestone, (verifyByMilestone.get(r.milestone) ?? 0) + 1);
  }
  const reworked = [...verifyByMilestone.entries()].filter(([, n]) => n > 1);
  if (reworked.length === 0) return "no rework signal";
  return reworked.map(([m, n]) => `${m} re-verified ${n}×`).join(", ") + " (possible rework)";
}

/** Nearest-rank percentile of a numeric sample (p in [0,1]). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

const roundTo5k = (n: number) => Math.ceil(n / 5000) * 5000;

export interface CapSuggestion {
  phase: string;
  n: number;
  p50: number;
  p95: number;
  soft: number; // suggested
  hard: number; // suggested
}

/**
 * Data-driven cap suggestions from recorded spend: soft ≈ p50×1.25, hard ≈ p95×1.5,
 * rounded up to 5k and floored. Only phases with ≥3 real (non-`session`) records are
 * suggested — small samples are noise. Advisory only; the user edits BUDGET.md.
 */
export function suggestCaps(recs: MetricRecord[], minSamples = 3): CapSuggestion[] {
  const byPhase = new Map<string, number[]>();
  for (const r of recs) {
    if (r.phase === "session") continue; // session rows are markers, not phase spend
    (byPhase.get(r.phase) ?? byPhase.set(r.phase, []).get(r.phase)!).push(r.tokens);
  }
  const out: CapSuggestion[] = [];
  for (const [phase, tokens] of byPhase) {
    if (tokens.length < minSamples) continue;
    const p50 = percentile(tokens, 0.5);
    const p95 = percentile(tokens, 0.95);
    const soft = Math.max(10000, roundTo5k(p50 * 1.25));
    const hard = Math.max(soft + 5000, 20000, roundTo5k(p95 * 1.5));
    out.push({ phase, n: tokens.length, p50, p95, soft, hard });
  }
  return out.sort((a, b) => b.p95 - a.p95);
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
    console.error('usage: flow-metrics append --phase <p> --tokens N [--within-cap true|false] [--milestone <slug>] [--path ...] [--note "..."]');
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
    milestone: strFlag(args, "--milestone"),
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

  const reworkSignal = detectRework(recs);

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

function cmdCalibrate(args: string[]): number {
  const month = strFlag(args, "--month") ?? monthKey();
  const recs = readRecords(month);
  const suggestions = suggestCaps(recs);
  let current: ReturnType<typeof parseCaps> = [];
  try {
    current = parseCaps(readState(flowPaths().budget));
  } catch {
    /* no BUDGET.md reachable — show suggestions only */
  }
  console.log(`FLOW cap calibration — ${month} (suggested soft≈p50×1.25, hard≈p95×1.5)`);
  if (suggestions.length === 0) {
    console.log("  Not enough data yet (need ≥3 records for a phase). Keep running FLOW.");
    return 0;
  }
  console.log("  phase      runs     p50     p95   current(soft/hard)   suggested(soft/hard)");
  for (const s of suggestions) {
    const cap = capFor(current, s.phase);
    const cur = cap ? `${cap.soft / 1000}k/${cap.hard / 1000}k` : "—";
    console.log(
      `  ${s.phase.padEnd(10)} ${String(s.n).padStart(3)}  ${String(s.p50).padStart(6)}  ${String(s.p95).padStart(6)}   ${cur.padStart(16)}   ${(s.soft / 1000 + "k/" + s.hard / 1000 + "k").padStart(16)}`,
    );
  }
  console.log("\n  Advisory only — edit the caps table in .flow/BUDGET.md if you agree.");
  return 0;
}

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "append":
      return cmdAppend(rest);
    case "calibrate":
      return cmdCalibrate(rest);
    case "summary":
    case undefined:
      return cmdSummary(rest);
    default:
      console.error(`unknown subcommand "${cmd}". Use "append", "summary", or "calibrate".`);
      return 1;
  }
}

// Cross-platform direct-invocation guard (see flow-budget.ts for the Windows note).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
