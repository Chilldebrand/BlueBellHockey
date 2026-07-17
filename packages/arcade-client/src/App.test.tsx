import { describe, expect, it, vi } from "vitest";
import type { ArcadeClientState } from "./store.js";

const reconnectPreviousRoom = vi.fn();

const baseState: ArcadeClientState = {
  connectionStatus: "idle",
  roomCode: "",
  playerSessionId: null,
  roster: [],
  score: { home: 0, away: 0 },
  phase: "waiting",
  isRosterValid: false,
  currentWorld: null,
  previousWorld: null,
  inputAcks: {},
  error: null
};

let currentAudioReady = false;
let stateHookCall = 0;
let effectHookCall = 0;
let callbackHookCall = 0;
let refHookCall = 0;
const priorEffectDeps: Array<readonly unknown[] | undefined> = [];
const priorCallbackDeps: Array<readonly unknown[] | undefined> = [];
const priorCallbacks: Array<((...args: never[]) => unknown) | undefined> = [];
const priorRefs: Array<{ current: unknown } | undefined> = [];

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();

  return {
    ...react,
    useReducer: () => [baseState, () => undefined],
    useState: <T,>(initial: T) => {
      const hookIndex = stateHookCall++;

      if (hookIndex === 0) {
        return ["boot" as T, () => undefined];
      }

      if (hookIndex === 1) {
        return [false as T, () => undefined];
      }

      if (hookIndex === 2) {
        return [currentAudioReady as T, () => undefined];
      }

      return [initial, () => undefined];
    },
    useRef: <T,>(initial: T) => {
      const hookIndex = refHookCall++;
      priorRefs[hookIndex] ??= { current: initial };
      return priorRefs[hookIndex] as { current: T };
    },
    useMemo: <T,>(factory: () => T) => factory(),
    useCallback: <T extends (...args: never[]) => unknown>(fn: T, deps?: readonly unknown[]) => {
      const hookIndex = callbackHookCall++;
      const previousDeps = priorCallbackDeps[hookIndex];
      const changed =
        !deps ||
        !previousDeps ||
        deps.length !== previousDeps.length ||
        deps.some((dep, index) => !Object.is(dep, previousDeps[index]));

      if (changed) {
        priorCallbacks[hookIndex] = fn;
        priorCallbackDeps[hookIndex] = deps;
      }

      return (priorCallbacks[hookIndex] ?? fn) as T;
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const hookIndex = effectHookCall++;
      const previousDeps = priorEffectDeps[hookIndex];
      const changed =
        !deps ||
        !previousDeps ||
        deps.length !== previousDeps.length ||
        deps.some((dep, index) => !Object.is(dep, previousDeps[index]));

      if (changed) {
        effect();
        priorEffectDeps[hookIndex] = deps;
      }
    }
  };
});

vi.mock("./render/Scene.js", () => ({
  Scene: () => <section aria-label="Arcade rink" />
}));

vi.mock("./render/ModelPreview.js", () => ({
  ModelPreview: () => <section aria-label="Model preview" />
}));

vi.mock("./input/keyboard.js", () => ({
  createKeyboardInputTracker: () => ({
    dispose: vi.fn(),
    clear: vi.fn(),
    getState: vi.fn(() => new Map())
  })
}));

import { App } from "./App.js";

describe("App reconnect lifecycle", () => {
  it("re-evaluates auto reconnect when Press Start flips audioReady", async () => {
    const connectionApi = {
      connectQuickMatch: vi.fn(),
      createPrivateRoom: vi.fn(),
      joinPrivateRoom: vi.fn(),
      hasReconnectTicket: vi.fn(() => true),
      reconnectPreviousRoom: reconnectPreviousRoom.mockResolvedValue(undefined)
    };

    const audio = {
      start: vi.fn(),
      dispose: vi.fn(),
      getPreferences: vi.fn(() => ({
        announcer: 1,
        gameplay: 1,
        music: 1
      })),
      consumeWorld: vi.fn(),
      setPreferences: vi.fn(),
      setMenuMusicAllowed: vi.fn(),
      resetEventCursor: vi.fn()
    };

    currentAudioReady = false;
    stateHookCall = 0;
    effectHookCall = 0;
    callbackHookCall = 0;
    refHookCall = 0;
    priorEffectDeps.length = 0;
    priorCallbackDeps.length = 0;
    priorCallbacks.length = 0;
    priorRefs.length = 0;
    reconnectPreviousRoom.mockClear();
    App({ connectionApi, audio });
    expect(reconnectPreviousRoom).not.toHaveBeenCalled();

    currentAudioReady = true;
    stateHookCall = 0;
    effectHookCall = 0;
    callbackHookCall = 0;
    refHookCall = 0;
    App({ connectionApi, audio });
    await Promise.resolve();

    expect(reconnectPreviousRoom).toHaveBeenCalledTimes(1);
  });
});
