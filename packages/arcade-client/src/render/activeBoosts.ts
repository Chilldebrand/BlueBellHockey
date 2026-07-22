import type { PowerupType, WorldState } from "@bbh/arcade-core";

/**
 * Powerup types badged on a skater's identity disc while their window is
 * active. Goalie resizes are deliberately excluded (they show on the goalie
 * model itself), and freeze never has a sustained window on the picker.
 */
export const DISC_BOOST_TYPES: readonly PowerupType[] = [
  "speed-boost",
  "hard-shot",
  "bulldozer"
];

const DISC_BOOST_SET = new Set<PowerupType>(DISC_BOOST_TYPES);

/**
 * Sustained boosts currently held by a skater, in stable DISC_BOOST_TYPES
 * order (the sim refreshes rather than stacks a re-collected type, so each
 * type appears at most once).
 */
export function activeBoostTypesForSlot(
  world: Pick<WorldState, "activePowerups">,
  slotId: string
): readonly PowerupType[] {
  const held = new Set<PowerupType>();

  for (const powerup of world.activePowerups) {
    if (powerup.slotId === slotId && DISC_BOOST_SET.has(powerup.type)) {
      held.add(powerup.type);
    }
  }

  return DISC_BOOST_TYPES.filter((type) => held.has(type));
}
