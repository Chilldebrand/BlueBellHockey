import {
  getCharacterById,
  type CharacterId,
  type CharacterStatKey
} from "../config/characters.js";

/**
 * Character-stat gameplay scaling. Every stat (0-5) maps to a multiplier
 * centered on 1.0 at stat 2.5, spanning `spread` from stat 0 to stat 5 —
 * deliberately small bands so no character is a must-pick, but every stat on
 * the card is real. Power/balance keep their original checking formulas in
 * actions.ts; these spreads cover the other four.
 *
 * All math is pure integer-stat arithmetic — deterministic and replay-safe.
 */

/** Skating top speed + acceleration: ±3%. */
export const SPEED_STAT_SPREAD = 0.06;
/** Wrist/slap/one-timer release velocity: ±5% (lift untouched). */
export const SHOT_STAT_SPREAD = 0.1;
/** Pass velocity, tap and charged: ±5%. */
export const PASS_STAT_SPREAD = 0.1;
/** Puck security: carry tether tolerance + gather radius: ±6%. */
export const HANDLING_STAT_SPREAD = 0.12;

/** 1 + (stat/5 - 0.5) * spread — stat 0 → 1-spread/2, stat 5 → 1+spread/2. */
export function statMultiplier(stat: number, spread: number): number {
  return 1 + (stat / 5 - 0.5) * spread;
}

export function characterStatMultiplier(
  characterId: CharacterId,
  statKey: CharacterStatKey,
  spread: number
): number {
  return statMultiplier(getCharacterById(characterId).stats[statKey], spread);
}
