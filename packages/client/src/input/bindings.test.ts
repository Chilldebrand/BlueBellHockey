import { describe, expect, it } from 'vitest';

import { DEFAULT_BINDINGS, padBindingLabel, padLabel, type PadBinding } from './bindings.js';

describe('default gamepad bindings', () => {
  it('matches the requested arcade controller layout', () => {
    const labels = (binding: PadBinding) =>
      (
        Array.isArray(binding)
          ? binding
          : binding === null || typeof binding === 'object'
            ? []
            : [binding]
      ).map(padLabel);

    expect(labels(DEFAULT_BINDINGS.gamepad.pass)).toEqual(['A']);
    expect(labels(DEFAULT_BINDINGS.gamepad.shoot)).toEqual(['X']);
    expect(labels(DEFAULT_BINDINGS.gamepad.steal)).toEqual(['B']);
    expect(labels(DEFAULT_BINDINGS.gamepad.sprint)).toEqual(['L3']);
    expect(labels(DEFAULT_BINDINGS.gamepad.hit)).toEqual([]);
    expect(labels(DEFAULT_BINDINGS.gamepad.poke)).toEqual(['RB']);
    expect(labels(DEFAULT_BINDINGS.gamepad.deke)).toEqual(['LT']);
    expect(labels(DEFAULT_BINDINGS.gamepad.switchPlayer)).toEqual(['RT']);
    expect(padBindingLabel(DEFAULT_BINDINGS.gamepad.ult)).toBe('LB + RB');
    expect(Object.values(DEFAULT_BINDINGS.gamepad).flat()).not.toContain(3);
  });
});
