---
name: git-branch-and-commit-rules
description: The remote rejects claude/* branches, and commits go through the guard script — not bare git commit
events: PreToolUse
trigger_pretool: Bash:git\s+commit,Bash:git\s+push,Bash:git\s+checkout\s+-b,Bash:git\s+switch\s+-c,Bash:git\s+branch\s+-m
trigger_session: false
inject: full
---

### Branch names and commits are both enforced — check before you run this

**Branch names.** The remote rejects a push to any branch not matching:

```
^(main|master|develop|release/.+|(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert|hotfix)/.+)$
```

A **`claude/*` prefix is rejected on push** — as is any other unlisted prefix.
Use a Conventional-Commits-style prefix + `/` + kebab-case description:
`feat/proportional-kind-cards`, `fix/checkout-total`, `chore/bump-deps`.
Rename the branch *before* pushing, not after the rejection.

**Commits.** Bare `git commit` is blocked by a PreToolUse hook. Commits go
through the guard script, which auto-formats, validates, blocks AI attribution,
enforces a human git identity, and pushes:

```bash
node "$CLAUDE_PLUGIN_ROOT/scripts/workflows/work/scripts/commit-and-push.js" \
  -m "type(scope): imperative summary (#123)" \
  -m "optional body paragraph"
```

Repeat `-m` once per body paragraph, git-style. Also accepted: `--header`,
`-F <file>`, `-F -` for stdin, `--no-push`, `--cwd <dir>`.

Message contract:
- header **≤72 chars**, `type(scope): imperative summary` — no trailing period,
  no emoji
- types: `feat fix docs style refactor test chore perf ci build`
- a **ticket ref** (e.g. `(#123)` or `(GYM-1)`) must appear somewhere
- body auto-wraps at 100 chars — write freely

Amend / fixup / empty commits are exempt via `--amend`, `--allow-empty`,
`fixup!`, `squash!`.

**Set a human identity first** — not a generic or tool identity:

```bash
git config user.name "<the user's name>"
git config user.email "<the user's email>"
```
