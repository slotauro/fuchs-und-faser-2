import { distributorCells } from './connection';
import { DURATION, neighbors } from './terrain';
import type { Cell, GameState } from './types';

/**
 * Geschätzter Arbeitsaufwand in Sekunden, um auf dieser Kachel Kabel zu verlegen,
 * oder null, wenn hier keine Trasse möglich ist.
 */
export function routeCost(cell: Cell): number | null {
  if (cell.cable) return 0;
  switch (cell.kind) {
    case 'grass':
    case 'gravel':
    case 'roots': {
      const dig = cell.dug ? 0 : cell.kind === 'roots' ? DURATION.digRoots : DURATION.digGrass;
      return dig + DURATION.lay + 1;
    }
    case 'rock':
      return DURATION.breakRock + DURATION.digGravel + DURATION.lay + 1;
    case 'road':
      return (cell.shaft ? 0 : DURATION.shaft) + DURATION.lay + 1;
    case 'conduit':
      return (cell.hidden ? DURATION.digGrass : 0) + DURATION.lay + 0.3;
    case 'socket':
      return DURATION.lay;
    default:
      return null;
  }
}

/**
 * Günstigste Trasse (Dijkstra) vom bestehenden Netz zu einem Hausanschluss.
 * Die Liste beginnt an der ersten neuen Kachel und endet am Anschluss.
 * Andere Hausanschlüsse werden nicht durchquert.
 */
export function cheapestRoute(state: GameState, socket: number): { cells: number[]; cost: number } | null {
  const dist = new Map<number, number>();
  const parent = new Map<number, number>();
  const open: number[] = [];
  const sources = distributorCells(state);
  state.cells.forEach((c, i) => {
    if (c.cable) sources.push(i);
  });
  for (const s of sources) {
    dist.set(s, 0);
    parent.set(s, -1);
    open.push(s);
  }
  while (open.length > 0) {
    open.sort((a, b) => dist.get(a)! - dist.get(b)!);
    const current = open.shift()!;
    if (current === socket) break;
    const cell = state.cells[current]!;
    // Über einen fremden Anschluss geht es nicht weiter.
    if (cell.kind === 'socket' && current !== socket && !cell.cable) continue;
    for (const n of neighbors(state, current)) {
      const ncell = state.cells[n]!;
      if (ncell.kind === 'socket' && n !== socket) continue;
      const cost = routeCost(ncell);
      if (cost === null) continue;
      const next = dist.get(current)! + cost;
      if (next < (dist.get(n) ?? Infinity)) {
        if (!dist.has(n)) open.push(n);
        dist.set(n, next);
        parent.set(n, current);
      }
    }
  }
  if (!parent.has(socket)) return null;
  const cells: number[] = [];
  for (let at = socket; parent.get(at) !== -1; at = parent.get(at)!) cells.push(at);
  return { cells: cells.reverse(), cost: dist.get(socket)! };
}
