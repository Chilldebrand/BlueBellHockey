import type { WorldState } from "@bbh/arcade-core";

export type MusicRoute = "off" | "menu" | "regular" | "high";

export interface MusicTrack {
  readonly id: string;
  readonly title: string;
  readonly path: string;
}

const musicTrack = (
  id: string,
  title: string
): MusicTrack => ({
  id,
  title,
  path: `/audio/music/${id}.mp3`
});

export const REGULAR_MATCH_MUSIC: readonly MusicTrack[] = [
  musicTrack("steel-grit", "Steel Grit (Sports Rock Background)"),
  musicTrack("342-maxed-out", "342 Maxed Out (The Action Rock)"),
  musicTrack("full-blast", "Full Blast (Energetic Sport Rock)"),
  musicTrack("motivation-sport-rock-trailer", "Motivation Sport Rock Trailer"),
  musicTrack("action-rock", "Action Rock"),
  musicTrack("on-my-way", "On My Way (Cool Rock Background)"),
  musicTrack("shout-it", "Shout It (Sports Rock)"),
  musicTrack("motivation-epic-rock", "Motivation Epic Rock")
];

export const HIGH_INTENSITY_MUSIC: readonly MusicTrack[] = [
  musicTrack("power-drive-extreme-sports", "Power Drive Extreme Sports"),
  musicTrack("bringing-thunder", "Bringing Thunder (The Cool Rock Background)"),
  musicTrack("sports-energetic-metalcore", "Sports Energetic Metalcore")
];

export const MENU_MUSIC: readonly MusicTrack[] = [
  musicTrack("cool-old-school", "Cool Old School — Classic Boom Bap Hip-Hop"),
  musicTrack(
    "delinquente",
    "Delinquente Hip Hop Old School Instrumental"
  ),
  musicTrack("positive-hip-hop", "Positive Hip Hop"),
  musicTrack("hip-hop-old-school", "Hip Hop Old School")
];

const LATE_CLOSE_REMAINING_MS = 60_000;

export function musicRouteForWorld(world: Pick<
  WorldState,
  "phase" | "isOvertime" | "remainingMs" | "score"
>): Exclude<MusicRoute, "off" | "menu"> {
  if (
    world.isOvertime ||
    (world.remainingMs <= LATE_CLOSE_REMAINING_MS &&
      Math.abs(world.score.home - world.score.away) <= 1)
  ) {
    return "high";
  }

  return "regular";
}

export function createMusicShuffle<T extends MusicTrack>(
  tracks: readonly T[],
  random: () => number = Math.random,
  // Seeding the no-repeat guard with the last track of a PREVIOUS app run
  // stops a fresh boot from opening with the song you just heard — the
  // repeat-on-restart that reads as "the playlist is in order".
  initialLastTrackId: string | null = null
): () => T {
  let remaining: T[] = [];
  let lastTrackId: string | null = initialLastTrackId;

  const refill = (): void => {
    remaining = [...tracks];
    for (let index = remaining.length - 1; index > 0; index -= 1) {
      const raw = random();
      const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999, raw)) : 0;
      const swapIndex = Math.floor(normalized * (index + 1));
      const current = remaining[index]!;
      remaining[index] = remaining[swapIndex]!;
      remaining[swapIndex] = current;
    }

    if (remaining.length > 1 && remaining[0]?.id === lastTrackId) {
      const swapIndex = remaining.findIndex((track) => track.id !== lastTrackId);
      if (swapIndex > 0) {
        const first = remaining[0]!;
        remaining[0] = remaining[swapIndex]!;
        remaining[swapIndex] = first;
      }
    }
  };

  return () => {
    if (remaining.length === 0) {
      refill();
    }

    const next = remaining.shift();
    if (!next) {
      throw new Error("Music rotation cannot be empty");
    }

    lastTrackId = next.id;
    return next;
  };
}

const TRACKS_BY_ROUTE: Record<Exclude<MusicRoute, "off">, readonly MusicTrack[]> = {
  menu: MENU_MUSIC,
  regular: REGULAR_MATCH_MUSIC,
  high: HIGH_INTENSITY_MUSIC
};

const SILENT_GAIN = 0.0001;

type MusicRouteKey = Exclude<MusicRoute, "off">;

export const LAST_TRACKS_STORAGE_KEY = "bbh.audio.lastTracks.v1";

const ROUTE_KEYS: readonly MusicRouteKey[] = ["menu", "regular", "high"];

/** Per-route last-played track ids persisted across app runs. Corruption-safe. */
export function readLastMusicTracks(
  storage: Storage | null
): Partial<Record<MusicRouteKey, string>> {
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(LAST_TRACKS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: Partial<Record<MusicRouteKey, string>> = {};
    for (const route of ROUTE_KEYS) {
      const value = (parsed as Record<string, unknown>)[route];
      if (typeof value === "string" && value) {
        result[route] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
}

function defaultMusicStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export class MenuMusic {
  readonly output: GainNode;
  route: MusicRoute = "off";
  currentTrackId: string | null = null;

  private readonly shuffles = new Map<
    Exclude<MusicRoute, "off">,
    () => MusicTrack
  >();
  private readonly buffers = new Map<string, AudioBuffer>();
  private currentSource: AudioBufferSourceNode | null = null;
  private generation = 0;
  private readonly storage: Storage | null;
  private readonly lastTracks: Partial<Record<MusicRouteKey, string>>;

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    storage: Storage | null = defaultMusicStorage()
  ) {
    this.output = context.createGain();
    this.output.gain.value = SILENT_GAIN;
    this.output.connect(destination);
    this.storage = storage;
    this.lastTracks = readLastMusicTracks(storage);
  }

  setBuffers(buffers: ReadonlyMap<string, AudioBuffer>): void {
    this.buffers.clear();
    for (const [trackId, buffer] of buffers) {
      this.buffers.set(trackId, buffer);
    }

    this.startCurrentRouteIfNeeded();
  }

  setEnabled(enabled: boolean): void {
    this.setRoute(enabled ? "menu" : "off");
  }

  setRoute(route: MusicRoute): void {
    if (route === this.route) {
      this.startCurrentRouteIfNeeded();
      return;
    }

    this.route = route;
    this.generation += 1;
    this.stopCurrentSource();
    this.currentTrackId = null;
    this.output.gain.setTargetAtTime(
      route === "off" ? SILENT_GAIN : 1,
      this.context.currentTime,
      0.4
    );

    this.startCurrentRouteIfNeeded();
  }

  dispose(): void {
    this.route = "off";
    this.generation += 1;
    this.stopCurrentSource();
    this.currentTrackId = null;
  }

  private startCurrentRouteIfNeeded(): void {
    if (this.route === "off" || this.currentSource) {
      return;
    }

    const pool = TRACKS_BY_ROUTE[this.route];
    if (!pool || pool.length === 0) {
      return;
    }

    // Nothing decoded yet (assets still loading): don't touch the shuffle
    // bag at all — burning draws on unplayable tracks churned the rotation
    // before the first real song.
    if (!pool.some((track) => this.buffers.has(track.id))) {
      return;
    }

    let nextTrack: MusicTrack | null = null;
    const next = this.getShuffle(this.route);
    for (let attempt = 0; attempt < pool.length; attempt += 1) {
      const candidate = next();
      if (this.buffers.has(candidate.id)) {
        nextTrack = candidate;
        break;
      }
    }

    if (!nextTrack) {
      return;
    }

    const buffer = this.buffers.get(nextTrack.id);
    if (!buffer) {
      return;
    }

    const generation = this.generation;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.onended = () => {
      if (generation !== this.generation || this.currentSource !== source) {
        return;
      }

      this.currentSource = null;
      this.currentTrackId = null;
      this.startCurrentRouteIfNeeded();
    };
    this.currentSource = source;
    this.currentTrackId = nextTrack.id;
    this.persistLastTrack(this.route, nextTrack.id);
    source.start(this.context.currentTime + 0.05);
  }

  private getShuffle(route: Exclude<MusicRoute, "off">): () => MusicTrack {
    let shuffle = this.shuffles.get(route);
    if (!shuffle) {
      shuffle = createMusicShuffle(
        TRACKS_BY_ROUTE[route],
        undefined,
        this.lastTracks[route] ?? null
      );
      this.shuffles.set(route, shuffle);
    }

    return shuffle;
  }

  private persistLastTrack(route: MusicRoute, trackId: string): void {
    if (route === "off") {
      return;
    }

    this.lastTracks[route] = trackId;
    if (!this.storage) {
      return;
    }

    try {
      this.storage.setItem(
        LAST_TRACKS_STORAGE_KEY,
        JSON.stringify(this.lastTracks)
      );
    } catch {
      // Ignore storage quota / privacy mode failures.
    }
  }

  private stopCurrentSource(): void {
    if (!this.currentSource) {
      return;
    }

    try {
      this.currentSource.stop();
    } catch {
      // A source that already ended is safe to discard.
    }

    this.currentSource = null;
  }
}
