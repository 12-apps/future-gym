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
| E-003 | Pipeline on the engine: `static` + `tests` from 12-apps/ci, `ci-success` aggregating them |

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

**Addendum (2026-09-30):** What the first GitHub run found.

- **The failure:** run 36707073096 (job 109859741852, `ubuntu-latest`, git 2.55) failed 1 of 16 tests. The case "CLI: on a pull-request checkout the base is the merge commit's first parent" got `base: origin/main tip (fetched now)`. The `--deepen=1 origin` fetch that finds the merge parent on git 2.43 left the merge commit parentless on git 2.55. The gate then fell back to a base tip fetched later. That fallback can only over-demand an entry, never hide one, but it is not the exact base.
- **The fix:** when the merge parent is still missing, the gate fetches the merge commit itself with `--depth=2`, which brings its parents in. The runner had already shown a fetch by SHA working in that same test.
- **The new test:** "…when --deepen leaves the merge commit parentless…" forces that path with `CI_DOC_SKIP_DEEPEN=1`. It fails with the `--depth=2` fetch removed and passes with it. The suite is now 17 tests, and the regression watch count above reads 17.

**Addendum (2026-09-30):** The fix, confirmed on the hosted runner.

- **The run:** run 36707315755 (job 109860525317, `ubuntu-latest`, git 2.55.0) passed 17/17 tests.
- **The gate's own line:** `[ci-change-documented] base: merge parent (the base tip this run merged into) · 44 changed path(s) · 2 entries in docs/ci/EXPERIMENTS.md` then `ok`, followed by `[adr-index] records ok`.
- **Still owed:** a follow-up PR that changes a workflow with no entry here, to watch `ci-success` go red on GitHub, not only in the CLI test.

### E-003 — Pipeline on the engine: do 12-apps/ci's `monorepo-static` and `monorepo-tests` run green on a repository with no workspaces yet?

**Status:** Open — 2026-09-30

**Question:** Can `.github/workflows/ci.yml` call the engine tiers exactly as `12-apps/future-pay` and `12-apps/base-app` do, before `apps/mobile` exists, without either tier failing or reporting work it did not do?
- `static` is `12-apps/ci/.github/workflows/monorepo-static.yml@v2`.
- `tests` is `monorepo-tests.yml@v2`.
- `ci-success` aggregates both and runs the root suite, as future-pay runs `ci-root-suite.mjs` in its own `ci-success`.

**Method:**
- The engine's tiers are pnpm + turbo (a frozen-lockfile install, then turbo's lint, check-types and test tasks), so the repository root became a monorepo on base-app's conventions:
  - `package.json` with `packageManager: pnpm@10.34.5` (future-pay's) and exact pins `@12-apps/eslint-config@1.22.0` and `@12-apps/typescript-config@1.21.0` (future-pay's catalog);
  - `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` and `tsconfig.base.json` (base-app's);
  - a committed `pnpm-lock.yaml`.
- Both engine tiers use `stack-aware: true`, like base-app.
- The hand-rolled single job from E-002 moved into `ci-success`, after the aggregation step.

**Result:** Measured locally:
- The frozen-lockfile install passes.
- Turbo's lint, check-types and test tasks exit 0 with `Tasks: 0 successful, 0 total` ("No tasks were executed"), because there is no workspace yet.
- The script suite passes 17/17.

The first GitHub run is the push that adds this to 12-apps/future-gym#1.

**Why:** Zero turbo tasks is the honest state until story 0 of GYM-1 adds `apps/mobile`. The zero-test guard in `monorepo-tests` is opt-in (`unit-junit-reports`) and not set here. So a green `tests` tier means nothing ran, and it is not evidence of coverage until a workspace exists.

**Evidence:**
- `.github/workflows/ci.yml`
- `package.json`
- `pnpm-lock.yaml`
- The engine's declared inputs, from `monorepo-static.yml` and `monorepo-tests.yml` at `v2`.

**Regression watch:**
- **Aggregation:** `ci-success` lists every tier in `needs` (a failed `static` skips `tests`, and a skip is not a failure).
- **Tier inputs:** the `with:` keys stay within the engine's declared inputs.
- **Zero tasks:** once `apps/mobile` lands, a `tests` run reporting 0 tasks is a regression. Set `unit-junit-reports` then, so the zero-test guard arms.

**Addendum (2026-09-30):** What the first GitHub run found.

- **The failure:** run 36707818061 ended in `startup_failure` with no job created. A reusable workflow's jobs may only request permissions the caller grants.
  - `monorepo-static.yml@v2` has a job declaring `actions: read` (its retry gate).
  - The `static` caller granted only `contents: read` and `pull-requests: read`.
  - future-pay's `static` grants `actions: read` for exactly this reason.
- **The fix:** `static` now grants it. `monorepo-tests.yml@v2` declares only `contents: read`, which `tests` already grants.
- **Added to the regression watch:** each engine caller grants a superset of the scopes its reusable workflow's jobs declare. Re-read them when `v2` moves: `grep -n "permissions" -A4` over the engine file.

**Addendum (2026-09-30):** The engine pipeline, confirmed on GitHub.

- **The run:** run 36707923606 (after the permissions fix) completed `success`. Static ran Detect Changes, Lint, Type Check and Actionlint, all success, with Retry Gate skipped since there was no previous failure. Tests ran Unit Plan, Unit Tests and Build, all success, with the integration lanes skipped because this repo declares none. CI Success was success.
- **Zero tasks, as predicted:** the Lint and Unit Tests logs both read `Tasks: 0 successful, 0 total` ("No tasks were executed"). Until `apps/mobile` exists, green tiers ran nothing.
- **The root suite in `ci-success`:** `job results: success success`, then `# tests 17 # pass 17 # fail 0`, then `base: merge parent (the base tip this run merged into) · 49 changed path(s) · 3 entries`, then `ok`, then `[adr-index] records ok`.

### E-004 — Validated engine baseline and explicit bootstrap: can green mean real work without an app?

**Status:** Open — 2026-09-30

**Question:** Can this repository consume the validated Future Pay CI safety baseline without claiming that its absent application passed lint, types, tests or build?

**Method:**
- Start from `main` at `d21964935641c9d742a8702b0b1c3129bb6337b9`, not the already-merged feature branch that remains the repository's default. No repository setting is changed.
- Pin consumer workflow/action entrypoints to `12-apps/ci@be3300542208ebab5b30a75f58d018518f9d3459` (v2.48.2). The engine's own internal major-tag references remain its release contract; this is not a claim that transitive actions are immutable.
- Run the real root regression suite on every PR and main push, emit Node JUnit, and call the shared signal guard without a bypass condition. Workflow syntax, the CI documentation rule and ADR records also remain mandatory.
- Declare `.ci/workspaces.json` as explicit bootstrap state. Unregistered workspaces, missing expected workspaces, invalid manifests and undeclared task entrypoints fail closed. Only an empty declared bootstrap may omit application lanes, with an explicit notice that no app was built or tested. CI descriptor changes require this log too.
- Prewire application lanes for stack-aware selection, strict PR/full unit commands, JUnit signal guarding and one shard. Whole-tree fingerprints use `git rev-parse 'HEAD^{tree}'`: every tracked input, file mode, global config and document is covered. No app-specific ignore list is guessed.
- The final check separately validates required repository work and the only allowed application skip states. A failed or cancelled producer cannot be hidden by skipped dependents.

**Result:** Baseline root suite: 17/17 tests, 747.8 ms locally on Node 24.19.0. The expanded root suite has 30 tests, including positive application inventory, unexpected/missing workspace negatives, all aggregate failure/skip states, and complete-tree fingerprint invariants. Hosted run IDs and runner measurements will be appended after the draft PR executes. No app workspace, app build, APK, selective test plan or actual fingerprint cache reuse has been validated yet.

**Why:** E-003's green zero-task tiers provided no application evidence. Skipping explicitly absent work while requiring real repository tests is truthful; fabricating a workspace or a passing build is not. Platform clarification is still pending, so this change does not select React web over the accepted Expo Android architecture. Per-test selection, skip-green shadow measurement and runtime-specific caches must be connected to the actual app runner before they can be claimed.

**Evidence:**
- GYM-2 tracks this CI-only portion; GYM-1's screenless app foundation is not implemented by it.
- `.github/workflows/ci.yml`, `.ci/workspaces.json`, `scripts/ci/workspace-contract.mjs`, `scripts/ci/check-results.mjs`.
- `scripts/__tests__/ci-contract.test.mjs` keeps the configuration assertions consumer-side; signal parsing and cache provenance remain engine-owned.

**Regression watch:**
- Root JUnit must contain executed test cases. Missing, zero, all-skipped and malformed reports must fail the shared guard; the root command must fail on a failing assertion.
- Adding `apps/mobile` without registering it and leaving bootstrap must fail; deleting a registered app must fail. The descriptor is not an optional auto-discovery escape hatch.
- An invalid readiness or code-selection output, failed/cancelled root/static/test job, or unexpected application skip makes `CI Success` red.
- Application enablement requires the actual app's strict test commands to write fresh workspace JUnit under `reports/junit/workspaces`, plus lint/typecheck/test/build task implementations. A structural inventory alone does not prove those commands execute useful work.
- On app introduction, validate the chosen runner's real positive/negative selection, unchanged-input reuse, changed-input invalidation and full push safety net. Keep per-test skip-green off until shadow evidence exists.
- Revert the optimization inputs if their run evidence cannot establish the guard and input-coverage contract; do not retain a green skip as proof of execution.

**Addendum (2026-09-30):** The first hosted positive run, [36727498141](https://github.com/12-apps/future-gym/actions/runs/36727498141), executed 30/30 real root cases in 701.3 ms on Node 22. The shared signal guard reported 30 executed cases, the documentation gate used the exact merge parent, ADR records and Actionlint passed, and application lanes were explicitly skipped. A local negative selection probe found that Node 24 can report three successful file-wrapper cases when a name filter selects no real tests. The shared JUnit parser sees those as cases. A consumer-specific root TAP baseline now requires at least the already-established 30 passing cases with an unambiguous zero-failure summary; zero, all-skipped, file-only and ambiguous results are permanent negative tests. This does not alter the shared JUnit parser or claim application signal coverage.

**Addendum (2026-09-30):** Hosted negative proof [36728005584](https://github.com/12-apps/future-gym/actions/runs/36728005584), commit `bdaa174ede5f0c9687df308a5afa55ba91c3a80f`, deliberately replaced the root suite invocation with one real Node `test.skip` case. The runner command exited successfully, but `Require executed root tests` failed on zero executed cases. `Repository Contracts` and `CI Success` both failed; skipped application dependents did not hide the failure. The probe is removed in the next commit, not merged. The local suite is now 32/32, adding the root count baseline and a negative workspace-glob mutation so changing pnpm roots cannot silently hide an app from the explicit inventory. The final restored hosted run remains to be verified.
