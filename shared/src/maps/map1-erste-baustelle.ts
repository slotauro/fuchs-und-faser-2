import type { MapDef } from '../types';

export const map1: MapDef = {
  id: 'erste-baustelle',
  name: 'Die erste Baustelle',
  order: 'Schließe das Haus an. Der Felsriegel lässt sich brechen oder umgehen.',
  timeLimit: 300,
  stationStock: 30,
  rows: [
    'TT..........TT',
    'T.....#..AA..T',
    '..D...#..AA...',
    '......#..a....',
    '.P....##......',
    '..S...........',
    '.P.......#....',
    'T..........TTT',
    'TTT.....TTTTTT',
  ],
};
