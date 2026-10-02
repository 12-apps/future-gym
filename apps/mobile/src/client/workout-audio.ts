import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkoutSession } from "./model";
import { MAX_AUDIO_UPDATE_GAP_MS, observeWorkoutAudio, workoutAudioIdentity, type WorkoutAudioCue, type WorkoutAudioCursor } from "./workout-audio-cues";

// Metro requires literal asset paths. These are generated from the reference, never fetched remotely.
/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES: Record<WorkoutAudioCue, AudioSource> = {
  restEnd: require("../../assets/audio/rest-end.wav"),
  setEnd: require("../../assets/audio/set-end.wav"),
  exDone: require("../../assets/audio/exercise-done.wav"),
  tick: require("../../assets/audio/tick.wav"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const MAX_CUE_START_DELAY_MS = 500;
const CUE_DURATION_MS: Record<WorkoutAudioCue, number> = { restEnd: 890, setEnd: 570, exDone: 930, tick: 100 };

export interface WorkoutAudioError {
  code: "configuration" | "playback" | "cleanup";
  cause: unknown;
}

interface ActiveCue {
  player: AudioPlayer;
  subscription?: { remove(): void };
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Foreground-only, best-effort cues. No permissions, recording, lock-screen controls
 * or workout mutations. Mounts and delayed updates do not replay missed sounds.
 * Native background behavior still needs a device audit; renderer mocks prove only
 * our calls, cancellation, asset selection and error handling.
 */
export function useWorkoutAudio(session: WorkoutSession | null | undefined, now: number, enabled: boolean) {
  const [error, setError] = useState<WorkoutAudioError | null>(null);
  const cursor = useRef<WorkoutAudioCursor | null>(null);
  const active = useRef<ActiveCue | null>(null);
  const generation = useRef(0);
  const request = useRef(0);
  const mounted = useRef(false);
  const ready = useRef<Promise<boolean>>(Promise.resolve(false));
  const identity = workoutAudioIdentity(session);

  const report = useCallback((code: WorkoutAudioError["code"], cause: unknown) => {
    if (mounted.current) setError({ code, cause });
    else console.warn(`Workout audio ${code} failed during cleanup`, cause);
  }, []);

  const stop = useCallback(() => {
    const playing = active.current;
    active.current = null;
    if (!playing) return;
    clearTimeout(playing.timer);
    // Unregister before releasing: Expo's native foreground callback otherwise
    // retains the disposed player and may try to resume its released resources.
    // Attempt every cleanup step even if a native method fails.
    for (const clean of [() => playing.subscription?.remove(), () => playing.player.pause(), () => playing.player.remove(), () => playing.player.release()]) {
      try { clean(); } catch (cause) { report("cleanup", cause); }
    }
  }, [report]);

  const cancelPending = useCallback(() => { request.current++; stop(); }, [stop]);
  const invalidatePlayback = useCallback(() => { generation.current++; cancelPending(); }, [cancelPending]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelPending(); };
  }, [cancelPending]);

  useEffect(() => {
    const version = ++generation.current;
    request.current++;
    stop();
    if (!enabled || !identity) {
      ready.current = Promise.resolve(false);
      return;
    }
    setError(null);
    ready.current = (async () => {
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          allowsBackgroundRecording: false,
          shouldPlayInBackground: false,
          playsInSilentMode: false,
          interruptionMode: "mixWithOthers",
          shouldRouteThroughEarpiece: false,
        });
        return mounted.current && generation.current === version;
      } catch (cause) {
        if (mounted.current && generation.current === version) report("configuration", cause);
        return false;
      }
    })();
    return invalidatePlayback;
  }, [enabled, identity, report, stop, invalidatePlayback]);

  useEffect(() => {
    const previous = cursor.current;
    const observation = observeWorkoutAudio(previous, { session, now, enabled });
    cursor.current = observation.cursor;
    const delayed = !!previous && (now < previous.observation.now || now - previous.observation.now > MAX_AUDIO_UPDATE_GAP_MS);
    if (!session || !enabled || session.paused || delayed || workoutAudioIdentity(previous?.observation.session) !== identity) {
      request.current++;
      stop();
    }
    const cue = observation.cue;
    if (!cue) return;
    const token = ++request.current;
    const requestedAt = Date.now();
    void ready.current.then((configured) => {
      const age = Date.now() - requestedAt;
      if (!configured || !mounted.current || request.current !== token || age < 0 || age > MAX_CUE_START_DELAY_MS) return;
      stop();
      try {
        // A fresh, short-lived player avoids seek races and replaying a finished source.
        const player = createAudioPlayer(SOURCES[cue], { updateInterval: 100, keepAudioSessionActive: false });
        const playing: ActiveCue = { player };
        active.current = playing;
        let started = false;
        const expiresAt = requestedAt + MAX_CUE_START_DELAY_MS + CUE_DURATION_MS[cue];
        playing.subscription = player.addListener("playbackStatusUpdate", (status) => {
          if (active.current !== playing) return;
          if (status.error || status.mediaServicesDidReset) {
            report("playback", status.error ?? new Error("Audio media services were reset"));
            stop();
          } else if (status.didJustFinish || Date.now() > expiresAt || (started && !status.playing && !status.isBuffering)) {
            // An interrupted chime is disposable; it must not be resumed intentionally.
            stop();
          } else if (status.playing) {
            started = true;
          }
        });
        playing.timer = setTimeout(() => {
          if (active.current !== playing) return;
          if (!started) report("playback", new Error("The workout cue did not start before its deadline"));
          stop();
        }, Math.max(0, expiresAt - Date.now()));
        player.play();
      } catch (cause) {
        report("playback", cause);
        stop();
      }
    });
  }, [session, now, enabled, identity, report, stop]);

  return { error };
}
