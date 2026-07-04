# 3v3 Arcade Hockey — Session Handoff

Paste this into a new chat to continue. It captures the full state as of the last session.

## What this project is
A **grounded 3v3 online multiplayer arcade hockey game** (NHL-Threes feel, NOT NHL-Street) with
**NHL-style skill-stick controls** (right stick = puck control). Browser game: TypeScript, Three.js
+ react-three-fiber client, authoritative Colyseus server, deterministic shared sim.

- **Repo:** `https://github.com/richey1406-prog/BBellHockey.git`
- **Working dir:** `C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey`
- **Active branch:** `main` (the rewrite was merged in; `DalesMajorPLan` is the now-redundant feature branch)
- **The game lives in `packages/arcade-core` (sim), `arcade-server` (Colyseus), `arcade-client` (React/Three).**
  `packages/shared|server|client` are the ORIGINAL prototype, kept read-only as a reference quarry
  (best goalie/puck algorithms were ported from `packages/shared/src/sim/puck.ts`). Run legacy with `*:legacy` npm scripts.

## Locked-in decisions (do not relitigate)
- Grounded arcade identity — NO ultimates, style meter, gamebreakers, or fantasy characters.
  Powerups + character specials are CUT: their code stays but is flag-disabled via `TUNING.flags`
  (`powerupsEnabled:false`, `specialsEnabled:false`) in `packages/arcade-core/src/config/tuning.ts`.
- Stay web/TypeScript. No Unity/Godot.
- New sim inside the existing arcade shell (not a fresh repo).
- No real NHL branding/logos/player likenesses — original teams only.

## How to run
```
cd "C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey"
npm run dev      # arcade server (ws://localhost:2568) + client (http://localhost:5173)
npm test         # 171 tests across arcade-core/server/client
npm run typecheck
npm run smoke --workspace @bbh/arcade-server   # 2-client websocket end-to-end
```
Open http://localhost:5173. Main menu has Quick Match, Private Room, and **Free Skate** (solo practice).

## What's built (deterministic shared sim, server-authoritative, client-predicted)
- **Skating** (`sim/skater.ts`): facing + anisotropic grip (edge bite vs glide), capped turn rate,
  brake-to-stop, turbo. Cruise maxSpeed 560, turbo ~840.
- **Puck** (`sim/puck.ts`): free body with height/vertical velocity, gravity, ice bounce, air drag.
  Carried puck is a **spring tether to the stick blade** (lags on turns, breaks if over-dangled, pokeable).
- **Skill stick** (`sim/stick.ts` + `sim/gestures.ts`): right-stick raw samples on the wire; gesture
  detection is deterministic in shared code. Flick fwd = wrist, pull back + flick = slap, one-timers off passes.
- **NHL shot aiming:** every shot auto-drives at the net (center on neutral); LEFT stick at release places
  it — left/right picks side, up lifts toward bar, down keeps it low.
- **Defense** (`sim/actions.ts` `resolveDefensiveActions`): poke check (blade lunge), body checks,
  block shot / dive (lay out, body blocks pucks).
- **Contact** (`sim/collision.ts`): skater-skater impulses, goalie body block, carrier jostle.
- **Goalies** (`sim/goalie.ts`): swept save test (no tunneling), save types by height/side, cover→faceoff
  vs directional rebounds.
- **Nets** (`sim/net.ts`): REAL cages pulled ~170u off the end wall — skateable ice behind the net,
  cage is solid (skate around, puck bounces off twine), goals = crossing the line through the mouth.
- **Rink** (`config/rink.ts`): rounded-rect boards, 2600 x 1560 (was grown 2x from feedback), glass ring
  rendered above boards.
- **Camera** (`render/CameraRig.tsx`): FIXED height/distance, north-south (goals top & bottom),
  smoothed puck-follow, NO zoom/punch-in.
- **Netcode:** full input-replay reconciliation, per-slot input acks in snapshots.
- **Feel Lab:** Free Skate = client-only sim (`game/localSim.ts`, `practice:true` = just you + a goalie),
  live tuning panel (`dev/TuningPanel.tsx`, mutates `TUNING`, "Copy JSON" exports to paste into
  `DEFAULT_TUNING`), debug overlays, deterministic input recorder.

## Controls
Gamepad = EA NHL 25 Skill Stick layout: Left stick skate, **Right stick = puck**, A pass / stick-lift,
B/X check, RB poke, LB dive/block, RT switch, L3 hustle.
Keyboard: WASD move, IJKL or mouse = stick, Space = simple shot, F pass, G check, R poke, V dive, Shift turbo, Q switch.

## Known placeholders / next steps
- **Characters are procedural capsule blockouts** (`render/CharacterModel.tsx`, `GoalieModel.tsx`),
  scaled 1.6x/1.5x to match the NHL-Arcade character/ice ratio. Dives/pokes reuse the knockdown pose.
- **Model research done (last session):** recommended stack = Quaternius modular body (CC0, GLB) +
  PROCEDURAL gear (stick/helmet/skates/gloves — no clean CC0 hockey-gear set exists; legacy game already
  did procedural gear) + Quaternius Universal Animation Library (CC0, 120+ clips, retarget generic
  run→skate, melee→check, throw→shot). Alt animations: Mixamo (free, royalty-free, can't resell standalone).
  Jerseys are NOT a model — they're material recolors via existing `TEAM_PALETTES`.
  The manifest contract already exists in `render/modelValidation.ts` (required bones incl. skate_l/r,
  attachment points stick_hand/stick_blade, gear+uniform material slots, named clips wrist_shot/check/etc).
  CATCH: retargeting is real work — Quaternius/Mixamo bone + clip names won't match the manifest, needs a
  Blender retarget or load-time bone map.
- **Suggested immediate next step:** wire real `useGLTF` loading for ONE test Quaternius body + one skating
  clip into `CharacterModel.tsx` (replace the capsule blockout) to judge the look in Free Skate before
  committing to the full roster/retarget pipeline.
- **Owed by user:** playtest tuning pass in Free Skate → Copy JSON → paste values to lock into `DEFAULT_TUNING`.

## Working style that's been effective
Small changes → typecheck + `npm test` green → commit with descriptive message → push to `main` →
restart dev servers (`npm run dev`) so online play uses new code. Feel/visual changes verified by the
user in-browser (assistant can't run WebGL); logic verified by tests + the 2-client smoke.
