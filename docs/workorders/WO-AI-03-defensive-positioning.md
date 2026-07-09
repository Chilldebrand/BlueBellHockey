# WO-AI-03 - Defensive Positioning

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | WO-AI-01 |
| **Blocks** | WO-AI-04, WO-AI-05 |
| **Status** | Planned |

## Objective

Make defending bots protect dangerous space, cover threats, and pressure the
puck situationally instead of sending all three skaters into a chase.

## Files

- Modify `packages/arcade-core/src/sim/ai/tactics.ts` and tests.
- Modify `packages/arcade-core/src/sim/ai/positions.ts` and tests.
- Modify `packages/arcade-core/src/sim/ai/decision.ts` and tests.

## Tasks

1. Rank opponent threats by slot danger, separation, attack angle, and puck access rather than distance alone.
2. Assign pressure, slot protection, and off-puck coverage as distinct jobs.
3. Allow pressure only when angle, support, and recovery make it viable.
4. Add numbers-disadvantage behavior that collapses toward the slot.
5. Abandon stale chases when the puck changes side or another threat becomes more dangerous.
6. Add 2-on-1, defensive scramble, and failed-pressure recovery tests.

## Acceptance criteria

- The slot is protected before low-danger wide puck pressure.
- One defender can pressure while the others cover meaningful threats.
- Defenders recover after a missed challenge.
- Defensive assignments remain deterministic and readable.

## Testing

`npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/tactics.test.ts src/sim/ai/positions.test.ts src/sim/ai/decision.test.ts`

