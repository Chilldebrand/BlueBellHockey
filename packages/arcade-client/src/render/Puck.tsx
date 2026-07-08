import { bladeWorldPosition, type PuckState, type SkaterEntity } from "@bbh/arcade-core";

export interface PuckProps {
  readonly puck: PuckState;
}

export function Puck({ puck }: PuckProps): JSX.Element {
  return (
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
