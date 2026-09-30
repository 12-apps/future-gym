# Appearance comes only from `@12-apps/ui`

**Status:** Accepted — 2026-09-30

**Lane:** UI of every future-gym app (the Expo mobile app first; any web app later).

**Summary:** future-gym code imports nothing that renders or styles directly. Every visual element comes from `@12-apps/ui`: components, layout, typography, icons, colours, theme and style types. Only `@12-apps/ui` imports `react-native` (or MUI). A visual gap is fixed in `12-apps/shared-packages` and consumed through a version bump, never worked around locally. Expo modules are allowed for device capabilities that draw nothing.

## Context

- **The lib already covers both renderers behind one import path.** `@12-apps/ui` serves the same subpath to web and React Native. Every ported subpath carries a `react-native` export condition that points at its native build (`12-apps/shared-packages@6b42866:packages/ui/NATIVE.md:10`). Component files never mix renderers (`NATIVE.md:24`, `NATIVE.md:32`). The lib is consumed per component, never through a barrel (`packages/ui/src/index.ts:4`).
- **The native build is still partial.** It covers 27 subpaths (`packages/ui/entries.native.json`), and several things a workout app needs are missing:
  - page scrolling;
  - safe-area insets;
  - following the system light/dark mode;
  - a pressable list row;
  - style types;
  - native builds of `ToggleGroup`, `NumberField`, `Toast` and `Autocomplete`.
- **The sibling courier app shows where that leads.** `12-apps/future-pay@7ccf1e1:apps/motoboy` fills those gaps by reaching past the lib:
  - `ScrollView` and `StyleSheet` in `App.tsx:12`;
  - `react-native-safe-area-context` in `App.tsx:17`;
  - `Pressable` in `src/courier/run-card.tsx:6`;
  - `StyleSheet` in seven more files (for example `src/shift/shift-card.tsx:8`);
  - `TextInputProps` in `src/contact/contact-panel.tsx:10`.

  Each of those lines is a piece of appearance the lib does not own. The app has to maintain it itself, and the next app will copy it.
- **This repository has no app code yet.** The only UI built so far is a throwaway HTML prototype, kept outside `main` (12-apps/future-gym#1 history). So the rule costs nothing to adopt now and a migration later.

## Decision

We build every future-gym screen out of `@12-apps/ui` only.

**Forbidden:** app code (everything outside `node_modules`) must not import any of the following.

| Source | Examples |
| --- | --- |
| `react-native` | components (`View`, `Text`, `ScrollView`, `Pressable`, `Modal`…), `StyleSheet`, `useColorScheme`, `useWindowDimensions`, `Animated` and style types (`ViewStyle`, `TextStyle`, `StyleProp`). `import type` is forbidden too. |
| React Native view or styling libraries | `react-native-safe-area-context`, `react-native-svg`, `react-native-reanimated`, NativeWind or Tailwind, `styled-components`, `@emotion/*` |
| Visual Expo modules | `expo-image`, `expo-linear-gradient`, `expo-blur`, `@expo/vector-icons`, `expo-symbols` |
| MUI | `@mui/*`, and the raw MUI passthroughs `@12-apps/ui/mui/*` |

**Allowed:**
- **`@12-apps/ui`:** deep subpath imports only, for example `@12-apps/ui/layout/Stack`, `@12-apps/ui/icons` and `@12-apps/ui/tokens`.
- **Expo modules that draw nothing:**
  - `expo-audio`, `expo-haptics`, `expo-notifications`, `expo-keep-awake`, `expo-linking`, `expo-file-system`, `expo-constants`.
  - `expo-router`, for navigation structure. Any colours or sizes its options take are read from `useUiTheme()`, never written as literals.
  - `expo-status-bar`. Its `style` follows the theme's `mode`.

**Values:**
- No raw colour literals (`'#fff'`, `'rgba(…)'`). A colour is a palette role from `useUiTheme()`, or a component's `color` prop.
- Spacing and radius come from component props (`p`, `gap`, `radius`) or from `theme.spacing()` and `theme.radius`.

**Gaps:**
- If the lib lacks a visual piece, the feature waits for it. It is added in `12-apps/shared-packages`, following `packages/ui/NATIVE.md` "How a component is ported", and arrives through a version bump.
- Composing existing `@12-apps/ui` components inside the app is fine. Re-implementing one on raw primitives is not.

## Consequences

**What this buys:**
- The app has no styling code of its own to keep in sync: a theme or component fix in the lib reaches it with a version bump.
- Light/dark mode, density and brand stay in one place.
- Anything built for this app lands in the lib, where future-pay and the next app can use it.

**What it costs:**
- The mobile app cannot start until the lib ships the pieces a first screen needs:
  - page scroll (`layout/ScrollView` or `layout/Screen`, with the top safe area and keyboard lift);
  - `mode: 'system'` in `UiProvider`;
  - style types re-exported from `@12-apps/ui/tokens`;
  - a pressable `ListItem`.
- Later screens then need:
  - a centre slot on circular `Progress`, for the timer;
  - a range and markers on linear `Progress`, for weekly volume;
  - `Input type="decimal"`;
  - grouped `Select` options;
  - tabular numbers on `Text`;
  - new icons (`PlayArrow`, `Pause`, `SkipNext`, `Timer`, `FitnessCenter`, `EmojiEvents`, `History`, `Home`, `VolumeUp`, `VolumeOff`);
  - native builds of `ToggleGroup`, `NumberField`, `Toast` and `Autocomplete`.
- Each of these is a pull request in another repository and a release. That is slower than a local `StyleSheet`, on purpose.

**Enforcement:** when the app is scaffolded, its ESLint config adds a `no-restricted-imports` rule. It lists the forbidden sources above in `paths` and `patterns` (`react-native`, `react-native-*`, `@mui/*`, `@emotion/*`, `@12-apps/ui/mui/*`, `expo-image`, `expo-linear-gradient`, `expo-blur`, `@expo/vector-icons`, `expo-symbols`). The message on each entry points to this record, `docs/adr/appearance-comes-only-from-12-apps-ui.md`. Tests may import `@testing-library/react-native`, because it renders nothing into the app.

**Out of scope:**
- The HTML prototype is a reference artefact outside `main` (12-apps/future-gym#1 history). It is never merged, gets no new features, and is not app code.
- This record does not decide the navigation library beyond allowing `expo-router`.
