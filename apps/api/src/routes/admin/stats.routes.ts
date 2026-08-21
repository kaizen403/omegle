/**
 * Admin Statistics Routes
 * Handles user statistics, analytics
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { statsService } from '../../services/admin';

const router = Router();

/**
 * GET /api/admin/stats/today
 * Get today's user statistics
 */
router.get('/today', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await statsService.getTodayStats();

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get today stats error:', error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching today's statistics",
    });
  }
});

/**
 * GET /api/admin/stats/date/:date
 * Get statistics for a specific date (format: YYYY-MM-DD)
 */
router.get('/date/:date', requireAuth, async (req: Request, res: Response) => {
  try {
    const { date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const stats = await statsService.getDateStats(date);

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get date stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching statistics',
    });
  }
});

/**
 * GET /api/admin/stats/range?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Get statistics for a date range
 */
router.get('/range', requireAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Start and end dates are required',
      });
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start as string) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end as string)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const stats = await statsService.getDateRangeStats(start as string, end as string);

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get range stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching statistics',
    });
  }
});

/**
 * GET /api/admin/stats/last-days/:days
 * Get statistics for the last N days
 */
router.get('/last-days/:days', requireAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.params.days);

    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        message: 'Invalid number of days. Must be between 1 and 365',
      });
    }

    const stats = await statsService.getLastDaysStats(days);

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get last days stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching statistics',
    });
  }
});

export default router;
