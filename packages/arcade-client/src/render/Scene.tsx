import { Canvas } from "@react-three/fiber";
import {
  bladeBodyOffset,
  goalieSizeMultiplier,
  teamIdentityFor,
  TUNING,
  type PuckState,
  type SkaterEntity,
  type TeamId,
  type TeamIdentity,
  type TeamIdentityId,
  type WorldState
} from "@bbh/arcade-core";
import { interpolateSkaters } from "../game/interpolation.js";
import { activeBoostTypesForSlot } from "./activeBoosts.js";
import { selectGoalieAnimation } from "./animation/goalieAnimation.js";
import { selectSkaterAnimation } from "./animation/skaterAnimation.js";
import { ArenaShell } from "./ArenaShell.js";
import { CameraRig } from "./CameraRig.js";
import { GoalieModel } from "./GoalieModel.js";
import { OffscreenArrowLayer } from "./OffscreenArrowLayer.js";
import { OffscreenArrowTracker } from "./OffscreenArrowTracker.js";
import { Puck, pocketCarriedPuck, predictedCarriedPuck } from "./Puck.js";
import { BananaPeels, Powerups } from "./Powerups.js";
import { Rink } from "./Rink.js";
import { SkaterDebug } from "./SkaterDebug.js";
import { Vfx } from "./Vfx.js";
import type { ViewOrientation } from "./viewOrientation.js";

export interface SceneProps {
  readonly currentWorld: WorldState | null;
  readonly previousWorld: WorldState | null;
  readonly localSlotId: string | null;
  /**
   * The goalie the LOCAL human temporarily controls after a covered save, or
   * null. Marks that goalie's identity disc as the local player's.
   */
  readonly localGoalieId?: string | null;
  readonly predictedLocalSkater: SkaterEntity | null;
  /** Fully replayed local puck (tether prediction); overrides the blade snap. */
  readonly predictedPuck?: PuckState | null;
  /**
   * Human identity color per CURRENTLY-controlled entity: skater slots, or a
   * goalie ID while its cover grant is held. Entities not in the map are
   * AI-controlled and render no disc.
   */
  readonly highlightColorByEntityId?: Readonly<Record<string, string>>;
  /** Feel-lab overlays: velocity vectors and other sim diagnostics. */
  readonly debugOverlays?: boolean;
  /**
   * Captain-chosen team identities (uniform skins + arrow colors). Omitted
   * (Free Skate) falls back to the classic blue home vs red away.
   */
  readonly teamIdentities?: Readonly<Record<TeamId, TeamIdentityId>>;
  /**
   * 1 = classic framing (sim +x up-screen, home attacks up); -1 yaws the rig
   * 180 degrees so the AWAY viewer attacks up their own screen too. Local-sim
   * screens (Free Skate, Shootout) are always home and take the default.
   */
  readonly viewOrientation?: ViewOrientation;
  /**
   * Drops the crowd to half density and turns off real-time shadows. Purely
   * local presentation — the sim and the match are identical either way.
   */
  readonly reducedGraphics?: boolean;
}

export function Scene({
  currentWorld,
  previousWorld,
  localSlotId,
  localGoalieId = null,
  predictedLocalSkater,
  predictedPuck = null,
  highlightColorByEntityId = {},
  debugOverlays = false,
  teamIdentities,
  viewOrientation = 1,
  reducedGraphics = false
}: SceneProps): JSX.Element | null {
  if (!currentWorld) {
    return null;
  }

  const identities: Record<TeamId, TeamIdentity> = {
    home: teamIdentityFor("home", teamIdentities?.home),
    away: teamIdentityFor("away", teamIdentities?.away)
  };

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

  // Edge arrows track the same positions the bodies render at.
  const trackedSkaters = skaters.map((skater) => ({
    id: skater.id,
    position: (skater.id === localSlotId && predictedLocalSkater
      ? predictedLocalSkater
      : skater
    ).position
  }));
  // Camera anchor: the carrier's rendered BODY while the puck is carried — a
  // carried puck pops between blade and feet on windup entry/exit (slap parks
  // it at the feet now), and following those pops read as camera shake. Loose
  // pucks and shots keep the puck follow.
  const cameraAnchor = puckCarrier
    ? trackedSkaters.find((skater) => skater.id === puckCarrier.id)?.position ??
      puckCarrier.position
    : renderedPuck.position;
  const arrowsEnabled =
    currentWorld.phase === "playing" &&
    currentWorld.faceoffUntilMs <= currentWorld.time.nowMs;

  return (
    <section className="arcade-rink-shell" aria-label="Arcade rink debug view">
      <Canvas
        // Shadows are the single biggest frame cost here: every casting mesh
        // (bodies, sticks, the whole arena bowl) renders a second time into
        // the shadow map.
        shadows={!reducedGraphics}
        camera={{
          position: [520, 1180, 980],
          fov: 44,
          // near 10 (not 0.1): nothing ever comes within ~400 of the camera
          // (rig height 987, tallest arena structure 560), and a tight near
          // plane is what depth precision lives on — at 0.1 the far half of
          // the scene had only ~2-4 world units of z-resolution.
          near: 10,
          // far must cover the WHOLE arena bowl from the pulled-back camera
          // (worst case ~4200: puck at one end, far wall top corner). At 3000
          // the far plane sliced through the boards/stands and flickered as
          // the camera eased — black lines on the boards, stands showing
          // through where board geometry was clipped away.
          far: 4500
        }}
      >
        {/* Explicit arena-dark background. Without one the canvas is
            transparent and the PAGE shows through wherever the bowl doesn't
            reach, which reads as a hole rather than as the far side of a
            dark building. */}
        <color attach="background" args={["#0b1017"]} />
        <CameraRig puck={cameraAnchor} orientation={viewOrientation} />
        <OffscreenArrowTracker skaters={trackedSkaters} enabled={arrowsEnabled} />
        <ambientLight intensity={0.95} />
        {/* The key light mirrors with the rig (a directional light aims at the
            origin, so negating the position rotates it 180 degrees about Y),
            keeping shadows falling the same way relative to the viewer on
            both ends instead of toward the flipped camera. */}
        <directionalLight
          position={[320 * viewOrientation, 900, 460 * viewOrientation]}
          intensity={1.25}
          castShadow
        />
        <Rink viewOrientation={viewOrientation} />
        <ArenaShell
          events={currentWorld.eventQueue}
          nowMs={currentWorld.time.nowMs}
          detail={reducedGraphics ? "reduced" : "full"}
        />
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
          // The local player's windup reads from prediction (~1 RTT fresher).
          const gestureSkater =
            skater.id === localSlotId && predictedLocalSkater
              ? predictedLocalSkater
              : sourceSkater;

          return (
            <SkaterDebug
              key={skater.id}
              id={skater.id}
              teamId={skater.teamId}
              uniform={identities[skater.teamId].uniform}
              characterId={skater.characterId}
              position={renderSkater.position}
              isLocal={skater.id === localSlotId}
              highlightColor={highlightColorByEntityId[skater.id] ?? null}
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
              windupDepth={
                gestureSkater.gesture.phase === "windup"
                  ? Math.min(1, gestureSkater.gesture.windupDepth)
                  : 0
              }
              activeBoosts={activeBoostTypesForSlot(currentWorld, skater.id)}
              viewOrientation={viewOrientation}
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
            {/* Identity disc while a human temporarily controls this goalie
                (covered-save outlet). Same treatment as skater discs; sized
                against the 1.5 base group scale so it matches on the ice. */}
            {highlightColorByEntityId[goalie.id] ? (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[goalie.id === localGoalieId ? 38 : 34, 24]} />
                <meshStandardMaterial
                  color={highlightColorByEntityId[goalie.id]}
                  emissive={goalie.id === localGoalieId ? "#ffffff" : "#000000"}
                  emissiveIntensity={goalie.id === localGoalieId ? 0.25 : 0}
                />
              </mesh>
            ) : null}
            <GoalieModel
              teamId={goalie.teamId}
              uniform={identities[goalie.teamId].uniform}
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
      <OffscreenArrowLayer
        skaters={currentWorld.skaters.map((skater) => ({
          id: skater.id,
          teamId: skater.teamId,
          teamColor: identities[skater.teamId].iconColor
        }))}
        highlightColorByEntityId={highlightColorByEntityId}
      />
    </section>
  );
}
