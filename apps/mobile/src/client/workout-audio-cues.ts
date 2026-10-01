import { remainingMilliseconds, type WorkoutSession } from "./model";

export type WorkoutAudioCue = "restEnd" | "setEnd" | "exDone" | "tick";
export const MAX_AUDIO_UPDATE_GAP_MS = 1000;

export interface WorkoutAudioObservation {
  session: WorkoutSession | null | undefined;
  now: number;
  enabled: boolean;
}

export interface WorkoutAudioCursor {
  observation: WorkoutAudioObservation;
  executionEndObserved: boolean;
}

export function workoutAudioIdentity(session: WorkoutSession | null | undefined): string | null {
  return session ? JSON.stringify([session.userId, session.tenantId, session.id, session.exerciseIndex]) : null;
}

/** Observe immutable session transitions only. Audio never sends a workout command. */
export function observeWorkoutAudio(previous: WorkoutAudioCursor | null, observation: WorkoutAudioObservation): {
  cursor: WorkoutAudioCursor;
  cue: WorkoutAudioCue | null;
} {
  const { session, now, enabled } = observation;
  const before = previous?.observation;
  const oldSession = before?.session;
  const sameExercise = !!session && !!oldSession && workoutAudioIdentity(session) === workoutAudioIdentity(oldSession);
  const newExecution = sameExercise && session.phase === "execution" && oldSession.phase !== "execution";
  const expired = !!session && session.phase === "execution" && remainingMilliseconds(session, now) === 0;
  const endObserved = sameExercise && !newExecution ? previous!.executionEndObserved : false;
  const cursor = { observation, executionEndObserved: endObserved || expired };
  const silent = { cursor, cue: null };

  // Mounts, tenant/exercise changes, mute/resume and delayed JS delivery never replay history.
  if (!sameExercise || !before || !session || !oldSession || !enabled || !before.enabled || session.paused || oldSession.paused ||
      !Number.isFinite(now) || now < before.now || now - before.now > MAX_AUDIO_UPDATE_GAP_MS) return silent;

  if (newExecution && oldSession.phase === "ready") return { cursor, cue: "restEnd" };

  const exerciseId = oldSession.workout.exercises[oldSession.exerciseIndex]?.id;
  const completed = !!exerciseId && !oldSession.logs[exerciseId]?.[oldSession.setIndex]?.completed &&
    !!session.logs[exerciseId]?.[oldSession.setIndex]?.completed;
  if (oldSession.phase === "execution" && completed) {
    if (session.phase === "exercise-complete") return { cursor, cue: "exDone" };
    if (!endObserved && (session.phase === "rest" || session.phase === "ready")) return { cursor, cue: "setEnd" };
  }

  if (oldSession.phase === "rest" && session.phase === "ready" && session.logs === oldSession.logs) return { cursor, cue: "restEnd" };

  if (session.phase !== oldSession.phase || session.setIndex !== oldSession.setIndex || session.deadline !== oldSession.deadline) return silent;
  const oldRemaining = remainingMilliseconds(oldSession, before.now);
  const remaining = remainingMilliseconds(session, now);
  if (session.phase === "execution" && !endObserved && oldRemaining > 0 && remaining === 0) return { cursor, cue: "setEnd" };
  const seconds = Math.ceil(remaining / 1000);
  if ((session.phase === "execution" || session.phase === "rest") && seconds >= 1 && seconds <= 3 && seconds < Math.ceil(oldRemaining / 1000)) {
    return { cursor, cue: "tick" };
  }
  return silent;
}
