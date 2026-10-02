# Native client prototype

Scope: [GYM-4](https://linear.app/12-apps/issue/GYM-4/build-the-tenant-scoped-native-workout-client-prototype).

## What this build does

- Presents separate sample gym, two personal-training and physiotherapy spaces for one sample member.
- Shows assigned workouts and exercise prescriptions without an editing surface.
- Starts an independent active session for each space; navigation and provider switches retain its state.
- Records completed sets and validated inline or routed load/repetition values, with cancel and error paths.
- Runs wall-clock execution and rest timers, including pause/resume, extra rest and skip.
- Offers optional foreground sound cues; mute and re-enable do not replay earlier events.
- Saves a completed-set snapshot into the selected space's history or explicitly discards it.
- Uses React Native components through the published `@12-apps/ui` native exports. It contains no HTML renderer or WebView.

The input reference is the user-supplied `Future Gym.html` (105,552 bytes). The app keeps its weekly workout-letter pattern, semantic plate colors, ordered exercises, load/repetition logging, timer phases and session summaries. Typography, spacing, surfaces and controls use the shared design system; no reference CSS or browser implementation is copied into the app.

## Deliberate boundaries

This is a session-only sample adapter. All sample content is visibly labeled and stays in memory. Relaunching the process clears demo sessions/history. There is no authentication, server authorization, API persistence, trainer transmission, real billing or subscription flow. Exercise examples are fixtures, not a training recommendation. No pricing, minimum student count or permanent application identifier has been invented.

The business plan admits one global user to multiple provider tenants, including multiple providers of the same type at the same time. There is no one-personal-trainer limit. Both sample personal trainers remain selectable and have independent prescriptions, active sessions and history keyed by tenant ID, never provider type. The fixture includes a gym owner who is also a client of a separate physiotherapy provider; ownership never crosses that tenant boundary. The prototype rejects stale-account and mis-keyed-tenant snapshots before both display and mutation. It keeps all records under the selected tenant and carries the sample user ID through session and history boundaries. These guards prevent local state leakage; they are not a substitute for server-side membership verification. The future API must derive membership/permissions from the authenticated user and selected tenant, never trust these mock identifiers.

Prescription editing and partner duels are intentionally deferred from this first functional version. Trainer desktop React web, backend and superadmin are separate work. The volume view reports direct planned sets from sample prescriptions and makes no ideal-volume, recovery, or clinical claims.

## Timer semantics

Deadlines use wall-clock timestamps rather than decrementing counters, so delayed foreground updates do not extend a timer accidentally. Pause saves the precise remaining milliseconds. Expired rest returns to ready. Optional audio cues run in the foreground; there is no background alarm, notification, audio or haptic service. The prototype requests no recording permission and disables background recording/playback. Execution reaching zero does not mark any sets as performed: the person confirms completion. In particular, leaving the app in the background cannot manufacture repetitions, volume or training history. Manual completion/undo reconciles the exercise's pending set and clears a running timer.

Finishing stores detached copies of all set logs and counts only explicitly completed sets. Empty sessions cannot be saved. A stale action carries both tenant and session identity and is rejected after a tenant switch or a completed session. Repeated completion cannot duplicate history.

Numeric editing is available inline and through a dedicated shared Screen route. Both use the same whole-value validation. Main completion validates and commits the active set's draft; opening finish validates and commits the current exercise's rows, including values that have not blurred. An invalid active-set draft blocks completion; any invalid current-row draft blocks finish until corrected or canceled. The routed editor retains keyboard avoidance and native Back/cancel behavior in the navigation/screen primitives.

## Native dependency

Every screen requires the shared `@12-apps/ui/layout/Screen` export for safe area, scroll and keyboard handling. The app pins the published `@12-apps/ui` version `6.57.0`, including Screen, native navigation/sound icons, circular progress center content and bottom-sheet dialogs. The app has no fallback implementation and never imports raw `react-native` components or types.

## Accepted Android runtime evidence — 2026-10-02

The complete [native audit 37070038717](https://github.com/12-apps/future-gym/actions/runs/37070038717)
passed against consumer `7295e2c29073f40af0d744db095d0d7342f24dc5`, mobile tree
`51528c56bbeb6236f7522f6e6d4f5ca4fb65cd62`. Verification-only harness
`49590703e9f3fa969ecf15e8e45a2470cd87fd7c` captured 56 named states, all 20
phone/wide counterparts and 59 original native PNGs including host setup and
cleanup captures. The immutable original HTML references are from successful
reference run 37068097713, at 390×844 and 1280×800; the input remains 105,552 bytes.

- Inline/routed invalid input, correction, cancel, focused completion and finish
  validation passed. The completed 42.5 kg × 9 set produced 382.5 kg in summary
  and history; unperformed sets were excluded.
- Pause/resume, +15 seconds and skip rest, continue/save/discard, empty-save
  refusal and clean restart passed. Marina's 120 kg and Rafael's 96 kg records
  remained separate from each other, the gym and physiotherapy.
- Fresh-launch 1.3× font checks passed and restored 1.0. Native series labels,
  complete targets, keyboard actions, persistent footers and finish sheets
  remained reachable. Expo Go Tools used its supported drag gesture.
- Background/resume retained populated history. Cold process restart cleared
  all three in-memory histories as designed, without the linking advisory.
- All six Android playback-service checks passed. The lifecycle observer saw
  a currently started player owned by the Expo Go UID before sending HOME;
  playback was inactive 0.44 seconds later, with no new playback on resume.
  Enabling sound did not replay old events; muted completion stayed silent.
- The complete unfiltered native log contains 44,774,991 bytes, verified SHA-256
  `09a5e5142bc9c5ad89431d799e3f24396a6277f18bbbcd12dd6f677706f07c52`.
  The unchanged JS/linking/audio rejection gate passed. Development telemetry
  recorded eight finished cues and one native interruption aligned with HOME,
  with no delayed/deadline/native-error stop in this run.
- The actual emulator exited gracefully with code 0 and was reaped before the
  private Pulse/Xvfb servers, both exit 0. Font and temporary runner KVM access
  were restored. All 44 driver, collector and environment contracts passed.

[Exact application CI 37069954144](https://github.com/12-apps/future-gym/actions/runs/37069954144)
passed 256 actual Android/iOS renderer cases in 22 suites, zero skipped, plus
46 root contracts, lint, types and build. This section is a documentation-only
acceptance update; its final commit requires its own CI, while the audited app,
lockfile, root package and Turbo configuration remain byte-identical.

The private virtual output route stayed present throughout 3,944 host samples,
but the Android Ranchu HAL still logged 3,475 PCM write failures. Their cause is
not established. Expo Go and Android host warnings also remain in the retained
raw logs. Acceptance is specifically no rejected Future Gym JS/linking/audio
failure or app audio warning, not an assertion that every host log is clean.
Service events and a virtual sink do not prove audible output or successful
physical PCM delivery. Android/Expo Go execution and iOS renderer tests do not
establish iOS-device, standalone, production or audible-device acceptance.

## Historical verification record

The sections below preserve prior attempts and their then-current pending or
failed results. The complete exact-source Android audit above supersedes those
pending runtime statuses; it does not relabel any failed attempt as passing.

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


The independent native screenshot review found that the newly added single-line
set layout compressed its identity: normal-font labels overlapped the reps
label, and at1.3x all set numbers were ellipsized. Each row now places checkbox,
set identity and target in a clear header, with the same inline fields and step
controls below. This uses existing shared Stack/Box/Input/Button primitives and
tokens, without changing the accepted prototype theme. The visual readability
fix requires fresh source checks and native captures at both font settings.

The first header capture at 7187a32 restored series numbers but exposed another
native text-measurement boundary: normal-font target text painted only `meta`,
with `10` missing despite being present in the accessibility tree. The target
now has a non-shrinking shared Box with a token-based minimum width, and one
complete text value. No validation handler, theme or dependency changed. Fresh
normal/1.3x raster inspection remains required; renderer text alone cannot close
this finding. The owner's resumption instruction keeps the repair active while
retaining all required source, native, visual and CI gates.

This bounded correction passed all 232 Android/iOS renderer cases across 22
suites, with zero skipped cases, plus lint and type checks. Its actual native
raster verification is still pending; the prior screenshots remain preserved.

## Native audio cleanup correction — 2026-10-02

Consumer e0f903f passed exact-head CI37051105814: 232 Android/iOS renderer
cases across 22 suites, zero skipped, 46 root contracts, lint, types and build.
Independent native raster review closed the series/target readability finding
at normal and 1.3x font and accepted all 20 phone/wide reference counterparts.
The owner-approved prototype theme remains unchanged.

Audit37058465803 captured 53 states and passed all six playback probes,
including current UID-owned active playback before HOME, inactivity afterward,
and no new playback or automatic set completion on resume. Its late immediate
Execution assertion failed, although the final image shows Execution after the
same single Start input. The verification driver now awaits that exact phase
through its existing bounded observation loop, without retapping.

The complete native log exposed a separate audio integration defect: Expo's
foreground callback tried to play an already released player. Android's
expo-audio lifecycle registry retains a player until its public remove method
is called; releasing the shared object alone destroys its playback resources
without unregistering it. Cleanup now unregisters before releasing, while
still attempting every cleanup step if another fails. A native AudioTrack
timestamp warning also remains under investigation. The log rejection gate
is unchanged. Fresh exact-source CI, the full native audit and independent
final review are required before merge.

The old cleanup failed all six new lifecycle/error-path executions across
Android and iOS renderers. With unregistration, all 44 focused audio cases and
the complete 238-case mobile suite pass (22 suites, zero skipped); lint and
types also pass. These controlled native-registry mocks verify causality and
cleanup failures, not device behavior. The fresh native run must still prove
that the actual foreground warning is gone.

## Short-cue status delivery correction (2026-10-02)

Consumer `1522b78` passed exact CI37061921035 with 238 Android/iOS renderer
cases and 46 root contracts. Native audit37065484095 reached 24 captured
states, passed the initial active foreground/background/resume probe and
fresh-launch 1.3x font checks, then refused a visible sound-unavailable alert.
The first 100 ms countdown cue's native PLAYING observation arrived 763 ms
after player initialization, while the hook's bounded lifetime was 600 ms.
The failure image still showed an uncompleted series; it does not establish
that the completion action caused the alert. The previous released-player
foreground warning did not recur in the complete retained log.

The hook previously treated a missing JavaScript playing event as proof the
cue never started. Independent renderer reproduction verifies that a native
player can already be playing or finished while that event is delayed. At the
existing deadline, cleanup now checks the public native playing/currentTime
properties before reporting non-start. Fresh players never seek, so a finite
positive position proves progress. Zero/invalid progress, property-read
failures and explicit native playback errors still surface. The cue lifetime,
delayed-start cutoff, cancellation and unregistration remain unchanged.

The independent causal fixture failed six executions before the correction;
all 60 focused audio executions now pass. The complete local mobile suite
passes 254 cases in 22 suites with zero skips, with lint and types also green.
These tests model native progress independently from callback delivery; they
do not replace the pending full real-runtime proof.

The private virtual audio route was observed throughout that failed run, but
623 Ranchu PCM write failures remain in its guest log; a connected host stream
does not establish successful PCM delivery or audible output. Font, audio and
display servers and temporary KVM permissions were restored. Exact-source CI,
the complete fresh native run and independent final acceptance remain open.

## Current cancellation diagnostics (2026-10-02)

Consumer90dca82 passed exact CI37067891784: 254 actual platform cases, 22
suites, zero skips, 46 root contracts, lint, types and build. Native
audit37068097713 stopped at its initial live audio observation: 78 snapshots
in4.025 seconds did not capture an active app-owned player. Native events show
one64ms started-to-paused interval, already historical in the first snapshot
that contains it. The screen entered execution without a sound-unavailable
alert. Historical playback does not satisfy active-before-HOME acceptance.

Independent scratch diagnostics reproduce two possible early-stop paths:
screen-clock catch-up can cancel a recently created cue, and synchronous native
preparation can consume its request-relative lifetime. The retained native log
does not distinguish those paths. Development-only informational diagnostics
now record cue creation, status and stop reason/times without person, tenant or
session identifiers. Actual error code/cause is also logged while preserving
the user-facing error. Playback policy, lifetime and cancellation are unchanged;
this is instrumentation for the next exact-source run, not claimed closure.

The production-mode guard and error/cleanup preservation pass in 62 focused
audio executions. The complete local suite passes 256 cases in 22 suites,
zero skipped. Informational cue diagnostics are absent outside development;
real failures retain their warning, cause and visible error.

The corrected harness waited/reaped the actual emulator with exit0 before
stopping Pulse/Xvfb; no previous teardown XIO line recurred, and KVM restoration
passed. Device service diagnostics were captured; restricted ALSA/kernel reads
are honestly unavailable. Full native acceptance remains required.
