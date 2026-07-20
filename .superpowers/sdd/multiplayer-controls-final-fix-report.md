# Multiplayer Controls Final Fix Report

## Root cause (pre-change investigation)

- The client transforms every `stickY` sample for an away/default player in `App.tsx` after the keyboard tracker has converted Space into semantic accessibility-shot samples: release/tap forward (`+1`) and charged windup backward (`-1`). The blanket transform reverses those meanings only for away/default, while raw directional and analog stick input should remain team-transformed.
- `ArcadeRoom` applies a waiting-phase guard to name and readiness messages, but team selection only rejects `playing` and character selection has no phase guard. Both therefore mutate the roster after an ended match; character selection also mutates it during play.
- Loose-puck pickup already uses `PUCK_CONFIG.pickupRadius` (75) from blade position and first honors an active `pickupDisabledUntilMs` cooldown. The final-review gap is behavioral coverage at the requested 70-unit distance and under an active cooldown, not missing simulation logic.

## Files changed

- `packages/arcade-client/src/App.tsx`
- `packages/arcade-client/src/input/inputState.ts`
- `packages/arcade-client/src/input/keyboard.ts`
- `packages/arcade-client/src/input/stickControls.ts`
- `packages/arcade-client/src/input/stickControls.test.ts`
- `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`
- `packages/arcade-core/src/sim/puck.test.ts`

The client now marks only Space-generated samples as accessibility-shot
gestures. That marker bypasses the away/default vertical-stick inversion;
directional and analog input retains the prior team transform. Team and
character messages now return before roster mutation unless the world is
waiting. The pickup implementation was unchanged because both reviewed
behaviors already existed; focused simulation tests were added.

## Red/green proof

- Client RED: the new real keyboard-tracker → transform → input-frame tests
  failed for away/default tap (`[1, -1, 1]`) and charged gesture
  (`[-1, 1]` became `[1, -1]`). A further red run caught the final synthetic
  release frame being inverted; it is now covered and green.
- Server RED: the three new phase tests failed: ended team selection moved the
  human slot, and character selection changed the roster in both playing and
  ended phases.
- Pickup coverage was green at the starting implementation: a 70-unit
  blade-distance pickup succeeds, while an active `pickupDisabledUntilMs`
  blocks it. This was a coverage finding, not a production defect.
- Focused GREEN: client `stickControls.test.ts` 5/5; server
  `ArcadeRoom.test.ts` 53/53; core `puck.test.ts` 28/28.

## Tests run and results

- `npm.cmd test` — passed: 223 core, 84 server, 180 client tests.
- `npm.cmd run typecheck` — passed.

The review's minor shared-protocol suggestion was not implemented.
