import type { MatchMode } from "../config/match.js";
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
  readonly home: number;
  readonly away: number;
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
}

export interface GoalieEntity {
  readonly id: string;
  readonly slot: GoalieSlot;
  readonly teamId: TeamId;
  readonly owner: "server";
  position: Vec2;
  velocity: Vec2;
}

export interface PuckState {
  position: Vec2;
  velocity: Vec2;
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
  readonly type: string;
  readonly slotId: string | null;
  readonly expiresAtMs: number;
}

export interface WorldEvent {
  readonly id: string;
  readonly type: string;
  readonly atMs: number;
}

export interface WorldState {
  readonly seed: number;
  readonly mode: MatchMode;
  time: SimTime;
  phase: WorldPhase;
  score: ScoreState;
  skaters: SkaterEntity[];
  goalies: GoalieEntity[];
  puck: PuckState;
  activePowerups: ActivePowerup[];
  eventQueue: WorldEvent[];
}
