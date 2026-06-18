# WO-06 — AI Catch-Up

| | |
|---|---|
| **Phase** | 6 (make solo play show the systems) |
| **Depends on** | WO-02 (Gamebreakers), WO-03 (dekes); benefits from WO-04 |
| **Blocks** | — |
| **Est. effort** | ~1–2 days |
| **Risk** | Low–Med — server-only AI, no schema/protocol change |
| **Status** | Not started |

## Objective
Teach the bots to use the new systems so the **default solo experience**
(empty slots auto-filled by bots — see `MatchRoom.buildRoster`) actually
demonstrates Gamebreakers, dekes, and combos. Today bots never trigger their
ultimate or any trick, so a solo player never sees the game's signature
mechanics from the opposition.

## Background
- `packages/server/src/ai/bot.ts` produces an `InputState` per bot each tick.
  It currently sets `move`/`aim` and only `shoot`/`pass`/`steal`/`hit` — **never
  `ult`**, and (after WO-03) never `deke`.
- `packages/server/src/ai/goalie.ts` is separate and should stay focused on
  net-minding (no ults/dekes).
- Bots are server-only and already use `Math.random` for hit variance, so light
  stochastic decisions are fine here (this code is outside the deterministic
  shared sim).
- `SkaterState` exposes everything the bot needs: `ultCharge`, `ultActiveUntil`,
  and (post-WO-03/04) deke cooldown + `combo`.

## Design

### 1. Spend Gamebreakers intelligently (needs WO-02)
In `bot.ts`, when `s.ultCharge >= 1` and the ult is off cooldown, decide to fire
based on the ult's archetype and situation — so bots set up *Gamebreaker goals*,
not random pops:
- **Shooter ults** (Cannon, Barrage): fire when carrying and within shooting
  range of the net (the bot already computes `dist` to net and shoots `< 13`).
- **Speed ults** (Afterburner, Phase, Overdrive, Vision): fire when carrying with
  open ice ahead (no opponent within ~X in the lane toward the net).
- **Disruption ults** (Shockwave, Deep Freeze, Magnet): fire when *defending* and
  opponents/carrier are clustered near our net, or to strip a carrier in range.
- **Freight Train**: fire when charging the lane with the puck and a defender
  ahead.
Encode as a small per-ult policy keyed by `getCharacter(s.characterId).ultimateId`
(import from `@bbh/shared`). Add light randomness/hysteresis so bots don't all
fire on the same frame.

### 2. Deke under pressure (needs WO-03)
When a bot is the carrier and a defender is within the "about to be checked/stolen"
band (the bot already finds `nearestOpponent`/`pressure`), occasionally trigger
`deke` toward open space instead of always passing/shooting — respecting the deke
cooldown. This both protects the puck and demonstrates ankle-breaks to the player.

### 3. Play for style/combo (benefits from WO-04)
Bias bot decision weights slightly toward style plays when their meter is low
(chain a deke→pass) so the *opponent* visibly builds combos and earns
Gamebreakers — making solo matches feel alive. Keep it subtle; bots shouldn't
showboat themselves into turnovers constantly.

### 4. Difficulty knobs
Introduce simple difficulty scaling (ult aggressiveness, deke frequency, reaction
range) so the solo game can be tuned. A single `BotDifficulty` constant or
per-roster setting is enough for now.

## Files to touch
| File | Change |
|---|---|
| `packages/server/src/ai/bot.ts` | ult policy by archetype; deke-under-pressure; style bias; difficulty knobs |
| `packages/server/src/ai/goalie.ts` | (likely none — keep goalie focused) |
| `packages/server/src/rooms/MatchRoom.ts` | (optional) pass a difficulty into bot input |

No shared-sim, schema, or client change — bots just emit a richer `InputState`,
and the new action fields already exist from WO-03 (`emptyActions()` defaults).

## Acceptance criteria
- [ ] In a solo match (5 bots), bots fire ultimates and you see Gamebreaker goals against you.
- [ ] Bot ults are situational, not random spam (shooter ults near the net, disruption ults on defense, etc.).
- [ ] Bot carriers occasionally deke to escape pressure (respecting cooldown).
- [ ] Goalies still only mind the net.
- [ ] Difficulty knob visibly changes how often bots use supers/tricks.
- [ ] `npm run typecheck` clean; server runs without errors over a full match.

## Testing
- Manual: start a solo match, confirm bots use each archetype's ult sensibly over
  a few periods; confirm you get scored on by a Gamebreaker.
- Optional unit test: a `decideUlt(world, s)` helper extracted from `bot.ts`
  returns "fire" in a contrived shooter-in-slot scenario and "hold" with an empty
  meter or no setup. Extracting the policy as a pure function makes it testable
  even though the bot itself is stochastic.

## Notes / risks
- Don't regress the role-aware spacing already in `bot.ts` (only the closest
  teammate forechecks; others support/drop). Add ult/deke decisions *on top* of
  the existing role logic, not as a replacement.
- Avoid all bots firing simultaneously — add per-bot jitter/hysteresis.
- Keep bot logic out of the deterministic shared sim; it lives server-side and
  may use `Math.random`.
