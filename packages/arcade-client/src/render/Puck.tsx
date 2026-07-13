import { bladeWorldPosition, type PuckState, type SkaterEntity } from "@bbh/arcade-core";

export interface PuckProps {
  readonly puck: PuckState;
}

// Shadow tuning against the sim's shot arcs (wrist/slap peak ~50-70,
// GOAL_HEIGHT 95): grounded pucks get a tight dark blob, airborne pucks leave
// a shrinking, fading blob on the ice — the widening gap is the lift cue.
const SHADOW_RADIUS = 11;
const SHADOW_MAX_HEIGHT = 95;
const SHADOW_MIN_SCALE = 0.45;
const SHADOW_MAX_OPACITY = 0.42;
const SHADOW_MIN_OPACITY = 0.12;

/**
 * Ground-shadow look for a puck at the given height: full-size and darkest on
 * the ice, smaller and fainter the higher the puck flies. Pure math so tests
 * can assert the curve.
 */
export function puckShadowAppearance(height: number): {
  readonly scale: number;
  readonly opacity: number;
} {
  const lift = Math.min(Math.max(height, 0) / SHADOW_MAX_HEIGHT, 1);
  return {
    scale: 1 - (1 - SHADOW_MIN_SCALE) * lift,
    opacity:
      SHADOW_MAX_OPACITY - (SHADOW_MAX_OPACITY - SHADOW_MIN_OPACITY) * lift
  };
}

export function Puck({ puck }: PuckProps): JSX.Element {
  const shadow = puckShadowAppearance(puck.height);

  return (
    <group>
      <mesh
        position={[
          puck.position.x,
          (puck.carrierSlotId ? 22 : 12) + puck.height,
          puck.position.y
        ]}
        name="puck"
      >
        <sphereGeometry args={[9, 16, 10]} />
        <meshStandardMaterial color={puck.carrierSlotId ? "#171717" : "#2b2f36"} />
      </mesh>
      {/* Blob shadow pinned to the ice under the puck: the gap between puck
          and shadow is what makes wrist/slap lift readable. */}
      <mesh
        position={[puck.position.x, 1.2, puck.position.y]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={shadow.scale}
        name="puck-shadow"
      >
        <circleGeometry args={[SHADOW_RADIUS, 20]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={shadow.opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function predictedCarriedPuck(
  puck: PuckState,
  predictedCarrier: SkaterEntity | null,
  nowMs = 0
): PuckState {
  if (!predictedCarrier || puck.carrierSlotId !== predictedCarrier.id) {
    return puck;
  }

  // Snap the locally-carried puck to the predicted carrier's blade so it
  // doesn't trail a network tick behind the player's own stick. nowMs matters:
  // without it an expired poke lunge reads as active forever and the puck
  // floats ahead of the blade.
  return {
    ...puck,
    position: bladeWorldPosition(predictedCarrier, undefined, nowMs)
  };
}

// Ride a carried puck a little way along the blade toward its middle (body
// space: +forward, +right-of-facing) so it sits in the pocket rather than at
// the heel by the shaft. Visual only, applied on top of whatever base position
// (Free Skate sim tether or the online blade snap).
const POCKET_FORWARD = 1.5;
const POCKET_RIGHT = 13;

export function pocketCarriedPuck(
  puck: PuckState,
  carrier: SkaterEntity | null
): PuckState {
  if (!carrier || puck.carrierSlotId !== carrier.id) {
    return puck;
  }

  const cos = Math.cos(carrier.facing);
  const sin = Math.sin(carrier.facing);
  return {
    ...puck,
    position: {
      x: puck.position.x + POCKET_FORWARD * cos - POCKET_RIGHT * sin,
      y: puck.position.y + POCKET_FORWARD * sin + POCKET_RIGHT * cos
    }
  };
}
