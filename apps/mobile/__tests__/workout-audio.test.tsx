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
    play: jest.fn(), pause: jest.fn(), release: jest.fn(), removeListener: jest.fn(),
    addListener: jest.fn((_event: string, listener: (status: AudioStatus) => void) => {
      statusListener = listener;
      return { remove: () => players.find(player => player.emit === emit)?.removeListener() };
    }),
    emit,
  };
  function emit(status: Partial<AudioStatus>) {
    statusListener({ playing: false, isBuffering: false, didJustFinish: false, error: null, ...status } as AudioStatus);
  }
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
