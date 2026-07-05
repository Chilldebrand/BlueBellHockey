# 3v3 Arcade Hockey — Session Handoff

Paste this into a new chat to continue. Captures full state as of the end of the last session.

## What this project is
A **grounded 3v3 online multiplayer arcade hockey game** (NHL-Threes feel, NOT NHL-Street) with
**NHL-style skill-stick controls** (right stick = puck control). Browser game: TypeScript, Three.js +
react-three-fiber client, authoritative Colyseus server, deterministic shared sim.

- **Repo:** `https://github.com/richey1406-prog/BBellHockey.git`
- **Working dir:** `C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey`
- **Active branch:** `main`
- **Game lives in `packages/arcade-core` (sim), `arcade-server` (Colyseus), `arcade-client` (React/Three).**
  `packages/shared|server|client` are the ORIGINAL prototype, kept read-only as a reference quarry.

## How to run
```
cd "C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey"
npm run dev      # arcade server (ws://localhost:2568) + client (http://localhost:5173)
npm test         # 195 tests (98 arcade-core / 35 arcade-server / 62 arcade-client)
npm run typecheck
npm run smoke --workspace @bbh/arcade-server   # 2-client websocket end-to-end
```
Open http://localhost:5173 → Press Start → **Free Skate** (solo practice + a goalie + a stationary
opponent dummy). Free Skate = client-only sim with the **Feel Lab** live-tuning panel (Copy JSON exports).

> NOTE: the assistant can't render WebGL headlessly (the preview browser suspends requestAnimationFrame),
> so all VISUAL changes must be eyeballed by the user in their own browser. Logic is verified by tests +
> the 2-client smoke. When iterating, the assistant edits source and Vite HMR hot-reloads localhost:5173.

## ⚠️ GIT STATE — READ FIRST
- **2 local commits are UNPUSHED** on `main` (`d8c0d52` GLB wiring, `b9ea6c0` fiber-dedupe fix).
- **The ENTIRE rest of this session is UNCOMMITTED** — ~30 modified files + 1 new file
  (`packages/arcade-core/src/sim/spawns.ts`). Nothing below "This session's work" is committed.
- Everything is green: `npm test` (195), `npm run typecheck`, and the smoke all pass.
- **First decision for next session: commit + push this work** (the user kept iterating and never asked to
  commit). Suggest grouped commits by feature. On `main`, so branch first if desired.

## This session's work (all uncommitted unless noted)

### Gameplay / sim (packages/arcade-core)
- **Goalies made beatable.** New reaction-latency lever in `sim/goalie.ts`: `reactionDelayMs` (default 150) —
  the goalie tracks where the puck *was* that long ago (velocity-extrapolated), so quick shots / one-timers
  beat it. Also tuned `lateralSpeed` 560→520, `saveReach` 74→70. All live in the Feel Lab "Goalie" section.
- **Faceoff reposition fix.** `resetForFaceoff` (`sim/goal.ts`) now returns all skaters + goalies to spawn
  positions, not just the puck — fixes "can't find my character after a goal" (was: puck+camera snapped to
  center, player stranded by the net). Spawn math extracted to new `sim/spawns.ts` (shared by `world.ts` +
  `goal.ts`, no circular import).
- **Slap shots hit harder** (`sim/puck.ts` PUCK_CONFIG): `maxChargedShotSpeed` 1460→1650, `slapLiftSpeed` 330→430.
- **Shots lift off most of the time.** Lift base formula `0.55+0.45*aim` → `0.72+0.28*aim`; `wristLiftSpeed` 170→260.
- **Left-stick-aimed passing.** `passDirectionWithAssist(world, carrier, aim)` now takes an aim vector; new
  `passAimDirection(input, carrier)` uses the LEFT stick's world direction (falls back to facing), assists to
  the best-aligned teammate, else goes straight. Dropped the old cycled-target dependency for passes.
- **Charged pass (hold to charge, fire on release).** New `SkaterEntity.passChargeMs` (init in `world.ts`,
  reset on pickup in `puck.ts`). PUCK_CONFIG `passChargeMaxMs` 600, `passChargeSpeedBonus` 380 (820→1200 at
  full). A quick tap = normal pass. Deterministic; no InputFrame/netcode change.
- **Stick rest tuning locked in** (`sim/stick.ts`): `restOffset` 52→22, `restLateral` 22→44.5 (blade closer
  in, further right — right-handed forehand cradle).

### Controls (packages/arcade-client/src/input)
- **RT (Xbox) / R2 (PS) now pass**, same as A: `gamepad.ts` `pass = buttons[0] || buttons[7]`.
- **Target-cycling REMOVED from controls** (user request) — dropped Y (gamepad `buttons[3]`) and Q (keyboard).
  `switchTarget` is now always false; the sim's `selectedTarget`/`updateAssistTargets` code is dormant (left
  in place; passing no longer uses it). Could be fully ripped out later if desired.

### Visuals (packages/arcade-client/src/render)
- **Camera:** zoomed out ~20% then given a slight down-ice tilt (`CameraRig.tsx`: back-offset 520→760,
  height 860→940). Still fixed/no-zoom-punch.
- **Rink = standard NHL markings** (`Rink.tsx`): red center line (split so it stops at the center circle),
  two blue lines, blue center faceoff circle (now **red** per user) + a painted **blue Liberty Bell** logo at
  center ice (canvas texture, `CenterIceLogo`), 4 red end-zone faceoff circles (moved 25% closer to the side
  boards, `zOff` 412). Removed the 4 neutral-zone dots. Bell plane rotation was flipped 180° to sit upright.
- **Skater helmets → glossy black CCM style** (`CharacterModel.tsx`): clearcoat black shell, ear guards, a
  **clear** curved visor (sphere-slice), dark eyes + mouth.
- **Stick blade reworked** (`CharacterModel.tsx` `StickAssembly`): long axis now lateral/horizontal, ~75%
  skinnier (box `[1.75, 3.4, 18]`), swept to ONE side from a rounded heel via `segmentBetween` so shaft→blade
  reads as one curved piece.
- **Puck:** 50% smaller render (radius 18→9), removed the yellow charged-shot glow.
- **Puck rides in the blade pocket** (`Puck.tsx` + `Scene.tsx`): new `pocketCarriedPuck` offsets the carried
  puck along the blade toward the middle (`POCKET_RIGHT` = 13, `POCKET_FORWARD` = 1.5). Applied in `Scene.tsx`
  for ANY carrier (Free Skate has no predicted local skater, so it must run there too — that was a real bug).
  **These are code constants, NOT Feel Lab sliders.**
- **Removed a stray cyan debug blade marker** from `SkaterDebug.tsx` (it sat at the sim blade point and
  showed as a "blue highlight" at the heel once the puck moved into the pocket).
- **Free Skate has a stationary opponent dummy** (`game/localSim.ts`) to practice hitting; the yellow
  facing-arrow debug overlay is still on in Free Skate (user may want it gone).

### GLB skater models — parked (flag OFF)
- Real GLB body loading is wired (`render/gltf/`: `GltfSkaterBody.tsx`, `skaterGltfSource.ts`,
  `ModelErrorBoundary.tsx`) with a load-time approach + graceful fallback to the capsule blockout.
  `@react-three/drei` added; a **duplicate-react-three-fiber Vite bug** was found & fixed (dedupe +
  optimizeDeps in `vite.config.ts`) — drei hooks threw "Hooks can only be used within the Canvas component".
- Test asset `public/arcade/models/skaters/test-cesium.glb` (CesiumMan, CC-BY, temporary placeholder).
  Idle-freeze logic (`shouldAdvanceClip`) holds a static pose when a rig lacks a dedicated clip.
- **Currently DISABLED:** `GLTF_SKATER_BODIES_ENABLED = false` in `skaterGltfSource.ts` — all skaters use the
  procedural blockout (to match the goalie). Flip to `true` to bring the GLB path back. The user chose to
  stick with the polished blockout look for now.

## Current tuning defaults (DEFAULT_TUNING == user's last Copy-JSON export)
All sim knobs are live-tunable in the Feel Lab and were verified via a diff script to match the user's export
exactly. Notable non-stock values: stick `restOffset:22, restLateral:44.5`; goalie `lateralSpeed:520,
saveReach:70, reactionDelayMs:150`; puck `maxChargedShotSpeed:1650, wristLiftSpeed:260, slapLiftSpeed:430,
passChargeMaxMs:600, passChargeSpeedBonus:380`. To re-verify a pasted export: rebuild arcade-core, import
`snapshotTuning()` from `dist/config/tuning.js`, diff against the JSON (see prior chat for the script).

## Controls (current)
Gamepad: Left stick skate, **Right stick = puck (skill stick)**, **A / RT / R2 = pass (hold to charge)**,
B/X check, RB poke, LB dive/block, L3 hustle. (No target-cycle button anymore.)
Keyboard: WASD move, IJKL/mouse = stick, Space simple shot, F pass, G check, R poke, V dive, Shift turbo.
Shots auto-drive at the net; LEFT stick at release places them (L/R side, up = bar, down = low).

## Known next steps / owed / open questions
- **Commit + push** the session (see git state above). Not yet done.
- **Online play with a friend:** fully built (Colyseus, Quick Match, Private Room + room codes) but only runs
  on localhost. Client reads `VITE_ARCADE_WS_URL` env (defaults `ws://localhost:2568`); server binds
  `PORT ?? 2568`. To actually connect a friend: LAN (point client at host IP), a tunnel (ngrok/cloudflared,
  needs `wss://` once served over https), or deploy (server→Fly/Render/Colyseus Cloud, client→Vercel/Netlify).
  A nice helper: auto-derive the WS URL from `window.location.host` instead of hardcoding localhost.
- **One-timers** need real 2-player testing (user can't test solo). Charged-pass "fires on release" feel may
  need tuning if quick taps feel laggy (`passChargeMaxMs`).
- **Blade pocket / stick** fine-tuning is via code constants (`POCKET_RIGHT` in `Puck.tsx`); consider exposing
  as Feel Lab sliders if the user keeps iterating. Stick blade could get a lie angle / curve if wanted.
- **GLB roster pipeline** (retargeting Quaternius/Mixamo → the manifest bones) still owed if the user wants
  real models instead of blockouts.
- Optional: fully remove the dormant `switchTarget`/`selectedTarget` system + on-screen target indicator.

## Working style that's been effective
Small change → `npm run typecheck` + `npm test` green → tell the user to eyeball on localhost:5173 (HMR).
Feel/visual changes verified by the user in-browser; sim logic by tests + the 2-client smoke. When a test
breaks from an intended change, fix the test to the new behavior (and anchor geometry tests to real values
like `bladeWorldPosition` rather than magic numbers). Restart the preview server when asked.
