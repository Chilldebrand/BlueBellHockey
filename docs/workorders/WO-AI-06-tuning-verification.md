# WO-AI-06 - Tuning And Verification

| | |
|---|---|
| **Phase** | 5 (integration) |
| **Depends on** | WO-AI-00 through WO-AI-05 |
| **Blocks** | - |
| **Status** | Planned |

## Objective

Tune the complete AI system for fast, readable arcade hockey and verify that
server play, Free Skate, determinism, and Feel Lab all agree.

## Files

- Modify `packages/arcade-core/src/config/tuning.ts` and tests.
- Modify AI tests with repeatable breakout, rush, defense, transition, and loose-puck scenarios.
- Review `packages/arcade-server/src/rooms/ArcadeRoom.test.ts` and `packages/arcade-client/src/game/localSim.test.ts`.
- Update `HANDOFF.md` with final defaults and playtest notes.

## Tasks

1. Tune spacing, awareness, role, pressure, transition, and action values in Feel Lab using the scenario tests as guardrails.
2. Run the full arcade-core suite, typecheck, and server smoke test.
3. Start `npm.cmd run dev` and manually inspect attack support, defensive slot protection, turnovers, failed pressure, and loose-puck races.
4. Confirm Free Skate and authoritative server play use the same decisions.
5. Record final values, known feel gaps, and manual verification status in the handoff.

## Acceptance criteria

- Full tests, typecheck, and server smoke pass.
- Feel Lab can change AI values without code edits.
- Free Skate and online bot behavior agree on the same shared-core rules.
- Bots feel aggressive and arcade-like without clustering or clairvoyance.
- Remaining visual issues are documented for user eyeballing.

## Testing

`npm.cmd run test`

`npm.cmd run typecheck`

`npm.cmd run smoke --workspace @bbh/arcade-server`

