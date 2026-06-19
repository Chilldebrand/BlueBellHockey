import { PERIOD_MS } from './charge.js';

// Game modes (WO-15). Each is a config the *same* continuous sim runs under — no
// separate game loop — varying period structure, a sudden win target, roster size,
// and whether a tie goes to sudden-death overtime.
export type GameModeId = 'regulation' | 'first5' | 'blitz' | '1v1';

export interface GameModeDef {
  id: GameModeId;
  name: string;
  description: string;
  periods: number; // regulation periods before OT/end
  periodMs: number; // length of each period
  targetGoals: number; // first team to this many goals wins instantly (0 = no target)
  skatersPerTeam: number; // human-capable skaters per team (3 normal, 1 for a duel)
  suddenDeathOT: boolean; // a tie after regulation goes to sudden-death OT
}

export const GAME_MODES: Record<GameModeId, GameModeDef> = {
  regulation: {
    id: 'regulation',
    name: 'Regulation',
    description: '3 periods × 3:00, sudden-death OT on a tie.',
    periods: 3,
    periodMs: PERIOD_MS,
    targetGoals: 0,
    skatersPerTeam: 3,
    suddenDeathOT: true,
  },
  first5: {
    id: 'first5',
    name: 'First to 5',
    description: 'No periods — first team to 5 goals takes it.',
    periods: 1,
    periodMs: 10 * 60 * 1000, // a generous cap; the goal target usually ends it first
    targetGoals: 5,
    skatersPerTeam: 3,
    suddenDeathOT: true,
  },
  blitz: {
    id: 'blitz',
    name: 'Blitz',
    description: 'One frantic 3:00 period, OT on a tie.',
    periods: 1,
    periodMs: PERIOD_MS,
    targetGoals: 0,
    skatersPerTeam: 3,
    suddenDeathOT: true,
  },
  '1v1': {
    id: '1v1',
    name: '1-on-1',
    description: 'Duel — one skater each, 3 × 2:00.',
    periods: 3,
    periodMs: 2 * 60 * 1000,
    targetGoals: 0,
    skatersPerTeam: 1,
    suddenDeathOT: true,
  },
};

export const DEFAULT_MODE: GameModeId = 'regulation';

export function getMode(id: string | undefined | null): GameModeDef {
  return (id && (GAME_MODES as Record<string, GameModeDef>)[id]) || GAME_MODES[DEFAULT_MODE];
}
