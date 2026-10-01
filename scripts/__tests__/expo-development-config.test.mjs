import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const appConfig = require("../../apps/mobile/app.config.js");
const { developmentEnvironment } = require("../../apps/mobile/scripts/start-dev.cjs");
const base = { name: "@repo/mobile", slug: "@repomobile", version: "0.1.0" };

function evaluate(variant, nodeEnv, config = base) {
  const previous = { APP_VARIANT: process.env.APP_VARIANT, NODE_ENV: process.env.NODE_ENV };
  try {
    for (const [key, value] of Object.entries({ APP_VARIANT: variant, NODE_ENV: nodeEnv })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return appConfig({ config });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Expo Go development declares one scheme without inventing native identities", () => {
  const config = evaluate("development", "development");
  assert.deepEqual(config, { ...base, scheme: "future-gym-dev" });
  assert.equal(config.android?.package, undefined);
  assert.equal(config.ios?.bundleIdentifier, undefined);
  assert.deepEqual(base, { name: "@repo/mobile", slug: "@repomobile", version: "0.1.0" });
});

test("default, preview and production config cannot inherit the development scheme", () => {
  for (const variant of [undefined, "preview", "production", "Development"])
    assert.deepEqual(evaluate(variant, "development"), base);
  assert.deepEqual(evaluate("development", "production"), base);
  const futureConfig = { ...base, scheme: "owner-approved-later" };
  assert.deepEqual(evaluate("production", "production", futureConfig), futureConfig);
});

test("the cross-platform dev command selects Expo Go and the explicit development variant", () => {
  const environment = { APP_VARIANT: "production", NODE_ENV: "production", PATH: "/test/bin" };
  assert.deepEqual(developmentEnvironment(environment), {
    APP_VARIANT: "development", NODE_ENV: "development", PATH: "/test/bin",
  });
  assert.equal(environment.APP_VARIANT, "production");
  const read = (file) => readFileSync(new URL(`../../apps/mobile/${file}`, import.meta.url), "utf8");
  assert.equal(JSON.parse(read("package.json")).scripts.dev, "node scripts/start-dev.cjs");
  assert.match(read("scripts/start-dev.cjs"), /"start", "--go", \.\.\.process\.argv\.slice\(2\)/);
  assert.match(read("scripts/build-android.cjs"), /APP_VARIANT: "production"/);
  for (const file of ["app.config.js", "scripts/start-dev.cjs"])
    assert.doesNotMatch(read(file), /LogBox|ignoreLogs|ignoreAllLogs|console\.warn\s*=/);
});
