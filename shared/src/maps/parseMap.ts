import type { Cell, House, MapDef, TileKind } from '../types';

const SYMBOLS: Record<string, TileKind> = {
  '.': 'grass',
  P: 'grass',
  r: 'roots',
  '#': 'rock',
  '=': 'road',
  '~': 'water',
  o: 'conduit',
  h: 'conduit',
  D: 'distributor',
  S: 'station',
  T: 'tree',
};

export interface ParsedMap {
  width: number;
  height: number;
  cells: Cell[];
  houses: House[];
  spawns: { x: number; z: number }[];
}

/**
 * Liest eine ASCII-Karte. Großbuchstaben A–C sind Hausflächen, der passende
 * Kleinbuchstabe ist der Anschlusspunkt davor. Siehe Legende in SYMBOLS.
 */
export function parseMap(map: MapDef): ParsedMap {
  const height = map.rows.length;
  const width = map.rows[0]?.length ?? 0;
  const cells: Cell[] = [];
  const houses = new Map<string, House>();
  const spawns: { x: number; z: number }[] = [];
  const house = (id: string): House => {
    let h = houses.get(id);
    if (!h) {
      h = { id, cells: [], socket: -1, online: false };
      houses.set(id, h);
    }
    return h;
  };

  map.rows.forEach((row, z) => {
    if (row.length !== width) throw new Error(`Karte ${map.id}: Zeile ${z} hat ${row.length} statt ${width} Zeichen`);
    [...row].forEach((ch, x) => {
      const index = z * width + x;
      const base: Cell = { kind: 'grass', dug: false, shaft: false, cable: false, hidden: false };
      if (ch >= 'A' && ch <= 'C') {
        house(ch).cells.push(index);
        cells.push({ ...base, kind: 'house', houseId: ch });
      } else if (ch >= 'a' && ch <= 'c') {
        const id = ch.toUpperCase();
        house(id).socket = index;
        cells.push({ ...base, kind: 'socket', houseId: id });
      } else {
        const kind = SYMBOLS[ch];
        if (!kind) throw new Error(`Karte ${map.id}: unbekanntes Zeichen "${ch}"`);
        if (ch === 'P') spawns.push({ x, z });
        cells.push({ ...base, kind, hidden: ch === 'h' });
      }
    });
  });

  for (const h of houses.values()) {
    if (h.socket < 0 || h.cells.length === 0) throw new Error(`Karte ${map.id}: Haus ${h.id} unvollständig`);
  }
  if (spawns.length === 0) throw new Error(`Karte ${map.id}: kein Startpunkt`);
  return { width, height, cells, houses: [...houses.values()].sort((a, b) => a.id.localeCompare(b.id)), spawns };
}
