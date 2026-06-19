import { create } from 'zustand';

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface RosterIdentity {
  id: string;
  team: number;
  characterId: string;
}

export interface UiState {
  roster: RosterIdentity[];
  status: ConnStatus;
  error: string | null;
  mySkaterId: string | null;
  myTeam: 0 | 1 | null;
  selectedCharacter: string;
  // live match meta (updated each server patch)
  phase: string;
  period: number;
  clock: number;
  phaseTimer: number;
  score0: number;
  score1: number;
  myUltCharge: number;
  myUltActiveUntil: number;
  myCombo: number;
  myComboUntil: number;
  serverTime: number;
  // audio controls (WO-05)
  muted: boolean;
  volume: number; // 0..1
  // controls remapping panel
  controlsOpen: boolean;
  set: (patch: Partial<UiState>) => void;
}

export const useUi = create<UiState>((set) => ({
  roster: [],
  status: 'idle',
  error: null,
  mySkaterId: null,
  myTeam: null,
  selectedCharacter: 'blaze',
  phase: 'lobby',
  period: 1,
  clock: 0,
  phaseTimer: 0,
  score0: 0,
  score1: 0,
  myUltCharge: 0,
  myUltActiveUntil: 0,
  myCombo: 0,
  myComboUntil: 0,
  muted: false,
  volume: 0.5,
  controlsOpen: false,
  serverTime: 0,
  set: (patch) => set(patch),
}));
