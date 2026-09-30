---
name: ci-experiments-log
description: Before touching CI, read docs/ci/EXPERIMENTS.md — the append-only log of what was tried and what broke — check its regression watch for your mechanism, and land your change with an entry; never delete or rewrite a past entry
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(ci|ci\.yml|workflows?|pipeline|github actions|test lane|shards?|runner|fleet|post-merge-regen|EXPERIMENTS\.md)\b
trigger_pretool: Edit:"file_path":"[^"]*\.github/workflows/,Write:"file_path":"[^"]*\.github/workflows/,Edit:"file_path":"[^"]*scripts/ci/,Write:"file_path":"[^"]*scripts/ci/,Edit:"file_path":"[^"]*scripts/post-merge-regen,Write:"file_path":"[^"]*scripts/post-merge-regen,Edit:"file_path":"[^"]*docs/ci/EXPERIMENTS\.md,Write:"file_path":"[^"]*docs/ci/EXPERIMENTS\.md,Bash:\.github/workflows/,Bash:EXPERIMENTS\.md
trigger_session: false
inject: full
enforce: suggest
---

### Read the experiments log BEFORE you change CI. Log what you do. Never delete an entry.

`docs/ci/EXPERIMENTS.md` is the append-only record of every experiment,
measurement and outcome behind this repository's CI. Each entry holds:
- what was tried;
- the numbers, with their run ids;
- what broke and why;
- per mechanism, a **regression watch**: the invariant a later change could
  break and the test that pins it.

The practice comes from 12-apps/future-pay (its ADR 0069,
`docs/adr/0069-every-ci-change-is-documented.md`, and its
`scripts/ci/ci-change-documented.mjs`). This repo has no enforcing gate yet,
so the log only holds if you keep it.

**Why it exists.** A CI defect is usually GREEN. In future-pay, four holes were
found by a person reading the inputs, none by a red run:
- an undeclared reusable-workflow input that scheduled zero jobs;
- a built `dist/` that hid most of the tree from change detection;
- a file a suite reads off disk that its skip hash never saw;
- a generated client with no tracked file.

**So, in order:**

1. **Find the mechanism you are about to touch** in the log's index. Read its
   *Regression watch*. Run the checks it names before AND after your change. A
   watch line that goes red is a regression, not a test to update.
2. **Append an entry** (`### E-NNN`, the next number, using the template at the
   top of the file): question, method, result with run ids, why, evidence,
   regression watch. A change with no measurement yet is `**Status:** Open`.
   Per `ci-work-must-be-tested`, you come back and fill in the run.
3. **Never delete, reorder or rewrite a past entry.** A finding that
   contradicts one goes in an `**Addendum (date):**` paragraph at the END of
   that entry, or in a new entry that cites it. The trail is the point, not the
   current state.

**One fact the log cannot see for you:** the engine repo (`12-apps/ci`) has no
copy of this log. An engine change that alters what a lane here does is still
logged HERE, in the consumer PR that picks up the new `v2`.
