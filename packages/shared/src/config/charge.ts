import type { SkaterState } from '../sim/types.js';

// Match timing.
export const PERIOD_MS = 3 * 60 * 1000; // 3 minutes
export const PERIODS = 3;
export const TOTAL_PLAY_MS = PERIOD_MS * PERIODS; // 9:00
export const COUNTDOWN_MS = 3000;
export const INTERMISSION_MS = 15000;
export const OVERTIME_MS = 2 * 60 * 1000;

// Ultimate charge model. C in [0,1].
// Passive fill (zero positive plays) completes in 7:30. Positive plays add on top
// so a maximal-cadence player completes roughly every 2:00.
export const CHARGE = {
  fullChargeFloorMs: 7 * 60 * 1000 + 30 * 1000, // 450000
  perfectCadenceMs: 2 * 60 * 1000, // 120000
  get passivePerMs(): number {
    return 1 / this.fullChargeFloorMs;
  },
  // Award per positive-play event type (fraction of a full bar). Tunable.
  awards: {
    goal: 0.2,
    assist: 0.12,
    steal: 0.1,
    block: 0.1,
    hit: 0.08,
    shot: 0.05,
    pass: 0.03,
  } as Record<string, number>,
};

export function tickCharge(s: SkaterState, dtMs: number): void {
  s.ultCharge = Math.min(1, s.ultCharge + CHARGE.passivePerMs * dtMs);
}

export function awardCharge(s: SkaterState, eventType: string): void {
  const a = CHARGE.awards[eventType] ?? 0;
  if (a > 0) s.ultCharge = Math.min(1, s.ultCharge + a);
}
