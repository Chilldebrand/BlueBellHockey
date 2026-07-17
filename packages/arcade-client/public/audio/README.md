# Arcade client audio manifest contract

This folder defines stable logical audio IDs for the active `@bbh/arcade-client`.
Do not rename IDs once consumers ship against them; swap files behind the same ID
instead.

## Formats

- Provide both `.ogg` and `.mp3` for each logical clip ID.
- Voice assets should be exported as mono at 48kHz.
- Missing files are non-fatal: the client should fail silently and continue.
- Unit tests must depend only on logical IDs and copy, never on binary assets.

## Stable logical IDs

Character name clips:

- `announcer.name.rook-rocket`
- `announcer.name.nova-screen`
- `announcer.name.dash-iron`
- `announcer.name.luna-thread`
- `announcer.name.kip-hook`
- `announcer.name.vex-rebound`
- `announcer.name.axel-laser`
- `announcer.name.zara-crush`
- `announcer.name.milo-ghost`
- `announcer.name.tess-flash`
- `announcer.name.orin-pads`
- `announcer.name.mira-wall`

Goal quip clips:

- `announcer.goal.0` — “finds the twine!”
- `announcer.goal.1` — “the goalie is requesting a map!”
- `announcer.goal.2` — “the scoreboard is filing a complaint!”
- `announcer.goal.3` — “that puck had a business meeting with the net!”
- `announcer.goal.4` — “the crease has been invaded!”
- `announcer.goal.5` — “top shelf, no ladder required!”
- `announcer.goal.6` — “the goalie saw it in the brochure!”
- `announcer.goal.7` — “that was rude!”

Powerup quip clips:

- `announcer.powerup.speed-boost` — “just found another gear!”
- `announcer.powerup.freeze` — “froze the competition!”
- `announcer.powerup.bulldozer` — “turned into a wrecking ball!”
- `announcer.powerup.mini-goalie` — “made the goalie tiny!”
- `announcer.powerup.giant-goalie` — “built a goalie wall!”

Music:

- `music.menu.0`

## Public path layout

The manifest maps stable logical IDs to public `/audio/` paths under these slots:

- `/audio/announcer/names/<character-id>.{ogg,mp3}`
- `/audio/announcer/goals/goal-<0-7>.{ogg,mp3}`
- `/audio/announcer/powerups/<powerup-type>.{ogg,mp3}`
- `/audio/music/menu-0.{ogg,mp3}`
