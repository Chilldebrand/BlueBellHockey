import { awardStyle, breakCombo } from '../config/charge.js';
import { PUCK_RADIUS, RINK, SKATER_RADIUS } from '../config/rink.js';
import { v, containCircle } from './physics.js';
import { isDisabled } from './skater.js';
import type { SkaterState, SkaterStatus, Vec2, WorldState } from './types.js';

// Arcade feel pass (WO-00): loose pucks slide farther and pickups are forgiving.
const PUCK_FRICTION = 0.82; // per second velocity retention factor base
export const STICK_REACH = SKATER_RADIUS + 0.45;
const PICKUP_RANGE = SKATER_RADIUS + 0.7;
// Bank-play (WO-04): how long after a board bounce a same-team pickup still counts.
const BANK_VALID_MS = 4000;

// Deke / trick (WO-03): how long the lateral carry offset lasts and how far it
// bends. The offset eases out and back over the window so the puck "dangles".
export const DEKE_MS = 220;
export const DEKE_OFFSET = 0.95;

/**
 * World-space position of a carried puck for a skater at (pos, facing). During a
 * deke window the dead-ahead stick anchor bends laterally along (dekeDirX,
 * dekeDirZ) following a sin envelope (0 at the ends, peak mid-window). Shared by
 * the authoritative sim and the client's local-carrier prediction so they agree.
 */
export function carryAnchor(
  pos: Vec2,
  facing: number,
  status: Pick<SkaterStatus, 'dekeUntil' | 'dekeDirX' | 'dekeDirZ'>,
  time: number,
): Vec2 {
  const ahead = v.fromAngle(facing, STICK_REACH);
  let x = pos.x + ahead.x;
  let z = pos.z + ahead.z;
  if (status.dekeUntil > time) {
    const p = Math.max(0, Math.min(1, 1 - (status.dekeUntil - time) / DEKE_MS));
    const env = Math.sin(p * Math.PI); // 0 -> 1 -> 0 across the window
    x += status.dekeDirX * DEKE_OFFSET * env;
    z += status.dekeDirZ * DEKE_OFFSET * env;
  }
  return { x, z };
}

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
      const anchor = carryAnchor(c.pos, c.facing, c.status, world.time);
      puck.pos.x = anchor.x;
      puck.pos.z = anchor.z;
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
  const banked = containCircle(puck.pos, puck.vel, PUCK_RADIUS, 0.7);
  // Mark a board bounce so a later same-team pickup reads as an "off the wall" play.
  // Re-marking on each bounce keeps it to one award per rally (consumed at pickup).
  if (banked && puck.lastTouch) {
    puck.bankedBy = puck.lastTouch;
    puck.bankedAt = world.time;
  }

  // auto-pickup
  if (world.time >= puck.pickupCooldownUntil) {
    const grabber = nearestSkater(world);
    if (grabber) {
      const prevId = puck.lastTouch;
      const prev = prevId ? world.skaters[prevId] : null;
      // Opponent takeaway: whoever last carried the puck loses their combo.
      if (prev && prevId !== grabber.id && prev.team !== grabber.team) breakCombo(prev);
      // Bank-play: a fresh bounce that comes back to the same team scores once.
      if (
        puck.bankedBy &&
        world.time - puck.bankedAt <= BANK_VALID_MS &&
        world.skaters[puck.bankedBy]?.team === grabber.team
      ) {
        world.events.push({ type: 'bank_play', by: grabber.id });
        awardStyle(grabber, 'bank_play', world.time);
      }
      puck.bankedBy = null;
      puck.bankedAt = 0;

      puck.carrier = grabber.id;
      if (prevId && prevId !== grabber.id) {
        if (prev && prev.team === grabber.team) puck.assistTouch = prevId;
        else puck.assistTouch = null;
      }
      puck.lastTouch = grabber.id;
    }
  }
}
