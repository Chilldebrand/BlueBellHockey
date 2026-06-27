import { describe, expect, it } from "vitest";
import {
  clipForGoalieState,
  clipForSkaterState,
  GOALIE_CLIP_MAP,
  SKATER_CLIP_MAP,
  validateGoalieClipCoverage,
  validateSkaterClipCoverage
} from "./clipMap.js";

describe("animation clip maps", () => {
  it("maps every required skater and goalie state to a role-specific clip", () => {
    expect(SKATER_CLIP_MAP.check).toBe("check");
    expect(SKATER_CLIP_MAP.wristShot).toBe("wrist_shot");
    expect(SKATER_CLIP_MAP.down).toBe("knockdown");
    expect(GOALIE_CLIP_MAP.padSave).toBe("pad_save");
    expect(GOALIE_CLIP_MAP.cover).toBe("cover");
    expect(Object.values(SKATER_CLIP_MAP)).not.toContain("pad_save");
    expect(Object.values(GOALIE_CLIP_MAP)).not.toContain("check");
  });

  it("uses approved fallback clips when optional clips are missing", () => {
    expect(clipForSkaterState("chargeShot", ["wrist_shot"])).toBe("wrist_shot");
    expect(clipForGoalieState("padSave", ["body_save"])).toBe("body_save");
    expect(validateSkaterClipCoverage(["idle_ready"])).not.toContain(
      "missing celebrate clip without approved fallback: celebrate_goal"
    );
  });

  it("reports missing clips that have no fallback", () => {
    expect(validateSkaterClipCoverage([])).toContain(
      "missing idle clip without approved fallback: idle_ready"
    );
    expect(validateGoalieClipCoverage([])).toContain(
      "missing ready clip without approved fallback: goalie_ready"
    );
  });
});
