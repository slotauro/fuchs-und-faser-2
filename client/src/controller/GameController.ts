import type { GameEvent, GameState, PlayerInput } from '@ff/shared';

/**
 * Gemeinsame Schnittstelle für Singleplayer (Simulation im Browser) und
 * Multiplayer (Server ist maßgeblich). Die Darstellung kennt nur diese Schnittstelle.
 */
export interface GameController {
  readonly playerId: string;
  readonly mode: 'solo' | 'coop';
  /** Aktueller Zustand für die Darstellung. */
  state(): GameState;
  /** Schreitet die Zeit voran und liefert neue Ereignisse. */
  update(dt: number): GameEvent[];
  setInput(input: PlayerInput): void;
  interact(): void;
  ability(): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

export const newActionId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
