export type AudioBus = "announcer" | "gameplay" | "music";

export interface AudioPreferences {
  readonly announcer: number;
  readonly gameplay: number;
  readonly music: number;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  announcer: 0.8,
  gameplay: 0.8,
  music: 0.55
};

export const AUDIO_PREFERENCES_STORAGE_KEY = "bbh.audio.preferences";

export function clampAudioLevel(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function loadAudioPreferences(
  storage?: Storage | null
): AudioPreferences {
  const resolvedStorage = storage ?? getBrowserStorage();
  if (!resolvedStorage) {
    return DEFAULT_AUDIO_PREFERENCES;
  }

  try {
    const raw = resolvedStorage.getItem(AUDIO_PREFERENCES_STORAGE_KEY);

    if (!raw) {
      return DEFAULT_AUDIO_PREFERENCES;
    }

    const parsed = JSON.parse(raw);

    if (!isPlainObject(parsed)) {
      return DEFAULT_AUDIO_PREFERENCES;
    }

    return {
      announcer: readAudioLevel(
        parsed.announcer,
        DEFAULT_AUDIO_PREFERENCES.announcer
      ),
      gameplay: readAudioLevel(
        parsed.gameplay,
        DEFAULT_AUDIO_PREFERENCES.gameplay
      ),
      music: readAudioLevel(parsed.music, DEFAULT_AUDIO_PREFERENCES.music)
    };
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
}

export function saveAudioPreferences(
  preferences: AudioPreferences,
  storage?: Storage | null
): void {
  const resolvedStorage = storage ?? getBrowserStorage();
  if (!resolvedStorage) {
    return;
  }

  const normalized = normalizeAudioPreferences(preferences);

  try {
    resolvedStorage.setItem(
      AUDIO_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function normalizeAudioPreferences(
  preferences: AudioPreferences
): AudioPreferences {
  return {
    announcer: normalizePersistedAudioLevel(
      preferences.announcer,
      DEFAULT_AUDIO_PREFERENCES.announcer
    ),
    gameplay: normalizePersistedAudioLevel(
      preferences.gameplay,
      DEFAULT_AUDIO_PREFERENCES.gameplay
    ),
    music: normalizePersistedAudioLevel(
      preferences.music,
      DEFAULT_AUDIO_PREFERENCES.music
    )
  };
}

function normalizePersistedAudioLevel(value: number, fallback: number): number {
  return Number.isFinite(value) ? clampAudioLevel(value) : fallback;
}

function readAudioLevel(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clampAudioLevel(value)
    : fallback;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
