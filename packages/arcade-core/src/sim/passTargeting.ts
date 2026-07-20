import { RINK_CONFIG } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import {
  clamp,
  clampMagnitude,
  dot,
  normalizeOrZero
} from "./physics.js";
import type { SkaterEntity, Vec2, WorldState } from "./types.js";

export const PASS_AIM_ASSIST_COSINE = 0.42;
export const PASS_LEAD_MAX_SECONDS = 0.3;
export const PASS_LEAD_MAX_DISTANCE = 220;
const PASS_TARGET_RINK_MARGIN = 60;

export interface PassSource {
  readonly id: string;
  readonly teamId: TeamId;
  readonly position: Vec2;
}

export function passTargetWithAssist(
  world: WorldState,
  source: PassSource,
  aim: Vec2,
  speed: number,
  assistCosine = PASS_AIM_ASSIST_COSINE
): Vec2 | null {
  const recipient = findAimedPassRecipient(world, source, aim, assistCosine);
  return recipient ? predictPassTarget(source.position, recipient, speed) : null;
}

export function findAimedPassRecipient(
  world: WorldState,
  source: PassSource,
  aim: Vec2,
  assistCosine = PASS_AIM_ASSIST_COSINE
): SkaterEntity | null {
  let bestRecipient: SkaterEntity | null = null;
  let bestScore = assistCosine;

  for (const teammate of world.skaters) {
    if (teammate.id === source.id || teammate.teamId !== source.teamId) {
      continue;
    }

    const toTeammate = normalizeOrZero({
      x: teammate.position.x - source.position.x,
      y: teammate.position.y - source.position.y
    });
    const score = dot(aim, toTeammate);

    if (score > bestScore) {
      bestScore = score;
      bestRecipient = teammate;
    }
  }

  return bestRecipient;
}

export function predictPassTarget(
  sourcePosition: Vec2,
  recipient: Pick<SkaterEntity, "position" | "velocity">,
  speed: number
): Vec2 {
  const distance = Math.hypot(
    recipient.position.x - sourcePosition.x,
    recipient.position.y - sourcePosition.y
  );
  const travelSeconds = Math.min(
    PASS_LEAD_MAX_SECONDS,
    distance / Math.max(speed, 1)
  );
  const lead = clampMagnitude(
    {
      x: recipient.velocity.x * travelSeconds,
      y: recipient.velocity.y * travelSeconds
    },
    PASS_LEAD_MAX_DISTANCE
  );

  return {
    x: clamp(
      recipient.position.x + lead.x,
      PASS_TARGET_RINK_MARGIN,
      RINK_CONFIG.width - PASS_TARGET_RINK_MARGIN
    ),
    y: clamp(
      recipient.position.y + lead.y,
      PASS_TARGET_RINK_MARGIN,
      RINK_CONFIG.height - PASS_TARGET_RINK_MARGIN
    )
  };
}
