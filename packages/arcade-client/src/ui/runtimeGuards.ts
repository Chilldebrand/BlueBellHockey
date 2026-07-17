import type { WorldPhase } from "@bbh/arcade-core";
import type { AppConnectionApi } from "../App.js";

export type AppScreen = "boot" | "menu" | "lobby" | "freeskate";

export function isMenuMusicAllowed(
  screen: AppScreen,
  phase: WorldPhase
): boolean {
  if (screen === "menu") {
    return true;
  }

  if (screen === "lobby") {
    return phase !== "playing";
  }

  return phase === "ended";
}

export function shouldReconnectAfterAudioInit({
  audioReady,
  hasReconnectTicket,
  reconnectPreviousRoom
}: Pick<AppConnectionApi, "reconnectPreviousRoom"> & {
  readonly audioReady: boolean;
  readonly hasReconnectTicket: boolean;
}): boolean {
  return Boolean(audioReady && hasReconnectTicket && reconnectPreviousRoom);
}
