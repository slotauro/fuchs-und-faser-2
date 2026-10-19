import { applyAction, createGame, step, type AnimalId, type GameEvent, type GameState, type PlayerInput } from '@ff/shared';
import { newActionId, type GameController } from './GameController';

/** Feiner Schritt im Browser für flüssige Bewegung; die Regeln sind schrittweitenunabhängig. */
const LOCAL_TICK = 1 / 60;

/** Singleplayer: die Simulation läuft vollständig im Browser, ohne Server. */
export class LocalController implements GameController {
  readonly playerId = 'solo';
  readonly mode = 'solo' as const;
  private readonly game: GameState;
  private input: PlayerInput = { x: 0, z: 0 };
  /** Kurzes Antippen soll die Figur wenigstens drehen, auch wenn Drücken und Loslassen in einen Frame fallen. */
  private inputConsumed = true;
  private releaseAfterStep = false;
  private accumulator = 0;
  private pending: GameEvent[] = [];

  constructor(mapId: string, animal: AnimalId, name: string) {
    this.game = createGame(mapId, [{ id: this.playerId, name, animal }], 'solo');
  }

  state(): GameState {
    return this.game;
  }

  private tick(): void {
    this.pending.push(...step(this.game, { [this.playerId]: this.input }, LOCAL_TICK));
    this.inputConsumed = true;
    if (this.releaseAfterStep) {
      this.input = { x: 0, z: 0 };
      this.releaseAfterStep = false;
    }
  }

  update(dt: number): GameEvent[] {
    this.accumulator = Math.min(this.accumulator + dt, 0.25);
    if (!this.inputConsumed && this.accumulator < LOCAL_TICK) this.accumulator = LOCAL_TICK;
    while (this.accumulator >= LOCAL_TICK) {
      this.tick();
      this.accumulator -= LOCAL_TICK;
    }
    const events = this.pending;
    this.pending = [];
    return events;
  }

  /** Eine angetippte Richtung muss vor der Aktion wirken, sonst zielt die Aktion noch in die alte Richtung. */
  private flushInput(): void {
    if (!this.inputConsumed) this.tick();
  }

  setInput(input: PlayerInput): void {
    const idle = input.x === 0 && input.z === 0;
    if (idle && !this.inputConsumed) {
      this.releaseAfterStep = true;
      return;
    }
    this.input = input;
    this.inputConsumed = idle;
    this.releaseAfterStep = false;
  }

  interact(): void {
    this.flushInput();
    const result = applyAction(this.game, { type: 'interact', playerId: this.playerId, actionId: newActionId() });
    if (result.ok) this.pending.push(...result.events);
  }

  ability(): void {
    this.flushInput();
    const result = applyAction(this.game, { type: 'ability', playerId: this.playerId, actionId: newActionId() });
    if (result.ok) this.pending.push(...result.events);
  }

  pause(): void {
    applyAction(this.game, { type: 'pause' });
  }

  resume(): void {
    applyAction(this.game, { type: 'resume' });
  }

  dispose(): void {}
}
