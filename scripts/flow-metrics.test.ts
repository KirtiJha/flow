/**
 * Tests for the rework signal. Regression for the false positive where two distinct
 * milestones (each verified once) were reported as "possible rework".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRework, suggestCaps, percentile, type MetricRecord } from "./flow-metrics.js";

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

const tok = (phase: string, tokens: number): MetricRecord => ({
  ts: "2026-06-05T00:00:00.000Z",
  phase,
  tokens,
  withinCap: true,
});

test("percentile uses nearest-rank", () => {
  assert.equal(percentile([10, 20, 30, 40], 0.5), 20);
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  assert.equal(percentile([], 0.5), 0);
});

test("suggestCaps needs >=3 samples and excludes session", () => {
  const recs = [tok("plan", 20000), tok("plan", 22000), tok("session", 0)];
  // only 2 plan samples -> no suggestion
  assert.equal(suggestCaps(recs).length, 0);
});

test("suggestCaps derives soft~p50x1.25 / hard~p95x1.5, rounded to 5k", () => {
  const recs = [tok("verify", 18000), tok("verify", 21000), tok("verify", 31000), tok("verify", 40000)];
  const [v] = suggestCaps(recs);
  assert.equal(v.phase, "verify");
  assert.equal(v.n, 4);
  // p50 (nearest-rank, ceil(0.5*4)-1=1) = 21000 -> soft = ceil(26250/5000)*5000 = 30000
  assert.equal(v.soft, 30000);
  // p95 (ceil(0.95*4)-1=3) = 40000 -> hard = ceil(60000/5000)*5000 = 60000
  assert.equal(v.hard, 60000);
  assert.ok(v.hard > v.soft);
});
