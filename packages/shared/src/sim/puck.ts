import { PUCK_RADIUS, RINK, SKATER_RADIUS } from '../config/rink.js';
import { v, containCircle } from './physics.js';
import { isDisabled } from './skater.js';
import type { SkaterState, WorldState } from './types.js';

const PUCK_FRICTION = 0.7; // per second velocity retention factor base
const STICK_REACH = SKATER_RADIUS + 0.45;
const PICKUP_RANGE = SKATER_RADIUS + 0.55;

function nearestSkater(world: WorldState, exclude?: string): SkaterState | null {
  let best: SkaterState | null = null;
  let bestD = Infinity;
  for (const s of Object.values(world.skaters)) {
    if (s.id === exclude) continue;
    if (isDisabled(s, world.time)) continue;
    const d = v.dist(s.pos, world.puck.pos);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best && bestD <= PICKUP_RANGE ? best : null;
}

/** Advance puck physics & possession for dt seconds. Returns false if a goal/reset is pending. */
export function stepPuck(world: WorldState, dt: number): void {
  const puck = world.puck;

  // Magnet ultimate: pull loose puck / strip nearby carrier toward the magnet skater.
  for (const s of Object.values(world.skaters)) {
    if (s.status.magnetUntil <= world.time) continue;
    if (v.dist(s.pos, puck.pos) < 6) {
      if (puck.carrier && puck.carrier !== s.id) {
        const carrier = world.skaters[puck.carrier];
        if (carrier && carrier.team !== s.team) {
          puck.carrier = null;
          puck.pickupCooldownUntil = world.time + 150;
        }
      }
      if (!puck.carrier) {
        const dir = v.norm(v.sub(s.pos, puck.pos));
        puck.vel.x += dir.x * 30 * dt;
        puck.vel.z += dir.z * 30 * dt;
      }
    }
  }

  if (puck.carrier) {
    const c = world.skaters[puck.carrier];
    if (!c || isDisabled(c, world.time)) {
      puck.carrier = null;
      puck.pickupCooldownUntil = world.time + 200;
    } else {
      const ahead = v.fromAngle(c.facing, STICK_REACH);
      puck.pos.x = c.pos.x + ahead.x;
      puck.pos.z = c.pos.z + ahead.z;
      puck.vel.x = c.vel.x;
      puck.vel.z = c.vel.z;
      return;
    }
  }

  // free puck
  const f = Math.pow(PUCK_FRICTION, dt);
  puck.vel.x *= f;
  puck.vel.z *= f;
  puck.pos.x += puck.vel.x * dt;
  puck.pos.z += puck.vel.z * dt;
  containCircle(puck.pos, puck.vel, PUCK_RADIUS, 0.7);

  // auto-pickup
  if (world.time >= puck.pickupCooldownUntil) {
    const grabber = nearestSkater(world);
    if (grabber) {
      puck.carrier = grabber.id;
      if (puck.lastTouch && puck.lastTouch !== grabber.id) {
        const prev = world.skaters[puck.lastTouch];
        if (prev && prev.team === grabber.team) puck.assistTouch = puck.lastTouch;
        else puck.assistTouch = null;
      }
      puck.lastTouch = grabber.id;
    }
  }
}
