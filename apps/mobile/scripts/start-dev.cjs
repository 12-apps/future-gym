const { spawnSync } = require("node:child_process");
const path = require("node:path");

function developmentEnvironment(environment) {
  return { ...environment, APP_VARIANT: "development", NODE_ENV: "development" };
}

if (require.main === module) {
  const result = spawnSync(process.execPath, [require.resolve("expo/bin/cli"), "start", "--go", ...process.argv.slice(2)], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: developmentEnvironment(process.env),
  });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}

module.exports = { developmentEnvironment };
