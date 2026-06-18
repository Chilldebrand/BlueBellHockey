# WO-00 — Arcade Feel Pass

| | |
|---|---|
| **Phase** | 0 (foundation) |
| **Depends on** | — |
| **Blocks** | none hard; sets the baseline all later WOs tune against |
| **Est. effort** | ~0.5 day |
| **Risk** | Low — constants only, fully reversible |
| **Status** | Done |

## Objective
Make the *existing* game move and hit like an arcade title before any new
systems are added. No new state, no new mechanics — only tuning constants and
the feel they produce. This establishes the baseline "game feel" that Style
Meter, tricks, and combos are balanced against.

## Background
The sim today is tuned like a measured simulation: moderate speed, high puck
friction, modest checks, 3:00 periods. "Street" games feel fast, loose, and
punchy. All the relevant numbers are already isolated as named constants.

## Scope
**In scope:** movement, puck slide, check knockback, optional period length.
**Out of scope:** any new field, event, action, or rule. Goal/score logic
untouched. (If a change needs new state, it belongs in a later WO.)

## Files & current values
| File | Constant | Old | **Chosen (applied)** |
|---|---|---|---|
| `packages/shared/src/sim/skater.ts` | `BASE_SPEED` | `6` | **`7`** (now exported for client prediction) |
| | `SPEED_PER_POINT` | `0.8` | **`0.9`** (now exported) |
| | `ACCEL` | `24` | **`30`** (snappier starts) |
| | `FRICTION` | `9` | **`7`** (longer glide) |
| | carrying penalty | `*= 0.9` | **`*= 0.92`** (less drag while carrying) |
| `packages/shared/src/sim/puck.ts` | `PUCK_FRICTION` | `0.7` | **`0.82`** (puck slides farther) |
| | `PICKUP_RANGE` | `SKATER_RADIUS + 0.55` | **`+0.7`** (more forgiving pickups) |
| `packages/shared/src/sim/actions.ts` | hit knock (`doHit`) | `4 + hit*0.6` | **`6 + hit*0.9`** |
| | shot power (`doShoot`) | `16 + shoot*1.6` | **`18 + shoot*1.8`** |
| `packages/shared/src/sim/world.ts` | check knock (`checkContact`) | `8` | **`11`** |
| `packages/shared/src/config/rink.ts` | `boardRestitution` | `0.55` | **`0.6`** (livelier boards) |
| `packages/shared/src/config/charge.ts` | `PERIOD_MS` | `180000` | **`180000`** (left as-is; 120000 hot-seat deferred to feel) |

> `BASE_SPEED`/`SPEED_PER_POINT` are now exported from `skater.ts` and imported by
> `packages/client/src/game/prediction.ts` so client prediction tracks the new top
> speed instead of mispredicting at the old `6 / 0.8`.

> Values are starting points, not gospel. The deliverable is a *feel*, reached
> by playtesting and iterating these numbers — not hitting these exact figures.

## Tasks
1. Apply the movement constants in `skater.ts`; playtest acceleration/top-speed/stop feel.
2. Loosen the puck (`PUCK_FRICTION`, `PICKUP_RANGE`); confirm loose pucks slide
   and rebound off boards in a fun way (board bounce already works via
   `containCircle`).
3. Raise knockback in `doHit` and `checkContact`; confirm hits read as big
   without launching skaters off the rink.
4. (Optional) shorten periods for couch play.
5. Sweep for any test that asserts on these magnitudes and update expectations.

## Acceptance criteria
- [x] A skater crosses the rink noticeably faster than before; starts/stops feel responsive, not floaty or twitchy.
- [x] A clean check sends the target sliding a meaningful distance and reads as impactful.
- [x] Loose pucks travel and bank off boards rather than dying quickly.
- [x] No skater/puck can escape the rink boundary (boundary still enforced by `containCircle`).
- [x] `npm test` green (added a deterministic hit-knockback guard test pinning the new magnitude).
- [x] `npm run typecheck` clean.

## Testing
- Manual: open two tabs, skate/shoot/check, eyeball feel.
- Automated: `sim/world.test.ts` should still pass; if a test pins exact
  post-hit velocity it will need its expected value bumped — do so deliberately,
  not by loosening the assertion.

## Notes / risks
- Knockback that is too high can make checks feel random and break the steal
  game; tune `doHit`/`checkContact` together.
- Keep determinism — these are all plain constants, safe.
- Record the final chosen values in this file's table (replace "suggested") so
  later WOs reference the real baseline.
