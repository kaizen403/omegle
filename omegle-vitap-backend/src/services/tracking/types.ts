/**
 * User Tracking Types
 * Type definitions for user tracking functionality
 */

export interface UserVisit {
  name: string;
  gender: string;
  timestamp: number;
  uid: number;
  ipAddress?: string;
  location?: LocationData;
}

export interface UserListItem {
  uid: number;
  name: string;
  gender: string;
  timestamp: number;
  city?: string;
  country?: string;
}

export interface DailyStats {
  date: string;
  totalUsers: number;
  maleUsers: number;
  femaleUsers: number;
  otherUsers: number;
}

export interface LocationData {
  [key: string]: any;
}
