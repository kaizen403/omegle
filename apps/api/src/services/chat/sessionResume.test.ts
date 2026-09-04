import {
  mintResumeToken,
  verifyResumeToken,
  PendingSessionRegistry,
} from './sessionResume';

describe('resume tokens', () => {
  it('round-trips the uid it was minted for', () => {
    const token = mintResumeToken(4242);
    expect(verifyResumeToken(token)).toBe(4242);
  });

  it('refuses a token whose uid was edited', () => {
    // The whole point: a token must only ever resume its own session.
    const token = mintResumeToken(4242);
    const [, issued, mac] = token.split('.');
    expect(verifyResumeToken(`9999.${issued}.${mac}`)).toBeNull();
  });

  it('refuses a forged signature', () => {
    const token = mintResumeToken(4242);
    const [uid, issued] = token.split('.');
    expect(verifyResumeToken(`${uid}.${issued}.notarealmac`)).toBeNull();
    expect(verifyResumeToken(`${uid}.${issued}.`)).toBeNull();
  });

  it("refuses another uid's valid token as a resume for a different id", () => {
    const mallory = mintResumeToken(1);
    // Mallory's own token verifies as Mallory, never as the victim.
    expect(verifyResumeToken(mallory)).toBe(1);
    expect(verifyResumeToken(mallory)).not.toBe(2);
  });

  it('expires', () => {
    const old = mintResumeToken(7, Date.now() - 11 * 60 * 1000);
    expect(verifyResumeToken(old)).toBeNull();
  });

  it('rejects a token issued in the future', () => {
    const future = mintResumeToken(7, Date.now() + 5 * 60 * 1000);
    expect(verifyResumeToken(future)).toBeNull();
  });

  it('rejects malformed input without throwing', () => {
    for (const bad of [null, undefined, 42, '', 'a.b', 'a.b.c.d', 'x'.repeat(600), {}]) {
      expect(verifyResumeToken(bad as unknown)).toBeNull();
    }
  });

  it('rejects a non-numeric uid segment', () => {
    // Signature is computed over whatever the segments are, so a valid MAC over a junk uid
    // must still be refused.
    const forged = mintResumeToken('abc' as unknown as number);
    expect(verifyResumeToken(forged)).toBeNull();
  });
});

describe('PendingSessionRegistry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const session = { uid: 5, name: 'Ada', gender: 'female', roomId: 'room-1', partnerId: 9 };

  it('returns the held session to whoever claims it, and cancels teardown', () => {
    const reg = new PendingSessionRegistry();
    const onExpire = jest.fn();

    reg.hold(session, onExpire, 25_000);
    const claimed = reg.claim(5);

    expect(claimed).toMatchObject({ uid: 5, roomId: 'room-1', partnerId: 9 });

    jest.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();
    reg.destroy();
  });

  it('tears down when nobody comes back', () => {
    const reg = new PendingSessionRegistry();
    const onExpire = jest.fn();

    reg.hold(session, onExpire, 25_000);
    expect(onExpire).not.toHaveBeenCalled();

    jest.advanceTimersByTime(24_999);
    expect(onExpire).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(reg.has(5)).toBe(false);
    reg.destroy();
  });

  it('claiming twice yields nothing the second time', () => {
    const reg = new PendingSessionRegistry();
    reg.hold(session, jest.fn(), 25_000);

    expect(reg.claim(5)).not.toBeNull();
    expect(reg.claim(5)).toBeNull();
    reg.destroy();
  });

  it('a second drop replaces the first without stacking timers', () => {
    // Flapping connections must not accumulate timers, each firing a teardown.
    const reg = new PendingSessionRegistry();
    const first = jest.fn();
    const second = jest.fn();

    reg.hold(session, first, 25_000);
    reg.hold(session, second, 25_000);

    jest.advanceTimersByTime(60_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(reg.size()).toBe(0);
    reg.destroy();
  });

  it('release drops a session without running teardown', () => {
    const reg = new PendingSessionRegistry();
    const onExpire = jest.fn();

    reg.hold(session, onExpire, 25_000);
    reg.release(5);

    jest.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(reg.has(5)).toBe(false);
    reg.destroy();
  });

  it('keeps sessions independent', () => {
    const reg = new PendingSessionRegistry();
    const a = jest.fn();
    const b = jest.fn();

    reg.hold({ ...session, uid: 1 }, a, 10_000);
    reg.hold({ ...session, uid: 2 }, b, 30_000);

    jest.advanceTimersByTime(15_000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(reg.has(2)).toBe(true);

    jest.advanceTimersByTime(20_000);
    expect(b).toHaveBeenCalledTimes(1);
    reg.destroy();
  });

  it('destroy cancels everything pending', () => {
    const reg = new PendingSessionRegistry();
    const onExpire = jest.fn();
    reg.hold(session, onExpire, 25_000);

    reg.destroy();
    jest.advanceTimersByTime(60_000);

    expect(onExpire).not.toHaveBeenCalled();
    expect(reg.size()).toBe(0);
  });
});
