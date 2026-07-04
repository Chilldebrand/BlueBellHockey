import { useMemo } from "react";
import { Shape, ShapeGeometry, ExtrudeGeometry, DoubleSide } from "three";
import { RINK_CONFIG, goalLineX, netBackX } from "@bbh/arcade-core";

const BOARD_THICKNESS = 36;
const BOARD_HEIGHT = 52;
const GLASS_THICKNESS = 10;
const GLASS_HEIGHT = 120;

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

function useGlassGeometry(): ExtrudeGeometry {
  return useMemo(() => {
    // Thin ring sitting on top of the boards, hugging their inner face.
    const outer = roundedRinkShape(GLASS_THICKNESS);
    outer.holes.push(roundedRinkShape());

    return new ExtrudeGeometry(outer, {
      depth: GLASS_HEIGHT,
      bevelEnabled: false,
      curveSegments: 24
    });
  }, []);
}

export function Rink(): JSX.Element {
  const ice = useIceGeometry();
  const boards = useBoardsGeometry();
  const glass = useGlassGeometry();

  return (
    <group name="arcade-rink">
      {/* Ice sheet — shape lives in the (x, y) sim plane; rotate flat. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, RINK_CONFIG.height]} geometry={ice}>
        <meshStandardMaterial color="#e7f6ff" roughness={0.5} metalness={0.04} />
      </mesh>
      <RinkLine x={RINK_CONFIG.width / 2} color="#1f8fff" width={12} />
      <RinkLine x={RINK_CONFIG.width * 0.34} color="#1f8fff" width={10} />
      <RinkLine x={RINK_CONFIG.width * 0.66} color="#1f8fff" width={10} />
      <RinkLine x={goalLineX("home")} color="#ff4f5e" width={6} />
      <RinkLine x={goalLineX("away")} color="#ff4f5e" width={6} />
      <GoalCrease
        x={goalLineX("home") + RINK_CONFIG.goalieDepth}
      />
      <GoalCrease
        x={goalLineX("away") - RINK_CONFIG.goalieDepth}
      />
      <GoalCage team="home" />
      <GoalCage team="away" />
      {/* Boards — rounded ring wall extruded upward around the sheet. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, RINK_CONFIG.height]}
        geometry={boards}
      >
        <meshStandardMaterial color="#f8fbff" emissive="#77cfff" emissiveIntensity={0.08} />
      </mesh>
      {/* Glass — a taller, thinner translucent ring on top of the boards. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BOARD_HEIGHT, RINK_CONFIG.height]}
        geometry={glass}
      >
        <meshPhysicalMaterial
          color="#dff3ff"
          transparent
          opacity={0.16}
          roughness={0.08}
          metalness={0}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <CenterLogo />
    </group>
  );
}

function RinkLine({
  x,
  color,
  width = 12
}: {
  readonly x: number;
  readonly color: string;
  readonly width?: number;
}): JSX.Element {
  return (
    <mesh position={[x, 2, RINK_CONFIG.height / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, RINK_CONFIG.height]} />
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

/**
 * Full goal cage matching the sim's net box: red frame (posts + crossbar) on
 * the goal line, and translucent netting on the back, sides, and top. The
 * mouth is open; everything else is solid in the sim.
 */
function GoalCage({ team }: { readonly team: "home" | "away" }): JSX.Element {
  const lineX = goalLineX(team);
  const backX = netBackX(team);
  const centerY = RINK_CONFIG.height / 2;
  const half = RINK_CONFIG.goalWidth / 2;
  const barHeight = 95; // GOAL_HEIGHT / NET_TOP_HEIGHT in the sim
  const depth = Math.abs(backX - lineX);
  const midX = (lineX + backX) / 2;

  return (
    <group name={`goal-cage-${team}`}>
      {/* posts + crossbar */}
      <mesh position={[lineX, barHeight / 2, centerY - half]}>
        <cylinderGeometry args={[8, 8, barHeight, 10]} />
        <meshStandardMaterial color="#ff4f5e" />
      </mesh>
      <mesh position={[lineX, barHeight / 2, centerY + half]}>
        <cylinderGeometry args={[8, 8, barHeight, 10]} />
        <meshStandardMaterial color="#ff4f5e" />
      </mesh>
      <mesh position={[lineX, barHeight, centerY]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[8, 8, RINK_CONFIG.goalWidth + 16, 10]} />
        <meshStandardMaterial color="#ff4f5e" />
      </mesh>
      {/* netting: back, two sides, top */}
      <mesh position={[backX, barHeight / 2, centerY]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[RINK_CONFIG.goalWidth + 16, barHeight]} />
        <NetMaterial />
      </mesh>
      <mesh position={[midX, barHeight / 2, centerY - half - 8]}>
        <planeGeometry args={[depth, barHeight]} />
        <NetMaterial />
      </mesh>
      <mesh position={[midX, barHeight / 2, centerY + half + 8]}>
        <planeGeometry args={[depth, barHeight]} />
        <NetMaterial />
      </mesh>
      <mesh position={[midX, barHeight, centerY]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[depth, RINK_CONFIG.goalWidth + 16]} />
        <NetMaterial />
      </mesh>
    </group>
  );
}

function NetMaterial(): JSX.Element {
  return (
    <meshStandardMaterial
      color="#ffffff"
      transparent
      opacity={0.32}
      side={DoubleSide}
    />
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
