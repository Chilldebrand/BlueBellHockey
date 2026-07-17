import {
  CHARACTER_IDS,
  ARCADE_CHARACTERS,
  POWERUP_DEFINITIONS,
  type PowerupType,
  type WorldEvent,
  type WorldState
} from "@bbh/arcade-core";

export type AnnouncerKind = "goal" | "powerup";

export interface AnnouncerCue {
  readonly eventId: string;
  readonly kind: AnnouncerKind;
  readonly priority: number;
  readonly clipIds: readonly string[];
  readonly characterName: string;
  readonly text: string;
}

const GOAL_PRIORITY = 100;
const POWERUP_PRIORITY = 50;
const ANNOUNCER_COOLDOWN_MS = 1500;
const MAX_QUEUED_CUES = 2;
const UNKNOWN_PLAYER = "Unknown Player";

const GOAL_LINES = [
  "finds the twine!",
  "the goalie is requesting a map!",
  "the scoreboard is filing a complaint!",
  "that puck had a business meeting with the net!",
  "the crease has been invaded!",
  "top shelf, no ladder required!",
  "the goalie saw it in the brochure!",
  "that was rude!"
] as const;

const POWERUP_LINES: Partial<Record<PowerupType, string>> = {
  "speed-boost": "just found another gear!",
  freeze: "froze the competition!",
  bulldozer: "turned into a wrecking ball!",
  "mini-goalie": "made the goalie tiny!",
  "giant-goalie": "built a goalie wall!"
};

export const characterNameClipIds = CHARACTER_IDS.map(
  (characterId) => `announcer.name.${characterId}`
);

const expectedAnnouncerClipIds = [
  ...characterNameClipIds,
  ...Array.from({ length: GOAL_LINES.length }, (_, index) => `announcer.goal.${index}`),
  ...Object.keys(POWERUP_LINES).map(
    (powerupType) => `announcer.powerup.${powerupType}`
  ),
  "music.menu.0"
] as const;

export interface AnnouncerManifestValidation {
  readonly characterIdsValid: boolean;
  readonly missingIds: readonly string[];
  readonly unexpectedIds: readonly string[];
}

export function validateAnnouncerManifest(value: unknown): AnnouncerManifestValidation {
  const clips = isRecord(value) && isRecord(value.clips) ? value.clips : {};
  const actualIds = Object.keys(clips);
  const expectedIds = new Set<string>(expectedAnnouncerClipIds);
  const missingIds = expectedAnnouncerClipIds.filter((id) => !actualIds.includes(id));
  const unexpectedIds = actualIds.filter((id) => !expectedIds.has(id));
  const actualCharacterIds = actualIds.filter((id) => id.startsWith("announcer.name."));

  return {
    characterIdsValid:
      actualCharacterIds.length === characterNameClipIds.length &&
      actualCharacterIds.every((id, index) => id === characterNameClipIds[index]),
    missingIds,
    unexpectedIds
  };
}

const characterNameById = new Map(
  ARCADE_CHARACTERS.map((character) => [character.id, character.displayName])
);

interface RankedCue {
  readonly cue: AnnouncerCue;
  readonly order: number;
}

export function announcerCueForEvent(
  event: WorldEvent,
  world: WorldState,
  random: () => number = Math.random
): AnnouncerCue | null {
  if (event.type === "goal") {
    const lineIndex = chooseIndex(GOAL_LINES.length, random);
    const character = resolveCharacter(world, event.sourceSlotId);
    const characterName = character?.displayName ?? UNKNOWN_PLAYER;
    const clipIds =
      character?.id === undefined
        ? [`announcer.goal.${lineIndex}`]
        : [`announcer.name.${character.id}`, `announcer.goal.${lineIndex}`];

    return {
      eventId: event.id,
      kind: "goal",
      priority: GOAL_PRIORITY,
      clipIds,
      characterName,
      text: `${characterName} ${GOAL_LINES[lineIndex]}`
    };
  }

  if (event.type !== "powerupPickup") {
    return null;
  }

  if (!event.targetSlotId || !isPowerupType(event.targetSlotId)) {
    return null;
  }

  const character = resolveCharacter(world, event.sourceSlotId);
  const characterName = character?.displayName ?? UNKNOWN_PLAYER;
  const powerupType = event.targetSlotId;
  const powerupLine = POWERUP_LINES[powerupType];
  if (!powerupLine) {
    return null;
  }
  const clipIds =
    character?.id === undefined
      ? [`announcer.powerup.${powerupType}`]
      : [`announcer.name.${character.id}`, `announcer.powerup.${powerupType}`];

  return {
    eventId: event.id,
    kind: "powerup",
    priority: POWERUP_PRIORITY,
    clipIds,
    characterName,
    text: `${characterName} ${powerupLine}`
  };
}

export class AnnouncerQueue {
  private active: RankedCue | null = null;
  private activeStartedAtMs: number | null = null;
  private pending: RankedCue[] = [];
  private order = 0;

  enqueue(cue: AnnouncerCue): void {
    this.pending.push(this.wrap(cue));
    this.trimPending();
  }

  interruptWith(cue: AnnouncerCue): void {
    const nextActive = this.wrap(cue);

    this.pending = this.pending.filter(
      (pendingCue) => compareRankedCues(pendingCue, nextActive) <= 0
    );

    if (
      this.active &&
      compareRankedCues(this.active, nextActive) <= 0
    ) {
      this.pending.push(this.active);
    }

    this.active = nextActive;
    this.activeStartedAtMs = null;
    this.trimPending();
  }

  next(nowMs: number): AnnouncerCue | null {
    if (this.active && this.activeStartedAtMs === null) {
      this.activeStartedAtMs = nowMs;
      return this.active.cue;
    }

    if (
      this.active &&
      this.activeStartedAtMs !== null &&
      nowMs - this.activeStartedAtMs < ANNOUNCER_COOLDOWN_MS
    ) {
      return null;
    }

    this.active = this.pending.shift() ?? null;
    this.activeStartedAtMs = this.active ? nowMs : null;

    return this.active?.cue ?? null;
  }

  clear(): void {
    this.active = null;
    this.activeStartedAtMs = null;
    this.pending = [];
  }

  private wrap(cue: AnnouncerCue): RankedCue {
    const rankedCue = {
      cue,
      order: this.order
    } satisfies RankedCue;

    this.order += 1;
    return rankedCue;
  }

  private trimPending(): void {
    this.pending.sort(compareRankedCues);
    const limit = this.active ? MAX_QUEUED_CUES : MAX_QUEUED_CUES + 1;
    this.pending = this.pending.slice(0, limit);
  }
}

function resolveCharacter(
  world: WorldState,
  slotId: string | undefined
): { readonly id: string; readonly displayName: string } | null {
  if (!slotId) {
    return null;
  }

  const skater = world.skaters.find((candidate) => candidate.id === slotId);
  if (!skater) {
    return null;
  }

  const displayName = characterNameById.get(skater.characterId);
  if (!displayName) {
    return null;
  }

  return {
    id: skater.characterId,
    displayName
  };
}

function chooseIndex(length: number, random: () => number): number {
  const raw = random();
  if (!Number.isFinite(raw)) {
    return 0;
  }

  return Math.min(length - 1, Math.max(0, Math.floor(raw * length)));
}

function isPowerupType(value: string): value is PowerupType {
  return value in POWERUP_DEFINITIONS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compareRankedCues(left: RankedCue, right: RankedCue): number {
  if (right.cue.priority !== left.cue.priority) {
    return right.cue.priority - left.cue.priority;
  }

  if (left.cue.kind !== right.cue.kind) {
    return left.cue.kind === "goal" ? -1 : 1;
  }

  return left.order - right.order;
}
