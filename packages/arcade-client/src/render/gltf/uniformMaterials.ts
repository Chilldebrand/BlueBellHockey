import type { UniformPalette } from "@bbh/arcade-core";
import { Mesh, MeshStandardMaterial, type Object3D } from "three";

const UNIFORM_TOKEN = /(^|[_\s-])(uniform|jersey|sweater|shirt|pants|trousers|socks?)(?=$|[_\s-])/i;

export function isUniformMaterialName(name: string): boolean {
  return UNIFORM_TOKEN.test(name);
}

export function applyUniformMaterialColor(
  root: Object3D,
  palette: UniformPalette
): boolean {
  let recolored = false;

  root.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) {
        continue;
      }

      const semanticName = `${node.name} ${material.name}`.trim();
      if (!isUniformMaterialName(semanticName)) {
        continue;
      }

      material.color.set(palette.jersey);
      recolored = true;
    }
  });

  return recolored;
}
