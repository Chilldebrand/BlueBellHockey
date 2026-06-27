import type { TeamId } from "@bbh/arcade-core";
import { Client } from "colyseus.js";
import type { ServerRoomState } from "../store.js";

export interface ArcadeRoomConnection {
  readonly sessionId: string;
  readonly state: ServerRoomState;
  onStateChange(callback: (state: ServerRoomState) => void): unknown;
  onError(callback: (code: number, message?: string) => void): unknown;
  onLeave(callback: (code: number) => void): unknown;
  onMessage?(
    type: string,
    callback: (message: { readonly message?: string }) => void
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
}

export interface ArcadePrivateRoomResult extends ArcadeConnectionResult {
  readonly code: string;
}

const ROOM_NAME = "arcade";
const MODE = "arcade3v3";
const DEFAULT_WS_URL = "ws://localhost:2568";

export class ArcadeRoomSession {
  constructor(readonly room: ArcadeRoomConnection) {}

  chooseTeam(teamId: TeamId): void {
    this.room.send("client.chooseTeam", { teamId });
  }

  requestStart(): void {
    this.room.send("client.requestStart");
  }

  leave(): Promise<unknown> | unknown {
    return this.room.leave?.();
  }
}

export async function connectQuickMatch(
  dependencies: ArcadeConnectionDependencies = {}
): Promise<ArcadeConnectionResult> {
  const room = await joinOrCreateRoom(getMatchmaker(dependencies), {
    mode: MODE,
    privateCode: "",
    quickMatch: true
  });

  return connectResult(room);
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

  return { ...connectResult(room), code };
}

export async function joinPrivateRoom(
  code: string,
  dependencies: ArcadeConnectionDependencies = {}
): Promise<ArcadeConnectionResult> {
  const room = await joinRoom(
    getMatchmaker(dependencies),
    privateRoomOptions(normalizePrivateRoomCode(code))
  );

  return connectResult(room);
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

function connectResult(room: ArcadeRoomConnection): ArcadeConnectionResult {
  return {
    connection: new ArcadeRoomSession(room),
    room
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
  return import.meta.env.VITE_ARCADE_WS_URL ?? DEFAULT_WS_URL;
}

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
}
