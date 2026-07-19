import type { UniformPalette } from "@bbh/arcade-core";

export function getHeadgearColor(
  palette: Pick<UniformPalette, "jersey">
): string {
  return palette.jersey;
}
