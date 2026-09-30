---
name: ci-engine-or-consumer
description: Before any CI change, decide whether it belongs in 12-apps/ci (engine) or future-gym (consumer)
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(ci|cd|ci\.yml|cd\.yml|pipeline|github actions|(ci|cd|github|reusable|actions) workflows?|workflow (files?|runs?|jobs?)|12-apps/ci|composite actions?|self-hosted runners?|runner fleet|renovate)\b|\.github/
trigger_pretool: Edit:"file_path":"[^"]*(\.github/|\.githooks/|scripts/(ci/|ci-|deploy/|post-merge-regen)|apps/[^/"]+/deploy/|renovate\.json),Write:"file_path":"[^"]*(\.github/|\.githooks/|scripts/(ci/|ci-|deploy/|post-merge-regen)|apps/[^/"]+/deploy/|renovate\.json),Bash:(\.github/|\.githooks/|scripts/(ci/|ci-|deploy/|post-merge-regen)|apps/[^/" ]+/deploy/|renovate\.json)
trigger_session: false
inject: full
enforce: suggest
---

### Every CI change starts with: which repo owns this?

future-gym consumes `12-apps/ci` (the engine) at `@v2`. Today that means
`.github/workflows/post-merge-regen.yml`, which calls the engine's
`post-merge-regen.yml@v2`. Before you change a workflow, an action, a CI
script or gate, a deploy descriptor or `renovate.json` in EITHER repo, decide
which repo the change belongs in. Say so in one line of the PR body. This
applies whether you change it by Edit, Write, `sed`, a heredoc or `git rm`.

**ENGINE (12-apps/ci)** when any of these hold:
- The mechanism carries no future-gym knowledge: no app paths and no domain
  terms. Whatever differs per repo can be an input.
- It encodes a GitHub Actions platform lesson. Examples: `workflow_run` never
  fires for a run started with `GITHUB_TOKEN`; a `uses:` job cannot carry
  `timeout-minutes`; the draft→ready flip; the token scopes Renovate needs.
- Another consumer (future-pay, base-app) would have to work it out again. The
  APK build is a case: future-pay calls `expo-apk.yml@v2` for its courier app,
  and the gym app will call the same workflow.

**CONSUMER (future-gym)** when:
- Its subject is future-gym's own source or data: what the post-merge job
  derives (`scripts/post-merge-regen.mjs`), ADR rules, app-specific gates.
- It asserts over this repo's own workflow files. The engine cannot read the
  caller's file.
- It is configuration: `apps/*/deploy/config.json`, app build inputs (package
  id, ABIs), `allow-paths`.

**SPLIT** is the default for anything large: the mechanism goes in the engine,
the descriptor or config in the consumer. The post-merge job is the pattern:
`prepare → generate → land` lives in the engine, and what gets generated lives
here.

**Smells that the placement is wrong:**
- A file copied between repos. Copies drift. Consume the engine's through
  `12-apps/ci/.github/actions/*@v2`, or through a published file.
- The consumer mirroring an engine value it cannot import. Export the value
  from the engine as a file instead.
- The engine re-implementing what a consumer already hardened. Promote one copy
  and call it from both.

**If it belongs in the engine:**
- Land the engine PR first. It reaches this repo only once `v2` moves.
- Check with `git fetch --tags --force` (a plain fetch shows the old tag),
  against `"supported"` in the engine's `.github/majors.json`. Then do the
  consumer PR.
- The engine states its own rules as tests in `.github/workflows/__tests__/`.
  Run them there rather than recalling them.
- The engine repo is PUBLIC, so its own workflows stay on `ubuntu-latest`.

**If it stays here:**
- A run started with `GITHUB_TOKEN` must report its own failure from inside;
  no watcher can see it.
- Log the change in `docs/ci/EXPERIMENTS.md` (memory `ci-experiments-log`).
