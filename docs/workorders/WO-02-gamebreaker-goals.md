# WO-02 — Gamebreaker Goals

| | |
|---|---|
| **Phase** | 2 (signature payoff) |
| **Depends on** | WO-01 |
| **Blocks** | WO-06 (bots must spend Gamebreakers) |
| **Est. effort** | ~1 day |
| **Risk** | Med — touches scoring + score schema (uint8 underflow) |
| **Status** | Done |

## Objective
Make spending the meter *climactic*: a goal scored while your ultimate is active
is a **Gamebreaker** — worth 2, and/or it removes a point from the opponent
(NBA Street Vol. 2 rules). This gives the meter a reason to be *held and timed*,
not dumped on cooldown.

## Background
Scoring lives in `detectGoal()` (`packages/shared/src/sim/world.ts:158`). It
already resolves `scorer` and `assist` from `puck.lastTouch`/`assistTouch`. Each
skater has `ultActiveUntil` (`SkaterState`), set by `doUlt` (`actions.ts:146`)
to `world.time + ult.durationMs`. So "was the scorer's ult live?" is a one-line
check. Score is `world.score: [number, number]`, synced as `score0/score1`
(`@type('uint8')` in `state.ts`).

## Design
In `detectGoal`, after resolving `scorer`:
1. `const gb = scorer && world.skaters[scorer].ultActiveUntil > world.time`.
2. If `gb`:
   - Award **2** instead of 1 to the scoring team, **or** award 1 and subtract 1
     from the opponent (floored at 0). Pick one rule and make it a named constant
     (`GAMEBREAKER_GOAL_VALUE`, `GAMEBREAKER_STEALS_POINT`). Recommend +2 *and*
     opponent −1 capped at 0 as the most "Street," but ship the simpler +2 first
     if balance is shaky.
   - Emit a distinct event: `{ type: 'gamebreaker', team, scorer, value }` in
     addition to (or instead of) the normal `goal` event.
3. Some ults aren't shots (e.g. instant `shockwave`, `magnet`, `deep_freeze`).
   Decide the rule: simplest is "ult active at moment of goal" regardless of
   which ult. Cannon (`guaranteedGoal`) is the canonical Gamebreaker finish.
   Consider that instant-duration ults (`durationMs: 0`) set
   `ultActiveUntil = world.time` — they will **not** be "active" next frame, so
   they can't produce Gamebreaker goals. That's acceptable (those are utility
   ults), but document it.

### uint8 underflow — must handle
`score0/score1` are `uint8`. If "steal a point" drops a team below 0 it must
clamp at 0 *before* assignment. Keep `world.score` clamped in the sim
(`Math.max(0, ...)`) so authority and schema never disagree.

## Reframe ultimates (light)
No mechanical rewrite required, but update blurbs/naming so the 10 ults read as
"Gamebreakers / setups for the big goal" (`config/ultimates.ts`,
`config/characters.ts` blurbs, character-select copy). Cannon = the guaranteed
finish; Afterburner = the breakaway; Shockwave = clear the crease first.

## Files to touch
| File | Change |
|---|---|
| `packages/shared/src/sim/world.ts` | `detectGoal`: Gamebreaker check, scoring rule, clamp, emit |
| `packages/shared/src/sim/types.ts` | add `gamebreaker` to `SimEvent` union |
| `packages/shared/src/config/ultimates.ts` | (copy) reframe names if desired |
| `packages/server/src/rooms/MatchRoom.ts` | add `gamebreaker` to broadcast filter (`tick`, line ~159) |
| `packages/client/src/net/client.ts` | `room.onMessage('gamebreaker', ...)`, extend `GameEvent` type |
| `packages/client/src/ui/HUD.tsx` | "GAMEBREAKER!" banner + "+2" on the GoalBanner |

## Acceptance criteria
- [x] A goal scored while the scorer's ult is active scores per the chosen rule (**+2 AND opponent −1**, clamped).
- [x] A normal goal still scores exactly 1 and does not alter the opponent.
- [x] Opponent score never goes below 0 (verified by test — `Math.max(0, ...)` in the sim).
- [x] A distinct on-screen callout fires for a Gamebreaker ("GAMEBREAKER!!!" + "+2", gold).
- [x] Instant-duration ults behave per the documented rule (`durationMs:0` sets `ultActiveUntil=time`, not active next frame).
- [x] `npm test` + `npm run typecheck` clean.

## Chosen rule (applied)
- `GAMEBREAKER_GOAL_VALUE = 2`, `GAMEBREAKER_STEALS_POINT = true` (exported from
  `sim/world.ts` — flip either to dial back swinginess). A Gamebreaker is a
  3-point swing; if that feels too decisive set `STEALS_POINT = false` for flat +2.
- Gamebreaker celebration pause is 2600ms vs 1800ms for a normal goal.
- Ultimate copy reframe left for WO-05 (polish); not required by acceptance here.

## Testing (`sim/world.test.ts`)
- Goal with `scorer.ultActiveUntil > time` → team gains the Gamebreaker value;
  opponent decremented/clamped per rule.
- Goal with no active ult → +1, opponent unchanged.
- Opponent at 0 + steal-a-point goal → opponent stays 0.
- Sudden-death OT: a Gamebreaker still ends OT correctly (the OT-end check in
  `step()` compares score deltas — make sure a +2 swing is detected).

## Notes / risks
- **OT interaction:** `step()` ends overtime if either score changed
  (`world.ts:273`). A +2 or a steal-a-point both change scores, so OT still ends
  — but add a test so a future refactor doesn't break it.
- Balance: "steal a point" is swingy in a low-scoring game; if matches feel
  decided by one Gamebreaker, fall back to flat +2.
- Keep the score mutation in the sim only; never edit `state.score0` directly in
  the room.
