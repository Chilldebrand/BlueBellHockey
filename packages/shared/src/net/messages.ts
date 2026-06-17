import type { InputState } from '../sim/types.js';

// Colyseus message type constants (client -> server).
export const MSG = {
  INPUT: 'input',
  SELECT_CHARACTER: 'select',
  READY: 'ready',
} as const;

export interface InputMessage {
  seq: number; // client input sequence number, for reconciliation
  input: InputState;
}

export interface SelectCharacterMessage {
  characterId: string;
}

export interface ReadyMessage {
  ready: boolean;
}

export const TICK_HZ = 30;
export const TICK_MS = 1000 / TICK_HZ;
