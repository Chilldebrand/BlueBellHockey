import { RINK, SKATER_RADIUS } from '../config/rink.js';
import { v } from './physics.js';
import { isDisabled } from './skater.js';
import type { Pickup, SkaterState, WorldState } from './types.js';

// Ice pickups (WO-16): NBA-Street-flavored tokens that spawn in the open ice and
// grant a quick edge — a speed boost or a chunk of ultimate charge — to the first
// skater who glides over one. Server-authoritative (only the server runs step()),
// so the random spawn placement never needs to be deterministic.

export const PICKUP_SPAWN_MS = 9000; // cadence between spawn checks
export const PICKUP_MAX = 2; // never more than this on the ice at once
export const PICKUP_LIFETIME_MS = 16000; // uncollected tokens fade after this
export const PICKUP_GRAB_RADIUS = SKATER_RADIUS + 0.6;
export const PICKUP_BOOST_MULT = 1.5;
export const PICKUP_BOOST_MS = 4000;
export const PICKUP_CHARGE_GAIN = 0.5; // half an ult bar

function spawnPickup(world: WorldState): Pickup {
  // open ice: keep clear of the nets/corners
  const x = (Math.random() * 2 - 1) * RINK.halfLength * 0.55;
  const z = (Math.random() * 2 - 1) * RINK.halfWidth * 0.7;
  const kind = Math.random() < 0.5 ? 'boost' : 'charge';
  return { id: `pk${world.pickupSeq++}`, kind, pos: { x, z }, spawnedAt: world.time };
}

function applyPickup(world: WorldState, s: SkaterState, p: Pickup): void {
  if (p.kind === 'boost') {
    // don't let a token stomp a stronger ult boost — take the better of the two
    s.status.speedMult = Math.max(s.status.speedMult, PICKUP_BOOST_MULT);
    s.status.speedMultUntil = Math.max(s.status.speedMultUntil, world.time + PICKUP_BOOST_MS);
  } else {
    s.ultCharge = Math.min(1, s.ultCharge + PICKUP_CHARGE_GAIN);
  }
}

/** Spawn, expire, and collect ice pickups for this frame. */
export function stepPickups(world: WorldState, dtMs: number): void {
  // expire stale tokens
  if (world.pickups.length) {
    world.pickups = world.pickups.filter((p) => world.time - p.spawnedAt < PICKUP_LIFETIME_MS);
  }

  // periodic spawn
  world.pickupTimer -= dtMs;
  if (world.pickupTimer <= 0) {
    world.pickupTimer = PICKUP_SPAWN_MS;
    if (world.pickups.length < PICKUP_MAX) world.pickups.push(spawnPickup(world));
  }

  // collection — skaters only (not goalies), and not while disabled
  for (const s of Object.values(world.skaters)) {
    if (s.isGoalie || isDisabled(s, world.time)) continue;
    for (let i = world.pickups.length - 1; i >= 0; i--) {
      const p = world.pickups[i];
      if (v.dist(s.pos, p.pos) <= PICKUP_GRAB_RADIUS) {
        applyPickup(world, s, p);
        world.pickups.splice(i, 1);
        world.events.push({ type: 'pickup', by: s.id, kind: p.kind });
      }
    }
  }
}

/** Clear the ice (called on faceoffs so a token doesn't sit through a stoppage). */
export function clearPickups(world: WorldState): void {
  world.pickups = [];
  world.pickupTimer = PICKUP_SPAWN_MS;
}
