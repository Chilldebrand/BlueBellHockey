import type { TeamId, Vec2 } from "@bbh/arcade-core";

export interface SkaterDebugProps {
  readonly id: string;
  readonly teamId: TeamId;
  readonly position: Vec2;
  readonly isLocal: boolean;
}

const TEAM_COLORS: Record<TeamId, string> = {
  home: "#1f8fff",
  away: "#ff4f5e"
};

export function SkaterDebug({
  id,
  teamId,
  position,
  isLocal
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
      <mesh position={[0, 18, 0]}>
        <boxGeometry args={[18, 36, 18]} />
        <meshStandardMaterial color={isLocal ? "#ffffff" : "#d9e6f2"} />
      </mesh>
    </group>
  );
}
