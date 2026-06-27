import { CHARACTER_SPECIALS } from "../config/specials.js";
import type { InputFrame, WorldState } from "./types.js";

const DEFAULT_SPECIAL = CHARACTER_SPECIALS[0];

export function resolveSpecials(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>
): void {
  for (const skater of world.skaters) {
    const input = inputsBySlot.get(skater.id);
    if (!input?.special || skater.specialCharge < DEFAULT_SPECIAL.chargeRequired) {
      continue;
    }

    if (world.time.nowMs < skater.specialCooldownUntilMs) {
      continue;
    }

    skater.specialCharge = 0;
    skater.specialCooldownUntilMs =
      world.time.nowMs + DEFAULT_SPECIAL.cooldownMs;
    world.activePowerups.push({
      id: `special-${world.time.tick}-${skater.id}`,
      type: "speed-boost",
      slotId: skater.id,
      position: null,
      expiresAtMs: world.time.nowMs + DEFAULT_SPECIAL.durationMs
    });
    skater.turboMeter = 1;
    world.eventQueue.push({
      id: `special-use-${world.time.tick}-${skater.id}`,
      type: "specialUse",
      atMs: world.time.nowMs,
      sourceSlotId: skater.id,
      targetSlotId: DEFAULT_SPECIAL.id
    });
  }
}
