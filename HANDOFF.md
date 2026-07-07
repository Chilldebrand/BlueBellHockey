# 3v3 Arcade Hockey — Session Handoff

Paste this into a new chat to continue. Captures full state as of the end of the last session (2026-07-05).

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
npm run dev      # arcade server (ws://localhost:2567) + client (http://localhost:5173)
npm test         # 218 tests (124 arcade-core / 32 arcade-server / 62 arcade-client)
npm run typecheck
npm run smoke --workspace @bbh/arcade-server   # 2-client websocket end-to-end
```
Open http://localhost:5173 → Press Start → **Free Skate** now runs a FULL 3v3 of AI (you + 2 AI
teammates vs 3 AI opponents + goalie) with the **Feel Lab** live-tuning panel (Copy JSON exports).

> NOTE: the assistant can't render WebGL headlessly (the preview browser suspends requestAnimationFrame),
> so all VISUAL changes must be eyeballed by the user in their own browser. Logic is verified by tests +
> the 2-client smoke. When iterating, the assistant edits source and Vite HMR hot-reloads localhost:5173.

> Ports are unified on **2567** (server default, client DEFAULT_WS_URL, .claude/launch.json) — the old
> 2567-vs-2568 mismatch that broke online mode under the preview tools is fixed.

## GIT STATE
**Everything is committed AND pushed** — clean tree, `main` in sync with origin. All green:
`npm test` (218), `npm run typecheck`, smoke.

## This session's work (5 commits, all pushed)

### 1. Madden-style control switching (`df97e07`) — THE big feature
You control the highlighted skater; control now moves like a sports game.
- **Architecture (load-bearing):** control-switch is a ROUTING concern, never a sim concern. The
  deterministic world has no idea who is "controlled" — every slot always receives exactly one
  InputFrame per tick (human or bot), so the shared sim can't desync. Controlled-slot state lives in
  the **server roster** (online) and the **localSim closure** (Free Skate).
- `packages/arcade-core/src/sim/control.ts`: `resolveReceptionSwitch` (pass gathered by teammate →
  switch; keyed on pre/post-step `puck.carrierSlotId` transition — do NOT key on `passedFromSlotId`,
  it's nulled at pickup), `resolveManualSwitchTarget` / `nearestTeammateToPuck` (pass button while NOT
  carrying = switch to teammate nearest the puck), and (commit 3) `resolveTeamPossessionSwitch`.
- **Bot AI relocated** from `arcade-server/src/ai/` → `arcade-core/src/sim/ai/` (bot.ts, decision.ts)
  so the client-only Free Skate sim can drive AI. (`arcade-server/src/ai/goalie.ts` stayed — it's dead
  code; the real goalie AI is `stepGoalies` inside the sim.)
- Server: `switchHumanControl` in `roster.ts` (same-team, only into a `bot` slot, characterIds stay
  with their slots); `applyControlSwitches` in `ArcadeRoom.tick` after each stepWorld sub-step;
  rising-edge pass latch per session (consumed once per tick, so no multi-sub-step double-fire).
- Client: `localSlotId` is reactive off the roster schema, so highlight/camera/input all follow a
  server-side switch automatically. `App.tsx` flushes the prediction buffer (`unackedFramesRef`) +
  smoothing ref when `localSlotId` changes — without that, stale frames tagged with the old slot cause
  a brief rubber-band. Free Skate: `localSim.ts` tracks `controlledSlotId` in its closure, bot frames
  are generated inside `advance()` with sequence = `world.time.tick` (keeps recordings replay-identical).

### 2. Shots actually lift now (`af253ab`)
The lift logic was always there; the numbers were ~5× too weak for gravity 2300 (a full-power wrist
shot peaked at 15 units vs the 95-unit net). `wristLiftSpeed 260→660`, `slapLiftSpeed 430→860`.
Now: hard wrist aimed up ≈ crossbar; neutral ≈ mid-net; aim-down stays low (~12); full slap aimed up
sails OVER the bar (~160) — ease off top aim on slappers. Regression tests pin this. Peak height
math: `lift²/(2·gravity)`. Wrist power is clamped to [0.55, 1] in gestures.ts, so power was never
the culprit.

### 3. Solo: control follows ANY teammate pickup (`7b80669`)
`resolveTeamPossessionSwitch`: loose-puck pickups, rebounds, and interceptions by a teammate also
grab control — not just your own completed passes. Free Skate uses it unconditionally; the Colyseus
room uses it only when the team has ≤1 human (co-op teams keep pass-only so you can't yank a body
from a friend). **Known consequence flagged to user:** if two AI teammates pass amongst themselves,
control hops to follow the puck. User hasn't said yet whether they want bot-to-bot passes excluded.

### 4 + 5. Skates, legs, shorter torso, white helmet (`197da27`, `916ad7e`)
`CharacterModel.tsx`: new `Skate` (glossy black boot low-toe→tall-ankle, white Bauer-style holder,
steel runner with up-swept tips, laced tongue) and `LowerLimb` (pants thigh + team-sock shin, knee
bend, one foot staggered). **Trap that bit us once:** legs/skates must live in the ROOT frame
(+X forward, +Z right — same frame as the stick), NOT inside the body's `FORWARD_CORRECTION_Y`
(π/2) group, or the boots point sideways. Torso capsule shortened+raised (`[9, 10]` at y=30) so hips
clear the legs. Helmet shell + ear guards are glossy white again; visor is black smoked
(opacity 0.9). User saw an intermediate version; the FINAL pass (short torso/white helmet) was
pushed on request but **not explicitly confirmed on screen — ask for a visual check-in**.

## Controls (current)
Gamepad: Left stick skate, **Right stick = skill stick**, **A / RT / R2 = pass (hold to charge)**;
same button while NOT carrying = **switch to teammate nearest the puck**. B/X check, RB poke,
LB dive/block, L3 hustle. Keyboard: WASD move, IJKL/mouse stick, Space shot, F pass/switch, G check,
R poke, V dive, Shift turbo. Shots auto-aim at the net; LEFT stick at release places them
(L/R side, up = bar, down = low). Control auto-follows your team's puck possession in solo play.

## Online play with a friend — WORKED tonight (ephemeral recipe)
Played a real internet match this session via **cloudflared quick tunnels** (no account needed):
1. Download `cloudflared.exe` (single binary, `curl -L .../cloudflared-windows-amd64.exe`).
2. Start server + tunnel it: `cloudflared tunnel --url http://localhost:2567` → gives `https://xxx.trycloudflare.com`.
3. Restart the Vite client with `VITE_ARCADE_WS_URL=wss://xxx.trycloudflare.com` (baked at startup!).
4. Tunnel the client: `cloudflared tunnel --url http://localhost:5173 --http-host-header localhost:5173`
   (the host-header rewrite stops Vite rejecting the public hostname).
5. Send the friend the client https URL → Private Room + 6-char code.
Latency through Cloudflare was playable. Tunnels are shut down; URLs are dead and change every run.
**Next step if the user wants a permanent link:** deploy server (Fly/Render/Colyseus Cloud) + client
(Vercel/Netlify), and consider auto-deriving the WS URL from `window.location.host`.

## Current tuning defaults
`PUCK_CONFIG` is the source of truth (flows into `TUNING.puck` via `buildDefaults()`; Feel Lab
auto-generates sliders for every field). Notable: `wristLiftSpeed:660, slapLiftSpeed:860,
maxChargedShotSpeed:1650, passChargeMaxMs:600, passChargeSpeedBonus:380`; stick `restOffset:22,
restLateral:44.5`; goalie `lateralSpeed:520, saveReach:70, reactionDelayMs:150`.

## Known next steps / owed / open questions
- **User feel-checks owed:** (a) new shot lift (neutral vs aimed, wrist vs slap), (b) possession-switch
  feel in Free Skate + online solo — especially whether bot-to-bot passes hopping control is OK,
  (c) final skate/leg/torso/white-helmet visual pass.
- **Possible tweak queued:** exclude bot-to-bot passes from `resolveTeamPossessionSwitch` (only
  switch on loose-puck/interception/your-own-pass) if the control-hopping annoys.
- **Permanent online deploy** (see recipe section) if tunnel-on-demand gets old.
- **One-timers** got real 2-player exercise tonight but no explicit feedback — ask.
- **GLB roster pipeline** still parked: `GLTF_SKATER_BODIES_ENABLED = false` in `skaterGltfSource.ts`,
  blockout look is the current choice. Test asset + load path remain wired.
- Optional cleanups: dormant `selectedTargetSlotId`/`updateAssistTargets` + TargetIndicator;
  dead `arcade-server/src/ai/goalie.ts`. (Ports now unified on 2567 — done.)

## Working style that's been effective
Small change → `npm run typecheck` + `npm test` green → user eyeballs on localhost:5173 (HMR).
Feel/visual changes verified by the user in-browser; sim logic by tests + the 2-client smoke. When a
test breaks from an intended change, fix the test to the new behavior. Ask real design questions
before building (switch timing, button mapping, test scope all came from user answers). Commit per
feature with detailed bodies; push when asked. Restart the preview servers when asked.
