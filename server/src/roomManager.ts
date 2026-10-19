import { randomBytes, randomInt } from 'node:crypto';
import {
  ANIMAL_IDS,
  MAPS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_CODE_LENGTH,
  TICK,
  applyAction,
  createGame,
  rejectMessage,
  step,
  toSnapshot,
  type Ack,
  type AnimalId,
  type ErrorCode,
  type GameEvent,
  type GameState,
  type JoinedPayload,
  type LobbyState,
  type PlayerInput,
  type Snapshot,
} from '@ff/shared';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** So lange bleibt ein getrennter Spieler in der Lobby reserviert. */
export const RECONNECT_GRACE_MS = 60_000;
/** So lange bleibt ein Raum ohne verbundene Spieler bestehen. */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;

interface RoomPlayer {
  id: string;
  token: string;
  name: string;
  animal: AnimalId;
  socketId: string | null;
  disconnectedAt: number | null;
  input: PlayerInput;
}

interface Room {
  code: string;
  hostId: string;
  mapId: string;
  phase: 'lobby' | 'playing';
  players: RoomPlayer[];
  game: GameState | null;
  sentCellsVersion: number;
  emptySince: number | null;
}

/** Ausgang des Servers; im Produktivbetrieb Socket.IO, in Tests ein Mitschnitt. */
export interface Broadcast {
  lobby(code: string, lobby: LobbyState): void;
  snapshot(code: string, snapshot: Snapshot): void;
  events(code: string, events: GameEvent[]): void;
}

const fail = (code: ErrorCode, message: string): { ok: false; error: { code: ErrorCode; message: string } } => ({
  ok: false,
  error: { code, message },
});

/**
 * Räume, Lobby und maßgeblicher Spielzustand. Unabhängig von Socket.IO, damit es
 * direkt testbar ist. Spieler werden über ihre Socket-ID zugeordnet.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly bySocket = new Map<string, { code: string; playerId: string }>();

  constructor(private readonly out: Broadcast) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  private lobby(room: Room): LobbyState {
    return {
      code: room.code,
      mapId: room.mapId,
      phase: room.phase,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        animal: p.animal,
        connected: p.socketId !== null,
        isHost: p.id === room.hostId,
      })),
    };
  }

  private publishLobby(room: Room): void {
    this.out.lobby(room.code, this.lobby(room));
  }

  private joined(room: Room, player: RoomPlayer): Ack<JoinedPayload> {
    return { ok: true, data: { code: room.code, playerId: player.id, token: player.token, lobby: this.lobby(room) } };
  }

  /** Erstes freies Tier, wenn das gewünschte schon vergeben ist. */
  private freeAnimal(room: Room, wanted: AnimalId, exceptId?: string): AnimalId | null {
    const taken = new Set(room.players.filter((p) => p.id !== exceptId).map((p) => p.animal));
    if (!taken.has(wanted)) return wanted;
    return ANIMAL_IDS.find((a) => !taken.has(a)) ?? null;
  }

  private addPlayer(room: Room, socketId: string, name: string, animal: AnimalId): RoomPlayer {
    const player: RoomPlayer = {
      id: randomBytes(8).toString('hex'),
      token: randomBytes(16).toString('hex'),
      name,
      animal,
      socketId,
      disconnectedAt: null,
      input: { x: 0, z: 0 },
    };
    room.players.push(player);
    room.emptySince = null;
    this.bySocket.set(socketId, { code: room.code, playerId: player.id });
    return player;
  }

  create(socketId: string, name: string, animal: AnimalId, mapId: string): Ack<JoinedPayload> {
    this.leave(socketId);
    const room: Room = {
      code: this.newCode(),
      hostId: '',
      mapId: mapId || MAPS[0]!.id,
      phase: 'lobby',
      players: [],
      game: null,
      sentCellsVersion: -1,
      emptySince: null,
    };
    this.rooms.set(room.code, room);
    const player = this.addPlayer(room, socketId, name, animal);
    room.hostId = player.id;
    return this.joined(room, player);
  }

  join(socketId: string, code: string, name: string, animal: AnimalId): Ack<JoinedPayload> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND', 'Diesen Raum gibt es nicht (mehr).');
    if (room.phase !== 'lobby') return fail('ALREADY_STARTED', 'Die Runde läuft schon. Warte, bis sie vorbei ist.');
    if (room.players.length >= MAX_PLAYERS) return fail('ROOM_FULL', 'Der Raum ist voll (höchstens vier Tiere).');
    const free = this.freeAnimal(room, animal);
    if (!free) return fail('ANIMAL_TAKEN', 'Alle Tiere sind schon vergeben.');
    this.leave(socketId);
    const player = this.addPlayer(room, socketId, name, free);
    this.publishLobby(room);
    return this.joined(room, player);
  }

  /** Wiederbeitritt nach Neuladen oder Verbindungsabbruch, über das geheime Token. */
  rejoin(socketId: string, code: string, token: string): Ack<JoinedPayload> {
    const room = this.rooms.get(code);
    const player = room?.players.find((p) => p.token === token);
    if (!room || !player) return fail('ROOM_NOT_FOUND', 'Der Raum ist nicht mehr verfügbar.');
    if (player.socketId && player.socketId !== socketId) this.bySocket.delete(player.socketId);
    player.socketId = socketId;
    player.disconnectedAt = null;
    room.emptySince = null;
    this.bySocket.set(socketId, { code, playerId: player.id });
    this.publishLobby(room);
    if (room.game) this.out.snapshot(room.code, toSnapshot(room.game, true));
    return this.joined(room, player);
  }

  private find(socketId: string): { room: Room; player: RoomPlayer } | null {
    const ref = this.bySocket.get(socketId);
    const room = ref && this.rooms.get(ref.code);
    const player = room?.players.find((p) => p.id === ref!.playerId);
    return room && player ? { room, player } : null;
  }

  update(socketId: string, change: { animal?: AnimalId; mapId?: string }): Ack {
    const found = this.find(socketId);
    if (!found) return fail('NOT_IN_ROOM', 'Du bist in keinem Raum.');
    const { room, player } = found;
    if (room.phase !== 'lobby') return fail('ALREADY_STARTED', 'Die Runde läuft schon.');
    if (change.animal) {
      if (this.freeAnimal(room, change.animal, player.id) !== change.animal) {
        return fail('ANIMAL_TAKEN', 'Dieses Tier hat schon jemand gewählt.');
      }
      player.animal = change.animal;
    }
    if (change.mapId) {
      if (player.id !== room.hostId) return fail('NOT_HOST', 'Nur der Host wählt die Baustelle.');
      room.mapId = change.mapId;
    }
    this.publishLobby(room);
    return { ok: true, data: undefined };
  }

  start(socketId: string): Ack {
    const found = this.find(socketId);
    if (!found) return fail('NOT_IN_ROOM', 'Du bist in keinem Raum.');
    const { room, player } = found;
    if (player.id !== room.hostId) return fail('NOT_HOST', 'Nur der Host startet die Runde.');
    if (room.phase !== 'lobby') return fail('ALREADY_STARTED', 'Die Runde läuft schon.');
    const connected = room.players.filter((p) => p.socketId !== null);
    if (connected.length < MIN_PLAYERS) return fail('NOT_ENOUGH_PLAYERS', 'Für den Koop braucht es mindestens zwei Tiere.');
    // Wer in der Lobby getrennt ist, fällt beim Start heraus.
    room.players = connected;
    for (const p of room.players) p.input = { x: 0, z: 0 };
    room.game = createGame(
      room.mapId,
      room.players.map((p) => ({ id: p.id, name: p.name, animal: p.animal })),
      'coop',
    );
    room.phase = 'playing';
    room.sentCellsVersion = room.game.cellsVersion;
    this.publishLobby(room);
    this.out.snapshot(room.code, toSnapshot(room.game, true));
    return { ok: true, data: undefined };
  }

  /** Nach Rundenende zurück in die Lobby (jeder Spieler darf das auslösen). */
  backToLobby(socketId: string): Ack {
    const found = this.find(socketId);
    if (!found) return fail('NOT_IN_ROOM', 'Du bist in keinem Raum.');
    const { room } = found;
    if (room.game && room.game.status === 'playing') return fail('ALREADY_STARTED', 'Die Runde läuft noch.');
    room.phase = 'lobby';
    room.game = null;
    this.publishLobby(room);
    return { ok: true, data: undefined };
  }

  input(socketId: string, input: PlayerInput): void {
    const found = this.find(socketId);
    if (found) found.player.input = input;
  }

  action(socketId: string, type: 'interact' | 'ability', actionId: string, facing?: { x: number; z: number }): Ack {
    const found = this.find(socketId);
    if (!found) return fail('NOT_IN_ROOM', 'Du bist in keinem Raum.');
    const { room, player } = found;
    if (!room.game) return fail('INVALID', 'Es läuft keine Runde.');
    // Kurzes Antippen erreicht den Server evtl. nie als Eingabe; die Blickrichtung kommt deshalb mit der Aktion.
    const gamePlayer = room.game.players.find((p) => p.id === player.id);
    if (facing && gamePlayer && !gamePlayer.job && room.game.status === 'playing') gamePlayer.facing = facing;
    const result = applyAction(room.game, { type, playerId: player.id, actionId });
    if (!result.ok) return fail('INVALID', rejectMessage(result.reason));
    if (result.events.length > 0) this.out.events(room.code, result.events);
    return { ok: true, data: undefined };
  }

  leave(socketId: string): void {
    const found = this.find(socketId);
    this.bySocket.delete(socketId);
    if (!found) return;
    const { room, player } = found;
    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.game) room.game.players = room.game.players.filter((p) => p.id !== player.id);
    this.afterRemoval(room);
  }

  disconnect(socketId: string, now = Date.now()): void {
    const found = this.find(socketId);
    this.bySocket.delete(socketId);
    if (!found) return;
    found.player.socketId = null;
    found.player.disconnectedAt = now;
    found.player.input = { x: 0, z: 0 };
    if (found.room.players.every((p) => p.socketId === null)) found.room.emptySince = now;
    this.publishLobby(found.room);
  }

  private afterRemoval(room: Room): void {
    if (room.players.length === 0) {
      this.rooms.delete(room.code);
      return;
    }
    if (!room.players.some((p) => p.id === room.hostId)) {
      room.hostId = (room.players.find((p) => p.socketId) ?? room.players[0]!).id;
    }
    this.publishLobby(room);
  }

  /** Ein Simulationsschritt für alle laufenden Runden, plus Aufräumen. */
  tick(now = Date.now()): void {
    for (const room of this.rooms.values()) {
      if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        this.rooms.delete(room.code);
        continue;
      }
      if (room.phase === 'lobby') {
        const expired = room.players.filter((p) => p.disconnectedAt !== null && now - p.disconnectedAt > RECONNECT_GRACE_MS);
        if (expired.length > 0) {
          room.players = room.players.filter((p) => !expired.includes(p));
          this.afterRemoval(room);
        }
        continue;
      }
      const game = room.game;
      if (!game) continue;
      const wasPlaying = game.status === 'playing';
      if (!wasPlaying) continue;
      const inputs = Object.fromEntries(room.players.map((p) => [p.id, p.input]));
      const events = step(game, inputs, TICK);
      if (events.length > 0) this.out.events(room.code, events);
      const includeCells = game.cellsVersion !== room.sentCellsVersion;
      room.sentCellsVersion = game.cellsVersion;
      this.out.snapshot(room.code, toSnapshot(game, includeCells));
    }
  }

  /** Nur für Tests. */
  peek(code: string): Room | undefined {
    return this.rooms.get(code);
  }
}
