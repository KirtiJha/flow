/**
 * Regression tests for parseDoc frontmatter extraction.
 *
 * The frontmatter regex is anchored on LF. Source authored on Windows (or
 * rewritten by Git autocrlf) arrives as CRLF; if parseDoc fails to normalize it,
 * every frontmatter field is silently dropped — descriptions vanish, tools empty
 * out, and model tiers collapse to `inherit`. These tests pin that down so the
 * generator can never regress to producing tier-less, description-less output.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDoc } from "./shared.js";

const SRC = [
  "---",
  "description: Phase 1. Surface decisions before planning.",
  "allowed-tools: read, grep, glob, task, write",
  "model: mid",
  "argument-hint: <request or topic>",
  "---",
  "",
  "# /flow-discuss — body starts here",
  "",
  "Topic: **$ARGUMENTS**",
].join("\n");

test("parseDoc extracts frontmatter from LF source", () => {
  const d = parseDoc("discuss", "command", SRC);
  assert.equal(d.frontmatter["description"], "Phase 1. Surface decisions before planning.");
  assert.equal(d.frontmatter["model"], "mid");
  assert.deepEqual(d.tools, ["read", "grep", "glob", "task", "write"]);
  assert.match(d.body, /^# \/flow-discuss/);
});

test("parseDoc extracts frontmatter from CRLF source (Windows / autocrlf)", () => {
  const crlf = SRC.replace(/\n/g, "\r\n");
  const d = parseDoc("discuss", "command", crlf);
  // Identical results to the LF case — CRLF must not drop a single field.
  assert.equal(d.frontmatter["description"], "Phase 1. Surface decisions before planning.");
  assert.equal(d.frontmatter["model"], "mid");
  assert.deepEqual(d.tools, ["read", "grep", "glob", "task", "write"]);
  assert.match(d.body, /^# \/flow-discuss/);
  // And no stray carriage return must survive into a parsed value.
  assert.ok(!d.frontmatter["model"].includes("\r"));
});

test("parseDoc handles a doc with no frontmatter", () => {
  const d = parseDoc("plain", "command", "# Just a heading\n\nNo frontmatter.\n");
  assert.deepEqual(d.frontmatter, {});
  assert.deepEqual(d.tools, []);
  assert.match(d.body, /^# Just a heading/);
});
