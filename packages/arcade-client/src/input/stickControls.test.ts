import { describe, expect, it } from "vitest";
import { createKeyboardInputTracker } from "./keyboard.js";
import { createInputFrame, type ArcadeInputState } from "./inputState.js";
import { transformStickForTeam } from "./stickControls.js";

type AccessibilityGestureInput = ArcadeInputState & {
  readonly isAccessibilityShotGesture?: boolean;
};

const transformAccessibilityGestureForTeam = transformStickForTeam as unknown as (
  stickY: number,
  teamId: "home" | "away",
  alwaysUp: boolean,
  preserveAccessibilityShotGesture: boolean
) => number;

function createSpaceGestureSamples(): {
  readonly tap: AccessibilityGestureInput;
  readonly chargedWindup: AccessibilityGestureInput;
  readonly chargedReleaseFlicks: readonly AccessibilityGestureInput[];
} {
  const listeners = new Map<string, (event: { code: string }) => void>();
  let now = 0;
  const tracker = createKeyboardInputTracker(
    {
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject
      ) => {
        listeners.set(type, listener as unknown as (event: { code: string }) => void);
      },
      removeEventListener: () => undefined
    },
    () => now
  );

  listeners.get("keydown")?.({ code: "Space" });
  now = 20;
  listeners.get("keyup")?.({ code: "Space" });
  const tap = tracker.read();

  tracker.clear();
  now = 100;
  listeners.get("keydown")?.({ code: "Space" });
  now = 300;
  const chargedWindup = tracker.read();
  listeners.get("keyup")?.({ code: "Space" });
  const chargedReleaseFlicks = [tracker.read(), tracker.read(), tracker.read()];

  return { tap, chargedWindup, chargedReleaseFlicks };
}

function frameForSpaceGesture(
  input: AccessibilityGestureInput,
  teamId: "home" | "away",
  alwaysUp: boolean
) {
  return createInputFrame({
    input: {
      ...input,
      stickY: transformAccessibilityGestureForTeam(
        input.stickY,
        teamId,
        alwaysUp,
        input.isAccessibilityShotGesture === true
      )
    },
    playerId: "session-a",
    slotId: "home-skater-1",
    sequence: 1
  });
}

describe("transformStickForTeam", () => {
  it("preserves vertical stick input for the home team", () => {
    expect(transformStickForTeam(0.75, "home", false)).toBe(0.75);
  });

  it("inverts vertical stick input for the away team by default", () => {
    expect(transformStickForTeam(0.75, "away", false)).toBe(-0.75);
  });

  it("preserves vertical stick input for the away team with Always Up enabled", () => {
    expect(transformStickForTeam(0.75, "away", true)).toBe(0.75);
  });

  it("keeps a Space tap shot forward for home, away default, and away Always Up", () => {
    const { tap } = createSpaceGestureSamples();

    const frames = [
      frameForSpaceGesture(tap, "home", false),
      frameForSpaceGesture(tap, "away", false),
      frameForSpaceGesture(tap, "away", true)
    ];

    expect(frames.map((frame) => frame.stickY)).toEqual([1, 1, 1]);
  });

  it("keeps a charged Space windup and release identical for home, away default, and away Always Up", () => {
    const { chargedWindup, chargedReleaseFlicks } = createSpaceGestureSamples();

    const framesForTeam = (teamId: "home" | "away", alwaysUp: boolean) => [
      frameForSpaceGesture(chargedWindup, teamId, alwaysUp),
      ...chargedReleaseFlicks.map((input) =>
        frameForSpaceGesture(input, teamId, alwaysUp)
      )
    ];

    const frames = [
      framesForTeam("home", false),
      framesForTeam("away", false),
      framesForTeam("away", true)
    ];

    expect(frames.map((teamFrames) => teamFrames.map((frame) => frame.stickY))).toEqual(
      [
        [-1, 1, 1, 1],
        [-1, 1, 1, 1],
        [-1, 1, 1, 1]
      ]
    );
  });
});
