/**
 * Tests for the rework signal. Regression for the false positive where two distinct
 * milestones (each verified once) were reported as "possible rework".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRework, type MetricRecord } from "./flow-metrics.js";

const rec = (phase: string, milestone?: string): MetricRecord => ({
  ts: "2026-06-05T00:00:00.000Z",
  phase,
  tokens: 1000,
  withinCap: true,
  milestone,
});

test("two different milestones each verified once is NOT rework", () => {
  const recs = [rec("verify", "index-utils"), rec("verify", "cli"), rec("plan", "cli")];
  assert.equal(detectRework(recs), "no rework signal");
});

test("one milestone verified twice IS rework", () => {
  const recs = [rec("verify", "cli"), rec("execute", "cli"), rec("verify", "cli")];
  assert.match(detectRework(recs), /cli re-verified 2×/);
});

test("untagged verify records never raise a false alarm", () => {
  const recs = [rec("verify"), rec("verify"), rec("session")];
  assert.equal(detectRework(recs), "no rework signal");
});
