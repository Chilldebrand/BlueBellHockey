import type { CharacterId, PowerupType, TeamId, Vec2 } from "@bbh/arcade-core";
import { CharacterModel } from "./CharacterModel.js";
import { PowerupIcon } from "./Powerups.js";
import type { SkaterAnimationState } from "./animation/clipMap.js";

export interface SkaterDebugProps {
  readonly id: string;
  readonly teamId: TeamId;
  readonly characterId?: CharacterId;
  readonly position: Vec2;
  readonly isLocal: boolean;
  /**
   * Identity color of the HUMAN controlling this skater (e.g. player 1 =
   * blue), or null when AI-controlled. Only human-controlled skaters get a
   * disc; the color follows the human through control switches and never
   * changes for possession.
   */
  readonly highlightColor?: string | null;
  readonly animationState?: SkaterAnimationState;
  /** Sim-plane velocity; when set with showVectors, renders a debug arrow. */
  readonly velocity?: Vec2;
  /** Body orientation in sim-plane radians; orients the model and debug arrow. */
  readonly facing?: number;
  /** Blade offset in body space (x forward, y lateral) for the stick overlay. */
  readonly bladeOffset?: Vec2;
  /** Slap windup depth 0..1 (chargeShot only): draws the stick up and back. */
  readonly windupDepth?: number;
  /**
   * Sustained boosts this skater holds (speed-boost / hard-shot / bulldozer):
   * badged on the identity disc so everyone can see who is powered up.
   * Only rendered when the disc itself renders (human-controlled skaters).
   */
  readonly activeBoosts?: readonly PowerupType[];
  readonly showVectors?: boolean;
}

// Sim plane (x, y) renders as three.js (x, z); yaw θ around +Y rotates the +X
// axis to (cosθ, 0, -sinθ), so matching a plane direction needs θ = atan2(-y, x).
function yawForPlaneDirection(direction: Vec2): number {
  return Math.atan2(-direction.y, direction.x);
}

function VelocityArrow({ velocity }: { readonly velocity: Vec2 }): JSX.Element | null {
  const speed = Math.hypot(velocity.x, velocity.y);

  if (speed < 1) {
    return null;
  }

  const length = Math.min(240, speed * 0.35);

  return (
    <group rotation={[0, yawForPlaneDirection(velocity), 0]}>
      <mesh position={[length / 2, 26, 0]}>
        <boxGeometry args={[length, 3, 3]} />
        <meshBasicMaterial color="#3dfc9d" />
      </mesh>
      <mesh position={[length, 26, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[7, 16, 8]} />
        <meshBasicMaterial color="#3dfc9d" />
      </mesh>
    </group>
  );
}

/**
 * NHL-Arcade-style character/ice ratio: the blockout body is ~69 units tall,
 * which reads tiny on a 1000-unit-wide sheet (≈14.5 player-heights across).
 * The reference game fits ~9 across, so bodies render 1.6× (≈110 units) while
 * physics stays untouched. Visual only — debug vectors stay world-accurate.
 */
export const SKATER_MODEL_SCALE = 1.6;

export function SkaterDebug({
  id,
  teamId,
  characterId,
  position,
  isLocal,
  highlightColor = null,
  animationState = "idle",
  velocity,
  facing,
  bladeOffset,
  windupDepth = 0,
  activeBoosts = [],
  showVectors = false
}: SkaterDebugProps): JSX.Element {
  return (
    <group position={[position.x, 10, position.y]} name={id}>
      {/* Human-identity disc: rendered ONLY under human-controlled skaters,
          in that human's fixed color (it follows them through control
          switches and never changes for possession). AI gets nothing. */}
      {highlightColor ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[isLocal ? 56 : 50, 24]} />
          <meshStandardMaterial
            color={highlightColor}
            emissive={isLocal ? "#ffffff" : "#000000"}
            emissiveIntensity={isLocal ? 0.25 : 0}
          />
        </mesh>
      ) : null}
      {/* Active-boost badges on the disc's camera-side edge (the camera sits
          at -X looking up-ice): the same procedural icons as the pickups,
          shrunk, so the effect is instantly recognizable on whoever holds it. */}
      {highlightColor
        ? activeBoosts.map((type, index) => (
            <group
              key={type}
              name={`boost-badge:${type}`}
              position={[
                -((isLocal ? 56 : 50) - 16),
                6,
                (index - (activeBoosts.length - 1) / 2) * 26
              ]}
              scale={0.95}
            >
              <PowerupIcon type={type} />
            </group>
          ))
        : null}
      <group rotation={[0, facing === undefined ? 0 : -facing, 0]}>
        <group scale={SKATER_MODEL_SCALE}>
          <CharacterModel
            teamId={teamId}
            characterId={characterId}
            isLocal={isLocal}
            animationState={animationState}
            bladeOffset={bladeOffset}
            windupDepth={windupDepth}
            speed={velocity ? Math.hypot(velocity.x, velocity.y) : 0}
          />
        </group>
        {showVectors ? (
          <mesh position={[34, 22, 0]}>
            <boxGeometry args={[36, 2.5, 2.5]} />
            <meshBasicMaterial color="#ffdf6e" />
          </mesh>
        ) : null}
      </group>
      {showVectors && velocity ? <VelocityArrow velocity={velocity} /> : null}
    </group>
  );
}
