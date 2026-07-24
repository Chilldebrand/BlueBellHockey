import { createWorld } from "@bbh/arcade-core";
import { describe, expect, it, vi } from "vitest";
import {
  HIGH_INTENSITY_MUSIC,
  LAST_TRACKS_STORAGE_KEY,
  MENU_MUSIC,
  REGULAR_MATCH_MUSIC,
  createMusicShuffle,
  musicRouteForWorld,
  readLastMusicTracks
} from "./music.js";

describe("authored music plan", () => {
  it("keeps the approved tracks in their three rotation pools", () => {
    expect(REGULAR_MATCH_MUSIC.map((track) => track.id)).toEqual([
      "steel-grit",
      "342-maxed-out",
      "full-blast",
      "motivation-sport-rock-trailer",
      "action-rock",
      "on-my-way",
      "shout-it",
      "motivation-epic-rock"
    ]);
    expect(HIGH_INTENSITY_MUSIC.map((track) => track.id)).toEqual([
      "power-drive-extreme-sports",
      "bringing-thunder",
      "sports-energetic-metalcore"
    ]);
    expect(MENU_MUSIC.map((track) => track.id)).toEqual([
      "cool-old-school",
      "delinquente",
      "positive-hip-hop",
      "hip-hop-old-school"
    ]);
  });

  it("shuffles every track before repeating and never immediately repeats", () => {
    const randomValues = [0.01, 0.99, 0.4, 0.7, 0.2, 0.8, 0.3, 0.6];
    let randomIndex = 0;
    const nextTrack = createMusicShuffle(
      REGULAR_MATCH_MUSIC,
      () => randomValues[randomIndex++ % randomValues.length]!
    );

    const firstCycle = REGULAR_MATCH_MUSIC.map(() => nextTrack().id);
    const secondCycleFirst = nextTrack().id;

    expect(new Set(firstCycle).size).toBe(REGULAR_MATCH_MUSIC.length);
    expect(secondCycleFirst).not.toBe(firstCycle.at(-1));
  });

  it("never opens with the seeded previous-run track", () => {
    // random() = 0 makes the Fisher-Yates order deterministic; without the
    // seed the first draw would be "342-maxed-out". Seeding it as the
    // previous run's last track must push something else to the front.
    const zeroRandom = () => 0;
    const unseeded = createMusicShuffle(REGULAR_MATCH_MUSIC, zeroRandom);
    const wouldBeFirst = unseeded().id;

    const seeded = createMusicShuffle(
      REGULAR_MATCH_MUSIC,
      zeroRandom,
      wouldBeFirst
    );
    expect(seeded().id).not.toBe(wouldBeFirst);
  });

  it("round-trips per-route last tracks and survives corrupt storage", () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value)
    } as unknown as Storage;

    expect(readLastMusicTracks(null)).toEqual({});
    expect(readLastMusicTracks(storage)).toEqual({});

    entries.set(
      LAST_TRACKS_STORAGE_KEY,
      JSON.stringify({ menu: "delinquente", regular: "shout-it", junk: 4 })
    );
    expect(readLastMusicTracks(storage)).toEqual({
      menu: "delinquente",
      regular: "shout-it"
    });

    entries.set(LAST_TRACKS_STORAGE_KEY, "{nope");
    expect(readLastMusicTracks(storage)).toEqual({});

    const throwing = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      })
    } as unknown as Storage;
    expect(readLastMusicTracks(throwing)).toEqual({});
  });

  it("routes overtime and late close games to the high-intensity pool", () => {
    const regularWorld = createWorld(3, "arcade3v3");
    regularWorld.phase = "playing";
    regularWorld.remainingMs = 90_000;
    expect(musicRouteForWorld(regularWorld)).toBe("regular");

    const overtimeWorld = createWorld(3, "arcade3v3");
    overtimeWorld.phase = "playing";
    overtimeWorld.isOvertime = true;
    expect(musicRouteForWorld(overtimeWorld)).toBe("high");

    const closeWorld = createWorld(3, "arcade3v3");
    closeWorld.phase = "playing";
    closeWorld.remainingMs = 45_000;
    closeWorld.score.home = 3;
    closeWorld.score.away = 2;
    expect(musicRouteForWorld(closeWorld)).toBe("high");

    closeWorld.score.away = 1;
    expect(musicRouteForWorld(closeWorld)).toBe("regular");
  });
});
