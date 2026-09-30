#!/usr/bin/env node
/**
 * The gate behind docs/adr/every-ci-change-is-documented.md: a CI change lands
 * with a log entry, and the log only grows. Run via
 * `node --test scripts/__tests__/`, which `ci-success` does on every pull request.
 * Ported from 12-apps/future-pay.
 *
 * Both halves fail silently when broken — a gate that never fires still prints
 * "ok" — so each case below is a shape a real pull request produces, and the
 * mutation direction (the case that MUST fail) gets the most cases.
 *
 * Node builtins only: this runs in `ci-success`, no install.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { CI_PATH_RE, LOG, checkDocumented, parseEntries } from "../ci/ci-change-documented.mjs";
// A git hook exports GIT_DIR (and friends), which beats `cwd:` and `git -C`:
// the fixtures below would then write into the real repository. Scrub them.
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_PREFIX", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"]) delete process.env[k];

const GATE = join(dirname(fileURLToPath(import.meta.url)), "..", "ci", "ci-change-documented.mjs");
const TMP = mkdtempSync(join(tmpdir(), "ci-change-documented-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

const E1 = "### E-001 — first\n**Status:** Worked\nbody one\n";
const E2 = "### E-002 — second\n**Status:** Open\nbody two\n";
const HEADER = "# log\n\nintro\n\n";

test("what counts as CI", () => {
  for (const p of [".github/workflows/ci.yml", ".github/workflows/post-merge-regen.yml", "scripts/ci-x.mjs", "scripts/ci/ci-change-documented.mjs", "scripts/post-merge-regen.mjs", "scripts/adr/records.mjs"])
    assert.ok(CI_PATH_RE.test(p), p);
  for (const p of ["apps/mobile/app/index.tsx", "index.html", "docs/ci/EXPERIMENTS.md", "docs/adr/README.md", "scripts/__tests__/ci-change-documented.test.mjs", "package.json"])
    assert.ok(!CI_PATH_RE.test(p), `${p} is not CI`);
});

test("entries parse in order, body up to the next heading", () => {
  const e = parseEntries(HEADER + E1 + E2);
  assert.deepEqual(e.map((x) => x.id), ["E-001", "E-002"]);
  assert.equal(e[0].body, E1.trimEnd());
});

test("a CI change with a log entry passes; without one it fails and names the paths", () => {
  const base = HEADER + E1;
  assert.deepEqual(checkDocumented({ changed: [".github/workflows/ci.yml", LOG], baseLog: base, headLog: base + E2 }), []);
  const problems = checkDocumented({ changed: [".github/workflows/ci.yml", "scripts/ci/x.mjs"], baseLog: base, headLog: base });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /2 CI path\(s\) changed/);
  assert.match(problems[0], /\.github\/workflows\/ci\.yml/);
});

test("a change that touches no CI path needs no entry", () => {
  const base = HEADER + E1;
  assert.deepEqual(checkDocumented({ changed: ["apps/mobile/app/index.tsx", "README.md"], baseLog: base, headLog: base }), []);
});

test("Renovate's branches are exempt from the entry rule, not from the append-only rule", () => {
  const base = HEADER + E1;
  assert.deepEqual(checkDocumented({ changed: [".github/workflows/ci.yml"], baseLog: base, headLog: base, headRef: "chore/renovate-actions" }), []);
  const p = checkDocumented({ changed: [".github/workflows/ci.yml", LOG], baseLog: base, headLog: HEADER, headRef: "renovate/x" });
  assert.equal(p.length, 1);
  assert.match(p[0], /E-001 was in .* and is gone/);
});

test("deleting an entry fails; rewriting one fails; appending an addendum passes", () => {
  const base = HEADER + E1 + E2;
  assert.match(checkDocumented({ changed: [LOG], baseLog: base, headLog: HEADER + E2 })[0], /E-001 .* gone/);
  const rewritten = HEADER + "### E-001 — first\n**Status:** Failed\nbody one\n" + E2;
  assert.match(checkDocumented({ changed: [LOG], baseLog: base, headLog: rewritten })[0], /E-001 was rewritten/);
  const addendum = HEADER + E1 + "\n**Addendum (2026-10-01):** the number was 12, not 11.\n\n" + E2;
  assert.deepEqual(checkDocumented({ changed: [LOG], baseLog: base, headLog: addendum }), []);
});

test("ids must be unique and ascending; the log may not vanish", () => {
  assert.match(checkDocumented({ changed: [], baseLog: null, headLog: HEADER + E1 + E1 })[0], /duplicate entry id/);
  assert.match(checkDocumented({ changed: [], baseLog: null, headLog: HEADER + E2 + E1 })[0], /ascending/);
  assert.match(checkDocumented({ changed: [LOG], baseLog: HEADER + E1, headLog: null })[0], /missing at the head/);
});

test("a log that did not exist at the base (this PR adds it) is fine", () => {
  assert.deepEqual(checkDocumented({ changed: [".github/workflows/ci.yml", LOG], baseLog: null, headLog: HEADER + E1 }), []);
});

// ── the CLI over a real repository ──────────────────────────────────────────

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function repo(name) {
  const dir = join(TMP, name);
  mkdirSync(join(dir, "scripts", "lib"), { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.test");
  git(dir, "config", "user.name", "T");
  git(dir, "config", "commit.gpgsign", "false");
  return dir;
}
function put(dir, files, message) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
    git(dir, "add", "--", path);
  }
  git(dir, "commit", "-qm", message);
}
function run(dir, base, headRef = "feat/x") {
  return spawnSync("node", [GATE], { cwd: dir, encoding: "utf8", env: { ...process.env, CI_DOC_REPO: dir, CI_DOC_BASE: base, CI_DOC_HEAD_REF: headRef, GITHUB_EVENT_NAME: "", GITHUB_BASE_REF: "" } });
}

test("CLI: a CI change plus an appended entry passes; the same change without the entry fails", () => {
  const dir = repo("cli");
  put(dir, { [LOG]: HEADER + E1, ".github/workflows/ci.yml": "name: CI\n", "package.json": "{}\n" }, "base");
  const base = git(dir, "rev-parse", "HEAD");
  put(dir, { ".github/workflows/ci.yml": "name: CI\non: push\n", [LOG]: HEADER + E1 + E2 }, "documented change");
  const ok = run(dir, base);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /2 changed path\(s\) · 2 entries/);
  put(dir, { ".github/workflows/ci.yml": "name: CI\non: pull_request\n" }, "undocumented change");
  const red = run(dir, git(dir, "rev-parse", "HEAD~1"));
  assert.equal(red.status, 1);
  assert.match(red.stderr, /::error title=ci-change-documented::1 CI path\(s\) changed/);
});

test("CLI: no base at all is a notice and a pass, never a silent pass", () => {
  const dir = repo("cli-nobase");
  put(dir, { [LOG]: HEADER + E1 }, "base");
  const r = spawnSync("node", [GATE], { cwd: dir, encoding: "utf8", env: { ...process.env, CI_DOC_REPO: dir, CI_DOC_BASE: "", GITHUB_EVENT_NAME: "", GITHUB_BASE_REF: "" } });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /::notice::\[ci-change-documented\] no base to diff against/);
});

test("CLI: on a pull-request checkout the base is the merge commit's first parent, not a tip fetched later", () => {
  // A remote whose main moves AFTER the merge commit was cut: the fetched tip
  // would show the mover's file as changed; the merge parent does not.
  const remote = repo("pr-remote");
  put(remote, { [LOG]: HEADER + E1, "README.md": "r\n", ".github/workflows/ci.yml": "name: CI\n" }, "base");
  const baseTip = git(remote, "rev-parse", "HEAD");
  git(remote, "checkout", "-q", "-b", "feat/x");
  put(remote, { "docs/x.md": "x\n" }, "docs only");
  const head = git(remote, "rev-parse", "HEAD");
  git(remote, "checkout", "-q", "main");
  git(remote, "checkout", "-q", "-b", "pr-merge", baseTip);
  git(remote, "merge", "-q", "--no-ff", "-m", "merge", head);
  const mergeSha = git(remote, "rev-parse", "HEAD");
  git(remote, "update-ref", "refs/pull/1/merge", mergeSha);
  git(remote, "checkout", "-q", "main");
  put(remote, { ".github/workflows/ci.yml": "name: CI\non: push\n" }, "main moves a workflow after the merge was cut");
  const local = join(TMP, "pr-local");
  execFileSync("git", ["clone", "-q", "--depth=1", "--no-checkout", `file://${remote}`, local], { stdio: "ignore" });
  git(local, "fetch", "--depth=1", "origin", `+${mergeSha}:refs/remotes/pull/1/merge`);
  git(local, "checkout", "-q", mergeSha);
  const r = spawnSync("node", [GATE], { cwd: local, encoding: "utf8", env: { ...process.env, CI_DOC_REPO: local, CI_DOC_BASE: "", CI_DOC_HEAD_REF: "feat/x", GITHUB_EVENT_NAME: "pull_request", GITHUB_BASE_REF: "main" } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /base: merge parent/);
  assert.match(r.stdout, /1 changed path\(s\)/, "only the PR's own docs/x.md — not the workflow main changed afterwards");
});
