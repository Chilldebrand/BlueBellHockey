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
export * from "./config/powerups.js";
export * from "./config/rink.js";
export * from "./config/characters.js";
export * from "./config/specials.js";
export * from "./config/teams.js";
export * from "./config/tuning.js";
export * from "./net/messages.js";
export * from "./sim/actions.js";
export * from "./sim/ai/bot.js";
export * from "./sim/ai/decision.js";
export * from "./sim/ai/tactics.js";
export * from "./sim/boards.js";
export * from "./sim/collision.js";
export * from "./sim/control.js";
export * from "./sim/gestures.js";
export * from "./sim/net.js";
export * from "./sim/stick.js";
export * from "./sim/goal.js";
export * from "./sim/goalie.js";
export * from "./sim/physics.js";
export * from "./sim/puck.js";
export * from "./sim/powerups.js";
export * from "./sim/skater.js";
export * from "./sim/specials.js";
export * from "./sim/stats.js";
export * from "./sim/types.js";
export * from "./sim/world.js";
