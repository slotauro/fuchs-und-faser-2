import { describe, expect, it } from 'vitest';
import {
  BADGER_BREAK_SECONDS,
  BEAVER_SHAFT_SECONDS,
  CARRY_CAPACITY,
  DURATION,
  MAPS,
  MOLE_DIG_FACTOR,
  POINTS_PER_HOUSE,
  TICK,
  applyAction,
  cellIndex,
  connectionPath,
  createGame,
  step,
  type AnimalId,
  type GameEvent,
  type GameState,
  type MapDef,
} from '../src';
import { Bot } from './bot';

const map = (rows: string[], extra: Partial<MapDef> = {}): MapDef => ({
  id: 'unit',
  name: 'Unit',
  order: '',
  timeLimit: 120,
  stationStock: 10,
  rows,
  ...extra,
});

/** D = Verteiler, P = Start, S = Kabeltrommel, A/a = Haus und Anschluss. */
const LINE = map(['..AA.', '..AA.', 'D.a..', 'P.S..']);

function game(rows: MapDef | string[], animal: AnimalId = 'fox'): GameState {
  return createGame(Array.isArray(rows) ? map(rows) : rows, [{ id: 'p1', name: 'Test', animal }]);
}

let counter = 0;
const interact = (state: GameState) =>
  applyAction(state, { type: 'interact', playerId: 'p1', actionId: `a${counter++}` });

function run(state: GameState, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += TICK) events.push(...step(state, {}, TICK));
  return events;
}

function place(state: GameState, cx: number, cz: number, facing: { x: number; z: number }) {
  const p = state.players[0]!;
  p.x = cx;
  p.z = cz;
  p.facing = facing;
  return p;
}

describe('Bewegung', () => {
  it('läuft und bleibt an Felsen und am Kartenrand stehen', () => {
    const state = game(['P.#', '...']);
    const p = state.players[0]!;
    for (let i = 0; i < 40; i++) step(state, { p1: { x: 1, z: 0 } }, TICK);
    expect(p.x).toBeGreaterThan(0.9);
    expect(p.x).toBeLessThan(1.5 - 0.3 + 0.01);
    for (let i = 0; i < 40; i++) step(state, { p1: { x: 0, z: -1 } }, TICK);
    expect(p.z).toBeCloseTo(-0.5 + 0.3, 2);
  });

  it('rutscht an Ecken zur Spurmitte, statt hängen zu bleiben', () => {
    // Freie Spur nach oben bei x = 1, rechts daneben Felsen; die Figur steht leicht nach rechts versetzt.
    const state = game(['..#', '..#', '.P.']);
    const p = state.players[0]!;
    p.x = 1.25;
    for (let i = 0; i < 30; i++) step(state, { p1: { x: 0, z: -1 } }, TICK);
    expect(p.z).toBeLessThan(1);
    expect(p.x).toBeLessThanOrEqual(1.2 + 1e-9);
  });

  it('ist mit Kabel langsamer', () => {
    const a = game(['P.......']);
    const b = game(['P.......']);
    b.players[0]!.carrying = 3;
    for (let i = 0; i < 20; i++) {
      step(a, { p1: { x: 1, z: 0 } }, TICK);
      step(b, { p1: { x: 1, z: 0 } }, TICK);
    }
    expect(b.players[0]!.x).toBeLessThan(a.players[0]!.x);
  });
});

describe('Graben und Kabel', () => {
  it('gräbt eine Wiese in der vorgesehenen Zeit', () => {
    const state = game(LINE);
    place(state, 1, 3, { x: 0, z: -1 });
    const result = interact(state);
    expect(result.ok && result.events[0]?.type).toBe('jobStarted');
    run(state, DURATION.digGrass - 0.1);
    expect(state.cells[cellIndex(state, 1, 2)]!.dug).toBe(false);
    run(state, 0.15);
    expect(state.cells[cellIndex(state, 1, 2)]!.dug).toBe(true);
  });

  it('nimmt höchstens die Tragkapazität und nie mehr als den Bestand', () => {
    const state = game(map(['D.S', 'P..'], { stationStock: 8 }));
    place(state, 2, 1, { x: 0, z: -1 });
    interact(state);
    expect(state.players[0]!.carrying).toBe(CARRY_CAPACITY);
    expect(state.stationStock).toBe(8 - CARRY_CAPACITY);
    state.players[0]!.carrying = 0;
    interact(state);
    expect(state.players[0]!.carrying).toBe(2);
    state.players[0]!.carrying = 0;
    const res = interact(state);
    expect(res.ok && res.events[0]).toMatchObject({ type: 'rejected', reason: 'STOCK_EMPTY' });
  });

  it('verlegt nur mit Kabel, angeschlossen und ohne doppelten Verbrauch', () => {
    const state = game(LINE);
    const target = cellIndex(state, 1, 2);
    state.cells[target]!.dug = true;
    const p = place(state, 1, 3, { x: 0, z: -1 });

    let res = interact(state);
    expect(res.ok && res.events[0]).toMatchObject({ type: 'rejected', reason: 'NO_CABLE' });

    p.carrying = 2;
    // Nicht angeschlossen: Graben weiter rechts ohne Verbindung zum Netz.
    const far = cellIndex(state, 4, 3);
    state.cells[far]!.dug = true;
    place(state, 3, 3, { x: 1, z: 0 });
    res = interact(state);
    expect(res.ok && res.events[0]).toMatchObject({ type: 'rejected', reason: 'NOT_CONNECTED' });

    place(state, 1, 3, { x: 0, z: -1 });
    const actionId = 'same-id';
    applyAction(state, { type: 'interact', playerId: 'p1', actionId });
    const dup = applyAction(state, { type: 'interact', playerId: 'p1', actionId });
    expect(dup).toMatchObject({ ok: true, duplicate: true });
    run(state, 1);
    expect(state.cells[target]!.cable).toBe(true);
    expect(p.carrying).toBe(1);

    // Vorne liegt schon Kabel: Die Figur gräbt stattdessen auf der eigenen Kachel.
    res = interact(state);
    expect(res.ok && res.events[0]).toMatchObject({ type: 'jobStarted', job: 'dig', cell: cellIndex(state, 1, 3) });
    run(state, 1.1);
    expect(p.carrying).toBe(1);
  });

  it('Straßen brauchen einen Schacht, Leerrohre keinen Graben', () => {
    const state = game(['D=o', 'P..']);
    const road = cellIndex(state, 1, 0);
    const conduit = cellIndex(state, 2, 0);
    const p = place(state, 1, 1, { x: 0, z: -1 });
    p.carrying = 2;
    interact(state);
    expect(p.job?.kind).toBe('shaft');
    run(state, DURATION.shaft + 0.1);
    expect(state.cells[road]!.shaft).toBe(true);
    interact(state);
    run(state, 1);
    expect(state.cells[road]!.cable).toBe(true);
    place(state, 2, 1, { x: 0, z: -1 });
    interact(state);
    expect(p.job?.kind).toBe('lay');
    run(state, 1);
    expect(state.cells[conduit]!.cable).toBe(true);
  });

  it('Graben über einem verborgenen Leerrohr deckt es auf', () => {
    const state = game(['Dh', 'P.']);
    const cell = state.cells[cellIndex(state, 1, 0)]!;
    place(state, 1, 1, { x: 0, z: -1 });
    interact(state);
    const events = run(state, 1.1);
    expect(events).toContainEqual({ type: 'dug', cell: 1, revealedConduit: true });
    expect(cell.hidden).toBe(false);
    expect(cell.dug).toBe(false);
  });

  it('Felsen werden zu Schotter gebrochen und sind dann begehbar', () => {
    const state = game(['D#', 'P.']);
    place(state, 1, 1, { x: 0, z: -1 });
    interact(state);
    run(state, DURATION.breakRock + 0.1);
    expect(state.cells[1]!.kind).toBe('gravel');
  });

  it('verlegt zuerst im eigenen Graben, wenn die Figur Kabel trägt', () => {
    const state = game(LINE);
    const own = cellIndex(state, 1, 2);
    state.cells[own]!.dug = true;
    const p = place(state, 1, 2, { x: 0, z: -1 });
    p.carrying = 1;
    const res = interact(state);
    expect(res.ok && res.events[0]).toMatchObject({ type: 'jobStarted', job: 'lay', cell: own });
  });
});

describe('Hausanschluss', () => {
  function cabledToSocket(): GameState {
    const state = game(LINE);
    for (const [x, z] of [
      [1, 2],
      [2, 2],
    ] as const) {
      const c = state.cells[cellIndex(state, x, z)]!;
      c.dug = true;
      c.cable = true;
    }
    return state;
  }

  it('lässt sich ohne durchgehenden Weg nicht anschließen', () => {
    const state = game(LINE);
    place(state, 3, 2, { x: -1, z: 0 });
    state.players[0]!.carrying = 1;
    // Anschlusspunkt hat noch kein Nachbarkabel.
    const res = interact(state);
    expect(res.ok && res.events[0]).toMatchObject({ type: 'rejected', reason: 'NOT_CONNECTED' });
  });

  it('vergibt die Punkte genau einmal', () => {
    const state = cabledToSocket();
    const socket = cellIndex(state, 2, 2);
    expect(connectionPath(state, socket)).toEqual([cellIndex(state, 1, 2), socket]);
    place(state, 3, 2, { x: -1, z: 0 });
    interact(state);
    const events = run(state, 1);
    expect(events.filter((e) => e.type === 'houseOnline')).toHaveLength(1);
    expect(state.houses[0]!.online).toBe(true);
    expect(state.status).toBe('won');
    expect(state.result?.housePoints).toBe(POINTS_PER_HOUSE);
    expect(state.result!.score).toBeGreaterThan(POINTS_PER_HOUSE);

    const again = interact(state);
    expect(again).toEqual({ ok: false, reason: 'GAME_OVER' });
    expect(state.result?.housePoints).toBe(POINTS_PER_HOUSE);
  });

  it('ein unterbrochener Weg zählt nicht', () => {
    const state = cabledToSocket();
    state.cells[cellIndex(state, 1, 2)]!.cable = false;
    expect(connectionPath(state, cellIndex(state, 2, 2))).toBeNull();
  });
});

describe('Runde', () => {
  it('endet bei Zeitablauf als verloren ohne Bonus', () => {
    const state = game(map(['D.a', 'P.A'], { timeLimit: 2 }));
    const events = run(state, 2.1);
    expect(events).toContainEqual({ type: 'roundLost' });
    expect(state.result).toMatchObject({ won: false, score: 0, timeBonus: 0 });
  });

  it('Pause hält die Zeit an, nur im Singleplayer', () => {
    const state = game(LINE);
    applyAction(state, { type: 'pause' });
    run(state, 1);
    expect(state.time).toBe(0);
    applyAction(state, { type: 'resume' });
    run(state, 1);
    expect(state.time).toBeCloseTo(1);
    const coop = createGame(LINE, [{ id: 'p1', name: 'A', animal: 'fox' }], 'coop');
    expect(applyAction(coop, { type: 'pause' })).toEqual({ ok: false, reason: 'NOT_ALLOWED' });
  });
});

describe('Fähigkeiten', () => {
  const ability = (state: GameState) =>
    applyAction(state, { type: 'ability', playerId: 'p1', actionId: `f${counter++}` });

  it('Maulwurf gräbt schneller und hat eine Abklingzeit', () => {
    const state = game(LINE, 'mole');
    ability(state);
    place(state, 1, 3, { x: 0, z: -1 });
    interact(state);
    expect(state.players[0]!.job?.duration).toBeCloseTo(DURATION.digGrass * MOLE_DIG_FACTOR);
    const again = ability(state);
    expect(again.ok && again.events[0]).toMatchObject({ type: 'rejected', reason: 'ABILITY_COOLDOWN' });
  });

  it('Biber baut den nächsten Schacht schnell, nur einmal', () => {
    const state = game(['D==', 'P..'], 'beaver');
    ability(state);
    place(state, 1, 1, { x: 0, z: -1 });
    interact(state);
    expect(state.players[0]!.job?.duration).toBe(BEAVER_SHAFT_SECONDS);
    run(state, 1);
    place(state, 2, 1, { x: 0, z: -1 });
    interact(state);
    expect(state.players[0]!.job?.duration).toBe(DURATION.shaft);
  });

  it('Dachs bricht den nächsten Felsen schnell', () => {
    const state = game(['D#', 'P.'], 'badger');
    ability(state);
    place(state, 1, 1, { x: 0, z: -1 });
    interact(state);
    expect(state.players[0]!.job?.duration).toBe(BADGER_BREAK_SECONDS);
  });

  it('Fuchs deckt Leerrohre in der Nähe auf, einmal pro Auftrag', () => {
    const state = game(['D.hhhhhhh', 'P..A.....', '...a.....']);
    const res = ability(state);
    expect(res.ok && res.events[0]).toMatchObject({ type: 'ability', animal: 'fox' });
    const revealed = state.cells.filter((c) => c.kind === 'conduit' && !c.hidden).length;
    expect(revealed).toBeGreaterThan(0);
    expect(revealed).toBeLessThan(7);
    expect(state.hint?.cells.at(-1)).toBe(cellIndex(state, 3, 2));
    const again = ability(state);
    expect(again.ok && again.events[0]).toMatchObject({ type: 'rejected', reason: 'ABILITY_USED' });
  });
});

describe('Karten', () => {
  for (const def of MAPS) {
    it(`${def.name} ist allein und ohne Fähigkeiten in der Zeit lösbar`, () => {
      const state = createGame(def.id, [{ id: 'bot', name: 'Bot', animal: 'fox' }]);
      new Bot(state, 'bot').solve();
      expect(state.status).toBe('won');
      // Etwas Puffer für menschliche Spieler.
      expect(state.time).toBeLessThan(state.timeLimit * 0.75);
    });
  }

  it('Startpunkte reichen für vier Spieler', () => {
    for (const def of MAPS) {
      const state = createGame(
        def.id,
        (['fox', 'mole', 'beaver', 'badger'] as const).map((animal, i) => ({ id: `p${i}`, name: animal, animal })),
        'coop',
      );
      const spots = new Set(state.players.map((p) => `${p.x},${p.z}`));
      expect(spots.size).toBe(4);
    }
  });
});
