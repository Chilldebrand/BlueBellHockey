# Team Uniform Color Blocking Design

## Status

Approved design for implementation planning.

## Context

The active teams already have blue and red palette identities, but their uniforms include secondary gold, mint, pale sock, and dark-pants colors. The real GLB skater renderer also blends every material only 55% toward the jersey color, so imported model colors remain visible and the jersey does not read as a clean team-color uniform.

## Goals

1. Keep the home Blue Blades blue and the away Red Rockets red.
2. Render skater jerseys and pants as the team's pure primary blue or red, making the jersey and pants read as one uniform.
3. Keep helmets matched to the team jersey color.
4. Use white for visible jersey numbers and trim.
5. Use black only for equipment accents such as gloves, skates, stick, and other non-uniform hard gear.
6. Make goalie jerseys and helmets follow the same team color while keeping protective pads white and the stick black.

## Non-goals

- No team-name, roster, player-number, physics, or gameplay change.
- No recoloring of faces or skin.
- No change to rink markings, goal cages, UI team colors, or player-control discs.
- No custom per-character uniform palettes.

## Palette

| Team | Jersey and pants | Helmet | Numbers and trim | Protective equipment |
| --- | --- | --- | --- | --- |
| Home / Blue Blades | `#1267d8` blue | `#1267d8` blue | white | black gloves/skates/stick; white goalie pads |
| Away / Red Rockets | `#b3132b` red | `#b3132b` red | white | black gloves/skates/stick; white goalie pads |

The palette removes the prior gold, mint, pale-blue/pale-pink, and dark team-specific uniform colors. The same primary color is used for skater pants and socks to maintain a solid red-or-blue silhouette; any stripe/number detail remains white.

## Rendering architecture

`TEAM_PALETTES` remains the source of truth. Its uniform values are simplified so `jersey`, `pants`, and `socks` all use the team's primary color; `numbers` and `trim` use white.

The procedural skater fallback already assigns palette values by garment. It will therefore render a primary-color torso, pants, and socks, with white back lettering/numbers and black equipment.

The GLB renderer must stop applying a partial all-material tint. It instead applies the primary team color at full strength only to model materials that represent the uniform cloth. It must preserve skin, gloves, skates, sticks, and other hard gear. If the imported model lacks reliable uniform material names, the renderer uses the established procedural fallback rather than recoloring every GLB mesh indiscriminately.

Goalie torso and headgear use the primary team color. Pads, blocker/glove surfaces, and helmet cage remain white/black equipment accents rather than becoming solid team color.

## Data flow

1. A skater or goalie provides its existing `teamId` to the renderer.
2. The renderer resolves the primary uniform palette from `TEAM_PALETTES`.
3. Procedural skaters and goalies assign the primary color to cloth surfaces and white/black to their documented accents.
4. GLB skaters apply the primary color only to identified uniform materials; fallback rendering handles an asset without that separation.

## Error handling

- A missing or unsupported GLB continues to use the existing procedural fallback.
- An unrecognized GLB material is left untouched only when it is known non-uniform gear; otherwise the model falls back instead of risking a mixed-color uniform.
- Palette changes are render-only and must not affect client/server state.

## Verification

Automated tests must confirm that:

- Home primary uniform values are blue and away values are red.
- Each team's `jersey`, `pants`, and `socks` resolve to the same primary color.
- Numbers and trim remain white with adequate contrast.
- Headgear resolves to the matching jersey color for both teams.
- GLB uniform recoloring does not target skin or known hard-gear materials.

Manual browser QA must show all skaters in a strong blue-or-red jersey-and-pants silhouette, white number/trim readability, black skates/gloves/sticks, and matching goalie jersey/helmet colors with white pads. Verify both loaded GLB skaters and the procedural fallback.

## Scope boundary

This work changes team-uniform color application only. It does not alter models, animations, UI, game rules, or any audio behavior.
