import {
  normalizeOrZero,
  type InputFrame,
  type SkaterEntity,
  type WorldState
} from "@bbh/arcade-core";
import {
  DEFAULT_BOT_DIFFICULTY,
  selectBotDecision,
  type BotDifficulty
} from "./decision.js";

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
  const movement = normalizeOrZero({
    x: decision.moveTarget.x - bot.position.x,
    y: decision.moveTarget.y - bot.position.y
  });
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
