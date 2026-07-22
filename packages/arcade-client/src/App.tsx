import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  MATCH_CONFIG,
  type CharacterId,
  type InputFrame,
  type MatchRules,
  type SkaterEntity,
  type TeamId
} from "@bbh/arcade-core";
import { gamepadStateFromGamepad } from "./input/gamepad.js";
import {
  createInputFrame,
  createNeutralInputState,
  mergeInputStates
} from "./input/inputState.js";
import {
  createKeyboardInputTracker,
  type KeyboardInputTracker
} from "./input/keyboard.js";
import {
  predictLocalState,
  pruneAcknowledgedFrames,
  pushInputFrame,
  smoothPredictedSkater
} from "./game/prediction.js";
import {
  connectQuickMatch,
  createPrivateRoom,
  hasReconnectTicket,
  joinPrivateRoom,
  normalizePrivateRoomCode,
  reconnectPreviousRoom,
  saveReconnectTicket,
  type ArcadeConnectionResult
} from "./net/client.js";
import {
  disposeStaleConnection,
  isCurrentConnectionAttempt,
  startConnectionAttempt,
  type ConnectionAttemptRef
} from "./net/connectionAttempt.js";
import {
  attachArcadeRoom,
  type ActiveRoomRef
} from "./net/sessionBinding.js";
import {
  buildHighlightColorByEntityId,
  createInitialArcadeClientState,
  reduceArcadeClientState,
  type ArcadeClientAction
} from "./store.js";
import { PerfHud, perfCounters } from "./dev/PerfHud.js";
import { Scene } from "./render/Scene.js";
import { ModelPreview } from "./render/ModelPreview.js";
import {
  audioManager,
  type AudioManagerApi
} from "./audio/AudioManager.js";
import {
  loadAudioPreferences,
  type AudioPreferences
} from "./audio/preferences.js";
import {
  loadControlPreferences,
  saveControlPreferences,
  type ControlPreferences
} from "./input/controlPreferences.js";
import { transformStickForTeam } from "./input/stickControls.js";
import { HUD } from "./ui/HUD.js";
import { BootSplash } from "./ui/BootSplash.js";
import { ControllerPrompt } from "./ui/ControllerPrompt.js";
import { FaceoffIntro } from "./ui/FaceoffIntro.js";
import { FreeSkate } from "./ui/FreeSkate.js";
import { Lobby } from "./ui/Lobby.js";
import { MainMenu } from "./ui/MainMenu.js";
import { Postgame } from "./ui/Postgame.js";
import {
  isMenuMusicAllowed,
  shouldReconnectAfterAudioInit
} from "./ui/runtimeGuards.js";
import { SettingsOverlay } from "./ui/SettingsOverlay.js";

export interface AppConnectionApi {
  readonly connectQuickMatch: typeof connectQuickMatch;
  readonly createPrivateRoom: typeof createPrivateRoom;
  readonly joinPrivateRoom: typeof joinPrivateRoom;
  readonly reconnectPreviousRoom?: typeof reconnectPreviousRoom;
  readonly hasReconnectTicket?: typeof hasReconnectTicket;
}

const defaultConnectionApi: AppConnectionApi = {
  connectQuickMatch,
  createPrivateRoom,
  joinPrivateRoom,
  reconnectPreviousRoom,
  hasReconnectTicket
};

export function App({
  connectionApi = defaultConnectionApi,
  audio = audioManager
}: {
  readonly connectionApi?: AppConnectionApi;
  readonly audio?: AudioManagerApi;
}): JSX.Element {
  const [state, dispatch] = useReducer(
    reduceArcadeClientState,
    undefined,
    createInitialArcadeClientState
  );
  const activeRoomRef = useRef<ActiveRoomRef["current"]>(null);
  const connectionAttemptRef = useRef<ConnectionAttemptRef["current"]>(0);
  const keyboardRef = useRef<KeyboardInputTracker | null>(null);
  const inputSequenceRef = useRef(0);
  const unackedFramesRef = useRef<InputFrame[]>([]);
  const smoothedSkaterRef = useRef<SkaterEntity | null>(null);
  const predictedSlotIdRef = useRef<string | null>(null);
  const [screen, setScreen] = useState<"boot" | "menu" | "lobby" | "freeskate">(
    "boot"
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioPreferences, setAudioPreferences] = useState<AudioPreferences>(() =>
    loadAudioPreferences()
  );
  const [controlPreferences, setControlPreferences] =
    useState<ControlPreferences>(() => loadControlPreferences());
  const audioRef = useRef(audio);
  const consumedWorldCursorRef = useRef<{
    readonly tick: number;
    readonly localEntityId: string | null;
  } | null>(null);

  const reconnectSourceRef = useRef<ArcadeConnectionResult | null>(null);

  const attachRoom = useCallback((result: ArcadeConnectionResult) => {
    audioRef.current.resetEventCursor();
    consumedWorldCursorRef.current = null;
    attachArcadeRoom(activeRoomRef, result, {
      onState: ({ room }) => {
        perfCounters.roomStatePatches += 1;
        dispatch({ type: "room.state", room });
      },
      onError: (message) => dispatch({ type: "connection.error", message }),
      onLeave: (message) => dispatch({ type: "connection.left", message }),
      onWorldSnapshot: (world, inputAcks) => {
        perfCounters.worldSnapshots += 1;
        dispatch({ type: "world.snapshot", world, inputAcks });
      }
    });
    reconnectSourceRef.current = result;
    saveReconnectTicket(result.room, result.options);
  }, []);

  useEffect(() => {
    audioRef.current.setPreferences(audioPreferences);
  }, [audioPreferences]);

  useEffect(() => {
    audioRef.current.setMenuMusicAllowed(isMenuMusicAllowed(screen, state.phase));
  }, [screen, state.phase]);

  useEffect(() => {
    if (state.connectionStatus === "connected") {
      return;
    }

    audioRef.current.resetEventCursor();
    consumedWorldCursorRef.current = null;
  }, [state.connectionStatus]);

  useEffect(() => {
    return () => {
      audioRef.current.dispose();
    };
  }, []);

  // Keep the stored reconnect ticket fresh while connected: its 30s window
  // must be measured from the moment the connection drops, not from join,
  // or a reload minutes into a match would never even try to reconnect.
  useEffect(() => {
    if (state.connectionStatus !== "connected") {
      return;
    }

    const intervalId = window.setInterval(() => {
      const source = reconnectSourceRef.current;
      if (source) {
        saveReconnectTicket(source.room, source.options);
      }
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.connectionStatus]);

  useEffect(() => {
    keyboardRef.current = createKeyboardInputTracker();

    return () => {
      keyboardRef.current?.dispose();
      keyboardRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    keyboardRef.current?.clear();
  }, [settingsOpen]);

  const runConnection = useCallback(
    async (connect: () => Promise<Parameters<typeof attachRoom>[0]>) => {
      const attempt = startConnectionAttempt(connectionAttemptRef);
      dispatch({ type: "connection.start" });
      try {
        const result = await connect();

        if (!isCurrentConnectionAttempt(connectionAttemptRef, attempt)) {
          disposeStaleConnection(result);
          return;
        }

        attachRoom(result);
      } catch (error) {
        if (isCurrentConnectionAttempt(connectionAttemptRef, attempt)) {
          dispatch(connectionErrorAction(error));
        }
      }
    },
    [attachRoom]
  );

  useEffect(() => {
    if (
      !shouldReconnectAfterAudioInit({
        audioReady,
        hasReconnectTicket: connectionApi.hasReconnectTicket?.() ?? false,
        reconnectPreviousRoom: connectionApi.reconnectPreviousRoom
      })
    ) {
      return;
    }

    setScreen("lobby");
    void runConnection(async () => {
      const result = await connectionApi.reconnectPreviousRoom?.();
      if (!result) {
        throw new Error("Reconnect expired");
      }

      return result;
    });
  }, [audioReady, connectionApi, runConnection]);

  const handleQuickMatch = useCallback(() => {
    setScreen("lobby");
    setSettingsOpen(false);
    audioRef.current.resetEventCursor();
    consumedWorldCursorRef.current = null;
    void runConnection(() => connectionApi.connectQuickMatch());
  }, [connectionApi, runConnection]);

  const handleCreatePrivateRoom = useCallback(() => {
    setScreen("lobby");
    setSettingsOpen(false);
    audioRef.current.resetEventCursor();
    consumedWorldCursorRef.current = null;
    void runConnection(() => connectionApi.createPrivateRoom());
  }, [connectionApi, runConnection]);

  const handleJoinPrivateRoom = useCallback(
    (code: string) => {
      setSettingsOpen(false);
      audioRef.current.resetEventCursor();
      consumedWorldCursorRef.current = null;
      void runConnection(() =>
        connectionApi.joinPrivateRoom(normalizePrivateRoomCode(code))
      );
    },
    [connectionApi, runConnection]
  );

  const handleChooseTeam = useCallback((teamId: TeamId) => {
    activeRoomRef.current?.session.chooseTeam(teamId);
  }, []);

  const handleChooseCharacterFor = useCallback(
    (slotId: string, characterId: CharacterId) => {
      activeRoomRef.current?.session.chooseCharacterFor(slotId, characterId);
    },
    []
  );

  const handleSetPlayerName = useCallback((playerName: string) => {
    activeRoomRef.current?.session.setPlayerName(playerName);
  }, []);

  const handleSetReady = useCallback((ready: boolean) => {
    activeRoomRef.current?.session.setReady(ready);
  }, []);

  const handleKickPlayer = useCallback((sessionId: string) => {
    activeRoomRef.current?.session.kickPlayer(sessionId);
  }, []);

  const handleSetMatchRules = useCallback((rules: MatchRules) => {
    activeRoomRef.current?.session.setMatchRules(rules);
  }, []);

  const handleRequestStart = useCallback(() => {
    activeRoomRef.current?.session.requestStart();
  }, []);

  const handleRematch = useCallback(() => {
    activeRoomRef.current?.session.requestRematch();
  }, []);

  const handleBackToLobby = useCallback(() => {
    activeRoomRef.current?.session.backToLobby();
    setScreen("lobby");
  }, []);

  const handleAudioPreferencesChange = useCallback((next: AudioPreferences) => {
    setAudioPreferences(next);
    audioRef.current.setPreferences(next);
  }, []);

  const handleControlPreferencesChange = useCallback(
    (next: ControlPreferences) => {
      setControlPreferences(next);
      saveControlPreferences(next);
    },
    []
  );

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const localSlot = state.roster.find((slot) => slot.isOwnedByLocalPlayer);
  const localSlotId = localSlot?.slotId ?? null;
  const localTeamId = localSlot?.teamId ?? null;
  // Temporary goalie control: while the server grants us the covering goalie,
  // input, highlight, and camera target it; the skater slot stays ours.
  const localGoalieId = localSlot?.controlledGoalieId ?? null;
  const localControlledEntityId = localGoalieId ?? localSlotId;

  useEffect(() => {
    if (screen === "freeskate") {
      return;
    }

    if (!state.currentWorld) {
      consumedWorldCursorRef.current = null;
      return;
    }

    if (
      consumedWorldCursorRef.current?.tick === state.currentWorld.time.tick &&
      consumedWorldCursorRef.current.localEntityId === localControlledEntityId
    ) {
      return;
    }

    consumedWorldCursorRef.current = {
      tick: state.currentWorld.time.tick,
      localEntityId: localControlledEntityId
    };
    audioRef.current.consumeWorld(state.currentWorld, localControlledEntityId);
  }, [localControlledEntityId, screen, state.currentWorld]);

  const highlightColorByEntityId = useMemo(
    () => buildHighlightColorByEntityId(state.roster),
    [state.roster]
  );

  useEffect(() => {
    if (!localControlledEntityId || !localTeamId || !state.playerSessionId) {
      unackedFramesRef.current = [];
      return;
    }

    const playerSessionId = state.playerSessionId;
    const isGoalieControlled = localControlledEntityId !== localSlotId;
    const sendInput = () => {
      const input = settingsOpen
        ? createNeutralInputState()
        : mergeInputStates(
            keyboardRef.current?.read() ?? createNeutralInputState(),
            gamepadStateFromGamepad(navigator.getGamepads?.()[0] ?? null)
          );
      const frame = createInputFrame({
        input: {
          ...input,
          stickY: transformStickForTeam(
            input.stickY,
            localTeamId,
            controlPreferences.alwaysUpStickControls,
            input.isAccessibilityShotGesture === true
          )
        },
        playerId: playerSessionId,
        slotId: localControlledEntityId,
        sequence: (inputSequenceRef.current += 1)
      });

      // Goalie control renders pure authoritative snapshots — no local
      // movement prediction — so goalie-targeted frames are never replayed.
      if (!isGoalieControlled) {
        pushInputFrame(unackedFramesRef.current, frame);
      }
      activeRoomRef.current?.session.sendInput(frame);
    };
    const intervalId = window.setInterval(
      sendInput,
      MATCH_CONFIG.fixedTickMs
    );

    sendInput();

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    controlPreferences.alwaysUpStickControls,
    localControlledEntityId,
    localSlotId,
    localTeamId,
    settingsOpen,
    state.playerSessionId
  ]);

  // Madden-style control switching (and a goalie grant starting or ending)
  // reassigns which entity we drive mid-play. The buffered unacked frames are
  // tagged with the OLD entity; replaying them after a switch would drive the
  // wrong body and starve the new one. Drop them (and the follow smoothing) so
  // we fall back to the authoritative snapshot for the ~1 RTT until fresh,
  // correctly-tagged frames refill the buffer.
  if (localControlledEntityId !== predictedSlotIdRef.current) {
    unackedFramesRef.current = [];
    smoothedSkaterRef.current = null;
    predictedSlotIdRef.current = localControlledEntityId;
  }

  // Input-replay prediction: drop server-acknowledged frames, then
  // re-simulate the remainder on top of the freshest snapshot. Suspended
  // entirely while goalie-controlled (authoritative snapshots only).
  if (localSlotId && !localGoalieId) {
    pruneAcknowledgedFrames(
      unackedFramesRef.current,
      state.inputAcks[localSlotId]
    );
  }

  const predicted = predictLocalState(
    state.currentWorld,
    localGoalieId ? null : localSlotId,
    unackedFramesRef.current
  );
  const predictedLocalSkater = predicted
    ? smoothPredictedSkater(smoothedSkaterRef.current, predicted.skater)
    : null;
  smoothedSkaterRef.current = predictedLocalSkater;
  const predictedPuck =
    predicted &&
    localSlotId &&
    (predicted.puck.carrierSlotId === localSlotId ||
      state.currentWorld?.puck.carrierSlotId === localSlotId)
      ? predicted.puck
      : null;
  perfCounters.appRenders += 1;
  const isModelPreviewRoute =
    typeof window !== "undefined" && window.location.pathname === "/model-preview";

  if (isModelPreviewRoute) {
    return <ModelPreview />;
  }

  if (screen === "boot") {
    return (
      <BootSplash
        onContinue={() => {
          audioRef.current.start();
          setAudioReady(true);
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "menu") {
    return (
      <>
        <MainMenu
          onQuickMatch={handleQuickMatch}
          onPrivateRoom={handleCreatePrivateRoom}
          onFreeSkate={() => {
            setSettingsOpen(false);
            audioRef.current.resetEventCursor();
            consumedWorldCursorRef.current = null;
            setScreen("freeskate");
          }}
          onOpenSettings={handleOpenSettings}
        />
        <SettingsOverlay
          open={settingsOpen}
          preferences={audioPreferences}
          controlPreferences={controlPreferences}
          onChange={handleAudioPreferencesChange}
          onControlPreferencesChange={handleControlPreferencesChange}
          onClose={handleCloseSettings}
        />
      </>
    );
  }

  if (screen === "freeskate") {
    return (
      <FreeSkate
        onExit={() => {
          setSettingsOpen(false);
          audioRef.current.resetEventCursor();
          consumedWorldCursorRef.current = null;
          setScreen("menu");
        }}
        onOpenSettings={handleOpenSettings}
        settingsOpen={settingsOpen}
        audioPreferences={audioPreferences}
        onAudioPreferencesChange={handleAudioPreferencesChange}
        onCloseSettings={handleCloseSettings}
        onWorldUpdate={(world, localEntityId) => {
          consumedWorldCursorRef.current = {
            tick: world.time.tick,
            localEntityId
          };
          audioRef.current.consumeWorld(world, localEntityId);
        }}
      />
    );
  }

  if (state.phase === "ended" && state.currentWorld) {
    return (
      <>
        <PerfHud />
        <Scene
          currentWorld={state.currentWorld}
          previousWorld={state.previousWorld}
          localSlotId={localSlotId}
          localGoalieId={localGoalieId}
          predictedLocalSkater={predictedLocalSkater}
          predictedPuck={predictedPuck}
          highlightColorByEntityId={highlightColorByEntityId}
        />
        <Postgame
          world={state.currentWorld}
          onRematch={handleRematch}
          onBackToLobby={handleBackToLobby}
          onOpenSettings={handleOpenSettings}
        />
        <SettingsOverlay
          open={settingsOpen}
          preferences={audioPreferences}
          controlPreferences={controlPreferences}
          onChange={handleAudioPreferencesChange}
          onControlPreferencesChange={handleControlPreferencesChange}
          onClose={handleCloseSettings}
        />
      </>
    );
  }

  return (
    <>
      <PerfHud />
      {/* The redesigned lobby is a full screen with its own scoreboard; the
          floating match HUD only belongs over live play. */}
      {state.phase === "playing" ? (
        <HUD state={state} onOpenSettings={handleOpenSettings} />
      ) : null}
      <FaceoffIntro
        phase={state.phase}
        faceoffUntilMs={state.currentWorld?.faceoffUntilMs ?? 0}
        nowMs={state.currentWorld?.time.nowMs ?? 0}
      />
      <Scene
        currentWorld={state.currentWorld}
        previousWorld={state.previousWorld}
        localSlotId={localSlotId}
        localGoalieId={localGoalieId}
        predictedLocalSkater={predictedLocalSkater}
        predictedPuck={predictedPuck}
        highlightColorByEntityId={highlightColorByEntityId}
      />
      {state.phase === "playing" ? null : (
        <>
          <Lobby
            state={state}
            onQuickMatch={handleQuickMatch}
            onCreatePrivateRoom={handleCreatePrivateRoom}
            onJoinPrivateRoom={handleJoinPrivateRoom}
            onChooseTeam={handleChooseTeam}
            onChooseCharacterFor={handleChooseCharacterFor}
            onSetPlayerName={handleSetPlayerName}
            onSetReady={handleSetReady}
            onSetMatchRules={handleSetMatchRules}
            onRequestStart={handleRequestStart}
            onKickPlayer={handleKickPlayer}
            onOpenSettings={handleOpenSettings}
          />
          <ControllerPrompt />
        </>
      )}
      <SettingsOverlay
        open={settingsOpen}
        preferences={audioPreferences}
        controlPreferences={controlPreferences}
        onChange={handleAudioPreferencesChange}
        onControlPreferencesChange={handleControlPreferencesChange}
        onClose={handleCloseSettings}
      />
    </>
  );
}

function connectionErrorAction(error: unknown): ArcadeClientAction {
  return {
    type: "connection.error",
    message: error instanceof Error ? error.message : "Connection error"
  };
}
