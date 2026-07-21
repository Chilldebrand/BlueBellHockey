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

export interface CornerSpec {
  readonly id: "corner-sw" | "corner-se" | "corner-nw" | "corner-ne";
  readonly center: { readonly x: number; readonly z: number };
  readonly sizeX: number;
  readonly sizeZ: number;
  readonly height: number;
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
  readonly corners: readonly CornerSpec[];
  readonly wall: ArenaWallSpec;
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
/** How far each stand stops short of the rink corner (leaves concourse gaps). */
export const STAND_CORNER_CUT = 320;

export const CORNER_BLOCK_HEIGHT = 200;
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
const MIN_STAND_LENGTH = 120;

function standLength(edgeExtent: number): number {
  return Math.max(MIN_STAND_LENGTH, edgeExtent - 2 * STAND_CORNER_CUT);
}

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

  const stands: readonly [StandSpec, StandSpec, StandSpec, StandSpec] = [
    {
      id: "south",
      axis: "x",
      direction: -1,
      centerAlong: width / 2,
      length: standLength(width),
      innerEdge: -STAND_SETBACK,
      ...base
    },
    {
      id: "north",
      axis: "x",
      direction: 1,
      centerAlong: width / 2,
      length: standLength(width),
      innerEdge: height + STAND_SETBACK,
      ...base
    },
    {
      id: "west",
      axis: "z",
      direction: -1,
      centerAlong: height / 2,
      length: standLength(height),
      innerEdge: -STAND_SETBACK,
      ...base
    },
    {
      id: "east",
      axis: "z",
      direction: 1,
      centerAlong: height / 2,
      length: standLength(height),
      innerEdge: width + STAND_SETBACK,
      ...base
    }
  ];

  // Dark concourse blocks filling the diagonal gaps between stand ends. They
  // reach exactly to the rink footprint corner (never inside it) and out to
  // the stands' outer extent.
  const outerExtent = STAND_SETBACK + STAND_DEPTH;
  const cornerSize = outerExtent;
  const cornerOffset = -outerExtent / 2;
  const corners: readonly CornerSpec[] = [
    {
      id: "corner-sw",
      center: { x: cornerOffset, z: cornerOffset },
      sizeX: cornerSize,
      sizeZ: cornerSize,
      height: CORNER_BLOCK_HEIGHT
    },
    {
      id: "corner-se",
      center: { x: width - cornerOffset, z: cornerOffset },
      sizeX: cornerSize,
      sizeZ: cornerSize,
      height: CORNER_BLOCK_HEIGHT
    },
    {
      id: "corner-nw",
      center: { x: cornerOffset, z: height - cornerOffset },
      sizeX: cornerSize,
      sizeZ: cornerSize,
      height: CORNER_BLOCK_HEIGHT
    },
    {
      id: "corner-ne",
      center: { x: width - cornerOffset, z: height - cornerOffset },
      sizeX: cornerSize,
      sizeZ: cornerSize,
      height: CORNER_BLOCK_HEIGHT
    }
  ];

  const wall: ArenaWallSpec = {
    minX: -(outerExtent + WALL_MARGIN),
    maxX: width + outerExtent + WALL_MARGIN,
    minZ: -(outerExtent + WALL_MARGIN),
    maxZ: height + outerExtent + WALL_MARGIN,
    height: WALL_HEIGHT,
    thickness: WALL_THICKNESS
  };

  return { stands, corners, wall };
}

/** Outer facing-axis extent of a stand (its back edge coordinate). */
export function standOuterEdge(stand: StandSpec): number {
  return stand.innerEdge + stand.direction * stand.rowCount * stand.rowDepth;
}
