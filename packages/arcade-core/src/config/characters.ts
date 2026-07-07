import { isSpecialId, type SpecialId } from "./specials.js";
import type { SkaterSlot } from "./teams.js";

export const CHARACTER_STAT_KEYS = [
  "speed",
  "power",
  "handling",
  "shot",
  "pass",
  "balance"
] as const;

export type CharacterStatKey = (typeof CHARACTER_STAT_KEYS)[number];
export type CharacterStats = Record<CharacterStatKey, number>;

export const CHARACTER_IDS = [
  "rook-rocket",
  "nova-screen",
  "dash-iron",
  "luna-thread",
  "kip-hook",
  "vex-rebound",
  "axel-laser",
  "zara-crush",
  "milo-ghost",
  "tess-flash",
  "orin-pads",
  "mira-wall"
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export interface ArcadeCharacter {
  readonly id: CharacterId;
  readonly displayName: string;
  readonly silhouette: string;
  readonly specialId: SpecialId;
  readonly stats: CharacterStats;
  /** Number worn on the jersey back (unique across the cast). */
  readonly jerseyNumber: number;
  readonly modelId: string;
  readonly gearSlots: readonly string[];
}

export const CHARACTER_STAT_BUDGET = 20;

/** Jersey numbers, one per character (rendered with the surname on the back). */
const JERSEY_NUMBERS: Record<CharacterId, number> = {
  "rook-rocket": 9,
  "nova-screen": 21,
  "dash-iron": 44,
  "luna-thread": 7,
  "kip-hook": 13,
  "vex-rebound": 89,
  "axel-laser": 4,
  "zara-crush": 55,
  "milo-ghost": 47,
  "tess-flash": 3,
  "orin-pads": 27,
  "mira-wall": 33
};

export const ARCADE_CHARACTERS = [
  character("rook-rocket", "Rook Rocket", "compact speedster", "rocket-burst", {
    speed: 5,
    power: 2,
    handling: 4,
    shot: 3,
    pass: 4,
    balance: 2
  }),
  character("nova-screen", "Nova Screen", "wide net-front forward", "screen-spark", {
    speed: 3,
    power: 4,
    handling: 3,
    shot: 4,
    pass: 2,
    balance: 4
  }),
  character("dash-iron", "Dash Iron", "square-shouldered checker", "wall-check", {
    speed: 3,
    power: 5,
    handling: 2,
    shot: 3,
    pass: 2,
    balance: 5
  }),
  character("luna-thread", "Luna Thread", "lean passing ace", "thread-pass", {
    speed: 4,
    power: 2,
    handling: 4,
    shot: 2,
    pass: 5,
    balance: 3
  }),
  character("kip-hook", "Kip Hook", "low-stance puck thief", "ice-hook", {
    speed: 4,
    power: 3,
    handling: 5,
    shot: 2,
    pass: 3,
    balance: 3
  }),
  character("vex-rebound", "Vex Rebound", "crease-crashing shooter", "rebound-rain", {
    speed: 3,
    power: 4,
    handling: 3,
    shot: 5,
    pass: 2,
    balance: 3
  }),
  character("axel-laser", "Axel Laser", "tall blue-line bomber", "blue-line-laser", {
    speed: 2,
    power: 4,
    handling: 2,
    shot: 5,
    pass: 4,
    balance: 3
  }),
  character("zara-crush", "Zara Crush", "corner-board bruiser", "corner-crush", {
    speed: 2,
    power: 5,
    handling: 3,
    shot: 3,
    pass: 3,
    balance: 4
  }),
  character("milo-ghost", "Milo Ghost", "slippery slot cutter", "crease-ghost", {
    speed: 5,
    power: 2,
    handling: 5,
    shot: 3,
    pass: 3,
    balance: 2
  }),
  character("tess-flash", "Tess Flash", "defensive glove-hand skater", "glove-flash", {
    speed: 3,
    power: 3,
    handling: 3,
    shot: 2,
    pass: 4,
    balance: 5
  }),
  character("orin-pads", "Orin Pads", "slot-blocking defender", "pad-surge", {
    speed: 2,
    power: 4,
    handling: 2,
    shot: 3,
    pass: 4,
    balance: 5
  }),
  character("mira-wall", "Mira Wall", "goalie-inspired stopper", "mask-focus", {
    speed: 3,
    power: 3,
    handling: 3,
    shot: 3,
    pass: 3,
    balance: 5
  })
] as const satisfies readonly ArcadeCharacter[];

export const DEFAULT_CHARACTER_ID: CharacterId = "rook-rocket";

export function isCharacterId(value: string): value is CharacterId {
  return CHARACTER_IDS.includes(value as CharacterId);
}

export function getCharacterById(id: CharacterId): ArcadeCharacter {
  return ARCADE_CHARACTERS.find((character) => character.id === id) ?? ARCADE_CHARACTERS[0];
}

/**
 * Deterministic default character for a slot (used when no roster picks exist,
 * e.g. Free Skate and bare createWorld calls): fans the cast so the two teams
 * don't mirror each other.
 */
export function defaultCharacterIdForSlot(
  slot: Pick<SkaterSlot, "teamId" | "index">
): CharacterId {
  const offset = slot.teamId === "away" ? 3 : 0;
  return (
    ARCADE_CHARACTERS[(slot.index + offset) % ARCADE_CHARACTERS.length]?.id ??
    DEFAULT_CHARACTER_ID
  );
}

export function characterStatTotal(stats: CharacterStats): number {
  return CHARACTER_STAT_KEYS.reduce((total, key) => total + stats[key], 0);
}

function character(
  id: CharacterId,
  displayName: string,
  silhouette: string,
  specialId: SpecialId,
  stats: CharacterStats
): ArcadeCharacter {
  if (!isSpecialId(specialId)) {
    throw new Error(`Unknown special id: ${specialId}`);
  }

  return {
    id,
    displayName,
    silhouette,
    specialId,
    stats,
    jerseyNumber: JERSEY_NUMBERS[id],
    modelId: id,
    gearSlots: ["gear_helmet", "gear_gloves", "gear_skates", "gear_stick"]
  };
}
