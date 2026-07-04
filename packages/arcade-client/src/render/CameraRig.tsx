import { useFrame, useThree } from "@react-three/fiber";
import { RINK_CONFIG, type Vec2, type WorldEvent } from "@bbh/arcade-core";

export interface CameraTargetInput {
  readonly puck: Vec2;
  readonly rink?: {
    readonly width: number;
    readonly height: number;
  };
}

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
 *
 * Framing calibrated against 3-on-3 NHL Arcade: roughly half the rink length
 * in frame and players ~1/5 of screen height, so the ice reads compact and
 * the characters read big.
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

export function shouldPunchIn(events: readonly WorldEvent[]): boolean {
  return events
    .slice(-3)
    .some((event) => event.type === "goal" || event.type === "knockdown");
}

export function CameraRig({
  puck,
  events
}: {
  readonly puck: Vec2;
  readonly events: readonly WorldEvent[];
}): null {
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    const target = computeCameraTarget({ puck });
    const position = computeCameraPosition(target, shouldPunchIn(events));
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(target.x, 0, target.y);
    camera.updateProjectionMatrix();
  });

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
