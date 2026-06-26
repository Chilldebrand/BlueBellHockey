import { getCharacter } from '../config/characters.js';
import { SKATER_RADIUS } from '../config/rink.js';
import { v, containCircle } from './physics.js';
import { RINK } from '../config/rink.js';
import type { AttributeKey, InputState, SkaterState, WorldState } from './types.js';

export function effectiveAttr(s: SkaterState, key: AttributeKey): number {
  const base = getCharacter(s.characterId).attrs[key];
  return Math.max(1, Math.min(12, base + s.status.attrBonus));
}

export function isDisabled(s: SkaterState, time: number): boolean {
  return (
    s.status.frozenUntil > time ||
    s.status.staggeredUntil > time
  );
}

// Penalty box (WO-17): a boxed skater sits just outside the boards on their bench
// side, out of the play, until the penalty expires.
export function penaltyBoxPos(team: number): { x: number; z: number } {
  return { x: team === 0 ? -8 : 8, z: team === 0 ? -(RINK.halfWidth + 1.6) : RINK.halfWidth + 1.6 };
}

// Arcade feel pass (WO-00): faster top speed, snappier accel, longer glide.
export const BASE_SPEED = 7;
export const SPEED_PER_POINT = 0.9;
const ACCEL = 30;
const FRICTION = 7;
export const SPRINT_MULT = 1.18;

// Commitment window (ms) after which winding up a slap shot starts to root you.
export const SLAP_COMMIT_MS = 140;

export function maxSpeedOf(s: SkaterState, carrying: boolean, time = -1, sprinting = false): number {
  const sp = effectiveAttr(s, 'speed');
  let m = (BASE_SPEED + sp * SPEED_PER_POINT) * s.status.speedMult;
  if (sprinting) m *= SPRINT_MULT;
  if (carrying) m *= 0.92;
  // Deke (WO-03): trade a little speed for separation while the dangle is live.
  if (time >= 0 && s.status.dekeUntil > time) m *= 0.9;
  // Slap shot (WO-08): once a wind-up passes the commit window you're slowed, so a
  // charged slapper is telegraphed and a defender can close to interrupt it.
  if (time >= 0 && s.status.shootChargeStart > 0 && time - s.status.shootChargeStart > SLAP_COMMIT_MS) {
    m *= 0.6;
  }
  return m;
}

/** Integrate one skater's movement for dt seconds. */
export function stepSkater(
  world: WorldState,
  s: SkaterState,
  input: InputState,
  dt: number,
): void {
  const carrying = world.puck.carrier === s.id;
  const disabled = isDisabled(s, world.time);

  const windupGlide =
    s.status.shootChargeStart > 0 && carrying && !disabled
      ? { x: s.status.shootGlideDirX, z: s.status.shootGlideDirZ }
      : null;
  const move = windupGlide && v.len(windupGlide) > 0.05 ? windupGlide : input.move;
  const moveLen = v.len(move);
  if (!disabled && moveLen > 0.05) {
    const dir = v.norm(move);
    const target = v.scale(dir, maxSpeedOf(s, carrying, world.time, !windupGlide && input.actions.sprint));
    s.vel.x += (target.x - s.vel.x) * Math.min(1, ACCEL * dt);
    s.vel.z += (target.z - s.vel.z) * Math.min(1, ACCEL * dt);
  } else {
    const decel = disabled ? FRICTION * 2.5 : FRICTION;
    const f = Math.max(0, 1 - decel * dt);
    s.vel.x *= f;
    s.vel.z *= f;
  }

  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.z * dt;
  containCircle(s.pos, s.vel, SKATER_RADIUS, RINK.boardRestitution);

  // facing: travel direction when moving, else aim
  if (v.len(s.vel) > 0.4) s.facing = v.angle(s.vel);
  else if (v.len(input.aim) > 0.1) s.facing = v.angle(input.aim);
}
