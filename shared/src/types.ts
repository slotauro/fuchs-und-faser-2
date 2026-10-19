/** Kachelarten der Karte. Eine Kachel hat eine Kantenlänge von einer Welteinheit. */
export type TileKind =
  | 'grass'
  | 'roots'
  | 'rock'
  | 'gravel' // gebrochener Fels
  | 'road'
  | 'water'
  | 'conduit' // vorhandenes Leerrohr (evtl. verborgen)
  | 'socket' // Hausanschlusspunkt vor einem Haus
  | 'house'
  | 'distributor'
  | 'station'
  | 'tree';

export type AnimalId = 'fox' | 'mole' | 'beaver' | 'badger';

export interface Cell {
  kind: TileKind;
  /** Graben ausgehoben (Wiese, Wurzeln, Schotter). */
  dug: boolean;
  /** Kabelschacht gesetzt (nur Straße). */
  shaft: boolean;
  /** Glasfaser liegt auf dieser Kachel. */
  cable: boolean;
  /** Nur Leerrohr: verborgen, bis es aufgedeckt wird. */
  hidden: boolean;
  /** Haus-Kennung bei Haus- und Anschlusskacheln. */
  houseId?: string;
}

export interface House {
  id: string;
  cells: number[];
  socket: number;
  online: boolean;
}

export type JobKind = 'dig' | 'break' | 'shaft' | 'lay' | 'connect';

export interface Job {
  kind: JobKind;
  cell: number;
  elapsed: number;
  duration: number;
}

export interface AbilityState {
  /** Spielzeit, ab der die Fähigkeit wieder einsetzbar ist. */
  readyAt: number;
  /** Maulwurf: Schnellbuddeln aktiv bis zu dieser Spielzeit. */
  activeUntil: number;
  /** Biber und Dachs: die nächste passende Arbeit ist beschleunigt. */
  armed: boolean;
  /** Fuchs: einmal pro Auftrag verbraucht. */
  used: boolean;
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface PlayerState {
  id: string;
  name: string;
  animal: AnimalId;
  /** Position in Kachelkoordinaten; Kachel (cx, cz) reicht von cx-0.5 bis cx+0.5. */
  x: number;
  z: number;
  facing: Vec2;
  moving: boolean;
  carrying: number;
  job: Job | null;
  ability: AbilityState;
}

export interface PlayerInput {
  /** Gewünschte Richtung, Komponenten zwischen -1 und 1. */
  x: number;
  z: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface RoundResult {
  won: boolean;
  housesOnline: number;
  housesTotal: number;
  housePoints: number;
  timeBonus: number;
  cableBonus: number;
  score: number;
}

export interface Hint {
  cells: number[];
  until: number;
}

export interface GameState {
  mapId: string;
  mode: 'solo' | 'coop';
  width: number;
  height: number;
  cells: Cell[];
  houses: House[];
  stationStock: number;
  players: PlayerState[];
  /** Vergangene Spielzeit in Sekunden. */
  time: number;
  timeLimit: number;
  status: GameStatus;
  paused: boolean;
  score: number;
  result: RoundResult | null;
  hint: Hint | null;
  /** Steigt bei jeder Kachelveränderung; der Server sendet Kacheln nur bei Änderung. */
  cellsVersion: number;
  appliedActionIds: string[];
}

export type RejectReason =
  | 'NOTHING_HERE'
  | 'NO_CABLE'
  | 'NOT_CONNECTED'
  | 'ALREADY_DONE'
  | 'STOCK_EMPTY'
  | 'HANDS_FULL'
  | 'BLOCKED'
  | 'BUSY'
  | 'ABILITY_COOLDOWN'
  | 'ABILITY_USED'
  | 'GAME_OVER'
  | 'NOT_ALLOWED';

export type GameAction =
  | { type: 'interact'; playerId: string; actionId: string }
  | { type: 'ability'; playerId: string; actionId: string }
  | { type: 'pause' }
  | { type: 'resume' };

export type GameEvent =
  | { type: 'jobStarted'; playerId: string; job: JobKind; cell: number }
  | { type: 'dug'; cell: number; revealedConduit: boolean }
  | { type: 'rockBroken'; cell: number }
  | { type: 'shaftBuilt'; cell: number }
  | { type: 'cableLaid'; cell: number; playerId: string }
  | { type: 'pickup'; playerId: string; amount: number }
  | { type: 'houseOnline'; houseId: string; points: number; path: number[] }
  | { type: 'ability'; playerId: string; animal: AnimalId; revealed?: number[] }
  | { type: 'rejected'; playerId: string; reason: RejectReason; message: string; cell?: number }
  | { type: 'roundWon' }
  | { type: 'roundLost' };

export interface MapDef {
  id: string;
  name: string;
  order: string;
  timeLimit: number;
  stationStock: number;
  rows: string[];
}
