import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from './server';
import type { MahjongServer } from './server';
import type { ServerFrame } from './session';

/**
 * One thin pass over a real loopback socket, to prove the wiring in `server.ts` is real: the two
 * HTTP endpoints, the upgrade, and a framed round trip. Everything about behaviour is tested in
 * `session.test.ts` with fake sockets and injected time, because a suite that waits on a clock
 * is a suite that goes red on a slow machine.
 */
let server: MahjongServer;
let base: string;

beforeAll(async () => {
  server = await startServer({ port: 0 });
  base = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await server.close();
});

async function post(path: string, body?: unknown): Promise<any> {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

/** Resolves on the first frame the server sends, or on the socket closing. */
function firstFrame(socket: WebSocket): Promise<ServerFrame | { closedWith: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no frame within 5s')), 5_000);
    socket.addEventListener('message', (event) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(event.data)) as ServerFrame);
    });
    socket.addEventListener('close', (event) => {
      clearTimeout(timer);
      resolve({ closedWith: event.code });
    });
  });
}

describe('loopback transport', () => {
  it('creates and joins over HTTP, then serves the seat its own snapshot over the socket', async () => {
    const created = await post('/rooms');
    expect(created.status).toBe(201);
    const roomId: string = created.body.roomId;
    expect(roomId).toHaveLength(6);

    const joined = await post(`/rooms/${roomId}/join`, { clientId: 'alice', displayName: 'Alice', seat: 2 });
    expect(joined.status).toBe(200);
    expect(joined.body).toMatchObject({ ok: true, seat: 2 });
    const token: string = joined.body.token;
    expect(typeof token).toBe('string');

    const socket = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise<void>((resolve) => socket.addEventListener('open', () => resolve()));
    const frame = firstFrame(socket);
    socket.send(JSON.stringify({ type: 'auth', roomId, clientId: 'alice', token }));

    const welcome = await frame;
    expect(welcome).toMatchObject({ type: 'welcome', seat: 2 });
    socket.close();
  });

  it('closes a socket that presents the wrong token', async () => {
    const created = await post('/rooms');
    const roomId: string = created.body.roomId;
    await post(`/rooms/${roomId}/join`, { clientId: 'bob', displayName: 'Bob' });

    const socket = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise<void>((resolve) => socket.addEventListener('open', () => resolve()));
    const frame = firstFrame(socket);
    socket.send(JSON.stringify({ type: 'auth', roomId, clientId: 'bob', token: 'wrong' }));

    expect(await frame).toMatchObject({ type: 'error', code: 'INVALID_TOKEN' });
    socket.close();
  });

  it('answers an unknown room and an unknown endpoint without inventing one', async () => {
    expect((await post('/rooms/ZZZZZZ/join', { clientId: 'x' })).status).toBe(404);
    expect((await post('/nope')).status).toBe(404);
  });
});
