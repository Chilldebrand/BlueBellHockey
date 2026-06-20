import {
  COUNTDOWN_MS,
  INTERMISSION_MS,
  OVERTIME_MS,
  awardStyle,
  breakCombo,
  tickCharge,
} from '../config/charge.js';
import { getMode, type GameModeDef } from '../config/modes.js';
import { PUCK_RADIUS, RINK, SKATER_RADIUS, attackingGoalX } from '../config/rink.js';
import { doDeke, doHit, doPass, doPoke, doShoot, doSteal, doUlt } from './actions.js';
import { containCircle, resolveCircles, v } from './physics.js';
import { isDisabled, stepSkater } from './skater.js';
import { stepPuck } from './puck.js';
import { clearPickups, stepPickups } from './pickups.js';
import {
  emptyActions,
  emptyStats,
  emptyStatus,
  neutralInput,
  type InputState,
  type SkaterState,
  type Team,
  type Vec2,
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

export function createWorld(roster: RosterEntry[], mode?: GameModeDef): WorldState {
  const m = mode ?? getMode(undefined);
  const skaters: Record<string, SkaterState> = {};
  const stats: WorldState['stats'] = {};
  const counts: Record<Team, number> = { 0: 0, 1: 0 };
  for (const r of roster) {
    const idx = counts[r.team]++;
    stats[r.id] = emptyStats();
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
      combo: 0,
      comboUntil: 0,
      lastActions: emptyActions(),
    };
  }
  return {
    time: 0,
    phase: 'lobby',
    periods: m.periods,
    periodMs: m.periodMs,
    targetGoals: m.targetGoals,
    suddenDeathOT: m.suddenDeathOT,
    period: 1,
    clock: m.periodMs,
    phaseTimer: 0,
    pauseUntil: 0,
    goalResetPending: false,
    score: [0, 0],
    skaters,
    stats,
    pickups: [],
    pickupTimer: 0,
    pickupSeq: 0,
    puck: {
      pos: { ...RINK.centerFaceoff },
      vel: { x: 0, z: 0 },
      carrier: null,
      pickupCooldownUntil: 0,
      lastTouch: null,
      assistTouch: null,
      bankedBy: null,
      bankedAt: 0,
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
    s.combo = 0; // possession resets at a faceoff
    s.comboUntil = 0;
  }
  world.puck.pos = { ...RINK.centerFaceoff };
  world.puck.vel = { x: 0, z: 0 };
  world.puck.carrier = null;
  world.puck.pickupCooldownUntil = world.time + 500;
  world.puck.lastTouch = null;
  world.puck.assistTouch = null;
  world.puck.bankedBy = null;
  world.puck.bankedAt = 0;
  clearPickups(world); // wipe the ice on a stoppage (WO-16)
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
    // combo lapses if no style move landed within the window (WO-04)
    if (s.comboUntil && world.time >= s.comboUntil) {
      s.combo = 0;
      s.comboUntil = 0;
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
      // Damp the closing velocity so bodies don't grind/jitter or tunnel through
      // each other — resolveCircles only separates positions (WO-19). Done before
      // checkContact so a freight-train knock added there isn't cancelled.
      dampContact(a, b);
      // resolveCircles can shove a skater past the boards for a frame — pull both back.
      containCircle(a.pos, a.vel, SKATER_RADIUS, RINK.boardRestitution);
      containCircle(b.pos, b.vel, SKATER_RADIUS, RINK.boardRestitution);
      // freight-train style: a checking skater flattens an opposing skater on contact
      checkContact(world, a, b);
      checkContact(world, b, a);
    }
  }
}

// Cancel the part of two skaters' velocities that drives them together, along the
// contact normal (WO-19): an equal-mass inelastic response that kills the grind
// without making bodies bounce apart. No effect if they're already separating.
function dampContact(a: SkaterState, b: SkaterState): void {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return;
  const nx = dx / d;
  const nz = dz / d;
  const va = a.vel.x * nx + a.vel.z * nz;
  const vb = b.vel.x * nx + b.vel.z * nz;
  if (va - vb <= 0) return; // not closing along the normal
  const avg = (va + vb) / 2;
  a.vel.x += (avg - va) * nx;
  a.vel.z += (avg - va) * nz;
  b.vel.x += (avg - vb) * nx;
  b.vel.z += (avg - vb) * nz;
}

function checkContact(world: WorldState, attacker: SkaterState, target: SkaterState): void {
  if (attacker.team === target.team) return;
  if (attacker.status.checkingUntil <= world.time) return;
  if (target.status.staggeredUntil > world.time) return;
  target.status.staggeredUntil = world.time + 1000;
  const knock = v.scale(v.norm(v.sub(target.pos, attacker.pos)), 11);
  target.vel = v.add(target.vel, knock);
  if (world.puck.carrier === target.id) {
    world.puck.carrier = null;
    world.puck.pickupCooldownUntil = world.time + 150;
  }
  world.events.push({ type: 'hit', by: attacker.id, target: target.id });
}

// Gamebreaker (WO-02): a goal scored while the scorer's ultimate is live is worth
// more. It used to also steal a point from the opponent (NBA Street Vol. 2 rules),
// but that knocked the trailing team back every time the leader popped one and made
// comebacks too hard, so the steal is off — a Gamebreaker is a big +2, not a -1 to
// the other side. Flip STEALS_POINT back on (or drop VALUE to 1) to retune.
export const GAMEBREAKER_GOAL_VALUE = 2;
export const GAMEBREAKER_STEALS_POINT = false;
const SCORE_MAX = 255; // score0/score1 are uint8 in the schema

function detectGoal(world: WorldState, prevPos: Vec2): void {
  const p = world.puck;
  if (p.carrier) return;
  for (const team of [0, 1] as Team[]) {
    const gx = attackingGoalX(team); // team scores by sending puck across this line
    const sign = team === 0 ? 1 : -1; // team 0 attacks +X, team 1 attacks -X
    // A goal is an *inward* crossing of the mouth plane this frame: the puck was in
    // front of the line and is now at/past it, within the mouth width. A loose puck
    // already behind the line (dumped around the net) never re-crosses, and a puck
    // wrapping back out toward center crosses the wrong way — neither scores, so you
    // can no longer "score from behind the net" (WO-18).
    const crossed = sign * prevPos.x < sign * gx && sign * p.pos.x >= sign * gx;
    if (crossed && Math.abs(p.pos.z) < RINK.goalWidth / 2) {
      const scorer = p.lastTouch && world.skaters[p.lastTouch]?.team === team ? p.lastTouch : null;
      const assist = p.assistTouch && world.skaters[p.assistTouch]?.team === team ? p.assistTouch : null;
      // A Gamebreaker requires the scorer's ult to be active at the moment of the
      // goal. Instant-duration ults set ultActiveUntil = world.time, so they are
      // not "active" the next frame and cannot produce Gamebreakers (acceptable —
      // those are utility ults; Cannon/Afterburner are the canonical finishes).
      const gb = !!scorer && world.skaters[scorer].ultActiveUntil > world.time;
      const value = gb ? GAMEBREAKER_GOAL_VALUE : 1;
      const opp = (team === 0 ? 1 : 0) as Team;
      // Clamp into uint8 range in the sim so authority and schema never disagree.
      world.score[team] = Math.min(SCORE_MAX, world.score[team] + value);
      if (gb && GAMEBREAKER_STEALS_POINT) {
        world.score[opp] = Math.max(0, world.score[opp] - 1);
      }
      if (scorer) awardStyle(world.skaters[scorer], 'goal', world.time);
      if (assist) awardStyle(world.skaters[assist], 'assist', world.time);
      world.events.push({ type: 'goal', team, scorer: scorer ?? '', assist });
      if (gb) world.events.push({ type: 'gamebreaker', team, scorer: scorer ?? '', value });
      // WO-10: leave the puck where it crossed and defer the faceoff to the end of
      // the celebration pause, which also covers the client's slow-mo goal replay.
      world.goalResetPending = true;
      world.pauseUntil = world.time + (gb ? 3400 : 3000);
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
        world.phase = world.period > world.periods ? 'overtime' : 'period';
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
        world.clock = world.periodMs;
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
  if (world.period >= world.periods) {
    if (world.score[0] === world.score[1] && world.suddenDeathOT) {
      world.phase = 'overtime';
      world.period = world.periods + 1;
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

/** Roll this step's one-shot events into the cumulative per-skater box score (WO-09). */
function tallyStats(world: WorldState): void {
  for (const e of world.events) {
    switch (e.type) {
      case 'goal':
        if (e.scorer && world.stats[e.scorer]) world.stats[e.scorer].goals++;
        if (e.assist && world.stats[e.assist]) world.stats[e.assist].assists++;
        break;
      case 'hit':
        if (world.stats[e.by]) world.stats[e.by].hits++;
        break;
      case 'steal':
      case 'poke':
        if (world.stats[e.by]) world.stats[e.by].takeaways++;
        break;
      case 'save':
        if (world.stats[e.by]) world.stats[e.by].saves++;
        break;
      case 'shot':
        if (world.stats[e.shooter]) world.stats[e.shooter].shots++;
        break;
    }
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

  // WO-10: once the celebration pause is over, drop the puck back at center for the
  // faceoff (the deferred reset that detectGoal no longer does inline).
  if (!paused && world.goalResetPending) {
    resetFaceoff(world);
    world.goalResetPending = false;
  }

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
        if (a.steal && !last.steal) doSteal(world, s); // stick lift
        if (a.poke && !last.poke) doPoke(world, s); // poke check
        if (a.deke && !last.deke) doDeke(world, s, input);
        if (a.pass && !last.pass) doPass(world, s, input);
        // Slap shot (WO-08): pressing shoot starts the wind-up; the shot fires on
        // release below, with power/accuracy set by how long it was held.
        if (a.shoot && !last.shoot && world.puck.carrier === s.id) {
          s.status.shootChargeStart = world.time;
        }
      }
      // Fire on release — handled outside the disabled guard so a check that
      // strips or staggers mid-wind-up cancels the shot cleanly.
      if (!a.shoot && last.shoot) {
        if (s.status.shootChargeStart > 0 && world.puck.carrier === s.id && !isDisabled(s, world.time)) {
          doShoot(world, s, input);
        }
        s.status.shootChargeStart = 0;
      }
      // Drop a stale charge if the puck was lost or the skater got disabled while holding.
      if (s.status.shootChargeStart > 0 && (world.puck.carrier !== s.id || isDisabled(s, world.time))) {
        s.status.shootChargeStart = 0;
      }
      s.lastActions = { ...a };
    }

    for (const s of Object.values(world.skaters)) {
      stepSkater(world, s, inputs[s.id] ?? neutralInput(), dt);
    }
    collide(world);
    // capture the puck's position before it moves so detectGoal can test the
    // direction it crossed the goal line this frame (WO-18).
    const puckBefore = { x: world.puck.pos.x, z: world.puck.pos.z };
    stepPuck(world, dt);
    detectGoal(world, puckBefore);
    stepPickups(world, dtMs);

    // A turnover kills the combo: anyone checked, frozen, or staggered this frame
    // loses their chain (steals/takeaways reset the victim where they happen).
    for (const s of Object.values(world.skaters)) {
      if (isDisabled(s, world.time)) breakCombo(s);
    }

    for (const s of Object.values(world.skaters)) tickCharge(s, dtMs);

    // Match-ending goal (WO-15): a sudden-death OT goal, or reaching the mode's
    // goal target (e.g. first-to-5), ends the match immediately.
    const scoreChanged =
      world.score[0] !== otStartScore[0] || world.score[1] !== otStartScore[1];
    const hitTarget =
      world.targetGoals > 0 &&
      (world.score[0] >= world.targetGoals || world.score[1] >= world.targetGoals);
    if (scoreChanged && (world.phase === 'overtime' || hitTarget)) {
      world.phase = 'ended';
      world.events.push({ type: 'phase', phase: 'ended' });
    }
  } else {
    // Not simulating actions (countdown, goal celebration, intermission): keep each
    // skater's lastActions in step with their held input so a button held across the
    // stoppage isn't read as a fresh press the instant play resumes. Without this,
    // holding the Gamebreaker key through a goal celebration auto-fires the ult on
    // the faceoff and wastes a full meter (WO-20).
    for (const s of Object.values(world.skaters)) {
      s.lastActions = { ...(inputs[s.id]?.actions ?? emptyActions()) };
    }
  }

  if (!paused) tickClock(world, dtMs);

  tallyStats(world);
}
