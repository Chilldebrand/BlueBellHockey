# WO-AI-02 - Offensive Movement

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | WO-AI-01 |
| **Blocks** | WO-AI-04, WO-AI-05 |
| **Status** | Planned |

## Objective

Make bots create useful arcade offense around a carrier, including human
support, cuts, screens, net drives, stretch options, and safe outlets.

## Files

- Modify `packages/arcade-core/src/sim/ai/positions.ts` and tests.
- Modify `packages/arcade-core/src/sim/ai/decision.ts` and tests.
- Modify `packages/arcade-core/src/sim/ai/bot.ts` and tests.

## Tasks

1. Choose distinct support and scoring candidates when a teammate carries.
2. Bias support toward a human carrier without making every bot follow them.
3. Reward backdoor, high-slot, net-front, and cross-ice lanes when open.
4. Penalize occupied lanes, poor arrival timing, and teammate overlap.
5. Settle station movement with intent-aware throttle and braking.
6. Add breakout, supported-rush, and offensive-cycle scenario tests.

## Acceptance criteria

- Human carriers receive at least one useful passing option.
- Bots move into open ice rather than standing in a fixed high slot.
- Screens and cuts are readable but do not constantly cause collisions.
- A safe outlet remains available when the attack stalls.

## Testing

`npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/positions.test.ts src/sim/ai/decision.test.ts src/sim/ai/bot.test.ts`

