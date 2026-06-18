import { describe, expect, it } from 'vitest';
import {
  CHARGE,
  COMBO,
  awardCharge,
  awardStyle,
  breakCombo,
  comboMultiplier,
  tickCharge,
} from './charge.js';
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
    combo: 0,
    comboUntil: 0,
    lastActions: emptyActions(),
  };
}

describe('style / gamebreaker charge', () => {
  it('passive fill (zero plays) reaches full only at the 9:00 floor', () => {
    const s = skater();
    const dt = 1000 / 30;
    let t = 0;
    // halfway through the floor a passive player is nowhere near full
    while (t < CHARGE.fullChargeFloorMs / 2) {
      tickCharge(s, dt);
      t += dt;
    }
    expect(s.ultCharge).toBeLessThan(0.6);
    while (s.ultCharge < 1 && t < 600000) {
      tickCharge(s, dt);
      t += dt;
    }
    // within one tick of the floor (540000ms)
    expect(Math.abs(t - CHARGE.fullChargeFloorMs)).toBeLessThanOrEqual(dt);
  });

  it('safe play (only shots/passes) charges slowly — not full in 2:00', () => {
    const s = skater();
    const dt = 1000 / 30;
    let t = 0;
    let next = 0;
    while (t < CHARGE.perfectCadenceMs) {
      tickCharge(s, dt);
      t += dt;
      if (t >= next) {
        // a safe player just rings shots and dumps passes every ~5s
        awardCharge(s, Math.floor(t / 5000) % 2 === 0 ? 'shot' : 'pass');
        next += 5000;
      }
    }
    expect(s.ultCharge).toBeLessThan(1);
  });

  it('an aggressive style shift fills the bar within ~2:00', () => {
    const s = skater();
    const dt = 1000 / 30;
    // a Street highlight reel: dangles, ankle-breaks, takeaways, big hits
    const plays: Array<[number, string]> = [
      [10000, 'deke'],
      [14000, 'ankle_break'],
      [22000, 'steal'],
      [30000, 'hit'],
      [40000, 'deke'],
      [44000, 'ankle_break'],
      [55000, 'assist'],
      [70000, 'steal'],
      [80000, 'hit'],
      [95000, 'deke'],
      [100000, 'ankle_break'],
      [115000, 'goal'],
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

  it('every style award key exists and is positive (guards WO-03/04 typos)', () => {
    for (const key of ['deke', 'ankle_break', 'bank_play', 'nolook_pass']) {
      expect(CHARGE.awards[key], key).toBeGreaterThan(0);
    }
    // an award with a key advances the meter; an unknown key is a safe no-op
    const s = skater();
    awardCharge(s, 'deke');
    expect(s.ultCharge).toBeCloseTo(CHARGE.awards.deke, 6);
    const before = s.ultCharge;
    awardCharge(s, 'not_a_real_event');
    expect(s.ultCharge).toBe(before);
  });
});

describe('combo multiplier (WO-04)', () => {
  it('awardStyle multiplies the base award by the current combo multiplier and advances', () => {
    const s = skater();
    s.combo = 4; // multiplier from the chain so far = 1 + 4*0.25 = 2.0
    awardStyle(s, 'hit', 1000);
    expect(s.ultCharge).toBeCloseTo(CHARGE.awards.hit * comboMultiplier(4), 6);
    expect(s.combo).toBe(5); // advanced one link
    expect(s.comboUntil).toBe(1000 + COMBO.windowMs); // window refreshed
  });

  it('the multiplier is capped', () => {
    expect(comboMultiplier(1000)).toBe(comboMultiplier(COMBO.cap));
    expect(comboMultiplier(0)).toBe(1);
  });

  it('plain shot/pass charge does not advance the combo', () => {
    const s = skater();
    awardCharge(s, 'shot');
    awardCharge(s, 'pass');
    expect(s.combo).toBe(0);
    expect(s.ultCharge).toBeGreaterThan(0); // but still gave base charge
  });

  it('breakCombo zeroes the chain', () => {
    const s = skater();
    s.combo = 5;
    s.comboUntil = 9999;
    breakCombo(s);
    expect(s.combo).toBe(0);
    expect(s.comboUntil).toBe(0);
  });
});
