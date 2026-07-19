# Predictive Passing

## Goal

Make passes feel faster and more effective by leading a selected teammate along their skating path while increasing quick and charged pass speed by 40 percent.

## Player Experience

- A player points the left stick toward a teammate and releases pass.
- The game selects the best same-team skater inside the existing aim cone.
- The puck targets that skater's predicted skating path instead of only their current position.
- A player who is stationary receives the puck near their current position.
- If no teammate is in the aim cone, the puck continues along the player's manual aim.
- Defenders may still intercept passes; prediction improves timing and accuracy but does not make passes unavoidable.

## Prediction Design

- Extract a deterministic, pure targeting helper shared by skater passing and goalie outlets.
- Choose a recipient by the current aim cone before calculating any lead, preserving intuitive stick-based selection.
- Estimate flight time from release point to recipient using the actual release speed, then project the recipient using their current velocity.
- Cap lead time and lead distance, and clamp the final target inside rink bounds, so passes do not overshoot a receiver or target beyond the boards.
- Keep the existing manual pass direction when no recipient qualifies.

## Speed and Reception Tuning

- Set base `passSpeed` to `1512` from `1080` (+40%).
- Set `passChargeSpeedBonus` to `638` from `456` (+40%, rounded down).
- A fully charged pass therefore reaches approximately `2150` speed.
- Raise `passCatchMaxRelativeSpeed` from `1750` to `2400` so the new fast passes remain catchable.
- Keep pass charge time, pass catch radius, one-timer timing, and the control scheme unchanged.

## Goalie Outlets

- Apply the same aim-cone selection and prediction to a goalie outlet when an eligible teammate is aimed at.
- If no teammate is aimed at, preserve the existing safe outlet fallback target.
- Keep goalie hold, charging, release, and automatic-timeout behavior unchanged.

## Verification

- Unit-test recipient selection, movement lead, stationary targets, capped lead, and manual directional fallback.
- Test the released skater puck speed for quick and fully charged passes.
- Test that a pass at the new maximum speed is still accepted by the reception rules.
- Test predictive goalie outlets and the unchanged safe fallback.
- Run the complete test suite, typecheck, and production client build.
