import type { SkaterEntity, WorldState } from "./types.js";

export interface CollisionConfig {
  readonly skaterRadius: number;
  readonly goalieRadius: number;
  /** Normal restitution for body-on-body contact — low, bodies absorb. */
  readonly restitution: number;
  /** Closing speed against a carrier that jostles the puck off the tether. */
  readonly jostleStripSpeed: number;
  /** Speed given to a jostled-loose puck along the contact normal. */
  readonly jostleImpulse: number;
}

export const COLLISION_CONFIG: CollisionConfig = {
  skaterRadius: 38,
  goalieRadius: 42,
  restitution: 0.25,
  jostleStripSpeed: 430,
  jostleImpulse: 260
};

/**
 * Skater-skater circle collisions: equal-mass positional separation plus a
 * low-restitution impulse, so players can't overlap and incidental contact
 * reads as a bump, not a teleport. A hard bump into the puck carrier jostles
 * the puck off the tether (body defense without pressing anything). Skaters
 * also can't stand inside their (immovable) goalies.
 */
export function resolveSkaterCollisions(
  world: WorldState,
  config: CollisionConfig = COLLISION_CONFIG
): void {
  const skaters = world.skaters;

  for (let a = 0; a < skaters.length; a += 1) {
    for (let b = a + 1; b < skaters.length; b += 1) {
      collideSkaterPair(world, skaters[a], skaters[b], config);
    }
  }

  for (const skater of skaters) {
    for (const goalie of world.goalies) {
      pushOutOfGoalie(skater, goalie.position, config);
    }
  }
}

function collideSkaterPair(
  world: WorldState,
  first: SkaterEntity,
  second: SkaterEntity,
  config: CollisionConfig
): void {
  const minDistance = config.skaterRadius * 2;
  const offsetX = second.position.x - first.position.x;
  const offsetY = second.position.y - first.position.y;
  const distance = Math.hypot(offsetX, offsetY);

  if (distance >= minDistance) {
    return;
  }

  // Degenerate overlap (same point): separate along x deterministically.
  const normalX = distance > 1e-6 ? offsetX / distance : 1;
  const normalY = distance > 1e-6 ? offsetY / distance : 0;
  const overlap = minDistance - distance;

  first.position.x -= normalX * overlap * 0.5;
  first.position.y -= normalY * overlap * 0.5;
  second.position.x += normalX * overlap * 0.5;
  second.position.y += normalY * overlap * 0.5;

  const closingSpeed =
    (first.velocity.x - second.velocity.x) * normalX +
    (first.velocity.y - second.velocity.y) * normalY;

  if (closingSpeed <= 0) {
    return; // already separating
  }

  const impulse = (closingSpeed * (1 + config.restitution)) / 2;
  first.velocity.x -= normalX * impulse;
  first.velocity.y -= normalY * impulse;
  second.velocity.x += normalX * impulse;
  second.velocity.y += normalY * impulse;

  jostleCarrier(world, first, second, closingSpeed, normalX, normalY, config);
}

function jostleCarrier(
  world: WorldState,
  first: SkaterEntity,
  second: SkaterEntity,
  closingSpeed: number,
  normalX: number,
  normalY: number,
  config: CollisionConfig
): void {
  if (closingSpeed < config.jostleStripSpeed) {
    return;
  }

  const carrierId = world.puck.carrierSlotId;
  const carrier =
    carrierId === first.id ? first : carrierId === second.id ? second : null;
  const bumper = carrier === first ? second : first;

  if (!carrier || bumper.teamId === carrier.teamId) {
    return;
  }

  // Knocked off the stick, not stolen: the puck pops loose along the hit.
  const direction = carrier === first ? 1 : -1;
  world.puck.carrierSlotId = null;
  world.puck.pickupDisabledForSlotId = carrier.id;
  world.puck.pickupDisabledUntilMs = world.time.nowMs + 220;
  world.puck.velocity.x += normalX * config.jostleImpulse * direction;
  world.puck.velocity.y += normalY * config.jostleImpulse * direction;
  world.eventQueue.push({
    id: `jostle-${world.time.tick}-${carrier.id}`,
    type: "jostle",
    atMs: world.time.nowMs,
    sourceSlotId: bumper.id,
    targetSlotId: carrier.id,
    force: closingSpeed
  });
}

function pushOutOfGoalie(
  skater: SkaterEntity,
  goaliePosition: { x: number; y: number },
  config: CollisionConfig
): void {
  const minDistance = config.skaterRadius + config.goalieRadius;
  const offsetX = skater.position.x - goaliePosition.x;
  const offsetY = skater.position.y - goaliePosition.y;
  const distance = Math.hypot(offsetX, offsetY);

  if (distance >= minDistance) {
    return;
  }

  const normalX = distance > 1e-6 ? offsetX / distance : 1;
  const normalY = distance > 1e-6 ? offsetY / distance : 0;

  // The goalie holds his crease: the skater takes the full push-out.
  skater.position.x = goaliePosition.x + normalX * minDistance;
  skater.position.y = goaliePosition.y + normalY * minDistance;

  const into =
    skater.velocity.x * normalX + skater.velocity.y * normalY;

  if (into < 0) {
    skater.velocity.x -= normalX * into;
    skater.velocity.y -= normalY * into;
  }
}
