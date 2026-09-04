import { BoundedRateLimiter, GlobalBudget } from './boundedRateLimiter';

describe('BoundedRateLimiter', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows a burst up to capacity then refuses', () => {
    const limiter = new BoundedRateLimiter({ capacity: 3, refillPerSecond: 1 });
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
    limiter.destroy();
  });

  it('keeps separate budgets per key', () => {
    const limiter = new BoundedRateLimiter({ capacity: 1, refillPerSecond: 1 });
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
    expect(limiter.tryConsume('b')).toBe(true);
    limiter.destroy();
  });

  it('refills over time', () => {
    jest.useFakeTimers();
    const limiter = new BoundedRateLimiter({ capacity: 2, refillPerSecond: 1 });
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);

    jest.advanceTimersByTime(1000);
    expect(limiter.tryConsume('a')).toBe(true);
    limiter.destroy();
  });

  it('never exceeds maxKeys, so a key flood cannot exhaust the heap', () => {
    // This is the property that makes the limiter safe against spoofed-IP floods.
    const limiter = new BoundedRateLimiter({ capacity: 5, refillPerSecond: 1, maxKeys: 10 });
    for (let i = 0; i < 5000; i++) {
      limiter.tryConsume(`key-${i}`);
    }
    expect(limiter.size()).toBeLessThanOrEqual(10);
    limiter.destroy();
  });

  it('evicts least-recently-used keys, retaining active ones', () => {
    const limiter = new BoundedRateLimiter({ capacity: 5, refillPerSecond: 0, maxKeys: 3 });
    limiter.tryConsume('old');
    limiter.tryConsume('b');
    limiter.tryConsume('c');
    // Touch 'old' so it is no longer the least recent, then push past the cap.
    limiter.tryConsume('old');
    limiter.tryConsume('d');

    expect(limiter.size()).toBeLessThanOrEqual(3);
    // 'old' was refreshed, so its consumed tokens should still be tracked.
    expect(limiter.remaining('old')).toBeLessThan(5);
    limiter.destroy();
  });

  it('supports a variable cost for expensive operations', () => {
    const limiter = new BoundedRateLimiter({ capacity: 10, refillPerSecond: 0 });
    expect(limiter.tryConsume('a', 6)).toBe(true);
    expect(limiter.tryConsume('a', 6)).toBe(false);
    expect(limiter.tryConsume('a', 4)).toBe(true);
    limiter.destroy();
  });

  it('reports a positive retry-after when exhausted', () => {
    const limiter = new BoundedRateLimiter({ capacity: 1, refillPerSecond: 0.5 });
    limiter.tryConsume('a');
    expect(limiter.tryConsume('a')).toBe(false);
    expect(limiter.retryAfterSeconds('a')).toBeGreaterThan(0);
    limiter.destroy();
  });
});

describe('GlobalBudget', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('caps total spend regardless of who is asking', () => {
    // The property that bounds the LLM and geolocation bill.
    const budget = new GlobalBudget(3);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
    expect(budget.tryConsume()).toBe(false);
  });

  it('resets after the window elapses', () => {
    jest.useFakeTimers();
    const budget = new GlobalBudget(1, 1000);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);

    jest.advanceTimersByTime(1001);
    expect(budget.tryConsume()).toBe(true);
  });

  it('reports usage', () => {
    const budget = new GlobalBudget(5);
    budget.tryConsume(2);
    expect(budget.stats().used).toBe(2);
    expect(budget.stats().limit).toBe(5);
  });
});
