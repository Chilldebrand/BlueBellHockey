// Core simulation types. The ice is the X/Z plane (Y is up, unused by physics).

export interface Vec2 {
  x: number;
  z: number;
}

export type Team = 0 | 1;

export interface AttributeSet {
  speed: number;
  hit: number;
  steal: number;
  shoot: number;
  pass: number;
}

export type AttributeKey = keyof AttributeSet;

/** Timed buffs/debuffs. Timestamps are absolute sim-time in ms (WorldState.time). */
export interface SkaterStatus {
  speedMult: number; // movement speed multiplier (ultimates)
  speedMultUntil: number; // when speedMult resets to 1
  attrBonus: number; // flat bonus added to every attribute (Overdrive)
  attrBonusUntil: number;
  shootPowerMult: number; // shot power multiplier
  shootPowerUntil: number;
  intangibleUntil: number; // skips skater-skater collision (Phase)
  frozenUntil: number; // cannot move or act (Deep Freeze)
  staggeredUntil: number; // knocked down by a hit
  checkingUntil: number; // body contact flattens opponents (Freight Train)
  magnetUntil: number; // pulls loose puck / strips carriers nearby (Magnet)
  passPerfectUntil: number; // passes auto-complete to best teammate (Vision)
  guaranteedGoal: boolean; // next on-net shot scores (Cannon)
}

export interface SkaterState {
  id: string;
  team: Team;
  characterId: string;
  isBot: boolean;
  isGoalie: boolean;
  pos: Vec2;
  vel: Vec2;
  facing: number; // radians
  status: SkaterStatus;
  ultCharge: number; // 0..1
  ultActiveUntil: number; // absolute sim-time ms; 0 if inactive
  /** previous-frame button states, for rising-edge detection (kept in state for determinism) */
  lastActions: ActionFlags;
}

export interface PuckState {
  pos: Vec2;
  vel: Vec2;
  carrier: string | null;
  pickupCooldownUntil: number; // skater that just released can't instantly re-grab
  lastTouch: string | null; // for assist tracking
  assistTouch: string | null;
}

export interface ActionFlags {
  shoot: boolean;
  pass: boolean;
  hit: boolean;
  steal: boolean;
  ult: boolean;
}

export interface InputState {
  move: Vec2; // components in [-1,1]
  aim: Vec2; // direction (need not be normalized)
  actions: ActionFlags;
}

export type MatchPhase =
  | 'lobby'
  | 'countdown'
  | 'period'
  | 'intermission'
  | 'overtime'
  | 'ended';

export type SimEvent =
  | { type: 'goal'; team: Team; scorer: string; assist: string | null }
  | { type: 'gamebreaker'; team: Team; scorer: string; value: number }
  | { type: 'shot'; shooter: string }
  | { type: 'pass'; from: string; to: string }
  | { type: 'hit'; by: string; target: string }
  | { type: 'steal'; by: string; from: string }
  | { type: 'block'; by: string }
  | { type: 'ult'; by: string; ultimateId: string }
  | { type: 'faceoff' }
  | { type: 'period'; period: number }
  | { type: 'phase'; phase: MatchPhase };

export interface WorldState {
  time: number; // accumulated sim time in ms
  phase: MatchPhase;
  period: number; // 1..3 (or 4 for OT)
  clock: number; // ms remaining in current period
  phaseTimer: number; // ms remaining for countdown/intermission/overtime
  pauseUntil: number; // gameplay/clock frozen until this sim-time (goal celebration)
  score: [number, number];
  skaters: Record<string, SkaterState>;
  puck: PuckState;
  /** one-shot events produced during the most recent step(); consumer reads then they reset */
  events: SimEvent[];
}

export function emptyStatus(): SkaterStatus {
  return {
    speedMult: 1,
    speedMultUntil: 0,
    attrBonus: 0,
    attrBonusUntil: 0,
    shootPowerMult: 1,
    shootPowerUntil: 0,
    intangibleUntil: 0,
    frozenUntil: 0,
    staggeredUntil: 0,
    checkingUntil: 0,
    magnetUntil: 0,
    passPerfectUntil: 0,
    guaranteedGoal: false,
  };
}

export function emptyActions(): ActionFlags {
  return { shoot: false, pass: false, hit: false, steal: false, ult: false };
}

export function neutralInput(): InputState {
  return { move: { x: 0, z: 0 }, aim: { x: 0, z: 0 }, actions: emptyActions() };
}
