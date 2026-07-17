import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  clampAudioLevel,
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
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
        music: 9
      })
    });

    expect(loadAudioPreferences(storage)).toEqual({
      announcer: 0.35,
      gameplay: DEFAULT_AUDIO_PREFERENCES.gameplay,
      music: 1
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
        music: 1
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
