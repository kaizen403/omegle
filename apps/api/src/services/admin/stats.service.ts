import { userTrackingService } from '../tracking';

/**
 * Service for admin statistics and reporting
 */
export class AdminStatsService {
  /**
   * Get statistics for today
   */
  async getTodayStats(): Promise<any> {
    // Visit rows are keyed by IST date in Neon — do not use UTC here.
    return userTrackingService.getTodayStats();
  }

  /**
   * Get statistics for a specific date
   */
  async getDateStats(date: string): Promise<any> {
    this.validateDateFormat(date);
    return await userTrackingService.getDailyStats(date);
  }

  /**
   * Get statistics for a date range
   */
  async getDateRangeStats(startDate: string, endDate: string): Promise<any> {
    this.validateDateFormat(startDate);
    this.validateDateFormat(endDate);

    return await userTrackingService.getStatsForDateRange(startDate, endDate);
  }

  /**
   * Get statistics for the last N days
   */
  async getLastDaysStats(days: number): Promise<any> {
    if (isNaN(days) || days < 1 || days > 365) {
      throw new Error('Invalid number of days. Must be between 1 and 365');
    }

    return await userTrackingService.getLastNDaysStats(days);
  }

  /**
   * Get list of users for a specific date (lightweight list with city/country)
   */
  async getUsersList(date: string): Promise<any[]> {
    this.validateDateFormat(date);
    return await userTrackingService.getUsersList(date);
  }

  /**
   * Get detailed user information for a specific date
   */
  async getUserDetails(date: string, uid: string): Promise<any | null> {
    this.validateDateFormat(date);

    if (!uid) {
      throw new Error('User ID is required');
    }

    // Convert string UID to number for userTrackingService
    const numericUid = parseInt(uid, 10);
    if (isNaN(numericUid)) {
      throw new Error('Invalid user ID format');
    }

    return await userTrackingService.getUserDetails(date, numericUid);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private validateDateFormat(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
  }
}

export default new AdminStatsService();
