import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import { RINK_CONFIG, type WorldEvent } from "@bbh/arcade-core";
import {
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
          stand.length,
          stepHeight,
          stand.rowDepth
        )
      );
    }
    // Front fascia closing the gap between the outer floor and the first row.
    instances.push(
      standWorld(
        stand,
        stand.centerAlong,
        stand.innerEdge + stand.direction * 3,
        STAND_BASE_HEIGHT / 2,
        stand.length,
        STAND_BASE_HEIGHT,
        6
      )
    );
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
        stand.length,
        3,
        3
      )
    );

    // Two stair aisles running up the rake, tilted to the seating slope.
    const rise = stand.rowCount * stand.rowRise;
    const slopeLength = Math.hypot(rise, rakeDepth(stand));
    const tilt =
      Math.atan2(rise, rakeDepth(stand)) * (stand.direction === -1 ? 1 : -1);
    for (const alongFraction of [-0.25, 0.25]) {
      const along = stand.centerAlong + stand.length * alongFraction;
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

function cornerInstances(layout: ArenaLayout): BoxInstance[] {
  return layout.corners.map((corner) => ({
    x: corner.center.x,
    y: corner.height / 2,
    z: corner.center.z,
    sizeX: corner.sizeX,
    sizeY: corner.height,
    sizeZ: corner.sizeZ
  }));
}

function lightBankInstances(layout: ArenaLayout): BoxInstance[] {
  return layout.stands.map((stand) =>
    standWorld(
      stand,
      stand.centerAlong,
      stand.innerEdge + stand.direction * ((stand.rowCount * stand.rowDepth) / 2),
      LIGHT_BANK_HEIGHT,
      stand.length * 0.5,
      10,
      30
    )
  );
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
  const rails = useMemo(() => railInstances(layout), [layout]);
  const floor = useMemo(() => floorInstances(layout), [layout]);
  const walls = useMemo(() => wallInstances(layout), [layout]);
  const corners = useMemo(() => cornerInstances(layout), [layout]);
  const lightBanks = useMemo(() => lightBankInstances(layout), [layout]);

  return (
    <group name="arena-shell">
      <InstancedBoxes instances={bleachers} color="#3a4149" roughness={0.95} />
      <InstancedBoxes instances={corners} color="#23272e" roughness={1} />
      <InstancedBoxes instances={floor} color="#2c3036" roughness={1} />
      <InstancedBoxes instances={walls} color="#1a1d23" roughness={1} />
      <InstancedBoxes
        instances={rails}
        color="#b9c0c8"
        roughness={0.35}
        metalness={0.7}
      />
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
