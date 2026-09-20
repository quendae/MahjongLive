import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';
import type { PlayerIndex } from '@mahjong-live/shared/rules';
import { RoomHub } from './session';
import { RoomManager } from './roomManager';

/**
 * How often the real clock is pushed into every room.
 *
 * The shortest window a room waits on is the 8s reaction deadline, so the tick interval is the
 * slop on every timer a player sees. 250ms is 3% of that window -- under the ~200ms a person can
 * resolve on a countdown -- while 1s would overrun a pass prompt by a visible eighth. Going below
 * 250ms buys nothing: no deadline in `DEFAULT_ROOM_TIMING` is finer, and the cost is wakeups.
 * `sweep` rides the same timer; its TTLs are minutes, so 4 Hz is free precision there.
 */
export const TICK_MS = 250;

const MAX_BODY_BYTES = 4096;

export interface MahjongServer {
  readonly hub: RoomHub;
  readonly port: number;
  close(): Promise<void>;
}

interface JoinBody {
  clientId?: unknown;
  displayName?: unknown;
  seat?: unknown;
  token?: unknown;
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    // The client is served from its own origin in dev and the API holds no cookies or ambient
    // credentials -- the join token is the credential and it travels in the body.
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  });
  response.end(payload);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isSeat(value: unknown): value is PlayerIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/**
 * The whole HTTP surface, per section 1: create a room and join it. Everything else -- every
 * command, every projection -- rides the one WebSocket, so there is a single protocol to version.
 */
async function route(hub: RoomHub, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '');

  if (request.method === 'OPTIONS') return send(response, 204, {});

  if (request.method === 'POST' && path === '/rooms') {
    // No seed from the caller: section 3 keeps it server-held, because a client that picked it
    // could derive the whole wall.
    const room = hub.manager.allocate();
    return send(response, 201, { roomId: room.id, version: room.publicVersion });
  }

  const join = /^\/rooms\/([^/]+)\/join$/.exec(path);
  if (request.method === 'POST' && join) {
    const room = hub.manager.get(decodeURIComponent(join[1]!));
    if (!room) return send(response, 404, { ok: false, code: 'NO_SUCH_ROOM', message: 'No room with that code' });

    let body: JoinBody;
    try {
      body = (await readJson(request)) as JoinBody;
    } catch (error) {
      return send(response, 400, { ok: false, code: 'BAD_BODY', message: String(error) });
    }
    if (typeof body.clientId !== 'string' || body.clientId.length === 0) {
      return send(response, 400, { ok: false, code: 'BAD_BODY', message: 'clientId is required' });
    }
    if (body.seat !== undefined && !isSeat(body.seat)) {
      return send(response, 400, { ok: false, code: 'INVALID_SEAT', message: 'Seat must be 0, 1, 2 or 3' });
    }

    const result = room.join(
      body.clientId,
      typeof body.displayName === 'string' ? body.displayName : '',
      body.seat as PlayerIndex | undefined,
      typeof body.token === 'string' ? body.token : undefined,
    );
    // The token in this response is the credential for everything after it, including the socket.
    return send(response, result.ok ? 200 : 409, { ...result, roomId: room.id });
  }

  send(response, 404, { ok: false, code: 'NOT_FOUND', message: 'Unknown endpoint' });
}

export async function startServer(
  options: { port?: number; host?: string; manager?: RoomManager } = {},
): Promise<MahjongServer> {
  const hub = new RoomHub(options.manager ?? new RoomManager());
  const http: Server = createServer((request, response) => {
    route(hub, request, response).catch((error: unknown) => {
      if (!response.headersSent) send(response, 500, { ok: false, message: String(error) });
    });
  });

  const wss = new WebSocketServer({ server: http });
  wss.on('connection', (socket) => {
    const connection = hub.open(socket);
    socket.on('message', (data) => hub.receive(connection, data.toString(), Date.now()));
    socket.on('close', () => hub.close(connection, Date.now()));
    socket.on('error', () => hub.close(connection, Date.now()));
  });

  const timer = setInterval(() => hub.tick(Date.now()), TICK_MS);

  await new Promise<void>((resolve) => http.listen(options.port ?? 8787, options.host ?? '127.0.0.1', resolve));

  return {
    hub,
    port: (http.address() as AddressInfo).port,
    close: async () => {
      clearInterval(timer);
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
