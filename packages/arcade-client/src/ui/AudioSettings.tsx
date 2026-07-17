import type { AudioPreferences } from "../audio/preferences.js";

export interface AudioSettingsProps {
  readonly value: AudioPreferences;
  readonly onChange: (next: AudioPreferences) => void;
}

const AUDIO_SLIDERS = [
  { key: "announcer", label: "Announcer" },
  { key: "gameplay", label: "Gameplay" },
  { key: "music", label: "Music" }
] as const satisfies ReadonlyArray<{
  readonly key: keyof AudioPreferences;
  readonly label: string;
}>;

export function AudioSettings({
  value,
  onChange
}: AudioSettingsProps): JSX.Element {
  return (
    <section className="audio-settings" aria-label="Audio settings">
      <h2>Audio Mix</h2>
      <div className="audio-settings-list">
        {AUDIO_SLIDERS.map(({ key, label }) => {
          const percentage = Math.round(value[key] * 100);

          return (
            <label key={key} className="audio-settings-row">
              <span className="audio-settings-copy">
                <span className="audio-settings-label">{label}</span>
                <strong className="audio-settings-value">{percentage}%</strong>
              </span>
              <input
                className="audio-settings-input"
                aria-label={label}
                type="range"
                min={0}
                max={100}
                step={1}
                value={percentage}
                onChange={(event) =>
                  onChange({
                    ...value,
                    [key]: Number(event.currentTarget.value) / 100
                  })
                }
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
