import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  clampAudioLevel,
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
  perceptualGainForLevel,
  saveAudioPreferences,
  type AudioPreferences
} from "./preferences.js";

function memoryStorage(seed?: Record<string, string>): Storage {
  const entries = new Map(Object.entries(seed ?? {}));

  return {
    get length() {
      return entries.size;
    },
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(entries.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      entries.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    })
  };
}

describe("clampAudioLevel", () => {
  it("clamps below 0 and above 1", () => {
    expect(clampAudioLevel(-0.2)).toBe(0);
    expect(clampAudioLevel(1.7)).toBe(1);
  });
});

describe("perceptualGainForLevel", () => {
  it("keeps the endpoints and clamps out-of-range input", () => {
    expect(perceptualGainForLevel(0)).toBe(0);
    expect(perceptualGainForLevel(1)).toBe(1);
    expect(perceptualGainForLevel(-0.5)).toBe(0);
    expect(perceptualGainForLevel(1.5)).toBe(1);
  });

  it("attenuates mid-slider positions well below linear", () => {
    // The whole point of the taper: 50% slider must be clearly quieter
    // than 50% amplitude, and steps must stay strictly monotonic.
    expect(perceptualGainForLevel(0.5)).toBeCloseTo(0.125, 6);
    expect(perceptualGainForLevel(0.8)).toBeLessThan(0.6);
    for (let level = 0.1; level < 1; level += 0.1) {
      expect(perceptualGainForLevel(level)).toBeGreaterThan(
        perceptualGainForLevel(level - 0.1)
      );
    }
  });
});

describe("loadAudioPreferences", () => {
  it("returns defaults when storage is empty", () => {
    expect(loadAudioPreferences(memoryStorage())).toEqual(
      DEFAULT_AUDIO_PREFERENCES
    );
  });

  it("returns defaults when storage contains malformed JSON", () => {
    const storage = memoryStorage({
      "bbh.audio.preferences": "{nope"
    });

    expect(loadAudioPreferences(storage)).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it("preserves valid values and falls back for absent or invalid fields", () => {
    const storage = memoryStorage({
      "bbh.audio.preferences": JSON.stringify({
        announcer: 0.35,
        gameplay: Number.NaN,
        music: 9,
        curve: "cubic"
      })
    });

    expect(loadAudioPreferences(storage)).toEqual({
      announcer: 0.35,
      gameplay: DEFAULT_AUDIO_PREFERENCES.gameplay,
      music: 1
    });
  });

  it("cube-roots pre-taper payloads so their loudness is preserved", () => {
    // Payloads without the curve marker were written when sliders mapped
    // straight to gain; their numbers are raw gains, not slider levels.
    const storage = memoryStorage({
      "bbh.audio.preferences": JSON.stringify({
        announcer: 0.8,
        gameplay: 0.512,
        music: 0.55
      })
    });

    expect(loadAudioPreferences(storage)).toEqual({
      announcer: Math.cbrt(0.8),
      gameplay: 0.8,
      music: Math.cbrt(0.55)
    });
  });

  it("parses only plain objects and ignores arrays", () => {
    const storage = memoryStorage({
      "bbh.audio.preferences": JSON.stringify([0.1, 0.2, 0.3])
    });

    expect(loadAudioPreferences(storage)).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it("swallows storage read errors", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      })
    } as unknown as Storage;

    expect(loadAudioPreferences(storage)).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it("returns defaults when resolving browser storage throws", () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "window"
    );
    const fakeWindow = {};

    Object.defineProperty(fakeWindow, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      }
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: fakeWindow
    });

    try {
      expect(loadAudioPreferences()).toEqual(DEFAULT_AUDIO_PREFERENCES);
      expect(() =>
        saveAudioPreferences(DEFAULT_AUDIO_PREFERENCES)
      ).not.toThrow();
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });
});

describe("saveAudioPreferences", () => {
  it("saves the exact normalized object under the named storage key", () => {
    const storage = memoryStorage();
    const input: AudioPreferences = {
      announcer: -2,
      gameplay: 0.49,
      music: 8
    };

    saveAudioPreferences(input, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      AUDIO_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        announcer: 0,
        gameplay: 0.49,
        music: 1,
        curve: "cubic"
      })
    );
  });

  it("falls back to defaults for non-finite runtime values before persisting", () => {
    const storage = memoryStorage();

    saveAudioPreferences(
      {
        announcer: Number.NaN,
        gameplay: Number.POSITIVE_INFINITY,
        music: Number.NEGATIVE_INFINITY
      },
      storage
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      AUDIO_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        announcer: DEFAULT_AUDIO_PREFERENCES.announcer,
        gameplay: DEFAULT_AUDIO_PREFERENCES.gameplay,
        music: DEFAULT_AUDIO_PREFERENCES.music,
        curve: "cubic"
      })
    );
  });

  it("swallows storage write errors", () => {
    const storage = {
      setItem: vi.fn(() => {
        throw new Error("denied");
      })
    } as unknown as Storage;

    expect(() =>
      saveAudioPreferences(DEFAULT_AUDIO_PREFERENCES, storage)
    ).not.toThrow();
  });
});
