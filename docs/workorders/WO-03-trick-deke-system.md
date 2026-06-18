# WO-03 — Trick / Deke System

| | |
|---|---|
| **Phase** | 3 (core feel) |
| **Depends on** | WO-01 (dekes feed the meter) |
| **Blocks** | WO-04 (combos chain dekes), WO-06 (bots deke) |
| **Est. effort** | ~2–4 days |
| **Risk** | Med–High — new action across the full input→sim chain + prediction |
| **Status** | Not started |

## Objective
Add the moment-to-moment **dangle**: a dedicated deke/trick action that jukes the
puck laterally, beats defenders, and — when it beats them — "breaks ankles"
(staggers them). This is the mechanic that makes the game *feel* like NHL Street
rather than a sim.

## Background — the two facts that make this tractable
1. **Carrier puck is pinned dead-ahead.** In `puck.ts:54`, a carried puck sits at
   `STICK_REACH` along `c.facing`. A deke = briefly offset/rotate that anchor
   (between-the-legs, toe-drag, side-deke), then snap back. No new physics body
   needed.
2. **"Broken ankles" already has a state.** `status.staggeredUntil` (used by
   hits, `actions.ts:115`) + `isDisabled()` (`skater.ts:12`) already model a
   skater who's knocked out of the play. A deke that beats a defender just sets
   their `staggeredUntil` — the defender "bites."

## Scope
**In scope:** one new `deke` action, its input bindings, a `doDeke` handler, a
transient carry-offset so the deke reads visually, ankle-break stagger, whiff
risk, and a `deke`/`ankle_break` style award.
**Out of scope:** combo multiplier (WO-04), trick-specific animations beyond a
puck-offset + existing attack clips (WO-05 polishes visuals), gamepad
right-stick "trick stick" (optional stretch, noted below).

## Design

### Input plumbing (pattern #1 from README)
- `ActionFlags` += `deke` (`types.ts`), and `emptyActions()` += `deke: false`.
  Bots/goalies get `deke:false` for free via `emptyActions()`.
- `GamepadReading` += `deke`; map a button in `readGamepad` (e.g. **B**, or move
  steal to B and put deke on a face button — reconcile with current
  `steal: pressed(4)||pressed(1)`). (`gamepad.ts`)
- `gather()` actions object += `deke` with a keyboard bind, e.g. **`KeyL`** or
  **Space-tap** (Space is currently ult). Pick a free key; document it in
  `HUD.tsx` controls hint. (`inputState.ts`)
- Edge-trigger in `step()` like the other actions
  (`if (a.deke && !last.deke) doDeke(...)`, `world.ts` action loop ~line 254).

### `doDeke(world, s, input)` in `actions.ts`
1. Guard: must be carrier (`puck.carrier === s.id`), not disabled, and respect a
   **deke cooldown** (new `status.dekeCooldownUntil` or reuse a generic
   action-cooldown) so it can't be mashed every frame.
2. Determine deke direction from `input.aim` relative to `facing` (left/right
   juke) — lateral unit vector.
3. Set a transient carry offset the puck step reads: add
   `status.dekeOffset` + `status.dekeUntil` to `SkaterStatus`; in `puck.ts`
   carrier branch, if `dekeUntil > time`, bend the puck anchor by the offset
   (lerp out and back over ~150–250 ms) instead of pure `fromAngle(facing)`.
4. **Ankle-break check:** find the nearest opponent within a deke radius roughly
   in front/side of the juke direction. If they're close and not intangible,
   set `their.status.staggeredUntil = world.time + BREAK_MS` (scale with the
   deker's `steal` or a new "handles" notion — reuse `steal` to avoid an attr
   change). Emit `{ type:'ankle_break', by, target }`; `awardCharge(s,'ankle_break')`.
5. **Whiff / clean deke:** if no defender was beaten, still emit
   `{ type:'deke', by }` and `awardCharge(s,'deke')` (smaller). If a defender is
   *behind* you and in steal range during the deke window, leave the existing
   `doSteal` exposure as the risk (no extra penalty needed initially).

### Risk/reward
- Cooldown prevents spam.
- During the deke window the carrier's effective speed dips slightly (multiply
  `maxSpeedOf` while `dekeUntil > time`) so dekes trade speed for separation.
- A deke into a defender who is *not* beaten leaves the carrier puck more
  exposed (the offset puts the puck to the side, within steal range).

### New state (pattern #2 — only if visualized)
The deke offset matters for client prediction so it must be in shared sim state.
Minimum additions to `SkaterStatus`: `dekeUntil`, `dekeDirX`, `dekeDirZ`,
`dekeCooldownUntil`. If you want the client to *show* the juke, also sync them in
`SkaterSchema`/`syncState`/`SkaterSnap`. If the deke window is short and purely
server-authoritative, you may skip schema sync and let interpolation smooth the
puck — **but** then client prediction (`game/prediction.ts`) will mispredict the
puck during a deke; prefer syncing.

### Optional stretch — "trick stick"
Map dekes to right-stick flicks (gamepad) and mouse-flick (KB/M) for direction
selection, à la NHL skill stick. Defer unless input feel demands it.

## Files to touch
| File | Change |
|---|---|
| `packages/shared/src/sim/types.ts` | `ActionFlags.deke`; `SkaterStatus` deke fields; `SimEvent` += `deke`, `ankle_break` |
| `packages/shared/src/sim/actions.ts` | `doDeke()`; export + call |
| `packages/shared/src/sim/world.ts` | edge-trigger dispatch for `deke` |
| `packages/shared/src/sim/puck.ts` | bend carry anchor during deke window |
| `packages/shared/src/sim/skater.ts` | optional speed dip during deke |
| `packages/client/src/input/gamepad.ts` | `deke` button |
| `packages/client/src/input/inputState.ts` | `deke` key/button in `gather()` |
| `packages/server/src/rooms/state.ts` | (if visualized) sync deke fields |
| `packages/client/src/net/client.ts` | (if visualized) snap fields; register `deke`/`ankle_break` events |
| `packages/server/src/rooms/MatchRoom.ts` | broadcast `deke`/`ankle_break` |
| `packages/client/src/ui/HUD.tsx` | controls hint += deke key |
| `packages/client/src/render/Vfx.tsx` | (light) ankle-break spark; full polish in WO-05 |

## Acceptance criteria
- [ ] Pressing deke while carrying visibly jukes the puck to a side and recovers.
- [ ] Deking past a close defender staggers them (they stumble) and pops the style meter.
- [ ] Deke has a cooldown; mashing it does nothing extra.
- [ ] A whiffed deke gives separation but leaves the puck more steal-exposed.
- [ ] Client prediction does not visibly snap the puck on the local player's deke.
- [ ] Bots are unaffected (still `deke:false`) until WO-06.
- [ ] `npm test` + `npm run typecheck` clean.

## Testing (`sim/world.test.ts` + new cases)
- Carrier deke sets the carry offset for the window, then restores dead-ahead.
- Deke with an opponent in range/arc → opponent `staggeredUntil` set; `deke`
  event(s) emitted; style awarded.
- Deke on cooldown → no-op.
- Non-carrier deke → no-op.
- Determinism: same inputs → same outcome (no `Math.random` in `doDeke`).

## Notes / risks
- **Prediction is the trap.** The local client predicts puck position from the
  carrier's facing; a server-only deke offset will fight reconciliation. Keep the
  deke math in shared `puck.ts` so client prediction runs the same code, and sync
  the deke fields. Budget time here.
- Keep ankle-break range/arc conservative — too generous and defense evaporates.
- Reuse `staggeredUntil` so the existing stand-up/disable logic and any future
  knockdown animation "just work."
