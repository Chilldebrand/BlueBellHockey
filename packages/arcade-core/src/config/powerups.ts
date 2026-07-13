import { RINK_CONFIG } from "./rink.js";

export const POWERUP_TYPES = [
  "speed-boost",
  "hard-shot",
  "freeze",
  "bulldozer",
  "mini-goalie",
  "giant-goalie"
] as const;

export type PowerupType = (typeof POWERUP_TYPES)[number];

export interface PowerupDefinition {
  readonly type: PowerupType;
  readonly label: string;
  readonly durationMs: number;
}

export const POWERUP_SPAWN_INTERVAL_MS = 9000;
export const POWERUP_PICKUP_RADIUS = 80;

export const POWERUP_DEFINITIONS: Record<PowerupType, PowerupDefinition> = {
  "speed-boost": { type: "speed-boost", label: "Speed", durationMs: 3600 },
  "hard-shot": { type: "hard-shot", label: "Hard Shot", durationMs: 4300 },
  // Freeze locks a random opponent as an ice block; the duration is the freeze
  // length applied to that target (not an aura on the user).
  freeze: { type: "freeze", label: "Freeze", durationMs: 5000 },
  // Big Hit: turns the user into a wrecking ball for its duration.
  bulldozer: { type: "bulldozer", label: "Big Hit", durationMs: 4000 },
  // Mini Goalie: shrinks the OPPOSING goalie so the user scores easier.
  "mini-goalie": { type: "mini-goalie", label: "Mini Goalie", durationMs: 8000 },
  // Giant Goalie: grows the user's OWN goalie into a wall for its duration.
  "giant-goalie": {
    type: "giant-goalie",
    label: "Giant Goalie",
    durationMs: 10000
  }
};

export const POWERUP_SPAWN_POINTS = [
  { x: RINK_CONFIG.width * 0.34, y: RINK_CONFIG.height * 0.25 },
  { x: RINK_CONFIG.width * 0.66, y: RINK_CONFIG.height * 0.75 },
  { x: RINK_CONFIG.width * 0.5, y: RINK_CONFIG.height * 0.5 }
] as const;

/**
 * Deterministic integer mixer for spawn decisions (replay-safe, no
 * Math.random). The old linear `(seed + index) % n` selection was correlated
 * with the round-robin spawn point (`index % 3`): one point was permanently
 * all bananas, each other point only ever offered two fixed types, and the
 * two types whose indices matched the banana residue — speed-boost and
 * bulldozer — could NEVER spawn, for any seed.
 */
function mixSpawnHash(seed: number, index: number, salt: number): number {
  let h = (seed | 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

export function powerupTypeForSpawn(seed: number, index: number): PowerupType {
  return (
    POWERUP_TYPES[mixSpawnHash(seed, index, 2) % POWERUP_TYPES.length] ??
    "speed-boost"
  );
}

// Banana peel hazard: spawns on the same cadence/points as powerups, but every
// Nth spawn is a banana peel instead of a collectible powerup.
export const BANANA_SPAWN_EVERY = 3;
/** Skater-to-peel distance that triggers a wipeout. */
export const BANANA_TRIP_RADIUS = 46;
/** How long an untouched peel sits before it rots away. */
export const BANANA_LIFETIME_MS = 14000;
/** How long a slipped skater stays down. */
export const BANANA_SLIP_MS = 900;
/** Slide speed imparted by the slip (they skid out from under themselves). */
export const BANANA_SLIP_SLIDE = 260;

/**
 * Whether the spawn at this index drops a banana peel (hazard) instead of a
 * collectible powerup. Deterministic from the seed so replays stay identical.
 * Hashed independently of the type/point selection so bananas land on every
 * spawn point over a match instead of claiming one point forever.
 */
export function isBananaSpawn(seed: number, index: number): boolean {
  return mixSpawnHash(seed, index, 1) % BANANA_SPAWN_EVERY === 0;
}
