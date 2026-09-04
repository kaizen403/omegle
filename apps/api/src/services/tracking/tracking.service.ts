import { and, desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db, userVisits } from '../../db';
import { geolocationService } from './geolocation.service';
import type { UserVisit, UserListItem, DailyStats, LocationData } from './types';

export class UserTrackingService {
  private getDateString(date: Date = new Date()): string {
    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toUserVisit(row: typeof userVisits.$inferSelect): UserVisit {
    return {
      uid: row.uid,
      name: row.name,
      gender: row.gender,
      timestamp: row.visitedAt.getTime(),
      ipAddress: row.ipAddress ?? undefined,
      location: (row.location as LocationData | null) ?? undefined,
    };
  }

  async trackUserVisit(
    uid: number,
    name: string,
    gender: string,
    ipAddress?: string
  ): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Development mode: Skipping user tracking for ${name} (${uid})`);
      return;
    }

    try {
      const visitDate = this.getDateString();
      const visitedAt = new Date();

      let location: LocationData | null = null;
      if (ipAddress) {
        // No substitution here. This used to rewrite 127.0.0.1 to 8.8.8.8 so a developer
        // would see a location locally, but the branch ran in production too: any request
        // that resolved to loopback got billed a geolocation lookup and was recorded with
        // Google's address instead of being left blank.
        location = await geolocationService.getLocationFromIP(ipAddress);
      }

      await db
        .insert(userVisits)
        .values({
          id: randomUUID(),
          uid,
          name,
          gender,
          ipAddress: ipAddress || null,
          location: location || null,
          visitedAt,
          visitDate,
        })
        .onConflictDoNothing({ target: [userVisits.visitDate, userVisits.uid] });

      const locationStr = location
        ? ` from ${location.city || location.locality || 'Unknown'}, ${location.countryName || location.country || 'Unknown'}`
        : '';
      console.log(
        `Tracked user visit: ${name} (${gender})${locationStr} [IP: ${ipAddress || 'N/A'}]`
      );
    } catch (error) {
      console.error('Error tracking user visit:', error);
    }
  }

  async getUsersByDate(date: string): Promise<UserVisit[]> {
    try {
      const rows = await db
        .select()
        .from(userVisits)
        .where(eq(userVisits.visitDate, date))
        .orderBy(desc(userVisits.visitedAt));

      return rows.map((row) => this.toUserVisit(row));
    } catch (error) {
      console.error('Error fetching users by date:', error);
      return [];
    }
  }

  private statsFromVisits(date: string, users: { gender: string }[]): DailyStats {
    return {
      date,
      totalUsers: users.length,
      maleUsers: users.filter((u) => u.gender.toLowerCase() === 'male').length,
      femaleUsers: users.filter((u) => u.gender.toLowerCase() === 'female').length,
      otherUsers: users.filter((u) => !['male', 'female'].includes(u.gender.toLowerCase())).length,
    };
  }

  private listDatesInclusive(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      dates.push(this.getDateString(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  async getDailyStats(date: string): Promise<DailyStats> {
    const users = await this.getUsersByDate(date);
    return this.statsFromVisits(date, users);
  }

  async getStatsForDates(dates: string[]): Promise<DailyStats[]> {
    if (dates.length === 0) {
      return [];
    }

    try {
      const rows = await db
        .select({ visitDate: userVisits.visitDate, gender: userVisits.gender })
        .from(userVisits)
        .where(inArray(userVisits.visitDate, dates));

      const byDate = new Map<string, { gender: string }[]>();
      for (const date of dates) {
        byDate.set(date, []);
      }
      for (const row of rows) {
        byDate.get(row.visitDate)?.push(row);
      }

      return dates.map((date) => this.statsFromVisits(date, byDate.get(date) ?? []));
    } catch (error) {
      console.error('Error fetching stats for dates:', error);
      return dates.map((date) => this.statsFromVisits(date, []));
    }
  }

  async getStatsForDateRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    return this.getStatsForDates(this.listDatesInclusive(startDate, endDate));
  }

  async getTodayStats(): Promise<DailyStats> {
    return this.getDailyStats(this.getDateString());
  }

  async getLastNDaysStats(days: number = 7): Promise<DailyStats[]> {
    const today = new Date();
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(this.getDateString(date));
    }
    return this.getStatsForDates(dates);
  }

  async getUsersList(date: string): Promise<UserListItem[]> {
    const users = await this.getUsersByDate(date);

    return users.map((visit) => {
      let city: string | undefined;
      let country: string | undefined;

      if (visit.location) {
        if (visit.location.location && typeof visit.location.location === 'object') {
          city = visit.location.location.city || visit.location.location.localityName;
        } else {
          city = visit.location.city || visit.location.localityName;
        }

        if (visit.location.country && typeof visit.location.country === 'object') {
          country = visit.location.country.name || visit.location.country.isoName;
        } else if (typeof visit.location.country === 'string') {
          country = visit.location.country;
        }

        if (!city && visit.location.principalSubdivision) {
          city = visit.location.principalSubdivision;
        }
      }

      return {
        uid: visit.uid,
        name: visit.name,
        gender: visit.gender,
        timestamp: visit.timestamp,
        city,
        country,
      };
    });
  }

  async getUserDetails(date: string, uid: number): Promise<UserVisit | null> {
    try {
      const rows = await db
        .select()
        .from(userVisits)
        .where(and(eq(userVisits.visitDate, date), eq(userVisits.uid, uid)))
        .limit(1);

      return rows[0] ? this.toUserVisit(rows[0]) : null;
    } catch (error) {
      console.error('Error fetching user details:', error);
      return null;
    }
  }
}

export const userTrackingService = new UserTrackingService();
