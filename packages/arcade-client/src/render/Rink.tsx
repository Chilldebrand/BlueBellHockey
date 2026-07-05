import { useMemo } from "react";
import { CanvasTexture, Shape, ShapeGeometry, ExtrudeGeometry, DoubleSide } from "three";
import { RINK_CONFIG, goalLineX, netBackX } from "@bbh/arcade-core";

const BOARD_THICKNESS = 36;
const BOARD_HEIGHT = 52;
const GLASS_THICKNESS = 10;
const GLASS_HEIGHT = 120;
const CENTER_CIRCLE_RADIUS = 200;

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
      {/* NHL zone markings: a thick red center line flanked by two blue lines.
          The center line is split so it stops at the center circle. */}
      <CenterLine />
      <RinkLine x={RINK_CONFIG.width * 0.375} color="#2b7fff" width={14} />
      <RinkLine x={RINK_CONFIG.width * 0.625} color="#2b7fff" width={14} />
      <RinkLine x={goalLineX("home")} color="#ff4f5e" width={6} />
      <RinkLine x={goalLineX("away")} color="#ff4f5e" width={6} />
      <FaceoffMarkings />
      <CenterIceLogo />
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

/**
 * Red center line, split into two segments so it stops at the edge of the
 * center faceoff circle instead of running straight through the logo.
 */
function CenterLine(): JSX.Element {
  const x = RINK_CONFIG.width / 2;
  const segLen = RINK_CONFIG.height / 2 - CENTER_CIRCLE_RADIUS;

  return (
    <group name="center-line">
      <mesh position={[x, 2, segLen / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, segLen]} />
        <meshStandardMaterial color="#e2384a" />
      </mesh>
      <mesh
        position={[x, 2, RINK_CONFIG.height - segLen / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[16, segLen]} />
        <meshStandardMaterial color="#e2384a" />
      </mesh>
    </group>
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

/**
 * A blue Liberty-Bell painted at center ice. Drawn to an offscreen canvas (no
 * external asset) and mapped onto a flat plane inside the center circle.
 */
function CenterIceLogo(): JSX.Element {
  const texture = useMemo(() => {
    const size = 512;
    const cx = size / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      const blue = "#1f5fd0";
      ctx.fillStyle = blue;

      // Yoke (headstock beam) and the hanger loop under it.
      ctx.fillRect(cx - 78, 150, 156, 14);
      ctx.fillRect(cx - 7, 162, 14, 18);

      // Bell body: domed shoulders flaring out to a lipped skirt.
      ctx.beginPath();
      ctx.moveTo(cx - 30, 196);
      ctx.bezierCurveTo(cx - 30, 176, cx + 30, 176, cx + 30, 196);
      ctx.bezierCurveTo(cx + 46, 246, cx + 74, 300, cx + 90, 338);
      ctx.lineTo(cx + 116, 360);
      ctx.lineTo(cx + 116, 380);
      ctx.lineTo(cx - 116, 380);
      ctx.lineTo(cx - 116, 360);
      ctx.lineTo(cx - 90, 338);
      ctx.bezierCurveTo(cx - 74, 300, cx - 46, 246, cx - 30, 196);
      ctx.closePath();
      ctx.fill();

      // Clapper.
      ctx.beginPath();
      ctx.arc(cx, 396, 11, 0, Math.PI * 2);
      ctx.fill();

      // Signature crack, drawn transparent so the ice shows through the split.
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 7;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx + 30, 202);
      ctx.lineTo(cx + 15, 240);
      ctx.lineTo(cx + 34, 276);
      ctx.lineTo(cx + 17, 314);
      ctx.lineTo(cx + 30, 352);
      ctx.lineTo(cx + 22, 382);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
    const tex = new CanvasTexture(canvas);
    tex.anisotropy = 8;
    return tex;
  }, []);

  return (
    <mesh
      position={[RINK_CONFIG.width / 2, 6, RINK_CONFIG.height / 2]}
      rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
    >
      <planeGeometry args={[360, 360]} />
      <meshStandardMaterial map={texture} transparent />
    </mesh>
  );
}

/** NHL faceoff spot: an optional circle ring plus its center dot. */
function FaceoffSpot({
  x,
  z,
  color,
  circleRadius
}: {
  readonly x: number;
  readonly z: number;
  readonly color: string;
  readonly circleRadius?: number;
}): JSX.Element {
  return (
    <group position={[x, 0, z]}>
      {circleRadius !== undefined ? (
        <mesh position={[0, 4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[circleRadius - 8, circleRadius, 48]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ) : null}
      <mesh position={[0, 3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[15, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/**
 * Standard NHL faceoff layout: a blue center circle + dot and four red end-zone
 * circles. Positions are in the three (x, z) plane; z is the sim-plane y,
 * symmetric about center.
 */
function FaceoffMarkings(): JSX.Element {
  const cx = RINK_CONFIG.width / 2;
  const cz = RINK_CONFIG.height / 2;
  // End-zone circles pushed out toward the side boards: 25% closer to them than
  // the old 290 offset (gap to the board 490 -> ~367).
  const zOff = 412;
  const zoneInset = 300;
  const homeZoneX = goalLineX("home") + zoneInset;
  const awayZoneX = goalLineX("away") - zoneInset;
  const red = "#e2384a";

  return (
    <group name="faceoff-markings">
      <FaceoffSpot x={cx} z={cz} color={red} circleRadius={CENTER_CIRCLE_RADIUS} />
      <FaceoffSpot x={homeZoneX} z={cz - zOff} color={red} circleRadius={165} />
      <FaceoffSpot x={homeZoneX} z={cz + zOff} color={red} circleRadius={165} />
      <FaceoffSpot x={awayZoneX} z={cz - zOff} color={red} circleRadius={165} />
      <FaceoffSpot x={awayZoneX} z={cz + zOff} color={red} circleRadius={165} />
    </group>
  );
}
