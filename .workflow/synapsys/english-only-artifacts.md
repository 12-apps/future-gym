---
name: english-only-artifacts
description: Commits, PRs, code and comments are ENGLISH — the Portuguese in git history is a bug, not the convention
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(commit|commit message|pr body|pull request|open a pr|create a pr|abrir (um )?pr|changelog|release notes|code comment|docstring|readme)\b
trigger_pretool: Bash:git\s+commit,Bash:commit-and-push,mcp__github__create_pull_request:.*,mcp__github__update_pull_request:.*,mcp__github__add_issue_comment:.*,mcp__github__add_comment_to_pending_review:.*,mcp__github__pull_request_review_write:.*,mcp__github__create_or_update_file:.*,mcp__github__push_files:.*
trigger_session: false
inject: full
---

### 12-apps writes English. Do not copy the language you find in git log.

**Everything a developer reads is English:**

| Artifact | Language |
|---|---|
| Commit messages (header AND body) | **English** |
| PR titles, PR bodies, PR/review comments | **English** |
| Code: identifiers, comments, docstrings, test names | **English** |
| Docs (`docs/**`, `README.md`, `CLAUDE.md`, package READMEs) | **English** |
| Branch names | **English** |

**Everything an end user reads stays pt-BR.** The storefront, admin and
super-admin ship to Brazilian users, so user-facing strings are Portuguese and
must NOT be "fixed":

```tsx
<Button>Agora não</Button>                       // ✓ product copy — leave it
Instale {loja} no seu celular…                   // ✓ product copy — leave it
/** The one-tap route: Chromium held a prompt. */ // ✓ comment — English
```

Seed data, fixture names and Gherkin `.feature` files written in the shopper's
own words are product copy too. The test *file* is English; the shopper's line
in a scenario is not.

### The history is NOT evidence — this is the trap

`git log` on `main` is full of Portuguese commit subjects and bodies
(`fix(admin): pinar @12-apps/ui…`, `feat(mcp): enviar a imagem…`). **Those are
mistakes that agents copied from each other**, not the house style. One agent
wrote Portuguese, the next read the log, matched the pattern, and it compounded
until it looked like a convention.

So: **do not infer the language from surrounding commits, PR bodies, or the
user's own chat language.** The user writes to you in Portuguese and still wants
English artifacts. Read this rule as the source of truth and ignore the sample.

### When you catch it

- Not yet pushed → rewrite the message before committing.
- Pushed, PR open → fix the PR title and body via `update_pull_request`, and
  amend + force-push the commit if the branch allows it (many do not; the repo
  ruleset blocks force-push, in which case the PR title/body is the fix you have).
- Already merged → leave it. Do not rewrite published history.
