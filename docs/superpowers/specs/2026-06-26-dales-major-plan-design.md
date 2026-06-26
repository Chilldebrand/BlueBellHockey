# Dale's Major Plan: Arcade Hockey Gameplay Feel

## Status

Approved design for a coordinated gameplay-feel pass on the current arcade hockey mode.

This document is intended as a reference branch plan for `DalesMajorPLan`. It describes intended behavior and implementation boundaries, but does not implement the changes.

## Goal

Improve the moment-to-moment feel of skating, puck interaction, goal collisions, passing, poke checking, and shooting without rewriting the whole game. The work should make controls more readable, reduce stuck or glitchy interactions, and make hockey objects behave more physically while keeping the arcade pace.

## Recommended Approach

Use a gameplay interaction layer that gives explicit rules to interactions between skaters, sticks, puck, goal frames, boards, glass, passing, and shooting.

This should be more structured than tuning scattered constants in place, but smaller and safer than a physics-first rewrite. Each interaction should have clear inputs, outputs, and testable behavior.

## Scope

### Hockey Character Roster and Outfit Direction

Replace the medieval fantasy character presentation with fictional hockey archetypes.

- Keep the current 10-character roster structure.
- Do not use real player names, team logos, or direct player likenesses.
- Use famous hockey play styles only as inspiration for fictional characters.
- Give every archetype readable hockey gear and silhouette details that sell the role.
- Keep every character balanced to the current 38-point total stat budget.
- Each archetype should have one or two standout strengths and one or two real weaknesses.
- No archetype should be strictly better than another.
- Use the existing `hit` stat as both checking power and body strength/balance resistance.

The target fictional roster is:

- Sniper: elite quick-release shooter with weaker physical play.
- Heavy Hitter: contact-first enforcer who knocks pucks and players loose.
- Deke Artist: fast, flashy puck-control specialist with lighter contact.
- Playmaker: passing and lane-creation specialist.
- Lockdown Defender: reach, poke checks, shot blocks, and positioning.
- All-Around Star: balanced captain type with no major weakness and no elite peak.
- Power Forward: net-crasher with strength and a heavy shot.
- Two-Way Pest: disruptive forechecker who steals, pressures, and scores gritty goals.
- Slap Shot Cannon: big windup, huge shot, and high glass/post danger.
- Wild Card Defender: awkward, chaotic, high-effort blocks and loose-puck disruption.

### Human Control Rings and Uniform Color Selection

Human-control rings and team uniform colors are separate visual systems.

Control rings should identify human controllers only.

- Rings are only for human-controlled skaters.
- AI and bot skaters should have no control ring.
- Ring color is assigned by human join order, not team, jersey, archetype, or skater slot.
- Player 1 uses red: `#ff3030`.
- Player 2 uses blue: `#2878ff`.
- Player 3 uses green: `#21d96b`.
- Player 4 uses yellow: `#ffd735`.
- Player 5 uses magenta: `#ff3bd4`.
- Player 6 uses cyan: `#26f0ff`.
- If a human switches controlled skaters, that human's ring moves to the newly controlled skater.
- Multiple humans on the same team should keep distinct ring colors.
- The active controlled-skater ring should be thicker, brighter, slightly larger, and easier to notice than the current highlight.
- Use subtle glow, bloom, or pulse if needed so the ring remains readable during crowded plays.

Uniform color selection should happen before starting a game.

- Add Home and Away uniform color scheme selection to the home or lobby flow before match start.
- Uniform schemes affect only jerseys and pants.
- Uniform schemes do not determine control-ring colors.
- Uniform schemes should not override archetype-specific gear details.
- Archetype-specific visuals can control sticks, gloves, helmets, visors, tape, pads, and accessories.
- A Heavy Hitter archetype may have no helmet if that look is chosen later.
- Suggested basic uniform schemes are black, red, blue, green, yellow, and white.
- The game should prevent both teams from starting with indistinguishable uniform colors, either by blocking start or by auto-adjusting Away to a contrasting fallback.

### Net and Rink Physics

Skaters should no longer get stuck on the goal frame.

- Skaters slide around the goal frame when they collide with it.
- Skaters lose speed while rubbing against or sliding along the goal.
- If a skater becomes wedged or nearly stationary against the net, apply a small outward bump to free them.
- This behavior should feel like skating around a heavy object, not bouncing off a wall.

The puck should never pass through non-scoring parts of the goal.

- A puck can score only through the front goal mouth.
- Posts and crossbar create hard rebounds, similar to a firm ball hitting metal.
- Post and crossbar impacts should play a clear metal ding sound.
- Netting, back mesh, side mesh, and outside goal surfaces create softer rebounds and absorb more puck speed.
- Puck rebounds from the goal should land back on the ice where players can recover it.
- If the puck clips through any non-scoring part of the goal, restore it to its last valid ice position and apply the correct rebound.
- After a valid goal, the puck should remain dead in the net for 2 seconds before the normal goal flow continues.

Glass should be taller both visually and physically.

- The arena glass should look higher.
- Puck collision should respect the taller glass.
- Missed shots, lifted shots, and slap shots can hit the glass and rebound into play.

### Skating and Sprint Feel

Base skating should be moderately slower than the current feel.

- Normal skating should feel a bit more controlled and less fast by default.
- Holding L3 should make sprint clearly noticeable.
- Sprint top speed should be slightly below the current maximum skating speed.
- Sprint should widen turns and reduce puck-control precision slightly.
- No stamina meter should be added for this pass.

### Stick Possession and Defensive Play

Loose-puck pickup should use forgiving stick reach.

- If the puck is loose on the ice and within typical stick range, a nearby skater should reach for it.
- The skater does not need to skate directly over the puck.
- The reach should work regardless of exact facing direction.
- This auto-pickup reach applies only to free pucks.
- If another skater has possession, passive stick reach must not steal the puck.

Poke checking should be an active defensive tool.

- RB triggers a long-reach poke check animation.
- The animation should be visually clear and slightly committed.
- Poke checks use a range check and cooldown.
- During the poke and short recovery, the skater has a small movement and turning penalty.
- A successful poke against an opponent with possession knocks the puck loose.
- A successful poke should not automatically transfer possession to the defender.

### Arcade Contact, Knockdowns, and Pileups

There should be no penalties or power plays.

- Remove penalty-box behavior from gameplay.
- A hit away from the puck should not box the hitter.
- No player should be forced off the ice for a bad hit.
- No penalty event, power play UI, penalty callout, or penalty sound should trigger from hits.
- Hits should still stagger, knock pucks loose, break combos, and contribute to style.

All hits are legal, but puck-relevant hits should be worth much more style.

- All hits can earn style.
- Hits on the puck carrier or near an active puck battle award significantly more style.
- Off-puck hits award very low style, mostly for spectacle.

Hard hits should knock players down and can create chain-reaction pileups.

- A successful hard hit should visibly knock the target to the ice.
- The downed state should last briefly, then the player gets back up and resumes play.
- Harder hits should send the target sliding farther across the ice.
- Hit impact force should use the hitter's `hit` rating, current skating speed, approach angle, and contact alignment.
- The target's `hit` rating should resist knockdowns and sliding.
- A lower-`hit` player can still knock down a stronger player, but must be moving faster and land cleaner contact.
- Glancing or low-force hits may bump, slow, or stagger without a full knockdown.
- Downed and sliding players become low obstacles for all skaters, including teammates.
- High-speed contact with a downed or sliding player can trip the moving skater and knock them down too.
- Lower-speed contact with a downed or sliding player should slow, bump, or redirect the moving skater without forcing a fall.
- Pileup contact should never create penalties.

### Passing

Passing should use the left-stick aim direction.

- Pressing pass uses the current left-stick direction as the primary pass direction.
- Passing uses best-lane priority.
- If a teammate is in the aimed cone and the lane is reasonable, the pass should assist toward that teammate.
- If no teammate has a reasonable lane in that direction, the puck should pass into open ice along the aimed direction.
- A tap pass should be soft.
- Holding pass should smoothly charge power from soft to strong over 0.5 seconds.
- Pass power caps after the 0.5 second charge.

### Shooting

Right-stick shooting should support wrist shots and slap shots as separate actions.

- Flicking the right stick up performs a quick wrist shot.
- Wrist shots should have a quick release animation and moderate power.
- Pulling the right stick back starts a slap-shot windup animation only.
- Pulling back should not fire a shot by itself.
- After pulling back, flicking the right stick up fires the slap shot.
- Slap-shot power is based on drawback distance.
- Half drawback is roughly 50 percent power; maximum drawback is 100 percent power.
- While winding up, the skater glides in the direction they were moving when windup began.
- The skater should not steer normally while wound up.
- Returning the right stick to neutral cancels the windup.
- Add a timeout safety so a skater cannot remain stuck in windup forever.
- Stronger shots should affect both puck speed and lift chance.
- Higher-power shots are more likely to rise, hit glass, hit posts or crossbar, or miss high.

### Goalie Rework

Goalies should look and behave like hockey goalies, not regular skaters parked in front of the net.

Goalie visual identity should be distinct from skater archetypes.

- Goalies should have recognizable hockey goalie pads.
- Goalie gear should include leg pads, blocker, catching glove, chest/shoulder bulk, goalie stick, and mask/helmet.
- Goalie gear should be separate from skater archetype gear.
- Uniform color schemes may affect goalie jersey and pants when goalie uniforms include those pieces.
- Goalie pads, glove, blocker, mask, and goalie stick should remain goalie-specific visual elements.

Goalie movement should feel like hockey goalie movement.

- When the puck is far or not dangerous, the goalie can stay mostly still in a ready stance.
- Goalies should track puck angle without chasing every small puck jitter.
- If the puck or puck carrier moves left or right near the net, the goalie should shift laterally to stay square.
- If a player attacks from the left or right side, the goalie should move toward that side while staying inside the crease.
- Goalies may challenge slightly forward when the puck is close.
- Goalies should not chase into open ice.
- Movement should read as shuffles, crease slides, and set positions rather than normal skater movement.

Goalie saves should use readable hockey-style reactions.

- Low shots trigger pad or butterfly saves where the goalie drops to the knees.
- Mid-height shots can hit the body or chest and rebound.
- High glove-side shots trigger glove saves or catches if the shot is slow and clean enough.
- High blocker-side shots trigger blocker deflections.
- Soft centered shots can be covered or frozen, then passed or cleared after a short hold.
- Hard saves should create rebounds.
- Save pose sync should support the visible save style so pad, glove, blocker, body, and cover outcomes read differently.

## Work Orders

> For agentic workers: work through these in order. Use TDD for behavior changes. Keep each work order independently reviewable and commit after each work order passes its listed checks.

### WO-01: Hockey Roster and Archetype Presentation

**Goal:** Replace medieval-facing character identity with fictional hockey archetypes while preserving the 10-character roster and 38-point balance rule.

**Likely files:**

- Modify: `packages/shared/src/config/characters.ts`
- Modify: `packages/shared/src/config/characters.test.ts`
- Modify: `packages/client/src/ui/CharacterSelect.tsx`
- Modify: `packages/client/src/render/CharacterModel.tsx`
- Modify: `packages/client/src/render/gear.ts`
- Modify: `packages/client/src/render/CharacterPreview.tsx`

**Steps:**

- [ ] Re-read `characters.ts`, `characters.test.ts`, `CharacterSelect.tsx`, `CharacterModel.tsx`, and `gear.ts`.
- [ ] Write or update character tests so the roster still has exactly 10 characters, every build totals 38 points, every distribution remains unique, and every archetype has at least one clear strength and one clear weakness.
- [ ] Replace character names/blurbs with fictional hockey archetypes: Sniper, Heavy Hitter, Deke Artist, Playmaker, Lockdown Defender, All-Around Star, Power Forward, Two-Way Pest, Slap Shot Cannon, and Wild Card Defender.
- [ ] Keep real player names, real team names, logos, and direct likenesses out of code and UI copy.
- [ ] Keep `hit` as both checking power and body strength/balance resistance.
- [ ] Add or structure archetype visual metadata so hockey looks can vary by role without changing team uniform colors.
- [ ] Preserve or update ultimate links deliberately so every character still references a valid unique ultimate.
- [ ] Run `npm.cmd run test --workspace @bbh/shared`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Add hockey archetype roster`.

**Acceptance:**

- Character select reads like hockey archetypes, not medieval classes.
- Roster balance tests pass.
- No archetype is strictly better than another.
- The game still supports exactly 10 selectable characters.

### WO-02: Human Control Rings and Uniform Color Selection

**Goal:** Separate human-controller identity rings from team uniform colors, and let players choose Home/Away jersey and pants schemes before match start.

**Likely files:**

- Modify: `packages/shared/src/net/messages.ts`
- Modify: `packages/server/src/rooms/MatchRoom.ts`
- Modify: `packages/server/src/rooms/state.ts`
- Modify: `packages/server/src/rooms/state.test.ts`
- Modify: `packages/client/src/store.ts`
- Modify: `packages/client/src/net/client.ts`
- Modify: `packages/client/src/ui/Lobby.tsx`
- Modify: `packages/client/src/render/Skater.tsx`
- Modify: `packages/client/src/render/gear.ts`
- Test: `packages/client/src/render/playerIdentity.test.ts`

**Steps:**

- [ ] Re-read the lobby connect flow, Colyseus state schema, client snapshot parsing, and skater rendering.
- [ ] Define player ring colors by human join order: P1 `#ff3030`, P2 `#2878ff`, P3 `#21d96b`, P4 `#ffd735`, P5 `#ff3bd4`, P6 `#26f0ff`.
- [ ] Add server-owned human controller index metadata so the ring follows the human session, not the skater slot.
- [ ] Sync the controller index to clients for human-controlled skaters; bots and goalies should expose no player ring identity.
- [ ] Update skater rendering so AI/bot skaters render no control ring.
- [ ] Update skater rendering so the human ring moves when a session switches controlled skaters.
- [ ] Make the active human ring thicker, brighter, slightly larger, and more readable than the current local-only highlight; use a subtle pulse or glow.
- [ ] Add Home and Away uniform scheme selection to the home/lobby flow before match start.
- [ ] Define basic uniform schemes: black, red, blue, green, yellow, and white.
- [ ] Store selected Home/Away uniform scheme IDs on the room and sync them to clients.
- [ ] Apply uniform scheme colors only to jerseys and pants.
- [ ] Keep sticks, gloves, helmets, visors, tape, pads, and accessories controlled by archetype visuals, not uniform schemes.
- [ ] Prevent indistinguishable Home/Away uniform selections by blocking start or auto-adjusting Away to a contrasting fallback.
- [ ] Run targeted server/client tests for room state and snapshot mapping.
- [ ] Run `npm.cmd run test`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Add human rings and uniform schemes`.

**Acceptance:**

- P1-P6 rings use the configured join-order colors.
- Bots have no ring.
- Rings are not team colors.
- Uniform colors affect jersey and pants only.
- Human ring identity survives same-team multiplayer and skater switching.

### WO-03: Net, Goal, and Glass Physics

**Goal:** Make goals and glass behave physically and prevent puck/skater clipping or sticking around the net.

**Likely files:**

- Modify: `packages/shared/src/config/rink.ts`
- Modify: `packages/shared/src/sim/physics.ts`
- Modify: `packages/shared/src/sim/puck.ts`
- Modify: `packages/shared/src/sim/world.ts`
- Modify: `packages/shared/src/sim/world.test.ts`
- Modify: `packages/client/src/render/Rink.tsx`
- Modify: `packages/client/src/audio/sfx.ts`

**Steps:**

- [ ] Re-read current net collision helpers, puck step logic, goal detection, and rink rendering.
- [ ] Write failing tests for skaters sliding around the goal frame, slowing on contact, and receiving a small escape bump only when wedged.
- [ ] Implement skater-goal collision as slide-and-slow behavior instead of sticky collision.
- [ ] Write failing tests for goal mouth scoring versus post, crossbar, side mesh, back mesh, and outside goal hits.
- [ ] Implement strict scoring only through the front goal mouth.
- [ ] Implement hard rebound responses for posts and crossbar.
- [ ] Emit a post/crossbar impact event that `sfx.ts` can subscribe to for a metal ding sound.
- [ ] Implement softer netting/mesh rebounds that return the puck to playable ice.
- [ ] Add last-valid-position safety correction for puck clips through non-scoring goal geometry.
- [ ] Keep valid goals dead in the net for 2 seconds before reset.
- [ ] Increase glass height visually in `Rink.tsx`.
- [ ] Add physical puck collision against taller glass for lifted/missed shots.
- [ ] Wire the metal ding sound in `sfx.ts`.
- [ ] Run `npm.cmd run test --workspace @bbh/shared`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Improve net and glass physics`.

**Acceptance:**

- Puck never passes through non-scoring goal parts.
- Posts/crossbar rebound harder than netting and play a ding.
- Netting rebounds softly and leaves the puck playable.
- Skaters slide off goals instead of sticking.
- Taller glass catches lifted/missed shots.

### WO-04: Skating, Sprint, and Slap-Windup Glide

**Goal:** Tune skating so base speed is slower, sprint is meaningful, and slap-shot windup locks the skater into a glide direction.

**Likely files:**

- Modify: `packages/shared/src/sim/skater.ts`
- Modify: `packages/shared/src/sim/actions.ts`
- Modify: `packages/shared/src/sim/world.ts`
- Modify: `packages/shared/src/sim/world.test.ts`
- Modify: `packages/client/src/game/prediction.ts`
- Modify: `packages/client/src/game/prediction.test.ts`
- Modify: `packages/client/src/input/gamepad.ts`

**Steps:**

- [x] Re-read movement constants, sprint handling, shot charge handling, and client prediction.
- [x] Write failing tests proving base speed is moderately slower and sprint is above base but below the previous effective top speed.
- [x] Tune base speed and sprint multiplier.
- [x] Add sprint turning and puck-control precision penalty.
- [x] Update prediction tests so local movement matches shared movement.
- [x] Write failing tests for slap-shot windup glide: windup captures initial movement direction and steering is ignored while wound up.
- [x] Write failing tests for neutral right-stick windup cancel once WO-08 introduces the shot-input state machine.
- [x] Implement windup glide direction state in shared sim.
- [x] Add windup timeout safety.
- [x] Ensure getting checked, stripped, disabled, or losing the puck cancels windup.
- [x] Run `npm.cmd run test --workspace @bbh/shared`.
- [x] Run `npm.cmd run test --workspace @bbh/client`.
- [x] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Tune sprint and slapshot glide`.

**Acceptance:**

- L3 sprint feels noticeably faster than base skating.
- Sprint remains slightly below the prior max-speed feel.
- Sprint has a control tradeoff.
- Slap windup glides forward in the starting direction and can be canceled safely.

### WO-05: Stick Reach, Poke Check, and Defensive Possession

**Goal:** Make loose-puck pickup forgiving, keep passive reach from stealing possessed pucks, and make poke checking a readable defensive action.

**Likely files:**

- Modify: `packages/shared/src/sim/puck.ts`
- Modify: `packages/shared/src/sim/actions.ts`
- Modify: `packages/shared/src/sim/types.ts`
- Modify: `packages/shared/src/sim/world.test.ts`
- Modify: `packages/server/src/rooms/state.ts`
- Modify: `packages/client/src/net/client.ts`
- Modify: `packages/client/src/render/CharacterModel.tsx`
- Modify: `packages/client/src/render/clipMap.ts`

**Steps:**

- [x] Re-read loose puck pickup, carried puck logic, poke handling, and animation event wiring.
- [x] Write failing tests for loose-puck stick reach within typical range without direct overlap.
- [x] Implement forgiving auto-pickup only for loose pucks.
- [x] Write failing tests proving passive reach cannot steal from a puck carrier.
- [x] Keep possessed-puck takeaways limited to active defensive actions.
- [x] Write failing tests for poke check range, cooldown, whiff commitment, and knock-loose behavior.
- [x] Implement long-reach poke check as knock-loose, not auto-possession.
- [x] Add a small movement/turning penalty during poke and recovery.
- [x] Add or improve poke animation event state so the long reach is visible.
- [x] Run `npm.cmd run test --workspace @bbh/shared`.
- [x] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Improve stick reach and poke checks`.

**Acceptance:**

- Skaters collect nearby loose pucks without skating directly over them.
- Passive reach never steals a possessed puck.
- RB poke check is visible, has range/cooldown/recovery, and knocks the puck loose on success.

### WO-06: Arcade Hits, No Penalties, Knockdowns, and Pileups

**Goal:** Remove penalty-box hockey rules and replace them with arcade hit physics, sliding knockdowns, and downed-player pileups.

**Likely files:**

- Modify: `packages/shared/src/config/charge.ts`
- Modify: `packages/shared/src/sim/actions.ts`
- Modify: `packages/shared/src/sim/skater.ts`
- Modify: `packages/shared/src/sim/types.ts`
- Modify: `packages/shared/src/sim/world.ts`
- Modify: `packages/shared/src/sim/world.test.ts`
- Modify: `packages/server/src/rooms/state.ts`
- Modify: `packages/client/src/net/client.ts`
- Modify: `packages/client/src/store.ts`
- Modify: `packages/client/src/ui/HUD.tsx`
- Modify: `packages/client/src/ui/Callouts.tsx`
- Modify: `packages/client/src/audio/sfx.ts`
- Modify: `packages/client/src/render/CharacterModel.tsx`

**Steps:**

- [x] Re-read penalty, power play, hit, stagger, style charge, and collision code.
- [x] Write failing tests proving away-from-puck hits do not emit `penalty`, do not set `penaltyUntil`, and do not move the hitter off ice.
- [x] Remove or disable penalty-box gameplay and power-play derivation from hits.
- [x] Remove penalty callouts and penalty sounds.
- [x] Keep hit, stagger, puck-loose, combo-break, and style consequences.
- [x] Split hit style rewards into puck-relevant hit value and very-low off-puck hit value.
- [x] Write failing tests for impact force using hitter `hit`, speed, approach angle, and contact alignment.
- [x] Write failing tests proving target `hit` resists knockdown and sliding.
- [x] Implement hard-hit knockdown and slide distance scaling.
- [x] Add downed/sliding state that lasts briefly before recovery.
- [x] Write failing tests for high-speed collision with downed players tripping the moving skater.
- [x] Write failing tests for low-speed collision with downed players slowing, bumping, or redirecting instead of tripping.
- [x] Make downed-player obstacle collisions affect teammates and opponents.
- [x] Update animation/render state so knockdowns read as players on the ice instead of only a small stagger.
- [x] Run `npm.cmd run test --workspace @bbh/shared`.
- [x] Run `npm.cmd run test --workspace @bbh/client`.
- [x] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Add arcade knockdown contact`.

**Acceptance:**

- No penalties or power plays exist from hits.
- All hits are legal.
- Puck-relevant hits are worth much more style than off-puck hits.
- Hard hits knock players down and slide them.
- Downed players can trip or slow later skaters based on speed.

### WO-07: Passing Direction, Lane Assist, and Pass Charge

**Goal:** Make passing use left-stick direction, target teammates only when the lane is reasonable, and support smooth 0.5-second pass power charging.

**Likely files:**

- Modify: `packages/shared/src/sim/actions.ts`
- Modify: `packages/shared/src/sim/types.ts`
- Modify: `packages/shared/src/sim/world.ts`
- Modify: `packages/shared/src/sim/world.test.ts`
- Modify: `packages/client/src/input/inputState.ts`
- Modify: `packages/client/src/input/gamepad.ts`
- Modify: `packages/client/src/net/client.ts`
- Modify: `packages/client/src/game/prediction.ts`

**Steps:**

- [x] Re-read current pass target selection and input edge handling.
- [x] Write failing tests for pass direction following left-stick aim.
- [x] Write failing tests for teammate assist only when a teammate is in the aimed cone and the lane is reasonable.
- [x] Write failing tests for open-ice pass when no reasonable teammate target exists.
- [x] Add pass-charge start and release state.
- [x] Write failing tests for smooth pass power ramp from soft to strong over 0.5 seconds.
- [x] Implement pass charge cap at 0.5 seconds.
- [x] Preserve existing assist/last-touch/one-timer behavior where compatible.
- [x] Update client input handling so tap pass and held pass are distinguishable.
- [x] Run `npm.cmd run test --workspace @bbh/shared`.
- [x] Run `npm.cmd run test --workspace @bbh/client`.
- [x] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Add aimed charged passing`.

**Acceptance:**

- Left stick controls pass direction.
- Good teammate lanes receive assist.
- Bad or absent lanes pass into open ice.
- Tap pass is soft and 0.5-second hold reaches max pass power.

### WO-08: Right-Stick Wrist Shots and Slap Shots

**Goal:** Split shooting into quick flick-up wrist shots and pull-back-then-flick-up slap shots with drawback-based power and lift chance.

**Likely files:**

- Modify: `packages/shared/src/sim/actions.ts`
- Modify: `packages/shared/src/sim/types.ts`
- Modify: `packages/shared/src/sim/world.ts`
- Modify: `packages/shared/src/sim/world.test.ts`
- Modify: `packages/client/src/input/gamepad.ts`
- Modify: `packages/client/src/input/inputState.ts`
- Modify: `packages/client/src/render/CharacterModel.tsx`
- Modify: `packages/client/src/render/clipMap.ts`
- Modify: `packages/client/src/render/Skater.tsx`

**Steps:**

- [x] Re-read current right-stick and shot-charge behavior.
- [x] Write failing tests for flick-up right stick firing a wrist shot.
- [x] Write failing tests for pull-back starting slap windup without firing.
- [x] Write failing tests for flick-up after pull-back firing a slap shot.
- [x] Write failing tests for drawback distance mapping to shot power.
- [x] Write failing tests proving stronger shots increase speed and lift chance.
- [x] Implement wrist-shot and slap-shot input state machine.
- [x] Wire wrist-shot animation as a quick release.
- [x] Wire slap-shot windup and release animation.
- [x] Ensure neutral right stick cancels windup and timeout safety clears stale windup.
- [x] Run `npm.cmd run test --workspace @bbh/shared`.
- [x] Run `npm.cmd run test --workspace @bbh/client`.
- [x] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Split wrist and slap shots`.

**Acceptance:**

- Flick up shoots a quick wrist shot.
- Pull back only winds up.
- Flick up after windup fires a slap shot.
- Drawback controls slap-shot power.
- Stronger shots are faster and more likely to lift into posts, crossbar, glass, or high misses.

### WO-09: Goalie Visual Gear

**Goal:** Make goalies immediately recognizable with hockey goalie equipment.

**Likely files:**

- Modify: `packages/client/src/render/gear.ts`
- Modify: `packages/client/src/render/CharacterModel.tsx`
- Modify: `packages/client/src/render/Skater.tsx`
- Test: `packages/client/src/render/goalieGear.test.ts`

**Steps:**

- [x] Re-read `gear.ts`, `CharacterModel.tsx`, and `Skater.tsx`.
- [x] Add a goalie-specific gear attachment path when `isGoalie` is true.
- [x] Build procedural leg pads, blocker, catching glove, chest/shoulder bulk, goalie stick, and mask.
- [x] Keep normal skater gear for non-goalies.
- [x] Keep goalie pads, blocker, glove, mask, and goalie stick separate from jersey/pants uniform schemes.
- [x] Add render-data or unit tests proving goalie gear selection is driven by `isGoalie`.
- [x] Run `npm.cmd run test --workspace @bbh/client`.
- [x] Run `npm.cmd run typecheck`.
- [ ] Manually verify goalies are visually recognizable in a local match.
- [ ] Commit with a message like `Add goalie gear visuals`.

**Acceptance:**

- Goalies clearly look like hockey goalies.
- Skaters keep skater gear.
- Uniform scheme changes do not erase goalie-specific pads, blocker, glove, mask, or goalie stick.

### WO-10: Goalie Crease Movement

**Goal:** Make goalie AI move like a hockey goalie: calm when safe, lateral and square when danger rises.

**Likely files:**

- Modify: `packages/server/src/ai/goalie.ts`
- Modify: `packages/server/src/ai/goalie.test.ts`

**Steps:**

- [x] Re-read current goalie target caching, crease constraints, and auto-pass behavior.
- [x] Define goalie movement states in `goalie.ts`: idle ready stance, puck tracking, lateral slide, and close-puck challenge.
- [x] Keep existing anti-twitch target caching.
- [x] Write failing tests proving a far puck keeps the goalie mostly settled.
- [x] Write failing tests proving tiny puck jitter does not change the cached target.
- [x] Write failing tests proving a close left-side attack shifts the goalie left.
- [x] Write failing tests proving a close right-side attack shifts the goalie right.
- [x] Write failing tests proving the goalie stays inside crease limits and does not chase into open ice.
- [x] Implement lateral crease movement using puck angle and puck-carrier danger.
- [x] Preserve goalie cover and auto-pass behavior after holding the puck.
- [x] Run `npm.cmd run test --workspace @bbh/server -- goalie`.
- [x] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Rework goalie crease movement`.

**Acceptance:**

- Goalies stand calm when the puck is not dangerous.
- Goalies shift laterally toward side attacks.
- Goalies challenge slightly when the puck is close.
- Goalies stay in the crease and avoid twitching.

### WO-11: Goalie Save Type Rework

**Goal:** Map shot height, side, speed, and danger to readable goalie save outcomes.

**Likely files:**

- Modify: `packages/shared/src/sim/puck.ts`
- Modify: `packages/shared/src/sim/types.ts`
- Modify: `packages/shared/src/sim/world.test.ts`
- Modify: `packages/server/src/rooms/state.ts`
- Modify: `packages/server/src/rooms/state.test.ts`
- Modify: `packages/client/src/net/client.ts`
- Modify: `packages/client/src/game/interpolation.ts`
- Modify: `packages/client/src/game/interpolation.test.ts`

**Steps:**

- [x] Re-read current goalie save code in `puck.ts` and save pose sync fields.
- [x] Extend save pose typing if needed so outcomes can represent `pad`, `body`, `glove`, `blocker`, and `cover`.
- [x] Write failing tests proving low shots produce pad or butterfly saves.
- [x] Write failing tests proving high glove-side shots produce glove saves.
- [x] Write failing tests proving high blocker-side shots produce blocker deflections.
- [x] Write failing tests proving mid-height shots can produce body/chest saves.
- [x] Write failing tests proving soft centered shots can be covered.
- [x] Write failing tests proving hard saves create rebounds.
- [x] Implement save outcome selection from puck height, lateral side, puck speed, and goalie position.
- [x] Sync the selected save pose through server state and client snapshots.
- [x] Preserve save events, save stat tallying, and rebound versus cover behavior.
- [x] Run `npm.cmd run test --workspace @bbh/shared -- goalie`.
- [x] Run `npm.cmd run test --workspace @bbh/server -- state`.
- [x] Run `npm.cmd run test --workspace @bbh/client -- interpolation`.
- [x] Run `npm.cmd run typecheck`.
- [ ] Commit with a message like `Expand goalie save outcomes`.

**Acceptance:**

- Low shots read as pad/butterfly saves.
- High glove-side shots read as glove saves.
- Blocker-side shots deflect away.
- Soft centered shots can be covered.
- Hard saves rebound and count as saves.

### WO-12: Goalie Save Animation and Poses

**Goal:** Make goalie save outcomes visually distinct without requiring detailed bespoke animation assets.

**Likely files:**

- Modify: `packages/client/src/render/Skater.tsx`
- Modify: `packages/client/src/render/CharacterModel.tsx`
- Modify: `packages/client/src/render/clipMap.ts`
- Test: `packages/client/src/game/interpolation.test.ts`

**Steps:**

- [ ] Re-read current goalie save tilt logic in `Skater.tsx` and animation selection in `CharacterModel.tsx`.
- [ ] Add or refine a goalie ready stance for idle/tracking goalie state.
- [ ] Add procedural butterfly or drop-to-knees pose for pad saves.
- [ ] Add glove-side lean/reach pose for glove saves.
- [ ] Add blocker-side lean/deflection pose for blocker saves.
- [ ] Add body/chest save pose for mid-height body saves.
- [ ] Add cover pose for soft puck covers.
- [ ] Return the goalie to ready stance after `goalieSaveUntil` expires.
- [ ] Keep non-goalie skater animations unaffected.
- [ ] Run `npm.cmd run test --workspace @bbh/client`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Manually verify pad, glove, blocker, body, and cover saves are visually distinct.
- [ ] Commit with a message like `Add goalie save poses`.

**Acceptance:**

- Goalie save visuals match save outcome type.
- Pad, glove, blocker, body, and cover saves read differently.
- Goalie returns to a ready stance after the save window.

### WO-13: Goalie Tuning and Verification

**Goal:** Tune goalie movement, save reach, cover behavior, and rebound behavior so goalies feel reactive but not overpowered.

**Likely files:**

- Modify: `packages/server/src/ai/goalie.ts`
- Modify: `packages/shared/src/sim/puck.ts`
- Modify: `packages/client/src/render/Skater.tsx`
- Modify: `packages/client/src/render/gear.ts`
- Modify: `docs/superpowers/specs/2026-06-26-dales-major-plan-design.md`

**Steps:**

- [ ] Re-read goalie movement, save outcome, and save pose work-order commits.
- [ ] Tune lateral speed, settle radius, target hold, challenge depth, save reach, cover threshold, rebound strength, and save pose duration together.
- [ ] Verify goalies are not overpowered against cross-crease plays.
- [ ] Verify goalies are not useless against straight-on shots.
- [ ] Verify goalies stay calm when the puck is far and react when danger rises.
- [ ] Verify goalie gear remains readable with all selected uniform schemes.
- [ ] Run `npm.cmd run test --workspace @bbh/shared`.
- [ ] Run `npm.cmd run test --workspace @bbh/server`.
- [ ] Run `npm.cmd run test --workspace @bbh/client`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Manually playtest a local match and inspect several low, high, side-angle, and hard shots.
- [ ] Commit with a message like `Tune goalie rework`.

**Acceptance:**

- Goalies look like goalies.
- Goalies move like crease-bound hockey goalies.
- Save types are readable and appropriate to shot type.
- Goalies feel fair: strong on reasonable saves, beatable on good plays.

### WO-14: Integration, Feel Tuning, and Full Verification

**Goal:** Tune all completed systems together so the game feels cohesive, then verify the full stack.

**Likely files:**

- Modify: `packages/shared/src/config/characters.ts`
- Modify: `packages/shared/src/config/charge.ts`
- Modify: `packages/shared/src/config/rink.ts`
- Modify: `packages/shared/src/sim/actions.ts`
- Modify: `packages/shared/src/sim/physics.ts`
- Modify: `packages/shared/src/sim/puck.ts`
- Modify: `packages/shared/src/sim/skater.ts`
- Modify: `packages/shared/src/sim/world.ts`
- Modify: `packages/server/src/ai/goalie.ts`
- Modify: `packages/client/src/render/Skater.tsx`
- Modify: `packages/client/src/render/gear.ts`
- Modify: `packages/client/src/render/Rink.tsx`
- Modify: `packages/client/src/ui/Lobby.tsx`
- Modify: `docs/superpowers/specs/2026-06-26-dales-major-plan-design.md`

**Steps:**

- [ ] Re-read all completed work-order commits and the full spec.
- [ ] Tune skating speed, sprint tradeoff, pickup radius, poke range, hit force, slide friction, pass cone, pass power, shot lift, glass height, and ring readability together.
- [ ] Remove obsolete penalty/power-play references from UI, comments, README sections, and docs touched by this feature set.
- [ ] Confirm generated or procedural hockey gear remains readable on all archetypes.
- [ ] Run `npm.cmd run test`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Start the local dev stack with `npm.cmd run dev`.
- [ ] Manually verify a local match at `http://localhost:5173/`.
- [ ] Manually verify the server monitor at `http://localhost:2567/colyseus`.
- [ ] Manual check: six human ring colors are distinguishable on ice.
- [ ] Manual check: bots have no ring.
- [ ] Manual check: uniforms affect jersey/pants only.
- [ ] Manual check: puck cannot pass through goal exterior.
- [ ] Manual check: hits create knockdowns/pileups without penalties.
- [ ] Manual check: pass and shot controls match this spec.
- [ ] Manual check: goalies have pads and distinct goalie gear.
- [ ] Manual check: goalies move laterally in the crease and stay calm when puck danger is low.
- [ ] Manual check: goalie pad, glove, blocker, body, and cover saves read differently.
- [ ] Commit final tuning with a message like `Tune Dale gameplay feel pass`.

**Acceptance:**

- Full tests and typecheck pass.
- The gameplay pass can be explained through the work orders above.
- The game still runs locally.
- The plan file remains accurate after implementation.

## Non-Goals

- Do not rewrite the entire physics engine.
- Do not add stamina for sprint.
- Do not add manual high-low shot aiming in this pass.
- Do not let passive loose-puck reach steal from controlled possession.
- Do not make poke checks instantly grant possession.
- Do not use real hockey player names, team logos, or direct player likenesses for the fictional roster.
- Do not add a separate strength stat unless the five-stat model is intentionally redesigned later.
- Do not add penalties, power plays, or forced penalty-box states.
- Do not use team uniform colors as human-control ring colors.
- Do not show control rings under AI or bot skaters.
- Do not let uniform color schemes override archetype-specific sticks, gloves, helmets, visors, tape, pads, or accessories.
- Do not make goalies chase into open ice.
- Do not make goalie gear depend on skater archetype gear.
- Do not commit gameplay code from this planning branch.

## Testing Strategy

Use TDD for the implementation branch.

Recommended regression coverage:

- Skaters colliding with the goal slide and slow instead of sticking.
- Wedged skaters receive a small escape bump.
- Puck entering through the goal mouth scores.
- Puck hitting posts or crossbar rebounds hard and triggers the ding event.
- Puck hitting mesh or outside goal surfaces rebounds softly and remains playable.
- Puck clipping through non-scoring goal geometry is corrected to the last valid ice position.
- Goal scoring leaves the puck dead in the net for 2 seconds.
- Sprint speed is above base speed but below the previous top speed target.
- Sprint widens turns and reduces puck-control precision.
- Loose puck pickup works within stick range without requiring direct overlap.
- Passive pickup does not steal from a possessed puck.
- Poke check knocks loose an opponent-controlled puck when in range.
- Missed poke check applies cooldown and small movement/turning penalty.
- Character stat totals remain equal and each distribution remains unique.
- No penalty event is emitted for away-from-puck hits.
- No skater receives a penalty-box state or is moved off-ice for a hit.
- Power play UI state does not activate from hit events.
- Puck-relevant hits grant more style than off-puck hits.
- High-force hits knock targets down and slide them across the ice.
- High-`hit` targets resist knockdowns better than low-`hit` targets.
- Lower-`hit` hitters can knock down stronger targets only with enough speed and clean contact.
- High-speed collision with a downed player trips the moving skater.
- Low-speed collision with a downed player slows or redirects without tripping.
- Downed-player pileup collisions affect teammates and opponents.
- Human Player 1 through Player 6 control rings render with the configured join-order colors.
- AI and bot skaters render with no control ring.
- A human control ring moves when that human switches controlled skaters.
- Multiple humans on the same team keep distinct control rings.
- Team uniform schemes affect jerseys and pants only.
- Uniform scheme changes do not change human-control ring colors.
- Archetype-specific sticks, gloves, helmets, visors, tape, pads, and accessories remain controlled by archetype visuals.
- Home and Away cannot start with indistinguishable uniform colors.
- Pass direction follows left-stick aim.
- Pass targeting chooses a teammate only when the aimed cone and lane are reasonable.
- Pass into open ice works when no reasonable teammate target exists.
- Pass power charges smoothly over 0.5 seconds.
- Flick-up right-stick input fires a wrist shot.
- Pull-back right-stick input starts slap-shot windup without firing.
- Flick-up after windup fires a slap shot with power based on drawback.
- Neutral right stick cancels slap-shot windup.
- Wound-up skater glides along the initial windup direction.
- Stronger shots increase speed and lift chance.
- Taller glass collision catches lifted or missed shots.
- Goalies render with leg pads, blocker, catching glove, chest bulk, goalie stick, and mask.
- Far or low-danger pucks keep goalies mostly settled.
- Close side attacks shift goalies laterally while staying in the crease.
- Tiny puck jitter does not cause goalie twitching.
- Low shots trigger pad or butterfly saves.
- High glove-side shots trigger glove saves.
- Blocker-side shots trigger blocker deflections.
- Soft centered shots can be covered.
- Hard saves create rebounds.
- Save pose sync exposes the selected goalie save type to the client.

## Implementation Notes

Prefer small, named interaction helpers over scattering conditionals across control and physics code. The implementation should preserve existing multiplayer/server authority patterns and current possession handoff rules.

Likely units to define or clarify during implementation:

- Goal collision rules for skaters and puck.
- Puck impact response types: post, crossbar, net mesh, outside goal, glass, boards, ice.
- Loose-puck stick reach and possession eligibility.
- Poke-check state, animation window, hit window, cooldown, and recovery penalty.
- Fictional hockey archetype roster definitions, outfit direction, and balanced stat distributions.
- Human controller identity mapping for Player 1 through Player 6 ring colors.
- Human-only control-ring rendering that follows the controlling session when skater control changes.
- Lobby uniform scheme selection for Home and Away jerseys and pants.
- Uniform rendering split between team-selected jersey/pants colors and archetype-owned gear/accessory details.
- Goalie-specific visual gear: pads, blocker, catching glove, chest bulk, goalie stick, and mask.
- Goalie AI movement states for idle ready stance, tracking, lateral slide, and close-puck challenge.
- Goalie save outcome selection for pad, body, glove, blocker, and cover saves.
- Goalie save pose syncing and procedural save rendering.
- Arcade hit resolution: impact force, knockdown threshold, sliding distance, and style award tier.
- Downed-player obstacle collision for trip, slowdown, bump, and redirect outcomes.
- Removal or disabling of penalty-box and power-play flows while preserving normal hit consequences.
- Pass charge and target selection.
- Shot state machine for wrist shot, slap-shot windup, cancel, and release.
- Tunable skating constants for base speed, sprint speed, turning, and puck-control precision.

## Open Tuning Points

These values should be tuned during implementation and feel-testing:

- Goal-frame slide friction.
- Wedged-skater escape bump strength.
- Post/crossbar rebound energy.
- Netting rebound softness.
- Loose-puck pickup radius.
- Poke-check range, cooldown, hit window, and recovery penalty.
- Base skating speed and sprint speed.
- Sprint turning penalty and puck-control penalty.
- Pass aim cone width and lane quality rules.
- Minimum and maximum pass power.
- Off-puck hit style value versus puck-relevant hit style value.
- Hit impact-force formula and knockdown threshold.
- Sliding friction and maximum slide distance for downed players.
- Speed threshold for tripping over a downed or sliding player.
- Low-speed slowdown, bump, and redirect strength against downed players.
- Control-ring thickness, opacity, pulse, and glow strength.
- Home and Away uniform color palette and contrast rules.
- Goalie lateral speed, settle radius, target hold time, and challenge depth.
- Goalie save reach, cover threshold, rebound strength, and save pose duration.
- Slap-shot windup timeout.
- Shot lift probabilities by power.
- Glass height and rebound energy.
