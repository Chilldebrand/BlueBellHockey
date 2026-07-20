import { describe, expect, it, vi } from "vitest";
import {
  CONTROL_PREFERENCES_STORAGE_KEY,
  DEFAULT_CONTROL_PREFERENCES,
  loadControlPreferences,
  saveControlPreferences
} from "./controlPreferences.js";

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

describe("loadControlPreferences", () => {
  it("falls back to defaults for missing or invalid saved values", () => {
    const invalidStorage = memoryStorage({
      [CONTROL_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        alwaysUpStickControls: "yes"
      })
    });

    expect(loadControlPreferences(memoryStorage())).toEqual(
      DEFAULT_CONTROL_PREFERENCES
    );
    expect(loadControlPreferences(invalidStorage)).toEqual(
      DEFAULT_CONTROL_PREFERENCES
    );
  });

  it("falls back to defaults for malformed or unavailable storage", () => {
    const malformedStorage = memoryStorage({
      [CONTROL_PREFERENCES_STORAGE_KEY]: "{not-json"
    });
    const unavailableStorage = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      })
    } as unknown as Storage;

    expect(loadControlPreferences(malformedStorage)).toEqual(
      DEFAULT_CONTROL_PREFERENCES
    );
    expect(loadControlPreferences(unavailableStorage)).toEqual(
      DEFAULT_CONTROL_PREFERENCES
    );
  });
});

describe("saveControlPreferences", () => {
  it("persists valid control preferences under the versioned storage key", () => {
    const storage = memoryStorage();

    saveControlPreferences({ alwaysUpStickControls: true }, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      CONTROL_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ alwaysUpStickControls: true })
    );
  });
});
