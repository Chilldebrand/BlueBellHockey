import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Vec2 } from "@bbh/arcade-core";
import { applyArrowPlacement, placeEdgeArrow } from "./offscreenArrows.js";

export interface TrackedSkater {
  readonly id: string;
  /** Interpolated/predicted render position in sim space. */
  readonly position: Vec2;
}

export interface OffscreenArrowTrackerProps {
  readonly skaters: readonly TrackedSkater[];
  readonly enabled: boolean;
}

const projected = new Vector3();

/**
 * Lives inside the Canvas (needs the live camera), renders nothing: each
 * frame it projects every skater to NDC and imperatively positions the DOM
 * arrows registered by OffscreenArrowLayer.
 */
export function OffscreenArrowTracker({
  skaters,
  enabled
}: OffscreenArrowTrackerProps): null {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useFrame(() => {
    for (const skater of skaters) {
      if (!enabled) {
        applyArrowPlacement(skater.id, {
          visible: false,
          x: 0,
          y: 0,
          angleRad: 0
        });
        continue;
      }

      projected.set(skater.position.x, 0, skater.position.y).project(camera);
      applyArrowPlacement(
        skater.id,
        placeEdgeArrow(projected.x, projected.y, size.width, size.height)
      );
    }
  });

  return null;
}
