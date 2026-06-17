import { Client, Room } from 'colyseus.js';
import { MSG, type InputState } from '@bbh/shared';
import { useUi } from '../store.js';

export interface SkaterSnap {
  id: string;
  team: number;
  characterId: string;
  isBot: boolean;
  isGoalie: boolean;
  px: number;
  pz: number;
  vx: number;
  vz: number;
  facing: number;
  ultCharge: number;
  ultActiveUntil: number;
  frozenUntil: number;
  staggeredUntil: number;
  intangibleUntil: number;
  ackSeq: number;
}

export interface Snapshot {
  t: number; // client receive time (performance.now)
  serverTime: number;
  skaters: Record<string, SkaterSnap>;
  puck: { px: number; pz: number; vx: number; vz: number; carrier: string };
}

// Low-frequency UI state lives in zustand; the high-frequency snapshot buffer is a
// plain singleton read directly by the render loop (avoids re-rendering React at 30Hz).
type GameEvent = 'goal' | 'hit' | 'ult';

class EventBus {
  private handlers: Record<string, Array<(e: any) => void>> = {};
  on(type: GameEvent, fn: (e: any) => void): () => void {
    (this.handlers[type] ??= []).push(fn);
    return () => {
      this.handlers[type] = (this.handlers[type] ?? []).filter((h) => h !== fn);
    };
  }
  emit(type: GameEvent, e: any): void {
    for (const h of this.handlers[type] ?? []) h(e);
  }
}

class NetClient {
  room: Room | null = null;
  snapshots: Snapshot[] = [];
  readonly events = new EventBus();
  private seq = 0;
  private rosterSig = '';

  async connect(serverUrl?: string): Promise<void> {
    const ui = useUi.getState();
    ui.set({ status: 'connecting', error: null });
    try {
      const url = serverUrl ?? `ws://${location.hostname}:2567`;
      const client = new Client(url);
      const room = await client.joinOrCreate('match');
      this.room = room;

      room.onMessage('assigned', (m: { skaterId: string; team: 0 | 1 }) => {
        useUi.getState().set({ mySkaterId: m.skaterId, myTeam: m.team });
      });

      // one-shot gameplay events (hooks for VFX/SFX; registered to avoid warnings)
      room.onMessage('goal', (e: any) => this.events.emit('goal', e));
      room.onMessage('hit', (e: any) => this.events.emit('hit', e));
      room.onMessage('ult', (e: any) => this.events.emit('ult', e));

      room.onStateChange((state: any) => this.onState(state));
      room.onLeave(() => useUi.getState().set({ status: 'idle' }));
      ui.set({ status: 'connected' });
    } catch (e) {
      ui.set({ status: 'error', error: (e as Error).message });
    }
  }

  private onState(state: any): void {
    const skaters: Record<string, SkaterSnap> = {};
    state.skaters.forEach((s: any, id: string) => {
      skaters[id] = {
        id,
        team: s.team,
        characterId: s.characterId,
        isBot: s.isBot,
        isGoalie: s.isGoalie,
        px: s.px,
        pz: s.pz,
        vx: s.vx,
        vz: s.vz,
        facing: s.facing,
        ultCharge: s.ultCharge,
        ultActiveUntil: s.ultActiveUntil,
        frozenUntil: s.frozenUntil,
        staggeredUntil: s.staggeredUntil,
        intangibleUntil: s.intangibleUntil,
        ackSeq: s.ackSeq,
      };
    });

    this.snapshots.push({
      t: performance.now(),
      serverTime: state.time,
      skaters,
      puck: {
        px: state.puck.px,
        pz: state.puck.pz,
        vx: state.puck.vx,
        vz: state.puck.vz,
        carrier: state.puck.carrier,
      },
    });
    // keep ~1s of history
    if (this.snapshots.length > 40) this.snapshots.shift();

    const ui = useUi.getState();
    const mine = ui.mySkaterId ? skaters[ui.mySkaterId] : undefined;

    // publish roster identities only when they change (low frequency)
    const ids = Object.values(skaters).sort((a, b) => a.id.localeCompare(b.id));
    const sig = ids.map((s) => `${s.id}:${s.team}:${s.characterId}`).join('|');
    if (sig !== this.rosterSig) {
      this.rosterSig = sig;
      ui.set({ roster: ids.map((s) => ({ id: s.id, team: s.team, characterId: s.characterId })) });
    }

    ui.set({
      phase: state.phase,
      period: state.period,
      clock: state.clock,
      phaseTimer: state.phaseTimer,
      score0: state.score0,
      score1: state.score1,
      serverTime: state.time,
      myUltCharge: mine?.ultCharge ?? 0,
      myUltActiveUntil: mine?.ultActiveUntil ?? 0,
    });
  }

  sendInput(input: InputState): number {
    const seq = ++this.seq;
    this.room?.send(MSG.INPUT, { seq, input });
    return seq;
  }

  selectCharacter(characterId: string): void {
    this.room?.send(MSG.SELECT_CHARACTER, { characterId });
  }

  ready(): void {
    this.room?.send(MSG.READY, { ready: true });
  }
}

export const net = new NetClient();
