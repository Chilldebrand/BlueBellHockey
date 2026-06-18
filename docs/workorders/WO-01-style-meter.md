# WO-01 — Style Meter

| | |
|---|---|
| **Phase** | 1 (identity flip) |
| **Depends on** | WO-00 (soft) |
| **Blocks** | WO-02, WO-03 (feed the meter), WO-04 |
| **Est. effort** | ~0.5–1 day |
| **Risk** | Low–Med — reuses existing economy; touches charge tests |
| **Status** | Done |

## Objective
Reframe the ultimate-charge economy so the meter fills from **style** (flashy,
aggressive play) rather than passive time + plain outcomes. This is the single
change that flips the game's incentive structure from "play efficiently" to
"play with flair" — the core of the Street identity.

## Background
`packages/shared/src/config/charge.ts` already implements the whole economy:
- `ultCharge` ∈ [0,1] per skater (`SkaterState.ultCharge`).
- `tickCharge()` passive trickle: full in 7:30 with zero plays.
- `awardCharge(s, eventType)` adds a fraction per positive play.
- Current `awards`: `goal .20, assist .12, steal .10, block .10, hit .08,
  shot .05, pass .03`.

Today the meter leans on passive time and outcomes. We want it earned by style.
The machinery is identical — we retune the awards table, lower the passive
floor, and (in later WOs) feed it new style events (dekes, ankle-breakers,
board-plays, no-look passes).

## Scope
**In scope:** `charge.ts` awards + passive rate; rename to "style" in
client-facing UI; update `charge.test.ts`.
**Out of scope:** the Gamebreaker scoring payoff (WO-02), trick events that
don't exist yet (WO-03/04 will call `awardCharge` with new keys). Wiring the
*existing* meter to the UI is already done (`UltMeter.tsx` reads `ultCharge`).

## Design
1. **Lower the passive floor** so the bar is meaningfully *earned*. e.g. raise
   `fullChargeFloorMs` from 7:30 toward ~9–10:00, or gate passive fill to only
   when the skater's team is on offense. Keep a small trickle so a shut-out
   player still eventually gets one.
2. **Retune `awards`** to pay for *flair*, not efficiency. Proposed direction:
   | event | now | proposed | rationale |
   |---|---|---|---|
   | `goal` | .20 | .14 | still good, no longer dominant |
   | `assist` | .12 | .12 | keep |
   | `steal` | .10 | .12 | takeaways are hype |
   | `hit` | .08 | .10 | big checks are style |
   | `block` | .10 | .12 | sells defense |
   | `shot` | .05 | .03 | discourage meter-farming via shots |
   | `pass` | .03 | .02 | plain passes shouldn't farm |
   | **`deke`** *(WO-03)* | — | .06 | reward beating a defender |
   | **`ankle_break`** *(WO-03)* | — | .10 | the signature highlight |
   | **`bank_play`** *(WO-04)* | — | .06 | off-the-wall give-and-go |
   | **`nolook_pass`** *(WO-04)* | — | .05 | pass while facing away |
   The new keys are listed now so the table is the single source of truth; they
   stay dormant until their WO emits the event. `awardCharge` already no-ops on
   unknown keys, so adding them early is safe.
3. **Rename for players:** surface the bar as "STYLE" / "GAMEBREAKER" in
   `ui/UltMeter.tsx` and `ui/HUD.tsx`. Keep the serialized field name
   `ultCharge` (in `types.ts` + `state.ts` schema) to avoid a schema churn;
   optionally alias via a `styleMeter` getter in shared if clarity is wanted.

## Files to touch
| File | Change |
|---|---|
| `packages/shared/src/config/charge.ts` | retune `awards`, adjust passive rate; add dormant style keys |
| `packages/shared/src/config/charge.test.ts` | update cadence expectations |
| `packages/client/src/ui/UltMeter.tsx` | relabel to STYLE/GAMEBREAKER |
| `packages/client/src/ui/HUD.tsx` | (optional) "GAMEBREAKER READY" when full |

No schema or network change (the field already syncs as `ultCharge`).

## Acceptance criteria
- [x] A player who only skates and takes safe shots charges the meter slowly. (test: safe play not full in 2:00)
- [x] A player who hits, steals, and (later) dekes charges noticeably faster. (test: aggressive shift fills in ~2:00)
- [x] Meter still reaches full in a reasonable window with aggressive play (target ~1:30–2:30 of active play).
- [x] A totally passive player still eventually charges (no permanent zero). (passive floor 9:00, fills by ~end of regulation)
- [x] UI reads "STYLE"/"GAMEBREAKER", and shows a pulsing "GAMEBREAKER READY" state at full.
- [x] `charge.test.ts` updated and green; `npm run typecheck` clean.

## Chosen values (applied)
- `fullChargeFloorMs` 450000 (7:30) → **540000 (9:00)** passive floor.
- awards: `goal .20→.14, steal .10→.12, hit .08→.10, block .10→.12, shot .05→.03, pass .03→.02`; `assist .12` kept.
- dormant style keys added: `deke .06, ankle_break .10, bank_play .06, nolook_pass .05`.
- Passive gating "only on offense" was **not** taken (would require threading world
  possession into `tickCharge`); the raised floor achieves the same "earned" feel
  with less plumbing.

## Testing
- Update `charge.test.ts`: the "perfect cadence → ~2:00" and "zero play → floor"
  invariants must be re-expressed against the new numbers. Keep the *shape* of
  the tests (passive floor exists; active cadence is much faster) even as the
  exact ms change.
- Add a unit test asserting the new award keys exist and are > 0 (guards against
  WO-03/04 silently no-op-ing on a typo'd key).

## Notes / risks
- This WO changes balance; expect to co-tune with WO-02 (Gamebreaker payoff) and
  WO-03 (deke awards). Treat the numbers as a first pass.
- Because the bar drives ultimates, making it too cheap floods the game with
  supers; too expensive and nobody sees them. Aim for "a couple per team per
  period" before tricks exist, knowing tricks will speed it up.
