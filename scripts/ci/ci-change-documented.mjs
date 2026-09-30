#!/usr/bin/env node
/**
 * EVERY CI CHANGE LANDS WITH AN ENTRY IN docs/ci/EXPERIMENTS.md, AND NO ENTRY
 * IS EVER LOST (docs/adr/every-ci-change-is-documented.md).
 *
 * Ported from 12-apps/future-pay `scripts/ci/ci-change-documented.mjs` (its
 * ADR 0069); only the CI paths and the record it cites differ.
 *
 * Two properties over a pull request's diff against its base:
 *
 *   1. A pull request that changes CI — `.github/workflows/`, `scripts/ci-*.mjs`,
 *      `scripts/ci/`, and what the post-merge job runs (`scripts/post-merge-regen.mjs`,
 *      `scripts/adr/`) — also changes `docs/ci/EXPERIMENTS.md`. The entry is where
 *      the measurement gets written down, so that the next change can compare
 *      against it instead of re-deriving it.
 *   2. Every `### E-NNN` entry present in the log at the base is present at the
 *      head, and its base text is a PREFIX of its head text. The log is a trail:
 *      a correction is an addendum at the end of the entry or a new entry, never
 *      a rewrite. Ids stay unique and ascending.
 *
 * ## Where the base comes from
 *
 * `ci-success` (.github/workflows/ci.yml) checks out at depth 1 — there is no merge base to compute. On a
 * pull request the checkout IS the merge of the head into the base tip as it
 * was when the run started, so the merge commit's FIRST PARENT is that tip and
 * `HEAD^1..HEAD` is exactly the pull request's change set. One `--deepen=1`
 * fetch brings the parents in without any history. (Fetching the base tip at
 * gate time was the first version: measured on run 36670993318, `main` had
 * moved during the run and the diff read 26 paths for a 9-file PR — extra
 * paths only ever ADD to the demand, never hide one, but the parent is exact.)
 * Locally the merge base with `origin/main` is used. With neither
 * available the gate cannot judge the tree and SAYS SO — a notice, and a pass —
 * rather than failing a run it did not check; enforcement rests on the
 * pull-request run, which always has a base.
 *
 * Renovate's branches (`chore/renovate-*`, `renovate/*`) are exempt from (1): a
 * pin bump is not an experiment. They are not exempt from (2).
 *
 * Node builtins only, no install needed. `CI_DOC_BASE` overrides the base ref
 * (the tests use it); `CI_DOC_HEAD_REF` overrides the branch name.
 *
 * Usage:
 *   node scripts/ci/ci-change-documented.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

export const LOG = "docs/ci/EXPERIMENTS.md";

/** What counts as "CI" for rule (1). Kept in one place so the ADR and the gate agree. */
export const CI_PATH_RE = /^(\.ci\/|\.github\/workflows\/|scripts\/ci-[^/]+\.mjs$|scripts\/ci\/|scripts\/post-merge-regen\.mjs$|scripts\/adr\/)/;

export const RENOVATE_BRANCH_RE = /^(chore\/renovate-|renovate\/)/;

const ENTRY_RE = /^### (E-\d{3,}) — /gm;

/** `[{ id, body }]` in file order; `body` is the text from the heading to the next heading. */
export function parseEntries(text) {
  const heads = [...text.matchAll(ENTRY_RE)].map((m) => ({ id: m[1], at: m.index }));
  return heads.map((h, i) => ({ id: h.id, body: text.slice(h.at, i + 1 < heads.length ? heads[i + 1].at : text.length).trimEnd() }));
}

/** Rule (1): a CI change carries a log change, Renovate's pin bumps aside. */
function entryRuleProblems(changed, headRef) {
  const ciChanges = changed.filter((p) => CI_PATH_RE.test(p));
  if (ciChanges.length === 0 || changed.includes(LOG) || RENOVATE_BRANCH_RE.test(headRef)) return [];
  return [
    `${ciChanges.length} CI path(s) changed and ${LOG} did not — every CI change lands with an entry (docs/adr/every-ci-change-is-documented.md):\n` +
      ciChanges.map((p) => `    ${p}`).join("\n"),
  ];
}

/** Ids stay unique and ascending in file order. */
function idProblems(head) {
  const problems = [];
  const ids = head.map((e) => e.id);
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupes.length) problems.push(`duplicate entry id(s) in ${LOG}: ${dupes.join(", ")}`);
  const numbers = ids.map((id) => Number(id.slice(2)));
  if (numbers.some((n, i) => i > 0 && n <= numbers[i - 1])) problems.push(`entry ids in ${LOG} must be ascending in file order: ${ids.join(", ")}`);
  return problems;
}

/** Rule (2): every base entry survives at the head, and only ever grows at its end. */
function appendOnlyProblems(baseLog, head) {
  if (baseLog === null) return [];
  const headById = new Map(head.map((e) => [e.id, e.body]));
  return parseEntries(baseLog).flatMap((entry) => {
    const now = headById.get(entry.id);
    if (now === undefined) return [`${entry.id} was in ${LOG} at the base and is gone at the head — entries are never deleted.`];
    if (!now.startsWith(entry.body)) return [`${entry.id} was rewritten — a past entry is only ever APPENDED to (an addendum at its end); its base text must remain a prefix of the head text.`];
    return [];
  });
}

/**
 * The pure decision. Returns the list of problems (empty = pass).
 *
 * @param {object} o
 * @param {string[]} o.changed     paths the pull request changes
 * @param {string|null} o.baseLog  the log at the base, or null when it did not exist there
 * @param {string|null} o.headLog  the log at the head, or null when missing
 * @param {string} [o.headRef]     the branch name, for the Renovate exemption
 */
export function checkDocumented({ changed, baseLog, headLog, headRef = "" }) {
  const problems = entryRuleProblems(changed, headRef);
  if (headLog === null) return [...problems, `${LOG} is missing at the head — it is the append-only record of every CI change and may not be removed.`];
  const head = parseEntries(headLog);
  return [...problems, ...idProblems(head), ...appendOnlyProblems(baseLog, head)];
}

// ── git plumbing ─────────────────────────────────────────────────────────────

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function tryGit(cwd, ...args) {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
}

/** The ref to diff against, or null with the reason when none is available. */
export function resolveBase(cwd, env = process.env) {
  if (env.CI_DOC_BASE) return { ref: env.CI_DOC_BASE, how: "CI_DOC_BASE" };
  if (env.GITHUB_EVENT_NAME === "pull_request" && env.GITHUB_BASE_REF) {
    // The PR checkout is the MERGE of the head into the base tip as it was when
    // the run started. Its first parent is that tip, so `HEAD^1..HEAD` is the
    // pull request's change set exactly. A depth-1 checkout does not have the
    // parents; deepening by one commit brings them in without any history.
    //
    // Measured on the GitHub-hosted runner (git 2.55, run 36707073096): the
    // `--deepen=1 origin` fetch that works on git 2.43 left the merge commit
    // parentless there, and the gate fell back to a base tip fetched later.
    // Fetching the merge commit itself two deep brings its parents in on both.
    const mergeParent = () => {
      const parents = (tryGit(cwd, "rev-list", "--parents", "-n", "1", "HEAD") ?? "").split(" ");
      return parents.length >= 3 && tryGit(cwd, "cat-file", "-e", `${parents[1]}^{commit}`) !== null ? parents[1] : null;
    };
    const how = "merge parent (the base tip this run merged into)";
    if (!mergeParent() && process.env.CI_DOC_SKIP_DEEPEN !== "1") tryGit(cwd, "fetch", "--no-tags", "--deepen=1", "origin");
    if (mergeParent()) return { ref: mergeParent(), how };
    const head = tryGit(cwd, "rev-parse", "HEAD");
    if (head) tryGit(cwd, "fetch", "--no-tags", "--depth=2", "origin", head);
    if (mergeParent()) return { ref: mergeParent(), how };
    // Not a merge checkout (a fork, a custom ref): the base tip fetched now is
    // the closest available. It can be NEWER than the tip the run used, which
    // only ever ADDS paths to the diff — a false demand for an entry is loud;
    // it never hides one.
    if (tryGit(cwd, "fetch", "--no-tags", "--depth=1", "origin", env.GITHUB_BASE_REF) !== null) return { ref: "FETCH_HEAD", how: `origin/${env.GITHUB_BASE_REF} tip (fetched now)` };
    return { ref: null, why: `could not fetch origin/${env.GITHUB_BASE_REF}` };
  }
  const mergeBase = tryGit(cwd, "merge-base", "origin/main", "HEAD");
  if (mergeBase) return { ref: mergeBase, how: "merge-base(origin/main, HEAD)" };
  return { ref: null, why: "no pull-request context and no origin/main to compute a merge base from" };
}

function showAt(cwd, ref, path) {
  return tryGit(cwd, "show", `${ref}:${path}`);
}

function report(base, changed, headLog, problems) {
  const entries = headLog ? parseEntries(headLog).length : 0;
  console.log(`[ci-change-documented] base: ${base.how} · ${changed.length} changed path(s) · ${entries} entr${entries === 1 ? "y" : "ies"} in ${LOG}`);
  if (problems.length === 0) {
    console.log("[ci-change-documented] ok");
    return 0;
  }
  for (const p of problems) console.error(`::error title=ci-change-documented::${p}`);
  console.error(`\n[ci-change-documented] ${problems.length} problem(s). docs/ci/EXPERIMENTS.md has the entry template; docs/adr/every-ci-change-is-documented.md has the rule.`);
  return 1;
}

function main() {
  const cwd = process.env.CI_DOC_REPO || REPO_ROOT;
  const base = resolveBase(cwd);
  if (!base.ref) {
    console.log(`::notice::[ci-change-documented] no base to diff against (${base.why}) — nothing checked here; the pull-request run enforces docs/adr/every-ci-change-is-documented.md.`);
    return 0;
  }
  const changed = (tryGit(cwd, "diff", "--name-only", base.ref, "HEAD") ?? "").split("\n").filter(Boolean);
  const baseLog = showAt(cwd, base.ref, LOG);
  const headPath = join(cwd, LOG);
  const headLog = existsSync(headPath) ? readFileSync(headPath, "utf8") : null;
  const headRef = process.env.CI_DOC_HEAD_REF ?? process.env.GITHUB_HEAD_REF ?? tryGit(cwd, "rev-parse", "--abbrev-ref", "HEAD") ?? "";
  return report(base, changed, headLog, checkDocumented({ changed, baseLog, headLog, headRef }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main());
