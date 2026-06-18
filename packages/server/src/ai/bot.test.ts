import { describe, expect, it } from 'vitest';
import { attackingGoalX, createWorld, defendingGoalX, type RosterEntry } from '@bbh/shared';
import { decideUlt } from './bot.js';

function world(roster: RosterEntry[]) {
  const w = createWorld(roster);
  w.phase = 'period';
  return w;
}

describe('bot ult policy (WO-06)', () => {
  it('a shooter fires only when carrying within range, never on an empty meter', () => {
    const w = world([
      { id: 'a', team: 0, characterId: 'sniper', isBot: true, isGoalie: false }, // cannon
      { id: 'b', team: 1, characterId: 'tank', isBot: true, isGoalie: false },
    ]);
    const a = w.skaters.a;
    a.ultCharge = 1;
    a.pos = { x: attackingGoalX(0) - 8, z: 0 }; // 8 from the net
    w.puck.carrier = 'a';
    expect(decideUlt(w, a)).toBe(true);

    a.ultCharge = 0; // empty meter → hold
    expect(decideUlt(w, a)).toBe(false);

    a.ultCharge = 1;
    w.puck.carrier = null; // not carrying → hold
    expect(decideUlt(w, a)).toBe(false);
  });

  it('a speed ult fires with a clear lane and holds when a defender blocks it', () => {
    const w = world([
      { id: 'a', team: 0, characterId: 'blaze', isBot: true, isGoalie: false }, // afterburner
      { id: 'b', team: 1, characterId: 'tank', isBot: true, isGoalie: false },
    ]);
    const a = w.skaters.a;
    a.ultCharge = 1;
    a.pos = { x: 0, z: 0 };
    w.puck.carrier = 'a';

    w.skaters.b.pos = { x: -20, z: 0 }; // behind → open ice ahead
    expect(decideUlt(w, a)).toBe(true);

    w.skaters.b.pos = { x: 8, z: 0 }; // square in the lane to the net
    expect(decideUlt(w, a)).toBe(false);
  });

  it('a disruption ult fires on defense when an opposing carrier is near our net', () => {
    const w = world([
      { id: 'a', team: 0, characterId: 'tank', isBot: true, isGoalie: false }, // shockwave
      { id: 'b', team: 1, characterId: 'sniper', isBot: true, isGoalie: false },
    ]);
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.ultCharge = 1;
    b.pos = { x: defendingGoalX(0) + 7, z: 0 }; // attacking our net
    a.pos = { x: defendingGoalX(0) + 5, z: 0 }; // in reach of the carrier
    w.puck.carrier = 'b';
    expect(decideUlt(w, a)).toBe(true);

    b.pos = { x: 0, z: 0 }; // carrier at center, far from our net
    a.pos = { x: 1, z: 0 };
    expect(decideUlt(w, a)).toBe(false);
  });
});
