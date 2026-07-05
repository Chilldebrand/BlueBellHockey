import type { SkaterEntity, WorldState } from "./types.js";

/**
 * Madden-style control switching lives OUTSIDE the deterministic world: the sim
 * never knows who is "controlled". These are pure helpers a controller (the
 * Colyseus room, or the client-only Free Skate sim) calls to decide which slot
 * a human should be driving. They only read world state and return a slot id.
 */

function findSkater(
  world: WorldState,
  slotId: string | null
): SkaterEntity | null {
  if (!slotId) {
    return null;
  }
  return world.skaters.find((skater) => skater.id === slotId) ?? null;
}

/**
 * Switch-on-reception: returns the teammate who just gathered a pass thrown by
 * the controlled skater, so control can snap to them. Fires exactly once —
 * `carrierSlotId` only changes on the reception tick, so comparing the pre-step
 * carrier (the passer) to the post-step carrier (the receiver) is the reliable
 * signal. (Do NOT key off `puck.passedFromSlotId`; it is nulled the instant the
 * pass is gathered, so it would never be readable here.)
 *
 * @param world post-step world
 * @param controlledSlotId the slot the human currently drives
 * @param prevCarrierSlotId `world.puck.carrierSlotId` captured BEFORE the step
 * @returns the receiver's slot id, or null when no switch should happen
 */
export function resolveReceptionSwitch(
  world: WorldState,
  controlledSlotId: string,
  prevCarrierSlotId: string | null
): string | null {
  const newCarrier = world.puck.carrierSlotId;

  // The human's skater must have been the one holding the puck (i.e. the passer)
  // and must no longer be holding it.
  if (
    prevCarrierSlotId !== controlledSlotId ||
    !newCarrier ||
    newCarrier === controlledSlotId
  ) {
    return null;
  }

  const controlled = findSkater(world, controlledSlotId);
  const receiver = findSkater(world, newCarrier);

  if (!controlled || !receiver || receiver.teamId !== controlled.teamId) {
    return null;
  }

  return receiver.id;
}

/**
 * Nearest same-team, non-goalie skater to the puck, excluding the currently
 * controlled slot. Used for the manual (pass-button-as-switch) defensive swap.
 * Returns null when there is no other eligible teammate.
 */
export function nearestTeammateToPuck(
  world: WorldState,
  controlledSlotId: string
): string | null {
  const controlled = findSkater(world, controlledSlotId);
  if (!controlled) {
    return null;
  }

  const puck = world.puck.position;
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const skater of world.skaters) {
    if (skater.id === controlledSlotId || skater.teamId !== controlled.teamId) {
      continue;
    }

    const candidateDistance = Math.hypot(
      skater.position.x - puck.x,
      skater.position.y - puck.y
    );
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestId = skater.id;
    }
  }

  return bestId;
}

/**
 * Manual switch target for a pass-button press: only switches when the human is
 * NOT the puck carrier (when carrying, the pass button passes instead). Returns
 * the same-team skater nearest the puck, or null when no switch should happen.
 */
export function resolveManualSwitchTarget(
  world: WorldState,
  controlledSlotId: string
): string | null {
  if (world.puck.carrierSlotId === controlledSlotId) {
    return null;
  }

  return nearestTeammateToPuck(world, controlledSlotId);
}
