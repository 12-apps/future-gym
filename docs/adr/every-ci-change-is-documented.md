# Every CI change lands with an entry in the experiments log

**Status:** Accepted — 2026-09-30

**Lane:** CI

**Summary:** Every pull request that changes CI (`.github/workflows/`, `scripts/ci/`, `scripts/ci-*.mjs`, and what the post-merge job runs) lands with an entry in `docs/ci/EXPERIMENTS.md`. Entries are append-only, and a correction is an addendum. `scripts/ci/ci-change-documented.mjs` enforces both rules in `ci-success`; Renovate pin bumps are exempt from the entry rule.

## Context

- **Where the rule comes from.** `12-apps/future-pay` adopted this rule in its ADR 0069 (`12-apps/future-pay@7ccf1e1:docs/adr/0069-every-ci-change-is-documented.md`).
- **Why it exists there.** Every CI defect it recorded was green, and four of them were found by a person reading the inputs, not by a red run. For example, a reusable-workflow input passed before the engine declared it scheduled zero jobs (run 36641143797, cited there). The measurements that justified the work lived in a chat thread until the log existed.
- **What this repo already has.** future-gym consumes the same engine (`12-apps/ci`): `.github/workflows/post-merge-regen.yml` calls `post-merge-regen.yml@v2`. It also already keeps its trail of decisions in `docs/adr/` (`docs/adr/README.md`) and has a CI log with E-001 (`docs/ci/EXPERIMENTS.md`). What it lacked was the gate that makes the log mandatory.
- **Where a gate would run.** Before this record the repository had no pull-request workflow at all, so a gate would have had nowhere to run.

## Decision

We keep `docs/ci/EXPERIMENTS.md` as the append-only log of every experiment, measurement and outcome behind a CI change, and every pull request that changes CI lands with an entry there.

**What counts as CI:** `.github/workflows/`, `scripts/ci-*.mjs`, `scripts/ci/`, `scripts/post-merge-regen.mjs` and `scripts/adr/`. The list lives in `CI_PATH_RE` in the gate.

**What an entry states:**
- the question;
- the method;
- the result, with its run ids;
- why it turned out that way;
- the invariant a later change could break, together with the check that pins it.

**Append-only:** an entry is never deleted or rewritten. A later finding is an addendum at its end, or a new entry.

**Enforcement:** `scripts/ci/ci-change-documented.mjs` (ported from future-pay, with this repository's CI paths) enforces both halves in the `ci-success` job of `.github/workflows/ci.yml` on every pull request. Renovate's branches are exempt from the entry rule, not from the append-only rule. The synapsys memory `ci-experiments-log` puts the log in front of any session that touches CI.

## Consequences

- **Cost:** a CI change costs a paragraph more. The measurement that paragraph reports has to be taken anyway (memory `ci-work-must-be-tested`).
- **Growth:** the log grows without bound, by design. It is indexed by mechanism at the top.
- **Corrections:** a correction cannot erase what it corrects. That is the property the trail is for.
- **What the rule misses:** Renovate is exempt, so an action pin bump can regress a mechanism without a word here. The engine's own tests in `12-apps/ci/.github/workflows/__tests__/` are what catch that class.
- **No base, no check:** on a checkout without a base (no pull-request context and no `origin/main`), the gate cannot diff. It says so with a notice and passes. Enforcement rests on the pull-request run. future-pay also runs the gate in pre-push; this repository has no git hooks yet.
- **New required check:** `ci-success` becomes the check a branch rule should require on `main`.
