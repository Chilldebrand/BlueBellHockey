import { describe, expect, it } from 'vitest';
import { createWorld, type RosterEntry } from '@bbh/shared';
import { MatchState, syncState } from './state.js';

describe('syncState', () => {
  it('refreshes mutable skater identity fields on existing rows', () => {
    const state = new MatchState();
    const first: RosterEntry[] = [
      { id: 's0', team: 0, characterId: 'blaze', isBot: true, isGoalie: false },
    ];
    const second: RosterEntry[] = [
      { id: 's0', team: 1, characterId: 'tank', isBot: false, isGoalie: true },
    ];

    syncState(state, createWorld(first));
    syncState(state, createWorld(second));

    const row = state.skaters.get('s0');
    expect(row?.team).toBe(1);
    expect(row?.characterId).toBe('tank');
    expect(row?.isBot).toBe(false);
    expect(row?.isGoalie).toBe(true);
  });
});
