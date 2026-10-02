import { act, renderHook } from "@testing-library/react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioStatus } from "expo-audio";
import { createSession, updateSession, type WorkoutSession } from "../src/client/model";
import { SAMPLE_WORKOUTS } from "../src/client/sample-data";
import { useWorkoutAudio } from "../src/client/workout-audio";

jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));

const configure = jest.mocked(setAudioModeAsync);
const createPlayer = jest.mocked(createAudioPlayer);
const initial = () => createSession(SAMPLE_WORKOUTS[0]!, "member", "session", 0);
const players: ReturnType<typeof playerMock>[] = [];
function playerMock() {
  let statusListener: (status: AudioStatus) => void = () => undefined;
  return {
    playing: false, currentTime: 0,
    play: jest.fn(), pause: jest.fn(), remove: jest.fn(), release: jest.fn(), removeListener: jest.fn(),
    addListener: jest.fn((_event: string, listener: (status: AudioStatus) => void) => {
      statusListener = listener;
      return { remove: (): void => { players.find(player => player.emit === emit)?.removeListener(); } };
    }),
    emit,
  };
  function emit(status: Partial<AudioStatus>) {
    statusListener({ playing: false, isBuffering: false, didJustFinish: false, error: null, ...status } as AudioStatus);
  }
}

// Installed Android AudioModule keeps a lifecycle registry independently from
// shared playback resources: remove() unregisters, release() frees the player.
// This causal fixture models that contract; it does not execute native code.
function nativeRegistryFixture() {
  const registered = new Set<ReturnType<typeof makePlayer>>();
  function makePlayer() {
    let released = false;
    let listener: ((status: AudioStatus) => void) | undefined;
    const player = {
      isPaused: false,
      play: jest.fn(() => { if (released) throw new Error("play sent to released native player"); }),
      pause: jest.fn(),
      remove: jest.fn(() => { registered.delete(player); }),
      release: jest.fn(() => { released = true; }),
      addListener: jest.fn((_event: string, next: (status: AudioStatus) => void) => {
        listener = next;
        return { remove: () => { listener = undefined; } };
      }),
      emit(status: Partial<AudioStatus>) {
        listener?.({ playing: false, isBuffering: false, didJustFinish: false, error: null, ...status } as AudioStatus);
      },
    };
    registered.add(player);
    return player;
  }
  const player = makePlayer();
  return {
    player,
    registered,
    background() {
      for (const item of registered) {
        item.isPaused = true;
        item.pause();
        item.emit({ playing: false });
      }
    },
    foreground() {
      for (const item of registered) {
        if (item.isPaused) { item.isPaused = false; item.play(); }
      }
    },
  };
}

async function boot(enabled = true) {
  const session = initial();
  const hook = renderHook(({ current, now, sound }: { current: WorkoutSession | null; now: number; sound: boolean }) =>
    useWorkoutAudio(current, now, sound), { initialProps: { current: session as WorkoutSession | null, now: 0, sound: enabled } });
  await act(async () => { await Promise.resolve(); });
  return {
    ...hook,
    async update(current: WorkoutSession | null, now = 0, sound = true) {
      await act(async () => { hook.rerender({ current, now, sound }); });
    },
    active: updateSession(session, { type: "start-set", now: 0 }),
  };
}

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(0); jest.clearAllMocks(); players.length = 0;
  configure.mockResolvedValue(undefined);
  createPlayer.mockImplementation(() => {
    const player = playerMock(); players.push(player);
    return player as unknown as ReturnType<typeof createAudioPlayer>;
  });
});
afterEach(() => jest.useRealTimers());

describe("foreground audio hook with controlled Expo mocks", () => {
  it("configures playback-only mixing and never enables background audio", async () => {
    const hook = await boot();
    expect(configure).toHaveBeenCalledWith({ allowsRecording: false, allowsBackgroundRecording: false,
      shouldPlayInBackground: false, playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldRouteThroughEarpiece: false });
    expect(createPlayer).not.toHaveBeenCalled(); expect(hook.result.current.error).toBeNull();
  });
  it("creates a single player for a new cue and no duplicates on repeated updates", async () => {
    const hook = await boot(); await hook.update(hook.active);
    expect(createPlayer).toHaveBeenCalledTimes(1); expect(players[0]!.play).toHaveBeenCalledTimes(1);
    await hook.update({ ...hook.active }, 250); await hook.update(hook.active, 500);
    expect(createPlayer).toHaveBeenCalledTimes(1);
  });
  it.each(["mute", "pause", "session-end", "exercise", "tenant", "late-update"])("stops and releases playback on %s", async (reason) => {
    const hook = await boot(); await hook.update(hook.active);
    const next = reason === "pause" ? updateSession(hook.active, { type: "toggle-pause", now: 250 }) :
      reason === "session-end" ? null : reason === "exercise" ? { ...hook.active, exerciseIndex: 1 } :
      reason === "tenant" ? { ...hook.active, tenantId: "other" } : hook.active;
    await hook.update(next, reason === "late-update" ? 5000 : 250, reason !== "mute");
    expect(players[0]!.pause).toHaveBeenCalledTimes(1); expect(players[0]!.release).toHaveBeenCalledTimes(1);
    expect(players[0]!.removeListener).toHaveBeenCalledTimes(1);
  });
  it("releases players and cancels pending work on unmount", async () => {
    const hook = await boot(); await hook.update(hook.active); hook.unmount();
    expect(players[0]!.release).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(players[0]!.release).toHaveBeenCalledTimes(1);
  });
  it("releases a finished or interrupted cue instead of retaining it for replay", async () => {
    const hook = await boot(); await hook.update(hook.active);
    act(() => { players[0]!.emit({ playing: true }); players[0]!.emit({ playing: false }); });
    expect(players[0]!.release).toHaveBeenCalledTimes(1);
    const rest = updateSession(hook.active, { type: "complete-set", now: 250 }); await hook.update(rest, 250);
    act(() => { players[1]!.emit({ didJustFinish: true }); });
    expect(players[1]!.release).toHaveBeenCalledTimes(1);
  });
  it("does not let native foreground resume a player disposed after background pause", async () => {
    const native = nativeRegistryFixture();
    createPlayer.mockReturnValue(native.player as unknown as ReturnType<typeof createAudioPlayer>);
    const hook = await boot(); await hook.update(hook.active);
    act(() => { native.player.emit({ playing: true }); native.background(); });
    expect(native.player.release).toHaveBeenCalledTimes(1);
    expect(() => native.foreground()).not.toThrow();
    expect(native.player.play).toHaveBeenCalledTimes(1);
    expect(native.registered.size).toBe(0);
  });
  it("unregisters and releases even when cleanup pause fails", async () => {
    const native = nativeRegistryFixture();
    createPlayer.mockReturnValue(native.player as unknown as ReturnType<typeof createAudioPlayer>);
    const hook = await boot(); await hook.update(hook.active);
    native.player.pause.mockImplementation(() => { throw new Error("native pause unavailable"); });
    act(() => native.player.emit({ didJustFinish: true }));
    expect(hook.result.current.error?.code).toBe("cleanup");
    expect(native.registered.size).toBe(0);
    expect(native.player.release).toHaveBeenCalledTimes(1);
  });
  it("reports failed native unregistration and still releases playback resources", async () => {
    const hook = await boot(); await hook.update(hook.active);
    const failure = new Error("native registry unavailable");
    players[0]!.remove.mockImplementation(() => { throw failure; });
    act(() => players[0]!.emit({ didJustFinish: true }));
    expect(hook.result.current.error).toEqual({ code: "cleanup", cause: failure });
    expect(players[0]!.pause).toHaveBeenCalledTimes(1);
    expect(players[0]!.release).toHaveBeenCalledTimes(1);
  });
  it("does not initialize native audio while muted", async () => {
    const hook = await boot(false); await hook.update(hook.active, 250, false);
    expect(configure).not.toHaveBeenCalled(); expect(createPlayer).not.toHaveBeenCalled();
    await hook.update(hook.active, 500, true); expect(createPlayer).not.toHaveBeenCalled();
  });
  it("surfaces configuration failures without starting playback", async () => {
    const failure = new Error("Audio session unavailable"); configure.mockRejectedValue(failure);
    const hook = await boot(); await hook.update(hook.active);
    expect(hook.result.current.error).toEqual({ code: "configuration", cause: failure }); expect(createPlayer).not.toHaveBeenCalled();
  });
  it("surfaces a player-construction failure", async () => {
    const failure = new Error("Native player unavailable"); createPlayer.mockImplementation(() => { throw failure; });
    const hook = await boot(); await hook.update(hook.active);
    expect(hook.result.current.error).toEqual({ code: "playback", cause: failure });
  });
  it("surfaces native status errors and releases the failed player", async () => {
    const hook = await boot(); await hook.update(hook.active);
    act(() => { players[0]!.emit({ error: "Asset decode failed" }); });
    expect(hook.result.current.error).toEqual({ code: "playback", cause: "Asset decode failed" });
    expect(players[0]!.release).toHaveBeenCalledTimes(1);
  });
  it("surfaces playback invocation and cleanup failures without skipping release", async () => {
    const hook = await boot();
    createPlayer.mockImplementationOnce(() => {
      const player = playerMock(); players.push(player);
      player.play.mockImplementation(() => { throw new Error("Play failed"); });
      player.pause.mockImplementation(() => { throw new Error("Pause failed"); });
      return player as unknown as ReturnType<typeof createAudioPlayer>;
    });
    await hook.update(hook.active);
    expect(hook.result.current.error?.code).toBe("cleanup"); expect(players[0]!.release).toHaveBeenCalledTimes(1);
  });
  it("surfaces a stalled player and enforces a short cue lifetime", async () => {
    const hook = await boot(); await hook.update(hook.active);
    act(() => { jest.advanceTimersByTime(1500); });
    expect(hook.result.current.error?.code).toBe("playback"); expect(players[0]!.release).toHaveBeenCalledTimes(1);
  });
  // Native playback and JS event delivery have separate clocks. A 100ms tick
  // can finish before its status event reaches JS; public getters still expose
  // its actual position. This fixture models that ordering, not audible output.
  async function countdownTick() {
    const active = updateSession(initial(), { type: "start-set", now: 0 });
    const deadline = active.deadline!;
    const hook = renderHook(({ now }: { now: number }) => useWorkoutAudio(active, now, true),
      { initialProps: { now: deadline - 3250 } });
    await act(async () => { await Promise.resolve(); });
    jest.setSystemTime(250);
    await act(async () => { hook.rerender({ now: deadline - 3000 }); });
    expect(createPlayer).toHaveBeenCalledTimes(1);
    return { hook, player: players[0]! };
  }
  it.each([
    { label: "completed", playing: false, currentTime: 0.1 },
    { label: "active", playing: true, currentTime: 0 },
  ])("recognizes $label native playback when the tick status event misses its deadline", async (native) => {
    const { hook, player } = await countdownTick();
    player.playing = native.playing; player.currentTime = native.currentTime;
    act(() => { jest.advanceTimersByTime(599); });
    expect(player.release).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(hook.result.current.error).toBeNull();
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.remove).toHaveBeenCalledTimes(1);
    expect(player.release).toHaveBeenCalledTimes(1);
    act(() => { player.emit({ playing: true }); jest.advanceTimersByTime(1000); });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.release).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toBeNull();
  });
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("still rejects a silent tick with native position %s at its deadline", async (position) => {
    const { hook, player } = await countdownTick();
    player.currentTime = position;
    act(() => { jest.advanceTimersByTime(600); });
    expect(hook.result.current.error?.code).toBe("playback");
    expect(player.release).toHaveBeenCalledTimes(1);
  });
  it("reports a native deadline status-read failure and still releases the tick", async () => {
    const { hook, player } = await countdownTick();
    const failure = new Error("Native playback position unavailable");
    Object.defineProperty(player, "currentTime", { get() { throw failure; } });
    act(() => { jest.advanceTimersByTime(600); });
    expect(hook.result.current.error).toEqual({ code: "playback", cause: failure });
    expect(player.remove).toHaveBeenCalledTimes(1);
    expect(player.release).toHaveBeenCalledTimes(1);
  });
  it("preserves an explicit native error even after the tick made progress", async () => {
    const { hook, player } = await countdownTick();
    player.currentTime = 0.05;
    act(() => { player.emit({ error: "Native tick decode failed" }); jest.advanceTimersByTime(600); });
    expect(hook.result.current.error).toEqual({ code: "playback", cause: "Native tick decode failed" });
    expect(player.release).toHaveBeenCalledTimes(1);
  });
  it.each(["late", "mute", "unmount"])("does not play a queued cue after %s while configuration is pending", async (reason) => {
    let resolveMode: (() => void) | undefined;
    configure.mockImplementation(() => new Promise<void>(resolve => { resolveMode = resolve; }));
    const hook = await boot(); await hook.update(hook.active);
    if (reason === "late") jest.setSystemTime(1000);
    if (reason === "mute") await hook.update(hook.active, 250, false);
    if (reason === "unmount") hook.unmount();
    await act(async () => { resolveMode!(); });
    expect(createPlayer).not.toHaveBeenCalled();
  });
});
