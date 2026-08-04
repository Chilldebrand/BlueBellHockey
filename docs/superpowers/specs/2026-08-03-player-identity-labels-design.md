# Player identity name labels

## Goal

Show each human player's display name as a small, static label on the ice in
the same camera-side identity-marker area as the power-up icons. The name is
centred in the stack; active power-up icons render in a centred row below it.

## Scope

- Human-controlled skaters receive a label from their roster `displayName`.
- A human's label follows their temporary goalie control exactly as their
  identity colour already does.
- AI skaters and unclaimed goalies receive neither label nor identity marker.
- Free Skate and Shootout remain unchanged unless they explicitly provide a
  display-name identity entry.
- Existing power-up art and all unrelated working-tree changes are out of
  scope.

## Presentation

- The name sits on the ice at the camera-side edge of the identity disc,
  centred on the skater or goalie.
- Power-up icons sit farther toward the camera, below the name in screen
  space, as a centred row.
- The label is a small white raster with a dark outline for contrast against
  the ice. A 24-character server name is scaled to the available width rather
  than truncated.
- The label is static: it has no bobbing, spinning, animation, or screen-space
  DOM behavior. It moves only because the controlled entity moves.
- Away-view orientation mirrors the ice-plane placement and glyph direction so
  every local player reads names upright from their own end.

## Architecture

1. Add a client-side `displayNameByEntityId` presentation map beside the
   existing colour map. Each human roster slot writes its name under its
   current controlled entity ID (goalie while granted; skater otherwise).
2. Thread this optional map from `App` into `Scene`, then into `SkaterDebug`.
   The goalie render uses the same map directly.
3. Add a reusable identity-name decal component. It memoizes a small
   `CanvasTexture` from a name, draws fill plus outline, applies it to a
   transparent plane on the ice, and disposes the texture when the name
   changes or unmounts. No external font asset or network request is needed.
4. Keep the identity disc rendering as-is. Place the name decal centred at
   the disc's camera-side edge and move the existing power-up badge row below
   it by a fixed additional camera-side offset.

## Tests and verification

- Unit-test the display-name map: human names are keyed to their skater,
  follow goalie control, and omit bots.
- Unit-test the pure name/badge placement helper for both view orientations so
  name and badges remain centred and ordered correctly.
- Run the focused tests first in red/green order, then the full arcade-client
  suite, typecheck, and a production client build.
- Visually inspect a live 3v3 scene with and without active power-ups before
  publishing.

## Non-goals

- No name labels for bots.
- No changes to player colour allocation.
- No change to power-up mechanics, physics, or player names in the lobby.
