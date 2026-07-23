export type AudioBus = "announcer" | "gameplay" | "music";

export interface AudioPreferences {
  readonly announcer: number;
  readonly gameplay: number;
  readonly music: number;
}

// Cube roots of the pre-taper defaults (0.8 / 0.8 / 0.55), so a fresh
// install plays the same mix it did when sliders mapped straight to gain.
export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  announcer: 0.93,
  gameplay: 0.93,
  music: 0.82
};

export const AUDIO_PREFERENCES_STORAGE_KEY = "bbh.audio.preferences";

/**
 * Marks persisted payloads written since the cubic taper landed. Payloads
 * without it were written when sliders mapped straight to gain, so their
 * numbers are raw gains — loading cube-roots them into slider levels that
 * reproduce the same loudness under the taper.
 */
const PERSISTED_CURVE = "cubic";

export function clampAudioLevel(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Loudness perception is roughly logarithmic while GainNode gain is linear
 * amplitude, so a slider mapped straight to gain packs its whole audible
 * range into the bottom ~15% of travel. The cubic taper (~-60 dB usable
 * range) makes equal slider steps sound like similar loudness changes;
 * 0 and 1 still map to silence and full volume.
 */
export function perceptualGainForLevel(level: number): number {
  const clamped = clampAudioLevel(level);
  return clamped * clamped * clamped;
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

    const legacy = parsed.curve !== PERSISTED_CURVE;

    return {
      announcer: readAudioLevel(
        parsed.announcer,
        DEFAULT_AUDIO_PREFERENCES.announcer,
        legacy
      ),
      gameplay: readAudioLevel(
        parsed.gameplay,
        DEFAULT_AUDIO_PREFERENCES.gameplay,
        legacy
      ),
      music: readAudioLevel(
        parsed.music,
        DEFAULT_AUDIO_PREFERENCES.music,
        legacy
      )
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
      JSON.stringify({ ...normalized, curve: PERSISTED_CURVE })
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

function readAudioLevel(
  value: unknown,
  fallback: number,
  legacy: boolean
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const clamped = clampAudioLevel(value);
  return legacy ? Math.cbrt(clamped) : clamped;
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
