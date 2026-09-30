---
name: ci-work-must-be-tested
description: CI work is not done at merge — build the follow-up that proves it, and try to break it
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(ci|ci\.yml|workflows?|pipeline|github actions|test lane|shards?|turbo|vitest|affected tests?|selector|post-merge|flaky|timed out)\b
trigger_pretool: Edit:"file_path":"[^"]*\.github/workflows/,Write:"file_path":"[^"]*\.github/workflows/,Edit:"file_path":"[^"]*scripts/ci-,Write:"file_path":"[^"]*scripts/ci-,Edit:"file_path":"[^"]*vitest\.config,Write:"file_path":"[^"]*vitest\.config,Bash:\.github/workflows/,Bash:scripts/ci-,Bash:vitest\.config,Bash:turbo\s+run\s+test
trigger_session: false
inject: full
enforce: suggest
---

### Testing it IS the task, and MERGING IS NOT THE FINISH LINE.

A CI change is not done when the code is written, when the PR is green, or when
it merges. It is done when you have **made** a run exercise it and can quote the
line that proves it.

**Waiting is not testing.** "The next commit touching X will confirm it", "I've
armed a check for when the cache misses", "say so if you want it watched" — all
of these are hoping, dressed as diligence. They leave a claim published and
unproven, and they push your job onto the user.

**So build the thing that tests it.** After the fix merges, ask two questions and
answer both with a follow-up PR:

1. **What can I do to make this actually execute?** If turbo's cache hides your
   change, land a real change in that workspace. If the PR lane never calls the
   path you fixed, exercise it from a lane that does. Construct the conditions;
   do not wait for them.
2. **What would BREAK it?** Remove the flag, double the fork cap, feed the
   selector a diff shape you did not consider — and confirm the gate goes red.
   A gate you have only ever seen pass is a gate you have not tested.

**Prefer a permanent assertion over a one-off measurement.** If you measured
something once to justify a change, the follow-up is usually a test that asserts
it on EVERY run. "I measured 886ms locally" is an anecdote; a check that fails
when the number regresses is verification. Numbers published in a docblock or a
PR body are claims you now owe evidence for — if a real run contradicts them,
correct the doc in the same breath.

**Four ways a CI change looks verified when it is not:**

1. **The lane never exercised it.** The PR unit lane takes the *planned* path
   (`ci-planned-tests.mjs`, per-workspace `pnpm --filter`) and never calls turbo.
   Only `CI_FULL_SUITE` — the daily full-suite run — goes through turbo.
2. **Turbo replayed a cache hit.** `cache hit, replaying logs` means the timings
   predate your fix. A `Duration` line flushing 19s into a 188s step did not
   execute. Grep for `cache hit` / `FULL TURBO` before believing any number.
3. **The job passed having run nothing.** `tasks: 0`, `--passWithNoTests`. Read
   the test COUNT, never the exit code.
4. **The gate you added never ran.** A `scripts/__tests__/*.test.mjs` needs no
   wiring — `ci-success` runs `ci-root-suite.mjs`, which DISCOVERS the directory
   — but a new LANE still needs a caller. Confirm it in a real run either way.

Get the JOB log, not the run conclusion — `mcp__github__get_job_logs` with
`return_content:false` gives a blob URL that is not gated; `curl` it and strip
the escapes (`sed -e 's/\x1b\[[0-9;]*m//g'`) before matching.
