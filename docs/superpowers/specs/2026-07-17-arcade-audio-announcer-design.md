# Arcade Audio and Announcer Design

## Status

Approved design for implementation planning.

## Context

The active game is the `@bbh/arcade-client` application. It currently has visual announcements and a deterministic world-event queue, but it does not yet have an active-client audio system. The legacy client contains useful procedural Web Audio code for music, crowd ambience, horns, impacts, saves, and pickups, but that code is not connected to the active arcade client.

The active simulation already emits event data needed for sound presentation:

- `goal` events identify the scorer through `sourceSlotId`.
- `powerupPickup` events identify the skater through `sourceSlotId` and the powerup type through `targetSlotId`.
- Gameplay events include hits, knockdowns, saves, covers, shots, one-timers, posts, blocks, pokes, jostles, and bounce-backs.
- Character IDs resolve to a fixed roster of twelve named characters.

## Goals

1. Add menu-only music.
2. Add an announcer with a polished arcade voice.
3. Announce goals with funny quips and the scorer's character name.
4. Announce powerups and the character who collected them.
5. Add gameplay sounds for hits, skating, saves, and puck interactions.
6. Give each player independent local volume controls for announcer, gameplay, and music.
7. Make settings accessible from menus and during live gameplay.
8. Keep sound presentation client-local and responsive without adding separate sound network messages.

## Non-goals

- No arbitrary player-display-name voice generation. Announcer names are the fixed character names only.
- No gameplay music for the first audio pass.
- No server-wide pause behavior. The in-game settings overlay is local-only and must not pause the online match.
- No requirement for every event to receive an announcer line. Most gameplay events use effects only.

## Recommended architecture

Add an active-client audio subsystem under `packages/arcade-client/src/audio/`:

- `AudioManager.ts`: owns the browser `AudioContext`, output buses, asset loading, preferences, menu music state, event deduplication, and public playback methods.
- `announcer.ts`: resolves world events into announcer requests, selects randomized quips, resolves character names, and enforces priority/cooldown rules.
- `gameplay.ts`: plays one-shot gameplay effects and manages the local skating loop.
- `music.ts`: owns the menu-only music loop and fade transitions.
- `preferences.ts`: loads, clamps, and persists local audio preferences.

Add shared UI under `packages/arcade-client/src/ui/`:

- `AudioSettings.tsx`: renders three labeled range sliders: Announcer, Gameplay, and Music.
- `SettingsOverlay.tsx`: shared modal/overlay used by the main menu, lobby, postgame, match pause/settings, and Free Skate.

The existing `BootSplash` Press Start action will call the audio manager's initialization/start method. This satisfies browser autoplay restrictions by creating or resuming the `AudioContext` from a user gesture.

## Audio buses and preferences

The mixer has a master output plus three user-controlled buses:

1. Announcer
2. Gameplay
3. Music

The master is an internal safety/output gain and is not exposed as a fourth slider in the first pass. Each visible slider uses a normalized `0..1` value, updates live, and persists in `localStorage`. Invalid, missing, or out-of-range stored values are replaced or clamped to safe defaults.

The audio manager must remain functional when initialization is unavailable, suspended, or partially fails. A missing sound asset produces a silent sound for that request and must not throw into the render loop or gameplay simulation.

## Music behavior

After the Press Start gesture initializes audio, menu music is active on the menu/lobby/postgame UI screens. It fades out when entering a live match or Free Skate. There is no music bed during active gameplay in this release.

Music state is controlled by the app's screen/phase transitions rather than by simulation events. Re-entering a menu fades music back in without creating duplicate schedulers or audio graphs.

The legacy procedural music implementation may be adapted for the first menu track. The system should keep its asset boundary open so a future authored track can replace it without changing UI or gameplay code.

## Event-to-sound mapping

The client consumes new world events from `WorldState.eventQueue`. Since snapshots repeat recent events, the audio manager tracks event IDs and presents each event at most once. Old IDs are pruned so the set remains bounded.

| Event | Presentation |
| --- | --- |
| `goal` | Goal horn, crowd burst if available, and a prioritized announcer quip with the scorer's character name. |
| `powerupPickup` | Pickup stinger and announcer line naming the powerup and collecting character. |
| `hit` | Body-impact sound scaled by event force. |
| `knockdown` | Larger impact plus skid/fall sound. |
| `save` | Gameplay sound selected from `detail`: pad, body, glove, blocker, or cover. |
| `shot` | Stick crack and puck launch. |
| `oneTimer` | Sharper, louder shot variant. |
| `post` | Metallic post ping. |
| `block` / `poke` | Short defensive puck-contact effect. |
| `jostle` / `bounceBack` | Smaller collision effects. |
| Local controlled-skater motion | Continuous skating loop with speed-driven gain and pitch. |

Gameplay sound effects are local to each client. A client may hear the replicated event presentation for the match while its skating loop follows only the locally controlled entity, avoiding a noisy six-skater sound layer.

## Announcer behavior

Announcer priority is:

1. Goal
2. Powerup pickup
3. Future special-event callouts

A goal interrupts or supersedes a lower-priority powerup callout. Gameplay effects continue underneath, with a modest gameplay-bus duck while speech plays. The announcer has a bounded queue and a short cooldown so a burst of simultaneous events cannot create an unreadable backlog.

Character identity is resolved as follows:

- Goal: `goal.sourceSlotId` -> matching skater -> `characterId` -> `ARCADE_CHARACTERS.displayName`.
- Powerup: `powerupPickup.sourceSlotId` -> matching skater -> character name; `targetSlotId` -> `POWERUP_DEFINITIONS` -> powerup label.

Voice content is data-driven. The initial pack contains twelve character-name clips, goal quip clips, and powerup announcement clips. Short compatible clips may be crossfaded or sequenced to produce lines such as:

- “Milo Ghost! Finds the twine! The goalie is requesting a map!”
- “Rook Rocket! The scoreboard is filing a complaint!”
- “Tiny Goalie! Somebody shrank the net minder!”
- “Super Speed! Tess Flash just found another gear!”

The implementation must allow new lines to be added or removed through a manifest/data table rather than hard-coded event logic.

## Settings access and interaction

Settings is a local overlay available from:

- Main menu
- Lobby
- Postgame
- In-game match overlay
- Free Skate

The Boot Splash provides the Press Start gesture that initializes audio; the first settings control appears after entering the main menu.

The in-game overlay is opened by a visible Settings control and the `Escape` key where keyboard input is available. It does not pause or alter the online match. Opening and closing it must not recreate the audio context or reset volume preferences.

Controls need accessible labels and keyboard-operable range inputs. Slider changes should be reflected immediately in the corresponding bus.

## Asset layout

Use an explicit public asset boundary under `packages/arcade-client/public/audio/`, with logical IDs resolved by a manifest. The initial categories are:

- `announcer/names/`
- `announcer/goals/`
- `announcer/powerups/`
- `gameplay/hits/`
- `gameplay/skating/`
- `gameplay/saves/`
- `gameplay/puck/`
- `music/menu/`

The code should support authored `.ogg`/`.mp3` assets and procedural effects behind the same logical playback API.

## Data flow

1. `BootSplash` Press Start initializes/resumes the audio manager.
2. App screen/phase changes tell the audio manager whether menu music is allowed.
3. Each fresh online world snapshot or local-simulation world update is inspected for new event IDs.
4. New events are mapped to gameplay effects and, when applicable, announcer requests.
5. Roster and character config resolve slot IDs into character display names.
6. The audio manager schedules sounds on the correct bus using current local preferences.
7. Settings slider changes update bus gain and persist locally.

The server and deterministic simulation remain responsible for gameplay state only. Audio must not affect simulation timing, prediction, replay determinism, or server authority.

## Verification plan

Unit tests should cover:

- Preference defaults, clamping, persistence, and malformed storage.
- Event-ID deduplication.
- Goal-over-powerup announcer priority.
- Character and powerup label resolution.
- Announcer queue bounds and cooldown behavior.
- Screen transitions enabling music only in menus.

Browser smoke verification should cover:

- Press Start creates/resumes the audio context without errors.
- Each slider changes its bus immediately.
- Preferences survive refresh.
- Music plays in menu/lobby/postgame and stops entering gameplay/Free Skate.
- Goal, powerup, hit, save, and puck events trigger sounds once.
- Skating sound responds smoothly to local speed.
- Settings opens during a live match without pausing or disrupting the match.
- Missing audio assets fail silently without console errors.

Manual feel QA should check mix balance on speakers and headphones, rapid goal/powerup sequences, repeated hits, save variants, and whether skating remains noticeable without becoming tiring.

## Scope boundary for implementation planning

The first implementation plan should cover the audio manager, preferences, settings overlay, menu music, event-driven gameplay effects, announcer resolution/queueing, the initial asset manifest, tests, and browser smoke verification. Voice asset creation can proceed in parallel as a content task, provided the filenames and manifest IDs remain stable.
