import {
  createNeutralInputState,
  type ArcadeInputState
} from "./inputState.js";

export interface MouseStickTracker {
  readonly read: () => ArcadeInputState;
  readonly dispose: () => void;
}

// Mouse-as-skill-stick: movement deltas become the stick vector (screen up =
// stick forward), decaying back to neutral between motions — so a quick
// upward flick of the mouse is a wrist shot and drag-down-then-flick-up is a
// slap, through exactly the same protocol as a gamepad.
const DELTA_SCALE = 1 / 30;
const DECAY_PER_SECOND = 10;

export function createMouseStickTracker(
  target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
  now: () => number = () => performance.now()
): MouseStickTracker {
  let stickX = 0;
  let stickY = 0;
  let lastReadMs = now();

  const onMouseMove = (event: MouseEvent) => {
    stickX = clampAxis(stickX + event.movementX * DELTA_SCALE);
    stickY = clampAxis(stickY - event.movementY * DELTA_SCALE);
  };

  target.addEventListener("mousemove", onMouseMove as EventListener);

  return {
    read: () => {
      const nowMs = now();
      const dt = Math.max(0, (nowMs - lastReadMs) / 1000);
      lastReadMs = nowMs;
      const decay = Math.exp(-DECAY_PER_SECOND * dt);
      stickX *= decay;
      stickY *= decay;

      return {
        ...createNeutralInputState(),
        stickX: Math.abs(stickX) < 0.02 ? 0 : stickX,
        stickY: Math.abs(stickY) < 0.02 ? 0 : stickY
      };
    },
    dispose: () => {
      target.removeEventListener("mousemove", onMouseMove as EventListener);
    }
  };
}

function clampAxis(value: number): number {
  return Math.min(1, Math.max(-1, value));
}
