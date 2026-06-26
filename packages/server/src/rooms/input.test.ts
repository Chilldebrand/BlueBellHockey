import { describe, expect, it } from 'vitest';
import { sanitizeClientInput, sanitizeInputSeq } from './input.js';

describe('client input sanitization', () => {
  it('defaults malformed input instead of trusting the network payload', () => {
    const input = sanitizeClientInput({
      move: { x: Number.POSITIVE_INFINITY, z: -3 },
      aim: null,
      actions: { shoot: true, pass: 'yes', hit: 1, steal: false },
    });

    expect(input.move).toEqual({ x: 0, z: -1 });
    expect(input.aim).toEqual({ x: 0, z: 0 });
    expect(input.actions).toEqual({
      shoot: true,
      pass: false,
      hit: false,
      steal: false,
      ult: false,
      deke: false,
      poke: false,
      sprint: false,
      switchPlayer: false,
    });
  });

  it('normalizes invalid sequence numbers', () => {
    expect(sanitizeInputSeq(12.8)).toBe(12);
    expect(sanitizeInputSeq(-1)).toBe(0);
    expect(sanitizeInputSeq(Number.NaN)).toBe(0);
  });

  it('sanitizes controller shot placement to the left-stick range', () => {
    const over = sanitizeClientInput({ move: null, aim: null, shotPlacement: 2, actions: {} });
    const under = sanitizeClientInput({ move: null, aim: null, shotPlacement: -2, actions: {} });
    const bad = sanitizeClientInput({ move: null, aim: null, shotPlacement: 'wide', actions: {} });

    expect(over.shotPlacement).toBe(1);
    expect(under.shotPlacement).toBe(-1);
    expect(bad.shotPlacement).toBeUndefined();
  });

  it('only accepts intentional low-shot input as a boolean', () => {
    expect(sanitizeClientInput({ move: null, aim: null, lowShot: true, actions: {} }).lowShot).toBe(true);
    expect(sanitizeClientInput({ move: null, aim: null, lowShot: 'true', actions: {} }).lowShot).toBe(false);
  });

  it('only accepts sprint and player switching as booleans', () => {
    const good = sanitizeClientInput({
      move: null,
      aim: null,
      actions: { sprint: true, switchPlayer: true },
    });
    const bad = sanitizeClientInput({
      move: null,
      aim: null,
      actions: { sprint: 1, switchPlayer: 'true' },
    });

    expect(good.actions.sprint).toBe(true);
    expect(good.actions.switchPlayer).toBe(true);
    expect(bad.actions.sprint).toBe(false);
    expect(bad.actions.switchPlayer).toBe(false);
  });
});
