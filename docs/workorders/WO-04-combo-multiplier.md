# WO-04 — Combo Multiplier

| | |
|---|---|
| **Phase** | 4 (depth / addiction loop) |
| **Depends on** | WO-03 (combos chain dekes), WO-01 (multiplies meter gains) |
| **Blocks** | — |
| **Est. effort** | ~1–2 days |
| **Risk** | Med — new synced per-skater state + turnover bookkeeping |
| **Status** | Done |

## Objective
Reward *stringing* style moves together. Chaining tricks, dekes, no-look passes,
and off-the-wall plays without losing the puck builds a rising **combo
multiplier** on style-meter gains. Getting checked, frozen, or stripped **drops
the combo to zero**. This is the "don't lose your streak" tension that makes the
trick economy addictive.

## Background
- Style awards flow through `awardCharge(s, eventType)` (`charge.ts:36`). A
  multiplier is a natural wrapper around that call.
- Turnover signals already exist: a hit clears `puck.carrier` and sets
  `staggeredUntil` (`actions.ts`/`world.ts`); a steal reassigns `puck.carrier`
  (`actions.ts:139`); freeze/stagger via `isDisabled`.
- Off-the-wall is already physical: `containCircle` reflects the puck at
  `boardRestitution` (`physics.ts`, `puck.ts:69`). A board bounce that returns to
  a teammate/self is a recognizable "bank play" — it just isn't detected yet.

## Design

### Combo state (pattern #2 — synced)
Add to `SkaterState` (and schema, snap, store so the HUD can show it):
- `combo: number` — current chain count (0 = no combo).
- `comboUntil: number` — sim-time the combo expires if no new style move lands
  (rolling window, e.g. 3–4 s). Refreshed by each style event.
- Derived multiplier: `mult = 1 + min(combo, CAP) * STEP` (e.g. STEP 0.25, CAP 6
  → up to ~2.5×).

### Earning
Wrap meter awards so style events advance the combo:
- On a style event (`deke`, `ankle_break`, `steal`, `hit`, `bank_play`,
  `nolook_pass`, `assist`, `goal`): `combo += 1`, refresh `comboUntil`, and award
  `baseAward * mult` to the meter. Centralize this — e.g. an
  `awardStyle(world, s, eventType)` in shared that bumps combo then calls the
  existing `awardCharge`. Plain `shot`/`pass` should **not** advance combo (they
  can still give base charge).

### Losing
Reset `combo = 0` (and `comboUntil = 0`) when the carrier loses the puck
involuntarily:
- They get hit / `checkContact` strips them (`world.ts` `checkContact`,
  `actions.ts doHit`).
- They get stolen from (`doSteal` success).
- They get frozen / staggered (`isDisabled`).
- Optional: a *voluntary* clean pass keeps the combo (it's still your team's
  possession); only **turnovers** reset. Track via puck `lastTouch` team change
  in `puck.ts` auto-pickup: if the new grabber is an opponent, zero the previous
  carrier's combo.

### Bank-play & no-look detection (new style events)
- **`bank_play`**: in `puck.ts`, when `containCircle` reflects a *moving, loose*
  puck (detect a sign flip / the reflect branch) and it is later picked up by the
  same team as `lastTouch`, emit `{ type:'bank_play', by }` and award. Simplest:
  set a `puck.bankedBy`/`bankedAt` marker on reflect, consume it on pickup.
- **`nolook_pass`**: in `doPass`, if the completed pass target is roughly
  *behind* the passer's `facing` (dot(toTarget, facing) < 0), emit
  `{ type:'nolook_pass', from, to }` and award the bonus.

### HUD
Show the live combo + multiplier near the style meter (`ui/UltMeter.tsx` /
`ui/HUD.tsx`): e.g. "x3.2 🔥" that grows and flashes, and visibly *breaks* on
turnover.

## Files to touch
| File | Change |
|---|---|
| `packages/shared/src/sim/types.ts` | `SkaterState.combo`, `comboUntil`; `SimEvent` += `bank_play`, `nolook_pass`; `PuckState` bank marker |
| `packages/shared/src/config/charge.ts` | `awardStyle()` wrapper / multiplier math; combo constants |
| `packages/shared/src/sim/world.ts` | expire combo on `comboUntil`; reset on disable; route style events through `awardStyle` |
| `packages/shared/src/sim/actions.ts` | reset combo on hit/steal; no-look detection in `doPass` |
| `packages/shared/src/sim/puck.ts` | bank-play detect on reflect + pickup; reset combo on opponent takeaway |
| `packages/server/src/rooms/state.ts` | sync `combo` (+ `comboUntil` if UI needs countdown) |
| `packages/client/src/net/client.ts` | `SkaterSnap.combo`; publish to store; register new events |
| `packages/client/src/store.ts` | `myCombo` for HUD |
| `packages/client/src/ui/UltMeter.tsx` / `HUD.tsx` | combo/multiplier display + break animation |
| `packages/server/src/rooms/MatchRoom.ts` | broadcast `bank_play`, `nolook_pass` |

## Acceptance criteria
- [x] Chaining dekes/steals/hits raises a visible multiplier; meter fills faster as it climbs.
- [x] The multiplier expires if you stop doing style moves for the window. (`comboUntil`, 3.5s; tested)
- [x] Getting hit, frozen, or stripped resets the combo to zero immediately. (disabled-pass + explicit resets; tested)
- [x] A voluntary completed pass to a teammate does **not** reset the combo. (tested)
- [x] A puck banked off the boards back to your team awards `bank_play` once (not every frame). (marker consumed at pickup; tested)
- [x] A pass to a teammate behind you registers `nolook_pass`. (tested behind/ahead)
- [x] `npm test` + `npm run typecheck` clean.

## Decisions (applied)
- `COMBO`: `windowMs 3500`, `step 0.25`, `cap 6` → up to **2.5×**; raw count capped at 99 (uint8-safe).
- **Single award path:** every style event routes through `awardStyle(s, type, time)`
  (goal, assist, hit, steal, deke, ankle_break, bank_play, nolook_pass); only plain
  `shot`/`pass` keep `awardCharge` (base charge, no combo). Multiplier applied once.
- **Turnover resets:** a disabled-skater pass in `step()` zeroes combo for anyone
  checked/frozen/staggered; `doSteal`/`doHit`/ankle-break also reset their victim;
  `puck.ts` zeroes the previous carrier's combo on an opponent takeaway.
- **Bank-play:** `containCircle` now returns whether it reflected; a bounce marks
  `puck.bankedBy/bankedAt`, consumed once on a same-team pickup within 4s.
- Combos also reset at every faceoff (possession resets). HUD shows a live
  `2.50× · N COMBO 🔥` badge that pops and vanishes on a break.

## Testing (`sim/world.test.ts` + `charge.test.ts`)
- `awardStyle` with combo N multiplies the base award by the expected factor (capped).
- Combo advances on style events, not on plain shot/pass.
- Hit/steal/freeze on the carrier zeroes their combo.
- `comboUntil` expiry zeroes combo with no further events.
- Bank-play marker is set on reflect and consumed exactly once on same-team pickup.
- No-look: pass with target behind facing → event; pass ahead → no event.

## Notes / risks
- **Double-counting:** centralize all meter awards through `awardStyle` so the
  multiplier is applied exactly once; grep for direct `awardCharge` calls and
  route the style ones through the wrapper (keep plain charge for non-combo
  events if desired).
- **Bank-play spam:** a puck rattling in the corner could fire repeatedly — gate
  on a single marker consumed at pickup, and require the puck to be loose/moving.
- Keep multiplier CAP modest; with WO-02 a high multiplier + Gamebreaker can
  snowball a match.
