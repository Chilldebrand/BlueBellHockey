import { useCallback, useEffect, useRef, useState } from "react";
import type { InputFrame, WorldState } from "@bbh/arcade-core";
import { PerfHud } from "../dev/PerfHud.js";
import { TuningPanel } from "../dev/TuningPanel.js";
import {
  createInputRecorder,
  parseRecording,
  serializeRecording,
  type InputRecording
} from "../dev/recorder.js";
import { createLocalSim, FREE_SKATE_SLOT_ID } from "../game/localSim.js";
import { gamepadStateFromGamepad } from "../input/gamepad.js";
import {
  createInputFrame,
  createNeutralInputState,
  mergeInputStates
} from "../input/inputState.js";
import { createKeyboardInputTracker } from "../input/keyboard.js";
import { createMouseStickTracker } from "../input/mouse.js";
import { Scene } from "../render/Scene.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";

const FREE_SKATE_SEED = 20260703;

interface ReplayState {
  readonly frames: readonly (InputFrame | null)[];
  readonly startTick: number;
}

export interface FreeSkateProps {
  readonly onExit: () => void;
}

/**
 * The feel lab: the shared sim runs entirely client-side in an endless
 * session while the tuning panel mutates physics constants live. Also hosts
 * the input recorder used to produce deterministic replay fixtures.
 */
export function FreeSkate({ onExit }: FreeSkateProps): JSX.Element {
  const simRef = useRef(
    createLocalSim({
      seed: FREE_SKATE_SEED,
      slotId: FREE_SKATE_SLOT_ID,
      practice: true // just you and a goalie to shoot on
    })
  );
  const recorderRef = useRef(createInputRecorder());
  const replayRef = useRef<ReplayState | null>(null);
  const sequenceRef = useRef(0);
  const previousWorldRef = useRef<WorldState | null>(null);
  const lastRecordingRef = useRef<InputRecording | null>(null);
  const [, setRenderTick] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);

  useEffect(() => {
    // Dev console handle for poking the running feel-lab world.
    (window as unknown as Record<string, unknown>).__bbhFreeSkateSim =
      simRef.current;
    const keyboard = createKeyboardInputTracker();
    const mouse = createMouseStickTracker();
    let raf = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const elapsedMs = now - lastTime;
      lastTime = now;

      const liveFrame = createInputFrame({
        input: mergeInputStates(
          mergeInputStates(
            keyboard.read() ?? createNeutralInputState(),
            mouse.read()
          ),
          gamepadStateFromGamepad(navigator.getGamepads?.()[0] ?? null)
        ),
        playerId: "free-skate",
        // Drive whichever entity the human currently controls: their skater
        // (moves on a pass), or their goalie while it covers the puck.
        slotId: simRef.current.getControlledEntityId(),
        sequence: (sequenceRef.current += 1)
      });

      const result = simRef.current.advance(elapsedMs, (tick) => {
        const replay = replayRef.current;

        if (replay) {
          const index = tick - replay.startTick;

          if (index >= replay.frames.length) {
            replayRef.current = null;
            setIsReplaying(false);
            return liveFrame;
          }

          return replay.frames[index];
        }

        recorderRef.current.capture(liveFrame);
        return liveFrame;
      });

      if (result.ticksAdvanced > 0) {
        if (result.previousWorld) {
          previousWorldRef.current = result.previousWorld;
        }

        setRenderTick(result.currentWorld.time.tick);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      keyboard.dispose();
      mouse.dispose();
      delete (window as unknown as Record<string, unknown>).__bbhFreeSkateSim;
    };
  }, []);

  const handleToggleRecord = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder.isRecording()) {
      lastRecordingRef.current = recorder.stop(
        FREE_SKATE_SEED,
        FREE_SKATE_SLOT_ID
      );
      setIsRecording(false);
      setHasRecording(true);
    } else {
      // A recording only replays deterministically from the same start state,
      // so recording always begins from a fresh world.
      simRef.current.reset();
      previousWorldRef.current = null;
      recorder.start();
      setIsRecording(true);
      setIsReplaying(false);
      replayRef.current = null;
    }
  }, []);

  const handleReplay = useCallback(() => {
    const recording = lastRecordingRef.current;

    if (!recording || recorderRef.current.isRecording()) {
      return;
    }

    simRef.current.reset();
    previousWorldRef.current = null;
    replayRef.current = {
      frames: recording.frames,
      startTick: simRef.current.getTick()
    };
    setIsReplaying(true);
  }, []);

  const handleReset = useCallback(() => {
    simRef.current.reset();
    previousWorldRef.current = null;
    replayRef.current = null;
    setIsReplaying(false);
  }, []);

  const handleDownload = useCallback(() => {
    const recording = lastRecordingRef.current;

    if (!recording) {
      return;
    }

    const blob = new Blob([serializeRecording(recording)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `free-skate-recording-${recording.frames.length}f.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleLoadRecording = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      void file.text().then((json) => {
        try {
          lastRecordingRef.current = parseRecording(json);
          setHasRecording(true);
        } catch {
          // ignore malformed files; dev-only tool
        }
      });
      event.target.value = "";
    },
    []
  );

  const world = simRef.current.getWorld();
  const localSlotId = simRef.current.getControlledSlotId();
  // The blue identity disc follows the ACTIVE entity — the goalie during a
  // covered-save outlet, the controlled skater otherwise.
  const localEntityId = simRef.current.getControlledEntityId();

  return (
    <div className="free-skate-screen">
      <PerfHud />
      <Scene
        currentWorld={world}
        previousWorld={previousWorldRef.current}
        localSlotId={localSlotId}
        localGoalieId={localEntityId === localSlotId ? null : localEntityId}
        predictedLocalSkater={null}
        highlightColorByEntityId={{ [localEntityId]: "#1f8fff" }}
        debugOverlays
      />
      <AnnouncementBanner
        events={world.eventQueue}
        nowMs={world.time.nowMs}
      />
      <TuningPanel />
      <div className="free-skate-toolbar">
        <strong>FREE SKATE</strong>
        <button type="button" onClick={handleToggleRecord}>
          {isRecording ? "Stop Rec" : "Record"}
        </button>
        <button
          type="button"
          onClick={handleReplay}
          disabled={!hasRecording || isRecording}
        >
          {isReplaying ? "Replaying…" : "Replay"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!hasRecording}
        >
          Download
        </button>
        <label className="free-skate-load">
          Load
          <input type="file" accept=".json" onChange={handleLoadRecording} />
        </label>
        <button type="button" onClick={handleReset}>
          Reset World
        </button>
        <button type="button" onClick={onExit}>
          Exit
        </button>
      </div>
      <div className="free-skate-help">
        WASD move · Shift turbo · right stick / mouse / IJKL = puck control
        (flick fwd = wrist, pull back + flick = slap) · Space tap/hold = simple
        shot · F / A / RT = pass (with the puck) or switch to the nearest
        teammate (without it) · G check · R poke · V dive — Pad: B/X check ·
        RB poke · LB dive · L3 hustle
      </div>
    </div>
  );
}
