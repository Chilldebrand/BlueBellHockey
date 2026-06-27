# Arcade Model Import Paths

Client-visible character models live under this directory:

- skaters: `/arcade/models/skaters/<character-id>.glb`
- goalies: `/arcade/models/goalies/<character-id>.glb`

Each model must have metadata that validates against `packages/arcade-assets/characters/roster.schema.json` and the client-side validation harness in `src/render/modelValidation.ts`.

Current first-pass manifests are stubbed in code for:

- `/arcade/models/skaters/rook-rocket.glb`
- `/arcade/models/goalies/mira-wall.glb`

If the GLB is unavailable or metadata is incomplete, the renderer must show a clear fallback instead of silently failing.
