import { afterEach, describe, expect, it, vi } from 'vitest';

import { readGamepad } from './gamepad.js';
import type { PadBindings } from './bindings.js';

const buttons = (pressed: number[]): GamepadButton[] =>
  Array.from({ length: 12 }, (_, i) => ({
    pressed: pressed.includes(i),
    touched: pressed.includes(i),
    value: pressed.includes(i) ? 1 : 0,
  }));

function stubGamepad(pressed: number[], axes = [0, 0, 0, 0]): void {
  vi.stubGlobal('navigator', {
    getGamepads: () => [
      {
        axes,
        buttons: buttons(pressed),
      },
    ],
  });
}

describe('readGamepad', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires every button in a chord binding to be pressed', () => {
    const bind: PadBindings = {
      shoot: 2,
      pass: 0,
      hit: null,
      steal: 1,
      poke: 5,
      deke: 6,
      sprint: 10,
      switchPlayer: 7,
      ult: { all: [4, 5] },
    };

    stubGamepad([4]);
    expect(readGamepad(bind).ult).toBe(false);

    stubGamepad([4, 5]);
    expect(readGamepad(bind).ult).toBe(true);
  });

  it('lets an active ultimate chord override its single-button actions', () => {
    const bind: PadBindings = {
      shoot: 2,
      pass: 0,
      hit: null,
      steal: 1,
      poke: 5,
      deke: 6,
      sprint: 10,
      switchPlayer: 7,
      ult: { all: [4, 5] },
    };

    stubGamepad([4, 5]);
    const reading = readGamepad(bind);

    expect(reading.ult).toBe(true);
    expect(reading.poke).toBe(false);
  });

  it('reports L3 as sprint and RT as switch player', () => {
    const bind: PadBindings = {
      shoot: 2,
      pass: 0,
      hit: null,
      steal: 1,
      poke: 5,
      deke: 6,
      sprint: 10,
      switchPlayer: 7,
      ult: { all: [4, 5] },
    };

    stubGamepad([7, 10]);
    const reading = readGamepad(bind);

    expect(reading.sprint).toBe(true);
    expect(reading.switchPlayer).toBe(true);
  });

  it('treats right-stick up as an off-puck hit gesture', () => {
    const bind: PadBindings = {
      shoot: 2,
      pass: 0,
      hit: null,
      steal: 1,
      poke: 5,
      deke: 6,
      sprint: 10,
      switchPlayer: 7,
      ult: { all: [4, 5] },
    };

    stubGamepad([], [0, 0, 0, -1]);

    expect(readGamepad(bind).hitGesture).toBe(true);
  });
});
