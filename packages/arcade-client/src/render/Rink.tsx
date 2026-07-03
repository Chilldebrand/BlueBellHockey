import { useMemo } from "react";
import { Shape, ShapeGeometry, ExtrudeGeometry } from "three";
import { RINK_CONFIG } from "@bbh/arcade-core";

const BOARD_THICKNESS = 36;
const BOARD_HEIGHT = 52;

/**
 * Rounded-rect outline matching the sim's board geometry (boards.ts): straight
 * walls joined by quarter-circle corners of RINK_CONFIG.cornerRadius, drawn in
 * the sim plane (x, y) and rotated flat onto the ice.
 */
function roundedRinkShape(inflate = 0): Shape {
  const radius = RINK_CONFIG.cornerRadius + inflate;
  const minX = -inflate;
  const minY = -inflate;
  const maxX = RINK_CONFIG.width + inflate;
  const maxY = RINK_CONFIG.height + inflate;
  const shape = new Shape();

  shape.moveTo(minX + radius, minY);
  shape.lineTo(maxX - radius, minY);
  shape.absarc(maxX - radius, minY + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(maxX, maxY - radius);
  shape.absarc(maxX - radius, maxY - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(minX + radius, maxY);
  shape.absarc(minX + radius, maxY - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(minX, minY + radius);
  shape.absarc(minX + radius, minY + radius, radius, Math.PI, Math.PI * 1.5, false);

  return shape;
}

function useIceGeometry(): ShapeGeometry {
  return useMemo(() => new ShapeGeometry(roundedRinkShape(), 24), []);
}

function useBoardsGeometry(): ExtrudeGeometry {
  return useMemo(() => {
    // Ring wall: outer rounded rect with the rink itself punched out as a
    // hole (Shape extends Path, so it can serve as one directly).
    const outer = roundedRinkShape(BOARD_THICKNESS);
    outer.holes.push(roundedRinkShape());

    return new ExtrudeGeometry(outer, {
      depth: BOARD_HEIGHT,
      bevelEnabled: false,
      curveSegments: 24
    });
  }, []);
}

export function Rink(): JSX.Element {
  const ice = useIceGeometry();
  const boards = useBoardsGeometry();

  return (
    <group name="arcade-rink">
      {/* Ice sheet — shape lives in the (x, y) sim plane; rotate flat. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, RINK_CONFIG.height]} geometry={ice}>
        <meshStandardMaterial color="#e7f6ff" roughness={0.5} metalness={0.04} />
      </mesh>
      <RinkLine x={RINK_CONFIG.width / 2} color="#1f8fff" />
      <RinkLine x={RINK_CONFIG.width * 0.32} color="#ff4f5e" />
      <RinkLine x={RINK_CONFIG.width * 0.68} color="#ff4f5e" />
      <GoalCrease x={RINK_CONFIG.goalLineOffset} />
      <GoalCrease x={RINK_CONFIG.width - RINK_CONFIG.goalLineOffset} />
      <GoalFrame x={0} />
      <GoalFrame x={RINK_CONFIG.width} />
      {/* Boards — rounded ring wall extruded upward around the sheet. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, RINK_CONFIG.height]}
        geometry={boards}
      >
        <meshStandardMaterial color="#f8fbff" emissive="#77cfff" emissiveIntensity={0.08} />
      </mesh>
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

/** Simple post-and-crossbar frame so shots visibly have a target. */
function GoalFrame({ x }: { readonly x: number }): JSX.Element {
  const half = RINK_CONFIG.goalWidth / 2;
  const centerY = RINK_CONFIG.height / 2;
  const barHeight = 95; // GOAL_HEIGHT in the sim

  return (
    <group name={`goal-frame-${x}`}>
      <mesh position={[x, barHeight / 2, centerY - half]}>
        <cylinderGeometry args={[8, 8, barHeight, 10]} />
        <meshStandardMaterial color="#ff4f5e" />
      </mesh>
      <mesh position={[x, barHeight / 2, centerY + half]}>
        <cylinderGeometry args={[8, 8, barHeight, 10]} />
        <meshStandardMaterial color="#ff4f5e" />
      </mesh>
      <mesh position={[x, barHeight, centerY]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[8, 8, RINK_CONFIG.goalWidth + 16, 10]} />
        <meshStandardMaterial color="#ff4f5e" />
      </mesh>
    </group>
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
