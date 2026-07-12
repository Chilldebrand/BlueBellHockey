# WO-GOALIE-02 - Client Presentation And Verification

| | |
|---|---|
| **Phase** | 3 (client integration) |
| **Depends on** | WO-GOALIE-01 |
| **Blocks** | - |
| **Status** | Approved, not implemented |

## Objective

Make temporary goalie control readable and responsive online: route local input, suppress stale skater prediction, follow/highlight the goalie, render held puck position, and verify the complete lifecycle.

## Scope

- Map `controlledGoalieId` into client roster state and derive active controlled entity.
- Send input/acknowledgements under the active entity ID.
- Disable and flush skater prediction while goalie-controlled.
- Move identity highlight and camera to the goalie and render the covered puck at its hold point.
- Return presentation immediately to the owned skater after release.

## Acceptance Criteria

- Local and remote clients see the correct human identity on the controlled goalie.
- Camera and puck remain stable during the cover.
- No stale skater prediction is replayed during or after the temporary grant.
- Control returns automatically after pass or timeout.
- All tests, typecheck, build, two-client smoke, and manual two-client verification pass.

## Testing

`npm.cmd run test --workspace @bbh/arcade-client -- src/store.test.ts src/App.test.tsx src/render/CameraRig.test.ts`

`npm.cmd test`

`npm.cmd run typecheck`

`npm.cmd run build:arcade`

`npm.cmd run smoke --workspace @bbh/arcade-server`

Design: `docs/superpowers/specs/2026-07-10-goalie-outlet-control-design.md`  
Plan: `docs/superpowers/plans/2026-07-10-goalie-outlet-control.md`

