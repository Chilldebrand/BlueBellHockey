import type { InputFrame, SkaterEntity, Vec2, WorldState } from "./types.js";
import { magnitude, normalizeOrZero } from "./physics.js";

export function inputAimOrFacing(
  input: InputFrame | undefined,
  skater: SkaterEntity
): Vec2 {
  const aim = normalizeOrZero({
    x: input?.aimX ?? 0,
    y: input?.aimY ?? 0
  });

  if (magnitude(aim) > 0) {
    return aim;
  }

  const velocityDirection = normalizeOrZero(skater.velocity);
  if (magnitude(velocityDirection) > 0) {
    return velocityDirection;
  }

  return {
    x: skater.teamId === "home" ? 1 : -1,
    y: 0
  };
}

export function passDirectionWithAssist(
  world: WorldState,
  carrier: SkaterEntity,
  input: InputFrame | undefined,
  assistCosine = 0.65
): Vec2 {
  const aim = inputAimOrFacing(input, carrier);
  let bestTeammate: SkaterEntity | null = null;
  let bestScore = assistCosine;

  for (const teammate of world.skaters) {
    if (teammate.id === carrier.id || teammate.teamId !== carrier.teamId) {
      continue;
    }

    const toTeammate = normalizeOrZero({
      x: teammate.position.x - carrier.position.x,
      y: teammate.position.y - carrier.position.y
    });
    const score = aim.x * toTeammate.x + aim.y * toTeammate.y;

    if (score > bestScore) {
      bestScore = score;
      bestTeammate = teammate;
    }
  }

  if (!bestTeammate) {
    return aim;
  }

  return normalizeOrZero({
    x: bestTeammate.position.x - carrier.position.x,
    y: bestTeammate.position.y - carrier.position.y
  });
}
