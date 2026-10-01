#!/usr/bin/env node
/** One real native workspace: Turbo may replay only with both signal reports restored. */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import nativeSignal from "../../apps/mobile/scripts/test-signal.cjs";

rmSync("apps/mobile/reports", { recursive: true, force: true });
const result = spawnSync("pnpm", ["exec", "turbo", "run", "test", "--filter=@repo/mobile"], { stdio: "inherit" });
if (result.error) { console.error(result.error.message); process.exit(1); }
if (result.status !== 0) process.exit(result.status ?? 1);
try {
  const summary = JSON.parse(readFileSync("apps/mobile/reports/results.json", "utf8"));
  nativeSignal.assertNativeTestSignal(summary);
  if (!readFileSync("apps/mobile/reports/junit.xml", "utf8").includes("<testcase")) throw new Error("Native JUnit output is missing cases");
  console.log(`[workspace-test-signal] ${summary.numPassedTests} passing native cases; fresh execution or restored task evidence`);
} catch (error) {
  console.error(`[workspace-test-signal] ${error.message}`);
  process.exit(1);
}
