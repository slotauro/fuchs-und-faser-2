import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { Ack, ClientToServer, JoinedPayload, ServerToClient, Snapshot } from '@ff/shared';
import { createApp } from '../src/app';

type Client = Socket<ServerToClient, ClientToServer>;

describe('Socket.IO-Durchlauf mit zwei Clients', () => {
  const app = createApp();
  let url = '';
  const clients: Client[] = [];

  beforeAll(async () => {
    await new Promise<void>((r) => app.http.listen(0, r));
    url = `http://localhost:${(app.http.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    for (const c of clients) c.close();
    app.close();
  });

  const client = () => {
    const c: Client = connect(url, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    return c;
  };
  const call = <T>(fn: (ack: (r: Ack<T>) => void) => void) => new Promise<Ack<T>>((resolve) => fn(resolve));

  it('beide sehen dieselbe Runde und dieselben Bauaktionen', async () => {
    const a = client();
    const b = client();
    const created = await call<JoinedPayload>((ack) => a.emit('room:create', { name: 'Anna', animal: 'fox', mapId: 'erste-baustelle' }, ack));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const joined = await call<JoinedPayload>((ack) => b.emit('room:join', { code: created.data.code, name: 'Ben', animal: 'fox' }, ack));
    expect(joined.ok && joined.data.lobby.players.map((p) => p.animal)).toEqual(['fox', 'mole']);

    let lastA: Snapshot | null = null;
    let lastB: Snapshot | null = null;
    let cellsB: Snapshot['cells'];
    a.on('snapshot', (s) => (lastA = s));
    b.on('snapshot', (s) => {
      lastB = s;
      if (s.cells) cellsB = s.cells;
    });

    expect((await call((ack) => b.emit('room:start', ack))).ok).toBe(false);
    expect((await call((ack) => a.emit('room:start', ack))).ok).toBe(true);

    // Host läuft nach rechts und gräbt die Kachel vor sich.
    a.emit('game:input', { x: 1, z: 0 });
    await new Promise((r) => setTimeout(r, 120));
    a.emit('game:input', { x: 0, z: 0 });
    const action = await call((ack) => a.emit('game:action', { type: 'interact', actionId: 'dig-a' }, ack));
    expect(action.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 1300));

    expect(lastA).not.toBeNull();
    expect(lastB).not.toBeNull();
    const dugIndex = cellsB?.findIndex((c) => c.dug) ?? -1;
    expect(dugIndex).toBeGreaterThanOrEqual(0);
    expect(lastA!.players[0]!.x).toBeCloseTo(lastB!.players[0]!.x, 5);

    // Ungültige Daten werden abgelehnt, ohne den Server zu stören.
    const bad = await call((ack) => a.emit('game:action', { type: 'explode', actionId: '!' } as never, ack));
    expect(bad).toMatchObject({ ok: false, error: { code: 'INVALID' } });
  });
});
