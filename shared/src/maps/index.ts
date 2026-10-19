import type { MapDef } from '../types';
import { map1 } from './map1-erste-baustelle';
import { map2 } from './map2-wurzelweg';
import { map3 } from './map3-bachsiedlung';
import { testMap } from './test-map';

/** Spielbare Karten in Menüreihenfolge. */
export const MAPS: readonly MapDef[] = [map1, map2, map3];

const ALL: readonly MapDef[] = [...MAPS, testMap];

export function isMapId(id: string): boolean {
  return ALL.some((m) => m.id === id);
}

export function getMap(id: string): MapDef {
  const map = ALL.find((m) => m.id === id);
  if (!map) throw new Error(`Unbekannte Karte: ${id}`);
  return map;
}
