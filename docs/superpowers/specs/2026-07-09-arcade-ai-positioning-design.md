# Arcade AI Positioning And Decision-Making Design

## Status

Approved design direction for improving bot movement and hockey decision-making in the current 3v3 arcade game. This document defines behavior and architecture only; implementation is tracked in the companion plan.

## Goal

Make AI-controlled skaters feel like aggressive arcade hockey players who understand spacing, support, open ice, scoring opportunities, defensive threats, and transitions while remaining readable, fallible, and fun to outplay.

## Product Target

The AI target is a hybrid arcade style:

- Human-controlled players receive meaningful support, but bots can act independently when the play demands it.
- Each skater has role tendencies, not a permanently fixed position.
- Bots have bounded awareness: they understand the broad play, but reaction range, pressure, angle, and timing create believable mistakes.
- Defense uses situational pressure: one player may challenge the puck when support exists while teammates protect the slot and dangerous attackers.
- Bots may pass or shoot autonomously when the opportunity is clearly better than waiting for the human.
- Movement should be intentional and continuous, with arcade-speed recovery and dramatic attacking choices.

## Current Foundation

The current `packages/arcade-core/src/sim/ai/decision.ts` already provides deterministic per-team roles: `carrier`, `chase`, `attack-slot`, `hold-back`, `pressure`, `cover`, and `protect-net`. It also provides basic pass, shot, check, turbo, powerup, and special decisions. `bot.ts` converts the chosen target into the shared input protocol.

The enhancement should evolve this foundation rather than replace the deterministic simulation or create a second AI path. The server and Free Skate local simulation must continue to use the same shared-core AI behavior.

## Design Principles

### 1. Tactical context before individual decisions

Every bot decision should be based on a shared, deterministic tactical snapshot containing:

- puck position, velocity, possession, and likely next owner;
- team and opponent positions, velocities, and movement direction;
- attacking and defending goals and zones;
- slot danger, passing lanes, open ice, and pressure;
- team numbers advantage or disadvantage;
- human-controlled teammates and their current support needs;
- each skater's role tendency and current intent.

The snapshot is read-only for a decision tick. It must not mutate the world or depend on client-only state.

### 2. Tactical state plus utility scoring

Use a small set of high-level tactical states:

- `attack`: our team controls the puck or is established in the offensive half;
- `defend`: the opponent controls the puck and can attack;
- `transition`: possession just changed or the puck is moving between teams;
- `loose-puck`: neither team controls the puck;
- `reset`: the play is too uncertain or the skater must recover structure.

Within a state, bots score candidate intents and destinations. This prevents a large unconditional rule tree while keeping the overall behavior explainable.

Candidate intents include `carry`, `support`, `cut`, `screen`, `stretch`, `trail`, `pressure`, `cover`, `protect-slot`, `recover`, `challenge-loose-puck`, and `reset-shape`.

The scoring system must use deterministic tie-breakers based on skater id or slot id. Do not use nondeterministic randomness in shared simulation.

### 3. Role tendencies, not fixed lanes

Each skater receives a preferred tendency from its character or slot configuration. Initial tendencies can be represented as data and should remain compatible with the current character roster. Suggested tendencies are `attack`, `support`, `safety`, `net-drive`, `shooter`, and `checker`.

Tendencies influence scores and preferred destinations but never prevent emergency defense, loose-puck races, or recovery. The system must allow a safety to join an attack when the team has controlled possession and coverage, and require an attack-minded player to recover when the team loses the puck.

### 4. Spacing is relative to the play

Destinations should be generated from the puck, goals, teammates, and opponents rather than from fixed rink coordinates alone. The system should prefer:

- non-overlapping passing angles around the carrier;
- one aggressive scoring option, one support option, and one safety option during a normal attack;
- a player-width-plus-clearance separation from teammates;
- open lanes that are not directly occupied by an opponent;
- arrival timing that reaches a useful space as the carrier can pass or shoot.

Bots should ease into station targets, brake near destinations, and avoid orbiting or repeatedly crossing through teammates.

### 5. Defense protects dangerous space

Defensive priorities are:

1. Protect the slot and immediate scoring lanes.
2. Identify the most dangerous uncovered attacker.
3. Pressure the puck only when the pressure player can recover or has support.
4. Cover the next likely pass and backdoor threat.
5. Reset toward defensive shape after a failed challenge.

The nearest skater is not always the correct defender. Pressure distance, angle, teammate support, and opponent threat score must affect the assignment.

### 6. Bounded awareness and readable mistakes

The AI may have a full deterministic world snapshot, but decisions should be filtered by bounded awareness:

- reaction delay before changing intent;
- a pressure-dependent reaction range;
- reduced confidence in threats behind or far from the skater;
- imperfect pass and shot confidence;
- recovery time after a missed check, bad turn, or lost assignment.

The first implementation should model these as tunable deterministic thresholds and timers rather than a complex visibility or occlusion simulation.

## Offensive Behavior

When a teammate carries the puck, the two non-carriers should normally select distinct jobs:

- `support`: present a short, safe passing angle behind or beside the carrier;
- `cut` or `net-drive`: attack open space toward the slot, backdoor, or net front;
- `stretch` or `trail`: provide width, a cross-ice option, or a safe outlet.

The carrier should prefer a shot when the lane is clearly superior, pass when pressured and a teammate has a better expected opportunity, and continue carrying when neither option is strong.

Human-controlled carriers receive a support bias. Bots should move to make the human's next pass or shot easier, but the bias must not cause all teammates to follow or stand directly in front of the human.

Bots should autonomously pass or shoot when:

- the receiver has clear separation and a useful attack angle;
- the shot lane is materially better than available passes;
- a rebound or net-front play is more valuable than holding the puck;
- the carrier is under pressure and delaying would likely lose possession.

## Defensive Behavior

Against a controlled opponent:

- one skater may pressure the carrier from a recoverable angle;
- one skater protects the slot or most dangerous scoring lane;
- one skater covers the highest-threat off-puck attacker or backdoor lane.

Against an opponent with a clear numbers advantage, all defenders should bias toward the slot and passing lanes. Against a supported carrier with limited options, the pressure player can close more aggressively.

The defender should abandon a chase when the target exits the danger area, support is lost, the puck changes sides, or another opponent becomes the higher threat.

## Transition And Loose Puck Behavior

On a turnover:

- the closest viable skater attacks or supports the loose puck;
- one teammate immediately becomes the safety;
- one teammate stretches into a counterattack lane;
- defenders recover toward the slot before pursuing wide threats.

When the puck is loose, both teams may contest it within the existing deterministic contest margin. The losing team should begin defensive recovery instead of sending all three skaters toward the puck.

## Data And Tuning Boundaries

AI constants currently live partly in `decision.ts`. This feature should move behavior knobs into the shared `TUNING` structure so Feel Lab can tune them live. The new tuning group should cover:

- spacing radii and minimum teammate separation;
- candidate position weights;
- support and human-carrier bias;
- slot and passing-lane danger weights;
- pressure distance and recoverability thresholds;
- role tendency weights;
- reaction delay and awareness ranges;
- intent-switch hysteresis;
- pass and shot confidence thresholds;
- transition and reset timing.

All defaults must be deterministic and shared by server and local simulation. No client-only AI behavior is allowed.

## Debugging And Evaluation

The implementation must expose enough debug information to tune behavior:

- tactical state;
- role tendency;
- current intent;
- desired destination;
- defensive assignment;
- candidate scores or selected reason;
- time since intent change.

Debug output may be test-facing or dev-only and must not change authoritative simulation. A future client overlay can consume this data, but the first milestone may use structured decision snapshots and tests.

Repeatable evaluation scenarios:

- controlled breakout;
- supported rush;
- human carrier under pressure;
- offensive cycle;
- slot cut and backdoor threat;
- 2-on-1 attack;
- defensive-zone scramble;
- turnover and counterattack;
- contested loose puck;
- failed pressure and defensive recovery.

## Non-Goals

- No machine learning, external model calls, or nondeterministic planner.
- No full visibility raycast or expensive pathfinding system.
- No rewrite of skating physics or puck physics.
- No change to human controls or control switching rules.
- No replacement of the authoritative server model.
- No character special system expansion as part of the first AI pass.
- No single-player-only AI implementation.

## Acceptance Criteria

The feature is ready for implementation review when:

- the current role tests remain valid or are intentionally updated to the new tactical contract;
- bots choose distinct offensive support destinations instead of clustering;
- a human puck carrier receives support without all bots following them;
- defenders protect the slot when pressure is unsafe;
- defenders pressure when support and recovery are available;
- bots recover after turnovers and failed challenges;
- bot passes and shots occur from clear opportunities without firing constantly;
- all decisions remain deterministic across repeated simulations;
- AI tuning values are visible through `TUNING` and can be adjusted by Feel Lab;
- tests cover attack, defense, transition, loose puck, bounded awareness, and deterministic tie-breaking.
