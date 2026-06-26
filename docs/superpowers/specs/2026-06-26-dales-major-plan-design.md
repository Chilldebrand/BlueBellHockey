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

## Non-Goals

- Do not rewrite the entire physics engine.
- Do not add stamina for sprint.
- Do not add manual high-low shot aiming in this pass.
- Do not let passive loose-puck reach steal from controlled possession.
- Do not make poke checks instantly grant possession.
- Do not use real hockey player names, team logos, or direct player likenesses for the fictional roster.
- Do not add a separate strength stat unless the five-stat model is intentionally redesigned later.
- Do not add penalties, power plays, or forced penalty-box states.
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

## Implementation Notes

Prefer small, named interaction helpers over scattering conditionals across control and physics code. The implementation should preserve existing multiplayer/server authority patterns and current possession handoff rules.

Likely units to define or clarify during implementation:

- Goal collision rules for skaters and puck.
- Puck impact response types: post, crossbar, net mesh, outside goal, glass, boards, ice.
- Loose-puck stick reach and possession eligibility.
- Poke-check state, animation window, hit window, cooldown, and recovery penalty.
- Fictional hockey archetype roster definitions, outfit direction, and balanced stat distributions.
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
- Slap-shot windup timeout.
- Shot lift probabilities by power.
- Glass height and rebound energy.
