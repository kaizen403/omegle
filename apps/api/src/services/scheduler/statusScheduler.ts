/**
 * Status Scheduler Service
 *
 * Opens the service for the nightly peak window and closes it outside of it. The window is
 * 9 PM to 2 AM IST, which CROSSES MIDNIGHT — the previous 3 PM to 11 PM window did not, and
 * the old hour-equality logic could not express one that does.
 *
 * Two bugs came out of that old approach and are fixed here:
 *
 * 1. It only acted on the exact hour a boundary was crossed. A process that started at
 *    11 PM — inside the window — sat closed until the next 9 PM, because no boundary fired
 *    while it was running. State is now derived from the current time on every tick, so
 *    booting mid-window opens immediately.
 *
 * 2. It set an in-memory flag that nothing enforced and nothing persisted. It now goes
 *    through the same maintenance state as the admin toggle, so a scheduled close actually
 *    stops users joining and survives a restart.
 *
 * The EC2 instance itself is started and stopped by EventBridge on the same schedule
 * (see infra/bootstrap-aws.sh); these hours must be kept in sync with those cron rules.
 */

import { logger } from '../../utils/logger';

/** IST is a fixed UTC+05:30 with no daylight saving. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Inclusive open hour and exclusive close hour, in IST. */
export const WINDOW_OPEN_HOUR = 21;
export const WINDOW_CLOSE_HOUR = 2;

/**
 * Is the given IST hour inside the nightly window?
 *
 * Handles a window that wraps past midnight: 21:00-01:59 is open, 02:00-20:59 is closed.
 */
export function isWithinWindow(
  hour: number,
  openHour = WINDOW_OPEN_HOUR,
  closeHour = WINDOW_CLOSE_HOUR
): boolean {
  if (openHour === closeHour) {
    return true;
  }
  // Wrapping window (e.g. 21 -> 2): open if at/after the open hour OR before the close hour.
  if (openHour > closeHour) {
    return hour >= openHour || hour < closeHour;
  }
  // Non-wrapping window (e.g. 9 -> 17).
  return hour >= openHour && hour < closeHour;
}

export function istHour(now: number = Date.now()): number {
  return new Date(now + IST_OFFSET_MS).getUTCHours();
}

export class StatusScheduler {
  private statusSetter: (status: boolean) => void;
  private broadcastStatus: (status: boolean) => void;
  private schedulerInterval: NodeJS.Timeout | null = null;

  /** Last state this scheduler applied, so it only acts on an actual change. */
  private lastApplied: boolean | null = null;

  constructor(statusSetter: (status: boolean) => void, broadcastStatus: (status: boolean) => void) {
    this.statusSetter = statusSetter;
    this.broadcastStatus = broadcastStatus;
    logger.info(
      `[SCHEDULER] Initialized - open ${WINDOW_OPEN_HOUR}:00 to ${WINDOW_CLOSE_HOUR}:00 IST daily`
    );
  }

  private checkSchedule(): void {
    const hour = istHour();
    const shouldBeOpen = isWithinWindow(hour);

    // Idempotent: derive the desired state and only act when it differs from what we last
    // applied, rather than firing on an exact boundary hour and hoping we were running.
    if (this.lastApplied === shouldBeOpen) {
      return;
    }

    logger.warn(
      `[SCHEDULER] ${hour}:00 IST - turning system ${shouldBeOpen ? 'ON' : 'OFF'} ` +
        `(window ${WINDOW_OPEN_HOUR}:00-${WINDOW_CLOSE_HOUR}:00 IST)`
    );
    this.lastApplied = shouldBeOpen;
    this.statusSetter(shouldBeOpen);
    this.broadcastStatus(shouldBeOpen);
  }

  public start(): void {
    if (this.schedulerInterval) {
      return;
    }
    logger.info('[SCHEDULER] Started');
    this.checkSchedule();
    this.schedulerInterval = setInterval(() => this.checkSchedule(), 60 * 1000);
    this.schedulerInterval.unref?.();
  }

  public stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      logger.info('[SCHEDULER] Stopped');
    }
  }
}
