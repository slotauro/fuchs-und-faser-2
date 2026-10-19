import { io, type Socket } from 'socket.io-client';
import type { Ack, AnimalId, ClientToServer, JoinedPayload, ServerToClient } from '@ff/shared';

export type GameSocket = Socket<ServerToClient, ClientToServer>;

const SESSION_KEY = 'fiber-frenzy-room';

export interface StoredSession {
  code: string;
  token: string;
}

/** Socket.IO-Verbindung plus Raum-Sitzung (für Wiederbeitritt nach Neuladen im selben Tab). */
export class NetworkGateway {
  readonly socket: GameSocket;

  constructor() {
    this.socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });
  }

  private call<T>(fn: (ack: (r: Ack<T>) => void) => void, timeoutMs = 6000): Promise<Ack<T>> {
    return new Promise((resolve) => {
      const timer = window.setTimeout(
        () => resolve({ ok: false, error: { code: 'INVALID', message: 'Der Server antwortet nicht. Läuft er?' } }),
        timeoutMs,
      );
      fn((result) => {
        window.clearTimeout(timer);
        resolve(result);
      });
    });
  }

  async create(name: string, animal: AnimalId, mapId: string): Promise<Ack<JoinedPayload>> {
    const r = await this.call<JoinedPayload>((ack) => this.socket.emit('room:create', { name, animal, mapId }, ack));
    if (r.ok) this.remember(r.data);
    return r;
  }

  async join(code: string, name: string, animal: AnimalId): Promise<Ack<JoinedPayload>> {
    const r = await this.call<JoinedPayload>((ack) => this.socket.emit('room:join', { code, name, animal }, ack));
    if (r.ok) this.remember(r.data);
    return r;
  }

  async rejoin(session: StoredSession): Promise<Ack<JoinedPayload>> {
    const r = await this.call<JoinedPayload>((ack) => this.socket.emit('room:rejoin', session, ack));
    if (!r.ok) this.forget();
    return r;
  }

  update(change: { animal?: AnimalId; mapId?: string }): Promise<Ack> {
    return this.call((ack) => this.socket.emit('room:update', change, ack));
  }

  start(): Promise<Ack> {
    return this.call((ack) => this.socket.emit('room:start', ack));
  }

  backToLobby(): Promise<Ack> {
    return this.call((ack) => this.socket.emit('game:lobby', ack));
  }

  leave(): void {
    this.socket.emit('room:leave');
    this.forget();
  }

  action(type: 'interact' | 'ability', actionId: string, facing?: { x: number; z: number }): Promise<Ack> {
    return this.call((ack) => this.socket.emit('game:action', { type, actionId, facing }, ack), 1500);
  }

  private remember(data: JoinedPayload): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: data.code, token: data.token }));
    } catch {
      // Ohne Speicher klappt nur der Wiederbeitritt nach Neuladen nicht.
    }
  }

  forget(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignorieren
    }
  }

  static stored(): StoredSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.socket.removeAllListeners();
    this.socket.close();
  }
}
