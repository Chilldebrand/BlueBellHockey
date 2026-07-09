import type { CharacterId } from "../../config/characters.js";
import type { SkaterEntity } from "../types.js";

export type BotTendency =
  | "attack"
  | "support"
  | "safety"
  | "net-drive"
  | "shooter"
  | "checker";

const TENDENCY_BY_CHARACTER_ID: Readonly<Record<CharacterId, BotTendency>> = {
  "rook-rocket": "attack",
  "nova-screen": "net-drive",
  "dash-iron": "checker",
  "luna-thread": "support",
  "kip-hook": "checker",
  "vex-rebound": "net-drive",
  "axel-laser": "shooter",
  "zara-crush": "checker",
  "milo-ghost": "attack",
  "tess-flash": "safety",
  "orin-pads": "safety",
  "mira-wall": "safety"
};

/** Character flavor biases choices, while neutral support remains the fallback. */
export function tendencyForSkater(skater: SkaterEntity): BotTendency {
  return TENDENCY_BY_CHARACTER_ID[skater.characterId] ?? "support";
}
