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
and does not prove a device install. `android.package` is intentionally unset:
the foundation's tests and bundle do not need a final application identity.
Final branding and the Play Store identifier can be decided later; owning a
domain is not a prerequisite for an Android application ID. See the
[Android ID rules](https://developer.android.com/build/configure-app-module)
and [Expo configuration reference](https://docs.expo.dev/versions/latest/config/app/#package).

Expo Go can host this development bundle using its own installed application
identity. Use a matching SDK 57 Android build to validate the native shell
without inventing a package identifier. A standalone development APK would need
an explicitly chosen development ID; never silently turn a temporary value into
the production identity. After publication, changing the application ID makes it
a different app. Signing and distribution remain separate decisions.

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

## Observed development runtime

The [SDK 57 Expo Go audit](https://github.com/12-apps/future-gym/actions/runs/36766752079)
rendered this shell on Android API 35 with `android.package` still unset. It
verified the localized tab, repeated interaction, background/resume, cold reopen
and phone/wide layouts. The captures show an Expo production-scheme advisory;
that warning has not been suppressed or resolved. Runtime behavior passing is
not a zero-warning or production-readiness claim. See E-008 in
[`docs/ci/EXPERIMENTS.md`](../../docs/ci/EXPERIMENTS.md) for the measured attempts,
screenshots and remaining acceptance boundary.

## Functional client prototype (GYM-4)

The prototype adds tenant-scoped sample plans, native workout execution and timers,
validated load/repetition input, and completed-set history. One global sample user
can own a gym and be a client of another provider. All records stay in memory for
this demonstration; no login, network persistence, billing or real prescription
is represented as implemented.

The normal native Jest command runs both Android and iOS presets. A preset pass
is source/renderer coverage, not a device or simulator boot. The required CI build
remains Android export; a separate `expo export --platform ios --output-dir
<scratch-directory>` verifies iOS bundling without creating an IPA or a permanent
bundle identifier. See [scope, limitations and acceptance steps](../../docs/product/NATIVE-CLIENT-PROTOTYPE.md).
