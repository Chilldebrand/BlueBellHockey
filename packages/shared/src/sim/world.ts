import {
  COUNTDOWN_MS,
  INTERMISSION_MS,
  OVERTIME_MS,
  PERIOD_MS,
  PERIODS,
  awardCharge,
  tickCharge,
} from '../config/charge.js';
import { PUCK_RADIUS, RINK, SKATER_RADIUS, attackingGoalX } from '../config/rink.js';
import { doHit, doPass, doShoot, doSteal, doUlt } from './actions.js';
import { resolveCircles, v } from './physics.js';
import { isDisabled, stepSkater } from './skater.js';
import { stepPuck } from './puck.js';
import {
  emptyActions,
  emptyStatus,
  neutralInput,
  type InputState,
  type SkaterState,
  type Team,
  type WorldState,
} from './types.js';

export interface RosterEntry {
  id: string;
  team: Team;
  characterId: string;
  isBot: boolean;
  isGoalie: boolean;
}

function startPositions(team: Team, index: number, isGoalie: boolean): { x: number; z: number } {
  const sign = team === 0 ? -1 : 1;
  if (isGoalie) return { x: sign * (RINK.goalLineX - 1.5), z: 0 };
  const zs = [-RINK.faceoffZ, 0, RINK.faceoffZ];
  return { x: sign * 6, z: zs[index % zs.length] };
}

export function createWorld(roster: RosterEntry[]): WorldState {
  const skaters: Record<string, SkaterState> = {};
  const counts: Record<Team, number> = { 0: 0, 1: 0 };
  for (const r of roster) {
    const idx = counts[r.team]++;
    skaters[r.id] = {
      id: r.id,
      team: r.team,
      characterId: r.characterId,
      isBot: r.isBot,
      isGoalie: r.isGoalie,
      pos: startPositions(r.team, idx, r.isGoalie),
      vel: { x: 0, z: 0 },
      facing: r.team === 0 ? 0 : Math.PI,
      status: emptyStatus(),
      ultCharge: 0,
      ultActiveUntil: 0,
      lastActions: emptyActions(),
    };
  }
  return {
    time: 0,
    phase: 'lobby',
    period: 1,
    clock: PERIOD_MS,
    phaseTimer: 0,
    pauseUntil: 0,
    score: [0, 0],
    skaters,
    puck: {
      pos: { ...RINK.centerFaceoff },
      vel: { x: 0, z: 0 },
      carrier: null,
      pickupCooldownUntil: 0,
      lastTouch: null,
      assistTouch: null,
    },
    events: [],
  };
}

export function resetFaceoff(world: WorldState): void {
  let i0 = 0;
  let i1 = 0;
  for (const s of Object.values(world.skaters)) {
    const idx = s.isGoalie ? 0 : s.team === 0 ? i0++ : i1++;
    s.pos = startPositions(s.team, idx, s.isGoalie);
    s.vel = { x: 0, z: 0 };
    s.facing = s.team === 0 ? 0 : Math.PI;
  }
  world.puck.pos = { ...RINK.centerFaceoff };
  world.puck.vel = { x: 0, z: 0 };
  world.puck.carrier = null;
  world.puck.pickupCooldownUntil = world.time + 500;
  world.puck.lastTouch = null;
  world.puck.assistTouch = null;
}

/** Begin the pre-match (or post-intermission) countdown. */
export function beginCountdown(world: WorldState): void {
  resetFaceoff(world);
  world.phase = 'countdown';
  world.phaseTimer = COUNTDOWN_MS;
  world.events.push({ type: 'phase', phase: 'countdown' });
}

function expireStatuses(world: WorldState): void {
  for (const s of Object.values(world.skaters)) {
    const st = s.status;
    if (st.speedMultUntil && world.time >= st.speedMultUntil) {
      st.speedMult = 1;
      st.speedMultUntil = 0;
    }
    if (st.attrBonusUntil && world.time >= st.attrBonusUntil) {
      st.attrBonus = 0;
      st.attrBonusUntil = 0;
    }
    if (st.shootPowerUntil && world.time >= st.shootPowerUntil) {
      st.shootPowerMult = 1;
      st.shootPowerUntil = 0;
      st.guaranteedGoal = false;
    }
    if (s.ultActiveUntil && world.time >= s.ultActiveUntil) {
      s.ultActiveUntil = 0;
    }
  }
}

function collide(world: WorldState): void {
  const list = Object.values(world.skaters);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.status.intangibleUntil > world.time || b.status.intangibleUntil > world.time) continue;
      const hit = resolveCircles(a.pos, b.pos, SKATER_RADIUS, SKATER_RADIUS);
      if (!hit) continue;
      // freight-train style: a checking skater flattens an opposing skater on contact
      checkContact(world, a, b);
      checkContact(world, b, a);
    }
  }
}

function checkContact(world: WorldState, attacker: SkaterState, target: SkaterState): void {
  if (attacker.team === target.team) return;
  if (attacker.status.checkingUntil <= world.time) return;
  if (target.status.staggeredUntil > world.time) return;
  target.status.staggeredUntil = world.time + 1000;
  const knock = v.scale(v.norm(v.sub(target.pos, attacker.pos)), 8);
  target.vel = v.add(target.vel, knock);
  if (world.puck.carrier === target.id) {
    world.puck.carrier = null;
    world.puck.pickupCooldownUntil = world.time + 150;
  }
  world.events.push({ type: 'hit', by: attacker.id, target: target.id });
}

function detectGoal(world: WorldState): void {
  const p = world.puck;
  if (p.carrier) return;
  for (const team of [0, 1] as Team[]) {
    const gx = attackingGoalX(team); // team scores by sending puck across this line
    const crossed = team === 0 ? p.pos.x >= gx : p.pos.x <= gx;
    if (crossed && Math.abs(p.pos.z) < RINK.goalWidth / 2) {
      const scorer = p.lastTouch && world.skaters[p.lastTouch]?.team === team ? p.lastTouch : null;
      const assist = p.assistTouch && world.skaters[p.assistTouch]?.team === team ? p.assistTouch : null;
      world.score[team] += 1;
      if (scorer) awardCharge(world.skaters[scorer], 'goal');
      if (assist) awardCharge(world.skaters[assist], 'assist');
      world.events.push({ type: 'goal', team, scorer: scorer ?? '', assist });
      resetFaceoff(world);
      world.pauseUntil = world.time + 1800; // brief celebration before play resumes
      return;
    }
  }
}

function advancePhase(world: WorldState, dtMs: number): boolean {
  switch (world.phase) {
    case 'countdown':
      world.phaseTimer -= dtMs;
      if (world.phaseTimer <= 0) {
        // resume into overtime once we're past regulation, otherwise a normal period
        world.phase = world.period > PERIODS ? 'overtime' : 'period';
        world.events.push({ type: 'phase', phase: world.phase });
        world.events.push({ type: 'period', period: world.period });
      }
      return false;
    case 'period':
    case 'overtime':
      return true; // simulate gameplay
    case 'intermission':
      world.phaseTimer -= dtMs;
      if (world.phaseTimer <= 0) {
        world.period += 1;
        world.clock = PERIOD_MS;
        beginCountdown(world);
      }
      return false;
    default:
      return false; // lobby / ended
  }
}

function tickClock(world: WorldState, dtMs: number): void {
  if (world.phase !== 'period' && world.phase !== 'overtime') return;
  world.clock -= dtMs;
  if (world.clock > 0) return;
  world.clock = 0;
  if (world.phase === 'overtime') {
    world.phase = 'ended';
    world.events.push({ type: 'phase', phase: 'ended' });
    return;
  }
  if (world.period >= PERIODS) {
    if (world.score[0] === world.score[1]) {
      world.phase = 'overtime';
      world.period = PERIODS + 1;
      world.clock = OVERTIME_MS;
      beginCountdown(world);
    } else {
      world.phase = 'ended';
      world.events.push({ type: 'phase', phase: 'ended' });
    }
  } else {
    world.phase = 'intermission';
    world.phaseTimer = INTERMISSION_MS;
    world.events.push({ type: 'phase', phase: 'intermission' });
  }
}

/** Advance the whole world by dtMs given each skater's input this frame. */
export function step(
  world: WorldState,
  inputs: Record<string, InputState>,
  dtMs: number,
): void {
  world.events = [];
  world.time += dtMs;
  const dt = dtMs / 1000;

  const playing = advancePhase(world, dtMs);
  expireStatuses(world);
  const paused = world.time < world.pauseUntil; // goal celebration freeze

  if (playing && !paused) {
    // sudden-death overtime ends instantly on a goal
    const otStartScore: [number, number] = [world.score[0], world.score[1]];

    for (const s of Object.values(world.skaters)) {
      const input = inputs[s.id] ?? neutralInput();
      const a = input.actions;
      const last = s.lastActions;
      if (!isDisabled(s, world.time)) {
        if (a.ult && !last.ult) doUlt(world, s);
        if (a.hit && !last.hit) doHit(world, s, input);
        if (a.steal && !last.steal) doSteal(world, s);
        if (a.shoot && !last.shoot) doShoot(world, s, input);
        if (a.pass && !last.pass) doPass(world, s, input);
      }
      s.lastActions = { ...a };
    }

    for (const s of Object.values(world.skaters)) {
      stepSkater(world, s, inputs[s.id] ?? neutralInput(), dt);
    }
    collide(world);
    stepPuck(world, dt);
    detectGoal(world);

    for (const s of Object.values(world.skaters)) tickCharge(s, dtMs);

    if (
      world.phase === 'overtime' &&
      (world.score[0] !== otStartScore[0] || world.score[1] !== otStartScore[1])
    ) {
      world.phase = 'ended';
      world.events.push({ type: 'phase', phase: 'ended' });
    }
  }

  if (!paused) tickClock(world, dtMs);
}
