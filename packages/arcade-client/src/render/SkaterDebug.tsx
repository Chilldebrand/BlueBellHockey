import type { TeamId, Vec2 } from "@bbh/arcade-core";
import { CharacterModel } from "./CharacterModel.js";

export interface SkaterDebugProps {
  readonly id: string;
  readonly teamId: TeamId;
  readonly position: Vec2;
  readonly isLocal: boolean;
  readonly hasPossession?: boolean;
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
  hasPossession = false
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
      <CharacterModel teamId={teamId} isLocal={isLocal} />
      {isLocal || hasPossession ? (
        <mesh position={[0, 4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[52, 58, 24]} />
          <meshStandardMaterial color={hasPossession ? "#ffdf6e" : "#ffffff"} />
        </mesh>
      ) : null}
    </group>
  );
}
