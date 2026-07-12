import {
  BANANA_LIFETIME_MS,
  BANANA_SLIP_MS,
  BANANA_SLIP_SLIDE,
  BANANA_TRIP_RADIUS,
  POWERUP_DEFINITIONS,
  POWERUP_PICKUP_RADIUS,
  POWERUP_SPAWN_INTERVAL_MS,
  POWERUP_SPAWN_POINTS,
  isBananaSpawn,
  powerupTypeForSpawn,
  type PowerupType
} from "../config/powerups.js";
import type { InputFrame, SkaterEntity, WorldState } from "./types.js";
import { magnitude, normalizeOrZero } from "./physics.js";

/** How long a frozen skater stays an ice block. */
export const FREEZE_DURATION_MS = 5000;

/**
 * Whether a skater currently has an active (unexpired) powerup of this type.
 * The active list is expired-filtered each tick, so a hit here means "in
 * effect right now". This is the read side of `world.activePowerups` — every
 * sustained powerup effect (speed, hard-shot, bulldozer) consumes it.
 */
export function hasActivePowerup(
  world: WorldState,
  slotId: string,
  type: PowerupType
): boolean {
  return world.activePowerups.some(
    (powerup) => powerup.slotId === slotId && powerup.type === type
  );
}

export function stepPowerups(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>
): void {
  expireActivePowerups(world);
  spawnPowerups(world);
  pickUpPowerups(world);
  useHeldPowerups(world, inputsBySlot);
  stepBananaPeels(world);
  chargeSpecials(world);
}

function spawnPowerups(world: WorldState): void {
  const latestDueIndex =
    Math.floor(world.time.nowMs / POWERUP_SPAWN_INTERVAL_MS) - 1;
  for (
    let spawnIndex = world.lastPowerupSpawnIndex + 1;
    spawnIndex <= latestDueIndex;
    spawnIndex += 1
  ) {
    spawnPowerupAtIndex(world, spawnIndex);
    world.lastPowerupSpawnIndex = spawnIndex;
  }
}

function spawnPowerupAtIndex(world: WorldState, spawnIndex: number): void {
  const point = POWERUP_SPAWN_POINTS[spawnIndex % POWERUP_SPAWN_POINTS.length];
  if (!point) {
    return;
  }

  // Every Nth spawn is a banana peel hazard instead of a collectible powerup.
  if (isBananaSpawn(world.seed, spawnIndex)) {
    world.bananaPeels.push({
      id: `banana-spawn-${spawnIndex}`,
      position: { x: point.x, y: point.y },
      spawnedAtMs: world.time.nowMs
    });
    world.eventQueue.push({
      id: `banana-spawn-${world.time.tick}-${spawnIndex}`,
      type: "bananaSpawn",
      atMs: world.time.nowMs
    });
    return;
  }

  const type = powerupTypeForSpawn(world.seed, spawnIndex);
  world.powerupPickups.push({
    id: `powerup-spawn-${spawnIndex}-${type}`,
    type,
    position: { x: point.x, y: point.y },
    spawnedAtMs: world.time.nowMs
  });
  world.eventQueue.push({
    id: `powerup-spawn-${world.time.tick}-${spawnIndex}`,
    type: "powerupSpawn",
    atMs: world.time.nowMs,
    targetSlotId: type
  });
}

/**
 * Banana peels: rot away after their lifetime, and the first ready skater to
 * skate within trip range of one wipes out (full knockdown), dropping the puck
 * if they were carrying. No owner — anyone can slip. Deterministic (iterates
 * skaters in world order; the peel is consumed by the first it catches).
 */
function stepBananaPeels(world: WorldState): void {
  const now = world.time.nowMs;

  world.bananaPeels = world.bananaPeels.filter(
    (peel) => now - peel.spawnedAtMs < BANANA_LIFETIME_MS
  );

  const survivors: typeof world.bananaPeels = [];
  for (const peel of world.bananaPeels) {
    const victim = world.skaters.find(
      (skater) =>
        skater.contactState === "ready" &&
        magnitude({
          x: peel.position.x - skater.position.x,
          y: peel.position.y - skater.position.y
        }) <= BANANA_TRIP_RADIUS
    );

    if (!victim) {
      survivors.push(peel);
      continue;
    }

    // Wipeout: skid out in the direction they were travelling and fall.
    const slide = normalizeOrZero(victim.velocity);
    victim.contactState = "knockedDown";
    victim.contactStateUntilMs = now + BANANA_SLIP_MS;
    victim.velocity = {
      x: slide.x * BANANA_SLIP_SLIDE,
      y: slide.y * BANANA_SLIP_SLIDE
    };

    if (world.puck.carrierSlotId === victim.id) {
      world.puck.carrierSlotId = null;
      world.puck.lastTouchSlotId = victim.id;
      world.puck.assistCandidateSlotId = null;
      world.puck.pickupDisabledForSlotId = victim.id;
      world.puck.pickupDisabledUntilMs = now + 250;
    }

    world.eventQueue.push({
      id: `banana-slip-${world.time.tick}-${victim.id}`,
      type: "bananaSlip",
      atMs: now,
      targetSlotId: victim.id
    });
    // Peel consumed — not pushed to survivors.
  }
  world.bananaPeels = survivors;
}

function pickUpPowerups(world: WorldState): void {
  for (const skater of world.skaters) {
    if (skater.heldPowerupType) {
      continue;
    }

    const pickup = world.powerupPickups.find(
      (candidate) =>
        magnitude({
          x: candidate.position.x - skater.position.x,
          y: candidate.position.y - skater.position.y
        }) <= POWERUP_PICKUP_RADIUS
    );

    if (!pickup) {
      continue;
    }

    skater.heldPowerupType = pickup.type;
    world.powerupPickups = world.powerupPickups.filter(
      (candidate) => candidate.id !== pickup.id
    );
    world.eventQueue.push({
      id: `powerup-pickup-${world.time.tick}-${skater.id}`,
      type: "powerupPickup",
      atMs: world.time.nowMs,
      sourceSlotId: skater.id,
      targetSlotId: pickup.type
    });
  }
}

function useHeldPowerups(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>
): void {
  for (const skater of world.skaters) {
    const input = inputsBySlot.get(skater.id);
    if (!input?.usePowerup || !skater.heldPowerupType) {
      continue;
    }

    const powerupType = skater.heldPowerupType;
    skater.heldPowerupType = null;

    if (powerupType === "freeze") {
      // Freeze doesn't buff the user — it turns a random opponent into an
      // ice block. No active-window entry for the user.
      freezeRandomOpponent(world, skater);
    } else {
      world.activePowerups.push({
        id: `active-${world.time.tick}-${skater.id}-${powerupType}`,
        type: powerupType,
        slotId: skater.id,
        position: null,
        expiresAtMs:
          world.time.nowMs + POWERUP_DEFINITIONS[powerupType].durationMs
      });
      applyImmediateEffect(skater, powerupType);
    }

    world.eventQueue.push({
      id: `powerup-use-${world.time.tick}-${skater.id}`,
      type: "powerupUse",
      atMs: world.time.nowMs,
      sourceSlotId: skater.id,
      targetSlotId: powerupType
    });
  }
}

function applyImmediateEffect(skater: SkaterEntity, powerupType: string): void {
  if (powerupType === "speed-boost") {
    skater.turboMeter = 1;
    skater.velocity = {
      x: skater.velocity.x * 1.18,
      y: skater.velocity.y * 1.18
    };
  }
}

/**
 * Freeze a random opposing SKATER (never the goalie) into an ice block for
 * FREEZE_DURATION_MS. The pick is seeded off (seed, tick) so it's fully
 * deterministic — replays stay byte-identical. If the chosen target is
 * carrying the puck, it pops loose (an ice block can't stickhandle).
 */
function freezeRandomOpponent(world: WorldState, user: SkaterEntity): void {
  const now = world.time.nowMs;
  const opponents = world.skaters
    .filter(
      (skater) =>
        skater.teamId !== user.teamId && skater.contactState !== "knockedDown"
    )
    // Stable order so the seeded index is reproducible regardless of array order.
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (opponents.length === 0) {
    return;
  }

  const target = opponents[(world.seed + world.time.tick) % opponents.length];
  if (!target) {
    return;
  }

  target.contactState = "frozen";
  target.contactStateUntilMs = now + FREEZE_DURATION_MS;
  target.velocity = { x: 0, y: 0 };

  if (world.puck.carrierSlotId === target.id) {
    world.puck.carrierSlotId = null;
    world.puck.lastTouchSlotId = target.id;
    world.puck.assistCandidateSlotId = null;
    world.puck.pickupDisabledForSlotId = target.id;
    world.puck.pickupDisabledUntilMs = now + 250;
  }

  world.eventQueue.push({
    id: `freeze-${world.time.tick}-${target.id}`,
    type: "freeze",
    atMs: now,
    sourceSlotId: user.id,
    targetSlotId: target.id
  });
}

function chargeSpecials(world: WorldState): void {
  for (const skater of world.skaters) {
    skater.specialCharge = Math.min(1, skater.specialCharge + 0.004);
  }
}

function expireActivePowerups(world: WorldState): void {
  world.activePowerups = world.activePowerups.filter(
    (powerup) => powerup.expiresAtMs > world.time.nowMs
  );
}
