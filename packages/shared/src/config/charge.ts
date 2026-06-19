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
    steal: 0.12, // takeaways are hype (stick lift)
    poke: 0.08, // WO-08 — knock the puck loose (recovery not guaranteed)
    block: 0.12, // sells defense
    hit: 0.1, // big checks are style
    shot: 0.03, // discourage meter-farming via shots
    pass: 0.02, // plain passes shouldn't farm
    deke: 0.06, // WO-03 — beat a defender
    ankle_break: 0.1, // WO-03 — the signature highlight
    bank_play: 0.06, // WO-04 — off-the-wall give-and-go
    nolook_pass: 0.05, // WO-04 — pass while facing away
    one_timer: 0.07, // WO-09 — shoot straight off a pass
    save: 0.1, // WO-09 — goalie robs a shooter (defensive style)
  } as Record<string, number>,
};

export function tickCharge(s: SkaterState, dtMs: number): void {
  s.ultCharge = Math.min(1, s.ultCharge + CHARGE.passivePerMs * dtMs);
}

export function awardCharge(s: SkaterState, eventType: string): void {
  const a = CHARGE.awards[eventType] ?? 0;
  if (a > 0) s.ultCharge = Math.min(1, s.ultCharge + a);
}

// Combo multiplier (WO-04). Chaining style moves without a turnover raises a
// rising multiplier on style-meter gains; a turnover resets it to zero.
export const COMBO = {
  windowMs: 3500, // a new style move must land within this to keep the chain
  step: 0.25, // +25% per chain link
  cap: 6, // multiplier tops out at 1 + 6*0.25 = 2.5x
  maxTrack: 99, // keep the raw count bounded (uint8-safe in the schema)
};

/** Style-gain multiplier for a skater currently at `combo` chain links. */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(0, combo), COMBO.cap) * COMBO.step;
}

/**
 * Single entry point for *style* meter awards: applies the current combo
 * multiplier exactly once, then advances + refreshes the combo. Plain `shot`/
 * `pass` should keep using `awardCharge` so they grant base charge without
 * touching the combo. (WO-04)
 */
export function awardStyle(s: SkaterState, eventType: string, time: number): void {
  const base = CHARGE.awards[eventType] ?? 0;
  const mult = comboMultiplier(s.combo); // multiplier from the chain so far
  if (base > 0) s.ultCharge = Math.min(1, s.ultCharge + base * mult);
  s.combo = Math.min(s.combo + 1, COMBO.maxTrack);
  s.comboUntil = time + COMBO.windowMs;
}

/** Drop a combo to zero (a turnover: checked, frozen, or stripped). */
export function breakCombo(s: SkaterState): void {
  s.combo = 0;
  s.comboUntil = 0;
}
