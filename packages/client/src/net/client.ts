import { Client, Room } from 'colyseus.js';
import { MSG, type InputState } from '@bbh/shared';
import { useUi, type PlayerStatLine } from '../store.js';

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
  combo: number;
  comboUntil: number;
  frozenUntil: number;
  staggeredUntil: number;
  intangibleUntil: number;
  dekeUntil: number;
  dekeDirX: number;
  dekeDirZ: number;
  shootChargeStart: number;
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
type GameEvent =
  | 'goal'
  | 'gamebreaker'
  | 'hit'
  | 'ult'
  | 'shot'
  | 'one_timer'
  | 'save'
  | 'deke'
  | 'poke'
  | 'ankle_break'
  | 'bank_play'
  | 'nolook_pass';

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
  private statsSig = '';

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
      room.onMessage('gamebreaker', (e: any) => this.events.emit('gamebreaker', e));
      room.onMessage('hit', (e: any) => this.events.emit('hit', e));
      room.onMessage('ult', (e: any) => this.events.emit('ult', e));
      room.onMessage('shot', (e: any) => this.events.emit('shot', e));
      room.onMessage('one_timer', (e: any) => this.events.emit('one_timer', e));
      room.onMessage('save', (e: any) => this.events.emit('save', e));
      room.onMessage('deke', (e: any) => this.events.emit('deke', e));
      room.onMessage('poke', (e: any) => this.events.emit('poke', e));
      room.onMessage('ankle_break', (e: any) => this.events.emit('ankle_break', e));
      room.onMessage('bank_play', (e: any) => this.events.emit('bank_play', e));
      room.onMessage('nolook_pass', (e: any) => this.events.emit('nolook_pass', e));

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
        combo: s.combo,
        comboUntil: s.comboUntil,
        frozenUntil: s.frozenUntil,
        staggeredUntil: s.staggeredUntil,
        intangibleUntil: s.intangibleUntil,
        dekeUntil: s.dekeUntil,
        dekeDirX: s.dekeDirX,
        dekeDirZ: s.dekeDirZ,
        shootChargeStart: s.shootChargeStart,
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
    // keep a few seconds of history — enough to feed the goal replay capture (WO-10)
    if (this.snapshots.length > 80) this.snapshots.shift();

    const ui = useUi.getState();
    const mine = ui.mySkaterId ? skaters[ui.mySkaterId] : undefined;

    // publish roster identities only when they change (low frequency)
    const ids = Object.values(skaters).sort((a, b) => a.id.localeCompare(b.id));
    const sig = ids.map((s) => `${s.id}:${s.team}:${s.characterId}`).join('|');
    if (sig !== this.rosterSig) {
      this.rosterSig = sig;
      ui.set({
        roster: ids.map((s) => ({
          id: s.id,
          team: s.team,
          characterId: s.characterId,
          isGoalie: s.isGoalie,
        })),
      });
    }

    // publish the box score only when a tally changes (WO-09) — keeps the postgame
    // screen off the 30Hz re-render path.
    const stats: Record<string, PlayerStatLine> = {};
    let statsSig = '';
    state.skaters.forEach((s: any, id: string) => {
      stats[id] = {
        goals: s.goals,
        assists: s.assists,
        hits: s.hits,
        takeaways: s.takeaways,
        saves: s.saves,
        shots: s.shots,
      };
      statsSig += `${id}:${s.goals},${s.assists},${s.hits},${s.takeaways},${s.saves},${s.shots}|`;
    });
    if (statsSig !== this.statsSig) {
      this.statsSig = statsSig;
      ui.set({ stats });
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
      myCombo: mine?.combo ?? 0,
      myComboUntil: mine?.comboUntil ?? 0,
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

  rematch(): void {
    this.room?.send(MSG.REMATCH, {});
  }

  backToLobby(): void {
    this.room?.send(MSG.BACK_TO_LOBBY, {});
  }
}

export const net = new NetClient();
