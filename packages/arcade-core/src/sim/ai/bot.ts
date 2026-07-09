import { normalizeOrZero } from "../physics.js";
import type { InputFrame, SkaterEntity, WorldState } from "../types.js";
import {
  ARRIVAL_RADIUS,
  DEFAULT_BOT_DIFFICULTY,
  selectBotDecision,
  type BotDifficulty,
  type BotIntent
} from "./decision.js";

/** Roles that hold a station — ease in and settle rather than orbiting it. */
const SETTLING_INTENTS: ReadonlySet<BotIntent> = new Set([
  "support",
  "screen",
  "stretch",
  "trail",
  "cover",
  "protect-slot",
  "recover",
  "reset-shape"
]);

/**
 * Bots speak the same skill-stick protocol as humans: raw stick samples the
 * deterministic sim turns into gestures. A shooting bot snaps the stick full
 * forward — the sample-to-sample jump reads as a wrist flick. (Slap windups
 * are a future bot skill.) Otherwise the stick rests neutral.
 */
export function createBotInputFrame(
  bot: SkaterEntity,
  world: WorldState,
  sequence: number,
  difficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY
): InputFrame {
  const decision = selectBotDecision(bot, world, difficulty);
  const toTarget = {
    x: decision.moveTarget.x - bot.position.x,
    y: decision.moveTarget.y - bot.position.y
  };
  // Arrival damping for station roles: full stick far out, easing to neutral
  // at the spot — otherwise bots overshoot their station and circle it
  // forever. Puck-attacking roles (chase/pressure/carrier) stay full-tilt.
  const throttle = SETTLING_INTENTS.has(decision.intent)
    ? Math.min(1, Math.hypot(toTarget.x, toTarget.y) / ARRIVAL_RADIUS)
    : 1;
  const direction = normalizeOrZero(toTarget);
  const movement = { x: direction.x * throttle, y: direction.y * throttle };
  const shootFlick = decision.shoot && world.puck.carrierSlotId === bot.id;

  return {
    playerId: `bot:${bot.id}`,
    slotId: bot.id,
    sequence,
    moveX: movement.x,
    moveY: movement.y,
    stickX: 0,
    stickY: shootFlick ? 1 : 0,
    pass: decision.pass,
    check: decision.check,
    turbo: decision.turbo,
    switchTarget: decision.switchTarget
  };
}
