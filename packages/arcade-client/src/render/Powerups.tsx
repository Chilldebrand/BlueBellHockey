import type { PowerupPickup } from "@bbh/arcade-core";

export function Powerups({
  pickups
}: {
  readonly pickups: readonly PowerupPickup[];
}): JSX.Element {
  return (
    <>
      {pickups.map((pickup) => (
        <mesh
          key={pickup.id}
          name={`powerup:${pickup.type}`}
          position={[pickup.position.x, 18, pickup.position.y]}
        >
          <octahedronGeometry args={[22, 0]} />
          <meshStandardMaterial color={colorForPowerup(pickup.type)} emissive={colorForPowerup(pickup.type)} emissiveIntensity={0.25} />
        </mesh>
      ))}
    </>
  );
}

function colorForPowerup(type: string): string {
  switch (type) {
    case "hard-shot":
      return "#ffdf6e";
    case "goalie-freeze":
      return "#8ee9ff";
    case "puck-magnet":
      return "#c084fc";
    case "shield":
      return "#72f1d1";
    case "instant-special":
      return "#ff7ad9";
    case "speed-boost":
    default:
      return "#7dd3fc";
  }
}
