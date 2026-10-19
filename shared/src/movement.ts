import { CARRY_SPEED_FACTOR, PLAYER_RADIUS, WALK_SPEED, cellAt, isWalkable } from './terrain';
import type { GameState, PlayerInput, PlayerState } from './types';

function blockedAt(state: GameState, cx: number, cz: number): boolean {
  return !isWalkable(cellAt(state, cx, cz));
}

/** Kacheln, die das Quadrat der Figur bei (x, z) berührt. */
function overlapsBlocked(state: GameState, x: number, z: number): boolean {
  const r = PLAYER_RADIUS;
  const minX = Math.floor(x - r + 0.5);
  const maxX = Math.floor(x + r + 0.5 - 1e-9);
  const minZ = Math.floor(z - r + 0.5);
  const maxZ = Math.floor(z + r + 0.5 - 1e-9);
  for (let cz = minZ; cz <= maxZ; cz++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (blockedAt(state, cx, cz)) return true;
    }
  }
  return false;
}

/** Bewegt eine Achse so weit wie möglich, ohne in gesperrte Kacheln zu laufen. */
function moveAxis(state: GameState, player: PlayerState, axis: 'x' | 'z', delta: number): void {
  if (delta === 0) return;
  const target = player[axis] + delta;
  const probe = (value: number) =>
    axis === 'x' ? overlapsBlocked(state, value, player.z) : overlapsBlocked(state, player.x, value);
  if (!probe(target)) {
    player[axis] = target;
    return;
  }
  // Bis an die Kachelkante heranschieben.
  const edge =
    delta > 0
      ? Math.floor(target + PLAYER_RADIUS + 0.5) - 0.5 - PLAYER_RADIUS - 1e-6
      : Math.ceil(target - PLAYER_RADIUS - 0.5) + 0.5 + PLAYER_RADIUS + 1e-6;
  const clamped = delta > 0 ? Math.max(player[axis], edge) : Math.min(player[axis], edge);
  if (!probe(clamped)) player[axis] = clamped;
}

export function playerSpeed(player: PlayerState): number {
  return WALK_SPEED * (player.carrying > 0 ? CARRY_SPEED_FACTOR : 1);
}

/** Wendet eine Eingabe für dt Sekunden an. Während einer Arbeit bleibt die Figur stehen. */
export function movePlayer(state: GameState, player: PlayerState, input: PlayerInput, dt: number): void {
  const len = Math.hypot(input.x, input.z);
  if (player.job || len < 0.1) {
    player.moving = false;
    return;
  }
  const dirX = input.x / Math.max(1, len);
  const dirZ = input.z / Math.max(1, len);
  player.facing = { x: input.x / len, z: input.z / len };
  const step = playerSpeed(player) * dt;
  const beforeX = player.x;
  const beforeZ = player.z;
  moveAxis(state, player, 'x', dirX * step);
  if (player.x === beforeX && Math.abs(dirX) > Math.abs(dirZ)) laneAssist(state, player, 'x', dirX, step);
  const midZ = player.z;
  moveAxis(state, player, 'z', dirZ * step);
  if (player.z === midZ && Math.abs(dirZ) > Math.abs(dirX)) laneAssist(state, player, 'z', dirZ, step);
  player.moving = Math.abs(player.x - beforeX) + Math.abs(player.z - beforeZ) > 1e-4;
}

/**
 * Eckenhilfe: Ist der Weg geradeaus nur blockiert, weil die Figur seitlich versetzt steht,
 * die Kachel direkt voraus aber frei, rutscht sie zur Mitte ihrer Spur.
 */
function laneAssist(state: GameState, player: PlayerState, axis: 'x' | 'z', dir: number, step: number): void {
  const other = axis === 'x' ? 'z' : 'x';
  const center = Math.round(player[other]);
  const offset = center - player[other];
  if (Math.abs(offset) < 1e-4) return;
  const aheadX = axis === 'x' ? Math.round(player.x) + Math.sign(dir) : center;
  const aheadZ = axis === 'z' ? Math.round(player.z) + Math.sign(dir) : center;
  if (!isWalkable(cellAt(state, aheadX, aheadZ))) return;
  moveAxis(state, player, other, Math.sign(offset) * Math.min(step, Math.abs(offset)));
}

/** Kachel, auf der die Figur steht. */
export function playerCell(state: GameState, player: PlayerState): number {
  return Math.round(player.z) * state.width + Math.round(player.x);
}

/** Nachbarkachel der eigenen Kachel in Blickrichtung (unabhängig davon, wo in der Kachel die Figur steht). */
export function frontCell(state: GameState, player: PlayerState): number | null {
  const fx = player.facing.x;
  const fz = player.facing.z;
  // Auf die Hauptachse runden, damit diagonales Laufen eindeutig bleibt.
  const [dx, dz] = Math.abs(fx) >= Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz)];
  const cx = Math.round(player.x) + dx;
  const cz = Math.round(player.z) + dz;
  if (cx < 0 || cz < 0 || cx >= state.width || cz >= state.height) return null;
  return cz * state.width + cx;
}
