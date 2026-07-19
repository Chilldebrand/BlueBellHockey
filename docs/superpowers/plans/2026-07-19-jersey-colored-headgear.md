# Jersey-Colored Headgear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every skater helmet and goalie mask shell use the wearer’s jersey color.

**Architecture:** Add one small, typed headgear-color helper that maps an existing uniform palette to its jersey color. Both procedural renderers consume that helper, while visors, cages, pads, and other gear retain their existing colors.

**Tech Stack:** TypeScript, React Three Fiber/Three.js, Vitest, Vite.

## Global Constraints

- Reuse the existing `palette.jersey` values; do not add new team-color constants or props.
- Keep visors, cages, straps, face, pads, and other protective details unchanged.
- Preserve the existing GLB/fallback renderer behavior.

---

### Task 1: Add the headgear color regression test

**Files:**
- Create: `packages/arcade-client/src/render/headgearColor.test.ts`
- Create: `packages/arcade-client/src/render/headgearColor.ts` (created in Task 2)

**Interfaces:**
- Consumes: `TEAM_PALETTES` from `@bbh/arcade-core`.
- Produces: the required `getHeadgearColor` contract for Task 2: `(palette: Pick<UniformPalette, "jersey">) => string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { TEAM_PALETTES } from "@bbh/arcade-core";
import { getHeadgearColor } from "./headgearColor.js";

describe("getHeadgearColor", () => {
  it("uses the home jersey color for home headgear", () => {
    expect(getHeadgearColor(TEAM_PALETTES.home.uniform)).toBe(
      TEAM_PALETTES.home.uniform.jersey
    );
  });

  it("uses the away jersey color for away headgear", () => {
    expect(getHeadgearColor(TEAM_PALETTES.away.uniform)).toBe(
      TEAM_PALETTES.away.uniform.jersey
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails for the missing feature**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- headgearColor.test.ts`

Expected: FAIL because `packages/arcade-client/src/render/headgearColor.ts` does not exist yet.

### Task 2: Wire jersey colors into skater and goalie headgear

**Files:**
- Create: `packages/arcade-client/src/render/headgearColor.ts`
- Modify: `packages/arcade-client/src/render/CharacterModel.tsx` (helmet shell and both ear guards)
- Modify: `packages/arcade-client/src/render/GoalieModel.tsx` (goalie mask shell surfaces)

**Interfaces:**
- Consumes: `UniformPalette` from `@bbh/arcade-core`.
- Produces: `getHeadgearColor(palette: Pick<UniformPalette, "jersey">): string`.

- [ ] **Step 1: Implement the smallest passing helper**

```ts
import type { UniformPalette } from "@bbh/arcade-core";

export function getHeadgearColor(
  palette: Pick<UniformPalette, "jersey">
): string {
  return palette.jersey;
}
```

- [ ] **Step 2: Use the helper for the procedural skater helmet**

In `CharacterModel.tsx`, import `getHeadgearColor` and replace only the three white helmet material colors:

```tsx
<meshPhysicalMaterial
  color={getHeadgearColor(palette)}
  roughness={0.14}
  metalness={0.05}
  clearcoat={1}
  clearcoatRoughness={0.08}
/>
```

Apply the same `color={getHeadgearColor(palette)}` expression to both ear-guard `meshPhysicalMaterial` elements. Leave the visor and all face materials unchanged.

- [ ] **Step 3: Use the helper for the procedural goalie mask shell**

In `GoalieModel.tsx`, import `getHeadgearColor` and replace the goalie mask shell’s `color="#f8fafc"` with `color={getHeadgearColor(palette)}`. Leave the white leg pads and blocker/glove details, the gray cage, and the face material unchanged.

- [ ] **Step 4: Run the focused regression test**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- headgearColor.test.ts`

Expected: PASS with 2 tests.

### Task 3: Verify the client and finish the change

**Files:**
- Verify: `packages/arcade-client/src/render/CharacterModel.tsx`
- Verify: `packages/arcade-client/src/render/GoalieModel.tsx`
- Verify: `packages/arcade-client/src/render/headgearColor.ts`
- Verify: `packages/arcade-client/src/render/headgearColor.test.ts`

**Interfaces:**
- Consumes: the passing headgear regression test and renderer updates from Tasks 1–2.
- Produces: a type-safe production client build with jersey-colored skater helmets and goalie masks.

- [ ] **Step 1: Run the full arcade-client test suite**

Run: `npm.cmd run test --workspace @bbh/arcade-client`

Expected: all client tests pass.

- [ ] **Step 2: Run the repository typecheck**

Run: `npm.cmd run typecheck`

Expected: TypeScript completes without errors.

- [ ] **Step 3: Build the production client**

Run: `npm.cmd run build --workspace @bbh/arcade-client`

Expected: Vite completes successfully and writes the client bundle.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check; git diff -- packages/arcade-client/src/render/CharacterModel.tsx packages/arcade-client/src/render/GoalieModel.tsx packages/arcade-client/src/render/headgearColor.ts packages/arcade-client/src/render/headgearColor.test.ts`

Expected: no whitespace errors; the diff contains only the helper, focused test, and requested helmet/mask color changes.

- [ ] **Step 5: Commit the implementation**

```bash
git add packages/arcade-client/src/render/CharacterModel.tsx packages/arcade-client/src/render/GoalieModel.tsx packages/arcade-client/src/render/headgearColor.ts packages/arcade-client/src/render/headgearColor.test.ts docs/superpowers/plans/2026-07-19-jersey-colored-headgear.md
git commit -m "feat: match headgear to jersey colors"
```
