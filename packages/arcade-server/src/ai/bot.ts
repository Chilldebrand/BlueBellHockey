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
  const aim = normalizeOrZero({
    x: decision.aimTarget.x - bot.position.x,
    y: decision.aimTarget.y - bot.position.y
  });

  return {
    playerId: `bot:${bot.id}`,
    slotId: bot.id,
    sequence,
    moveX: movement.x,
    moveY: movement.y,
    aimX: aim.x,
    aimY: aim.y,
    pass: decision.pass,
    shoot: decision.shoot,
    check: decision.check,
    turbo: decision.turbo,
    switchTarget: decision.switchTarget,
    usePowerup: decision.usePowerup,
    special: decision.special
  };
}
