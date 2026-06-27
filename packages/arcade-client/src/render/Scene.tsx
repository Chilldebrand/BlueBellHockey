import { Canvas } from "@react-three/fiber";
import { RINK_CONFIG, type SkaterEntity, type WorldState } from "@bbh/arcade-core";
import { interpolateSkaters } from "../game/interpolation.js";
import { SkaterDebug } from "./SkaterDebug.js";

export interface SceneProps {
  readonly currentWorld: WorldState | null;
  readonly previousWorld: WorldState | null;
  readonly localSlotId: string | null;
  readonly predictedLocalSkater: SkaterEntity | null;
}

export function Scene({
  currentWorld,
  previousWorld,
  localSlotId,
  predictedLocalSkater
}: SceneProps): JSX.Element | null {
  if (!currentWorld) {
    return null;
  }

  const skaters = interpolateSkaters(previousWorld, currentWorld, 0.75, localSlotId);

  return (
    <section aria-label="Arcade rink debug view" style={{ height: 360 }}>
      <Canvas
        orthographic
        camera={{
          position: [RINK_CONFIG.width / 2, 1400, RINK_CONFIG.height / 2],
          zoom: 0.45,
          near: 0.1,
          far: 3000
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[0, 600, 400]} intensity={1.1} />
        <mesh
          position={[RINK_CONFIG.width / 2, 0, RINK_CONFIG.height / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[RINK_CONFIG.width, RINK_CONFIG.height]} />
          <meshStandardMaterial color="#dcecf7" />
        </mesh>
        {skaters.map((skater) => {
          const renderSkater =
            skater.id === localSlotId && predictedLocalSkater
              ? predictedLocalSkater
              : skater;

          return (
            <SkaterDebug
              key={skater.id}
              id={skater.id}
              teamId={skater.teamId}
              position={renderSkater.position}
              isLocal={skater.id === localSlotId}
            />
          );
        })}
      </Canvas>
    </section>
  );
}
