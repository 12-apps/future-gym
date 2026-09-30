/** Workout data remains tenant-scoped at every boundary, including demo mode. */
export interface Exercise {
  id: string;
  name: string;
  muscle: string;
  sets: number;
  repetitions: number;
  executionSeconds: number;
  restSeconds: number;
  suggestedKg: number;
}

export interface Workout {
  id: string;
  tenantId: string;
  letter: string;
  name: string;
  prescribedBy: string;
  exercises: readonly Exercise[];
}

export interface SetLog {
  kg: number;
  repetitions: number;
  completed: boolean;
}

export type SessionPhase = "ready" | "execution" | "rest" | "exercise-complete";
export interface WorkoutSession {
  userId: string;
  id: string;
  tenantId: string;
  workout: Workout;
  startedAt: number;
  exerciseIndex: number;
  setIndex: number;
  phase: SessionPhase;
  deadline: number | null;
  remainingMs: number;
  durationMs: number;
  paused: boolean;
  logs: Record<string, SetLog[]>;
}

export interface SessionSummary {
  userId: string;
  id: string;
  tenantId: string;
  workoutId: string;
  name: string;
  letter: string;
  startedAt: number;
  finishedAt: number;
  durationSeconds: number;
  completedSets: number;
  plannedSets: number;
  volumeKg: number;
  exercises: readonly { id: string; name: string; sets: readonly SetLog[] }[];
}

export interface TenantTrainingState {
  activeSession: WorkoutSession | null;
  history: readonly SessionSummary[];
}

export interface DemoClientState {
  userId: string;
  selectedTenantId: string;
  tenants: Record<string, TenantTrainingState>;
}

export type SessionCommand =
  | { type: "start-set"; now: number }
  | { type: "complete-set"; now: number }
  | { type: "toggle-pause"; now: number }
  | { type: "extend-rest"; milliseconds: number }
  | { type: "skip-rest" }
  | { type: "tick"; now: number }
  | { type: "exercise"; index: number }
  | { type: "set-log"; exerciseId: string; setIndex: number; kg: number; repetitions: number }
  | { type: "toggle-set"; exerciseId: string; setIndex: number };

const cloneLogs = (logs: WorkoutSession["logs"]) => Object.fromEntries(
  Object.entries(logs).map(([id, sets]) => [id, sets.map((set) => ({ ...set }))]),
);

export function createSession(workout: Workout, userId: string, id: string, now: number, history: readonly SessionSummary[] = []): WorkoutSession {
  if (workout.exercises.length === 0) throw new Error("Cannot start an empty workout");
  const previous = history.find((entry) => entry.userId === userId && entry.tenantId === workout.tenantId && entry.workoutId === workout.id);
  const logs = Object.fromEntries(workout.exercises.map((exercise) => {
    const last = previous?.exercises.find((item) => item.id === exercise.id)?.sets;
    return [exercise.id, Array.from({ length: exercise.sets }, (_, index) => ({
      kg: last?.[index]?.completed ? last[index].kg : exercise.suggestedKg,
      repetitions: exercise.repetitions,
      completed: false,
    }))];
  }));
  return { id, userId, tenantId: workout.tenantId, workout: { ...workout, exercises: workout.exercises.map((item) => ({ ...item })) }, startedAt: now, exerciseIndex: 0, setIndex: 0,
    phase: "ready", deadline: null, remainingMs: 0, durationMs: 0, paused: false, logs };
}

export function remainingMilliseconds(session: WorkoutSession, now: number): number {
  if (session.paused) return Math.max(0, session.remainingMs);
  return session.deadline === null ? 0 : Math.max(0, session.deadline - now);
}

/** An expired timer never invents completed repetitions while the app is backgrounded. */
export function updateSession(session: WorkoutSession, command: SessionCommand): WorkoutSession {
  const exercise = session.workout.exercises[session.exerciseIndex];
  if (!exercise) return session;
  const logs = session.logs[exercise.id];
  if (!logs) return session;
  const ready = (state: WorkoutSession): WorkoutSession => ({ ...state, phase: "ready", deadline: null, remainingMs: 0, durationMs: 0, paused: false });
  if (command.type === "tick") {
    if (session.phase === "rest" && !session.paused && session.deadline !== null && command.now >= session.deadline) return ready(session);
    return session;
  }
  if (command.type === "start-set") {
    if (session.phase !== "ready") return session;
    const pending = logs.findIndex((set) => !set.completed);
    if (pending < 0) return { ...ready(session), phase: "exercise-complete" };
    const durationMs = exercise.executionSeconds * 1000;
    return { ...session, setIndex: pending, phase: "execution", deadline: command.now + durationMs, durationMs, remainingMs: durationMs, paused: false };
  }
  if (command.type === "complete-set") {
    if (session.phase !== "execution") return session;
    const nextLogs = cloneLogs(session.logs);
    const set = nextLogs[exercise.id]?.[session.setIndex];
    if (!set) return session;
    set.completed = true;
    const pending = nextLogs[exercise.id]?.findIndex((item) => !item.completed) ?? -1;
    const next = { ...session, logs: nextLogs, paused: false };
    if (pending < 0) return { ...ready(next), phase: "exercise-complete" };
    const durationMs = exercise.restSeconds * 1000;
    if (durationMs === 0) return { ...ready(next), setIndex: pending };
    return { ...next, phase: "rest", setIndex: pending, durationMs, remainingMs: durationMs, deadline: command.now + durationMs };
  }
  if (command.type === "toggle-pause") {
    if (session.deadline === null || !["execution", "rest"].includes(session.phase)) return session;
    if (session.paused) return { ...session, paused: false, deadline: command.now + session.remainingMs };
    return { ...session, paused: true, remainingMs: remainingMilliseconds(session, command.now) };
  }
  if (command.type === "extend-rest") {
    if (session.phase !== "rest" || !Number.isFinite(command.milliseconds) || command.milliseconds <= 0 || command.milliseconds > 60000) return session;
    return { ...session, durationMs: session.durationMs + command.milliseconds, remainingMs: session.remainingMs + command.milliseconds,
      deadline: session.deadline === null ? null : session.deadline + command.milliseconds };
  }
  if (command.type === "skip-rest") return session.phase === "rest" ? ready(session) : session;
  if (command.type === "exercise") {
    if (!Number.isInteger(command.index) || !session.workout.exercises[command.index]) return session;
    const target = session.workout.exercises[command.index]!;
    const pending = session.logs[target.id]?.findIndex((item) => !item.completed) ?? -1;
    return { ...ready(session), exerciseIndex: command.index, setIndex: Math.max(0, pending), phase: pending < 0 ? "exercise-complete" : "ready" };
  }
  if (command.type === "set-log" || command.type === "toggle-set") {
    const target = session.logs[command.exerciseId]?.[command.setIndex];
    if (!target || !Number.isInteger(command.setIndex)) return session;
    if (command.type === "set-log" && (!validLoad(command.kg) || !validRepetitions(command.repetitions))) return session;
    const nextLogs = cloneLogs(session.logs);
    nextLogs[command.exerciseId]![command.setIndex] = command.type === "set-log"
      ? { ...target, kg: command.kg, repetitions: command.repetitions }
      : { ...target, completed: !target.completed };
    // Manual changes reconcile the timer before another set can be credited.
    const next = { ...session, logs: nextLogs };
    if (command.type === "toggle-set" && command.exerciseId === exercise.id) {
      const pending = nextLogs[exercise.id]!.findIndex((item) => !item.completed);
      return { ...ready(next), phase: pending < 0 ? "exercise-complete" : "ready", setIndex: Math.max(0, pending) };
    }
    return next;
  }
  return session;
}

export const validLoad = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1000;
export const validRepetitions = (value: number) => Number.isInteger(value) && value >= 1 && value <= 100;

/** Parse the whole pt-BR input, never a partial prefix such as "40kg". */
export function parseSetInput(kgText: string, repetitionsText: string): { kg: number; repetitions: number } | null {
  const kg = kgText.trim();
  const reps = repetitionsText.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(kg) || !/^\d+$/.test(reps)) return null;
  const result = { kg: Number(kg.replace(",", ".")), repetitions: Number(reps) };
  return validLoad(result.kg) && validRepetitions(result.repetitions) ? result : null;
}

export function summarizeSession(session: WorkoutSession, now: number): SessionSummary {
  const sets = Object.values(session.logs).flat();
  const completed = sets.filter((set) => set.completed);
  return { id: session.id, userId: session.userId, tenantId: session.tenantId, workoutId: session.workout.id, name: session.workout.name,
    letter: session.workout.letter, startedAt: session.startedAt, finishedAt: now,
    durationSeconds: Math.max(0, Math.floor((now - session.startedAt) / 1000)), completedSets: completed.length,
    plannedSets: sets.length, volumeKg: Math.round(completed.reduce((sum, set) => sum + set.kg * set.repetitions, 0) * 100) / 100,
    exercises: session.workout.exercises.map((exercise) => ({ id: exercise.id, name: exercise.name,
      sets: (session.logs[exercise.id] ?? []).map((set) => ({ ...set })) })) };
}

/** Reject a stale or mis-keyed member snapshot on reads as well as writes. */
export function trainingForMember(state: DemoClientState, tenantId = state.selectedTenantId): TenantTrainingState {
  const tenant = state.tenants[tenantId];
  const session = tenant?.activeSession;
  return {
    activeSession: session?.userId === state.userId && session.tenantId === tenantId ? session : null,
    history: (tenant?.history ?? []).filter((entry) => entry.userId === state.userId && entry.tenantId === tenantId),
  };
}

export function selectTenant(state: DemoClientState, tenantId: string): DemoClientState {
  return state.tenants[tenantId] ? { ...state, selectedTenantId: tenantId } : state;
}

export function beginWorkout(state: DemoClientState, workout: Workout, id: string, now: number): DemoClientState {
  const tenant = state.tenants[state.selectedTenantId];
  if (!tenant || workout.tenantId !== state.selectedTenantId || tenant.activeSession) return state;
  return { ...state, tenants: { ...state.tenants, [workout.tenantId]: { ...tenant,
    activeSession: createSession(workout, state.userId, id, now, tenant.history) } } };
}

export function commandForTenant(state: DemoClientState, tenantId: string, sessionId: string, command: SessionCommand): DemoClientState {
  const tenant = state.tenants[tenantId];
  if (state.selectedTenantId !== tenantId || tenant?.activeSession?.id !== sessionId || tenant.activeSession.userId !== state.userId || tenant.activeSession.tenantId !== tenantId) return state;
  const activeSession = updateSession(tenant.activeSession, command);
  if (activeSession === tenant.activeSession) return state;
  return { ...state, tenants: { ...state.tenants, [tenantId]: { ...tenant, activeSession } } };
}

export function finishSession(state: DemoClientState, tenantId: string, sessionId: string, now: number, discard = false): DemoClientState {
  const tenant = state.tenants[tenantId];
  if (state.selectedTenantId !== tenantId || tenant?.activeSession?.id !== sessionId || tenant.activeSession.userId !== state.userId || tenant.activeSession.tenantId !== tenantId) return state;
  const summary = summarizeSession(tenant.activeSession, now);
  if (!discard && summary.completedSets === 0) return state;
  return { ...state, tenants: { ...state.tenants, [tenantId]: { activeSession: null,
    history: discard ? tenant.history : [summary, ...tenant.history.filter((entry) => entry.id !== sessionId)] } } };
}
