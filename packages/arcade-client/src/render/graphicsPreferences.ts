/**
 * Graphics quality preference, persisted like the audio mix.
 *
 * Reduced mode targets the two things that actually cost frames in this scene:
 * the crowd (~2900 instanced fans at full detail, ~1450 reduced) and real-time
 * shadows, which make every shadow-casting mesh — bodies, sticks, the whole
 * arena bowl — render a second time into the shadow map. Gameplay, the sim,
 * and the rink itself are untouched, so a reduced-graphics client sees exactly
 * the same match as everyone else.
 */

export interface GraphicsPreferences {
  readonly reducedGraphics: boolean;
}

export const DEFAULT_GRAPHICS_PREFERENCES: GraphicsPreferences = {
  reducedGraphics: false
};

export const GRAPHICS_PREFERENCES_STORAGE_KEY = "bbh.arcade.graphics.v1";

export function loadGraphicsPreferences(
  storage?: Storage | null
): GraphicsPreferences {
  const resolved = storage ?? browserStorage();
  if (!resolved) {
    return DEFAULT_GRAPHICS_PREFERENCES;
  }

  try {
    const raw = resolved.getItem(GRAPHICS_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_GRAPHICS_PREFERENCES;
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("reducedGraphics" in parsed) ||
      typeof parsed.reducedGraphics !== "boolean"
    ) {
      return DEFAULT_GRAPHICS_PREFERENCES;
    }

    return { reducedGraphics: parsed.reducedGraphics };
  } catch {
    return DEFAULT_GRAPHICS_PREFERENCES;
  }
}

export function saveGraphicsPreferences(
  preferences: GraphicsPreferences,
  storage?: Storage | null
): void {
  const resolved = storage ?? browserStorage();
  if (!resolved) {
    return;
  }

  try {
    resolved.setItem(
      GRAPHICS_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ reducedGraphics: preferences.reducedGraphics })
    );
  } catch {
    // Ignore quota / privacy-mode failures, same as the audio prefs.
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
