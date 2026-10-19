import { abilityBlocker, jobDuration, newAbilityState, useAbility } from './abilities';
import { connectionPath, touchesNetwork } from './connection';
import { getMap } from './maps';
import { parseMap } from './maps/parseMap';
import { frontCell, movePlayer, playerCell } from './movement';
import { scoreRound, POINTS_PER_HOUSE } from './scoring';
import { CARRY_CAPACITY, DURATION, acceptsCable, baseDigDuration, isWalkable, neighbors } from './terrain';
import type {
  AnimalId,
  GameAction,
  GameEvent,
  GameState,
  Job,
  JobKind,
  MapDef,
  PlayerInput,
  PlayerState,
  RejectReason,
} from './types';

/** Feste Simulationsschrittweite des Servers in Sekunden (20 Hz). */
export const TICK = 1 / 20;
const MAX_ACTION_IDS = 256;

export interface PlayerSetup {
  id: string;
  name: string;
  animal: AnimalId;
}

export function createGame(
  mapOrId: string | MapDef,
  setups: PlayerSetup[],
  mode: 'solo' | 'coop' = 'solo',
): GameState {
  const map = typeof mapOrId === 'string' ? getMap(mapOrId) : mapOrId;
  const parsed = parseMap(map);
  const state: GameState = {
    mapId: map.id,
    mode,
    width: parsed.width,
    height: parsed.height,
    cells: parsed.cells,
    houses: parsed.houses,
    stationStock: map.stationStock,
    players: [],
    time: 0,
    timeLimit: map.timeLimit,
    status: 'playing',
    paused: false,
    score: 0,
    result: null,
    hint: null,
    cellsVersion: 0,
    appliedActionIds: [],
  };
  const spawns = spawnPoints(state, parsed.spawns, setups.length);
  state.players = setups.map((s, i) => ({
    id: s.id,
    name: s.name,
    animal: s.animal,
    x: spawns[i]!.x,
    z: spawns[i]!.z,
    facing: { x: 1, z: 0 },
    moving: false,
    carrying: 0,
    job: null,
    ability: newAbilityState(),
  }));
  return state;
}

/** Startpunkte aus der Karte, bei Bedarf ergänzt um begehbare Nachbarkacheln. */
function spawnPoints(state: GameState, fromMap: { x: number; z: number }[], count: number) {
  const result = [...fromMap];
  const seen = new Set(fromMap.map((p) => p.z * state.width + p.x));
  const queue = [...seen];
  while (result.length < count && queue.length > 0) {
    for (const n of neighbors(state, queue.shift()!)) {
      if (seen.has(n) || !isWalkable(state.cells[n])) continue;
      seen.add(n);
      queue.push(n);
      result.push({ x: n % state.width, z: Math.floor(n / state.width) });
    }
  }
  return result;
}

export function findPlayer(state: GameState, id: string): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

const MESSAGES: Record<RejectReason, string> = {
  NOTHING_HERE: 'Hier gibt es nichts zu tun.',
  NO_CABLE: 'Du trägst kein Kabel. Hol welches an der Kabeltrommel.',
  NOT_CONNECTED: 'Kabel muss an den Verteiler oder an bestehendes Kabel anschließen.',
  ALREADY_DONE: 'Hier ist schon alles erledigt.',
  STOCK_EMPTY: 'Die Kabeltrommel ist leer.',
  HANDS_FULL: 'Du kannst nicht mehr Kabel tragen.',
  BLOCKED: 'Hier kann kein Kabel verlegt werden.',
  BUSY: 'Du bist gerade beschäftigt.',
  ABILITY_COOLDOWN: 'Die Fähigkeit lädt noch.',
  ABILITY_USED: 'Die Fähigkeit ist für diesen Auftrag verbraucht.',
  GAME_OVER: 'Die Runde ist vorbei.',
  NOT_ALLOWED: 'Das geht im Koop nicht.',
};

export function rejectMessage(reason: RejectReason): string {
  return MESSAGES[reason];
}

type Plan =
  | { ok: true; kind: 'pickup' }
  | { ok: true; kind: JobKind; duration: number }
  | { ok: false; reason: RejectReason };

/** Welche Aktion wäre auf dieser Kachel für diesen Spieler möglich? */
function planAt(state: GameState, player: PlayerState, index: number): Plan {
  const cell = state.cells[index];
  if (!cell) return { ok: false, reason: 'NOTHING_HERE' };

  const lay = (): Plan => {
    if (player.carrying <= 0) return { ok: false, reason: 'NO_CABLE' };
    if (!touchesNetwork(state, index)) return { ok: false, reason: 'NOT_CONNECTED' };
    return { ok: true, kind: 'lay', duration: DURATION.lay };
  };
  const connect = (houseId: string | undefined): Plan => {
    const house = state.houses.find((h) => h.id === houseId);
    if (!house) return { ok: false, reason: 'NOTHING_HERE' };
    if (house.online) return { ok: false, reason: 'ALREADY_DONE' };
    if (!connectionPath(state, house.socket)) return { ok: false, reason: 'NOT_CONNECTED' };
    return { ok: true, kind: 'connect', duration: DURATION.connect };
  };

  switch (cell.kind) {
    case 'station':
      if (state.stationStock <= 0) return { ok: false, reason: 'STOCK_EMPTY' };
      if (player.carrying >= CARRY_CAPACITY) return { ok: false, reason: 'HANDS_FULL' };
      return { ok: true, kind: 'pickup' };
    case 'house': {
      const house = state.houses.find((h) => h.id === cell.houseId);
      // Am Haus selbst: anschließen, sonst auf den Anschlusspunkt hinweisen.
      if (house && !state.cells[house.socket]!.cable) return { ok: false, reason: 'NOT_CONNECTED' };
      return connect(cell.houseId);
    }
    case 'socket':
      return cell.cable ? connect(cell.houseId) : lay();
    case 'rock':
      return { ok: true, kind: 'break', duration: jobDurationPreview(state, player, 'break', DURATION.breakRock) };
    case 'road':
      if (!cell.shaft) return { ok: true, kind: 'shaft', duration: jobDurationPreview(state, player, 'shaft', DURATION.shaft) };
      return cell.cable ? { ok: false, reason: 'ALREADY_DONE' } : lay();
    case 'grass':
    case 'roots':
    case 'gravel':
    case 'conduit': {
      const dig = baseDigDuration(cell);
      if (dig !== null) return { ok: true, kind: 'dig', duration: jobDurationPreview(state, player, 'dig', dig) };
      if (cell.cable) return { ok: false, reason: 'ALREADY_DONE' };
      return acceptsCable(cell) ? lay() : { ok: false, reason: 'BLOCKED' };
    }
    default:
      return { ok: false, reason: 'NOTHING_HERE' };
  }
}

/** Dauer ohne die scharfe Fähigkeit zu verbrauchen (das passiert erst beim Start). */
function jobDurationPreview(state: GameState, player: PlayerState, kind: 'dig' | 'break' | 'shaft', base: number) {
  const copy = { ...player, ability: { ...player.ability } };
  return jobDuration(state, copy, kind, base);
}

/**
 * Bestimmt die Aktion. Steht die Figur mit Kabel in einem fertigen Graben, wird zuerst dort
 * verlegt. Sonst gilt die Kachel vor der Figur; nur wenn dort gar nichts zu tun ist, die
 * Kachel unter der Figur, damit man auch auf der Stelle graben kann.
 */
export function previewInteraction(state: GameState, player: PlayerState): { cell: number; plan: Plan } | null {
  const front = frontCell(state, player);
  const own = playerCell(state, player);
  const ownPlan = planAt(state, player, own);
  if (ownPlan.ok && ownPlan.kind === 'lay') return { cell: own, plan: ownPlan };
  const frontResult = front === null ? null : { cell: front, plan: planAt(state, player, front) };
  if (frontResult && (frontResult.plan.ok || !FALLBACK_REASONS.has(frontResult.plan.reason))) return frontResult;
  const ownResult = { cell: own, plan: ownPlan };
  return ownResult.plan.ok || !frontResult ? ownResult : frontResult;
}

const FALLBACK_REASONS: ReadonlySet<RejectReason> = new Set(['NOTHING_HERE', 'ALREADY_DONE']);

function startInteraction(state: GameState, player: PlayerState, events: GameEvent[]): void {
  const target = previewInteraction(state, player);
  if (!target || !target.plan.ok) {
    const reason = target && !target.plan.ok ? target.plan.reason : 'NOTHING_HERE';
    events.push({ type: 'rejected', playerId: player.id, reason, message: MESSAGES[reason], cell: target?.cell });
    return;
  }
  const { cell, plan } = target;
  if (plan.kind === 'pickup') {
    const amount = Math.min(CARRY_CAPACITY - player.carrying, state.stationStock);
    player.carrying += amount;
    state.stationStock -= amount;
    events.push({ type: 'pickup', playerId: player.id, amount });
    return;
  }
  let duration = plan.duration;
  if (plan.kind === 'dig' || plan.kind === 'break' || plan.kind === 'shaft') {
    const c = state.cells[cell]!;
    const base =
      plan.kind === 'dig' ? baseDigDuration(c)! : plan.kind === 'break' ? DURATION.breakRock : DURATION.shaft;
    duration = jobDuration(state, player, plan.kind, base);
  }
  player.job = { kind: plan.kind, cell, elapsed: 0, duration };
  player.moving = false;
  events.push({ type: 'jobStarted', playerId: player.id, job: plan.kind, cell });
}

/** Schließt eine Arbeit ab. Prüft erneut, weil Mitspieler den Zustand inzwischen verändert haben können. */
function finishJob(state: GameState, player: PlayerState, job: Job, events: GameEvent[]): void {
  player.job = null;
  const cell = state.cells[job.cell]!;
  const plan = planAt(state, player, job.cell);
  if (!plan.ok || plan.kind !== job.kind) {
    const reason = plan.ok ? 'ALREADY_DONE' : plan.reason;
    events.push({ type: 'rejected', playerId: player.id, reason, message: MESSAGES[reason], cell: job.cell });
    return;
  }
  switch (job.kind) {
    case 'dig': {
      const revealedConduit = cell.kind === 'conduit' && cell.hidden;
      if (revealedConduit) cell.hidden = false;
      else cell.dug = true;
      events.push({ type: 'dug', cell: job.cell, revealedConduit });
      break;
    }
    case 'break':
      cell.kind = 'gravel';
      events.push({ type: 'rockBroken', cell: job.cell });
      break;
    case 'shaft':
      cell.shaft = true;
      events.push({ type: 'shaftBuilt', cell: job.cell });
      break;
    case 'lay':
      cell.cable = true;
      player.carrying -= 1;
      events.push({ type: 'cableLaid', cell: job.cell, playerId: player.id });
      break;
    case 'connect': {
      const house = state.houses.find((h) => h.id === cell.houseId)!;
      house.online = true;
      state.score += POINTS_PER_HOUSE;
      events.push({
        type: 'houseOnline',
        houseId: house.id,
        points: POINTS_PER_HOUSE,
        path: connectionPath(state, house.socket) ?? [],
      });
      if (state.houses.every((h) => h.online)) endRound(state, true, events);
      break;
    }
  }
  state.cellsVersion++;
}

function endRound(state: GameState, won: boolean, events: GameEvent[]): void {
  state.status = won ? 'won' : 'lost';
  state.result = scoreRound(state, won);
  state.score = state.result.score;
  for (const p of state.players) {
    p.job = null;
    p.moving = false;
  }
  events.push({ type: won ? 'roundWon' : 'roundLost' });
}

/**
 * Ein Simulationsschritt. Verändert `state` direkt und liefert die entstandenen Ereignisse.
 * `inputs` enthält die aktuelle Laufrichtung je Spieler-ID.
 */
export function step(state: GameState, inputs: Record<string, PlayerInput>, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.status !== 'playing' || state.paused) return events;
  state.time = Math.min(state.timeLimit, state.time + dt);
  if (state.hint && state.time >= state.hint.until) state.hint = null;

  for (const player of state.players) {
    const job = player.job;
    if (job) {
      job.elapsed += dt;
      if (job.elapsed >= job.duration) finishJob(state, player, job, events);
      if (state.status !== 'playing') return events;
      continue;
    }
    movePlayer(state, player, inputs[player.id] ?? { x: 0, z: 0 }, dt);
  }

  if (state.time >= state.timeLimit) endRound(state, false, events);
  return events;
}

export type ActionResult = { ok: true; events: GameEvent[]; duplicate?: boolean } | { ok: false; reason: RejectReason };

/** Wendet eine diskrete Aktion an. Bereits angewendete actionIds werden ignoriert. */
export function applyAction(state: GameState, action: GameAction): ActionResult {
  if ('actionId' in action) {
    if (state.appliedActionIds.includes(action.actionId)) return { ok: true, events: [], duplicate: true };
    state.appliedActionIds.push(action.actionId);
    if (state.appliedActionIds.length > MAX_ACTION_IDS) state.appliedActionIds.shift();
  }

  if (action.type === 'pause' || action.type === 'resume') {
    if (state.mode !== 'solo') return { ok: false, reason: 'NOT_ALLOWED' };
    if (state.status === 'playing') state.paused = action.type === 'pause';
    return { ok: true, events: [] };
  }

  if (state.status !== 'playing') return { ok: false, reason: 'GAME_OVER' };
  if (state.paused) return { ok: false, reason: 'NOT_ALLOWED' };
  const player = findPlayer(state, action.playerId);
  if (!player) return { ok: false, reason: 'NOT_ALLOWED' };
  const events: GameEvent[] = [];

  if (action.type === 'interact') {
    if (player.job) return { ok: false, reason: 'BUSY' };
    startInteraction(state, player, events);
    return { ok: true, events };
  }

  const blocker = abilityBlocker(state, player);
  if (blocker) {
    events.push({ type: 'rejected', playerId: player.id, reason: blocker, message: MESSAGES[blocker] });
    return { ok: true, events };
  }
  const { revealed } = useAbility(state, player);
  events.push({ type: 'ability', playerId: player.id, animal: player.animal, revealed });
  return { ok: true, events };
}

