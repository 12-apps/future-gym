import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("bundled reference cues", () => {
  it.each([
    ["tick", 0.1], ["set-end", 0.57], ["rest-end", 0.89], ["exercise-done", 0.93],
  ] as const)("ships a nonempty, unclipped mono PCM asset for %s", (name, seconds) => {
    const bytes = readFileSync(join(__dirname, "../assets/audio", `${name}.wav`));
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(bytes.toString("ascii", 8, 12)).toBe("WAVE");
    expect(bytes.readUInt32LE(4)).toBe(bytes.length - 8);
    expect(bytes.readUInt16LE(20)).toBe(1);
    expect(bytes.readUInt16LE(22)).toBe(1);
    expect(bytes.readUInt32LE(24)).toBe(44100);
    expect(bytes.readUInt16LE(34)).toBe(16);
    expect(bytes.readUInt32LE(40)).toBe(bytes.length - 44);
    expect((bytes.length - 44) / 2 / 44100).toBeCloseTo(seconds, 4);
    let peak = 0;
    for (let index = 44; index < bytes.length; index += 2) peak = Math.max(peak, Math.abs(bytes.readInt16LE(index)));
    expect(peak).toBeGreaterThan(1000);
    expect(peak).toBeLessThan(32767);
  });
});
