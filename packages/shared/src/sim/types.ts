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
  // Deke / trick (WO-03): a transient lateral carry offset + a cooldown. While
  // dekeUntil > time the carried puck anchor bends along (dekeDirX, dekeDirZ).
  dekeUntil: number;
  dekeDirX: number;
  dekeDirZ: number;
  dekeCooldownUntil: number;
  // Slap shot (WO-08): hold-to-charge. Set when the carrier presses shoot; the
  // longer it's held before release, the more the shot ramps wrist -> slap. 0 when
  // not charging. Synced so clients can telegraph the wind-up.
  shootChargeStart: number;
  // Poke check (WO-08): brief cooldown after a jab so it can't be mashed.
  pokeCooldownUntil: number;
  // One-timer (WO-09): set when a skater takes possession straight off a teammate's
  // pass; shooting before this lapses fires a bonus-power/accuracy one-timer.
  oneTimerUntil: number;
  // Penalty (WO-17): a late/away-from-the-puck check boxes the offender until this
  // time — they sit out off-ice and their team plays short-handed (power play).
  penaltyUntil: number;
  // Goalie AI: sim-time when a goalie first covered/held the puck. -1 when unset.
  goaliePossessionStart: number;
  goalieTargetX: number;
  goalieTargetZ: number;
  goalieTargetUntil: number;
  // Goalie save pose: synced to render a procedural save matched to shot height/side.
  goalieSaveUntil: number;
  goalieSaveType: 'none' | 'pad' | 'body' | 'glove';
  goalieSaveSide: -1 | 0 | 1;
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
  combo: number; // current style-chain count (0 = no combo) — WO-04
  comboUntil: number; // sim-time the combo expires without a new style move
  /** previous-frame button states, for rising-edge detection (kept in state for determinism) */
  lastActions: ActionFlags;
}

export interface PuckState {
  pos: Vec2;
  vel: Vec2;
  y: number;
  vy: number;
  carrier: string | null;
  pickupCooldownUntil: number; // skater that just released can't instantly re-grab
  lastTouch: string | null; // for assist tracking
  assistTouch: string | null;
  // Bank-play marker (WO-04): set when a loose puck reflects off the boards, then
  // consumed on a same-team pickup to award one "off the wall" style event.
  bankedBy: string | null;
  bankedAt: number;
  mouthEntryTeam: Team | null;
  mouthEntryValid: boolean;
}

export interface ActionFlags {
  shoot: boolean;
  pass: boolean;
  hit: boolean;
  steal: boolean; // stick lift: close-range takeaway that gains possession
  ult: boolean;
  deke: boolean;
  poke: boolean; // poke check: longer-reach jab that knocks the puck loose
  sprint: boolean;
  switchPlayer: boolean;
}

export interface InputState {
  move: Vec2; // components in [-1,1]
  aim: Vec2; // direction (need not be normalized)
  shotPlacement?: number; // controller left-stick horizontal shot placement, -1..1
  lowShot?: boolean; // intentional low release: keeps the puck on the ice
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
  | { type: 'shot'; shooter: string; charge: number } // charge 0..1 (>~0.85 reads as a slapper)
  | { type: 'one_timer'; by: string } // WO-09 — shot fired straight off a pass
  | { type: 'pass'; from: string; to: string }
  | { type: 'hit'; by: string; target: string }
  | { type: 'steal'; by: string; from: string }
  | { type: 'poke'; by: string; from: string }
  | { type: 'block'; by: string }
  | { type: 'save'; by: string; shooter: string | null; rebound: boolean } // WO-09 — goalie stop
  | { type: 'deke'; by: string }
  | { type: 'ankle_break'; by: string; target: string }
  | { type: 'bank_play'; by: string }
  | { type: 'nolook_pass'; from: string; to: string }
  | { type: 'ult'; by: string; ultimateId: string }
  | { type: 'pickup'; by: string; kind: PickupKind } // WO-16 — grabbed an ice token
  | { type: 'penalty'; on: string; team: Team } // WO-17 — bad hit → power play
  | { type: 'faceoff' }
  | { type: 'period'; period: number }
  | { type: 'phase'; phase: MatchPhase };

/** Cumulative per-skater box-score line (WO-09). Tallied from SimEvents each step. */
export interface PlayerStats {
  goals: number;
  assists: number;
  hits: number;
  takeaways: number; // stick lifts + poke checks
  saves: number; // goalie stops
  shots: number;
}

export function emptyStats(): PlayerStats {
  return { goals: 0, assists: 0, hits: 0, takeaways: 0, saves: 0, shots: 0 };
}

// Ice pickups (WO-16): tokens that spawn mid-rink and grant a buff when a skater
// glides over them.
export type PickupKind = 'boost' | 'charge';
export interface Pickup {
  id: string;
  kind: PickupKind;
  pos: Vec2;
  spawnedAt: number; // sim-time it appeared (for despawn)
}

export interface WorldState {
  time: number; // accumulated sim time in ms
  phase: MatchPhase;
  // Game-mode config (WO-15): the same sim runs under these. Set by createWorld.
  periods: number; // regulation periods before OT/end
  periodMs: number; // length of each period
  targetGoals: number; // first to this many goals wins instantly (0 = no target)
  suddenDeathOT: boolean; // a tie after regulation goes to OT
  period: number; // 1..periods (or periods+1 for OT)
  clock: number; // ms remaining in current period
  phaseTimer: number; // ms remaining for countdown/intermission/overtime
  pauseUntil: number; // gameplay/clock frozen until this sim-time (goal celebration)
  // Goal reset is deferred to the end of the celebration pause (WO-10) so the puck
  // visibly sits in the net instead of teleporting to center the instant it scores.
  goalResetPending: boolean;
  score: [number, number];
  skaters: Record<string, SkaterState>;
  puck: PuckState;
  /** ice pickups currently on the rink (WO-16) */
  pickups: Pickup[];
  pickupTimer: number; // ms until the next spawn check
  pickupSeq: number; // monotonic id source for pickups
  /** cumulative per-skater box score (WO-09), keyed by skater id */
  stats: Record<string, PlayerStats>;
  /** deterministic random source for authoritative sim rolls */
  rng: () => number;
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
    dekeUntil: 0,
    dekeDirX: 0,
    dekeDirZ: 0,
    dekeCooldownUntil: 0,
    shootChargeStart: 0,
    pokeCooldownUntil: 0,
    oneTimerUntil: 0,
    penaltyUntil: 0,
    goaliePossessionStart: -1,
    goalieTargetX: 0,
    goalieTargetZ: 0,
    goalieTargetUntil: 0,
    goalieSaveUntil: 0,
    goalieSaveType: 'none',
    goalieSaveSide: 0,
  };
}

export function emptyActions(): ActionFlags {
  return {
    shoot: false,
    pass: false,
    hit: false,
    steal: false,
    ult: false,
    deke: false,
    poke: false,
    sprint: false,
    switchPlayer: false,
  };
}

export function neutralInput(): InputState {
  return { move: { x: 0, z: 0 }, aim: { x: 0, z: 0 }, actions: emptyActions() };
}
