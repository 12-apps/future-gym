/** Native renderers cannot decode or play audio. Never treat this mock as device evidence. */
jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    let listener: ((status: { playing: boolean; isBuffering: boolean; didJustFinish: boolean; error: null }) => void) | null = null;
    return {
      addListener: jest.fn((_event: string, callback: typeof listener) => {
        listener = callback;
        return { remove: jest.fn(() => { listener = null; }) };
      }),
      play: jest.fn(() => listener?.({ playing: true, isBuffering: false, didJustFinish: false, error: null })),
      pause: jest.fn(),
      remove: jest.fn(),
      release: jest.fn(),
    };
  }),
}));
