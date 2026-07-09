# WO-AI-04 - Transitions And Loose Pucks

| | |
|---|---|
| **Phase** | 3 |
| **Depends on** | WO-AI-02, WO-AI-03 |
| **Blocks** | WO-AI-05 |
| **Status** | Planned |

## Objective

Give turnovers and loose pucks a clear arcade rhythm: one skater contests or
attacks, one supports the counterattack, and one preserves recovery shape.

## Files

- Modify `packages/arcade-core/src/sim/ai/tactics.ts` and tests.
- Modify `packages/arcade-core/src/sim/ai/positions.ts` and tests.
- Modify `packages/arcade-core/src/sim/ai/decision.ts` and tests.
- Review `packages/arcade-core/src/sim/world.ts` only if a deterministic possession-transition signal is needed; do not move AI rules into world code.

## Tasks

1. Detect recent possession changes and enter transition with bounded timing.
2. Assign a winnable loose-puck racer using the existing contest margin.
3. Give the other skaters counterattack and safety destinations.
4. Make the losing team recover toward the slot instead of sending everyone to the puck.
5. Add turnover, contested puck, and losing-race scenario tests.

## Acceptance criteria

- Turnovers produce immediate but organized counterattacks.
- Both teams can contest a genuinely winnable loose puck.
- Losing races trigger defensive recovery.
- No extra authoritative state or network schema is required.

## Testing

`npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/tactics.test.ts src/sim/ai/decision.test.ts`

