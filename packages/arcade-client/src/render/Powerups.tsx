import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, type Group } from "three";
import type { BananaPeel, PowerupPickup } from "@bbh/arcade-core";

/**
 * On-ice powerup pickups, each drawn as a themed procedural icon (rocket for
 * speed, barbell for Big Hit, snowflake for Freeze, ...) so the effect reads at
 * a glance instead of by color alone. Everything is primitive geometry to match
 * the blockout-body house style.
 */
export function Powerups({
  pickups
}: {
  readonly pickups: readonly PowerupPickup[];
}): JSX.Element {
  return (
    <>
      {pickups.map((pickup) => (
        <FloatingIcon
          key={pickup.id}
          position={[pickup.position.x, 20, pickup.position.y]}
        >
          <PowerupIcon type={pickup.type} />
        </FloatingIcon>
      ))}
    </>
  );
}

/** Banana peel hazards resting flat on the ice (not collectible). */
export function BananaPeels({
  peels
}: {
  readonly peels: readonly BananaPeel[];
}): JSX.Element {
  return (
    <>
      {peels.map((peel) => (
        <group
          key={peel.id}
          name={`banana:${peel.id}`}
          position={[peel.position.x, 3, peel.position.y]}
        >
          <BananaPeelModel />
        </group>
      ))}
    </>
  );
}

// Slow hover + spin so pickups catch the eye. Imperative (no re-renders), same
// pattern as the skater leg stride.
function FloatingIcon({
  position,
  children
}: {
  readonly position: [number, number, number];
  readonly children: React.ReactNode;
}): JSX.Element {
  const ref = useRef<Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame((_state, delta) => {
    const group = ref.current;
    if (!group) {
      return;
    }
    phase.current += delta;
    group.rotation.y += delta * 1.4;
    group.position.y = position[1] + Math.sin(phase.current * 2) * 3;
  });

  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

function PowerupIcon({ type }: { readonly type: string }): JSX.Element {
  switch (type) {
    case "speed-boost":
      return <RocketIcon />;
    case "hard-shot":
      return <HardShotIcon />;
    case "freeze":
      return <SnowflakeIcon />;
    case "bulldozer":
      return <BarbellIcon />;
    case "mini-goalie":
      return <GoalieMaskIcon scale={0.62} color="#a3e635" />;
    case "giant-goalie":
      return <GoalieMaskIcon scale={1.15} color="#f472b6" />;
    default:
      return <RocketIcon />;
  }
}

// A little rocket: nose cone up, body, fins, and a flame beneath.
function RocketIcon(): JSX.Element {
  return (
    <group scale={1.1}>
      <mesh position={[0, 8, 0]}>
        <coneGeometry args={[6, 12, 16]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, -2, 0]}>
        <cylinderGeometry args={[6, 6, 10, 16]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={0.35} />
      </mesh>
      {/* Fins */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[0, -7, 0]}
          rotation={[0, (i * Math.PI * 2) / 3, 0.4]}
        >
          <boxGeometry args={[1.2, 6, 5]} />
          <meshStandardMaterial color="#0ea5e9" />
        </mesh>
      ))}
      {/* Flame */}
      <mesh position={[0, -12, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[4, 8, 12]} />
        <meshStandardMaterial color="#ffb703" emissive="#ff7a00" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

// A flaming puck: a dark disc with a rising flame — a hot shot.
function HardShotIcon(): JSX.Element {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[8, 8, 4, 24]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} />
      </mesh>
      <mesh position={[0, 8, 0]}>
        <coneGeometry args={[6, 12, 14]} />
        <meshStandardMaterial
          color="#ffdf6e"
          emissive="#ff9d00"
          emissiveIntensity={0.9}
        />
      </mesh>
    </group>
  );
}

// A 6-armed snowflake from crossed thin bars.
function SnowflakeIcon(): JSX.Element {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
          <boxGeometry args={[18, 1.6, 1.6]} />
          <meshStandardMaterial
            color="#e0f7ff"
            emissive="#8ee9ff"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      <mesh>
        <icosahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial color="#bfe9ff" emissive="#8ee9ff" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

// A barbell: a bar with two weight discs — the Big Hit.
function BarbellIcon(): JSX.Element {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[1.6, 1.6, 20, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.35} />
      </mesh>
      {[-8, 8].map((y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh>
            <cylinderGeometry args={[6, 6, 4, 20]} />
            <meshStandardMaterial color="#ff9d4d" emissive="#ff7a1a" emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// A goalie mask: rounded shell with a cage. Scaled small (mini) or large (giant).
function GoalieMaskIcon({
  scale,
  color
}: {
  readonly scale: number;
  readonly color: string;
}): JSX.Element {
  return (
    <group scale={scale * 11}>
      <mesh>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} roughness={0.4} />
      </mesh>
      {/* Cage bars across the face (+Z). */}
      {[-0.5, 0, 0.5].map((offset) => (
        <mesh key={offset} position={[offset, 0, 0.92]}>
          <boxGeometry args={[0.12, 1.5, 0.12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      ))}
      {[-0.4, 0.2].map((offset) => (
        <mesh key={offset} position={[0, offset, 0.92]}>
          <boxGeometry args={[1.5, 0.12, 0.12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      ))}
    </group>
  );
}

// A banana peel: a yellow C-curve (torus arc) lying flat, with browned tips.
function BananaPeelModel(): JSX.Element {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <torusGeometry args={[12, 3.6, 10, 24, Math.PI * 1.25]} />
        <meshStandardMaterial color="#facc15" roughness={0.5} side={DoubleSide} />
      </mesh>
      {/* A couple of drooping peel flaps for silhouette. */}
      <mesh position={[12, 0, 0]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[3.4, 12, 10, 1, true]} />
        <meshStandardMaterial color="#fde047" roughness={0.55} side={DoubleSide} />
      </mesh>
      <mesh position={[-8.5, 8.5, 0]} rotation={[0, 0, 0.7]}>
        <coneGeometry args={[3.2, 11, 10, 1, true]} />
        <meshStandardMaterial color="#eab308" roughness={0.55} side={DoubleSide} />
      </mesh>
      {/* Brown stem tip. */}
      <mesh position={[-9, -9, 0]}>
        <sphereGeometry args={[2.2, 8, 8]} />
        <meshStandardMaterial color="#6b4f1d" roughness={0.7} />
      </mesh>
    </group>
  );
}
