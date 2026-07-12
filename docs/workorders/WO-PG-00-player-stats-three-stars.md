# WO-PG-00 - Player Stats And Three Stars

| | |
|---|---|
| **Phase** | 1 (authoritative data) |
| **Depends on** | - |
| **Blocks** | WO-PG-01 |
| **Status** | Approved, not implemented |

## Objective

Add deterministic per-skater goals, primary assists, and hits to shared match stats, then rank three postgame stars from those authoritative lines.

## Scope

- Add `MatchStats.players` and initialize all skater slot lines.
- Credit scorers and hitters at existing authoritative increment points.
- Track one primary assist from a completed same-team pass until an opponent touch/possession or faceoff.
- Add pure `selectThreeStars(world)` using score `goals * 5 + assists * 3 + hits`, then goals, assists, hits, and slot ID tie-breaks.
- Do not add secondary assists, goalie points, persistence, or season stats.

## Acceptance Criteria

- Every match starts with six zeroed player lines.
- Goals, one valid primary assist, and hits are credited once to the correct skater.
- Opponent touches and faceoffs clear assist eligibility.
- Three-star selection is deterministic and returns three eligible skaters.
- Focused core/client tests pass.

## Testing

`npm.cmd run test --workspace @bbh/arcade-core -- src/sim/world.test.ts src/sim/goal.test.ts src/sim/puck.test.ts src/sim/hit.test.ts`

`npm.cmd run test --workspace @bbh/arcade-client -- src/ui/threeStars.test.ts`

Design: `docs/superpowers/specs/2026-07-10-postgame-pickup-presentation-design.md`  
Plan: `docs/superpowers/plans/2026-07-10-postgame-pickup-presentation.md`

