# WO-GOALIE-01 - Control Grants And Free Skate

| | |
|---|---|
| **Phase** | 2 (ownership wrappers) |
| **Depends on** | WO-GOALIE-00 |
| **Blocks** | WO-GOALIE-02 |
| **Status** | Implemented 2026-07-13 (`982f5ed`, `d27367a`) |

## Objective

Assign covered-goalie input temporarily to the correct human without moving skater roster ownership, authorize it on the server, and reproduce the lifecycle in Free Skate.

## Scope

- Add `controlledGoalieId` to room roster/schema state.
- In co-op, grant the nearest same-team human skater; tie-break by slot ID.
- Accept goalie input only from the exact grantee and suppress goalie-time manual switches.
- Clear grants on release, disconnect, rematch, lobby, and disposal.
- Track controlled skater separately from active goalie in local simulation.

## Acceptance Criteria

- Exactly one eligible human receives a new cover grant.
- Spoofed goalie input cannot reach the simulation.
- Release returns to the same owned skater; reception switching remains available afterward.
- No-human/disconnect cases still receive the 2500 ms shared fallback.
- Server and Free Skate focused tests pass.

## Testing

`npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/roster.test.ts src/rooms/ArcadeRoom.test.ts`

`npm.cmd run test --workspace @bbh/arcade-client -- src/game/localSim.test.ts`

Design: `docs/superpowers/specs/2026-07-10-goalie-outlet-control-design.md`  
Plan: `docs/superpowers/plans/2026-07-10-goalie-outlet-control.md`

