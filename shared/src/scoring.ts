import type { GameState, RoundResult } from './types';

export const POINTS_PER_HOUSE = 100;
export const TIME_BONUS_PER_SECOND = 2;
export const CABLE_BONUS_PER_UNIT = 5;

/** Endwertung. Zeit- und Kabelbonus gibt es nur bei Erfolg. */
export function scoreRound(state: GameState, won: boolean): RoundResult {
  const housesOnline = state.houses.filter((h) => h.online).length;
  const housePoints = housesOnline * POINTS_PER_HOUSE;
  const remaining = Math.max(0, state.timeLimit - state.time);
  const spareCable = state.stationStock + state.players.reduce((sum, p) => sum + p.carrying, 0);
  const timeBonus = won ? Math.round(remaining * TIME_BONUS_PER_SECOND) : 0;
  const cableBonus = won ? spareCable * CABLE_BONUS_PER_UNIT : 0;
  return {
    won,
    housesOnline,
    housesTotal: state.houses.length,
    housePoints,
    timeBonus,
    cableBonus,
    score: housePoints + timeBonus + cableBonus,
  };
}
