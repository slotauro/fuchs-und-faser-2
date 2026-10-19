import type { AnimalId, Cell, GameEvent, GameState, PlayerInput } from './types';

export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_NAME_LENGTH = 16;

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ANIMAL_TAKEN'
  | 'ALREADY_STARTED'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID'
  | 'RATE_LIMITED'
  | 'NOT_IN_ROOM';

export interface ErrorInfo {
  code: ErrorCode;
  message: string;
}

export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: ErrorInfo };

export interface LobbyPlayer {
  id: string;
  name: string;
  animal: AnimalId;
  connected: boolean;
  isHost: boolean;
}

export interface LobbyState {
  code: string;
  mapId: string;
  phase: 'lobby' | 'playing';
  players: LobbyPlayer[];
}

export interface JoinedPayload {
  code: string;
  playerId: string;
  token: string;
  lobby: LobbyState;
}

/** Zustand ohne Verwaltungsdaten; Kacheln nur, wenn sie sich geändert haben. */
export interface Snapshot extends Omit<GameState, 'cells' | 'appliedActionIds'> {
  cells?: Cell[];
}

export function toSnapshot(state: GameState, includeCells: boolean): Snapshot {
  const { cells, appliedActionIds: _ids, ...rest } = state;
  return includeCells ? { ...rest, cells } : rest;
}

export interface ClientToServer {
  'room:create': (p: { name: string; animal: AnimalId; mapId: string }, ack: (r: Ack<JoinedPayload>) => void) => void;
  'room:join': (p: { code: string; name: string; animal: AnimalId }, ack: (r: Ack<JoinedPayload>) => void) => void;
  'room:rejoin': (p: { code: string; token: string }, ack: (r: Ack<JoinedPayload>) => void) => void;
  'room:update': (p: { animal?: AnimalId; mapId?: string }, ack: (r: Ack) => void) => void;
  'room:start': (ack: (r: Ack) => void) => void;
  'room:leave': () => void;
  'game:input': (p: PlayerInput) => void;
  /** `facing` ist die Blickrichtung der Client-Vorhersage; der Server übernimmt sie vor der Aktion. */
  'game:action': (
    p: { type: 'interact' | 'ability'; actionId: string; facing?: { x: number; z: number } },
    ack: (r: Ack) => void,
  ) => void;
  'game:lobby': (ack: (r: Ack) => void) => void;
}

export interface ServerToClient {
  lobby: (lobby: LobbyState) => void;
  snapshot: (snapshot: Snapshot) => void;
  events: (events: GameEvent[]) => void;
}
