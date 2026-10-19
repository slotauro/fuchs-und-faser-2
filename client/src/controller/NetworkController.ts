import {
  findPlayer,
  movePlayer,
  type GameEvent,
  type GameState,
  type PlayerInput,
  type Snapshot,
} from '@ff/shared';
import type { NetworkGateway } from '../net/NetworkGateway';
import { newActionId, type GameController } from './GameController';

/** Ab diesem Abstand springt die eigene Figur auf die Serverposition statt sanft nachzuführen. */
const SNAP_DISTANCE = 1.2;

/**
 * Multiplayer: der Server ist maßgeblich. Der Client sendet Eingaben und Aktionen,
 * zeigt den Serverzustand und sagt nur die eigene Bewegung voraus, damit die
 * Steuerung ohne Verzögerung reagiert.
 */
export class NetworkController implements GameController {
  readonly mode = 'coop' as const;
  private game: GameState;
  private input: PlayerInput = { x: 0, z: 0 };
  private lastSentInput = '';
  private predicted: { x: number; z: number; facing: { x: number; z: number } } | null = null;
  private pending: GameEvent[] = [];

  constructor(
    private readonly net: NetworkGateway,
    readonly playerId: string,
    initial: Snapshot & { cells: NonNullable<Snapshot['cells']> },
  ) {
    this.game = { ...initial, appliedActionIds: [] };
    net.socket.on('snapshot', this.onSnapshot);
    net.socket.on('events', this.onEvents);
  }

  private readonly onSnapshot = (s: Snapshot): void => {
    const cells = s.cells ?? this.game.cells;
    const { cells: _c, ...rest } = s;
    this.game = { ...rest, cells, appliedActionIds: [] };
    const server = findPlayer(this.game, this.playerId);
    if (!server) return;
    if (!this.predicted || server.job || this.game.status !== 'playing') {
      this.predicted = { x: server.x, z: server.z, facing: server.facing };
      return;
    }
    const dx = server.x - this.predicted.x;
    const dz = server.z - this.predicted.z;
    if (Math.hypot(dx, dz) > SNAP_DISTANCE) {
      this.predicted.x = server.x;
      this.predicted.z = server.z;
    } else {
      // Sanfte Korrektur zur Serverposition.
      this.predicted.x += dx * 0.25;
      this.predicted.z += dz * 0.25;
    }
  };

  private readonly onEvents = (events: GameEvent[]): void => {
    this.pending.push(...events);
  };

  state(): GameState {
    return this.game;
  }

  update(dt: number): GameEvent[] {
    const self = findPlayer(this.game, this.playerId);
    if (self && this.predicted) {
      // Eigene Bewegung lokal mit derselben Regel wie der Server vorhersagen.
      const copy = { ...self, x: this.predicted.x, z: this.predicted.z, facing: this.predicted.facing };
      if (this.game.status === 'playing') movePlayer(this.game, copy, this.input, dt);
      this.predicted = { x: copy.x, z: copy.z, facing: copy.facing };
      self.x = copy.x;
      self.z = copy.z;
      self.facing = copy.facing;
      self.moving = copy.moving;
    }
    const events = this.pending;
    this.pending = [];
    return events;
  }

  setInput(input: PlayerInput): void {
    this.input = input;
    const key = `${input.x.toFixed(2)},${input.z.toFixed(2)}`;
    if (key === this.lastSentInput) return;
    this.lastSentInput = key;
    this.net.socket.emit('game:input', input);
  }

  private send(type: 'interact' | 'ability'): void {
    const actionId = newActionId();
    const facing = this.predicted?.facing;
    void this.net.action(type, actionId, facing).then((r) => {
      // Bei Zeitüberschreitung einmal mit derselben ID wiederholen; der Server dedupliziert.
      if (!r.ok && r.error.message.includes('antwortet')) void this.net.action(type, actionId, facing);
    });
  }

  interact(): void {
    this.send('interact');
  }

  ability(): void {
    this.send('ability');
  }

  pause(): void {}

  resume(): void {}

  dispose(): void {
    this.net.socket.off('snapshot', this.onSnapshot);
    this.net.socket.off('events', this.onEvents);
  }
}
