import { Canvas } from "@react-three/fiber";
import {
  bladeBodyOffset,
  type PuckState,
  type SkaterEntity,
  type WorldState
} from "@bbh/arcade-core";
import { interpolateSkaters } from "../game/interpolation.js";
import { selectGoalieAnimation } from "./animation/goalieAnimation.js";
import { selectSkaterAnimation } from "./animation/skaterAnimation.js";
import { CameraRig } from "./CameraRig.js";
import { GoalieModel } from "./GoalieModel.js";
import { Puck, predictedCarriedPuck } from "./Puck.js";
import { Powerups } from "./Powerups.js";
import { Rink } from "./Rink.js";
import { SkaterDebug } from "./SkaterDebug.js";
import { Vfx } from "./Vfx.js";

export interface SceneProps {
  readonly currentWorld: WorldState | null;
  readonly previousWorld: WorldState | null;
  readonly localSlotId: string | null;
  readonly predictedLocalSkater: SkaterEntity | null;
  /** Fully replayed local puck (tether prediction); overrides the blade snap. */
  readonly predictedPuck?: PuckState | null;
  /** Feel-lab overlays: velocity vectors and other sim diagnostics. */
  readonly debugOverlays?: boolean;
}

export function Scene({
  currentWorld,
  previousWorld,
  localSlotId,
  predictedLocalSkater,
  predictedPuck = null,
  debugOverlays = false
}: SceneProps): JSX.Element | null {
  if (!currentWorld) {
    return null;
  }

  const skaters = interpolateSkaters(previousWorld, currentWorld, 0.75, localSlotId);
  const renderedPuck =
    predictedPuck ??
    predictedCarriedPuck(currentWorld.puck, predictedLocalSkater);

  return (
    <section className="arcade-rink-shell" aria-label="Arcade rink debug view">
      <Canvas
        shadows
        camera={{
          position: [520, 1180, 980],
          fov: 44,
          near: 0.1,
          far: 3000
        }}
      >
        <CameraRig
          puck={renderedPuck.position}
          events={currentWorld.eventQueue}
          nowMs={currentWorld.time.nowMs}
        />
        <ambientLight intensity={0.95} />
        <directionalLight position={[320, 900, 460]} intensity={1.25} castShadow />
        <Rink />
        <Powerups pickups={currentWorld.powerupPickups} />
        {skaters.map((skater) => {
          const renderSkater =
            skater.id === localSlotId && predictedLocalSkater
              ? predictedLocalSkater
              : skater;
          const sourceSkater =
            currentWorld.skaters.find((candidate) => candidate.id === skater.id) ??
            currentWorld.skaters[0];

          return (
            <SkaterDebug
              key={skater.id}
              id={skater.id}
              teamId={skater.teamId}
              position={renderSkater.position}
              isLocal={skater.id === localSlotId}
              hasPossession={currentWorld.puck.carrierSlotId === skater.id}
              velocity={renderSkater.velocity}
              facing={renderSkater.facing}
              bladeOffset={bladeBodyOffset(sourceSkater)}
              showVectors={debugOverlays}
              animationState={selectSkaterAnimation({
                skater: sourceSkater,
                puck: currentWorld.puck,
                events: currentWorld.eventQueue,
                nowMs: currentWorld.time.nowMs
              })}
            />
          );
        })}
        {currentWorld.goalies.map((goalie) => (
          <group
            key={goalie.id}
            name={goalie.id}
            position={[goalie.position.x, 10, goalie.position.y]}
            scale={1.5}
          >
            <GoalieModel
              teamId={goalie.teamId}
              animationState={selectGoalieAnimation({
                goalie,
                events: currentWorld.eventQueue,
                nowMs: currentWorld.time.nowMs
              })}
            />
          </group>
        ))}
        <Puck puck={renderedPuck} />
        <Vfx events={currentWorld.eventQueue} />
      </Canvas>
    </section>
  );
}
