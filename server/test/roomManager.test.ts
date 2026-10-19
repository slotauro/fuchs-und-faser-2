import { describe, expect, it } from 'vitest';
import { cellIndex, type GameEvent, type LobbyState, type Snapshot } from '@ff/shared';
import { EMPTY_ROOM_TTL_MS, RECONNECT_GRACE_MS, RoomManager } from '../src/roomManager';
import { RateLimiter } from '../src/rateLimiter';
import { parseCode, parseInput, parseName } from '../src/validation';

function setup() {
  const lobbies: LobbyState[] = [];
  const snapshots: Snapshot[] = [];
  const events: GameEvent[] = [];
  const rooms = new RoomManager({
    lobby: (_c, l) => lobbies.push(l),
    snapshot: (_c, s) => snapshots.push(s),
    events: (_c, e) => events.push(...e),
  });
  return { rooms, lobbies, snapshots, events };
}

function twoPlayers() {
  const ctx = setup();
  const host = ctx.rooms.create('s1', 'Anna', 'fox', 'erste-baustelle');
  if (!host.ok) throw new Error('create failed');
  const guest = ctx.rooms.join('s2', host.data.code, 'Ben', 'mole');
  if (!guest.ok) throw new Error('join failed');
  return { ...ctx, code: host.data.code, host: host.data, guest: guest.data };
}

describe('Räume', () => {
  it('erzeugt gut lesbare, eindeutige Codes', () => {
    const { rooms } = setup();
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = rooms.create(`s${i}`, 'A', 'fox', 'erste-baustelle');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        codes.add(r.data.code);
      }
    }
    expect(codes.size).toBe(200);
  });

  it('lässt höchstens vier Spieler herein und vergibt jedes Tier einmal', () => {
    const { rooms, code } = twoPlayers();
    const third = rooms.join('s3', code, 'Cleo', 'fox');
    expect(third.ok && third.data.lobby.players.map((p) => p.animal)).toEqual(['fox', 'mole', 'beaver']);
    expect(rooms.join('s4', code, 'Dora', 'fox').ok).toBe(true);
    expect(rooms.join('s5', code, 'Emil', 'fox')).toMatchObject({ ok: false, error: { code: 'ROOM_FULL' } });
    expect(rooms.update('s2', { animal: 'fox' })).toMatchObject({ ok: false, error: { code: 'ANIMAL_TAKEN' } });
  });

  it('unbekannte Räume werden abgelehnt', () => {
    const { rooms } = setup();
    expect(rooms.join('s1', 'ZZZZZZ', 'A', 'fox')).toMatchObject({ ok: false, error: { code: 'ROOM_NOT_FOUND' } });
  });

  it('nur der Host startet, und erst ab zwei Spielern', () => {
    const { rooms } = setup();
    const host = rooms.create('s1', 'Anna', 'fox', 'erste-baustelle');
    expect(rooms.start('s1')).toMatchObject({ ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } });
    if (!host.ok) return;
    rooms.join('s2', host.data.code, 'Ben', 'mole');
    expect(rooms.start('s2')).toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
    expect(rooms.update('s2', { mapId: 'wurzelweg' })).toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
    expect(rooms.start('s1').ok).toBe(true);
    expect(rooms.join('s3', host.data.code, 'C', 'beaver')).toMatchObject({ ok: false, error: { code: 'ALREADY_STARTED' } });
  });

  it('übergibt die Host-Rolle, wenn der Host geht, und löscht leere Räume', () => {
    const { rooms, code, guest } = twoPlayers();
    rooms.leave('s1');
    expect(rooms.peek(code)?.hostId).toBe(guest.playerId);
    rooms.leave('s2');
    expect(rooms.peek(code)).toBeUndefined();
  });
});

describe('Runde auf dem Server', () => {
  it('synchronisiert Bewegung und Bauaktionen für alle', () => {
    const { rooms, code, snapshots, events } = twoPlayers();
    rooms.start('s1');
    const game = rooms.peek(code)!.game!;
    expect(snapshots.at(-1)?.cells).toBeDefined();

    const host = game.players[0]!;
    const x0 = host.x;
    const z0 = host.z;
    rooms.input('s1', { x: 0, z: -1 });
    for (let i = 0; i < 5; i++) rooms.tick();
    expect(host.z).toBeLessThan(z0);
    expect(host.x).toBe(x0);

    // Gast gräbt vor sich: Kachel ändert sich, Kacheln gehen im nächsten Snapshot mit.
    const guest = game.players[1]!;
    guest.facing = { x: 1, z: 0 };
    const target = cellIndex(game, Math.round(guest.x) + 1, Math.round(guest.z));
    expect(rooms.action('s2', 'interact', 'dig-1').ok).toBe(true);
    for (let i = 0; i < 25; i++) rooms.tick();
    expect(game.cells[target]!.dug).toBe(true);
    expect(events.some((e) => e.type === 'dug' && e.cell === target)).toBe(true);
    expect(snapshots.some((s) => s.cells?.[target]?.dug)).toBe(true);
  });

  it('wendet doppelte Aktionen nur einmal an', () => {
    const { rooms, code, events } = twoPlayers();
    rooms.start('s1');
    const game = rooms.peek(code)!.game!;
    const p = game.players[0]!;
    p.facing = { x: 1, z: 0 };
    rooms.action('s1', 'interact', 'same');
    rooms.action('s1', 'interact', 'same');
    expect(events.filter((e) => e.type === 'jobStarted')).toHaveLength(1);
  });

  it('lehnt Aktionen ohne Raum oder ohne Runde ab', () => {
    const { rooms } = twoPlayers();
    expect(rooms.action('nobody', 'interact', 'x')).toMatchObject({ ok: false, error: { code: 'NOT_IN_ROOM' } });
    expect(rooms.action('s1', 'interact', 'x')).toMatchObject({ ok: false, error: { code: 'INVALID' } });
  });

  it('Wiederbeitritt behält die Figur und liefert den vollen Zustand', () => {
    const { rooms, code, host, snapshots } = twoPlayers();
    rooms.start('s1');
    rooms.disconnect('s1');
    const before = snapshots.length;
    const again = rooms.rejoin('s9', code, host.token);
    expect(again.ok && again.data.playerId).toBe(host.playerId);
    expect(snapshots.length).toBe(before + 1);
    expect(snapshots.at(-1)?.cells).toBeDefined();
    expect(rooms.rejoin('s10', code, 'f'.repeat(32))).toMatchObject({ ok: false });
  });

  it('räumt getrennte Lobby-Spieler und leere Räume nach Fristablauf auf', () => {
    const { rooms, code } = twoPlayers();
    const t0 = Date.now();
    rooms.disconnect('s2', t0);
    rooms.tick(t0 + RECONNECT_GRACE_MS + 1);
    expect(rooms.peek(code)?.players).toHaveLength(1);
    rooms.disconnect('s1', t0);
    rooms.tick(t0 + EMPTY_ROOM_TTL_MS + 1);
    expect(rooms.peek(code)).toBeUndefined();
  });

  it('nach Rundenende zurück in die Lobby', () => {
    const { rooms, code } = twoPlayers();
    rooms.start('s1');
    expect(rooms.backToLobby('s2')).toMatchObject({ ok: false });
    rooms.peek(code)!.game!.status = 'won';
    expect(rooms.backToLobby('s2').ok).toBe(true);
    expect(rooms.peek(code)?.phase).toBe('lobby');
  });
});

describe('Validierung und Rate-Limit', () => {
  it('prüft Namen, Codes und Eingaben', () => {
    expect(parseName('  Anna\u0000  Lena ')).toBe('Anna Lena');
    expect(parseName('   ')).toBeNull();
    expect(parseCode('abc234')).toBe('ABC234');
    expect(parseCode('abc')).toBeNull();
    expect(parseInput({ x: 5, z: -0.5 })).toEqual({ x: 1, z: -0.5 });
    expect(parseInput({ x: NaN, z: 0 })).toBeNull();
    expect(parseInput('x')).toBeNull();
  });

  it('begrenzt Nachrichtenspitzen', () => {
    const limiter = new RateLimiter(10, 3, 0);
    expect([limiter.take(0), limiter.take(0), limiter.take(0), limiter.take(0)]).toEqual([true, true, true, false]);
    expect(limiter.take(200)).toBe(true);
  });
});
