# Future Gym

The gym app for the MVP epic [GYM-1](https://linear.app/12-apps/issue/GYM-1/mvp-future-gym): an Android app (Expo + `@12-apps/ui`) where a person runs this week's plan with a set/rest timer, logs loads, checks weekly volume per muscle group, and competes with a training partner.

This repository is a pnpm + turbo monorepo on the `12-apps/base-app` conventions. It has no workspaces yet; `apps/mobile` arrives with GYM-1 story 0.

## Layout

| Path | What |
| --- | --- |
| `apps/*`, `packages/*` | Workspaces (none yet). |
| `docs/adr/` | Architecture decisions. Unnumbered; the index is generated after each merge. |
| `docs/ci/EXPERIMENTS.md` | Append-only log of every CI change. A CI change without an entry fails `ci-success`. |
| `scripts/` | Root scripts: the CI documentation gate, the ADR index, their tests. |
| `.github/workflows/` | CI on the `12-apps/ci` engine (`static`, `tests`, `ci-success`) and the post-merge regeneration. |
| `.workflow/synapsys/` | Agent memories: the merge and orchestration protocols, process rules, `@12-apps/ui` notes. |

## Commands

```sh
pnpm install
pnpm turbo run lint check-types test build   # the tiers CI runs
node --test "scripts/__tests__/*.test.mjs"   # the root suite
node scripts/adr/render-index.mjs --records  # validate the ADRs
```

## Rules worth knowing first

- **Appearance comes only from `@12-apps/ui`**, and app code never imports `react-native`. See `docs/adr/appearance-comes-only-from-12-apps-ui.md`.
- **Every CI change is logged** in `docs/ci/EXPERIMENTS.md`. See `docs/adr/every-ci-change-is-documented.md`.
- **Code, commits, PRs and docs are English**; user-facing copy is pt-BR.
- **Secrets live in Doppler.**
