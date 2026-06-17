import { describe, expect, it } from 'vitest';
import { CHARGE, awardCharge, tickCharge } from './charge.js';
import { emptyActions, emptyStatus, type SkaterState } from '../sim/types.js';

function skater(): SkaterState {
  return {
    id: 's',
    team: 0,
    characterId: 'blaze',
    isBot: false,
    isGoalie: false,
    pos: { x: 0, z: 0 },
    vel: { x: 0, z: 0 },
    facing: 0,
    status: emptyStatus(),
    ultCharge: 0,
    ultActiveUntil: 0,
    lastActions: emptyActions(),
  };
}

describe('ultimate charge', () => {
  it('reaches full in 7:30 with zero positive plays', () => {
    const s = skater();
    const dt = 1000 / 30;
    let t = 0;
    while (s.ultCharge < 1 && t < 600000) {
      tickCharge(s, dt);
      t += dt;
    }
    // within one tick of 450000ms
    expect(Math.abs(t - CHARGE.fullChargeFloorMs)).toBeLessThanOrEqual(dt);
  });

  it('a perfect-play cadence fills the bar within 2:00', () => {
    const s = skater();
    const dt = 1000 / 30;
    // a representative "perfect" 2-minute shift of positive plays
    const plays: Array<[number, string]> = [
      [15000, 'steal'],
      [25000, 'pass'],
      [35000, 'shot'],
      [45000, 'hit'],
      [60000, 'steal'],
      [75000, 'pass'],
      [90000, 'shot'],
      [100000, 'assist'],
      [110000, 'goal'],
    ];
    let t = 0;
    let pi = 0;
    while (t < CHARGE.perfectCadenceMs) {
      tickCharge(s, dt);
      t += dt;
      while (pi < plays.length && t >= plays[pi][0]) {
        awardCharge(s, plays[pi][1]);
        pi++;
      }
    }
    expect(s.ultCharge).toBeGreaterThanOrEqual(1);
  });
});
