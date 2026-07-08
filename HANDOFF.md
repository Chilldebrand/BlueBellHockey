# 3v3 Arcade Hockey — Session Handoff

Paste this into a new chat to continue. Captures full state as of the end of the last session (2026-07-07).

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
npm test         # 263 tests (147 arcade-core / 45 arcade-server / 71 arcade-client)
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
**Everything is committed AND pushed** — clean tree, `main` in sync with origin.
All green: `npm test` (263), `npm run typecheck`, smoke.

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
- Shot lift (earlier fix): wristLiftSpeed 660, slapLiftSpeed 860 vs gravity 2300, GOAL_HEIGHT 95 —
  top-shelf wrist ≈ crossbar; aim-down stays low.
- Emergent: skaters in a shooting lane can now catch slower wrist shots mid-flight (plays as
  tips/blocks; add a shot exception if the user dislikes it).
- Check tiers calibrated (kip-hook neutral): standstill 130 bump / cruise ~830 stumble+strip /
  turbo ~1180 knockdown / anchored knockdown threshold 1200.

## Controls (current)
Gamepad: Left stick skate, **Right stick = skill stick** (up-flick = wrist shot with puck, HIT
attempt without; pull back + flick = slap), **A / RT / R2 = pass (hold to charge) / manual switch
when not carrying**, B/X = body check, RB poke, LB dive, L3 hustle.
Keyboard: WASD move, IJKL/mouse stick, Space simple shot, F pass, G check, R poke, V dive, Shift turbo.
Shots auto-aim at the net; LEFT stick at release places them (sides/high/low).

## Known next steps / open questions
- **User feel passes owed** on basically everything visual/AI from the last two sessions: offense
  shape (point man + slot cycling), hitting tiers, goalie-vs-shot balance after the mutual +20%,
  body types (knobs in `bodyScaleForCharacter`), jersey text size (`JerseyBack`), highlight discs.
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
