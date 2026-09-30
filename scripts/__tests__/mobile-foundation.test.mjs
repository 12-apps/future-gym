import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import androidExport from "../../apps/mobile/scripts/android-export.cjs";
import { test } from "node:test";
import nativeSignal from "../../apps/mobile/scripts/test-signal.cjs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Jest signal counts passing execution, never all-skipped or missing evidence", () => {
  assert.equal(nativeSignal.assertNativeTestSignal({ success: true, numPassedTests: 3, numFailedTests: 0 }), 3);
  for (const summary of [null, {}, { success: true, numPassedTests: 0, numFailedTests: 0, numPendingTests: 3 }, { success: false, numPassedTests: 3, numFailedTests: 0 }, { success: true, numPassedTests: 2, numFailedTests: 1 }, { success: true, numPassedTests: "3", numFailedTests: 0 }]) assert.throws(() => nativeSignal.assertNativeTestSignal(summary));
});

test("the sole native workspace has real CI tasks and restores both reports", () => {
  const pkg = JSON.parse(read("apps/mobile/package.json"));
  for (const task of ["lint", "check-types", "test", "build"]) assert.ok(pkg.scripts[task]);
  assert.equal(pkg.scripts.build, "node scripts/build-android.cjs");
  assert.match(read("apps/mobile/scripts/build-android.cjs"), /"export", "--platform", "android"/);
  assert.doesNotMatch(JSON.stringify(pkg.scripts), /passWithNoTests|no tests|echo/);
  const outputs = JSON.parse(read("apps/mobile/turbo.json")).tasks.test.outputs;
  assert.ok(outputs.includes("reports/junit.xml")); assert.ok(outputs.includes("reports/results.json"));
  const root = JSON.parse(read("package.json"));
  assert.equal(root.scripts["test:ci"], root.scripts["test:ci:full"], "single native workspace uses full real suite on both paths");
  assert.match(read("scripts/ci/run-mobile-tests.mjs"), /rmSync\("apps\/mobile\/reports"/);
});

test("production source composes shared UI and preserves the approved native stack", () => {
  for (const path of ["apps/mobile/app/_layout.tsx", "apps/mobile/app/(tabs)/_layout.tsx", "apps/mobile/app/(tabs)/index.tsx", "apps/mobile/src/providers.tsx"]) {
    assert.doesNotMatch(read(path), /from ["'](?:react-native|@mui|@emotion|expo-image|expo-linear-gradient|expo-blur|@expo\/vector-icons)/, path);
  }
  const rules = read("apps/mobile/eslint.config.mjs");
  for (const name of ["react-native", "react-native-*", "@mui/*", "@emotion/*", "@12-apps/ui/mui/*", "expo-image", "expo-linear-gradient", "expo-blur", "expo-symbols", "@expo/vector-icons"]) assert.ok(rules.includes(`"${name}"`), name);
  const providers = read("apps/mobile/src/providers.tsx");
  assert.match(providers, /<UiProvider>/); assert.match(providers, /<LocaleProvider locale=\{DEFAULT_LOCALE\}>/);
});


test("Android build evidence rejects missing, empty and escaping bundle output", () => {
  const root = mkdtempSync(join(tmpdir(), "gym-android-export-"));
  const metadata = (bundle) => writeFileSync(join(root, "metadata.json"), JSON.stringify({ bundler: "metro", fileMetadata: { android: { bundle } } }));
  try {
    assert.throws(() => androidExport.assertAndroidExport(root));
    metadata("entry.hbc"); assert.throws(() => androidExport.assertAndroidExport(root));
    writeFileSync(join(root, "entry.hbc"), ""); assert.throws(() => androidExport.assertAndroidExport(root), /empty/);
    writeFileSync(join(root, "entry.hbc"), "bundle bytes"); assert.equal(androidExport.assertAndroidExport(root).bytes, 12);
    metadata("../outside.hbc"); assert.throws(() => androidExport.assertAndroidExport(root), /escapes/);
    metadata("directory"); mkdirSync(join(root, "directory")); assert.throws(() => androidExport.assertAndroidExport(root), /not a file/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
