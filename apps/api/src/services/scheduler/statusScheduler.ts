/**
 * Status Scheduler Service
 * Peak window: ON at 3 PM IST, OFF at 11 PM IST (matches EventBridge EC2 hours).
 */

import { logger } from '../../utils/logger';

// IST is UTC+5:30
const IST_OFFSET_HOURS = 5;
const IST_OFFSET_MINUTES = 30;

export class StatusScheduler {
  private statusSetter: (status: boolean) => void;
  private broadcastStatus: (status: boolean) => void;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private lastTriggeredHour: number = -1;

  constructor(statusSetter: (status: boolean) => void, broadcastStatus: (status: boolean) => void) {
    this.statusSetter = statusSetter;
    this.broadcastStatus = broadcastStatus;
    logger.info('[SCHEDULER] Initialized - Auto ON at 3 PM IST, OFF at 11 PM IST');
  }

  private getCurrentISTHour(): number {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const istTime = new Date(utc + 3600000 * IST_OFFSET_HOURS + 60000 * IST_OFFSET_MINUTES);
    return istTime.getHours();
  }

  private checkSchedule(): void {
    const hour = this.getCurrentISTHour();

    if (hour === this.lastTriggeredHour) {
      return;
    }

    if (hour === 15) {
      logger.info('[SCHEDULER] 3 PM IST - Turning system ON');
      this.statusSetter(true);
      this.broadcastStatus(true);
      this.lastTriggeredHour = hour;
    }

    if (hour === 23) {
      logger.info('[SCHEDULER] 11 PM IST - Turning system OFF');
      this.statusSetter(false);
      this.broadcastStatus(false);
      this.lastTriggeredHour = hour;
    }
  }

  public start(): void {
    if (this.schedulerInterval) {
      return;
    }
    logger.info('[SCHEDULER] Started');
    this.checkSchedule();
    this.schedulerInterval = setInterval(() => this.checkSchedule(), 60 * 1000);
  }

  public stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      logger.info('[SCHEDULER] Stopped');
    }
  }
}
