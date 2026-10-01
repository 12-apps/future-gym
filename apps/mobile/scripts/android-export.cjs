const { readFileSync, lstatSync } = require("node:fs");
const path = require("node:path");

function assertAndroidExport(directory) {
  const root = path.resolve(directory);
  const metadata = JSON.parse(readFileSync(path.join(root, "metadata.json"), "utf8"));
  const bundle = metadata.fileMetadata?.android?.bundle;
  if (metadata.bundler !== "metro" || typeof bundle !== "string" || !bundle) throw new Error("Export has no Android Metro bundle");
  const file = path.resolve(root, bundle);
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Android bundle escapes the export directory");
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size < 1) throw new Error("Android bundle is empty or not a file");
  return { bundle, bytes: stat.size };
}
module.exports = { assertAndroidExport };
