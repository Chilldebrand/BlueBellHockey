import { describe, expect, it } from 'vitest';
import { canTeamControl, nextSkaterOnTeam } from './control.js';

const slots = [
  { id: 's0', team: 0 as const },
  { id: 's1', team: 0 as const },
  { id: 's2', team: 0 as const },
  { id: 's3', team: 1 as const },
];

describe('solo team control', () => {
  it('cycles only through field skaters on the player team', () => {
    expect(nextSkaterOnTeam(slots, 's0', 0)).toBe('s1');
    expect(nextSkaterOnTeam(slots, 's1', 0)).toBe('s2');
    expect(nextSkaterOnTeam(slots, 's2', 0)).toBe('s0');
  });

  it('allows team control only when unlocked and alone on that team', () => {
    expect(canTeamControl({ locked: false, humansOnTeam: 1 })).toBe(true);
    expect(canTeamControl({ locked: true, humansOnTeam: 1 })).toBe(false);
    expect(canTeamControl({ locked: false, humansOnTeam: 2 })).toBe(false);
  });
});
