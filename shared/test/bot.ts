import {
  TICK,
  applyAction,
  cheapestRoute,
  findPlayer,
  isWalkable,
  neighbors,
  playerCell,
  step,
  type GameEvent,
  type GameState,
  type PlayerInput,
} from '../src';

/**
 * Ein einfacher Bot, der eine Runde nur über die öffentlichen Regeln spielt:
 * Eingaben über `step`, Interaktionen über `applyAction`. So prüfen die Tests,
 * dass jede Karte in der Zeit lösbar ist.
 */
export class Bot {
  readonly events: GameEvent[] = [];
  private actionCounter = 0;

  constructor(
    private readonly state: GameState,
    private readonly playerId: string,
  ) {}

  private get player() {
    return findPlayer(this.state, this.playerId)!;
  }

  private tick(input: PlayerInput = { x: 0, z: 0 }): void {
    if (this.state.status !== 'playing') throw new BotStopped();
    this.events.push(...step(this.state, { [this.playerId]: input }, TICK));
  }

  /** Läuft über Kachelmitten zu einer begehbaren Kachel. */
  walkTo(target: number): void {
    const path = this.findWalkPath(playerCell(this.state, this.player), target);
    if (!path) throw new Error(`Kein Fußweg zu Kachel ${target}`);
    for (const cell of path) {
      const cx = cell % this.state.width;
      const cz = Math.floor(cell / this.state.width);
      for (let guard = 0; guard < 200; guard++) {
        const dx = cx - this.player.x;
        const dz = cz - this.player.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.08) break;
        // Kurz vor dem Ziel langsamer, damit die Figur nicht überschießt.
        const scale = Math.min(1, dist / (this.player.carrying > 0 ? 0.136 : 0.16));
        this.tick({ x: (dx / dist) * scale, z: (dz / dist) * scale });
      }
    }
  }

  private findWalkPath(from: number, to: number): number[] | null {
    const parent = new Map<number, number>([[from, -1]]);
    const queue = [from];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) break;
      for (const n of neighbors(this.state, current)) {
        if (parent.has(n) || !isWalkable(this.state.cells[n])) continue;
        parent.set(n, current);
        queue.push(n);
      }
    }
    if (!parent.has(to)) return null;
    const path: number[] = [];
    for (let at = to; at !== from; at = parent.get(at)!) path.push(at);
    return path.reverse();
  }

  /** Stellt sich neben die Zielkachel und schaut sie an. */
  approach(target: number): void {
    const here = playerCell(this.state, this.player);
    const options = neighbors(this.state, target).filter((n) => isWalkable(this.state.cells[n]));
    const reachable = options
      .map((n) => ({ n, path: n === here ? [] : this.findWalkPath(here, n) }))
      .filter((o) => o.path !== null)
      .sort((a, b) => a.path!.length - b.path!.length);
    if (reachable.length === 0) throw new Error(`Kachel ${target} ist nicht erreichbar`);
    this.walkTo(reachable[0]!.n);
    const tx = target % this.state.width;
    const tz = Math.floor(target / this.state.width);
    // Ein kurzer Schritt in Richtung Ziel dreht die Figur.
    this.tick({ x: Math.sign(tx - Math.round(this.player.x)) * 0.3, z: Math.sign(tz - Math.round(this.player.z)) * 0.3 });
  }

  /** Interagiert und wartet, bis die Arbeit fertig ist. */
  interact(): GameEvent[] {
    const result = applyAction(this.state, {
      type: 'interact',
      playerId: this.playerId,
      actionId: `bot-${this.playerId}-${this.actionCounter++}`,
    });
    if (!result.ok) throw new Error(`Aktion abgelehnt: ${result.reason}`);
    const rejected = result.events.find((e) => e.type === 'rejected');
    if (rejected) throw new Error(`Aktion abgelehnt: ${rejected.type === 'rejected' ? rejected.message : ''}`);
    this.events.push(...result.events);
    while (this.player.job) this.tick();
    return result.events;
  }

  fetchCable(): void {
    const station = this.state.cells.findIndex((c) => c.kind === 'station');
    this.approach(station);
    this.interact();
  }

  /** Bereitet eine Kachel vor und verlegt darauf Kabel. */
  cableCell(target: number): void {
    for (let guard = 0; guard < 6 && !this.state.cells[target]!.cable; guard++) {
      const cell = this.state.cells[target]!;
      const needsWork =
        (cell.kind === 'rock') ||
        (cell.kind === 'road' && !cell.shaft) ||
        (cell.kind === 'conduit' && cell.hidden) ||
        ((cell.kind === 'grass' || cell.kind === 'roots' || cell.kind === 'gravel') && !cell.dug);
      if (!needsWork && this.player.carrying === 0) this.fetchCable();
      this.approach(target);
      this.interact();
    }
    if (!this.state.cells[target]!.cable) throw new Error(`Kachel ${target} bekam kein Kabel`);
  }

  /** Schließt alle Häuser nacheinander an, jeweils über die günstigste Trasse. */
  solve(): void {
    try {
      for (const house of this.state.houses) {
        if (house.online) continue;
        const route = cheapestRoute(this.state, house.socket);
        if (!route) throw new Error(`Keine Trasse zu Haus ${house.id}`);
        for (const cell of route.cells) this.cableCell(cell);
        this.approach(house.socket);
        this.interact();
      }
    } catch (error) {
      if (!(error instanceof BotStopped)) throw error;
    }
  }
}

class BotStopped extends Error {}
