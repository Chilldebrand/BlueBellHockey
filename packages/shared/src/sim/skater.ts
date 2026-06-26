import { getCharacter } from '../config/characters.js';
import { RINK, SKATER_RADIUS } from '../config/rink.js';
import { v, containCircle } from './physics.js';
import type { AttributeKey, InputState, SkaterState, WorldState } from './types.js';

export function effectiveAttr(s: SkaterState, key: AttributeKey): number {
  const base = getCharacter(s.characterId).attrs[key];
  return Math.max(1, Math.min(12, base + s.status.attrBonus));
}

export function isDisabled(s: SkaterState, time: number): boolean {
  return (
    s.status.frozenUntil > time ||
    s.status.staggeredUntil > time ||
    s.status.downedUntil > time
  );
}

// Arcade feel pass (WO-00): faster top speed, snappier accel, longer glide.
export const BASE_SPEED = 6.2;
export const SPEED_PER_POINT = 0.88;
const ACCEL = 30;
const FRICTION = 7;
export const SPRINT_MULT = 1.14;
const SPRINT_TURN_ACCEL_MULT = 0.45;
export const CARRY_SPEED_MULT = 0.92;
export const SPRINT_CARRY_SPEED_MULT = 0.84;
export const POKE_RECOVERY_SPEED_MULT = 0.82;

// Commitment window (ms) after which winding up a slap shot starts to root you.
export const SLAP_COMMIT_MS = 140;

export function maxSpeedOf(s: SkaterState, carrying: boolean, time = -1, sprinting = false): number {
  const sp = effectiveAttr(s, 'speed');
  let m = (BASE_SPEED + sp * SPEED_PER_POINT) * s.status.speedMult;
  if (sprinting) m *= SPRINT_MULT;
  if (carrying) m *= sprinting ? SPRINT_CARRY_SPEED_MULT : CARRY_SPEED_MULT;
  // Deke (WO-03): trade a little speed for separation while the dangle is live.
  if (time >= 0 && s.status.dekeUntil > time) m *= 0.9;
  if (time >= 0 && s.status.pokeCooldownUntil > time) m *= POKE_RECOVERY_SPEED_MULT;
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
    const sprinting = !windupGlide && input.actions.sprint;
    const target = v.scale(dir, maxSpeedOf(s, carrying, world.time, sprinting));
    const turningHard = sprinting && v.len(s.vel) > 0.5 && v.dot(v.norm(s.vel), dir) < 0.85;
    const accel = ACCEL * (turningHard ? SPRINT_TURN_ACCEL_MULT : 1);
    s.vel.x += (target.x - s.vel.x) * Math.min(1, accel * dt);
    s.vel.z += (target.z - s.vel.z) * Math.min(1, accel * dt);
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
