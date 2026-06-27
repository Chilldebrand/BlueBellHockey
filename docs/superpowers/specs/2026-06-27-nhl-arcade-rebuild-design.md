# NHL Arcade Rebuild Design

## Status

Approved design direction for a ground-up rebuild of the hockey game as a multiplayer-first, browser-based spiritual remake of the reference video:

`3 on 3 NHL Arcade Longplay (Xbox 360 Version) - Difficulty: Hard`

The reference video was reviewed across its full 12:11 runtime using downloaded storyboard frames and local video artifacts. The target is not to copy NHL branding, real teams, real player likenesses, or protected assets. The target is to match the playable feel, camera language, character proportions, menu flow, and arcade hockey presentation as closely as practical with original content.

## Goal

Build a new online-first 3v3 arcade hockey game from the ground up. The rebuild should prioritize multiplayer architecture from day one while delivering a close visual and gameplay match to the reference:

- big-headed bespoke stylized hockey characters
- compact rink and high diagonal puck-follow camera
- fast, readable hockey-first gameplay
- hard checks, rebounds, quick shots, goalie scrambles, turbo, targeting, powerups, and specials
- simple score/time HUD and short arcade callouts
- frosty console-arcade menus, team select, character select, win splash, and postgame stats

The current codebase can be mined for useful ideas and lessons, but the new game should not preserve existing gameplay systems by default. Anything that does not serve the reference target should be removed, deferred, or treated as an optional future modifier.

## Reference Observations

The video shows a clean console-arcade game rather than a dense hockey sim or trick-combo sports game.

- The camera is a high diagonal/isometric view that keeps the puck, nearby skaters, and both net-front scrambles readable.
- Characters have oversized heads, compact bodies, clear red/blue uniforms, and silhouettes that read from far away.
- The rink is bright, icy, compact, and uncluttered, with strong boards, glass, a bold center logo, and a small top-left score/time HUD.
- Gameplay is hockey-first: quick passing, quick shots, rebounds, loose-puck battles, large checks, goalie saves, and faceoff resets.
- Presentation is simple but complete: splash screens, frosty panels, team select, player/stat screens, controller prompts, win splash, and postgame rankings.

## Product Target

The rebuild should be a faithful original arcade hockey game. It should feel like the reference within seconds:

- 3v3 skaters plus goalies
- short arcade matches
- immediate controls
- fast skating with glide
- simple but punchy contact
- readable puck possession and loose-puck scrambles
- easy-to-read goals, saves, checks, powerups, and special moments

The game should use original teams, logos, characters, uniform designs, names, and specials. No NHL team marks, real player names, real player likenesses, or copied UI/art assets should be used.

## Architecture

Use a clean multiplayer-first architecture with four layers.

### Shared Game Core

A pure TypeScript game core owns the deterministic hockey rules:

- rink dimensions
- player movement
- turbo state
- puck physics
- possession
- passing
- shooting
- checking
- knockdowns and recovery
- powerups
- character specials
- goalie decision inputs and save outcomes
- scoring
- periods and match state

The core should be usable by the server and by the client for prediction where appropriate.

### Authoritative Server

The server owns truth:

- rooms
- private room codes
- quick match
- team and character slots
- bot fill
- fixed simulation ticks
- input validation
- powerup spawns and pickups
- special activation
- scoring
- match end
- snapshots
- one-shot events

Clients send compact input frames. The server decides what happens.

### Client Renderer

The client renders:

- high diagonal gameplay camera
- arcade rink and arena
- bespoke skater and goalie characters
- animation state
- puck and effects
- HUD
- menus
- team select
- character select
- postgame screens

The client should predict local movement where safe, interpolate remote skaters, and reconcile against authoritative snapshots.

### Asset And Design System

Art and gameplay identity should be data-driven:

- character roster definitions
- stats
- specials
- team palettes
- uniforms
- animation clip names
- camera presets
- powerup definitions
- UI theme tokens
- sound cue definitions

This keeps the reference-match work from becoming hardcoded across gameplay files.

## Gameplay Design

The first version should be hockey-first arcade gameplay, not a Street-style combo game.

### Controls

The first-class control set is:

- move
- pass
- shoot
- check
- turbo/sprint
- switch/assist target
- powerup pickup/use
- character special

Keyboard/mouse and gamepad should both be supported. Gamepad should be treated as the primary design target because the reference is a console arcade game.

### Skating

Skating should be fast, chunky, and readable:

- responsive acceleration
- visible glide
- broad arcade turns
- no stamina simulation
- turbo as a short arcade burst or recharge/cooldown state
- turbo creates breakaways but reduces handling enough that defense remains viable

### Puck And Possession

Possession should be forgiving but not sticky:

- loose pucks can be picked up within stick reach
- carried puck should remain readable from the high camera
- checks and poke-like contact can knock the puck loose
- rebounds should stay playable
- board and net-front scrambles should be common

### Passing

Passing should be fast and assisted:

- pass toward the aimed direction
- selected assist target biases pass selection
- teammate targeting should feel console-like
- pass strength can be simple at first, then tuned
- one-timers should be supported once shooting is stable

### Shooting

Shooting should emphasize arcade clarity:

- quick wrist shot
- stronger charged shot or slap shot
- one-timer support
- posts, rebounds, glass, and goalie deflections
- visible shot windup for stronger shots

### Checking

Checks are legal by default:

- carrier checks knock the puck loose
- heavy checks can knock skaters down
- off-puck checks can stumble or knock down but should not trigger penalties
- collisions should be short, readable, and recover quickly

### Goalies

Goalies should be simple but expressive:

- crease-bound movement
- lateral slide
- pad save
- glove save
- blocker save
- body save
- cover/freeze
- rebound on hard shots

Goalie visuals should be bespoke from the start, with oversized goalie pads, blocker, glove, mask, and goalie stick.

### Target Switching And Assist Target

Switch/assist target should serve both solo and multiplayer play:

- on offense, bias passes and one-timers toward the selected teammate
- on defense, choose a sensible defender or mark target
- in solo/undermanned play, allow control switching among available skaters
- in multiplayer, never let one human take control of another human's assigned skater

### Powerups

Powerups are server-authoritative rink pickups:

- speed boost
- hard-shot boost
- goalie freeze
- puck magnet
- shield
- instant special charge

Powerups should have obvious rink visuals and short, readable effects.

### Character Specials

Each bespoke character has one hockey-flavored special:

- super shot
- heavy check
- speed burst
- goalie breaker
- magnet stick
- team pass boost
- defensive wall
- rebound storm
- net-front screen
- precision one-timer

Specials should create dramatic moments without becoming long ability chains.

## Character And Animation Direction

Bespoke stylized hockey characters are required from the start.

### Roster

Initial roster target:

- 10 to 12 original arcade hockey characters
- distinct silhouette for every character
- big-head proportions
- compact bodies
- exaggerated hockey gear
- unique special per character
- balanced stat profiles

Team uniforms should recolor jersey, pants, and socks while character-specific gear remains recognizable.

### Asset Pipeline

Define a repeatable character pipeline:

- concept sheet
- model spec
- rig spec
- texture/material rules
- animation clip contract
- export naming
- import validation
- character select preview

Temporary blockout models are acceptable only as short-lived implementation scaffolding. The first production milestone should include at least one bespoke skater and one bespoke goalie.

### Animation Set

Required skater animations:

- idle ready stance
- forward skate
- hard turn/lean
- turbo skate
- pass
- wrist shot
- charged shot/slap shot
- check
- stumble
- knockdown
- get-up
- light juke/evasive move
- goal celebration

Required goalie animations:

- ready stance
- lateral slide
- pad save
- glove save
- blocker save
- body save
- cover
- reset to ready

Animations should be short, snappy, and readable from the high camera.

## Rink, Camera, HUD, And Presentation

### Rink

The rink should match the reference's readable arcade look:

- compact hockey surface
- bright ice
- strong red/blue team contrast
- clean boards and glass
- bold center logo
- visible net-front areas
- arena bowl that frames the action without clutter

No Street/graffiti visual direction in the core theme. Alternate arena themes can come later.

### Camera

The camera is a signature feature:

- high diagonal/isometric angle
- puck-following
- zoomed far enough for 3v3 readability
- subtle punch-in near goals, big hits, and specials
- no frequent cinematic cutaways during live play
- always preserve input readability

### HUD

In-game HUD should be minimal:

- top-left score/time panel
- team colors/icons
- player control indicators
- possession indicator
- turbo indicator
- special indicator
- held powerup indicator
- short callouts for goal, save, big hit, powerup, and special ready

### Presentation Flow

The complete arcade flow is part of the product:

- boot/splash screen
- frosty main menu
- quick match/private room
- team select
- character select with stats and specials
- controller/control prompt
- faceoff intro
- match
- win splash
- postgame stats/rankings
- rematch/back to lobby

The UI should feel icy, glossy, and console-arcade. Avoid modern dashboard layouts and dense app cards.

## Multiplayer Design

Multiplayer architecture is the top priority.

### Room Flow

Core flow:

1. Player opens the game.
2. Player chooses quick match or private room.
3. Player joins lobby.
4. Player chooses team.
5. Player chooses character.
6. Server fills empty skater slots with bots.
7. Server starts match only with a valid roster.
8. Server owns match simulation and result.
9. Clients see win splash and postgame.

### Room Model

One room owns one lobby plus its active match:

- 1 to 6 human players
- bot fill for empty skater slots
- server AI goalies
- private room codes from the first playable version
- spectators deferred
- reconnect/resume best effort after core loop works

### Player Control Model

- each human controls one skater at a time
- multiple humans on a team keep separate controller identity indicators
- bots control only unassigned skaters
- solo and undermanned teams can switch among available bot skaters if the mode allows it
- goalies are not manually controlled in the first version

### Network Model

- client sends compact input frames
- server runs fixed tick simulation
- server validates input ownership and timing
- server broadcasts snapshots and one-shot events
- client interpolates remote skaters
- client predicts local movement and low-risk puck movement
- client reconciles to authoritative snapshots

The first network milestone is two tabs joining one room, selecting sides/characters, spawning into a 3v3 bot-filled match, and seeing the same goals/checks/powerups.

## Phased Build Plan

Every milestone must preserve multiplayer flow. No milestone should become a single-player-only prototype.

### Phase 1: Foundation

- clean game-core/server/client boundaries
- room lifecycle
- private room code
- input messages
- fixed server tick
- snapshots
- two-tab join
- bot-fill stubs

### Phase 2: Playable Hockey Slice

- compact rink
- 3v3 spawn
- skating
- puck possession
- pass
- shoot
- check
- temporary goalie implementation with a clear path to bespoke goalie art and animations
- scoring
- faceoffs
- match clock
- win condition

### Phase 3: Reference Camera And HUD

- high diagonal camera
- puck-follow framing
- top-left score/time
- player indicators
- possession indicator
- simple goal/save/hit callouts

### Phase 4: Bespoke Character Pipeline

- character art spec
- first bespoke skater
- first bespoke goalie
- rig and animation contract
- uniform recolor rules
- character preview/import validation

### Phase 5: Full Roster And Animation Set

- 10 to 12 original characters
- full stat/special definitions
- skater animation set
- goalie animation set
- character select preview

### Phase 6: Turbo, Targeting, Powerups, Specials

- turbo meter/cooldown
- switch/assist target
- rink pickups
- held powerup state
- character special activation
- server-authoritative special effects

### Phase 7: Menus And Arcade Presentation

- boot splash
- frosty main menu
- quick match/private room UI
- team select
- character select
- controller prompt
- faceoff intro
- win splash
- postgame stats/rankings
- rematch/back to lobby

### Phase 8: Tuning And Online Hardening

- prediction/reconciliation polish
- latency handling
- bot behavior
- goalie fairness
- powerup balance
- special balance
- performance
- reconnect/resume
- full tests and manual multiplayer smoke checks

## Testing Strategy

Testing should be built into each phase:

- shared game-core unit tests for deterministic rules
- server room tests for roster, input ownership, scoring, and match state
- client interpolation/prediction tests
- snapshot contract tests
- asset validation tests for character definitions and animation clip names
- manual two-tab smoke tests for every playable milestone

Key acceptance tests:

- two clients see the same puck, score, clock, goals, powerups, and match result
- a client cannot control another human's skater
- bot fill creates a valid 3v3 match
- turbo is server-authoritative and cannot be spammed
- powerups spawn, pick up, expire, and apply only on the server
- specials validate charge/cooldown/ownership on the server
- scoring and faceoff reset are deterministic
- goalie save outcomes sync to all clients
- postgame stats match authoritative server stats

## Non-Goals

- Do not copy NHL branding, team names, logos, uniforms, or player likenesses.
- Do not preserve existing Street/Gamebreaker/combo systems as core gameplay.
- Do not build a single-player-only prototype first.
- Do not add deep simulation systems such as stamina, line changes, penalties, or franchise/team management.
- Do not make visual polish a late afterthought; bespoke characters and arcade presentation are core requirements.
- Do not let client-side prediction decide authoritative scoring, powerups, specials, or goalie saves.

## Open Tuning Points

- final roster size: 10 or 12 characters
- turbo duration, recharge, and handling penalty
- pass assist cone and selected-target weighting
- shot charge timing and maximum shot speed
- check range, knockback, and knockdown thresholds
- goalie reaction speed and save reach
- powerup spawn cadence and allowed overlap
- special charge model and cooldowns
- camera angle, zoom, and punch-in strength
- HUD indicator placement for turbo, special, and held powerup
- match length and default win condition

## Approval Notes

The user approved:

- Approach C: full new architecture rather than preserving the current gameplay code.
- Multiplayer architecture as the priority.
- Bespoke stylized hockey characters from the start.
- Reference-like gameplay with turbo/sprint, switch/assist target, powerups, and specials included in the core plan.
- Reference-like rink, camera, HUD, menus, and postgame presentation.
