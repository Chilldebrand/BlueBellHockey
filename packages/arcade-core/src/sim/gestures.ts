import type { GestureState, InputFrame, SkaterEntity } from "./types.js";
import { clamp } from "./physics.js";

export interface GestureConfig {
  /** Stick magnitude below this is neutral (no handling). */
  readonly neutralZone: number;
  /** Back-depth (stickY below -this) that arms a slap windup. */
  readonly windupDepthMin: number;
  /** Forward flick speed (stick units/s) that fires a wrist shot. */
  readonly wristFlickSpeed: number;
  /** Flick speed at which wrist power caps at 1. */
  readonly wristMaxFlickSpeed: number;
  /** Stick must end at least this far forward for a wrist release. */
  readonly wristReleaseZone: number;
  /** Forward flick speed that fires the slap out of a windup. */
  readonly slapFlickSpeed: number;
  /** Crossing this forward position ends a windup (fires or whiffs). */
  readonly slapReleaseZone: number;
  /** Held windup time at which the charge contribution caps. */
  readonly slapMaxChargeMs: number;
  /** Minimum normalized power of any slap that fires. */
  readonly slapMinPower: number;
  /** Refractory period after any release. */
  readonly releaseCooldownMs: number;
}

export const GESTURE_CONFIG: GestureConfig = {
  neutralZone: 0.15,
  windupDepthMin: 0.42,
  wristFlickSpeed: 8,
  wristMaxFlickSpeed: 26,
  wristReleaseZone: 0.5,
  slapFlickSpeed: 6,
  slapReleaseZone: 0.12,
  slapMaxChargeMs: 750,
  slapMinPower: 0.35,
  releaseCooldownMs: 320
};

export function createGestureState(): GestureState {
  return {
    phase: "neutral",
    windupStartMs: 0,
    windupDepth: 0,
    prevStickX: 0,
    prevStickY: 0,
    cooldownUntilMs: 0,
    pendingReleaseType: "none",
    pendingReleasePower: 0,
    pendingReleaseSide: 0
  };
}

/**
 * Skill-stick gesture detection over raw stick samples, one sample per tick.
 * Runs identically on server and predicting client (all state lives on the
 * skater). Flick forward = wrist shot; pull back beyond the windup depth,
 * then flick forward = slap shot whose power scales with depth and hold time.
 * Anything slower is stickhandling — the blade just follows the stick.
 */
export function stepGesture(
  skater: SkaterEntity,
  input: InputFrame | undefined,
  nowMs: number,
  dt: number,
  config: GestureConfig = GESTURE_CONFIG
): void {
  const gesture = skater.gesture;
  const stickX = clamp(input?.stickX ?? 0, -1, 1);
  const stickY = clamp(input?.stickY ?? 0, -1, 1);
  const flickSpeed = dt > 0 ? (stickY - gesture.prevStickY) / dt : 0;
  const canRelease = nowMs >= gesture.cooldownUntilMs;

  if (gesture.phase === "windup") {
    if (stickY < 0) {
      gesture.windupDepth = Math.max(gesture.windupDepth, -stickY);
    }

    if (stickY > config.slapReleaseZone) {
      if (canRelease && flickSpeed > config.slapFlickSpeed) {
        const held = nowMs - gesture.windupStartMs;
        const charge = clamp(held / config.slapMaxChargeMs, 0, 1);
        const power = clamp(
          gesture.windupDepth * 0.55 + charge * 0.45,
          config.slapMinPower,
          1
        );
        latchRelease(gesture, "slap", power, stickX, nowMs, config);
      }

      // Forward again: the windup is over whether it fired or whiffed.
      gesture.phase = "neutral";
      gesture.windupStartMs = 0;
      gesture.windupDepth = 0;
    }
  } else {
    if (stickY < -config.windupDepthMin) {
      gesture.phase = "windup";
      gesture.windupStartMs = nowMs;
      gesture.windupDepth = -stickY;
    } else if (
      canRelease &&
      flickSpeed > config.wristFlickSpeed &&
      stickY > config.wristReleaseZone
    ) {
      const power = clamp(
        flickSpeed / config.wristMaxFlickSpeed,
        0.55,
        1
      );
      latchRelease(gesture, "wrist", power, stickX, nowMs, config);
      gesture.phase = "neutral";
    } else {
      gesture.phase =
        Math.hypot(stickX, stickY) > config.neutralZone ? "handling" : "neutral";
    }
  }

  gesture.prevStickX = stickX;
  gesture.prevStickY = stickY;
}

/** Clear a pending release after the puck step consumed (or ignored) it. */
export function clearPendingRelease(gesture: GestureState): void {
  gesture.pendingReleaseType = "none";
  gesture.pendingReleasePower = 0;
  gesture.pendingReleaseSide = 0;
}

function latchRelease(
  gesture: GestureState,
  type: "wrist" | "slap",
  power: number,
  side: number,
  nowMs: number,
  config: GestureConfig
): void {
  gesture.pendingReleaseType = type;
  gesture.pendingReleasePower = power;
  gesture.pendingReleaseSide = side;
  gesture.cooldownUntilMs = nowMs + config.releaseCooldownMs;
}
