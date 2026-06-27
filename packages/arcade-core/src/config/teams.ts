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

export const TEAM_PALETTES: Record<TeamId, TeamPalette> = {
  home: {
    id: "home",
    displayName: "Blue Blades",
    shortName: "BLU",
    iconColor: "#1f8fff",
    uniform: {
      jersey: "#1267d8",
      pants: "#082b63",
      socks: "#eaf6ff",
      numbers: "#ffffff",
      trim: "#ffd95a"
    }
  },
  away: {
    id: "away",
    displayName: "Red Rockets",
    shortName: "RED",
    iconColor: "#ff4f5e",
    uniform: {
      jersey: "#3b0714",
      pants: "#1f0610",
      socks: "#fff1f2",
      numbers: "#ffffff",
      trim: "#72f1d1"
    }
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
