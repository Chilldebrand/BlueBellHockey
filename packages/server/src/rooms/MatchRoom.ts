import { Room, type Client } from '@colyseus/core';
import {
  CHARACTERS,
  MSG,
  TICK_MS,
  beginCountdown,
  createWorld,
  getMode,
  neutralInput,
  step,
  type GameModeDef,
  type InputState,
  type RosterEntry,
  type Team,
  type WorldState,
} from '@bbh/shared';
import { MatchState, syncState } from './state.js';
import { sanitizeClientInput, sanitizeInputSeq } from './input.js';
import { canTeamControl, nextSkaterOnTeam } from './control.js';
import { botInput } from '../ai/bot.js';
import { goalieInput } from '../ai/goalie.js';
import type {
  InputMessage,
  ReadyMessage,
  SelectCharacterMessage,
} from '@bbh/shared';

// Six human-capable skater slots (3 per team) plus one bot goalie per team.
const SKATER_SLOTS: { id: string; team: Team }[] = [
  { id: 's0', team: 0 },
  { id: 's1', team: 0 },
  { id: 's2', team: 0 },
  { id: 's3', team: 1 },
  { id: 's4', team: 1 },
  { id: 's5', team: 1 },
];
const GOALIES: { id: string; team: Team }[] = [
  { id: 'g0', team: 0 },
  { id: 'g1', team: 1 },
];

export class MatchRoom extends Room<MatchState> {
  maxClients = 6;
  private world!: WorldState;
  private inputs: Record<string, InputState> = {};
  private lastSeq: Record<string, number> = {};
  private sessionToSkater = new Map<string, string>();
  private sessionLocked = new Map<string, boolean>();
  private lastSwitchHeld = new Map<string, boolean>();
  private selected = new Map<string, string>(); // slotId -> characterId
  private started = false;
  private displayCode = ''; // shareable private code ('' = public) — WO-14
  private mode: GameModeDef = getMode(undefined); // game mode — WO-15

  onCreate(options?: { code?: string; mode?: string }): void {
    const mmCode = (options?.code ?? '').toString();
    this.mode = getMode(options?.mode);
    // Public/quick rooms (empty or a '~mode' bucket) have no shareable code; a
    // private room shows its code so the host can invite friends.
    this.displayCode = mmCode && !mmCode.startsWith('~') ? mmCode.toUpperCase().slice(0, 6) : '';
    this.setMetadata({ code: mmCode, mode: this.mode.id });
    this.setState(new MatchState());

    // default character per slot so bots and unselected humans have a build
    SKATER_SLOTS.forEach((slot, i) => this.selected.set(slot.id, CHARACTERS[i % CHARACTERS.length].id));
    GOALIES.forEach((slot, i) =>
      this.selected.set(slot.id, CHARACTERS[(i + 6) % CHARACTERS.length].id),
    );

    this.world = createWorld(this.buildRoster(), this.mode);
    syncState(this.state, this.world);

    this.onMessage<InputMessage>(MSG.INPUT, (client, msg) => {
      const skaterId = this.sessionToSkater.get(client.sessionId);
      if (!skaterId) return;
      this.inputs[skaterId] = sanitizeClientInput(msg.input);
      this.lastSeq[skaterId] = sanitizeInputSeq(msg.seq);
    });

    this.onMessage<SelectCharacterMessage>(MSG.SELECT_CHARACTER, (client, msg) => {
      if (this.started) return;
      const skaterId = this.sessionToSkater.get(client.sessionId);
      if (skaterId && CHARACTERS.some((c) => c.id === msg.characterId)) {
        this.selected.set(skaterId, msg.characterId);
        this.world = createWorld(this.buildRoster(), this.mode);
        syncState(this.state, this.world);
      }
    });

    this.onMessage<ReadyMessage>(MSG.READY, (_client, msg) => {
      if (msg.ready && !this.started) this.startMatch();
    });

    // Postgame (WO-09): rematch replays the same teams; back-to-lobby returns
    // everyone to character select. Only meaningful once the match has ended.
    this.onMessage(MSG.REMATCH, () => {
      if (this.world.phase === 'ended') this.startMatch();
    });
    this.onMessage(MSG.BACK_TO_LOBBY, () => {
      if (this.world.phase === 'ended') this.returnToLobby();
    });

    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
  }

  onJoin(client: Client, options?: { team?: number; lockToCharacter?: boolean }): void {
    // Team preference (WO-14): take a free slot on the requested team if any,
    // otherwise fall back to any free slot. Only the mode's active slots exist
    // (e.g. 1-on-1 has one per side) — WO-15.
    const slots = this.activeSlots();
    const want = options?.team === 1 ? 1 : options?.team === 0 ? 0 : null;
    const slot =
      (want !== null && slots.find((s) => s.team === want && !this.isSlotTaken(s.id))) ||
      slots.find((s) => !this.isSlotTaken(s.id));
    if (!slot) return; // room full for this mode → spectate (no slot)
    this.sessionToSkater.set(client.sessionId, slot.id);
    this.sessionLocked.set(client.sessionId, options?.lockToCharacter === true);
    const row = this.state.skaters.get(slot.id);
    if (row) row.isBot = false;
    const w = this.world.skaters[slot.id];
    if (w) w.isBot = false;
    client.send('assigned', {
      skaterId: slot.id,
      team: slot.team,
      code: this.displayCode,
      mode: this.mode.id,
    });
  }

  onLeave(client: Client): void {
    const skaterId = this.sessionToSkater.get(client.sessionId);
    if (skaterId) {
      // hand the slot back to a bot
      const w = this.world.skaters[skaterId];
      if (w) w.isBot = true;
      const row = this.state.skaters.get(skaterId);
      if (row) row.isBot = true;
      delete this.inputs[skaterId];
      this.sessionToSkater.delete(client.sessionId);
      this.sessionLocked.delete(client.sessionId);
      this.lastSwitchHeld.delete(client.sessionId);
    }
  }

  private isSlotTaken(slotId: string): boolean {
    for (const id of this.sessionToSkater.values()) if (id === slotId) return true;
    return false;
  }

  /** The skater slots active for the current mode (e.g. one per side for 1-on-1). */
  private activeSlots(): { id: string; team: Team }[] {
    const n = this.mode.skatersPerTeam;
    return [
      ...SKATER_SLOTS.filter((s) => s.team === 0).slice(0, n),
      ...SKATER_SLOTS.filter((s) => s.team === 1).slice(0, n),
    ];
  }

  private buildRoster(): RosterEntry[] {
    const humans = new Set(this.sessionToSkater.values());
    const roster: RosterEntry[] = this.activeSlots().map((slot) => ({
      id: slot.id,
      team: slot.team,
      characterId: this.selected.get(slot.id)!,
      isBot: !humans.has(slot.id),
      isGoalie: false,
    }));
    for (const g of GOALIES) {
      roster.push({
        id: g.id,
        team: g.team,
        characterId: this.selected.get(g.id)!,
        isBot: true,
        isGoalie: true,
      });
    }
    return roster;
  }

  private startMatch(): void {
    this.started = true;
    this.world = createWorld(this.buildRoster(), this.mode);
    beginCountdown(this.world);
    syncState(this.state, this.world);
  }

  /** Tear the match down to a fresh lobby (postgame "Back to Lobby"). */
  private returnToLobby(): void {
    this.started = false;
    this.inputs = {};
    this.lastSeq = {};
    this.world = createWorld(this.buildRoster(), this.mode); // phase 'lobby'
    syncState(this.state, this.world);
  }

  private tick(dtMs: number): void {
    this.processControlSwitches();

    const inputs: Record<string, InputState> = {};
    for (const s of Object.values(this.world.skaters)) {
      if (s.isGoalie) inputs[s.id] = goalieInput(this.world, s);
      else if (s.isBot) inputs[s.id] = botInput(this.world, s);
      else inputs[s.id] = this.inputs[s.id] ?? neutralInput();
    }

    step(this.world, inputs, dtMs);
    this.followTeamCarrier();
    syncState(this.state, this.world);

    // attach last-processed input seq for client reconciliation
    for (const [, skaterId] of this.sessionToSkater) {
      const row = this.state.skaters.get(skaterId);
      if (row) row.ackSeq = this.lastSeq[skaterId] ?? 0;
    }

    // forward one-shot events for VFX / SFX
    for (const e of this.world.events) {
      if (
        e.type === 'goal' ||
        e.type === 'gamebreaker' ||
        e.type === 'hit' ||
        e.type === 'ult' ||
        e.type === 'shot' ||
        e.type === 'one_timer' ||
        e.type === 'save' ||
        e.type === 'pickup' ||
        e.type === 'penalty' ||
        e.type === 'deke' ||
        e.type === 'poke' ||
        e.type === 'ankle_break' ||
        e.type === 'bank_play' ||
        e.type === 'nolook_pass'
      ) {
        this.broadcast(e.type, e);
      }
    }
  }

  private humansOnTeam(team: Team): number {
    let count = 0;
    for (const skaterId of this.sessionToSkater.values()) {
      const s = this.world.skaters[skaterId];
      if (s?.team === team) count++;
    }
    return count;
  }

  private hasTeamControl(client: Client | string, team: Team): boolean {
    const sessionId = typeof client === 'string' ? client : client.sessionId;
    return canTeamControl({
      locked: this.sessionLocked.get(sessionId) === true,
      humansOnTeam: this.humansOnTeam(team),
    });
  }

  private setControlledSkater(sessionId: string, skaterId: string): void {
    const prev = this.sessionToSkater.get(sessionId);
    if (prev === skaterId) return;
    if (prev) {
      const oldWorld = this.world.skaters[prev];
      if (oldWorld) oldWorld.isBot = true;
      const oldRow = this.state.skaters.get(prev);
      if (oldRow) oldRow.isBot = true;
      delete this.inputs[prev];
    }
    this.sessionToSkater.set(sessionId, skaterId);
    const nextWorld = this.world.skaters[skaterId];
    if (nextWorld) nextWorld.isBot = false;
    const nextRow = this.state.skaters.get(skaterId);
    if (nextRow) nextRow.isBot = false;
    this.clients.find((c) => c.sessionId === sessionId)?.send('assigned', {
      skaterId,
      team: nextWorld?.team ?? 0,
      code: this.displayCode,
      mode: this.mode.id,
    });
  }

  private processControlSwitches(): void {
    for (const [sessionId, skaterId] of this.sessionToSkater) {
      const current = this.world.skaters[skaterId];
      if (!current) continue;
      const input = this.inputs[skaterId] ?? neutralInput();
      const held = input.actions.switchPlayer;
      const wasHeld = this.lastSwitchHeld.get(sessionId) === true;
      this.lastSwitchHeld.set(sessionId, held);
      if (!held || wasHeld) continue;
      if (this.world.puck.carrier === skaterId) continue;
      if (!this.hasTeamControl(sessionId, current.team)) continue;
      this.setControlledSkater(sessionId, nextSkaterOnTeam(this.activeSlots(), skaterId, current.team));
    }
  }

  private followTeamCarrier(): void {
    const carrierId = this.world.puck.carrier;
    if (!carrierId) return;
    const carrier = this.world.skaters[carrierId];
    if (!carrier || carrier.isGoalie) return;
    for (const [sessionId, skaterId] of this.sessionToSkater) {
      const current = this.world.skaters[skaterId];
      if (!current || current.team !== carrier.team) continue;
      if (!this.hasTeamControl(sessionId, carrier.team)) continue;
      this.setControlledSkater(sessionId, carrierId);
    }
  }
}
