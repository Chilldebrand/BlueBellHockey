import type { WorldState } from "@bbh/arcade-core";

/**
 * Adaptive snapshot buffer — the timing half of remote-player interpolation.
 *
 * THE PROBLEM IT SOLVES. Snapshots arrive ~31/s during play, but they do not arrive on a metronome:
 * the further away a player is, the more the gap between arrivals wobbles (queueing, re-routes, wifi).
 * Rendering "the newest snapshot, blended by a constant" — which is what `Scene` did before this
 * module, with a hardcoded alpha of 0.75 — makes remote skaters a STEP FUNCTION: they freeze between
 * arrivals and jump on arrival. Locally that step is ~32ms and reads as slightly crunchy motion; from
 * across the country the steps are irregular and it reads as the thing players call "lag", even when
 * the average latency is fine. Nothing about that is fixed by a faster connection, because the
 * renderer was never asking what time it is.
 *
 * THE FIX. Keep the last N snapshots WITH THE TIME THEY ARRIVED, and render the world as it was a
 * little while ago — `now - delay` — interpolating between the two snapshots that bracket that
 * moment. Motion then advances every frame instead of every arrival, and a late snapshot is invisible
 * as long as it lands within the delay.
 *
 * WHY THE DELAY ADAPTS. That delay is a straight trade: too small and the buffer runs dry between
 * arrivals (the stutter comes back), too large and everyone else is rendered needlessly far in the
 * past. The right value is a property of the player's connection, not a constant someone picks — so
 * it's derived from the arrival gaps this client is actually seeing: one typical interval, plus a
 * margin for how much those intervals wobble. A player on the same LAN as the server settles near the
 * floor; a player three states away automatically buys themselves more cushion, and pays only what
 * their connection actually costs.
 *
 * Everything here is pure and clock-injected so the behaviour under jitter, stalls and starvation can
 * be tested without a network — see snapshotBuffer.test.ts.
 */

export interface SnapshotBufferOptions {
  /** Ring size. ~24 at 31/s covers about 0.75s of history — far more than maxDelayMs needs. */
  readonly maxEntries: number;
  /** Floor for the render delay. Below one snapshot interval there is nothing to interpolate toward. */
  readonly minDelayMs: number;
  /** Ceiling. Past this, hiding jitter costs more (in felt lag) than the jitter costs. */
  readonly maxDelayMs: number;
  /** How many multiples of measured wobble to hold as cushion. 2 covers the large majority of arrivals. */
  readonly jitterMultiplier: number;
  /** Share of the gap to the target closed per snapshot when the delay must GROW. Deliberately brisk. */
  readonly riseFactor: number;
  /** ...and when it may SHRINK. Deliberately slow — see the asymmetry note on updateDelay. */
  readonly fallFactor: number;
  /** An arrival gap this large is a stall or a backgrounded tab, not jitter: drop the stats. */
  readonly resetGapMs: number;
}

export const DEFAULT_SNAPSHOT_BUFFER_OPTIONS: SnapshotBufferOptions = {
  maxEntries: 24,
  // The server sends every 2nd tick of a 16ms sim = ~32ms. One whole interval is the true floor;
  // 40 leaves a little room so a merely-average arrival doesn't graze starvation.
  minDelayMs: 40,
  // ~7 snapshot intervals. A connection needing more than this is not going to feel good regardless,
  // and holding position briefly beats rendering a quarter-second in the past.
  maxDelayMs: 220,
  jitterMultiplier: 2,
  riseFactor: 0.5,
  fallFactor: 0.02,
  resetGapMs: 1000,
};

/** How many recent arrival gaps feed the estimate — ~1s of history at 31/s. */
const GAP_WINDOW = 20;

export interface BufferedSnapshot {
  readonly world: WorldState;
  readonly receivedAtMs: number;
}

export interface SnapshotSample {
  /** Null only before there are two snapshots to blend; callers render `current` as-is. */
  readonly previous: WorldState | null;
  readonly current: WorldState;
  /** 0..1 position of the render clock between `previous` and `current`. */
  readonly alpha: number;
  /** True when the render clock has run past the newest snapshot — the buffer is dry. */
  readonly starved: boolean;
}

export function medianOf(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Mean absolute deviation, not standard deviation: one freak 400ms arrival should widen the cushion a
 * little, not square itself into the estimate and shove every player into the ceiling.
 */
export function meanAbsoluteDeviation(values: readonly number[], center: number): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + Math.abs(value - center), 0) / values.length;
}

/**
 * The delay this connection currently warrants: one typical arrival interval (so there is always a
 * next snapshot to aim at) plus a margin for how irregular those arrivals have been.
 */
export function targetDelayMs(
  gaps: readonly number[],
  options: SnapshotBufferOptions = DEFAULT_SNAPSHOT_BUFFER_OPTIONS
): number {
  if (gaps.length === 0) {
    return options.minDelayMs;
  }

  const interval = medianOf(gaps);
  const jitter = meanAbsoluteDeviation(gaps, interval);
  const target = interval + options.jitterMultiplier * jitter;

  return Math.min(options.maxDelayMs, Math.max(options.minDelayMs, target));
}

/**
 * Ease the live delay toward the target, ASYMMETRICALLY — fast up, slow down.
 *
 * Getting this backwards is the classic way to build a buffer that thrashes. Growing late is paid for
 * in visible stutter (the buffer runs dry before it widens), so growth is brisk. Shrinking early is
 * paid for the same way, on the very next wobble, and a connection that just misbehaved will probably
 * misbehave again — so the cushion is given up grudgingly, over seconds of consistent calm.
 */
export function updateDelay(
  currentMs: number,
  target: number,
  options: SnapshotBufferOptions = DEFAULT_SNAPSHOT_BUFFER_OPTIONS
): number {
  const factor = target > currentMs ? options.riseFactor : options.fallFactor;

  return currentMs + (target - currentMs) * factor;
}

/**
 * Resolve the pair of snapshots bracketing `renderTimeMs`, and where between them it falls.
 *
 * `entries` must be ascending by receivedAtMs (pushSnapshot guarantees it).
 */
export function sampleEntries(
  entries: readonly BufferedSnapshot[],
  renderTimeMs: number
): SnapshotSample | null {
  if (entries.length === 0) {
    return null;
  }

  const newest = entries[entries.length - 1];

  // Render clock still behind the oldest thing we hold — we just joined, or the buffer was reset.
  // Show the oldest as-is rather than inventing a blend against nothing.
  if (renderTimeMs <= entries[0].receivedAtMs) {
    return { previous: null, current: entries[0].world, alpha: 1, starved: false };
  }

  // Past the newest: the buffer is dry. HOLD at the newest instead of extrapolating. Extrapolation in
  // a rink means predicting skaters through the boards during exactly the moments the connection is
  // worst — a brief freeze is the honest, and far less ugly, failure.
  if (renderTimeMs >= newest.receivedAtMs) {
    return {
      previous: entries.length > 1 ? entries[entries.length - 2].world : null,
      current: newest.world,
      alpha: 1,
      starved: true,
    };
  }

  let index = 0;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].receivedAtMs <= renderTimeMs) {
      index = i;
      break;
    }
  }

  const previous = entries[index];
  const current = entries[index + 1];
  const span = current.receivedAtMs - previous.receivedAtMs;
  // Two snapshots stamped identically (a coalesced burst) would divide by zero; treat as arrived-now.
  const alpha = span <= 0 ? 1 : (renderTimeMs - previous.receivedAtMs) / span;

  return {
    previous: previous.world,
    current: current.world,
    alpha: Math.min(1, Math.max(0, alpha)),
    starved: false,
  };
}

export interface SnapshotBuffer {
  /** Record an arrival. Out-of-order and duplicate arrivals are ignored. */
  push(world: WorldState, receivedAtMs: number): void;
  /** The world as it should be drawn right now, already delayed. Null until the first snapshot. */
  sample(nowMs: number): SnapshotSample | null;
  /** Current adaptive delay, for diagnostics/HUD. */
  delayMs(): number;
  /** Recent arrival gaps, for diagnostics. */
  gaps(): readonly number[];
  /**
   * Forget the measured cadence but keep the buffered worlds.
   *
   * Called when the room changes gear — the lobby streams one snapshot every 8th tick (~128ms) and
   * live play every 2nd (~32ms). Those are different cadences, not a jittery connection, and without
   * this the delay learned while sitting in the lobby would carry into the opening seconds of the
   * match, rendering everyone needlessly far in the past until it decayed.
   */
  resetTiming(): void;
  reset(): void;
}

/**
 * Mutable on purpose: this is touched every frame by the renderer and ~31 times a second by the
 * socket. All of the actual decision-making lives in the pure functions above; this is just the
 * container that holds their state.
 */
export function createSnapshotBuffer(
  options: SnapshotBufferOptions = DEFAULT_SNAPSHOT_BUFFER_OPTIONS
): SnapshotBuffer {
  let entries: BufferedSnapshot[] = [];
  let gaps: number[] = [];
  let delay = options.minDelayMs;
  let lastReceivedAtMs: number | null = null;

  return {
    push(world, receivedAtMs) {
      // A snapshot that is not newer than what we hold tells us nothing about the future and would
      // break the ascending order sampleEntries relies on.
      if (entries.length > 0 && receivedAtMs <= entries[entries.length - 1].receivedAtMs) {
        return;
      }

      if (lastReceivedAtMs !== null) {
        const gap = receivedAtMs - lastReceivedAtMs;

        if (gap >= options.resetGapMs) {
          // A backgrounded tab (rAF suspended, arrivals queued) or a genuine stall. Neither is
          // jitter, and feeding it in would peg the delay at the ceiling for the next several
          // seconds of perfectly good play.
          gaps = [];
        } else {
          gaps.push(gap);
          if (gaps.length > GAP_WINDOW) {
            gaps.shift();
          }
          delay = updateDelay(delay, targetDelayMs(gaps, options), options);
        }
      }

      lastReceivedAtMs = receivedAtMs;
      entries.push({ world, receivedAtMs });
      if (entries.length > options.maxEntries) {
        entries.shift();
      }
    },

    sample(nowMs) {
      return sampleEntries(entries, nowMs - delay);
    },

    delayMs() {
      return delay;
    },

    gaps() {
      return gaps;
    },

    resetTiming() {
      gaps = [];
      delay = options.minDelayMs;
      lastReceivedAtMs = null;
    },

    reset() {
      entries = [];
      gaps = [];
      delay = options.minDelayMs;
      lastReceivedAtMs = null;
    },
  };
}
