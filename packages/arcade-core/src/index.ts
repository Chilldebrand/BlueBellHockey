export const arcadeCoreVersion = "0.1.0";

export interface ArcadePackageInfo {
  readonly name: string;
  readonly version: string;
}

export function getArcadeCoreInfo(): ArcadePackageInfo {
  return {
    name: "@bbh/arcade-core",
    version: arcadeCoreVersion
  };
}
