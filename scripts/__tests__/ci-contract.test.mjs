import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { inspectWorkspaces } from "../ci/workspace-contract.mjs";
import { checkResults } from "../ci/check-results.mjs";
import { CI_PATH_RE } from "../ci/ci-change-documented.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TMP = mkdtempSync(join(tmpdir(), "gym-ci-contract-"));
after(() => rmSync(TMP, { recursive: true, force: true }));
const scripts = { lint: "eslint .", "check-types": "tsc --noEmit", test: "jest --ci", build: "expo export" };
let sequence = 0;
function fixture({ mode = "bootstrap", workspaces = [] } = {}) {
  const root = join(TMP, String(++sequence));
  mkdirSync(join(root, ".ci"), { recursive: true });
  writeFileSync(join(root, ".ci/workspaces.json"), JSON.stringify({ mode, workspaces }));
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { "test:ci": "run-unit", "test:ci:full": "run-all" } }));
  writeFileSync(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n  - "packages/*"\n');
  return root;
}
function app(root, path = "apps/mobile", tasks = scripts) {
  mkdirSync(join(root, path), { recursive: true });
  writeFileSync(join(root, path, "package.json"), JSON.stringify({ name: "@repo/mobile", scripts: tasks }));
}

test("explicit empty bootstrap reports no application work", () => {
  assert.deepEqual(inspectWorkspaces(fixture()), { ready: false, workspaces: [] });
  assert.deepEqual(inspectWorkspaces(ROOT).workspaces, JSON.parse(readFileSync(join(ROOT, ".ci/workspaces.json"), "utf8")).workspaces);
});
test("unregistered app cannot silently stay in bootstrap", () => {
  const root = fixture(); app(root);
  assert.throws(() => inspectWorkspaces(root), /inventory mismatch/);
});
test("registering an app without leaving bootstrap fails", () => {
  const root = fixture({ workspaces: ["apps/mobile"] }); app(root);
  assert.throws(() => inspectWorkspaces(root), /Bootstrap mode/);
});
test("application mode requires an actual app, not an empty success", () => {
  assert.throws(() => inspectWorkspaces(fixture({ mode: "application" })), /at least one app/);
});
test("registered app with real task entrypoints enables application lanes", () => {
  const root = fixture({ mode: "application", workspaces: ["apps/mobile"] }); app(root);
  assert.deepEqual(inspectWorkspaces(root), { ready: true, workspaces: ["apps/mobile"] });
});
test("losing an expected workspace fails rather than suppressing its jobs", () => {
  assert.throws(() => inspectWorkspaces(fixture({ mode: "application", workspaces: ["apps/mobile"] })), /inventory mismatch/);
});
test("every application task and both strict unit entrypoints are mandatory", () => {
  for (const task of Object.keys(scripts)) {
    const root = fixture({ mode: "application", workspaces: ["apps/mobile"] });
    app(root, "apps/mobile", { ...scripts, [task]: "" });
    assert.throws(() => inspectWorkspaces(root), new RegExp(`must define ${task}`));
  }
  const root = fixture({ mode: "application", workspaces: ["apps/mobile"] }); app(root);
  writeFileSync(join(root, "package.json"), "{}");
  assert.throws(() => inspectWorkspaces(root), /Root must define test:ci/);
});
test("unknown modes, duplicate/traversal entries and partial app directories fail", () => {
  assert.throws(() => inspectWorkspaces(fixture({ mode: "other" })), /Unknown/);
  assert.throws(() => inspectWorkspaces(fixture({ workspaces: ["apps/mobile", "apps/mobile"] })), /Duplicate/);
  assert.throws(() => inspectWorkspaces(fixture({ workspaces: ["apps/../mobile"] })), /explicit/);
  const root = fixture(); mkdirSync(join(root, "apps/mobile"), { recursive: true });
  assert.throws(() => inspectWorkspaces(root), /no package.json/);
});
test("workspace symlinks cannot evade inventory", () => {
  const root = fixture(); mkdirSync(join(root, "apps")); symlinkSync(join(root, ".ci"), join(root, "apps/mobile"));
  assert.throws(() => inspectWorkspaces(root), /Symlink/);
});
test("inventory CLI emits explicit false and reports invalid inventory nonzero", () => {
  const root = fixture(); const output = join(root, "output"); const summary = join(root, "summary");
  const script = join(ROOT, "scripts/ci/workspace-contract.mjs");
  const positive = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary } });
  assert.equal(positive.status, 0, positive.stderr);
  assert.match(readFileSync(output, "utf8"), /application-ready=false/);
  assert.match(readFileSync(summary, "utf8"), /NOT run/);
  app(root);
  const negative = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  assert.equal(negative.status, 1); assert.match(negative.stderr, /inventory mismatch/);
});
test("aggregate accepts only known bootstrap skips or successful selected application work", () => {
  const bootstrap = { contracts: "success", ready: "false", staticResult: "skipped", tests: "skipped", code: "" };
  assert.equal(checkResults(bootstrap), null);
  const application = { contracts: "success", ready: "true", staticResult: "success", tests: "success", code: "true" };
  assert.equal(checkResults(application), null);
  assert.equal(checkResults({ ...application, code: "false", tests: "skipped" }), null);
  for (const status of ["failure", "cancelled", "skipped", "", "unknown"]) {
    assert.ok(checkResults({ ...application, contracts: status }));
    assert.ok(checkResults({ ...application, staticResult: status }));
    assert.ok(checkResults({ ...application, tests: status }));
  }
  for (const ready of ["", "unknown"]) assert.ok(checkResults({ ...application, ready }));
  for (const code of ["", "unknown"]) assert.ok(checkResults({ ...application, code }));
  assert.ok(checkResults({ ...bootstrap, staticResult: "success" }));
  assert.ok(checkResults({ ...bootstrap, tests: "success" }));
});
test("full-tree fingerprint preserves modes, runtime config, docs and base inputs", () => {
  const root = fixture();
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q"); git("add", ".");
  const tree = () => { git("add", "."); return git("write-tree"); };
  let before = tree();
  for (const file of ["pnpm-lock.yaml", "tsconfig.base.json", "README.md", "turbo.json", ".ci/workspaces.json"]) {
    writeFileSync(join(root, file), `tracked input ${file}\n`);
    const after = tree(); assert.notEqual(after, before, file); before = after;
  }
  assert.equal(tree(), before, "unchanged tree has unchanged evidence key");
  chmodSync(join(root, "README.md"), 0o755); assert.notEqual(tree(), before, "executable mode changes invalidate evidence");
});
test("workflow wires real root evidence, strict skips, validated engine and safe future app inputs", () => {
  const workflow = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const pin = "ea88024608cb8c9f5ce8fe655fb64e6866bbf469";
  assert.match(workflow, /node --test --test-reporter=tap --test-reporter=junit/);
  assert.match(workflow, new RegExp(`vitest-signal-guard@${pin}`));
  assert.match(workflow, /reports: reports\/junit\/root.xml/);
  assert.match(workflow, /needs: \[repository-contracts, static, tests\]/);
  assert.match(workflow, /run: node scripts\/ci\/check-results.mjs/);
  assert.match(workflow, /unit-junit-reports: apps\/mobile\/reports\/junit.xml/);
  assert.match(workflow, /unit-full-command: pnpm run test:ci:full/);
  assert.equal((workflow.match(/stack-aware: true/g) || []).length, 2);
  assert.equal((workflow.match(/fingerprint-command: git rev-parse 'HEAD\^\{tree\}'/g) || []).length, 4);
  assert.doesNotMatch(workflow, /skip-green: enforce|passWithNoTests|continue-on-error/);
  for (const path of [".ci/workspaces.json"]) assert.equal(CI_PATH_RE.test(path), true, path);
});

test("root signal requires the established suite, not zero, skipped or file-only successes", async () => {
  const { assertRootTestCount } = await import("../ci/root-test-count.mjs");
  assert.equal(assertRootTestCount("# pass 30\n# fail 0\n"), 30);
  for (const tap of ["", "# pass 0\n# fail 0\n", "# pass 3\n# fail 0\n", "# pass 30\n# fail 1\n", "# pass 30\n# fail 0\n# pass 0\n# fail 0\n"]) assert.throws(() => assertRootTestCount(tap));
});


test("changing pnpm workspace roots cannot hide an unregistered application", () => {
  const root = fixture();
  writeFileSync(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "services/*"\n');
  assert.throws(() => inspectWorkspaces(root), /Workspace globs changed/);
});
