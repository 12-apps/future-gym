/** Jest-native execution evidence, used on both PR and full-suite commands. */
function assertNativeTestSignal(summary) {
  if (!summary || summary.success !== true || !Number.isSafeInteger(summary.numPassedTests) || summary.numPassedTests < 1 || summary.numFailedTests !== 0) {
    throw new Error("Native tests must execute at least one passing case with no failures; skipped cases are not execution");
  }
  return summary.numPassedTests;
}
module.exports = { assertNativeTestSignal };
