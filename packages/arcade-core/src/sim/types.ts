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
  readonly aimX: number;
  readonly aimY: number;
  readonly pass: boolean;
  readonly shoot: boolean;
  readonly check: boolean;
  readonly turbo: boolean;
  readonly switchTarget: boolean;
  readonly usePowerup: boolean;
  readonly special: boolean;
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

export interface SkaterEntity {
  readonly id: string;
  readonly slot: SkaterSlot;
  readonly teamId: TeamId;
  position: Vec2;
  velocity: Vec2;
  /** Body orientation in radians on the sim plane (0 = +x). */
  facing: number;
  contactState: "ready" | "stumbling" | "knockedDown";
  contactStateUntilMs: number;
  checkCooldownUntilMs: number;
  activeCheckUntilMs: number;
  turboMeter: number;
  turboCooldownUntilMs: number;
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
  chargeBySlotId: string | null;
  chargeStartedAtMs: number | null;
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
