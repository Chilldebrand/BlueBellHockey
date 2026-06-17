import { describe, expect, it } from 'vitest';
import { beginCountdown, createWorld, step, type RosterEntry } from './world.js';
import { neutralInput, type InputState } from './types.js';
import { attackingGoalX } from '../config/rink.js';
import { v } from './physics.js';

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
