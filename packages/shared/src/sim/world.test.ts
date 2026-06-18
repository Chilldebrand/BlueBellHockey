import { describe, expect, it } from 'vitest';
import {
  GAMEBREAKER_GOAL_VALUE,
  beginCountdown,
  createWorld,
  step,
  type RosterEntry,
} from './world.js';
import { doHit } from './actions.js';
import { neutralInput, type InputState, type WorldState } from './types.js';
import { attackingGoalX } from '../config/rink.js';
import { v } from './physics.js';

/** Launch a loose puck across team 0's attacking line, credited to `scorer`. */
function launchTeam0Goal(w: WorldState, scorer: string): void {
  const gx = attackingGoalX(0);
  w.puck.carrier = null;
  w.puck.lastTouch = scorer;
  w.puck.assistTouch = null;
  w.puck.pos = { x: gx - 1, z: 0 };
  w.puck.vel = { x: 20, z: 0 };
  w.puck.pickupCooldownUntil = w.time + 10000;
}

function roster(): RosterEntry[] {
  return [
    { id: 'a', team: 0, characterId: 'blaze', isBot: false, isGoalie: false },
    { id: 'b', team: 1, characterId: 'tank', isBot: false, isGoalie: false },
  ];
}

const DT = 1000 / 30;

describe('world simulation', () => {
  it('starts in lobby and counts down into a period', () => {
    const w = createWorld(roster());
    expect(w.phase).toBe('lobby');
    beginCountdown(w);
    expect(w.phase).toBe('countdown');
    for (let i = 0; i < 200; i++) step(w, {}, DT);
    expect(w.phase).toBe('period');
  });

  it('a skater can pick up the puck and skate', () => {
    const w = createWorld(roster());
    beginCountdown(w);
    for (let i = 0; i < 200; i++) step(w, {}, DT); // into period
    const a = w.skaters.a;
    const input: InputState = { ...neutralInput(), move: v.norm(v.sub(w.puck.pos, a.pos)) };
    for (let i = 0; i < 120; i++) step(w, { a: input }, DT);
    expect(w.puck.carrier).toBe('a');
  });

  it('a free puck across the goal line scores', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 1, z: 0 };
    w.puck.vel = { x: 20, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;
    const before = w.score[0];
    for (let i = 0; i < 30; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(before + 1);
  });

  it('a check knocks the target back and staggers them (WO-00 feel)', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'tank', isBot: false, isGoalie: false },
      { id: 'b', team: 1, characterId: 'blaze', isBot: false, isGoalie: false },
    ]);
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.facing = 0; // facing +X, toward b
    b.pos = { x: 1.4, z: 0 };
    b.vel = { x: 0, z: 0 };
    doHit(w, a, neutralInput());
    expect(b.status.staggeredUntil).toBeGreaterThan(w.time);
    // tank hit=10 → arcade knock magnitude 6 + 10*0.9 = 15 along +X
    expect(b.vel.x).toBeCloseTo(15, 1);
  });

  it('a normal goal scores exactly 1 and leaves the opponent unchanged (WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.score = [0, 2];
    launchTeam0Goal(w, 'a'); // a is team 0, no active ult
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(1);
    expect(w.score[1]).toBe(2);
  });

  it('a goal with the scorer ult active is a Gamebreaker worth more + steals a point (WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.score = [0, 3];
    w.skaters.a.ultActiveUntil = w.time + 10000; // a's ult is live
    launchTeam0Goal(w, 'a');
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(GAMEBREAKER_GOAL_VALUE); // +2
    expect(w.score[1]).toBe(2); // 3 - 1 stolen
    const gb = w.events.find((e) => e.type === 'gamebreaker');
    expect(gb).toBeDefined();
    expect(gb && gb.type === 'gamebreaker' && gb.value).toBe(GAMEBREAKER_GOAL_VALUE);
  });

  it('a Gamebreaker never drops the opponent below 0 (uint8 underflow guard, WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.score = [0, 0]; // opponent already at 0
    w.skaters.a.ultActiveUntil = w.time + 10000;
    launchTeam0Goal(w, 'a');
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(GAMEBREAKER_GOAL_VALUE);
    expect(w.score[1]).toBe(0); // stayed clamped at 0
  });

  it('a Gamebreaker in sudden-death overtime ends the match (WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'overtime';
    w.period = 4;
    w.clock = 100000;
    w.score = [0, 0];
    w.skaters.a.ultActiveUntil = w.time + 10000;
    launchTeam0Goal(w, 'a');
    for (let i = 0; i < 30 && w.phase === 'overtime'; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(GAMEBREAKER_GOAL_VALUE);
    expect(w.phase).toBe('ended');
  });

  it('freezes the clock during the goal celebration pause', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 1, z: 0 };
    w.puck.vel = { x: 20, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(1);
    expect(w.pauseUntil).toBeGreaterThan(w.time);
    const clockAtGoal = w.clock;
    for (let i = 0; i < 10; i++) step(w, {}, DT); // still within the pause window
    expect(w.clock).toBe(clockAtGoal); // clock did not tick while paused
  });
});
