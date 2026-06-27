import { getArcadeCoreInfo } from "@bbh/arcade-core";

export interface ArcadeServerInfo {
  readonly name: string;
  readonly coreVersion: string;
}

export function getArcadeServerInfo(): ArcadeServerInfo {
  const coreInfo = getArcadeCoreInfo();

  return {
    name: "@bbh/arcade-server",
    coreVersion: coreInfo.version
  };
}

if (process.env.NODE_ENV !== "test") {
  const serverInfo = getArcadeServerInfo();
  console.log(`${serverInfo.name} ready with core ${serverInfo.coreVersion}`);
}
