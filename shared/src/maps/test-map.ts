import type { MapDef } from '../types';

/** Winzige Karte für automatisierte Browsertests. */
export const testMap: MapDef = {
  id: 'test',
  name: 'Testbaustelle',
  order: 'Testkarte',
  timeLimit: 120,
  stationStock: 10,
  rows: [
    '...AA..',
    '...AA..',
    '.D.a...',
    '.P.S...',
    '.......',
  ],
};
