import { useCallback, useEffect, useRef, useState } from "react";
import {
  SKATER_SLOTS,
  defaultCharacterIdForSlot,
  type CharacterId,
  type WorldState
} from "@bbh/arcade-core";
import type { AudioPreferences } from "../audio/preferences.js";
import {
  SHOOTOUT_SLOT_ID,
  createShootoutSim,
  type ShootoutSim
} from "../game/shootout.js";
import { gamepadStateFromGamepad } from "../input/gamepad.js";
import {
  createInputFrame,
  createNeutralInputState,
  mergeInputStates
} from "../input/inputState.js";
import {
  createKeyboardInputTracker,
  type KeyboardInputTracker
} from "../input/keyboard.js";
import {
  createMouseStickTracker,
  type MouseStickTracker
} from "../input/mouse.js";
import { Scene } from "../render/Scene.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";
import { CharacterSelect } from "./CharacterSelect.js";
import { SettingsOverlay } from "./SettingsOverlay.js";
import { ShootoutHud } from "./ShootoutHud.js";
import { ShootoutResults } from "./ShootoutResults.js";

const SHOOTER_SLOT = SKATER_SLOTS.find((slot) => slot.id === SHOOTOUT_SLOT_ID)!;

export interface ShootoutScreenProps {
  readonly onExit: () => void;
  readonly onOpenSettings?: () => void;
  readonly settingsOpen?: boolean;
  readonly audioPreferences?: AudioPreferences;
  readonly onAudioPreferencesChange?: (next: AudioPreferences) => void;
  readonly onCloseSettings?: () => void;
  readonly onWorldUpdate?: (
    world: WorldState,
    localEntityId: string | null
  ) => void;
}

/**
 * Solo shootout: pick a shooter, then five one-shot attempts on the standard
 * AI goalie from center ice. Client-only, mirroring the Free Skate localSim
 * pattern minus the dev tooling.
 */
export function ShootoutScreen({
  onExit,
  onOpenSettings,
  settingsOpen = false,
  audioPreferences,
  onAudioPreferencesChange,
  onCloseSettings,
  onWorldUpdate
}: ShootoutScreenProps): JSX.Element {
  const [stage, setStage] = useState<"select" | "playing">("select");
  const [characterId, setCharacterId] = useState<CharacterId>(() =>
    defaultCharacterIdForSlot(SHOOTER_SLOT)
  );
  const simRef = useRef<ShootoutSim | null>(null);
  const sequenceRef = useRef(0);
  const previousWorldRef = useRef<WorldState | null>(null);
  const keyboardRef = useRef<KeyboardInputTracker | null>(null);
  const mouseRef = useRef<MouseStickTracker | null>(null);
  const settingsOpenRef = useRef(settingsOpen);
  const [, setRenderTick] = useState(0);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
    if (settingsOpen) {
      keyboardRef.current?.clear();
    }
  }, [settingsOpen]);

  const handleStart = useCallback(() => {
    simRef.current = createShootoutSim({ characterId });
    previousWorldRef.current = null;
    setStage("playing");
  }, [characterId]);

  useEffect(() => {
    if (stage !== "playing") {
      return;
    }

    keyboardRef.current = createKeyboardInputTracker();
    mouseRef.current = createMouseStickTracker();
    let raf = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const elapsedMs = now - lastTime;
      lastTime = now;
      const sim = simRef.current;

      if (sim) {
        // Neutral input while an overlay (settings / results) is up so the
        // shooter can't be steered blind.
        const overlayUp =
          settingsOpenRef.current || sim.getState().phase === "complete";
        const liveFrame = createInputFrame({
          input: overlayUp
            ? createNeutralInputState()
            : mergeInputStates(
                mergeInputStates(
                  keyboardRef.current?.read() ?? createNeutralInputState(),
                  mouseRef.current?.read() ?? createNeutralInputState()
                ),
                gamepadStateFromGamepad(navigator.getGamepads?.()[0] ?? null)
              ),
          playerId: "shootout",
          slotId: SHOOTOUT_SLOT_ID,
          sequence: (sequenceRef.current += 1)
        });

        const result = sim.advance(elapsedMs, () => liveFrame);

        if (result.ticksAdvanced > 0) {
          if (result.previousWorld) {
            previousWorldRef.current = result.previousWorld;
          }

          onWorldUpdate?.(result.currentWorld, SHOOTOUT_SLOT_ID);
          setRenderTick(result.currentWorld.time.tick);
        } else if (sim.getState().phase === "complete") {
          // The sim freezes once complete; keep rendering the overlay fresh.
          setRenderTick((tick) => tick);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      keyboardRef.current?.dispose();
      keyboardRef.current = null;
      mouseRef.current?.dispose();
      mouseRef.current = null;
    };
  }, [stage, onWorldUpdate]);

  const handleRetry = useCallback(() => {
    simRef.current?.reset();
    previousWorldRef.current = null;
    setRenderTick((tick) => tick + 1);
  }, []);

  if (stage === "select") {
    return (
      <div className="shootout-screen shootout-screen--select">
        <div className="shootout-select-panel">
          <h1 className="shootout-select-title">SHOOTOUT</h1>
          <p className="shootout-select-blurb">
            Five shots, one goalie. Pick your shooter, then hit Done.
          </p>
          <CharacterSelect
            selectedCharacterId={characterId}
            headline="Pick your shooter"
            disabled={false}
            onChooseCharacter={setCharacterId}
            onClose={handleStart}
          />
          <div className="shootout-select-actions">
            <button type="button" onClick={onExit}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sim = simRef.current!;
  const world = sim.getWorld();
  const state = sim.getState();

  return (
    <div className="shootout-screen">
      <Scene
        currentWorld={world}
        previousWorld={previousWorldRef.current}
        localSlotId={SHOOTOUT_SLOT_ID}
        localGoalieId={null}
        predictedLocalSkater={null}
        highlightColorByEntityId={{ [SHOOTOUT_SLOT_ID]: "#1f8fff" }}
      />
      <AnnouncementBanner events={world.eventQueue} nowMs={world.time.nowMs} />
      <ShootoutHud
        results={state.results}
        attemptIndex={state.attemptIndex}
        phase={state.phase}
      />
      <div className="free-skate-toolbar shootout-toolbar">
        <strong>SHOOTOUT</strong>
        {onOpenSettings ? (
          <button type="button" onClick={onOpenSettings}>
            Settings
          </button>
        ) : null}
        <button type="button" onClick={onExit}>
          Exit
        </button>
      </div>
      {state.phase === "complete" ? (
        <ShootoutResults
          results={state.results}
          onRetry={handleRetry}
          onExit={onExit}
        />
      ) : null}
      {audioPreferences && onAudioPreferencesChange && onCloseSettings ? (
        <SettingsOverlay
          open={settingsOpen}
          preferences={audioPreferences}
          onChange={onAudioPreferencesChange}
          onClose={onCloseSettings}
          onExitToMenu={onExit}
        />
      ) : null}
      <div className="free-skate-help">
        WASD move · Shift turbo · right stick / mouse / IJKL = puck control
        (flick fwd = wrist, pull back + flick = slap) · Space tap/hold = simple
        shot · One shot per attempt — make it count
      </div>
    </div>
  );
}
