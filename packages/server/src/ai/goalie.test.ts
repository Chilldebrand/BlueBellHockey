import { describe, expect, it } from 'vitest';
import { createWorld, defendingGoalX, v, type RosterEntry } from '@bbh/shared';
import { goalieInput } from './goalie.js';

function world(roster: RosterEntry[]) {
  const w = createWorld(roster);
  w.phase = 'period';
  return w;
}

describe('goalie AI', () => {
  it('hovers around the crease instead of full-speed chasing tiny target changes', () => {
    const w = world([{ id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true }]);
    const g = w.skaters.g;
    const gx = defendingGoalX(1);

    g.pos = { x: gx - 1.1, z: 0.02 };
    w.puck.pos = { x: gx - 6, z: 0.04 };

    const input = goalieInput(w, g);

    expect(v.len(input.move)).toBeLessThan(0.2);
  });

  it('holds its lane target through tiny puck jitter while set', () => {
    const w = world([{ id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true }]);
    const g = w.skaters.g;
    const gx = defendingGoalX(1);

    g.pos = { x: gx - 1.1, z: 0 };
    w.time = 1000;
    w.puck.pos = { x: gx - 6, z: 0.08 };
    const first = goalieInput(w, g);
    const targetZ = g.status.goalieTargetZ;

    w.time += 50;
    w.puck.pos = { x: gx - 6, z: -0.08 };
    const second = goalieInput(w, g);

    expect(g.status.goalieTargetZ).toBeCloseTo(targetZ, 5);
    expect(second.move).toEqual(first.move);
    expect(second.aim.z).toBeCloseTo(first.aim.z, 5);
  });

  it('retargets only when the shot lane meaningfully changes', () => {
    const w = world([{ id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true }]);
    const g = w.skaters.g;
    const gx = defendingGoalX(1);

    g.pos = { x: gx - 1.1, z: 0 };
    w.time = 1000;
    w.puck.pos = { x: gx - 5, z: 0.1 };
    goalieInput(w, g);
    const targetZ = g.status.goalieTargetZ;

    w.time += 50;
    w.puck.pos = { x: gx - 2, z: 4 };
    goalieInput(w, g);

    expect(g.status.goalieTargetZ).toBeGreaterThan(targetZ + 0.5);
  });

  it('settles fully when already inside the cached target radius', () => {
    const w = world([{ id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true }]);
    const g = w.skaters.g;
    const gx = defendingGoalX(1);

    g.pos = { x: gx - 1.1, z: 0 };
    w.time = 1000;
    w.puck.pos = { x: gx - 8, z: 0.2 };
    goalieInput(w, g);

    g.pos = { x: g.status.goalieTargetX + 0.05, z: g.status.goalieTargetZ - 0.05 };
    w.time += 50;
    w.puck.pos = { x: gx - 8, z: 0.21 };
    const input = goalieInput(w, g);

    expect(v.len(input.move)).toBe(0);
  });

  it('auto-passes after holding the puck for five seconds', () => {
    const w = world([
      { id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true },
      { id: 'm', team: 1, characterId: 'blaze', isBot: true, isGoalie: false },
    ]);
    const g = w.skaters.g;
    w.puck.carrier = 'g';
    w.puck.pos = { ...g.pos };

    expect(goalieInput(w, g).actions.pass).toBe(false);

    w.time = 4999;
    expect(goalieInput(w, g).actions.pass).toBe(false);

    w.time = 5000;
    expect(goalieInput(w, g).actions.pass).toBe(true);
  });

  it('stays set near center when the puck is wide but far from the net', () => {
    const w = world([{ id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true }]);
    const g = w.skaters.g;
    const gx = defendingGoalX(1);

    g.pos = { x: gx - 1.2, z: 0 };
    w.puck.pos = { x: gx - 16, z: 12 };

    const input = goalieInput(w, g);

    expect(v.len(input.move)).toBeLessThan(0.35);
  });

  it('slides laterally inside the crease when a close puck changes angle', () => {
    const w = world([{ id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true }]);
    const g = w.skaters.g;
    const gx = defendingGoalX(1);

    g.pos = { x: gx - 1.2, z: 0 };
    w.puck.pos = { x: gx - 2, z: 12 };

    const input = goalieInput(w, g);

    expect(input.move.z).toBeGreaterThan(0.7);
    expect(Math.abs(input.move.x)).toBeLessThan(0.4);
  });
});
