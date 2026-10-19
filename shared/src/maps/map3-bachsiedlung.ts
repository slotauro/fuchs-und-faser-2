import type { MapDef } from '../types';

export const map3: MapDef = {
  id: 'bachsiedlung',
  name: 'Die Bachsiedlung',
  order: 'Drei Häuser, ein Bach. Kabel queren den Bach nur über die Brücken.',
  timeLimit: 270,
  stationStock: 55,
  rows: [
    'TTT.....~~.....TTT',
    'T..AA...~~...BB..T',
    '...AA...~~...BB...',
    '...a....==....b...',
    '.....#..~~..hhhh..',
    '.D...#..~~..r.....',
    '........~~..r.....',
    '.P..S...~~..rrrr..',
    '.P......~~.....cCC',
    '........==.....#CC',
    'T.......~~........',
    'TTTT....~~....TT..',
  ],
};
