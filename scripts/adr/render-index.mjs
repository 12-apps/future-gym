/**
 * Render the ADR index in `docs/adr/README.md` from the records themselves:
 * one row per record, between the `adr-index` markers, from its Status date,
 * `Lane` and `Summary`. Ported from 12-apps/future-pay
 * `scripts/adr/render-index.mjs`.
 *
 * Nobody edits the table by hand: the post-merge job
 * (`scripts/post-merge-regen.mjs`) rewrites it on `main`, so two open PRs never
 * conflict on its last row.
 *
 * Usage:
 *   node scripts/adr/render-index.mjs          # rewrite the README in place
 *   node scripts/adr/render-index.mjs --check  # exit 1 when stale or a record is malformed
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { misnamedFiles, README, readRecords, recordProblems, renderTable, spliceIndex } from "./records.mjs";

/** The README as it should read; the second value says whether that differs from the file. */
function renderedReadme(root) {
  const current = readFileSync(join(root, README), "utf8");
  const next = spliceIndex(current, renderTable(readRecords(root)));
  return { next, changed: next !== current };
}

export function renderIndex(root) {
  const { next, changed } = renderedReadme(root);
  if (changed) writeFileSync(join(root, README), next);
  return changed;
}

/** Record-level problems a pull request must fix before it merges. */
export function recordErrors(root) {
  const misnamed = misnamedFiles(root).map((name) => `${name}: records are named <kebab-case-slug>.md, with no number`);
  return [...misnamed, ...readRecords(root).flatMap(recordProblems)];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
  const errors = recordErrors(root);
  if (errors.length) {
    for (const error of errors) console.error(`[adr-index] ${error}`);
    process.exit(1);
  }
  if (process.argv.includes("--check")) {
    const { changed } = renderedReadme(root);
    console.log(changed ? `[adr-index] ${README} is stale; the post-merge job re-renders it` : "[adr-index] up to date");
    process.exit(changed ? 1 : 0);
  }
  console.log(renderIndex(root) ? `[adr-index] rewrote ${README}` : "[adr-index] already up to date");
}
