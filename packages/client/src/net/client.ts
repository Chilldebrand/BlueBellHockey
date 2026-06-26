import { Client, Room } from 'colyseus.js';
import { MSG, normalizeUniformPair, type InputState, type UniformSchemeId } from '@bbh/shared';
import { useUi, type IcePickup, type PlayerStatLine } from '../store.js';

export interface SkaterSnap {
  id: string;
  team: number;
  characterId: string;
  isBot: boolean;
  isGoalie: boolean;
  controllerIndex: number;
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
  downedUntil: number;
  intangibleUntil: number;
  dekeUntil: number;
  dekeDirX: number;
  dekeDirZ: number;
  shootChargeStart: number;
  shootGlideDirX: number;
  shootGlideDirZ: number;
  goalieSaveUntil: number;
  goalieSaveType: 'none' | 'pad' | 'body' | 'glove' | 'blocker' | 'cover';
  goalieSaveSide: -1 | 0 | 1;
  ackSeq: number;
}

export interface Snapshot {
  t: number; // client receive time (performance.now)
  serverTime: number;
  skaters: Record<string, SkaterSnap>;
  puck: { px: number; pz: number; py: number; vx: number; vz: number; vy: number; carrier: string };
}

export interface ConnectOpts {
  mode?: 'quick' | 'create' | 'join'; // connection intent
  gameMode?: string; // game-mode id (regulation/first5/blitz/1v1) — WO-15
  code?: string;
  team?: 0 | 1 | null;
  homeUniform?: UniformSchemeId;
  awayUniform?: UniformSchemeId;
  serverUrl?: string;
  lockToCharacter?: boolean;
}

// Friendly room code (WO-14): 4 chars from an unambiguous alphabet (no O/0/I/1).
function genRoomCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

// Low-frequency UI state lives in zustand; the high-frequency snapshot buffer is a
// plain singleton read directly by the render loop (avoids re-rendering React at 30Hz).
type GameEvent =
  | 'goal'
  | 'gamebreaker'
  | 'hit'
  | 'ult'
  | 'shot'
  | 'puck_post'
  | 'one_timer'
  | 'save'
  | 'pickup'
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
  private pickupsSig = '';

  async connect(opts: ConnectOpts = {}): Promise<void> {
    const connMode = opts.mode ?? 'quick';
    const gameMode = opts.gameMode ?? 'regulation';
    const code = (opts.code ?? '').toUpperCase().trim();
    const ui = useUi.getState();
    ui.set({ status: 'connecting', error: null });
    try {
      const url = opts.serverUrl ?? `ws://${location.hostname}:2567`;
      const client = new Client(url);
      const joinOpts: Record<string, unknown> = { mode: gameMode };
      if (opts.team === 0 || opts.team === 1) joinOpts.team = opts.team;
      if (opts.lockToCharacter) joinOpts.lockToCharacter = true;
      const uniforms = normalizeUniformPair(opts.homeUniform, opts.awayUniform);
      joinOpts.homeUniform = uniforms.home;
      joinOpts.awayUniform = uniforms.away;

      let room: Room;
      if (connMode === 'create') {
        joinOpts.code = code || genRoomCode();
        room = await client.create('match', joinOpts); // always a fresh private room
      } else if (connMode === 'join') {
        joinOpts.code = code; // join a friend's coded room (inherits its mode)
        room = await client.joinOrCreate('match', joinOpts);
      } else {
        // Quick Play: matchmake within a per-mode public bucket (so different modes
        // don't collide); the '~' prefix marks it non-shareable on the server.
        joinOpts.code = `~${gameMode}`;
        room = await client.joinOrCreate('match', joinOpts);
      }
      this.room = room;

      room.onMessage('assigned', (m: { skaterId: string; team: 0 | 1; code?: string; mode?: string; homeUniform?: UniformSchemeId; awayUniform?: UniformSchemeId }) => {
        useUi.getState().set({
          mySkaterId: m.skaterId,
          myTeam: m.team,
          roomCode: m.code ?? '',
          gameMode: m.mode ?? 'regulation',
          homeUniform: m.homeUniform ?? uniforms.home,
          awayUniform: m.awayUniform ?? uniforms.away,
        });
      });

      // one-shot gameplay events (hooks for VFX/SFX; registered to avoid warnings)
      room.onMessage('goal', (e: any) => this.events.emit('goal', e));
      room.onMessage('gamebreaker', (e: any) => this.events.emit('gamebreaker', e));
      room.onMessage('hit', (e: any) => this.events.emit('hit', e));
      room.onMessage('ult', (e: any) => this.events.emit('ult', e));
      room.onMessage('shot', (e: any) => this.events.emit('shot', e));
      room.onMessage('puck_post', (e: any) => this.events.emit('puck_post', e));
      room.onMessage('one_timer', (e: any) => this.events.emit('one_timer', e));
      room.onMessage('save', (e: any) => this.events.emit('save', e));
      room.onMessage('pickup', (e: any) => this.events.emit('pickup', e));
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
        controllerIndex: s.controllerIndex ?? -1,
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
        downedUntil: s.downedUntil,
        intangibleUntil: s.intangibleUntil,
        dekeUntil: s.dekeUntil,
        dekeDirX: s.dekeDirX,
        dekeDirZ: s.dekeDirZ,
        shootChargeStart: s.shootChargeStart,
        shootGlideDirX: s.shootGlideDirX,
        shootGlideDirZ: s.shootGlideDirZ,
        goalieSaveUntil: s.goalieSaveUntil,
        goalieSaveType: s.goalieSaveType,
        goalieSaveSide: s.goalieSaveSide,
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
        py: state.puck.py,
        vy: state.puck.vy,
        carrier: state.puck.carrier,
      },
    });
    // keep a few seconds of history — enough to feed the goal replay capture (WO-10)
    if (this.snapshots.length > 80) this.snapshots.shift();

    const ui = useUi.getState();
    const mine = ui.mySkaterId ? skaters[ui.mySkaterId] : undefined;

    // publish roster identities only when they change (low frequency)
    const ids = Object.values(skaters).sort((a, b) => a.id.localeCompare(b.id));
    const sig = ids.map((s) => `${s.id}:${s.team}:${s.characterId}:${s.controllerIndex}`).join('|');
    if (sig !== this.rosterSig) {
      this.rosterSig = sig;
      ui.set({
        roster: ids.map((s) => ({
          id: s.id,
          team: s.team,
          characterId: s.characterId,
          isGoalie: s.isGoalie,
          controllerIndex: s.controllerIndex,
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

    // publish ice pickups only when the set changes (WO-16)
    const pickups: IcePickup[] = [];
    let pickupsSig = '';
    state.pickups?.forEach((p: any, id: string) => {
      pickups.push({ id, kind: p.kind, px: p.px, pz: p.pz });
      pickupsSig += `${id}:${p.kind}:${p.px.toFixed(1)}:${p.pz.toFixed(1)}|`;
    });
    if (pickupsSig !== this.pickupsSig) {
      this.pickupsSig = pickupsSig;
      ui.set({ pickups });
    }

    ui.set({
      phase: state.phase,
      period: state.period,
      clock: state.clock,
      phaseTimer: state.phaseTimer,
      score0: state.score0,
      score1: state.score1,
      serverTime: state.time,
      homeUniform: state.homeUniform ?? ui.homeUniform,
      awayUniform: state.awayUniform ?? ui.awayUniform,
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

  setUniforms(home: UniformSchemeId, away: UniformSchemeId): void {
    const uniforms = normalizeUniformPair(home, away);
    this.room?.send(MSG.SET_UNIFORMS, uniforms);
    useUi.getState().set({ homeUniform: uniforms.home, awayUniform: uniforms.away });
  }

  rematch(): void {
    this.room?.send(MSG.REMATCH, {});
  }

  backToLobby(): void {
    this.room?.send(MSG.BACK_TO_LOBBY, {});
  }
}

export const net = new NetClient();
