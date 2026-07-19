# Task 2 Report: semantic GLB uniform coloring

Date: 2026-07-19

## Scope

Implemented only the Task 2 files:

- `packages/arcade-client/src/render/gltf/uniformMaterials.ts`
- `packages/arcade-client/src/render/gltf/uniformMaterials.test.ts`
- `packages/arcade-client/src/render/gltf/GltfSkaterBody.tsx`

Plus this report:

- `.superpowers/sdd/team-uniform-task-2-report.md`

No palette files were changed. No unrelated renderer behavior was changed.

## TDD evidence

### RED: focused failing test created first

Created `packages/arcade-client/src/render/gltf/uniformMaterials.test.ts` before the helper existed.

Initial command:

`npm.cmd run test --workspace @bbh/arcade-client -- src/render/gltf/uniformMaterials.test.ts`

First run inside the sandbox failed at Vitest config loading due sandbox access limits, so the same command was rerun outside the sandbox to capture the actual test failure required by the task.

Expected red failure from the rerun:

`Error: Failed to load url ./uniformMaterials.js ... Does the file exist?`

Vitest summary:

- `Test Files 1 failed`
- `Tests no tests`

This confirmed the new focused test was genuinely red because the target module did not exist yet.

### GREEN: minimal implementation added

Added `packages/arcade-client/src/render/gltf/uniformMaterials.ts` with:

- `isUniformMaterialName(name): boolean`
- `applyUniformMaterialColor(root, palette): boolean`

Behavior implemented:

- Case-insensitive semantic token matching for `uniform`, `jersey`, `sweater`, `shirt`, `pants`, `trousers`, and `sock`/`socks`
- Token boundaries limited to start/end, underscore, whitespace, or hyphen
- Traversal over the GLB root object
- Inspection of each `Mesh` and each `MeshStandardMaterial`
- Classification using concatenated mesh/material names
- Uniform cloth recolor via `material.color.set(palette.jersey)`
- Boolean return based on whether at least one semantic uniform material changed

Integrated helper into `GltfSkaterBody.tsx` by:

- Keeping skeleton cloning
- Keeping per-instance material cloning
- Extending cloning to handle material arrays safely
- Preserving local-player emissive behavior
- Removing the prior whole-model `lerp(..., 0.55)` tint
- Throwing `new Error("GLB skater has no named uniform materials")` when no semantic cloth material is found

## Test evidence

### Focused helper test after implementation

Command:

`npm.cmd run test --workspace @bbh/arcade-client -- src/render/gltf/uniformMaterials.test.ts`

Result:

- `src/render/gltf/uniformMaterials.test.ts (3 tests)`
- `Test Files 1 passed`
- `Tests 3 passed`

### Required focused pair

Command:

`npm.cmd run test --workspace @bbh/arcade-client -- src/render/gltf/uniformMaterials.test.ts src/render/headgearColor.test.ts`

Result:

- `src/render/headgearColor.test.ts (2 tests)`
- `src/render/gltf/uniformMaterials.test.ts (3 tests)`
- `Test Files 2 passed`
- `Tests 5 passed`

### Full arcade-client suite

Command:

`npm.cmd run test --workspace @bbh/arcade-client`

Result:

- `Test Files 37 passed`
- `Tests 166 passed`

## Requirement check

- Added the required helper file: yes
- Added the required focused test file first: yes
- Validated accepted names: yes
- Validated rejected names: yes
- Verified recolors only semantic uniform cloth in a fixture group: yes
- Verified no-uniform fixture returns `false`: yes
- Removed whole-model 55% lerp tinting: yes
- Preserved local emissive behavior: yes
- Throws exact fallback error when no semantic uniform material is recognized: yes
- Avoided palette-file changes: yes

## Self-review

What I checked:

- The regex matches semantic cloth names without catching the non-uniform examples in the brief.
- `team-socks` is handled by supporting `sock`/`socks`.
- Mesh material arrays are cloned and traversed so multi-material GLBs do not share mutable material state between skater instances.
- Recoloring is limited to `MeshStandardMaterial`, which matches the task requirement and avoids unexpected behavior for unrelated material types.
- The helper sets full jersey color directly rather than blending toward it, which satisfies the “full primary color” requirement.
- The error string in `GltfSkaterBody` matches the brief exactly.

Potential limitation noted:

- The helper currently applies `palette.jersey` to every recognized uniform cloth material, including pants and socks, which matches the current palette contract because pants and socks are equal to jersey today. If the palette contract later differentiates those slots, this helper would need to route semantic matches to the corresponding palette slot instead of always using `jersey`.
