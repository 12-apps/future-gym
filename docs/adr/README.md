# Architecture Decision Records

An ADR records ONE decision: what was decided, the situation that forced it, and
what it costs. It is written once and then left alone. A decision that changes
gets a NEW record that supersedes the old one, because the value is the trail.

The format follows `12-apps/future-pay` (`docs/adr/README.md`), minus the numbers.

## Naming: no numbers

A record is `docs/adr/<kebab-case-slug>.md` with the H1 `# <Title>`. It never
carries a number. Two branches in flight always want the same "next" number, and
the loser's citations end up pointing at somebody else's decision. A slug is
chosen by the author and does not collide by accident. Cite a record by its
path (`docs/adr/<slug>.md`), never by a number or a title alone.

A record whose decision changes is not renamed. Its Status becomes
`Superseded by [<slug>](./<slug>.md)` and the new record explains why.

## Format

Under the H1, in this order:

- **Status**: `Accepted`, `Superseded by [<slug>](./<slug>.md)` or `Rejected`, then ` — YYYY-MM-DD`.
- **Lane**: one paragraph, `**Lane:** <lane>`. It becomes the index's lane cell.
- **Summary**: one paragraph, `**Summary:** <the decision in one line>`. It becomes the index's decision cell.
- **Context**: the situation, with `file:line` citations. Cite another repository as `owner/repo@sha:path:line`.
- **Decision**: one paragraph in the active voice. "We do X."
- **Consequences**: what this buys and what it costs, including the work it creates.

Every factual claim carries a citation. A record whose Context cannot be checked
against the tree is worse than none, because it will be trusted.

## The index is generated after the merge

Do not edit the table below by hand. The last row of a hand-kept table is where
every pull request that adds a record meets every other one.

- **The workflow:** `.github/workflows/post-merge-regen.yml` runs `scripts/post-merge-regen.mjs` on every push to `main`. It lands the result as one auto-merged PR.
- **How the table is built:** it is rendered between the `adr-index` markers from each record's Status date, `Lane` and `Summary`. The oldest decision is first, and a tie is broken by slug.
- **Running it locally:** `node scripts/adr/render-index.mjs` rewrites the table. `--check` exits 1 when the table is stale or a record lacks its `Lane` or `Summary`.

<!-- adr-index:start -->
| Decision | Date | Lane | Summary |
| --- | --- | --- | --- |
| [Appearance comes only from `@12-apps/ui`](./appearance-comes-only-from-12-apps-ui.md) | 2026-09-30 | UI of every future-gym app (the Expo mobile app first; any web app later). | future-gym code imports nothing that renders or styles directly. Every visual element comes from `@12-apps/ui`: components, layout, typography, icons, colours, theme and style types. Only `@12-apps/ui` imports `react-native` (or MUI). A visual gap is fixed in `12-apps/shared-packages` and consumed through a version bump, never worked around locally. Expo modules are allowed for device capabilities that draw nothing. |
<!-- adr-index:end -->
