# Team Uniform Color Blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a solid blue home uniform and solid red away uniform across skater jerseys, pants, socks, and helmets, while retaining white trim and black hard gear.

**Architecture:** Simplify `TEAM_PALETTES` into a strict primary/white/black uniform contract. The procedural models already consume garment-level palette fields. Add a pure GLB-material classifier so only named uniform cloth is colored at full strength; an asset without separable uniform material names deliberately falls back to the procedural renderer instead of tinting skin and equipment.

**Tech Stack:** TypeScript, React 18, React Three Fiber, Three.js, Vitest, Vite.

## Global Constraints

- Home remains Blue Blades (`#1267d8`) and away remains Red Rockets (`#b3132b`).
- `jersey`, `pants`, and `socks` must equal the team primary color.
- `numbers` and `trim` must be white; gloves, skates, sticks, and goalie cages remain black/steel equipment.
- Preserve faces/skin, existing team IDs, simulation state, rink colors, UI colors, and player-control discs.
- If GLB material names cannot identify uniform cloth, use the existing procedural `BlockoutBody` fallback; never recolor all GLB meshes.
- Every code task follows TDD: focused failing test, test run proving failure, minimal implementation, focused passing test, commit.

---

### Task 1: Make the team palette a strict full-uniform contract

**Files:**
- Modify: `packages/arcade-core/src/config/teams.ts`
- Modify: `packages/arcade-core/src/config/teams.test.ts`

**Interfaces:**
- Consumes: `TEAM_PALETTES: Record<TeamId, TeamPalette>`.
- Produces: `TEAM_PALETTES[teamId].uniform` where `jersey === pants === socks`, `numbers === trim === "#ffffff"`.

- [ ] **Step 1: Write the failing palette regression test.**

```ts
it("uses one primary color from skater jersey through pants and socks", () => {
  for (const teamId of TEAM_IDS) {
    const uniform = TEAM_PALETTES[teamId].uniform;
    expect(uniform.pants).toBe(uniform.jersey);
    expect(uniform.socks).toBe(uniform.jersey);
    expect(uniform.numbers).toBe("#ffffff");
    expect(uniform.trim).toBe("#ffffff");
  }
});
```

- [ ] **Step 2: Run the focused test and confirm failure.**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- src/config/teams.test.ts`

Expected: FAIL because the current pants, socks, and trim values differ from the jersey values.

- [ ] **Step 3: Apply the minimal palette update.**

```ts
home: {
  // Existing id/displayName/shortName/iconColor remain unchanged.
  uniform: {
    jersey: "#1267d8",
    pants: "#1267d8",
    socks: "#1267d8",
    numbers: "#ffffff",
    trim: "#ffffff"
  }
},
away: {
  // Existing id/displayName/shortName/iconColor remain unchanged.
  uniform: {
    jersey: "#b3132b",
    pants: "#b3132b",
    socks: "#b3132b",
    numbers: "#ffffff",
    trim: "#ffffff"
  }
}
```

- [ ] **Step 4: Run the focused test and the core package suite.**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- src/config/teams.test.ts`

Expected: PASS.

Run: `npm.cmd run test --workspace @bbh/arcade-core`

Expected: PASS.

- [ ] **Step 5: Commit the palette slice.**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- packages/arcade-core/src/config/teams.ts packages/arcade-core/src/config/teams.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'feat: use full team-color uniforms'
```

### Task 2: Color only semantic GLB uniform materials

**Files:**
- Create: `packages/arcade-client/src/render/gltf/uniformMaterials.ts`
- Create: `packages/arcade-client/src/render/gltf/uniformMaterials.test.ts`
- Modify: `packages/arcade-client/src/render/gltf/GltfSkaterBody.tsx`

**Interfaces:**
- Consumes: a Three.js `Object3D`, `UniformPalette`, and mesh/material names from the GLB.
- Produces: `applyUniformMaterialColor(root, palette): boolean`, which returns `true` only when it recolored at least one semantic uniform material.

- [ ] **Step 1: Write failing classifier and material-isolation tests.**

```ts
it.each(["uniform_jersey", "Jersey", "pants_mesh", "team-socks"]) (
  "recognizes %s as uniform cloth",
  (name) => expect(isUniformMaterialName(name)).toBe(true)
);

it.each(["face", "skin", "gear_gloves", "skates", "stick", "visor"]) (
  "does not recognize %s as uniform cloth",
  (name) => expect(isUniformMaterialName(name)).toBe(false)
);

it("colors uniform materials at full primary color without changing gear", () => {
  const root = fixtureGroup({ uniform_jersey: "#d0d0d0", gear_gloves: "#20242b" });
  expect(applyUniformMaterialColor(root, TEAM_PALETTES.home.uniform)).toBe(true);
  expect(material(root, "uniform_jersey").color.getStyle()).toBe("rgb(18,103,216)");
  expect(material(root, "gear_gloves").color.getStyle()).toBe("rgb(32,36,43)");
});
```

- [ ] **Step 2: Run the focused test and confirm failure.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/render/gltf/uniformMaterials.test.ts`

Expected: FAIL because `uniformMaterials.ts` does not exist.

- [ ] **Step 3: Implement the pure classifier and color applicator.**

```ts
const UNIFORM_NAME = /(?:^|[_\s-])(uniform|jersey|sweater|shirt|pants|trousers|sock)(?:$|[_\s-])/i;

export function isUniformMaterialName(name: string): boolean {
  return UNIFORM_NAME.test(name);
}

export function applyUniformMaterialColor(
  root: Object3D,
  palette: Pick<UniformPalette, "jersey">
): boolean {
  let changed = false;
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      if (!isUniformMaterialName(`${node.name} ${material.name}`)) continue;
      material.color.set(palette.jersey);
      changed = true;
    }
  });
  return changed;
}
```

- [ ] **Step 4: Change `GltfSkaterBody` to require semantic cloth.** Clone each existing `MeshStandardMaterial` as it does today, preserve every non-uniform material, call the helper after cloning, and throw `new Error("GLB skater has no named uniform materials")` when it returns `false`. The existing `ModelErrorBoundary` catches that error and renders `BlockoutBody`, which is already fully palette-driven. Remove `lerp(jersey, 0.55)`; it is the cause of the muddy mixed colors.

- [ ] **Step 5: Run focused tests and the client renderer tests.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/render/gltf/uniformMaterials.test.ts src/render/headgearColor.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the GLB isolation slice.**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- packages/arcade-client/src/render/gltf/uniformMaterials.ts packages/arcade-client/src/render/gltf/uniformMaterials.test.ts packages/arcade-client/src/render/gltf/GltfSkaterBody.tsx
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'feat: apply full team colors to GLB uniforms'
```

### Task 3: Verify procedural skaters and goalies preserve the new color blocking

**Files:**
- Modify: `packages/arcade-client/src/render/CharacterModel.tsx` (comments only if they still describe a white helmet)
- Modify: `packages/arcade-client/src/render/GoalieModel.tsx` (comments only if they still describe a white mask)
- Modify: `packages/arcade-client/src/render/headgearColor.test.ts`
- Verify: `packages/arcade-client/src/render/Scene.tsx`

**Interfaces:**
- Consumes: palette contract from Task 1 and `getHeadgearColor(palette)`.
- Produces: consistent procedural fallback and goalie jersey/helmet presentation without changing pad/cage colors.

- [ ] **Step 1: Write a failing combined-uniform assertion.**

```ts
it("keeps each procedural helmet aligned with its full uniform primary color", () => {
  for (const teamId of ["home", "away"] as const) {
    const uniform = TEAM_PALETTES[teamId].uniform;
    expect(getHeadgearColor(uniform)).toBe(uniform.jersey);
    expect(uniform.pants).toBe(uniform.jersey);
    expect(uniform.socks).toBe(uniform.jersey);
  }
});
```

- [ ] **Step 2: Run the test and confirm it passes after Task 1.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/render/headgearColor.test.ts`

Expected: PASS; this is a regression test proving the renderer inputs are consistent.

- [ ] **Step 3: Remove stale visual comments only.** Replace comments that call team-colored helmets or goalie mask shells “white”; do not change procedural face, visor, black glove/skate/stick, white pad, or cage materials.

- [ ] **Step 4: Run release checks and manual browser QA.**

Run: `npm.cmd run test:arcade`

Expected: PASS.

Run: `npm.cmd run typecheck`

Expected: PASS.

Run: `npm.cmd run build --workspace @bbh/arcade-client`

Expected: PASS.

Manual check: start a 3v3 match and confirm every blue skater has blue jersey/pants/socks/helmet, every red skater has red jersey/pants/socks/helmet, white numbers remain readable, black hard gear is unchanged, and both goalies have matching jersey/helmet with white pads.

- [ ] **Step 5: Commit verification cleanup.**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- packages/arcade-client/src/render/CharacterModel.tsx packages/arcade-client/src/render/GoalieModel.tsx packages/arcade-client/src/render/headgearColor.test.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'test: verify full team uniform colors'
```
