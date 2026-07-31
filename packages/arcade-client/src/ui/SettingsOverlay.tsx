import { useEffect, useRef } from "react";
import type { AudioPreferences } from "../audio/preferences.js";
import {
  DEFAULT_GRAPHICS_PREFERENCES,
  type GraphicsPreferences
} from "../render/graphicsPreferences.js";
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
  readonly graphicsPreferences?: GraphicsPreferences;
  readonly onChange: (next: AudioPreferences) => void;
  readonly onGraphicsPreferencesChange?: (next: GraphicsPreferences) => void;
  readonly onClose: () => void;
  /**
   * Renders an "Exit to Main Menu" action. Omit on the main menu itself;
   * from a room screen the handler must also leave the room cleanly.
   */
  readonly onExitToMenu?: () => void;
}

export function SettingsOverlay({
  open,
  preferences,
  graphicsPreferences = DEFAULT_GRAPHICS_PREFERENCES,
  onChange,
  onGraphicsPreferencesChange = () => undefined,
  onClose,
  onExitToMenu
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
            <span className="audio-settings-label">Reduced Graphics</span>
            <input
              aria-label="Reduced Graphics"
              type="checkbox"
              checked={graphicsPreferences.reducedGraphics}
              onChange={(event) =>
                onGraphicsPreferencesChange({
                  reducedGraphics: event.currentTarget.checked
                })
              }
            />
          </span>
          <span className="audio-settings-hint">
            Thins the crowd and turns off shadows for a higher frame rate.
            Gameplay is unchanged.
          </span>
        </label>
        <ControlsGuide />
        {onExitToMenu ? (
          <button
            type="button"
            className="settings-overlay-exit"
            onClick={onExitToMenu}
          >
            Exit to Main Menu
          </button>
        ) : null}
      </section>
    </section>
  );
}
