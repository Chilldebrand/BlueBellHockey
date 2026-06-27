import type { WorldEvent } from "@bbh/arcade-core";

export interface VfxProps {
  readonly events: readonly WorldEvent[];
}

const EVENT_LABELS: Record<string, string> = {
  hit: "Hit",
  stumble: "Stumble",
  knockdown: "Knockdown",
  powerupPickup: "Powerup",
  powerupUse: "Use",
  specialUse: "Special"
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
            color={eventColor(event.type)}
            emissive={event.type === "hit" ? "#ff4f5e" : eventColor(event.type)}
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

function eventColor(type: string): string {
  switch (type) {
    case "knockdown":
      return "#ffdf6e";
    case "powerupPickup":
    case "powerupUse":
      return "#72f1d1";
    case "specialUse":
      return "#ff7ad9";
    default:
      return "#ffffff";
  }
}
