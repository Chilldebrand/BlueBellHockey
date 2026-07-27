/**
 * Pure stand/concourse/wall layout math for the four-sided arena bowl.
 * No Three.js imports — everything here is testable without a WebGL canvas.
 * Scene coordinates: the ice occupies x in [0, width], z in [0, height], y up.
 */

export type StandId = "north" | "south" | "east" | "west";

export interface StandSpec {
  readonly id: StandId;
  /** Axis the stand RUNS along: long sides run x, ends run z. */
  readonly axis: "x" | "z";
  /** Outward sign along the facing axis: -1 toward negative, +1 positive. */
  readonly direction: 1 | -1;
  /** Center coordinate along the run axis. */
  readonly centerAlong: number;
  /** Extent along the run axis. */
  readonly length: number;
  /** Facing-axis coordinate of the front (rink-side) edge. */
  readonly innerEdge: number;
  readonly rowCount: number;
  readonly rowRise: number;
  readonly rowDepth: number;
  /** Front-row seat elevation above the outer floor. */
  readonly baseHeight: number;
  /** Back-row top height. */
  readonly topHeight: number;
}

/**
 * The flat ring of floor between the outside of the boards and the first row
 * of seats — the "apron" a real rink has its benches and photographers on.
 * Four boxes; the x-running pair spans the full width so the corners are
 * covered exactly once (see `bowlRowLength`).
 */
export interface ApronSpec {
  readonly innerDepth: number;
  readonly outerDepth: number;
  readonly thickness: number;
}

export interface ArenaWallSpec {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly height: number;
  readonly thickness: number;
}

export interface ArenaLayout {
  readonly stands: readonly [StandSpec, StandSpec, StandSpec, StandSpec];
  readonly apron: ApronSpec;
  readonly wall: ArenaWallSpec;
  readonly rink: { readonly width: number; readonly height: number };
}

/**
 * Depth of the board + glass ring outside the rink footprint (mirrors
 * Rink.tsx's BOARD_THICKNESS 36 + GLASS_THICKNESS 10, which are private).
 */
export const BOARD_RING_DEPTH = 46;
/** Spec clearance between the board/glass outside face and the first seat. */
export const STAND_CLEARANCE = 90;
/** Total setback of every stand's inner edge from the rink footprint. */
export const STAND_SETBACK = BOARD_RING_DEPTH + STAND_CLEARANCE;

export const STAND_ROW_COUNT = 10;
export const STAND_ROW_RISE = 34;
export const STAND_ROW_DEPTH = 34;
export const STAND_BASE_HEIGHT = 40;

/**
 * Every row is longer than the one in front of it, because the bowl is a set
 * of nested rectangular rings: stepping back one row moves the ring out by
 * rowDepth on BOTH ends of the run.
 *
 * This is what makes the bowl continuous. It used to be four separate stands
 * cut 320 short of each rink corner, with a near-black concourse block parked
 * in each diagonal gap — and those blocks sit exactly in the top-left and
 * top-right of the gameplay frame, which is what read as unfinished black
 * boxes. Now the x-running rows run corner to corner and the z-running rows
 * fill only the middle, so the four rings tile the whole bowl with no gap and
 * no double-covered corner (which would z-fight on the shared top face).
 */
export const STAND_ROW_LENGTH_GROWTH = 2 * STAND_ROW_DEPTH;

export const WALL_MARGIN = 40;
export const WALL_HEIGHT = 470;
export const WALL_THICKNESS = 20;

/**
 * Hard ceiling for every arena structure. The gameplay camera rides at y=940
 * (CameraRig.tsx); staying far below it keeps the bowl out of the camera's
 * travel path and sightlines at the clamp extremes.
 */
export const ARENA_MAX_STRUCTURE_HEIGHT = 560;

const STAND_DEPTH = STAND_ROW_COUNT * STAND_ROW_DEPTH;
const STAND_TOP_HEIGHT = STAND_BASE_HEIGHT + STAND_ROW_COUNT * STAND_ROW_RISE;

export function computeArenaLayout(rink: {
  readonly width: number;
  readonly height: number;
}): ArenaLayout {
  const { width, height } = rink;

  const base = {
    rowCount: STAND_ROW_COUNT,
    rowRise: STAND_ROW_RISE,
    rowDepth: STAND_ROW_DEPTH,
    baseHeight: STAND_BASE_HEIGHT,
    topHeight: STAND_TOP_HEIGHT
  };

  // Row-0 lengths. The x-running pair reaches past the rink corners by one
  // full row depth so it owns the corner squares; the z-running pair stops at
  // the footprint edge where that coverage begins. `bowlRowLength` grows both
  // by STAND_ROW_LENGTH_GROWTH per row, which keeps the tiling exact all the
  // way up the rake.
  const stands: readonly [StandSpec, StandSpec, StandSpec, StandSpec] = [
    {
      id: "south",
      axis: "x",
      direction: -1,
      centerAlong: width / 2,
      length: width + 2 * (STAND_SETBACK + STAND_ROW_DEPTH),
      innerEdge: -STAND_SETBACK,
      ...base
    },
    {
      id: "north",
      axis: "x",
      direction: 1,
      centerAlong: width / 2,
      length: width + 2 * (STAND_SETBACK + STAND_ROW_DEPTH),
      innerEdge: height + STAND_SETBACK,
      ...base
    },
    {
      id: "west",
      axis: "z",
      direction: -1,
      centerAlong: height / 2,
      length: height + 2 * STAND_SETBACK,
      innerEdge: -STAND_SETBACK,
      ...base
    },
    {
      id: "east",
      axis: "z",
      direction: 1,
      centerAlong: height / 2,
      length: height + 2 * STAND_SETBACK,
      innerEdge: width + STAND_SETBACK,
      ...base
    }
  ];

  const outerExtent = STAND_SETBACK + STAND_DEPTH;

  const wall: ArenaWallSpec = {
    minX: -(outerExtent + WALL_MARGIN),
    maxX: width + outerExtent + WALL_MARGIN,
    minZ: -(outerExtent + WALL_MARGIN),
    maxZ: height + outerExtent + WALL_MARGIN,
    height: WALL_HEIGHT,
    thickness: WALL_THICKNESS
  };

  return {
    stands,
    apron: {
      innerDepth: BOARD_RING_DEPTH,
      outerDepth: STAND_SETBACK,
      thickness: 3
    },
    wall,
    rink: { width, height }
  };
}

/**
 * Length of one stand's row `row`, in the direction the stand runs. Row 0 is
 * the shortest; every step back adds a row depth at each end.
 */
export function bowlRowLength(stand: StandSpec, row: number): number {
  return stand.length + row * STAND_ROW_LENGTH_GROWTH;
}

/** Outer facing-axis extent of a stand (its back edge coordinate). */
export function standOuterEdge(stand: StandSpec): number {
  return stand.innerEdge + stand.direction * stand.rowCount * stand.rowDepth;
}
