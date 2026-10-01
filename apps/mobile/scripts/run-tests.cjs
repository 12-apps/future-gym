const { spawnSync } = require("node:child_process");
const { mkdirSync, readFileSync, rmSync } = require("node:fs");
const path = require("node:path");
const { assertNativeTestSignal } = require("./test-signal.cjs");

const root = path.resolve(__dirname, "..");
const reports = path.join(root, "reports");
// A stale report is never evidence for this invocation, including Turbo misses.
rmSync(reports, { recursive: true, force: true });
mkdirSync(reports, { recursive: true });
const result = spawnSync(process.execPath, [
  require.resolve("jest/bin/jest"), "--ci", "--runInBand", "--json",
  `--outputFile=${path.join(reports, "results.json")}`, ...process.argv.slice(2),
], { cwd: root, stdio: "inherit" });
if (result.error) { console.error(result.error.message); process.exit(1); }
if (result.status !== 0) process.exit(result.status ?? 1);
try {
  const summary = JSON.parse(readFileSync(path.join(reports, "results.json"), "utf8"));
  assertNativeTestSignal(summary);
  // The engine consumes this exact fresh report, restored by Turbo on a cache hit.
  if (!readFileSync(path.join(reports, "junit.xml"), "utf8").includes("<testcase")) throw new Error("Mobile JUnit report has no cases");
  console.log(`[mobile-test-signal] ${summary.numPassedTests} actual passing cases; ${summary.numPendingTests ?? 0} skipped`);
} catch (error) {
  console.error(`[mobile-test-signal] ${error.message}`);
  process.exit(1);
}
