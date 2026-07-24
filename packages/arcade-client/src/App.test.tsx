import { createWorld, DEFAULT_MATCH_RULES } from "@bbh/arcade-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArcadeClientState } from "./store.js";

vi.stubGlobal("window", {
  location: { pathname: "/" },
  setInterval: vi.fn(() => 1),
  clearInterval: vi.fn()
});
vi.stubGlobal("navigator", {
  getGamepads: vi.fn(() => [])
});

const reconnectPreviousRoom = vi.fn();
let lobbyProps: Record<string, unknown> | null = null;
const predictedFrames: unknown[] = [];
let currentInput = {
  moveX: 0,
  moveY: 0,
  stickX: 0,
  stickY: 0,
  pass: false,
  check: false,
  turbo: false,
  poke: false,
  dive: false,
  usePowerup: false
};

const baseState: ArcadeClientState = {
  connectionStatus: "idle",
  roomCode: "",
  playerSessionId: null,
  roomCreatorSessionId: null,
  rules: DEFAULT_MATCH_RULES,
  roster: [],
  score: { home: 0, away: 0 },
  phase: "waiting",
  isRosterValid: false,
  currentWorld: null,
  previousWorld: null,
  inputAcks: {},
  error: null
};

let currentState: ArcadeClientState = baseState;
let currentScreen: "boot" | "menu" | "lobby" | "freeskate" = "boot";
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
    useReducer: () => [currentState, () => undefined],
    useState: <T,>(initial: T) => {
      const hookIndex = stateHookCall++;

      if (hookIndex === 0) {
        return [currentScreen as T, () => undefined];
      }

      if (hookIndex === 1) {
        return [false as T, () => undefined];
      }

      if (hookIndex === 2) {
        return [currentAudioReady as T, () => undefined];
      }

      return [
        (typeof initial === "function" ? initial() : initial) as T,
        () => undefined
      ];
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

vi.mock("./ui/Lobby.js", () => ({
  Lobby: (props: Record<string, unknown>) => {
    lobbyProps = props;
    return <section aria-label="Lobby" />;
  }
}));

vi.mock("./render/ModelPreview.js", () => ({
  ModelPreview: () => <section aria-label="Model preview" />
}));

vi.mock("./dev/PerfHud.js", () => ({
  PerfHud: () => null,
  perfCounters: {}
}));

vi.mock("./input/keyboard.js", () => ({
  createKeyboardInputTracker: () => ({
    dispose: vi.fn(),
    clear: vi.fn(),
    read: vi.fn(() => currentInput)
  })
}));

vi.mock("./game/prediction.js", async (importOriginal) => {
  const prediction = await importOriginal<typeof import("./game/prediction.js")>();

  return {
    ...prediction,
    pushInputFrame: vi.fn((buffer: unknown[], frame: unknown) => {
      predictedFrames.push(frame);
      buffer.push(frame);
    })
  };
});

import { App } from "./App.js";

function resetHookState(): void {
  stateHookCall = 0;
  effectHookCall = 0;
  callbackHookCall = 0;
  refHookCall = 0;
  priorEffectDeps.length = 0;
  priorCallbackDeps.length = 0;
  priorCallbacks.length = 0;
  priorRefs.length = 0;
}

describe("App", () => {
  it("mounts only the unified Postgame surface after a match ends", () => {
    const world = createWorld(13, "arcade3v3");
    world.phase = "ended";
    world.winnerTeamId = "home";
    world.score = { home: 5, away: 2 };

    currentState = {
      ...baseState,
      connectionStatus: "connected",
      roomCode: "PUCK42",
      score: world.score,
      phase: "ended",
      isRosterValid: true,
      currentWorld: world
    };
    currentScreen = "lobby";
    currentAudioReady = false;
    resetHookState();

    const html = renderToStaticMarkup(<App />);

    expect(html.match(/aria-label="Postgame"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-label="Win splash"');
  });

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

    currentState = baseState;
    currentScreen = "boot";
    currentAudioReady = false;
    resetHookState();
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

  it("uses the same away-team transformed frame for local prediction and session input", () => {
    const world = createWorld(13, "arcade3v3");
    const sendInput = vi.fn();
    const audio = {
      start: vi.fn(),
      dispose: vi.fn(),
      getPreferences: vi.fn(() => ({ announcer: 1, gameplay: 1, music: 1 })),
      consumeWorld: vi.fn(),
      setPreferences: vi.fn(),
      setMenuMusicAllowed: vi.fn(),
      resetEventCursor: vi.fn()
    };

    currentInput = {
      moveX: 0.25,
      moveY: -0.5,
      stickX: 0.5,
      stickY: 0.75,
      pass: true,
      check: false,
      turbo: false,
      poke: false,
      dive: false,
      usePowerup: false
    };
    currentState = {
      ...baseState,
      connectionStatus: "connected",
      playerSessionId: "away-session",
      phase: "playing",
      currentWorld: world,
      roster: [
        {
          slotId: "away-skater-1",
          teamId: "away",
          index: 0,
          kind: "human",
          sessionId: "away-session",
          playerName: "Away Player",
          botId: null,
          characterId: "dash-iron",
          displayName: "Away Player",
          isBot: false,
          isCaptain: true,
          ready: true,
          teamJoinOrder: 1,
          isOwnedByLocalPlayer: true,
          controlledGoalieId: null,
          votedRematch: false
        }
      ]
    };
    currentScreen = "lobby";
    currentAudioReady = false;
    predictedFrames.length = 0;
    resetHookState();
    priorRefs[0] = { current: { session: { sendInput } } };

    App({ audio });

    expect(sendInput).toHaveBeenCalledTimes(1);
    expect(predictedFrames).toEqual([sendInput.mock.calls[0][0]]);
    expect(sendInput.mock.calls[0][0]).toMatchObject({
      moveX: 0.5,
      moveY: 0.25,
      stickX: 0.5,
      stickY: -0.75,
      pass: true
    });
  });

  it("delegates Lobby rule selections to the active room session", () => {
    const setMatchRules = vi.fn();
    currentState = {
      ...baseState,
      connectionStatus: "connected",
      phase: "waiting",
      rules: DEFAULT_MATCH_RULES
    };
    currentScreen = "lobby";
    currentAudioReady = false;
    lobbyProps = null;
    resetHookState();
    priorRefs[0] = { current: { session: { setMatchRules } } };

    renderToStaticMarkup(<App />);

    const capturedLobbyProps = lobbyProps as Record<string, unknown> | null;
    if (!capturedLobbyProps) {
      throw new Error("Lobby did not render");
    }
    const onSetMatchRules = capturedLobbyProps.onSetMatchRules as
      | ((rules: typeof DEFAULT_MATCH_RULES) => void)
      | undefined;
    onSetMatchRules?.({ ...DEFAULT_MATCH_RULES, timeLimitMs: 300_000 });

    expect(setMatchRules).toHaveBeenCalledWith({
      timeLimitMs: 300_000,
      goalLimit: DEFAULT_MATCH_RULES.goalLimit
    });
  });
});
