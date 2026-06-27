export const SPECIAL_IDS = [
  "rocket-burst",
  "screen-spark",
  "wall-check",
  "thread-pass",
  "ice-hook",
  "rebound-rain",
  "blue-line-laser",
  "corner-crush",
  "crease-ghost",
  "glove-flash",
  "pad-surge",
  "mask-focus"
] as const;

export type SpecialId = (typeof SPECIAL_IDS)[number];

export interface CharacterSpecial {
  readonly id: SpecialId;
  readonly name: string;
  readonly description: string;
}

export const CHARACTER_SPECIALS = [
  {
    id: "rocket-burst",
    name: "Rocket Burst",
    description: "A short straight-line speed surge for breakaways."
  },
  {
    id: "screen-spark",
    name: "Screen Spark",
    description: "Creates a brief net-front screen for quick shots."
  },
  {
    id: "wall-check",
    name: "Wall Check",
    description: "A heavier shoulder check with extra puck strip force."
  },
  {
    id: "thread-pass",
    name: "Thread Pass",
    description: "Boosts pass assist through tight lanes."
  },
  {
    id: "ice-hook",
    name: "Ice Hook",
    description: "Extends stick reach for one loose-puck grab."
  },
  {
    id: "rebound-rain",
    name: "Rebound Rain",
    description: "Turns the next hard shot into a livelier rebound."
  },
  {
    id: "blue-line-laser",
    name: "Blue-Line Laser",
    description: "Charges a long-range shot faster."
  },
  {
    id: "corner-crush",
    name: "Corner Crush",
    description: "Wins board battles with a short power shove."
  },
  {
    id: "crease-ghost",
    name: "Crease Ghost",
    description: "Briefly improves net-front handling."
  },
  {
    id: "glove-flash",
    name: "Glove Flash",
    description: "Goalie-style flash save energy for defensive blocks."
  },
  {
    id: "pad-surge",
    name: "Pad Surge",
    description: "A sliding block burst when defending the slot."
  },
  {
    id: "mask-focus",
    name: "Mask Focus",
    description: "Reduces stumble time after a heavy hit."
  }
] as const satisfies readonly CharacterSpecial[];

export function isSpecialId(value: string): value is SpecialId {
  return SPECIAL_IDS.includes(value as SpecialId);
}
