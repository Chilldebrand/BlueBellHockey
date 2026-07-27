import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import { RINK_CONFIG, type WorldEvent } from "@bbh/arcade-core";
import {
  bowlRowLength,
  computeArenaLayout,
  STAND_BASE_HEIGHT,
  type ArenaLayout,
  type StandSpec
} from "./arenaLayout.js";
import {
  ARENA_CROWD_SEED,
  generateCrowd,
  type CrowdDetail
} from "./crowdGeneration.js";
import { Crowd } from "./Crowd.js";

export interface ArenaShellProps {
  readonly events: readonly WorldEvent[];
  readonly nowMs: number;
  /**
   * Full detail is the runtime default; "reduced" keeps the whole stadium
   * with a sparser, stiller crowd. No UI exposes this yet — it exists so a
   * future graphics-quality setting can cut crowd cost without a redesign.
   */
  readonly detail?: CrowdDetail;
}

const LIGHT_BANK_HEIGHT = 500;

interface BoxInstance {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  /** Rotation about the stand's run axis (for raked aisle strips). */
  readonly tiltAxis?: "x" | "z";
  readonly tilt?: number;
}

/** Facing-axis coordinate of a stand row's center. */
function rowFacing(stand: StandSpec, row: number): number {
  return stand.innerEdge + stand.direction * stand.rowDepth * (row + 0.5);
}

function standWorld(
  stand: StandSpec,
  along: number,
  facing: number,
  y: number,
  sizeAlong: number,
  sizeY: number,
  sizeFacing: number
): BoxInstance {
  return stand.axis === "x"
    ? { x: along, y, z: facing, sizeX: sizeAlong, sizeY, sizeZ: sizeFacing }
    : { x: facing, y, z: along, sizeX: sizeFacing, sizeY, sizeZ: sizeAlong };
}

function bleacherInstances(layout: ArenaLayout): BoxInstance[] {
  const instances: BoxInstance[] = [];

  for (const stand of layout.stands) {
    for (let row = 0; row < stand.rowCount; row += 1) {
      const stepHeight = stand.rowRise + 6;
      instances.push(
        standWorld(
          stand,
          stand.centerAlong,
          rowFacing(stand, row),
          stand.baseHeight + row * stand.rowRise - stepHeight / 2,
          bowlRowLength(stand, row),
          stepHeight,
          stand.rowDepth
        )
      );
    }
    // Front fascia closing the gap between the apron and the first row.
    instances.push(
      standWorld(
        stand,
        stand.centerAlong,
        stand.innerEdge + stand.direction * 3,
        STAND_BASE_HEIGHT / 2,
        bowlRowLength(stand, 0),
        STAND_BASE_HEIGHT,
        6
      )
    );
  }

  return instances;
}

/**
 * Seat-coloured caps sitting on the back lip of each riser. The risers alone
 * read as bare grey steps; a band of seat colour is what makes a rake look
 * like seating rather than stairs, and the empty upper rows are exactly where
 * the eye lands in the top corners of the frame.
 */
function seatBandInstances(layout: ArenaLayout): BoxInstance[] {
  const instances: BoxInstance[] = [];

  for (const stand of layout.stands) {
    for (let row = 0; row < stand.rowCount; row += 1) {
      instances.push(
        standWorld(
          stand,
          stand.centerAlong,
          rowFacing(stand, row) + stand.direction * (stand.rowDepth * 0.3),
          stand.baseHeight + row * stand.rowRise + 5,
          bowlRowLength(stand, row),
          10,
          stand.rowDepth * 0.34
        )
      );
    }
  }

  return instances;
}

/**
 * The flat ring of floor between the boards and the first row — a real rink's
 * apron. Sits a hair above the outer floor slab so it reads as its own
 * surface. The x-running pair spans the corners, matching the bowl's tiling.
 */
function apronInstances(layout: ArenaLayout): BoxInstance[] {
  const { apron, rink } = layout;
  const { width, height } = rink;
  const y = apron.thickness / 2;
  const band = apron.outerDepth - apron.innerDepth;
  const mid = (apron.innerDepth + apron.outerDepth) / 2;
  const spanX = width + 2 * apron.outerDepth;

  return [
    { x: width / 2, y, z: -mid, sizeX: spanX, sizeY: apron.thickness, sizeZ: band },
    {
      x: width / 2,
      y,
      z: height + mid,
      sizeX: spanX,
      sizeY: apron.thickness,
      sizeZ: band
    },
    {
      x: -mid,
      y,
      z: height / 2,
      sizeX: band,
      sizeY: apron.thickness,
      sizeZ: height + 2 * apron.innerDepth
    },
    {
      x: width + mid,
      y,
      z: height / 2,
      sizeX: band,
      sizeY: apron.thickness,
      sizeZ: height + 2 * apron.innerDepth
    }
  ];
}

/** Fascia ad panels: repeating boards along the front of the lower bowl. */
const AD_PANEL_LENGTH = 200;
const AD_PANEL_GAP = 16;

function adPanelInstances(layout: ArenaLayout, phase: number, stride: number): BoxInstance[] {
  const instances: BoxInstance[] = [];
  const pitch = AD_PANEL_LENGTH + AD_PANEL_GAP;

  for (const stand of layout.stands) {
    const runLength = bowlRowLength(stand, 0);
    const count = Math.floor(runLength / pitch);
    const start = stand.centerAlong - (count * pitch) / 2 + pitch / 2;

    for (let index = phase; index < count; index += stride) {
      instances.push(
        standWorld(
          stand,
          start + index * pitch,
          // Proud of the fascia face by 2 so it never z-fights it.
          stand.innerEdge - stand.direction * 2,
          STAND_BASE_HEIGHT * 0.56,
          AD_PANEL_LENGTH,
          STAND_BASE_HEIGHT * 0.52,
          4
        )
      );
    }
  }

  return instances;
}

function railInstances(layout: ArenaLayout): BoxInstance[] {
  const instances: BoxInstance[] = [];
  const rakeDepth = (stand: StandSpec): number => stand.rowCount * stand.rowDepth;

  for (const stand of layout.stands) {
    // Front safety rail above the fascia.
    instances.push(
      standWorld(
        stand,
        stand.centerAlong,
        stand.innerEdge + stand.direction * 2,
        stand.baseHeight + 26,
        bowlRowLength(stand, 0),
        3,
        3
      )
    );

    // Two stair aisles running up the rake, tilted to the seating slope.
    const rise = stand.rowCount * stand.rowRise;
    const slopeLength = Math.hypot(rise, rakeDepth(stand));
    const tilt =
      Math.atan2(rise, rakeDepth(stand)) * (stand.direction === -1 ? 1 : -1);
    // Aisles every ~700 units of run, so the longer continuous rows get the
    // vertical breaks a real bowl has instead of two lonely staircases.
    const runLength = bowlRowLength(stand, 0);
    const aisleCount = Math.max(2, Math.round(runLength / 700));
    for (let aisle = 0; aisle < aisleCount; aisle += 1) {
      const alongFraction = (aisle + 0.5) / aisleCount - 0.5;
      const along = stand.centerAlong + runLength * alongFraction;
      const facing = stand.innerEdge + stand.direction * (rakeDepth(stand) / 2);
      const y = stand.baseHeight + rise / 2 - stand.rowRise / 2;
      const base = standWorld(stand, along, facing, y, 12, 3, slopeLength);
      instances.push({
        ...base,
        tiltAxis: stand.axis === "x" ? "x" : "z",
        tilt: stand.axis === "x" ? tilt : -tilt
      });
    }
  }

  return instances;
}

function floorInstances(layout: ArenaLayout): BoxInstance[] {
  const { wall } = layout;
  const thickness = 4;
  // One slab under EVERYTHING, its top 1 unit below the ice plane. The old
  // four-strip floor stopped at the rink's bounding box, which left black
  // voids at the four corners (the boards' rounded outer arc never reaches
  // the box corner, so nothing rendered in the wedge outside it). Sitting
  // 1 unit low keeps it clear of z-fighting the ice sheet above it.
  const y = -1 - thickness / 2;

  return [
    {
      x: (wall.minX + wall.maxX) / 2,
      y,
      z: (wall.minZ + wall.maxZ) / 2,
      sizeX: wall.maxX - wall.minX,
      sizeY: thickness,
      sizeZ: wall.maxZ - wall.minZ
    }
  ];
}

function wallInstances(layout: ArenaLayout): BoxInstance[] {
  const { wall } = layout;
  const spanX = wall.maxX - wall.minX + 2 * wall.thickness;
  const spanZ = wall.maxZ - wall.minZ;
  const y = wall.height / 2;

  return [
    {
      x: (wall.minX + wall.maxX) / 2,
      y,
      z: wall.minZ - wall.thickness / 2,
      sizeX: spanX,
      sizeY: wall.height,
      sizeZ: wall.thickness
    },
    {
      x: (wall.minX + wall.maxX) / 2,
      y,
      z: wall.maxZ + wall.thickness / 2,
      sizeX: spanX,
      sizeY: wall.height,
      sizeZ: wall.thickness
    },
    {
      x: wall.minX - wall.thickness / 2,
      y,
      z: (wall.minZ + wall.maxZ) / 2,
      sizeX: wall.thickness,
      sizeY: wall.height,
      sizeZ: spanZ
    },
    {
      x: wall.maxX + wall.thickness / 2,
      y,
      z: (wall.minZ + wall.maxZ) / 2,
      sizeX: wall.thickness,
      sizeY: wall.height,
      sizeZ: spanZ
    }
  ];
}

/** Emissive fixture faces — the lit panel a light bank shows from below. */
function lightBankInstances(layout: ArenaLayout): BoxInstance[] {
  return layout.stands.flatMap((stand) => {
    const facing =
      stand.innerEdge + stand.direction * ((stand.rowCount * stand.rowDepth) / 2);
    const runLength = bowlRowLength(stand, 0);
    const count = Math.max(2, Math.round(runLength / 900));
    const bankLength = (runLength / count) * 0.62;

    return Array.from({ length: count }, (_unused, index) =>
      standWorld(
        stand,
        stand.centerAlong + runLength * ((index + 0.5) / count - 0.5),
        facing,
        LIGHT_BANK_HEIGHT,
        bankLength,
        10,
        30
      )
    );
  });
}

/**
 * Dark housings and hanger stems around each lit panel. The banks used to be
 * bare white bars floating in the dark with nothing holding them up.
 */
function lightRigInstances(layout: ArenaLayout): BoxInstance[] {
  const instances: BoxInstance[] = [];

  for (const bank of lightBankInstances(layout)) {
    const alongIsX = bank.sizeX > bank.sizeZ;
    // Housing: a slightly larger box wrapped above the emissive face.
    instances.push({
      ...bank,
      y: bank.y + 9,
      sizeX: bank.sizeX + (alongIsX ? 6 : 8),
      sizeY: 12,
      sizeZ: bank.sizeZ + (alongIsX ? 8 : 6)
    });
    // Two stems climbing out of frame toward the (unmodelled) roof steel.
    for (const offset of [-0.3, 0.3]) {
      instances.push({
        x: bank.x + (alongIsX ? bank.sizeX * offset : 0),
        y: bank.y + 46,
        z: bank.z + (alongIsX ? 0 : bank.sizeZ * offset),
        sizeX: 5,
        sizeY: 60,
        sizeZ: 5
      });
    }
  }

  return instances;
}

/** One instanced unit-box mesh; every instance is a scaled/tilted box. */
function InstancedBoxes({
  instances,
  color,
  roughness = 0.9,
  metalness = 0,
  emissive,
  emissiveIntensity
}: {
  readonly instances: readonly BoxInstance[];
  readonly color: string;
  readonly roughness?: number;
  readonly metalness?: number;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
}): JSX.Element {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const dummy = new Object3D();
    instances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.rotation.set(
        instance.tiltAxis === "x" ? instance.tilt ?? 0 : 0,
        0,
        instance.tiltAxis === "z" ? instance.tilt ?? 0 : 0
      );
      dummy.scale.set(instance.sizeX, instance.sizeY, instance.sizeZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [instances]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined!, undefined!, instances.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity ?? 0}
      />
    </instancedMesh>
  );
}

/**
 * The decorative arena bowl around the rink: raked stands, corner concourses,
 * outer floor, enclosing wall, rails, light-bank fixtures, and the crowd.
 * Client-side presentation only — nothing here collides, adds scene lights,
 * or writes to world state.
 */
export function ArenaShell({
  events,
  nowMs,
  detail = "full"
}: ArenaShellProps): JSX.Element {
  const layout = useMemo(() => computeArenaLayout(RINK_CONFIG), []);
  const crowd = useMemo(
    () => generateCrowd(layout, ARENA_CROWD_SEED, detail),
    [layout, detail]
  );
  const bleachers = useMemo(() => bleacherInstances(layout), [layout]);
  const seatBands = useMemo(() => seatBandInstances(layout), [layout]);
  const apron = useMemo(() => apronInstances(layout), [layout]);
  const rails = useMemo(() => railInstances(layout), [layout]);
  const floor = useMemo(() => floorInstances(layout), [layout]);
  const walls = useMemo(() => wallInstances(layout), [layout]);
  const lightBanks = useMemo(() => lightBankInstances(layout), [layout]);
  const lightRigs = useMemo(() => lightRigInstances(layout), [layout]);
  // Three interleaved passes so the ring of boards alternates colour without
  // needing per-instance colours (one draw call each, same as any other box).
  const adsA = useMemo(() => adPanelInstances(layout, 0, 3), [layout]);
  const adsB = useMemo(() => adPanelInstances(layout, 1, 3), [layout]);
  const adsC = useMemo(() => adPanelInstances(layout, 2, 3), [layout]);

  return (
    <group name="arena-shell">
      <InstancedBoxes instances={bleachers} color="#454d57" roughness={0.95} />
      {/* Seat colour on the riser lips — what turns bare steps into seating. */}
      <InstancedBoxes instances={seatBands} color="#1f3f6b" roughness={0.75} />
      <InstancedBoxes instances={apron} color="#6a7079" roughness={0.95} />
      <InstancedBoxes instances={floor} color="#343941" roughness={1} />
      <InstancedBoxes instances={walls} color="#1a1d23" roughness={1} />
      <InstancedBoxes
        instances={rails}
        color="#b9c0c8"
        roughness={0.35}
        metalness={0.7}
      />
      {/* Dasher-level ad boards ringing the bowl front. */}
      <InstancedBoxes instances={adsA} color="#c9d3de" roughness={0.6} />
      <InstancedBoxes instances={adsB} color="#1f5fd0" roughness={0.6} />
      <InstancedBoxes instances={adsC} color="#b3132b" roughness={0.6} />
      <InstancedBoxes instances={lightRigs} color="#191c22" roughness={1} />
      {/* Visible fixtures only — emissive meshes, never actual scene lights. */}
      <InstancedBoxes
        instances={lightBanks}
        color="#20242b"
        emissive="#fff3d6"
        emissiveIntensity={1.6}
      />
      <Crowd
        spec={crowd}
        layout={layout}
        events={events}
        nowMs={nowMs}
        detail={detail}
      />
    </group>
  );
}
