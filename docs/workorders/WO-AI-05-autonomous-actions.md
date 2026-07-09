# WO-AI-05 - Autonomous Passing And Shooting

| | |
|---|---|
| **Phase** | 4 |
| **Depends on** | WO-AI-02, WO-AI-03 |
| **Blocks** | WO-AI-06 |
| **Status** | Planned |

## Objective

Let bots pass, shoot, carry, and check when the opportunity is clearly better
than waiting, while retaining the hybrid human-support bias.

## Files

- Modify `packages/arcade-core/src/sim/ai/decision.ts` and tests.
- Modify `packages/arcade-core/src/sim/ai/bot.ts` and tests.
- Preserve existing powerup and dormant-special decisions.

## Tasks

1. Compare shot lane, best pass, carry value, and pressure before choosing an action.
2. Pass when a teammate has clear separation and a materially better angle.
3. Shoot when the lane is clearly superior or a rebound/net-front play is best.
4. Keep action confidence deterministic and bounded by `TUNING.ai`.
5. Add reaction delay and pressure-based imperfect decisions without random shared-sim behavior.
6. Add autonomous-action and human-support regression tests.

## Acceptance criteria

- Bots do not shoot or pass constantly.
- Clear opportunities are taken without requiring a human to trigger them.
- Human-support behavior remains the default when options are comparable.
- Existing powerup behavior and input-frame contracts remain intact.

## Testing

`npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/decision.test.ts src/sim/ai/bot.test.ts`

