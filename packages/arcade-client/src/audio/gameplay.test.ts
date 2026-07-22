import { createWorld, type WorldEvent, type WorldState } from "@bbh/arcade-core";
import { describe, expect, it, vi } from "vitest";
import { AudioManager } from "./AudioManager.js";
import {
  gameplayCueForEvent,
  skatingMixForSpeed,
  type GameplayCueId
} from "./gameplay.js";

class FakeAudioParam {
  value = 1;
  readonly events: Array<{
    readonly type: string;
    readonly value: number;
    readonly time: number;
  }> = [];

  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ type: "setValueAtTime", value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ type: "setTargetAtTime", value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ type: "exponentialRampToValueAtTime", value, time });
    return this;
  }
}

class FakeGainNode {
  readonly kind = "gain";
  readonly gain = new FakeAudioParam();
  readonly connections: unknown[] = [];

  connect(target: unknown): unknown {
    this.connections.push(target);
    return target;
  }
}

class FakeBiquadFilterNode {
  readonly kind = "biquad-filter";
  type: BiquadFilterType = "lowpass";
  readonly frequency = new FakeAudioParam();
  readonly Q = new FakeAudioParam();
  readonly connections: unknown[] = [];

  connect(target: unknown): unknown {
    this.connections.push(target);
    return target;
  }
}

class FakeOscillatorNode {
  readonly kind = "oscillator";
  readonly frequency = new FakeAudioParam();
  type: OscillatorType = "sine";
  readonly connections: unknown[] = [];
  readonly starts: number[] = [];
  readonly stops: number[] = [];

  connect(target: unknown): unknown {
    this.connections.push(target);
    return target;
  }

  start(time = 0): void {
    this.starts.push(time);
  }

  stop(time = 0): void {
    this.stops.push(time);
  }
}

class FakeAudioBuffer {
  readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number
  ) {
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length)
    );
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel]!;
  }
}

class FakeBufferSourceNode {
  readonly kind = "bufferSource";
  readonly playbackRate = new FakeAudioParam();
  readonly connections: unknown[] = [];
  readonly starts: number[] = [];
  readonly stops: number[] = [];
  buffer: FakeAudioBuffer | null = null;
  loop = false;

  connect(target: unknown): unknown {
    this.connections.push(target);
    return target;
  }

  start(time = 0): void {
    this.starts.push(time);
  }

  stop(time = 0): void {
    this.stops.push(time);
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  currentTime = 0;
  readonly sampleRate = 48_000;
  readonly destination = { kind: "destination" };
  readonly gains: FakeGainNode[] = [];
  readonly filters: FakeBiquadFilterNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly buffers: FakeAudioBuffer[] = [];
  readonly bufferSources: FakeBufferSourceNode[] = [];
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    const filter = new FakeBiquadFilterNode();
    this.filters.push(filter);
    return filter;
  }

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number
  ): FakeAudioBuffer {
    const buffer = new FakeAudioBuffer(numberOfChannels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer;
  }

  createBufferSource(): FakeBufferSourceNode {
    const source = new FakeBufferSourceNode();
    this.bufferSources.push(source);
    return source;
  }
}

function installAudioWindow() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const fakeWindow = {
    AudioContext: FakeAudioContext,
    localStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow
  });

  return {
    restore() {
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  };
}

function event(
  type: string,
  overrides: Partial<WorldEvent> = {}
): WorldEvent {
  return {
    id: `${type}-1`,
    type,
    atMs: 1000,
    sourceSlotId: "home-skater-1",
    ...overrides
  };
}

function worldFixture(): WorldState {
  return createWorld(7, "arcade3v3");
}

describe("gameplayCueForEvent", () => {
  it("maps every supported gameplay event type to a cue id", () => {
    const cases: ReadonlyArray<readonly [WorldEvent, GameplayCueId]> = [
      [event("hit"), "hit"],
      [event("knockdown"), "knockdown"],
      [event("shot"), "shot"],
      [event("oneTimer"), "one-timer"],
      [event("post"), "post"],
      [event("block"), "block"],
      [event("poke"), "poke"],
      [event("jostle"), "jostle"],
      [event("bounceBack"), "bounce-back"],
      [event("save", { detail: "pad" }), "save-pad"],
      [event("save", { detail: "body" }), "save-body"],
      [event("save", { detail: "glove" }), "save-glove"],
      [event("save", { detail: "blocker" }), "save-blocker"],
      [event("save", { detail: "cover" }), "save-cover"],
      [event("clockCountdown", { detail: "7" }), "clock-tick"]
    ];

    expect(
      cases.map(([worldEvent]) => gameplayCueForEvent(worldEvent)?.id)
    ).toEqual(cases.map(([, cueId]) => cueId));
  });

  it("normalizes hit force with a fixed cap", () => {
    expect(gameplayCueForEvent(event("hit", { force: 0 }))).toEqual({
      id: "hit",
      intensity: 0
    });
    expect(gameplayCueForEvent(event("hit", { force: 600 }))).toEqual({
      id: "hit",
      intensity: 0.5
    });
    expect(gameplayCueForEvent(event("hit", { force: 2400 }))).toEqual({
      id: "hit",
      intensity: 1
    });
  });

  it("pips the final second of the clock countdown higher", () => {
    expect(gameplayCueForEvent(event("clockCountdown", { detail: "5" }))).toEqual({
      id: "clock-tick",
      intensity: 0
    });
    expect(gameplayCueForEvent(event("clockCountdown", { detail: "1" }))).toEqual({
      id: "clock-tick",
      intensity: 1
    });
  });

  it("returns silence for unknown, announcer-only, and spawn events", () => {
    expect(gameplayCueForEvent(event("goal"))).toBeNull();
    expect(gameplayCueForEvent(event("powerupPickup"))).toBeNull();
    expect(gameplayCueForEvent(event("powerupSpawn"))).toBeNull();
    expect(gameplayCueForEvent(event("bananaSpawn"))).toBeNull();
    expect(gameplayCueForEvent(event("cover"))).toBeNull();
    expect(gameplayCueForEvent(event("mystery"))).toBeNull();
  });
});

describe("skatingMixForSpeed", () => {
  it("keeps the continuous skating texture subtle at top speed", () => {
    expect(skatingMixForSpeed(430).gain).toBeLessThanOrEqual(0.12);
  });

  it("stays silent at zero speed and below the movement threshold", () => {
    expect(skatingMixForSpeed(0)).toEqual({
      gain: 0,
      playbackRate: 0.85
    });
    expect(skatingMixForSpeed(25)).toEqual({
      gain: 0,
      playbackRate: 0.85
    });
  });

  it("raises gain and playback rate monotonically as speed increases without exceeding bounds", () => {
    const slow = skatingMixForSpeed(80);
    const medium = skatingMixForSpeed(220);
    const fast = skatingMixForSpeed(420);
    const turbo = skatingMixForSpeed(9999);

    expect(slow.gain).toBeGreaterThan(0);
    expect(medium.gain).toBeGreaterThan(slow.gain);
    expect(fast.gain).toBeGreaterThan(medium.gain);
    expect(turbo.gain).toBe(0.12);

    expect(medium.playbackRate).toBeGreaterThan(slow.playbackRate);
    expect(fast.playbackRate).toBeGreaterThan(medium.playbackRate);
    expect(turbo.playbackRate).toBeLessThanOrEqual(1.35);
  });
});

describe("AudioManager gameplay runtime", () => {
  it("is a no-op before start", () => {
    const manager = new AudioManager();
    const world = worldFixture();
    world.eventQueue.push(event("hit"));

    expect(() => manager.consumeWorld(world, "home-skater-1")).not.toThrow();
  });

  it("plays each gameplay event once per id and keeps one persistent skating source for the local skater", () => {
    const { restore } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();
      manager.start();

      const world = worldFixture();
      world.skaters[0]!.velocity = { x: 180, y: 240 };
      world.eventQueue.push(event("hit", { id: "hit-1", force: 900 }));

      manager.consumeWorld(world, "home-skater-1");

      const context = FakeAudioContext.instances[0]!;
      expect(context.bufferSources).toHaveLength(2);
      expect(context.bufferSources[0]?.loop).toBe(true);
      expect(context.bufferSources[0]?.starts).toEqual([0]);

      const skatingGain = (
        manager as unknown as { skatingGain: FakeGainNode | null }
      ).skatingGain;
      expect(skatingGain?.gain.events.at(-1)?.value).toBeGreaterThan(0);

      manager.consumeWorld(world, "home-skater-1");

      expect(context.bufferSources).toHaveLength(2);
    } finally {
      restore();
    }
  });

  it("mutes skating when the local entity is absent or a goalie", () => {
    const { restore } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();
      manager.start();

      const world = worldFixture();
      world.skaters[0]!.velocity = { x: 300, y: 0 };

      manager.consumeWorld(world, "missing-skater");
      manager.consumeWorld(world, "home-goalie");

      const skatingGain = (
        manager as unknown as { skatingGain: FakeGainNode | null }
      ).skatingGain;
      const targetEvents =
        skatingGain?.gain.events.filter((entry) => entry.type === "setTargetAtTime") ?? [];

      expect(targetEvents.at(-1)?.value).toBe(0);
    } finally {
      restore();
    }
  });
});
