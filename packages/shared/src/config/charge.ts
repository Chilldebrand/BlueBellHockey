import type { SkaterState } from '../sim/types.js';

// Match timing.
export const PERIOD_MS = 3 * 60 * 1000; // 3 minutes
export const PERIODS = 3;
export const TOTAL_PLAY_MS = PERIOD_MS * PERIODS; // 9:00
export const COUNTDOWN_MS = 3000;
export const INTERMISSION_MS = 15000;
export const OVERTIME_MS = 2 * 60 * 1000;

// Style / Gamebreaker charge model. C in [0,1]. (WO-01)
// The meter is earned by *style*, not passive time: the passive floor is lowered
// to 9:00 (a shut-out player still eventually charges), while flashy/aggressive
// plays — hits, steals, dekes, ankle-breaks — pay the most. An aggressive Street
// shift fills the bar in ~1:30–2:30.
export const CHARGE = {
  fullChargeFloorMs: 9 * 60 * 1000, // 540000 — passive fill with zero plays
  perfectCadenceMs: 2 * 60 * 1000, // 120000 — reference window for an aggressive shift
  get passivePerMs(): number {
    return 1 / this.fullChargeFloorMs;
  },
  // Award per positive-play event type (fraction of a full bar). This table is the
  // single source of truth for style values. Keys with no emitter yet (style
  // events from WO-03/04) are listed dormant — `awardCharge` no-ops on unknown
  // keys, so wiring the values in early is safe.
  awards: {
    goal: 0.14, // still strong, no longer dominant
    assist: 0.12,
    steal: 0.12, // takeaways are hype
    block: 0.12, // sells defense
    hit: 0.1, // big checks are style
    shot: 0.03, // discourage meter-farming via shots
    pass: 0.02, // plain passes shouldn't farm
    deke: 0.06, // WO-03 — beat a defender
    ankle_break: 0.1, // WO-03 — the signature highlight
    bank_play: 0.06, // WO-04 — off-the-wall give-and-go
    nolook_pass: 0.05, // WO-04 — pass while facing away
  } as Record<string, number>,
};

export function tickCharge(s: SkaterState, dtMs: number): void {
  s.ultCharge = Math.min(1, s.ultCharge + CHARGE.passivePerMs * dtMs);
}

export function awardCharge(s: SkaterState, eventType: string): void {
  const a = CHARGE.awards[eventType] ?? 0;
  if (a > 0) s.ultCharge = Math.min(1, s.ultCharge + a);
}
