import {
  isWithinWindow,
  isAutoCloseHour,
  istHour,
  StatusScheduler,
  WINDOW_OPEN_HOUR,
  WINDOW_CLOSE_HOUR,
} from './statusScheduler';

/**
 * The operating window is 21:00-02:00 IST, which wraps past midnight. The previous
 * implementation compared against a single boundary hour and could not express that, so these
 * tests pin the wrap explicitly.
 */
describe('isWithinWindow (21:00 - 02:00 IST)', () => {
  it('is open through the evening', () => {
    expect(isWithinWindow(21)).toBe(true);
    expect(isWithinWindow(22)).toBe(true);
    expect(isWithinWindow(23)).toBe(true);
  });

  it('stays open across midnight', () => {
    // The bug this guards: a naive `hour >= open && hour < close` closes at midnight.
    expect(isWithinWindow(0)).toBe(true);
    expect(isWithinWindow(1)).toBe(true);
  });

  it('closes at 02:00 and stays closed all day', () => {
    expect(isWithinWindow(2)).toBe(false);
    expect(isWithinWindow(3)).toBe(false);
    expect(isWithinWindow(13)).toBe(false);
    // 1 PM specifically — the owner called out that it must not stop then.
    expect(isWithinWindow(15)).toBe(false);
    expect(isWithinWindow(20)).toBe(false);
  });

  it('opens exactly on the hour and not before', () => {
    expect(isWithinWindow(20)).toBe(false);
    expect(isWithinWindow(21)).toBe(true);
  });

  it('covers all 24 hours with no gaps or double states', () => {
    const open: number[] = [];
    for (let h = 0; h < 24; h++) {
      if (isWithinWindow(h)) open.push(h);
    }
    // 21, 22, 23, 0, 1 — five hours.
    expect(open.sort((a, b) => a - b)).toEqual([0, 1, 21, 22, 23]);
  });

  it('still handles a non-wrapping window', () => {
    expect(isWithinWindow(10, 9, 17)).toBe(true);
    expect(isWithinWindow(17, 9, 17)).toBe(false);
    expect(isWithinWindow(8, 9, 17)).toBe(false);
  });

  it('treats an equal open and close as always open', () => {
    expect(isWithinWindow(3, 12, 12)).toBe(true);
  });

  it('uses the configured constants', () => {
    expect(WINDOW_OPEN_HOUR).toBe(21);
    expect(WINDOW_CLOSE_HOUR).toBe(2);
  });
});

describe('isAutoCloseHour', () => {
  it('is only 02:00 IST', () => {
    expect(isAutoCloseHour(2)).toBe(true);
    expect(isAutoCloseHour(1)).toBe(false);
    expect(isAutoCloseHour(17)).toBe(false);
    expect(isAutoCloseHour(21)).toBe(false);
  });
});

describe('StatusScheduler', () => {
  it('does not close the site during the afternoon — admin is in charge', () => {
    const applied: boolean[] = [];
    // 12:00 UTC = 17:30 IST
    const now = Date.parse('2026-09-04T12:00:00Z');
    const scheduler = new StatusScheduler(
      (status) => applied.push(status),
      () => undefined,
      () => now
    );
    scheduler.noteExternalChange(true);
    scheduler.start();
    expect(applied).toEqual([]);
    scheduler.stop();
  });

  it('closes at 02:00 IST and does not fire again', () => {
    const applied: boolean[] = [];
    // 20:30 UTC = 02:00 IST
    const now = Date.parse('2026-09-04T20:30:00Z');
    const scheduler = new StatusScheduler(
      (status) => applied.push(status),
      () => undefined,
      () => now
    );
    scheduler.noteExternalChange(true);
    scheduler.start();
    expect(applied).toEqual([false]);
    scheduler.tick();
    expect(applied).toEqual([false]);
    scheduler.stop();
  });

  it('does not undo an admin who reopened after the scheduled close hour passed', () => {
    const applied: boolean[] = [];
    // 12:00 UTC = 17:30 IST — not the close hour
    const now = Date.parse('2026-09-04T12:00:00Z');
    const scheduler = new StatusScheduler(
      (status) => applied.push(status),
      () => undefined,
      () => now
    );
    scheduler.start();
    scheduler.noteExternalChange(true);
    scheduler.tick();
    expect(applied).toEqual([]);
    scheduler.stop();
  });
});

describe('istHour', () => {
  it('converts UTC to IST', () => {
    // 15:30 UTC is 21:00 IST — the moment the window opens.
    expect(istHour(Date.parse('2026-09-04T15:30:00Z'))).toBe(21);
    // 20:30 UTC is 02:00 IST — the moment it closes.
    expect(istHour(Date.parse('2026-09-04T20:30:00Z'))).toBe(2);
    // 18:30 UTC is midnight IST.
    expect(istHour(Date.parse('2026-09-04T18:30:00Z'))).toBe(0);
  });

  it('agrees with the window across a full simulated day', () => {
    // Walk real instants rather than bare hour numbers, so a timezone mistake in istHour
    // would surface here even though isWithinWindow is correct.
    const openHours: number[] = [];
    for (let i = 0; i < 24; i++) {
      const instant = Date.parse('2026-09-04T00:00:00Z') + i * 3600_000;
      if (isWithinWindow(istHour(instant))) {
        openHours.push(istHour(instant));
      }
    }
    expect(openHours.sort((a, b) => a - b)).toEqual([0, 1, 21, 22, 23]);
  });
});
