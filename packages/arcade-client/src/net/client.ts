import type { CharacterId, InputFrame, TeamId } from "@bbh/arcade-core";
import { Client } from "colyseus.js";
import type { ServerRoomState } from "../store.js";

export interface ArcadeRoomConnection {
  readonly sessionId: string;
  readonly reconnectionToken?: string;
  readonly state: ServerRoomState;
  onStateChange(callback: (state: ServerRoomState) => void): unknown;
  onError(callback: (code: number, message?: string) => void): unknown;
  onLeave(callback: (code: number) => void): unknown;
  onMessage?<TMessage>(
    type: string,
    callback: (message: TMessage) => void
  ): unknown;
  send(type: string, message?: unknown): void;
  removeAllListeners?(): void;
  leave?(): Promise<unknown> | unknown;
}

export interface ArcadeMatchmaker {
  joinOrCreate?(
    roomName: string,
    options: ArcadeRoomOptions
  ): Promise<ArcadeRoomConnection>;
  join?(
    roomName: string,
    options: ArcadeRoomOptions
  ): Promise<ArcadeRoomConnection>;
  create?(
    roomName: string,
    options: ArcadeRoomOptions
  ): Promise<ArcadeRoomConnection>;
  reconnect?(reconnectionToken: string): Promise<ArcadeRoomConnection>;
}

export interface ArcadeRoomOptions {
  readonly mode: "arcade3v3";
  readonly privateCode: string;
  readonly quickMatch: boolean;
}

export interface ArcadeConnectionDependencies {
  readonly matchmaker?: ArcadeMatchmaker;
  readonly codeGenerator?: () => string;
}

export interface ArcadeConnectionResult {
  readonly connection: ArcadeRoomSession;
  readonly room: ArcadeRoomConnection;
  readonly options?: ArcadeRoomOptions;
  readonly isReconnect?: boolean;
}

export interface ArcadePrivateRoomResult extends ArcadeConnectionResult {
  readonly code: string;
}

const ROOM_NAME = "arcade";
const MODE = "arcade3v3";
const DEFAULT_WS_URL = "ws://localhost:2567";
export const ARCADE_RECONNECT_STORAGE_KEY = "bbh.arcade.reconnect.v1";
const RECONNECT_WINDOW_MS = 30_000;

export interface ArcadeReconnectTicket {
  readonly reconnectionToken: string;
  readonly options: ArcadeRoomOptions;
  readonly savedAtMs: number;
  readonly expiresAtMs: number;
}

export interface ArcadeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class ArcadeRoomSession {
  constructor(readonly room: ArcadeRoomConnection) {}

  chooseTeam(teamId: TeamId): void {
    this.room.send("client.chooseTeam", { teamId });
  }

  /**
   * Slot-targeted character selection: your own slot, or (as team captain)
   * one of your team's bot slots. The server enforces permissions.
   */
  chooseCharacterFor(slotId: string, characterId: CharacterId): void {
    this.room.send("client.chooseCharacterFor", { slotId, characterId });
  }

  requestStart(): void {
    this.room.send("client.requestStart");
  }

  requestRematch(): void {
    this.room.send("client.rematch");
  }

  backToLobby(): void {
    this.room.send("client.backToLobby");
  }

  sendInput(frame: InputFrame): void {
    this.room.send("client.input", {
      type: "client.input",
      frame
    });
  }

  leave(): Promise<unknown> | unknown {
    return this.room.leave?.();
  }
}

export async function connectQuickMatch(
  dependencies: ArcadeConnectionDependencies = {}
): Promise<ArcadeConnectionResult> {
  const options = {
    mode: MODE,
    privateCode: "",
    quickMatch: true
  } satisfies ArcadeRoomOptions;
  const room = await joinOrCreateRoom(getMatchmaker(dependencies), options);

  return connectResult(room, options);
}

export async function createPrivateRoom(
  dependencies: ArcadeConnectionDependencies = {}
): Promise<ArcadePrivateRoomResult> {
  const code = createPrivateRoomCode(dependencies.codeGenerator);
  const options = privateRoomOptions(code);
  const matchmaker = getMatchmaker(dependencies);
  const room = matchmaker.create
    ? await matchmaker.create(ROOM_NAME, options)
    : await joinOrCreateRoom(matchmaker, options);

  return { ...connectResult(room, options), code };
}

export async function joinPrivateRoom(
  code: string,
  dependencies: ArcadeConnectionDependencies = {}
): Promise<ArcadeConnectionResult> {
  const options = privateRoomOptions(normalizePrivateRoomCode(code));
  const room = await joinRoom(getMatchmaker(dependencies), options);

  return connectResult(room, options);
}

export async function reconnectPreviousRoom(
  dependencies: ArcadeConnectionDependencies = {},
  storage: ArcadeStorage | null = getBrowserStorage(),
  nowMs = Date.now()
): Promise<ArcadeConnectionResult | null> {
  const ticket = readReconnectTicket(storage, nowMs);
  if (!ticket) {
    return null;
  }

  const matchmaker = getMatchmaker(dependencies);
  if (!matchmaker.reconnect) {
    clearReconnectTicket(storage);
    return null;
  }

  try {
    const room = await matchmaker.reconnect(ticket.reconnectionToken);
    return {
      ...connectResult(room, ticket.options),
      isReconnect: true
    };
  } catch (error) {
    clearReconnectTicket(storage);
    throw error;
  }
}

export function hasReconnectTicket(
  storage: ArcadeStorage | null = getBrowserStorage(),
  nowMs = Date.now()
): boolean {
  return readReconnectTicket(storage, nowMs) !== null;
}

export function saveReconnectTicket(
  room: ArcadeRoomConnection,
  options: ArcadeRoomOptions | undefined,
  storage: ArcadeStorage | null = getBrowserStorage(),
  nowMs = Date.now()
): ArcadeReconnectTicket | null {
  if (!storage || !options || !room.reconnectionToken) {
    return null;
  }

  const ticket: ArcadeReconnectTicket = {
    reconnectionToken: room.reconnectionToken,
    options,
    savedAtMs: nowMs,
    expiresAtMs: nowMs + RECONNECT_WINDOW_MS
  };

  storage.setItem(ARCADE_RECONNECT_STORAGE_KEY, JSON.stringify(ticket));
  return ticket;
}

export function clearReconnectTicket(
  storage: ArcadeStorage | null = getBrowserStorage()
): void {
  storage?.removeItem(ARCADE_RECONNECT_STORAGE_KEY);
}

export function createPrivateRoomCode(codeGenerator = generateRoomCode): string {
  return normalizePrivateRoomCode(codeGenerator());
}

export function normalizePrivateRoomCode(code: string): string {
  const normalized = code.trim().toUpperCase();

  if (!normalized) {
    throw new Error("Room code is required.");
  }

  return normalized;
}

function connectResult(
  room: ArcadeRoomConnection,
  options?: ArcadeRoomOptions
): ArcadeConnectionResult {
  return {
    connection: new ArcadeRoomSession(room),
    room,
    options
  };
}

function privateRoomOptions(privateCode: string): ArcadeRoomOptions {
  return {
    mode: MODE,
    privateCode,
    quickMatch: false
  };
}

function getMatchmaker(
  dependencies: ArcadeConnectionDependencies
): ArcadeMatchmaker {
  return dependencies.matchmaker ?? new Client(getArcadeServerUrl());
}

async function joinOrCreateRoom(
  matchmaker: ArcadeMatchmaker,
  options: ArcadeRoomOptions
): Promise<ArcadeRoomConnection> {
  if (!matchmaker.joinOrCreate) {
    throw new Error("Matchmaker does not support joinOrCreate.");
  }

  return matchmaker.joinOrCreate(ROOM_NAME, options);
}

async function joinRoom(
  matchmaker: ArcadeMatchmaker,
  options: ArcadeRoomOptions
): Promise<ArcadeRoomConnection> {
  if (!matchmaker.join) {
    throw new Error("Matchmaker does not support join.");
  }

  return matchmaker.join(ROOM_NAME, options);
}

function getArcadeServerUrl(): string {
  // Explicit override first (tunnel/deploy builds that split page and server).
  if (import.meta.env.VITE_ARCADE_WS_URL) {
    return import.meta.env.VITE_ARCADE_WS_URL;
  }

  // Served from anywhere that isn't localhost (tunnel, LAN IP, real deploy):
  // the arcade-server hosts this page itself, so the websocket lives on the
  // SAME origin — derive it instead of assuming localhost:2567.
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}`;
  }

  return DEFAULT_WS_URL;
}

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
}

function readReconnectTicket(
  storage: ArcadeStorage | null,
  nowMs: number
): ArcadeReconnectTicket | null {
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(ARCADE_RECONNECT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const ticket = JSON.parse(raw) as Partial<ArcadeReconnectTicket>;
    const expiresAtMs = Number(ticket.expiresAtMs);

    if (
      !ticket.reconnectionToken ||
      !ticket.options ||
      ticket.options.mode !== MODE ||
      typeof ticket.options.privateCode !== "string" ||
      typeof ticket.options.quickMatch !== "boolean" ||
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs < nowMs
    ) {
      clearReconnectTicket(storage);
      return null;
    }

    return {
      reconnectionToken: ticket.reconnectionToken,
      options: ticket.options,
      savedAtMs: Number(ticket.savedAtMs ?? nowMs),
      expiresAtMs
    };
  } catch {
    clearReconnectTicket(storage);
    return null;
  }
}

function getBrowserStorage(): ArcadeStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}
