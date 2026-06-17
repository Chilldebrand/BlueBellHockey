import { awardCharge } from '../config/charge.js';
import { getCharacter } from '../config/characters.js';
import { attackingGoalX, SKATER_RADIUS } from '../config/rink.js';
import { getUltimate } from '../config/ultimates.js';
import { v } from './physics.js';
import { effectiveAttr, isDisabled } from './skater.js';
import type { InputState, SimEvent, SkaterState, WorldState } from './types.js';

const HIT_RANGE = SKATER_RADIUS * 2 + 0.9;
const STEAL_RANGE = SKATER_RADIUS * 2 + 0.7;

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

  let dir = aimDir(s, input);
  // aim assist toward the net scales with shoot rating
  const toNet = v.norm(v.sub(netCenter(s.team), puck.pos));
  const assist = 0.15 + (shoot / 10) * 0.35;
  dir = v.norm({ x: dir.x * (1 - assist) + toNet.x * assist, z: dir.z * (1 - assist) + toNet.z * assist });
  if (s.status.guaranteedGoal) {
    dir = toNet; // cannon: dead-on
  }

  const power = (16 + shoot * 1.6) * s.status.shootPowerMult;
  puck.vel = v.scale(dir, power);
  puck.carrier = null;
  puck.pickupCooldownUntil = world.time + 300;
  puck.lastTouch = s.id;
  puck.assistTouch = null;

  emit(world, { type: 'shot', shooter: s.id });
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

  target.status.staggeredUntil = world.time + 700 + hit * 60;
  const knock = v.scale(v.norm(v.sub(target.pos, s.pos)), 4 + hit * 0.6);
  target.vel = v.add(target.vel, knock);
  if (world.puck.carrier === target.id) {
    world.puck.carrier = null;
    world.puck.vel = v.add(world.puck.vel, knock);
    world.puck.pickupCooldownUntil = world.time + 150;
  }
  emit(world, { type: 'hit', by: s.id, target: target.id });
  awardCharge(s, 'hit');
}

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
  emit(world, { type: 'steal', by: s.id, from: carrier.id });
  awardCharge(s, 'steal');
}

export function doUlt(world: WorldState, s: SkaterState): void {
  if (s.ultCharge < 1 || s.ultActiveUntil > world.time) return;
  const ult = getUltimate(getCharacter(s.characterId).ultimateId);
  ult.activate(world, s);
  s.ultCharge = 0;
  s.ultActiveUntil = world.time + ult.durationMs;
  emit(world, { type: 'ult', by: s.id, ultimateId: ult.id });
}
