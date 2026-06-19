import { awardStyle, breakCombo } from '../config/charge.js';
import {
  PUCK_RADIUS,
  RINK,
  SKATER_RADIUS,
  attackingGoalX,
  defendingGoalX,
} from '../config/rink.js';
import { v, containCircle, collideNets } from './physics.js';
import { isDisabled } from './skater.js';
import type { SkaterState, SkaterStatus, Vec2, WorldState } from './types.js';

// Arcade feel pass (WO-00): loose pucks slide farther and pickups are forgiving.
const PUCK_FRICTION = 0.82; // per second velocity retention factor base
// Net twine barely rebounds (WO-18): a shot dies in the mesh, a dump-in off the
// back wall stays loose behind the net rather than springing back into the slot.
const NET_RESTITUTION = 0.25;
export const STICK_REACH = SKATER_RADIUS + 0.45;
const PICKUP_RANGE = SKATER_RADIUS + 0.7;
// Bank-play (WO-04): how long after a board bounce a same-team pickup still counts.
const BANK_VALID_MS = 4000;

// Deke / trick (WO-03): how long the lateral carry offset lasts and how far it
// bends. The offset eases out and back over the window so the puck "dangles".
export const DEKE_MS = 220;
export const DEKE_OFFSET = 0.95;

// One-timer (WO-09): window after taking a teammate's pass during which a shot
// counts as a one-timer (bonus power/accuracy + style). Read by actions.doShoot.
export const ONE_TIMER_WINDOW_MS = 550;

// Goalie save (WO-09). A loose puck heading at a defended net, reaching the
// goalie's reach, is stopped: a hard/clean shot pops out a juicy rebound; a soft,
// centered one is covered (the goalie holds it, then clears). The reach is small
// enough that a cross-crease shot the goalie hasn't slid over to still beats him.
const SAVE_REACH = SKATER_RADIUS + 1.3; // ~1.85
const SAVE_ZONE_X = 6; // only act within this of the goal line
const COVER_MAX_SPEED = 14; // below this (and centered) the goalie covers instead of rebounding
const COVER_MAX_OFFSET = 0.8; // puck must be near the goalie's z to be covered
const REBOUND_SPEED_FACTOR = 0.45;
const REBOUND_MIN_SPEED = 7;

/**
 * Goalie stop. Scans goalies; if a loose puck is bearing in on the net within
 * reach, the goalie saves it — covering (becomes carrier) or kicking out a
 * rebound — and a `save` event is emitted. Returns true if a save was made (the
 * caller then skips the normal auto-pickup for this frame).
 */
function goalieSave(world: WorldState): boolean {
  const puck = world.puck;
  for (const g of Object.values(world.skaters)) {
    if (!g.isGoalie) continue;
    if (isDisabled(g, world.time)) continue;
    const defLine = defendingGoalX(g.team);
    // puck must be near the net and travelling toward the goal line
    if (Math.abs(puck.pos.x - defLine) > SAVE_ZONE_X) continue;
    const heading = g.team === 0 ? puck.vel.x < 0 : puck.vel.x > 0;
    if (!heading) continue;
    if (v.dist(puck.pos, g.pos) > SAVE_REACH) continue;

    // a goalie smothering his own team's dump-in isn't a "save" — let pickup handle it
    const shooter = puck.lastTouch;
    const shooterTeam = shooter ? world.skaters[shooter]?.team : undefined;
    if (shooterTeam === g.team) continue;

    const speed = v.len(puck.vel);
    const offset = Math.abs(puck.pos.z - g.pos.z);
    awardStyle(g, 'save', world.time);

    if (speed < COVER_MAX_SPEED && offset < COVER_MAX_OFFSET) {
      // glove/cover: freeze it on the goalie, who clears next (bot logic)
      puck.carrier = g.id;
      puck.lastTouch = g.id;
      puck.assistTouch = null;
      world.events.push({ type: 'save', by: g.id, shooter, rebound: false });
    } else {
      // rebound: pop it back up-ice and off to the side it came from (live scramble)
      const upIce = attackingGoalX(g.team) > 0 ? 1 : -1;
      let lateral = puck.pos.z - g.pos.z;
      if (Math.abs(lateral) < 0.2) lateral = puck.vel.z; // dead-center → keep its drift
      const dir = v.norm({ x: upIce, z: Math.sign(lateral) * 0.8 });
      const out = Math.max(REBOUND_MIN_SPEED, speed * REBOUND_SPEED_FACTOR);
      puck.vel = v.scale(dir, out);
      puck.carrier = null;
      puck.lastTouch = g.id;
      puck.assistTouch = null;
      puck.pickupCooldownUntil = world.time + 120; // a crasher can bang the rebound home
      world.events.push({ type: 'save', by: g.id, shooter, rebound: true });
    }
    return true;
  }
  return false;
}

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
  // Net collision (WO-18): keep the puck out of the net except through the mouth.
  // Twine deadens the puck, so a low restitution — it rattles in rather than springs.
  collideNets(puck.pos, puck.vel, PUCK_RADIUS, NET_RESTITUTION);

  // Goalie save (WO-09): a stop ends the puck's frame here (cover sets a carrier;
  // a rebound leaves it loose but heading back out), skipping the auto-pickup so a
  // saved shot is never instantly re-gathered or counted as a goal.
  if (goalieSave(world)) return;

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
        if (prev && prev.team === grabber.team) {
          puck.assistTouch = prevId;
          // One-timer (WO-09): collecting a teammate's feed arms a brief window in
          // which a shot fires as a bonus one-timer (a real catch-and-release).
          if (!grabber.isGoalie) grabber.status.oneTimerUntil = world.time + ONE_TIMER_WINDOW_MS;
        } else puck.assistTouch = null;
      }
      puck.lastTouch = grabber.id;
    }
  }
}
