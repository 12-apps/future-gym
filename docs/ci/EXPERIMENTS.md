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

**Addendum (2026-09-30):** Restored-code validation [36728281249](https://github.com/12-apps/future-gym/actions/runs/36728281249), commit `7a12014df562203abbb462ce028a4c0934b3352d`, passed: 32/32 actual root cases in 720.1 ms, JUnit signal 32, root baseline 32, workflow lint, documentation and ADR checks. `CI Success` was green with both application calls explicitly skipped. The experiment's all-skipped runner substitution is absent from this commit. Local frozen workflow-schema comparison confirms all 5 static and 8 test inputs are declared by v2.48.2. Consumer peer review found no bootstrap/aggregate blocker; the application full-push guard limitation is explicitly recorded in `BOOTSTRAP.md` and must be resolved before app activation.

**Addendum (2026-09-30):** Existing post-merge regeneration remains separately blocked by a missing PR token. This predates this PR: main commit `d21964935641c9d742a8702b0b1c3129bb6337b9`, run [36711353985](https://github.com/12-apps/future-gym/actions/runs/36711353985), job `109873754341`, failed with `post-merge-regen: pr-token is required; a PR opened with GITHUB_TOKEN never gets its checks`. This port does not create or transmit credentials, change auto-merge/security settings, or claim to have fixed that existing blocker. The separately successful CI run for that same baseline is `36711354172`.

### E-005 — Expo foundation: can the application lanes prove actual native work?

**Status:** Open — 2026-09-30

**Question:** After explicit confirmation of Expo/React Native Android, can the first screenless app execute real lint, typechecking, native tests and an Android bundle, with strict execution evidence on both PR and full runs?

**Method:**
- Add only `apps/mobile` on Expo SDK 57, React Native 0.86.3, React 19.2.3 and expo-router. Native appearance comes from `@12-apps/ui` deep imports; locale comes from `@12-apps/i18n`. No workout features or backend are added.
- Activate the explicit workspace inventory. Keep the root contracts mandatory and the sole native workspace's test set full: no unverified Vitest plan is applied to Jest.
- The native Jest wrapper removes stale reports, executes the actual native-renderer tests, emits JSON plus JUnit and rejects missing, failed or all-skipped execution. Both root PR/full commands call the same real workspace task and revalidate its execution evidence.
- Turbo declares BOTH native JSON and JUnit reports as outputs. The root runner removes the report directory before every invocation, so a cache hit must restore evidence rather than accidentally reusing old local files. Root CI, inventory and TypeScript inputs participate in Turbo's global hash.
- Keep conservative complete-tree fingerprints. Per-test skip-green remains off until a native-compatible selection/execution contract is measured. A fast three-case native setup does not justify extra shards.

**Result:** Work in progress. The expanded root contract suite currently passes 35/35 locally. Dependency installation, real native renderer tests, Android bundle compilation, cache restoration, deliberate failures and hosted workflow evidence must be measured before application acceptance. No APK, emulator/device boot, signing or distribution is claimed by the root checks.

**Why:** Bootstrap green only proved repository contracts. Enabling application jobs requires observable application work. Jest can exit successfully when all tests are skipped, so the JSON execution guard runs inside its task on every event; the shared JUnit guard remains a second independent check. A report from an earlier invocation is not proof of this run unless the exact task cache restores it.

**Evidence:** GYM-3; `apps/mobile`, `scripts/ci/run-mobile-tests.mjs`, `scripts/__tests__/mobile-foundation.test.mjs`, `.ci/workspaces.json`, and `.github/workflows/ci.yml`.

**Regression watch:**
- App source imports no raw React Native/visual primitives; lint must reject a forbidden import, including type-only imports.
- Missing tests, all-skipped tests and a failing assertion must fail both direct and full CI unit paths.
- Cold and warm Turbo runs must account for actual test cases and restore JSON/JUnit outputs; changing a runtime/CI/global input must invalidate prior evidence.
- Android export must emit a nonempty bundle. Bundle compilation, APK compilation, emulator/device execution and distribution are separate evidence, never synonyms.
- No permanent Android package identity, credentials, signing or distribution destination is guessed. The package identifier remains a user decision.
- The final head must pass real hosted application lint, typecheck, tests and build, plus the root gates. Revert any optimization whose positive/negative experiment cannot establish safe execution.

**Addendum (2026-09-30):** Local application evidence is now real: lint and types pass; two Jest suites execute 4/4 cases including the actual Expo router boot and published native shared UI, locale and repeated mount/unmount. The Android export produced a 2,690,029-byte Hermes bundle; a build wrapper now clears stale output and asserts a nonempty Android bundle from Metro metadata. Missing, empty, directory-valued and escaping artifacts are permanent negatives. Root contracts pass 36/36.

**Addendum (2026-09-30):** Negative and cache measurements: a deliberately wrong native assertion failed 1/4 cases and exited 1, an unmatched test-file selection exited 1, and a name filter skipping all 4 tests exited 1 through the consumer JSON guard despite Jest's successful all-skipped exit. All mutations were restored. Both a direct type import and a CommonJS require of `react-native` fail the actual zero-warning lint command. Turbo first executed one real native task (0/1 hits, 2.370 s task time); a full-command repeat restored both removed JSON/JUnit reports (1/1 hits, 19 ms task time, 0.818 s whole command). A temporary change to the root CI runner invalidated the task (0/1 hits, 2.343 s task time, 3.105 s whole command). The root input probe was restored too. Cache-hit logs are historical evidence, not a claim of re-execution.

**Addendum (2026-09-30):** Setup findings: the first native run failed because Babel's generated helper import needed an explicit `@babel/runtime` dependency, and router boot required transforming its ESM navigation packages under pnpm. Both are fixed rather than mocked away. Exact SDK-compatible peer pins replace drifted optional-peer versions for Expo constants/runtime, native Metro, reanimated and worklets. The lockfile is frozen-installable. The published UI package's only blocked lifecycle is its `npx only-allow pnpm` preinstall guard; its prebuilt native exports were actually rendered and bundled without executing that lifecycle. No package build script was broadly enabled.

**Addendum (2026-09-30):** Verification boundary: the cloud browser refused the local preview with `net::ERR_BLOCKED_BY_CLIENT`; no alternate route was used. This executor has no Android SDK/adb or `/dev/kvm`. Router render tests and Android compilation are verified, but browser screenshots, Android device/emulator installation and APK distribution are not. Final Android app name/package identity remain user decisions. Hosted application CI and repeat-input provenance experiments are still pending.

**Addendum (2026-09-30):** Independent review repeated the 36 root checks, 4 fresh native cases and all-skipped negative (exit 1), lint/types, Actionlint and a real Android export (1,249 modules, 7,897 ms Metro, 2,690,028-byte nonempty Hermes artifact). It found no code blocker. Its `EXPO_PUBLIC_REVIEW_PROBE` alpha/beta experiment produced different Turbo build hashes and included the variable in inferred hashed inputs. The single minor documentation finding was corrected: the native JUnit path is `apps/mobile/reports/junit.xml`. No browser, Android device or APK verification was claimed by the review.

**Addendum (2026-09-30):** First hosted application run [36733075268](https://github.com/12-apps/future-gym/actions/runs/36733075268), head `b675ef6364ca0467f9975e3d88666be6f3cbac49`, passed all required work. Static lint and typecheck each executed one task with zero cache hits (2.469 s and 2.116 s). Native unit executed 4/4 cases, 16.013 s Jest / 16.882 s task time, zero cache hits, and the shared guard confirmed 4 executed cases. Build executed one uncached task in 15.922 s; Metro compiled 1,249 modules in 13,921 ms and emitted the verified 2,690,029-byte Android Hermes artifact. Root contracts and CI Success passed. This is application evidence, unlike E-004's intentional bootstrap skips. A same-tree commit now measures whether the recorded passing lane verdicts safely eliminate repeated work.

**Addendum (2026-09-30):** The first identical-tree comparison did not establish reuse: run [36733538675](https://github.com/12-apps/future-gym/actions/runs/36733538675), empty commit `9775c9bac6f77af5eb1cfefa6eedf00d8d4d64f9`, kept consumer tree `cce023252da192727e363f49b39c6fb9e0477128` and selection base unchanged. Lint also kept Node 22.23.3 and image 20260927.320.1 unchanged; typecheck/build moved to Node 22.23.2 and image 20260920.314.1. The engine's internal `@v2` action checkout advanced from `be3300542208ebab5b30a75f58d018518f9d3459` to `102a864b440ced7f94ac92136d7dd44962137016`. The provenance salt changed and lint/types/build/unit reran instead of reusing old evidence; lint isolates the implementation change, while the other measured lanes also changed runtime image. This is a confirmed safety invalidation, not a performance win or a consumer regression. A further same-tree comparison must hold the central implementation fixed before reuse can be claimed.

**Addendum (2026-09-30):** A narrow artifact-guard follow-up replaces `statSync` with `lstatSync` and adds a terminal-symlink negative; independent delta review passes. The check rejects missing/empty/non-file bundles, lexical traversal and a symlink at the bundle path. It is an assertion over trusted Metro output, not a general symlink-ancestor sandbox.

**Addendum (2026-09-30):** Real reuse confirmed in [36734084593](https://github.com/12-apps/future-gym/actions/runs/36734084593), identical-tree commit `b36e5611627196c05b9c5a6648e72eaa0cd831ed`: typecheck and build restored their passing verdict keys under engine `102a864b`, Node 22.23.2 and image 20260920.314.1, and explicitly skipped install and work. The unit plan restored its passing verdict and omitted the unit matrix; CI Success remained green on that prior verified 4-case execution. Lint safely missed because it changed from Node 22.23.3/image20260927 to 22.23.2/image20260920 and executed again. This measures reuse and runtime invalidation in the same consumer run; it does not claim that cached lanes re-executed. Root contracts still ran freshly.

**Addendum (2026-09-30):** Consumer entrypoints are aligned to the verified v2.48.3 release, `102a864b440ced7f94ac92136d7dd44962137016`, after the central reviewer confirmed its quoted-XML parser fix and independent checks. This release does not yet contain the separate full-push guard change. Native full-run safety continues to come from this consumer's strict Jest JSON assertion; no unreleased central capability is claimed.

**Addendum (2026-09-30):** Hosted relevant-input negative [36734637553](https://github.com/12-apps/future-gym/actions/runs/36734637553), commit `b11c0e1c1efec5a5ee0c5917db3c01e7be557da6`, changed only the native repeated-mount assertion from one surface to two. The changed tree did not inherit the previous green: the unit task executed, reported 1 failed / 3 passed / 4 total, and exited nonzero; the unit verdict writer was skipped and CI Success failed. Static and Android build still passed. This is the expected failure, not an app defect being accepted. The next commit restores the correct assertion, publishes the reviewed artifact-guard/doc corrections and release alignment, and requires a new exact-head green run.

**Addendum (2026-09-30):** Restored head `a10a3e9c3d43e7d319e1ffc7ef7468cfa3e24983` passed the full hosted application pipeline in [36735339638](https://github.com/12-apps/future-gym/actions/runs/36735339638) with v2.48.3 consumer pins. A final foundation convention correction routes the existing tab label through the typed `@12-apps/i18n` locale pack instead of an inline literal, retaining pt-BR as the configured locale. The actual router test now asserts the pt-BR tab label. This adds no locale switch or product feature and will receive its own final-head checks.

**Addendum (2026-09-30):** Final application source head `69bfa0eb8d506413a0fbe85b65745411a8deb935` passed hosted [36736198006](https://github.com/12-apps/future-gym/actions/runs/36736198006): real repository contracts, native lint/types, 4/4 native cases including the localized router label, nonempty Android export and CI Success. Independent narrow review also reran lint/types, all 4 fresh native cases and focused root contracts with no findings. The PR remains a draft because permanent Android identity and device/emulator installation acceptance are unresolved; these green checks do not claim an APK, device boot or distribution.

### E-006 — Public CI: can inherited runner configuration redirect Future Gym to AWS?

**Status:** Open — 2026-09-30

**Question:** Can this open-source repository enforce GitHub-hosted execution for
all CI and regeneration jobs, regardless of an inherited `CI_RUNNER` variable,
without adding AWS runners, storage or paid infrastructure?

**Method:**
- Inspect actual job metadata, rather than infer hosting from step names. On
  [36736863609](https://github.com/12-apps/future-gym/actions/runs/36736863609),
  all 11 executed jobs at head `291718b21c8b22cc646d2337d55a0d97884aab21`
  used the `GitHub Actions` runner group and `ubuntu-latest`. Five skipped jobs
  are not execution evidence. The workflow passed all application checks.
- The pinned static/tests/regeneration engine still chose
  `vars.CI_RUNNER || 'ubuntu-latest'`. This is an inheritance gap even though no
  AWS execution was observed. Organization/repository variable administration
  was not exposed by the available connection, and no setting was changed.
- Keep runner-selection precedence in `12-apps/ci`; the consumer supplies
  `runner: ubuntu-latest` to static, tests and post-merge regeneration. Root
  repository contracts and CI Success already use that literal runner.
- Add dependency-free consumer tests over every committed workflow. They reject
  each missing override, inherited or self-hosted selectors, unreviewed reusable
  calls, AWS credential/deployment/storage wiring, blanket secret inheritance
  and external Turbo remote-cache variables. The parser intentionally supports
  this repository's narrow workflow layout; Actionlint separately validates YAML.
- Require a released engine that declares the runner input before publishing
  the caller change. Then exercise a missing-override negative on the PR, restore
  it and inspect exact-head hosted jobs. The negative fails repository contracts
  before the reusable application jobs can start.

**Result:** Locally, 43/43 root cases pass (695.8 ms), including 7 new runner/cloud
contract tests. Native lint/types pass, and the PR unit command freshly executes
4/4 native cases across 2 suites (1.810 s Jest; 2.695 s Turbo task, zero cache
hits). The full command restores the same verified JSON/JUnit evidence from the
task cache (15 ms Turbo), rather than re-executing. A fresh Android export
compiles 1,250 modules in 7,709 ms and verifies a 2,690,422-byte Hermes bundle.
Actionlint, ADR records and whitespace checks pass. The initial shell selected
an unrelated global pnpm shim and failed before application commands; using the
already-installed repository-pinned pnpm 10.34.5 resolves that tool-selection
issue without changing dependencies. Metro inherited a color-environment
warning from the executor; this is not an application warning or device test.
Released-input integration and hosted positive/negative results remain pending.

**Why:** A GitHub-hosted historical run proves where that run executed. Only an
explicit caller input, honored before organization configuration, prevents a
future inherited variable from selecting the AWS fleet. Cache/verdict safety is
still the engine's responsibility; consumer tests pin its intended use here.

**Evidence:** `scripts/__tests__/hosted-runners.test.mjs`, both workflow files,
the linked baseline run and `BOOTSTRAP.md`. Caches remain GitHub Actions caches;
the current build is a local Android export and no APK publishing/S3 lane exists.
The pre-existing missing regeneration PR token and Android identity/device
acceptance blockers are unchanged.

**Regression watch:** Every current and future job must have a reviewed
GitHub-hosted selection. Removing any caller override must fail root contracts;
explicit `ubuntu-latest` must win even if the shared engine sees a self-hosted
organization variable. No AWS credential action, S3 destination or external
remote-cache secret may enter these workflows. Exact-head hosted job metadata
must show GitHub Actions runners. A future APK workflow must use GitHub artifact
storage and must not imply release/distribution acceptance from bundle success.

**Addendum (2026-09-30):** The central runner override is normally released as
[v2.49.0](https://github.com/12-apps/ci/releases/tag/v2.49.0), immutable commit
`ea88024608cb8c9f5ce8fe655fb64e6866bbf469`. The annotated release tag was resolved
and all 17 jobs across this consumer's three reusable callees were checked for
`inputs.runner || vars.CI_RUNNER || 'ubuntu-latest'`. All four consumer engine
entrypoints now pin that commit. This release does not include the separate
full-event JUnit change; the native JSON guard still protects both PR and full
commands. An actual local missing-override mutation exited 1 (5/7 runner tests
passed, 2 failed); after restoration all 43 root cases passed. No remote
repository settings or credentials changed. Hosted negative/positive integration
will be appended after execution.

**Addendum (2026-09-30):** Hosted negative
[36746106434](https://github.com/12-apps/future-gym/actions/runs/36746106434),
head `107296de0f33a07fe809f68a3df839c185f45a49`, deliberately omitted only the
static caller's runner override. The actual root command exited 1 with 41 passed
and 2 failed cases (804.6 ms); its exact error was `ci.yml/static: runner override
is required`. Repository Contracts and CI Success both failed. Static and Tests
were skipped before any inherited runner could be requested. This is the
expected policy failure, not an accepted regression. The following commit
restores the explicit override and requires a new exact-head green run.

**Addendum (2026-09-30):** Restored head
`bbdba2171dac996f951257f555f0137923b237da` passed
[36746315794](https://github.com/12-apps/future-gym/actions/runs/36746315794).
All 10 executed jobs reported the `GitHub Actions` runner group and
`ubuntu-latest`; 6 correctly skipped jobs requested no runner. This also corrects
the baseline tally above: run 36736863609 had 10 executed and 6 skipped jobs,
not 11 and 5. The hosting conclusion is unchanged.

The restored run executed 43/43 root cases (652.4 ms) and passed native lint/types.
Unit tests were uncached: 4/4 native cases, 13.925 s Jest / 14.785 s task time,
with the shared JUnit guard confirming 4 executed cases. Android build was also
uncached: 1,250 modules in 20,166 ms, 23.104 s task time and a verified
2,690,424-byte Hermes bundle. CI Success passed. The omitted-override probe is
absent, and all three reusable calls now consume the released runner input.
Post-merge regeneration's three runner selections are source-verified against
the same release; its existing missing-token blocker means regeneration execution
is not claimed. Android identity/device acceptance remains separate, so the app
PR stays a draft and no app merge, APK install or AWS infrastructure is claimed.

### E-007 — Released full-event guard: does it reject a real all-skipped native push?

**Status:** Confirmed — 2026-09-30

**Question:** Can Future Gym adopt the released engine's push/dispatch/schedule
JUnit guard without losing its native safeguards or GitHub-hosted runner policy?

**Method:** Pin all entrypoints to
[v2.49.2](https://github.com/12-apps/ci/releases/tag/v2.49.2), immutable commit
`dd17e765c6d3799cfc9a3cbeebf3cf640d368908`, after resolving its annotated tag.
Keep every explicit `runner: ubuntu-latest` and the consumer's JSON execution
assertions. A bounded, push-only
[audit branch](https://github.com/12-apps/future-gym/tree/ci/gym-3-full-signal-proof)
at `4874eddcc4200c53e6987471bca270596185bfcd` adds only an experiment workflow;
it is outside the application PR and will not merge. Its PR command deliberately
throws, so accidental selection of the PR path cannot silently pass.

The two negative controls invoke the actual existing Jest suites directly with
an unmatched test-name filter, producing 4 skipped cases and a successful Jest
exit. They intentionally bypass the consumer JSON wrapper to isolate the shared
JUnit guard. The normal old Future Gym full command already rejected all-skipped
execution through that wrapper; this experiment proves the added central defense.
The positive control runs the actual `pnpm run test:ci:full` without a filter.

**Result:** Actual push run
[36750100434](https://github.com/12-apps/future-gym/actions/runs/36750100434)
produced the required old-success/fixed-failure/fixed-success outcomes:
- The [old-engine unit job](https://github.com/12-apps/future-gym/actions/runs/36750100434/job/110006276946)
  passed with 2 skipped suites / 4 skipped cases (13.774 s Jest); its PR-only
  guard never ran.
- The [released-engine negative](https://github.com/12-apps/future-gym/actions/runs/36750100434/job/110006270644)
  also had 2 skipped suites / 4 skipped cases (9.636 s Jest), then failed at the
  central guard with zero executed test cases. The test command itself succeeded.
- The [real native full command](https://github.com/12-apps/future-gym/actions/runs/36750100434/job/110006263611)
  passed 4/4 cases across 2 suites, uncached (14.576 s Jest / 15.451 s task).
  Both consumer JSON execution validation and central JUnit validation passed;
  the central guard counted exactly 4 executed cases.
- The [experiment verifier](https://github.com/12-apps/future-gym/actions/runs/36750100434/job/110006612438)
  passed. The overall run is intentionally red because its negative lane must
  fail. All 7 executed jobs used `GitHub Actions` and `ubuntu-latest`.

Local final-pin validation passes 43/43 root cases (812.1 ms), Actionlint and
whitespace checks. The real native full command freshly executes 4/4 cases,
zero Turbo hits (1.759 s Jest / 2.580 s task). Final application PR-head CI will
be linked in the PR description after it completes; no post-merge app run is
claimed while identity/device acceptance keeps this PR a draft.

**Why:** A successful runner exit with all tests skipped is not executed work.
This native proof exercises the real push scheduler, Jest's real JUnit shape,
the released engine's full-command selection and both positive/negative guard
outcomes. It supplements, rather than replaces, E-005's native execution checks
and E-006's explicit hosted-runner policy.

**Evidence:** The linked push jobs, `.github/workflows/ci.yml`, the matching
consumer contract pin and `BOOTSTRAP.md`. The isolated experiment workflow is
not in the application PR. Previous E-005/E-006 statements that the central
full-event guard was pending describe their earlier release state; v2.49.2
resolves that dependency without removing the native JSON guard.

**Regression watch:** Both PR/full native commands must keep producing fresh or
properly cache-restored JSON/JUnit evidence. A full event cannot use a PR label
bypass or treat skipped cases as execution. All public runner overrides remain
mandatory, no AWS/S3/external cache wiring is added, and Android bundle success
still does not establish APK/device acceptance.

### E-008 — Deferred identity: can Expo Go validate the native foundation without a permanent application ID?

**Status:** Open — 2026-09-30

**Question:** Can the existing screenless shell satisfy its runtime gate while
final branding, Android application ID and publication remain deferred?

**Method:** Keep `android.package` unset. The actual Expo config command reports
SDK 57.0.0 and no Android package; the already-proven tests and bundle do not
require one. Android's [documented ID rules](https://developer.android.com/build/configure-app-module)
require a syntactically valid unique identifier, not domain ownership. Expo's
[configuration reference](https://docs.expo.dev/versions/latest/config/app/#package)
describes a user-chosen standalone identifier. The earlier notes treating final
identity as a prerequisite for this foundation were unnecessarily restrictive;
runtime/on-screen validation remains a separate, required gate.

Use an isolated GitHub-hosted Android emulator audit branch with the official
SDK 57 Expo Go build, which supplies its own native application identity. No
app ID, Expo account, secret, AWS resource, host-security setting or signing
configuration is added. Observe existing acceleration access; use software
emulation if it is unavailable. Do not accept a new Android SDK license silently.
Capture launch, repeated tab interaction, background/resume, cold reopen and a
wide layout. Keep screenshots and runtime logs as evidence and inspect them
before claiming the gate passes. The probe workflow remains outside this app PR.

**Result:** The first hosted attempt
[36757551281](https://github.com/12-apps/future-gym/actions/runs/36757551281)
resolved and downloaded official Expo Go 57.0.9 successfully. It then stopped
before boot because `sdkmanager` was not on the runner's PATH (exit 127).
The next audit commit resolves the installed Android command-line tools from
`ANDROID_HOME`; no application dependency or security setting is changed.
Runtime evidence is still pending, and no emulator success is claimed from this
setup-only result.

**Why:** A final store identity is needed for publishing the app under that
identity, not for executing the existing bundle inside Expo Go. Any standalone
temporary development ID would be a separate explicit choice. Expo Go validation
does not claim a standalone APK, signing or store acceptance.

**Regression watch:** Leave the Android package unset until an explicit identity
choice. Do not substitute bundle/test success for on-screen execution. Preserve
GitHub-hosted-only infrastructure and fail on unsupported native dependencies,
runtime errors or missing screenshots. Record failed attempts as well as the
restored successful proof; never waive the runtime gate because setup is slow.

**Addendum (2026-09-30):** After correcting command-line tool discovery,
[36757754714](https://github.com/12-apps/future-gym/actions/runs/36757754714)
installed the official SDK/emulator without a new license prompt. Its software
boot attempt exceeded the 900-second window, and unbounded cleanup waited on
adb; cleanup and emulator-process checks were bounded in the next audit commit.
The diagnostic retry
[36760143025](https://github.com/12-apps/future-gym/actions/runs/36760143025),
head `d0b5df80eb4dfeff7c59785e93999d3c113db1a7`, stopped with exit 77:
`This user doesn't have permissions to use KVM (/dev/kvm)`. The device was
`root:kvm` with mode 0660 and the runner was not in that group. SDK 57 Expo Go
57.0.9 was downloaded successfully, but no native app screen or screenshot was
produced. No virtualization permission was changed. Granting scoped access to
that device in a disposable test runner requires explicit action-time approval;
the runtime gate remains open while that decision is pending. Final app identity
and domain ownership are unrelated to this verified infrastructure blocker.

**Addendum (2026-09-30, approved acceleration and observed runtime):** The
owner explicitly approved read/write access only for the current `runner` user
on `/dev/kvm` in this disposable GitHub-hosted audit. The harness saves the
original ACL, grants that one user access, and restores the original ACL in an
`always()` step. This changes the earlier permission-pending result; it does
not establish a standing permission for other jobs or alter account settings.

The following recovery attempts were measured before the successful runtime:
- [36761956436](https://github.com/12-apps/future-gym/actions/runs/36761956436)
  confirmed usable KVM after the approved grant, then failed to discover the
  AVD. `avdmanager` and the emulator had different home directories. Explicit
  `ANDROID_USER_HOME`, `ANDROID_EMULATOR_HOME` and `ANDROID_AVD_HOME` fixed the
  mismatch. The original ACL was restored.
- An intermediate audit commit, `40ebab9b40c363c464a691941ae35491a42fbb82`, used
  the unsupported `runner.temp` expression in job-level `env`. Actionlint
  detected it, but a later successful shell command masked that validation
  exit. The next commit moved these values to a step writing `GITHUB_ENV` and
  made validation fail fast. No application source changed.
- [36762434620](https://github.com/12-apps/future-gym/actions/runs/36762434620)
  booted Android, installed Expo Go 57.0.9 and confirmed the package was unset,
  but the Metro health check timed out after 180 seconds. Its actual screenshot
  showed the Android launcher, not the application. Read-only log inspection
  [36763594889](https://github.com/12-apps/future-gym/actions/runs/36763594889)
  and a local reproduction separated IPv6 localhost binding from the IPv4
  health check. `NODE_OPTIONS=--dns-result-order=ipv4first` fixed the mismatch.
  Expo CLI's headless mode avoided its optional desktop DevTools launcher;
  Chromium sandbox settings were not changed.
- [36764153374](https://github.com/12-apps/future-gym/actions/runs/36764153374)
  loaded the bundle into Expo Go but stopped on the observed first-run tutorial.
  The harness now locates the real `Continue` control from UIAutomator XML.
  Removing offline mode also removed an avoidable manifest-assets warning.
- [36765514636](https://github.com/12-apps/future-gym/actions/runs/36765514636)
  dismissed that tutorial, then correctly failed while the normal developer
  menu covered the app. The next audit locates its observed `Close` control,
  and parses XML entities before asserting the localized `Início` tab.

**Measured positive:** Audit head
`99912a25aa0ebfd40a13bce3b7a00b74f8639c2b`, on app source
`d853045788a8b7d1c5e7a541d2cac5332f2e932f`, completed
[36766752079](https://github.com/12-apps/future-gym/actions/runs/36766752079)
successfully. The sole job ran in runner group `GitHub Actions` with label
`ubuntu-latest`, from 19:35:42 to 19:39:47 UTC (245 seconds). Its boot/drive/
capture step took 146 seconds. Android API 35 x86_64 ran official Expo Go
57.0.9 with project SDK 57.0.0. The first bundle transformed 1,416 modules in
16,138 ms; the cold reopen transformed one module in 135 ms. No final Android
package or domain was configured.

The actual native shell and its localized tab passed first launch, repeated tab
taps, Home/background and resume, force-stop and cold reopen, then a 1280x800
wide layout. Phone captures are 390x844. UI assertions ran after each action;
no fatal Android exception, JavaScript error overlay or matching runtime error
was found. The original virtualization ACL was restored successfully at
19:39:45 UTC. The exact PNGs were inspected, including the tutorial and developer
menu before dismissal, and the five application states were preserved separately.
The [runtime artifact](https://github.com/12-apps/future-gym/actions/runs/36766752079/artifacts/11121536572)
contains screenshots, UI XML, Metro logs and logcat (717,325 bytes; seven-day
retention). The workflow and driving scripts remain only on the isolated audit
branch, not in the application PR.

**Acceptance boundary:** Runtime behavior passed, but the screenshots visibly
show Expo's production `scheme` advisory as a development warning toast. The
console states that it does not apply to development in the Expo client and
that a build-time scheme is needed for production linking. No warning was
suppressed and no production identity or scheme was invented. The repository's
strict no-new-warning run gate therefore remains open pending a real resolution
or an explicit owner decision for this deferred-production scope. A successful
probe exit is not a claim that that broader gate passed. This is a screenless
foundation: no workout screens, dark-mode behavior, standalone APK, signing,
physical-device or store acceptance are established by these captures.

**Regression watch addendum:** Keep emulator homes consistent and Metro's
loopback address compatible with the readiness probe; fail promptly if the
emulator dies and bound cleanup. Observe onboarding controls before tapping,
parse decoded UI labels, and preserve a screenshot for every runtime state.
Only the separately approved temporary user ACL may change and it must be
restored even on failure. Neither bundle success nor a passing runtime script
may conceal a visible warning or claim production acceptance.


**Addendum (2026-10-01, development acceptance decision):** The Expo production-scheme advisory is accepted for development inside Expo Go only. It does not waive production linking configuration, assign an Android/iOS application identifier, authorize publication or suppress any warning. The measured foundation runtime and screenshots from run 36766752079 remain the evidence; this documentation decision changes no application code. The foundation may precede the functional client merge after its exact-head CI and review checks pass. The functional client still requires its own runtime and visual acceptance.

### E-009 — Development linking: can the native audit run without the recurring advisory?

**Status:** Open — 2026-10-01
**Question:** Remove the actual cause of Expo's recurring scheme advisory while
keeping production identity deferred, then prove all native prototype states.
**Method:** Inspect the captured manifest and pinned `expo-linking` resolver;
provide an explicit development-only scheme via dynamic Expo config and the
normal cross-platform development command. Add regressions for default,
development and production variants. The Android export pins the production
variant even if its caller inherited development variables. Repeat exact-head CI
and the GitHub-hosted Android audit, with no warning-dismissal step and with the
advisory itself treated as a failing runtime observation.
**Result:** Prior run 36908104023 reached the cold-reopened home but its advisory
intercepted History navigation. The owner requested a cause fix after the
three-failure protocol stop. New local root contracts pass 46 cases, including
three config regressions; updated device and CI evidence remain pending.
**Why:** The prior public manifest has no scheme. `expo-linking@57.0.9`
`src/Schemes.ts` emits this exact warning when `collectManifestSchemes()` is empty,
before selecting Expo Go's `exp` transport. Development config now supplies a
scheme without registering a standalone application or changing production
identity. The resolver still uses Expo Go's normal transport.
**Evidence:** `apps/mobile/app.config.js`, `scripts/start-dev.cjs`,
`scripts/__tests__/expo-development-config.test.mjs`, and
[prior Android run](https://github.com/12-apps/future-gym/actions/runs/36908104023).
**Regression watch:** No warning suppression, `LogBox` filtering or automatic
advisory dismissal. Default/production config must not inherit the development
scheme. No Android package/iOS bundle identifier is assigned. The audit must
prove warning-free initial and cold launches, preserve screenshots, use only
the authorized temporary runner KVM ACL and always restore its original value.

**Addendum (2026-10-01):** First exact-head CI 36915179972 passed the 46 root
contracts and types, but lint correctly rejected the new `APP_VARIANT` because
it was not declared in Turbo. The variable is now in `globalEnv` and the config
regression also pins that declaration. This keeps variant-dependent configuration
inside the task environment/cache identity rather than silencing the lint rule.

**Addendum (2026-10-01, E-009 verification):** Exact-head CI 36915486404 passed
46 root contracts and 122 Android/iOS renderer cases, with zero skipped, plus
lint, types and Android export. Native audit 36915950179 passed all 23 real
Android states with application/configuration bytes matching 24c37a3. Initial
launch and cold reopen contain no scheme warning, the empty-history assertion
completed, and the temporary runner KVM ACL was restored. Independent visual
inspection confirmed the warning-free frames. The separate original-reference
job captured all 20 supplied HTML artboards. These results precede later
functional/fidelity changes and do not establish their final acceptance.

### E-010 — Renderer audio boundary: do tests distinguish mocked capability from runtime playback?

**Status:** Open — 2026-10-01
**Question:** Preserve Android/iOS real-router UI coverage after foreground-only
workout cues are added, without pretending a renderer can decode or play sound.
**Method:** Add a renderer-only `expo-audio` setup mock to both existing platform
projects. Controlled hook tests override it to exercise setup/playback failures,
late updates, mute/pause/navigation cancellation, cleanup and repeated cues.
Pure tests exercise cue selection without mutating workout state and verify the
committed generated WAV assets. Actual runtime playback/error evidence belongs
to the separate Android audit, not these mocks.
**Result:** Final integrated renderer and device execution is pending. Earlier
pure/syntax checks do not replace the affected native suites.
**Why:** The existing native renderer cannot provide the operating-system audio
player. An explicit documented device boundary keeps UI tests deterministic while
focused failure tests and real-runtime checks retain responsibility for behavior.
**Evidence:** `apps/mobile/jest.config.js`, `__tests__/audio-setup.tsx`, the three
`workout-audio*.test.tsx` suites and `src/client/workout-audio.ts`.
**Regression watch:** No conditional test skip, muted warning filter or production
mock. Both platform suites must execute. Cues must not complete sets, cross
user/tenant/session boundaries, replay after interruption or request recording/
background permissions. Any visible audio error or new runtime warning blocks
the device gate.
