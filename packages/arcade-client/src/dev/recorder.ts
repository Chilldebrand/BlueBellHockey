import type { InputFrame } from "@bbh/arcade-core";

/**
 * A deterministic input script: replaying `frames` tick-by-tick against a
 * world created from `seed` reproduces the original run exactly. Doubles as a
 * regression fixture source for sim determinism tests.
 */
export interface InputRecording {
  readonly seed: number;
  readonly slotId: string;
  readonly frames: readonly (InputFrame | null)[];
}

export interface InputRecorder {
  readonly isRecording: () => boolean;
  readonly frameCount: () => number;
  start(): void;
  /** Capture the input used for one sim tick (call once per tick). */
  capture(frame: InputFrame | null): void;
  stop(seed: number, slotId: string): InputRecording;
}

export function createInputRecorder(): InputRecorder {
  let recording = false;
  let frames: (InputFrame | null)[] = [];

  return {
    isRecording: () => recording,
    frameCount: () => frames.length,
    start() {
      recording = true;
      frames = [];
    },
    capture(frame) {
      if (recording) {
        frames.push(frame);
      }
    },
    stop(seed, slotId) {
      recording = false;
      return { seed, slotId, frames };
    }
  };
}

export function serializeRecording(recording: InputRecording): string {
  return JSON.stringify(recording, null, 2);
}

export function parseRecording(json: string): InputRecording {
  const parsed = JSON.parse(json) as Partial<InputRecording>;

  if (
    typeof parsed.seed !== "number" ||
    typeof parsed.slotId !== "string" ||
    !Array.isArray(parsed.frames)
  ) {
    throw new Error("Not a valid input recording");
  }

  return parsed as InputRecording;
}
