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
  readonly chargeRequired: number;
  readonly cooldownMs: number;
  readonly durationMs: number;
}

export const CHARACTER_SPECIALS = [
  {
    id: "rocket-burst",
    name: "Rocket Burst",
    description: "A short straight-line speed surge for breakaways.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 2200
  },
  {
    id: "screen-spark",
    name: "Screen Spark",
    description: "Creates a brief net-front screen for quick shots.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 2600
  },
  {
    id: "wall-check",
    name: "Wall Check",
    description: "A heavier shoulder check with extra puck strip force.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 1800
  },
  {
    id: "thread-pass",
    name: "Thread Pass",
    description: "Boosts pass assist through tight lanes.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 4000
  },
  {
    id: "ice-hook",
    name: "Ice Hook",
    description: "Extends stick reach for one loose-puck grab.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 4200
  },
  {
    id: "rebound-rain",
    name: "Rebound Rain",
    description: "Turns the next hard shot into a livelier rebound.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 3600
  },
  {
    id: "blue-line-laser",
    name: "Blue-Line Laser",
    description: "Charges a long-range shot faster.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 3400
  },
  {
    id: "corner-crush",
    name: "Corner Crush",
    description: "Wins board battles with a short power shove.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 2200
  },
  {
    id: "crease-ghost",
    name: "Crease Ghost",
    description: "Briefly improves net-front handling.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 3000
  },
  {
    id: "glove-flash",
    name: "Glove Flash",
    description: "Goalie-style flash save energy for defensive blocks.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 2600
  },
  {
    id: "pad-surge",
    name: "Pad Surge",
    description: "A sliding block burst when defending the slot.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 2600
  },
  {
    id: "mask-focus",
    name: "Mask Focus",
    description: "Reduces stumble time after a heavy hit.",
    chargeRequired: 1,
    cooldownMs: 7000,
    durationMs: 3000
  }
] as const satisfies readonly CharacterSpecial[];

export function isSpecialId(value: string): value is SpecialId {
  return SPECIAL_IDS.includes(value as SpecialId);
}
