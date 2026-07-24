export const TEAM_IDS = ["home", "away"] as const;

export type TeamId = (typeof TEAM_IDS)[number];

export interface UniformPalette {
  readonly jersey: string;
  readonly pants: string;
  readonly socks: string;
  readonly numbers: string;
  readonly trim: string;
}

export interface TeamPalette {
  readonly id: TeamId;
  readonly displayName: string;
  readonly shortName: string;
  readonly iconColor: string;
  readonly uniform: UniformPalette;
}

export interface SkaterSlot {
  readonly id: string;
  readonly teamId: TeamId;
  readonly index: number;
}

export interface GoalieSlot {
  readonly id: string;
  readonly teamId: TeamId;
  readonly owner: "server";
}

export const SKATER_SLOTS = [
  { id: "home-skater-1", teamId: "home", index: 0 },
  { id: "home-skater-2", teamId: "home", index: 1 },
  { id: "home-skater-3", teamId: "home", index: 2 },
  { id: "away-skater-1", teamId: "away", index: 0 },
  { id: "away-skater-2", teamId: "away", index: 1 },
  { id: "away-skater-3", teamId: "away", index: 2 }
] as const satisfies readonly SkaterSlot[];

export const GOALIE_SLOTS = [
  { id: "home-goalie", teamId: "home", owner: "server" },
  { id: "away-goalie", teamId: "away", owner: "server" }
] as const satisfies readonly GoalieSlot[];

export const TEAM_IDENTITY_IDS = [
  "blue-blades",
  "red-rockets",
  "green-glaciers",
  "gold-gauntlets",
  "purple-phantoms",
  "orange-outlaws",
  "cyan-cyclones",
  "black-bandits"
] as const;

export type TeamIdentityId = (typeof TEAM_IDENTITY_IDS)[number];

/**
 * A selectable team skin: name + colors. The SIM never sees identities —
 * home/away stay the only team ids it knows. Captains pick an identity for
 * their side in the lobby; the choice replicates as room state and drives
 * every presentation surface (uniforms, lobby, scoreboard, postgame).
 */
export interface TeamIdentity {
  readonly id: TeamIdentityId;
  readonly displayName: string;
  readonly shortName: string;
  readonly iconColor: string;
  readonly uniform: UniformPalette;
}

const solidUniform = (
  jersey: string,
  numbers = "#ffffff",
  trim = numbers
): UniformPalette => ({
  jersey,
  pants: jersey,
  socks: jersey,
  numbers,
  trim
});

export const TEAM_IDENTITIES: Record<TeamIdentityId, TeamIdentity> = {
  "blue-blades": {
    id: "blue-blades",
    displayName: "Blue Blades",
    shortName: "BLU",
    iconColor: "#1f8fff",
    uniform: solidUniform("#1267d8")
  },
  "red-rockets": {
    id: "red-rockets",
    displayName: "Red Rockets",
    shortName: "RED",
    iconColor: "#ff4f5e",
    uniform: solidUniform("#b3132b")
  },
  "green-glaciers": {
    id: "green-glaciers",
    displayName: "Green Glaciers",
    shortName: "GRN",
    iconColor: "#2fd071",
    uniform: solidUniform("#0f7a3d")
  },
  "gold-gauntlets": {
    id: "gold-gauntlets",
    displayName: "Gold Gauntlets",
    shortName: "GLD",
    iconColor: "#ffc93c",
    // Dark numbers: white on gold fails the readability contrast bar.
    uniform: solidUniform("#d8a412", "#151515")
  },
  "purple-phantoms": {
    id: "purple-phantoms",
    displayName: "Purple Phantoms",
    shortName: "PRP",
    iconColor: "#a05df0",
    uniform: solidUniform("#6a2fb8")
  },
  "orange-outlaws": {
    id: "orange-outlaws",
    displayName: "Orange Outlaws",
    shortName: "ORG",
    iconColor: "#ff7a2f",
    uniform: solidUniform("#d8560f")
  },
  "cyan-cyclones": {
    id: "cyan-cyclones",
    displayName: "Cyan Cyclones",
    shortName: "CYN",
    iconColor: "#22d3ee",
    uniform: solidUniform("#0891a6")
  },
  "black-bandits": {
    id: "black-bandits",
    displayName: "Black Bandits",
    shortName: "BLK",
    iconColor: "#aab4c8",
    uniform: solidUniform("#1c2230")
  }
};

export function isTeamIdentityId(value: unknown): value is TeamIdentityId {
  return (
    typeof value === "string" &&
    (TEAM_IDENTITY_IDS as readonly string[]).includes(value)
  );
}

/** Fresh rooms and Free Skate wear these — today's classic blue vs red. */
export const DEFAULT_TEAM_IDENTITIES: Record<TeamId, TeamIdentityId> = {
  home: "blue-blades",
  away: "red-rockets"
};

/** Identity for a side, tolerating absent/invalid replicated ids. */
export function teamIdentityFor(
  teamId: TeamId,
  identityId?: string | null
): TeamIdentity {
  return isTeamIdentityId(identityId ?? "")
    ? TEAM_IDENTITIES[identityId as TeamIdentityId]
    : TEAM_IDENTITIES[DEFAULT_TEAM_IDENTITIES[teamId]];
}

/**
 * Legacy default palettes keyed by side. Derived from the identity catalog
 * so unconverted call sites (and Free Skate) keep today's exact look.
 */
export const TEAM_PALETTES: Record<TeamId, TeamPalette> = {
  home: {
    ...TEAM_IDENTITIES[DEFAULT_TEAM_IDENTITIES.home],
    id: "home"
  },
  away: {
    ...TEAM_IDENTITIES[DEFAULT_TEAM_IDENTITIES.away],
    id: "away"
  }
};

export function contrastRatio(hexA: string, hexB: string): number {
  const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
  const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
