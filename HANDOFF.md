# 3v3 Arcade Hockey — Session Handoff

Paste the **Paste Into Next Chat** section into a new chat to continue. This top section is
authoritative as of 2026-07-13; historical notes below may describe older checkpoints.

## Paste Into Next Chat

Continue work in `C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey` on `main`.
Read `HANDOFF.md` first. Work only in `packages/arcade-core`, `packages/arcade-server`, and
`packages/arcade-client`; `packages/shared`, `packages/server`, and `packages/client` are legacy
reference code and must not be modified. Use `npm.cmd` in PowerShell.

**THE FULL GAME AUDIT WAS COMPLETED 2026-07-13** — all six priorities executed, fixes landed in
five pushed commits (`d752749..7154dc9`). Read "Audit results" below before anything else; the
biggest single finding (goalie outlet human control was never wired) has an approved work order
waiting.

### Current repository and runtime state (2026-07-13, post-audit)

- Everything is committed AND pushed; verify with `git status --short --branch`.
- Certified baseline at HEAD: `npm test` **354/354** (210 core / 58 server / 86 client),
  `npm run typecheck` clean, two-client smoke all 7 checks PASS.

### Audit results (2026-07-13) — what was found and fixed

**① Server hostile-client surface — fixed in `d752749`:**
- Non-string `playerName` in join options threw mid-slot-assignment → permanently stranded a
  zombie "human" slot no session could release. Names now sanitized (type/control-chars/24-char cap).
- `privateCode` (now 1-12 alphanumerics), `mode`, `quickMatch` join options validated — all three
  previously reached replicated schema state, room metadata, and `createWorld` raw.
- `client.rematch` / `client.backToLobby` were callable by anyone at ANY time → gated to
  postgame-only + rostered sender (a hostile client could reset/freeze a live match).
- `client.backToLobby` now builds a FRESH waiting world (before: phase-flip kept the expired
  clock + final score, so the next start resumed a finished match).
- `client.chooseTeam` rejected mid-match (team defection let a client control an opposing skater).
- `applyControlSwitches` only runs while playing (lobby input spam could hop slots).

**Room lifecycle (the two known live bugs) — fixed in `04625a6`:**
- `connection.left` now resets the whole client store: a dead room (server restart) previously
  left a frozen match on screen forever. Now → lobby with the error shown.
- Reconnect was a DEAD feature: the client saved tickets + called `matchmaker.reconnect()` but the
  server never called `allowReconnection`, so reloads always failed and dropped slots lingered.
  Now: unconsented leave → slot released to a bot immediately (no AFK statue), 30s reconnection
  seat held, returning session re-seated in its old slot with its old name (`preferredSlotId`).
  Client refreshes the stored ticket every 10s so the 30s window counts from the DROP, not join.

**② Sim edge-interaction matrix — fixed in `5a96240`:**
- BIG: powerup spawn selection was degenerate — `(seed+index)%3` bananas and `(seed+index)%6`
  types were correlated with the round-robin point (`index%3`). Verified by enumeration:
  **speed-boost and bulldozer could NEVER spawn (any seed)**, one point was permanently
  all-bananas, each other point only offered two fixed types. Now both decisions come from
  independent salts of a deterministic integer mixer (`mixSpawnHash` in `config/powerups.ts`) —
  all six types reachable, bananas rotate points, replays stay byte-identical.
- Frozen/knocked-down skaters could still ACTIVATE held powerups (counter-freeze from inside the
  ice block) → gated in `useHeldPowerups`.
- Unclaimed drops stacked unboundedly on a spawn point (endless Free Skate) → a point holding a
  pickup/peel skips its next spawn.
- Verified clean: contactState machine (frozen absorbs checks, can't act), banana-vs-freeze same
  tick ordering, bulldozer × braced/frozen branches, goalie resize × save reach single source,
  no Math.random/Date.now anywhere in arcade-core sim.

**③ localSim vs server drift — no drift found.** Switching latches, bot frames, possession rules
match; differences (co-op reception-only rule, endless clock) are by design.

**④ Performance — measured, no action needed now:** sim step 0.034 ms/tick (0.2% of budget);
eventQueue max ~31 (trim works); drops bounded ≤3 after the stacking fix. The number to know:
full-world snapshots are ~8-11 KiB JSON at 62.5/s ≈ up to ~680 KiB/s per client upper bound
(msgpack less). Fine on LAN/tunnel; before a public deploy consider broadcasting every 2nd-3rd
tick (client already interpolates) or delta snapshots.

**⑤ npm audit (first ever) — `df67902`:** 20 vulns → non-breaking fixes applied (incl. CRITICAL
shell-quote via concurrently). 18 remain, ALL requiring semver-major bumps, deliberately deferred:
vitest 4 / vite 8 (remaining critical/high are dev-server-only exposure) and colyseus 0.17
(nanoid predictability, low practical risk). Do these as a dedicated upgrade session sometime.

**⑥ Dead-code sweep — `7154dc9`:** removed the end-to-end-dead assist-target system (nothing
bound `switchTarget`; `selectedTargetSlotId` was write-only; TargetIndicator.tsx orphaned) and the
legacy `client.chooseCharacter` message + roster delegate. `InputFrame.switchTarget` kept as
optional deprecated for wire tolerance. Specials scaffolding intentionally kept (flag-gated).

### ⚠ Corrections to the previous handoff (found during audit)

- **"Goalie outlet control" was OVERSTATED.** Only the sim side (WO-GOALIE-00) landed. The control
  grant layer (WO-GOALIE-01) and client presentation (WO-GOALIE-02) were never implemented: NO
  controller routes a human's input to the goalie slot, so `latestInputBySlot.get(activeGoalie.id)`
  in `stepWorld` is always undefined in real play (server AND Free Skate). Actual behavior today:
  every covered save holds 2.5s, then the deterministic fallback outlet fires. The human
  aim/charge/release path only executes in unit tests. WO-GOALIE-01 is approved and ready to build.
- Workorder `**Status**` fields in `docs/workorders/` are broadly stale (e.g. WO-GOALIE-00 and
  WO-PG-00 say "not implemented" but ARE live) — don't trust them over the code.

### Recommended next steps (in rough order)

1. **WO-GOALIE-01** — goalie outlet control grants (the audit's one real feature gap; approved).
2. User-owed feel passes on the 2026-07-09 batch (see "Known next steps" below).
3. Optional `/code-review ultra` (user-triggered, billed) now that targeted fixes have landed.
4. Real deploy (Fly/Render + static host) — the server surface is now hardened for strangers;
   revisit snapshot bandwidth (④) when it happens.
5. Dedicated major-upgrade session: vitest 4, vite 8, colyseus 0.17 (⑤ leftovers).

Method that worked: read-first, worst-first, regression test → fix → suite green → commit → push.

## What this project is
A 3v3 online multiplayer **arcade hockey game** with grounded core physics (NHL-Threes-style skating,
checking, puck feel) and **NHL-style skill-stick controls** (right stick = puck control). Browser
game: TypeScript, Three.js + react-three-fiber client, authoritative Colyseus server, deterministic
shared sim.
**As of 2026-07-09 the direction moved arcade-ward:** powerups + banana-peel hazards are now LIVE and
being actively expanded (see the powerups section) — the earlier "grounded, NO powerups" framing is
superseded, though the underlying skating/checking sim stays grounded.

- **Repo:** `https://github.com/richey1406-prog/BBellHockey.git`
- **Working dir:** `C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey`
- **Active branch:** `main`
- **Game lives in `packages/arcade-core` (sim), `arcade-server` (Colyseus), `arcade-client` (React/Three).**
  `packages/shared|server|client` are the ORIGINAL prototype, kept read-only as a reference quarry.

## How to run
```
cd "C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey"
npm run dev      # arcade server (ws://localhost:2567) + client (http://localhost:5173)
npm test         # 341 tests (210 arcade-core / 46 arcade-server / 85 arcade-client)
npm run typecheck
npm run smoke --workspace @bbh/arcade-server   # 2-client websocket end-to-end
```
Open http://localhost:5173 → Press Start → **Free Skate** runs a FULL 3v3 of AI (you + 2 AI
teammates vs 3 AI opponents + goalies) with the **Feel Lab** live-tuning panel (Copy JSON exports).
Preferred way to run servers with the assistant: the preview tools + `.claude/launch.json`
(`arcade-server` on 2567, `arcade-client` on 5173). Ports are unified on 2567 everywhere.

> NOTE: the assistant can't render WebGL headlessly (the preview browser suspends requestAnimationFrame),
> so all VISUAL changes must be eyeballed by the user in their own browser. Logic is verified by tests +
> the 2-client smoke. The LOBBY is plain DOM though — the assistant CAN drive/verify it via preview
> snapshot/click tools. When iterating, Vite HMR hot-reloads the client; SIM (arcade-core) changes need
> `npm run build:arcade-core` + an arcade-server restart to reach ONLINE play (Free Skate aliases core src).

## GIT STATE

**Current status (2026-07-13):** everything committed AND pushed — `main` in sync with origin.
Certified baseline: `npm test` (341), `npm run typecheck`, two-client smoke, all green.
Stale merged branches `DalesMajorPLan` / `arcade-hockey-game-i4zwau` are fully contained in `main`
(safe to prune).

## Feature state (everything shipped, newest last)

### Madden-style control switching
You control the highlighted skater; control follows the puck. In SOLO play, control snaps to ANY
teammate who gains possession (pass, loose puck, interception) — `resolveTeamPossessionSwitch`;
co-op teams use pass-only `resolveReceptionSwitch` so a pickup can't steal a co-op friend's body.
Pass button doubles as manual switch-to-nearest-teammate when not carrying. Determinism boundary:
the sim NEVER knows who is "controlled" — switching lives in the server roster
(`switchHumanControl`) and the Free Skate localSim closure. Client `localSlotId` is reactive off
the roster schema; App.tsx flushes the prediction buffer on slot change.
Key files: `arcade-core/src/sim/control.ts`, `ArcadeRoom.applyControlSwitches`, `game/localSim.ts`.

### Positional bot AI (heavily iterated — current shape)
Team-level role assignment (`computeTeamPlan` in `arcade-core/src/sim/ai/decision.ts`), pure +
deterministic (distance ranks, slotId tiebreak; replays stay byte-identical):
- **Offense:** carrier attacks; one mate CYCLES the high slot on a slow deterministic ellipse
  (SLOT_CYCLE_* consts — "skating to get open", drags his coverage with him); the other is a
  TRAILING POINT MAN (`holdBackTarget`): follows ~TRAIL_BEHIND(500) back of the puck, advancing to
  the offensive point (center + POINT_LINE_OFFSET 320) when the attack is deep — NOT net-camping.
- **Defense:** closest man pressures the carrier; the other two play MAN COVERAGE (goal-side
  standoff COVER_STANDOFF 140); protect-net is only a no-mark fallback.
- **Loose puck:** closer team attacks; within CONTESTED_PUCK_MARGIN(120) BOTH teams' closest race.
- **Human fills a role implicitly** — all 3 teammates ranked, bots take what's left.
- Bots get ARRIVAL damping on station roles (ease into spots, no orbiting) and only throw checks
  with momentum (speed gate in `shouldCheckCarrier`). AI constants are code-level in decision.ts
  (NOT in Feel Lab) — `// TODO: fold into TUNING`.

### Arcade tactical bot AI (current 2026-07-09)
`tactics.ts` derives deterministic attack/defend/transition/loose-puck/reset context from the world
snapshot. `tendencies.ts` maps character identity to attack/support/safety/net-drive/shooter/checker,
and `positions.ts` produces bounded relative intent targets. `TUNING.ai` is live in Feel Lab.

- Offense creates separated support, safety-trail, cut, stretch, and deep-zone screen options.
  Active cuts stay full-throttle; support/safety intents settle at their targets.
- Defense ranks slot danger, goal proximity, puck access, and carrier status. Pressure follows the
  highest threat while coverage plays goal-side on the next-ranked attacker.
- Transitions and loose pucks send one racer, a support outlet, and a recovery option instead of
  three identical chases.
- Autonomous passes and shots reject occupied deterministic lanes; powerup, special, input, and
  control-switch contracts remain unchanged.
- Fresh friendly passes now assign one lane-aligned teammate to a reachable intercept on the remaining
  puck path, so the receiver does not abandon a normal pass while it is still in flight.

### NHL-style hitting (stat-driven, tiered)
`resolveChecks` in `arcade-core/src/sim/actions.ts`: attempts (B button OR right-stick UP-FLICK
when not carrying; carrier flick stays a wrist shot) open the 150ms window; graded outcomes from
`force = (speed×(0.75+0.5×align) + baseCheckForce) × powerScale × flickScale` vs thresholds scaled
by target `balance` (stat renamed from `defense`) and an anchored (braced) bonus:
bump (shove) → stumble (+possible strip) → knockdown. Whiffs lunge then stagger you
(whiffRecoveryMs 500); weak hits on braced tanks BOUNCE THE CHECKER off. Stumbling now has a real
speed penalty (stumbleSpeedMultiplier 0.55 in skater.ts). Characters plumbed into the sim:
`SkaterEntity.characterId` (mutable for roster sync only), `createWorld(seed, mode, charactersBySlotId?)`,
server syncs lobby picks at onCreate/requestStart/rematch via `applyRosterCharactersToWorld`.

### Captaincy + lobby + scoreboard
First human on a team = captain (derived from `teamJoinOrder`, never stored; survives control
switches/rematches, passes on leave). Captain picks BOT slots' characters; every human picks their
own (`client.chooseCharacterFor` + `selectCharacterForSlot` permissions; old `chooseCharacter`
message still delegates). Lobby = two team columns of COMPACT slot cards (no stat grids — stats
live in the picker below, which gets ~46vh; C + You badges; Join in column headers). Broadcast
scoreboard top-left: BLU [44px digits] clock RED.

### Visuals / identity
- **Highlights:** disc under HUMAN-controlled skaters only, in the HUMAN's identity color — local
  player is ALWAYS blue on their own screen; other humans get stable colors (sessionId order).
  Follows control switches (map built from live roster in App.tsx `highlightColorBySlotId`).
  NO gold possession ring, NO discs under AI. Free Skate: blue disc follows controlled slot.
- **Jerseys:** away is real red now (#b3132b); palette test asserts HUE distinctness (blue-dominant
  vs red-dominant), not luminance. Surname + `jerseyNumber` (per character, characters.ts) rendered
  on jersey backs via offscreen-canvas texture (`JerseyBack` in CharacterModel.tsx).
- **Body types:** `bodyScaleForCharacter` — bulk from power+balance (×0.04/pt), height up with
  power (×0.03) down with speed (×0.02). Scales the BODY group only; stick stays outside so the
  blade keeps tracking the sim puck. Zara ~1.12×/1.08×, Rook ~0.92×/0.93×.
- Blockout bodies: white helmets + BLACK smoked visor, Bauer-style skates, two-part legs,
  shortened torso. GLB pipeline still parked (`GLTF_SKATER_BODIES_ENABLED = false`).

### Puck correctness fixes (both were real bugs)
- **Local carried puck floated ahead of the blade:** TWO causes fixed. (1) Online render mismatch —
  local carrier now snaps the puck to the RENDERED (smoothed-prediction) skater's blade in
  Scene.tsx, like remote carriers. (2) **Phantom poke reach** — `bladeWorldPosition` defaulted
  nowMs=0 so `pokeUntilMs > nowMs` stayed true forever after your first poke, permanently adding
  +58 to the carry tether/release/snap. All call sites now pass `world.time.nowMs`. If a blade
  offset ever looks wrong again, CHECK nowMs PLUMBING FIRST.
- **Pass reception assist:** passes used to exceed the 760 pickup gate and sail through teammates.
  Teammate receptions use passCatchRadius 72 / passCatchMaxRelativeSpeed 1750; opponents keep
  strict gates (interceptions stay hard).

### Latest tuning pass (2026-07-07, all in Feel Lab too)
- **Goalies +20%:** lateralSpeed 624, saveReach 84, reactionDelayMs 120.
- **Slap +20%:** maxChargedShotSpeed 1980. **Passes +20%:** passSpeed 1080, passChargeSpeedBonus 456.
- **Loose-puck magnetism:** pickupRadius 60, pickupMaxRelativeSpeed 1000 (turbo=840 used to
  DEFLECT a resting puck — that was the skate-over-the-puck bug).
- Shot lift: wristLiftSpeed 660, **slapLiftSpeed 680** (was 860 — see crossbar fix below) vs
  gravity 2300, GOAL_HEIGHT 95. A shot only scores below height 77 (GOAL_HEIGHT − puck radius 18);
  top-shelf wrist ≈ crossbar; aim-down stays low.
- Emergent: skaters in a shooting lane can now catch slower wrist shots mid-flight (plays as
  tips/blocks; add a shot exception if the user dislikes it).
- Check tiers calibrated (kip-hook neutral): standstill 130 bump / cruise ~830 stumble+strip /
  turbo ~1180 knockdown / anchored knockdown threshold 1200.

### Arcade powerups — NOW LIVE (2026-07-09) — DIRECTION SHIFT
Powerups were previously "cut from the roadmap" and flagged OFF. The user reversed that: they're a
**functional, enabled-by-default arcade feature** now (`TUNING.flags.powerupsEnabled: true` in
`config/tuning.ts`; character `specialsEnabled` stays false). They spawn every 9s at 3 rink points.
The system had a latent bug — activation pushed to `world.activePowerups` but NOTHING read it — fixed
by `hasActivePowerup(world, slotId, type)` in `sim/powerups.ts`, which every sustained effect consumes.
Current pool (6), all in `config/powerups.ts` + effects across the sim:
- **speed-boost** — instant velocity kick + turbo fill AND sustained ×1.25 top-speed/accel for 3.6s
  (`SPEED_BOOST_MULTIPLIER` in skater.ts; flag read in world.ts step loop).
- **hard-shot** — ×1.35 shot speed for 4.3s (`HARD_SHOT_MULTIPLIER` in puck.ts `releaseGestureShot`).
- **freeze** — ice-blocks a **deterministically random opponent** (seed-based pick, replay-safe) for 5s
  and pops their puck. New `"frozen"` contactState (skater.ts hard-locks it; `recoverContactStates`
  thaws it). `freezeRandomOpponent` in powerups.ts.
- **bulldozer** ("Big Hit") — ×2.5 check force AND any contact = knockdown, no bounce-off, for 4s
  (`BULLDOZER_FORCE_MULTIPLIER` in actions.ts `resolveHit`).
- **mini-goalie** / **giant-goalie** — shrink the ENEMY goalie (×0.45, 8s) / grow YOUR OWN goalie
  (×2.2, 10s). Single source of truth `goalieSizeMultiplier(world, goalieTeamId)` in goalie.ts scales
  BOTH the save reach (`resolveGoalieSave`) and the rendered model (`Scene.tsx` goalie group scale).
- Removed: puck-magnet, shield. Bots decide usage in `shouldUseHeldPowerup` (decision.ts).
- Client: each drop is a **themed procedural icon** (rocket/flaming-puck/snowflake/barbell/goalie-mask),
  floating + spinning, in `render/Powerups.tsx`; HUD shows friendly labels (`PowerupHud`); freeze VFX;
  freeze `"frozen"` renders a translucent ice-block in `CharacterModel.tsx`.

### Banana peel hazard (2026-07-09)
NOT a held/thrown powerup — a **hazard that spawns on the powerup cadence** (every 3rd spawn, via
`isBananaSpawn` in config/powerups.ts) and rests on the ice. First skater to skate within
`BANANA_TRIP_RADIUS` wipes out (full knockdown + drops puck); peels rot after `BANANA_LIFETIME_MS`.
New `world.bananaPeels` array (types.ts) rides the existing full-world snapshot — no server schema
work. Logic in `stepBananaPeels` (powerups.ts, gated by powerupsEnabled). Rendered flat as a yellow
C-curve in `render/Powerups.tsx` (`BananaPeels`); "Slip!" VFX.

### Skater posture + striding legs (2026-07-09)
Fixed a backwards lean (SIGN bug: body authored facing +Z inside the +90° forward correction, so
POSITIVE pitch = lean toward travel; turbo/shot/check poses were authored negative). `skaterPose` in
`CharacterModel.tsx` now leans forward with a baseline crouch that deepens with effort, hinged at the
hips (`HIP_PIVOT_Y`, not the ice) with the stick-arm shoulders following the pitch. Legs now STRIDE:
a `useFrame` scissor/lift/kick cycle whose cadence tracks the skater's real sim speed (threaded via a
new `speed` prop from `SkaterDebug.tsx`), easing in above `STRIDE_MIN_SPEED` and back to the glide
stance when coasting; per-skater random phase (render-only, sim untouched). Tuning consts `STRIDE_*`.

### Slapshot crossbar fix (2026-07-09)
Every neutral slapper clanged the bar: a shot only scores below height 77 (GOAL_HEIGHT 95 − radius 18),
but a neutral full slap with `slapLiftSpeed 860` peaked ~83. Dropped to **680** → neutral slap peaks
~52 (one-timers ~69), scores clean; aiming UP is now what risks the bar for top-shelf. A slap is
HARDER (faster) not loftier — the gestures-test invariant was updated to match, plus a puck regression
test asserts a neutral full slap stays under the scoring ceiling.

### Arcade AI positioning (implemented; playtest follow-up)
Implemented through WO-AI-05. The older plan prose below is historical context; the remaining work is
Free Skate feel tuning and browser playtesting of spacing, screens, defensive threat weights, and
lane-block radius.

### Arcade AI positioning plan (approved, not implemented)
The next feature track is a larger shared-core bot AI rework for arcade-style hockey intelligence:
hybrid human support plus independent team play, fluid role tendencies, bounded awareness, situational
defensive pressure, and autonomous passes/shots when the opportunity is clear. The approved design is
`docs/superpowers/specs/2026-07-09-arcade-ai-positioning-design.md`; the execution plan is
`docs/superpowers/plans/2026-07-09-arcade-ai-positioning.md`.

Seven active work orders now break the work into tactical context, role tendencies/spacing, offensive
movement, defensive positioning, transitions/loose pucks, autonomous actions, and final tuning. Start
with `docs/workorders/WO-AI-00-tactical-context.md`, then follow the dependency sequence in
`docs/workorders/README.md`. This work is deliberately not implemented yet.

## Controls (current)
Gamepad: Left stick skate, **Right stick = skill stick** (up-flick = wrist shot with puck, HIT
attempt without; pull back + flick = slap), **A / RT / R2 = pass (hold to charge) / manual switch
when not carrying**, B/X = body check, RB poke, LB dive, L3 hustle.
Keyboard: WASD move, IJKL/mouse stick, Space simple shot, F pass, G check, R poke, V dive, Shift turbo.
Shots auto-aim at the net; LEFT stick at release places them (sides/high/low).

## Known next steps / open questions
- **New active AI work-order track:** start with `docs/workorders/WO-AI-00-tactical-context.md` and
  follow the sequence in `docs/workorders/README.md`. The full design and implementation plan are
  `docs/superpowers/specs/2026-07-09-arcade-ai-positioning-design.md` and
  `docs/superpowers/plans/2026-07-09-arcade-ai-positioning.md`.
- **Historical work orders:** the older `WO-00` through `WO-06` files in `docs/workorders` describe
  the original prototype/Street conversion track. They are reference-only and must not be used as
  instructions for the next AI coding session; current AI code belongs in `packages/arcade-core`.
- **User feel passes owed** on the whole 2026-07-09 batch: powerup strengths/durations (all named
  consts), goalie resize factors, banana trip radius/lifetime, forward-lean depth + stride cadence
  (`STRIDE_*`), slap lift 680, and the pickup-icon look (procedural in `render/Powerups.tsx`). Also
  still owed from prior sessions: offense shape, hitting tiers, body types, jersey text, highlight discs.
- **Powerup constants** are code-level named consts, NOT in Feel Lab yet — fold into TUNING if the
  user wants to live-tune them. Character `specials` system is still dormant (`specialsEnabled: false`).
- **Puck-carrier cue:** gold possession ring was removed by request. If the user misses knowing who
  has the puck (esp. on defense), add a subtle non-identity cue.
- **Online with a friend:** works via cloudflared quick tunnels (done live once):
  tunnel 2567 → wss URL, rebuild client with VITE_ARCADE_WS_URL=that URL, tunnel 5173 with
  `--http-host-header localhost:5173`, share the https link. cloudflared.exe sits in an old session
  scratchpad — re-download if needed. A real deploy (Fly/Render + Vercel/Netlify, WS URL derived
  from window.location) is the durable answer and still owed.
- **Zombie lobby sessions:** reloading without a clean leave can leave a "Player" slot occupied
  for ~a minute until Colyseus reaps it. Harmless; reconnect-grace tweak possible.
- **GLB roster pipeline** still parked. Optional: rip out dormant `selectedTargetSlotId` +
  TargetIndicator HUD ("Target: Auto" chip is dead UI).
- AI constants into TUNING/Feel Lab if AI feel iteration continues.

## Working style that's been effective
Small change → typecheck + tests green → commit per feature with a WHY-focused message → push
(user expects push after every accepted change) → restart arcade-server if arcade-core changed →
user eyeballs on localhost:5173. Plan mode + AskUserQuestion for big features (control switching,
hitting, UI overhaul all went through approved plans). When a test breaks from an intended change,
fix the test to the new behavior; when a "visual bug" is reported, look for a SIM cause first
(the floating puck was phantom poke reach, not rendering). The user reports feel issues in plain
words — translate to the specific constant/formula, cite the numbers back, and leave knobs
discoverable (Feel Lab or named consts).
