# WO-AI-01 - Role Tendencies And Spacing

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | WO-AI-00 |
| **Blocks** | WO-AI-02, WO-AI-03 |
| **Status** | Planned |

## Objective

Give each skater a preferred attacking or defensive tendency while keeping
roles fluid, then generate separated relative destinations instead of fixed
stations and puck swarming.

## Files

- Create `packages/arcade-core/src/sim/ai/tendencies.ts` and its test.
- Create `packages/arcade-core/src/sim/ai/positions.ts` and its test.
- Modify `packages/arcade-core/src/sim/ai/decision.ts` and tests.

## Tasks

1. Define attack, support, safety, net-drive, shooter, and checker tendencies.
2. Map existing character/slot data to tendencies with a neutral fallback.
3. Generate support, cut, stretch, trail, recover, and reset candidates from puck, goal, teammates, opponents, and rink geometry.
4. Score open ice, passing angle, teammate separation, role fit, and recovery.
5. Add deterministic tie-breakers and target hysteresis.
6. Preserve compatibility exports for the current positional roles.

## Acceptance criteria

- Normal offense has distinct support, scoring, and safety destinations.
- Bots avoid clustering and repeatedly crossing through teammates.
- Tendencies influence behavior without preventing emergency recovery.
- The same world state always produces the same role and target.

## Testing

`npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/tendencies.test.ts src/sim/ai/positions.test.ts src/sim/ai/decision.test.ts`

