---
name: branch-from-main-after-squash-merge
description: After a squash merge, cut the follow-up branch from main — the old one's merge base predates the squash
events: UserPromptSubmit,PreToolUse
trigger_prompt: \b(squash|merge base|follow-?up (pr|branch|change)|branch (off|from)|checkout -b|already merged|new branch)\b
trigger_pretool: Bash:git\s+checkout\s+-[bB],Bash:git\s+switch\s+-c,Bash:git\s+branch\s+-[mM]
trigger_session: false
inject: full
enforce: suggest
---

### After a SQUASH merge, branch from `main` — never from the merged branch

A squash merge puts a **new commit** on `main`. Your old branch still carries
the originals, so `merge-base(main, oldbranch)` sits BEFORE the squash. Cut the
follow-up from that branch and the PR silently re-proposes everything you
already merged.

**It does not look like a mistake.** The PR shows files you "changed" but did
not touch; the paths filter sees code where you wrote only docs; the heavy lanes
all wake up. Measured here: **33 billed minutes instead of 1** on a four-file
docs PR — a 32-minute tax, paid on the session whose whole complaint was CI
burning time on nothing.

**Check before opening the PR.** Two dots, not three — `...` diffs from the
merge base and will happily show you the same illusion GitHub does:

```bash
git diff origin/main..HEAD --stat     # ONLY what you actually changed
```

If that lists files you did not edit, you branched from the wrong place.

**Cut it right in the first place:**

```bash
git fetch origin main
git checkout -B <branch> origin/main
```

**Repairing one already pushed** (your own branch, unmerged — never someone
else's):

1. Save the files you meant to ship.
2. `git fetch origin main && git checkout -B <same-branch> origin/main`
3. Re-apply them — but for a file others also edit (`CLAUDE.md`, a shared
   config), **re-apply your edit onto main's current version** rather than
   copying your stale whole-file copy back, or you revert whatever landed since.
   Check with `git log <merge-base>..origin/main -- <file>`.
4. `git push --force-with-lease` — same branch, so the open PR updates in place.

The same rule covers the ordinary case: **if the PR for your branch is merged,
follow-up work starts from `main`.** Never stack new commits on merged history.
