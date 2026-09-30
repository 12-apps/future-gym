const { spawnSync } = require("node:child_process");
const { rmSync } = require("node:fs");
const path = require("node:path");
const { assertAndroidExport } = require("./android-export.cjs");

const root = path.resolve(__dirname, "..");
rmSync(path.join(root, "dist"), { recursive: true, force: true });
const result = spawnSync(process.execPath, [require.resolve("expo/bin/cli"), "export", "--platform", "android", "--output-dir", "dist"], {
  cwd: root, stdio: "inherit", env: { ...process.env, EXPO_NO_TELEMETRY: "1" },
});
if (result.error) { console.error(result.error.message); process.exit(1); }
if (result.status !== 0) process.exit(result.status ?? 1);
try {
  const artifact = assertAndroidExport(path.join(root, "dist"));
  console.log(`[android-build-signal] ${artifact.bundle}: ${artifact.bytes} bytes. Bundle only; not an APK or device test.`);
} catch (error) {
  console.error(`[android-build-signal] ${error.message}`);
  process.exit(1);
}
