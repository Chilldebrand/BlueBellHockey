import { Canvas } from "@react-three/fiber";
import {
  bladeBodyOffset,
  goalieSizeMultiplier,
  TUNING,
  type PuckState,
  type SkaterEntity,
  type WorldState
} from "@bbh/arcade-core";
import { interpolateSkaters } from "../game/interpolation.js";
import { selectGoalieAnimation } from "./animation/goalieAnimation.js";
import { selectSkaterAnimation } from "./animation/skaterAnimation.js";
import { CameraRig } from "./CameraRig.js";
import { GoalieModel } from "./GoalieModel.js";
import { Puck, pocketCarriedPuck, predictedCarriedPuck } from "./Puck.js";
import { BananaPeels, Powerups } from "./Powerups.js";
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
  /**
   * Human identity color per CURRENTLY-controlled slot (from the roster).
   * Slots not in the map are AI-controlled and render no disc.
   */
  readonly highlightColorBySlotId?: Readonly<Record<string, string>>;
  /** Feel-lab overlays: velocity vectors and other sim diagnostics. */
  readonly debugOverlays?: boolean;
}

export function Scene({
  currentWorld,
  previousWorld,
  localSlotId,
  predictedLocalSkater,
  predictedPuck = null,
  highlightColorBySlotId = {},
  debugOverlays = false
}: SceneProps): JSX.Element | null {
  if (!currentWorld) {
    return null;
  }

  const skaters = interpolateSkaters(previousWorld, currentWorld, 0.75, localSlotId);
  // Prefer the reconciled local skater when it's the carrier (no net lag),
  // otherwise the authoritative carrier — so the blade pocket works in Free
  // Skate (no predicted local skater) as well as online.
  const localIsCarrier =
    predictedLocalSkater !== null &&
    predictedLocalSkater.id === currentWorld.puck.carrierSlotId;
  const puckCarrier = localIsCarrier
    ? predictedLocalSkater
    : currentWorld.skaters.find(
        (skater) => skater.id === currentWorld.puck.carrierSlotId
      ) ?? null;
  // Carried by the local player: pin the puck to the RENDERED skater's blade
  // (the smoothed prediction) exactly like remote carriers get the sim tether
  // against their rendered body — using the raw predicted puck here makes it
  // lead the smoothed blade and float out front. The raw predicted puck still
  // wins for everything else (loose-puck tether prediction, shots).
  const renderedPuck = pocketCarriedPuck(
    localIsCarrier
      ? predictedCarriedPuck(
          currentWorld.puck,
          predictedLocalSkater,
          currentWorld.time.nowMs
        )
      : predictedPuck ?? currentWorld.puck,
    puckCarrier
  );

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
        <CameraRig puck={renderedPuck.position} />
        <ambientLight intensity={0.95} />
        <directionalLight position={[320, 900, 460]} intensity={1.25} castShadow />
        <Rink />
        <Powerups pickups={currentWorld.powerupPickups} />
        <BananaPeels peels={currentWorld.bananaPeels} />
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
              characterId={skater.characterId}
              position={renderSkater.position}
              isLocal={skater.id === localSlotId}
              highlightColor={highlightColorBySlotId[skater.id] ?? null}
              velocity={renderSkater.velocity}
              facing={renderSkater.facing}
              bladeOffset={bladeBodyOffset(
                sourceSkater,
                TUNING.stick,
                currentWorld.time.nowMs
              )}
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
            // The goalie model faces +Z locally, but goalies face center ice
            // down the X goal-axis: home defends the -X end (faces +X), away
            // defends the +X end (faces -X). So each turns 90 deg toward center.
            rotation={[0, goalie.teamId === "home" ? Math.PI / 2 : -Math.PI / 2, 0]}
            // Base 1.5 render scale, grown/shrunk by active Giant/Mini goalie
            // powerups — the same multiplier the sim uses for save reach.
            scale={1.5 * goalieSizeMultiplier(currentWorld, goalie.teamId)}
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
