import { ConnectionHandler } from './connection.handler';
import { ExtendedSocket } from './types';

function makeSocket(id: string, connected = true): ExtendedSocket {
  return {
    id,
    connected,
    clientIP: '203.0.113.5',
    emit: jest.fn(),
    handshake: { headers: {}, auth: {}, query: {}, address: '203.0.113.5' },
    conn: { remoteAddress: '203.0.113.5' },
  } as unknown as ExtendedSocket;
}

describe('ConnectionHandler identity assignment', () => {
  let connections: Map<number, ExtendedSocket>;
  let handler: ConnectionHandler;

  beforeEach(() => {
    connections = new Map();
    handler = new ConnectionHandler({} as never, connections);
  });

  afterEach(() => {
    handler.destroy();
  });

  it('assigns a uid on connect and tells the client', () => {
    const socket = makeSocket('s1');
    handler.handleConnection(socket);

    expect(typeof socket.uid).toBe('number');
    expect(socket.uid).toBeGreaterThan(0);
    // Must fit Postgres int4: user_visits.uid is an integer column, so a larger id would
    // fail the visit insert at runtime.
    expect(socket.uid).toBeLessThanOrEqual(2 ** 31 - 1);
    expect(Number.isInteger(socket.uid)).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith(
      'connected',
      expect.objectContaining({ uid: socket.uid })
    );
  });

  it('assigns distinct, non-sequential ids to different sockets', () => {
    // The old client-side scheme was (Date.now() % 1e6) * 1000 + rand(0..999): guessable,
    // and it cycled every ~16.7 minutes. Server ids must not be predictable from each other.
    const ids = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const socket = makeSocket(`s${i}`);
      handler.handleConnection(socket);
      ids.add(socket.uid!);
    }
    expect(ids.size).toBe(200);
  });

  it('ignores any uid supplied in the join payload', () => {
    const socket = makeSocket('s1');
    handler.handleConnection(socket);
    const assigned = socket.uid;

    // A hijack attempt: claim someone else's id in the payload.
    const result = handler.registerConnection(socket, 'Mallory', 'male');

    expect(result.ok).toBe(true);
    expect(socket.uid).toBe(assigned);
    expect(connections.get(assigned!)).toBe(socket);
  });

  it('registers the socket under its assigned id', () => {
    const socket = makeSocket('s1');
    handler.handleConnection(socket);

    const result = handler.registerConnection(socket, 'Ada', 'female');

    expect(result).toEqual({ ok: true, uid: socket.uid });
    expect(connections.get(socket.uid!)).toBe(socket);
  });

  it('refuses to register a socket that was never assigned an identity', () => {
    const socket = makeSocket('rogue');
    const result = handler.registerConnection(socket, 'Ada', 'female');
    expect(result.ok).toBe(false);
  });

  it('stores a sanitized display name', () => {
    const socket = makeSocket('s1');
    handler.handleConnection(socket);
    handler.registerConnection(socket, '  <script>Ada</script>  ', 'female');

    expect(socket.name).not.toContain('<');
    expect(socket.name).not.toContain('>');
    expect(socket.name?.startsWith(' ')).toBe(false);
  });

  it('is idempotent for the same socket', () => {
    const socket = makeSocket('s1');
    handler.handleConnection(socket);
    expect(handler.registerConnection(socket, 'Ada', 'female').ok).toBe(true);
    expect(handler.registerConnection(socket, 'Ada', 'female').ok).toBe(true);
  });
});

describe('ConnectionHandler.handleDisconnection', () => {
  it('does not evict a uid that now belongs to a different socket', () => {
    const connections = new Map<number, ExtendedSocket>();
    const handler = new ConnectionHandler({} as never, connections);

    const stale = makeSocket('stale');
    handler.handleConnection(stale);
    handler.registerConnection(stale, 'Ada', 'female');
    const uid = stale.uid!;

    // A newer socket takes over the slot after the old one dropped.
    const current = makeSocket('current');
    current.uid = uid;
    connections.set(uid, current);

    handler.handleDisconnection(stale, 'transport close');

    expect(connections.get(uid)).toBe(current);
    handler.destroy();
  });

  it('clears its own registry entry', () => {
    const connections = new Map<number, ExtendedSocket>();
    const handler = new ConnectionHandler({} as never, connections);

    const socket = makeSocket('s1');
    handler.handleConnection(socket);
    handler.registerConnection(socket, 'Ada', 'female');
    const uid = socket.uid!;

    handler.handleDisconnection(socket, 'transport close');

    expect(connections.has(uid)).toBe(false);
    handler.destroy();
  });
});

describe('ConnectionHandler.validateJoinRequest', () => {
  const handler = new ConnectionHandler({} as never, new Map());

  afterAll(() => handler.destroy());

  it('accepts a well-formed request without a uid', () => {
    expect(handler.validateJoinRequest({ name: 'Ada', gender: 'female' }).valid).toBe(true);
  });

  it('accepts (and ignores) a payload that still carries a uid', () => {
    // Older clients send one; it must not be an error, and it must not be used.
    expect(handler.validateJoinRequest({ uid: 999, name: 'Ada', gender: 'female' }).valid).toBe(
      true
    );
  });

  it('rejects a name that sanitizes to nothing', () => {
    expect(handler.validateJoinRequest({ name: '<<>>', gender: 'female' }).valid).toBe(false);
    expect(handler.validateJoinRequest({ name: '   ', gender: 'female' }).valid).toBe(false);
    expect(handler.validateJoinRequest({ name: 123, gender: 'female' }).valid).toBe(false);
  });

  it('rejects an unexpected gender', () => {
    expect(handler.validateJoinRequest({ name: 'Ada', gender: 'other' }).valid).toBe(false);
    expect(handler.validateJoinRequest({ name: 'Ada' }).valid).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(handler.validateJoinRequest(null).valid).toBe(false);
    expect(handler.validateJoinRequest('join').valid).toBe(false);
  });
});

describe('ConnectionHandler.authenticate', () => {
  let handler: ConnectionHandler;

  beforeEach(() => {
    handler = new ConnectionHandler({} as never, new Map());
  });

  afterEach(() => {
    handler.destroy();
  });

  function authSocket(auth: Record<string, unknown> = {}) {
    return {
      id: 's-auth',
      handshake: {
        headers: {},
        auth,
        query: {},
        address: '203.0.113.5',
      },
      conn: { remoteAddress: '203.0.113.5' },
    } as never;
  }

  it('accepts the configured API key', () => {
    expect(handler.authenticate(authSocket({ apiKey: 'test-api-key' }))).toEqual({ ok: true });
  });

  it('rejects a missing key with the client-visible auth error', () => {
    expect(handler.authenticate(authSocket())).toEqual({
      ok: false,
      reason: 'Authentication failed',
    });
  });

  it('rejects a wrong key with the client-visible auth error', () => {
    expect(handler.authenticate(authSocket({ apiKey: 'wrong-key' }))).toEqual({
      ok: false,
      reason: 'Authentication failed',
    });
  });
});
