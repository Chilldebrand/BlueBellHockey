import type { TeamId, Vec2 } from "@bbh/arcade-core";
import { CharacterModel } from "./CharacterModel.js";
import type { SkaterAnimationState } from "./animation/clipMap.js";

export interface SkaterDebugProps {
  readonly id: string;
  readonly teamId: TeamId;
  readonly position: Vec2;
  readonly isLocal: boolean;
  readonly hasPossession?: boolean;
  readonly animationState?: SkaterAnimationState;
  /** Sim-plane velocity; when set with showVectors, renders a debug arrow. */
  readonly velocity?: Vec2;
  /** Body orientation in sim-plane radians; orients the model and debug arrow. */
  readonly facing?: number;
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

export function SkaterDebug({
  id,
  teamId,
  position,
  isLocal,
  hasPossession = false,
  animationState = "idle",
  velocity,
  facing,
  showVectors = false
}: SkaterDebugProps): JSX.Element {
  return (
    <group position={[position.x, 10, position.y]} name={id}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[isLocal ? 48 : 38, 24]} />
        <meshStandardMaterial
          color={TEAM_COLORS[teamId]}
          emissive={isLocal ? "#ffffff" : "#000000"}
          emissiveIntensity={isLocal ? 0.2 : 0}
        />
      </mesh>
      <group rotation={[0, facing === undefined ? 0 : -facing, 0]}>
        <CharacterModel
          teamId={teamId}
          isLocal={isLocal}
          animationState={animationState}
        />
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
