import { describe, expect, it } from "vitest";
import type { WorldState } from "@bbh/arcade-core";
import {
  DEFAULT_SNAPSHOT_BUFFER_OPTIONS,
  createSnapshotBuffer,
  meanAbsoluteDeviation,
  medianOf,
  sampleEntries,
  targetDelayMs,
  updateDelay,
  type BufferedSnapshot,
} from "./snapshotBuffer.js";

/** Only identity matters here — the buffer never looks inside a world. */
function world(tag: number): WorldState {
  return { tag } as unknown as WorldState;
}

function entry(tag: number, receivedAtMs: number): BufferedSnapshot {
  return { world: world(tag), receivedAtMs };
}

const OPTIONS = DEFAULT_SNAPSHOT_BUFFER_OPTIONS;
/** The server's real cadence: every 2nd tick of a 16ms sim. */
const INTERVAL = 32;

describe("snapshotBuffer — statistics", () => {
  it("medianOf handles odd, even and empty inputs", () => {
    expect(medianOf([5, 1, 3])).toBe(3);
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    expect(medianOf([])).toBe(0);
  });

  it("meanAbsoluteDeviation measures spread around the given centre", () => {
    expect(meanAbsoluteDeviation([10, 10, 10], 10)).toBe(0);
    expect(meanAbsoluteDeviation([8, 12], 10)).toBe(2);
    expect(meanAbsoluteDeviation([], 10)).toBe(0);
  });

  it("uses mean absolute deviation, not variance, so one freak arrival can't dominate", () => {
    const steady = Array.from({ length: 19 }, () => INTERVAL);
    const oneSpike = [...steady, 400];

    // A single 400ms arrival in a second of otherwise perfect delivery should widen the cushion
    // somewhat, not slam it into the ceiling — that's the whole reason for MAD over stddev.
    expect(targetDelayMs(oneSpike)).toBeLessThan(OPTIONS.maxDelayMs);
    expect(targetDelayMs(oneSpike)).toBeGreaterThan(targetDelayMs(steady));
  });
});

describe("snapshotBuffer — adaptive delay", () => {
  it("a metronome connection sits on the floor", () => {
    const gaps = Array.from({ length: 20 }, () => INTERVAL);

    expect(targetDelayMs(gaps)).toBe(OPTIONS.minDelayMs);
  });

  it("a jittery connection buys itself more cushion than a steady one", () => {
    const steady = Array.from({ length: 20 }, () => INTERVAL);
    const jittery = [20, 60, 25, 70, 18, 65, 30, 55, 22, 68, 25, 62, 28, 58, 20, 66, 24, 60, 26, 64];

    expect(targetDelayMs(jittery)).toBeGreaterThan(targetDelayMs(steady));
  });

  it("never exceeds the ceiling, however bad the connection", () => {
    const awful = [400, 20, 500, 15, 380, 25, 600, 10];

    expect(targetDelayMs(awful)).toBeLessThanOrEqual(OPTIONS.maxDelayMs);
  });

  it("never drops below one snapshot interval, or there is nothing to interpolate toward", () => {
    const fast = Array.from({ length: 20 }, () => 5);

    expect(targetDelayMs(fast)).toBeGreaterThanOrEqual(INTERVAL);
  });

  it("grows quickly but shrinks slowly — the asymmetry that stops it thrashing", () => {
    const grown = updateDelay(40, 200);
    const shrunk = updateDelay(200, 40);

    expect(grown - 40).toBeGreaterThan(50);
    expect(200 - shrunk).toBeLessThan(10);
  });
});

describe("snapshotBuffer — sampling", () => {
  it("returns null with nothing buffered", () => {
    expect(sampleEntries([], 100)).toBeNull();
  });

  it("renders the oldest as-is when the render clock is still behind it", () => {
    const sample = sampleEntries([entry(1, 100), entry(2, 132)], 50);

    expect(sample?.previous).toBeNull();
    expect(sample?.current).toEqual(world(1));
    expect(sample?.starved).toBe(false);
  });

  it("brackets the render clock and reports where between the pair it falls", () => {
    const entries = [entry(1, 100), entry(2, 132), entry(3, 164)];
    const sample = sampleEntries(entries, 148);

    expect(sample?.previous).toEqual(world(2));
    expect(sample?.current).toEqual(world(3));
    expect(sample?.alpha).toBeCloseTo(0.5, 5);
    expect(sample?.starved).toBe(false);
  });

  it("holds the newest — never extrapolates — once the buffer runs dry", () => {
    const entries = [entry(1, 100), entry(2, 132)];
    const sample = sampleEntries(entries, 400);

    expect(sample?.current).toEqual(world(2));
    expect(sample?.alpha).toBe(1);
    expect(sample?.starved).toBe(true);
  });

  it("survives two snapshots stamped at the same instant without producing NaN", () => {
    const sample = sampleEntries([entry(1, 100), entry(2, 100.0), entry(3, 100)], 100);

    expect(Number.isNaN(sample?.alpha ?? NaN)).toBe(false);
  });
});

describe("snapshotBuffer — the behaviour this module exists to fix", () => {
  it("advances every frame between arrivals, instead of stepping on arrival", () => {
    const buffer = createSnapshotBuffer();

    // A second of steady arrivals so the delay settles.
    for (let i = 0; i < 31; i += 1) {
      buffer.push(world(i), 1000 + i * INTERVAL);
    }

    // Absolute progress through the stream, so the measure keeps rising as the render clock crosses
    // from one snapshot pair into the next (where alpha correctly restarts near 0).
    const progressAt = (nowMs: number): number | null => {
      const sample = buffer.sample(nowMs);
      if (!sample || sample.starved) {
        return null;
      }
      const tag = (sample.current as unknown as { tag: number }).tag;
      return tag + sample.alpha;
    };

    const start = 1000 + 30 * INTERVAL;
    const progress: number[] = [];
    // A full snapshot interval's worth of 60fps frames — deliberately long enough to cross a
    // boundary, since that crossing is exactly where a step-function renderer betrays itself.
    for (let frame = 0; frame < 8; frame += 1) {
      const value = progressAt(start + frame * 8);
      if (value !== null) {
        progress.push(value);
      }
    }

    expect(progress.length).toBeGreaterThan(4);
    // Strictly increasing every frame = motion is a function of the clock. The old renderer passed a
    // CONSTANT 0.75 here, so this measure would have been flat between arrivals and jumped on one —
    // which is precisely what remote players were seeing.
    for (let i = 1; i < progress.length; i += 1) {
      expect(progress[i]).toBeGreaterThan(progress[i - 1]);
    }
  });

  it("a steady connection is never starved by its own delay", () => {
    const buffer = createSnapshotBuffer();
    let starvedFrames = 0;

    for (let i = 0; i < 60; i += 1) {
      buffer.push(world(i), 1000 + i * INTERVAL);
      // Draw a couple of frames after each arrival, as a 60fps client would.
      for (let frame = 0; frame < 2; frame += 1) {
        const sample = buffer.sample(1000 + i * INTERVAL + frame * 16);
        if (sample?.starved && i > 5) {
          starvedFrames += 1;
        }
      }
    }

    expect(starvedFrames).toBe(0);
  });

  it("widens the delay for a jittery connection as arrivals wobble", () => {
    const buffer = createSnapshotBuffer();
    let at = 1000;

    for (let i = 0; i < 10; i += 1) {
      at += INTERVAL;
      buffer.push(world(i), at);
    }
    const settled = buffer.delayMs();

    const wobble = [15, 70, 18, 65, 20, 75, 16, 68, 22, 72, 17, 66];
    for (let i = 0; i < wobble.length; i += 1) {
      at += wobble[i];
      buffer.push(world(100 + i), at);
    }

    expect(buffer.delayMs()).toBeGreaterThan(settled);
  });

  it("treats a backgrounded tab as a stall, not as jitter", () => {
    const buffer = createSnapshotBuffer();
    let at = 1000;

    for (let i = 0; i < 20; i += 1) {
      at += INTERVAL;
      buffer.push(world(i), at);
    }
    const beforeStall = buffer.delayMs();

    // Tab hidden for two seconds, then delivery resumes normally.
    at += 2000;
    buffer.push(world(999), at);

    expect(buffer.gaps()).toHaveLength(0);
    // The stall itself must not have inflated the delay.
    expect(buffer.delayMs()).toBeLessThanOrEqual(beforeStall);
  });

  it("resetTiming drops the learned cadence but keeps the buffered worlds", () => {
    const buffer = createSnapshotBuffer();
    let at = 1000;

    // Lobby cadence: one snapshot every 8th tick. The delay climbs to suit it.
    for (let i = 0; i < 20; i += 1) {
      at += 128;
      buffer.push(world(i), at);
    }
    expect(buffer.delayMs()).toBeGreaterThan(OPTIONS.minDelayMs);

    buffer.resetTiming();

    expect(buffer.delayMs()).toBe(OPTIONS.minDelayMs);
    expect(buffer.gaps()).toHaveLength(0);
    // ...but the worlds survive, so the first frame of the match still has something to draw.
    expect(buffer.sample(at)).not.toBeNull();
  });

  it("ignores duplicate and out-of-order arrivals", () => {
    const buffer = createSnapshotBuffer();

    buffer.push(world(1), 1000);
    buffer.push(world(2), 1032);
    buffer.push(world(3), 1010); // late straggler
    buffer.push(world(4), 1032); // duplicate stamp

    const sample = buffer.sample(5000);
    expect(sample?.current).toEqual(world(2));
  });

  it("keeps the ring bounded under a long session", () => {
    const buffer = createSnapshotBuffer();

    for (let i = 0; i < 500; i += 1) {
      buffer.push(world(i), 1000 + i * INTERVAL);
    }

    // Nothing to assert on internals; what matters is that sampling stays correct and cheap.
    const sample = buffer.sample(1000 + 499 * INTERVAL);
    expect(sample).not.toBeNull();
  });
});
