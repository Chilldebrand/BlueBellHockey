import { describe, expect, it } from "vitest";
import { FIRST_SKATER_MODEL_MANIFEST } from "./skaterManifest.js";
import { FIRST_GOALIE_MODEL_MANIFEST } from "./GoalieModel.js";
import {
  REQUIRED_SKATER_ANIMATION_CLIPS,
  validateModelManifest,
  type CharacterModelManifest
} from "./modelValidation.js";

describe("character model validation", () => {
  it("accepts the first original skater and goalie manifests", () => {
    expect(validateModelManifest(FIRST_SKATER_MODEL_MANIFEST, "skater")).toEqual({
      valid: true,
      errors: []
    });
    expect(validateModelManifest(FIRST_GOALIE_MODEL_MANIFEST, "goalie")).toEqual({
      valid: true,
      errors: []
    });
  });

  it("rejects incomplete character definitions", () => {
    const incomplete: CharacterModelManifest = {
      ...FIRST_SKATER_MODEL_MANIFEST,
      assetPath: "rook-rocket.glb",
      bones: FIRST_SKATER_MODEL_MANIFEST.bones.filter((bone) => bone !== "head"),
      animationClips: REQUIRED_SKATER_ANIMATION_CLIPS.filter(
        (clip) => clip !== "charged_shot"
      )
    };

    const result = validateModelManifest(incomplete, "skater");

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("assetPath must live under /arcade/models/");
    expect(result.errors).toContain("missing bone: head");
    expect(result.errors).toContain("missing animation clip: charged_shot");
  });

  it("keeps uniform recolor slots separate from character-owned gear", () => {
    const overlapping: CharacterModelManifest = {
      ...FIRST_SKATER_MODEL_MANIFEST,
      materialSlots: {
        uniform: FIRST_SKATER_MODEL_MANIFEST.materialSlots.uniform,
        characterGear: [
          ...FIRST_SKATER_MODEL_MANIFEST.materialSlots.characterGear,
          "uniform_jersey"
        ]
      }
    };

    const result = validateModelManifest(overlapping, "skater");

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "uniform slots must be separate from character gear: uniform_jersey"
    );
  });
});
