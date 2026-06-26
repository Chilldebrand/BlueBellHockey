import { describe, expect, it } from 'vitest';
import { neutralInput } from '@bbh/shared';
import { predictLocal } from './prediction.js';
import type { Snapshot, SkaterSnap } from '../net/client.js';

function skater(id: string, px: number, pz: number): SkaterSnap {
  return {
    id,
    team: 0,
    characterId: 'blaze',
    isBot: false,
    isGoalie: false,
    controllerIndex: -1,
    px,
    pz,
    vx: 0,
    vz: 0,
    facing: 0,
    ultCharge: 0,
    ultActiveUntil: 0,
    combo: 0,
    comboUntil: 0,
    frozenUntil: 0,
    staggeredUntil: 0,
    downedUntil: 0,
    intangibleUntil: 0,
    dekeUntil: 0,
    dekeDirX: 0,
    dekeDirZ: 0,
    shootChargeStart: 0,
    shootGlideDirX: 0,
    shootGlideDirZ: 0,
    goalieSaveUntil: 0,
    goalieSaveType: 'none',
    goalieSaveSide: 0,
    ackSeq: 0,
  };
}

function snap(): Snapshot {
  return {
    t: 0,
    serverTime: 0,
    skaters: {
      s0: skater('s0', 0, 0),
      s1: skater('s1', 50, -12),
    },
    puck: { px: 50, pz: -12, py: 0, vx: 0, vz: 0, vy: 0, carrier: 's1' },
  };
}

describe('prediction', () => {
  it('starts from the new controlled skater when control follows the puck carrier', () => {
    const previous = { id: 's0', x: 0, z: 0, facing: 0 };

    const predicted = predictLocal([snap()], 's1', neutralInput(), 1 / 60, previous);

    expect(predicted?.x).toBeCloseTo(50);
    expect(predicted?.z).toBeCloseTo(-12);
  });

  it('keeps local slap-shot windup prediction gliding in the synced start direction', () => {
    const snapshot = snap();
    snapshot.serverTime = 1500;
    snapshot.puck.carrier = 's1';
    snapshot.skaters.s1.px = 0;
    snapshot.skaters.s1.pz = 0;
    snapshot.skaters.s1.shootChargeStart = 1300;
    snapshot.skaters.s1.shootGlideDirX = 1;
    snapshot.skaters.s1.shootGlideDirZ = 0;

    const input = neutralInput();
    input.move = { x: 0, z: 1 };
    input.actions.shoot = true;
    input.actions.sprint = true;

    const predicted = predictLocal([snapshot], 's1', input, 0.1, null);

    expect(predicted?.x).toBeGreaterThan(0.4);
    expect(Math.abs(predicted?.z ?? 0)).toBeLessThan(0.01);
  });

  it('predicts sprint faster than base while preserving the carrying tradeoff', () => {
    const baseInput = neutralInput();
    baseInput.move = { x: 1, z: 0 };

    const sprintInput = neutralInput();
    sprintInput.move = { x: 1, z: 0 };
    sprintInput.actions.sprint = true;

    const free = snap();
    free.puck.carrier = '';
    const freeBase = predictLocal([free], 's1', baseInput, 0.1, null);
    const freeSprint = predictLocal([free], 's1', sprintInput, 0.1, null);

    const carrying = snap();
    carrying.puck.carrier = 's1';
    const carrySprint = predictLocal([carrying], 's1', sprintInput, 0.1, null);

    expect((freeSprint?.x ?? 0) - 50).toBeGreaterThan(((freeBase?.x ?? 0) - 50) * 1.1);
    expect((carrySprint?.x ?? 0) - 50).toBeLessThan(((freeSprint?.x ?? 0) - 50) * 0.88);
  });
});
