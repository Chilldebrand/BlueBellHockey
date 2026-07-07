import type { CharacterId, TeamId, Vec2 } from "@bbh/arcade-core";
import { CharacterModel } from "./CharacterModel.js";
import type { SkaterAnimationState } from "./animation/clipMap.js";

export interface SkaterDebugProps {
  readonly id: string;
  readonly teamId: TeamId;
  readonly characterId?: CharacterId;
  readonly position: Vec2;
  readonly isLocal: boolean;
  readonly hasPossession?: boolean;
  readonly animationState?: SkaterAnimationState;
  /** Sim-plane velocity; when set with showVectors, renders a debug arrow. */
  readonly velocity?: Vec2;
  /** Body orientation in sim-plane radians; orients the model and debug arrow. */
  readonly facing?: number;
  /** Blade offset in body space (x forward, y lateral) for the stick overlay. */
  readonly bladeOffset?: Vec2;
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

const TEAM_COLORS: Record<TeamId, string> = {
  home: "#1f8fff",
  away: "#ff4f5e"
};

/**
 * Every slot gets its own indicator color (like most sports games) so each
 * human in an all-human online match can identify their skater at a glance.
 * Only the skater YOU control renders vibrant; everyone else is faded.
 */
const SLOT_INDICATOR_COLORS: Record<string, string> = {
  "home-skater-1": "#1f8fff", // blue
  "home-skater-2": "#3dfc9d", // green
  "home-skater-3": "#ffdf6e", // yellow
  "away-skater-1": "#ff4f5e", // red
  "away-skater-2": "#ff9e3d", // orange
  "away-skater-3": "#c479ff" // purple
};

/** Faded opacity for skaters the local human is NOT controlling. */
const UNCONTROLLED_CIRCLE_OPACITY = 0.28;

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
  hasPossession = false,
  animationState = "idle",
  velocity,
  facing,
  bladeOffset,
  showVectors = false
}: SkaterDebugProps): JSX.Element {
  const indicatorColor = SLOT_INDICATOR_COLORS[id] ?? TEAM_COLORS[teamId];

  return (
    <group position={[position.x, 10, position.y]} name={id}>
      {/* Slot-colored disc: vibrant only under the skater this human controls;
          everyone else fades so control is unambiguous online. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[isLocal ? 56 : 46, 24]} />
        <meshStandardMaterial
          color={indicatorColor}
          emissive={isLocal ? "#ffffff" : "#000000"}
          emissiveIntensity={isLocal ? 0.25 : 0}
          transparent={!isLocal}
          opacity={isLocal ? 1 : UNCONTROLLED_CIRCLE_OPACITY}
        />
      </mesh>
      <group rotation={[0, facing === undefined ? 0 : -facing, 0]}>
        <group scale={SKATER_MODEL_SCALE}>
          <CharacterModel
            teamId={teamId}
            characterId={characterId}
            isLocal={isLocal}
            animationState={animationState}
            bladeOffset={bladeOffset}
          />
        </group>
        {showVectors ? (
          <mesh position={[34, 22, 0]}>
            <boxGeometry args={[36, 2.5, 2.5]} />
            <meshBasicMaterial color="#ffdf6e" />
          </mesh>
        ) : null}
      </group>
      {isLocal || hasPossession ? (
        <mesh position={[0, 4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[52, 58, 24]} />
          <meshStandardMaterial color={hasPossession ? "#ffdf6e" : "#ffffff"} />
        </mesh>
      ) : null}
      {showVectors && velocity ? <VelocityArrow velocity={velocity} /> : null}
    </group>
  );
}
