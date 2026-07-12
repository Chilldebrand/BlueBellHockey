# WO-PG-01 - Postgame, HUD, And Pickup Presentation

| | |
|---|---|
| **Phase** | 2 (client presentation) |
| **Depends on** | WO-PG-00 |
| **Blocks** | - |
| **Status** | Approved, not implemented |

## Objective

Replace overlapping match-end panels with one centered first-to-five modal, show three stars and team totals, remove two unwanted HUD widgets, and make powerup pickups visually obvious.

## Scope

- Render one dimmed backdrop and responsive centered postgame modal.
- Show winner, `FIRST TO 5`, final score, three star cards with G/A/H, team totals, Rematch, and Back To Lobby.
- Remove `PowerupHud` and `TargetIndicator` from match HUD only.
- Scale pickup models to 1.55, increase bobbing, and add a pulsing emissive ice ring.
- Leave pickup radius, position, cadence, effects, controls, and banana hazards unchanged.

## Acceptance Criteria

- Only one ended-match surface is mounted and all actions remain reachable at laptop height.
- Three stars display authoritative character identity and G/A/H values.
- Score, turbo, and callouts remain; powerup and target chips are absent.
- Pickup visual scale/halo changes without any core gameplay change.
- Client tests, production build, and manual visual QA pass.

## Testing

`npm.cmd run test --workspace @bbh/arcade-client -- src/ui/Postgame.test.tsx src/App.test.tsx src/ui/HUD.test.tsx src/render/Powerups.test.tsx`

`npm.cmd run build:arcade`

Design: `docs/superpowers/specs/2026-07-10-postgame-pickup-presentation-design.md`  
Plan: `docs/superpowers/plans/2026-07-10-postgame-pickup-presentation.md`

