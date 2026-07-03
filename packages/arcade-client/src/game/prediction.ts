import {
  MATCH_CONFIG,
  stepWorld,
  type InputFrame,
  type PuckState,
  type SkaterEntity,
  type WorldState
} from "@bbh/arcade-core";

/** Cap on buffered unacknowledged frames (~2s of input at 16ms ticks). */
const MAX_BUFFERED_FRAMES = 128;

/** Reconciliation error under this snaps smoothly; beyond it, hard-snaps. */
const SMOOTH_SNAP_DISTANCE = 90;
const SMOOTH_BLEND = 0.45;

export interface PredictedLocalState {
  readonly skater: SkaterEntity;
  /** The predicted puck — only meaningful while the local skater carries it. */
  readonly puck: PuckState;
  readonly replayedFrames: number;
}

/**
 * Append a sent input frame to the unacknowledged buffer (in place), keeping
 * it ordered and bounded.
 */
export function pushInputFrame(buffer: InputFrame[], frame: InputFrame): void {
  buffer.push(frame);

  if (buffer.length > MAX_BUFFERED_FRAMES) {
    buffer.splice(0, buffer.length - MAX_BUFFERED_FRAMES);
  }
}

/** Drop frames the server has already applied (in place). */
export function pruneAcknowledgedFrames(
  buffer: InputFrame[],
  ackSequence: number | undefined
): void {
  if (ackSequence === undefined) {
    return;
  }

  let firstUnacked = 0;

  while (
    firstUnacked < buffer.length &&
    buffer[firstUnacked].sequence <= ackSequence
  ) {
    firstUnacked += 1;
  }

  if (firstUnacked > 0) {
    buffer.splice(0, firstUnacked);
  }
}

/**
 * Input-replay prediction: clone the authoritative snapshot and re-simulate
 * every buffered frame the server hasn't applied yet, one fixed tick each.
 * Because gesture, stick, and tether state all live in the world and step
 * through shared sim code, the local player's stickhandling, windups, and
 * releases predict for free — each snapshot restarts from server truth, so a
 * shot can never double-fire.
 */
export function predictLocalState(
  world: WorldState | null,
  slotId: string | null,
  unackedFrames: readonly InputFrame[],
  dtMs = MATCH_CONFIG.fixedTickMs
): PredictedLocalState | null {
  if (!world || !slotId) {
    return null;
  }

  const predicted = cloneWorld(world);

  for (const frame of unackedFrames) {
    stepWorld(predicted, [frame], dtMs);
  }

  const skater = predicted.skaters.find((candidate) => candidate.id === slotId);

  if (!skater) {
    return null;
  }

  return {
    skater,
    puck: predicted.puck,
    replayedFrames: unackedFrames.length
  };
}

/**
 * Soften reconciliation: small corrections blend toward the fresh prediction
 * so a poke-loose or collision fix doesn't teleport the local skater; big
 * corrections snap outright (the player is genuinely somewhere else).
 */
export function smoothPredictedSkater(
  previous: SkaterEntity | null,
  next: SkaterEntity
): SkaterEntity {
  if (!previous || previous.id !== next.id) {
    return next;
  }

  const errorDistance = Math.hypot(
    next.position.x - previous.position.x,
    next.position.y - previous.position.y
  );

  if (errorDistance === 0 || errorDistance > SMOOTH_SNAP_DISTANCE) {
    return next;
  }

  return {
    ...next,
    position: {
      x: previous.position.x + (next.position.x - previous.position.x) * SMOOTH_BLEND,
      y: previous.position.y + (next.position.y - previous.position.y) * SMOOTH_BLEND
    }
  };
}

function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}
