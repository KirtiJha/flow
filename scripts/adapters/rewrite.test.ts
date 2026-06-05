/**
 * Tests for install-mode invocation rewriting.
 *
 * Canonical command bodies reference the dev repo's invocations (`npm run …`,
 * `node --import tsx scripts/…`) which only resolve inside this repository.
 * `rewriteInvocations` repoints them at the installed package's compiled scripts
 * by absolute path so generated commands work in a user's project regardless of
 * cwd or toolchain. These tests pin all five known invocation-site forms and
 * confirm dev-mode generation is unaffected.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rewriteInvocations,
  type GenContext,
  type CanonicalDoc,
} from "./shared.js";
import { claudeCodeAdapter } from "./claude-code.js";

// A sample body containing all five real invocation sites (flow.md:40,
// plan.md:29, execute.md:25, ship.md:28, status.md:14-15) plus a compress form.
const SAMPLE = [
  "Run `npm run budget -- check <phase> --estimate <est>` first.",
  "Inside plan, re-check the cap (`npm run budget -- check plan`).",
  "Estimate: `npm run budget -- check execute --estimate <wave_est>`",
  "On ship: `npm run metrics -- append --phase ship --tokens <spend> --within-cap true`",
  "!`node --import tsx scripts/flow-budget.ts show`",
  "!`node --import tsx scripts/flow-metrics.ts summary`",
  "Optional compress: `npm run compress -- run` and `node --import tsx scripts/flow-compress.ts run`.",
].join("\n");

const INSTALL_DIR = "C:\\Users\\me\\AppData\\flow"; // Windows-style on purpose.

test("rewriteInvocations removes all npm run / tsx forms", () => {
  const out = rewriteInvocations(SAMPLE, INSTALL_DIR);
  assert.ok(!/npm run /.test(out), "no `npm run` should remain");
  assert.ok(!/--import tsx/.test(out), "no `--import tsx` should remain");
});

test("rewriteInvocations emits forward-slashed absolute dist paths", () => {
  const out = rewriteInvocations(SAMPLE, INSTALL_DIR);
  const dist = "C:/Users/me/AppData/flow/dist/scripts";
  assert.ok(out.includes(`node "${dist}/flow-budget.js"`), "budget path present");
  assert.ok(out.includes(`node "${dist}/flow-metrics.js"`), "metrics path present");
  assert.ok(
    out.includes(`node "${dist}/flow-compress.js"`),
    "compress path present",
  );
  // No backslashes should survive in the embedded dist path.
  assert.ok(!out.includes("\\dist\\scripts"), "no backslashed dist path");
});

test("rewriteInvocations preserves trailing args", () => {
  const out = rewriteInvocations(SAMPLE, INSTALL_DIR);
  assert.ok(out.includes("check <phase> --estimate <est>"), "budget args kept");
  assert.ok(
    out.includes("append --phase ship --tokens <spend> --within-cap true"),
    "metrics args kept",
  );
});

test("rewriteInvocations normalizes CRLF input", () => {
  const crlf = SAMPLE.replace(/\n/g, "\r\n");
  const out = rewriteInvocations(crlf, INSTALL_DIR);
  assert.ok(!out.includes("\r\n"), "CRLF normalized to LF");
  assert.ok(!/npm run /.test(out), "rewrite still applies on CRLF source");
});

// --- adapter-level dev vs install behavior -------------------------------

function ctxWith(
  extra: Partial<GenContext>,
): GenContext {
  return {
    sourceRoot: "/repo",
    targetRoot: "/repo",
    legacyCommands: false,
    invocationMode: "dev",
    config: {
      modelTiers: { low: "m-low", mid: "m-mid", high: "m-high" },
      generatedBanner: "<!-- GENERATED -->",
      runtimes: {
        "claude-code": { enabled: true, commandLayout: "skills" },
        copilot: { enabled: true, cliSupportsPromptFiles: false },
      },
    },
    ...extra,
  };
}

const DOC: CanonicalDoc = {
  name: "status",
  kind: "command",
  frontmatter: { description: "status", model: "low" },
  body: "!`node --import tsx scripts/flow-budget.ts show`",
  tools: [],
};

test("claude adapter: dev mode keeps repo-relative invocations", () => {
  const res = claudeCodeAdapter.generate([DOC], [], ctxWith({}));
  const skill = res.files.find((f) => f.path.includes("status"))!;
  assert.ok(
    skill.content.includes("--import tsx scripts/flow-budget.ts"),
    "dev body should be untouched",
  );
});

test("claude adapter: install mode rewrites to compiled scripts", () => {
  const res = claudeCodeAdapter.generate(
    [DOC],
    [],
    ctxWith({ invocationMode: "install", installDir: "/opt/flow" }),
  );
  const skill = res.files.find((f) => f.path.includes("status"))!;
  assert.ok(!skill.content.includes("--import tsx"), "tsx removed in install mode");
  assert.ok(
    skill.content.includes('node "/opt/flow/dist/scripts/flow-budget.js"'),
    "compiled script path present",
  );
});
