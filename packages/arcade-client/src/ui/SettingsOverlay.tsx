import { useEffect, useRef } from "react";
import type { AudioPreferences } from "../audio/preferences.js";
import {
  DEFAULT_CONTROL_PREFERENCES,
  type ControlPreferences
} from "../input/controlPreferences.js";
import { AudioSettings } from "./AudioSettings.js";
import { ControlsGuide } from "./ControlsGuide.js";

const GAMEPLAY_KEYS = new Set([
  " ",
  "a",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowup",
  "d",
  "escape",
  "f",
  "g",
  "i",
  "j",
  "k",
  "l",
  "q",
  "r",
  "s",
  "shift",
  "v",
  "w"
]);

function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

function isRangeInputTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object" || !("tagName" in target)) {
    return false;
  }

  return String(target.tagName).toUpperCase() === "INPUT";
}

export interface SettingsOverlayProps {
  readonly open: boolean;
  readonly preferences: AudioPreferences;
  readonly controlPreferences?: ControlPreferences;
  readonly onChange: (next: AudioPreferences) => void;
  readonly onControlPreferencesChange?: (next: ControlPreferences) => void;
  readonly onClose: () => void;
}

export function SettingsOverlay({
  open,
  preferences,
  controlPreferences = DEFAULT_CONTROL_PREFERENCES,
  onChange,
  onControlPreferencesChange = () => undefined,
  onClose
}: SettingsOverlayProps): JSX.Element | null {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      openerRef.current?.focus();
      return;
    }

    openerRef.current =
      typeof document === "undefined"
        ? null
        : (document.activeElement as HTMLElement | null);

    const handleKey = (event: KeyboardEvent) => {
      const key = normalizeKey(event.key);

      if (!GAMEPLAY_KEYS.has(key)) {
        return;
      }

      event.stopPropagation?.();

      if (!(key.startsWith("arrow") && isRangeInputTarget(event.target))) {
        event.preventDefault?.();
      }

      if (key === "escape" && (event.type || "keydown") === "keydown") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("keyup", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("keyup", handleKey);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <section className="settings-overlay-backdrop" onClick={onClose}>
      <section
        className="settings-overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-overlay-header">
          <h2>Settings</h2>
          <button
            type="button"
            className="settings-overlay-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <AudioSettings value={preferences} onChange={onChange} />
        <label className="audio-settings-row">
          <span className="audio-settings-copy">
            <span className="audio-settings-label">Always Up Stick Controls</span>
          </span>
          <input
            aria-label="Always Up Stick Controls"
            type="checkbox"
            checked={controlPreferences.alwaysUpStickControls}
            onChange={(event) =>
              onControlPreferencesChange({
                alwaysUpStickControls: event.currentTarget.checked
              })
            }
          />
        </label>
        <ControlsGuide />
      </section>
    </section>
  );
}
