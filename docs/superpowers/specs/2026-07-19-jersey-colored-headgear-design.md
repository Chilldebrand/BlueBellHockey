# Jersey-Colored Headgear

## Goal

Make team identity visually consistent by matching each skater helmet and goalie mask shell to the wearer’s jersey color.

## Design

- In `CharacterModel.tsx`, use `palette.jersey` for the regular helmet shell and both ear guards.
- In `GoalieModel.tsx`, use `palette.jersey` for the goalie mask shell surfaces.
- Keep visors, cages, straps, face, pads, and other protective details unchanged so the headgear remains readable and visually separated.
- Reuse the existing palette data rather than introducing new team-color constants or props.

## Verification

- Add focused render coverage for jersey-colored skater helmets and goalie masks where the existing test structure supports it.
- Run the arcade client tests, typecheck, and production build.
- Inspect the rendered client after the build to confirm both regular players and goalies follow their jersey colors.
