import { describe, expect, it } from "vitest";
import {
  pickPlayableClip,
  resolveGltfClipName,
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
