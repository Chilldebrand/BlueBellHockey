import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RINK_CONFIG, type Vec2 } from "@bbh/arcade-core";

export interface CameraTargetInput {
  /**
   * Follow point: the carrier's body while the puck is carried (a carried
   * puck hops between blade and feet on windups/dangles — following it
   * directly reads as camera shake), otherwise the puck itself.
   */
  readonly puck: Vec2;
  readonly rink?: {
    readonly width: number;
    readonly height: number;
  };
}

/** Per-second exponential smoothing rate for camera follow. */
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
 * is up-screen and the goals are top and bottom. Height and distance are
 * FIXED — the camera translates to follow the puck but never zooms.
 */
export function computeCameraPosition(target: Vec2): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  // Playtest 2026-07-23: pulled back 5% (760/940 → 798/987) to show more ice.
  return {
    x: Math.round(target.x - 798),
    y: 987,
    z: Math.round(target.y)
  };
}

export function CameraRig({ puck }: { readonly puck: Vec2 }): null {
  const camera = useThree((state) => state.camera);
  const smoothedPosition = useRef<{ x: number; y: number; z: number } | null>(null);
  const smoothedTarget = useRef<Vec2 | null>(null);

  useFrame((_state, delta) => {
    const target = computeCameraTarget({ puck });
    const position = computeCameraPosition(target);

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
