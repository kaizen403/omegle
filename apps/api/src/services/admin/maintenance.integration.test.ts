import { createClient, RedisClientType } from 'redis';
import { MaintenanceService } from './maintenance.service';
import { AnalyticsService, istDate } from './analytics.service';
import { RedisClient } from '../core/redis';

/**
 * Integration tests for the two pieces of state that must outlive the process.
 *
 * Both exist specifically because in-memory state was wrong: the maintenance flag used to be
 * a plain instance field, so every deploy silently reopened a site an operator had taken
 * down; and the only "total" the dashboard had was `room:count`, a gauge that decrements on
 * close and therefore can never answer "how many rooms have ever been created".
 *
 * Needs a real Redis. Set REDIS_TEST_URL to point at one; the suite skips itself when none is
 * reachable so CI without Redis stays green.
 */

const REDIS_URL = process.env.REDIS_TEST_URL || 'redis://127.0.0.1:6399';

let raw: RedisClientType | null = null;
let available = false;
let wrapper: RedisClient;

beforeAll(async () => {
  try {
    const client = createClient({
      url: REDIS_URL,
      socket: { connectTimeout: 1000, reconnectStrategy: false },
    }) as RedisClientType;
    client.on('error', () => undefined);
    await client.connect();
    await client.ping();
    raw = client;
    available = true;
    // Both services take a RedisClient wrapper; stand one in front of the test connection.
    wrapper = { getClient: () => client } as unknown as RedisClient;
  } catch {
    available = false;
    raw = null;
  }
}, 10_000);

afterAll(async () => {
  if (raw) {
    await raw.quit().catch(() => undefined);
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

describe('MaintenanceService', () => {
  beforeEach(async () => {
    if (available && raw) await raw.del('system:maintenance');
  });

  itIfRedis('defaults to open when nothing is stored', async () => {
    const svc = new MaintenanceService(wrapper);
    const state = await svc.init();
    expect(state.open).toBe(true);
    expect(svc.isOpen()).toBe(true);
  });

  itIfRedis('persists a maintenance window across a fresh process', async () => {
    // The whole point: a deploy must not reopen a site someone deliberately closed.
    const first = new MaintenanceService(wrapper);
    await first.set(false, 'Back in 10', 'harsha@vitap.in');

    const afterRestart = new MaintenanceService(wrapper);
    const restored = await afterRestart.init();

    expect(restored.open).toBe(false);
    expect(restored.message).toBe('Back in 10');
    expect(restored.changedBy).toBe('harsha@vitap.in');
    expect(afterRestart.isOpen()).toBe(false);
  });

  itIfRedis('reopening persists too', async () => {
    const svc = new MaintenanceService(wrapper);
    await svc.set(false, 'down', 'admin');
    await svc.set(true, null, 'admin');

    const fresh = new MaintenanceService(wrapper);
    expect((await fresh.init()).open).toBe(true);
  });

  itIfRedis('applies the new value synchronously for the join path', async () => {
    // The socket join check is synchronous, so a write must be visible to it immediately
    // rather than after the cache TTL.
    const svc = new MaintenanceService(wrapper);
    await svc.init();
    expect(svc.isOpen()).toBe(true);

    await svc.set(false, null, 'admin');
    expect(svc.isOpen()).toBe(false);
  });

  itIfRedis('trims and bounds the operator message', async () => {
    const svc = new MaintenanceService(wrapper);
    const state = await svc.set(false, '  ' + 'x'.repeat(400) + '  ', 'admin');
    expect(state.message).toHaveLength(280);
    expect(state.message?.startsWith(' ')).toBe(false);
  });

  itIfRedis('treats a blank message as no message', async () => {
    const svc = new MaintenanceService(wrapper);
    expect((await svc.set(false, '   ', 'admin')).message).toBeNull();
  });

  itIfRedis('fails open on unreadable stored state', async () => {
    // A corrupt flag must never keep the product down.
    await raw!.set('system:maintenance', 'not json');
    const svc = new MaintenanceService(wrapper);
    expect((await svc.init()).open).toBe(true);
  });
});

describe('AnalyticsService cumulative counters', () => {
  const keys = [
    'stats:rooms:created:total',
    'stats:matches:total',
    'stats:messages:total',
    'stats:peak:concurrent_users',
    `stats:rooms:created:${istDate()}`,
    `stats:matches:${istDate()}`,
    `stats:messages:${istDate()}`,
  ];

  beforeEach(async () => {
    if (available && raw) await raw.del(keys);
  });

  itIfRedis('counts rooms created and never decrements', async () => {
    const svc = new AnalyticsService(wrapper);
    svc.recordRoomCreated();
    svc.recordRoomCreated();
    svc.recordRoomCreated();
    await new Promise((r) => setTimeout(r, 150));

    const stats = await svc.getCumulative(0);
    expect(stats.roomsCreatedTotal).toBe(3);
    expect(stats.roomsCreatedToday).toBe(3);
  });

  itIfRedis('survives a new service instance (i.e. a restart)', async () => {
    const before = new AnalyticsService(wrapper);
    before.recordMatch();
    before.recordMatch();
    await new Promise((r) => setTimeout(r, 150));

    const afterRestart = new AnalyticsService(wrapper);
    expect((await afterRestart.getCumulative(0)).matchesTotal).toBe(2);
  });

  itIfRedis('tracks a concurrency high-water mark that only rises', async () => {
    const svc = new AnalyticsService(wrapper);
    await svc.recordConcurrentUsers(12);
    await svc.recordConcurrentUsers(40);
    await svc.recordConcurrentUsers(7);

    expect((await svc.getCumulative(0)).peakConcurrentUsers).toBe(40);
  });

  itIfRedis('gives daily buckets a TTL so the keyspace stays bounded', async () => {
    const svc = new AnalyticsService(wrapper);
    svc.recordMessage();
    await new Promise((r) => setTimeout(r, 150));

    const ttl = await raw!.ttl(`stats:messages:${istDate()}`);
    expect(ttl).toBeGreaterThan(0);
  });

  itIfRedis('caches reads and de-duplicates concurrent callers', async () => {
    const svc = new AnalyticsService(wrapper);
    svc.recordRoomCreated();
    await new Promise((r) => setTimeout(r, 150));

    const first = await svc.getCumulative(5000);
    // A later increment must not appear while the cache is warm.
    svc.recordRoomCreated();
    await new Promise((r) => setTimeout(r, 150));
    const second = await svc.getCumulative(5000);

    expect(second.roomsCreatedTotal).toBe(first.roomsCreatedTotal);
  });
});

describe('istDate', () => {
  it('rolls over at 18:30 UTC, which is midnight IST', () => {
    expect(istDate(Date.parse('2026-09-04T18:29:59Z'))).toBe('2026-09-04');
    expect(istDate(Date.parse('2026-09-04T18:30:00Z'))).toBe('2026-09-05');
  });
});
