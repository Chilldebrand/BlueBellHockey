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
    });
  });

  it('normalizes invalid sequence numbers', () => {
    expect(sanitizeInputSeq(12.8)).toBe(12);
    expect(sanitizeInputSeq(-1)).toBe(0);
    expect(sanitizeInputSeq(Number.NaN)).toBe(0);
  });
});
