# CI experiments log

Append-only. Every CI experiment, measurement and outcome in this repository, with the invariant a later change could break. Read the entry for a mechanism before you touch it; add one when you change it. Never delete, reorder or rewrite a past entry: a later finding is an `**Addendum (YYYY-MM-DD):**` paragraph at the end of the entry it amends, or a new entry that cites it.

## Template

```
### E-NNN — <mechanism>: <question>

**Status:** Open | Confirmed | Refuted — YYYY-MM-DD
**Question:** what we wanted to know.
**Method:** what was run, where.
**Result:** the numbers, with run ids.
**Why:** the explanation the result supports.
**Evidence:** links, file:line.
**Regression watch:** the invariant, and the check that pins it.
```

## Index

| Entry | Mechanism |
| --- | --- |
| E-001 | Post-merge regeneration (ADR index) |
| E-002 | Pull-request gate `ci-success`: the documentation rule and the ADR record check |

## Entries

### E-001 — Post-merge regeneration: does the ADR index render on `main` without a PR ever touching it?

**Status:** Open — 2026-09-30

**Question:** Can every pull request that adds an ADR leave `docs/adr/README.md` alone, with the index rendered after the merge instead? Two PRs would then never conflict on the table's last row.

**Method:**
- `.github/workflows/post-merge-regen.yml` calls `12-apps/ci/.github/workflows/post-merge-regen.yml@v2` on `push: main` and `workflow_dispatch`, with `command: node scripts/post-merge-regen.mjs`.
- The engine lands the diff as one auto-merged PR, limited by `allow-paths: docs/adr/README.md`.
- The mechanism and its inputs were copied from 12-apps/future-pay's `post-merge-regen.yml` (FUT-3073), with the numbering step dropped: records here are never numbered.

**Result:** Not run on GitHub yet, because the workflow first reaches `main` with GYM-1. Measured locally:
- `node scripts/post-merge-regen.mjs` renders the table.
- A second run reports `unchanged`, so the script is idempotent.
- A numbered record, or one without `Status` date, `Lane` or `Summary`, throws and exits 1.

**Why:** Only the post-merge job ever writes the table.

**Evidence:**
- `scripts/adr/records.mjs` (`renderTable`, `recordProblems`)
- `scripts/adr/render-index.mjs`
- The engine's declared inputs: `command`, `title`, `body`, `base`, `branch-prefix`, `allow-paths`, `commit-author`, `node-version`, and the `PR_TOKEN` secret.

**Regression watch:**
- `node scripts/adr/render-index.mjs --check` exits 0 on `main` after the regen PR lands.
- The workflow's `with:` keys stay a subset of the engine's declared inputs, since an undeclared input fails the call.
- `allow-paths` stays limited to `docs/adr/README.md`.
- The run needs the `RENOVATE_TOKEN` secret; without it, the job fails at `land`.

### E-002 — Pull-request gate: does `ci-success` enforce the documentation rule and the ADR record check on a real PR?

**Status:** Open — 2026-09-30

**Question:** On a real pull request, does the new `ci-success` job (`.github/workflows/ci.yml`) do three things?
- find the exact base;
- fail a CI change that has no entry here;
- refuse a malformed or numbered ADR?

**Method:**
- `ci-success` runs three steps: `node --test "scripts/__tests__/*.test.mjs"`, `node scripts/ci/ci-change-documented.mjs` and `node scripts/adr/render-index.mjs --records`.
- The gate is ported from 12-apps/future-pay (`scripts/ci/ci-change-documented.mjs`, its ADR 0069), with `CI_PATH_RE` narrowed to this repository: `.github/workflows/`, `scripts/ci-*.mjs`, `scripts/ci/`, `scripts/post-merge-regen.mjs`, `scripts/adr/`.
- It is a consumer-side gate (memory `ci-engine-or-consumer`): its subject is this repository's own log and records.

**Result:** Locally, 16/16 tests pass. The 11 gate tests come from future-pay. They include:
- a CLI case where the undocumented change fails;
- the no-base notice;
- the pull-request merge-parent base.

The 5 ADR-index tests cover:
- ordering;
- missing fields;
- a numbered file or title being refused;
- idempotence;
- this repository's own records being valid.

The first GitHub run is the PR that adds the workflow (12-apps/future-gym#1).

**Why:** A gate that has only ever passed has not been tested (memory `ci-work-must-be-tested`). The follow-up is a PR that changes a workflow without an entry and must go red.

**Evidence:**
- `scripts/ci/ci-change-documented.mjs`
- `scripts/__tests__/ci-change-documented.test.mjs`
- `scripts/__tests__/adr-index.test.mjs`
- `.github/workflows/ci.yml`

**Regression watch:**
- `CI_PATH_RE` covers every file the workflows run. A new CI script outside those paths needs the regex widened in the same PR.
- The job keeps `fetch-depth: 1` plus the gate's `--deepen=1`, so the base is the merge commit's first parent (test "CLI: on a pull-request checkout…").
- The test step reads the test COUNT, not only the exit code: the glob must match the files (16 today).
