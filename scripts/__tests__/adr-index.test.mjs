#!/usr/bin/env node
/**
 * The ADR index (docs/adr/README.md): records are unnumbered, every record
 * carries Status date, Lane and Summary, and rendering is idempotent. Run via
 * `node --test "scripts/__tests__/*.test.mjs"`, which `ci-success` does.
 *
 * Node builtins only: this runs in `ci-success`, no install.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseRecord, recordProblems, renderTable } from "../adr/records.mjs";
import { recordErrors, renderIndex } from "../adr/render-index.mjs";

const RENDER = join(dirname(fileURLToPath(import.meta.url)), "..", "adr", "render-index.mjs");
const TMP = mkdtempSync(join(tmpdir(), "adr-index-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

const README = "# ADRs\n\n<!-- adr-index:start -->\n<!-- adr-index:end -->\n";
const record = (title, date = "2026-09-30", lane = "UI", summary = "We do X.") =>
  `# ${title}\n\n**Status:** Accepted — ${date}\n\n**Lane:** ${lane}\n\n**Summary:** ${summary}\n\n## Context\n`;

function tree(name, records) {
  const root = join(TMP, name);
  mkdirSync(join(root, "docs", "adr"), { recursive: true });
  writeFileSync(join(root, "docs", "adr", "README.md"), README);
  for (const [file, body] of Object.entries(records)) writeFileSync(join(root, "docs", "adr", file), body);
  return root;
}

test("a well-formed record parses and lists; oldest first, ties by slug", () => {
  const recs = [
    parseRecord("b-later.md", record("B", "2026-10-02")),
    parseRecord("z-first.md", record("Z", "2026-10-01")),
    parseRecord("a-first.md", record("A", "2026-10-01")),
  ].sort((x, y) => x.date.localeCompare(y.date) || x.slug.localeCompare(y.slug));
  assert.deepEqual(recs.map((r) => r.slug), ["a-first", "z-first", "b-later"]);
  assert.match(renderTable(recs), /\| \[A\]\(\.\/a-first\.md\) \| 2026-10-01 \| UI \| We do X\. \|/);
});

test("a record missing Status date, Lane or Summary cannot render", () => {
  const bad = parseRecord("x.md", "# X\n\n**Status:** Accepted\n\n**Lane:** UI\n");
  assert.equal(recordProblems(bad).length, 2);
  assert.throws(() => renderTable([bad]), /cannot render the ADR index/);
});

test("a numbered file or title is refused", () => {
  const root = tree("numbered", { "0002-x.md": record("0002 — X"), "ok.md": record("Ok") });
  const errors = recordErrors(root);
  assert.ok(errors.some((e) => /0002-x\.md: records are named <kebab-case-slug>\.md, with no number/.test(e)), errors.join("\n"));
  assert.ok(errors.some((e) => /the title carries a number/.test(e)), errors.join("\n"));
});

test("rendering is idempotent", () => {
  const root = tree("idem", { "one.md": record("One") });
  assert.equal(renderIndex(root), true);
  const once = readFileSync(join(root, "docs", "adr", "README.md"), "utf8");
  assert.equal(renderIndex(root), false);
  assert.equal(readFileSync(join(root, "docs", "adr", "README.md"), "utf8"), once);
});

test("this repository's own records are valid", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  assert.deepEqual(recordErrors(root), []);
  const r = spawnSync("node", [RENDER, "--records"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
