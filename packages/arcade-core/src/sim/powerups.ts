import {
  POWERUP_DEFINITIONS,
  POWERUP_PICKUP_RADIUS,
  POWERUP_SPAWN_INTERVAL_MS,
  POWERUP_SPAWN_POINTS,
  powerupTypeForSpawn
} from "../config/powerups.js";
import type { InputFrame, SkaterEntity, WorldState } from "./types.js";
import { magnitude } from "./physics.js";

export function stepPowerups(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>
): void {
  expireActivePowerups(world);
  spawnPowerups(world);
  pickUpPowerups(world);
  useHeldPowerups(world, inputsBySlot);
  chargeSpecials(world);
}

function spawnPowerups(world: WorldState): void {
  const spawnIndex = Math.floor(world.time.nowMs / POWERUP_SPAWN_INTERVAL_MS);
  const existingSpawnIndex = world.powerupPickups.some((pickup) =>
    pickup.id.includes(`spawn-${spawnIndex}`)
  );

  if (world.time.nowMs === 0 || existingSpawnIndex) {
    return;
  }

  const point = POWERUP_SPAWN_POINTS[spawnIndex % POWERUP_SPAWN_POINTS.length];
  if (!point) {
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
    id: `powerup-spawn-${world.time.tick}`,
    type: "powerupSpawn",
    atMs: world.time.nowMs,
    targetSlotId: type
  });
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

    if (powerupType === "instant-special") {
      skater.specialCharge = 1;
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
