import { RINK_CONFIG } from "@bbh/arcade-core";

export function Rink(): JSX.Element {
  return (
    <group name="arcade-rink">
      <mesh
        position={[RINK_CONFIG.width / 2, 0, RINK_CONFIG.height / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[RINK_CONFIG.width, RINK_CONFIG.height]} />
        <meshStandardMaterial color="#e7f6ff" roughness={0.5} metalness={0.04} />
      </mesh>
      <RinkLine x={RINK_CONFIG.width / 2} color="#1f8fff" />
      <RinkLine x={RINK_CONFIG.width * 0.32} color="#ff4f5e" />
      <RinkLine x={RINK_CONFIG.width * 0.68} color="#ff4f5e" />
      <GoalCrease x={RINK_CONFIG.goalLineOffset} />
      <GoalCrease x={RINK_CONFIG.width - RINK_CONFIG.goalLineOffset} />
      <Boards />
      <CenterLogo />
    </group>
  );
}

function RinkLine({
  x,
  color
}: {
  readonly x: number;
  readonly color: string;
}): JSX.Element {
  return (
    <mesh position={[x, 2, RINK_CONFIG.height / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, RINK_CONFIG.height]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function GoalCrease({ x }: { readonly x: number }): JSX.Element {
  return (
    <mesh position={[x, 3, RINK_CONFIG.height / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[RINK_CONFIG.goalWidth / 2, 32]} />
      <meshStandardMaterial color="#b9e7ff" transparent opacity={0.45} />
    </mesh>
  );
}

function Boards(): JSX.Element {
  return (
    <group name="boards-and-glass">
      <Board position={[RINK_CONFIG.width / 2, 26, -18]} size={[RINK_CONFIG.width, 52, 36]} />
      <Board
        position={[RINK_CONFIG.width / 2, 26, RINK_CONFIG.height + 18]}
        size={[RINK_CONFIG.width, 52, 36]}
      />
      <Board position={[-18, 26, RINK_CONFIG.height / 2]} size={[36, 52, RINK_CONFIG.height]} />
      <Board
        position={[RINK_CONFIG.width + 18, 26, RINK_CONFIG.height / 2]}
        size={[36, 52, RINK_CONFIG.height]}
      />
    </group>
  );
}

function Board({
  position,
  size
}: {
  readonly position: [number, number, number];
  readonly size: [number, number, number];
}): JSX.Element {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#f8fbff" emissive="#77cfff" emissiveIntensity={0.08} />
    </mesh>
  );
}

function CenterLogo(): JSX.Element {
  return (
    <group name="center-ice-bbh-mark" position={[RINK_CONFIG.width / 2, 5, RINK_CONFIG.height / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[96, 40]} />
        <meshStandardMaterial color="#101820" />
      </mesh>
      <mesh position={[0, 3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[64, 78, 40]} />
        <meshStandardMaterial color="#ffdf6e" />
      </mesh>
    </group>
  );
}
