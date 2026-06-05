/**
 * flow-compress — compress bulky tool output before it enters context.
 *
 * Principle (borrowed from the reference implementation's companion compressor):
 * PRESERVE the signal — errors, failures, warnings, diffs, and summaries — and
 * DROP redundant success noise (repeated "ok" lines, progress bars, dependency
 * spam, long unchanged file dumps). Subagent-heavy workflows multiply token use,
 * so trimming tool results is essential, not optional.
 *
 * It is a stream/string transform with no model call: deterministic, cheap, and
 * safe to run on every tool result via a hook or wrapper.
 *
 * Usage:
 *   flow-compress [--max-lines N] [--head N] [--tail N] < raw > compact
 *   echo "<output>" | flow-compress
 */

import { pathToFileURL } from "node:url";

export interface CompressOptions {
  /** If total lines <= this, pass through untouched. */
  maxLines: number;
  /** Lines of leading context to always keep. */
  head: number;
  /** Lines of trailing context to always keep. */
  tail: number;
}

export const DEFAULT_OPTIONS: CompressOptions = {
  maxLines: 40,
  head: 6,
  tail: 6,
};

/** Lines matching these are always kept — they carry the signal. */
const KEEP_PATTERNS: RegExp[] = [
  /\berror\b/i,
  /\bfailed?\b/i,
  /\bfailure\b/i,
  /\bexception\b/i,
  /\bwarn(ing)?\b/i,
  /\bfatal\b/i,
  /\bpanic\b/i,
  /\bdenied\b/i,
  /\btimeout\b/i,
  /\b(traceback|stack ?trace)\b/i,
  /^\s*[-+]{3} /, // diff file headers
  /^\s*@@ /, // diff hunk headers
  /^\s*[-+](?![-+])/, // diff add/remove lines
  /\b\d+\s+(passed|failed|skipped|errors?)\b/i, // test summaries
  /\b(summary|result|total)\b/i,
  /\bassert(ion)?\b/i,
  /\bE\d{2,}\b/, // error codes like E404
  /:\s*\d+\s*:\s*\d+/, // file:line:col references
];

/** Lines matching these are pure noise and may be dropped from the middle. */
const NOISE_PATTERNS: RegExp[] = [
  /^\s*$/, // blank
  /^\s*(ok|done|success|✓|✔|added \d|up to date)\b/i,
  /^\s*[\d.]+%/, // progress percentages
  /^\s*(downloading|fetching|resolving|linking|building) /i,
  /node_modules/,
  /^\s*[█▓▒░\.]+\s*$/, // progress bars / dot runs
  /^\s*\[\d+\/\d+\]/, // [12/340] style counters
];

/** True when a line carries signal that must be preserved verbatim. */
export function isSignal(line: string): boolean {
  return KEEP_PATTERNS.some((re) => re.test(line));
}

/** True when a line is recognized redundant success noise. */
export function isNoise(line: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(line));
}

export interface CompressResult {
  text: string;
  originalLines: number;
  keptLines: number;
  droppedLines: number;
}

/**
 * Compress text. Strategy:
 *   1. Short outputs pass through untouched.
 *   2. Otherwise keep head + tail verbatim.
 *   3. In the middle, keep every signal line; drop runs of noise, replacing each
 *      dropped run with a single "… N lines elided …" marker so the shape is
 *      still legible and nothing silently vanishes.
 */
export function compress(
  input: string,
  opts: Partial<CompressOptions> = {},
): CompressResult {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const lines = input.replace(/\n$/, "").split("\n");
  const original = lines.length;

  if (original <= o.maxLines) {
    return { text: input, originalLines: original, keptLines: original, droppedLines: 0 };
  }

  const headEnd = Math.min(o.head, original);
  const tailStart = Math.max(headEnd, original - o.tail);

  const out: string[] = [];
  out.push(...lines.slice(0, headEnd));

  let dropRun = 0;
  const flush = () => {
    if (dropRun > 0) {
      out.push(`… ${dropRun} line${dropRun === 1 ? "" : "s"} elided (redundant success noise) …`);
      dropRun = 0;
    }
  };

  for (let i = headEnd; i < tailStart; i++) {
    const line = lines[i];
    if (isSignal(line)) {
      // Signal always survives and breaks any pending drop run.
      flush();
      out.push(line);
    } else {
      // Non-signal middle line (explicit noise or ordinary chatter): elide it,
      // growing the run so a single marker stands in for the whole block.
      dropRun++;
    }
  }
  flush();

  out.push(...lines.slice(tailStart));

  const text = out.join("\n");
  const kept = out.length;
  return {
    text,
    originalLines: original,
    keptLines: kept,
    droppedLines: original - kept,
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(argv: string[]): Promise<number> {
  const opts: Partial<CompressOptions> = {};
  const ml = numFlag(argv, "--max-lines");
  const hd = numFlag(argv, "--head");
  const tl = numFlag(argv, "--tail");
  if (ml !== null) opts.maxLines = ml;
  if (hd !== null) opts.head = hd;
  if (tl !== null) opts.tail = tl;

  const input = await readStdin();
  const res = compress(input, opts);
  process.stdout.write(res.text + "\n");
  if (res.droppedLines > 0) {
    process.stderr.write(
      `[compress] ${res.originalLines} → ${res.keptLines} lines (-${res.droppedLines})\n`,
    );
  }
  return 0;
}

function numFlag(args: string[], name: string): number | null {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  const n = parseInt(args[i + 1], 10);
  return Number.isFinite(n) ? n : null;
}

// Cross-platform direct-invocation guard (see flow-budget.ts for the Windows note).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
