import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  MATCH_CONFIG,
  type CharacterId,
  type InputFrame,
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
import { predictControlledSkater } from "./game/prediction.js";
import {
  connectQuickMatch,
  createPrivateRoom,
  joinPrivateRoom,
  normalizePrivateRoomCode,
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
  createInitialArcadeClientState,
  reduceArcadeClientState,
  type ArcadeClientAction
} from "./store.js";
import { Scene } from "./render/Scene.js";
import { ModelPreview } from "./render/ModelPreview.js";
import { HUD } from "./ui/HUD.js";
import { Lobby } from "./ui/Lobby.js";

export interface AppConnectionApi {
  readonly connectQuickMatch: typeof connectQuickMatch;
  readonly createPrivateRoom: typeof createPrivateRoom;
  readonly joinPrivateRoom: typeof joinPrivateRoom;
}

const defaultConnectionApi: AppConnectionApi = {
  connectQuickMatch,
  createPrivateRoom,
  joinPrivateRoom
};

export function App({
  connectionApi = defaultConnectionApi
}: {
  readonly connectionApi?: AppConnectionApi;
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
  const latestInputRef = useRef<InputFrame | null>(null);

  const attachRoom = useCallback((result: ArcadeConnectionResult) => {
    attachArcadeRoom(activeRoomRef, result, {
      onState: ({ room }) => dispatch({ type: "room.state", room }),
      onError: (message) => dispatch({ type: "connection.error", message }),
      onLeave: (message) => dispatch({ type: "connection.left", message }),
      onWorldSnapshot: (world) => dispatch({ type: "world.snapshot", world })
    });
  }, []);

  useEffect(() => {
    keyboardRef.current = createKeyboardInputTracker();

    return () => {
      keyboardRef.current?.dispose();
      keyboardRef.current = null;
    };
  }, []);

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

  const handleQuickMatch = useCallback(() => {
    void runConnection(() => connectionApi.connectQuickMatch());
  }, [connectionApi, runConnection]);

  const handleCreatePrivateRoom = useCallback(() => {
    void runConnection(() => connectionApi.createPrivateRoom());
  }, [connectionApi, runConnection]);

  const handleJoinPrivateRoom = useCallback(
    (code: string) => {
      void runConnection(() =>
        connectionApi.joinPrivateRoom(normalizePrivateRoomCode(code))
      );
    },
    [connectionApi, runConnection]
  );

  const handleChooseTeam = useCallback((teamId: TeamId) => {
    activeRoomRef.current?.session.chooseTeam(teamId);
  }, []);

  const handleChooseCharacter = useCallback((characterId: CharacterId) => {
    activeRoomRef.current?.session.chooseCharacter(characterId);
  }, []);

  const handleRequestStart = useCallback(() => {
    activeRoomRef.current?.session.requestStart();
  }, []);

  const localSlotId =
    state.roster.find((slot) => slot.isOwnedByLocalPlayer)?.slotId ?? null;

  useEffect(() => {
    if (!localSlotId || !state.playerSessionId) {
      latestInputRef.current = null;
      return;
    }

    const playerSessionId = state.playerSessionId;
    const sendInput = () => {
      const keyboardInput =
        keyboardRef.current?.read() ?? createNeutralInputState();
      const gamepadInput = gamepadStateFromGamepad(
        navigator.getGamepads?.()[0] ?? null
      );
      const frame = createInputFrame({
        input: mergeInputStates(keyboardInput, gamepadInput),
        playerId: playerSessionId,
        slotId: localSlotId,
        sequence: (inputSequenceRef.current += 1)
      });

      latestInputRef.current = frame;
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
  }, [localSlotId, state.playerSessionId]);

  const predictedLocalSkater = predictControlledSkater(
    state.currentWorld,
    localSlotId,
    latestInputRef.current
  );
  const isModelPreviewRoute =
    typeof window !== "undefined" && window.location.pathname === "/model-preview";

  if (isModelPreviewRoute) {
    return <ModelPreview />;
  }

  return (
    <>
      <HUD state={state} />
      <Scene
        currentWorld={state.currentWorld}
        previousWorld={state.previousWorld}
        localSlotId={localSlotId}
        predictedLocalSkater={predictedLocalSkater}
      />
      {state.phase === "playing" ? null : (
        <Lobby
          state={state}
          onQuickMatch={handleQuickMatch}
          onCreatePrivateRoom={handleCreatePrivateRoom}
          onJoinPrivateRoom={handleJoinPrivateRoom}
          onChooseTeam={handleChooseTeam}
          onChooseCharacter={handleChooseCharacter}
          onRequestStart={handleRequestStart}
        />
      )}
    </>
  );
}

function connectionErrorAction(error: unknown): ArcadeClientAction {
  return {
    type: "connection.error",
    message: error instanceof Error ? error.message : "Connection error"
  };
}
