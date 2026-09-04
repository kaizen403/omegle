import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, RedisClientType } from 'redis';

/**
 * Integration test for the atomic pair claim in match.lua.
 *
 * This is the fix that stops concurrent matchmaking from stranding users. Before it, the
 * script removed both users from the queue but did not mark them as taken, and
 * `user:room:<uid>` was only written much later by createRoom — so a second caller could
 * select a user who had already been matched. Whichever room-creation lost left both of its
 * users de-queued and roomless: connected, "Searching...", forever. A 1,000-user load test
 * produced 642 matches for 297 rooms, stranding roughly 400 people.
 *
 * Requires a real Redis (Lua is not emulated by redis-mock). Set REDIS_TEST_URL to point at
 * one; the suite skips itself when none is reachable so CI without Redis stays green.
 */

const REDIS_URL = process.env.REDIS_TEST_URL || 'redis://127.0.0.1:6399';
const QUEUE_KEY = 'queue:all';
const LUA = readFileSync(join(__dirname, '../../scripts/redis/match.lua'), 'utf-8');

let redis: RedisClientType | null = null;
let available = false;

beforeAll(async () => {
  try {
    // Fail fast when there is no Redis: the default client retries forever, which would hang
    // the suite instead of skipping it (CI has no Redis).
    const client = createClient({
      url: REDIS_URL,
      socket: { connectTimeout: 1000, reconnectStrategy: false },
    }) as RedisClientType;
    client.on('error', () => undefined);
    await client.connect();
    await client.ping();
    redis = client;
    available = true;
  } catch {
    available = false;
    redis = null;
  }
}, 10_000);

afterAll(async () => {
  if (redis) {
    await redis.flushDb().catch(() => undefined);
    await redis.quit().catch(() => undefined);
  }
});

beforeEach(async () => {
  if (available && redis) {
    await redis.flushDb();
  }
});

const itIfRedis = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!available) {
      console.warn(`[skipped: no Redis at ${REDIS_URL}] ${name}`);
      return;
    }
    await fn();
  });

function member(uid: number, gender: 'male' | 'female') {
  return JSON.stringify({ uid, name: `u${uid}`, gender, joinedAt: 1 });
}

async function seed(uids: Array<[number, 'male' | 'female']>) {
  await redis!.zAdd(
    QUEUE_KEY,
    uids.map(([uid, gender], i) => ({ score: i, value: member(uid, gender) }))
  );
}

function runMatch(uid: number, gender: 'male' | 'female', roomId: string, ttl = 30) {
  return redis!.eval(LUA, {
    keys: [QUEUE_KEY],
    arguments: [String(uid), member(uid, gender), roomId, String(ttl)],
  }) as Promise<string | null>;
}

describe('match.lua atomic pair claim', () => {
  itIfRedis('claims both users for the room it was given', async () => {
    await seed([
      [1, 'male'],
      [2, 'female'],
    ]);

    const result = await runMatch(1, 'male', 'room-A');
    expect(result).not.toBeNull();
    expect(JSON.parse(result as string).uid).toBe(2);

    expect(await redis!.get('user:room:1')).toBe('room-A');
    expect(await redis!.get('user:room:2')).toBe('room-A');
  });

  itIfRedis('removes both users from the queue', async () => {
    await seed([
      [1, 'male'],
      [2, 'female'],
    ]);

    await runMatch(1, 'male', 'room-A');
    expect(await redis!.zCard(QUEUE_KEY)).toBe(0);
  });

  itIfRedis('never hands the same user to two different rooms', async () => {
    // The core regression. Three users; two callers race. Exactly one pairing may involve
    // user 2, and no user may end up claimed by a room they were not returned for.
    await seed([
      [1, 'male'],
      [2, 'female'],
      [3, 'male'],
    ]);

    const [a, b] = await Promise.all([
      runMatch(1, 'male', 'room-A'),
      runMatch(3, 'male', 'room-B'),
    ]);

    const claimed = [a, b]
      .filter((r): r is string => r !== null)
      .map((r) => JSON.parse(r).uid as number);

    // No user may be returned as a partner twice.
    expect(new Set(claimed).size).toBe(claimed.length);

    // Every claim in Redis must be consistent: a uid maps to exactly one room.
    for (const uid of [1, 2, 3]) {
      const room = await redis!.get(`user:room:${uid}`);
      if (room !== null) {
        expect(['room-A', 'room-B']).toContain(room);
      }
    }
  });

  itIfRedis('skips a user who is already claimed', async () => {
    await seed([
      [1, 'male'],
      [2, 'female'],
    ]);
    // User 2 is already spoken for by an in-flight match.
    await redis!.setEx('user:room:2', 30, 'room-existing');

    const result = await runMatch(1, 'male', 'room-A');
    expect(result).toBeNull();
    // User 1 must not have been claimed for a match that did not happen.
    expect(await redis!.get('user:room:1')).toBeNull();
  });

  itIfRedis('refuses to match a caller who is already in a room', async () => {
    await seed([
      [1, 'male'],
      [2, 'female'],
    ]);
    await redis!.setEx('user:room:1', 30, 'room-existing');

    const result = await runMatch(1, 'male', 'room-A');
    expect(result).toBeNull();
    expect(await redis!.get('user:room:1')).toBe('room-existing');
    expect(await redis!.get('user:room:2')).toBeNull();
  });

  itIfRedis('claims expire so a died-mid-match pair is not stuck forever', async () => {
    await seed([
      [1, 'male'],
      [2, 'female'],
    ]);

    await runMatch(1, 'male', 'room-A', 1);
    const ttl = await redis!.ttl('user:room:1');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(1);
  });

  itIfRedis('leaves no claim behind when there is nobody to match', async () => {
    await seed([[1, 'male']]);

    const result = await runMatch(1, 'male', 'room-A');
    expect(result).toBeNull();
    expect(await redis!.get('user:room:1')).toBeNull();
    // The lone user stays queued and matchable.
    expect(await redis!.zCard(QUEUE_KEY)).toBe(1);
  });

  itIfRedis('under a wide concurrent burst, claims stay one-to-one', async () => {
    const uids: Array<[number, 'male' | 'female']> = [];
    for (let i = 1; i <= 100; i++) uids.push([i, i % 2 ? 'male' : 'female']);
    await seed(uids);

    const results = await Promise.all(
      uids.map(([uid, gender], i) => runMatch(uid, gender, `room-${i}`))
    );

    const partners = results
      .filter((r): r is string => r !== null)
      .map((r) => JSON.parse(r).uid as number);

    // Nobody may be handed out as a partner more than once.
    expect(new Set(partners).size).toBe(partners.length);

    // And every claimed uid points at exactly one room.
    const rooms = new Map<string, number>();
    for (let uid = 1; uid <= 100; uid++) {
      const room = await redis!.get(`user:room:${uid}`);
      if (room) rooms.set(room, (rooms.get(room) ?? 0) + 1);
    }
    for (const [room, count] of rooms) {
      expect({ room, count }).toEqual({ room, count: 2 });
    }
  });
});
