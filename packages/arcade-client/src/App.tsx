import { useCallback, useReducer, useRef } from "react";
import type { TeamId } from "@bbh/arcade-core";
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

  const attachRoom = useCallback((result: ArcadeConnectionResult) => {
    attachArcadeRoom(activeRoomRef, result, {
      onState: ({ room }) => dispatch({ type: "room.state", room }),
      onError: (message) => dispatch({ type: "connection.error", message }),
      onLeave: (message) => dispatch({ type: "connection.left", message })
    });
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

  const handleRequestStart = useCallback(() => {
    activeRoomRef.current?.session.requestStart();
  }, []);

  return (
    <Lobby
      state={state}
      onQuickMatch={handleQuickMatch}
      onCreatePrivateRoom={handleCreatePrivateRoom}
      onJoinPrivateRoom={handleJoinPrivateRoom}
      onChooseTeam={handleChooseTeam}
      onRequestStart={handleRequestStart}
    />
  );
}

function connectionErrorAction(error: unknown): ArcadeClientAction {
  return {
    type: "connection.error",
    message: error instanceof Error ? error.message : "Connection error"
  };
}
