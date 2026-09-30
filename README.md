# Future Gym

A single-file gym app prototype (`index.html`), with no build step. Open it in a phone or desktop browser. The user-facing copy is pt-BR.

> The prototype is a reference artefact. New app code follows
> `docs/adr/appearance-comes-only-from-12-apps-ui.md`: every visual element
> comes from `@12-apps/ui`.

## What it does

- **Home**: this week's plan, today's workout and weekly progress.
- **Workout**: exercises with sets, reps, set duration, rest interval and the last load used.
- **Session**:
  - Starting an exercise starts the set timer.
  - When the set ends, an alarm plays and the rest interval starts.
  - When the rest ends, a different sound plays and the next set starts on its own.
  - You can pause and resume, finish a set early, skip the rest or add 15 s.
  - You move to the next exercise until **Concluir treino** (finish workout).
- **Loads**: kg and reps per set, stored on the device and suggested next time.
- **Plan editor**:
  - Pick a split (Full body, AB, ABC, ABCD, ABCDE) or assign each weekday by hand.
  - Create up to 6 workouts (A to F) and register their exercises.
  - Each exercise has sets, reps, set duration, rest interval and a starting load.
  - Exercises can be reordered, edited and removed.
- **Muscle subgroups**:
  - Each workout shows the muscle groups it trains, suggested from its name.
  - Each group is split into subgroups: upper/middle/lower chest, anterior/lateral/posterior deltoid, biceps and triceps heads, vasti vs rectus femoris, and so on.
  - A subgroup with no exercise gets one-tap suggestions.
- **Weekly volume (under/overtraining)**:
  - Counts weekly sets per muscle group across the whole plan. Compound lifts count half a set for their secondary muscles.
  - The goal (Cutting, Maintenance or Bulking) moves the ideal band and the ceiling.
  - The bands come from per-group MEV/MRV volume landmarks, defined in `GROUPS`.
- **Duel**:
  - Add training partners and compete on weekly tonnage divided by body weight.
  - When you train together, you log the partner's loads on the same screen.
- **History**: finished workouts with duration, sets and tonnage.

Data lives in the browser's `localStorage`. The sample plan, used until you edit it, is `DEFAULT_WORKOUTS` and `DEFAULT_WEEK` at the top of the script.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Decisions

Architecture decisions live in `docs/adr/`. Its index is generated after each merge by `scripts/post-merge-regen.mjs`, so do not edit it by hand.
