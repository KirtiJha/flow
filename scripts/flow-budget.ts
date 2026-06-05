/**
 * flow-budget — the team's governance lever.
 *
 * Reads per-phase caps from BUDGET.md, compares them against recorded session
 * spend, WARNS at the soft cap and BLOCKS at the hard cap (non-zero exit). A
 * pre-phase hook calls this at every phase boundary so spend-vs-cap is visible
 * and enforceable. This matters precisely because FLOW deliberately avoids native
 * Dynamic Workflows, whose unbounded fan-out would burn tokens without a gate.
 *
 * Usage:
 *   flow-budget check <phase> [--spent <tokens>] [--estimate <tokens>]
 *   flow-budget show
 *
 * Exit codes: 0 ok (incl. soft-cap warning), 2 hard-cap block, 1 usage error.
 */

import { flowPaths, readState, parseCaps, capFor, type PhaseCap } from "./flow-core.js";

interface CheckResult {
  phase: string;
  cap: PhaseCap | null;
  spent: number;
  level: "ok" | "soft" | "hard" | "uncapped";
  message: string;
}

/** Pure decision function — easy to unit test, no I/O. */
export function evaluate(
  caps: PhaseCap[],
  phase: string,
  spent: number,
): CheckResult {
  const cap = capFor(caps, phase);
  if (!cap) {
    return {
      phase,
      cap: null,
      spent,
      level: "uncapped",
      message: `No cap defined for phase "${phase}". Add a row to BUDGET.md.`,
    };
  }
  if (spent >= cap.hard) {
    return {
      phase,
      cap,
      spent,
      level: "hard",
      message:
        `HARD CAP EXCEEDED for "${phase}": ${fmt(spent)} ≥ ${fmt(cap.hard)} tokens. ` +
        `Phase is blocked. Reduce scope, compress context, or raise the cap deliberately.`,
    };
  }
  if (spent >= cap.soft) {
    return {
      phase,
      cap,
      spent,
      level: "soft",
      message:
        `Soft cap reached for "${phase}": ${fmt(spent)} ≥ ${fmt(cap.soft)} ` +
        `(hard ${fmt(cap.hard)}). Proceeding, but watch spend.`,
    };
  }
  return {
    phase,
    cap,
    spent,
    level: "ok",
    message: `Within budget for "${phase}": ${fmt(spent)} / soft ${fmt(cap.soft)} / hard ${fmt(cap.hard)}.`,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function loadCaps(): PhaseCap[] {
  const paths = flowPaths();
  return parseCaps(readState(paths.budget));
}

function cmdShow(): number {
  const caps = loadCaps();
  if (caps.length === 0) {
    console.error("No caps found in BUDGET.md (looked between FLOW:CAPS markers).");
    return 1;
  }
  console.log("Phase budgets (tokens):");
  for (const c of caps) {
    console.log(`  ${c.phase.padEnd(10)} soft ${fmt(c.soft).padStart(8)}  hard ${fmt(c.hard).padStart(8)}`);
  }
  return 0;
}

function cmdCheck(args: string[]): number {
  const phase = args[0];
  if (!phase) {
    console.error("usage: flow-budget check <phase> [--spent N] [--estimate N]");
    return 1;
  }
  const spent = numFlag(args, "--spent") ?? 0;
  const estimate = numFlag(args, "--estimate") ?? 0;
  const projected = spent + estimate;
  const res = evaluate(loadCaps(), phase, projected);

  const prefix =
    res.level === "hard" ? "⛔" : res.level === "soft" ? "⚠️ " : res.level === "uncapped" ? "•" : "✅";
  const line = `${prefix} [budget] ${res.message}`;
  if (res.level === "hard") {
    console.error(line);
    return 2;
  }
  console.log(line);
  return 0;
}

function numFlag(args: string[], name: string): number | null {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  const n = parseInt(args[i + 1].replace(/[_,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "check":
      return cmdCheck(rest);
    case "show":
    case undefined:
      return cmdShow();
    default:
      console.error(`unknown subcommand "${cmd}". Use "check" or "show".`);
      return 1;
  }
}

// Run only when invoked directly (not when imported for tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
