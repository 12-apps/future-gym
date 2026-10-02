"""Reproduce Future Gym.html's four Web Audio cues as bundled 44.1 kHz PCM.

Run: python3 apps/mobile/assets/audio/generate.py
The reference's oscillator frequencies, wave types, offsets, gain and exponential
12 ms attack/decay envelope are preserved. Harmonic synthesis band-limits square
and triangle waves at Nyquist, matching Web Audio's non-aliasing oscillators.
No external files, services or sound licenses are needed.
"""

import math
import pathlib
import struct
import wave

SAMPLE_RATE = 44100
TONES = {
    "tick": [(1320, 0, 0.07, "sine", 0.12)],
    "set-end": [(1046, offset, 0.14, "square", 0.18) for offset in (0, 0.2, 0.4)],
    "rest-end": [(frequency, offset, 0.5 if offset == 0.36 else 0.14, "triangle", 0.32)
                 for frequency, offset in ((523, 0), (659, 0.12), (784, 0.24), (1046, 0.36))],
    "exercise-done": [(frequency, 0, 0.9, "triangle", 0.2) for frequency in (523, 659, 784)],
}


def oscillator(frequency, time, kind):
    phase = 2 * math.pi * frequency * time
    if kind == "sine":
        return math.sin(phase)
    harmonics = range(1, int(SAMPLE_RATE / (2 * frequency)) + 1, 2)
    if kind == "square":
        return 4 / math.pi * sum(math.sin(harmonic * phase) / harmonic for harmonic in harmonics)
    return 8 / math.pi**2 * sum((-1)**((harmonic - 1) // 2) * math.sin(harmonic * phase) / harmonic**2
                              for harmonic in harmonics)


def render(tones):
    frames = math.ceil(max(offset + duration + 0.03 for _, offset, duration, _, _ in tones) * SAMPLE_RATE)
    samples = [0.0] * frames
    for frequency, offset, duration, kind, gain in tones:
        start = round(offset * SAMPLE_RATE)
        for index in range(round((duration + 0.03) * SAMPLE_RATE)):
            time = index / SAMPLE_RATE
            envelope = (0.0001 * (gain / 0.0001)**(time / 0.012) if time <= 0.012 else
                        gain * (0.0001 / gain)**((time - 0.012) / (duration - 0.012)) if time <= duration else 0.0001)
            samples[start + index] += envelope * oscillator(frequency, time, kind)
    assert max(abs(sample) for sample in samples) < 1, "The cue must not clip"
    return b"".join(struct.pack("<h", round(sample * 32767)) for sample in samples)


if __name__ == "__main__":
    for name, tones in TONES.items():
        with wave.open(str(pathlib.Path(__file__).with_name(name + ".wav")), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(SAMPLE_RATE)
            output.writeframes(render(tones))
