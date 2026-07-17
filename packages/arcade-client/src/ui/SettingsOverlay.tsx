import { useEffect, useRef } from "react";
import type { AudioPreferences } from "../audio/preferences.js";
import { AudioSettings } from "./AudioSettings.js";

export interface SettingsOverlayProps {
  readonly open: boolean;
  readonly preferences: AudioPreferences;
  readonly onChange: (next: AudioPreferences) => void;
  readonly onClose: () => void;
}

export function SettingsOverlay({
  open,
  preferences,
  onChange,
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
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
      </section>
    </section>
  );
}
