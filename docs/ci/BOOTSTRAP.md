# CI bootstrap and application activation

`Repository Contracts` always runs real root tests, checks nonzero JUnit signal,
lints workflow syntax and validates the documentation and ADR rules. The first
app now registers `apps/mobile` in application mode. Its lint, types, native
tests and Android bundle are application evidence; they are not MVP acceptance.
An explicitly empty bootstrap remains supported for a new repository, with
application jobs reported as not run rather than green zero-task work.

## Add the actual application

The confirmed platform is Expo/React Native Android. The accepted UI ADR remains
binding. Permanent Android identity and distribution decisions must come from
the user; never invent a package identifier or signing setup.

In the same PR as the app:

1. Set the descriptor's mode to `application` and list every `apps/<name>` and
   `packages/<name>` workspace. An unregistered, lost or malformed workspace
   fails the repository gate instead of suppressing a lane. Changing the pnpm
   workspace globs also requires updating the inventory implementation.
2. Give each workspace real `lint`, `check-types`, `test` and `build` scripts.
   Do not use success-only placeholders or `--passWithNoTests` as acceptance.
3. Implement root `test:ci` and `test:ci:full`. Both must run actual workspace
   tests and produce fresh JUnit XML under `reports/junit/workspaces`.
   The PR command must widen safely when affected selection cannot be resolved
   or selects zero runnable tasks; the full command skips no workspace tests.
   Clear stale reports before each invocation. Preserve failing exit statuses.
   At engine v2.48.2 the reusable application JUnit guard is PR-only. The
   native Jest wrapper and root runner explicitly reject zero/all-skipped JSON
   results on both paths, including cached full runs; a newer central guard is
   defense in depth rather than permission to remove that execution assertion.
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
