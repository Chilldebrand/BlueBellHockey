import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from './inputState.js';

const buttons = (): GamepadButton[] =>
  Array.from({ length: 12 }, () => ({
    pressed: false,
    touched: false,
    value: 0,
  }));

function stubGamepad(axes: number[]): void {
  vi.stubGlobal('navigator', {
    getGamepads: () => [
      {
        axes,
        buttons: buttons(),
      },
    ],
  });
}

describe('InputManager right-stick shooting', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pulls back to hold a slap windup and neutral cancels it without firing', () => {
    const input = new InputManager();

    stubGamepad([0, 0, 0, 1]);
    expect(input.gather({ hasPuck: true }).actions.shoot).toBe(true);

    stubGamepad([0, 0, 0, 0]);
    const neutral = input.gather({ hasPuck: true });
    expect(neutral.actions.shoot).toBe(false);
    expect((neutral as any).cancelShoot).toBe(true);
  });

  it('flicks up for a wrist-shot tap or to release a held slap windup', () => {
    const wrist = new InputManager();

    stubGamepad([0, 0, 0, -1]);
    expect(wrist.gather({ hasPuck: true }).actions.shoot).toBe(true);
    stubGamepad([0, 0, 0, 0]);
    expect(wrist.gather({ hasPuck: true }).actions.shoot).toBe(false);

    const slap = new InputManager();
    stubGamepad([0, 0, 0, 1]);
    expect(slap.gather({ hasPuck: true }).actions.shoot).toBe(true);
    stubGamepad([0, 0, 0, -1]);
    const release = slap.gather({ hasPuck: true });
    expect(release.actions.shoot).toBe(false);
    expect((release as any).cancelShoot).not.toBe(true);
  });
});
