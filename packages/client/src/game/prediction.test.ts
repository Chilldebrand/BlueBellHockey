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
    intangibleUntil: 0,
    dekeUntil: 0,
    dekeDirX: 0,
    dekeDirZ: 0,
    shootChargeStart: 0,
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
});
