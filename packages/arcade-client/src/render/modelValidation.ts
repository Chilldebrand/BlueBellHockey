export type CharacterModelRole = "skater" | "goalie";

export interface ModelProportions {
  readonly headScale: number;
  readonly bodyHeight: number;
  readonly handScale: number;
  readonly footScale: number;
}

export interface CharacterModelManifest {
  readonly id: string;
  readonly role: CharacterModelRole;
  readonly displayName: string;
  readonly assetPath: string;
  readonly proportions: ModelProportions;
  readonly bones: readonly string[];
  readonly attachments: Readonly<Record<string, string>>;
  readonly materialSlots: {
    readonly uniform: readonly string[];
    readonly characterGear: readonly string[];
  };
  readonly animationClips: readonly string[];
}

export interface ModelValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export const REQUIRED_MODEL_BONES = [
  "root",
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  "upper_arm_l",
  "lower_arm_l",
  "hand_l",
  "upper_arm_r",
  "lower_arm_r",
  "hand_r",
  "upper_leg_l",
  "lower_leg_l",
  "skate_l",
  "upper_leg_r",
  "lower_leg_r",
  "skate_r"
] as const;

export const REQUIRED_ATTACHMENTS = [
  "stick_hand",
  "stick_blade",
  "puck_blade",
  "nameplate"
] as const;

export const REQUIRED_UNIFORM_SLOTS = [
  "uniform_jersey",
  "uniform_pants",
  "uniform_socks",
  "uniform_numbers",
  "uniform_trim"
] as const;

export const REQUIRED_GEAR_SLOTS = [
  "gear_helmet",
  "gear_gloves",
  "gear_skates",
  "gear_stick"
] as const;

export const REQUIRED_SKATER_ANIMATION_CLIPS = [
  "idle_ready",
  "skate_forward",
  "hard_turn",
  "turbo_skate",
  "pass",
  "wrist_shot",
  "charged_shot",
  "check",
  "stumble",
  "knockdown",
  "get_up",
  "juke",
  "celebrate_goal"
] as const;

export const REQUIRED_GOALIE_ANIMATION_CLIPS = [
  "goalie_ready",
  "goalie_slide",
  "pad_save",
  "glove_save",
  "blocker_save",
  "body_save",
  "cover",
  "reset_ready"
] as const;

export function validateModelManifest(
  manifest: CharacterModelManifest,
  expectedRole: CharacterModelRole
): ModelValidationResult {
  const errors: string[] = [];

  if (!manifest.id.trim()) {
    errors.push("id is required");
  }

  if (manifest.role !== expectedRole) {
    errors.push(`role must be ${expectedRole}`);
  }

  if (!manifest.assetPath.startsWith("/arcade/models/")) {
    errors.push("assetPath must live under /arcade/models/");
  }

  if (manifest.proportions.headScale < 1.45) {
    errors.push("headScale must preserve the big-head silhouette");
  }

  if (manifest.proportions.bodyHeight < 55) {
    errors.push("bodyHeight must be tall enough to read above the ice");
  }

  requireEvery(REQUIRED_MODEL_BONES, manifest.bones, "bone", errors);
  requireEvery(
    REQUIRED_ATTACHMENTS,
    Object.keys(manifest.attachments),
    "attachment",
    errors
  );
  requireEvery(
    REQUIRED_UNIFORM_SLOTS,
    manifest.materialSlots.uniform,
    "uniform material slot",
    errors
  );
  requireEvery(
    REQUIRED_GEAR_SLOTS,
    manifest.materialSlots.characterGear,
    "character gear material slot",
    errors
  );
  requireEvery(
    expectedRole === "goalie"
      ? REQUIRED_GOALIE_ANIMATION_CLIPS
      : REQUIRED_SKATER_ANIMATION_CLIPS,
    manifest.animationClips,
    "animation clip",
    errors
  );

  const overlappingSlots = manifest.materialSlots.uniform.filter((slot) =>
    manifest.materialSlots.characterGear.includes(slot)
  );
  if (overlappingSlots.length > 0) {
    errors.push(
      `uniform slots must be separate from character gear: ${overlappingSlots.join(
        ", "
      )}`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function requireEvery(
  required: readonly string[],
  actual: readonly string[],
  label: string,
  errors: string[]
): void {
  for (const value of required) {
    if (!actual.includes(value)) {
      errors.push(`missing ${label}: ${value}`);
    }
  }
}
