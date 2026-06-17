import {
  attackingGoalX,
  defendingGoalX,
  RINK,
  emptyActions,
  neutralInput,
  v,
  type InputState,
  type SkaterState,
  type WorldState,
} from '@bbh/shared';

// Role-aware field bot: only the closest teammate forechecks the puck; the rest
// support on offense or drop goal-side on defense, so a team doesn't swarm.
export function botInput(world: WorldState, s: SkaterState): InputState {
  const input = neutralInput();
  const actions = emptyActions();
  const puck = world.puck;
  const attackX = attackingGoalX(s.team);
  const defendX = defendingGoalX(s.team);
  const net = { x: attackX, z: 0 };

  const carrier = puck.carrier ? world.skaters[puck.carrier] : null;
  const weHavePuck = carrier && carrier.team === s.team;
  const theyHavePuck = carrier && carrier.team !== s.team;
  const isClosest = closestTeammateToPuck(world, s);

  if (puck.carrier === s.id) {
    // carry to the net; shoot when close, pass if pressured and a mate is open
    const toNet = v.sub(net, s.pos);
    input.move = v.norm(toNet);
    input.aim = v.norm(toNet);
    const dist = v.len(toNet);
    const pressure = nearestOpponent(world, s);
    if (dist < 13) actions.shoot = true;
    else if (pressure && v.dist(pressure.pos, s.pos) < 2.6 && openMate(world, s)) actions.pass = true;
  } else if (weHavePuck) {
    // support: get open ahead of the carrier, offset in Z to give a passing lane
    const lane = s.pos.z >= 0 ? RINK.faceoffZ : -RINK.faceoffZ;
    const support = { x: (carrier!.pos.x + attackX) / 2, z: lane };
    input.move = v.norm(v.sub(support, s.pos));
    input.aim = v.norm(v.sub(net, s.pos));
  } else if (theyHavePuck) {
    if (isClosest) {
      // forecheck the carrier
      input.move = v.norm(v.sub(carrier!.pos, s.pos));
      input.aim = input.move;
      const d = v.dist(carrier!.pos, s.pos);
      if (d < 2.3) {
        actions.steal = true;
        if (Math.random() < 0.35) actions.hit = true;
      }
    } else {
      // drop goal-side: position between the puck and our net
      const goalSide = { x: (puck.pos.x + defendX) / 2, z: puck.pos.z * 0.5 };
      input.move = v.norm(v.sub(goalSide, s.pos));
      input.aim = v.norm(v.sub(puck.pos, s.pos));
    }
  } else {
    // loose puck: closest chases, others hold a ready position
    if (isClosest) {
      input.move = v.norm(v.sub(puck.pos, s.pos));
    } else {
      const hold = { x: (puck.pos.x + defendX) / 2, z: s.pos.z };
      input.move = v.norm(v.sub(hold, s.pos));
    }
    input.aim = v.norm(v.sub(puck.pos, s.pos));
  }

  input.actions = actions;
  return input;
}

function closestTeammateToPuck(world: WorldState, s: SkaterState): boolean {
  let best: SkaterState | null = null;
  let bestD = Infinity;
  for (const o of Object.values(world.skaters)) {
    if (o.team !== s.team || o.isGoalie) continue;
    const d = v.dist(o.pos, world.puck.pos);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best?.id === s.id;
}

function nearestOpponent(world: WorldState, s: SkaterState): SkaterState | null {
  let best: SkaterState | null = null;
  let bestD = Infinity;
  for (const o of Object.values(world.skaters)) {
    if (o.team === s.team) continue;
    const d = v.dist(o.pos, s.pos);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

// a teammate is "open" if they're closer to the attacking net and not tightly marked
function openMate(world: WorldState, s: SkaterState): boolean {
  const attackX = attackingGoalX(s.team);
  for (const o of Object.values(world.skaters)) {
    if (o.team !== s.team || o.id === s.id || o.isGoalie) continue;
    const closerToNet = Math.abs(o.pos.x - attackX) < Math.abs(s.pos.x - attackX) - 2;
    const marked = !!nearestOpponentWithin(world, o, 2.2);
    if (closerToNet && !marked) return true;
  }
  return false;
}

function nearestOpponentWithin(world: WorldState, s: SkaterState, range: number): SkaterState | null {
  for (const o of Object.values(world.skaters)) {
    if (o.team === s.team) continue;
    if (v.dist(o.pos, s.pos) <= range) return o;
  }
  return null;
}
