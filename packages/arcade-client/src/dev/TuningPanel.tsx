import { useCallback, useMemo, useReducer, useState } from "react";
import {
  DEFAULT_TUNING,
  TUNING,
  applyTuning,
  resetTuning,
  snapshotTuning,
  type Tuning
} from "@bbh/arcade-core";

const PRESETS_STORAGE_KEY = "bbh.arcade.tuning.presets.v1";

type TuningGroup = keyof Tuning;

const GROUP_LABELS: Record<TuningGroup, string> = {
  skater: "Skating",
  stick: "Stick",
  gestures: "Shot Gestures",
  puck: "Puck",
  check: "Checking",
  collision: "Body Contact",
  goalie: "Goalie",
  flags: "Flags"
};

interface SliderRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/**
 * Derive a usable slider range from the shipped default so the panel needs no
 * per-constant schema: 0 → 3× the default (or 0..1 for meter-like fractions),
 * with a step that gives ~300 increments.
 */
function rangeFor(defaultValue: number): SliderRange {
  if (defaultValue === 0) {
    return { min: 0, max: 10, step: 0.05 };
  }

  const magnitude = Math.abs(defaultValue);

  if (magnitude <= 1) {
    return { min: 0, max: Math.max(1, magnitude * 3), step: 0.01 };
  }

  const max = magnitude * 3;
  const step = max > 300 ? 1 : max > 30 ? 0.5 : 0.05;

  return { min: 0, max, step };
}

function loadPresets(): Record<string, Tuning> {
  try {
    return JSON.parse(
      window.localStorage.getItem(PRESETS_STORAGE_KEY) ?? "{}"
    ) as Record<string, Tuning>;
  } catch {
    return {};
  }
}

function savePresets(presets: Record<string, Tuning>): void {
  window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

export interface TuningPanelProps {
  /** Live tuning affects only a local world; in online play it is ignored. */
  readonly readOnly?: boolean;
}

/**
 * Dev feel-lab panel: auto-generated sliders over the live TUNING object.
 * Dragging a slider mutates TUNING in place, and the running local sim reads
 * it on the next tick — tune while you skate. "Copy JSON" exports the current
 * values for pasting into DEFAULT_TUNING when a feel is locked in.
 */
export function TuningPanel({ readOnly = false }: TuningPanelProps): JSX.Element {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [openGroup, setOpenGroup] = useState<TuningGroup | null>("skater");
  const [presetName, setPresetName] = useState("");
  const [copied, setCopied] = useState(false);
  const presets = useMemo(loadPresets, []);
  const [presetNames, setPresetNames] = useState(() => Object.keys(presets));

  const setValue = useCallback(
    (group: TuningGroup, key: string, value: number | boolean) => {
      if (readOnly) {
        return;
      }

      (TUNING[group] as Record<string, number | boolean>)[key] = value;
      bump();
    },
    [readOnly]
  );

  const handleReset = useCallback(() => {
    resetTuning();
    bump();
  }, []);

  const handleCopy = useCallback(() => {
    void navigator.clipboard
      ?.writeText(JSON.stringify(snapshotTuning(), null, 2))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      });
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = presetName.trim();

    if (!name) {
      return;
    }

    const all = loadPresets();
    all[name] = snapshotTuning();
    savePresets(all);
    setPresetNames(Object.keys(all));
    setPresetName("");
  }, [presetName]);

  const handleLoadPreset = useCallback((name: string) => {
    const preset = loadPresets()[name];

    if (preset) {
      applyTuning(preset);
      bump();
    }
  }, []);

  return (
    <aside className="tuning-panel" aria-label="Physics tuning panel">
      <header className="tuning-panel-header">
        <strong>FEEL LAB</strong>
        {readOnly ? <em> (read-only online)</em> : null}
        <div className="tuning-panel-actions">
          <button type="button" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy JSON"}
          </button>
          <button type="button" onClick={handleReset} disabled={readOnly}>
            Reset
          </button>
        </div>
      </header>
      {(Object.keys(GROUP_LABELS) as TuningGroup[]).map((group) => (
        <section key={group} className="tuning-group">
          <button
            type="button"
            className="tuning-group-toggle"
            onClick={() => setOpenGroup(openGroup === group ? null : group)}
          >
            {openGroup === group ? "▾" : "▸"} {GROUP_LABELS[group]}
          </button>
          {openGroup === group
            ? Object.entries(TUNING[group]).map(([key, value]) =>
                typeof value === "boolean" ? (
                  <label key={key} className="tuning-row">
                    <span>{key}</span>
                    <input
                      type="checkbox"
                      checked={value}
                      disabled={readOnly}
                      onChange={(event) =>
                        setValue(group, key, event.target.checked)
                      }
                    />
                  </label>
                ) : (
                  <label key={key} className="tuning-row">
                    <span>{key}</span>
                    <input
                      type="range"
                      disabled={readOnly}
                      {...rangeFor(
                        (DEFAULT_TUNING[group] as unknown as Record<string, number>)[
                          key
                        ] ?? value
                      )}
                      value={value}
                      onChange={(event) =>
                        setValue(group, key, Number(event.target.value))
                      }
                    />
                    <input
                      type="number"
                      disabled={readOnly}
                      value={value}
                      onChange={(event) => {
                        const next = Number(event.target.value);

                        if (Number.isFinite(next)) {
                          setValue(group, key, next);
                        }
                      }}
                    />
                  </label>
                )
              )
            : null}
        </section>
      ))}
      <footer className="tuning-presets">
        <div className="tuning-row">
          <input
            type="text"
            placeholder="preset name"
            value={presetName}
            disabled={readOnly}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <button
            type="button"
            onClick={handleSavePreset}
            disabled={readOnly || !presetName.trim()}
          >
            Save
          </button>
        </div>
        {presetNames.map((name) => (
          <div key={name} className="tuning-row">
            <span>{name}</span>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => handleLoadPreset(name)}
            >
              Load
            </button>
          </div>
        ))}
      </footer>
    </aside>
  );
}
