/**
 * Deterministic seeded spectator generation for the arena crowd. Pure module,
 * no Three.js and no Math.random — the same layout/seed/detail always yields
 * the identical crowd, and different seeds only restyle fans (never move the
 * count or breach placement bounds, because seat occupancy hashes off a fixed
 * constant rather than the visual seed).
 */

import type { ArenaLayout, StandId, StandSpec } from "./arenaLayout.js";

export type CrowdDetail = "full" | "reduced";
export type ApparelKind = "jersey" | "hoodie" | "jacket" | "street";
export type AccessoryKind = "none" | "beanie" | "cap" | "scarf";

export interface SpectatorInstance {
  readonly standId: StandId;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotationY: number;
  /** Body width multiplier. */
  readonly scaleXZ: number;
  /** Body height multiplier. */
  readonly scaleY: number;
  readonly skinTone: string;
  readonly apparel: ApparelKind;
  readonly apparelColor: string;
  readonly accessory: AccessoryKind;
}

export interface CrowdSpec {
  readonly spectators: readonly SpectatorInstance[];
  readonly countByStand: Readonly<Record<string, number>>;
}

export const FULL_DETAIL_FAN_CAP = 2000;
export const REDUCED_DETAIL_FAN_CAP = 1000;

/** Fixed visual seed for the shipped arena crowd. */
export const ARENA_CROWD_SEED = 20260721;

const SEAT_SPACING = 34;
/** Percent of seats left deterministically empty so rows look organic. */
const EMPTY_SEAT_PERCENT = 8;
/** Occupancy hashes off this fixed constant, NOT the visual seed. */
const OCCUPANCY_SEED = 0x51ab5eed;

/**
 * Muted neutrals and winter colors dominate; restrained blue/red team accents
 * and occasional gold/bright pieces mix in. No section coordination.
 */
export const NEUTRAL_APPAREL_COLORS: readonly string[] = [
  "#8a8f99",
  "#5d6470",
  "#3e4450",
  "#6b5d4f",
  "#8c7a66",
  "#4a5568",
  "#37474f",
  "#7a7265",
  "#9aa1ad",
  "#5c5347",
  "#324a5f",
  "#6e7b8b"
];

export const TEAM_ACCENT_APPAREL_COLORS: readonly string[] = [
  "#1f5fd0",
  "#2b7fff",
  "#16437e",
  "#b3132b",
  "#d8404f",
  "#7e1220"
];

export const BRIGHT_APPAREL_COLORS: readonly string[] = [
  "#d9a441",
  "#c98f2d",
  "#3f9d63",
  "#7a4fbf"
];

export const SKIN_TONES: readonly string[] = [
  "#f2d6c4",
  "#e8bfa1",
  "#d9a184",
  "#c48a63",
  "#9c6b45",
  "#6f4a2f"
];

const APPAREL_KINDS: readonly ApparelKind[] = [
  "jersey",
  "hoodie",
  "jacket",
  "street"
];

const ACCESSORY_KINDS: readonly Exclude<AccessoryKind, "none">[] = [
  "beanie",
  "cap",
  "scarf"
];

/**
 * Deterministic integer mixer in the style of arcade-core's mixSpawnHash:
 * independent salts keep per-attribute choices uncorrelated.
 */
function mixCrowdHash(seed: number, index: number, salt: number): number {
  let h =
    (seed | 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

/** 0..1 float from a hash draw. */
function hashUnit(seed: number, index: number, salt: number): number {
  return mixCrowdHash(seed, index, salt) / 0x100000000;
}

function apparelColorFor(seed: number, index: number): string {
  const roll = mixCrowdHash(seed, index, 4) % 100;
  const palette =
    roll < 68
      ? NEUTRAL_APPAREL_COLORS
      : roll < 88
        ? TEAM_ACCENT_APPAREL_COLORS
        : BRIGHT_APPAREL_COLORS;
  return palette[mixCrowdHash(seed, index, 11) % palette.length]!;
}

function seatWorldPosition(
  stand: StandSpec,
  along: number,
  facing: number,
  elevation: number
): { x: number; y: number; z: number } {
  return stand.axis === "x"
    ? { x: along, y: elevation, z: facing }
    : { x: facing, y: elevation, z: along };
}

export function generateCrowd(
  layout: ArenaLayout,
  seed: number,
  detail: CrowdDetail
): CrowdSpec {
  const cap = detail === "full" ? FULL_DETAIL_FAN_CAP : REDUCED_DETAIL_FAN_CAP;
  const spectators: SpectatorInstance[] = [];
  const countByStand: Record<string, number> = {};

  for (let standIndex = 0; standIndex < layout.stands.length; standIndex += 1) {
    const stand = layout.stands[standIndex]!;
    countByStand[stand.id] = 0;
    const seatsPerRow = Math.max(1, Math.floor(stand.length / SEAT_SPACING));
    const rowStart = stand.centerAlong - stand.length / 2;

    for (let row = 0; row < stand.rowCount; row += 1) {
      for (let seat = 0; seat < seatsPerRow; seat += 1) {
        // Unique fan index across the whole bowl (seatsPerRow stays < 1024
        // for any plausible rink, and row < 32).
        const index = (standIndex * 32 + row) * 1024 + seat;

        // Occupancy is seed-independent so restyling never changes the count.
        if (mixCrowdHash(OCCUPANCY_SEED, index, 1) % 100 < EMPTY_SEAT_PERCENT) {
          continue;
        }
        if (detail === "reduced" && seat % 2 === 1) {
          continue;
        }

        const jitterAlong = (hashUnit(seed, index, 7) - 0.5) * 16;
        const jitterFacing = (hashUnit(seed, index, 8) - 0.5) * 10;
        const along =
          rowStart + SEAT_SPACING * (seat + 0.5) + jitterAlong;
        const facing =
          stand.innerEdge +
          stand.direction * (stand.rowDepth * (row + 0.5) + jitterFacing);
        const elevation = stand.baseHeight + row * stand.rowRise;

        // Fans face back toward the rink with a small deterministic wobble.
        const faceAngle =
          stand.axis === "x"
            ? stand.direction === -1
              ? 0
              : Math.PI
            : stand.direction === -1
              ? Math.PI / 2
              : -Math.PI / 2;

        spectators.push({
          standId: stand.id,
          position: seatWorldPosition(stand, along, facing, elevation),
          rotationY: faceAngle + (hashUnit(seed, index, 9) - 0.5) * 0.3,
          scaleXZ: 0.9 + hashUnit(seed, index, 6) * 0.25,
          scaleY: 0.9 + hashUnit(seed, index, 10) * 0.3,
          skinTone: SKIN_TONES[mixCrowdHash(seed, index, 2) % SKIN_TONES.length]!,
          apparel: APPAREL_KINDS[mixCrowdHash(seed, index, 3) % APPAREL_KINDS.length]!,
          apparelColor: apparelColorFor(seed, index),
          accessory:
            detail === "reduced" || mixCrowdHash(seed, index, 5) % 100 < 76
              ? "none"
              : ACCESSORY_KINDS[
                  mixCrowdHash(seed, index, 12) % ACCESSORY_KINDS.length
                ]!
        });
        countByStand[stand.id] = (countByStand[stand.id] ?? 0) + 1;
      }
    }
  }

  // Density changes can never create an unbounded instance count.
  const capped = spectators.slice(0, cap);
  if (capped.length < spectators.length) {
    for (const dropped of spectators.slice(cap)) {
      countByStand[dropped.standId] = (countByStand[dropped.standId] ?? 1) - 1;
    }
  }

  return { spectators: capped, countByStand };
}
