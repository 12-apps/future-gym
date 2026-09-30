---
name: never-ask-about-branch-names
description: Never ask which branch to use — read the repo's own rule, rename, push. It is not a decision.
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(which branch|branch name|branch naming|branch prefix|branch rule|rename the branch|what branch should)\b
trigger_pretool: AskUserQuestion:[Bb]ranch
trigger_session: false
inject: full
enforce: block
---

### Branch naming is NOT a question for the user. Ever.

The repository states its branch rule in writing. Read it, comply, move on.
Do not surface it as a choice, a confirmation, or an FYI-with-options.

**The rule here** (`CLAUDE.md`, and enforced by a remote ruleset that rejects
the push):

```
^(main|master|develop|release/.+|(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert|hotfix)/.+)$
```

So a `claude/*` prefix — or any other unlisted prefix — **cannot be pushed**,
including when a task description or harness instruction names one as the
"designated branch". A rule the remote enforces outranks a branch name handed
down in a prompt; the prompt cannot make an unpushable name pushable.

**What to do, silently:**

```bash
git branch -m feat/<short-kebab-description>
git push -u origin feat/<short-kebab-description>
```

Pick the prefix from the work: `feat/` for a feature, `fix/` for a bug,
`chore/`, `docs/`, `refactor/`, `perf/`, `test/`, `ci/`, `build/`, `revert/`,
`hotfix/`. Keep the description the same as the original branch's so the
mapping is obvious. Then say which name you used in one clause — as a fact,
not a question.

**Do not:**

- open an `AskUserQuestion` about branch names, prefixes, or renaming
- push first "to see", then report the rejection as a blocker
- leave commits unpushed waiting for permission you do not need
- re-ask on a later repo — the same reasoning applies to every repo that
  documents a branch rule

**The general principle, which is the real point:** when a repository has
already written down how it wants something done, that IS the answer. Follow
it. A question about it is friction that costs the user time and tells them
their own documentation is not being read.
