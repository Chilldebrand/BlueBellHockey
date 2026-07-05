import { describe, expect, it } from "vitest";
import {
  isDedicatedClip,
  pickPlayableClip,
  resolveGltfClipName,
  shouldAdvanceClip,
  type SkaterGltfSource
} from "./skaterGltfSource.js";

const source: SkaterGltfSource = {
  assetPath: "/arcade/models/skaters/example.glb",
  label: "example",
  attribution: "test",
  boneMap: { hips: "root_hips" },
  clipMap: {
    skate_forward: "Walk",
    wrist_shot: "Shoot",
    turbo_skate: null
  },
  baseClip: "Idle",
  rootRotation: [0, 0, 0],
  rootScale: 1,
  yOffset: 0
};

describe("resolveGltfClipName", () => {
  it("returns the mapped clip when one is configured", () => {
    expect(resolveGltfClipName(source, "skate_forward")).toBe("Walk");
    expect(resolveGltfClipName(source, "wrist_shot")).toBe("Shoot");
  });

  it("falls back to the base clip when the map entry is explicit null", () => {
    expect(resolveGltfClipName(source, "turbo_skate")).toBe("Idle");
  });

  it("falls back to the base clip when the clip is unmapped", () => {
    expect(resolveGltfClipName(source, "celebrate_goal")).toBe("Idle");
  });

  it("propagates a null base clip", () => {
    const noBase = { ...source, baseClip: null };
    expect(resolveGltfClipName(noBase, "celebrate_goal")).toBeNull();
  });
});

describe("pickPlayableClip", () => {
  it("plays the mapped clip when the GLB exposes it", () => {
    expect(pickPlayableClip(source, "skate_forward", ["Walk", "Idle"])).toBe(
      "Walk"
    );
  });

  it("falls back to the base clip when the mapped clip is absent", () => {
    expect(pickPlayableClip(source, "skate_forward", ["Idle"])).toBe("Idle");
  });

  it("falls back to the first available clip when nothing matches", () => {
    // Covers exports whose single clip is unnamed / not in the map.
    expect(pickPlayableClip(source, "skate_forward", [""])).toBe("");
  });

  it("returns null when the GLB exposes no clips at all", () => {
    expect(pickPlayableClip(source, "skate_forward", [])).toBeNull();
  });
});

describe("isDedicatedClip", () => {
  it("is true when a mapped clip exists in the GLB", () => {
    expect(isDedicatedClip(source, "skate_forward", ["Walk", "Idle"])).toBe(true);
  });

  it("is false when the state only resolves to the first-available fallback", () => {
    // Walk-only rig: nothing maps 'celebrate_goal', base clip absent.
    const walkOnly = { ...source, clipMap: {}, baseClip: null };
    expect(isDedicatedClip(walkOnly, "celebrate_goal", ["Walk"])).toBe(false);
  });
});

describe("shouldAdvanceClip", () => {
  // Mirrors the CesiumMan placeholder: a single walk clip, nothing mapped.
  const walkOnly: SkaterGltfSource = { ...source, clipMap: {}, baseClip: null };

  it("holds a static pose when idle on a locomotion-only rig", () => {
    expect(shouldAdvanceClip(walkOnly, "idle_ready", "idle", ["Walk"])).toBe(
      false
    );
  });

  it("advances the walk while actually skating", () => {
    expect(
      shouldAdvanceClip(walkOnly, "skate_forward", "skate", ["Walk"])
    ).toBe(true);
  });

  it("advances turbo and hard-turn locomotion states", () => {
    expect(shouldAdvanceClip(walkOnly, "turbo_skate", "turbo", ["Walk"])).toBe(
      true
    );
    expect(shouldAdvanceClip(walkOnly, "hard_turn", "hardTurn", ["Walk"])).toBe(
      true
    );
  });

  it("does not march in place for a non-locomotion action like a pass", () => {
    expect(shouldAdvanceClip(walkOnly, "pass", "pass", ["Walk"])).toBe(false);
  });

  it("advances a dedicated idle clip when the rig has one", () => {
    // Full rig: idle maps to its own clip, so play it as authored.
    const withIdle = {
      ...source,
      clipMap: { ...source.clipMap, idle_ready: "Idle" }
    };
    expect(shouldAdvanceClip(withIdle, "idle_ready", "idle", ["Idle"])).toBe(
      true
    );
  });

  it("advances an idle base clip rather than freezing", () => {
    // `source` has baseClip 'Idle': unmapped idle resolves to it, which is a
    // real standing loop and safe to play.
    expect(shouldAdvanceClip(source, "idle_ready", "idle", ["Idle"])).toBe(
      true
    );
  });
});
