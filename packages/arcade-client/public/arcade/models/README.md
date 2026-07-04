# Arcade Model Import Paths

Client-visible character models live under this directory:

- skaters: `/arcade/models/skaters/<character-id>.glb`
- goalies: `/arcade/models/goalies/<character-id>.glb`

Each model must have metadata that validates against `packages/arcade-assets/characters/roster.schema.json` and the client-side validation harness in `src/render/modelValidation.ts`.

Current first-pass manifests are stubbed in code for:

- `/arcade/models/skaters/rook-rocket.glb`
- `/arcade/models/goalies/mira-wall.glb`

If the GLB is unavailable or metadata is incomplete, the renderer must show a clear fallback instead of silently failing.

## Live test asset (temporary)

- `skaters/test-cesium.glb` — **CesiumMan**, a rigged, walk-animated humanoid.
  Wired in as the first real GLB body to prove the loader + bone/clip remap +
  fallback path and to judge scale/orientation in Free Skate. It is **not** the
  shipping character: its rig is a few generic joints and it has a single walk
  clip, so most animation states fall back to that clip.
  - Source: Khronos glTF-Sample-Assets.
  - Licence: **CC-BY 4.0**, © Cesium. Attribution required while it ships.
  - Remap + scale/orientation knobs: `src/render/gltf/skaterGltfSource.ts`.
  - To go live for real: drop a Quaternius CC0 body in here, point
    `ACTIVE_SKATER_GLTF_SOURCE` at it, and rewrite its `boneMap` / `clipMap`.
  - Kill switch: set `GLTF_SKATER_BODIES_ENABLED = false` to force every skater
    back to the procedural capsule blockout.
