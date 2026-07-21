import { createWorld } from "@bbh/arcade-core";
import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  DEFAULT_AUDIO_PREFERENCES
} from "./preferences.js";
import {
  AudioManager,
  type AudioInspectionHandle
} from "./AudioManager.js";

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

class FakeSpeechSynthesisUtterance {
  volume = 1;
  rate = 1;
  pitch = 1;

  constructor(readonly text: string) {}
}

class FakeAudioBuffer {
  readonly channels: Float32Array[];
  readonly duration: number;

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number
  ) {
    this.duration = length / sampleRate;
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length)
    );
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel]!;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static constructError: Error | null = null;

  currentTime = 0;
  readonly sampleRate = 48_000;
  state: AudioContextState = "running";
  readonly destination = { kind: "destination" };
  readonly gains: FakeGainNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly filters: FakeBiquadFilterNode[] = [];
  readonly buffers: FakeAudioBuffer[] = [];
  readonly bufferSources: Array<{
    buffer: FakeAudioBuffer | null;
    loop: boolean;
    playbackRate: FakeAudioParam;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  decodeAudioData = vi.fn(async () => new FakeAudioBuffer(1, 480, 48_000));

  constructor() {
    if (FakeAudioContext.constructError) {
      throw FakeAudioContext.constructError;
    }

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

  createBufferSource(): {
    buffer: FakeAudioBuffer | null;
    loop: boolean;
    playbackRate: FakeAudioParam;
    connect: (target: unknown) => unknown;
    start: (time?: number) => void;
    stop: (time?: number) => void;
  } {
    const source = {
      buffer: null,
      loop: false,
      playbackRate: new FakeAudioParam(),
      connect: vi.fn((target: unknown) => target),
      start: vi.fn(),
      stop: vi.fn()
    };
    this.bufferSources.push(source);
    return source;
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
}

function memoryStorage(seed?: Record<string, string>): Storage {
  const entries = new Map(Object.entries(seed ?? {}));

  return {
    get length() {
      return entries.size;
    },
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(entries.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      entries.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    })
  };
}

function installAudioWindow(storage?: Storage) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const fakeWindow = {
    AudioContext: FakeAudioContext,
    SpeechSynthesisUtterance: FakeSpeechSynthesisUtterance,
    speechSynthesis: {
      cancel: vi.fn(),
      speak: vi.fn()
    },
    localStorage: storage ?? memoryStorage(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow
  });

  return {
    fakeWindow,
    restore() {
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  };
}

describe("AudioManager", () => {
  it("uses a sparse ice-scrape texture instead of continuous white noise", () => {
    const { restore } = installAudioWindow();

    try {
      const manager = new AudioManager();
      manager.start();
      manager.consumeWorld(createWorld(3, "arcade3v3"), "home-skater-1");

      const samples = FakeAudioContext.instances[0]?.buffers[0]?.channels[0] ?? [];
      const silentSamples = samples.filter((sample) => Math.abs(sample) < 0.0001);
      expect(silentSamples.length / samples.length).toBeGreaterThan(0.5);
    } finally {
      restore();
    }
  });

  it("speaks a goal cue when voice assets are unavailable", async () => {
    const { restore, fakeWindow } = installAudioWindow();

    try {
      const manager = new AudioManager();
      manager.start();
      const world = createWorld(3, "arcade3v3");
      world.eventQueue = [
        {
          id: "goal-announcer-test",
          type: "goal",
          atMs: 100,
          sourceSlotId: "home-skater-1"
        }
      ];

      manager.consumeWorld(world, "home-skater-1");

      await vi.waitFor(() => {
        expect(fakeWindow.speechSynthesis.speak).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringMatching(/^Rook Rocket /)
          })
        );
      });
      manager.dispose();
    } finally {
      restore();
    }
  });

  it("plays loaded announcer clips instead of using speech synthesis", async () => {
    const { restore, fakeWindow } = installAudioWindow();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/audio/manifest.json") {
        return {
          ok: true,
          headers: { get: (_name: string): string => "application/json" },
          json: async () => ({
            clips: {
              "announcer.goal.0": ["/audio/announcer/goals/goal-0.ogg"]
            }
          })
        };
      }

      return {
        ok: true,
        headers: { get: (_name: string): string => "audio/ogg" },
        arrayBuffer: async () => new ArrayBuffer(8)
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);

    try {
      const manager = new AudioManager();
      manager.start();
      const context = FakeAudioContext.instances.at(-1)!;
      const world = createWorld(3, "arcade3v3");
      world.eventQueue = [
        {
          id: "goal-asset-playback-test",
          type: "goal",
          atMs: 100
        }
      ];

      manager.consumeWorld(world, "home-skater-1");

      await vi.waitFor(() => {
        expect(context.bufferSources).toHaveLength(2);
      });
      expect(context.bufferSources[1]?.start).toHaveBeenCalled();
      expect(fakeWindow.speechSynthesis.speak).not.toHaveBeenCalled();
      manager.dispose();
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      restore();
    }
  });

  it("routes the skating texture through a quiet low-pass filter", () => {
    const { restore } = installAudioWindow();

    try {
      const manager = new AudioManager();
      manager.start();
      manager.consumeWorld(createWorld(3, "arcade3v3"), "home-skater-1");

      const [filter] = FakeAudioContext.instances[0]?.filters ?? [];
      expect(filter?.type).toBe("lowpass");
      expect(filter?.frequency.value).toBeLessThanOrEqual(400);
    } finally {
      restore();
    }
  });

  it("starts once, creates one context and one gain node per bus, and applies loaded preferences", () => {
    const storage = memoryStorage({
      [AUDIO_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        announcer: 0.2,
        gameplay: 0.4,
        music: 0.6
      })
    });
    const { restore, fakeWindow } = installAudioWindow(storage);
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();

      manager.start();
      manager.start();

      expect(FakeAudioContext.instances).toHaveLength(1);

      const context = FakeAudioContext.instances[0]!;
      expect(context.gains).toHaveLength(5);
      expect(manager.getPreferences()).toEqual({
        announcer: 0.2,
        gameplay: 0.4,
        music: 0.6
      });
      expect(
        ((manager as unknown as { masterGain: FakeGainNode | null }).masterGain)
          ?.gain.value
      ).toBe(1);
      expect(
        (
          (manager as unknown as { announcerGain: FakeGainNode | null })
            .announcerGain
        )?.gain.value
      ).toBe(0.2);
      expect(
        (
          (manager as unknown as { gameplayGain: FakeGainNode | null })
            .gameplayGain
        )?.gain.value
      ).toBe(0.4);
      expect(
        ((manager as unknown as { musicGain: FakeGainNode | null }).musicGain)
          ?.gain.value
      ).toBe(0.6);
      expect(fakeWindow.addEventListener).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it("exposes only safe development inspection snapshots", () => {
    const { restore, fakeWindow } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();
      const handle = (fakeWindow as typeof fakeWindow & {
        __bbhArcadeAudio?: AudioInspectionHandle;
      }).__bbhArcadeAudio;

      expect(handle).toBeDefined();
      expect(Object.keys(handle ?? {}).sort()).toEqual([
        "getBusLevels",
        "getDiagnostics",
        "getMenuMusicState",
        "getPreferences",
        "runEventCursorSmoke",
        "start"
      ]);
      expect((handle as unknown as Record<string, unknown>).context).toBeUndefined();
      expect((handle as unknown as Record<string, unknown>).consumeWorld).toBeUndefined();

      handle?.start();

      expect(handle?.getPreferences()).toEqual(DEFAULT_AUDIO_PREFERENCES);
      expect(handle?.getMenuMusicState()).toEqual({
        allowed: false,
        active: false
      });
      expect(handle?.getBusLevels()).toEqual({
        master: 1,
        announcer: DEFAULT_AUDIO_PREFERENCES.announcer,
        gameplay: DEFAULT_AUDIO_PREFERENCES.gameplay,
        music: DEFAULT_AUDIO_PREFERENCES.music
      });
      expect(handle?.getDiagnostics()).toMatchObject({
        contextAvailable: true,
        contextState: "running",
        processedEventCount: 0,
        duplicateEventCount: 0
      });
      expect(handle?.runEventCursorSmoke()).toMatchObject({
        processedEventCount: 2,
        duplicateEventCount: 2,
        announcerGoalCount: 1,
        announcerPowerupCount: 1
      });
      expect(manager).toBeInstanceOf(AudioManager);
    } finally {
      restore();
    }
  });

  it("counts goal and powerup events once across duplicate world snapshots", () => {
    const { restore, fakeWindow } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();
      manager.start();
      const world = createWorld(3, "arcade3v3");
      world.eventQueue = [
        {
          id: "verify-goal-1",
          type: "goal",
          atMs: 100,
          sourceSlotId: "home-skater-1"
        },
        {
          id: "verify-powerup-1",
          type: "powerupPickup",
          atMs: 100,
          sourceSlotId: "home-skater-1",
          targetSlotId: "speed-boost"
        }
      ];

      manager.consumeWorld(world, "home-skater-1");
      manager.consumeWorld(world, "home-skater-1");

      const handle = (fakeWindow as typeof fakeWindow & {
        __bbhArcadeAudio?: AudioInspectionHandle;
      }).__bbhArcadeAudio;
      expect(handle?.getDiagnostics()).toMatchObject({
        processedEventCount: 2,
        duplicateEventCount: 2,
        announcerGoalCount: 1,
        announcerPowerupCount: 1
      });
    } finally {
      restore();
    }
  });

  it("normalizes each bus in setPreferences before storing and applying runtime gains", () => {
    const storage = memoryStorage();
    const { restore } = installAudioWindow(storage);
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();
      manager.start();

      manager.setPreferences({
        announcer: Number.NaN,
        gameplay: 9,
        music: Number.NEGATIVE_INFINITY
      });

      expect(manager.getPreferences()).toEqual({
        announcer: DEFAULT_AUDIO_PREFERENCES.announcer,
        gameplay: 1,
        music: DEFAULT_AUDIO_PREFERENCES.music
      });
      expect(storage.setItem).toHaveBeenLastCalledWith(
        AUDIO_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          announcer: DEFAULT_AUDIO_PREFERENCES.announcer,
          gameplay: 1,
          music: DEFAULT_AUDIO_PREFERENCES.music
        })
      );
      expect(
        (
          (manager as unknown as { announcerGain: FakeGainNode | null })
            .announcerGain
        )?.gain.value
      ).toBe(DEFAULT_AUDIO_PREFERENCES.announcer);
      expect(
        (
          (manager as unknown as { gameplayGain: FakeGainNode | null })
            .gameplayGain
        )?.gain.value
      ).toBe(1);
      expect(
        ((manager as unknown as { musicGain: FakeGainNode | null }).musicGain)
          ?.gain.value
      ).toBe(DEFAULT_AUDIO_PREFERENCES.music);
    } finally {
      restore();
    }
  });

  it("starts menu music only after start and fades it out when disabled", () => {
    vi.useFakeTimers();
    const { restore } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();

      manager.setMenuMusicAllowed(true);
      expect(vi.getTimerCount()).toBe(0);

      manager.start();
      expect(vi.getTimerCount()).toBe(1);

      const context = FakeAudioContext.instances[0]!;
      context.currentTime = 1;
      vi.advanceTimersByTime(25);
      expect(context.oscillators.length).toBeGreaterThan(0);

      const menuMusicOutput = (
        manager as unknown as {
          menuMusic: { output: FakeGainNode } | null;
        }
      ).menuMusic?.output;
      manager.setMenuMusicAllowed(false);

      expect(menuMusicOutput?.gain.events.at(-1)).toMatchObject({
        type: "setTargetAtTime",
        value: 0.0001,
        time: 1
      });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
      restore();
    }
  });

  it("disposes safely before or after initialization and clears timers and listeners", () => {
    vi.useFakeTimers();
    const { restore, fakeWindow } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const unstartedManager = new AudioManager();
      expect(() => unstartedManager.dispose()).not.toThrow();

      const manager = new AudioManager();
      manager.start();
      manager.setMenuMusicAllowed(true);

      expect(vi.getTimerCount()).toBe(1);

      expect(() => manager.dispose()).not.toThrow();
      expect(vi.getTimerCount()).toBe(0);
      expect(fakeWindow.removeEventListener).toHaveBeenCalledTimes(1);
      expect(FakeAudioContext.instances[0]?.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      restore();
    }
  });

  it("swallows the retained event backlog after a cursor reset instead of replaying it", async () => {
    const { restore, fakeWindow } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();
      manager.start();
      manager.resetEventCursor();

      const world = createWorld(3, "arcade3v3");
      world.eventQueue = [
        {
          id: "backlog-goal-1",
          type: "goal",
          atMs: 100,
          sourceSlotId: "home-skater-1"
        },
        {
          id: "backlog-hit-1",
          type: "hit",
          atMs: 200,
          sourceSlotId: "home-skater-2"
        }
      ];

      // First snapshot after the reset carries the backlog: consumed silently.
      manager.consumeWorld(world, "home-skater-1");

      const handle = (fakeWindow as typeof fakeWindow & {
        __bbhArcadeAudio?: AudioInspectionHandle;
      }).__bbhArcadeAudio;
      expect(handle?.getDiagnostics()).toMatchObject({
        processedEventCount: 0,
        suppressedEventCount: 2,
        announcerGoalCount: 0
      });
      expect(fakeWindow.speechSynthesis.speak).not.toHaveBeenCalled();

      // A genuinely new event on the next snapshot plays normally.
      world.eventQueue = [
        ...world.eventQueue,
        {
          id: "backlog-goal-2",
          type: "goal",
          atMs: 300,
          sourceSlotId: "home-skater-1"
        }
      ];
      manager.consumeWorld(world, "home-skater-1");

      await vi.waitFor(() => {
        expect(fakeWindow.speechSynthesis.speak).toHaveBeenCalledTimes(1);
      });
      expect(handle?.getDiagnostics()).toMatchObject({
        processedEventCount: 1,
        suppressedEventCount: 2,
        announcerGoalCount: 1
      });
      manager.dispose();
    } finally {
      restore();
    }
  });

  it("silences the skating loop when the event cursor resets on screen changes", () => {
    const { restore } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();
      manager.start();

      const world = createWorld(3, "arcade3v3");
      const skater = world.skaters.find((entry) => entry.id === "home-skater-1")!;
      skater.velocity = { x: 900, y: 0 };
      manager.consumeWorld(world, "home-skater-1");

      const skatingGain = (
        manager as unknown as { skatingGain: FakeGainNode | null }
      ).skatingGain;
      expect(skatingGain?.gain.value ?? 0).toBeGreaterThan(0);

      manager.resetEventCursor();

      expect(skatingGain?.gain.events.at(-1)).toMatchObject({
        type: "setTargetAtTime",
        value: 0
      });
    } finally {
      restore();
    }
  });

  it("interrupts an active powerup announcement when a goal arrives", async () => {
    const { restore, fakeWindow } = installAudioWindow();
    FakeAudioContext.instances.length = 0;

    try {
      const manager = new AudioManager();
      manager.start();

      const world = createWorld(3, "arcade3v3");
      world.eventQueue = [
        {
          id: "interrupt-powerup-1",
          type: "powerupPickup",
          atMs: 100,
          sourceSlotId: "home-skater-1",
          targetSlotId: "speed-boost"
        }
      ];
      manager.consumeWorld(world, "home-skater-1");

      await vi.waitFor(() => {
        expect(fakeWindow.speechSynthesis.speak).toHaveBeenCalledTimes(1);
      });
      expect(
        (fakeWindow.speechSynthesis.speak.mock.calls[0]?.[0] as { text: string })
          .text
      ).toContain("another gear");

      // The goal must play immediately — no waiting out the powerup's window.
      world.eventQueue = [
        ...world.eventQueue,
        {
          id: "interrupt-goal-1",
          type: "goal",
          atMs: 200,
          sourceSlotId: "home-skater-1"
        }
      ];
      manager.consumeWorld(world, "home-skater-1");

      await vi.waitFor(() => {
        expect(fakeWindow.speechSynthesis.speak).toHaveBeenCalledTimes(2);
      });
      expect(fakeWindow.speechSynthesis.cancel).toHaveBeenCalled();
      expect(
        (fakeWindow.speechSynthesis.speak.mock.calls[1]?.[0] as { text: string })
          .text
      ).toMatch(/^Rook Rocket /);
      manager.dispose();
    } finally {
      restore();
    }
  });

  it("stays safe when Web Audio is unavailable", () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: memoryStorage()
      }
    });

    try {
      const manager = new AudioManager();

      expect(() => {
        manager.start();
        manager.setMenuMusicAllowed(true);
        manager.setPreferences(DEFAULT_AUDIO_PREFERENCES);
        manager.consumeWorld(null as never, null);
        manager.resetEventCursor();
        manager.dispose();
      }).not.toThrow();
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  });

  it("stays safe when AudioContext construction throws during start", () => {
    const { restore } = installAudioWindow();
    FakeAudioContext.instances.length = 0;
    FakeAudioContext.constructError = new Error("constructor failed");

    try {
      const manager = new AudioManager();

      expect(() => manager.start()).not.toThrow();
      expect(FakeAudioContext.instances).toHaveLength(0);
      expect(manager.getPreferences()).toEqual(DEFAULT_AUDIO_PREFERENCES);
      expect(() => {
        manager.start();
        manager.setMenuMusicAllowed(true);
        manager.setPreferences(DEFAULT_AUDIO_PREFERENCES);
        manager.dispose();
      }).not.toThrow();
    } finally {
      FakeAudioContext.constructError = null;
      restore();
    }
  });
});
