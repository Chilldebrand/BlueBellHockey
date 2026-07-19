import { describe, expect, it } from "vitest";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { TEAM_PALETTES } from "@bbh/arcade-core";
import {
  applyUniformMaterialColor,
  isUniformMaterialName
} from "./uniformMaterials.js";

describe("isUniformMaterialName", () => {
  it("recognizes semantic uniform cloth names and rejects non-uniform gear", () => {
    expect(isUniformMaterialName("uniform_jersey")).toBe(true);
    expect(isUniformMaterialName("Jersey")).toBe(true);
    expect(isUniformMaterialName("pants_mesh")).toBe(true);
    expect(isUniformMaterialName("team-socks")).toBe(true);

    expect(isUniformMaterialName("face")).toBe(false);
    expect(isUniformMaterialName("skin")).toBe(false);
    expect(isUniformMaterialName("gear_gloves")).toBe(false);
    expect(isUniformMaterialName("skates")).toBe(false);
    expect(isUniformMaterialName("stick")).toBe(false);
    expect(isUniformMaterialName("visor")).toBe(false);
  });
});

describe("applyUniformMaterialColor", () => {
  it("colors semantic uniform materials without changing gear", () => {
    const root = new Group();
    const jersey = new MeshStandardMaterial({ color: "#808080" });
    jersey.name = "uniform_jersey";
    const gloves = new MeshStandardMaterial({ color: "#202020" });
    gloves.name = "gear_gloves";

    root.add(createMesh("body", jersey));
    root.add(createMesh("hands", gloves));

    expect(applyUniformMaterialColor(root, TEAM_PALETTES.home.uniform)).toBe(true);
    expect(jersey.color.getStyle()).toBe(
      new MeshStandardMaterial({
        color: TEAM_PALETTES.home.uniform.jersey
      }).color.getStyle()
    );
    expect(gloves.color.getStyle()).toBe("rgb(32,32,32)");
  });

  it("returns false when no semantic uniform cloth is present", () => {
    const root = new Group();
    const gloves = new MeshStandardMaterial({ color: "#202020" });
    gloves.name = "gear_gloves";
    root.add(createMesh("hands", gloves));

    expect(applyUniformMaterialColor(root, TEAM_PALETTES.home.uniform)).toBe(false);
    expect(gloves.color.getStyle()).toBe("rgb(32,32,32)");
  });
});

function createMesh(name: string, material: MeshStandardMaterial): Mesh {
  const mesh = new Mesh();
  mesh.name = name;
  mesh.material = material;
  return mesh;
}
