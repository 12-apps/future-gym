import { createSession, updateSession, type WorkoutSession } from "../src/client/model";
import { SAMPLE_WORKOUTS } from "../src/client/sample-data";
import { observeWorkoutAudio, type WorkoutAudioCursor } from "../src/client/workout-audio-cues";

const readySession = () => createSession(SAMPLE_WORKOUTS[0]!, "member", "session", 0);
function observer() {
  let cursor: WorkoutAudioCursor | null = null;
  return (session: WorkoutSession | null, now: number, enabled = true) => {
    const result = observeWorkoutAudio(cursor, { session, now, enabled });
    cursor = result.cursor;
    return result.cue;
  };
}
const execution = () => updateSession(readySession(), { type: "start-set", now: 0 });

describe("workout cue selection without native playback", () => {
  it("plays the reference arpeggio once on an observed set start", () => {
    const observe = observer(); const ready = readySession();
    expect(observe(ready, 0)).toBeNull();
    const active = updateSession(ready, { type: "start-set", now: 0 });
    expect(observe(active, 0)).toBe("restEnd");
    expect(observe({ ...active }, 250)).toBeNull();
  });
  it("does not replay a start on mount or a new user, tenant, session or exercise", () => {
    const observe = observer(); const active = execution();
    expect(observe(active, 0)).toBeNull();
    for (const replacement of [{ ...active, id: "other" }, { ...active, userId: "other" },
      { ...active, tenantId: "other" }, { ...active, exerciseIndex: 1 }]) expect(observe(replacement, 250)).toBeNull();
  });
  it("ticks once per final second and signals expiration without completing a set", () => {
    const observe = observer(); const active = execution(); const end = active.deadline!;
    const initial = JSON.stringify(active);
    expect(observe(active, end - 3250)).toBeNull();
    for (const seconds of [3, 2, 1]) {
      expect(observe(active, end - seconds * 1000)).toBe("tick");
      expect(observe({ ...active }, end - seconds * 1000 + 250)).toBeNull();
    }
    expect(observe(active, end)).toBe("setEnd");
    expect(observe(active, end + 250)).toBeNull();
    expect(JSON.stringify(active)).toBe(initial);
    expect(Object.values(active.logs).flat().every(set => !set.completed)).toBe(true);
    expect(observe(updateSession(active, { type: "complete-set", now: end + 250 }), end + 250)).toBeNull();
  });
  it("plays set-end for explicit early completion and rest-end for skip", () => {
    const observe = observer(); const active = execution(); observe(active, 0);
    const rest = updateSession(active, { type: "complete-set", now: 250 });
    expect(observe(rest, 250)).toBe("setEnd");
    expect(observe(rest, 500)).toBeNull();
    expect(observe(updateSession(rest, { type: "skip-rest" }), 500)).toBe("restEnd");
  });
  it("ticks during rest and plays rest-end when the model returns to ready", () => {
    const observe = observer(); const rest = updateSession(execution(), { type: "complete-set", now: 250 });
    observe(rest, rest.deadline! - 3250);
    expect(observe(rest, rest.deadline! - 3000)).toBe("tick");
    observe(rest, rest.deadline! - 2000); observe(rest, rest.deadline! - 1000);
    expect(observe(updateSession(rest, { type: "tick", now: rest.deadline! }), rest.deadline!)).toBe("restEnd");
  });
  it("plays the final chord only when the last performed set is recorded", () => {
    const workout = { ...SAMPLE_WORKOUTS[0]!, exercises: [{ ...SAMPLE_WORKOUTS[0]!.exercises[0]!, sets: 1 }] };
    const active = updateSession(createSession(workout, "member", "session", 0), { type: "start-set", now: 0 });
    const observe = observer(); observe(active, 0);
    const finished = updateSession(active, { type: "complete-set", now: 250 });
    expect(observe(finished, 250)).toBe("exDone");
    expect(observe(finished, 500)).toBeNull();
  });
  it("handles zero-rest completion without requiring an automatic next set", () => {
    const active = execution(); active.workout.exercises[0]!.restSeconds = 0;
    const observe = observer(); observe(active, 0);
    const next = updateSession(active, { type: "complete-set", now: 250 });
    expect(next.phase).toBe("ready"); expect(observe(next, 250)).toBe("setEnd");
  });
  it("does not turn manual rest log edits into a start cue", () => {
    const rest = updateSession(execution(), { type: "complete-set", now: 0 });
    const observe = observer(); observe(rest, 0);
    expect(observe(updateSession(rest, { type: "toggle-set", exerciseId: rest.workout.exercises[0]!.id, setIndex: 1 }), 250)).toBeNull();
  });
  it("suppresses late and backward-clock transitions rather than catching up", () => {
    const active = execution(); const observe = observer(); observe(active, 0);
    expect(observe(active, active.deadline! + 10000)).toBeNull();
    expect(observe(active, active.deadline! + 10250)).toBeNull();
    expect(observe(updateSession(active, { type: "complete-set", now: active.deadline! + 10250 }), active.deadline! + 10250)).toBeNull();
    expect(observe(readySession(), -1)).toBeNull();
  });
  it("suppresses a rest-end transition delivered after background suspension", () => {
    const rest = updateSession(execution(), { type: "complete-set", now: 0 });
    const observe = observer(); observe(rest, 250);
    expect(observe(updateSession(rest, { type: "tick", now: 1000000 }), 1000000)).toBeNull();
  });
  it("does not replay muted ticks or a muted deadline on unmute", () => {
    const active = execution(); const observe = observer(); const end = active.deadline!;
    observe(active, end - 3250);
    expect(observe(active, end - 3000, false)).toBeNull();
    expect(observe(active, end - 2750)).toBeNull();
    expect(observe(active, end - 2000)).toBe("tick");
    observe(active, end - 1000, false);
    expect(observe(active, end, false)).toBeNull();
    expect(observe(active, end + 250)).toBeNull();
  });
  it("does not replay the paused second on resume", () => {
    const active = execution(); const end = active.deadline!; const observe = observer();
    observe(active, end - 3250); expect(observe(active, end - 3000)).toBe("tick");
    const paused = updateSession(active, { type: "toggle-pause", now: end - 2750 });
    expect(observe(paused, end - 2750)).toBeNull();
    const resumed = updateSession(paused, { type: "toggle-pause", now: end - 2500 });
    expect(observe(resumed, end - 2500)).toBeNull();
    expect(observe(resumed, end - 2250)).toBeNull();
    expect(observe(resumed, end - 1750)).toBe("tick");
  });
  it("resets the deadline signal for a newly started set", () => {
    const observe = observer(); const first = execution(); const end = first.deadline!;
    observe(first, end - 250); expect(observe(first, end)).toBe("setEnd");
    const rest = updateSession(first, { type: "complete-set", now: end }); observe(rest, end);
    const ready = updateSession(rest, { type: "skip-rest" }); observe(ready, end);
    const next = updateSession(ready, { type: "start-set", now: end }); expect(observe(next, end)).toBe("restEnd");
    observe(next, next.deadline! - 250); expect(observe(next, next.deadline!)).toBe("setEnd");
  });
});
