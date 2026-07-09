# WO-AI-00 - Tactical Context And Observability

| | |
|---|---|
| **Phase** | 0 (foundation) |
| **Depends on** | - |
| **Blocks** | WO-AI-01 through WO-AI-06 |
| **Status** | Planned |

## Objective

Create the deterministic read-only tactical context that all bots use, define
the high-level tactical states, and expose enough decision metadata to tune
behavior without guessing.

## Files

- Create `packages/arcade-core/src/sim/ai/tactics.ts` and its test.
- Modify `packages/arcade-core/src/sim/ai/decision.ts` only to consume the context.
- Modify `packages/arcade-core/src/config/tuning.ts` and its test for AI values.

## Tasks

1. Add `Tuning.ai` for awareness range, reaction delay, state thresholds, and intent-switch hysteresis.
2. Add tactical states: attack, defend, transition, loose-puck, and reset.
3. Implement `buildTacticalContext(world, teamId)` with deterministic sorting, pressure values, threat identity, open-lane scores, and team numbers.
4. Add decision metadata for state, intent, score, reason, and intent-change time.
5. Test attack, defense, transition, loose puck, reset, determinism, and no world mutation.

## Acceptance criteria

- Every bot derives the same tactical context from the same world and tick.
- State selection has explicit precedence and no wall-clock dependency.
- Debug metadata explains the selected state and later target choice.
- Existing server and Free Skate simulations still use shared-core behavior.

## Testing

`npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/tactics.test.ts src/config/tuning.test.ts`

