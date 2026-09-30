import { beginWorkout, commandForTenant, createSession, finishSession, parseSetInput, remainingMilliseconds, selectTenant, summarizeSession, updateSession } from "../src/client/model";
import { createDemoState, SAMPLE_WORKOUTS, sampleRolesForTenant } from "../src/client/sample-data";
import { formatInputNumber } from "../src/client/copy";
const workout = SAMPLE_WORKOUTS[0]!;
const session = () => createSession(workout, "sample-member", "session-1", 1000);

describe("native workout state", () => {
  it("records execution without changing the provider prescription", () => {
    const before = JSON.stringify(workout);
    const next = updateSession(session(), { type: "set-log", exerciseId: "supino-reto", setIndex: 0, kg: 42.5, repetitions: 9 });
    expect(next.logs["supino-reto"]![0]!.kg).toBe(42.5);
    expect(JSON.stringify(workout)).toBe(before);
  });
  it("keeps an accurate deadline after backgrounding without inventing completed sets", () => {
    const active = updateSession(session(), { type: "start-set", now: 2000 });
    expect(remainingMilliseconds(active, 12000)).toBe(30000);
    const later = updateSession(active, { type: "tick", now: 302000 });
    expect(remainingMilliseconds(later, 302000)).toBe(0);
    expect(summarizeSession(later, 302000).completedSets).toBe(0);
  });
  it("pauses and resumes with the exact remaining duration", () => {
    let active = updateSession(session(), { type: "start-set", now: 2000 });
    active = updateSession(active, { type: "toggle-pause", now: 12000 });
    expect(remainingMilliseconds(active, 900000)).toBe(30000);
    active = updateSession(active, { type: "toggle-pause", now: 900000 });
    expect(remainingMilliseconds(active, 910000)).toBe(20000);
  });
  it("completes one set once, extends rest, and returns ready after an interruption", () => {
    let active = updateSession(session(), { type: "start-set", now: 2000 });
    active = updateSession(active, { type: "complete-set", now: 12000 });
    expect(active.phase).toBe("rest");
    expect(updateSession(active, { type: "complete-set", now: 12001 })).toBe(active);
    active = updateSession(active, { type: "extend-rest", milliseconds: 15000 });
    expect(remainingMilliseconds(active, 12000)).toBe(105000);
    active = updateSession(active, { type: "tick", now: 1000000 });
    expect(active.phase).toBe("ready");
    expect(summarizeSession(active, 1000000).completedSets).toBe(1);
  });
  it("handles the last set and invalid navigation without invalid indices", () => {
    const single = { ...workout, exercises: [{ ...workout.exercises[0]!, sets: 1, restSeconds: 0 }] };
    let active = createSession(single, "sample-member", "single", 0);
    active = updateSession(active, { type: "start-set", now: 0 });
    active = updateSession(active, { type: "complete-set", now: 1 });
    expect(active.phase).toBe("exercise-complete");
    expect(updateSession(active, { type: "exercise", index: 42 })).toBe(active);
  });
  it("manual unchecking reopens an exercise and cancels its timer", () => {
    let active = updateSession(session(), { type: "start-set", now: 2000 });
    active = updateSession(active, { type: "toggle-set", exerciseId: "supino-reto", setIndex: 0 });
    expect(active.deadline).toBeNull();
    expect(active.setIndex).toBe(1);
    active = updateSession(active, { type: "toggle-set", exerciseId: "supino-reto", setIndex: 0 });
    expect(active.setIndex).toBe(0);
  });
  it.each(["", "1e2", "40kg", "1,2,3", "-2", "NaN", "Infinity", "1001", "1.234"])("rejects invalid load %s", (value) => {
    expect(parseSetInput(value, "10")).toBeNull();
  });
  it.each(["", "0", "101", "1.5", "10reps"])("rejects invalid repetitions %s", (value) => {
    expect(parseSetInput("40", value)).toBeNull();
  });
  it("accepts pt-BR decimal and bodyweight zero", () => {
    expect(parseSetInput("42,5", "10")).toEqual({ kg: 42.5, repetitions: 10 });
    expect(parseSetInput("0", "1")).toEqual({ kg: 0, repetitions: 1 });
    expect(parseSetInput(formatInputNumber(1000), "10")).toEqual({ kg: 1000, repetitions: 10 });
  });
  it("rejects invalid commands even outside the form", () => {
    const initial = session();
    expect(updateSession(initial, { type: "set-log", exerciseId: "supino-reto", setIndex: 0, kg: NaN, repetitions: 10 })).toBe(initial);
    expect(updateSession(initial, { type: "set-log", exerciseId: "supino-reto", setIndex: 0, kg: 40, repetitions: 0 })).toBe(initial);
  });
  it("detaches the active prescription from later provider changes", () => {
    const input = { ...workout, exercises: workout.exercises.map((item) => ({ ...item })) };
    const active = createSession(input, "sample-member", "snapshot", 0);
    input.exercises[0]!.name = "Updated provider exercise";
    expect(active.workout.exercises[0]!.name).toBe("Supino reto com barra");
  });
  it("reuses only completed loads from the same user and tenant", () => {
    let previous = updateSession(session(), { type: "set-log", exerciseId: "supino-reto", setIndex: 0, kg: 55, repetitions: 8 });
    previous = updateSession(previous, { type: "toggle-set", exerciseId: "supino-reto", setIndex: 0 });
    const summary = summarizeSession(previous, 10000);
    expect(createSession(workout, "sample-member", "same", 20000, [summary]).logs["supino-reto"]![0]!.kg).toBe(55);
    expect(createSession(workout, "another-member", "other-user", 20000, [summary]).logs["supino-reto"]![0]!.kg).toBe(40);
    expect(createSession({ ...workout, tenantId: "another-tenant" }, "sample-member", "other-tenant", 20000, [summary]).logs["supino-reto"]![0]!.kg).toBe(40);
    expect(createSession(workout, "sample-member", "same", 20000, [summary]).logs["supino-reto"]![1]!.kg).toBe(40);
  });
  it("counts only performed sets and saves a detached snapshot", () => {
    let active = updateSession(session(), { type: "set-log", exerciseId: "supino-reto", setIndex: 0, kg: 42.5, repetitions: 9 });
    active = updateSession(active, { type: "toggle-set", exerciseId: "supino-reto", setIndex: 0 });
    const summary = summarizeSession(active, 61000);
    expect(summary).toMatchObject({ completedSets: 1, plannedSets: 16, volumeKg: 382.5, durationSeconds: 60 });
    active.logs["supino-reto"]![0]!.kg = 999;
    expect(summary.exercises[0]!.sets[0]!.kg).toBe(42.5);
  });
});

describe("tenant boundaries", () => {
  it("keeps a gym owner's role local while the same global person is a physiotherapy client", () => {
    const state = createDemoState();
    expect(sampleRolesForTenant(state.userId, "sample-gym")).toContain("owner");
    expect(sampleRolesForTenant(state.userId, "sample-physio")).toEqual(["client"]);
    expect(sampleRolesForTenant("unknown-user", "sample-gym")).toEqual([]);
    const physio = selectTenant(state, "sample-physio");
    expect(physio.userId).toBe(state.userId);
    expect(beginWorkout(physio, workout, "wrong-owner-scope", 0)).toBe(physio);
    const active = beginWorkout(physio, SAMPLE_WORKOUTS[4]!, "physio-session", 0);
    expect(active.tenants["sample-physio"]!.activeSession!.userId).toBe(state.userId);
    expect(active.tenants["sample-gym"]!.activeSession).toBeNull();
  });
  it("cannot start another tenant's plan or replace an active session", () => {
    const state = createDemoState();
    expect(beginWorkout(state, SAMPLE_WORKOUTS[3]!, "wrong", 0)).toBe(state);
    const active = beginWorkout(state, workout, "gym-session", 1000);
    expect(beginWorkout(active, workout, "duplicate", 2000)).toBe(active);
  });
  it("retains separate active sessions and rejects stale cross-tenant actions", () => {
    let state = beginWorkout(createDemoState(), workout, "gym-session", 1000);
    state = selectTenant(state, "sample-personal");
    expect(commandForTenant(state, "sample-gym", "gym-session", { type: "start-set", now: 2000 })).toBe(state);
    expect(finishSession(state, "sample-gym", "gym-session", 2000)).toBe(state);
    state = beginWorkout(state, SAMPLE_WORKOUTS[3]!, "personal-session", 3000);
    state = selectTenant(state, "sample-gym");
    expect(state.tenants["sample-gym"]!.activeSession!.id).toBe("gym-session");
    expect(state.tenants["sample-personal"]!.activeSession!.id).toBe("personal-session");
    expect(selectTenant(state, "unknown")).toBe(state);
  });
  it("refuses an empty saved workout but allows explicit discard", () => {
    const state = beginWorkout(createDemoState(), workout, "empty", 0);
    expect(finishSession(state, "sample-gym", "empty", 1000)).toBe(state);
    expect(finishSession(state, "sample-gym", "empty", 1000, true).tenants["sample-gym"]!.activeSession).toBeNull();
  });
  it("rejects another user's active session", () => {
    const state = { ...beginWorkout(createDemoState(), workout, "gym-session", 0), userId: "another-member" };
    expect(finishSession(state, "sample-gym", "gym-session", 1000)).toBe(state);
  });
  it("saves once, discards without history, and keeps history scoped", () => {
    let state = beginWorkout(createDemoState(), workout, "gym-session", 1000);
    state = commandForTenant(state, "sample-gym", "gym-session", { type: "toggle-set", exerciseId: "supino-reto", setIndex: 0 });
    state = finishSession(state, "sample-gym", "gym-session", 61000);
    expect(finishSession(state, "sample-gym", "gym-session", 61001)).toBe(state);
    expect(state.tenants["sample-gym"]!.history).toHaveLength(1);
    state = selectTenant(state, "sample-personal");
    state = beginWorkout(state, SAMPLE_WORKOUTS[3]!, "personal-session", 62000);
    expect(state.tenants["sample-personal"]!.history).toHaveLength(0);
    state = finishSession(state, "sample-personal", "personal-session", 63000, true);
    expect(state.tenants["sample-personal"]!.activeSession).toBeNull();
    expect(state.tenants["sample-personal"]!.history).toHaveLength(0);
  });
});
