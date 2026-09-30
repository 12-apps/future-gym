#!/usr/bin/env node
/** Consumer baseline: file-only Node successes are not this repository's tests. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// E-004: the established root suite has 30 real test cases before this guard's
// own regression tests. Removing coverage requires an explicit reviewed change.
export const MINIMUM_ROOT_TESTS = 30;
export function assertRootTestCount(tap) {
  const passes = [...tap.matchAll(/^# pass (\d+)\s*$/gm)];
  const failures = [...tap.matchAll(/^# fail (\d+)\s*$/gm)];
  if (passes.length !== 1 || failures.length !== 1) throw new Error("Root TAP must have one unambiguous completion summary");
  const passed = Number(passes[0][1]);
  if (Number(failures[0][1]) !== 0 || passed < MINIMUM_ROOT_TESTS) {
    throw new Error(`Root suite must pass at least ${MINIMUM_ROOT_TESTS} real cases; observed ${passed} passes and ${failures[0][1]} failures`);
  }
  return passed;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`[root-test-count] ${assertRootTestCount(readFileSync(process.argv[2], "utf8"))} passing cases meet the repository baseline.`); }
  catch (error) { console.error(`[root-test-count] ${error.message}`); process.exitCode = 1; }
}
