# WO-GOALIE-00 - Covered Save Possession And Outlet

| | |
|---|---|
| **Phase** | 1 (shared simulation) |
| **Depends on** | - |
| **Blocks** | WO-GOALIE-01 |
| **Status** | Approved, not implemented |

## Objective

Replace cover faceoffs with explicit goalie possession and deterministic aimable charged outlet passes in the shared simulation.

## Scope

- Add skater-exclusive `carrierSlotId` plus goalie-exclusive `goalieCarrierId` invariant.
- Keep covered puck attached to the goalie without changing phase, score, clock, or skater positions.
- Route goalie-ID input to left-stick aim and pass hold/release only.
- Add deterministic safe outlet at exactly 2500 ms.
- Preserve existing hot rebounds and true faceoff resets.

## Acceptance Criteria

- Cover saves do not reset to center.
- Goalie possession blocks goals, pickups, and skater actions until release.
- Human input can aim, charge, and release; timeout target selection is deterministic.
- Rebound and determinism regressions pass.

## Testing

`npm.cmd run test --workspace @bbh/arcade-core -- src/sim/goalie.test.ts src/sim/goalieOutlet.test.ts src/sim/goal.test.ts src/sim/puck.test.ts src/sim/determinism.test.ts`

Design: `docs/superpowers/specs/2026-07-10-goalie-outlet-control-design.md`  
Plan: `docs/superpowers/plans/2026-07-10-goalie-outlet-control.md`

