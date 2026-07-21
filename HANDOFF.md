# 3v3 Arcade Hockey — Session Handoff

Paste the **Paste Into Next Chat** section into a new chat to continue. This top section is
authoritative as of 2026-07-21; historical notes below may describe older checkpoints.

## Paste Into Next Chat

Continue work in `C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey` on `main`.
Read `HANDOFF.md` first. Work only in `packages/arcade-core`, `packages/arcade-server`, and
`packages/arcade-client`; `packages/shared`, `packages/server`, and `packages/client` are legacy
reference code and must not be modified. Use `npm.cmd` in PowerShell.

**NEXT TASK — IMPLEMENT MUSIC (user-approved 2026-07-21).** Do not research the lineup again;
the user has approved these 15 Pixabay tracks. Download the official MP3s, retain each Pixabay
license/download record in the repository, and wire them into the existing client music system
without replacing the shipped announcer voice. Use a non-repeating shuffle that never immediately
repeats a track. Keep audio preferences/sliders working.

- **Regular match rotation:** Steel Grit (Sports Rock Background), 342 Maxed Out (The Action
  Rock), Full Blast (Energetic Sport Rock), Motivation Sport Rock Trailer, Action Rock, On My
  Way (Cool Rock Background), Shout It (Sports Rock), Motivation Epic Rock.
- **High-intensity rotation:** Power Drive Extreme Sports, Bringing Thunder (The Cool Rock
  Background), Sports Energetic Metalcore. Use these for overtime, power plays, and late close
  games; Power Drive is specifically user-approved for high-intensity moments.
- **Menu/lobby/intermission/postgame rotation:** Cool Old School – Classic Boom Bap Hip-Hop,
  Delinquente Hip Hop Old School Instrumental, Positive Hip Hop, Hip Hop Old School.

Source links (download only from official Pixabay):
`https://pixabay.com/music/rock-steel-grit-sports-rock-background-457395/`,
`https://pixabay.com/music/rock-342-maxed-out-the-action-rock-442304/`,
`https://pixabay.com/music/rock-full-blast-energetic-sport-rock-457401/`,
`https://pixabay.com/music/rock-motivation-sport-rock-trailer-478796/`,
`https://pixabay.com/music/rock-action-rock-15038/`,
`https://pixabay.com/music/rock-on-my-way-cool-rock-background-457389/`,
`https://pixabay.com/music/rock-shout-it-sports-rock-454151/`,
`https://pixabay.com/music/rock-motivation-epic-rock-111444/`,
`https://pixabay.com/music/rock-power-drive-extreme-sports-123406/`,
`https://pixabay.com/music/rock-bringing-thunder-the-cool-rock-background-449653/`,
`https://pixabay.com/music/metal-sports-sports-energetic-metalcore-521530/`,
`https://pixabay.com/music/beats-cool-old-school-classic-boom-bap-hip-hop-483600/`,
`https://pixabay.com/music/beats-delinquente-hip-hop-old-school-instrumental-tristu-13589/`,
`https://pixabay.com/music/beats-positive-hip-hop-184768/`, and
`https://pixabay.com/music/beats-hip-hop-old-school-208627/`.

**LATEST SHIPPED FEATURE — four-sided arena crowd (2026-07-21).** The rink now sits inside a
procedural arena bowl: four raked stands, corner concourses, outer floor, dark enclosing wall,
aluminum rails/aisles, emissive light-bank fixtures (no new scene lights), and ~1,550 deterministic
seeded fans (instanced; ~18 added draw calls full detail / ~14 reduced). Crowd reacts ONLY to
goals (2.5s two-pulse celebration + synthesized roar) and knockdowns (0.8s pop + short cheer);
goal outranks knockdown; first-observed event queues are seeded as seen so mount/reconnect never
replays cheers. Crowd audio rides a sub-gain under gameplayGain (Gameplay slider governs it).
Key files: `render/arenaLayout.ts`, `crowdGeneration.ts`, `crowdReaction.ts` (pure + tested),
`ArenaShell.tsx`, `Crowd.tsx`, `synth.ts scheduleCrowdCheer`, mounted in `Scene.tsx`. Internal
`detail="reduced"` input exists (no UI). Spec/plan:
`docs/superpowers/specs/2026-07-21-four-sided-arena-crowd-design.md`,
`docs/superpowers/plans/2026-07-21-four-sided-arena-crowd.md`. Verified: typecheck, 227 core +
95 server + 228 client tests, production build, clean Free Skate mount (no console errors).
**USER EYEBALLS OWED:** stands/wall look at all three camera positions, crowd variety, goal +
knockdown reactions and cheers, PerfHud before/after (assistant can't render WebGL headlessly).
Known accepted quirk: the far arena wall may clip at extreme puck positions (Canvas far=3000) —
user approved; raise `far` in Scene.tsx if it ever bothers.

**PREVIOUSLY SHIPPED — host rules + unlimited overtime (2026-07-21, pushed `9330ffa`).**
Hosts can open a pre-game **Rules** panel; everyone sees it, but only the creator may choose 3/5/7/10
minutes and no-limit/3/5/7/10-goal caps. Ready states never change when rules change. Tied clocks
now enter unlimited next-goal-wins overtime, with the HUD showing `OT` / `NEXT GOAL`; rules persist
through rematch. The implementation includes server authority validation, deterministic core rules,
and client race/lifecycle handling for rapid selections and room changes. Final verification passed:
227 core, 95 server, 197 client tests. Specs/plan:
`docs/superpowers/specs/2026-07-21-host-rules-sudden-death-design.md` and
`docs/superpowers/plans/2026-07-21-host-rules-sudden-death.md`.

**AUDIO + ANNOUNCER SHIPPED (2026-07-17).** The full approved design is implemented and live:
Web Audio runtime with three localStorage-persisted sliders (Announcer/Gameplay/Music in
`SettingsOverlay`, available on every screen without pausing online play), procedural menu music
(main menu / lobby / postgame only, silent in matches and Free Skate), generated announcer voice
clips (character name + quip for goals, character + label for powerups; ogg+mp3 under
`packages/arcade-client/public/audio/`, manifest-driven, TTS fallback), and gameplay effects
(hits, saves, shots, posts, pokes, plus a speed-tracked skating scrape loop). Key files:
`src/audio/AudioManager.ts`, `announcer.ts`, `gameplay.ts`, `music.ts`, `synth.ts`,
`preferences.ts`; manual end-to-end checker `scripts/verify-arcade-audio.cjs`
(`npm run verify:arcade-audio`, needs a live dev server + Chrome).

**RAILWAY DEPLOY + SINGLE-ORIGIN HOSTING (2026-07-17, `11d3cc8` + `2478e24`):** the arcade
server now serves the built client (express.static + SPA fallback), the client self-derives
`wss://<host>` from `window.location` outside localhost, `railway.json` builds core→server→client
and honors `$PORT`, `/health` is the healthcheck. Local dev is unchanged.

**2026-07-19 BATCH:** predictive passing (`sim/passTargeting.ts` — passes lead the receiver),
tightened pass/pickup tuning, lobby readiness gating (`client.setReady`, start requires all humans
ready), lobby player names, team-aware stick controls (away-team stick flip preference,
`input/stickControls.ts` + `controlPreferences.ts`), and full team-color uniforms/headgear
(blockout + parked GLB path via `render/gltf/uniformMaterials.ts`).

**SECOND FULL AUDIT COMPLETED 2026-07-20 (this session)** over everything since `bca03de`
(~9.6k lines: audio, deploy, readiness, predictive passing, uniforms). Method: four parallel
subsystem audits (server hostile-client, sim determinism, audio lifecycle, deploy/controls/
uniforms) + baseline runs. Verified clean: new server messages are phase-gated and
permission-checked; no sim non-determinism (no Math.random/Date.now anywhere in arcade-core);
no server/localSim drift (predictive passing is shared-core; the away stick flip is applied
before both prediction and send); static serving is traversal-safe; Railway build order/port
binding correct; audio prefs corruption-safe; music screen rules match spec. All findings that
mattered were FIXED the same day in four pushed commits:

- `3713865` — the two-client smoke was silently RED since readiness gating landed (it never sent
  `client.setReady`). Smoke clients now ready up. **Lesson: no CI exists; the smoke only runs
  when someone runs it.**
- `ceff1b3` — audio lifecycle: reconnect no longer replays the ~5s retained event queue as one
  sound burst (`resetEventCursor` swallows the first snapshot's backlog); the skating loop is
  silenced on screen changes (it used to keep scraping on the main menu after exiting Free Skate
  at speed); goals now INTERRUPT an active powerup announcement (the priority queue's
  `interruptWith` was never wired in) and the announcer drain timer tracks real clip length so
  clips can't overlap. Dangling `music.menu.0` manifest entry removed (menu music is procedural;
  it 404'd every session).
- `118ff83` — readiness lifecycle: `backToLobby` clears all ready flags (stale flags let the
  creator relaunch instantly); an unready player can no longer deadlock a lobby forever — after a
  20s grace from the creator's first blocked start, the creator's retry force-starts
  (`FORCE_START_GRACE_MS`, newcomer join resets the window); the four lobby mutation messages
  share a per-session token bucket (burst 10, refill 250ms, silent drop) so one client can't
  amplify roster-rebuild broadcasts room-wide. Wall clock injectable via
  `ArcadeRoomDependencies.now` for tests.
- `6243ee7` — PerfHud and the Feel Lab TuningPanel render null outside `import.meta.env.DEV`;
  production players no longer see dev overlays (local `npm run dev` unchanged).

**KNOWN REMAINING FINDINGS (deliberately not fixed yet, low priority):**
- Predictive passing will lead a pass to a knocked-down/frozen teammate (no `contactState` filter
  in `passTargeting.ts` recipient selection) — likely turnover; add a filter if it annoys.
- Goalie-outlet 2.5s fallback re-runs the wide aim-assist cone and can bypass its lane-block
  vetting when two teammates are colinear; also skater pass hardcodes assistCosine 0.65 while
  `PASS_AIM_ASSIST_COSINE` is 0.42 (maintenance foot-gun).
- Name sanitization strips only ASCII control chars; Unicode bidi/zero-width survive (display
  spoofing only, 24-char capped).
- Reconnect restores name+ready but NOT characterId if the old slot was taken (cosmetic).
- Reconnect waits for the audio-init click; a slow player can miss the 30s ticket window —
  consider connecting in parallel with audio init.
- GLB cloned materials are never disposed (latent leak; GLB bodies still OFF via
  `GLTF_SKATER_BODIES_ENABLED = false`).
- Keyboard+gamepad merge can drop `isAccessibilityShotGesture` when the gamepad stick dominates
  (one-frame away-team shot inversion, rare).
- Away-team analog players physically flick opposite windup/release directions from home (design
  consequence of the team-aware flip — decide deliberately).
- ogg loader requires `content-type: audio/*`; `application/ogg` servers fall back to mp3.
- npm audit: 19 vulns (1 critical, 1 high) — all in the deferred vitest 4 / vite 8 /
  colyseus 0.17 major bumps. Colyseus matters more now that a public deploy exists.

### Current repository and runtime state (2026-07-20, post-audit-fixes)

- `main` in sync with `origin/main` (`6243ee7`). Verify with `git status --short --branch`
  (push after every accepted change).
- Certified this session: `npm run typecheck` clean, `npm test` 183 arcade-client + 88
  arcade-server + core suites all green, two-client smoke OK, production client build OK.

### Online perf fix (2026-07-13, `14fa2d9`) — quick play was melting CPUs

User report: Free Skate fine, Quick Match = "airplane fans". Measured cause: the server
broadcast full-world snapshots EVERY tick (62.5/s) even to idle lobbies, and the client
dispatched every snapshot + every schema patch straight into React (120+ full app re-renders/s,
each cloning the world for prediction). Fixes: idle (waiting/ended) rooms broadcast every 8th
tick only (`IDLE_SNAPSHOT_TICK_INTERVAL`, ArcadeRoom.ts); `attachArcadeRoom` coalesces both
streams to ≤1 delivery per animation frame keeping only the freshest (sessionBinding.ts).
A dev **PerfHud overlay** (top-right: fps / jank / snaps / patches / renders / heap) is mounted
in both modes — use it for any future perf claim.

### Feel batch (2026-07-13, `4ddaeee..35d30d0`, user-approved plan)

- **Knockdowns 30% harder:** `knockdownForce` 1000→1300 (actions.ts). Neutral checking tops out
  ~1180 at the turbo ceiling, so flattening now requires power 4-5, a balance<3 victim, or Big
  Hit (still unconditional). Bump/stumble/strip unchanged.
- **Powerup pickups 4x bigger** (Powerups.tsx: ICON_SCALE 6.2, ground-ring halo) — visual only,
  pickup radius 80 unchanged and now roughly matches the visual footprint.
- **Airborne puck ground shadow** (Puck.tsx `puckShadowAppearance`): blob pinned to the ice,
  shrinks/fades with height — wrist/slap lift finally reads.
- **POWERUPS NOW ACTIVATE ON PICKUP** (user decision — supersedes the held-slot description in
  the older powerups section below): skating over a drop fires it instantly; no held slot, no
  use button, `heldPowerupType`/`useHeldPowerups`/bot use-decision/`powerupUse` event all
  removed; `InputFrame.usePowerup` kept wire-tolerated-deprecated. Re-collecting an active type
  refreshes its window (never stacks). Frozen/knocked-down skaters can't trigger drops.
- **Labels renamed** (config/powerups.ts): Super Speed / Tiny Goalie / Huge Goalie (+ existing
  Hard Shot / Freeze / Big Hit).
- **Announcement banners** (ui/AnnouncementBanner.tsx, mounted in HUD + Free Skate): huge
  GOAL!!! for 2.5s, medium "<Label>!" for 2s on pickup; goal outranks; timed on the SIM clock.
- **User eyeballs owed on all five** (shadow readability, 4x size, knockdown feel, banner
  look/timing) plus the goalie-outlet check from earlier today.

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

### Goalie outlet control — COMPLETE (2026-07-13)

All three layers are live (the audit had found only WO-GOALIE-00 existed):
- **Sim (WO-GOALIE-00, was already live):** `puck.goalieCarrierId` possession on covered saves,
  `stepGoalieOutlet` aim/charge/release, 2500ms deterministic fallback (`goalieOutlet.ts`).
- **Server grants (WO-GOALIE-01, `982f5ed` + `d27367a`):** `RoomRosterSlot.controlledGoalieId`
  (replicated via schema), `selectGoalieController` picks the nearest defending human (slot-ID
  tie-break), `applyGoalieControlGrants` watches `goalieCarrierId` around each sim sub-step and
  re-points the session's buffered input. Wire slot IDs are never trusted (spoof-proof); grants
  clear on release/leave/team-move/switch/rematch/lobby; pass presses charge instead of latching
  manual switches; snapshots ack under the active entity. Free Skate mirrors it in `localSim.ts`
  (`getControlledEntityId()`).
- **Client (WO-GOALIE-02, `bbd89e0`):** active entity = `controlledGoalieId ?? slotId`; input
  frames target it; prediction suspended+flushed during goalie control; identity discs re-key to
  the goalie for ALL humans (`buildHighlightColorByEntityId` in store.ts, tested); Scene renders
  the disc under the goalie; camera already follows the covered puck at the goalie hold point.

### ⚠ Corrections to the previous handoff (found during audit)

- ~~"Goalie outlet control" was OVERSTATED~~ — **now resolved, see above.**
- Workorder `**Status**` fields in `docs/workorders/` were broadly stale; the three WO-GOALIE
  files are now corrected, others (e.g. WO-PG-00) may still lag the code — don't trust them
  over the code.

### Recommended next steps (in rough order)

1. **Add CI** (GitHub Action: `typecheck` + `npm test` + the two-client smoke). The smoke was
   silently red for a day because nothing runs it automatically — that's how the 2026-07-20 audit
   found it.
2. **User eyeballs owed:** the audio system end-to-end (music screens, announcer over a real
   goal, sliders, skating loop cutoff when exiting Free Skate), the 07-19 uniforms/predictive
   passing feel, the readiness/force-start lobby flow with two browsers, and the older goalie
   outlet + 2026-07-09 feel batch items below.
3. **Snapshot bandwidth before real strangers play** the Railway deploy: full-world snapshots are
   ~8-11 KiB at 62.5/s per client; broadcast every 2nd-3rd tick (client interpolates) or move to
   deltas.
4. Colyseus 0.17 bump (public deploy makes the nanoid advisory more relevant), then vitest 4 /
   vite 8 in the same dedicated upgrade session.
5. Pick off the "known remaining findings" list above as taste dictates (contactState filter for
   predictive passes and the reconnect/audio-init ordering are the most player-visible).
6. Optional `/code-review ultra` (user-triggered, billed) on the audit-fix commits.

Method that worked (both audits): read-first, worst-first, parallel subsystem audit agents,
regression test → fix → suite green → commit → push.

## What this project is
A 3v3 online multiplayer **arcade hockey game** with grounded core physics (NHL-Threes-style skating,
checking, puck feel) and **NHL-style skill-stick controls** (right stick = puck control). Browser
game: TypeScript, Three.js + react-three-fiber client, authoritative Colyseus server, deterministic
shared sim.
**As of 2026-07-09 the direction moved arcade-ward:** powerups + banana-peel hazards are now LIVE and
being actively expanded (see the powerups section) — the earlier "grounded, NO powerups" framing is
superseded, though the underlying skating/checking sim stays grounded.

- **Repo:** `https://github.com/Chilldebrand/BlueBellHockey.git` (remote `origin` — THE
  destination for all pushes as of 2026-07-17; the old
  `richey1406-prog/BBellHockey.git` remains as remote `legacy-origin`, frozen)
- **Working dir:** `C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey`
- **Active branch:** `main`
- **Game lives in `packages/arcade-core` (sim), `arcade-server` (Colyseus), `arcade-client` (React/Three).**
  `packages/shared|server|client` are the ORIGINAL prototype, kept read-only as a reference quarry.

## How to run
```
cd "C:\Users\hilde\OneDrive\Desktop\3V3 Hockey Files\BBellHockey"
npm run dev      # arcade server (ws://localhost:2567) + client (http://localhost:5173)
npm test         # all configured workspace tests
npm run test:arcade  # active arcade-core / arcade-server / arcade-client tests
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

**Current status for next chat (2026-07-20):** everything committed AND pushed — `main` in sync
with `origin/main` at `6243ee7` (audit-fix batch: smoke readiness, audio lifecycle, lobby
readiness lifecycle, prod dev-tool gating). Certified: typecheck, full test suite, two-client
smoke, production client build — all green this session.

**Older status (2026-07-13):** certified baseline `npm test` (341), typecheck, smoke all green.
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
