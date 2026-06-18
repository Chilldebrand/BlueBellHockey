import {
  attackingGoalX,
  defendingGoalX,
  getCharacter,
  isDisabled,
  RINK,
  emptyActions,
  neutralInput,
  v,
  type InputState,
  type SkaterState,
  type WorldState,
} from '@bbh/shared';

// Difficulty knobs (WO-06): scale how aggressively bots spend Gamebreakers and
// dekes, plus their reaction range. Bots are server-only, so Math.random is fine.
export interface BotDifficulty {
  ultChance: number; // per-tick chance to fire once the ult situation is right
  dekeChance: number; // per-tick chance to deke when pressured / building style
  reaction: number; // distance at which a bot reacts (steal/hit/deke)
}

export const DIFFICULTY: Record<string, BotDifficulty> = {
  rookie: { ultChance: 0.015, dekeChance: 0.02, reaction: 2.2 },
  pro: { ultChance: 0.05, dekeChance: 0.06, reaction: 2.6 },
  allstar: { ultChance: 0.12, dekeChance: 0.13, reaction: 3.0 },
};

export const BOT_DIFFICULTY: BotDifficulty = DIFFICULTY.pro;

// Role-aware field bot: only the closest teammate forechecks the puck; the rest
// support on offense or drop goal-side on defense, so a team doesn't swarm. On top
// of that it spends ultimates situationally (Gamebreakers) and dekes under pressure.
export function botInput(
  world: WorldState,
  s: SkaterState,
  diff: BotDifficulty = BOT_DIFFICULTY,
): InputState {
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
    // carry to the net; deke under pressure, else shoot/pass
    const toNet = v.sub(net, s.pos);
    input.move = v.norm(toNet);
    input.aim = v.norm(toNet);
    const dist = v.len(toNet);
    const pressure = nearestOpponent(world, s);
    const pressDist = pressure ? v.dist(pressure.pos, s.pos) : Infinity;
    const canDeke = s.status.dekeCooldownUntil <= world.time;
    // deke to protect the puck when checked-distance, or to build style when the
    // meter is low and a defender is closing (kept subtle so bots don't turtle).
    const wantsDeke =
      canDeke &&
      ((pressDist < diff.reaction + 0.4) || (s.ultCharge < 0.5 && pressDist < 4)) &&
      Math.random() < diff.dekeChance;

    if (wantsDeke && pressure) {
      actions.deke = true;
      // juke to the side away from the defender
      const fwd = v.norm(toNet);
      const left = { x: -fwd.z, z: fwd.x };
      const side = v.dot(v.sub(pressure.pos, s.pos), left) >= 0 ? -1 : 1;
      input.aim = v.scale(left, side);
    } else if (dist < 13) {
      actions.shoot = true;
    } else if (pressure && pressDist < diff.reaction && openMate(world, s)) {
      actions.pass = true;
    }
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
      if (d < diff.reaction) {
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

  // Spend the Gamebreaker when the situation is right (offense or defense). The
  // per-tick chance staggers bots so they don't all pop on the same frame.
  if (!actions.deke && decideUlt(world, s) && Math.random() < diff.ultChance) {
    actions.ult = true;
  }

  input.actions = actions;
  return input;
}

type UltArchetype = 'shooter' | 'speed' | 'disruption' | 'freight';

const ULT_ARCHETYPE: Record<string, UltArchetype> = {
  cannon: 'shooter',
  barrage: 'shooter',
  afterburner: 'speed',
  phase: 'speed',
  overdrive: 'speed',
  vision: 'speed',
  shockwave: 'disruption',
  deep_freeze: 'disruption',
  magnet: 'disruption',
  freight_train: 'freight',
};

/**
 * Pure situational policy for whether a bot *should* fire its ult right now (a
 * full meter aimed at a Gamebreaker, not a random pop). Deterministic so it can be
 * unit-tested; the stochastic "when exactly" gate lives in botInput.
 */
export function decideUlt(world: WorldState, s: SkaterState): boolean {
  if (s.isGoalie) return false;
  if (s.ultCharge < 1 || s.ultActiveUntil > world.time) return false;
  if (isDisabled(s, world.time)) return false;

  const arch = ULT_ARCHETYPE[getCharacter(s.characterId).ultimateId] ?? 'speed';
  const puck = world.puck;
  const carrying = puck.carrier === s.id;
  const net = { x: attackingGoalX(s.team), z: 0 };
  const defendX = defendingGoalX(s.team);

  switch (arch) {
    case 'shooter':
      // finish from range
      return carrying && v.dist(s.pos, net) < 14;
    case 'speed':
      // break away into open ice
      return carrying && laneClear(world, s, net, 12);
    case 'freight':
      // bulldoze a defender standing in the lane
      return carrying && !laneClear(world, s, net, 7);
    case 'disruption': {
      // strip / clear on defense: an opposing carrier near our net and in reach
      const carrier = puck.carrier ? world.skaters[puck.carrier] : null;
      if (!carrier || carrier.team === s.team) return false;
      const nearOurNet = Math.abs(carrier.pos.x - defendX) < 18;
      return nearOurNet && v.dist(s.pos, carrier.pos) < 8;
    }
    default:
      return false;
  }
}

/** True if no opponent stands in the lane from s toward `target` within `range`. */
function laneClear(
  world: WorldState,
  s: SkaterState,
  target: { x: number; z: number },
  range: number,
): boolean {
  const dir = v.norm(v.sub(target, s.pos));
  for (const o of Object.values(world.skaters)) {
    if (o.team === s.team || o.id === s.id) continue;
    const off = v.sub(o.pos, s.pos);
    const along = v.dot(off, dir);
    if (along <= 0 || along > range) continue; // behind us or beyond the window
    const lateral = Math.hypot(off.x - dir.x * along, off.z - dir.z * along);
    if (lateral < 2.5) return false;
  }
  return true;
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
