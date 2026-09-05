/**
 * Nightly auto-close.
 *
 * The admin dashboard toggle is the source of truth while the box is up. This
 * scheduler only does one thing: at 2:00 IST it takes the public site down.
 * It does not force the site closed all afternoon, and it does not undo an
 * admin who just opened (or closed) the product.
 *
 * The EC2 instance itself is still started and stopped by EventBridge
 * (see infra/bootstrap-aws.sh). WINDOW_OPEN_HOUR is when the box comes up;
 * WINDOW_CLOSE_HOUR is when this process closes the site and the box stops.
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

/** The one hour this scheduler is allowed to force the site down. */
export function isAutoCloseHour(hour: number, closeHour = WINDOW_CLOSE_HOUR): boolean {
  return hour === closeHour;
}

export class StatusScheduler {
  private statusSetter: (status: boolean) => void;
  private broadcastStatus: (status: boolean) => void;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private readonly now: () => number;

  /**
   * Last state this scheduler applied. `null` means it has not forced anything
   * this process — an admin toggle is in charge.
   */
  private lastApplied: boolean | null = null;

  constructor(
    statusSetter: (status: boolean) => void,
    broadcastStatus: (status: boolean) => void,
    now: () => number = Date.now
  ) {
    this.statusSetter = statusSetter;
    this.broadcastStatus = broadcastStatus;
    this.now = now;
    logger.info(
      `[SCHEDULER] Initialized — auto-close at ${WINDOW_CLOSE_HOUR}:00 IST; admin toggle otherwise`
    );
  }

  /** Keep the 2 AM close from fighting a toggle the admin just made. */
  noteExternalChange(open: boolean): void {
    this.lastApplied = open;
  }

  /** Exposed for tests. */
  tick(): void {
    this.checkSchedule();
  }

  private checkSchedule(): void {
    const hour = istHour(this.now());
    if (!isAutoCloseHour(hour)) {
      return;
    }
    if (this.lastApplied === false) {
      return;
    }

    logger.warn(
      `[SCHEDULER] ${hour}:00 IST — scheduled close. Admin can reopen from the dashboard until the box stops.`
    );
    this.lastApplied = false;
    this.statusSetter(false);
    this.broadcastStatus(false);
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
