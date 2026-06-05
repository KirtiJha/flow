/**
 * flow-core — shared primitives for the FLOW cost-control layer and generator.
 *
 * Responsibilities:
 *   - Locate the `.flow/` state directory by walking up from a starting dir.
 *   - Typed read/write of the state files (STATE.md / CONTEXT.md / BUDGET.md).
 *   - Parse the per-phase cap table from BUDGET.md.
 *   - Append rows into marker-delimited tables (caps/spend) without disturbing
 *     surrounding content.
 *
 * Dependency-light: Node built-ins only (ESM, Node >= 18).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type Phase =
  | "discuss"
  | "plan"
  | "review"
  | "execute"
  | "verify"
  | "ship"
  | "quick";

export interface PhaseCap {
  phase: string;
  soft: number;
  hard: number;
}

export interface FlowPaths {
  /** Absolute path to the `.flow/` directory. */
  dir: string;
  state: string;
  context: string;
  budget: string;
  metricsDir: string;
}

/**
 * Walk up from `start` looking for a `.flow/` directory. Returns its resolved
 * path or null if none is found before the filesystem root.
 */
export function findFlowDir(start: string = process.cwd()): string | null {
  let cur = resolve(start);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = join(cur, ".flow");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(cur);
    if (parent === cur) return null; // reached filesystem root
    cur = parent;
  }
}

/**
 * Resolve the standard FLOW paths. Throws a clear error if `.flow/` cannot be
 * located, unless `create` is set, in which case it is created under `start`.
 */
export function flowPaths(
  start: string = process.cwd(),
  opts: { create?: boolean } = {},
): FlowPaths {
  let dir = findFlowDir(start);
  if (!dir) {
    if (!opts.create) {
      throw new Error(
        "Could not locate a .flow/ directory by walking up from " +
          resolve(start) +
          ". Run `/flow-new-project` (or `flow-gen`) to initialize one.",
      );
    }
    dir = join(resolve(start), ".flow");
    mkdirSync(join(dir, "metrics"), { recursive: true });
  }
  return {
    dir,
    state: join(dir, "STATE.md"),
    context: join(dir, "CONTEXT.md"),
    budget: join(dir, "BUDGET.md"),
    metricsDir: join(dir, "metrics"),
  };
}

/** Read a state file, returning "" if it does not exist. */
export function readState(file: string): string {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

/** Write a state file, creating parent dirs as needed. */
export function writeState(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, "utf8");
}

/**
 * Parse the per-phase cap table from BUDGET.md. Reads the markdown table between
 * the `<!-- FLOW:CAPS:START -->` / `<!-- FLOW:CAPS:END -->` markers if present,
 * otherwise scans the whole document for a Phase|Soft|Hard table.
 */
export function parseCaps(budgetMd: string): PhaseCap[] {
  const region = extractMarkerRegion(budgetMd, "CAPS") ?? budgetMd;
  const caps: PhaseCap[] = [];
  for (const line of region.split("\n")) {
    const cells = splitRow(line);
    if (cells.length < 3) continue;
    const [phase, soft, hard] = cells;
    const softN = toInt(soft);
    const hardN = toInt(hard);
    if (phase && softN !== null && hardN !== null) {
      caps.push({ phase: phase.toLowerCase(), soft: softN, hard: hardN });
    }
  }
  return caps;
}

/** Look up a single phase's cap, or null if absent. */
export function capFor(caps: PhaseCap[], phase: string): PhaseCap | null {
  return caps.find((c) => c.phase === phase.toLowerCase()) ?? null;
}

/**
 * Append a row to a marker-delimited markdown table, inserting it just before the
 * END marker. Returns the updated document. If markers are missing the document
 * is returned unchanged (caller should warn).
 */
export function appendToMarkerTable(
  doc: string,
  marker: string,
  row: string,
): string {
  const end = `<!-- FLOW:${marker}:END -->`;
  const idx = doc.indexOf(end);
  if (idx === -1) return doc;
  const before = doc.slice(0, idx);
  const after = doc.slice(idx);
  const sep = before.endsWith("\n") ? "" : "\n";
  return `${before}${sep}${row}\n${after}`;
}

/** Extract the text between FLOW START/END markers for `name`, or null. */
export function extractMarkerRegion(doc: string, name: string): string | null {
  const start = `<!-- FLOW:${name}:START -->`;
  const end = `<!-- FLOW:${name}:END -->`;
  const s = doc.indexOf(start);
  const e = doc.indexOf(end);
  if (s === -1 || e === -1 || e < s) return null;
  return doc.slice(s + start.length, e);
}

/**
 * Replace the text between named START/END markers with `body`. If the markers do
 * not exist, `body` (wrapped in fresh markers) is appended. Used for safe,
 * non-destructive injection into shared files like copilot-instructions.md.
 */
export function replaceMarkerRegion(
  doc: string,
  name: string,
  body: string,
): string {
  const start = `<!-- FLOW:${name}:START -->`;
  const end = `<!-- FLOW:${name}:END -->`;
  const s = doc.indexOf(start);
  const e = doc.indexOf(end);
  const block = `${start}\n${body}\n${end}`;
  if (s === -1 || e === -1 || e < s) {
    const sep = doc.length === 0 || doc.endsWith("\n") ? "" : "\n";
    return `${doc}${sep}${doc.length ? "\n" : ""}${block}\n`;
  }
  return doc.slice(0, s) + block + doc.slice(e + end.length);
}

// --- small helpers -------------------------------------------------------

function splitRow(line: string): string[] {
  const t = line.trim();
  if (!t.startsWith("|")) return [];
  return t
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function toInt(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[_,\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  return parseInt(cleaned, 10);
}
