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
