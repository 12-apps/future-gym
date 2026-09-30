# Native client prototype

Scope: [GYM-4](https://linear.app/12-apps/issue/GYM-4/build-the-tenant-scoped-native-workout-client-prototype).

## What this build does

- Presents separate sample gym, personal-training and physiotherapy spaces for one sample member.
- Shows assigned workouts and exercise prescriptions without an editing surface.
- Starts an independent active session for each space; navigation and provider switches retain its state.
- Records completed sets and validated load/repetition values, with cancel and error paths.
- Runs wall-clock execution and rest timers, including pause/resume, extra rest and skip.
- Saves a completed-set snapshot into the selected space's history or explicitly discards it.
- Uses React Native components through the published `@12-apps/ui` native exports. It contains no HTML renderer or WebView.

The input reference is the user-supplied `Future Gym.html` (105,552 bytes). The app keeps its weekly workout-letter pattern, semantic plate colors, ordered exercises, load/repetition logging, timer phases and session summaries. Typography, spacing, surfaces and controls use the shared design system; no reference CSS or browser implementation is copied into the app.

## Deliberate boundaries

This is a session-only sample adapter. All sample content is visibly labeled and stays in memory. Relaunching the process clears demo sessions/history. There is no authentication, server authorization, API persistence, trainer transmission, real billing or subscription flow. Exercise examples are fixtures, not a training recommendation. No pricing, minimum student count or permanent application identifier has been invented.

The business plan admits one global user to multiple provider tenants. The fixture includes a gym owner who is also a client of a separate physiotherapy provider; ownership never crosses that tenant boundary. The prototype rejects stale-account and mis-keyed-tenant snapshots before both display and mutation. It keeps all records under the selected tenant and carries the sample user ID through session and history boundaries. These guards prevent local state leakage; they are not a substitute for server-side membership verification. The future API must derive membership/permissions from the authenticated user and selected tenant, never trust these mock identifiers.

Prescription editing and partner duels are intentionally deferred from this first functional version. Trainer desktop React web, backend and superadmin are separate work. The volume view reports direct planned sets from sample prescriptions and makes no ideal-volume, recovery, or clinical claims.

## Timer semantics

Deadlines use wall-clock timestamps rather than decrementing counters, so delayed foreground updates do not extend a timer accidentally. Pause saves the precise remaining milliseconds. Expired rest returns to ready. This first prototype has no background alarm, notification, audio or haptic service. Execution reaching zero does not mark any sets as performed: the person confirms completion. In particular, leaving the app in the background cannot manufacture repetitions, volume or training history. Manual completion/undo reconciles the exercise's pending set and clears a running timer.

Finishing stores detached copies of all set logs and counts only explicitly completed sets. Empty sessions cannot be saved. A stale action carries both tenant and session identity and is rejected after a tenant switch or a completed session. Repeated completion cannot duplicate history.

Numeric editing uses a dedicated shared Screen route. That keeps keyboard avoidance and native Back/cancel behavior in the navigation/screen primitives instead of trying to lift input fields inside a separate Modal window.

## Native dependency

Every screen requires the shared `@12-apps/ui/layout/Screen` export for safe area, scroll and keyboard handling. The app pins the published `@12-apps/ui` version `6.56.0`, which includes Screen and the native Home, FitnessCenter and History icons. The app has no fallback implementation and never imports raw `react-native` components or types.

## Verification record

All results below use the published [UI 6.56.0 release](https://github.com/12-apps/shared-packages/releases/tag/ui-v6.56.0).
Both prior dependency trees were removed before a frozen-lockfile registry install.
The installed version and lockfile integrity were checked against the actual
registry tarball (`sha512-uFDhi8ujqAxE4veUKqKj72ab7GVXqG9ZUgJa4+XIYOnUXKrn5GHUi4rVsoVGSpKnez98XDEL5L2QHNgjTCk2pw==`).
No local path, candidate version or source overlay is required.

- Native tests: 118 passed across 12 Android/iOS suites, zero skipped (2026-09-30,
  42.539 seconds). Includes 32 pure state cases per platform, eight real-router
  flows per platform, 16 navigation/lifecycle regression cases per platform, provider/router smoke checks, and a shared theme contract.
- Root contracts: 43 passed, zero skipped. The initial foundation-only
  `FOUNDATION_COPY` assertion was updated to the actual `CLIENT_COPY`; the check
  now scans all production sources and pins the shared Screen import and absence
  of WebView/HTML rendering.
- App lint, typecheck, ADR record validation and diff whitespace checks: passed.
- Fresh Android Hermes export: 1,407 modules, 9,178 ms Metro, 3,041,434 bytes.
- Fresh iOS Hermes export: 1,272 modules, 8,393 ms Metro, 2,729,796 bytes.
- Both exports were cleared first and verified as nonempty files referenced by
  their platform's Metro metadata. Local export used two Metro workers after an
  unbounded-worker attempt exited without a bundle. That first attempt is not
  reported as successful; the cause is unconfirmed. The local environment also
  emits a NO_COLOR/FORCE_COLOR configuration warning.
- The first partial UI candidate was rejected: Screen/icons had a duplicate
  theme context and ignored a dark UiProvider. A consumer regression reproduced
  the mismatch on both platforms. The replacement builds all native/web entries
  together, and the unchanged regression passes against both the replacement
  full-source candidate and the published release.
- Device/runtime screenshots: pending a separately authorized GitHub-hosted
  audit. The prepared harness covers 16 states and passes Python/shell syntax and
  actionlint checks; these are preparation checks, not execution evidence.
- Visual reference: source inspected and exact bytes verified. The cloud browser
  refused the local reference's file URL; no visual-reference acceptance is claimed.

Renderer tests and Hermes exports establish neither an APK/IPA nor device,
simulator, signing, store, background-alarm or production acceptance.

## Review corrections

The initial review reproduced six defects: direct-link Back without a fallback,
a stale daily plan across midnight, missing interactive-card roles, duplicate
route pushes, duplicate/mixed editor exits, and a completed exercise still
showing set 1. All six are fixed in this change, with permanent regressions in
`client-navigation-regressions.test.tsx`.

Navigation now rejects queued duplicate callbacks until the screen is focused
again, and editor mutation/exit are guarded together. A theme-bound Expo Stack
retains the selected History tab beneath a summary. The local calendar refreshes
at midnight and resynchronizes after focus or delayed timer delivery. Cards have
actionable roles and descriptive labels; completed exercises show completed sets.

Independent fix verification passed the original 22 reproductions and the 32
permanent regression executions across Android/iOS. No fix-induced regression
was identified. A larger combined diagnostic invocation was killed without
assertion output and is not counted as passing; the separate checks and the
application's full 118-case invocation passed. Runtime/visual acceptance is still
pending and is not replaced by this source review.

## Manual acceptance path

1. Install the pinned dependencies and start Expo from `apps/mobile`.
2. In the sample gym, open workout A, inspect the prescribed exercises, then start it.
3. Edit set 1. Enter `40kg` and save: validation must remain visible. Cancel and reopen: the previous value must remain. Save `42,5` kg and `9` repetitions.
4. Start the set, pause/resume, complete it, add 15 seconds of rest, then skip rest. Only set 1 is completed.
5. Return home, change to the sample personal trainer and inspect its different plan. Return to the gym and resume: set 1 still belongs to the gym.
6. Finish, choose continue, then finish and save. The summary must show one completed set and 382.5 kg, excluding all planned-but-unperformed sets. The history remains empty in the other space.
7. Start an empty session and attempt to finish: save is disabled; discard returns home. Starting again creates a fresh session.
8. Check Android back/dismissal, keyboard reachability, small-phone scrolling and large-font layout on a real runtime. Check iOS separately; Android evidence does not establish iOS acceptance.
