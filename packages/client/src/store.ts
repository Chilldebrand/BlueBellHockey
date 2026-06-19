import { create } from 'zustand';

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type QualityLevel = 'low' | 'medium' | 'high';

const QUALITY_KEY = 'bbh.quality';
function initialQuality(): QualityLevel {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === 'low' || q === 'medium' || q === 'high') return q;
  } catch {
    /* ignore */
  }
  return 'high';
}
/** Persist + apply a graphics-quality choice (WO-13). */
export function setQuality(q: QualityLevel): void {
  try {
    localStorage.setItem(QUALITY_KEY, q);
  } catch {
    /* ignore */
  }
  useUi.getState().set({ quality: q });
}

export interface RosterIdentity {
  id: string;
  team: number;
  characterId: string;
  isGoalie: boolean;
}

export interface PlayerStatLine {
  goals: number;
  assists: number;
  hits: number;
  takeaways: number;
  saves: number;
  shots: number;
}

export interface IcePickup {
  id: string;
  kind: string; // 'boost' | 'charge'
  px: number;
  pz: number;
}

export interface UiState {
  roster: RosterIdentity[];
  stats: Record<string, PlayerStatLine>; // WO-09 — box score, published on change
  pickups: IcePickup[]; // WO-16 — ice tokens, published on change
  status: ConnStatus;
  error: string | null;
  mySkaterId: string | null;
  myTeam: 0 | 1 | null;
  roomCode: string; // WO-14 — active private room code ('' = public Quick Play)
  gameMode: string; // WO-15 — active game-mode id
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
  musicOn: boolean; // WO-11 — procedural music bed on/off (SFX/crowd stay on)
  // controls remapping panel
  controlsOpen: boolean;
  // goal replay (WO-10): true while the slow-mo instant replay is playing
  replayActive: boolean;
  // graphics quality (WO-13): scales shadows / post-fx / reflections / dpr
  quality: QualityLevel;
  set: (patch: Partial<UiState>) => void;
}

export const useUi = create<UiState>((set) => ({
  roster: [],
  stats: {},
  pickups: [],
  status: 'idle',
  error: null,
  mySkaterId: null,
  myTeam: null,
  roomCode: '',
  gameMode: 'regulation',
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
  musicOn: true,
  controlsOpen: false,
  replayActive: false,
  quality: initialQuality(),
  serverTime: 0,
  set: (patch) => set(patch),
}));
