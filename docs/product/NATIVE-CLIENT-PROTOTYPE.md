# Native client prototype

Scope: [GYM-4](https://linear.app/12-apps/issue/GYM-4/build-the-tenant-scoped-native-workout-client-prototype).

## What this build does

- Presents separate sample gym, two personal-training and physiotherapy spaces for one sample member.
- Shows assigned workouts and exercise prescriptions without an editing surface.
- Starts an independent active session for each space; navigation and provider switches retain its state.
- Records completed sets and validated load/repetition values, with cancel and error paths.
- Runs wall-clock execution and rest timers, including pause/resume, extra rest and skip.
- Saves a completed-set snapshot into the selected space's history or explicitly discards it.
- Uses React Native components through the published `@12-apps/ui` native exports. It contains no HTML renderer or WebView.

The input reference is the user-supplied `Future Gym.html` (105,552 bytes). The app keeps its weekly workout-letter pattern, semantic plate colors, ordered exercises, load/repetition logging, timer phases and session summaries. Typography, spacing, surfaces and controls use the shared design system; no reference CSS or browser implementation is copied into the app.

## Deliberate boundaries

This is a session-only sample adapter. All sample content is visibly labeled and stays in memory. Relaunching the process clears demo sessions/history. There is no authentication, server authorization, API persistence, trainer transmission, real billing or subscription flow. Exercise examples are fixtures, not a training recommendation. No pricing, minimum student count or permanent application identifier has been invented.

The business plan admits one global user to multiple provider tenants, including multiple providers of the same type at the same time. There is no one-personal-trainer limit. Both sample personal trainers remain selectable and have independent prescriptions, active sessions and history keyed by tenant ID, never provider type. The fixture includes a gym owner who is also a client of a separate physiotherapy provider; ownership never crosses that tenant boundary. The prototype rejects stale-account and mis-keyed-tenant snapshots before both display and mutation. It keeps all records under the selected tenant and carries the sample user ID through session and history boundaries. These guards prevent local state leakage; they are not a substitute for server-side membership verification. The future API must derive membership/permissions from the authenticated user and selected tenant, never trust these mock identifiers.

Prescription editing and partner duels are intentionally deferred from this first functional version. Trainer desktop React web, backend and superadmin are separate work. The volume view reports direct planned sets from sample prescriptions and makes no ideal-volume, recovery, or clinical claims.

## Timer semantics

Deadlines use wall-clock timestamps rather than decrementing counters, so delayed foreground updates do not extend a timer accidentally. Pause saves the precise remaining milliseconds. Expired rest returns to ready. This first prototype has no background alarm, notification, audio or haptic service. Execution reaching zero does not mark any sets as performed: the person confirms completion. In particular, leaving the app in the background cannot manufacture repetitions, volume or training history. Manual completion/undo reconciles the exercise's pending set and clears a running timer.

Finishing stores detached copies of all set logs and counts only explicitly completed sets. Empty sessions cannot be saved. A stale action carries both tenant and session identity and is rejected after a tenant switch or a completed session. Repeated completion cannot duplicate history.

Numeric editing uses a dedicated shared Screen route. That keeps keyboard avoidance and native Back/cancel behavior in the navigation/screen primitives instead of trying to lift input fields inside a separate Modal window.

## Native dependency

Every screen requires the shared `@12-apps/ui/layout/Screen` export for safe area, scroll and keyboard handling. The app pins the published `@12-apps/ui` version `6.57.0`, including Screen, native navigation/sound icons, circular progress center content and bottom-sheet dialogs. The app has no fallback implementation and never imports raw `react-native` components or types.

## Verification record

The initial results in this section use the published [UI 6.56.0 release](https://github.com/12-apps/shared-packages/releases/tag/ui-v6.56.0).
Both prior dependency trees were removed before a frozen-lockfile registry install.
The installed version and lockfile integrity were checked against the actual
registry tarball (`sha512-uFDhi8ujqAxE4veUKqKj72ab7GVXqG9ZUgJa4+XIYOnUXKrn5GHUi4rVsoVGSpKnez98XDEL5L2QHNgjTCk2pw==`).
No local path, candidate version or source overlay is required.

- Native tests: 122 passed across 12 Android/iOS suites, zero skipped (2026-09-30,
  34.097 seconds, with a 1,536 MB Node heap limit). Includes 33 pure state cases per platform, nine real-router
  flows per platform, 16 navigation/lifecycle regression cases per platform, provider/router smoke checks, and a shared theme contract.
- Root contracts: 43 passed, zero skipped. The initial foundation-only
  `FOUNDATION_COPY` assertion was updated to the actual `CLIENT_COPY`; the check
  now scans all production sources and pins the shared Screen import and absence
  of WebView/HTML rendering.
- App lint, typecheck, ADR record validation and diff whitespace checks: passed.
- Fresh Android Hermes export: 1,407 modules, 8,266 ms Metro, 3,041,703 bytes.
- Fresh iOS Hermes export: 1,272 modules, 7,763 ms Metro, 2,730,080 bytes.
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

The owner subsequently requested removal of the recurring Expo advisory at its
cause. The resolved runtime manifest contained no linking scheme and the pinned
`expo-linking` resolver warns whenever the scheme list is empty. The normal
development command now selects a development-only scheme through Expo config.
No warning filter, LogBox override or Expo Go patch is present. The standalone
identifiers and production scheme remain unset. A fresh native audit must reject
the warning on initial launch and cold reopen rather than dismissing it.

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

## Same-type provider clarification

The sample global person now belongs to both Personal Marina and Personal Rafael
concurrently. A state regression exercises independent active sessions, histories,
reused completed loads and stale-command rejection even when both prescriptions
use the same exercise ID. A real-router flow selects both providers, saves each
session separately and checks that the other provider’s volume/history stays hidden.
These are state/renderer/router tests, not backend E2E. File-database-backed E2E
will consume the shared foundation’s FuturePay-compatible test infrastructure
after integration, rather than creating another database layer here.
This adds no pricing, exclusivity, subscription or backend authorization behavior.

Clarification verification (2026-09-30): 122 Android/iOS cases and 43 root cases
passed with zero skipped, plus lint, types, ADR records and both fresh Hermes
exports. Independent focused review found no blocker. The first unbounded-heap
full test invocation exited without assertion output and is not counted as a
pass; the full bounded-heap rerun passed. The cause of that first exit remains
unconfirmed. These results do not replace the pending native device audit.

## Rendered-reference fidelity correction, round 1

The first actual same-width comparison inspected 20 original artboards and the
23 warning-free Android states from run 36915950179. It rejected ten grouped
layout/interaction differences; successful runtime execution did not grant
visual acceptance. The closed list includes dated home navigation and volume
access, compact workout details/persistent start, centered timer and inline set
controls, session navigation/audio, bottom-anchored finish, summary/history
information, and matching wide-screen evidence.

The first correction restores dates/week range, repeated dated schedule rows and
rest-day next-workout access; restores direct home access to honestly labeled
planned-volume counts; restores compact detail rows, count/duration/last-load
metadata and viewport-persistent start/summary return; restores unperformed
summary labels and history count/tonnage/set aggregates with duration. The page
uses one outer shared Screen safe-area/keyboard owner, a shared scrolling child
and a footer sibling. Container sizing uses theme spacing at the reference's
column width; tab layout responds to its measured container, with labels below
icons. Six additional router/calendar regressions cover these changes.

Timer center content and a bottom-sheet confirmation require the shared UI
capabilities named by the appearance ADR. Those are being prepared upstream;
no consumer fallback, forged package version or local visual primitive is used.
Inline editing/audio and the full phone/wide re-audit remain outstanding. This
partial correction is not a fidelity approval or merge readiness claim.

## Owner acceptance and bounded continuation — 2026-10-01

The owner accepted the demonstrated native appearance for the playable prototype
and approved merging it after the remaining protocol gates. A future design
system pass will decide colours, contrast, typography and sizing; this PR does
not claim exact HTML styling fidelity or final visual-design acceptance. The
existing shared-token and native-component ADR remains binding.

This decision resumes work after the disclosed greater-than-50-percent diff
stop. The remaining review units are the additive shared Progress centre slot,
Dialog bottom-sheet placement and native sound icons, then the consumer's
functional inline set controls, sound toggle/cues, timer information and finish
interaction. The shared changes have explicit conditional merge/publication
approval and must arrive through a verified registry release. No local UI
fallback or invented package version is allowed. Prescription editing, duels,
production application identity and billing remain outside this prototype.

The original appearance differences remain recorded in the first review rather
than relabeled as an exact visual match. Missing functional controls and any
introduced runtime, data-isolation or accessibility defect still require a fix
and fresh exact-head tests/screenshots before merge. The 23-state audit from
36915950179 proves warning removal, including cold reopen; it predates these
control changes and is not their acceptance evidence.


## Integrated controls and published dependency — 2026-10-01

The shared prerequisite merged as shared-packages #746 at 473c915 and published
`@12-apps/ui@6.57.0` through its normal CI/CD. The downloaded registry tarball's
SHA-512 matches its published SRI; both declaration trees expose the two APIs,
and changed production sources match the reviewed package source. Dependencies,
peer dependencies and engines match 6.56.0 exactly, so the consumer retains the
existing resolved graph and changes only the version and verified integrity.

The remaining controls now use that release: the centered timer and underlying
paused phase; inline validated kg/repetitions, +/-2.5 kg and completion/target
state; persistent next/final navigation; sound toggle and foreground cues; and
the bottom finish sheet with full-width save/discard/continue. Routed editing is
retained, with invalid inline drafts discarded when entering that editor and
late blur events prevented from restoring them. Audio configuration failures
remain visible while explicit recording still works; no warning is suppressed.

The isolated audio transition unit passed 208 Android/iOS cases, zero skipped,
in exact-head CI36928846082 at 593515c. Its composed field-blur/Skip-rest case
preserves the cue without counting an unperformed set. The final integrated
native suites and actual Android proof are still pending. The prepared audit
requires all ten counterpart states at 390/1280, inline/routed error and cancel
paths, large-font/keyboard controls, both personal-provider histories, empty
save/discard/restart, cold reopen and UID-attributed native playback events.
Headless service evidence will not be called audible-output proof.


## Final control-action correction — 2026-10-02

Exact consumer head 667e514 passed CI 36933184873 with 220 Android/iOS renderer
cases, 46 root contracts, lint, types and Android export. The subsequent
independent control review reproduced an introduced boundary defect: entering
`40kg` inline and pressing the main Complete-set button completed the set with
its previous recorded load while the invalid draft remained visible. Both
Android and iOS renderer reproductions failed before the fix.

The main action now validates and commits its active row's actual draft before
completing the set, even when the native input has not blurred. Requesting the
finish sheet validates and commits all current rows before displaying its
summary; an invalid completed-row draft remains editable and cannot silently be
omitted from the saved snapshot. Cancel or correction recovers the normal flow.
The regression suite covers invalid load/repetitions, valid focused decimals,
completion volume, finish validation and recovery. Fresh exact-head CI and native
execution are required; the previous 220-case result is not their acceptance.

Runtime audit 36933459047 failed because the driver expected an in-memory workout
to survive Android font-scale Activity recreation. That test assumption was
corrected on the existing verification-only branch: stop Expo, configure font,
launch fresh, and start a workout using real controls; repeat after restoring
the original setting. The host's supported Tools drag is verified from fresh
bounds before sound is tapped. Audit 36964248201 exercises those harness fixes
on the older 667e514 application bytes and cannot accept this later app fix.

Corrected-tree verification: 232 real Android/iOS renderer cases passed across
22 suites, zero skipped, in 32.824s; lint and types passed. Independent focused
verification passed all 12 new action/draft and recovery executions. The earlier
46 root contracts also passed. These local results await remote exact-head CI
and a new native audit of the changed application tree.
