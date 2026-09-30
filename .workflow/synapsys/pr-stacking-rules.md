---
name: pr-stacking-rules
description: Use gh stack — an ad-hoc PR merely BASED on another branch gets ZERO check runs here
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(stack(ed|ing)? (prs?|pull requests?)|prs? stack(ed|ing)?|gh stack|stacked prs?|empilhar prs?)\b
trigger_pretool: Bash:gh\s+pr\s+create,Bash:gh\s+stack,mcp__github__create_pull_request:.*,mcp__github__merge_pull_request:.*,Bash:git\s+push
trigger_session: false
inject: full
---

### There are TWO ways to get a PR based on another branch, and only one gets CI

This is the distinction everything else hangs off, and it is easy to miss
because both produce a PR whose `base` is not `main`.

**1. A real GitHub stack** — created with the stacked-PRs feature (`gh stack`,
the web UI, or GitHub Mobile). Per [the docs][about] and the
[rollout guide][rollout]:

> CI checks triggered by pull requests on your default branch run for **all**
> pull requests in the stack, not just the bottom one.

> CI workflows triggering on pull requests targeting the default branch run for
> every stack member **with no configuration changes needed**.

> Required reviews, required status checks, and CODEOWNERS are all enforced
> against the stack's **base branch**.

So this repo's `pull_request: branches: [main]` filter is **not** a reason to
avoid stacking. GitHub runs the checks on every member anyway.

**2. An ad-hoc PR you merely pointed at another branch** — `gh pr create --base`,
or `create_pull_request({ base: "some-other-branch" })`. GitHub does not treat
this as a stack. The base does not match `branches: [main]`, so the workflow
matches nothing and the PR gets **zero check runs** — not a red run, *no run at
all*. Nothing blocks the merge and the code lands on the parent branch
unverified.

**Measured, not inferred:** future-pay#836 was opened this way and had 0 check
runs while every sibling PR in the same batch had 20-26.

### A 403 here is usually the session PROXY, not GitHub

This one has already produced a wrong conclusion once, so read it before you
interpret any failed GitHub call. Claude Code sessions run behind an agent proxy
that serves only a pinned set of GitHub operations. Two consequences:

- **GraphQL is refused outright** — `POST /graphql` 403s on every query,
  including `viewer { login }`, and introspection comes back with zero fields
  rather than an error. The `stack` field on `PullRequest` is exposed *only* in
  GraphQL, so **you cannot ask GitHub whether a PR is in a stack from here.**
- **Merge and retarget calls can 403 for the same reason** — and that says
  nothing whatsoever about stacking.

Tell the two apart by the **body**, never by the status code:

```jsonc
// the session proxy — documentation_url points at anthropic.com
{"message": "This GraphQL query is not enabled for this session …",
 "documentation_url": "https://docs.anthropic.com/en/docs/claude-code/github-actions"}

// GitHub itself — documentation_url points at docs.github.com
{"message": "Resource not accessible by integration",
 "documentation_url": "https://docs.github.com/rest/actions/workflow-jobs#…"}
```

A proxy 403 means "not available from here", so it is never evidence about the
PR. The trap is to read `403 on merge` as *GitHub refused because this is a
stack* and then "correct" this file on the strength of it. **Judge stack-ness by
the check-run count**, which is observable: a based-on-branch PR sitting at 0
checks in a repo whose workflow filters `branches: [main]` is the ad-hoc trap
above, whatever the merge endpoint says.

### Nothing needs enabling

> This is a workflow capability, not a gated feature. […] no setup or
> enablement — if teams already use pull requests, they can create stacks
> immediately.

(The CLI does define exit code 9, "Stacked pull requests are not enabled for
this repository", so a specific deployment may still refuse. Treat the rollout
guide as the rule and code 9 as the exception to read carefully if you see it.)

### Doing it

Needs `gh` 2.90.0+ and Git 2.20+.

```bash
gh extension install github/gh-stack

gh stack init                     # names the first branch; base = repo default
git add . && git commit -m "…"
gh stack add BRANCH-NAME          # next branch on top
gh stack add -Am "MESSAGE"        # or: stage + commit + branch, in one step
gh stack push                     # push every branch in the stack
gh stack submit                   # open/refresh the PRs with the right bases
gh stack view                     # where am I
gh stack sync --prune             # fetch, rebase, push, sync PR state
```

**Already opened them the ad-hoc way?** `gh stack link` converts existing PRs
into a stack on GitHub *without* local tracking:

```bash
gh stack link <branch-or-pr> <branch-or-pr> [...]
```

That is the repair for a PR sitting at zero checks — better than retargeting it
at `main` and losing the dependency, and much better than merging it on the
strength of its parent's green run.

### Merging a stack needs the ASYNCHRONOUS merge API

> Merging a stacked pull request requires the asynchronous merge API. Legacy
> endpoints cannot merge stacks.

This one bites automation, not humans. Any bot, script or MCP tool that merges
programmatically through a legacy merge endpoint will fail on a stacked PR —
check `ci.yml` (its `auto-ready` job) and anything else that merges for us before relying on
stacks in a lane that auto-merges.

From an agent session you likely cannot merge a stack at all: the asynchronous
endpoint was refused with both `GITHUB_TOKEN` and `GH_PERSONAL_ACCESS_TOKEN`.
Per the section above, check whether that refusal is the proxy's before
reporting it as GitHub's — but either way, **say the merge did not happen**
rather than inferring a cause. Ask the user to merge it.

Merging the **bottom** PR merges it and automatically rebases the rest onto the
base branch. Merging **mid-stack** merges everything below it; the ones above
stay open and re-target the stack's base. Merge requirements for every PR in the
stack come from the **bottom** PR's base, typically `main`.

### A base retarget does not start a CI run

Automatic or manual, the retarget emits no `pull_request` event this workflow's
`types:` list reacts to. The PR now matches the filter and **still has no
checks**, which looks exactly like the ad-hoc trap above.

**Push to the branch.** `synchronize` fires reliably. Same fix as a PR that never
got checks at all — and for the same reason, do NOT close/reopen: a PR opened
through the API may never emit a usable `opened` event, and a close/reopen risks
stranding it.

```bash
git commit --allow-empty -m "chore: trigger CI after base retarget"
git push
```

### Limitations to know before planning a stack

- **Same repository only** — cross-fork stacks are not supported.
- **Not supported in GitHub Desktop.** CLI, web, Mobile, and Webhooks/REST/
  GraphQL only.
- Structural rule: if code in one layer depends on code in another, the
  dependency must be in the same branch or a **lower** one.
- Non-stacked PRs are unaffected — their `stack` field is `null`.

### PR lifecycle for a finished change

1. Open as a **draft** once the work is pushed.
2. Push fix commits until every check is green, re-diagnosing each failure.
3. Mark **ready for review** only when CI passes clean.
4. Resolve every review-bot comment with a follow-up commit, or a reply saying
   why it doesn't apply. The PR is done only when no bot item is unaddressed.

**If the PR for your branch is already MERGED**, treat follow-up work as a fresh
change — never stack new commits on merged history:

```bash
git fetch origin main && git checkout -B <branch-name> origin/main
```

[about]: https://docs.github.com/en/pull-requests/get-started/about-stacked-prs
[rollout]: https://docs.github.com/en/pull-requests/tutorials/roll-out-stacked-prs
