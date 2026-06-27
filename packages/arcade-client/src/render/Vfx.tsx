import type { WorldEvent } from "@bbh/arcade-core";

export interface VfxProps {
  readonly events: readonly WorldEvent[];
}

const EVENT_LABELS: Record<string, string> = {
  hit: "Hit",
  stumble: "Stumble",
  knockdown: "Knockdown"
};

export function Vfx({ events }: VfxProps): JSX.Element | null {
  const visibleEvents = events.filter((event) => EVENT_LABELS[event.type]);

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <group name="event-vfx">
      {visibleEvents.slice(-4).map((event, index) => (
        <mesh
          key={event.id}
          position={[120 + index * 90, 40 + index * 16, 80]}
          name={`event-${event.type}`}
        >
          <boxGeometry args={[64, 12, 20]} />
          <meshStandardMaterial
            color={event.type === "knockdown" ? "#ffdf6e" : "#ffffff"}
            emissive={event.type === "hit" ? "#ff4f5e" : "#1f8fff"}
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}
