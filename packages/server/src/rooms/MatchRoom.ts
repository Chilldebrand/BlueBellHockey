import { Room, type Client } from '@colyseus/core';
import {
  CHARACTERS,
  MSG,
  TICK_MS,
  beginCountdown,
  createWorld,
  neutralInput,
  step,
  type InputState,
  type RosterEntry,
  type Team,
  type WorldState,
} from '@bbh/shared';
import { MatchState, syncState } from './state.js';
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
  private selected = new Map<string, string>(); // slotId -> characterId
  private started = false;

  onCreate(): void {
    this.setState(new MatchState());

    // default character per slot so bots and unselected humans have a build
    SKATER_SLOTS.forEach((slot, i) => this.selected.set(slot.id, CHARACTERS[i % CHARACTERS.length].id));
    GOALIES.forEach((slot, i) =>
      this.selected.set(slot.id, CHARACTERS[(i + 6) % CHARACTERS.length].id),
    );

    this.world = createWorld(this.buildRoster());
    syncState(this.state, this.world);

    this.onMessage<InputMessage>(MSG.INPUT, (client, msg) => {
      const skaterId = this.sessionToSkater.get(client.sessionId);
      if (!skaterId) return;
      this.inputs[skaterId] = msg.input;
      this.lastSeq[skaterId] = msg.seq;
    });

    this.onMessage<SelectCharacterMessage>(MSG.SELECT_CHARACTER, (client, msg) => {
      if (this.started) return;
      const skaterId = this.sessionToSkater.get(client.sessionId);
      if (skaterId && CHARACTERS.some((c) => c.id === msg.characterId)) {
        this.selected.set(skaterId, msg.characterId);
        this.world = createWorld(this.buildRoster());
        syncState(this.state, this.world);
      }
    });

    this.onMessage<ReadyMessage>(MSG.READY, (_client, msg) => {
      if (msg.ready && !this.started) this.startMatch();
    });

    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
  }

  onJoin(client: Client): void {
    const slot = SKATER_SLOTS.find((s) => !this.isSlotTaken(s.id));
    if (!slot) return;
    this.sessionToSkater.set(client.sessionId, slot.id);
    const row = this.state.skaters.get(slot.id);
    if (row) row.isBot = false;
    const w = this.world.skaters[slot.id];
    if (w) w.isBot = false;
    client.send('assigned', { skaterId: slot.id, team: slot.team });
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
    }
  }

  private isSlotTaken(slotId: string): boolean {
    for (const id of this.sessionToSkater.values()) if (id === slotId) return true;
    return false;
  }

  private buildRoster(): RosterEntry[] {
    const humans = new Set(this.sessionToSkater.values());
    const roster: RosterEntry[] = SKATER_SLOTS.map((slot) => ({
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
    this.world = createWorld(this.buildRoster());
    beginCountdown(this.world);
    syncState(this.state, this.world);
  }

  private tick(dtMs: number): void {
    const inputs: Record<string, InputState> = {};
    for (const s of Object.values(this.world.skaters)) {
      if (s.isGoalie) inputs[s.id] = goalieInput(this.world, s);
      else if (s.isBot) inputs[s.id] = botInput(this.world, s);
      else inputs[s.id] = this.inputs[s.id] ?? neutralInput();
    }

    step(this.world, inputs, dtMs);
    syncState(this.state, this.world);

    // attach last-processed input seq for client reconciliation
    for (const [, skaterId] of this.sessionToSkater) {
      const row = this.state.skaters.get(skaterId);
      if (row) row.ackSeq = this.lastSeq[skaterId] ?? 0;
    }

    // forward one-shot events for VFX / SFX
    for (const e of this.world.events) {
      if (e.type === 'goal' || e.type === 'hit' || e.type === 'ult') {
        this.broadcast(e.type, e);
      }
    }
  }
}
