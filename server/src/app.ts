import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { TICK, type Ack, type ClientToServer, type ServerToClient } from '@ff/shared';
import { RateLimiter } from './rateLimiter';
import { RoomManager } from './roomManager';
import {
  isRecord,
  parseActionId,
  parseAnimal,
  parseCode,
  parseFacing,
  parseInput,
  parseMapId,
  parseName,
  parseToken,
} from './validation';

const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../client/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/**
 * HTTP-Server (liefert im Produktivbetrieb den gebauten Client aus), Socket.IO und
 * Raumverwaltung. Als Fabrik, damit Tests einen echten Server starten können.
 */
export function createApp() {
  const http = createServer((req, res) => {
    if (!existsSync(DIST)) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Fuchs-und-Faser-2-Server läuft. Im Entwicklungsmodus den Client über http://localhost:5173 öffnen.');
      return;
    }
    let path = '/';
    try {
      path = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    } catch {
      // Ungültige Kodierung: Startseite ausliefern statt abzustürzen.
    }
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });

  const io = new Server<ClientToServer, ServerToClient>(http, { maxHttpBufferSize: 32_000, cors: { origin: false } });

  const rooms = new RoomManager({
    lobby: (code, lobby) => io.to(code).emit('lobby', lobby),
    snapshot: (code, snapshot) => io.to(code).emit('snapshot', snapshot),
    events: (code, events) => io.to(code).emit('events', events),
  });

  const invalid = <T>(): Ack<T> => ({ ok: false, error: { code: 'INVALID', message: 'Ungültige Anfrage.' } });
  const limited = <T>(): Ack<T> => ({ ok: false, error: { code: 'RATE_LIMITED', message: 'Zu viele Anfragen.' } });

  io.on('connection', (socket) => {
    // Eingaben kommen häufiger als Aktionen; beide sind begrenzt.
    const inputLimit = new RateLimiter(40, 80);
    const actionLimit = new RateLimiter(10, 20);
    const safeAck = (ack: unknown) => (typeof ack === 'function' ? (ack as (r: Ack<unknown>) => void) : () => {});
    const enter = (code: string) => {
      for (const r of socket.rooms) if (r !== socket.id) void socket.leave(r);
      void socket.join(code);
    };

    socket.on('room:create', (p, ack) => {
      const reply = safeAck(ack);
      if (!actionLimit.take()) return reply(limited());
      if (!isRecord(p)) return reply(invalid());
      const name = parseName(p.name);
      const animal = parseAnimal(p.animal);
      const mapId = parseMapId(p.mapId);
      if (!name || !animal || !mapId) return reply(invalid());
      const result = rooms.create(socket.id, name, animal, mapId);
      if (result.ok) enter(result.data.code);
      reply(result);
    });

    socket.on('room:join', (p, ack) => {
      const reply = safeAck(ack);
      if (!actionLimit.take()) return reply(limited());
      if (!isRecord(p)) return reply(invalid());
      const code = parseCode(p.code);
      const name = parseName(p.name);
      const animal = parseAnimal(p.animal);
      if (!code || !name || !animal) return reply(invalid());
      // Erst dem Socket-Raum beitreten, damit die Lobby-Nachricht schon ankommt.
      const result = rooms.join(socket.id, code, name, animal);
      if (result.ok) {
        enter(code);
        io.to(code).emit('lobby', result.data.lobby);
      }
      reply(result);
    });

    socket.on('room:rejoin', (p, ack) => {
      const reply = safeAck(ack);
      if (!actionLimit.take()) return reply(limited());
      if (!isRecord(p)) return reply(invalid());
      const code = parseCode(p.code);
      const token = parseToken(p.token);
      if (!code || !token) return reply(invalid());
      enter(code);
      const result = rooms.rejoin(socket.id, code, token);
      if (!result.ok) void socket.leave(code);
      reply(result);
    });

    socket.on('room:update', (p, ack) => {
      const reply = safeAck(ack);
      if (!actionLimit.take()) return reply(limited());
      if (!isRecord(p)) return reply(invalid());
      const animal = p.animal === undefined ? undefined : parseAnimal(p.animal);
      const mapId = p.mapId === undefined ? undefined : parseMapId(p.mapId);
      if (animal === null || mapId === null) return reply(invalid());
      reply(rooms.update(socket.id, { animal, mapId }));
    });

    socket.on('room:start', (ack) => {
      const reply = safeAck(ack);
      if (!actionLimit.take()) return reply(limited());
      reply(rooms.start(socket.id));
    });

    socket.on('game:lobby', (ack) => {
      const reply = safeAck(ack);
      if (!actionLimit.take()) return reply(limited());
      reply(rooms.backToLobby(socket.id));
    });

    socket.on('room:leave', () => {
      for (const r of socket.rooms) if (r !== socket.id) void socket.leave(r);
      rooms.leave(socket.id);
    });

    socket.on('game:input', (p) => {
      if (!inputLimit.take()) return;
      const input = parseInput(p);
      if (input) rooms.input(socket.id, input);
    });

    socket.on('game:action', (p, ack) => {
      const reply = safeAck(ack);
      if (!actionLimit.take()) return reply(limited());
      if (!isRecord(p) || (p.type !== 'interact' && p.type !== 'ability')) return reply(invalid());
      const actionId = parseActionId(p.actionId);
      if (!actionId) return reply(invalid());
      const facing = p.facing === undefined ? undefined : parseFacing(p.facing);
      if (facing === null) return reply(invalid());
      reply(rooms.action(socket.id, p.type, actionId, facing));
    });

    socket.on('disconnect', () => rooms.disconnect(socket.id));
  });

  const timer = setInterval(() => rooms.tick(), TICK * 1000);
  const close = () => {
    clearInterval(timer);
    io.close();
    http.close();
  };
  return { http, io, rooms, close };
}
