import { describe, expect, it } from 'vitest';
import { sampleAt } from './interpolation.js';
import type { Snapshot } from '../net/client.js';

function snap(t: number, serverTime: number, py: number, goalieSaveUntil: number): Snapshot {
  return {
    t,
    serverTime,
    skaters: {
      g: {
        id: 'g',
        team: 1,
        characterId: 'tank',
        isBot: true,
        isGoalie: true,
        px: 0,
        pz: 0,
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
        goalieSaveUntil,
        goalieSaveType: 'glove',
        goalieSaveSide: 1,
        ackSeq: 0,
      },
    },
    puck: { px: 0, pz: 0, py, vx: 0, vz: 0, vy: 0, carrier: '' },
  };
}

describe('interpolation', () => {
  it('interpolates puck height and exposes active goalie save poses', () => {
    const frame = sampleAt([snap(0, 1000, 0, 0), snap(100, 1100, 2, 1300)], 50);

    expect(frame?.puck.y).toBeCloseTo(1);
    expect(frame?.skaters[0].goalieSaveType).toBe('glove');
    expect(frame?.skaters[0].goalieSaveSide).toBe(1);
    expect(frame?.skaters[0].goalieSaving).toBe(true);
  });
});
