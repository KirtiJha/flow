/**
 * Integration tests for the npx installer (`bin/install.js`).
 *
 * These drive the REAL entrypoint via a child process (`node bin/install.js …`)
 * into throwaway OS temp dirs, so they exercise arg parsing, the compiled
 * generator import, `.flow/` scaffolding, hook merging, idempotency, global
 * targeting, and uninstall exactly as a user would hit them. Robust on Windows:
 * paths use `path.join`, the node binary is `process.execPath`, and the installer
 * is resolved by absolute path from the repo root.
 *
 * Requires `dist/` (the installer imports the compiled `runGen`). Run
 * `npm run build` first; if `dist/scripts/flow-gen.js` is missing the suite skips
 * with a clear message rather than failing spuriously.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Repo root: this file lives in scripts/, so root is its parent's parent.
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const installer = join(repoRoot, "bin", "install.js");
const distGen = join(repoRoot, "dist", "scripts", "flow-gen.js");

const HAS_DIST = existsSync(distGen);

/** Run the installer entrypoint in a child process; return its result. */
function runInstaller(
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
) {
  const res = spawnSync(process.execPath, [installer, ...args], {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env ?? {}) },
    encoding: "utf8",
  });
  return res;
}

/** Collect every hook command string across all events in a settings object. */
function allHookCommands(settings: any): string[] {
  const cmds: string[] = [];
  const hooks = settings?.hooks ?? {};
  for (const event of Object.keys(hooks)) {
    const arr = hooks[event];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      for (const h of entry?.hooks ?? []) {
        if (h && typeof h.command === "string") cmds.push(h.command);
      }
    }
  }
  return cmds;
}

test(
  "installer: local install, idempotency, state preservation, global, uninstall",
  { skip: HAS_DIST ? false : `dist/ not built (${distGen} missing) — run npm run build` },
  async (t) => {
    const tmp = mkdtempSync(join(os.tmpdir(), "flow-install-"));
    const tmpHome = mkdtempSync(join(os.tmpdir(), "flow-global-"));

    try {
      // --- 1. Local install ------------------------------------------------
      await t.test("local install creates layout, state, and 3 absolute hooks", () => {
        const res = runInstaller(["--claude", "--local"], { cwd: tmp });
        assert.equal(
          res.status,
          0,
          `installer exited ${res.status}\nstdout:${res.stdout}\nstderr:${res.stderr}`,
        );

        // Generated skill + scaffolded state + settings all present.
        assert.ok(
          existsSync(join(tmp, ".claude", "skills", "flow", "SKILL.md")),
          "flow SKILL.md exists",
        );
        assert.ok(existsSync(join(tmp, ".flow", "STATE.md")), ".flow/STATE.md exists");
        const settingsPath = join(tmp, ".claude", "settings.json");
        assert.ok(existsSync(settingsPath), "settings.json exists");

        // Exactly three hook commands, each an absolute path ending hooks/<x>.mjs.
        const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
        const cmds = allHookCommands(settings);
        assert.equal(cmds.length, 3, `expected 3 hook commands, got ${cmds.length}`);
        for (const cmd of cmds) {
          assert.match(
            cmd,
            /hooks\/(pre-phase-budget|atomic-commit|post-session-metrics)\.mjs"?$/,
            `hook command ends with absolute hooks/<x>.mjs: ${cmd}`,
          );
          // Absolute: the embedded hooks/ path is rooted (drive letter or leading /).
          assert.match(
            cmd,
            /(?:[A-Za-z]:[\\/]|\/).*hooks\/[a-z-]+\.mjs/,
            `hook path is absolute: ${cmd}`,
          );
        }

        // Install-mode body uses compiled dist script, not dev invocations.
        const statusSkill = readFileSync(
          join(tmp, ".claude", "skills", "flow-status", "SKILL.md"),
          "utf8",
        );
        assert.ok(
          statusSkill.includes("dist/scripts/flow-budget.js"),
          "flow-status body references compiled dist script",
        );
        assert.ok(!statusSkill.includes("npm run"), "no `npm run` in install body");
        assert.ok(
          !statusSkill.includes("--import tsx"),
          "no `--import tsx` in install body",
        );
      });

      // --- 2. Idempotent ---------------------------------------------------
      await t.test("re-install does not duplicate hooks", () => {
        const res = runInstaller(["--claude", "--local"], { cwd: tmp });
        assert.equal(res.status, 0, `2nd install exited ${res.status}: ${res.stderr}`);
        const settings = JSON.parse(
          readFileSync(join(tmp, ".claude", "settings.json"), "utf8"),
        );
        assert.equal(
          allHookCommands(settings).length,
          3,
          "still exactly 3 hooks after re-install",
        );
      });

      // --- 3. State preserved ---------------------------------------------
      const MARKER = "FLOW-TEST-MARKER-do-not-clobber";
      await t.test("re-install preserves .flow/ state", () => {
        const statePath = join(tmp, ".flow", "STATE.md");
        appendFileSync(statePath, `\n${MARKER}\n`);
        const res = runInstaller(["--claude", "--local"], { cwd: tmp });
        assert.equal(res.status, 0, `re-install exited ${res.status}: ${res.stderr}`);
        assert.ok(
          readFileSync(statePath, "utf8").includes(MARKER),
          "appended marker survived re-install",
        );
      });

      // --- 4. Global -------------------------------------------------------
      await t.test("global install targets HOME/USERPROFILE", () => {
        const res = runInstaller(["--claude", "--global"], {
          // cwd elsewhere so a stray local install can't satisfy the assertion.
          cwd: tmp,
          env: { HOME: tmpHome, USERPROFILE: tmpHome },
        });
        assert.equal(
          res.status,
          0,
          `global install exited ${res.status}: ${res.stderr}`,
        );
        assert.ok(
          existsSync(join(tmpHome, ".claude", "skills", "flow", "SKILL.md")),
          "global flow SKILL.md exists under HOME",
        );
      });

      // --- 5. Uninstall ----------------------------------------------------
      await t.test("uninstall removes FLOW files but keeps .flow/ state", () => {
        const res = runInstaller(["--uninstall"], { cwd: tmp });
        assert.equal(res.status, 0, `uninstall exited ${res.status}: ${res.stderr}`);
        assert.ok(
          !existsSync(join(tmp, ".claude", "skills", "flow")),
          ".claude/skills/flow removed",
        );
        const statePath = join(tmp, ".flow", "STATE.md");
        assert.ok(existsSync(statePath), ".flow/STATE.md preserved");
        assert.ok(
          readFileSync(statePath, "utf8").includes(MARKER),
          "marker still present after uninstall (state untouched)",
        );
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      rmSync(tmpHome, { recursive: true, force: true });
    }
  },
);

// Sanity: the installer resolves to a real file (guards against a path-shape
// regression on Windows that would make every child-process run fail silently).
test("installer entrypoint resolves to an existing file", () => {
  assert.ok(existsSync(installer), `bin/install.js exists at ${installer}`);
  assert.ok(
    readdirSync(join(repoRoot, "bin")).includes("install.js"),
    "install.js listed in bin/",
  );
});
