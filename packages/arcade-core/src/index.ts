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

export * from "./config/match.js";
export * from "./config/rink.js";
export * from "./config/teams.js";
export * from "./net/messages.js";
export * from "./sim/types.js";
export * from "./sim/world.js";
