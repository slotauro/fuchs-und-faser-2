import { cheapestRoute } from './routing';
import { cellCoords } from './terrain';
import type { AnimalId, GameState, PlayerState } from './types';

export interface AnimalInfo {
  id: AnimalId;
  name: string;
  role: string;
  ability: string;
  description: string;
  /** Abklingzeit in Sekunden; null = einmal pro Auftrag. */
  cooldown: number | null;
}

export const ANIMALS: Record<AnimalId, AnimalInfo> = {
  fox: {
    id: 'fox',
    name: 'Fuchs',
    role: 'Der clevere Planer',
    ability: 'Spürnase',
    description: 'Deckt verborgene Leerrohre in der Nähe auf und zeigt eine günstige Trasse.',
    cooldown: null,
  },
  mole: {
    id: 'mole',
    name: 'Maulwurf',
    role: 'Der Tunnelprofi',
    ability: 'Schnellbuddeln',
    description: 'Gräbt 6 Sekunden lang fast dreimal so schnell.',
    cooldown: 25,
  },
  beaver: {
    id: 'beaver',
    name: 'Biber',
    role: 'Der Baumeister',
    ability: 'Express-Schacht',
    description: 'Der nächste Kabelschacht unter der Straße steht in einer halben Sekunde.',
    cooldown: 25,
  },
  badger: {
    id: 'badger',
    name: 'Dachs',
    role: 'Der Kraftprotz',
    ability: 'Felsenknacker',
    description: 'Der nächste Felsen ist im Handumdrehen gebrochen.',
    cooldown: 25,
  },
};

export const ANIMAL_IDS = Object.keys(ANIMALS) as AnimalId[];

export const SCOUT_RADIUS = 4;
export const SCOUT_HINT_SECONDS = 10;
export const MOLE_BOOST_SECONDS = 6;
export const MOLE_DIG_FACTOR = 0.35;
export const BEAVER_SHAFT_SECONDS = 0.5;
export const BADGER_BREAK_SECONDS = 0.6;

export function newAbilityState() {
  return { readyAt: 0, activeUntil: 0, armed: false, used: false };
}

/** Kann die Fähigkeit jetzt eingesetzt werden? Liefert sonst den Grund. */
export function abilityBlocker(state: GameState, player: PlayerState): 'ABILITY_USED' | 'ABILITY_COOLDOWN' | null {
  const a = player.ability;
  if (player.animal === 'fox') return a.used ? 'ABILITY_USED' : null;
  if (a.armed || state.time < a.readyAt || state.time < a.activeUntil) return 'ABILITY_COOLDOWN';
  return null;
}

/** Setzt die Fähigkeit ein. Liefert beim Fuchs die aufgedeckten Leerrohre. */
export function useAbility(state: GameState, player: PlayerState): { revealed: number[] } {
  const a = player.ability;
  const info = ANIMALS[player.animal];
  if (info.cooldown !== null) a.readyAt = state.time + info.cooldown;
  switch (player.animal) {
    case 'fox': {
      a.used = true;
      const revealed: number[] = [];
      state.cells.forEach((cell, i) => {
        if (cell.kind !== 'conduit' || !cell.hidden) return;
        const { cx, cz } = cellCoords(state, i);
        if (Math.hypot(cx - player.x, cz - player.z) <= SCOUT_RADIUS) {
          cell.hidden = false;
          revealed.push(i);
        }
      });
      if (revealed.length > 0) state.cellsVersion++;
      // Günstigste Trasse zum nächsten noch nicht versorgten Haus als Spur.
      let best: number[] | null = null;
      let bestCost = Infinity;
      for (const house of state.houses) {
        if (house.online) continue;
        const route = cheapestRoute(state, house.socket);
        if (route && route.cost < bestCost) {
          best = route.cells;
          bestCost = route.cost;
        }
      }
      state.hint = best ? { cells: best, until: state.time + SCOUT_HINT_SECONDS } : null;
      return { revealed };
    }
    case 'mole':
      a.activeUntil = state.time + MOLE_BOOST_SECONDS;
      return { revealed: [] };
    case 'beaver':
    case 'badger':
      a.armed = true;
      return { revealed: [] };
  }
}

/** Dauer einer Arbeit unter Berücksichtigung der Fähigkeit. Verbraucht eine scharfe Fähigkeit. */
export function jobDuration(
  state: GameState,
  player: PlayerState,
  kind: 'dig' | 'break' | 'shaft',
  base: number,
): number {
  const a = player.ability;
  if (kind === 'dig' && player.animal === 'mole' && state.time < a.activeUntil) return base * MOLE_DIG_FACTOR;
  if (kind === 'shaft' && player.animal === 'beaver' && a.armed) {
    a.armed = false;
    return BEAVER_SHAFT_SECONDS;
  }
  if (kind === 'break' && player.animal === 'badger' && a.armed) {
    a.armed = false;
    return BADGER_BREAK_SECONDS;
  }
  return base;
}
