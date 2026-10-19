import { neighbors } from './terrain';
import type { GameState } from './types';

/** Kacheln des Netzverteilers. */
export function distributorCells(state: GameState): number[] {
  const result: number[] = [];
  state.cells.forEach((c, i) => {
    if (c.kind === 'distributor') result.push(i);
  });
  return result;
}

/** Grenzt die Kachel an den Verteiler oder an verlegtes Kabel? */
export function touchesNetwork(state: GameState, index: number): boolean {
  return neighbors(state, index).some((n) => {
    const c = state.cells[n];
    return c !== undefined && (c.kind === 'distributor' || c.cable);
  });
}

/**
 * Breitensuche vom Verteiler über verkabelte Kacheln.
 * Liefert für jede erreichte Kabelkachel ihren Vorgänger, um Wege zurückzuverfolgen.
 */
export function traceNetwork(state: GameState): Map<number, number> {
  const parent = new Map<number, number>();
  const queue: number[] = [];
  for (const d of distributorCells(state)) {
    parent.set(d, -1);
    queue.push(d);
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of neighbors(state, current)) {
      if (parent.has(n) || !state.cells[n]?.cable) continue;
      parent.set(n, current);
      queue.push(n);
    }
  }
  return parent;
}

/** Durchgehender Weg vom Verteiler zum Hausanschluss, oder null. */
export function connectionPath(state: GameState, socket: number): number[] | null {
  const parent = traceNetwork(state);
  if (!state.cells[socket]?.cable || !parent.has(socket)) return null;
  const path: number[] = [];
  for (let at = socket; at !== -1; at = parent.get(at)!) {
    if (state.cells[at]?.kind !== 'distributor') path.push(at);
  }
  return path.reverse();
}
