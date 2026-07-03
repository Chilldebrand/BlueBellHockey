import { CHECK_CONFIG, type CheckConfig } from "../sim/actions.js";
import { COLLISION_CONFIG, type CollisionConfig } from "../sim/collision.js";
import { GESTURE_CONFIG, type GestureConfig } from "../sim/gestures.js";
import { GOALIE_CONFIG, type GoalieConfig } from "../sim/goalie.js";
import { PUCK_CONFIG, type PuckConfig } from "../sim/puck.js";
import {
  SKATER_MOVEMENT_CONFIG,
  type SkaterMovementConfig
} from "../sim/skater.js";
import { STICK_CONFIG, type StickConfig } from "../sim/stick.js";

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

export interface TuningFlags {
  readonly powerupsEnabled: boolean;
  readonly specialsEnabled: boolean;
}

/**
 * Every gameplay-feel constant, grouped by system. The sim step functions read
 * the live TUNING object each tick, so a dev tuning panel can mutate values
 * while a local (client-only) world is running and feel the change instantly.
 * Server and clients that never mutate TUNING all run DEFAULT_TUNING values,
 * preserving deterministic agreement.
 */
export interface Tuning {
  readonly skater: SkaterMovementConfig;
  readonly stick: StickConfig;
  readonly gestures: GestureConfig;
  readonly puck: PuckConfig;
  readonly check: CheckConfig;
  readonly collision: CollisionConfig;
  readonly goalie: GoalieConfig;
  readonly flags: TuningFlags;
}

type MutableTuning = {
  skater: Mutable<SkaterMovementConfig>;
  stick: Mutable<StickConfig>;
  gestures: Mutable<GestureConfig>;
  puck: Mutable<PuckConfig>;
  check: Mutable<CheckConfig>;
  collision: Mutable<CollisionConfig>;
  goalie: Mutable<GoalieConfig>;
  flags: Mutable<TuningFlags>;
};

function buildDefaults(): MutableTuning {
  return {
    skater: { ...SKATER_MOVEMENT_CONFIG },
    stick: { ...STICK_CONFIG },
    gestures: { ...GESTURE_CONFIG },
    puck: { ...PUCK_CONFIG },
    check: { ...CHECK_CONFIG },
    collision: { ...COLLISION_CONFIG },
    goalie: { ...GOALIE_CONFIG },
    // Grounded-arcade scope: powerups and character specials are cut from
    // the roadmap; the systems stay in code but never activate.
    flags: {
      powerupsEnabled: false,
      specialsEnabled: false
    }
  };
}

function deepFreeze(tuning: MutableTuning): Tuning {
  for (const values of Object.values(tuning)) {
    Object.freeze(values);
  }

  return Object.freeze(tuning);
}

/** Shipped baseline values. Frozen — tuned values get pasted back here. */
export const DEFAULT_TUNING: Tuning = deepFreeze(buildDefaults());

/** Live values read by the sim each tick. Mutate via the dev tuning panel. */
export const TUNING: MutableTuning = buildDefaults();

/** Restore every live value to the shipped baseline. */
export function resetTuning(): void {
  const defaults = buildDefaults();

  for (const group of Object.keys(defaults) as (keyof MutableTuning)[]) {
    Object.assign(TUNING[group], defaults[group]);
  }
}

/** Deep copy of the live values, e.g. for export from the tuning panel. */
export function snapshotTuning(): Tuning {
  return {
    skater: { ...TUNING.skater },
    stick: { ...TUNING.stick },
    gestures: { ...TUNING.gestures },
    puck: { ...TUNING.puck },
    check: { ...TUNING.check },
    collision: { ...TUNING.collision },
    goalie: { ...TUNING.goalie },
    flags: { ...TUNING.flags }
  };
}

/** Merge partial overrides (e.g. a saved preset) into the live values. */
export function applyTuning(overrides: {
  [Group in keyof Tuning]?: Partial<Tuning[Group]>;
}): void {
  for (const group of Object.keys(overrides) as (keyof Tuning)[]) {
    const values = overrides[group];

    if (values && group in TUNING) {
      Object.assign(TUNING[group], values);
    }
  }
}
