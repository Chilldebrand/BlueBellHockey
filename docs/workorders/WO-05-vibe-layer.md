# WO-05 — Vibe Layer

| | |
|---|---|
| **Phase** | 5 (presentation / personality) |
| **Depends on** | WO-01..04 (events to react to) |
| **Blocks** | — |
| **Est. effort** | ~2–3 days (scales with art ambition) |
| **Status** | Done |

## Objective
Give the game the EA-BIG personality. Mechanically the game is "done" after
WO-04; this WO is what *sells* it as Street: reactive callouts, exaggerated
juice, a graffiti/neon court, and (optionally) a hype announcer. Half of "Street"
is attitude.

## Background — the hooks already exist
- **Event bus:** sim `SimEvent`s are broadcast by `MatchRoom.tick` and re-emitted
  client-side via `net.events` (`net/client.ts` `EventBus`). `HUD.tsx`'s
  `GoalBanner` already subscribes (`net.events.on('goal', ...)`). New callouts
  ride the same path.
- **VFX/SFX scaffold:** `render/Vfx.tsx`, `render/fx.ts`, `audio/sfx.ts` already
  exist (SFX appear synthesized — no audio files in `public/`).
- **HUD banners:** `HUD.tsx` `Banner`/`GoalBanner` are reusable big-text overlays.

## Scope
**In scope:** on-screen callouts for the new events, hit/ankle-break/Gamebreaker
juice, a court reskin, a "GAMEBREAKER READY" indicator, optional announcer/SFX,
and a player-facing mute/volume control (currently impossible — see WO list item
on options). **Out of scope:** new gameplay rules.

## Design

### 1. Callouts (cheap, high impact)
Subscribe in `HUD.tsx` (or a new `Callouts.tsx`) to the events from WO-02/03/04
and flash styled text:
| Event | Callout |
|---|---|
| `ankle_break` | "BROKEN ANKLES!" |
| `deke` (chained) | "DANGLES!" |
| `bank_play` | "OFF THE WALL!" |
| `nolook_pass` | "NO LOOK!" |
| combo milestones | "x5 COMBO 🔥" |
| meter full | "GAMEBREAKER READY" (persistent until spent) |
| `gamebreaker` | "GAMEBREAKER!!!" + "+2" |
Register each new type in `net/client.ts` (`room.onMessage` + `GameEvent` union)
and add them to the `MatchRoom` broadcast filter.

### 2. Juice (`render/Vfx.tsx`, `fx.ts`)
- Exaggerate hit/ankle-break impact: screen shake, freeze-frame (a few ms),
  impact spark/burst at contact, speed-lines on `afterburner`/big speedMult.
- Meter-full: pulsing aura on the carrier (some ult auras already exist).
- Gamebreaker goal: distinct full-screen flash + slow-mo on the goal pause
  (`world.pauseUntil` already freezes play for the celebration — lengthen it for
  Gamebreakers).

### 3. Court reskin (`render/Rink.tsx`)
Swap the clean NHL sheet for a street court: graffiti decals, neon boards, bolder
team colors, grungier ice texture. Keep `RINK` dimensions/`goalWidth` so sim and
collision are untouched — this is purely visual material/texture work.

### 4. Announcer / SFX (optional, `audio/sfx.ts`)
Reactive one-liners on big plays (hit, ankle-break, Gamebreaker, combo
milestone). If using audio files, add them under `packages/client/public/` and
preload. Add a **volume/mute** control (ties to the broader "options menu" gap —
there is currently no way for a player to mute).

## Files to touch
| File | Change |
|---|---|
| `packages/client/src/net/client.ts` | register all new events; extend `GameEvent` |
| `packages/server/src/rooms/MatchRoom.ts` | broadcast new event types |
| `packages/client/src/ui/HUD.tsx` (or new `Callouts.tsx`) | callout overlays + GAMEBREAKER READY |
| `packages/client/src/render/Vfx.tsx`, `fx.ts` | impact juice, shake, slow-mo, auras |
| `packages/client/src/render/Rink.tsx` | graffiti/neon court reskin |
| `packages/client/src/audio/sfx.ts` | reactive hits/announcer; volume control |
| `packages/shared/src/sim/world.ts` | (optional) longer `pauseUntil` for Gamebreaker celebration |

## Acceptance criteria
- [x] Each new gameplay event produces a distinct, readable on-screen callout. (`Callouts.tsx`: BROKEN ANKLES / OFF THE WALL / NO LOOK / xN COMBO)
- [x] Hits and ankle-breaks have visible impact juice (shake/spark/flash). (Vfx sparks + cameraShake + FlashOverlay)
- [x] "GAMEBREAKER READY" shows when the meter is full and clears when spent. (persistent badge + UltMeter)
- [x] A Gamebreaker goal gets a bigger celebration than a normal goal. (gold banner + full-screen flash + 220-particle burst + longer pause)
- [x] The court reads as a "street" court without changing rink dimensions/collision. (materials/decals only; `RINK` untouched)
- [x] A player can mute/adjust volume. (🔊 button + slider + **M** key, synced into `sfx` master gain)
- [x] No regression in frame rate from VFX (reuses the existing instanced particle pool + camera-shake; callouts are single-slot).
- [x] `npm run typecheck` clean (and the client production build succeeds).

## Decisions (applied)
- Callouts are a **single transient slot** (no stacking/leaks) biased to the upper
  area; center is reserved for the goal/Gamebreaker banner.
- New synth SFX cues added for `gamebreaker`/`ankle_break`/`bank_play`/`nolook_pass`;
  the mixer reads `store.muted`/`store.volume` (defaults: unmuted, 0.5).
- Court is dark asphalt + neon emissive boards + low-opacity graffiti splashes +
  team-tinted end zones; faceoff dots/goal posts recolored neon. No geometry change.
- `pauseUntil` for Gamebreakers was already lengthened to 2600ms in WO-02.

## Testing
- Mostly manual / visual. Trigger each event (deke into a defender, bank a pass,
  score with an ult up) and confirm the right callout + juice.
- Verify callouts don't stack/leak (clear timers on unmount — follow the
  existing `GoalBanner` `setTimeout`/cleanup pattern).
- Confirm slow-mo/`pauseUntil` change doesn't desync the clock (clock already
  freezes during `pauseUntil`).

## Notes / risks
- Screen shake + freeze-frame are easy to overdo; make them brief and
  intensity-scaled.
- Keep callouts from obscuring the puck during play; bias them to corners/edges,
  reserve center-screen for goals/Gamebreakers.
- Court art is the most open-ended task; timebox it or stage it (materials first,
  decals later).
