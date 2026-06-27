import { PUCK_CONFIG, type PuckState, type SkaterEntity } from "@bbh/arcade-core";

export interface PuckProps {
  readonly puck: PuckState;
}

export function Puck({ puck }: PuckProps): JSX.Element {
  return (
    <mesh
      position={[puck.position.x, puck.carrierSlotId ? 22 : 12, puck.position.y]}
      name="puck"
    >
      <sphereGeometry args={[18, 16, 10]} />
      <meshStandardMaterial
        color={puck.carrierSlotId ? "#171717" : "#2b2f36"}
        emissive={puck.isChargedShot ? "#ffdf6e" : "#000000"}
        emissiveIntensity={puck.isChargedShot ? 0.45 : 0}
      />
    </mesh>
  );
}

export function predictedCarriedPuck(
  puck: PuckState,
  predictedCarrier: SkaterEntity | null
): PuckState {
  if (!predictedCarrier || puck.carrierSlotId !== predictedCarrier.id) {
    return puck;
  }

  return {
    ...puck,
    position: {
      x: predictedCarrier.position.x + PUCK_CONFIG.carryOffset,
      y: predictedCarrier.position.y
    }
  };
}
