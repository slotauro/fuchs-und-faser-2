import type { Cell, GameState, TileKind } from './types';

export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 3.2;
export const CARRY_SPEED_FACTOR = 0.85;
export const CARRY_CAPACITY = 6;

/** Dauer der Arbeiten in Sekunden. */
export const DURATION = {
  digGrass: 0.5,
  digRoots: 1.25,
  digGravel: 0.4,
  breakRock: 3.0,
  shaft: 3.0,
  lay: 0.35,
  connect: 0.8,
} as const;

const WALKABLE: ReadonlySet<TileKind> = new Set(['grass', 'roots', 'gravel', 'road', 'conduit', 'socket']);

export const cellIndex = (state: { width: number }, cx: number, cz: number): number => cz * state.width + cx;

export const cellCoords = (state: { width: number }, index: number): { cx: number; cz: number } => ({
  cx: index % state.width,
  cz: Math.floor(index / state.width),
});

export function inBounds(state: { width: number; height: number }, cx: number, cz: number): boolean {
  return cx >= 0 && cz >= 0 && cx < state.width && cz < state.height;
}

export function cellAt(state: GameState, cx: number, cz: number): Cell | undefined {
  return inBounds(state, cx, cz) ? state.cells[cellIndex(state, cx, cz)] : undefined;
}

export function isWalkable(cell: Cell | undefined): boolean {
  return cell !== undefined && WALKABLE.has(cell.kind);
}

/** Orthogonale Nachbarn einer Kachel. */
export function neighbors(state: { width: number; height: number }, index: number): number[] {
  const cx = index % state.width;
  const cz = Math.floor(index / state.width);
  const result: number[] = [];
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    if (inBounds(state, cx + dx, cz + dz)) result.push((cz + dz) * state.width + cx + dx);
  }
  return result;
}

/** Grabdauer ohne Fähigkeit, oder null, wenn hier nicht gegraben werden kann. */
export function baseDigDuration(cell: Cell): number | null {
  if (cell.dug) return null;
  switch (cell.kind) {
    case 'grass':
      return DURATION.digGrass;
    case 'roots':
      return DURATION.digRoots;
    case 'gravel':
      return DURATION.digGravel;
    case 'conduit':
      // Graben über einem verborgenen Leerrohr legt es frei.
      return cell.hidden ? DURATION.digGrass : null;
    default:
      return null;
  }
}

/** Darf hier (abgesehen von Netzanschluss und Kabelbestand) Kabel liegen? */
export function acceptsCable(cell: Cell): boolean {
  if (cell.cable) return false;
  switch (cell.kind) {
    case 'grass':
    case 'roots':
    case 'gravel':
      return cell.dug;
    case 'road':
      return cell.shaft;
    case 'conduit':
      return !cell.hidden;
    case 'socket':
      return true;
    default:
      return false;
  }
}
