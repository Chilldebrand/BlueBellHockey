import { awardCharge, awardStyle, breakCombo } from '../config/charge.js';
import { getCharacter } from '../config/characters.js';
import { attackingGoalX, RINK, SKATER_RADIUS } from '../config/rink.js';
import { getUltimate } from '../config/ultimates.js';
import { v } from './physics.js';
import { DEKE_MS, ONE_TIMER_WINDOW_MS } from './puck.js';
import { effectiveAttr, isDisabled } from './skater.js';
import type { InputState, SimEvent, SkaterState, WorldState } from './types.js';

const HIT_RANGE = SKATER_RADIUS * 2 + 0.9;
const KNOCKDOWN_MS = 950;
const KNOCKDOWN_MARGIN = 9;
const STEAL_RANGE = SKATER_RADIUS * 2 + 0.7; // stick lift: close
// Slap shot (WO-08): hold time (ms) for a fully-charged slapper. A tap (charge 0)
// fires the original wrist shot; a full hold trades accuracy for big power.
export const SLAP_FULL_MS = 600;
// Poke check (WO-08): a longer-reach jab that knocks the puck loose (no guaranteed
// possession), with a short cooldown so it can't be spammed.
const POKE_RANGE = SKATER_RADIUS * 2 + 1.2; // 2.6 — reaches past stick-lift range
export const POKE_COOLDOWN_MS = 450;
const POKE_LOOSE_SPEED = 9; // how hard the puck pops free
// Penalty (WO-17): a check on a skater who isn't the carrier and is away from the
// puck is interference / a late hit — the offender is boxed and their team plays a
// man down for a brief power play.
// Deke / trick (WO-03)
const DEKE_RANGE = SKATER_RADIUS * 2 + 1.0; // 2.1 — reach to break a defender's ankles
const DEKE_COOLDOWN_MS = 650; // prevents mashing the trick every frame
const ANKLE_BREAK_MS = 900; // stagger applied to a beaten defender
// One-timer (WO-09): shooting inside the post-pass window trades nothing for a
// crisp redirect — extra power and a tighter line on net.
const ONE_TIMER_POWER = 1.25;
const ONE_TIMER_ASSIST_BONUS = 0.2;
const WRIST_LIFT = 3.2;
const SLAP_LIFT = 6.0;
const ONE_TIMER_LIFT_BONUS = 0.8;
export const SHOT_PLACEMENT_DEADZONE = 0.15;
export const WIDE_INPUT_THRESHOLD = 0.95;
export const WIDE_CHANCE = 0.2;
export const WIDE_MARGIN = 0.65;

export function controllerShotTargetZ(stickX: number, wideRoll: number): number {
  const clamped = Math.max(-1, Math.min(1, stickX));
  const placed = Math.abs(clamped) < SHOT_PLACEMENT_DEADZONE ? 0 : clamped;
  const postZ = RINK.goalWidth / 2;
  const base = placed * postZ;
  const atMax = Math.abs(placed) >= WIDE_INPUT_THRESHOLD;
  if (atMax && wideRoll < WIDE_CHANCE) {
    return Math.sign(placed || 1) * (postZ + WIDE_MARGIN);
  }
  return base;
}
export interface ShotQuality {
  powerMult: number;
  errorMaxZ: number;
}

export function shotQuality(world: WorldState, s: SkaterState, target: { x: number; z: number }): ShotQuality {
  void world;
  const toTarget = v.norm(v.sub(target, s.pos));
  const facing = v.fromAngle(s.facing);
  const alignment = v.dot(facing, toTarget);
  const alignment01 = Math.max(0, Math.min(1, (alignment + 1) / 2));

  const movementSpeed = v.len(s.vel);
  const movingIntoShot = movementSpeed > 0.1 ? Math.max(-1, Math.min(1, v.dot(v.norm(s.vel), toTarget))) : 0;
  const movementBonus = movingIntoShot > 0 ? movingIntoShot * 0.08 : movingIntoShot * 0.1;

  const lateral = Math.abs(s.pos.z) / RINK.halfWidth;
  const behindOrSharp = s.team === 0 ? s.pos.x > RINK.goalLineX - 2 : s.pos.x < -RINK.goalLineX + 2;
  const locationPenalty = Math.min(0.25, lateral * 0.18 + (behindOrSharp ? 0.12 : 0));

  const powerMult = Math.max(0.52, Math.min(1.08, 0.58 + alignment01 * 0.42 + movementBonus - locationPenalty));
  const errorMaxZ = Math.max(0.05, 1.25 - alignment01 * 0.85 + locationPenalty * 1.8 - movementBonus);

  return { powerMult, errorMaxZ };
}

function emit(world: WorldState, e: SimEvent): void {
  world.events.push(e);
}

function netCenter(team: 0 | 1): { x: number; z: number } {
  return { x: attackingGoalX(team), z: 0 };
}

/** Aim direction from input, falling back to the attacking net. */
function aimDir(s: SkaterState, input: InputState): { x: number; z: number } {
  if (v.len(input.aim) > 0.2) return v.norm(input.aim);
  return v.norm(v.sub(netCenter(s.team), s.pos));
}

export function doShoot(world: WorldState, s: SkaterState, input: InputState): void {
  const puck = world.puck;
  if (puck.carrier !== s.id) return;
  const shoot = effectiveAttr(s, 'shoot');

  // Hold-to-charge (WO-08): the wind-up held before release ramps the shot from a
  // quick wrist shot (charge 0) to a powerful but less-accurate slapper (charge 1).
  const charge =
    s.status.shootChargeStart > 0
      ? Math.max(0, Math.min(1, (world.time - s.status.shootChargeStart) / SLAP_FULL_MS))
      : 0;
  // One-timer (WO-09): a shot taken before the post-pass window lapses.
  const oneTimer = s.status.oneTimerUntil > world.time;

  const placement = input.shotPlacement;
  const usingControllerPlacement = typeof placement === 'number';
  const wideRoll = world.rng();
  const target = usingControllerPlacement
    ? { x: attackingGoalX(s.team), z: controllerShotTargetZ(placement, wideRoll) }
    : netCenter(s.team);

  let dir = usingControllerPlacement ? v.norm(v.sub(target, puck.pos)) : aimDir(s, input);
  const toNet = v.norm(v.sub(netCenter(s.team), puck.pos));

  if (!usingControllerPlacement) {
    let assist = (0.15 + (shoot / 10) * 0.35) * (1 - 0.5 * charge);
    if (oneTimer) assist = Math.min(0.9, assist + ONE_TIMER_ASSIST_BONUS);
    dir = v.norm({ x: dir.x * (1 - assist) + toNet.x * assist, z: dir.z * (1 - assist) + toNet.z * assist });
  }

  const quality = shotQuality(world, s, target);
  if (usingControllerPlacement) {
    const errorRoll = world.rng() * 2 - 1;
    const adjustedTarget = { x: target.x, z: target.z + errorRoll * quality.errorMaxZ };
    dir = v.norm(v.sub(adjustedTarget, puck.pos));
  }

  if (s.status.guaranteedGoal) {
    dir = toNet; // cannon: dead-on
  }

  // power lerps wrist -> slap with charge, then the one-timer bonus on top
  const wrist = 18 + shoot * 1.8;
  const slap = 30 + shoot * 2.8;
  let power = (wrist + (slap - wrist) * charge) * s.status.shootPowerMult * quality.powerMult;
  if (oneTimer) power *= ONE_TIMER_POWER;
  puck.vel = v.scale(dir, power);
  puck.y = 0;
  puck.vy = input.lowShot ? 0 : WRIST_LIFT + (SLAP_LIFT - WRIST_LIFT) * charge + (oneTimer ? ONE_TIMER_LIFT_BONUS : 0);
  puck.carrier = null;
  puck.pickupCooldownUntil = world.time + 300;
  puck.lastTouch = s.id;
  puck.assistTouch = null;
  s.status.shootChargeStart = 0;
  s.status.shootGlideDirX = 0;
  s.status.shootGlideDirZ = 0;
  s.status.oneTimerUntil = 0; // consumed (whether or not it was a one-timer)

  emit(world, { type: 'shot', shooter: s.id, charge });
  if (oneTimer) {
    emit(world, { type: 'one_timer', by: s.id });
    awardStyle(s, 'one_timer', world.time);
  }
  // count as a shot-on-goal if pointed roughly at the net
  if (v.dot(dir, toNet) > 0.6) awardCharge(s, 'shot');
}

export function doPass(world: WorldState, s: SkaterState, input: InputState): void {
  const puck = world.puck;
  if (puck.carrier !== s.id) return;

  const mates = Object.values(world.skaters).filter(
    (o) => o.team === s.team && o.id !== s.id && !isDisabled(o, world.time),
  );
  if (mates.length === 0) return;

  const perfect = s.status.passPerfectUntil > world.time;
  const aim = aimDir(s, input);
  let best: SkaterState | null = null;
  let bestScore = -Infinity;
  for (const m of mates) {
    const to = v.norm(v.sub(m.pos, s.pos));
    const align = v.dot(to, aim);
    // perfect vision favors the teammate nearest the net; otherwise favor aim alignment
    const score = perfect
      ? -v.dist(m.pos, netCenter(s.team))
      : align - v.dist(m.pos, s.pos) * 0.02;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (!best) return;

  const pass = effectiveAttr(s, 'pass');
  const lead = v.scale(best.vel, 0.2 + (pass / 10) * 0.2);
  const target = v.add(best.pos, lead);
  const dir = v.norm(v.sub(target, puck.pos));
  const power = perfect ? 26 : 14 + pass * 1.2;

  puck.vel = v.scale(dir, power);
  puck.carrier = null;
  puck.pickupCooldownUntil = world.time + 120;
  puck.lastTouch = s.id;
  puck.assistTouch = null;

  emit(world, { type: 'pass', from: s.id, to: best.id });
  awardCharge(s, 'pass');
  // No-look (WO-04): feeding a teammate behind where you're facing is style.
  const toTarget = v.norm(v.sub(best.pos, s.pos));
  if (v.dot(toTarget, v.fromAngle(s.facing)) < -0.1) {
    emit(world, { type: 'nolook_pass', from: s.id, to: best.id });
    awardStyle(s, 'nolook_pass', world.time);
  }
}

export function doHit(world: WorldState, s: SkaterState, input: InputState): void {
  if (isDisabled(s, world.time)) return;
  const hit = effectiveAttr(s, 'hit');
  const forward = v.fromAngle(s.facing);
  let target: SkaterState | null = null;
  let bestD = HIT_RANGE;
  for (const o of Object.values(world.skaters)) {
    if (o.team === s.team) continue;
    if (o.status.intangibleUntil > world.time) continue;
    // Don't re-hit a skater who's already down (staggered/frozen/boxed) — matches
    // the freight-train contact rule in world.ts so the two check paths agree (WO-19).
    if (isDisabled(o, world.time)) continue;
    const off = v.sub(o.pos, s.pos);
    const d = v.len(off);
    if (d > HIT_RANGE) continue;
    if (v.dot(v.norm(off), forward) < 0.3) continue; // must be in front
    if (d < bestD) {
      bestD = d;
      target = o;
    }
  }
  if (!target) return;

  // Foul check (WO-17): bodying a skater who isn't the carrier and is away from the
  // puck is interference. Freight Train (checkingUntil) is exempt — flattening
  // everyone is the whole point of that ultimate.
  const targetHadPuck = world.puck.carrier === target.id;

  const toTarget = v.norm(v.sub(target.pos, s.pos));
  const approachSpeed = Math.max(0, v.dot(s.vel, toTarget));
  const contactAlignment = Math.max(0, v.dot(v.fromAngle(s.facing), toTarget));
  const targetResistance = effectiveAttr(target, 'hit') * 1.2;
  const impactForce = hit * 0.9 + approachSpeed * 0.8 + contactAlignment * 4;
  const knockedDown = impactForce - targetResistance >= KNOCKDOWN_MARGIN;

  target.status.staggeredUntil = world.time + 650 + hit * 45;
  if (knockedDown) target.status.downedUntil = world.time + KNOCKDOWN_MS;
  const knockSpeed = Math.max(4, 4.5 + impactForce * 0.35 - targetResistance * 0.2 + (knockedDown ? 3 : 0));
  const knock = v.scale(toTarget, knockSpeed);
  target.vel = v.add(target.vel, knock);
  if (targetHadPuck) {
    world.puck.carrier = null;
    world.puck.vel = v.add(world.puck.vel, knock);
    world.puck.pickupCooldownUntil = world.time + 150;
  }
  breakCombo(target); // the checked skater loses their chain
  emit(world, { type: 'hit', by: s.id, target: target.id });

  awardStyle(s, targetHadPuck ? 'hit' : 'off_puck_hit', world.time);
}

/**
 * Stick lift: a close-range takeaway that *gains possession*. Works from any angle
 * but only at short reach. Contest is the lifter's steal vs the carrier's handling.
 */
export function doSteal(world: WorldState, s: SkaterState): void {
  if (isDisabled(s, world.time)) return;
  const puck = world.puck;
  if (!puck.carrier || puck.carrier === s.id) return;
  const carrier = world.skaters[puck.carrier];
  if (!carrier || carrier.team === s.team) return;
  if (carrier.status.intangibleUntil > world.time) return;
  if (v.dist(s.pos, carrier.pos) > STEAL_RANGE) return;

  // deterministic contest: stealer's steal vs carrier's puck protection (their steal)
  const success = effectiveAttr(s, 'steal') + 1 >= effectiveAttr(carrier, 'steal');
  if (!success) return;
  puck.carrier = s.id;
  puck.lastTouch = s.id;
  puck.assistTouch = null;
  breakCombo(carrier); // stripped: the victim loses their chain
  emit(world, { type: 'steal', by: s.id, from: carrier.id });
  awardStyle(s, 'steal', world.time);
}

/**
 * Poke check: a longer-reach jab at a carrier *in front* of you. Unlike a stick
 * lift it doesn't grab the puck — it knocks it loose so it pops free (either team
 * can recover). Easier to land than a clean lift, but you give up the puck and
 * eat a short cooldown (armed even on a whiff, so it can't be mashed).
 */
export function doPoke(world: WorldState, s: SkaterState): void {
  if (isDisabled(s, world.time)) return;
  if (s.status.pokeCooldownUntil > world.time) return;
  s.status.pokeCooldownUntil = world.time + POKE_COOLDOWN_MS; // commit the jab

  const puck = world.puck;
  if (!puck.carrier || puck.carrier === s.id) return;
  const carrier = world.skaters[puck.carrier];
  if (!carrier || carrier.team === s.team) return;
  if (carrier.status.intangibleUntil > world.time) return;

  const off = v.sub(carrier.pos, s.pos);
  if (v.len(off) > POKE_RANGE) return;
  const forward = v.fromAngle(s.facing);
  if (v.dot(v.norm(off), forward) < 0.3) return; // it's a reach — must be in front

  // contest: poke (steal rating) vs handling; a strong handler resists a loose poke
  if (effectiveAttr(s, 'steal') + 2 < effectiveAttr(carrier, 'steal')) return;

  const dir = v.norm(off); // knock it loose toward where we jabbed
  puck.carrier = null;
  puck.vel = v.scale(dir, POKE_LOOSE_SPEED);
  puck.pickupCooldownUntil = world.time + 220; // nobody re-sticks instantly
  puck.lastTouch = s.id; // poker touched it last (assist credit if his team recovers)
  puck.assistTouch = null;
  breakCombo(carrier);
  emit(world, { type: 'poke', by: s.id, from: carrier.id });
  awardStyle(s, 'poke', world.time);
}

/**
 * Dangle: briefly bend the carried-puck anchor laterally (between-the-legs /
 * toe-drag) and "break the ankles" of a defender you slip past — they bite and
 * stagger. A whiff still dangles but pays less. Carrier-only, with a cooldown.
 */
export function doDeke(world: WorldState, s: SkaterState, input: InputState): void {
  if (isDisabled(s, world.time)) return;
  const puck = world.puck;
  if (puck.carrier !== s.id) return;
  if (s.status.dekeCooldownUntil > world.time) return;

  // Lateral juke direction: left or right of facing, chosen by where the player aims.
  const forward = v.fromAngle(s.facing);
  const left = { x: -forward.z, z: forward.x }; // 90° to facing
  const aim = v.len(input.aim) > 0.2 ? v.norm(input.aim) : forward;
  const side = v.dot(aim, left) >= 0 ? 1 : -1;
  const juke = v.scale(left, side);

  // Arm the transient carry offset (read by carryAnchor + client prediction) + cooldown.
  s.status.dekeUntil = world.time + DEKE_MS;
  s.status.dekeDirX = juke.x;
  s.status.dekeDirZ = juke.z;
  s.status.dekeCooldownUntil = world.time + DEKE_COOLDOWN_MS;

  // Ankle-break: nearest opponent in front, within reach, who can't out-handle us.
  const handles = effectiveAttr(s, 'steal'); // reuse "steal" rating as stick handling
  let victim: SkaterState | null = null;
  let bestD = DEKE_RANGE;
  for (const o of Object.values(world.skaters)) {
    if (o.team === s.team) continue;
    if (o.status.intangibleUntil > world.time) continue;
    if (isDisabled(o, world.time)) continue;
    const off = v.sub(o.pos, s.pos);
    const d = v.len(off);
    if (d > DEKE_RANGE) continue;
    if (v.dot(v.norm(off), forward) < 0.25) continue; // must be in front to be beaten
    if (d < bestD) {
      bestD = d;
      victim = o;
    }
  }
  if (victim && handles + 1 >= effectiveAttr(victim, 'steal')) {
    victim.status.staggeredUntil = world.time + ANKLE_BREAK_MS;
    breakCombo(victim); // broken ankles end their chain
    if (puck.carrier === victim.id) puck.carrier = s.id; // shouldn't happen, but stay consistent
    emit(world, { type: 'ankle_break', by: s.id, target: victim.id });
    awardStyle(s, 'ankle_break', world.time);
    return;
  }
  // Clean deke / whiff: still a dangle, smaller style reward.
  emit(world, { type: 'deke', by: s.id });
  awardStyle(s, 'deke', world.time);
}

export function doUlt(world: WorldState, s: SkaterState): void {
  if (s.ultCharge < 1 || s.ultActiveUntil > world.time) return;
  const ult = getUltimate(getCharacter(s.characterId).ultimateId);
  ult.activate(world, s);
  s.ultCharge = 0;
  s.ultActiveUntil = world.time + ult.durationMs;
  emit(world, { type: 'ult', by: s.id, ultimateId: ult.id });
}
