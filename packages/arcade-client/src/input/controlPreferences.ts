export interface ControlPreferences {
  readonly alwaysUpStickControls: boolean;
}

export const DEFAULT_CONTROL_PREFERENCES: ControlPreferences = {
  alwaysUpStickControls: false
};

export const CONTROL_PREFERENCES_STORAGE_KEY = "bbh.arcade.controls.v1";

export function loadControlPreferences(
  storage?: Storage | null
): ControlPreferences {
  const resolvedStorage = storage ?? getBrowserStorage();
  if (!resolvedStorage) {
    return DEFAULT_CONTROL_PREFERENCES;
  }

  try {
    const raw = resolvedStorage.getItem(CONTROL_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CONTROL_PREFERENCES;
    }

    const parsed = JSON.parse(raw);
    if (!isControlPreferences(parsed)) {
      return DEFAULT_CONTROL_PREFERENCES;
    }

    return parsed;
  } catch {
    return DEFAULT_CONTROL_PREFERENCES;
  }
}

export function saveControlPreferences(
  preferences: ControlPreferences,
  storage?: Storage | null
): void {
  const resolvedStorage = storage ?? getBrowserStorage();
  if (!resolvedStorage) {
    return;
  }

  try {
    resolvedStorage.setItem(
      CONTROL_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        alwaysUpStickControls: preferences.alwaysUpStickControls
      })
    );
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function isControlPreferences(value: unknown): value is ControlPreferences {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "alwaysUpStickControls" in value &&
    typeof value.alwaysUpStickControls === "boolean"
  );
}

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
