import {
  RINK,
  defendingGoalX,
  emptyActions,
  neutralInput,
  v,
  type InputState,
  type SkaterState,
  type WorldState,
} from '@bbh/shared';

const CREASE_DEPTH = 1.1;
const CHALLENGE_DEPTH = 1.1;
const CREASE_Z = RINK.goalWidth / 2 + 0.75;
const SETTLE_RADIUS = 0.18;
const EASE_RADIUS = 3.0;
const GOALIE_AUTO_PASS_MS = 5000;
const TARGET_HOLD_MS = 180;
const TARGET_REPATH_DISTANCE = 0.35;
const AIM_DEADBAND = 0.08;

// Goalie bot: hover in the crease, track the puck without chasing every tiny
// twitch, and pass out after covering the puck for a few seconds.
export function goalieInput(world: WorldState, s: SkaterState): InputState {
  const input = neutralInput();
  const actions = emptyActions();
  const goalX = defendingGoalX(s.team);
  const puck = world.puck;
  const inward = s.team === 0 ? 1 : -1;

  const holding = puck.carrier === s.id;
  if (!holding) {
    s.status.goaliePossessionStart = -1;
  } else if (s.status.goaliePossessionStart == null || s.status.goaliePossessionStart < 0) {
    s.status.goaliePossessionStart = world.time;
  }

  const creaseLineX = goalX + inward * CREASE_DEPTH;
  const puckDistFromGoalLine = Math.max(0.75, Math.abs(puck.pos.x - goalX));
  const puckNearNet = Math.max(0, 1 - puckDistFromGoalLine / 4);
  const challenge = holding ? 0 : puckNearNet * CHALLENGE_DEPTH;
  const angleZ = puck.pos.z * ((CREASE_DEPTH + challenge) / puckDistFromGoalLine);
  const desired = {
    x: creaseLineX + inward * challenge,
    z: Math.max(-CREASE_Z, Math.min(CREASE_Z, angleZ)),
  };
  const hasTarget = s.status.goalieTargetUntil > world.time;
  const targetDrift = hasTarget ? v.dist(desired, { x: s.status.goalieTargetX, z: s.status.goalieTargetZ }) : Infinity;
  if (!hasTarget || targetDrift > TARGET_REPATH_DISTANCE) {
    s.status.goalieTargetX = desired.x;
    s.status.goalieTargetZ = desired.z;
    s.status.goalieTargetUntil = world.time + TARGET_HOLD_MS;
  }
  const target = { x: s.status.goalieTargetX, z: s.status.goalieTargetZ };
  const toTarget = v.sub(target, s.pos);
  const distToTarget = v.len(toTarget);
  input.move =
    distToTarget < SETTLE_RADIUS
      ? { x: 0, z: 0 }
      : v.scale(v.norm(toTarget), Math.min(1, distToTarget / EASE_RADIUS));
  const aimTarget = holding ? { x: s.pos.x + inward, z: s.pos.z } : target;
  const aim = v.sub(aimTarget, s.pos);
  input.aim = v.len(aim) < AIM_DEADBAND ? { x: inward, z: 0 } : v.norm(aim);

  if (
    holding &&
    s.status.goaliePossessionStart >= 0 &&
    world.time - s.status.goaliePossessionStart >= GOALIE_AUTO_PASS_MS
  ) {
    actions.pass = true;
  }
  input.actions = actions;
  return input;
}
