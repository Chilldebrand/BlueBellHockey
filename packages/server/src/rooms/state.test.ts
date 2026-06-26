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

  it('syncs puck height and goalie save pose fields', () => {
    const state = new MatchState();
    const w = createWorld([
      { id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true },
    ]);
    w.puck.y = 1.25;
    w.puck.vy = 4.5;
    w.skaters.g.status.goalieSaveUntil = 1234;
    w.skaters.g.status.goalieSaveType = 'glove';
    w.skaters.g.status.goalieSaveSide = -1;

    syncState(state, w);

    expect(state.puck.py).toBeCloseTo(1.25);
    expect(state.puck.vy).toBeCloseTo(4.5);
    const goalie = state.skaters.get('g');
    expect(goalie?.goalieSaveUntil).toBe(1234);
    expect(goalie?.goalieSaveType).toBe('glove');
    expect(goalie?.goalieSaveSide).toBe(-1);
  });
});
