import { and, desc, eq } from 'drizzle-orm';
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
        const testIP = ipAddress === '127.0.0.1' ? '8.8.8.8' : ipAddress;
        location = await geolocationService.getLocationFromIP(testIP);
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

  async getDailyStats(date: string): Promise<DailyStats> {
    const users = await this.getUsersByDate(date);

    return {
      date,
      totalUsers: users.length,
      maleUsers: users.filter((u) => u.gender.toLowerCase() === 'male').length,
      femaleUsers: users.filter((u) => u.gender.toLowerCase() === 'female').length,
      otherUsers: users.filter((u) => !['male', 'female'].includes(u.gender.toLowerCase())).length,
    };
  }

  async getStatsForDateRange(startDate: string, endDate: string): Promise<DailyStats[]> {
    const stats: DailyStats[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateString = this.getDateString(currentDate);
      stats.push(await this.getDailyStats(dateString));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return stats;
  }

  async getTodayStats(): Promise<DailyStats> {
    return this.getDailyStats(this.getDateString());
  }

  async getLastNDaysStats(days: number = 7): Promise<DailyStats[]> {
    const stats: DailyStats[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      stats.push(await this.getDailyStats(this.getDateString(date)));
    }

    return stats.reverse();
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
