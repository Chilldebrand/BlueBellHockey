import { facingDirection } from "../actions.js";
import { normalizeOrZero } from "../physics.js";
import { PUCK_CONFIG } from "../puck.js";
import type { InputFrame, SkaterEntity, WorldState } from "../types.js";
import {
  ARRIVAL_RADIUS,
  DEFAULT_BOT_DIFFICULTY,
  selectBotDecision,
  type BotDifficulty,
  type BotIntent
} from "./decision.js";

/**
 * Bots attempt a poke when an opponent carries the puck this close while the
 * bot faces it. Pokes now require an ACTIVE, aligned lunge to connect (the
 * old passive proximity strip is gone), so without this trigger bot defense
 * would never dispossess anyone with the stick. The sim's own poke cooldown
 * gates the frequency — no randomness, replay-safe.
 */
const BOT_POKE_RANGE = 80;

/**
 * Shot flicks are edge-triggered: only a stick jump reads as a wrist flick,
 * and a flick that lands inside the 260ms post-release gesture cooldown is
 * swallowed. A bot that held stickY at 1 after that never flicked again and
 * ground on the goalie's crease holding the puck forever (playtest
 * 2026-07-23). Pumping the stick on the sim tick re-flicks every few ticks
 * until the shot actually fires.
 */
const SHOT_PUMP_PERIOD_TICKS = 4;

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

  const carrierId = world.puck.carrierSlotId;
  const opponentCarries =
    carrierId !== null &&
    carrierId !== bot.id &&
    world.skaters.some(
      (skater) => skater.id === carrierId && skater.teamId !== bot.teamId
    );
  const toPuck = normalizeOrZero({
    x: world.puck.position.x - bot.position.x,
    y: world.puck.position.y - bot.position.y
  });
  const facing = facingDirection(bot);
  const poke =
    opponentCarries &&
    Math.hypot(
      world.puck.position.x - bot.position.x,
      world.puck.position.y - bot.position.y
    ) <= BOT_POKE_RANGE &&
    facing.x * toPuck.x + facing.y * toPuck.y >=
      PUCK_CONFIG.pokeAlignmentMin;

  return {
    playerId: `bot:${bot.id}`,
    slotId: bot.id,
    sequence,
    moveX: movement.x,
    moveY: movement.y,
    stickX: 0,
    // Pump, don't hold: dip to neutral one tick per period so every period
    // produces a fresh flick edge (see SHOT_PUMP_PERIOD_TICKS).
    stickY:
      shootFlick && world.time.tick % SHOT_PUMP_PERIOD_TICKS !== 0 ? 1 : 0,
    pass: decision.pass,
    check: decision.check,
    poke,
    turbo: decision.turbo
  };
}
