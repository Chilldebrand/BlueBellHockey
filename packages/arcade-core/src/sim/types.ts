import type { MatchMode } from "../config/match.js";
import type { PowerupType } from "../config/powerups.js";
import type { GoalieSlot, SkaterSlot, TeamId } from "../config/teams.js";

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputFrame {
  readonly playerId: string;
  readonly slotId: string;
  readonly sequence: number;
  readonly moveX: number;
  readonly moveY: number;
  /**
   * Raw right-stick sample in BODY space: stickY is forward (along facing,
   * push away = shoot direction), stickX is lateral (right of facing). The
   * client sends raw samples; the deterministic sim interprets stickhandling
   * and shot gestures from them (skill stick) — there is no shoot button.
   */
  readonly stickX: number;
  readonly stickY: number;
  readonly pass: boolean;
  readonly check: boolean;
  readonly turbo: boolean;
  readonly switchTarget: boolean;
  /** Deferred systems (powerups/specials) — legacy fields, not sent on the wire. */
  readonly usePowerup?: boolean;
  readonly special?: boolean;
}

export type WorldPhase = "waiting" | "playing" | "paused" | "ended";

export interface ScoreState {
  home: number;
  away: number;
}

export interface SimTime {
  readonly nowMs: number;
  readonly tick: number;
  readonly fixedTickMs: number;
}

/**
 * Stick blade offset in body space, eased toward the right-stick sample each
 * tick (rate-limited so the blade is a physical thing, not a teleport).
 * x = lateral (right of facing), y = forward reach. prev* holds last tick's
 * offset so blade velocity is derivable for pokes and shot power.
 */
export interface StickState {
  localX: number;
  localY: number;
  prevLocalX: number;
  prevLocalY: number;
}

export type GesturePhase = "neutral" | "handling" | "windup";

export type GestureReleaseType = "none" | "wrist" | "slap";

/**
 * Deterministic skill-stick gesture state, replicated with the skater so
 * server and client prediction interpret the same raw samples identically.
 */
export interface GestureState {
  phase: GesturePhase;
  /** Sim time the windup began; 0 when not winding. */
  windupStartMs: number;
  /** Peak back-depth reached during the windup (0..1). */
  windupDepth: number;
  /** Previous tick's raw stick sample (body space). */
  prevStickX: number;
  prevStickY: number;
  /** No new release fires before this sim time. */
  cooldownUntilMs: number;
  /** Shot latched this tick for the puck step to consume (then cleared). */
  pendingReleaseType: GestureReleaseType;
  /** Normalized 0..1 shot power for the pending release. */
  pendingReleasePower: number;
  /** Lateral stick position at release — aims the shot left/right of facing. */
  pendingReleaseSide: number;
}

export interface SkaterEntity {
  readonly id: string;
  readonly slot: SkaterSlot;
  readonly teamId: TeamId;
  position: Vec2;
  velocity: Vec2;
  /** Body orientation in radians on the sim plane (0 = +x). */
  facing: number;
  stick: StickState;
  gesture: GestureState;
  contactState: "ready" | "stumbling" | "knockedDown";
  contactStateUntilMs: number;
  checkCooldownUntilMs: number;
  activeCheckUntilMs: number;
  turboMeter: number;
  turboCooldownUntilMs: number;
  /** Shooting before this sim time fires a bonus one-timer (fed by a pass). */
  oneTimerUntilMs: number;
  selectedTargetSlotId: string | null;
  heldPowerupType: PowerupType | null;
  specialCharge: number;
  specialCooldownUntilMs: number;
}

export interface GoalieEntity {
  readonly id: string;
  readonly slot: GoalieSlot;
  readonly teamId: TeamId;
  readonly owner: "server";
  position: Vec2;
  velocity: Vec2;
}

export interface TeamStatTotals {
  goals: number;
  shots: number;
  saves: number;
  hits: number;
  takeaways: number;
}

export interface MatchStats {
  home: TeamStatTotals;
  away: TeamStatTotals;
  goals: ScoreState;
  shots: ScoreState;
  saves: ScoreState;
  hits: ScoreState;
  takeaways: ScoreState;
}

export interface PuckState {
  position: Vec2;
  velocity: Vec2;
  /** Height above the ice (0 = on the deck); shots can lift the puck. */
  height: number;
  verticalVelocity: number;
  carrierSlotId: string | null;
  lastTouchSlotId: string | null;
  shotBySlotId: string | null;
  shotPower: number;
  isChargedShot: boolean;
  /** Set while a pass is in flight — a teammate gathering it arms a one-timer. */
  passedFromSlotId: string | null;
  passedAtMs: number;
  pickupDisabledForSlotId: string | null;
  pickupDisabledUntilMs: number;
}

export interface ActivePowerup {
  readonly id: string;
  readonly type: PowerupType;
  readonly slotId: string | null;
  readonly position: Vec2 | null;
  readonly expiresAtMs: number;
}

export interface PowerupPickup {
  readonly id: string;
  readonly type: PowerupType;
  readonly position: Vec2;
  readonly spawnedAtMs: number;
}

export interface WorldEvent {
  readonly id: string;
  readonly type: string;
  readonly atMs: number;
  readonly sourceSlotId?: string;
  readonly targetSlotId?: string;
  readonly force?: number;
  /** Event-specific qualifier, e.g. the save type ("pad", "glove", ...). */
  readonly detail?: string;
}

export interface WorldState {
  readonly seed: number;
  readonly mode: MatchMode;
  time: SimTime;
  phase: WorldPhase;
  remainingMs: number;
  winnerTeamId: TeamId | null;
  score: ScoreState;
  stats: MatchStats;
  skaters: SkaterEntity[];
  goalies: GoalieEntity[];
  puck: PuckState;
  powerupPickups: PowerupPickup[];
  activePowerups: ActivePowerup[];
  eventQueue: WorldEvent[];
}
