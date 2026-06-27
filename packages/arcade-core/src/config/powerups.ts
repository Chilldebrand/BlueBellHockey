import { RINK_CONFIG } from "./rink.js";

export const POWERUP_TYPES = [
  "speed-boost",
  "hard-shot",
  "goalie-freeze",
  "puck-magnet",
  "shield",
  "instant-special"
] as const;

export type PowerupType = (typeof POWERUP_TYPES)[number];

export interface PowerupDefinition {
  readonly type: PowerupType;
  readonly label: string;
  readonly durationMs: number;
}

export const POWERUP_SPAWN_INTERVAL_MS = 10000;
export const POWERUP_PICKUP_RADIUS = 76;

export const POWERUP_DEFINITIONS: Record<PowerupType, PowerupDefinition> = {
  "speed-boost": { type: "speed-boost", label: "Speed", durationMs: 4200 },
  "hard-shot": { type: "hard-shot", label: "Hard Shot", durationMs: 5200 },
  "goalie-freeze": { type: "goalie-freeze", label: "Freeze", durationMs: 2600 },
  "puck-magnet": { type: "puck-magnet", label: "Magnet", durationMs: 4800 },
  shield: { type: "shield", label: "Shield", durationMs: 6500 },
  "instant-special": { type: "instant-special", label: "Special", durationMs: 0 }
};

export const POWERUP_SPAWN_POINTS = [
  { x: RINK_CONFIG.width * 0.34, y: RINK_CONFIG.height * 0.25 },
  { x: RINK_CONFIG.width * 0.66, y: RINK_CONFIG.height * 0.75 },
  { x: RINK_CONFIG.width * 0.5, y: RINK_CONFIG.height * 0.5 }
] as const;

export function powerupTypeForSpawn(seed: number, index: number): PowerupType {
  return POWERUP_TYPES[(seed + index) % POWERUP_TYPES.length] ?? "speed-boost";
}
