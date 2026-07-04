import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RINK_CONFIG, type Vec2, type WorldEvent } from "@bbh/arcade-core";

export interface CameraTargetInput {
  readonly puck: Vec2;
  readonly rink?: {
    readonly width: number;
    readonly height: number;
  };
}

/** How long a goal/knockdown punches the camera in, from the event moment. */
const PUNCH_IN_WINDOW_MS = 1100;
/** Per-second exponential smoothing rate for all camera motion. */
const CAMERA_SMOOTHING = 5.5;

export function computeCameraTarget({
  puck,
  rink = RINK_CONFIG
}: CameraTargetInput): Vec2 {
  return {
    x: clamp(puck.x, 220, rink.width - 220),
    y: clamp(puck.y, 220, rink.height - 220)
  };
}

/**
 * North-south presentation: the camera sits behind the home goal line side
 * (-x of the target) looking up-ice, so sim +x — home's attacking direction —
 * is up-screen and the goals are top and bottom.
 */
export function computeCameraPosition(
  target: Vec2,
  punchIn = false
): { readonly x: number; readonly y: number; readonly z: number } {
  const scale = punchIn ? 0.84 : 1;

  return {
    x: Math.round(target.x - 520 * scale),
    y: Math.round(860 * scale),
    z: Math.round(target.y)
  };
}

/**
 * Punch in for a short, fixed window after the moment of a goal or knockdown.
 * Strictly time-based: queue position must not matter, or the zoom flickers
 * as later events (shots, saves, pokes) churn past the trigger.
 */
export function shouldPunchIn(
  events: readonly WorldEvent[],
  nowMs: number
): boolean {
  return events.some(
    (event) =>
      (event.type === "goal" || event.type === "knockdown") &&
      nowMs - event.atMs >= 0 &&
      nowMs - event.atMs <= PUNCH_IN_WINDOW_MS
  );
}

export function CameraRig({
  puck,
  events,
  nowMs
}: {
  readonly puck: Vec2;
  readonly events: readonly WorldEvent[];
  readonly nowMs: number;
}): null {
  const camera = useThree((state) => state.camera);
  const smoothedPosition = useRef<{ x: number; y: number; z: number } | null>(null);
  const smoothedTarget = useRef<Vec2 | null>(null);

  useFrame((_state, delta) => {
    const target = computeCameraTarget({ puck });
    const position = computeCameraPosition(target, shouldPunchIn(events, nowMs));

    // Ease everything — follow, punch-in, and punch-out — so the camera
    // never snaps between framings.
    const blend = 1 - Math.exp(-CAMERA_SMOOTHING * Math.min(delta, 0.1));
    const previousPosition = smoothedPosition.current ?? position;
    const previousTarget = smoothedTarget.current ?? target;
    smoothedPosition.current = {
      x: previousPosition.x + (position.x - previousPosition.x) * blend,
      y: previousPosition.y + (position.y - previousPosition.y) * blend,
      z: previousPosition.z + (position.z - previousPosition.z) * blend
    };
    smoothedTarget.current = {
      x: previousTarget.x + (target.x - previousTarget.x) * blend,
      y: previousTarget.y + (target.y - previousTarget.y) * blend
    };

    camera.position.set(
      smoothedPosition.current.x,
      smoothedPosition.current.y,
      smoothedPosition.current.z
    );
    camera.lookAt(smoothedTarget.current.x, 0, smoothedTarget.current.y);
    camera.updateProjectionMatrix();
  });

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
