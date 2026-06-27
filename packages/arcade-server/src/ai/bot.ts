import type { InputFrame, SkaterEntity, WorldState } from "@bbh/arcade-core";

export function createBotInputFrame(
  bot: SkaterEntity,
  world: WorldState,
  sequence: number
): InputFrame {
  const moveX = Math.sign(world.puck.position.x - bot.position.x);
  const moveY = Math.sign(world.puck.position.y - bot.position.y);

  return {
    playerId: `bot:${bot.id}`,
    slotId: bot.id,
    sequence,
    moveX,
    moveY,
    aimX: moveX,
    aimY: moveY,
    pass: false,
    shoot: false,
    check: false,
    turbo: false,
    switchTarget: false,
    usePowerup: false,
    special: false
  };
}
