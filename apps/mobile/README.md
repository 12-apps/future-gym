# Future Gym mobile foundation

This is a screenless Expo SDK 57 / React Native Android shell. Its initial route
is intentionally empty. It does not implement the workout MVP described in
GYM-1.

## Commands

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @repo/mobile dev
pnpm --filter @repo/mobile lint
pnpm --filter @repo/mobile check-types
pnpm test:ci
pnpm test:ci:full
pnpm --filter @repo/mobile build
```

`build` creates an Android JavaScript/Hermes export in `dist/`; it is not an APK
and does not prove a device install. The APK workflow will be configured only
with the user's final Android package identifier and app name. Signing and
distribution remain separate decisions.

## Contracts

- Every route inherits `AppProviders`, the shared UI provider and explicit pt-BR
  locale. Visual components and values come only from `@12-apps/ui`.
- `expo-router` supplies navigation structure; the tab's colors come from the
  shared theme. No app code imports raw React Native components or style types.
- Jest uses the native Expo preset and native export conditions. Tests render
  the published shared UI native implementation and the actual router.
- Both CI unit paths run the sole real native workspace. The wrapper rejects
  missing/failed/all-skipped execution even when Jest itself exits zero.
- JSON and JUnit outputs live in `reports/` and are declared Turbo cache
  outputs. Root CI removes those files before each invocation; a hit must
  restore them. This guards against green tests with missing/stale evidence.
- Native-only shared UI gaps remain upstream work. No visual workaround is
  introduced here to bypass the accepted appearance ADR.
