# CI bootstrap and application activation

`Repository Contracts` always runs real root tests, checks nonzero JUnit signal,
lints workflow syntax and validates the documentation and ADR rules. During the
explicit `.ci/workspaces.json` bootstrap state, no application has been built or
tested. `CI Success` reports that limitation. It is not MVP acceptance.

## Add the actual application

Resolve the React-web versus existing Expo-Android request before scaffolding.
The accepted UI ADR remains binding. The Android package identifier, app name
and distribution decision are still open in GYM-1; do not invent them here.

In the same PR as the app:

1. Set the descriptor's mode to `application` and list every `apps/<name>` and
   `packages/<name>` workspace. An unregistered, lost or malformed workspace
   fails the repository gate instead of suppressing a lane.
2. Give each workspace real `lint`, `check-types`, `test` and `build` scripts.
   Do not use success-only placeholders or `--passWithNoTests` as acceptance.
3. Implement root `test:ci` and `test:ci:full`. Both must run actual workspace
   tests and produce fresh JUnit XML under `reports/junit/workspaces`.
   The PR command must widen safely when affected selection cannot be resolved
   or selects zero runnable tasks; the full command skips no workspace tests.
   Clear stale reports before each invocation. Preserve failing exit statuses.
4. Configure the runner's JUnit reporter and Turbo outputs so cached test tasks
   restore their reports. Add actual build outputs and all root configuration,
   runtime and environment inputs that can change task results.
5. Verify the app boots, real tests fail on a deliberate defect, lint/types
   inspect actual source, and the build emits the expected artifact. Bootstrap
   checks are not application tests or a build.
6. Measure a repeated relevant run, then change a relevant source/global input
   to prove fingerprints invalidate. Complete-tree fingerprints are deliberately
   conservative. The engine binds them to lane and execution context.
7. Add a runtime-compatible affected-test plan only with a runner that consumes
   the exact plan artifact. Start per-test skip-green in shadow and record both
   would-skip and executed results before considering enforcement. Do not copy
   merchant paths, databases or deployment assumptions from Future Pay.
8. Append actual run IDs, executed counts, cache evidence and both positive and
   negative outcomes to `EXPERIMENTS.md`. Verify full post-merge execution.

Consumer entrypoints use engine v2.48.2 commit
`be3300542208ebab5b30a75f58d018518f9d3459`. Internal engine actions still resolve
through its supported major references. Secrets and deployment are not added by
this bootstrap; the existing ADR-index job still needs its separately configured
`RENOVATE_TOKEN`.
