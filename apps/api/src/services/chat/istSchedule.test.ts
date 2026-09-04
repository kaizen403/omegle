import { MatchmakingService } from './matchmaking.service';

/**
 * The IST reset helpers are private statics; reach them through the class object rather than
 * exporting internals purely for the test.
 */
const svc = MatchmakingService as unknown as {
  msUntilIstMidnight(now?: number): number;
  istDateString(now?: number): string;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 2026-09-04T00:00:00Z === 2026-09-04 05:30 IST */
const UTC_MIDNIGHT = Date.parse('2026-09-04T00:00:00Z');

describe('IST scheduling', () => {
  describe('istDateString', () => {
    it('reports the IST calendar date, not the UTC one', () => {
      // 2026-09-04T19:00Z is already 2026-09-05 in IST (00:30 next day).
      expect(svc.istDateString(Date.parse('2026-09-04T19:00:00Z'))).toBe('2026-09-05');
      // 2026-09-04T17:00Z is 22:30 IST — still the 4th.
      expect(svc.istDateString(Date.parse('2026-09-04T17:00:00Z'))).toBe('2026-09-04');
    });

    it('rolls over exactly at 18:30 UTC', () => {
      expect(svc.istDateString(Date.parse('2026-09-04T18:29:59Z'))).toBe('2026-09-04');
      expect(svc.istDateString(Date.parse('2026-09-04T18:30:00Z'))).toBe('2026-09-05');
    });
  });

  describe('msUntilIstMidnight', () => {
    it('returns the exact remaining time at IST midnight boundaries', () => {
      // 18:30:00Z is precisely 00:00 IST, so a full day remains until the next one.
      expect(svc.msUntilIstMidnight(Date.parse('2026-09-04T18:30:00Z'))).toBe(DAY);
    });

    it('counts down correctly through the day', () => {
      // 17:30Z = 23:00 IST -> one hour to midnight.
      expect(svc.msUntilIstMidnight(Date.parse('2026-09-04T17:30:00Z'))).toBe(HOUR);
      // 00:00Z = 05:30 IST -> 18h30m remaining.
      expect(svc.msUntilIstMidnight(UTC_MIDNIGHT)).toBe(18 * HOUR + 30 * 60 * 1000);
    });

    it('always returns a positive delay within one day', () => {
      // The old implementation mixed an IST wall-clock reading with a UTC timestamp, which
      // could yield a delay hours off (and even negative) depending on the host timezone.
      for (let offset = 0; offset < DAY; offset += 37 * 60 * 1000) {
        const delay = svc.msUntilIstMidnight(UTC_MIDNIGHT + offset);
        expect(delay).toBeGreaterThan(0);
        expect(delay).toBeLessThanOrEqual(DAY);
      }
    });

    it('lands exactly on an IST midnight when the delay elapses', () => {
      const now = Date.parse('2026-09-04T09:13:47Z');
      const fireAt = now + svc.msUntilIstMidnight(now);

      // Firing instant must be 00:00 IST, i.e. 18:30 UTC.
      const fired = new Date(fireAt);
      expect(fired.getUTCHours()).toBe(18);
      expect(fired.getUTCMinutes()).toBe(30);
      expect(fired.getUTCSeconds()).toBe(0);
      expect(fired.getUTCMilliseconds()).toBe(0);
    });

    it('advances the reported date across the reset', () => {
      const now = Date.parse('2026-09-04T09:13:47Z');
      const before = svc.istDateString(now);
      const after = svc.istDateString(now + svc.msUntilIstMidnight(now));

      expect(before).toBe('2026-09-04');
      expect(after).toBe('2026-09-05');
    });
  });
});
