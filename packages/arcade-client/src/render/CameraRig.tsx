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

export function computeCameraPosition(
  target: Vec2,
  punchIn = false
): { readonly x: number; readonly y: number; readonly z: number } {
  const scale = punchIn ? 0.84 : 1;

  return {
    x: Math.round(target.x - 480 * scale),
    y: Math.round(1180 * scale),
    z: Math.round(target.y + 480 * scale)
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
